#!/usr/bin/env python3
"""
build_apk.py — Build a correct APK v2 package for OpenWrt / Alpine apk-tools.

APK v2 = two concatenated gzip members:
  Member 1 (control): gzip(tar containing .PKGINFO + hook scripts)
  Member 2 (data):    gzip(tar containing actual filesystem files)

Critical: .PKGINFO must contain a 'datahash' field = SHA-256 of the data
gzip member bytes.  apk-tools uses this to verify package integrity; its
absence causes "unexpected end of file" even when the file is structurally OK.

Build order: data stream first → SHA-256 → embed in .PKGINFO → control stream.

Usage:
  python3 build_apk.py [--version VERSION] [--arch ARCH] [--output OUTPUT_DIR]
"""

import argparse
import gzip
import hashlib
import io
import os
import stat
import sys
import tarfile
import time

# ── Package metadata (parsed from Makefile) ───────────────────────────────────

def parse_makefile(makefile_path: str = None) -> dict:
    if makefile_path is None:
        makefile_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Makefile")
    meta = {}
    if not os.path.isfile(makefile_path):
        return meta
    with open(makefile_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":=" in line:
                k, v = line.split(":=", 1)
                meta[k.strip()] = v.strip()
            elif "=" in line:
                k, v = line.split("=", 1)
                meta[k.strip()] = v.strip()
    return meta


_meta = parse_makefile()

PKG_NAME       = _meta.get("PKG_NAME", "luci-app-leigod-manager")
PKG_VERSION    = _meta.get("PKG_VERSION", "1.0.1")
PKG_RELEASE    = _meta.get("PKG_RELEASE", "1")
PKG_ARCH       = "noarch" if _meta.get("LUCI_PKGARCH", "all") == "all" else _meta.get("LUCI_PKGARCH", "noarch")
PKG_DESC       = _meta.get("LUCI_TITLE", "LuCI support for Leigod Accelerator Manager (fw4/nftables compatible)")
PKG_URL        = "https://github.com/ArlenDu/luci-leigod-manager"
PKG_MAINTAINER = _meta.get("PKG_MAINTAINER", "Arlen Du")
PKG_LICENSE    = _meta.get("PKG_LICENSE", "GPL-2.0-only")

# Parse depends from Makefile: "+leigod-acc" -> ["luci-base", "leigod-acc"]
_raw_deps = _meta.get("LUCI_DEPENDS", "")
_dep_list = ["luci-base"]
for _d in _raw_deps.split():
    _d = _d.lstrip("+").strip()
    if _d and _d not in _dep_list:
        _dep_list.append(_d)
PKG_DEPS = _dep_list

# ── Helpers ───────────────────────────────────────────────────────────────────

def add_file_to_tar(tf: tarfile.TarFile, arcname: str, content: bytes,
                    mode: int = 0o644, mtime: int = 0):
    """Add in-memory bytes as a file entry to a TarFile object."""
    info = tarfile.TarInfo(name=arcname)
    info.size  = len(content)
    info.mode  = mode
    info.mtime = mtime
    info.type  = tarfile.REGTYPE
    info.uid   = 0
    info.gid   = 0
    info.uname = "root"
    info.gname = "root"
    tf.addfile(info, io.BytesIO(content))


def add_disk_file(tf: tarfile.TarFile, arcname: str, disk_path: str, mtime: int = 0):
    """Add a file from disk into a TarFile with normalised metadata."""
    info = tf.gettarinfo(disk_path, arcname=arcname)
    info.uid   = 0
    info.gid   = 0
    info.uname = "root"
    info.gname = "root"
    info.mtime = mtime
    with open(disk_path, "rb") as fh:
        tf.addfile(info, fh)


def make_gz_bytes(build_tar_fn) -> bytes:
    """
    Call build_tar_fn(tf) to populate a TarFile, then return the gzip-compressed
    bytes of that tar.  Uses mtime=0 for reproducibility.
    """
    raw_buf = io.BytesIO()
    with tarfile.open(fileobj=raw_buf, mode="w", format=tarfile.PAX_FORMAT) as tf:
        build_tar_fn(tf)
    raw_buf.seek(0)

    gz_buf = io.BytesIO()
    with gzip.GzipFile(fileobj=gz_buf, mode="wb", mtime=0, compresslevel=9) as gz:
        gz.write(raw_buf.read())
    return gz_buf.getvalue()


def make_control_gz_bytes(build_tar_fn) -> bytes:
    """
    Build a gzip'd tar SEGMENT for the APK control stream.

    APK v2 key rule: apk-tools decompresses ALL gzip streams into one
    concatenated byte sequence, then reads it as a single tar archive:

        zcat(ctrl.gz) + zcat(data.gz)  →  one big tar

    A complete tar ends with two 512-byte null blocks (EOF marker), so if
    the control tar includes them, the tar reader stops there and never
    reaches the data files — causing "unexpected end of file".

    Fix: strip ALL trailing null 512-byte blocks from the control tar before
    compressing.  The data tar MUST keep its null blocks (standard tar EOF).

    Python's tarfile also pads to RECORDSIZE (10240 bytes), so there may be
    more than 1024 trailing null bytes; we strip all of them.
    """
    raw_buf = io.BytesIO()
    with tarfile.open(fileobj=raw_buf, mode="w") as tf:
        build_tar_fn(tf)

    raw_bytes = raw_buf.getvalue()

    # Strip all trailing null 512-byte blocks (EOT marker + blocking padding)
    end = len(raw_bytes)
    while end >= 512 and raw_bytes[end - 512:end] == b'\x00' * 512:
        end -= 512
    raw_bytes = raw_bytes[:end]

    gz_buf = io.BytesIO()
    with gzip.GzipFile(fileobj=gz_buf, mode="wb", mtime=0, compresslevel=9) as gz:
        gz.write(raw_bytes)
    return gz_buf.getvalue()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Build APK v2 package")
    parser.add_argument("--version", default=PKG_VERSION, help=f"Package version (default: {PKG_VERSION})")
    parser.add_argument("--arch",    default=PKG_ARCH,    help=f"Package arch (default: {PKG_ARCH})")
    parser.add_argument("--output",  default="dist",       help="Output directory (default: dist)")
    args = parser.parse_args()

    # In apk-tools, architecture-independent packages MUST use 'noarch', not 'all'
    target_arch = "noarch" if args.arch == "all" else args.arch

    rel_num = int(PKG_RELEASE) - 1 if PKG_RELEASE.isdigit() and int(PKG_RELEASE) > 0 else 0
    pkg_ver  = f"{args.version}-r{rel_num}" if "-r" not in args.version else args.version
    src_root = os.path.dirname(os.path.abspath(__file__))
    out_dir  = os.path.join(src_root, args.output)
    os.makedirs(out_dir, exist_ok=True)

    build_mtime = 0  # use 0 for reproducible builds

    print(f"==> Building {PKG_NAME} {pkg_ver} ({args.arch}) [APK v2]")

    # ── Collect data files ────────────────────────────────────────────────────
    # Map: archive_path → disk_path
    data_files: list[tuple[str, str, int]] = []  # (arcname, diskpath, mode)

    def add_data(arc: str, rel: str, mode: int = 0o644):
        disk = os.path.join(src_root, rel)
        if not os.path.isfile(disk):
            print(f"  [WARN] missing: {disk}", file=sys.stderr)
            return
        data_files.append((arc, disk, mode))

    # JS views
    for js in ["overview.js", "settings.js", "install.js", "logs.js"]:
        add_data(
            f"www/luci-static/resources/view/leigod/{js}",
            f"htdocs/luci-static/resources/view/leigod/{js}"
        )

    # Menu & ACL
    add_data(
        "usr/share/luci/menu.d/luci-app-leigod-manager.json",
        "root/usr/share/luci/menu.d/luci-app-leigod-manager.json"
    )
    add_data(
        "usr/share/rpcd/acl.d/luci-app-leigod-manager.json",
        "root/usr/share/rpcd/acl.d/luci-app-leigod-manager.json"
    )

    # rpcd plugin & init.d
    add_data("usr/libexec/rpcd/leigod",   "root/usr/libexec/rpcd/leigod",   0o755)
    add_data("etc/init.d/leigod-acc",      "root/etc/init.d/leigod-acc",      0o755)
    add_data("etc/config/leigod-manager",  "root/etc/config/leigod-manager",  0o644)

    # i18n
    for lang in ["en", "zh_Hans"]:
        po_src = os.path.join(src_root, f"po/{lang}/luci-app-leigod-manager.po")
        if os.path.isfile(po_src):
            data_files.append((
                f"usr/share/luci/i18n/{PKG_NAME}.{lang}.po",
                po_src, 0o644
            ))

    # Compute installed size
    installed_size = sum(os.path.getsize(d) for _, d, _ in data_files)
    print(f"    Installed size: {installed_size} bytes, {len(data_files)} files")

    # Hook scripts (needed before building control)
    post_install = """\
#!/bin/sh
# Ensure /dev/net/tun exists with proper permissions
mkdir -p /dev/net 2>/dev/null
[ -c /dev/net/tun ] || mknod /dev/net/tun c 10 200 2>/dev/null || true
chmod 0666 /dev/net/tun 2>/dev/null || true
modprobe tun 2>/dev/null || true

# Ensure tproxy_ip is 10.20.30.40
[ -f /etc/config/acc_firewall.ini ] && sed -i 's/^tproxy_ip=.*/tproxy_ip=10.20.30.40/' /etc/config/acc_firewall.ini 2>/dev/null || true

# Disable legacy procd acc init to avoid conflict with monitor.sh
[ -f /etc/init.d/acc ] && {
    /etc/init.d/acc stop 2>/dev/null || true
    /etc/init.d/acc disable 2>/dev/null || true
}
if [ -x /etc/init.d/leigod-acc ]; then
    chmod 0755 /etc/init.d/leigod-acc 2>/dev/null || true
    /etc/init.d/leigod-acc enable 2>/dev/null || true
fi
[ -x /usr/libexec/rpcd/leigod ] && chmod 0755 /usr/libexec/rpcd/leigod
rm -f /tmp/luci-indexcache.* 2>/dev/null || true
rm -rf /tmp/luci-modulecache/ 2>/dev/null || true
# Reload rpcd (SIGHUP) to register new plugins and ACLs without terminating active user sessions
if [ -x /etc/init.d/rpcd ]; then
    /etc/init.d/rpcd reload 2>/dev/null || killall -HUP rpcd 2>/dev/null || true
else
    killall -HUP rpcd 2>/dev/null || true
fi
exit 0
"""

    pre_deinstall = """\
#!/bin/sh
[ -x /etc/init.d/leigod-acc ] && {
    /etc/init.d/leigod-acc stop    2>/dev/null || true
    /etc/init.d/leigod-acc disable 2>/dev/null || true
}
exit 0
"""

    # ── MEMBER 2: data stream (built FIRST to get SHA-256 for datahash) ───────
    def build_data_tar(tf: tarfile.TarFile):
        seen_dirs: set[str] = set()

        def ensure_dir(arc_dir: str):
            parts = arc_dir.strip("/.").split("/")
            for i in range(len(parts)):
                d = "/".join(parts[:i + 1])
                if d and d not in seen_dirs:
                    di = tarfile.TarInfo(name=d)
                    di.type  = tarfile.DIRTYPE
                    di.mode  = 0o755
                    di.mtime = build_mtime
                    di.uid   = di.gid = 0
                    di.uname = di.gname = "root"
                    tf.addfile(di)
                    seen_dirs.add(d)

        for arcname, diskpath, mode in data_files:
            ensure_dir(os.path.dirname(arcname))
            with open(diskpath, "rb") as fh:
                content = fh.read()
            sha1_hex = hashlib.sha1(content).hexdigest()
            info = tarfile.TarInfo(name=arcname)
            info.size  = len(content)
            info.mode  = mode
            info.mtime = build_mtime
            info.uid   = info.gid = 0
            info.uname = info.gname = "root"
            info.pax_headers = {
                "APK-TOOLS.checksum.SHA1": sha1_hex,
                "xattr.APK-TOOLS.checksum.SHA1": sha1_hex,
            }
            tf.addfile(info, io.BytesIO(content))

    print("==> Building data stream...")
    data_gz = make_gz_bytes(build_data_tar)
    data_sha256 = hashlib.sha256(data_gz).hexdigest()
    print(f"    data.tar.gz: {len(data_gz)} bytes  sha256={data_sha256[:16]}...")

    # ── MEMBER 1: control stream (uses datahash from data stream) ─────────────
    # datahash = SHA-256 of the gzip'd data section bytes (apk-tools requirement)
    pkginfo = "\n".join([
        "# Generated by build_apk.py",
        f"pkgname = {PKG_NAME}",
        f"pkgver = {pkg_ver}",
        f"arch = {target_arch}",
        f"size = {installed_size}",
        f"pkgdesc = {PKG_DESC}",
        f"url = {PKG_URL}",
        f"builddate = {int(time.time())}",
        f"packager = {PKG_MAINTAINER}",
        f"datahash = {data_sha256}",
    ] + [f"depend = {d}" for d in PKG_DEPS]) + "\n"

    def build_control_tar(tf: tarfile.TarFile):
        add_file_to_tar(tf, ".PKGINFO",       pkginfo.encode(),       0o644, build_mtime)
        add_file_to_tar(tf, ".post-install",  post_install.encode(),  0o755, build_mtime)
        add_file_to_tar(tf, ".pre-deinstall", pre_deinstall.encode(), 0o755, build_mtime)

    print("==> Building control stream (tar segment, no null blocks)...")
    ctrl_gz = make_control_gz_bytes(build_control_tar)
    print(f"    control.tar.gz: {len(ctrl_gz)} bytes")

    # ── Concatenate: control + data → .apk ───────────────────────────────────
    apk_filename = f"{PKG_NAME}_{args.version}_{target_arch}.apk"
    apk_path = os.path.join(out_dir, apk_filename)
    with open(apk_path, "wb") as f:
        f.write(ctrl_gz)
        f.write(data_gz)
    print(f"==> Written: {apk_path}")

    # Also write / copy to _all.apk for compatibility with tools looking for _all.apk
    all_path = os.path.join(out_dir, f"{PKG_NAME}_{args.version}_all.apk")
    if all_path != apk_path:
        with open(all_path, "wb") as f:
            f.write(ctrl_gz)
            f.write(data_gz)
        print(f"==> Also written: {all_path}")

    # ── Verify: check both streams at their exact known offsets ─────────────
    print(f"\n==> Gzip stream verification:")
    try:
        c_raw = gzip.decompress(ctrl_gz)
        print(f"    Stream 1 (control): offset=0  gz={len(ctrl_gz)}B  data={len(c_raw)}B  ✓")
    except Exception as e:
        print(f"    Stream 1 (control): DECOMPRESS ERROR: {e}")

    try:
        d_raw = gzip.decompress(data_gz)
        print(f"    Stream 2 (data): offset={len(ctrl_gz)}  gz={len(data_gz)}B  data={len(d_raw)}B  ✓")
    except Exception as e:
        print(f"    Stream 2 (data): DECOMPRESS ERROR: {e}")

    if c_raw and d_raw:
        size_kb = os.path.getsize(apk_path) // 1024
        print(f"\n✅  Build successful!")
        print(f"    File : {apk_path}")
        print(f"    Size : {size_kb}K")
        print(f"\nDeploy to router (OpenWrt with apk):")
        print(f"    scp {apk_path} root@<router-ip>:/tmp/")
        print(f"    ssh root@<router-ip> 'apk add --allow-untrusted /tmp/{apk_filename}'")
    else:
        print(f"\n❌ Verification FAILED: streams failed to decompress")
        sys.exit(1)


if __name__ == "__main__":
    main()

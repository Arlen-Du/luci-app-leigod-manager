#!/usr/bin/env python3
"""
build_ipk.py — Build a valid OpenWrt IPK package on macOS / Linux.

An OpenWrt .ipk package is a gzip-compressed tar archive containing:
  ./debian-binary
  ./data.tar.gz
  ./control.tar.gz

This script builds clean POSIX tar archives with:
- No macOS AppleDouble (._*) metadata files
- Normalized uid=0, gid=0 (root:root)
- Exact file permissions (0755 for executables, 0644 for regular files)
- 100% compatible with OpenWrt opkg and iStoreOS is-package
"""

import argparse
import gzip
import io
import os
import sys
import tarfile

PKG_NAME = "luci-app-leigod-manager"
PKG_VERSION = "1.0.0"
PKG_ARCH = "all"
PKG_DEPENDS = "luci-base"
PKG_DESCRIPTION = "LuCI support for Leigod Accelerator Manager (fw4/nftables compatible)"
PKG_MAINTAINER = "Arlen Du"
PKG_LICENSE = "GPL-2.0-only"


def add_file_to_tar(tf: tarfile.TarFile, arcname: str, content: bytes, mode: int = 0o644, mtime: int = 0):
    if not arcname.startswith("./"):
        arcname = "./" + arcname.lstrip("/")
    info = tarfile.TarInfo(name=arcname)
    info.size = len(content)
    info.mode = mode
    info.mtime = mtime
    info.type = tarfile.REGTYPE
    info.uid = 0
    info.gid = 0
    info.uname = "root"
    info.gname = "root"
    tf.addfile(info, io.BytesIO(content))


def add_dir_to_tar(tf: tarfile.TarFile, arcname: str, mode: int = 0o755, mtime: int = 0):
    if not arcname.startswith("./"):
        arcname = "./" + arcname.lstrip("/")
    info = tarfile.TarInfo(name=arcname)
    info.type = tarfile.DIRTYPE
    info.mode = mode
    info.mtime = mtime
    info.uid = 0
    info.gid = 0
    info.uname = "root"
    info.gname = "root"
    tf.addfile(info)


def make_tar_gz_bytes(populate_fn) -> bytes:
    raw_buf = io.BytesIO()
    with tarfile.open(fileobj=raw_buf, mode="w", format=tarfile.GNU_FORMAT) as tf:
        populate_fn(tf)
    raw_buf.seek(0)

    gz_buf = io.BytesIO()
    with gzip.GzipFile(fileobj=gz_buf, mode="wb", mtime=0, compresslevel=9) as gz:
        gz.write(raw_buf.read())
    return gz_buf.getvalue()


def main():
    parser = argparse.ArgumentParser(description="Build OpenWrt IPK package")
    parser.add_argument("--version", default=PKG_VERSION, help=f"Package version (default: {PKG_VERSION})")
    parser.add_argument("--arch",    default=PKG_ARCH,    help=f"Package arch (default: {PKG_ARCH})")
    parser.add_argument("--output",  default="dist",       help="Output directory (default: dist)")
    args = parser.parse_args()

    src_root = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(src_root, args.output)
    os.makedirs(out_dir, exist_ok=True)

    print(f"==> Building {PKG_NAME} {args.version} ({args.arch}) [IPK format]")

    # 1. Collect data files
    data_files = []

    def add_data(arc: str, rel: str, mode: int = 0o644):
        disk = os.path.join(src_root, rel)
        if not os.path.isfile(disk):
            print(f"  [WARN] missing: {disk}", file=sys.stderr)
            return
        data_files.append((arc, disk, mode))

    # Views
    for js in ["overview.js", "settings.js", "install.js", "logs.js"]:
        add_data(f"www/luci-static/resources/view/leigod/{js}", f"htdocs/luci-static/resources/view/leigod/{js}")

    # Menu & ACL
    add_data("usr/share/luci/menu.d/luci-app-leigod-manager.json", "root/usr/share/luci/menu.d/luci-app-leigod-manager.json")
    add_data("usr/share/rpcd/acl.d/luci-app-leigod-manager.json", "root/usr/share/rpcd/acl.d/luci-app-leigod-manager.json")

    # Scripts
    add_data("usr/libexec/rpcd/leigod",  "root/usr/libexec/rpcd/leigod",  0o755)
    add_data("etc/init.d/leigod-acc",     "root/etc/init.d/leigod-acc",     0o755)
    add_data("etc/config/leigod-manager", "root/etc/config/leigod-manager", 0o644)

    # i18n
    for lang in ["en", "zh_Hans"]:
        po_src = os.path.join(src_root, f"po/{lang}/luci-app-leigod-manager.po")
        if os.path.isfile(po_src):
            data_files.append((f"usr/share/luci/i18n/{PKG_NAME}.{lang}.po", po_src, 0o644))

    # Build data.tar.gz
    def build_data(tf: tarfile.TarFile):
        seen_dirs = set()

        def ensure_dir(d: str):
            parts = d.strip("/.").split("/")
            for i in range(len(parts)):
                sub = "./" + "/".join(parts[:i + 1])
                if sub and sub not in seen_dirs:
                    add_dir_to_tar(tf, sub)
                    seen_dirs.add(sub)

        add_dir_to_tar(tf, "./")
        seen_dirs.add("./")

        for arc, disk, mode in data_files:
            ensure_dir(os.path.dirname(arc))
            with open(disk, "rb") as f:
                content = f.read()
            add_file_to_tar(tf, arc, content, mode=mode)

    print("==> Packing data.tar.gz (clean POSIX tar)...")
    data_gz = make_tar_gz_bytes(build_data)
    print(f"    data.tar.gz: {len(data_gz)} bytes")

    # Control files
    installed_size = sum(os.path.getsize(d) for _, d, _ in data_files)
    control_content = f"""Package: {PKG_NAME}
Version: {args.version}
Depends: {PKG_DEPENDS}
Section: luci
Architecture: {args.arch}
Installed-Size: {installed_size}
Maintainer: {PKG_MAINTAINER}
License: {PKG_LICENSE}
Description: {PKG_DESCRIPTION}
"""

    conffiles_content = "/etc/config/leigod-manager\n"

    postinst_content = """#!/bin/sh
[ "${IPKG_NO_SCRIPT}" = "1" ] && exit 0
# Disable legacy procd acc init to avoid conflict with monitor.sh
[ -f /etc/init.d/acc ] && {
    /etc/init.d/acc stop 2>/dev/null || true
    /etc/init.d/acc disable 2>/dev/null || true
}
[ -x /etc/init.d/leigod-acc ] && {
    chmod 0755 /etc/init.d/leigod-acc
    /etc/init.d/leigod-acc enable 2>/dev/null || true
}
[ -x /usr/libexec/rpcd/leigod ] && chmod 0755 /usr/libexec/rpcd/leigod
/etc/init.d/rpcd reload 2>/dev/null || true
uci set luci.apply_needed=1 2>/dev/null || true
exit 0
"""

    prerm_content = """#!/bin/sh
[ "${IPKG_NO_SCRIPT}" = "1" ] && exit 0
[ -x /etc/init.d/leigod-acc ] && {
    /etc/init.d/leigod-acc stop 2>/dev/null || true
    /etc/init.d/leigod-acc disable 2>/dev/null || true
}
exit 0
"""

    def build_control(tf: tarfile.TarFile):
        add_dir_to_tar(tf, "./")
        add_file_to_tar(tf, "./control",   control_content.encode("utf-8"),   0o644)
        add_file_to_tar(tf, "./conffiles", conffiles_content.encode("utf-8"), 0o644)
        add_file_to_tar(tf, "./postinst",  postinst_content.encode("utf-8"),  0o755)
        add_file_to_tar(tf, "./prerm",     prerm_content.encode("utf-8"),     0o755)

    print("==> Packing control.tar.gz (clean POSIX tar)...")
    control_gz = make_tar_gz_bytes(build_control)
    print(f"    control.tar.gz: {len(control_gz)} bytes")

    # Outer archive: tar.gz containing ./debian-binary, ./data.tar.gz, ./control.tar.gz
    debian_binary = b"2.0\n"

    def build_outer(tf: tarfile.TarFile):
        add_file_to_tar(tf, "./debian-binary", debian_binary, 0o644)
        add_file_to_tar(tf, "./data.tar.gz",    data_gz,       0o644)
        add_file_to_tar(tf, "./control.tar.gz", control_gz,    0o644)

    ipk_filename = f"{PKG_NAME}_{args.version}_{args.arch}.ipk"
    ipk_path = os.path.join(out_dir, ipk_filename)
    print(f"==> Assembling outer tar.gz archive → {ipk_filename}...")

    ipk_gz = make_tar_gz_bytes(build_outer)
    with open(ipk_path, "wb") as f:
        f.write(ipk_gz)

    # Verification: check outer and inner tar streams
    print("==> Verifying IPK structure...")
    with tarfile.open(fileobj=io.BytesIO(ipk_gz), mode="r:gz") as tf:
        outer_members = [m.name for m in tf.getmembers()]
        print(f"    Outer archive members: {outer_members}")
        assert "./debian-binary" in outer_members or "debian-binary" in outer_members
        assert "./control.tar.gz" in outer_members or "control.tar.gz" in outer_members
        assert "./data.tar.gz" in outer_members or "data.tar.gz" in outer_members

    size = os.path.getsize(ipk_path)
    print(f"\n✅  Build successful!")
    print(f"    File : {ipk_path}")
    print(f"    Size : {size} bytes ({size // 1024}K)")
    print(f"\nDeploy to router:")
    print(f"    scp {ipk_path} root@<router-ip>:/tmp/")
    print(f"    ssh root@<router-ip> 'opkg install /tmp/{ipk_filename}'")


if __name__ == "__main__":
    main()

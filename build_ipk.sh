#!/bin/bash
# build_ipk.sh — Build luci-app-leigod-manager.ipk on macOS / Linux
# No OpenWrt buildroot required (pure-shell, no compiled binaries).
# Usage: ./build_ipk.sh [version] [arch]
#   version : package version, default 1.0.0
#   arch    : package arch,    default all

set -e

# ── Config ────────────────────────────────────────────────────────────────────
PKG_NAME="luci-app-leigod-manager"
PKG_VERSION="${1:-1.0.0}"
PKG_ARCH="${2:-all}"
PKG_DEPENDS="leigod-acc, rpcd, rpcd-mod-rpcsys, luci-base"
PKG_DESCRIPTION="LuCI support for Leigod Accelerator Manager (fw4/nftables compatible)"
PKG_MAINTAINER="Arlen Du"
PKG_LICENSE="GPL-2.0-only"
PKG_SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

OUTPUT_DIR="$PKG_SOURCE_DIR/dist"
BUILD_DIR="$PKG_SOURCE_DIR/.build_tmp"
DATA_DIR="$BUILD_DIR/data"
CTRL_DIR="$BUILD_DIR/control"

# ── Clean ─────────────────────────────────────────────────────────────────────
rm -rf "$BUILD_DIR"
mkdir -p "$DATA_DIR" "$CTRL_DIR" "$OUTPUT_DIR"

echo "==> Building $PKG_NAME $PKG_VERSION ($PKG_ARCH)"

# ── Stage data files ──────────────────────────────────────────────────────────

# 1. LuCI JS views → /www/luci-static/resources/view/leigod/
VIEW_DEST="$DATA_DIR/www/luci-static/resources/view/leigod"
mkdir -p "$VIEW_DEST"
cp "$PKG_SOURCE_DIR/htdocs/luci-static/resources/view/leigod/"*.js "$VIEW_DEST/"

# 2. Menu definition → /usr/share/luci/menu.d/
MENU_DEST="$DATA_DIR/usr/share/luci/menu.d"
mkdir -p "$MENU_DEST"
cp "$PKG_SOURCE_DIR/root/usr/share/luci/menu.d/luci-app-leigod-manager.json" "$MENU_DEST/"

# 3. ACL definition → /usr/share/rpcd/acl.d/
ACL_DEST="$DATA_DIR/usr/share/rpcd/acl.d"
mkdir -p "$ACL_DEST"
cp "$PKG_SOURCE_DIR/root/usr/share/rpcd/acl.d/luci-app-leigod-manager.json" "$ACL_DEST/"

# 4. rpcd plugin → /usr/libexec/rpcd/leigod  (must be executable)
RPCD_DEST="$DATA_DIR/usr/libexec/rpcd"
mkdir -p "$RPCD_DEST"
cp "$PKG_SOURCE_DIR/root/usr/libexec/rpcd/leigod" "$RPCD_DEST/"
chmod 0755 "$RPCD_DEST/leigod"

# 5. init.d script → /etc/init.d/leigod-acc  (must be executable)
INITD_DEST="$DATA_DIR/etc/init.d"
mkdir -p "$INITD_DEST"
cp "$PKG_SOURCE_DIR/root/etc/init.d/leigod-acc" "$INITD_DEST/"
chmod 0755 "$INITD_DEST/leigod-acc"

# 6. UCI defaults → /etc/config/leigod-manager  (only installed if not present)
CONFIG_DEST="$DATA_DIR/etc/config"
mkdir -p "$CONFIG_DEST"
cp "$PKG_SOURCE_DIR/root/etc/config/leigod-manager" "$CONFIG_DEST/"

# 7. po translations → /usr/share/luci/i18n/
#    LuCI expects .json (compiled) or .po files under i18n/
I18N_DEST="$DATA_DIR/usr/share/luci/i18n"
mkdir -p "$I18N_DEST"
if command -v po2lmo >/dev/null 2>&1; then
    # Compile .po → .lmo if po2lmo is available
    for po_file in "$PKG_SOURCE_DIR"/po/*/luci-app-leigod-manager.po; do
        lang=$(basename "$(dirname "$po_file")")
        po2lmo "$po_file" "$I18N_DEST/${PKG_NAME}.${lang}.lmo"
        echo "    compiled: $lang"
    done
else
    echo "    [WARN] po2lmo not found – copying raw .po files (will work but won't be compiled)"
    for po_file in "$PKG_SOURCE_DIR"/po/*/luci-app-leigod-manager.po; do
        lang=$(basename "$(dirname "$po_file")")
        mkdir -p "$I18N_DEST"
        cp "$po_file" "$I18N_DEST/${PKG_NAME}.${lang}.po"
    done
fi

# ── Compute installed size ────────────────────────────────────────────────────
INSTALLED_SIZE=$(du -sk "$DATA_DIR" 2>/dev/null | awk '{print $1}')

# ── Write control file ────────────────────────────────────────────────────────
cat > "$CTRL_DIR/control" <<EOF
Package: $PKG_NAME
Version: $PKG_VERSION
Architecture: $PKG_ARCH
Maintainer: $PKG_MAINTAINER
Depends: $PKG_DEPENDS
License: $PKG_LICENSE
Description: $PKG_DESCRIPTION
Installed-Size: $INSTALLED_SIZE
EOF

# ── Write conffiles (files that survive upgrade/reinstall) ───────────────────
cat > "$CTRL_DIR/conffiles" <<'EOF'
/etc/config/leigod-manager
EOF

# ── Write postinst script ─────────────────────────────────────────────────────
cat > "$CTRL_DIR/postinst" <<'POSTINST'
#!/bin/sh
[ "${IPKG_NO_SCRIPT}" = "1" ] && exit 0
[ -f /etc/init.d/acc ] && {
    /etc/init.d/acc stop 2>/dev/null || true
    /etc/init.d/acc disable 2>/dev/null || true
}
[ -x /etc/init.d/leigod-acc ] && {
    chmod 0755 /etc/init.d/leigod-acc
    /etc/init.d/leigod-acc enable
}
[ -x /usr/libexec/rpcd/leigod ] && chmod 0755 /usr/libexec/rpcd/leigod
# Reload rpcd to register new ubus objects
/etc/init.d/rpcd reload 2>/dev/null || true
# Notify LuCI to rebuild cache
uci set luci.apply_needed=1 2>/dev/null || true
exit 0
POSTINST
chmod 0755 "$CTRL_DIR/postinst"

# ── Write prerm script ────────────────────────────────────────────────────────
cat > "$CTRL_DIR/prerm" <<'PRERM'
#!/bin/sh
[ "${IPKG_NO_SCRIPT}" = "1" ] && exit 0
[ -x /etc/init.d/leigod-acc ] && {
    /etc/init.d/leigod-acc stop 2>/dev/null || true
    /etc/init.d/leigod-acc disable 2>/dev/null || true
}
exit 0
PRERM
chmod 0755 "$CTRL_DIR/prerm"

# ── Pack archives ─────────────────────────────────────────────────────────────
echo "==> Packing data.tar.gz"
( cd "$DATA_DIR" && tar -czf "$BUILD_DIR/data.tar.gz" . )

echo "==> Packing control.tar.gz"
( cd "$CTRL_DIR" && tar -czf "$BUILD_DIR/control.tar.gz" . )

echo "==> Writing debian-binary"
printf "2.0\n" > "$BUILD_DIR/debian-binary"

# ── Assemble IPK (ar archive) ─────────────────────────────────────────────────
IPK_FILE="$OUTPUT_DIR/${PKG_NAME}_${PKG_VERSION}_${PKG_ARCH}.ipk"
echo "==> Assembling $IPK_FILE"

# Use -S to skip ranlib symbol index (not needed for IPK, avoids macOS Mach-O warning)
( cd "$BUILD_DIR" && ar rcS "$IPK_FILE" debian-binary control.tar.gz data.tar.gz )

# ── Cleanup ───────────────────────────────────────────────────────────────────
rm -rf "$BUILD_DIR"

# ── Result ────────────────────────────────────────────────────────────────────
SIZE=$(du -sh "$IPK_FILE" | awk '{print $1}')
echo ""
echo "✅  Build successful!"
echo "    File : $IPK_FILE"
echo "    Size : $SIZE"
echo ""
echo "Deploy to router:"
echo "    scp $IPK_FILE root@<router-ip>:/tmp/"
echo "    ssh root@<router-ip> opkg install /tmp/$(basename "$IPK_FILE")"

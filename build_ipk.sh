#!/bin/bash
# build_ipk.sh — Build luci-app-leigod-manager.ipk on macOS / Linux
# Usage: ./build_ipk.sh [version] [arch]
#   version : package version, default 1.0.0
#   arch    : package arch,    default all

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_VERSION="${1:-1.0.0}"
PKG_ARCH="${2:-all}"

exec python3 "$SCRIPT_DIR/build_ipk.py" --version "$PKG_VERSION" --arch "$PKG_ARCH"

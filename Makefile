# SPDX-License-Identifier: GPL-2.0-only
#
# Copyright (C) 2024 luci-leigod-manager contributors

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI support for Leigod Accelerator Manager
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-leigod-manager
PKG_VERSION:=1.0.1
PKG_RELEASE:=1

PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Arlen Du

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot calls this
$(eval $(call BuildPackage,luci-app-leigod-manager))

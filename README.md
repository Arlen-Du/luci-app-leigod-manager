# luci-app-leigod-manager

<p align="center">
  <b>雷神加速器 OpenWrt / iStoreOS / ImmortalWrt 现代化 LuCI 管理插件</b><br>
  现代化 JavaScript (客户端渲染) + rpcd 架构，全面兼容 <code>fw4 (nftables)</code> 与 <code>fw3 (iptables)</code>，同时支持 <b>APK</b> 与 <b>OPKG</b> 双包管理器。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/OpenWrt-21.02%20~%2025.10+-blue.svg?logo=openwrt" alt="OpenWrt">
  <img src="https://img.shields.io/badge/Package%20Manager-APK%20%7C%20OPKG-brightgreen.svg" alt="APK | OPKG">
  <img src="https://img.shields.io/badge/Firewall-fw4%20(nftables)%20%7C%20fw3-orange.svg" alt="Firewall">
  <img src="https://img.shields.io/badge/License-GPL--2.0--only-lightgrey.svg" alt="License">
</p>

---

## 🌟 核心特性

- 🚀 **全新独立免 SDK 打包**：内置 `build_ipk.py` 与 `build_apk.py`，无需搭建庞大的 OpenWrt SDK 即可一键生成纯净合规的 `.ipk` 与 `.apk` 安装包。
- 📦 **双包管理器全面兼容**：
  - 原生适配新版 OpenWrt (24.x / 25.x / Alpine) 的 **`apk`** 包管理机制（包含 apk v2 / v3 兼容与版本号剥离）；
  - 完美兼容传统 OpenWrt (<= 23.05)、iStoreOS 及 ImmortalWrt 的 **`opkg`** 包管理机制。
- 🛡️ **无感热重载，永不掉登录态**：安装及更新时采用 `rpcd reload` (SIGHUP) 优雅注册插件与 ACL 权限，**彻底解决传统插件安装后强制退出登录、丢失 Session 的痛点**。
- 🧩 **全功能依赖管理面板**：
  - **只读内置识别**：自动识别并标记系统固件（ROM/SquashFS）内置的底层组件（如固化进固件的 `curl`、`iptables`、`kmod-tun` 等），防止误操作与无效卸载；
  - **一键批量 / 单包精准维护**：支持一键「安装全部」、「重新安装全部」与「卸载扩展依赖」，也可单独维护某一依赖项；
  - **智能名称与架构适配**：自动双向映射 `libpcap / libpcap1`、`iptables / iptables-nft`、`kmod-ipt-* / kmod-nft-*` 别名，卸载内核模块时自动执行 `rmmod` 深度清理。
- 🚦 **模式切换前置安全拦截**：
  - 切换到 TUN 或 TProxy 模式前，实时校验目标模式依赖就绪情况；
  - 若检测到依赖缺失，自动弹窗拦截并红色高亮列出缺少项，提供快捷按钮一键跳转安装，避免服务起不来导致网络异常。
- 📊 **服务状态与进程看门狗**：
  - 实时监控加速核心（`acc-gw.router`）与守护进程状态、运行时长、模式与防火墙框架；
  - 支持一键启动、停止、重启与开机自启控制。
- 📜 **双通道专业日志查看器**：
  - 聚合查看加速核心服务日志与系统 syslog；
  - 支持关键字实时高亮过滤、行数选择与自动滚动。
- 🌐 **完整国际化**：支持原生 LuCI 规范的简体中文（`zh_Hans`）与英文（`en`）双语界面。

---

## 🖥️ 兼容性矩阵

| 固件环境 | 默认包管理器 | 防火墙框架 | TUN 模式 | TProxy 模式 |
|:---|:---:|:---:|:---:|:---:|
| **OpenWrt 24.10 / 25.10+** | **APK** | fw4 (nftables) | ✅ 原生支持 | ✅ 原生支持 (需 kmod-nft-tproxy) |
| **OpenWrt 22.03 / 23.05** | **OPKG** | fw4 (nftables) | ✅ 原生支持 | ⚠️ 需补齐 iptables-legacy / tproxy |
| **iStoreOS 21.02 / 22.03** | **OPKG** | fw4 / fw3 | ✅ 原生支持 | ✅ 原生支持 |
| **ImmortalWrt 21.02 ~ 24.10** | **OPKG / APK** | fw4 / fw3 | ✅ 原生支持 | ✅ 原生支持 |
| **OpenWrt 19.07 / 21.02** | **OPKG** | fw3 (iptables) | ✅ 原生支持 | ✅ 原生支持 |

---

## 📥 安装指南

从 [Releases](../../releases) 页面下载对应格式的安装包：

### 1. OpenWrt 24.x / 25.x (APK 包管理器)

```sh
# 上传到路由器
scp luci-app-leigod-manager_1.0.0_noarch.apk root@<路由器IP>:/tmp/

# 通过 apk 安装
ssh root@<路由器IP> 'apk add --allow-untrusted /tmp/luci-app-leigod-manager_1.0.0_noarch.apk'
```

### 2. OpenWrt <= 23.05 / iStoreOS / ImmortalWrt (OPKG 包管理器)

```sh
# 上传到路由器
scp luci-app-leigod-manager_1.0.0_all.ipk root@<路由器IP>:/tmp/

# 通过 opkg 安装
ssh root@<路由器IP> 'opkg install /tmp/luci-app-leigod-manager_1.0.0_all.ipk'
```

> 💡 **提示**：安装成功后刷新浏览器即可在 LuCI 菜单「**服务**」->「**雷神加速器**」中访问管理面板。会话不会中断，无需重新输入登录密码。

---

## 🛠️ 本地独立构建 (免 SDK)

本项目自带符合 OpenWrt / Alpine 规范的纯 Python3 打包器，**不需要安装庞大的 OpenWrt SDK 或配置编译工具链**，任意安装了 Python 3.6+ 的环境均可秒级完成打包：

```bash
git clone https://github.com/ArlenDu/luci-app-leigod-manager.git
cd luci-app-leigod-manager

# 构建 OPKG 格式安装包 (.ipk)
python3 build_ipk.py

# 构建 APK 格式安装包 (.apk)
python3 build_apk.py
```

构建生成的安装包将存放在 `dist/` 目录下：
- `dist/luci-app-leigod-manager_1.0.0_all.ipk`
- `dist/luci-app-leigod-manager_1.0.0_noarch.apk`

---

## 📁 目录结构

```
luci-app-leigod-manager/
├── build_ipk.py                                # IPK 纯 Python 构建脚本
├── build_apk.py                                # APK v2 纯 Python 构建脚本
├── Makefile                                    # OpenWrt 源码树集成编译定义
├── dist/                                       # 构建产物输出目录
├── po/                                         # 多语言翻译文件
│   ├── zh_Hans/luci-app-leigod-manager.po
│   └── en/luci-app-leigod-manager.po
├── htdocs/luci-static/resources/view/leigod/  # LuCI 前端视图 (原生现代 JS)
│   ├── overview.js                             # 运行状态概览 + 快捷控制
│   ├── settings.js                             # 基本设置 + 模式与自启
│   ├── install.js                              # 安装管理 + 依赖管理中心
│   └── logs.js                                 # 实时双通道日志查看器
└── root/                                       # 路由器根系统覆盖目录
    ├── etc/config/leigod-manager               # UCI 默认配置文件
    ├── etc/init.d/leigod-acc                   # 系统服务守护脚本
    └── usr/
        ├── libexec/rpcd/leigod                 # rpcd 后端业务与 RPC 分发
        └── share/
            ├── luci/menu.d/luci-app-leigod-manager.json
            └── rpcd/acl.d/luci-app-leigod-manager.json
```

---

## ⚙️ UCI 配置参数

配置文件路径：`/etc/config/leigod-manager`

```uci
config leigod-manager 'base'
    option enabled '1'       # 是否启用开机自启（1=启用，0=禁用）
    option mode 'tun'        # 加速运行模式：tun | tproxy
    option log_level 'info'  # 日志记录级别：debug | info | warn
```

---

## 🔌 rpcd ubus API 接口定义

插件通过 `/usr/libexec/rpcd/leigod` 提供标准的 ubus 接口：

| 方法 | 参数说明 | 功能描述 |
|:---|:---|:---|
| `get_status` | — | 查询加速器运行状态、守护进程状态、运行时间、当前模式、版本、防火墙及包管理器 |
| `start` | — | 启动雷神加速器服务（自动前置准备 TUN/TProxy 模块环境） |
| `stop` | — | 优雅关闭加速会话，清理防火墙规则并停止服务 |
| `restart` | — | 重启雷神加速服务 |
| `set_mode` | `{"mode": "tun"\|"tproxy"}` | 校验依赖后切换运行模式并自动应用重启 |
| `get_config` | — | 获取当前 UCI 配置 |
| `set_config` | `{"enabled": bool, "mode": str, "log_level": str}` | 校验依赖后保存 UCI 配置并使配置生效 |
| `get_deps` | — | 获取系统当前包管理器类型 (`apk`/`opkg`) 及 TUN / TProxy 依赖的安装与 ROM 只读状态 |
| `manage_deps` | `{"mode": str, "action": str, "pkg": str}` | 依赖包安装、重新安装或卸载（`action: install\|reinstall\|remove`） |
| `get_logs` | `{"lines": 100}` | 获取最新的加速服务输出日志与系统 syslog |
| `install` | — | 调用官方在线安装脚本安装雷神加速器核心 |
| `uninstall` | — | 调用官方卸载脚本并深度清理相关网络规则与文件 |

---

## 📄 开源许可证

本项目基于 [GPL-2.0-only](LICENSE) 协议开源。

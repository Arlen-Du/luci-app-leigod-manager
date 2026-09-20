# luci-leigod-manager

OpenWrt LuCI 雷神加速器管理插件 —— 现代 JS + rpcd 架构，兼容 fw4 (nftables)。

## 特性

- ✅ 服务运行状态实时监控（5 秒轮询）
- ✅ 一键启动 / 停止 / 重启服务
- ✅ TUN / TProxy 模式切换（含 fw4 兼容性警告）
- ✅ 开机自启、日志级别设置
- ✅ 通过 opkg 在线安装 / 卸载 leigod-acc
- ✅ 依赖说明（根据防火墙框架和模式自动适配）
- ✅ 双标签日志查看器（服务日志 + 系统日志）
- ✅ 日志关键词高亮 + 过滤 + 自动滚动
- ✅ 中英双语界面（LuCI i18n）

## 兼容性

| 固件 | 防火墙 | TUN | TProxy |
|------|--------|-----|--------|
| OpenWrt 23.05+ | fw4 (nftables) | ✅ | ⚠️ 需 iptables-legacy |
| ImmortalWrt | fw4 (nftables) | ✅ | ⚠️ 需 iptables-legacy |
| iStoreOS | fw4 (nftables) | ✅ | ⚠️ 需 iptables-legacy |
| OpenWrt 21.02 及以下 | fw3 (iptables) | ✅ | ✅ |

> **注意**：`leigod-acc` 二进制由雷神官方以 ipk 包形式提供，需配置对应软件源后通过「安装管理」页面安装。

## 目录结构

```
luci-leigod-manager/
├── Makefile
├── po/
│   ├── en/luci-app-leigod-manager.po
│   └── zh_Hans/luci-app-leigod-manager.po
├── htdocs/luci-static/resources/view/leigod/
│   ├── overview.js   # 运行状态 + 控制
│   ├── settings.js   # 基本设置
│   ├── install.js    # 安装管理
│   └── logs.js       # 日志查看
└── root/
    ├── etc/config/leigod-manager          # UCI 默认配置
    ├── etc/init.d/leigod-acc              # 服务脚本
    └── usr/
        ├── libexec/rpcd/leigod            # rpcd 后端（ubus 方法）
        └── share/
            ├── luci/menu.d/luci-app-leigod-manager.json
            └── rpcd/acl.d/luci-app-leigod-manager.json
```

## 编译

```bash
# 集成到 OpenWrt buildroot
cd <openwrt-buildroot>/package
git clone https://github.com/<your-repo>/luci-leigod-manager.git
make menuconfig  # LUCI -> Applications -> luci-app-leigod-manager
make package/luci-leigod-manager/compile V=s
```

## UCI 配置

```
config leigod-manager 'base'
    option enabled '1'       # 开机自启（1=是，0=否）
    option mode 'tun'        # 运行模式：tun | tproxy
    option log_level 'info'  # 日志级别：debug | info | warn
```

## rpcd ubus 方法

| 方法 | 参数 | 描述 |
|------|------|------|
| `get_status` | — | 返回运行状态、模式、版本、防火墙类型 |
| `start` | — | 启动服务 |
| `stop` | — | 停止服务 |
| `restart` | — | 重启服务 |
| `set_mode` | `mode: "tun"\|"tproxy"` | 切换运行模式并重启 |
| `get_logs` | `lines: Number` | 获取最近 N 行日志 |
| `install` | — | opkg install leigod-acc |
| `uninstall` | — | opkg remove leigod-acc |
| `get_config` | — | 读取 UCI 配置 |
| `set_config` | `enabled, mode, log_level` | 保存 UCI 配置 |

## 许可证

GPL-2.0-only

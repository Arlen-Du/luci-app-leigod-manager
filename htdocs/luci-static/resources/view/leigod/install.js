'use strict';
'require view';
'require rpc';
'require ui';

var callGetStatus = rpc.declare({
	object: 'leigod',
	method: 'get_status',
	expect: {}
});

var callInstall = rpc.declare({
	object: 'leigod',
	method: 'install',
	expect: {}
});

var callUninstall = rpc.declare({
	object: 'leigod',
	method: 'uninstall',
	expect: {}
});

var callGetDeps = rpc.declare({
	object: 'leigod',
	method: 'get_deps',
	expect: {}
});

var callManageDeps = rpc.declare({
	object: 'leigod',
	method: 'manage_deps',
	params: ['mode', 'action', 'pkg'],
	expect: {}
});

var PKG_META = {
	'libpcap1':            { desc: _('底层网络数据包捕获与链路过滤核心库') },
	'libpcap':             { desc: _('底层网络数据包捕获与链路过滤核心库') },
	'iptables':            { desc: _('基础防火墙数据包过滤与链管理工具') },
	'kmod-tun':            { desc: _('内核 TUN/TAP 虚拟网络驱动模块') },
	'kmod-ipt-nat':        { desc: _('内核 iptables 网络地址转换(NAT)模块') },
	'kmod-ipt-ipset':      { desc: _('内核 iptables 与 IPSet 集合匹配关联模块') },
	'ipset':               { desc: _('高效 IP 地址/网段集合管理工具') },
	'curl':                { desc: _('支持 HTTP/HTTPS 协议的网络文件传输命令行工具') },
	'kmod-ipt-tproxy':     { desc: _('内核透明代理 (TPROXY) 数据重定向驱动') },
	'iptables-mod-tproxy': { desc: _('iptables 的 TPROXY 用户态规则扩展模块') }
};

var TUN_DEFAULT_PKGS = ['libpcap1', 'iptables', 'kmod-tun', 'kmod-ipt-nat', 'kmod-ipt-ipset', 'ipset', 'curl'];
var TPROXY_DEFAULT_PKGS = ['libpcap1', 'iptables', 'iptables-mod-tproxy', 'kmod-ipt-tproxy', 'kmod-ipt-nat', 'kmod-ipt-ipset', 'ipset', 'curl'];

return view.extend({
	load: function () {
		return Promise.all([
			callGetStatus(),
			callGetDeps().catch(function () { return {}; })
		]);
	},

	render: function (data) {
		var status = data[0] || {};
		var depsData = data[1] || {};

		var installed  = !!status.installed;
		var fw         = status.fw || 'unknown';
		var version    = status.version || '';

		var style = E('style', {}, [`
			.lg-card { background: var(--cbi-section-bg,#fff); border: 1px solid var(--cbi-section-border,#ddd); border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
			.lg-card h3 { margin: 0 0 16px; font-size: 1rem; color: var(--cbi-label-color,#333); border-bottom: 1px solid var(--cbi-section-border,#eee); padding-bottom: 8px; }
			.lg-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 20px; }
			.lg-info-item strong { display: block; font-size: .78rem; text-transform: uppercase; color: var(--cbi-label-color,#888); letter-spacing: .05em; margin-bottom: 2px; }
			.lg-info-item span { font-size: .95rem; font-weight: 600; color: var(--cbi-value-color,#222); }
			.lg-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: .8rem; font-weight: 600; }
			.lg-badge-ok   { background: #d1fae5; color: #065f46; }
			.lg-badge-warn { background: #fee2e2; color: #991b1b; }
			.lg-badge-info { background: #e0f2fe; color: #0369a1; }
			.lg-btn-group { display: flex; gap: 12px; flex-wrap: wrap; }
			.lg-btn { padding: 9px 22px; border-radius: 6px; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; transition: opacity .15s; }
			.lg-btn:disabled { opacity: .4; cursor: not-allowed; }
			.lg-btn-green { background: #10b981; color: #fff; }
			.lg-btn-red   { background: #ef4444; color: #fff; }
			.lg-btn-blue  { background: #3b82f6; color: #fff; }
			.lg-btn-gray  { background: #6b7280; color: #fff; }
			.lg-btn:not(:disabled):hover { opacity: .85; }

			.lg-sec-header { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; margin-bottom: 12px; flex-wrap: wrap; gap: 12px; padding-bottom: 8px; border-bottom: 1px dashed var(--cbi-section-border,#e5e7eb); }
			.lg-sec-title { font-size: .96rem; font-weight: 700; color: var(--cbi-value-color,#1f2937); display: flex; align-items: center; gap: 8px; }
			.lg-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: .88rem; }
			.lg-table th { background: var(--cbi-section-border,#f9fafb); padding: 10px 12px; text-align: left; font-weight: 600; color: var(--cbi-label-color,#4b5563); border-bottom: 2px solid var(--cbi-section-border,#e5e7eb); }
			.lg-table td { padding: 9px 12px; border-bottom: 1px solid var(--cbi-section-border,#f3f4f6); vertical-align: middle; }
			.lg-table tr:hover { background: var(--cbi-section-border,#fbfcfd); }
			.lg-btn-sm { padding: 4px 10px; font-size: .78rem; border-radius: 4px; border: none; cursor: pointer; font-weight: 600; transition: opacity .15s; margin-right: 6px; }
			.lg-btn-sm:disabled { opacity: .4; cursor: not-allowed; }
			.lg-btn-sm:not(:disabled):hover { opacity: .85; }

			.lg-log-output { background: #111; color: #d1fae5; font-family: monospace; font-size: .83rem; border-radius: 6px; padding: 14px; max-height: 260px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin-top: 14px; display: none; }
			.lg-spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: lg-spin .6s linear infinite; vertical-align: middle; margin-right: 5px; }
			@keyframes lg-spin { to { transform: rotate(360deg); } }
		`]);

		var outputEl = E('div', { 'class': 'lg-log-output', 'id': 'lg-install-output' });
		var outputDepsEl = E('div', { 'class': 'lg-log-output', 'id': 'lg-deps-output' });

		function showOutput(text) {
			outputEl.style.display = 'block';
			outputEl.textContent   = text;
			outputEl.scrollTop     = outputEl.scrollHeight;
		}

		function showDepsOutput(text) {
			outputDepsEl.style.display = 'block';
			outputDepsEl.textContent   = text;
			outputDepsEl.scrollTop     = outputDepsEl.scrollHeight;
		}

		// Install button
		var installBtn = E('button', {
			'class': 'lg-btn lg-btn-green',
			'id': 'lg-btn-install',
			'click': function () {
				var prompt = installed ? _('确认要重新安装雷神加速器吗？这将从官方服务器重新下载并安装。') : _('确认要安装雷神加速器吗？这将从官方服务器下载并执行安装脚本。');
				if (!confirm(prompt)) return;
				this.disabled  = true;
				this.innerHTML = '<span class="lg-spinner"></span>' + (installed ? _('重新安装中...') : _('安装中...'));
				showOutput(_('正在执行官方安装脚本: cd /tmp && sh -c "$(curl -fsSL http://119.3.40.126/router_plugin_new/plugin_install.sh)" ...\n'));
				callInstall().then(function (result) {
					showOutput((result && result.message) ? result.message : _('操作完成'));
					if (result && result.code === 0) {
						ui.addNotification(null, E('p', {}, [_('安装成功！正在刷新状态...')]), 'success');
						setTimeout(function () { location.reload(); }, 1500);
					} else {
						ui.addNotification(null, E('p', {}, [_('安装失败，请查看下方日志')]), 'danger');
						var btn = document.getElementById('lg-btn-install');
						if (btn) {
							btn.disabled = false;
							btn.textContent = installed ? _('重新安装') : _('安装');
						}
					}
				}).catch(function (e) {
					showOutput(_('请求失败：') + e);
					var btn = document.getElementById('lg-btn-install');
					if (btn) {
						btn.disabled = false;
						btn.textContent = installed ? _('重新安装') : _('安装');
					}
				});
			}
		}, [installed ? _('重新安装') : _('安装')]);

		// Uninstall button
		var uninstallBtn = E('button', {
			'class': 'lg-btn lg-btn-red',
			'id': 'lg-btn-uninstall',
			'click': function () {
				if (!confirm(_('确认要卸载雷神加速器吗？这将停止加速服务并执行官方卸载脚本。'))) return;
				this.disabled  = true;
				this.innerHTML = '<span class="lg-spinner"></span>' + _('卸载中...');
				showOutput(_('正在执行官方卸载脚本: sh /usr/sbin/leigod/leigod_uninstall.sh ...\n'));
				callUninstall().then(function (result) {
					showOutput((result && result.message) ? result.message : _('操作完成'));
					if (result && result.code === 0) {
						ui.addNotification(null, E('p', {}, [_('卸载成功！正在刷新状态...')]), 'success');
						setTimeout(function () { location.reload(); }, 1500);
					} else {
						ui.addNotification(null, E('p', {}, [_('卸载失败，请查看下方日志')]), 'danger');
						var btn = document.getElementById('lg-btn-uninstall');
						if (btn) {
							btn.disabled = false;
							btn.textContent = _('卸载');
						}
					}
				}).catch(function (e) {
					showOutput(_('请求失败：') + e);
					var btn = document.getElementById('lg-btn-uninstall');
					if (btn) {
						btn.disabled = false;
						btn.textContent = _('卸载');
					}
				});
			}
		}, [_('卸载')]);

		// Refresh button
		var refreshBtn = E('button', {
			'class': 'lg-btn lg-btn-blue',
			'click': function () { location.reload(); }
		}, [_('刷新页面')]);

		// --- 依赖管理操作逻辑 ---
		function handleDepAction(mode, action, pkg, btn) {
			var actionNames = {
				'install': _('安装'),
				'reinstall': _('重新安装'),
				'remove': _('卸载')
			};
			var actName = actionNames[action] || action;
			var targetDesc = pkg ? pkg : (mode === 'tun' ? _('TUN 模式全部依赖') : _('TProxy 模式全部依赖'));

			if (!confirm('确认要对 [' + targetDesc + '] 执行 [' + actName + '] 操作吗？')) {
				return;
			}

			if (btn) {
				btn.disabled = true;
				btn.innerHTML = '<span class="lg-spinner"></span>' + actName + _('中...');
			}

			showDepsOutput('正在执行依赖操作: [' + actName + '] ' + targetDesc + ' ...\n');

			callManageDeps(mode, action, pkg || '').then(function (res) {
				showDepsOutput((res && res.message) ? res.message : _('操作完成'));
				if (res && res.code === 0) {
					ui.addNotification(null, E('p', {}, [actName + ' [' + targetDesc + '] ' + _('成功！正在刷新依赖状态...')]), 'success');
					setTimeout(function () { location.reload(); }, 1500);
				} else {
					ui.addNotification(null, E('p', {}, [actName + ' [' + targetDesc + '] ' + _('失败，请查看下方依赖控制台日志')]), 'danger');
					if (btn) {
						btn.disabled = false;
						btn.textContent = actName;
					}
				}
			}).catch(function (e) {
				showDepsOutput(_('请求失败：') + e);
				if (btn) {
					btn.disabled = false;
					btn.textContent = actName;
				}
			});
		}

		// 依赖列表构建器
		function buildDepSection(modeName, modeKey, pkgList) {
			var installedCount = 0;
			pkgList.forEach(function (item) {
				if (item.installed) installedCount++;
			});
			var allReady = (installedCount === pkgList.length);

			// 批量操作按钮
			var btnBatchInstall = E('button', {
				'class': 'lg-btn-sm lg-btn-green',
				'click': function () { handleDepAction(modeKey, 'install', null, this); }
			}, [_('安装全部')]);

			var btnBatchReinstall = E('button', {
				'class': 'lg-btn-sm lg-btn-blue',
				'click': function () { handleDepAction(modeKey, 'reinstall', null, this); }
			}, [_('重新安装全部')]);

			var btnBatchRemove = E('button', {
				'class': 'lg-btn-sm lg-btn-red',
				'click': function () { handleDepAction(modeKey, 'remove', null, this); }
			}, [_('卸载全部')]);

			var secHeader = E('div', { 'class': 'lg-sec-header' }, [
				E('div', { 'class': 'lg-sec-title' }, [
					modeName,
					E('span', {
						'class': allReady ? 'lg-badge lg-badge-ok' : 'lg-badge lg-badge-warn'
					}, [allReady ? _('已就绪') + ' (' + installedCount + '/' + pkgList.length + ')' : _('需安装') + ' (' + (pkgList.length - installedCount) + ' 项未就绪)'])
				]),
				E('div', { 'class': 'lg-btn-group' }, [btnBatchInstall, btnBatchReinstall, btnBatchRemove])
			]);

			// 依赖明细表格
			var rows = pkgList.map(function (pkgItem) {
				var meta = PKG_META[pkgItem.name] || { desc: _('网络加速相关依赖') };

				var btnSingleInstall = E('button', {
					'class': 'lg-btn-sm lg-btn-green',
					'click': function () { handleDepAction(modeKey, 'install', pkgItem.name, this); }
				}, [_('安装')]);

				var btnSingleReinstall = E('button', {
					'class': 'lg-btn-sm lg-btn-blue',
					'click': function () { handleDepAction(modeKey, 'reinstall', pkgItem.name, this); }
				}, [_('重新安装')]);

				var btnSingleRemove = E('button', {
					'class': 'lg-btn-sm lg-btn-red',
					'click': function () { handleDepAction(modeKey, 'remove', pkgItem.name, this); }
				}, [_('卸载')]);

				return E('tr', {}, [
					E('td', { 'style': 'font-weight:600;font-family:monospace;' }, [pkgItem.name]),
					E('td', { 'style': 'color:var(--cbi-label-color,#666);' }, [meta.desc]),
					E('td', {}, [
						E('span', {
							'class': pkgItem.installed ? 'lg-badge lg-badge-ok' : 'lg-badge lg-badge-warn'
						}, [pkgItem.installed ? _('已安装') : _('未安装')])
					]),
					E('td', { 'style': 'white-space:nowrap;' }, [
						btnSingleInstall,
						btnSingleReinstall,
						btnSingleRemove
					])
				]);
			});

			var table = E('table', { 'class': 'lg-table' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', { 'style': 'width:22%;' }, [_('软件包名称')]),
						E('th', { 'style': 'width:38%;' }, [_('功能描述')]),
						E('th', { 'style': 'width:15%;' }, [_('当前状态')]),
						E('th', { 'style': 'width:25%;' }, [_('操作')])
					])
				]),
				E('tbody', {}, rows)
			]);

			return E('div', {}, [secHeader, table]);
		}

		// 整理 TUN 模式包列表
		var tunPkgs = [];
		if (Array.isArray(depsData.tun) && depsData.tun.length > 0) {
			tunPkgs = depsData.tun;
		} else {
			tunPkgs = TUN_DEFAULT_PKGS.map(function (name) { return { name: name, installed: false }; });
		}

		// 整理 TProxy 模式包列表
		var tproxyPkgs = [];
		if (Array.isArray(depsData.tproxy) && depsData.tproxy.length > 0) {
			tproxyPkgs = depsData.tproxy;
		} else {
			tproxyPkgs = TPROXY_DEFAULT_PKGS.map(function (name) { return { name: name, installed: false }; });
		}

		var tunSection = buildDepSection(_('TUN 模式依赖组件'), 'tun', tunPkgs);
		var tproxySection = buildDepSection(_('TProxy 模式依赖组件'), 'tproxy', tproxyPkgs);

		return E('div', {}, [
			style,

			// 软件包状态卡片
			E('div', { 'class': 'lg-card' }, [
				E('h3', {}, [_('软件包状态')]),
				E('div', { 'class': 'lg-info-grid' }, [
					E('div', { 'class': 'lg-info-item' }, [
						E('strong', {}, [_('安装状态')]),
						E('span', {}, [
							E('span', {
								'class': installed ? 'lg-badge lg-badge-ok' : 'lg-badge lg-badge-warn'
							}, [installed ? _('已安装') : _('未安装')])
						])
					]),
					E('div', { 'class': 'lg-info-item' }, [
						E('strong', {}, [_('版本')]),
						E('span', {}, [version || '--'])
					]),
					E('div', { 'class': 'lg-info-item' }, [
						E('strong', {}, [_('防火墙框架')]),
						E('span', {}, [fw])
					]),
					E('div', { 'class': 'lg-info-item' }, [
						E('strong', {}, [_('TProxy 兼容')]),
						E('span', {}, [status.tproxy_compat || '--'])
					])
				]),

				E('div', { 'class': 'lg-btn-group' }, [installBtn, uninstallBtn, refreshBtn]),
				outputEl
			]),

			// 依赖管理卡片
			E('div', { 'class': 'lg-card' }, [
				E('h3', {}, [_('依赖管理')]),
				E('p', { 'style': 'font-size:.88rem;color:var(--cbi-label-color,#666);margin:0 0 16px;line-height:1.5;' }, [
					_('集中管理雷神加速器在 TUN 模式与 TProxy 模式下所需的内核模块与系统依赖包。支持一键批量安装/重新安装/卸载，也可针对特定单个组件进行精准维护。')
				]),
				tunSection,
				tproxySection,
				outputDepsEl
			])
		]);
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});

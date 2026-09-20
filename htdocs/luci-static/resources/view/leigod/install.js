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

// Known dependencies by mode
var DEPS_TUN    = ['kmod-tun', 'curl', 'jsonfilter'];
var DEPS_TPROXY = ['kmod-ipt-tproxy', 'iptables-mod-tproxy', 'curl', 'jsonfilter'];
var DEPS_FW4    = ['iptables-legacy', 'kmod-tun', 'curl', 'jsonfilter'];

function checkDep(pkg) {
	// Cannot run opkg from JS; show advisory list only
	return pkg;
}

return view.extend({
	load: function () {
		return callGetStatus();
	},

	render: function (status) {
		var installed  = !!status.installed;
		var running    = !!status.running;
		var fw         = status.fw || 'unknown';
		var mode       = status.mode || 'tun';
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
			.lg-btn-group { display: flex; gap: 12px; flex-wrap: wrap; }
			.lg-btn { padding: 9px 22px; border-radius: 6px; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; transition: opacity .15s; }
			.lg-btn:disabled { opacity: .4; cursor: not-allowed; }
			.lg-btn-green { background: #10b981; color: #fff; }
			.lg-btn-red   { background: #ef4444; color: #fff; }
			.lg-btn-blue  { background: #3b82f6; color: #fff; }
			.lg-btn:not(:disabled):hover { opacity: .85; }
			.lg-dep-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
			.lg-dep-list li { background: var(--cbi-section-border,#f3f4f6); border-radius: 4px; padding: 3px 10px; font-size: .83rem; font-family: monospace; color: var(--cbi-value-color,#333); }
			.lg-log-output { background: #111; color: #d1fae5; font-family: monospace; font-size: .83rem; border-radius: 6px; padding: 14px; max-height: 240px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin-top: 14px; display: none; }
			.lg-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: lg-spin .6s linear infinite; vertical-align: middle; margin-right: 6px; }
			@keyframes lg-spin { to { transform: rotate(360deg); } }
		`]);

		var deps = fw === 'fw4' ? DEPS_FW4 : (mode === 'tproxy' ? DEPS_TPROXY : DEPS_TUN);

		var outputEl = E('div', { 'class': 'lg-log-output', 'id': 'lg-install-output' });

		function showOutput(text) {
			outputEl.style.display = 'block';
			outputEl.textContent   = text;
			outputEl.scrollTop     = outputEl.scrollHeight;
		}

		// Install button
		var installBtn = E('button', {
			'class': 'lg-btn lg-btn-green',
			'id': 'lg-btn-install',
			'disabled': installed,
			'click': function () {
				if (!confirm(_('确认要安装 leigod-acc 吗？这将通过 opkg 从软件源下载安装。'))) return;
				this.disabled  = true;
				this.innerHTML = '<span class="lg-spinner"></span>' + _('安装中...');
				showOutput(_('正在执行 opkg install leigod-acc ...\n'));
				callInstall().then(function (result) {
					showOutput((result && result.message) ? result.message : _('操作完成'));
					if (result && result.code === 0) {
						ui.addNotification(null, E('p', {}, [_('安装成功！请刷新页面。')]), 'success');
					} else {
						ui.addNotification(null, E('p', {}, [_('安装失败，请查看下方日志')]), 'danger');
						document.getElementById('lg-btn-install').disabled = false;
						document.getElementById('lg-btn-install').textContent = _('安装');
					}
				}).catch(function (e) {
					showOutput(_('请求失败：') + e);
					document.getElementById('lg-btn-install').disabled = false;
					document.getElementById('lg-btn-install').textContent = _('安装');
				});
			}
		}, [_('安装')]);

		// Uninstall button
		var uninstallBtn = E('button', {
			'class': 'lg-btn lg-btn-red',
			'id': 'lg-btn-uninstall',
			'disabled': !installed,
			'click': function () {
				if (!confirm(_('确认要卸载 leigod-acc 吗？这将停止服务并移除软件包。'))) return;
				this.disabled  = true;
				this.innerHTML = '<span class="lg-spinner"></span>' + _('卸载中...');
				showOutput(_('正在停止服务并执行 opkg remove leigod-acc ...\n'));
				callUninstall().then(function (result) {
					showOutput((result && result.message) ? result.message : _('操作完成'));
					if (result && result.code === 0) {
						ui.addNotification(null, E('p', {}, [_('卸载成功！请刷新页面。')]), 'success');
					} else {
						ui.addNotification(null, E('p', {}, [_('卸载失败，请查看下方日志')]), 'danger');
						document.getElementById('lg-btn-uninstall').disabled = false;
						document.getElementById('lg-btn-uninstall').textContent = _('卸载');
					}
				}).catch(function (e) {
					showOutput(_('请求失败：') + e);
					document.getElementById('lg-btn-uninstall').disabled = false;
					document.getElementById('lg-btn-uninstall').textContent = _('卸载');
				});
			}
		}, [_('卸载')]);

		// Refresh button
		var refreshBtn = E('button', {
			'class': 'lg-btn lg-btn-blue',
			'click': function () { location.reload(); }
		}, [_('刷新页面')]);

		return E('div', {}, [
			style,

			// Package info card
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

			// Dependencies advisory card
			E('div', { 'class': 'lg-card' }, [
				E('h3', {}, [_('依赖说明')]),
				E('p', { 'style': 'font-size:.88rem;color:var(--cbi-label-color,#666);margin:0 0 12px;' }, [
					_('以下软件包为当前配置（') + fw + ' / ' + mode + _('）的推荐依赖。若遇问题可通过 SSH 运行 opkg install 手动安装：')
				]),
				E('ul', { 'class': 'lg-dep-list' },
					deps.map(function (d) { return E('li', {}, [d]); })
				)
			])
		]);
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});

'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

// ── RPC declarations ─────────────────────────────────────────────────────────
var callGetStatus = rpc.declare({
	object: 'leigod',
	method: 'get_status',
	expect: {}
});

var callStart = rpc.declare({
	object: 'leigod',
	method: 'start',
	expect: {}
});

var callStop = rpc.declare({
	object: 'leigod',
	method: 'stop',
	expect: {}
});

var callRestart = rpc.declare({
	object: 'leigod',
	method: 'restart',
	expect: {}
});

var callSetMode = rpc.declare({
	object: 'leigod',
	method: 'set_mode',
	params: ['mode'],
	expect: {}
});

var callGetDeps = rpc.declare({
	object: 'leigod',
	method: 'get_deps',
	expect: {}
});

// ── Helper renderers ─────────────────────────────────────────────────────────
function renderStatusBadge(running) {
	var cls  = running ? 'lg-badge lg-badge-running'  : 'lg-badge lg-badge-stopped';
	var text = running ? _('运行中')                   : _('已停止');
	return E('span', { 'class': cls }, [text]);
}

function renderModeBadge(mode) {
	var cls  = mode === 'tun' ? 'lg-badge lg-badge-tun' : 'lg-badge lg-badge-tproxy';
	var text = mode === 'tun' ? 'TUN' : 'TProxy';
	return E('span', { 'class': cls }, [text]);
}

function renderFwBadge(fw) {
	var cls  = fw === 'fw4' ? 'lg-badge lg-badge-fw4' : 'lg-badge lg-badge-fw3';
	return E('span', { 'class': cls }, [fw === 'fw4' ? 'nftables (fw4)' : 'iptables (fw3)']);
}

function renderWarning(status) {
	// Warn when tproxy + fw4 without iptables-legacy
	if (status.mode === 'tproxy' && status.fw === 'fw4' && status.tproxy_compat === 'none') {
		return E('div', { 'class': 'lg-alert lg-alert-warning' }, [
			E('strong', {}, [_('兼容性警告')]),
			E('p', {}, [
				_('当前系统使用 fw4 (nftables)，但 TProxy 模式需要 iptables-legacy 支持。'),
				E('br'),
				_('建议切换到 TUN 模式，或安装 iptables-legacy 兼容包。')
			])
		]);
	}
	return null;
}

// ── Status update function ────────────────────────────────────────────────────
function updateStatus(status) {
	var el;

	el = document.getElementById('lg-status-badge');
	if (el) {
		el.className = status.running ? 'lg-badge lg-badge-running' : 'lg-badge lg-badge-stopped';
		el.textContent = status.running ? _('运行中') : _('已停止');
	}

	el = document.getElementById('lg-mode-badge');
	if (el) {
		el.className = status.mode === 'tun' ? 'lg-badge lg-badge-tun' : 'lg-badge lg-badge-tproxy';
		el.textContent = status.mode === 'tun' ? 'TUN' : 'TProxy';
	}

	el = document.getElementById('lg-uptime');
	if (el) el.textContent = status.uptime || '--';

	el = document.getElementById('lg-version');
	if (el) el.textContent = status.version || _('未知');

	el = document.getElementById('lg-fw-badge');
	if (el) {
		el.className = status.fw === 'fw4' ? 'lg-badge lg-badge-fw4' : 'lg-badge lg-badge-fw3';
		el.textContent = status.fw === 'fw4' ? 'nftables (fw4)' : 'iptables (fw3)';
	}

	// Buttons
	var btnStart   = document.getElementById('lg-btn-start');
	var btnStop    = document.getElementById('lg-btn-stop');
	var btnRestart = document.getElementById('lg-btn-restart');
	var btnSwitch  = document.getElementById('lg-btn-switch-mode');

	if (btnStart)   btnStart.disabled   = !!status.running;
	if (btnStop)    btnStop.disabled    = !status.running;
	if (btnRestart) btnRestart.disabled = !status.running;
	if (btnSwitch) {
		btnSwitch.dataset.mode = status.mode || 'tproxy';
		btnSwitch.textContent = status.mode === 'tun' ? _('切换到 TProxy 模式') : _('切换到 TUN 模式');
	}

	// Warning
	var warnEl = document.getElementById('lg-compat-warn');
	if (warnEl) {
		if (status.mode === 'tproxy' && status.fw === 'fw4' && status.tproxy_compat === 'none') {
			warnEl.style.display = '';
		} else {
			warnEl.style.display = 'none';
		}
	}
}

// ── View ──────────────────────────────────────────────────────────────────────
return view.extend({
	load: function () {
		return callGetStatus();
	},

	render: function (status) {
		var installed = status.installed;

		// Theme detection helper
		try {
			var isDark = false;
			var root = document.documentElement;
			var body = document.body;
			if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) isDark = true;
			if (root && (root.getAttribute('data-theme') === 'dark' || root.getAttribute('data-darkmode') === 'true' || root.classList.contains('dark') || root.classList.contains('dark-mode'))) isDark = true;
			if (body && (body.getAttribute('data-theme') === 'dark' || body.getAttribute('data-darkmode') === 'true' || body.classList.contains('dark') || body.classList.contains('dark-mode'))) isDark = true;
			if (root && (root.getAttribute('data-theme') === 'light' || root.getAttribute('data-darkmode') === 'false' || root.classList.contains('light'))) isDark = false;
			if (body && (body.getAttribute('data-theme') === 'light' || body.getAttribute('data-darkmode') === 'false' || body.classList.contains('light'))) isDark = false;
			var links = document.querySelectorAll('link[rel="stylesheet"]');
			for (var li = 0; li < links.length; li++) {
				if (links[li].href && links[li].href.indexOf('dark.css') !== -1) { isDark = true; break; }
			}
			if (!isDark && body) {
				var bg = window.getComputedStyle(body).backgroundColor;
				var rgb = bg ? bg.match(/\d+/g) : null;
				if (rgb && rgb.length >= 3) {
					var brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
					if (brightness < 128) isDark = true;
				}
			}
			if (isDark) { if (root) root.classList.add('lg-dark'); }
			else { if (root) root.classList.remove('lg-dark'); }
		} catch (e) {}

		// Inline CSS (injected once)
		var style = E('style', {}, [`
			:root {
				--lg-bg-card: #ffffff;
				--lg-border-card: #e5e7eb;
				--lg-shadow-card: 0 1px 3px rgba(0, 0, 0, 0.05);
				--lg-border-subtle: #f3f4f6;
				--lg-border-divider: #e5e7eb;
				--lg-bg-subtle: #f9fafb;
				--lg-bg-hover: #f3f4f6;
				--lg-text-primary: #1f2937;
				--lg-text-secondary: #4b5563;
				--lg-text-muted: #6b7280;
				--lg-badge-ok-bg: #d1fae5;
				--lg-badge-ok-text: #065f46;
				--lg-badge-warn-bg: #fee2e2;
				--lg-badge-warn-text: #991b1b;
				--lg-badge-info-bg: #dbeafe;
				--lg-badge-info-text: #1e40af;
				--lg-badge-purple-bg: #ede9fe;
				--lg-badge-purple-text: #5b21b6;
				--lg-badge-amber-bg: #fef3c7;
				--lg-badge-amber-text: #92400e;
				--lg-badge-gray-bg: #f3f4f6;
				--lg-badge-gray-text: #374151;
				--lg-alert-warn-bg: #fffbeb;
				--lg-alert-warn-border: #fcd34d;
				--lg-alert-warn-text: #78350f;
				--lg-dep-miss-color: #dc2626;
			}
			@media (prefers-color-scheme: dark) {
				:root {
					--lg-bg-card: #22272e;
					--lg-border-card: #373e47;
					--lg-shadow-card: 0 2px 6px rgba(0, 0, 0, 0.3);
					--lg-border-subtle: #2d333b;
					--lg-border-divider: #373e47;
					--lg-bg-subtle: #1c2128;
					--lg-bg-hover: #2d333b;
					--lg-text-primary: #adbac7;
					--lg-text-secondary: #909dab;
					--lg-text-muted: #768390;
					--lg-badge-ok-bg: rgba(46, 160, 67, 0.2);
					--lg-badge-ok-text: #56d364;
					--lg-badge-warn-bg: rgba(248, 81, 73, 0.2);
					--lg-badge-warn-text: #ff7b72;
					--lg-badge-info-bg: rgba(56, 139, 253, 0.2);
					--lg-badge-info-text: #79c0ff;
					--lg-badge-purple-bg: rgba(163, 113, 247, 0.2);
					--lg-badge-purple-text: #d2a8ff;
					--lg-badge-amber-bg: rgba(210, 153, 34, 0.2);
					--lg-badge-amber-text: #e3b341;
					--lg-badge-gray-bg: rgba(118, 131, 144, 0.2);
					--lg-badge-gray-text: #adbac7;
					--lg-alert-warn-bg: rgba(210, 153, 34, 0.15);
					--lg-alert-warn-border: rgba(210, 153, 34, 0.4);
					--lg-alert-warn-text: #f0c563;
					--lg-dep-miss-color: #ff7b72;
				}
			}
			[data-theme="dark"], [data-theme="dark-mode"], [data-darkmode="true"], [data-color-scheme="dark"],
			.dark, .dark-mode, body.dark, html.dark, .lg-dark {
				--lg-bg-card: #22272e;
				--lg-border-card: #373e47;
				--lg-shadow-card: 0 2px 6px rgba(0, 0, 0, 0.3);
				--lg-border-subtle: #2d333b;
				--lg-border-divider: #373e47;
				--lg-bg-subtle: #1c2128;
				--lg-bg-hover: #2d333b;
				--lg-text-primary: #adbac7;
				--lg-text-secondary: #909dab;
				--lg-text-muted: #768390;
				--lg-badge-ok-bg: rgba(46, 160, 67, 0.2);
				--lg-badge-ok-text: #56d364;
				--lg-badge-warn-bg: rgba(248, 81, 73, 0.2);
				--lg-badge-warn-text: #ff7b72;
				--lg-badge-info-bg: rgba(56, 139, 253, 0.2);
				--lg-badge-info-text: #79c0ff;
				--lg-badge-purple-bg: rgba(163, 113, 247, 0.2);
				--lg-badge-purple-text: #d2a8ff;
				--lg-badge-amber-bg: rgba(210, 153, 34, 0.2);
				--lg-badge-amber-text: #e3b341;
				--lg-badge-gray-bg: rgba(118, 131, 144, 0.2);
				--lg-badge-gray-text: #adbac7;
				--lg-alert-warn-bg: rgba(210, 153, 34, 0.15);
				--lg-alert-warn-border: rgba(210, 153, 34, 0.4);
				--lg-alert-warn-text: #f0c563;
				--lg-dep-miss-color: #ff7b72;
			}
			[data-theme="light"], [data-color-scheme="light"], body.light, html.light {
				--lg-bg-card: #ffffff;
				--lg-border-card: #e5e7eb;
				--lg-shadow-card: 0 1px 3px rgba(0, 0, 0, 0.05);
				--lg-border-subtle: #f3f4f6;
				--lg-border-divider: #e5e7eb;
				--lg-bg-subtle: #f9fafb;
				--lg-bg-hover: #f3f4f6;
				--lg-text-primary: #1f2937;
				--lg-text-secondary: #4b5563;
				--lg-text-muted: #6b7280;
				--lg-badge-ok-bg: #d1fae5;
				--lg-badge-ok-text: #065f46;
				--lg-badge-warn-bg: #fee2e2;
				--lg-badge-warn-text: #991b1b;
				--lg-badge-info-bg: #dbeafe;
				--lg-badge-info-text: #1e40af;
				--lg-badge-purple-bg: #ede9fe;
				--lg-badge-purple-text: #5b21b6;
				--lg-badge-amber-bg: #fef3c7;
				--lg-badge-amber-text: #92400e;
				--lg-badge-gray-bg: #f3f4f6;
				--lg-badge-gray-text: #374151;
				--lg-alert-warn-bg: #fffbeb;
				--lg-alert-warn-border: #fcd34d;
				--lg-alert-warn-text: #78350f;
				--lg-dep-miss-color: #dc2626;
			}

			.lg-card { background: var(--lg-bg-card); border: 1px solid var(--lg-border-card); border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; box-shadow: var(--lg-shadow-card); transition: background .2s, border-color .2s; }
			.lg-card h3 { margin: 0 0 16px; font-size: 1rem; color: var(--lg-text-primary); border-bottom: 1px solid var(--lg-border-divider); padding-bottom: 8px; }
			.lg-stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
			.lg-stat { display: flex; flex-direction: column; gap: 4px; }
			.lg-stat-label { font-size: .75rem; color: var(--lg-text-muted); text-transform: uppercase; letter-spacing: .05em; }
			.lg-stat-value { font-size: 1rem; font-weight: 600; color: var(--lg-text-primary); display: flex; align-items: center; gap: 6px; }
			.lg-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: .8rem; font-weight: 600; }
			.lg-badge-running { background: var(--lg-badge-ok-bg); color: var(--lg-badge-ok-text); }
			.lg-badge-stopped { background: var(--lg-badge-warn-bg); color: var(--lg-badge-warn-text); }
			.lg-badge-tun     { background: var(--lg-badge-info-bg); color: var(--lg-badge-info-text); }
			.lg-badge-tproxy  { background: var(--lg-badge-purple-bg); color: var(--lg-badge-purple-text); }
			.lg-badge-fw4     { background: var(--lg-badge-amber-bg); color: var(--lg-badge-amber-text); }
			.lg-badge-fw3     { background: var(--lg-badge-gray-bg); color: var(--lg-badge-gray-text); }
			.lg-btn-group { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
			.lg-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; transition: opacity .15s; }
			.lg-btn:disabled { opacity: .4; cursor: not-allowed; }
			.lg-btn-green  { background: #10b981; color: #fff; }
			.lg-btn-red    { background: #ef4444; color: #fff; }
			.lg-btn-blue   { background: #3b82f6; color: #fff; }
			.lg-btn-purple { background: #8b5cf6; color: #fff; }
			.lg-btn:not(:disabled):hover { opacity: .85; }
			.lg-alert { border-radius: 6px; padding: 12px 16px; }
			.lg-alert-warning { background: var(--lg-alert-warn-bg); border: 1px solid var(--lg-alert-warn-border); color: var(--lg-alert-warn-text); }
			.lg-alert-warning strong { display: block; margin-bottom: 4px; }
			.lg-alert p { margin: 4px 0 0; font-size: .88rem; }
			.lg-not-installed { text-align: center; padding: 40px 20px; color: var(--lg-text-muted); }
			.lg-not-installed .lg-icon { font-size: 3rem; margin-bottom: 12px; }
			.lg-dep-box { background: var(--lg-bg-subtle); border: 1px solid var(--lg-border-divider); border-radius: 6px; padding: 10px 14px; margin: 12px 0; }
		`]);

		if (!installed) {
			return E('div', {}, [
				style,
				E('div', { 'class': 'lg-card' }, [
					E('div', { 'class': 'lg-not-installed' }, [
						E('div', { 'class': 'lg-icon' }, ['⚠️']),
						E('h3', {}, [_('leigod-acc 未安装')]),
						E('p', {}, [_('请前往「安装管理」页面安装 leigod-acc 软件包。')])
					])
				])
			]);
		}

		var self = this;

		// Helper to wait until service state is confirmed before showing notification
		function waitForState(expectedRunning, maxRetries) {
			maxRetries = maxRetries || 6;
			return callGetStatus().then(function (s) {
				updateStatus(s);
				if (s.running === expectedRunning || maxRetries <= 1) {
					return s;
				}
				return new Promise(function (resolve) {
					window.setTimeout(resolve, 600);
				}).then(function () {
					return waitForState(expectedRunning, maxRetries - 1);
				});
			});
		}

		// Control buttons
		var btnStart = E('button', {
			'class': 'lg-btn lg-btn-green',
			'id': 'lg-btn-start',
			'disabled': status.running ? '' : null,
			'click': function () {
				this.disabled = true;
				this.textContent = _('启动中...');
				var btn = this;
				callStart().then(function (res) {
					return waitForState(true, 6).then(function (s) {
						var ok = (res && res.code === 0) || s.running;
						var msg = ok ? _('服务已启动') : ((res && res.message) ? _('启动失败: ') + res.message : _('启动失败'));
						ui.addNotification(null, E('p', {}, [msg]), ok ? 'success' : 'danger');
					});
				}).catch(function (e) {
					ui.addNotification(null, E('p', {}, [_('启动失败: ') + (e.message || e)]), 'danger');
				}).finally(function () {
					btn.textContent = _('启动');
				});
			}
		}, [_('启动')]);

		var btnStop = E('button', {
			'class': 'lg-btn lg-btn-red',
			'id': 'lg-btn-stop',
			'disabled': !status.running ? '' : null,
			'click': function () {
				this.disabled = true;
				this.textContent = _('停止中...');
				var btn = this;
				callStop().then(function (res) {
					return waitForState(false, 6).then(function (s) {
						var ok = (res && res.code === 0) || !s.running;
						var msg = ok ? _('服务已停止') : ((res && res.message) ? _('停止失败: ') + res.message : _('停止失败'));
						ui.addNotification(null, E('p', {}, [msg]), ok ? 'success' : 'danger');
					});
				}).catch(function (e) {
					ui.addNotification(null, E('p', {}, [_('停止失败: ') + (e.message || e)]), 'danger');
				}).finally(function () {
					btn.textContent = _('停止');
				});
			}
		}, [_('停止')]);

		var btnRestart = E('button', {
			'class': 'lg-btn lg-btn-blue',
			'id': 'lg-btn-restart',
			'disabled': !status.running ? '' : null,
			'click': function () {
				this.disabled = true;
				this.textContent = _('重启中...');
				var btn = this;
				callRestart().then(function (res) {
					return waitForState(true, 6).then(function (s) {
						var ok = (res && res.code === 0) || s.running;
						var msg = ok ? _('服务已重启') : ((res && res.message) ? _('重启失败: ') + res.message : _('重启失败'));
						ui.addNotification(null, E('p', {}, [msg]), ok ? 'success' : 'danger');
					});
				}).catch(function (e) {
					ui.addNotification(null, E('p', {}, [_('重启失败: ') + (e.message || e)]), 'danger');
				}).finally(function () {
					btn.textContent = _('重启');
				});
			}
		}, [_('重启')]);

		var btnSwitch = E('button', {
			'class': 'lg-btn lg-btn-purple',
			'id': 'lg-btn-switch-mode',
			'click': function () {
				var btn = this;
				var cur = btn.dataset.mode || status.mode || 'tproxy';
				var target = cur === 'tun' ? 'tproxy' : 'tun';
				btn.disabled = true;
				btn.textContent = _('检查依赖中...');

				callGetDeps().then(function (deps) {
					var pkgs = (target === 'tun' ? (deps && deps.tun) : (deps && deps.tproxy)) || [];
					var missing = [];
					pkgs.forEach(function (p) {
						if (!p.installed) missing.push(p.name);
					});

					if (missing.length > 0) {
						btn.disabled = false;
						btn.textContent = (btn.dataset.mode || 'tproxy') === 'tun' ? _('切换到 TProxy 模式') : _('切换到 TUN 模式');

						ui.showModal(_('需要安装依赖组件'), [
							E('p', {}, [
								_('切换到 %s 模式需要安装对应的依赖组件，检测到以下依赖尚未就绪：').format(target.toUpperCase())
							]),
							E('div', { 'class': 'lg-dep-box' }, [
								E('ul', { 'style': 'margin: 0; padding-left: 20px; line-height: 1.8;' }, missing.map(function (pkg) {
									return E('li', {}, [
										E('strong', { 'style': 'font-family: monospace; color: var(--lg-dep-miss-color);' }, [pkg])
									]);
								}))
							]),
							E('p', { 'style': 'color: var(--lg-text-muted); font-size: .88rem; margin-bottom: 20px;' }, [
								_('请先前往「安装管理」页面安装对应依赖，完成后即可正常切换模式。')
							]),
							E('div', { 'class': 'right' }, [
								E('button', {
									'class': 'btn cbi-button-action',
									'style': 'margin-right: 8px;',
									'click': function () {
										ui.hideModal();
										location.href = L.url('admin/services/leigod/install');
									}
								}, [_('前往安装依赖')]),
								E('button', {
									'class': 'btn cbi-button-neutral',
									'click': ui.hideModal
								}, [_('取消')])
							])
						]);
						return;
					}

					btn.textContent = _('切换模式中...');
					return callSetMode(target).then(function (res) {
						return waitForState(true, 6).then(function (s) {
							var ok = (res && res.code === 0) || (s.mode === target && s.running);
							var msg = ok ? _('模式已切换为 ') + target.toUpperCase() : ((res && res.message) ? _('切换模式失败: ') + res.message : _('切换模式失败'));
							ui.addNotification(null, E('p', {}, [msg]), ok ? 'success' : 'danger');
						});
					});
				}).catch(function (e) {
					ui.addNotification(null, E('p', {}, [_('切换模式失败: ') + (e.message || e)]), 'danger');
				}).finally(function () {
					btn.disabled = false;
					btn.textContent = (btn.dataset.mode || 'tproxy') === 'tun' ? _('切换到 TProxy 模式') : _('切换到 TUN 模式');
				});
			}
		}, [status.mode === 'tun' ? _('切换到 TProxy 模式') : _('切换到 TUN 模式')]);
		btnSwitch.dataset.mode = status.mode || 'tproxy';

		var view = E('div', {}, [
			style,

			// Compat warning (hidden by default, shown via updateStatus)
			E('div', {
				'class': 'lg-alert lg-alert-warning',
				'id': 'lg-compat-warn',
				'style': 'display:none; margin-bottom:16px;'
			}, [
				E('strong', {}, [_('兼容性警告')]),
				E('p', {}, [
					_('当前系统使用 fw4 (nftables)，但 TProxy 模式需要 iptables-legacy 支持。'),
					E('br'),
					_('建议切换到 TUN 模式，或安装 iptables-legacy 兼容包。')
				])
			]),

			// Status card
			E('div', { 'class': 'lg-card' }, [
				E('h3', {}, [_('运行状态')]),
				E('div', { 'class': 'lg-stat-grid' }, [
					E('div', { 'class': 'lg-stat' }, [
						E('span', { 'class': 'lg-stat-label' }, [_('服务状态')]),
						E('span', { 'class': 'lg-stat-value' }, [
							E('span', {
								'class': status.running ? 'lg-badge lg-badge-running' : 'lg-badge lg-badge-stopped',
								'id': 'lg-status-badge'
							}, [status.running ? _('运行中') : _('已停止')])
						])
					]),
					E('div', { 'class': 'lg-stat' }, [
						E('span', { 'class': 'lg-stat-label' }, [_('运行模式')]),
						E('span', { 'class': 'lg-stat-value' }, [
							E('span', {
								'class': status.mode === 'tun' ? 'lg-badge lg-badge-tun' : 'lg-badge lg-badge-tproxy',
								'id': 'lg-mode-badge'
							}, [status.mode === 'tun' ? 'TUN' : 'TProxy'])
						])
					]),
					E('div', { 'class': 'lg-stat' }, [
						E('span', { 'class': 'lg-stat-label' }, [_('运行时长')]),
						E('span', { 'class': 'lg-stat-value', 'id': 'lg-uptime' }, [status.uptime || '--'])
					]),
					E('div', { 'class': 'lg-stat' }, [
						E('span', { 'class': 'lg-stat-label' }, [_('版本')]),
						E('span', { 'class': 'lg-stat-value', 'id': 'lg-version' }, [status.version || _('未知')])
					]),
					E('div', { 'class': 'lg-stat' }, [
						E('span', { 'class': 'lg-stat-label' }, [_('防火墙框架')]),
						E('span', { 'class': 'lg-stat-value' }, [
							E('span', {
								'class': status.fw === 'fw4' ? 'lg-badge lg-badge-fw4' : 'lg-badge lg-badge-fw3',
								'id': 'lg-fw-badge'
							}, [status.fw === 'fw4' ? 'nftables (fw4)' : 'iptables (fw3)'])
						])
					])
				])
			]),

			// Control card
			E('div', { 'class': 'lg-card' }, [
				E('h3', {}, [_('服务控制')]),
				E('div', { 'class': 'lg-btn-group' }, [btnStart, btnStop, btnRestart, btnSwitch])
			])
		]);

		// Poll every 5 seconds
		poll.add(function () {
			return callGetStatus().then(function (s) {
				updateStatus(s);
			});
		}, 5);

		// Initial compat warning render
		updateStatus(status);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

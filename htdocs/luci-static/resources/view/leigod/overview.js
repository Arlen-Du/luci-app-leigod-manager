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

		// Inline CSS (injected once)
		var style = E('style', {}, [`
			.lg-card { background: var(--cbi-section-bg,#fff); border: 1px solid var(--cbi-section-border,#ddd); border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
			.lg-card h3 { margin: 0 0 16px; font-size: 1rem; color: var(--cbi-label-color,#333); border-bottom: 1px solid var(--cbi-section-border,#eee); padding-bottom: 8px; }
			.lg-stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
			.lg-stat { display: flex; flex-direction: column; gap: 4px; }
			.lg-stat-label { font-size: .75rem; color: var(--cbi-label-color,#888); text-transform: uppercase; letter-spacing: .05em; }
			.lg-stat-value { font-size: 1rem; font-weight: 600; color: var(--cbi-value-color,#222); display: flex; align-items: center; gap: 6px; }
			.lg-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: .8rem; font-weight: 600; }
			.lg-badge-running { background: #d1fae5; color: #065f46; }
			.lg-badge-stopped { background: #fee2e2; color: #991b1b; }
			.lg-badge-tun     { background: #dbeafe; color: #1e40af; }
			.lg-badge-tproxy  { background: #ede9fe; color: #5b21b6; }
			.lg-badge-fw4     { background: #fef3c7; color: #92400e; }
			.lg-badge-fw3     { background: #f3f4f6; color: #374151; }
			.lg-btn-group { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
			.lg-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; transition: opacity .15s; }
			.lg-btn:disabled { opacity: .4; cursor: not-allowed; }
			.lg-btn-green  { background: #10b981; color: #fff; }
			.lg-btn-red    { background: #ef4444; color: #fff; }
			.lg-btn-blue   { background: #3b82f6; color: #fff; }
			.lg-btn-purple { background: #8b5cf6; color: #fff; }
			.lg-btn:not(:disabled):hover { opacity: .85; }
			.lg-alert { border-radius: 6px; padding: 12px 16px; }
			.lg-alert-warning { background: #fffbeb; border: 1px solid #fcd34d; color: #78350f; }
			.lg-alert-warning strong { display: block; margin-bottom: 4px; }
			.lg-alert p { margin: 4px 0 0; font-size: .88rem; }
			.lg-not-installed { text-align: center; padding: 40px 20px; color: var(--cbi-label-color,#888); }
			.lg-not-installed .lg-icon { font-size: 3rem; margin-bottom: 12px; }
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
				this.disabled = true;
				var cur = this.dataset.mode || status.mode || 'tproxy';
				var target = cur === 'tun' ? 'tproxy' : 'tun';
				this.textContent = _('切换模式中...');
				var btn = this;
				callSetMode(target).then(function (res) {
					return waitForState(true, 6).then(function (s) {
						var ok = (res && res.code === 0) || (s.mode === target && s.running);
						var msg = ok ? _('模式已切换为 ') + target.toUpperCase() : ((res && res.message) ? _('切换模式失败: ') + res.message : _('切换模式失败'));
						ui.addNotification(null, E('p', {}, [msg]), ok ? 'success' : 'danger');
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

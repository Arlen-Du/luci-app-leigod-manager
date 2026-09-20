'use strict';
'require view';
'require form';
'require rpc';
'require ui';

var callGetConfig = rpc.declare({
	object: 'leigod',
	method: 'get_config',
	expect: {}
});

var callSetConfig = rpc.declare({
	object: 'leigod',
	method: 'set_config',
	params: ['enabled', 'mode', 'log_level'],
	expect: {}
});

var callGetStatus = rpc.declare({
	object: 'leigod',
	method: 'get_status',
	expect: {}
});

var callSetMode = rpc.declare({
	object: 'leigod',
	method: 'set_mode',
	params: ['mode'],
	expect: {}
});

return view.extend({
	load: function () {
		return Promise.all([callGetConfig(), callGetStatus()]);
	},

	render: function (data) {
		var cfg    = data[0];
		var status = data[1];

		var style = E('style', {}, [`
			.lg-card { background: var(--cbi-section-bg,#fff); border: 1px solid var(--cbi-section-border,#ddd); border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
			.lg-card h3 { margin: 0 0 16px; font-size: 1rem; color: var(--cbi-label-color,#333); border-bottom: 1px solid var(--cbi-section-border,#eee); padding-bottom: 8px; }
			.lg-form-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--cbi-section-border,#f0f0f0); }
			.lg-form-row:last-child { border-bottom: none; }
			.lg-form-label { flex: 1; }
			.lg-form-label strong { display: block; font-size: .9rem; color: var(--cbi-value-color,#222); }
			.lg-form-label span { font-size: .78rem; color: var(--cbi-label-color,#888); }
			.lg-form-control { flex: 0 0 auto; }
			.lg-toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
			.lg-toggle input { opacity: 0; width: 0; height: 0; }
			.lg-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #ccc; border-radius: 24px; transition: .2s; }
			.lg-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: .2s; }
			input:checked + .lg-slider { background: #10b981; }
			input:checked + .lg-slider:before { transform: translateX(20px); }
			.lg-select { padding: 6px 12px; border: 1px solid var(--cbi-section-border,#ddd); border-radius: 6px; background: var(--cbi-section-bg,#fff); color: var(--cbi-value-color,#222); font-size: .9rem; min-width: 140px; }
			.lg-save-bar { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; }
			.lg-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; transition: opacity .15s; }
			.lg-btn-green { background: #10b981; color: #fff; }
			.lg-btn:not(:disabled):hover { opacity: .85; }
			.lg-alert { border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
			.lg-alert-info { background: #eff6ff; border: 1px solid #93c5fd; color: #1e3a8a; font-size: .88rem; }
		`]);

		// Mode warning for tproxy + fw4
		var modeNote = null;
		if (status.fw === 'fw4') {
			modeNote = E('div', { 'class': 'lg-alert lg-alert-info' }, [
				_('检测到系统使用 fw4 (nftables)。TUN 模式与 fw4 完全兼容；TProxy 模式需额外安装 iptables-legacy 兼容包。')
			]);
		}

		// State holders
		var state = {
			enabled:   cfg.enabled,
			mode:      cfg.mode || 'tun',
			log_level: cfg.log_level || 'info'
		};

		// Toggle helper
		function mkToggle(id, checked, onChange) {
			var inp = E('input', { 'type': 'checkbox', 'id': id });
			inp.checked = !!checked;
			inp.addEventListener('change', function () { onChange(this.checked); });
			return E('label', { 'class': 'lg-toggle' }, [inp, E('span', { 'class': 'lg-slider' })]);
		}

		// Mode select
		var modeSelect = E('select', { 'class': 'lg-select', 'id': 'lg-sel-mode' }, [
			E('option', { 'value': 'tun',    'selected': state.mode === 'tun'    }, ['TUN']),
			E('option', { 'value': 'tproxy', 'selected': state.mode === 'tproxy' }, ['TProxy'])
		]);
		modeSelect.addEventListener('change', function () { state.mode = this.value; });

		// Log level select
		var logSelect = E('select', { 'class': 'lg-select', 'id': 'lg-sel-loglevel' }, [
			E('option', { 'value': 'debug', 'selected': state.log_level === 'debug' }, [_('调试 (debug)')]),
			E('option', { 'value': 'info',  'selected': state.log_level === 'info'  }, [_('信息 (info)')]),
			E('option', { 'value': 'warn',  'selected': state.log_level === 'warn'  }, [_('警告 (warn)')])
		]);
		logSelect.addEventListener('change', function () { state.log_level = this.value; });

		var enabledToggle = mkToggle('lg-tog-enabled', state.enabled, function (v) { state.enabled = v; });

		var saveBtn = E('button', {
			'class': 'lg-btn lg-btn-green',
			'id': 'lg-btn-save',
			'click': function () {
				var self = this;
				self.disabled = true;
				self.textContent = _('保存中...');
				callSetConfig(state.enabled, state.mode, state.log_level)
					.then(function (result) {
						if (result && result.code === 0) {
							ui.addNotification(null, E('p', {}, [_('设置已保存，服务将自动重启')]), 'success');
						} else {
							ui.addNotification(null, E('p', {}, [_('保存失败：') + (result ? result.message : '')]), 'danger');
						}
					})
					.catch(function (err) {
						ui.addNotification(null, E('p', {}, [_('请求失败：') + err]), 'danger');
					})
					.finally(function () {
						self.disabled = false;
						self.textContent = _('保存并应用');
					});
			}
		}, [_('保存并应用')]);

		return E('div', {}, [
			style,
			modeNote,

			E('div', { 'class': 'lg-card' }, [
				E('h3', {}, [_('基本设置')]),

				// Enabled
				E('div', { 'class': 'lg-form-row' }, [
					E('div', { 'class': 'lg-form-label' }, [
						E('strong', {}, [_('开机自启')]),
						E('span', {}, [_('路由器启动时自动运行雷神加速器')])
					]),
					E('div', { 'class': 'lg-form-control' }, [enabledToggle])
				]),

				// Mode
				E('div', { 'class': 'lg-form-row' }, [
					E('div', { 'class': 'lg-form-label' }, [
						E('strong', {}, [_('运行模式')]),
						E('span', {}, [_('TUN 模式兼容性最佳；TProxy 模式性能较高但需 iptables 支持')])
					]),
					E('div', { 'class': 'lg-form-control' }, [modeSelect])
				]),

				// Log level
				E('div', { 'class': 'lg-form-row' }, [
					E('div', { 'class': 'lg-form-label' }, [
						E('strong', {}, [_('日志级别')]),
						E('span', {}, [_('控制写入日志文件的详细程度')])
					]),
					E('div', { 'class': 'lg-form-control' }, [logSelect])
				])
			]),

			E('div', { 'class': 'lg-save-bar' }, [saveBtn])
		]);
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});

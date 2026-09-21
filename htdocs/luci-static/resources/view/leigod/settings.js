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

var callGetDeps = rpc.declare({
	object: 'leigod',
	method: 'get_deps',
	expect: {}
});

return view.extend({
	load: function () {
		return Promise.all([
			callGetConfig(),
			callGetStatus(),
			callGetDeps().catch(function () { return {}; })
		]);
	},

	render: function (data) {
		var cfg    = data[0] || {};
		var status = data[1] || {};
		var deps   = data[2] || {};

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

		var style = E('style', {}, [`
			:root {
				--lg-bg-card: #ffffff;
				--lg-border-card: #e5e7eb;
				--lg-shadow-card: 0 1px 3px rgba(0, 0, 0, 0.05);
				--lg-border-subtle: #f3f4f6;
				--lg-border-divider: #e5e7eb;
				--lg-bg-subtle: #f9fafb;
				--lg-text-primary: #1f2937;
				--lg-text-secondary: #4b5563;
				--lg-text-muted: #6b7280;
				--lg-input-bg: #ffffff;
				--lg-input-border: #d1d5db;
				--lg-input-color: #1f2937;
				--lg-slider-bg: #cbd5e1;
				--lg-slider-thumb: #ffffff;
				--lg-alert-warn-bg: #fffbeb;
				--lg-alert-warn-border: #fcd34d;
				--lg-alert-warn-text: #92400e;
				--lg-alert-info-bg: #eff6ff;
				--lg-alert-info-border: #93c5fd;
				--lg-alert-info-text: #1e3a8a;
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
					--lg-text-primary: #adbac7;
					--lg-text-secondary: #909dab;
					--lg-text-muted: #768390;
					--lg-input-bg: #1c2128;
					--lg-input-border: #444c56;
					--lg-input-color: #cdd9e5;
					--lg-slider-bg: #444c56;
					--lg-slider-thumb: #adbac7;
					--lg-alert-warn-bg: rgba(210, 153, 34, 0.15);
					--lg-alert-warn-border: rgba(210, 153, 34, 0.4);
					--lg-alert-warn-text: #f0c563;
					--lg-alert-info-bg: rgba(56, 139, 253, 0.15);
					--lg-alert-info-border: rgba(56, 139, 253, 0.4);
					--lg-alert-info-text: #9ecbff;
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
				--lg-text-primary: #adbac7;
				--lg-text-secondary: #909dab;
				--lg-text-muted: #768390;
				--lg-input-bg: #1c2128;
				--lg-input-border: #444c56;
				--lg-input-color: #cdd9e5;
				--lg-slider-bg: #444c56;
				--lg-slider-thumb: #adbac7;
				--lg-alert-warn-bg: rgba(210, 153, 34, 0.15);
				--lg-alert-warn-border: rgba(210, 153, 34, 0.4);
				--lg-alert-warn-text: #f0c563;
				--lg-alert-info-bg: rgba(56, 139, 253, 0.15);
				--lg-alert-info-border: rgba(56, 139, 253, 0.4);
				--lg-alert-info-text: #9ecbff;
				--lg-dep-miss-color: #ff7b72;
			}
			[data-theme="light"], [data-color-scheme="light"], body.light, html.light {
				--lg-bg-card: #ffffff;
				--lg-border-card: #e5e7eb;
				--lg-shadow-card: 0 1px 3px rgba(0, 0, 0, 0.05);
				--lg-border-subtle: #f3f4f6;
				--lg-border-divider: #e5e7eb;
				--lg-bg-subtle: #f9fafb;
				--lg-text-primary: #1f2937;
				--lg-text-secondary: #4b5563;
				--lg-text-muted: #6b7280;
				--lg-input-bg: #ffffff;
				--lg-input-border: #d1d5db;
				--lg-input-color: #1f2937;
				--lg-slider-bg: #cbd5e1;
				--lg-slider-thumb: #ffffff;
				--lg-alert-warn-bg: #fffbeb;
				--lg-alert-warn-border: #fcd34d;
				--lg-alert-warn-text: #92400e;
				--lg-alert-info-bg: #eff6ff;
				--lg-alert-info-border: #93c5fd;
				--lg-alert-info-text: #1e3a8a;
				--lg-dep-miss-color: #dc2626;
			}

			.lg-card { background: var(--lg-bg-card); border: 1px solid var(--lg-border-card); border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; box-shadow: var(--lg-shadow-card); transition: background .2s, border-color .2s; }
			.lg-card h3 { margin: 0 0 16px; font-size: 1rem; color: var(--lg-text-primary); border-bottom: 1px solid var(--lg-border-divider); padding-bottom: 8px; }
			.lg-form-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--lg-border-subtle); }
			.lg-form-row:last-child { border-bottom: none; }
			.lg-form-col { flex-direction: column; align-items: stretch; }
			.lg-form-col .lg-form-main { display: flex; align-items: center; justify-content: space-between; width: 100%; }
			.lg-form-label { flex: 1; }
			.lg-form-label strong { display: block; font-size: .9rem; color: var(--lg-text-primary); }
			.lg-form-label span { font-size: .78rem; color: var(--lg-text-muted); }
			.lg-form-control { flex: 0 0 auto; }
			.lg-toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
			.lg-toggle input { opacity: 0; width: 0; height: 0; }
			.lg-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: var(--lg-slider-bg); border-radius: 24px; transition: .2s; }
			.lg-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: var(--lg-slider-thumb); border-radius: 50%; transition: .2s; }
			input:checked + .lg-slider { background: #10b981; }
			input:checked + .lg-slider:before { transform: translateX(20px); background: #fff; }
			.lg-select { padding: 6px 12px; border: 1px solid var(--lg-input-border); border-radius: 6px; background: var(--lg-input-bg); color: var(--lg-input-color); font-size: .9rem; min-width: 140px; }
			.lg-save-bar { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; }
			.lg-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: .9rem; font-weight: 600; transition: opacity .15s; }
			.lg-btn-green { background: #10b981; color: #fff; }
			.lg-btn:not(:disabled):hover { opacity: .85; }
			.lg-alert { border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
			.lg-alert-info { background: var(--lg-alert-info-bg); border: 1px solid var(--lg-alert-info-border); color: var(--lg-alert-info-text); font-size: .88rem; }
			.lg-alert-warn { background: var(--lg-alert-warn-bg); border: 1px solid var(--lg-alert-warn-border); color: var(--lg-alert-warn-text); font-size: .88rem; }
			.lg-dep-box { background: var(--lg-bg-subtle); border: 1px solid var(--lg-border-divider); border-radius: 6px; padding: 10px 14px; margin: 12px 0; }
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

		function getMissingDeps(targetMode, depsData) {
			var pkgs = (targetMode === 'tun' ? (depsData && depsData.tun) : (depsData && depsData.tproxy)) || [];
			var missing = [];
			pkgs.forEach(function (p) {
				if (!p.installed) missing.push(p.name);
			});
			return missing;
		}

		// Mode dependency inline warning
		var modeDepAlert = E('div', {
			'class': 'lg-alert lg-alert-warn',
			'id': 'lg-mode-dep-warn',
			'style': 'display: none; margin-top: 10px;'
		});

		function updateModeDepAlert(selectedMode) {
			var missing = getMissingDeps(selectedMode, deps);
			if (missing.length > 0) {
				modeDepAlert.style.display = 'block';
				modeDepAlert.innerHTML = '';
				modeDepAlert.appendChild(E('span', {}, [
					E('strong', {}, [_('⚠️ 依赖未就绪：')]),
					_('当前选择的 %s 模式缺少以下必要依赖：').format(selectedMode.toUpperCase()),
					E('span', { 'style': 'font-family: monospace; font-weight: bold; color: var(--lg-dep-miss-color);' }, [missing.join(', ')]),
					_('。请在保存前前往 '),
					E('a', { 'href': L.url('admin/services/leigod/install'), 'style': 'text-decoration: underline; font-weight: 600;' }, [_('安装管理')]),
					_(' 页面安装依赖。')
				]));
			} else {
				modeDepAlert.style.display = 'none';
			}
		}

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
		modeSelect.addEventListener('change', function () {
			state.mode = this.value;
			updateModeDepAlert(this.value);
		});

		// Initial check for mode dependency alert
		updateModeDepAlert(state.mode);

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

				// Verify dependencies if service is enabled
				if (state.enabled) {
					var missing = getMissingDeps(state.mode, deps);
					if (missing.length > 0) {
						ui.showModal(_('需要安装依赖组件'), [
							E('p', {}, [
								_('所选的 %s 模式依赖尚未安装完成，无法启动加速服务。检测到缺少以下依赖：').format(state.mode.toUpperCase())
							]),
							E('div', { 'class': 'lg-dep-box' }, [
								E('ul', { 'style': 'margin: 0; padding-left: 20px; line-height: 1.8;' }, missing.map(function (pkg) {
									return E('li', {}, [
										E('strong', { 'style': 'font-family: monospace; color: var(--lg-dep-miss-color);' }, [pkg])
									]);
								}))
							]),
							E('p', { 'style': 'color: var(--lg-text-muted); font-size: .88rem; margin-bottom: 20px;' }, [
								_('请先前往「安装管理」页面安装对应依赖，完成后即可正常保存并应用。')
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
				}

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
				E('div', { 'class': 'lg-form-row lg-form-col' }, [
					E('div', { 'class': 'lg-form-main' }, [
						E('div', { 'class': 'lg-form-label' }, [
							E('strong', {}, [_('运行模式')]),
							E('span', {}, [_('TUN 模式兼容性最佳；TProxy 模式性能较高但需 iptables 支持')])
						]),
						E('div', { 'class': 'lg-form-control' }, [modeSelect])
					]),
					modeDepAlert
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

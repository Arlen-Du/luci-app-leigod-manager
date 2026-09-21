'use strict';
'require view';
'require rpc';
'require poll';

var callGetLogs = rpc.declare({
	object: 'leigod',
	method: 'get_logs',
	params: ['lines'],
	expect: {}
});

// Simple ANSI-like keyword highlighter
var HIGHLIGHTS = [
	{ re: /\bERROR\b|\bFAIL\b|\bFailed\b|\berr\b|\berror\b/gi,   cls: 'lg-log-error'   },
	{ re: /\bWARN\b|\bWARNING\b|\bwarn\b|\bwarning\b/gi,         cls: 'lg-log-warn'    },
	{ re: /\bINFO\b|\bStarted\b|\bStopped\b|\bnotice\b/gi,       cls: 'lg-log-info'    },
	{ re: /\bDEBUG\b|\bdebug\b/gi,                               cls: 'lg-log-debug'   },
	{ re: /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/g,           cls: 'lg-log-time'    },
	{ re: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+\s+\d{2}:\d{2}:\d{2}/g, cls: 'lg-log-time' }
];

function highlightLine(line) {
	// Return a span element with coloured keywords
	var result  = document.createDocumentFragment();
	var lastIdx = 0;
	var matches = [];

	HIGHLIGHTS.forEach(function (h) {
		h.re.lastIndex = 0;
		var m;
		while ((m = h.re.exec(line)) !== null) {
			matches.push({ start: m.index, end: h.re.lastIndex, text: m[0], cls: h.cls });
		}
	});

	matches.sort(function (a, b) { return a.start - b.start; });
	// Remove overlapping
	var filtered = [];
	var prevEnd  = -1;
	matches.forEach(function (m) {
		if (m.start >= prevEnd) { filtered.push(m); prevEnd = m.end; }
	});

	filtered.forEach(function (m) {
		if (m.start > lastIdx) {
			result.appendChild(document.createTextNode(line.slice(lastIdx, m.start)));
		}
		var s = E('span', { 'class': m.cls }, [m.text]);
		result.appendChild(s);
		lastIdx = m.end;
	});
	if (lastIdx < line.length) {
		result.appendChild(document.createTextNode(line.slice(lastIdx)));
	}
	return result;
}

function renderLines(text, container, shouldAutoScroll) {
	var prevScrollTop = container.scrollTop;
	var wasAtBottom = (container.scrollHeight - container.scrollTop - container.clientHeight) < 30;

	container.innerHTML = '';
	var lines = (text || '').split(/\r?\n|\\n/);
	var count = 0;
	lines.forEach(function (line) {
		if (!line || !line.trim()) return;
		var div = E('div', { 'class': 'lg-log-line' });
		div.appendChild(highlightLine(line));
		container.appendChild(div);
		count++;
	});

	if (count === 0) {
		var emptyDiv = E('div', {
			'style': 'color: var(--lg-text-muted); font-style: italic; padding: 24px 12px; text-align: center;'
		}, [_('暂无日志记录')]);
		container.appendChild(emptyDiv);
	} else if (shouldAutoScroll !== false && (shouldAutoScroll || wasAtBottom)) {
		container.scrollTop = container.scrollHeight;
	} else {
		container.scrollTop = prevScrollTop;
	}
}

return view.extend({
	load: function () {
		return callGetLogs(200);
	},

	render: function (data) {
		var initialContent = (data && data.content) ? data.content : '';
		var initialSyslog  = (data && data.syslog)  ? data.syslog  : '';

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
				--lg-badge-ok-bg: #d1fae5;
				--lg-badge-ok-text: #065f46;
				--lg-badge-warn-bg: #fee2e2;
				--lg-badge-warn-text: #991b1b;
				--lg-tab-bg: #f3f4f6;
				--lg-tab-text: #6b7280;
				--lg-tab-active-bg: #ffffff;
				--lg-tab-active-text: #111827;
				--lg-tab-border: #e5e7eb;
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
					--lg-badge-ok-bg: rgba(46, 160, 67, 0.2);
					--lg-badge-ok-text: #56d364;
					--lg-badge-warn-bg: rgba(248, 81, 73, 0.2);
					--lg-badge-warn-text: #ff7b72;
					--lg-tab-bg: #1c2128;
					--lg-tab-text: #768390;
					--lg-tab-active-bg: #22272e;
					--lg-tab-active-text: #adbac7;
					--lg-tab-border: #373e47;
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
				--lg-badge-ok-bg: rgba(46, 160, 67, 0.2);
				--lg-badge-ok-text: #56d364;
				--lg-badge-warn-bg: rgba(248, 81, 73, 0.2);
				--lg-badge-warn-text: #ff7b72;
				--lg-tab-bg: #1c2128;
				--lg-tab-text: #768390;
				--lg-tab-active-bg: #22272e;
				--lg-tab-active-text: #adbac7;
				--lg-tab-border: #373e47;
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
				--lg-badge-ok-bg: #d1fae5;
				--lg-badge-ok-text: #065f46;
				--lg-badge-warn-bg: #fee2e2;
				--lg-badge-warn-text: #991b1b;
				--lg-tab-bg: #f3f4f6;
				--lg-tab-text: #6b7280;
				--lg-tab-active-bg: #ffffff;
				--lg-tab-active-text: #111827;
				--lg-tab-border: #e5e7eb;
			}

			.lg-card { background: var(--lg-bg-card); border: 1px solid var(--lg-border-card); border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; box-shadow: var(--lg-shadow-card); transition: background .2s, border-color .2s; }
			.lg-card h3 { margin: 0 0 12px; font-size: 1rem; color: var(--lg-text-primary); border-bottom: 1px solid var(--lg-border-divider); padding-bottom: 8px; }
			.lg-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
			.lg-btn { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: .85rem; font-weight: 600; transition: opacity .15s; }
			.lg-btn-blue  { background: #3b82f6; color: #fff; }
			.lg-btn-gray  { background: #6b7280; color: #fff; }
			.lg-btn:hover { opacity: .85; }
			.lg-log-box { background: #0d1117; color: #c9d1d9; font-family: 'Courier New', monospace; font-size: .8rem; border: 1px solid var(--lg-border-divider); border-radius: 6px; padding: 12px 14px; height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
			.lg-log-line { line-height: 1.6; }
			.lg-log-error { color: #f87171; font-weight: 700; }
			.lg-log-warn  { color: #fbbf24; font-weight: 600; }
			.lg-log-info  { color: #34d399; }
			.lg-log-debug { color: #60a5fa; }
			.lg-log-time  { color: #a78bfa; }
			.lg-tab-bar { display: flex; gap: 2px; margin-bottom: 12px; }
			.lg-tab { padding: 6px 16px; border-radius: 6px 6px 0 0; border: 1px solid var(--lg-tab-border); border-bottom: none; cursor: pointer; font-size: .88rem; background: var(--lg-tab-bg); color: var(--lg-tab-text); }
			.lg-tab.active { background: var(--lg-tab-active-bg); color: var(--lg-tab-active-text); font-weight: 600; }
			.lg-label { font-size: .82rem; color: var(--lg-text-muted); }
			.lg-auto-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: .75rem; background: var(--lg-badge-ok-bg); color: var(--lg-badge-ok-text); font-weight: 600; transition: background .2s, color .2s; }
			.lg-auto-badge.paused { background: var(--lg-badge-warn-bg); color: var(--lg-badge-warn-text); }
			.lg-filter-input { flex: 1; min-width: 160px; padding: 5px 10px; border: 1px solid var(--lg-input-border); border-radius: 5px; font-size: .85rem; background: var(--lg-input-bg); color: var(--lg-input-color); }
		`]);

		// Tab state
		var activeTab = 'service';

		var logBox1    = E('div', { 'class': 'lg-log-box', 'id': 'lg-logbox-service' });
		var logBox2    = E('div', { 'class': 'lg-log-box', 'id': 'lg-logbox-syslog',  'style': 'display:none' });

		renderLines(initialContent, logBox1, autoScroll);
		renderLines(initialSyslog,  logBox2, autoScroll);

		// Auto-scroll toggle
		var autoScroll = true;
		var autoLabel  = E('span', { 'class': 'lg-auto-badge', 'id': 'lg-auto-badge' }, [_('自动滚动')]);

		// Filter input
		var filterInput = E('input', {
			'type': 'text',
			'class': 'lg-filter-input',
			'placeholder': _('关键词过滤...'),
			'input': function () {
				var keyword = this.value.toLowerCase();
				var box = activeTab === 'service' ? logBox1 : logBox2;
				Array.prototype.forEach.call(box.querySelectorAll('.lg-log-line'), function (line) {
					line.style.display = (!keyword || line.textContent.toLowerCase().indexOf(keyword) !== -1) ? '' : 'none';
				});
			}
		});

		// Tabs
		var tab1 = E('div', { 'class': 'lg-tab active', 'id': 'lg-tab1', 'click': function () {
			activeTab = 'service';
			this.className = 'lg-tab active';
			document.getElementById('lg-tab2').className = 'lg-tab';
			logBox1.style.display = '';
			logBox2.style.display = 'none';
			filterInput.value = '';
			// reset filter
			Array.prototype.forEach.call(logBox1.querySelectorAll('.lg-log-line'), function (l) { l.style.display = ''; });
		}}, [_('服务日志')]);

		var tab2 = E('div', { 'class': 'lg-tab', 'id': 'lg-tab2', 'click': function () {
			activeTab = 'syslog';
			this.className = 'lg-tab active';
			document.getElementById('lg-tab1').className = 'lg-tab';
			logBox1.style.display = 'none';
			logBox2.style.display = '';
			filterInput.value = '';
			Array.prototype.forEach.call(logBox2.querySelectorAll('.lg-log-line'), function (l) { l.style.display = ''; });
			// 切换到系统日志标签时主动请求一次最新日志
			callGetLogs(300).then(function (d) {
				if (d && d.syslog) {
					renderLines(d.syslog, logBox2, autoScroll);
				}
			});
		}}, [_('系统日志 (leigod)')]);

		// Toolbar buttons
		var refreshBtn = E('button', { 'class': 'lg-btn lg-btn-blue', 'click': function () {
			callGetLogs(500).then(function (d) {
				if (d) {
					renderLines(d.content || '', logBox1, autoScroll);
					renderLines(d.syslog  || '', logBox2, autoScroll);
				}
			});
		}}, [_('刷新')]);

		var clearBtn = E('button', { 'class': 'lg-btn lg-btn-gray', 'click': function () {
			var box = activeTab === 'service' ? logBox1 : logBox2;
			box.innerHTML = '';
		}}, [_('清空显示')]);

		var autoBtn = E('button', { 'class': 'lg-btn lg-btn-gray', 'click': function () {
			autoScroll = !autoScroll;
			autoLabel.textContent = autoScroll ? _('自动滚动') : _('已暂停');
			if (autoScroll) {
				autoLabel.classList.remove('paused');
			} else {
				autoLabel.classList.add('paused');
			}
		}}, [_('暂停滚动')]);

		// Poll every 8 seconds
		poll.add(function () {
			if (!autoScroll) return;
			return callGetLogs(300).then(function (d) {
				if (!d) return;
				renderLines(d.content || '', logBox1, autoScroll);
				renderLines(d.syslog  || '', logBox2, autoScroll);
			});
		}, 8);

		return E('div', {}, [
			style,
			E('div', { 'class': 'lg-card' }, [
				E('h3', {}, [_('运行日志')]),
				E('div', { 'class': 'lg-tab-bar' }, [tab1, tab2]),
				E('div', { 'class': 'lg-toolbar' }, [
					refreshBtn, clearBtn, autoBtn, autoLabel,
					E('span', { 'class': 'lg-label' }, ['　']),
					filterInput
				]),
				logBox1,
				logBox2
			])
		]);
	},

	handleSaveApply: null,
	handleSave:      null,
	handleReset:     null
});

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
	{ re: /\bERROR\b|\bFAIL\b|\bFailed\b/gi,   cls: 'lg-log-error'   },
	{ re: /\bWARN\b|\bWARNING\b/gi,             cls: 'lg-log-warn'    },
	{ re: /\bINFO\b|\bStarted\b|\bStopped\b/gi, cls: 'lg-log-info'    },
	{ re: /\bDEBUG\b/gi,                         cls: 'lg-log-debug'   },
	{ re: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g, cls: 'lg-log-time' }
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

function renderLines(text, container) {
	container.innerHTML = '';
	var lines = (text || '').split('\\n');
	lines.forEach(function (line) {
		if (!line) return;
		var div = E('div', { 'class': 'lg-log-line' });
		div.appendChild(highlightLine(line));
		container.appendChild(div);
	});
	container.scrollTop = container.scrollHeight;
}

return view.extend({
	load: function () {
		return callGetLogs(200);
	},

	render: function (data) {
		var initialContent = (data && data.content) ? data.content : '';
		var initialSyslog  = (data && data.syslog)  ? data.syslog  : '';

		var style = E('style', {}, [`
			.lg-card { background: var(--cbi-section-bg,#fff); border: 1px solid var(--cbi-section-border,#ddd); border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; }
			.lg-card h3 { margin: 0 0 12px; font-size: 1rem; color: var(--cbi-label-color,#333); border-bottom: 1px solid var(--cbi-section-border,#eee); padding-bottom: 8px; }
			.lg-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
			.lg-btn { padding: 6px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: .85rem; font-weight: 600; transition: opacity .15s; }
			.lg-btn-blue  { background: #3b82f6; color: #fff; }
			.lg-btn-gray  { background: #6b7280; color: #fff; }
			.lg-btn:hover { opacity: .85; }
			.lg-log-box { background: #0d1117; color: #c9d1d9; font-family: 'Courier New', monospace; font-size: .8rem; border-radius: 6px; padding: 12px 14px; height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
			.lg-log-line { line-height: 1.6; }
			.lg-log-error { color: #f87171; font-weight: 700; }
			.lg-log-warn  { color: #fbbf24; font-weight: 600; }
			.lg-log-info  { color: #34d399; }
			.lg-log-debug { color: #60a5fa; }
			.lg-log-time  { color: #a78bfa; }
			.lg-tab-bar { display: flex; gap: 2px; margin-bottom: 12px; }
			.lg-tab { padding: 6px 16px; border-radius: 6px 6px 0 0; border: 1px solid var(--cbi-section-border,#ddd); border-bottom: none; cursor: pointer; font-size: .88rem; background: var(--cbi-section-border,#f3f4f6); color: var(--cbi-label-color,#666); }
			.lg-tab.active { background: var(--cbi-section-bg,#fff); color: var(--cbi-value-color,#222); font-weight: 600; }
			.lg-label { font-size: .82rem; color: var(--cbi-label-color,#888); }
			.lg-auto-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: .75rem; background: #d1fae5; color: #065f46; font-weight: 600; }
			.lg-filter-input { flex: 1; min-width: 160px; padding: 5px 10px; border: 1px solid var(--cbi-section-border,#ddd); border-radius: 5px; font-size: .85rem; background: var(--cbi-section-bg,#fff); color: var(--cbi-value-color,#222); }
		`]);

		// Tab state
		var activeTab = 'service';

		var logBox1    = E('div', { 'class': 'lg-log-box', 'id': 'lg-logbox-service' });
		var logBox2    = E('div', { 'class': 'lg-log-box', 'id': 'lg-logbox-syslog',  'style': 'display:none' });

		renderLines(initialContent, logBox1);
		renderLines(initialSyslog,  logBox2);

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
		}}, [_('系统日志 (leigod)')]);

		// Toolbar buttons
		var refreshBtn = E('button', { 'class': 'lg-btn lg-btn-blue', 'click': function () {
			callGetLogs(500).then(function (d) {
				if (d) {
					renderLines(d.content || '', logBox1);
					renderLines(d.syslog  || '', logBox2);
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
			autoLabel.style.background = autoScroll ? '' : '#fee2e2';
			autoLabel.style.color      = autoScroll ? '' : '#991b1b';
		}}, [_('暂停滚动')]);

		// Poll every 8 seconds
		poll.add(function () {
			if (!autoScroll) return;
			return callGetLogs(300).then(function (d) {
				if (!d) return;
				renderLines(d.content || '', logBox1);
				renderLines(d.syslog  || '', logBox2);
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

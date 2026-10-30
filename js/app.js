(function () {
  'use strict';
  var FW = null;
  var state = { scores: {}, notes: {}, oos: {}, filter: 'all' };
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function round1(n) { return Math.round(n * 10) / 10; }
  function fmt(n) { return n == null ? '–' : round1(n).toFixed(1); }

  // Logo fallback if the file is missing
  (function () {
    var img = $('logoScreen'); if (!img) return;
    function swap() { var w = el('p', 'logo wordmark', 'Workmatik'); if (img.parentNode) img.parentNode.replaceChild(w, img); }
    if (img.complete && img.naturalWidth === 0) swap(); else img.addEventListener('error', swap);
  })();

  fetch('data/framework.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { FW = d; init(); })
    .catch(function () { var e = $('loadError'); e.textContent = 'The framework data could not be loaded. If you opened this file directly from your computer, use the published web address instead.'; e.hidden = false; });

  function caps() { return FW.capabilities; }
  function capById(id) { return caps().filter(function (c) { return c.id === id; })[0]; }
  function levelName(n) { return FW.scale[n - 1].name; }

  // ---------- calculations
  function calc() {
    var thrC = parseFloat($('thrCritical').value) || 2;
    var thrU = parseFloat($('thrUneven').value) || 1.5;
    var cats = FW.categories.map(function (name, i) {
      var list = caps().filter(function (c) { return c.cat === i; });
      var inScope = list.filter(function (c) { return !state.oos[c.id]; });
      var scored = inScope.filter(function (c) { return state.scores[c.id] >= 1; });
      var avg = scored.length ? scored.reduce(function (a, c) { return a + state.scores[c.id]; }, 0) / scored.length : null;
      return { name: name, avg: avg, scored: scored.length, inScope: inScope.length };
    });
    var have = cats.filter(function (c) { return c.avg != null; });
    var overall = have.length ? have.reduce(function (a, c) { return a + c.avg; }, 0) / have.length : null;
    var gap = null, strong = null, weak = null;
    if (have.length >= 2) {
      strong = have.slice().sort(function (a, b) { return b.avg - a.avg; })[0];
      weak = have.slice().sort(function (a, b) { return a.avg - b.avg; })[0];
      gap = strong.avg - weak.avg;
    }
    var crit = caps().filter(function (c) { return c.critical; }).map(function (c) {
      var s = state.scores[c.id];
      var status = state.oos[c.id] ? 'Out of scope' : !(s >= 1) ? 'Not scored' : s <= thrC ? 'Critical gap' : 'OK';
      return { cap: c, score: s, status: status };
    });
    var scoredN = caps().filter(function (c) { return state.scores[c.id] >= 1 && !state.oos[c.id]; }).length;
    var inScopeN = caps().filter(function (c) { return !state.oos[c.id]; }).length;
    return { cats: cats, overall: overall, gap: gap, strong: strong, weak: weak, crit: crit, thrC: thrC, thrU: thrU, scoredN: scoredN, inScopeN: inScopeN };
  }

  // ---------- assessment tab
  function renderChips() {
    var box = $('catChips'); box.textContent = '';
    var items = [{ k: 'all', t: 'All categories' }].concat(FW.categories.map(function (n, i) { return { k: String(i), t: n }; }));
    items.forEach(function (it) {
      var b = el('button', 'chip', it.t); b.type = 'button';
      b.setAttribute('aria-pressed', state.filter === it.k ? 'true' : 'false');
      b.addEventListener('click', function () { state.filter = it.k; renderChips(); applyFilter(); });
      box.appendChild(b);
    });
  }
  function applyFilter() {
    Array.prototype.forEach.call(document.querySelectorAll('details.domain'), function (d) {
      d.hidden = !(state.filter === 'all' || d.getAttribute('data-cat') === state.filter);
    });
  }

  function buildCaps() {
    var host = $('catCards'); host.textContent = '';
    FW.categories.forEach(function (name, i) {
      var d = el('details', 'domain'); d.setAttribute('data-cat', String(i)); if (i === 0) d.open = true;
      var s = el('summary');
      var t = el('span', 'domain-title', name);
      var n = caps().filter(function (c) { return c.cat === i; }).length;
      var badge = el('span', 'badge', n + ' capabilities'); badge.id = 'badge-' + i;
      s.appendChild(t); s.appendChild(badge); d.appendChild(s);
      caps().filter(function (c) { return c.cat === i; }).forEach(function (c) { d.appendChild(capRow(c)); });
      host.appendChild(d);
    });
    applyFilter();
  }

  function capRow(c) {
    var row = el('div', 'cap'); row.id = 'cap-' + c.id;
    var head = el('div', 'cap-head');
    head.appendChild(el('span', 'cap-id' + (c.critical ? ' crit' : ''), c.id));
    var nm = el('div', 'cap-name', c.name); nm.appendChild(el('small', null, c.activity)); head.appendChild(nm);
    row.appendChild(head);
    var body = el('div', 'cap-body');
    body.appendChild(el('p', 'cap-q', c.question));
    body.appendChild(el('p', 'cap-ev', 'Evidence of completion: ' + c.evidence));
    var lv = el('div', 'levels'); lv.setAttribute('role', 'radiogroup'); lv.setAttribute('aria-label', c.id + ' level');
    c.levels.forEach(function (txt, k) {
      var b = el('button', 'lvl'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('data-l', String(k + 1));
      var h = el('b'); var dot = el('span', 'dot lv' + k); dot.style.display = 'inline-block'; h.appendChild(dot); h.appendChild(document.createTextNode((k + 1) + ' ' + levelName(k + 1)));
      b.appendChild(h); b.appendChild(el('span', null, txt));
      b.addEventListener('click', function () {
        state.scores[c.id] = state.scores[c.id] === k + 1 ? 0 : k + 1; refreshCap(c.id); refreshProgress();
      });
      lv.appendChild(b);
    });
    body.appendChild(lv);
    row.appendChild(body);
    var tools = el('div', 'cap-tools');
    var ta = el('textarea'); ta.setAttribute('aria-label', c.id + ' evidence note'); ta.placeholder = 'Evidence seen, source or comment (optional)'; ta.maxLength = 500; ta.value = state.notes[c.id] || '';
    ta.addEventListener('input', function () { state.notes[c.id] = ta.value; });
    tools.appendChild(ta);
    var lab = el('label', 'check'); var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!state.oos[c.id];
    cb.addEventListener('change', function () { state.oos[c.id] = cb.checked; refreshCap(c.id); refreshProgress(); });
    lab.appendChild(cb); lab.appendChild(document.createTextNode('Out of scope')); tools.appendChild(lab);
    row.appendChild(tools);
    var ds = el('details', 'src'); ds.appendChild(el('summary', null, 'Source and evidence'));
    ds.appendChild(el('p', null, c.outcome));
    ds.appendChild(el('p', null, 'Evidence level: ' + c.evLevel + '. ' + c.evBasis));
    c.sources.forEach(function (s) { ds.appendChild(el('p', null, s)); });
    row.appendChild(ds);
    return row;
  }

  function refreshCap(id) {
    var row = $('cap-' + id); if (!row) return;
    row.classList.toggle('oos', !!state.oos[id]);
    Array.prototype.forEach.call(row.querySelectorAll('.lvl'), function (b) {
      b.setAttribute('aria-checked', state.scores[id] === parseInt(b.getAttribute('data-l'), 10) ? 'true' : 'false');
      b.disabled = !!state.oos[id];
    });
  }
  function refreshAllCaps() { caps().forEach(function (c) {
    refreshCap(c.id);
    var row = $('cap-' + c.id); var ta = row.querySelector('textarea'); ta.value = state.notes[c.id] || '';
    row.querySelector('input[type=checkbox]').checked = !!state.oos[c.id];
  }); refreshProgress(); }

  function refreshProgress() {
    var r = calc();
    $('progBar').style.width = (r.inScopeN ? (100 * r.scoredN / r.inScopeN) : 0) + '%';
    $('progText').textContent = r.scoredN + ' of ' + r.inScopeN + ' capabilities scored';
    r.cats.forEach(function (c, i) { var b = $('badge-' + i); if (b) b.textContent = c.scored + ' of ' + c.inScope + ' scored'; });
  }

  // ---------- results tab
  function renderResults() {
    var r = calc();
    var any = r.overall != null;
    $('resultsEmpty').hidden = any; $('resultsBody').hidden = !any;
    if (!any) return;
    var sc = $('summaryCards'); sc.textContent = '';
    function metric(label, val) { var m = el('div', 'metric'); m.appendChild(el('div', 'label', label)); m.appendChild(el('div', 'val', val)); sc.appendChild(m); }
    metric('Overall score', fmt(r.overall) + ' of 5');
    metric('Overall level', levelName(Math.max(1, Math.min(5, Math.round(r.overall)))));
    metric('Capabilities scored', r.scoredN + ' of ' + r.inScopeN);
    var gaps = r.crit.filter(function (c) { return c.status === 'Critical gap'; }).length;
    metric('Critical gaps', String(gaps));

    var bars = $('catBars'); bars.textContent = '';
    r.cats.forEach(function (c) {
      var row = el('div', 'avg-row' + (r.weak && c === r.weak && r.gap >= r.thrU ? ' weak' : ''));
      row.appendChild(el('span', null, c.name));
      var bar = el('div', 'bar'); var sp = el('span'); sp.style.width = c.avg == null ? '0' : (c.avg / 5 * 100) + '%'; bar.appendChild(sp); row.appendChild(bar);
      row.appendChild(el('strong', null, fmt(c.avg)));
      bars.appendChild(row);
    });
    drawRadar(r.cats);

    var ch = $('checks'); ch.textContent = '';
    function flag(ok, text) { var f = el('div', ok ? 'flag-ok' : 'flag-bad'); f.appendChild(el('span', null, ok ? '✓' : '!')); f.appendChild(el('span', null, text)); ch.appendChild(f); }
    r.crit.forEach(function (c) {
      var txt = c.cap.id + ' ' + c.cap.name + ': ' + c.status + (c.score >= 1 && c.status !== 'Out of scope' ? ' (level ' + c.score + ')' : '');
      if (c.status === 'Not scored' || c.status === 'Out of scope') { var f = el('div', 'flag-ok'); f.appendChild(el('span', null, '–')); f.appendChild(el('span', null, '★ ' + txt)); ch.appendChild(f); }
      else flag(c.status === 'OK', '★ ' + txt);
    });
    if (r.gap == null) { var f2 = el('div', 'flag-ok'); f2.appendChild(el('span', null, '–')); f2.appendChild(el('span', null, 'Uneven-profile check: score at least two categories.')); ch.appendChild(f2); }
    else if (r.gap >= r.thrU) flag(false, 'Uneven profile: ' + fmt(r.gap) + ' points between ' + r.strong.name + ' (' + fmt(r.strong.avg) + ') and ' + r.weak.name + ' (' + fmt(r.weak.avg) + '). Review the weakest category.');
    else flag(true, 'Consistent profile: ' + fmt(r.gap) + ' points between the strongest and weakest category.');

    var sl = $('startList'); sl.textContent = '';
    var list = caps().filter(function (c) { return !state.oos[c.id] && state.scores[c.id] >= 1 && state.scores[c.id] <= 2; })
      .sort(function (a, b) { return a.phase - b.phase || state.scores[a.id] - state.scores[b.id] || (b.critical ? 1 : 0) - (a.critical ? 1 : 0); });
    if (!list.length) sl.appendChild(el('p', 'empty', 'No scored capability is at level 2 or below.'));
    list.slice(0, 8).forEach(function (c) {
      var it = el('div', 'start-item');
      it.appendChild(el('span', 'cap-id' + (c.critical ? ' crit' : ''), c.id));
      it.appendChild(el('span', null, c.activity.split(' until ')[0]));
      it.appendChild(el('span', 'ph', 'Phase ' + (c.phase + 1) + ' ' + FW.phases[c.phase] + ' · level ' + state.scores[c.id]));
      sl.appendChild(it);
    });
    if (list.length > 8) sl.appendChild(el('p', 'hint', (list.length - 8) + ' more at level 2 or below are in the download.'));
  }

  function drawRadar(cats) {
    var NS = 'http://www.w3.org/2000/svg', S = 360, C = S / 2, R = 115;
    var SHORT = ['Strategy and leadership', 'Workflows', 'Operating model', 'People and skills', 'Data and technology', 'Governance and risk', 'Culture and change'];
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-60 0 480 ' + S);
    function node(n, a, parent) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); (parent || svg).appendChild(e); return e; }
    var N = cats.length;
    function pt(i, v) { var ang = -Math.PI / 2 + 2 * Math.PI * i / N; return [C + R * v / 5 * Math.cos(ang), C + R * v / 5 * Math.sin(ang)]; }
    for (var g = 1; g <= 5; g++) { node('polygon', { points: cats.map(function (_, i) { return pt(i, g).join(','); }).join(' '), fill: 'none', stroke: '#D9D9D9', 'stroke-width': 1 }); }
    cats.forEach(function (c, i) {
      var p = pt(i, 5); node('line', { x1: C, y1: C, x2: p[0], y2: p[1], stroke: '#D9D9D9' });
      var q = pt(i, 5.9); var t = node('text', { x: q[0], y: q[1] + 3, 'text-anchor': q[0] < C - 5 ? 'end' : q[0] > C + 5 ? 'start' : 'middle', 'font-size': 10, fill: '#024873', 'font-weight': 600 });
      t.textContent = SHORT[i] || c.name;
    });
    node('polygon', { points: cats.map(function (c, i) { return pt(i, c.avg || 0).join(','); }).join(' '), fill: 'rgba(242,93,39,.28)', stroke: '#F25D27', 'stroke-width': 2 });
    cats.forEach(function (c, i) { if (c.avg != null) { var p = pt(i, c.avg); node('circle', { cx: p[0], cy: p[1], r: 3.5, fill: '#F25D27' }); } });
    var host = $('radar'); host.textContent = ''; host.appendChild(svg);
  }

  // ---------- guide
  function renderGuide() {
    var g = $('guideLevels'); g.textContent = '';
    FW.scale.forEach(function (s) {
      var d = el('div', 'guide-level'); var b = el('b'); var dot = el('span', 'dot lv' + (s.level - 1)); b.appendChild(dot); b.appendChild(document.createTextNode(s.level + ' ' + s.name)); d.appendChild(b); d.appendChild(el('p', null, s.desc)); g.appendChild(d);
    });
  }

  // ---------- xlsx
  function download() {
    var r = calc();
    var meta = [
      ['AI Capability Assessment'], ['Framework version', FW.version],
      ['Organisation or function', $('orgName').value], ['Assessor', $('auditor').value], ['Assessment date', $('auditDate').value],
      ['Critical-gap threshold', r.thrC], ['Uneven-profile threshold', r.thrU], [],
      ['Overall score', r.overall == null ? '' : round1(r.overall)],
      ['Overall level', r.overall == null ? '' : levelName(Math.max(1, Math.min(5, Math.round(r.overall))))],
      ['Capabilities scored', r.scoredN + ' of ' + r.inScopeN],
      ['Uneven-profile gap', r.gap == null ? '' : round1(r.gap)],
      ['Strongest category', r.strong ? r.strong.name : ''], ['Weakest category', r.weak ? r.weak.name : ''],
      [], ['Generated in the browser by the Workmatik AI Capability Assessment. Thresholds and level descriptors are the author’s draft judgement.']
    ];
    var scoring = [['ID', 'Category', 'Capability', 'Activity', 'Critical', 'Score (1-5)', 'Level', 'Out of scope', 'Evidence note']];
    caps().forEach(function (c) {
      var s = state.scores[c.id];
      scoring.push([c.id, FW.categories[c.cat], c.name, c.activity, c.critical ? 'Y' : '', s >= 1 ? s : '', s >= 1 ? levelName(s) : '', state.oos[c.id] ? 'Y' : '', state.notes[c.id] || '']);
    });
    var res = [['Category', 'Average score', 'Scored', 'In scope']];
    r.cats.forEach(function (c) { res.push([c.name, c.avg == null ? '' : round1(c.avg), c.scored, c.inScope]); });
    res.push([]); res.push(['Critical capability', 'Score', 'Status']);
    r.crit.forEach(function (c) { res.push([c.cap.id + ' ' + c.cap.name, c.score >= 1 ? c.score : '', c.status]); });
    var wb = XLSX.utils.book_new();
    function add(name, aoa, widths) { var ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = widths.map(function (w) { return { wch: w }; }); XLSX.utils.book_append_sheet(wb, ws, name); }
    add('Summary', meta, [30, 60]); add('Scoring', scoring, [6, 30, 48, 60, 8, 11, 20, 12, 50]); add('Results', res, [48, 14, 10, 10]);
    var org = ($('orgName').value || 'results').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40);
    XLSX.writeFile(wb, 'AI_Capability_Assessment_' + org + '.xlsx');
  }

  function loadFile(file) {
    var msgs = $('loadMessages'); msgs.textContent = '';
    function msg(t, ok) { msgs.appendChild(el('li', ok ? 'ok' : 'bad', t)); }
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var wb = XLSX.read(rd.result, { type: 'array' });
        var ws = wb.Sheets['Scoring']; if (!ws) { msg('This file has no Scoring sheet, so it was not loaded.', false); return; }
        var rows = XLSX.utils.sheet_to_json(ws, { defval: '' }); var n = 0;
        state.scores = {}; state.notes = {}; state.oos = {};
        rows.forEach(function (row) {
          var id = String(row['ID'] || '').trim(); if (!capById(id)) return;
          var s = parseInt(row['Score (1-5)'], 10); if (s >= 1 && s <= 5) { state.scores[id] = s; n++; }
          if (String(row['Out of scope']).toUpperCase() === 'Y') state.oos[id] = true;
          if (row['Evidence note']) state.notes[id] = String(row['Evidence note']).slice(0, 500);
        });
        var sm = wb.Sheets['Summary'];
        if (sm) XLSX.utils.sheet_to_json(sm, { header: 1, defval: '' }).forEach(function (r) {
          if (r[0] === 'Organisation or function') $('orgName').value = r[1] || '';
          if (r[0] === 'Assessor' || r[0] === 'Auditor') $('auditor').value = r[1] || '';
          if (r[0] === 'Assessment date' || r[0] === 'Audit date') $('auditDate').value = /^\d{4}-\d{2}-\d{2}$/.test(r[1]) ? r[1] : '';
          if (r[0] === 'Critical-gap threshold' && r[1]) $('thrCritical').value = r[1];
          if (r[0] === 'Uneven-profile threshold' && r[1]) $('thrUneven').value = r[1];
        });
        refreshAllCaps(); msg('Loaded ' + n + ' scores from ' + file.name + '.', true);
      } catch (e) { msg('That file could not be read as an assessment file.', false); }
    };
    rd.readAsArrayBuffer(file);
  }

  // ---------- tabs and init
  function showTab(name) {
    ['audit', 'results', 'guide'].forEach(function (t) {
      var on = t === name; $('tab-' + t).setAttribute('aria-selected', on ? 'true' : 'false'); $('tab-' + t).tabIndex = on ? 0 : -1; $('panel-' + t).hidden = !on;
    });
    if (name === 'results') renderResults();
    window.scrollTo(0, 0);
  }

  function init() {
    $('fwVersion').textContent = FW.version;
    $('auditDate').value = new Date().toISOString().slice(0, 10);
    $('thrCritical').value = FW.thresholds.critical; $('thrUneven').value = FW.thresholds.uneven;
    renderChips(); buildCaps(); renderGuide(); refreshAllCaps();
    var tabs = ['audit', 'results', 'guide'];
    tabs.forEach(function (t, i) {
      $('tab-' + t).addEventListener('click', function () { showTab(t); });
      $('tab-' + t).addEventListener('keydown', function (e) {
        var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!k) return;
        var nt = tabs[(i + k + tabs.length) % tabs.length]; showTab(nt); $('tab-' + nt).focus();
      });
    });
    $('btnGoResults').addEventListener('click', function () { showTab('results'); });
    $('btnDownload').addEventListener('click', download);
    $('btnLoad').addEventListener('click', function () { $('fileInput').click(); });
    $('fileInput').addEventListener('change', function (e) { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; });
    $('btnReset').addEventListener('click', function () {
      if (!window.confirm('Clear all scores, notes and out-of-scope marks?')) return;
      state.scores = {}; state.notes = {}; state.oos = {}; $('loadMessages').textContent = ''; refreshAllCaps();
    });
    ['thrCritical', 'thrUneven'].forEach(function (id) { $(id).addEventListener('input', renderResults); });
  }
})();

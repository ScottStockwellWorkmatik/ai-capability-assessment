(function () {
  'use strict';
  var FW = null;
  var state = { scores: {}, notes: {}, oos: {}, filter: 'all' };
  var WFL = null; // workflow file linked to this assessment
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
  function calcData(scores, oos, thrC, thrU) {
    var cats = FW.categories.map(function (name, i) {
      var list = caps().filter(function (c) { return c.cat === i; });
      var inScope = list.filter(function (c) { return !oos[c.id]; });
      var scored = inScope.filter(function (c) { return scores[c.id] >= 1; });
      var avg = scored.length ? scored.reduce(function (a, c) { return a + scores[c.id]; }, 0) / scored.length : null;
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
      var s = scores[c.id];
      var status = oos[c.id] ? 'Out of scope' : !(s >= 1) ? 'Not scored' : s <= thrC ? 'Critical gap' : 'OK';
      return { cap: c, score: s, status: status };
    });
    var scoredN = caps().filter(function (c) { return scores[c.id] >= 1 && !oos[c.id]; }).length;
    var inScopeN = caps().filter(function (c) { return !oos[c.id]; }).length;
    return { cats: cats, overall: overall, gap: gap, strong: strong, weak: weak, crit: crit, thrC: thrC, thrU: thrU, scoredN: scoredN, inScopeN: inScopeN };
  }
  function calc() {
    return calcData(state.scores, state.oos, parseFloat($('thrCritical').value) || 2, parseFloat($('thrUneven').value) || 1.5);
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

  var SHORT = ['Strategy and leadership', 'Workflows', 'Operating model', 'People and skills', 'Data and technology', 'Governance and risk', 'Culture and change'];
  // series: [{ cats, color, dash, fill, label }]. opts.legend draws the series names inside the image.
  function buildRadarMulti(series, opts) {
    opts = opts || {};
    var NS = 'http://www.w3.org/2000/svg', S = 360, C = S / 2, R = 115;
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-60 0 480 ' + S);
    function node(n, a, parent) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); (parent || svg).appendChild(e); return e; }
    var cats = series[0].cats, N = cats.length;
    function pt(i, v) { var ang = -Math.PI / 2 + 2 * Math.PI * i / N; return [C + R * v / 5 * Math.cos(ang), C + R * v / 5 * Math.sin(ang)]; }
    for (var g = 1; g <= 5; g++) { node('polygon', { points: cats.map(function (_, i) { return pt(i, g).join(','); }).join(' '), fill: 'none', stroke: '#D9D9D9', 'stroke-width': 1 }); }
    cats.forEach(function (c, i) {
      var p = pt(i, 5); node('line', { x1: C, y1: C, x2: p[0], y2: p[1], stroke: '#D9D9D9' });
      var q = pt(i, 5.9); var t = node('text', { x: q[0], y: q[1] + 3, 'text-anchor': q[0] < C - 5 ? 'end' : q[0] > C + 5 ? 'start' : 'middle', 'font-size': 10, fill: '#024873', 'font-weight': 600 });
      t.textContent = SHORT[i] || c.name;
    });
    series.forEach(function (sr) {
      var a = { points: sr.cats.map(function (c, i) { return pt(i, c.avg || 0).join(','); }).join(' '), fill: sr.fill ? sr.color : 'none', 'fill-opacity': sr.fill ? 0.2 : 0, stroke: sr.color, 'stroke-width': sr.fill ? 2.5 : 2, 'stroke-linejoin': 'round' };
      if (sr.dash) a['stroke-dasharray'] = '6 4';
      node('polygon', a);
      sr.cats.forEach(function (c, i) { if (c.avg != null) { var p = pt(i, c.avg); node('circle', { cx: p[0], cy: p[1], r: sr.fill ? 3.5 : 2.8, fill: sr.color }); } });
    });
    if (opts.legend) series.forEach(function (sr, k) {
      var y = 14 + k * 15;
      var l = node('line', { x1: -90, y1: y - 3, x2: -70, y2: y - 3, stroke: sr.color, 'stroke-width': 3 }); if (sr.dash) l.setAttribute('stroke-dasharray', '6 4');
      var t = node('text', { x: -64, y: y, 'font-size': 10, fill: '#0D0D0D' }); t.textContent = sr.label;
    });
    return svg;
  }
  function buildRadar(cats) { return buildRadarMulti([{ cats: cats, color: '#F25D27', fill: true }]); }
  function drawRadar(cats) { var host = $('radar'); host.textContent = ''; host.appendChild(buildRadar(cats)); }

  // Render a radar as a PNG data URL (for the XLSX). Resolves to null if the browser cannot.
  function radarPng(series, legend) {
    return new Promise(function (resolve) {
      try {
        var svg = buildRadarMulti(series, { legend: !!legend }); svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('viewBox', '-100 0 560 360'); svg.setAttribute('width', '1680'); svg.setAttribute('height', '1080');
        Array.prototype.forEach.call(svg.querySelectorAll('text'), function (t) { t.setAttribute('font-family', 'Arial, Helvetica, sans-serif'); });
        var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); bg.setAttribute('x', '-100'); bg.setAttribute('y', '0'); bg.setAttribute('width', '560'); bg.setAttribute('height', '360'); bg.setAttribute('fill', '#FFFFFF'); svg.insertBefore(bg, svg.firstChild);
        var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
        var img = new Image();
        img.onload = function () { try { var c = document.createElement('canvas'); c.width = 1680; c.height = 1080; c.getContext('2d').drawImage(img, 0, 0, 1680, 1080); resolve(c.toDataURL('image/png')); } catch (e) { resolve(null); } };
        img.onerror = function () { resolve(null); };
        img.src = url;
      } catch (e) { resolve(null); }
    });
  }

  // ---------- guide
  function renderGuide() {
    var g = $('guideLevels'); g.textContent = '';
    FW.scale.forEach(function (s) {
      var d = el('div', 'guide-level'); var b = el('b'); var dot = el('span', 'dot lv' + (s.level - 1)); b.appendChild(dot); b.appendChild(document.createTextNode(s.level + ' ' + s.name)); d.appendChild(b); d.appendChild(el('p', null, s.desc)); g.appendChild(d);
    });
  }

  // ---------- link to an AI Workflow Assessment file
  var WF_RULES = [
    ['W1', 'Repeatability scored 2 or below'],
    ['D2', 'Data and content readiness scored 2 or below'],
    ['D4', 'Tool and integration readiness scored 2 or below'],
    ['G1', 'Risk is high (error consequence or data sensitivity 4 or above) or the EU AI Act tier is limited or high'],
    ['G4', 'Risk is high (error consequence or data sensitivity 4 or above) or the EU AI Act tier is limited or high'],
    ['W3', 'Consequence of an error scored 3 or above']
  ];
  function wfCapsFor(sc, tier) {
    var out = [];
    if (sc.F1 <= 2) out.push(['W1', WF_RULES[0][1]]);
    if (sc.F2 <= 2) out.push(['D2', WF_RULES[1][1]]);
    if (sc.F3 <= 2) out.push(['D4', WF_RULES[2][1]]);
    if (sc.R1 >= 4 || sc.R2 >= 4 || tier === 'limited' || tier === 'high') { out.push(['G1', WF_RULES[3][1]]); out.push(['G4', WF_RULES[4][1]]); }
    if (sc.R1 >= 3) out.push(['W3', WF_RULES[5][1]]);
    return out;
  }
  function normWfId(id) { id = String(id || '').trim(); var m = /^W(\d{2})$/.exec(id); return m ? 'WF' + m[1] : id; }
  var QUAD_NAMES = { start: 'Start here', prepare: 'Prepare first', quick: 'Quick win', park: 'Park', prohibited: 'Do not proceed' };
  function parseWorkflowFile(buf, fname) {
    var wb = XLSX.read(buf, { type: 'array' }), ws = wb.Sheets['Scoring']; if (!ws) throw new Error('no scoring');
    var first = XLSX.utils.sheet_to_json(ws, { defval: '' })[0]; if (!first || !('V1' in first) || !('F1' in first) || !('R1' in first)) throw new Error('not a workflow file');
    var tv = 3, tf = 3, org = '', date = '';
    if (wb.Sheets['Summary']) XLSX.utils.sheet_to_json(wb.Sheets['Summary'], { header: 1, defval: '' }).forEach(function (r) {
      if (r[0] === 'Value is high above' && r[1]) tv = parseFloat(r[1]) || tv;
      if (r[0] === 'Feasibility is high above' && r[1]) tf = parseFloat(r[1]) || tf;
      if (r[0] === 'Organisation or function') org = String(r[1] || '');
      if (r[0] === 'Assessment date') date = serialToIso(r[1]);
    });
    var rows = [];
    XLSX.utils.sheet_to_json(ws, { defval: '' }).forEach(function (row) {
      if (String(row['Included']).toUpperCase() === 'N') return;
      var sc = {}, got = 0; ['V1', 'V2', 'F1', 'F2', 'F3', 'R1', 'R2'].forEach(function (k) { var n = parseInt(row[k], 10); if (n >= 1 && n <= 5) { sc[k] = n; got++; } });
      if (got !== 7) return;
      var tier = String(row['EU AI Act tier'] || 'minimal').trim();
      var v = (sc.V1 + sc.V2) / 2, f = (sc.F1 + sc.F2 + sc.F3) / 3, r = (sc.R1 + sc.R2) / 2;
      var quad = tier === 'prohibited' ? 'prohibited' : (v > tv && f > tf) ? 'start' : (v > tv) ? 'prepare' : (f > tf) ? 'quick' : 'park';
      rows.push({ id: normWfId(row['ID']), name: String(row['Workflow'] || ''), priority: Math.round(v * f / 25 * 100 * (1 - 0.1 * (r - 1))), quad: quad, tier: tier, caps: wfCapsFor(sc, tier) });
    });
    return { file: fname, org: org, date: date, rows: rows };
  }
  function wfLinks() {
    var m = {};
    if (!WFL) return m;
    WFL.rows.forEach(function (w) { w.caps.forEach(function (c) { (m[c[0]] = m[c[0]] || []).push({ wf: w, why: c[1] }); }); });
    Object.keys(m).forEach(function (k) { m[k].sort(function (a, b) { return b.wf.priority - a.wf.priority; }); });
    return m;
  }
  function renderWfLink() {
    var host = $('wfLinkBody'); if (!host) return; host.textContent = '';
    $('wfLinkClear').hidden = !WFL;
    if (!WFL) { host.appendChild(el('p', 'hint', 'No workflow file loaded.')); return; }
    var links = wfLinks(), ids = Object.keys(links);
    host.appendChild(el('p', 'hint', 'From ' + WFL.file + (WFL.org ? ' (' + WFL.org + ')' : '') + ': ' + WFL.rows.length + ' fully scored workflow' + (WFL.rows.length === 1 ? '' : 's') + ', ' + WFL.rows.filter(function (w) { return w.quad === 'start'; }).length + ' in the Start here group.'));
    if (!ids.length) { host.appendChild(el('p', null, 'Your workflow scores flag no capability gaps.')); return; }
    ids.sort(function (a, b) { return links[b].length - links[a].length; });
    var wrap = el('div', 'table-scroll'), t = el('table', 'rank-table'), hr = el('tr');
    ['Capability', 'Flagged by', 'Top workflows', 'Your score'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
    var th = el('thead'); th.appendChild(hr); t.appendChild(th); var tb = el('tbody');
    ids.forEach(function (id) {
      var c = capById(id); if (!c) return; var l = links[id], tr = el('tr');
      tr.appendChild(el('td', null, c.id + ' ' + c.name));
      tr.appendChild(el('td', 'num', l.length + ' workflow' + (l.length === 1 ? '' : 's')));
      tr.appendChild(el('td', null, l.slice(0, 3).map(function (x) { return x.wf.name + ' (' + (QUAD_NAMES[x.wf.quad] || '') + ')'; }).join('; ') + (l.length > 3 ? '; and ' + (l.length - 3) + ' more' : '')));
      var sc = state.scores[id], oos = state.oos[id];
      tr.appendChild(el('td', null, oos ? 'Out of scope' : sc >= 1 ? sc + ' ' + levelName(sc) + (sc <= 2 ? ' (gap)' : '') : 'Not scored yet'));
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); host.appendChild(wrap);
    host.appendChild(el('p', 'hint', 'The links are rules, not findings: for example a workflow scored 2 or below on repeatability points to W1. They are the author’s judgement, and match the capability hints in the AI Workflow Assessment.'));
  }
  function loadWorkflowFile(file) {
    var msgs = $('loadMessages'); msgs.textContent = '';
    readFileBuffer(file).then(function (buf) {
      try { WFL = parseWorkflowFile(buf, file.name); } catch (e) { msgs.appendChild(el('li', 'bad', 'That file could not be read as an AI Workflow Assessment file.')); return; }
      if (!WFL.rows.length) { msgs.appendChild(el('li', 'bad', 'That file has no fully scored workflows, so there is nothing to link.')); WFL = null; }
      renderWfLink();
    }).catch(function () { msgs.appendChild(el('li', 'bad', 'That file could not be read.')); });
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
    var org = ($('orgName').value || 'results').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40);
    var fname = 'AI_Capability_Assessment_' + org + '.xlsx';
    var sheets = [['Summary', meta, [30, 60]], ['Workmatik data', [['Field', 'Value'], ['Tool', 'Workmatik AI Capability Assessment'], ['Tool key', 'capability'], ['Data version', FW.version], ['Schema', 'workmatik-shared-ids-1'], ['Organisation', $('orgName').value], ['Assessor', $('auditor').value], ['Assessment date', $('auditDate').value], ['Capabilities scored', r.scoredN], ['Workflow file linked', WFL ? WFL.file : ''], ['Note', 'Capability IDs (such as W1, D2, G1) are stable. Other Workmatik tools match on these IDs.']], [26, 90]], ['Scoring', scoring, [6, 30, 48, 60, 8, 11, 20, 12, 50]], ['Results', res, [48, 14, 10, 10]]];
    if (WFL) {
      var wl = [['Capability ID', 'Capability', 'Workflow ID', 'Workflow', 'Priority index', 'Group', 'Why it is flagged', 'Your score']], lk = wfLinks();
      Object.keys(lk).forEach(function (id) { var c = capById(id); if (!c) return; lk[id].forEach(function (x) { wl.push([id, c.name, x.wf.id, x.wf.name, x.wf.priority, QUAD_NAMES[x.wf.quad] || '', x.why, state.scores[id] >= 1 ? state.scores[id] : '']); }); });
      sheets.push(['Workflow links', wl, [12, 36, 11, 40, 13, 16, 60, 11]]);
    }
    function fallback() {
      var wb = XLSX.utils.book_new();
      sheets.forEach(function (sh) { var ws = XLSX.utils.aoa_to_sheet(sh[1]); ws['!cols'] = sh[2].map(function (w) { return { wch: w }; }); XLSX.utils.book_append_sheet(wb, ws, sh[0]); });
      XLSX.writeFile(wb, fname);
    }
    if (typeof ExcelJS === 'undefined') { fallback(); return; }
    radarPng([{ cats: r.cats, color: '#F25D27', fill: true }]).then(function (png) {
      var wb = new ExcelJS.Workbook(); wb.creator = 'Workmatik'; wb.title = 'AI Capability Assessment';
      var sheetObjs = {};
      sheets.forEach(function (sh) {
        var ws = wb.addWorksheet(sh[0]); sheetObjs[sh[0]] = ws;
        sh[1].forEach(function (row) { ws.addRow(row); });
        sh[2].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
        ws.eachRow(function (row) { row.alignment = { vertical: 'top', wrapText: true }; });
      });
      sheetObjs.Summary.getRow(1).font = { bold: true, size: 14 };
      ['Workmatik data', 'Workflow links'].forEach(function (n) { var w = sheetObjs[n]; if (!w) return; w.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; w.getRow(1).eachCell(function (c) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF024873' } }; }); });
      sheetObjs.Scoring.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheetObjs.Scoring.getRow(1).eachCell(function (c) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF024873' } }; });
      var rs = sheetObjs.Results; rs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      rs.getRow(1).eachCell(function (c) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF024873' } }; });
      rs.getRow(rs.rowCount - r.crit.length).font = { bold: true };
      if (png) {
        var id = wb.addImage({ base64: png, extension: 'png' });
        rs.getColumn(6).width = 4;
        rs.addImage(id, { tl: { col: 5, row: 0 }, ext: { width: 560, height: 360 } });
      }
      return wb.xlsx.writeBuffer();
    }).then(function (buf) {
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }).catch(function () { fallback(); });
  }

  function serialToIso(v) {
    if (typeof v === 'number' && v > 30000 && v < 80000) { var d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : '';
  }
  function parseWorkbook(buf) {
    var wb = XLSX.read(buf, { type: 'array' });
    var ws = wb.Sheets['Scoring']; if (!ws) throw new Error('no scoring sheet');
    var out = { scores: {}, notes: {}, oos: {}, n: 0, org: '', assessor: '', date: '', thrC: null, thrU: null };
    XLSX.utils.sheet_to_json(ws, { defval: '' }).forEach(function (row) {
      var id = String(row['ID'] || '').trim(); if (!capById(id)) return;
      var sc = parseInt(row['Score (1-5)'], 10); if (sc >= 1 && sc <= 5) { out.scores[id] = sc; out.n++; }
      if (String(row['Out of scope']).toUpperCase() === 'Y') out.oos[id] = true;
      if (row['Evidence note']) out.notes[id] = String(row['Evidence note']).slice(0, 500);
    });
    var sm = wb.Sheets['Summary'];
    if (sm) XLSX.utils.sheet_to_json(sm, { header: 1, defval: '' }).forEach(function (r) {
      if (r[0] === 'Organisation or function') out.org = String(r[1] || '');
      if (r[0] === 'Assessor' || r[0] === 'Auditor') out.assessor = String(r[1] || '');
      if (r[0] === 'Assessment date' || r[0] === 'Audit date') out.date = serialToIso(r[1]);
      if (r[0] === 'Critical-gap threshold' && r[1]) out.thrC = parseFloat(r[1]) || null;
      if (r[0] === 'Uneven-profile threshold' && r[1]) out.thrU = parseFloat(r[1]) || null;
    });
    return out;
  }
  function readFileBuffer(file) {
    return new Promise(function (resolve, reject) { var rd = new FileReader(); rd.onload = function () { resolve(rd.result); }; rd.onerror = reject; rd.readAsArrayBuffer(file); });
  }

  function loadFile(file) {
    var msgs = $('loadMessages'); msgs.textContent = '';
    function msg(t, ok) { msgs.appendChild(el('li', ok ? 'ok' : 'bad', t)); }
    readFileBuffer(file).then(function (buf) {
      var d;
      try { d = parseWorkbook(buf); } catch (e) { msg('This file has no Scoring sheet, or could not be read as an assessment file, so it was not loaded.', false); return; }
      state.scores = d.scores; state.notes = d.notes; state.oos = d.oos;
      $('orgName').value = d.org; $('auditor').value = d.assessor; $('auditDate').value = d.date;
      if (d.thrC) $('thrCritical').value = d.thrC; if (d.thrU) $('thrUneven').value = d.thrU;
      refreshAllCaps(); msg('Loaded ' + d.n + ' scores from ' + file.name + '.', true);
    }).catch(function () { msg('That file could not be read as an assessment file.', false); });
  }

  // ---------- compare tab
  var COMPARE_MAX = 6;
  var cmp = { snaps: [], includeCurrent: true };
  var SERIES_COLOURS = ['#8A949C', '#5DC1FF', '#1F7CAD', '#024873', '#0D0D0D'];

  function snapLabel(sn) { return sn.date || sn.name; }
  function compareList() {
    var list = cmp.snaps.slice();
    if (cmp.includeCurrent) {
      var any = Object.keys(state.scores).some(function (k) { return state.scores[k] >= 1; });
      if (any) list.push({ name: 'Current assessment', current: true, org: $('orgName').value, assessor: $('auditor').value, date: $('auditDate').value, scores: state.scores, oos: state.oos });
    }
    // sort by date (undated keep their order); the current assessment goes last when dates tie
    var idx = list.map(function (x, i) { return i; });
    idx.sort(function (a, b) {
      var da = list[a].date || '', db = list[b].date || '';
      if (da && db && da !== db) return da < db ? -1 : 1;
      if (list[a].current !== list[b].current) return list[a].current ? 1 : -1;
      return a - b;
    });
    list = idx.map(function (i) { return list[i]; });
    var thrC = parseFloat($('thrCritical').value) || 2;
    list.forEach(function (sn, k) {
      sn.res = calcData(sn.scores, sn.oos, thrC, 1.5);
      sn.label = (sn.current ? 'Current' : snapLabel(sn));
    });
    // make labels unique
    var seen = {};
    list.forEach(function (sn) { seen[sn.label] = (seen[sn.label] || 0) + 1; });
    var used = {};
    list.forEach(function (sn) { if (seen[sn.label] > 1) { used[sn.label] = (used[sn.label] || 0) + 1; sn.label = sn.label + ' (' + (sn.current ? 'current' : sn.name.replace(/\.xlsx$/i, '').slice(0, 24)) + ')'; } });
    list.forEach(function (sn, k) { sn.color = k === list.length - 1 ? '#F25D27' : SERIES_COLOURS[Math.min(k, SERIES_COLOURS.length - 1)]; sn.dash = k === 0 && list.length > 1; });
    return list;
  }
  function delta(a, b) { return (a == null || b == null) ? null : b - a; }
  function deltaText(d) { return d == null ? '\u2013' : (d > 0.049 ? '\u25B2 +' + round1(d).toFixed(1) : d < -0.049 ? '\u25BC ' + round1(d).toFixed(1) : '\u25CF no change'); }
  function deltaClass(d) { return d == null ? '' : d > 0.049 ? 'up-good' : d < -0.049 ? 'down-bad' : ''; }

  function addCmpFiles(files) {
    var msgs = $('cmpMessages'); msgs.textContent = '';
    function msg(t, ok) { msgs.appendChild(el('li', ok ? 'ok' : 'bad', t)); }
    var arr = Array.prototype.slice.call(files);
    Promise.all(arr.map(function (f) {
      return readFileBuffer(f).then(function (buf) {
        if (cmp.snaps.length >= COMPARE_MAX) { msg(f.name + ': the limit is ' + COMPARE_MAX + ' earlier files, so it was not added.', false); return; }
        try { var d = parseWorkbook(buf); d.name = f.name; cmp.snaps.push(d); msg('Added ' + f.name + ' (' + d.n + ' scores' + (d.date ? ', ' + d.date : ', no date found') + ').', true); }
        catch (e) { msg(f.name + ' is not a file from this tool (no Scoring sheet), so it was not added.', false); }
      }).catch(function () { msg(f.name + ' could not be read.', false); });
    })).then(renderCompare);
  }

  function renderCompare() {
    var list = compareList();
    var enough = list.length >= 1;
    $('cmpEmpty').hidden = enough; $('cmpBody').hidden = !enough;
    $('cmpClear').hidden = !cmp.snaps.length;
    if (!enough) return;
    var first = list[0], last = list[list.length - 1], multi = list.length >= 2;

    // snapshots table
    var tb = $('cmpSnaps'); tb.textContent = '';
    var thead = el('tr'); ['#', 'Assessment', 'Organisation', 'Assessor', 'Scored', 'Overall', ''].forEach(function (h) { thead.appendChild(el('th', null, h)); }); tb.appendChild(thead);
    list.forEach(function (sn, k) {
      var tr = el('tr');
      tr.appendChild(el('td', null, String(k + 1)));
      var tdl = el('td'); var sw = el('span', 'swatch'); sw.style.background = sn.color; if (sn.dash) sw.style.backgroundImage = 'repeating-linear-gradient(90deg,' + sn.color + ' 0 6px,transparent 6px 9px)'; tdl.appendChild(sw); tdl.appendChild(document.createTextNode(sn.label)); tr.appendChild(tdl);
      tr.appendChild(el('td', null, sn.org || '\u2013')); tr.appendChild(el('td', null, sn.assessor || '\u2013'));
      tr.appendChild(el('td', null, sn.res.scoredN + ' of ' + sn.res.inScopeN));
      tr.appendChild(el('td', null, sn.res.overall == null ? '\u2013' : fmt(sn.res.overall) + ' (' + levelName(Math.max(1, Math.min(5, Math.round(sn.res.overall)))) + ')'));
      var tdx = el('td');
      if (!sn.current) { var rm = el('button', 'btn small', 'Remove'); rm.type = 'button'; rm.setAttribute('aria-label', 'Remove ' + sn.label); rm.addEventListener('click', function () { cmp.snaps.splice(cmp.snaps.indexOf(sn), 1); renderCompare(); }); tdx.appendChild(rm); }
      tr.appendChild(tdx); tb.appendChild(tr);
    });
    var undated = list.filter(function (x) { return !x.date; }).length;
    $('cmpNote').textContent = undated ? undated + ' file(s) have no assessment date, so they are shown in the order loaded. Add a date in the Summary sheet (format 2026-10-30) to place them in time.' : '';

    // headline
    var hl = $('cmpHeadline');
    if (!multi) hl.textContent = 'Add at least one earlier assessment, or complete another, to see change over time.';
    else {
      var d = delta(first.res.overall, last.res.overall);
      hl.textContent = 'Overall score moved from ' + fmt(first.res.overall) + ' (' + first.label + ') to ' + fmt(last.res.overall) + ' (' + last.label + '): ' + deltaText(d).replace(/^\S+ /, '') + '.';
    }
    drawTrend(list);

    // category table
    var ct = $('cmpCats'); ct.textContent = '';
    var h2 = el('tr'); h2.appendChild(el('th', null, 'Category')); list.forEach(function (sn) { h2.appendChild(el('th', null, sn.label)); }); if (multi) h2.appendChild(el('th', null, 'Change')); ct.appendChild(h2);
    function row(name, getter, bold) {
      var tr = el('tr', bold ? 'avg' : ''); tr.appendChild(el('td', null, name));
      list.forEach(function (sn) { tr.appendChild(el('td', 'num', fmt(getter(sn)))); });
      if (multi) { var d = delta(getter(first), getter(last)); tr.appendChild(el('td', 'chg ' + deltaClass(d), deltaText(d))); }
      ct.appendChild(tr);
    }
    FW.categories.forEach(function (n, i) { row(n, function (sn) { return sn.res.cats[i].avg; }); });
    row('Overall score', function (sn) { return sn.res.overall; }, true);
    var host = $('cmpRadar'); host.textContent = '';
    host.appendChild(buildRadarMulti(list.map(function (sn) { return { cats: sn.res.cats, color: sn.color, dash: sn.dash, fill: sn === last, label: sn.label }; })));
    var lg = $('cmpLegend'); lg.textContent = '';
    list.forEach(function (sn) { var li = el('li'); var sw = el('span', 'swatch'); sw.style.background = sn.color; if (sn.dash) sw.style.backgroundImage = 'repeating-linear-gradient(90deg,' + sn.color + ' 0 6px,transparent 6px 9px)'; li.appendChild(sw); li.appendChild(document.createTextNode(sn.label)); lg.appendChild(li); });

    // critical capabilities
    var kt = $('cmpCrit'); kt.textContent = '';
    var h3 = el('tr'); h3.appendChild(el('th', null, 'Critical capability')); list.forEach(function (sn) { h3.appendChild(el('th', null, sn.label)); }); kt.appendChild(h3);
    caps().filter(function (c) { return c.critical; }).forEach(function (c, ci) {
      var tr = el('tr'); tr.appendChild(el('td', null, '\u2605 ' + c.id + ' ' + c.name));
      list.forEach(function (sn) { var cr = sn.res.crit[ci]; var td = el('td', 'num' + (cr.status === 'Critical gap' ? ' flag' : ''), cr.score >= 1 && cr.status !== 'Out of scope' ? cr.score + (cr.status === 'Critical gap' ? ' (gap)' : '') : cr.status === 'Out of scope' ? 'Out of scope' : '\u2013'); tr.appendChild(td); });
      kt.appendChild(tr);
    });
    $('cmpCritHint').textContent = 'A critical gap uses the threshold on the Results tab (currently ' + (parseFloat($('thrCritical').value) || 2) + ').';

    // capability movers (first vs last)
    var mv = $('cmpMovers'); mv.textContent = '';
    if (!multi) { mv.appendChild(el('p', 'empty', 'Capability changes appear once there are two assessments.')); return; }
    var ups = [], downs = [], same = 0, newly = 0, dropped = 0;
    caps().forEach(function (c) {
      var a = first.oos[c.id] ? null : first.scores[c.id], z = last.oos[c.id] ? null : last.scores[c.id];
      var ha = a >= 1, hz = z >= 1;
      if (ha && hz) { if (z > a) ups.push({ c: c, a: a, z: z }); else if (z < a) downs.push({ c: c, a: a, z: z }); else same++; }
      else if (!ha && hz) newly++; else if (ha && !hz) dropped++;
    });
    ups.sort(function (x, y) { return (y.z - y.a) - (x.z - x.a); }); downs.sort(function (x, y) { return (x.z - x.a) - (y.z - y.a); });
    function block(title, items, cls) {
      var box = el('div'); box.appendChild(el('h3', null, title + ' (' + items.length + ')'));
      if (!items.length) box.appendChild(el('p', 'empty', 'None.'));
      items.slice(0, 10).forEach(function (it) {
        var r = el('div', 'start-item'); r.appendChild(el('span', 'cap-id' + (it.c.critical ? ' crit' : ''), it.c.id)); r.appendChild(el('span', null, it.c.activity.split(' until ')[0]));
        r.appendChild(el('span', 'ph ' + cls, it.a + ' \u2192 ' + it.z + ' (' + (it.z > it.a ? '+' : '') + (it.z - it.a) + ')')); box.appendChild(r);
      });
      if (items.length > 10) box.appendChild(el('p', 'hint', (items.length - 10) + ' more are in the download.'));
      return box;
    }
    mv.appendChild(block('Improved', ups, 'up-good')); mv.appendChild(block('Declined', downs, 'down-bad'));
    mv.appendChild(el('p', 'hint', same + ' unchanged' + (newly ? ', ' + newly + ' newly scored' : '') + (dropped ? ', ' + dropped + ' scored before but not now (or now out of scope)' : '') + '. Comparing ' + first.label + ' with ' + last.label + '.'));
  }

  function drawTrend(list) {
    var NS = 'http://www.w3.org/2000/svg', W = 640, H = 230, L = 36, Rr = 20, T = 20, B = 44;
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Overall score for each assessment');
    function node(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; }
    function y(v) { return T + (H - T - B) * (1 - (v - 1) / 4); }
    for (var g = 1; g <= 5; g++) { node('line', { x1: L, y1: y(g), x2: W - Rr, y2: y(g), stroke: '#D9D9D9' }); var t = node('text', { x: L - 8, y: y(g) + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#4A5560' }); t.textContent = g; }
    var n = list.length, step = n > 1 ? (W - L - Rr - 40) / (n - 1) : 0, x0 = L + 20 + (n > 1 ? 0 : (W - L - Rr - 40) / 2);
    var pts = [];
    list.forEach(function (sn, k) {
      var x = x0 + step * k; var lab = node('text', { x: x, y: H - 16, 'text-anchor': 'middle', 'font-size': 11, fill: '#0D0D0D' }); lab.textContent = sn.label.length > 16 ? sn.label.slice(0, 15) + '\u2026' : sn.label;
      if (sn.res.overall != null) pts.push([x, y(sn.res.overall), sn.res.overall, sn.color]);
    });
    if (pts.length > 1) node('polyline', { points: pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '), fill: 'none', stroke: '#F25D27', 'stroke-width': 3, 'stroke-linejoin': 'round' });
    pts.forEach(function (p) { node('circle', { cx: p[0], cy: p[1], r: 6, fill: p[3], stroke: '#FFFFFF', 'stroke-width': 2 }); var t = node('text', { x: p[0], y: p[1] - 12, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#024873' }); t.textContent = fmt(p[2]); });
    var host = $('cmpTrend'); host.textContent = ''; host.appendChild(svg);
  }

  function downloadCompare() {
    var list = compareList(); if (!list.length) return;
    var multi = list.length >= 2, first = list[0], last = list[list.length - 1];
    var head = ['Measure'].concat(list.map(function (s) { return s.label; })); if (multi) head.push('Change (first to last)');
    function chg(a, b) { var d = delta(a, b); return d == null ? '' : round1(d); }
    var rows = [['AI Capability Assessment: comparison over time'], ['Framework version', FW.version], []];
    rows.push(['Assessment'].concat(list.map(function (s) { return s.current ? 'Current (on page)' : s.name; })));
    rows.push(['Organisation'].concat(list.map(function (s) { return s.org || ''; })));
    rows.push(['Assessor'].concat(list.map(function (s) { return s.assessor || ''; })));
    rows.push([]); var hdrRow = rows.length + 1; rows.push(head);
    rows.push(['Overall score'].concat(list.map(function (s) { return s.res.overall == null ? '' : round1(s.res.overall); })).concat(multi ? [chg(first.res.overall, last.res.overall)] : []));
    FW.categories.forEach(function (n, i) { rows.push([n].concat(list.map(function (s) { var v = s.res.cats[i].avg; return v == null ? '' : round1(v); })).concat(multi ? [chg(first.res.cats[i].avg, last.res.cats[i].avg)] : [])); });
    rows.push([]); rows.push(['Critical capability'].concat(list.map(function (s) { return s.label; })));
    caps().filter(function (c) { return c.critical; }).forEach(function (c, ci) { rows.push(['\u2605 ' + c.id + ' ' + c.name].concat(list.map(function (s) { var cr = s.res.crit[ci]; return cr.status === 'Out of scope' ? 'Out of scope' : cr.score >= 1 ? cr.score : ''; }))); });
    var capRows = [['ID', 'Category', 'Capability', 'Critical'].concat(list.map(function (s) { return s.label; })).concat(multi ? ['Change (first to last)'] : [])];
    caps().forEach(function (c) {
      var vals = list.map(function (s) { return s.oos[c.id] ? 'Out of scope' : s.scores[c.id] >= 1 ? s.scores[c.id] : ''; });
      var a = first.oos[c.id] ? null : first.scores[c.id], z = last.oos[c.id] ? null : last.scores[c.id];
      capRows.push([c.id, FW.categories[c.cat], c.name, c.critical ? 'Y' : ''].concat(vals).concat(multi ? [(a >= 1 && z >= 1) ? z - a : ''] : []));
    });
    var fname = 'AI_Capability_Assessment_Comparison.xlsx';
    function fallback() {
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Comparison'); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(capRows), 'Capabilities'); XLSX.writeFile(wb, fname);
    }
    if (typeof ExcelJS === 'undefined') { fallback(); return; }
    var series = list.map(function (sn) { return { cats: sn.res.cats, color: sn.color, dash: sn.dash, fill: sn === last, label: sn.label }; });
    radarPng(series, true).then(function (png) {
      var wb = new ExcelJS.Workbook(); wb.creator = 'Workmatik'; wb.title = 'AI Capability Assessment comparison';
      var ws = wb.addWorksheet('Comparison'); rows.forEach(function (r) { ws.addRow(r); });
      ws.getColumn(1).width = 52; for (var c = 2; c <= list.length + 2; c++) ws.getColumn(c).width = 20;
      ws.getRow(1).font = { bold: true, size: 14 };
      [hdrRow, rows.length - 4 - 0].forEach(function () {});
      var hr = ws.getRow(hdrRow); hr.font = { bold: true, color: { argb: 'FFFFFFFF' } }; hr.eachCell(function (cl) { cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF024873' } }; });
      var critHdr = ws.getRow(rows.length - caps().filter(function (c) { return c.critical; }).length); critHdr.font = { bold: true, color: { argb: 'FFFFFFFF' } }; critHdr.eachCell(function (cl) { cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF024873' } }; });
      var cs = wb.addWorksheet('Capabilities'); capRows.forEach(function (r) { cs.addRow(r); });
      [6, 30, 48, 8].forEach(function (w, i) { cs.getColumn(i + 1).width = w; }); for (var k = 5; k <= list.length + 5; k++) cs.getColumn(k).width = 18;
      var h1 = cs.getRow(1); h1.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h1.eachCell(function (cl) { cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF024873' } }; });
      if (png) { var id = wb.addImage({ base64: png, extension: 'png' }); ws.addImage(id, { tl: { col: 0, row: rows.length + 2 }, ext: { width: 560, height: 360 } }); }
      return wb.xlsx.writeBuffer();
    }).then(function (buf) {
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }).catch(function () { fallback(); });
  }

  // ---------- tabs and init
  function showTab(name) {
    ['audit', 'results', 'compare', 'guide', 'toolkit'].forEach(function (t) {
      var on = t === name; $('tab-' + t).setAttribute('aria-selected', on ? 'true' : 'false'); $('tab-' + t).tabIndex = on ? 0 : -1; $('panel-' + t).hidden = !on;
    });
    if (name === 'results') renderResults();
    if (name === 'compare') renderCompare();
    window.scrollTo(0, 0);
  }

  function init() {
    $('fwVersion').textContent = FW.version;
    $('auditDate').value = new Date().toISOString().slice(0, 10);
    $('thrCritical').value = FW.thresholds.critical; $('thrUneven').value = FW.thresholds.uneven;
    renderChips(); buildCaps(); renderGuide(); refreshAllCaps();
    var tabs = ['audit', 'results', 'compare', 'guide', 'toolkit'];
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
    $('btnWfLink').addEventListener('click', function () { $('wfFile').click(); });
    $('wfFile').addEventListener('change', function (e) { if (e.target.files[0]) loadWorkflowFile(e.target.files[0]); e.target.value = ''; });
    $('wfLinkClear').addEventListener('click', function () { WFL = null; renderWfLink(); });
    renderWfLink();
    $('btnReset').addEventListener('click', function () {
      if (!window.confirm('Clear all scores, notes and out-of-scope marks?')) return;
      state.scores = {}; state.notes = {}; state.oos = {}; WFL = null; renderWfLink(); $('loadMessages').textContent = ''; refreshAllCaps();
    });
    ['thrCritical', 'thrUneven'].forEach(function (id) { $(id).addEventListener('input', renderResults); });
    $('btnCmpAdd').addEventListener('click', function () { $('cmpFiles').click(); });
    $('cmpFiles').addEventListener('change', function (e) { if (e.target.files.length) addCmpFiles(e.target.files); e.target.value = ''; });
    $('cmpCurrent').addEventListener('change', function (e) { cmp.includeCurrent = e.target.checked; renderCompare(); });
    $('cmpClear').addEventListener('click', function () { cmp.snaps = []; $('cmpMessages').textContent = ''; renderCompare(); });
    $('btnCmpDownload').addEventListener('click', downloadCompare);
    $('btnCmpGo').addEventListener('click', function () { showTab('compare'); });
  }
})();

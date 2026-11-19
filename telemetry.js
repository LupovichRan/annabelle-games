/* Kids platform – anonymous usage telemetry + "who did what" audit + reproduction trail.
   Loaded on every page by playtime.js (after kid.js). Write-only: the site can INSERT rows, never read them.
   Attaches to window.KidApp:  track(type, data) · audit(action, target, detail, actor) · trail() · telemetryOn()
   Privacy: the kid's NAME never leaves the device (only the random profile uuid), no typed text, no room codes,
   no localStorage dumps. A parent can switch everything off:  localStorage 'annabelle-telemetry' = "0".
   Storage: localStorage annabelle-device (random id of this browser), annabelle-tq (rows waiting for a connection, <= 200);
            sessionStorage annabelle-sess (tab session id), annabelle-trail (last 80 user actions, for bug reports). */
(function () {
  'use strict';
  var K = window.KidApp = window.KidApp || {};
  if (K._tel) return;
  var URL0 = 'https://leitieyscvpebpgdengu.supabase.co', KEY = 'sb_publishable_k0jnNH7Qt_FURqnAtqrVyA_uGH7YAy3';
  var KDEV = 'annabelle-device', KQ = 'annabelle-tq', KOFF = 'annabelle-telemetry', KSESS = 'annabelle-sess', KTRAIL = 'annabelle-trail', KVER = 'annabelle-ver';
  var MAX_PAGE_EVENTS = 120, MAX_QUEUE = 200, MAX_TRAIL = 80, MAX_ERRORS = 10, FLUSH_MS = 10000;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function json(s, d) { try { var v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } }
  function uuid() {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    var b = new Uint8Array(16);
    try { crypto.getRandomValues(b); } catch (e) { for (var i = 0; i < 16; i++) b[i] = Math.random() * 256 | 0; }
    b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ---------- ids ---------- */
  var memDev = '', memSess = '';
  function device() {
    var d = lsGet(KDEV);
    if (!d || d.length > 40 || d.length < 8) { d = memDev || uuid(); lsSet(KDEV, d); }
    return memDev = d;
  }
  function sess() {
    var s = ssGet(KSESS);
    if (!s || s.length > 40) { s = memSess || uuid(); ssSet(KSESS, s); }
    return memSess = s;
  }
  function profiles() { var p = json(lsGet('annabelle-profiles'), null); return p && Array.isArray(p.list) ? p : {cur: '', list: []}; }
  function kid() {                       // {kid, age, gender} – never the name
    var o = null;
    try { if (typeof K.kid === 'function') o = K.kid(); } catch (e) {}
    if (!o || typeof o !== 'object') {
      var p = profiles();
      for (var i = 0; i < p.list.length; i++) if (p.list[i] && p.list[i].id === p.cur) o = p.list[i];
      o = o || p.list[0] || {};
    }
    var age = Math.round(+o.age);
    return {kid: UUID.test(o.kid || '') ? String(o.kid).toLowerCase() : device0(), age: age >= 3 && age <= 99 ? age : null, gender: /^[fmx]$/.test(o.gender || '') ? o.gender : null};
  }
  function device0() { var d = device(); return UUID.test(d) ? d.toLowerCase() : '00000000-0000-4000-8000-000000000000'; }
  function names() {                     // every profile name on this device (to scrub from anything we send)
    var out = [], p = profiles();
    for (var i = 0; i < p.list.length; i++) { var n = p.list[i] && p.list[i].name; if (typeof n === 'string' && n.trim().length >= 2) out.push(n.trim()); }
    return out;
  }
  function scrub(s) {
    s = String(s == null ? '' : s);
    var ns = names();
    for (var i = 0; i < ns.length; i++) if (s.indexOf(ns[i]) >= 0) s = s.split(ns[i]).join('••');
    return s;
  }
  function lang() { var l = lsGet('annabelle-lang'); return l === 'fr' || l === 'en' || l === 'he' ? l : 'he'; }
  function page() { var p = location.pathname.split('/').pop() || 'index.html'; return p.slice(0, 80); }
  function gameId() { return page().replace(/\.html?$/, '').slice(0, 40); }
  function on() { return lsGet(KOFF) !== '0'; }
  function cleanUrl(u) {                 // origin + path + harmless query (no secrets, no hash)
    try {
      var x = new URL(u || location.href), keep = [];
      x.searchParams.forEach(function (v, k) { if (!/^(s|room|code|pin|key|token|secret|peer|id)$/i.test(k) && v.length <= 24) keep.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });
      return (x.origin + x.pathname + (keep.length ? '?' + keep.join('&') : '')).slice(0, 300);
    } catch (e) { return ''; }
  }

  /* ---------- app version = the service-worker cache name (same string as VERSION in sw.js) ---------- */
  var ver = ssGet(KVER) || '';
  function findVer() {
    try {
      if (ver || !window.caches || !caches.keys) return;
      caches.keys().then(function (ks) {
        var best = '';
        ks.forEach(function (k) { if (/^annabelle-\d{8,}/.test(k) && k > best) best = k; });
        if (best) { ver = best.slice(0, 40); ssSet(KVER, ver); }
      }).catch(function () {});
    } catch (e) {}
  }
  findVer();
  function version() { return ver || 'dev'; }

  /* ---------- sending ---------- */
  function headers() { return {apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal'}; }
  // resolves {ok, status, net}; never rejects. net:true = could not reach the server (worth retrying later)
  function post(table, rows, keepalive) {
    try {
      return fetch(URL0 + '/rest/v1/' + table, {method: 'POST', headers: headers(), body: JSON.stringify(rows), keepalive: !!keepalive, credentials: 'omit', cache: 'no-store'})
        .then(function (r) { return {ok: r.ok, status: r.status, net: r.status >= 500 || r.status === 429}; }, function () { return {ok: false, status: 0, net: true}; });
    } catch (e) { return Promise.resolve({ok: false, status: 0, net: true}); }
  }
  function upload(path, blob, type) {
    try {
      return fetch(URL0 + '/storage/v1/object/reports/' + path, {method: 'POST', headers: {apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': type}, body: blob, credentials: 'omit', cache: 'no-store'})
        .then(function (r) { return {ok: r.ok, status: r.status}; }, function () { return {ok: false, status: 0}; });
    } catch (e) { return Promise.resolve({ok: false, status: 0}); }
  }
  var COLS = {
    events: ['kid', 'device', 'sess', 'type', 'client_ts', 'page', 'game', 'age', 'gender', 'lang', 'ver', 'env', 'data'],
    audit: ['kid', 'device', 'sess', 'actor', 'action', 'target', 'page', 'client_ts', 'env', 'detail'],
    reports: ['kid', 'device', 'sess', 'kind', 'note', 'client_ts', 'page', 'url', 'ua', 'viewport', 'lang', 'age', 'gender', 'ver', 'env', 'steps', 'state', 'screenshot_path', 'audio_path']
  };
  function shape(table, row) {           // same keys on every row of a batch, nothing unexpected
    var o = {}, c = COLS[table];
    for (var i = 0; i < c.length; i++) o[c[i]] = row[c[i]] === undefined ? null : row[c[i]];
    if (table === 'events' && !o.data) o.data = {};
    if (table === 'audit' && !o.detail) o.detail = {};
    if (table === 'events' && !o.ver) o.ver = version();
    return o;
  }
  var Q = [], sentOnPage = 0, flushing = false;
  function stored() { var a = json(lsGet(KQ), []); return Array.isArray(a) ? a : []; }
  function store(items) {             // newest 200; reports first so the cap never drops one
    if (!items.length) { try { localStorage.removeItem(KQ); } catch (e) {} return; }
    var rp = items.filter(function (it) { return it && it.t === 'reports'; }).slice(-10), rest = items.filter(function (it) { return it && it.t !== 'reports'; });
    lsSet(KQ, JSON.stringify(rp.concat(rest.slice(-(MAX_QUEUE - rp.length)))));
  }
  function enqueue(table, row, explicit) {
    if (explicit) { store(stored().concat([{t: table, r: row, x: 1, i: uuid().slice(0, 13)}])); return; }      // a report the user sent: on disk at once
    Q.push({t: table, r: row, x: 0}); if (Q.length > MAX_QUEUE) Q.shift();
  }
  var soonT = 0;
  function flushSoon() { if (!soonT) soonT = setTimeout(function () { soonT = 0; flush(); }, 400); }
  // Queued reports stay in localStorage until the server took them (a page change mid-send must not lose one);
  // events / audit rows are best effort.
  var sending = {};
  function dropReport(id) { store(stored().filter(function (it) { return !(it && it.t === 'reports' && it.i === id); })); }
  function flush(final) {
    if (flushing && !final) return;
    var all = stored().filter(function (it) { return it && COLS[it.t] && it.r; });
    var reports = all.filter(function (it) { return it.t === 'reports'; });
    var items = all.filter(function (it) { return it.t !== 'reports'; }).concat(Q); Q = [];
    if (!on()) items = [];                         // switched off: only reports the user sent explicitly go out
    if (navigator.onLine === false) { store(reports.concat(items)); return; }
    store(reports);
    var groups = {events: [], audit: []};
    items.forEach(function (it) { if (groups[it.t]) groups[it.t].push(it); });
    if (final) {                                  // page is going away: best effort with keepalive (64 KB budget)
      ['events', 'audit'].forEach(function (tb) {
        var rows = groups[tb].slice(-40).map(function (it) { return shape(tb, it.r); }), budget = tb === 'events' ? 40000 : 16000;
        while (rows.length && JSON.stringify(rows).length > budget) rows.shift();
        if (rows.length) post(tb, rows, true);
      });
      return;
    }
    reports.forEach(function (it) {
      if (!it.i || sending[it.i]) return;
      sending[it.i] = 1;
      post('reports', shape('reports', it.r), false).then(function (res) { delete sending[it.i]; if (res.ok || !res.net) dropReport(it.i); });
    });
    var jobs = [];
    ['events', 'audit'].forEach(function (tb) {
      var g = groups[tb];
      for (var i = 0; i < g.length; i += 50) (function (part) {
        jobs.push(post(tb, part.map(function (it) { return shape(tb, it.r); }), false).then(function (res) { return res.ok || !res.net ? [] : part; }));
      })(g.slice(i, i + 50));
    });
    if (!jobs.length) return;
    flushing = true;
    Promise.all(jobs).then(function (back) {
      flushing = false;
      var keep = []; back.forEach(function (b) { keep = keep.concat(b); });
      if (keep.length) store(stored().concat(keep));
    });
  }
  // Where a row comes from, so development and automated tests never pollute the real statistics:
  // 'qa'  = an automated browser (navigator.webdriver) or a device switched to QA mode (open any page with ?qa=1; ?qa=0 switches back)
  // 'dev' = served from a developer machine (localhost / file) ; 'prod' = a real visitor on the public site
  var ENV = (function () {
    try {
      var m = /[?&]qa=([01])(?:&|$)/.exec(location.search);
      if (m) { if (m[1] === '1') localStorage.setItem('kidapp-qa', '1'); else localStorage.removeItem('kidapp-qa'); }
      if (navigator.webdriver || localStorage.getItem('kidapp-qa') === '1') return 'qa';
      var h = location.hostname;
      if (!h || h === 'localhost' || h === '0.0.0.0' || h === '[::1]' || /^127\./.test(h) || /^(10|192\.168)\./.test(h) || location.protocol === 'file:') return 'dev';
    } catch (e) {}
    return 'prod';
  })();
  function base() { var k = kid(); return {env: ENV, kid: k.kid, device: device(), sess: sess(), age: k.age, gender: k.gender, lang: lang(), page: page(), ver: version(), client_ts: new Date().toISOString()}; }
  function small(obj, max) {             // plain JSON object under max bytes, names scrubbed
    if (obj == null || typeof obj !== 'object') obj = obj == null ? {} : {v: obj};
    var s; try { s = scrub(JSON.stringify(obj)); } catch (e) { return {}; }
    if (!s || s.length > max) return {truncated: true};
    return json(s, {});
  }
  function track(type, data, game) {
    try {
      if (!on() || !type) return false;
      if (sentOnPage >= MAX_PAGE_EVENTS) return false;
      sentOnPage++;
      var b = base();
      enqueue('events', {kid: b.kid, device: b.device, sess: b.sess, type: String(type).slice(0, 40), client_ts: b.client_ts, page: b.page,
        game: String(game || (data && data.game) || gameId()).slice(0, 40), age: b.age, gender: b.gender, lang: b.lang, ver: ver || null, env: ENV, data: small(data, 3000)});
      return true;
    } catch (e) { return false; }
  }
  function audit(action, target, detail, actor) {
    try {
      if (!on() || !action) return false;
      var b = base();
      enqueue('audit', {kid: b.kid, device: b.device, sess: b.sess, actor: actor === 'parent' || actor === 'system' ? actor : 'kid', action: String(action).slice(0, 60),
        target: target == null ? null : scrub(target).slice(0, 120), page: b.page, client_ts: b.client_ts, env: ENV, detail: small(detail, 3000)});
      note('audit', String(action).slice(0, 40));
      flushSoon();                         // rare and important: do not wait for the next batch
      return true;
    } catch (e) { return false; }
  }

  /* ---------- reproduction trail (stays on the device until a report is sent) ---------- */
  var trail = json(ssGet(KTRAIL), []); if (!Array.isArray(trail)) trail = [];
  var trailT = 0;
  function saveTrail() { trailT = 0; ssSet(KTRAIL, JSON.stringify(trail)); }
  function note(kind, text, extra) {
    try {
      var now = Date.now(), last = trail[trail.length - 1], d = scrub(text).replace(/\s+/g, ' ').trim().slice(0, 90);
      if (last && last.k === kind && last.d === d && last.p === page() && now - last.t < 1500) { last.n = (last.n || 1) + 1; last.t = now; }
      else { var e = {t: now, k: kind, p: page(), d: d}; if (extra) e.x = extra; trail.push(e); if (trail.length > MAX_TRAIL) trail.splice(0, trail.length - MAX_TRAIL); }
      if (!trailT) trailT = setTimeout(saveTrail, 400);
    } catch (e) {}
  }
  function describe(el) {                // tag + id/class + short visible label; never a value typed by the user
    if (!el || el.nodeType !== 1) return '';
    var tag = el.tagName.toLowerCase(), isField = /^(input|textarea|select)$/.test(tag) || el.isContentEditable;
    var hit = isField ? el : (el.closest && el.closest('button,a,[role=button],label,summary,[onclick],[data-a],[data-k]')) || el;
    tag = hit.tagName.toLowerCase();
    var s = tag;
    if (hit.id) s += '#' + String(hit.id).slice(0, 30);
    else { var c = typeof hit.className === 'string' ? hit.className.trim().split(/\s+/).slice(0, 2).join('.') : ''; if (c) s += '.' + c.slice(0, 30); }
    if (isField) return s + (hit.type ? '[' + hit.type + ']' : '');
    if (tag === 'canvas' || tag === 'html' || tag === 'body' || tag === 'svg') return s;
    var lab = hit.getAttribute('aria-label') || hit.getAttribute('title') || '';
    if (!lab && !hit.querySelector('input,textarea,[contenteditable]')) { var tx = hit.innerText || hit.textContent || ''; if (tx.length <= 200) lab = tx; }
    lab = lab.replace(/\s+/g, ' ').trim();
    if (lab.length > 40) lab = lab.slice(0, 39) + '…';
    return lab ? s + ' "' + lab + '"' : s;
  }
  window.addEventListener('pointerdown', function (e) {
    try {
      var el = e.target, d = describe(el), r, x;
      if (!d) return;
      if (el.tagName === 'CANVAS' || el === document.body || el === document.documentElement) {
        r = el.getBoundingClientRect(); if (r.width && r.height) x = Math.round((e.clientX - r.left) / r.width * 100) + '%,' + Math.round((e.clientY - r.top) / r.height * 100) + '%';
      }
      note(e.pointerType === 'touch' ? 'tap' : 'click', d, x);
    } catch (err) {}
  }, {capture: true, passive: true});
  window.addEventListener('keydown', function (e) {
    try {
      if (e.repeat || !e.key) return;
      var el = e.target, field = el && el.nodeType === 1 && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      var k = e.key === ' ' ? 'Space' : e.key;
      if (field ? !/^(Enter|Escape|Tab)$/.test(k) : k.length < 2) return;       // never letters, digits or anything typed into a field
      note('key', k);
    } catch (err) {}
  }, {capture: true, passive: true});
  window.addEventListener('online', function () { note('net', 'online'); setTimeout(flush, 1500); });
  window.addEventListener('offline', function () { note('net', 'offline'); });

  /* ---------- automatic events ---------- */
  var errSeen = {}, errCount = 0;
  function onError(msg, src, line, col) {
    try {
      msg = scrub(msg || 'error').slice(0, 200);
      src = String(src || '').split(/[?#]/)[0].split('/').pop().slice(0, 60);
      var key = msg + '|' + src + '|' + (line || 0);
      if (errSeen[key]) return; errSeen[key] = 1;
      note('error', msg + (src ? ' @' + src + ':' + (line || 0) : ''));
      if (errCount >= MAX_ERRORS) return; errCount++;
      track('error', {msg: msg, src: src, line: line || 0, col: col || 0});
    } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    if (e && e.message) onError(e.message, e.filename, e.lineno, e.colno);       // (resource load failures have no message: ignored)
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason, m = r && (r.message || (typeof r === 'string' ? r : '')) || 'unhandled rejection';
    var st = r && r.stack ? /([\w.-]+\.(?:js|html)):(\d+):(\d+)/.exec(String(r.stack)) : null;
    onError('Promise: ' + m, st ? st[1] : '', st ? +st[2] : 0, st ? +st[3] : 0);
  });

  var visStart = document.visibilityState === 'visible' ? Date.now() : 0, visMs = 0, viewed = false, ended = false;
  function visSec() { return Math.round((visMs + (visStart ? Date.now() - visStart : 0)) / 1000); }
  function pageView() {
    if (viewed) return; viewed = true; ended = false;
    var ref = ''; try { if (document.referrer && new URL(document.referrer).origin === location.origin) ref = (new URL(document.referrer).pathname.split('/').pop() || 'index.html').slice(0, 80); } catch (e) {}
    var pwa = false; try { pwa = !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; } catch (e) {}
    note('page', page());
    track('page_view', {ref: ref, vw: window.innerWidth, vh: window.innerHeight, dpr: Math.round((window.devicePixelRatio || 1) * 10) / 10, touch: (navigator.maxTouchPoints || 0) > 0, pwa: pwa});
  }
  function pageEnd() {
    if (ended) return; ended = true; viewed = false;
    if (run) endRun({quit: true});
    sentOnPage = Math.min(sentOnPage, MAX_PAGE_EVENTS - 1);
    track('session_end', {sec: visSec(), events: sentOnPage, errors: errCount});
    if (trailT) clearTimeout(trailT); saveTrail();
    flush(true);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { if (!visStart) visStart = Date.now(); }
    else if (visStart) { visMs += Date.now() - visStart; visStart = 0; flush(); }
  });
  window.addEventListener('pagehide', pageEnd);
  window.addEventListener('pageshow', function (e) { if (e.persisted) { visMs = 0; visStart = Date.now(); sentOnPage = 0; pageView(); } });

  /* ---------- game lifecycle, read off the shared rewards calls (no game file is touched) ---------- */
  var run = null;                        // {game, t0}
  function endRun(extra) {
    if (!run) return;
    var d = {sec: Math.round((Date.now() - run.t0) / 1000)}; for (var k in extra) d[k] = extra[k];
    if (run.score != null && d.score == null) d.score = run.score;
    track('game_end', d, run.game); run = null;
  }
  function num(v) { v = +v; return isFinite(v) ? Math.round(v * 100) / 100 : undefined; }
  function onAward(o) {
    if (!o || typeof o !== 'object' || !o.event) return;
    var g = String(o.game || gameId()).slice(0, 40), ev = String(o.event);
    note('reward', g + ' ' + ev + (o.level != null ? ' L' + num(o.level) : '') + (o.score != null ? ' score ' + num(o.score) : '') + (o.stars != null ? ' stars ' + num(o.stars) : ''));
    if (ev === 'play') { if (run) endRun({quit: true}); run = {game: g, t0: Date.now()}; track('game_start', {}, g); }
    else if (ev === 'levelClear' || ev === 'star') track('level', {level: num(o.level), stars: num(o.stars), score: num(o.score), sec: run ? Math.round((Date.now() - run.t0) / 1000) : undefined}, g);
    else if (ev === 'score') { if (run && run.game === g) { run.score = num(o.score); endRun({win: !!run.won}); } else track('game_end', {score: num(o.score)}, g); }
    else if (ev === 'win') { if (run && run.game === g) run.won = true; track('game_end', {win: true, score: num(o.score), level: num(o.level), sec: run ? Math.round((Date.now() - run.t0) / 1000) : undefined}, g); if (run && run.game === g) run = null; }
  }
  var hookTries = 0;
  function hookRewards() {
    var R = window.AnnabelleRewards;
    if (R && typeof R.award === 'function' && !R.award._tel) {
      var orig = R.award;
      var w = function (o) { try { onAward(o); } catch (e) {} return orig.apply(this, arguments); };
      w._tel = 1;
      try { R.award = w; } catch (e) {}
      return true;
    }
    return !!(R && R.award && R.award._tel);
  }
  function tryHook() { if (hookRewards() || ++hookTries > 40) return; setTimeout(tryHook, hookTries < 10 ? 150 : 1000); }

  K.track = track; K.audit = audit;
  K.trail = function () { return trail.map(function (e) { var o = {}; for (var k in e) o[k] = e[k]; return o; }); };
  K.telemetryOn = on;
  K._tel = {env: ENV, url: URL0, key: KEY, base: base, post: post, upload: upload, shape: shape, flush: flush, enqueue: enqueue, version: version, cleanUrl: cleanUrl, scrub: scrub, note: note, on: on, small: small};

  pageView();
  tryHook();
  document.addEventListener('DOMContentLoaded', function () { hookRewards(); });
  setInterval(flush, FLUSH_MS);
  setTimeout(flush, 2500);               // the first page_view (and anything left from an offline visit) goes out early
})();

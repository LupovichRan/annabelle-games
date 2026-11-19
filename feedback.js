/* Kids platform – in-app reports: a small movable "🐞" button on every screen (or F8, or KidApp.report()).
   Flow: remember the trail + game state -> take a picture of the screen as it is -> open the dialog
   (bug / idea / fix request, a note and/or a voice note of max 20 s, "don't send the picture") -> Send.
   Loaded by playtime.js after kid.js and telemetry.js; works (with its own tiny sender) when either is missing.
   The picture uses vendor/html2canvas.min.js (loaded only when the dialog is first opened; no CDN). */
(function () {
  'use strict';
  var K = window.KidApp = window.KidApp || {};
  if (K._fb) return; K._fb = 1;
  var me = document.currentScript, BASE = '';
  try { BASE = me && me.src ? me.src.replace(/[^\/]*$/, '') : ''; } catch (e) {}
  var URL0 = 'https://leitieyscvpebpgdengu.supabase.co', KEY = 'sb_publishable_k0jnNH7Qt_FURqnAtqrVyA_uGH7YAy3';
  var MAX_SEC = 20, MAX_SHOT = 300 * 1024, MAX_SIDE = 1280, KPOS = 'kidapp-fbpos';

  var T = {
    he: {btn: 'דיווח על תקלה או רעיון', title: 'ספרו לנו! 💌', bug: 'משהו לא עובד', feature: 'יש לי רעיון', fix: 'צריך לתקן',
      ph: 'מה קרה? אפשר לכתוב כאן…', rec: '🎤 הקלטת הודעה קולית', stop: '⏹ עצירה', del: 'מחיקה', delA: 'מחיקת ההקלטה', sec: 'שנ׳',
      shot: 'תמונה של המסך', noshot: 'לא לשלוח את התמונה', send: '🚀 שליחה', cancel: 'ביטול', close: 'סגירה',
      need: 'כתבו כמה מילים או הקליטו הודעה 🙂', sending: 'שולח…', thanks: 'תודה רבה! 💛', got: 'קיבלנו את ההודעה ונבדוק אותה.',
      id: 'מספר הדיווח', queued: 'אין אינטרנט כרגע. ההודעה נשמרה ותישלח אחר כך (בלי תמונה ובלי הקלטה).', fail: 'השליחה לא הצליחה. אפשר לנסות שוב.', kind: 'סוג ההודעה'},
    fr: {btn: 'Signaler un bug ou une idée', title: 'Dis-nous tout ! 💌', bug: 'Ça ne marche pas', feature: 'J’ai une idée', fix: 'À corriger',
      ph: 'Que s’est-il passé ? Écris ici…', rec: '🎤 Enregistrer un message vocal', stop: '⏹ Arrêter', del: 'Supprimer', delA: 'Supprimer l’enregistrement', sec: 's',
      shot: 'Image de l’écran', noshot: 'Ne pas envoyer l’image', send: '🚀 Envoyer', cancel: 'Annuler', close: 'Fermer',
      need: 'Écris quelques mots ou enregistre un message 🙂', sending: 'Envoi…', thanks: 'Merci beaucoup ! 💛', got: 'Message bien reçu, on va regarder ça.',
      id: 'Numéro du message', queued: 'Pas d’internet pour l’instant. Le message est gardé et partira plus tard (sans image ni son).', fail: 'L’envoi n’a pas marché. Tu peux réessayer.', kind: 'Type de message'},
    en: {btn: 'Report a bug or an idea', title: 'Tell us! 💌', bug: 'Something is broken', feature: 'I have an idea', fix: 'Please fix this',
      ph: 'What happened? Write here…', rec: '🎤 Record a voice note', stop: '⏹ Stop', del: 'Delete', delA: 'Delete the recording', sec: 's',
      shot: 'Picture of the screen', noshot: 'Don’t send the picture', send: '🚀 Send', cancel: 'Cancel', close: 'Close',
      need: 'Write a few words or record a message 🙂', sending: 'Sending…', thanks: 'Thank you! 💛', got: 'We got your message and will look at it.',
      id: 'Report number', queued: 'No internet right now. The message is saved and will be sent later (without the picture and the recording).', fail: 'Sending did not work. You can try again.', kind: 'Kind of message'}
  };
  function lang() { var l = null; try { l = localStorage.getItem('annabelle-lang'); } catch (e) {} return T[l] ? l : 'he'; }
  function t(k) { return T[lang()][k]; }

  /* ---------- sender (telemetry.js when present, else a minimal copy) ---------- */
  function rnd(n, abc) { var s = '', a = new Uint8Array(n); try { crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < n; i++) a[i] = Math.random() * 256 | 0; } for (var j = 0; j < n; j++) s += abc[a[j] % abc.length]; return s; }
  function tel() {
    if (K._tel) return K._tel;
    function g(st, k) { try { return st.getItem(k); } catch (e) { return null; } }
    function uu() { var h = rnd(32, '0123456789abcdef'); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-a' + h.slice(17, 20) + '-' + h.slice(20); }
    return {
      base: function () {
        var d = g(localStorage, 'annabelle-device'); if (!d) { d = uu(); try { localStorage.setItem('annabelle-device', d); } catch (e) {} }
        var s = g(sessionStorage, 'annabelle-sess'); if (!s) { s = uu(); try { sessionStorage.setItem('annabelle-sess', s); } catch (e) {} }
        var o = {}; try { var p = JSON.parse(g(localStorage, 'annabelle-profiles')); p.list.forEach(function (x) { if (x.id === p.cur) o = x; }); } catch (e) {}
        var age = Math.round(+o.age), U = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
        return {kid: U.test(o.kid || '') ? o.kid : (U.test(d) ? d : uu()), device: d.slice(0, 40), sess: s.slice(0, 40), age: age >= 3 && age <= 99 ? age : null, gender: /^[fmx]$/.test(o.gender || '') ? o.gender : null,
          lang: lang(), page: (location.pathname.split('/').pop() || 'index.html').slice(0, 80), ver: 'dev', client_ts: new Date().toISOString()};
      },
      post: function (table, row) {
        return fetch(URL0 + '/rest/v1/' + table, {method: 'POST', headers: {apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal'}, body: JSON.stringify(row), credentials: 'omit'})
          .then(function (r) { return {ok: r.ok, status: r.status, net: r.status >= 500 || r.status === 429}; }, function () { return {ok: false, status: 0, net: true}; });
      },
      upload: function (path, blob, type) {
        return fetch(URL0 + '/storage/v1/object/reports/' + path, {method: 'POST', headers: {apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': type}, body: blob, credentials: 'omit'})
          .then(function (r) { return {ok: r.ok, status: r.status}; }, function () { return {ok: false, status: 0}; });
      },
      enqueue: function (table, row) { try { var q = JSON.parse(g(localStorage, 'annabelle-tq') || '[]'); q.push({t: table, r: row, x: 1, i: rnd(12, 'abcdefghijklmnopqrstuvwxyz0123456789')}); localStorage.setItem('annabelle-tq', JSON.stringify(q.slice(-200))); } catch (e) {} },
      flush: function () {
        var self = this, q; try { q = JSON.parse(g(localStorage, 'annabelle-tq') || '[]'); } catch (e) { return; }
        if (!Array.isArray(q) || !q.length || navigator.onLine === false) return;
        var mine = q.filter(function (it) { return it && it.t === 'reports' && it.r; }), rest = q.filter(function (it) { return !(it && it.t === 'reports'); });
        if (!mine.length) return;
        try { localStorage.setItem('annabelle-tq', JSON.stringify(rest)); } catch (e) {}
        mine.forEach(function (it) { self.post('reports', it.r).then(function (res) { if (!res.ok && res.net) self.enqueue('reports', it.r); }); });
      },
      cleanUrl: function () { return (location.origin + location.pathname).slice(0, 300); },
      scrub: function (s) { return String(s); }, version: function () { return 'dev'; }, fallback: true
    };
  }
  function bytes(s) { try { return new Blob([s]).size; } catch (e) { return s.length * 3; } }

  /* ---------- what the page looked like: trail, state, picture ---------- */
  var SECRET = /name|room|code|secret|pin|peer|token|pass|invite|link|url/i;
  function clean(v, depth, maxArr) {
    if (v == null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 1000) / 1000 : null;
    if (typeof v === 'string') return v.length > 120 ? v.slice(0, 120) + '…' : v;
    if (typeof v !== 'object' || depth <= 0) return undefined;
    if (Array.isArray(v) || (typeof v.length === 'number' && typeof v !== 'function' && v.buffer)) {
      var a = [], n = Math.min(v.length, maxArr);
      for (var i = 0; i < n; i++) { var x = clean(v[i], depth - 1, maxArr); a.push(x === undefined ? null : x); }
      if (v.length > n) a.push('+' + (v.length - n));
      return a;
    }
    var o = {}, c = 0;
    for (var k in v) { if (++c > 80) break; if (SECRET.test(k)) continue; var y; try { y = clean(v[k], depth - 1, maxArr); } catch (e) { y = undefined; } if (y !== undefined) o[k] = y; }
    return o;
  }
  function hookState() {
    var id = (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/, ''), h = null;
    try { h = window['__' + id]; } catch (e) {}
    if (!h || typeof h.state !== 'function') {
      h = null;
      try { var ks = Object.keys(window); for (var i = 0; i < ks.length && !h; i++) if (/^__[a-z0-9]+$/i.test(ks[i]) && window[ks[i]] && typeof window[ks[i]].state === 'function') h = window[ks[i]]; } catch (e) {}
    }
    if (!h) return null;
    var raw; try { raw = h.state(); } catch (e) { return {error: String(e && e.message || e).slice(0, 120)}; }
    var tries = [[6, 40], [5, 12], [3, 6], [2, 3]], sc = tel().scrub;
    for (var j = 0; j < tries.length; j++) {
      try { var s = sc(JSON.stringify(clean(raw, tries[j][0], tries[j][1]))); if (s && bytes(s) <= 5000) return JSON.parse(s); } catch (e) {}
    }
    return {truncated: true};
  }
  function snapCanvases() {              // sync copies of every visible <canvas> (WebGL buffers are only valid right now)
    var out = [], all = document.querySelectorAll('canvas');
    for (var i = 0; i < all.length; i++) {
      var c = all[i], r = c.getBoundingClientRect(), copy = null;
      try {
        var cs = getComputedStyle(c);
        if (c.width > 0 && c.height > 0 && r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && cs.visibility !== 'hidden' && cs.display !== 'none' && !c.closest('#fb-btn,#fb-dlg')) {
          var k = Math.min(1, 1600 / Math.max(c.width, c.height));
          copy = document.createElement('canvas'); copy.width = Math.max(1, Math.round(c.width * k)); copy.height = Math.max(1, Math.round(c.height * k));
          copy.getContext('2d').drawImage(c, 0, 0, copy.width, copy.height);
        }
      } catch (e) { copy = null; }
      out.push({copy: copy, rect: r});
    }
    return out;
  }
  function hideNames(doc) {             // the kid's name must not leave the device: blank it in the copy that gets drawn
    var ns = []; try { JSON.parse(localStorage.getItem('annabelle-profiles')).list.forEach(function (p) { if (p && typeof p.name === 'string' && p.name.trim().length >= 2) ns.push(p.name.trim()); }); } catch (e) {}
    if (!ns.length || !doc.body) return;
    var w = doc.createTreeWalker(doc.body, 4, null), n, i;
    while ((n = w.nextNode())) { var v = n.nodeValue; if (!v) continue; for (i = 0; i < ns.length; i++) if (v.indexOf(ns[i]) >= 0) v = v.split(ns[i]).join('\u2022\u2022\u2022'); if (v !== n.nodeValue) n.nodeValue = v; }
    var f = doc.querySelectorAll('input,textarea');
    for (i = 0; i < f.length; i++) { try { if (f[i].type !== 'checkbox' && f[i].type !== 'radio' && f[i].type !== 'range' && f[i].value) f[i].value = ''; } catch (e) {} }
  }
  var h2cP = null;
  function loadH2C() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (!h2cP) h2cP = new Promise(function (res) {
      var s = document.createElement('script'); s.src = BASE + 'vendor/html2canvas.min.js';
      s.onload = function () { res(window.html2canvas || null); }; s.onerror = function () { h2cP = null; res(null); };
      (document.head || document.documentElement).appendChild(s);
    });
    return h2cP;
  }
  function bgColor() {
    try { var els = [document.body, document.documentElement]; for (var i = 0; i < 2; i++) { var c = getComputedStyle(els[i]).backgroundColor; if (c && c !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(c)) return c; } } catch (e) {}
    return '#ffffff';
  }
  function capture() {                   // resolves a <canvas> of the viewport, or null
    return new Promise(function (resolve) {
      var done = false, started = false, snaps = [], vw = innerWidth, vh = innerHeight, bg = bgColor();
      var scale = Math.min(2, window.devicePixelRatio || 1, MAX_SIDE / Math.max(vw, vh));
      function finish(c) { if (done) return; done = true; resolve(c || null); }
      function plain() {                 // fallback: background + the canvases only
        try {
          if (!snaps.some(function (s) { return s.copy; })) return null;
          var c = document.createElement('canvas'); c.width = Math.round(vw * scale); c.height = Math.round(vh * scale);
          var x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
          snaps.forEach(function (s) { if (s.copy) x.drawImage(s.copy, s.rect.left * scale, s.rect.top * scale, s.rect.width * scale, s.rect.height * scale); });
          return c;
        } catch (e) { return null; }
      }
      function go() {
        if (started) return; started = true;
        try { snaps = snapCanvases(); } catch (e) { snaps = []; }
        setTimeout(function () { finish(plain()); }, 5000);
        loadH2C().then(function (h2c) {
          if (!h2c || done) return finish(plain());
          return h2c(document.documentElement, {
            logging: false, backgroundColor: bg, scale: scale, x: window.pageXOffset, y: window.pageYOffset, width: vw, height: vh, windowWidth: vw, windowHeight: vh,
            imageTimeout: 2500, useCORS: false, allowTaint: false, removeContainer: true,
            ignoreElements: function (el) { return el.id === 'fb-btn' || el.id === 'fb-dlg' || el.tagName === 'IFRAME' || el.tagName === 'VIDEO'; },
            onclone: function (doc) {
              try { hideNames(doc); } catch (e) {}
              try {
                var cl = doc.querySelectorAll('canvas'); if (cl.length !== snaps.length) return;
                for (var i = 0; i < cl.length; i++) if (snaps[i].copy) { var x = cl[i].getContext('2d'); if (x) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cl[i].width, cl[i].height); x.drawImage(snaps[i].copy, 0, 0, cl[i].width, cl[i].height); } }
              } catch (e) {}
            }
          }).then(function (c) { finish(c && c.width > 8 ? c : plain()); });
        }).catch(function () { finish(plain()); });
      }
      try { requestAnimationFrame(go); } catch (e) {}
      setTimeout(go, 250);
    });
  }
  function toJpeg(canvas) {              // resolves a JPEG blob <= 300 KB, or null
    return new Promise(function (resolve) {
      var qs = [0.82, 0.68, 0.52, 0.38], cur = canvas, round = 0;
      function attempt(i) {
        try {
          cur.toBlob(function (b) {
            if (b && b.size <= MAX_SHOT && b.size > 0) return resolve(b);
            if (!b) return resolve(null);
            if (i + 1 < qs.length) return attempt(i + 1);
            if (++round > 4) return resolve(null);
            var s = document.createElement('canvas'); s.width = Math.max(1, Math.round(cur.width * 0.7)); s.height = Math.max(1, Math.round(cur.height * 0.7));
            s.getContext('2d').drawImage(cur, 0, 0, s.width, s.height); cur = s; attempt(1);
          }, 'image/jpeg', qs[i]);
        } catch (e) { resolve(null); }
      }
      attempt(0);
    });
  }

  /* ---------- styles ---------- */
  var css = '#fb-btn{all:revert;box-sizing:border-box;position:fixed;z-index:2147482900;width:36px;height:36px;border-radius:999px;border:1.5px solid rgba(90,59,26,.35);background:rgba(255,248,230,.6);' +
    'font:18px/1 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;padding:0;margin:0;display:flex;align-items:center;justify-content:center;opacity:.5;cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:opacity .2s}' +
    '#fb-btn:hover,#fb-btn:focus-visible,#fb-btn.drag{opacity:1}#fb-btn:focus-visible{outline:3px solid #4b6bd6;outline-offset:2px}#fb-btn.drag{cursor:grabbing;transform:scale(1.15)}#fb-btn[hidden]{display:none}' +
    '#fb-dlg :is(div,span,button,textarea,label,h3,p,input,audio,canvas,b){all:revert;box-sizing:border-box}' +
    '#fb-dlg [hidden]{display:none!important}#fb-dlg{position:fixed;inset:0;z-index:2147483150;display:flex;align-items:center;justify-content:center;background:rgba(20,16,40,.6);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;touch-action:manipulation;padding:8px;box-sizing:border-box}' +
    '#fb-dlg .card{background:#fffaf0;color:#3a2a17;border-radius:22px;padding:12px 14px;width:min(100%,440px);max-height:100%;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:9px;font-size:16px;line-height:1.3;text-align:start}' +
    '#fb-dlg h3{margin:0;font-size:20px;display:flex;align-items:center;justify-content:space-between;gap:8px}' +
    '#fb-dlg button{font:700 16px system-ui,-apple-system,Arial,sans-serif;min-height:46px;border-radius:14px;border:0;background:#ffd6a0;color:#3a2a17;cursor:pointer;padding:6px 10px;margin:0}' +
    '#fb-dlg button:active{transform:scale(.97)}#fb-dlg button:focus-visible,#fb-dlg textarea:focus-visible,#fb-dlg input:focus-visible{outline:3px solid #4b6bd6;outline-offset:2px}' +
    '#fb-dlg button.pri{background:#ff9f43;color:#fff}#fb-dlg button.soft{background:#efe6d8}#fb-dlg button.x{min-width:46px;background:#efe6d8;font-size:18px}#fb-dlg button[disabled]{opacity:.55;cursor:default}' +
    '#fb-dlg .kinds{display:flex;gap:6px}#fb-dlg .kinds button{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:13px;line-height:1.15;padding:6px 2px;background:#fff0d6;border:3px solid transparent;min-height:64px}' +
    '#fb-dlg .kinds button span{font-size:24px}#fb-dlg .kinds button[aria-pressed=true]{border-color:#ff9f43;background:#ffe2b8}' +
    '#fb-dlg textarea{display:block;width:100%;min-height:76px;max-height:30vh;resize:vertical;font:16px/1.35 system-ui,-apple-system,Arial,sans-serif;border-radius:14px;border:2px solid #e8c79a;padding:8px;background:#fff;color:#3a2a17;margin:0}' +
    '#fb-dlg .row{display:flex;gap:8px;align-items:center}#fb-dlg .row>button{flex:1}#fb-dlg .voice{flex-wrap:wrap}#fb-dlg audio{flex:1;min-width:0;height:40px;max-width:100%}' +
    '#fb-dlg .shot{background:#fff0d6;border-radius:14px;padding:6px 8px}#fb-dlg .shot canvas{display:block;max-width:96px;max-height:84px;width:auto;height:auto;border-radius:8px;border:2px solid #e8c79a;background:#fff;flex:none}' +
    '#fb-dlg .shot.off canvas{opacity:.25;filter:grayscale(1)}#fb-dlg .shot label{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;min-height:44px;cursor:pointer;flex:1}' +
    '#fb-dlg .shot input{width:24px;height:24px;flex:none;margin:0}#fb-dlg .shot small{display:block;font-weight:400;font-size:12px;opacity:.75}' +
    '#fb-dlg .msg{min-height:20px;text-align:center;font-weight:700;color:#b3261e;font-size:15px}' +
    '#fb-dlg .thanks{text-align:center;display:flex;flex-direction:column;gap:8px;align-items:center}#fb-dlg .thanks .big{font-size:26px;font-weight:800}#fb-dlg .thanks .rid{direction:ltr;font:800 22px ui-monospace,Menlo,Consolas,monospace;letter-spacing:3px;background:#fff0d6;border-radius:12px;padding:6px 14px}';
  function el(tag, attrs, text) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  var STOP = ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchmove', 'touchend', 'wheel', 'contextmenu'];
  function shield(node) { STOP.forEach(function (ev) { node.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); }); }

  /* ---------- the button ---------- */
  var btn = null, userPos = null, opening = false, dlg = null;
  function pageKey() { return location.pathname.split('/').pop() || 'index.html'; }
  function loadPos() { try { var p = JSON.parse(localStorage.getItem(KPOS) || '{}')[pageKey()]; if (p && p.length === 2 && isFinite(p[0]) && isFinite(p[1])) return p; } catch (e) {} return null; }
  function savePos(p) { try { var o = JSON.parse(localStorage.getItem(KPOS) || '{}'); if (!o || typeof o !== 'object') o = {}; o[pageKey()] = p; localStorage.setItem(KPOS, JSON.stringify(o)); } catch (e) {} }
  function setXY(x, y) {
    var m = 4, w = 36;
    x = Math.max(m, Math.min(innerWidth - w - m, x)); y = Math.max(m, Math.min(innerHeight - w - m, y));
    btn.style.left = Math.round(x) + 'px'; btn.style.top = Math.round(y) + 'px';
  }
  function busyRects() {
    var out = [], list = document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[onclick],.btn,.act,#pt-badge');
    for (var i = 0; i < list.length; i++) {
      var e = list[i]; if (e === btn || (dlg && dlg.contains(e))) continue;
      var r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      var cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') continue;
      out.push(r);
    }
    return out;
  }
  function place() {
    if (!btn || btn.hidden || btn.classList.contains('drag')) return;
    if (userPos) return setXY(userPos[0] * innerWidth - 18, userPos[1] * innerHeight - 18);
    var vw = innerWidth, vh = innerHeight, m = 4, w = 36, R = vw - w - m, B = vh - w - m, hits = busyRects(), pad = 6;
    var ys = [0.5, 0.38, 0.62, 0.27, 0.73, 0.16, 0.84], cand = [], i;
    for (i = 0; i < ys.length; i++) { cand.push([R, ys[i] * vh - 18]); cand.push([m, ys[i] * vh - 18]); }
    cand.push([R, B], [m, B], [R, m], [m, m], [vw / 2 - 18, B], [vw / 2 - 18, m]);
    for (i = 0; i < cand.length; i++) {
      var x = cand[i][0], y = cand[i][1], ok = true;
      for (var j = 0; j < hits.length; j++) { var r = hits[j]; if (r.left < x + w + pad && r.right > x - pad && r.top < y + w + pad && r.bottom > y - pad) { ok = false; break; } }
      if (ok) return setXY(x, y);
    }
    setXY(R, vh * 0.5 - 18);
  }
  var placeT = 0;
  function placeSoon(ms) { clearTimeout(placeT); placeT = setTimeout(place, ms || 60); }
  function makeButton() {
    if (btn || !document.body) return;
    var st = el('style', {id: 'fb-style'}); st.textContent = css; (document.head || document.documentElement).appendChild(st);
    btn = el('button', {id: 'fb-btn', type: 'button', 'aria-label': t('btn'), title: t('btn') + ' (F8)', 'data-html2canvas-ignore': 'true'}, '🐞');
    userPos = loadPos();
    document.body.appendChild(btn);
    var down = null;
    btn.addEventListener('pointerdown', function (e) {
      down = {x: e.clientX, y: e.clientY, l: btn.offsetLeft, t: btn.offsetTop, moved: false, id: e.pointerId};
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
    });
    btn.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== down.id) return;
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.moved && dx * dx + dy * dy < 64) return;
      down.moved = true; btn.classList.add('drag'); setXY(down.l + dx, down.t + dy);
    });
    function up(e) {
      if (!down) return; var d = down; down = null;
      try { btn.releasePointerCapture(e.pointerId); } catch (err) {}
      if (d.moved) {
        btn.classList.remove('drag'); btn._drag = Date.now();
        userPos = [(btn.offsetLeft + 18) / innerWidth, (btn.offsetTop + 18) / innerHeight]; savePos(userPos);
      }
    }
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
    btn.addEventListener('click', function (e) { e.preventDefault(); if (btn._drag && Date.now() - btn._drag < 400) return; open(); });
    btn.addEventListener('keydown', function (e) { e.stopPropagation(); }); btn.addEventListener('keyup', function (e) { e.stopPropagation(); });
    shield(btn);
    place(); placeSoon(600); setTimeout(place, 2000);
    window.addEventListener('resize', function () { placeSoon(80); });
    document.addEventListener('click', function () { placeSoon(450); }, true);
    window.addEventListener('storage', function (e) { if (e.key === 'annabelle-lang' && btn) { btn.setAttribute('aria-label', t('btn')); btn.title = t('btn') + ' (F8)'; } });
  }

  /* ---------- the dialog ---------- */
  var ctx = null;                         // everything gathered before the dialog opened
  function open() {
    if (opening || dlg) return; opening = true;
    makeButton();
    var steps = []; try { steps = K.trail ? K.trail() : []; } catch (e) {}
    var state = null; try { state = hookState(); } catch (e) {}
    ctx = {steps: steps, hook: state, vw: innerWidth, vh: innerHeight, focus: document.activeElement, shot: null};
    if (btn) { btn.textContent = '⏳'; btn.classList.add('drag'); }
    capture().then(function (c) { ctx.shot = c; }, function () {}).then(function () {
      opening = false;
      if (btn) { btn.textContent = '🐞'; btn.classList.remove('drag'); btn.hidden = true; }
      try { window.dispatchEvent(new Event('blur')); } catch (e) {}       // most games pause themselves on blur
      build();
    });
  }
  var rec = null;                         // {mr, stream, chunks, timer, left}
  function stopTracks() { if (rec && rec.stream) try { rec.stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) {} }
  function close() {
    if (!dlg) return;
    try { if (rec && rec.mr && rec.mr.state !== 'inactive') { rec.cancel = true; rec.mr.stop(); } } catch (e) {}
    stopTracks(); if (rec) clearInterval(rec.timer); rec = null;
    if (dlg._url) try { URL.revokeObjectURL(dlg._url); } catch (e) {}
    clearTimeout(dlg._auto);
    dlg.remove(); dlg = null;
    if (btn) { btn.hidden = false; place(); }
    var f = ctx && ctx.focus; ctx = null;
    try { if (f && f.focus && f !== document.body && document.contains(f)) f.focus(); else if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
  }
  function focusables() { return dlg ? [].slice.call(dlg.querySelectorAll('button,textarea,input,audio[controls]')).filter(function (e) { return !e.disabled && e.offsetParent !== null; }) : []; }
  ['keydown', 'keyup', 'keypress'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (!dlg) {
        if (ev === 'keydown' && e.key === 'F8' && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); open(); }
        return;
      }
      e.stopImmediatePropagation();       // the game underneath must not react; typing still works (default action)
      if (ev !== 'keydown') return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'F8') { e.preventDefault(); return; }
      if (e.key === 'Tab') {
        var f = focusables(); if (!f.length) return;
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey ? i <= 0 : i === f.length - 1 || i < 0) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
      }
    }, true);
  });
  document.addEventListener('focusin', function (e) { if (dlg && !dlg.contains(e.target)) { var f = focusables(); if (f[0]) f[0].focus(); } });

  function build() {
    var L = lang(), rtl = L === 'he';
    dlg = el('div', {id: 'fb-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fb-title', 'data-html2canvas-ignore': 'true'});
    shield(dlg);
    var card = el('div', {'class': 'card', dir: rtl ? 'rtl' : 'ltr', lang: L});
    dlg.appendChild(card);
    dlg.addEventListener('click', function (e) { if (e.target === dlg && !dlg._busy) close(); });
    var h = el('h3'); h.appendChild(el('span', {id: 'fb-title'}, t('title')));
    var x = el('button', {type: 'button', 'class': 'x', 'aria-label': t('close')}, '✕'); x.onclick = close; h.appendChild(x); card.appendChild(h);

    var kind = 'bug', kinds = el('div', {'class': 'kinds', role: 'group', 'aria-label': t('kind')}), kb = {};
    [['bug', '🐞'], ['feature', '💡'], ['fix', '🔧']].forEach(function (k) {
      var b = el('button', {type: 'button', 'data-kind': k[0], 'aria-pressed': k[0] === kind ? 'true' : 'false'});
      b.appendChild(el('span', {'aria-hidden': 'true'}, k[1])); b.appendChild(document.createTextNode(t(k[0])));
      b.onclick = function () { kind = k[0]; for (var n in kb) kb[n].setAttribute('aria-pressed', n === kind ? 'true' : 'false'); };
      kb[k[0]] = b; kinds.appendChild(b);
    });
    card.appendChild(kinds);

    var ta = el('textarea', {id: 'fb-note', maxlength: '2000', rows: '3', placeholder: t('ph'), 'aria-label': t('ph'), dir: 'auto', autocomplete: 'off'});
    card.appendChild(ta);

    /* voice note */
    var audioBlob = null, voice = el('div', {'class': 'row voice'});
    var canRec = false; try { canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.isSecureContext !== false); } catch (e) {}
    var rb = el('button', {type: 'button', 'class': 'soft', id: 'fb-rec'}, t('rec'));
    var player = null, delb = null;
    function recIdle() { rb.textContent = t('rec'); rb.className = 'soft'; rb.hidden = !!audioBlob; }
    function dropAudio() {
      audioBlob = null; if (player) player.remove(); if (delb) delb.remove(); player = delb = null;
      if (dlg && dlg._url) { try { URL.revokeObjectURL(dlg._url); } catch (e) {} dlg._url = null; }
      recIdle(); try { rb.focus(); } catch (e) {}
    }
    function gotAudio(blob) {
      audioBlob = blob; recIdle();
      try { dlg._url = URL.createObjectURL(blob); player = el('audio', {controls: '', preload: 'metadata'}); player.src = dlg._url; voice.appendChild(player); } catch (e) { player = el('span', {}, '🎤 ✓'); voice.appendChild(player); }
      delb = el('button', {type: 'button', 'class': 'soft', 'aria-label': t('delA'), style: 'flex:none'}, '🗑️ ' + t('del')); delb.onclick = dropAudio; voice.appendChild(delb);
      msg.textContent = '';
    }
    function stopRec() { try { if (rec && rec.mr.state !== 'inactive') rec.mr.stop(); } catch (e) {} }
    rb.onclick = function () {
      if (rec) return stopRec();
      rb.disabled = true;
      var p; try { p = navigator.mediaDevices.getUserMedia({audio: true}); } catch (e) { p = Promise.reject(e); }
      p.then(function (stream) {
        rb.disabled = false;
        if (!dlg) { stream.getTracks().forEach(function (tr) { tr.stop(); }); return; }
        var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'], mt = '';
        for (var i = 0; i < types.length; i++) { try { if (MediaRecorder.isTypeSupported(types[i])) { mt = types[i]; break; } } catch (e) {} }
        var mr = new MediaRecorder(stream, mt ? {mimeType: mt, audioBitsPerSecond: 32000} : undefined);
        rec = {mr: mr, stream: stream, chunks: [], left: MAX_SEC, timer: 0};
        var r = rec;
        mr.ondataavailable = function (e) { if (e.data && e.data.size) r.chunks.push(e.data); };
        mr.onstop = function () {
          clearInterval(r.timer); try { stream.getTracks().forEach(function (tr) { tr.stop(); }); } catch (e) {}
          if (rec === r) rec = null;
          if (r.cancel || !dlg) return;
          var type = (mr.mimeType || mt || 'audio/webm').split(';')[0];
          var blob = new Blob(r.chunks, {type: type});
          if (blob.size > 200 && blob.size <= 3 * 1024 * 1024) gotAudio(blob); else recIdle();
        };
        function label() { rb.textContent = t('stop') + ' (' + r.left + ' ' + t('sec') + ')'; }
        rb.className = 'pri'; label();
        r.timer = setInterval(function () { r.left--; if (r.left <= 0) stopRec(); else label(); }, 1000);
        mr.start();
      }, function () { rb.disabled = false; voice.hidden = true; try { ta.focus(); } catch (e) {} });   // no microphone / not allowed: just hide it
    };
    if (canRec) { voice.appendChild(rb); card.appendChild(voice); }

    /* picture */
    var sendShot = !!ctx.shot, shotRow = null;
    if (ctx.shot) {
      shotRow = el('div', {'class': 'row shot'});
      var th = document.createElement('canvas'), k = Math.min(1, 192 / Math.max(ctx.shot.width, ctx.shot.height));
      th.width = Math.max(1, Math.round(ctx.shot.width * k)); th.height = Math.max(1, Math.round(ctx.shot.height * k));
      try { th.getContext('2d').drawImage(ctx.shot, 0, 0, th.width, th.height); } catch (e) {}
      th.setAttribute('role', 'img'); th.setAttribute('aria-label', t('shot'));
      var lb = el('label'), cb = el('input', {type: 'checkbox', id: 'fb-noshot'}), sp = el('span', {}, t('noshot'));
      sp.insertBefore(el('small', {}, t('shot')), sp.firstChild);
      cb.onchange = function () { sendShot = !cb.checked; shotRow.classList.toggle('off', cb.checked); };
      lb.appendChild(cb); lb.appendChild(sp); shotRow.appendChild(th); shotRow.appendChild(lb); card.appendChild(shotRow);
    }

    var msg = el('div', {'class': 'msg', role: 'status', 'aria-live': 'polite'}); card.appendChild(msg);
    var row = el('div', {'class': 'row'}), send = el('button', {type: 'button', 'class': 'pri', id: 'fb-send'}, t('send')), cancel = el('button', {type: 'button', 'class': 'soft', id: 'fb-cancel'}, t('cancel'));
    cancel.onclick = close; row.appendChild(send); row.appendChild(cancel); card.appendChild(row);
    send.onclick = function () {
      if (dlg._busy) return;
      var note = ta.value.replace(/\s+$/, '').slice(0, 2000);
      if (rec) { msg.textContent = t('need'); return; }
      if (!note.trim() && !audioBlob) { msg.textContent = t('need'); try { ta.focus(); } catch (e) {} return; }
      dlg._busy = true; send.disabled = cancel.disabled = x.disabled = true; msg.style.color = '#7a5a3a'; msg.textContent = t('sending');
      submit({kind: kind, note: note, audio: audioBlob, shot: sendShot ? ctx.shot : null, hadShot: !!ctx.shot}).then(function (res) {
        if (!dlg) return;
        dlg._busy = false;
        if (res.fail) { send.disabled = cancel.disabled = x.disabled = false; msg.style.color = ''; msg.textContent = t('fail'); return; }
        thanks(card, res);
      });
    };
    document.body.appendChild(dlg);
    try { kb.bug.focus(); } catch (e) {}
  }
  function thanks(card, res) {
    while (card.firstChild) card.removeChild(card.firstChild);
    var box = el('div', {'class': 'thanks', role: 'status', 'aria-live': 'polite'});
    box.appendChild(el('div', {'class': 'big', id: 'fb-title'}, t('thanks')));
    box.appendChild(el('div', {}, res.queued ? t('queued') : t('got')));
    box.appendChild(el('div', {style: 'font-size:13px;opacity:.8'}, t('id')));
    box.appendChild(el('div', {'class': 'rid', id: 'fb-rid'}, res.rid));
    var b = el('button', {type: 'button', 'class': 'pri', style: 'min-width:140px'}, t('close')); b.onclick = close; box.appendChild(b);
    card.appendChild(box);
    try { b.focus(); } catch (e) {}
    dlg._auto = setTimeout(close, 12000);
  }

  /* ---------- sending ---------- */
  function trimSteps(steps, max) {
    steps = (steps || []).slice(-80);
    while (steps.length > 1 && bytes(JSON.stringify(steps)) > max) steps.shift();
    return steps;
  }
  function submit(o) {
    var S = tel(), b = S.base(), rid = rnd(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    var d = new Date(), day = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2), tail = rid + '-' + rnd(8, 'abcdefghijklmnopqrstuvwxyz0123456789');
    var pwa = false; try { pwa = !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches); } catch (e) {}
    var state = {rid: rid, shot: o.shot ? 'sent' : o.hadShot ? 'withheld' : 'none', voice: !!o.audio, online: navigator.onLine !== false, pwa: pwa,
      scroll: Math.round(window.pageYOffset || 0), tel: !(K.telemetryOn && !K.telemetryOn()), hook: ctx && ctx.hook || null};
    var row = {kid: b.kid, device: b.device, sess: b.sess, kind: o.kind, note: o.note || null, client_ts: new Date().toISOString(), page: b.page,
      url: S.cleanUrl(location.href), ua: String(navigator.userAgent || '').slice(0, 300), viewport: ((ctx ? ctx.vw : innerWidth) + 'x' + (ctx ? ctx.vh : innerHeight) + '@' + (Math.round((window.devicePixelRatio || 1) * 100) / 100)).slice(0, 40),
      lang: b.lang, age: b.age, gender: b.gender, ver: (S.version ? S.version() : b.ver) || 'dev', env: S.env || (navigator.webdriver ? 'qa' : 'prod'), steps: trimSteps(ctx && ctx.steps, 24000), state: state, screenshot_path: null, audio_path: null};
    function later() {
      row.screenshot_path = row.audio_path = null; row.state.shot = o.hadShot ? 'offline' : 'none'; row.state.voice = false; row.state.queued = true;
      row.steps = trimSteps(row.steps, 12000);
      S.enqueue('reports', row, true);
      return {rid: rid, queued: true};
    }
    if (navigator.onLine === false) {
      if (!row.note && o.audio) row.note = '(voice note recorded while offline: not kept)';
      return Promise.resolve(later());
    }
    var ups = [];
    if (o.shot) ups.push(toJpeg(o.shot).then(function (blob) {
      if (!blob) { row.state.shot = 'failed'; return; }
      var p = 'shot/' + day + '/' + tail + '.jpg';
      return S.upload(p, blob, 'image/jpeg').then(function (r) { if (r.ok) row.screenshot_path = p; else row.state.shot = 'upload ' + r.status; });
    }).catch(function () { row.state.shot = 'failed'; }));
    if (o.audio) {
      var type = (o.audio.type || 'audio/webm').split(';')[0]; if (!/^audio\/(webm|mp4|ogg)$/.test(type)) type = 'audio/webm';
      var p2 = 'voice/' + day + '/' + tail + '.' + type.split('/')[1];
      ups.push(S.upload(p2, o.audio, type).then(function (r) { if (r.ok) row.audio_path = p2; else row.state.voice = 'upload ' + r.status; }).catch(function () {}));
    }
    return Promise.all(ups).then(function () {
      if (!row.note && o.audio && !row.audio_path) row.note = '(voice note could not be uploaded)';
      return S.post('reports', row);
    }).then(function (res) {
      if (res.ok) return res;
      if (res.net) return res;
      row.steps = trimSteps(row.steps, 6000).slice(-20); row.state = {rid: rid, shot: row.state.shot, voice: row.state.voice, trimmed: res.status};   // rejected (too big?): once more, lighter
      return S.post('reports', row);
    }).then(function (res) {
      var out;
      if (res.ok) out = {rid: rid};
      else if (res.net) out = later();
      else return {fail: true};
      try { if (K.audit) K.audit('report_sent', rid, {kind: o.kind, shot: !!row.screenshot_path, voice: !!row.audio_path, queued: !!out.queued}, 'kid'); if (K._tel && !out.queued) K._tel.flush(); } catch (e) {}
      return out;
    }).catch(function () { return {fail: true}; });
  }

  K.report = open;
  function init() { makeButton(); try { var S = tel(); if (S.fallback) setTimeout(function () { S.flush(); }, 3000); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

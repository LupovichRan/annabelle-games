/* Annabelle games – shared daily play-time limit + parent controls.
   Injected into every page by pwa/build.py (sync, early in <head> so it can wrap AudioContext / rAF).
   Storage (localStorage, per device + per browser):
     annabelle-playtime = {date, seconds, extra, last, w5, w1}   today's counted seconds (resets at local midnight)
     annabelle-parent   = {limit, pin:{a,s,h}, lock, bed:{on,from,to}, skip, fails, wait}   only a salted hash of the PIN */
(function () {
  'use strict';
  if (window.AnnabellePlaytime) return;
  // Respect the OS "reduce motion" setting on every page: decorative CSS loops stop and transitions are instant
  // (events such as animationend still fire, so game logic is unaffected).
  try {
    var rm = document.createElement('style');
    rm.textContent = '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}';
    (document.head || document.documentElement).appendChild(rm);
  } catch (e) {}
  var DEFAULT_LIMIT_MIN = 55;               // <- the daily limit (minutes); parent can change it in the panel
  var MIN_LIMIT = 15, MAX_LIMIT = 180, STEP = 5, BONUS_MIN = 15;
  var WARN = [300, 60];                      // warn at 5 min and 1 min left
  var KP = 'annabelle-playtime', KPAR = 'annabelle-parent';
  var me = document.currentScript;
  var IS_LAUNCHER = !!(me && me.dataset.app === 'launcher') || /(^|\/)(index\.html)?$/.test(location.pathname);

  // repair: an early version of the player-profiles feature could move the parent settings into a profile snapshot
  try {
    if (!localStorage.getItem('annabelle-parent')) {
      var pm = JSON.parse(localStorage.getItem('annabelle-profiles') || 'null');
      if (pm && Array.isArray(pm.list)) for (var pi = 0; pi < pm.list.length; pi++) {
        var pd = JSON.parse(localStorage.getItem('annabelle-profdata-' + pm.list[pi].id) || 'null');
        if (pd && typeof pd['annabelle-parent'] === 'string' && pd['annabelle-parent']) { localStorage.setItem('annabelle-parent', pd['annabelle-parent']); break; }
      }
    }
  } catch (e) {}
  function rd(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === 'object' ? v : d; } catch (e) { return d; } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function play() { var s = rd(KP, null); if (!s || s.date !== today()) s = {date: today(), seconds: 0, extra: 0, last: 0}; return s; }
  function par() { var p = rd(KPAR, {}); if (!(p.limit >= MIN_LIMIT && p.limit <= MAX_LIMIT)) p.limit = DEFAULT_LIMIT_MIN; if (!p.bed) p.bed = {on: false, from: '20:30', to: '07:00'}; return p; }
  function limitSec(s, p) { return p.limit * 60 + (s.extra || 0); }
  function left(s, p) { s = s || play(); p = p || par(); return Math.max(0, limitSec(s, p) - s.seconds); }
  function hm(t) { var a = String(t || '').split(':'); return (+a[0] || 0) * 60 + (+a[1] || 0); }
  function bedInfo(p, now) {           // {in:bool, end:ms}
    now = now || new Date(); if (!p.bed || !p.bed.on) return {in: false};
    var f = hm(p.bed.from), t = hm(p.bed.to), n = now.getHours() * 60 + now.getMinutes(), inside;
    if (f === t) return {in: false};
    inside = f < t ? (n >= f && n < t) : (n >= f || n < t);
    if (!inside) return {in: false};
    var end = new Date(now); end.setHours(Math.floor(t / 60), t % 60, 0, 0); if (end <= now) end.setDate(end.getDate() + 1);
    return {in: true, end: +end};
  }
  function lockReason() {
    var p = par(), s = play();
    if (p.lock) return 'parent';
    var b = bedInfo(p); if (b.in && !(p.skip && p.skip > Date.now())) return 'bed';
    if (left(s, p) <= 0) return 'time';
    return '';
  }

  /* ---------- texts ---------- */
  var T = {
    he: {left: 'נשארו', min: 'דק׳', w5: 'עוד 5 דקות נגמר זמן המשחק להיום – כדאי לסיים בקרוב! 🐱', w1: 'נשארה דקה אחת! זמן להגיד לילה טוב למשחק 🦁',
      time: ['זמן המשחק להיום נגמר!', 'כל הכבוד ששיחקת! בואי נחזור מחר 🌙'], bed: ['שעת שינה!', 'גם האריה הולך לישון. לילה טוב, נתראה מחר 🌙'], parent: ['המשחקים נעולים כרגע', 'ההורים נעלו את המשחקים. תשאלי אותם 💛'],
      parentLink: 'הורים', panel: 'פאנל הורים', played: 'שוחק היום', of: 'מתוך', limit: 'מגבלה יומית', plus: '+15 דק׳ להיום', reset: 'איפוס היום',
      lock: '🔒 לנעול עכשיו', unlock: '🔓 לפתוח נעילה', bedtime: 'שעת שינה', on: 'פעיל', off: 'כבוי', from: 'מ־', to: 'עד', chpin: 'שינוי קוד', close: 'סגירה',
      create: 'יצירת קוד הורים (4 ספרות)', confirm: 'הקלידו שוב את הקוד', enter: 'קוד הורים', mismatch: 'הקודים לא תואמים, נסו שוב', wrong: 'קוד שגוי', wait: 'יותר מדי ניסיונות. נסו שוב בעוד', sec: 'שנ׳',
      forgot: 'שכחתי את הקוד', math: 'שאלת הורים', check: 'בדיקה', newpin: 'הגדרת קוד חדש', saved: 'נשמר ✓', back: 'חזרה'}
  };
  function L() { return 'he'; }
  function t(k) { return T[L()][k]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }

  /* ---------- freeze the game while locked: audio, animation frames, input ---------- */
  var locked = false, ctxs = [], held = [], streams = [], stoppedStreams = false;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    var origResume = AC.prototype.resume;
    var W = function () { var c = new (Function.prototype.bind.apply(AC, [null].concat([].slice.call(arguments))))(); ctxs.push(c);
      c.resume = function () { return locked ? Promise.resolve() : origResume.call(c); }; if (locked) try { c.suspend(); } catch (e) {} return c; };
    W.prototype = AC.prototype;
    try { if (window.AudioContext) window.AudioContext = W; if (window.webkitAudioContext) window.webkitAudioContext = W; } catch (e) {}
  }
  var raf = window.requestAnimationFrame && window.requestAnimationFrame.bind(window);
  if (raf) window.requestAnimationFrame = function (cb) { if (locked) { held.push(cb); return -held.length; } return raf(cb); };
  var md = navigator.mediaDevices;
  if (md && md.getUserMedia) { var gum = md.getUserMedia.bind(md); md.getUserMedia = function (c) { return gum(c).then(function (s) { streams.push(s); return s; }); }; }
  ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchmove', 'touchend', 'wheel', 'contextmenu'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (!locked) return;
      var inUI = e.target && e.target.closest && e.target.closest('#pt-lock,#pt-panel');
      if (inUI) return;
      e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault();
    }, {capture: true, passive: false});
  });
  function freeze() {
    ctxs.forEach(function (c) { try { c.suspend(); } catch (e) {} });
    document.querySelectorAll('audio,video').forEach(function (m) { try { if (!m.paused) { m.pause(); m.dataset.ptPaused = '1'; } } catch (e) {} });
    streams.forEach(function (s) { s.getTracks().forEach(function (tr) { if (tr.readyState === 'live') { tr.stop(); stoppedStreams = true; } }); });
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function unfreeze() {
    if (stoppedStreams) { location.reload(); return; }        // camera games restart cleanly
    ctxs.forEach(function (c) { try { origResume.call(c); } catch (e) {} });
    document.querySelectorAll('[data-pt-paused]').forEach(function (m) { delete m.dataset.ptPaused; try { m.play(); } catch (e) {} });
    var h = held; held = []; h.forEach(function (cb) { raf(cb); });
  }

  /* ---------- UI ---------- */
  // first: undo any game-wide styles (button{}, div{}, h2{}…) leaking into our UI; our own rules below win again
  var css = '#pt-panel :is(div,span,button,input,b,i,h3),#pt-lock :is(div,span,button,h2,p){all:revert;box-sizing:border-box}' +
    '#pt-badge{position:fixed;z-index:2147483000;left:calc(6px + env(safe-area-inset-left));bottom:calc(6px + env(safe-area-inset-bottom));font:700 11px/1 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:#5a3b1a;background:rgba(255,248,230,.82);border:1.5px solid rgba(232,134,45,.55);border-radius:999px;padding:3px 6px;pointer-events:none;direction:ltr;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.15);opacity:.85;transition:background .3s,translate .45s ease}' +
    '#pt-badge.tuck{translate:calc(-100% - 14px) 0}#pt-badge.tuck[data-at*=r]{translate:calc(100% + 14px) 0}' +
    '#pt-badge.low{background:#ffe1d6;color:#b3261e;border-color:#ff7a59;opacity:1}' +
    '#pt-badge.launch{position:absolute;top:calc(6px + env(safe-area-inset-top));bottom:auto;pointer-events:auto;cursor:pointer;min-height:44px;padding:4px 12px;display:flex;align-items:center;font-size:13px;opacity:.95}' +
    '#pt-toast{position:fixed;z-index:2147483100;left:50%;top:calc(10px + env(safe-area-inset-top));transform:translate(-50%,-140%);max-width:min(92vw,460px);background:#fff8e6;color:#5a3b1a;border:3px solid #ffb84d;border-radius:18px;padding:10px 14px;font:700 16px/1.3 system-ui,-apple-system,Arial,sans-serif;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:transform .45s cubic-bezier(.2,1.4,.4,1);pointer-events:none}' +
    '#pt-toast.show{transform:translate(-50%,0)}' +
    '#pt-lock{position:fixed;inset:0;z-index:2147483200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:16px;box-sizing:border-box;background:radial-gradient(circle at 50% 30%,#3b3f8f,#1d1f4a 70%);color:#fff;text-align:center;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}' +
    '#pt-lock svg.ptlion{width:min(62vw,42vh,300px);height:auto}' +
    '#pt-lock h2{margin:0;font-size:clamp(22px,6.5vw,34px);color:#ffe08a}#pt-lock p{margin:0;font-size:clamp(15px,4.4vw,20px);max-width:520px}' +
    '#pt-lock .other{font-size:13px;opacity:.7;line-height:1.4;margin-top:6px}' +
    '#pt-lock .star{position:absolute;color:#fff6c2;animation:pttw 2.4s ease-in-out infinite}@keyframes pttw{50%{opacity:.25}}' +
    '#pt-lock .z{animation:ptz 2.6s ease-in-out infinite;transform-box:fill-box}@keyframes ptz{0%{opacity:0;transform:translate(0,6px)}40%{opacity:1}100%{opacity:0;transform:translate(10px,-18px)}}' +
    '#pt-lock .breath{animation:ptb 3.2s ease-in-out infinite;transform-origin:50% 100%;transform-box:fill-box}@keyframes ptb{50%{transform:scaleY(1.035)}}' +
    '#pt-plink{position:absolute;bottom:calc(10px + env(safe-area-inset-bottom));right:12px;background:none;border:0;color:rgba(255,255,255,.55);font:600 13px system-ui,Arial,sans-serif;padding:10px 8px;min-height:44px;cursor:pointer;text-decoration:underline}' +
    '#pt-panel{position:fixed;inset:0;z-index:2147483300;display:flex;align-items:center;justify-content:center;background:rgba(20,16,40,.6);font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;touch-action:manipulation}' +
    '#pt-panel .card{background:#fffaf0;color:#3a2a17;border-radius:22px;padding:12px 14px;width:min(94vw,420px);max-height:96dvh;overflow:auto;box-sizing:border-box;box-shadow:0 10px 40px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:8px}' +
    '#pt-panel h3{margin:0;font-size:19px;display:flex;align-items:center;justify-content:space-between;gap:8px}' +
    '#pt-panel button{font:700 16px system-ui,-apple-system,Arial,sans-serif;min-height:46px;border-radius:14px;border:0;background:#ffd6a0;color:#3a2a17;cursor:pointer;padding:6px 10px}' +
    '#pt-panel button:active{transform:scale(.97)}#pt-panel button.pri{background:#ff9f43;color:#fff}#pt-panel button.dark{background:#4b3f8f;color:#fff}#pt-panel button.soft{background:#efe6d8}' +
    '#pt-panel button.x{min-height:44px;min-width:44px;background:#efe6d8;font-size:18px}' +
    '#pt-panel .row{display:flex;gap:8px;align-items:center}#pt-panel .row>*{flex:1}#pt-panel .lbl{flex:1.2;font-weight:700;font-size:15px}' +
    '#pt-panel .ptbig{font-size:22px;font-weight:800;text-align:center}#pt-panel .stat{background:#fff0d6;border-radius:14px;padding:8px;text-align:center;font-size:15px}#pt-panel .stat b{font-size:22px}' +
    '#pt-panel input[type=time]{font:700 16px system-ui,Arial,sans-serif;min-height:44px;border-radius:12px;border:2px solid #e8c79a;padding:0 4px;background:#fff;min-width:0;width:100%;box-sizing:border-box}' +
    '#pt-panel input[type=number]{font:800 24px system-ui,Arial,sans-serif;min-height:48px;border-radius:12px;border:2px solid #e8c79a;text-align:center;width:100%;box-sizing:border-box}' +
    '#pt-panel .dots{display:flex;gap:14px;justify-content:center;direction:ltr;margin:4px 0}#pt-panel .dots i{width:18px;height:18px;border-radius:50%;border:3px solid #ff9f43}#pt-panel .dots i.f{background:#ff9f43}' +
    '#pt-panel .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;direction:ltr}#pt-panel .pad button{font-size:24px;min-height:54px;background:#fff0d6}' +
    '#pt-panel .msg{min-height:20px;text-align:center;font-weight:700;color:#b3261e;font-size:14px}#pt-panel .msg.ok{color:#2e7d32}' +
    '#pt-panel .link{background:none;min-height:44px;text-decoration:underline;color:#7a5a3a;font-size:14px}';

  var badge, toast, lockEl, panelEl, toastTimer;
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function dir() { return 'rtl'; }
  function setupUI() {
    if (badge) return;
    document.head.appendChild(el('style', {id: 'pt-style'}, css));
    badge = el('div', {id: 'pt-badge', role: IS_LAUNCHER ? 'button' : 'status', 'aria-live': 'off'});
    if (IS_LAUNCHER) { badge.className = 'launch'; badge.addEventListener('click', function () { openPanel(); }); }
    toast = el('div', {id: 'pt-toast', role: 'alert'});
    document.body.appendChild(badge); document.body.appendChild(toast);
    render();
  }
  function fmtLeft(sec) { var m = Math.ceil(sec / 60); return sec < 60 && sec > 0 ? sec + '″' : m + '′'; }
  // Auto-place the badge in a corner/edge that covers no button. A page may force one via
  // <script src="playtime.js" data-pos="tr|tl|br|bl"> (tried first).
  var POS = {bl: ['left', 'bottom'], br: ['right', 'bottom'], tl: ['left', 'top'], tr: ['right', 'top'], ml: ['left', 50], mr: ['right', 50], ml2: ['left', 35], mr2: ['right', 35], ml3: ['left', 65], mr3: ['right', 65], ml4: ['left', 22], mr4: ['right', 22], ml5: ['left', 78], mr5: ['right', 78]};
  function placeBadge() {
    if (!badge || IS_LAUNCHER || badge.style.display === 'none') return;
    var pref = (me && me.getAttribute('data-pos')) || '';
    var order = (pref ? [pref] : []).concat(['bl', 'br', 'tl', 'tr', 'ml', 'mr', 'ml2', 'mr2', 'ml3', 'mr3', 'ml4', 'mr4', 'ml5', 'mr5']);
    var hits = [].slice.call(document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[onclick],.btn,.act')).filter(function (e) {
      if (e === badge || badge.contains(e)) return false; var r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
      var cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.opacity !== '0';
    }).map(function (e) { return e.getBoundingClientRect(); });
    var tk = badge.classList.contains('tuck'); badge.style.transition = 'none'; badge.classList.remove('tuck');
    try { for (var i = 0; i < order.length; i++) {
      var p = POS[order[i]]; if (!p) continue; var st = badge.style;
      st.left = st.right = st.top = st.bottom = st.transform = '';
      if (p[0] === 'right') { st.left = 'auto'; st.right = 'calc(6px + env(safe-area-inset-right))'; }
      if (p[1] === 'top') { st.bottom = 'auto'; st.top = 'calc(6px + env(safe-area-inset-top))'; }
      if (typeof p[1] === 'number') { st.bottom = 'auto'; st.top = p[1] + '%'; st.transform = 'translateY(-50%)'; }
      var b = badge.getBoundingClientRect(), ok = true;
      for (var j = 0; j < hits.length; j++) { var r = hits[j]; if (r.left < b.right + 3 && r.right > b.left - 3 && r.top < b.bottom + 3 && r.bottom > b.top - 3) { ok = false; break; } }
      if (ok) { badge.setAttribute('data-at', order[i]); return; }
    }
    badge.setAttribute('data-at', 'none');
    } finally { if (tk) badge.classList.add('tuck'); badge.getBoundingClientRect(); badge.style.transition = ''; }
  }
  window.addEventListener('resize', function () { setTimeout(function () { if (badge && !badge.classList.contains('tuck')) placeBadge(); }, 50); });
  document.addEventListener('click', function () { setTimeout(function () { if (badge && !badge.classList.contains('tuck')) placeBadge(); }, 400); }, true);
  function renderBadge() {
    if (!badge) return; var s = play(), p = par(), l = left(s, p);
    badge.textContent = '⏰ ' + fmtLeft(l) + (IS_LAUNCHER ? ' ⚙️' : '');
    badge.title = t('left') + ' ' + Math.ceil(l / 60) + ' ' + t('min');
    badge.setAttribute('aria-label', badge.title);
    badge.classList.toggle('low', l <= 300);
    badge.style.display = locked ? 'none' : '';
    if (IS_LAUNCHER || !badge.classList.contains('tuck')) placeBadge();
    if (IS_LAUNCHER) return;
    // Hidden off the side; peeks in for ~5s each time another 10 min of play passes.
    var step = Math.floor((s.seconds || 0) / 600);
    if (peekStep < 0) peekStep = step;
    if (step > peekStep && !locked) { peekStep = step; placeBadge(); badge.classList.remove('tuck'); clearTimeout(peekT); peekT = setTimeout(function () { badge.classList.add('tuck'); }, 5000); }
    else if (!peekT) badge.classList.add('tuck');
  }
  var peekStep = -1, peekT = 0;
  function showToast(msg) {
    if (!toast) return; toast.textContent = msg; toast.dir = dir(); toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 6000);
    try { var c = new (AC)(); var o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = 0.0001;
      o.connect(g); g.connect(c.destination); var n = c.currentTime;
      if (!(localStorage.getItem('annabelle-muted') === '1' || localStorage.getItem('annabelle-muted') === 'true')) { g.gain.setValueAtTime(0.08, n); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.5); o.frequency.setValueAtTime(660, n); o.frequency.setValueAtTime(880, n + 0.15); }
      o.start(); o.stop(n + 0.55); setTimeout(function () { try { c.close(); } catch (e) {} }, 900); } catch (e) {}
  }
  var LION = '<svg class="ptlion" viewBox="0 0 300 220" aria-hidden="true">' +
    '<ellipse cx="150" cy="200" rx="130" ry="14" fill="rgba(0,0,0,.25)"/>' +
    '<path d="M60 195 Q40 180 30 160 Q22 140 44 150" fill="none" stroke="#e8a43a" stroke-width="10" stroke-linecap="round"/><circle cx="40" cy="150" r="9" fill="#9a5a1a"/>' +
    '<g class="breath"><ellipse cx="160" cy="165" rx="95" ry="38" fill="#f2b34d"/>' +
    '<ellipse cx="110" cy="190" rx="26" ry="11" fill="#f2b34d"/><ellipse cx="205" cy="192" rx="26" ry="11" fill="#f2b34d"/></g>' +
    '<g><circle cx="215" cy="140" r="58" fill="#b8651f"/>' + (function () { var s = ''; for (var i = 0; i < 14; i++) { var a = i / 14 * Math.PI * 2; s += '<circle cx="' + (215 + Math.cos(a) * 52).toFixed(1) + '" cy="' + (140 + Math.sin(a) * 52).toFixed(1) + '" r="16" fill="#c9752a"/>'; } return s; })() +
    '<circle cx="215" cy="145" r="40" fill="#f6c560"/><circle cx="185" cy="112" r="10" fill="#f6c560"/><circle cx="245" cy="112" r="10" fill="#f6c560"/><circle cx="185" cy="112" r="5" fill="#e89a8a"/><circle cx="245" cy="112" r="5" fill="#e89a8a"/>' +
    '<path d="M196 140 q8 7 16 0 M220 140 q8 7 16 0" fill="none" stroke="#5a3010" stroke-width="3.5" stroke-linecap="round"/>' +
    '<ellipse cx="216" cy="156" rx="9" ry="6" fill="#8a4a2a"/><path d="M216 162 v6 M216 168 q-7 6 -13 1 M216 168 q7 6 13 1" fill="none" stroke="#5a3010" stroke-width="2.5" stroke-linecap="round"/>' +
    '<circle cx="193" cy="158" r="7" fill="#ff9fa0" opacity=".6"/><circle cx="239" cy="158" r="7" fill="#ff9fa0" opacity=".6"/>' +
    '<path d="M160 82 l12 -18 l6 14 l12 -16" fill="none" stroke="#ff6b8a" stroke-width="0"/>' +
    '<path d="M168 92 q-6 -26 22 -36 q30 -8 44 14" fill="#4b6bd6"/><circle cx="236" cy="72" r="7" fill="#fff"/></g>' +
    '<text class="z" x="262" y="78" font-size="22" font-weight="800" fill="#cfe0ff">z</text><text class="z" x="276" y="56" font-size="28" font-weight="800" fill="#e6efff" style="animation-delay:.8s">Z</text><text class="z" x="250" y="40" font-size="18" font-weight="800" fill="#fff" style="animation-delay:1.6s">z</text>' +
    '</svg>';
  function renderLock(reason) {
    if (!lockEl) {
      lockEl = el('div', {id: 'pt-lock', role: 'dialog', 'aria-modal': 'true'});
      document.body.appendChild(lockEl);
    }
    var l = L();
    var stars = ''; for (var i = 0; i < 14; i++) stars += '<span class="star" style="left:' + ((i * 37) % 97) + '%;top:' + ((i * 23) % 45) + '%;font-size:' + (8 + (i % 3) * 5) + 'px;animation-delay:' + (i % 5) * .4 + 's">✦</span>';
    var key = reason === 'bed' ? 'bed' : reason === 'parent' ? 'parent' : 'time';
    lockEl.innerHTML = stars + '<div dir="' + dir() + '" style="display:flex;flex-direction:column;align-items:center;gap:8px">' + LION +
      '<h2>' + esc(T[l][key][0]) + '</h2><p>' + esc(T[l][key][1]) + '</p>' + '</div>' +
      '<button id="pt-plink" type="button">🔒 ' + esc(t('parentLink')) + '</button>';
    lockEl.dataset.reason = reason;
    lockEl.querySelector('#pt-plink').addEventListener('click', function (e) { e.stopPropagation(); openPanel(); });
  }
  function applyLock() {
    var r = lockReason(), want = !!r;
    if (want && !locked) { locked = true; freeze(); }
    if (want) { if (!lockEl || lockEl.dataset.reason !== r || lockEl.dataset.lang !== L()) { renderLock(r); lockEl.dataset.lang = L(); } }
    else if (locked) { locked = false; if (lockEl) { lockEl.remove(); lockEl = null; } unfreeze(); }
    renderBadge();
  }
  function render() { applyLock(); }

  /* ---------- counting ---------- */
  function tick() {
    var s = play(), p = par(), now = Date.now();
    if (document.visibilityState === 'visible' && !locked && !lockReason()) {
      // one shared counter for all tabs/pages: only count if no other page ticked in the last ~0.9s
      if (!s.last || now - s.last >= 900 || now < s.last) { s.seconds += 1; s.last = now; }
      var l = left(s, p);
      WARN.forEach(function (w, i) {
        var f = i ? 'w1' : 'w5';
        if (l <= w && l > 0 && !s[f] && limitSec(s, p) > w) { s[f] = 1; if (i === 0) s.w5 = 1; showToast(t(f)); }
      });
      wr(KP, s);
    } else if (s.date !== (rd(KP, {}).date)) wr(KP, s);       // midnight rollover
    if (p.skip && p.skip < now) { delete p.skip; wr(KPAR, p); }
    render();
  }
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') render(); });
  window.addEventListener('storage', function (e) { if (e.key === KP || e.key === KPAR || e.key === 'annabelle-lang') render(); });
  window.addEventListener('pageshow', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupUI); else setupUI();

  /* ---------- parent PIN (salted SHA-256; only the hash is stored) ---------- */
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function fnv(str) { var h = 0x811c9dc5; for (var r = 0; r < 5000; r++) for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
  function hashPin(pin, salt) {
    var str = 'annabelle|' + salt + '|' + pin;
    if (window.crypto && crypto.subtle && window.TextEncoder) return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) { return {a: 'sha256', h: hex(b)}; });
    return Promise.resolve({a: 'fnv', h: fnv(str)});
  }
  function verifyPin(pin) {
    var p = par(); if (!p.pin) return Promise.resolve(false);
    var str = 'annabelle|' + p.pin.s + '|' + pin;
    if (p.pin.a === 'fnv') return Promise.resolve(fnv(str) === p.pin.h);
    if (!(window.crypto && crypto.subtle)) return Promise.resolve(false);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (b) { return hex(b) === p.pin.h; });
  }
  function savePin(pin) {
    var salt = ''; try { var a = new Uint8Array(12); crypto.getRandomValues(a); salt = hex(a); } catch (e) { salt = String(Math.random()).slice(2); }
    return hashPin(pin, salt).then(function (r) { var p = par(); p.pin = {a: r.a, s: salt, h: r.h}; p.fails = 0; delete p.wait; wr(KPAR, p); });
  }

  /* ---------- parent panel ---------- */
  // who-did-what log (telemetry.js; a no-op when it is missing or switched off). Never contains the PIN.
  function aud(action, target, detail) { try { if (window.KidApp && KidApp.audit) KidApp.audit(action, target, detail || {}, 'parent'); } catch (e) {} }
  var authed = false, waitTimer;
  function closePanel() { if (panelEl) { panelEl.remove(); panelEl = null; } authed = false; clearInterval(waitTimer); render(); }
  function shell(title, body) {
    if (!panelEl) { panelEl = el('div', {id: 'pt-panel', role: 'dialog', 'aria-modal': 'true'}); document.body.appendChild(panelEl);
      panelEl.addEventListener('click', function (e) { if (e.target === panelEl) closePanel(); }); }
    panelEl.innerHTML = '<div class="card" dir="' + dir() + '"><h3><span>' + title + '</span><button class="x" data-a="close" aria-label="' + esc(t('close')) + '">✕</button></h3>' + body + '</div>';
    panelEl.querySelector('[data-a=close]').onclick = closePanel;
    return panelEl.querySelector('.card');
  }
  function openPanel() { if (!document.body) return; if (authed) return showPanel(); if (!par().pin) return pinPad('create'); pinPad('enter'); }
  function pinPad(mode, first) {
    var title = mode === 'create' ? t('create') : mode === 'confirm' ? t('confirm') : t('enter');
    var keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'];
    var card = shell('🔐 ' + esc(title), '<div class="dots"><i></i><i></i><i></i><i></i></div><div class="msg"></div>' +
      '<div class="pad">' + keys.map(function (k) { return '<button type="button" data-k="' + k + '">' + k + '</button>'; }).join('') + '</div>' +
      (mode === 'enter' ? '<button type="button" class="link" data-a="forgot">' + esc(t('forgot')) + '</button>' : ''));
    var v = '', msg = card.querySelector('.msg'), dots = card.querySelectorAll('.dots i'), busy = false;
    function show() { dots.forEach(function (d, i) { d.classList.toggle('f', i < v.length); }); }
    function waiting() {
      var p = par(), w = (p.wait || 0) - Date.now();
      if (w > 0) { msg.textContent = t('wait') + ' ' + Math.ceil(w / 1000) + ' ' + t('sec'); return true; }
      if (p.wait) { delete p.wait; wr(KPAR, p); msg.textContent = ''; }
      return false;
    }
    if (mode === 'enter') { waiting(); clearInterval(waitTimer); waitTimer = setInterval(function () { if (panelEl && card.isConnected) waiting(); else clearInterval(waitTimer); }, 500); }
    function submit() {
      if (v.length !== 4 || busy) return;
      if (mode === 'create') return pinPad('confirm', v);
      if (mode === 'confirm') { if (v !== first) { pinPad('create'); panelEl.querySelector('.msg').textContent = t('mismatch'); return; }
        busy = true; var hadPin = !!par().pin; return savePin(v).then(function () { aud(hadPin ? 'pin_changed' : 'pin_set', 'parent-pin'); if (!authed) aud('panel_opened', 'parent-panel', {via: 'new-pin'}); authed = true; showPanel(t('saved')); }); }
      if (waiting()) { v = ''; show(); return; }
      busy = true;
      verifyPin(v).then(function (ok) {
        busy = false; var p = par();
        if (ok) { p.fails = 0; delete p.wait; wr(KPAR, p); authed = true; aud('panel_opened', 'parent-panel', {via: 'pin'}); showPanel(); return; }
        p.fails = (p.fails || 0) + 1; if (p.fails >= 3) { p.fails = 0; p.wait = Date.now() + 60000; }
        wr(KPAR, p); v = ''; show(); if (!waiting()) msg.textContent = t('wrong');
        card.animate && card.animate([{transform: 'translateX(-8px)'}, {transform: 'translateX(8px)'}, {transform: 'none'}], {duration: 250});
      });
    }
    card.querySelectorAll('[data-k]').forEach(function (b) { b.onclick = function () {
      var k = b.dataset.k; if (k === '⌫') v = v.slice(0, -1); else if (k === '✓') submit(); else if (v.length < 4) { v += k; if (v.length === 4) setTimeout(submit, 120); }
      show(); }; });
    var f = card.querySelector('[data-a=forgot]'); if (f) f.onclick = mathQ;
  }
  function mathQ() {
    var a = 12 + Math.floor(Math.random() * 87), b = 12 + Math.floor(Math.random() * 87);
    var card = shell('🧮 ' + esc(t('math')), '<div class="ptbig" dir="ltr">' + a + ' × ' + b + ' = ?</div><input type="number" inputmode="numeric" autocomplete="off" aria-label="answer"><div class="msg"></div>' +
      '<div class="row"><button type="button" class="soft" data-a="back">' + esc(t('back')) + '</button><button type="button" class="pri" data-a="ok">' + esc(t('check')) + '</button></div>');
    var inp = card.querySelector('input');
    card.querySelector('[data-a=back]').onclick = function () { openPanel(); };
    card.querySelector('[data-a=ok]').onclick = function () {
      if (+inp.value === a * b && inp.value !== '') { authed = true; aud('panel_opened', 'parent-panel', {via: 'math'}); showPanel('', true); }
      else { mathQ(); panelEl.querySelector('.msg').textContent = '✗'; }
    };
  }

  /* ---------- parent: reset progress (all, or only chosen games) ---------- */
  var RG = [['bubbles','🫧','בועות',/^annabelle-bubbles-/],['cats','🐱','חתולים (זוגות)',/^annabelle-cats-/],['checkers','♟️','דמקה',/^annabelle-(checkers-|ck-)/],['cups','🥤','איפה הכדור',/^annabelle-cups-/],
    ['digrod','🎣','חכת השריר',/^annabelle-digrod/],['escape','🏠','בריחה',/^annabelle-escape/],['fishing','🐟','דיג',/^annabelle-fishing-/],['fishy','🐠','דגיגון',/^annabelle-fishy-/],['football','⚽','כדורגל',/^annabelle-football-/],
    ['hiddencats','🔍','חתולים נסתרים',/^annabelle-hiddencats/],['hole','🕳️','החור הרעבתן',/^annabelle-hole-/],['kitchen','🍔','מסעדת החתולים',/^annabelle-kitchen/],['lionking','🦁','מלך האריות',/^annabelle-(lionking-|lion-)/],
    ['magic','🎩','קסם הקלפים',/^annabelle-magic(-|$)/],['magic2','🐾','קסם החתולים',/^annabelle-magic2/],['minesweeper','🌼','מוקשים (גינה)',/^annabelle-minesweeper-/],['pacman','🟡','פקמן',/^annabelle-pacman-/],
    ['runner','🏃','ריצה בסוואנה',/^annabelle-runner-/],['runner3d','🌅','ריצה תלת־ממדית',/^annabelle-runner3d-/],['soya','🐶','סויה',/^soya(?!home)/],['soyahome','🏡','סויה בבית',/^(annabelle-)?soyahome/],
    ['streetcats','🐈','חתולי הרחוב',/^annabelle-streetcats-/],['thunderkittens','⚡','לוחמי הברק',/^annabelle-tk-/],['tictactoe','❌','איקס עיגול',/^annabelle-ttt-/],['towerdefense','🏰','מגדלי הגנה',/^annabelle-td-/],
    ['bowling','🎳','באולינג',/^annabelle-bowling-/],['invaders','🚀','פולשי החלל',/^annabelle-retro-invaders/],['tetris','🧱','טטריס חתולים',/^annabelle-retro-tetris/],['breakout','🐾','שוברת הכלובים',/^annabelle-retro-breakout/],
    ['snake','🐯','זנב הנמר',/^annabelle-retro-snake/],['crossing','🐥','מעבר החיות',/^annabelle-retro-crossing/],
    ['pong','🏓','פינג־פונג כפות',/^annabelle-retro-pong/],['safari','📸','ספארי צילום',/^annabelle-retro-safari/],['simon','🎶','מקהלת החיות',/^annabelle-retro-simon/],
    ['funrun','👟','מרוץ התעלולים',/^annabelle-funrun/],['carrace','🏎️','מרוץ מכוניות החתולים',/^annabelle-carrace/],
    ['mathquest','🧮','מסע החשבון',/^annabelle-mathquest/],['wordcity','🔤','עיר המילים',/^annabelle-wordcity/],['sciencelab','🔬','מעבדת המדע',/^annabelle-sciencelab/],['reading','📖','סולם הקריאה',/^annabelle-reading/],['thinking','🧩','חידות חשיבה',/^annabelle-thinking/],['city','🏙️','עיר החתולים',/^annabelle-city/]];
  var KEEPK = /^annabelle-(lang|muted|music|turn|desk|installed|pwa.*|playtime|parent|launcher|profiles|profdata-.*|device|tq|telemetry)$/;
  function allKeys() { var ks = []; try { for (var i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); } catch (e) {} return ks; }
  function doReset(ids, everything) {
    var ks = allKeys(), rw = rd('annabelle-rewards', null);
    if (everything) {
      ks.forEach(function (k) { if ((/^annabelle-/.test(k) || /^soya/.test(k)) && !KEEPK.test(k)) try { localStorage.removeItem(k); } catch (e) {} });
      return;
    }
    RG.forEach(function (g) {
      if (ids.indexOf(g[0]) < 0) return;
      ks.forEach(function (k) { if (g[3].test(k)) try { localStorage.removeItem(k); } catch (e) {} });
      if (rw && rw.stats) ['plays', 'wins', 'stars', 'best'].forEach(function (f) { if (rw.stats[f] && typeof rw.stats[f] === 'object') delete rw.stats[f][g[0]]; });
    });
    if (rw) wr('annabelle-rewards', rw);
    // the shared sanctuary goes once a retro game was reset and no retro save is left at all
    var RT = /^annabelle-retro-(invaders|tetris|breakout|snake|crossing|pong|safari|simon)$/;
    if (ids.some(function (x) { return RT.test('annabelle-retro-' + x); }) && !allKeys().some(function (k) { return RT.test(k); })) try { localStorage.removeItem('annabelle-retro-zoo'); localStorage.removeItem('annabelle-retro-hub'); } catch (e) {}
  }
  function resetScreen(fromMath) {
    var card = shell('🗑️ ' + 'איפוס התקדמות',
      '<div class="stat" style="font-size:14px">בחרו אילו משחקים לאפס. כוכבים, שלבים שנפתחו ושיאים של המשחק יימחקו. מטבעות ומדבקות באלבום נשארים, אלא אם בוחרים "הכל".</div>' +
      '<label class="row" style="font-weight:800"><input type="checkbox" data-all style="flex:none;width:22px;height:22px"><span class="lbl">הכל (כולל מטבעות, מדבקות ופריטים)</span></label>' +
      '<div data-list style="display:grid;grid-template-columns:1fr 1fr;gap:4px;max-height:42dvh;overflow:auto">' + RG.map(function (g) { return '<label style="display:flex;align-items:center;gap:6px;font-size:15px;padding:4px"><input type="checkbox" data-g="' + g[0] + '" style="flex:none;width:20px;height:20px"><span>' + g[1] + ' ' + esc(g[2]) + '</span></label>'; }).join('') + '</div>' +
      '<div class="msg" data-m></div>' +
      '<div class="row"><button type="button" class="pri" data-a="go" style="background:#c0392b">🗑️ איפוס</button><button type="button" class="soft" data-a="cancel">' + esc(t('back')) + '</button></div>');
    var all = card.querySelector('[data-all]'), boxes = [].slice.call(card.querySelectorAll('[data-g]')), msg = card.querySelector('[data-m]'), step = 0;
    all.onchange = function () { boxes.forEach(function (b) { b.checked = false; b.disabled = all.checked; }); };
    card.querySelector('[data-a=cancel]').onclick = function () { showPanel('', fromMath); };
    var go = card.querySelector('[data-a=go]');
    go.onclick = function () {
      var ids = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.getAttribute('data-g'); });
      if (!all.checked && !ids.length) { msg.textContent = 'לא נבחר כלום'; return; }
      if (step === 0) { step = 1; msg.textContent = all.checked ? 'בטוחים? כל ההתקדמות תימחק. לחצו שוב לאישור' : 'בטוחים? ' + ids.length + ' משחקים יאופסו. לחצו שוב לאישור'; go.textContent = '⚠️ כן, לאפס'; return; }
      aud('progress_reset', all.checked ? 'all' : ids.join(',').slice(0, 120), {all: all.checked, games: ids, count: ids.length});
      doReset(ids, all.checked); msg.className = 'msg ok'; msg.textContent = '✅ אופס! מרענן…'; go.disabled = true; setTimeout(function () { location.reload(); }, 900);
    };
  }
  function showPanel(note, fromMath) {
    var s = play(), p = par(), r = lockReason(), playedMin = Math.floor(s.seconds / 60), bed = p.bed;
    var lockedNow = r === 'parent' || r === 'bed';
    var card = shell('⚙️ ' + esc(t('panel')),
      '<div class="stat">' + esc(t('played')) + ': <b>' + playedMin + '</b> ' + esc(t('min')) + ' ' + esc(t('of')) + ' ' + Math.round(limitSec(s, p) / 60) + ' · ' + esc(t('left')) + ' <b>' + Math.ceil(left(s, p) / 60) + '</b></div>' +
      '<div class="row"><span class="lbl">' + esc(t('limit')) + '</span><button type="button" data-a="minus" aria-label="-5">−5</button><span class="ptbig" data-v="limit">' + p.limit + '</span><button type="button" data-a="plus5" aria-label="+5">+5</button></div>' +
      '<div class="row"><button type="button" class="pri" data-a="bonus">' + esc(t('plus')) + '</button><button type="button" data-a="reset">' + esc(t('reset')) + '</button></div>' +
      '<button type="button" class="dark" data-a="lock">' + esc(lockedNow ? t('unlock') : t('lock')) + '</button>' +
      '<div class="row"><span class="lbl">🌙 ' + esc(t('bedtime')) + '</span><button type="button" data-a="bed" class="' + (bed.on ? 'pri' : 'soft') + '">' + esc(bed.on ? t('on') : t('off')) + '</button></div>' +
      '<div class="row" dir="ltr"><input type="time" data-a="from" value="' + esc(bed.from) + '" aria-label="' + esc(t('from')) + '"><span style="flex:0">→</span><input type="time" data-a="to" value="' + esc(bed.to) + '" aria-label="' + esc(t('to')) + '"></div>' +
      '<div class="msg ok">' + esc(note || '') + '</div>' +
      '<div class="row"><button type="button" class="soft" data-a="rst">🗑️ איפוס התקדמות</button></div>' +
      '<div class="row"><button type="button" class="' + (fromMath ? 'pri' : 'soft') + '" data-a="pin">' + esc(fromMath ? t('newpin') : t('chpin')) + '</button><button type="button" class="soft" data-a="done">' + esc(t('close')) + '</button></div>');
    function upd(fn, what) { var pp = par(), ss = play(); fn(pp, ss); wr(KPAR, pp); wr(KP, ss); render();
      aud('limits_changed', what, {limit: pp.limit, lock: !!pp.lock, bed: !!pp.bed.on, from: pp.bed.from, to: pp.bed.to, extraMin: Math.round((ss.extra || 0) / 60), playedMin: Math.floor(ss.seconds / 60)});
      showPanel(t('saved'), fromMath); }
    card.querySelector('[data-a=minus]').onclick = function () { upd(function (pp) { pp.limit = Math.max(MIN_LIMIT, pp.limit - STEP); }, 'daily-limit'); };
    card.querySelector('[data-a=plus5]').onclick = function () { upd(function (pp) { pp.limit = Math.min(MAX_LIMIT, pp.limit + STEP); }, 'daily-limit'); };
    card.querySelector('[data-a=bonus]').onclick = function () { upd(function (pp, ss) { ss.extra = (ss.extra || 0) + BONUS_MIN * 60; ss.w5 = ss.w1 = 0; }, 'bonus-time'); };
    card.querySelector('[data-a=reset]').onclick = function () { upd(function (pp, ss) { ss.seconds = 0; ss.extra = 0; ss.w5 = ss.w1 = 0; }, 'today-reset'); };
    card.querySelector('[data-a=lock]').onclick = function () { upd(function (pp) {
      if (lockedNow) { pp.lock = false; var b = bedInfo(pp); if (b.in) pp.skip = b.end; } else { pp.lock = true; delete pp.skip; } }, lockedNow ? 'unlock' : 'lock'); };
    card.querySelector('[data-a=bed]').onclick = function () { upd(function (pp) { pp.bed.on = !pp.bed.on; delete pp.skip; }, 'bedtime'); };
    ['from', 'to'].forEach(function (k) { card.querySelector('[data-a=' + k + ']').onchange = function (e) { var val = e.target.value; if (/^\d\d:\d\d$/.test(val)) upd(function (pp) { pp.bed[k] = val; delete pp.skip; }, 'bedtime-' + k); }; });
    card.querySelector('[data-a=rst]').onclick = function () { resetScreen(fromMath); };
    card.querySelector('[data-a=pin]').onclick = function () { pinPad('create'); };
    card.querySelector('[data-a=done]').onclick = closePanel;
  }

  /* ---------- shared platform modules, on every page, in this order: kid profile, telemetry, report button,
     then the ambience (vibe.js: WebGL background) and the game-feel layer (juice.js: player chip, level-up celebration) ----------
     Each one is optional (a missing file is skipped). While the page is still being parsed they are written into the
     document so kid.js runs before the page's own scripts; otherwise they are appended (ordered, non-blocking). */
  (function () {
    if (window.__kidMods) return; window.__kidMods = 1;
    var base = ''; try { base = me && me.getAttribute('src') ? me.getAttribute('src').replace(/[^\/]*$/, '') : ''; } catch (e) {}
    if (/["<>\s]/.test(base)) base = '';
    var mods = ['kid.js', 'telemetry.js', 'feedback.js', 'vibe.js', 'juice.js'], wrote = false;
    try {
      if (me && document.currentScript === me && document.readyState === 'loading' && !me.async && !me.defer && me.type !== 'module') {
        document.write('<script src="' + base + 'kid.js"><\/script><script src="' + base + 'telemetry.js"><\/script><script src="' + base + 'feedback.js" defer><\/script><script src="' + base + 'vibe.js" defer><\/script><script src="' + base + 'juice.js" defer><\/script>');
        wrote = true;
      }
    } catch (e) {}
    if (!wrote) mods.forEach(function (f) {
      try { var s = document.createElement('script'); s.src = base + f; s.async = false; (document.head || document.documentElement).appendChild(s); } catch (e) {}
    });
  })();

  window.AnnabellePlaytime = {DEFAULT_LIMIT_MIN: DEFAULT_LIMIT_MIN, left: function () { return left(); }, reason: lockReason, isLocked: function () { return locked; }, openPanel: openPanel, tick: tick, render: render};
})();

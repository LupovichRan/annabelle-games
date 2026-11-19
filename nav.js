/* Kids games platform – shared navigation: 🏠 launcher + ☰ this game's menu, and the STANDALONE ("solo") mode of shared links.
   <script src="nav.js" data-menuslot="#langs" data-pauseslot="#pause .card" data-menu="toMenu" defer>
   data-menu: name of a global function that returns to the game's start menu (falls back to reload, which opens the start menu).
   A tag without slots places no button and only gives the page the solo mode.

   SOLO MODE – a link made by share.js carries ?solo=1 (other parameters are left alone):
     · remembered per tab AND per page (sessionStorage 'annabelle-solo' = the page name): a reload keeps it, a new tab without the parameter
       is the normal site, ?solo=0 leaves it. It never writes to a save.
     · ?lang=he|fr|en of a solo link sets 'annabelle-lang' only when the visitor has not chosen a language yet (then one reload, so the page starts in it).
     · reduced platform chrome: every 🏠 (the buttons of this file and plain <a href="index.html|retro.html">🏠</a> links) becomes a discreet
       text link "more games" (small, no icon, no border; a soft light chip so it stays readable on any game background); the reward chip, banners and level-up screen of rewards.js / juice.js stay quiet (coins still count).
     · share.js is loaded when the page did not load it, so the game can be passed on and installed.
     · telemetry: KidApp.track('solo_open', {page}) once per arrival.
   window.AnnabelleSolo = {on: bool, page, exit()} */
(function () {
  'use strict';
  var me = document.currentScript || document.querySelector('script[src$="nav.js"]');
  var D = (me && me.dataset) || {};
  var T = {he: {home: 'לכל המשחקים', menu: 'לתפריט המשחק', more: 'עוד משחקים'}, fr: {home: 'Tous les jeux', menu: 'Menu du jeu', more: 'Plus de jeux'}, en: {home: 'All games', menu: 'Game menu', more: 'More games'}};
  function lang() { var l = 'he'; try { l = localStorage.getItem('annabelle-lang') || 'he'; } catch (e) {} return T[l] ? l : 'he'; }
  var css = 'button.an-nav.an-nav{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;min-height:44px;padding:4px 12px;margin:0;border-radius:999px;' +
    'border:2px solid #e8862d;background:#fff;color:#5a3b1a;font:800 15px/1.1 "Rubik","Varela Round",Arial,sans-serif;box-shadow:0 3px 0 #0002;cursor:pointer;flex:0 0 auto;white-space:nowrap;-webkit-tap-highlight-color:transparent}' +
    'button.an-nav.an-nav:active{transform:translateY(2px);box-shadow:0 1px 0 #0002}button.an-nav .i{font-size:19px}button.an-nav.ic .t{display:none}' +
    '.an-navrow{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;width:100%;margin-top:6px;flex:0 0 auto}';

  /* ---------- solo mode (see the header) ---------- */
  var SK = 'annabelle-solo', PAGE = location.pathname.split('/').pop() || 'index.html';
  var SOLO = (function () {
    var q = location.search, m = /[?&]solo=([01])(?:&|$)/.exec(q), on = false, arrived = false, reloading = false;
    try {
      if (m && m[1] === '1') sessionStorage.setItem(SK, PAGE); else if (m) { if (sessionStorage.getItem(SK) === PAGE) sessionStorage.removeItem(SK); }
      on = sessionStorage.getItem(SK) === PAGE;
    } catch (e) { on = !!m && m[1] === '1'; }                  // no sessionStorage: solo while the parameter is in the address
    if (on && m) {
      try { // the language of the link, only for a visitor who has not chosen one. Some pages store the default 'he' the moment they start:
        // for a brand-new visitor (no finished profile, nothing earned yet) on the first arrival in this tab that is not a choice either.
        var lg = /[?&]lang=(he|fr|en)(?:&|$)/.exec(q), cur = localStorage.getItem('annabelle-lang'), K = window.KidApp;
        var first = sessionStorage.getItem(SK + '-t') !== PAGE, fresh = !cur;
        if (!fresh && cur === 'he' && first) try { fresh = !!(K && K.needsOnboarding && K.hasLegacy && K.needsOnboarding() && !K.hasLegacy()); } catch (e2) {}
        if (lg && fresh && cur !== lg[1]) {
          localStorage.setItem('annabelle-lang', lg[1]);
          // the page has already started in the old language: start it again once, now in the visitor's language
          if (lg[1] !== (cur || 'he') && localStorage.getItem('annabelle-lang') === lg[1] && !sessionStorage.getItem(SK + '-l')) { sessionStorage.setItem(SK + '-l', '1'); reloading = true; location.reload(); }
        }
      } catch (e) {}
      try { if (!reloading && sessionStorage.getItem(SK + '-t') !== PAGE) { sessionStorage.setItem(SK + '-t', PAGE); arrived = true; } } catch (e) {}
    }
    return {on: on, page: PAGE, arrived: arrived, reloading: reloading, exit: function () { try { sessionStorage.removeItem(SK); sessionStorage.removeItem(SK + '-t'); } catch (e) {} }};
  })();
  var solo = SOLO.on;
  if (!window.AnnabelleSolo) window.AnnabelleSolo = {on: solo, page: PAGE, exit: SOLO.exit};
  var soloCss = 'html.an-solo #jz-chip,html.an-solo .jz-p,html.an-solo #jz-lv,html.an-solo .ar-toast{display:none!important}' +
    'html.an-solo .an-more.an-more.an-more{display:inline-flex!important;align-items:center;justify-content:center;box-sizing:border-box;width:auto!important;height:auto!important;min-width:44px!important;min-height:44px!important;max-width:92px;' +
    'padding:2px 8px!important;margin:0;border:0!important;border-radius:10px!important;background:#ffffffd1!important;box-shadow:none!important;color:#3a4252!important;' +
    'font:600 13px/1.15 "Rubik","Varela Round",Arial,sans-serif!important;text-decoration:underline!important;text-underline-offset:3px;text-align:center;white-space:normal!important;text-shadow:none!important;filter:none!important;transform:none!important;cursor:pointer}' +
    'html.an-solo .an-navrow .an-more.an-more.an-more{max-width:none;white-space:nowrap!important}html.an-solo .an-more .i{display:none}html.an-solo button.an-nav.an-more.ic .t{display:inline}' +
    'html.an-solo .an-more:focus-visible{outline:3px solid #34639f;outline-offset:2px}';
  function soloTrack() {
    if (!SOLO.arrived) return; var n = 0;
    (function go() { try { if (window.KidApp && KidApp.track) { KidApp.track('solo_open', {page: PAGE}); return; } } catch (e) { return; } if (++n < 8) setTimeout(go, 500); })();
  }
  function soloQuiet() { // juice.js has no "quiet" switch: its level-up screen is refused here (the level stays pending for a normal visit), the rest is hidden by soloCss
    try { var J = window.Juice; if (J && !J.__solo) { J.__solo = 1; J.levelUp = function () { return false; }; } } catch (e) {}
    try { var lv = document.getElementById('jz-lv'); if (lv && !lv.__solo) { lv.__solo = 1; lv.click(); } } catch (e) {} // one that was already pending when the page opened: closed at once
  }
  function soloLinks() { // plain home links of pages that have their own 🏠 (the retro games): same discreet link
    var t = T[lang()].more;
    document.querySelectorAll('a[href="index.html"],a[href="retro.html"],a.an-more').forEach(function (a) {
      if (!a.classList.contains('an-more')) { if (a.textContent.indexOf('🏠') < 0 || a.children.length) return; a.classList.add('an-more'); a.addEventListener('click', SOLO.exit); }
      if (a.textContent !== t) a.textContent = t;
      if (a.getAttribute('href') !== 'index.html') a.setAttribute('href', 'index.html');
      if (a.getAttribute('aria-label') !== t) a.setAttribute('aria-label', t);
      if (a.title) a.removeAttribute('title');
    });
  }
  function soloShare() { // a page that does not load share.js still gets it in solo mode (it attaches next to the home link by itself)
    try {
      if (window.AnnabelleShare || document.querySelector('script[src$="share.js"]')) return;
      var base = me && me.getAttribute('src') ? me.getAttribute('src').replace(/[^\/]*$/, '') : ''; if (/["<>\s]/.test(base)) base = '';
      var s = document.createElement('script'); s.src = base + 'share.js'; s.async = true; document.head.appendChild(s);
    } catch (e) {}
  }
  function goHome() { if (solo) SOLO.exit(); location.href = 'index.html'; }
  function goMenu() {
    var f = D.menu && window[D.menu];
    if (typeof f === 'function') { try { f(); return; } catch (e) {} }
    location.reload();
  }
  function btn(kind, iconOnly) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'an-nav' + (iconOnly ? ' ic' : '') + (solo && kind === 'home' ? ' an-more' : ''); b.dataset.kind = kind;
    b.innerHTML = '<span class="i">' + (kind !== 'home' ? '☰' : solo ? '' : '🏠') + '</span><span class="t"></span>';
    b.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); kind === 'home' ? goHome() : goMenu(); });
    ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { b.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); });
    return b;
  }
  var placed = {};
  function put(key, sel, make) {
    if (!sel) return; var tgt = document.querySelector(sel); if (!tgt) return;
    if (placed[key] && placed[key].isConnected) return;
    var w = make(); tgt.appendChild(w); placed[key] = w;
  }
  function place() {
    put('m', D.menuslot, function () { return btn('home', true); });
    put('p', D.pauseslot, function () { var r = document.createElement('div'); r.className = 'an-navrow'; if (D.pausemenu) r.appendChild(btn('menu')); r.appendChild(btn('home')); return r; });
    if (D.relabel) document.querySelectorAll(D.relabel).forEach(function (b) {
      var w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) if (n.nodeValue.indexOf('🏠') >= 0) n.nodeValue = n.nodeValue.replace('🏠', '☰');
      b.title = b.title || T[lang()].menu;
    });
    if (solo) { soloLinks(); soloQuiet(); }
    var t = T[lang()];
    document.querySelectorAll('button.an-nav').forEach(function (b) {
      var s = t[solo && b.dataset.kind === 'home' ? 'more' : b.dataset.kind], x = b.querySelector('.t');
      if (x.textContent !== s) { x.textContent = s; b.title = s; b.setAttribute('aria-label', s); }
    });
  }
  function start() {
    var st = document.createElement('style'); st.textContent = css + (solo ? soloCss : ''); document.head.appendChild(st);
    if (solo) { document.documentElement.classList.add('an-solo'); soloShare(); soloTrack(); }
    place(); setInterval(place, 700);
    document.addEventListener('click', function () { setTimeout(place, 50); }, true);
  }
  if (SOLO.reloading) return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

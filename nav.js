/* Annabelle games – shared navigation: 🏠 launcher + ☰ this game's menu.
   <script src="nav.js" data-menuslot="#langs" data-pauseslot="#pause .card" data-menu="toMenu" defer>
   data-menu: name of a global function that returns to the game's start menu (falls back to reload, which opens the start menu). */
(function () {
  'use strict';
  var me = document.currentScript || document.querySelector('script[src$="nav.js"]');
  var D = (me && me.dataset) || {};
  var T = {he: {home: 'לכל המשחקים', menu: 'לתפריט המשחק'}, fr: {home: 'Tous les jeux', menu: 'Menu du jeu'}, en: {home: 'All games', menu: 'Game menu'}};
  function lang() { var l = 'he'; try { l = localStorage.getItem('annabelle-lang') || 'he'; } catch (e) {} return T[l] ? l : 'he'; }
  var css = 'button.an-nav.an-nav{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;min-height:44px;padding:4px 12px;margin:0;border-radius:999px;' +
    'border:2px solid #e8862d;background:#fff;color:#5a3b1a;font:800 15px/1.1 "Rubik","Varela Round",Arial,sans-serif;box-shadow:0 3px 0 #0002;cursor:pointer;flex:0 0 auto;white-space:nowrap;-webkit-tap-highlight-color:transparent}' +
    'button.an-nav.an-nav:active{transform:translateY(2px);box-shadow:0 1px 0 #0002}button.an-nav .i{font-size:19px}button.an-nav.ic .t{display:none}' +
    '.an-navrow{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;width:100%;margin-top:6px;flex:0 0 auto}';
  function goHome() { location.href = 'index.html'; }
  function goMenu() {
    var f = D.menu && window[D.menu];
    if (typeof f === 'function') { try { f(); return; } catch (e) {} }
    location.reload();
  }
  function btn(kind, iconOnly) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'an-nav' + (iconOnly ? ' ic' : ''); b.dataset.kind = kind;
    b.innerHTML = '<span class="i">' + (kind === 'home' ? '🏠' : '☰') + '</span><span class="t"></span>';
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
    var t = T[lang()];
    document.querySelectorAll('button.an-nav').forEach(function (b) {
      var s = t[b.dataset.kind], x = b.querySelector('.t');
      if (x.textContent !== s) { x.textContent = s; b.title = s; b.setAttribute('aria-label', s); }
    });
  }
  function start() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    place(); setInterval(place, 700);
    document.addEventListener('click', function () { setTimeout(place, 50); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

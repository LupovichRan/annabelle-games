/* Annabelle games – "share with a friend" on WhatsApp (wa.me link; the child picks the contact, nothing is sent automatically).
   <script src="share.js" data-slot="#langs" defer>  (launcher: data-all="1" shares the whole collection) */
(function () {
  'use strict';
  var me = document.currentScript, D = (me && me.dataset) || {};
  var BASE = 'https://lupovichran.github.io/annabelle-games/';
  var T = {
    he: {b: 'שתפי עם חברה', g: 'בואי לשחק איתי ב{n}! 🐱', a: 'בואי לשחק איתי במשחקים של אנאבל! 🐱'},
    fr: {b: 'Partager avec un ami', g: 'Viens jouer avec moi à {n} ! 🐱', a: 'Viens jouer avec moi aux jeux d\'Annabelle ! 🐱'},
    en: {b: 'Share with a friend', g: 'Come play {n} with me! 🐱', a: 'Come play Annabelle\'s games with me! 🐱'}
  };
  function lang() { var l = 'he'; try { l = localStorage.getItem('annabelle-lang') || 'he'; } catch (e) {} return T[l] ? l : 'he'; }
  function name() { var m = document.querySelector('meta[name="apple-mobile-web-app-title"]'); return (m && m.content) || document.title; }
  function href() {
    var t = T[lang()], page = (location.pathname.split('/').pop() || '');
    var url = D.all ? BASE : BASE + page, txt = D.all ? t.a : t.g.replace('{n}', name());
    return 'https://wa.me/?text=' + encodeURIComponent(txt + ' ' + url);
  }
  var css = 'a.an-share{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:4px 12px;border-radius:999px;border:2px solid #25d366;background:#fff;color:#128c4a;' +
    'font:800 15px/1.1 "Rubik","Varela Round",Arial,sans-serif;text-decoration:none;box-shadow:0 3px 0 #0002;white-space:nowrap;-webkit-tap-highlight-color:transparent}a.an-share:active{transform:translateY(2px)}';
  var a;
  function place() {
    var tgt = D.slot && document.querySelector(D.slot); if (!tgt) return;
    if (!a) {
      a = document.createElement('a'); a.className = 'an-share'; a.target = '_blank'; a.rel = 'noopener';
      ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach(function (ev) { a.addEventListener(ev, function (e) { e.stopPropagation(); a.href = href(); }, {passive: true}); });
    }
    if (!a.isConnected) tgt.appendChild(a);
    var s = T[lang()].b; a.href = href();
    var lbl = D.icon ? '💬' : '💬 ' + s; a.title = s;
    if (a.textContent !== lbl) { a.textContent = lbl; a.setAttribute('aria-label', s); }
  }
  function start() { var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); place(); setInterval(place, 1000); }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();

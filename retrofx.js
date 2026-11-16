/* Retro Corner – shared desktop "arcade cabinet" side panels.
   Purely decorative (pointer-events:none). On a desktop-size screen the retro games are a centered column;
   this fills the free space left and right of the game with cabinet art: marquee, the rescued animals,
   a control panel on one side and the high-score table on the other. Hidden whenever there is no room. */
(function () {
  'use strict';
  if (window.__retrofx) return; window.__retrofx = 1;
  var tag = document.querySelector('script[data-app]'), ID = tag ? tag.getAttribute('data-app') : '';
  var ZOO = {tiger: '🐅', lion: '🦁', leopard: '🐆', cheetah: '🐈', puma: '😼', panda: '🐼', koala: '🐨', monkey: '🐒', elephant: '🐘', giraffe: '🦒', zebra: '🦓', rabbit: '🐇', fox: '🦊', owl: '🦉', parrot: '🦜', turtle: '🐢', dolphin: '🐬', penguin: '🐧', hedgehog: '🦔', deer: '🦌'};
  var EMO = {invaders: '🚀', tetris: '🧱', breakout: '🐾', snake: '🐯', crossing: '🐥', pong: '🏓', safari: '📸', simon: '🎶'};
  var TX = {he: {hi: 'שיאים', zoo: 'במקלט', ins: 'הכניסי כדור צמר', none: 'עוד אין שיא'}, fr: {hi: 'RECORDS', zoo: 'au refuge', ins: 'INSÈRE UNE PELOTE', none: 'pas encore de record'}, en: {hi: 'HIGH SCORES', zoo: 'in the sanctuary', ins: 'INSERT YARN', none: 'no record yet'}};
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function J(k) { try { return JSON.parse(ls(k) || 'null'); } catch (e) { return null; } }
  function lang() { var l = ls('annabelle-lang') || 'he'; return l === 'fr' || l === 'en' ? l : 'he'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  var css = document.createElement('style');
  css.textContent =
    '.rfx{position:fixed;top:0;bottom:0;z-index:0;pointer-events:none;display:none;flex-direction:column;align-items:center;justify-content:space-between;padding:18px 10px;box-sizing:border-box;overflow:hidden;color:#fff;font-family:"Courier New",monospace;' +
    'background:linear-gradient(#24124f,#120a2e);box-shadow:inset 0 0 0 4px #0006}' +
    '.rfx:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,#0000 0 3px,#0003 3px 4px),repeating-linear-gradient(90deg,#ffffff08 0 2px,#0000 2px 26px);pointer-events:none}' +
    '#rfxL{left:0;border-right:5px solid #ff6fb5;box-shadow:inset -14px 0 24px -14px #ff6fb5aa}#rfxR{right:0;border-left:5px solid #5ff0ff;box-shadow:inset 14px 0 24px -14px #5ff0ffaa}' +
    '.rfx.on{display:flex}.rfx>*{position:relative}' +
    '.rfx .mq{font-size:15px;font-weight:900;letter-spacing:3px;color:#ffe14d;text-shadow:0 0 10px #ff9d00,2px 2px 0 #b3002d;text-align:center;animation:rfxb 2.2s steps(2) infinite}' +
    '.rfx .big{font-size:64px;line-height:1.1;filter:drop-shadow(0 0 12px #fff6);animation:rfxf 2.6s ease-in-out infinite}' +
    '.rfx .zoo{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:100%}.rfx .zoo span{font-size:30px;animation:rfxf 2.4s ease-in-out infinite}.rfx .zoo span.no{filter:grayscale(1) brightness(.35);opacity:.5;animation:none}' +
    '.rfx .cnt{font-size:14px;font-weight:700;color:#5ff0ff;text-align:center;margin-top:6px}' +
    '.rfx .pad{display:flex;gap:16px;align-items:flex-end;justify-content:center}.rfx .stick{width:14px;height:44px;background:#888;border-radius:6px;position:relative}.rfx .stick:before{content:"";position:absolute;left:-11px;top:-22px;width:36px;height:36px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff9aa8,#e0193d 60%,#8f0020)}' +
    '.rfx .btn{width:30px;height:30px;border-radius:50%;box-shadow:0 5px 0 #0008}.rfx .b1{background:#ffe14d}.rfx .b2{background:#5ff0ff}' +
    '.rfx .ins{font-size:13px;font-weight:900;letter-spacing:1px;color:#fff;text-align:center;animation:rfxb 1.2s steps(2) infinite;margin-top:10px}' +
    '.rfx .hi{width:100%;font-size:15px;font-weight:700}.rfx .hi h4{margin:0 0 8px;text-align:center;color:#ff6fb5;font-size:17px;letter-spacing:2px;text-shadow:0 0 8px #ff6fb5}' +
    '.rfx .hi div{display:flex;justify-content:space-between;gap:8px;padding:3px 6px;direction:ltr}.rfx .hi div:nth-child(2){color:#ffe14d}.rfx .hi i{font-style:normal;opacity:.7}.rfx .hi .none{justify-content:center;opacity:.6;font-size:13px}' +
    '@keyframes rfxb{50%{opacity:.45}}@keyframes rfxf{50%{transform:translateY(-7px)}}' +
    '@media (prefers-reduced-motion:reduce){.rfx *{animation:none!important}}';
  var L, R, lastKey = '';
  function build() {
    L = document.createElement('div'); L.className = 'rfx'; L.id = 'rfxL'; L.setAttribute('aria-hidden', 'true');
    R = document.createElement('div'); R.className = 'rfx'; R.id = 'rfxR'; R.setAttribute('aria-hidden', 'true');
    document.head.appendChild(css); document.body.insertBefore(R, document.body.firstChild); document.body.insertBefore(L, document.body.firstChild);
  }
  function fill() {
    var t = TX[lang()], zoo = J('annabelle-retro-zoo'); zoo = Array.isArray(zoo) ? zoo : [];
    var sv = J('annabelle-retro-' + ID), hi = sv && Array.isArray(sv.hi) ? sv.hi.filter(function (h) { return h && typeof h.s === 'number'; }).slice(0, 5) : [];
    if (!hi.length && sv && typeof sv.best === 'number' && sv.best > 0) hi = [{s: sv.best}];
    var key = lang() + '|' + zoo.join(',') + '|' + JSON.stringify(hi); if (key === lastKey) return; lastKey = key;
    var ids = Object.keys(ZOO), have = ids.filter(function (a) { return zoo.indexOf(a) >= 0; });
    L.innerHTML = '<div><div class="mq">★ RETRO ★</div></div><div class="big">' + (EMO[ID] || '🕹️') + '</div>' +
      '<div><div class="pad"><div class="stick"></div><div class="btn b1"></div><div class="btn b2"></div></div><div class="ins">' + esc(t.ins) + ' 🧶</div></div>';
    R.innerHTML = '<div class="hi"><h4>' + esc(t.hi) + '</h4>' + (hi.length ? hi.map(function (h, i) { return '<div><span>' + (i + 1) + '.</span><span>' + Math.round(h.s) + '</span></div>'; }).join('') : '<div class="none">' + esc(t.none) + '</div>') + '</div>' +
      '<div><div class="zoo">' + ids.map(function (a, i) { var h = zoo.indexOf(a) >= 0; return '<span class="' + (h ? '' : 'no') + '" style="animation-delay:-' + (i * 0.23).toFixed(2) + 's">' + ZOO[a] + '</span>'; }).join('') + '</div>' +
      '<div class="cnt">🏡 ' + have.length + '/' + ids.length + ' ' + esc(t.zoo) + '</div></div>';
  }
  function measure() {
    if (!L) return;
    var vw = innerWidth, vh = innerHeight, desk = document.documentElement.classList.contains('desk');
    if (!desk || vw < 900) { L.classList.remove('on'); R.classList.remove('on'); return; }
    var minL = vw, maxR = 0, els = document.querySelectorAll('canvas,button,a,input,select,[role=button]');
    for (var i = 0; i < els.length; i++) {
      var e = els[i]; if (e.closest('.rfx') || e.closest('[id^="pt-"]')) continue;
      if (e.checkVisibility && !e.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) continue;
      var r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      if (r.left < minL) minL = r.left; if (r.right > maxR) maxR = r.right;
    }
    if (maxR <= minL) { L.classList.remove('on'); R.classList.remove('on'); return; }
    var free = Math.min(minL, vw - maxR) - 22;
    if (free < 120) { L.classList.remove('on'); R.classList.remove('on'); return; }
    var w = Math.min(250, free); L.style.width = R.style.width = w + 'px';
    fill(); L.classList.add('on'); R.classList.add('on');
  }
  function start() { if (!document.body) return; build(); measure(); setInterval(measure, 1500); addEventListener('resize', measure); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

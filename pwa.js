/* Annabelle games – install-to-home-screen + offline (service worker) */
(function () {
  'use strict';
  var me = document.currentScript || document.querySelector('script[src$="pwa.js"]');
  var APP = (me && me.dataset.app) || 'launcher';
  var SLOTS = []; try { SLOTS = JSON.parse((me && me.dataset.slots) || '[]'); } catch (e) {}

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', {scope: './'}).catch(function () {});
    });
  }

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var force = /[?&]pwatest=1/.test(location.search);
  function standalone() {
    return navigator.standalone === true ||
      ['standalone', 'fullscreen', 'minimal-ui'].some(function (m) { return matchMedia('(display-mode: ' + m + ')').matches; });
  }
  var deferred = null, installed = false;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; refresh(); });
  window.addEventListener('appinstalled', function () { installed = true; deferred = null; refresh(); });

  var T = {
    he: {btn: 'הוסיפי למסך הבית', launcherHint: 'גם כל משחק אפשר להוסיף לבד – פתחי אותו ולחצי 📲',
      tIOS: 'הוספה למסך הבית', ios: ['לחצי על כפתור השיתוף <b class="pwa-share">⬆︎</b> בתחתית ספארי (ריבוע עם חץ למעלה)', 'גללי ובחרי <b>„הוספה למסך הבית”</b>', 'לחצי <b>„הוסף”</b> – והמשחק יופיע עם אייקון משלו!'],
      iosNote: 'נפתח מתוך וואטסאפ? קודם פתחי את הקישור בספארי.',
      tAnd: 'הוספה למסך הבית', and: ['פתחי את תפריט הדפדפן <b>⋮</b> (שלוש נקודות למעלה)', 'בחרי <b>„התקנת אפליקציה”</b> או <b>„הוספה למסך הבית”</b>', 'אשרי – והמשחק יופיע עם אייקון משלו!'],
      andNote: 'נפתח מתוך וואטסאפ? קודם פתחי את הקישור בכרום.', ok: 'הבנתי 👍'},
    fr: {btn: "Installer l'appli", launcherHint: "Chaque jeu peut aussi être installé seul : ouvre-le et touche 📲",
      tIOS: "Ajouter à l'écran d'accueil", ios: ['Touche le bouton Partager <b class="pwa-share">⬆︎</b> en bas de Safari (carré avec une flèche)', "Choisis <b>« Sur l'écran d'accueil »</b>", 'Touche <b>« Ajouter »</b> – le jeu a sa propre icône !'],
      iosNote: "Ouvert depuis WhatsApp ? Ouvre d'abord le lien dans Safari.",
      tAnd: "Ajouter à l'écran d'accueil", and: ['Ouvre le menu du navigateur <b>⋮</b> (trois points en haut)', "Choisis <b>« Installer l'application »</b> ou <b>« Ajouter à l'écran d'accueil »</b>", 'Confirme – le jeu a sa propre icône !'],
      andNote: "Ouvert depuis WhatsApp ? Ouvre d'abord le lien dans Chrome.", ok: "D'accord 👍"},
    en: {btn: 'Add to Home', launcherHint: 'Each game can be added on its own too: open it and tap 📲',
      tIOS: 'Add to Home Screen', ios: ['Tap the Share button <b class="pwa-share">⬆︎</b> at the bottom of Safari (square with an arrow)', 'Choose <b>“Add to Home Screen”</b>', 'Tap <b>“Add”</b> – the game gets its own icon!'],
      iosNote: 'Opened from WhatsApp? Open the link in Safari first.',
      tAnd: 'Add to Home Screen', and: ['Open the browser menu <b>⋮</b> (three dots at the top)', 'Choose <b>“Install app”</b> or <b>“Add to Home screen”</b>', 'Confirm – the game gets its own icon!'],
      andNote: 'Opened from WhatsApp? Open the link in Chrome first.', ok: 'Got it 👍'}
  };
  function lang() { var l = 'he'; try { l = localStorage.getItem('annabelle-lang') || 'he'; } catch (e) {} return T[l] ? l : 'he'; }

  var css = 'button.pwa-btn.pwa-btn.pwa-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:6px 16px;margin:6px auto 0;' +
    'border-radius:999px;border:2px solid #7c5cff;background:#fff;color:#5b3b8c;font:800 15px/1.1 "Rubik","Varela Round",Arial,sans-serif;' +
    'box-shadow:0 3px 0 #0002;cursor:pointer;flex:0 0 auto;max-width:92vw;white-space:nowrap;position:relative;z-index:1;-webkit-tap-highlight-color:transparent}' +
    'button.pwa-btn.pwa-btn.pwa-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #0002}.pwa-btn .i{font-size:19px}' +
    '.pwa-wrap{display:flex;justify-content:center;width:100%;flex:0 0 auto}' +
    '.pwa-launch{display:flex;flex-direction:column;align-items:center;gap:6px;margin:-12px 0 -6px}' +
    '.pwa-launch p{margin:0;font-size:14px;font-weight:700;opacity:.85;max-width:420px}' +
    '.pwa-tip{position:fixed;inset:0;z-index:2147483000;background:#0007;display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Rubik","Varela Round",Arial,sans-serif}' +
    '.pwa-tip .c{background:#fff;color:#3a2459;border-radius:22px;padding:18px 18px 14px;max-width:380px;width:100%;box-shadow:0 10px 30px #0005;text-align:start}' +
    '.pwa-tip h3{margin:0 0 10px;font-size:20px;text-align:center}.pwa-tip ol{margin:0;padding-inline-start:22px;font-size:16px;line-height:1.45}' +
    '.pwa-tip li{margin:4px 0}.pwa-tip .n{font-size:13px;opacity:.75;margin:10px 0 0;text-align:center}.pwa-share{display:inline-block;border:2px solid #2a7cf6;color:#2a7cf6;border-radius:6px;padding:0 4px;font-size:13px}' +
    '.pwa-tip button{display:block;margin:12px auto 0;min-height:44px;padding:8px 28px;border-radius:999px;border:0;background:#7c5cff;color:#fff;font:800 17px/1 inherit;cursor:pointer}' +
    '.pwa-tip .x{font-size:44px;text-align:center;line-height:1}';

  function canOffer() {
    if (installed || standalone()) return false;
    return !!deferred || isIOS || isAndroid || force;
  }
  function label(b) {
    var t = T[lang()];
    var s = b.querySelector('.t'); if (s && s.textContent !== t.btn) s.textContent = t.btn;
    var d = lang() === 'he' ? 'rtl' : 'ltr'; if (b.dir !== d) b.dir = d;
    var h = b.parentNode && b.parentNode.querySelector('.pwa-hint'); if (h && h.textContent !== t.launcherHint) h.textContent = t.launcherHint;
  }
  function makeBtn() {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'pwa-btn';
    b.innerHTML = '<span class="i">📲</span><span class="t"></span>';
    b.addEventListener('click', function (e) { e.stopPropagation(); install(); });
    ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { b.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); });
    return b;
  }
  function install() {
    if (deferred) {
      var d = deferred; deferred = null;
      d.prompt(); (d.userChoice || Promise.resolve()).then(function (c) { if (c && c.outcome === 'accepted') installed = true; refresh(); });
      return;
    }
    tip();
  }
  function tip() {
    var t = T[lang()], ios = isIOS;
    var w = document.createElement('div'); w.className = 'pwa-tip'; w.dir = lang() === 'he' ? 'rtl' : 'ltr';
    w.innerHTML = '<div class="c"><div class="x">📲</div><h3>' + (ios ? t.tIOS : t.tAnd) + '</h3><ol>' +
      (ios ? t.ios : t.and).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol><p class="n">' +
      (ios ? t.iosNote : t.andNote) + '</p><button type="button">' + t.ok + '</button></div>';
    function close(e) { if (e) e.stopPropagation(); w.remove(); }
    w.addEventListener('click', function (e) { if (e.target === w || e.target.tagName === 'BUTTON') close(e); });
    ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { w.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); });
    document.body.appendChild(w);
  }

  var placed = [];
  function place() {
    if (APP === 'launcher') {
      if (!document.querySelector('.pwa-launch')) {
        var paws = document.querySelector('.paws'); if (!paws) return;
        var box = document.createElement('div'); box.className = 'pwa-launch';
        box.appendChild(makeBtn());
        var p = document.createElement('p'); p.className = 'pwa-hint'; box.appendChild(p);
        paws.insertAdjacentElement('afterend', box);
      }
      return;
    }
    SLOTS.forEach(function (s, i) {
      var tgt = document.querySelector(s[0]); if (!tgt) return;
      var have = placed[i];
      if (have && have.isConnected) return;
      var w; if (s[1] === 'append' && /langs/i.test(s[0])) { w = makeBtn(); w.style.cssText = 'margin:0;min-height:0;padding-top:0;padding-bottom:0;align-self:stretch'; } else { w = document.createElement('div'); w.className = 'pwa-wrap'; w.appendChild(makeBtn()); }
      if (s[1] === 'after') tgt.insertAdjacentElement('afterend', w); else tgt.appendChild(w);
      placed[i] = w;
    });
  }
  function refresh() {
    var show = canOffer();
    if (show) place();
    document.querySelectorAll('.pwa-btn').forEach(function (b) {
      var holder = b.closest('.pwa-launch') || b.closest('.pwa-wrap') || b;
      holder.style.display = show ? '' : 'none';
      if (show) label(b);
    });
  }
  function start() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    refresh();
    setInterval(refresh, 800);
    window.addEventListener('storage', refresh);
    document.addEventListener('click', function () { setTimeout(refresh, 50); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

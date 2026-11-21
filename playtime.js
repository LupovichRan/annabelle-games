/* Annabelle games – shared daily play-time limit + parent controls.
   Injected into every page by pwa/build.py (sync, early in <head> so it can wrap AudioContext / rAF).
   Storage (localStorage, per device + per browser):
     annabelle-playtime = {date, seconds, extra, last, w5, w1}   today's counted seconds (resets at local midnight)
     annabelle-parent   = {limit, pin:{a,s,h}, lock, bed:{on,from,to}, skip, fails, wait}   only a salted hash of the PIN
   CALM MODE (docs/CALM-UI.md; localStorage 'annabelle-calm' !== '0', the default). The limit logic is the same in both modes; only what is shown differs:
     · the ⏰ badge is hidden; it appears, still and in whole minutes, in the last 10 minutes, or for 5 s when a parent set a limit and the
       kid taps the page header (AnnabellePlaytime.peek(ms) does the same from code). On the home page the pill is only the parents' gear.
     · the 5-minute and 1-minute warnings stay, as one flat card without sound or bounce (he / fr / en).
     · the lock screen does not twinkle.
   Lively mode ('0') keeps the sliding pill, the bouncing toast with its beep and the animated lock screen.
   The parent panel (both modes) has five sections: today · daily limit · lock now · bedtime · more settings. */
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
  // teens (13+), grown-ups and the exam-prep page get no DEFAULT daily limit: a full mock exam is 3.5 hours. A limit a parent set explicitly still applies to everyone.
  function freeByDefault() {
    try {
      if (/(^|\/)bagrut\.html$/.test(location.pathname)) return true;
      var d = JSON.parse(localStorage.getItem('annabelle-profiles') || 'null'), c = d && d.list && d.list.filter(function (x) { return x && x.id === d.cur; })[0];
      return !!c && (c.role === 'adult' || (typeof c.age === 'number' && c.age >= 13));
    } catch (e) { return false; }
  }
  function par() { var p = rd(KPAR, {}); if (!(p.limit >= MIN_LIMIT && p.limit <= MAX_LIMIT)) { p.limit = DEFAULT_LIMIT_MIN; p.free = freeByDefault(); } else p.free = false; if (!p.bed) p.bed = {on: false, from: '20:30', to: '07:00'}; return p; }
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
    if (!p.free && left(s, p) <= 0) return 'time';
    return '';
  }

  /* ---------- texts ---------- */
  // he / fr / en (follows 'annabelle-lang'). A value [feminine, masculine, neutral] speaks to the kid: the form is picked for the
  // current profile each time it is shown (g3). Everything else is for parents, or the same for everybody.
  var T = {
    he: {left: 'נשארו', min: 'דק׳',
      time: ['זמן המשחק להיום נגמר!', ['כל הכבוד ששיחקת! בואי נחזור מחר 🌙', 'כל הכבוד ששיחקת! בוא נחזור מחר 🌙', 'כל הכבוד על המשחק! נחזור מחר 🌙']],
      bed: ['שעת שינה!', 'גם האריה הולך לישון. לילה טוב, נתראה מחר 🌙'],
      parent: ['המשחקים נעולים כרגע', ['ההורים נעלו את המשחקים. תשאלי אותם 💛', 'ההורים נעלו את המשחקים. תשאל אותם 💛', 'ההורים נעלו את המשחקים. אפשר לשאול אותם 💛']],
      parentLink: 'הורים', panel: 'פאנל הורים', played: 'שוחק היום', of: 'מתוך', limit: 'מגבלה יומית', plus: '+15 דק׳ להיום', reset: 'איפוס היום',
      lock: '🔒 לנעול עכשיו', unlock: '🔓 לפתוח נעילה', bedtime: 'שעת שינה', on: 'פעיל', off: 'כבוי', from: 'מ־', to: 'עד', chpin: 'שינוי קוד', close: 'סגירה',
      create: 'יצירת קוד הורים (4 ספרות)', confirm: 'הקלידו שוב את הקוד', enter: 'קוד הורים', mismatch: 'הקודים לא תואמים, נסו שוב', wrong: 'קוד שגוי', wait: 'יותר מדי ניסיונות. נסו שוב בעוד', sec: 'שנ׳',
      forgot: 'שכחתי את הקוד', math: 'שאלת הורים', check: 'בדיקה', newpin: 'הגדרת קוד חדש', saved: 'נשמר ✓', back: 'חזרה', del: 'מחיקה', ok: 'אישור', answer: 'התשובה',
      rst: 'איפוס התקדמות', rstInfo: 'בחרו אילו משחקים לאפס. כוכבים, שלבים שנפתחו ושיאים של המשחק יימחקו. מטבעות ומדבקות באלבום נשארים, אלא אם בוחרים "הכל".',
      rstAll: 'הכל (כולל מטבעות, מדבקות ופריטים)', rstGo: '🗑️ איפוס', rstNone: 'לא נבחר כלום', rstSureAll: 'בטוחים? כל ההתקדמות תימחק. לחצו שוב לאישור',
      rstSure: 'בטוחים? {n} משחקים יאופסו. לחצו שוב לאישור', rstYes: '⚠️ כן, לאפס', rstDone: '✅ אופס! מרענן…'},
    fr: {left: 'Reste', min: 'min',
      time: ['Le temps de jeu d’aujourd’hui est fini !', 'Bravo, tu as bien joué ! On se retrouve demain 🌙'],
      bed: ['C’est l’heure de dormir !', 'Le lion va se coucher lui aussi. Bonne nuit, à demain 🌙'],
      parent: ['Les jeux sont fermés pour le moment', 'Tes parents ont fermé les jeux. Demande-leur 💛'],
      parentLink: 'Parents', panel: 'Espace parents', played: 'Joué aujourd’hui\u00a0', of: 'sur', limit: 'Limite par jour', plus: '+15 min aujourd’hui', reset: 'Remettre à zéro',
      lock: '🔒 Fermer maintenant', unlock: '🔓 Rouvrir', bedtime: 'Heure du coucher', on: 'Activé', off: 'Désactivé', from: 'De', to: 'À', chpin: 'Changer le code', close: 'Fermer',
      create: 'Créer le code parents (4 chiffres)', confirm: 'Tapez le code encore une fois', enter: 'Code parents', mismatch: 'Les codes sont différents, réessayez', wrong: 'Code incorrect', wait: 'Trop d’essais. Réessayez dans', sec: 's',
      forgot: 'J’ai oublié le code', math: 'Question pour les parents', check: 'Vérifier', newpin: 'Choisir un nouveau code', saved: 'Enregistré ✓', back: 'Retour', del: 'Effacer', ok: 'Valider', answer: 'La réponse',
      rst: 'Effacer la progression', rstInfo: 'Choisissez les jeux à remettre à zéro. Les étoiles, les niveaux ouverts et les records du jeu seront effacés. Les pièces et les autocollants de l’album restent, sauf avec « Tout ».',
      rstAll: 'Tout (pièces, autocollants et objets compris)', rstGo: '🗑️ Effacer', rstNone: 'Rien n’est choisi', rstSureAll: 'Sûr ? Toute la progression sera effacée. Touchez encore pour confirmer',
      rstSure: 'Sûr ? {n} jeux seront remis à zéro. Touchez encore pour confirmer', rstYes: '⚠️ Oui, effacer', rstDone: '✅ Effacé ! Actualisation…'},
    en: {left: 'Time left:', min: 'min',
      time: ['Play time is over for today!', 'Well played! See you tomorrow 🌙'],
      bed: ['Bedtime!', 'The lion is going to sleep too. Good night, see you tomorrow 🌙'],
      parent: ['The games are locked for now', 'Your parents locked the games. Ask them 💛'],
      parentLink: 'Parents', panel: 'Parent panel', played: 'Played today', of: 'of', limit: 'Daily limit', plus: '+15 min today', reset: 'Reset today',
      lock: '🔒 Lock now', unlock: '🔓 Unlock', bedtime: 'Bedtime', on: 'On', off: 'Off', from: 'From', to: 'To', chpin: 'Change code', close: 'Close',
      create: 'Create a parent code (4 digits)', confirm: 'Type the code again', enter: 'Parent code', mismatch: 'The codes do not match, try again', wrong: 'Wrong code', wait: 'Too many tries. Try again in', sec: 's',
      forgot: 'I forgot the code', math: 'Question for parents', check: 'Check', newpin: 'Set a new code', saved: 'Saved ✓', back: 'Back', del: 'Delete', ok: 'OK', answer: 'The answer',
      rst: 'Reset progress', rstInfo: 'Choose which games to reset. The stars, unlocked levels and high scores of the game will be erased. Coins and album stickers stay, unless you choose "Everything".',
      rstAll: 'Everything (coins, stickers and items too)', rstGo: '🗑️ Reset', rstNone: 'Nothing is chosen', rstSureAll: 'Sure? All progress will be erased. Tap again to confirm',
      rstSure: 'Sure? {n} games will be reset. Tap again to confirm', rstYes: '⚠️ Yes, reset', rstDone: '✅ Reset! Refreshing…'}
  };
  // the two warnings (he / fr / en); the Hebrew is the same for everybody
  var WT = {he: {w5: 'עוד 5 דקות נגמר זמן המשחק להיום – כדאי לסיים בקרוב! 🐱', w1: 'נשארה דקה אחת! זמן להגיד לילה טוב למשחק 🦁'},
    fr: {w5: 'Encore 5 minutes de jeu pour aujourd’hui : c’est bientôt fini ! 🐱', w1: 'Il reste une minute ! On dit au revoir au jeu 🦁'},
    en: {w5: '5 minutes of play time left for today – time to wrap up soon! 🐱', w1: 'One minute left! Time to say good night to the game 🦁'}};
  function warnText(k) { return (WT[plang()] || WT.he)[k]; }
  function L() { return plang(); }
  function gen() { try { var K = window.KidApp; return K && K.kid ? K.kid().gender : ''; } catch (e) { return ''; } }
  function g3(v) { // [feminine, masculine, neutral] -> the form for the current kid (neutral when the profile module is missing)
    if (!Array.isArray(v)) return v;
    var G = gen(); return G === 'f' ? v[0] : G === 'm' ? v[1] : v[2];
  }
  function t(k) { return g3((T[L()] || T.he)[k]); }
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
    /* calm mode (docs/CALM-UI.md): the time badge is a still, plain pill that is only there when it matters; the warning is one flat card; the lock screen does not move */
    '#pt-badge.q{font-weight:600;font-size:12px;color:#2b3140;background:rgba(255,255,255,.92);border:1px solid #d9d3c7;box-shadow:none;opacity:1;transition:none;padding:4px 8px}' +
    '#pt-badge.q.low{background:#fff;color:#2b3140;border-color:#b98a4e}#pt-badge.q.launch{min-width:44px;justify-content:center;padding:4px 10px;font-size:14px}' +
    '#pt-toast.q{transform:translate(-50%,0);opacity:0;visibility:hidden;transition:opacity .15s linear,visibility 0s .15s;background:#fff;color:#2b3140;border:1px solid #d9d3c7;border-radius:14px;padding:9px 14px;font-weight:600;font-size:15px;line-height:1.35;box-shadow:0 2px 8px rgba(43,49,64,.14)}' +
    '#pt-toast.q.show{opacity:1;visibility:visible;transition:opacity .15s linear}' +
    '#pt-lock.q .star,#pt-lock.q .z,#pt-lock.q .breath{animation:none}' +
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
    '#pt-panel .link{background:none;min-height:44px;text-decoration:underline;color:#7a5a3a;font-size:14px}' +
    '#pt-panel .sec{background:#fff;border:1px solid #eadfcd;border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:6px}#pt-panel .sec .st{font-size:13px;font-weight:800;color:#7a5a3a;text-align:start}#pt-panel .sec .stat{padding:6px}' +
    '#pt-panel .cols{display:flex;flex-direction:column;gap:8px}#pt-panel .cols>div{display:flex;flex-direction:column;gap:8px;min-width:0}' +
    '@media (min-width:760px){#pt-panel .card.wide{width:min(94vw,760px)}#pt-panel .cols{display:grid;grid-template-columns:1fr 1fr;align-items:start}}' +
    '#pt-panel .pvh{font-size:13px;line-height:1.35;color:#6b5238;text-align:start}#pt-panel .stat.pvt{font-size:13.5px;line-height:1.35;text-align:start}#pt-panel .pvt b{font-size:13.5px}#pt-panel .pvb{display:grid;grid-template-columns:1fr 1fr;gap:6px}#pt-panel .pvb button{font-size:14.5px;padding:4px 6px;min-width:0}';

  var badge, toast, lockEl, panelEl, toastTimer;
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function dir() { return plang() === 'he' ? 'rtl' : 'ltr'; }
  function setupUI() {
    if (badge) return;
    document.head.appendChild(el('style', {id: 'pt-style'}, css));
    badge = el('div', {id: 'pt-badge', role: IS_LAUNCHER ? 'button' : 'status', 'aria-live': 'off'});
    if (IS_LAUNCHER) { badge.className = 'launch'; badge.addEventListener('click', function () { openPanel(); }); }
    toast = el('div', {id: 'pt-toast', role: 'alert'});
    document.body.appendChild(badge); document.body.appendChild(toast);
    render();
  }
  function calm() { try { return localStorage.getItem('annabelle-calm') !== '0'; } catch (e) { return true; } }
  // calm mode: the badge is hidden most of the time. A tap on the page's header shows it for a few seconds when a parent set a limit.
  var peekUntil = 0, wasShown = false;
  function explicitLimit() { var raw = rd(KPAR, {}); return raw.limit >= MIN_LIMIT && raw.limit <= MAX_LIMIT; }
  function peek(ms) { ms = ms > 0 ? ms : 5000; peekUntil = Date.now() + ms; renderBadge(); setTimeout(renderBadge, ms + 60); }
  document.addEventListener('click', function (e) {
    try { if (!IS_LAUNCHER && calm() && !locked && e.target && e.target.closest && e.target.closest('header,.top,.hdr,.hud,h1') && !(panelEl && panelEl.contains(e.target)) && explicitLimit()) peek(5000); } catch (x) {}
  }, true);
  window.addEventListener('annabelle-calm', function () { wasShown = false; render(); });
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
    renderBadge0();
    // the home page hides a parents pill that shows no time ('#pt-badge.launch.free', its own rule: no digit = nothing to tell): keep that mark fresh every second
    try { if (badge && IS_LAUNCHER) badge.classList.toggle('free', !/\d/.test(badge.textContent || '')); } catch (e) {}
  }
  function renderBadge0() {
    if (!badge) return; var s = play(), p = par(), l = left(s, p);
    var q = calm(); if (badge.classList.contains('q') !== q) { badge.classList.toggle('q', q); badge.classList.remove('tuck'); clearTimeout(peekT); peekT = 0; peekStep = -1; wasShown = false; }
    if (q) {                               // calm: only when it matters (the last 10 minutes), in whole minutes, without sliding in and out
      var soon = !p.free && l <= 600, lbl = t('left') + ' ' + Math.max(1, Math.ceil(l / 60)) + ' ' + t('min');
      badge.classList.toggle('low', !p.free && l <= 300);
      if (IS_LAUNCHER) { badge.style.display = locked ? 'none' : ''; badge.textContent = (soon ? '⏰ ' + Math.max(1, Math.ceil(l / 60)) + '′ ' : '') + '⚙️'; badge.title = t('panel'); badge.setAttribute('aria-label', t('panel') + (soon ? ' · ' + lbl : '')); return; }
      var show = !locked && !p.free && (soon || peekUntil > Date.now());
      badge.style.display = show ? '' : 'none';
      if (show) { badge.textContent = '⏰ ' + Math.max(1, Math.ceil(l / 60)) + '′'; badge.title = lbl; badge.setAttribute('aria-label', lbl); if (!wasShown) placeBadge(); }
      wasShown = show; return;
    }
    if (p.free) { badge.textContent = IS_LAUNCHER ? '⚙️' : ''; badge.title = ''; badge.style.display = IS_LAUNCHER ? '' : 'none'; return; }
    badge.style.display = '';
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
    var q = calm();
    if (!toast) return; toast.textContent = msg; toast.dir = plang() === 'he' ? 'rtl' : 'ltr'; toast.classList.toggle('q', q); toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('show'); }, q ? 8000 : 6000);
    if (q) return;                         // calm: one still card, no sound
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
      '<h2>' + esc(g3(T[l][key][0])) + '</h2><p>' + esc(g3(T[l][key][1])) + '</p>' + '</div>' +
      '<button id="pt-plink" type="button">🔒 ' + esc(t('parentLink')) + '</button>';
    lockEl.dataset.reason = reason; lockEl.classList.toggle('q', calm());
    lockEl.querySelector('#pt-plink').addEventListener('click', function (e) { e.stopPropagation(); openPanel(); });
  }
  function applyLock() {
    var r = lockReason(), want = !!r;
    if (want && !locked) { locked = true; freeze(); }
    if (want) { var lk = L() + gen(); if (!lockEl || lockEl.dataset.reason !== r || lockEl.dataset.lang !== lk) { renderLock(r); lockEl.dataset.lang = lk; } }
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
        if (!p.free && l <= w && l > 0 && !s[f] && limitSec(s, p) > w) { s[f] = 1; if (i === 0) s.w5 = 1; showToast(warnText(f)); }
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
      '<div class="pad">' + keys.map(function (k) { return '<button type="button" data-k="' + k + '"' + (k === '⌫' ? ' aria-label="' + esc(t('del')) + '"' : k === '✓' ? ' aria-label="' + esc(t('ok')) + '"' : '') + '>' + k + '</button>'; }).join('') + '</div>' +
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
    var card = shell('🧮 ' + esc(t('math')), '<div class="ptbig" dir="ltr">' + a + ' × ' + b + ' = ?</div><input type="number" inputmode="numeric" autocomplete="off" aria-label="' + esc(t('answer')) + '"><div class="msg"></div>' +
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
    ['mathquest','🧮','מסע החשבון',/^annabelle-mathquest/],['wordcity','🔤','עיר המילים',/^annabelle-wordcity/],['sciencelab','🔬','מעבדת המדע',/^annabelle-sciencelab/],['dogrun','🐕','מרוץ הכדור של הכלבים',/^annabelle-dogrun/],['critters','🐾','עולם היצורים',/^annabelle-critters/],['bagrut','🎓','מסלול הבגרות',/^annabelle-bagrut/],['reading','📖','סולם הקריאה',/^annabelle-reading/],['thinking','🧩','חידות חשיבה',/^annabelle-thinking/],['city','🏙️','עיר החתולים',/^annabelle-city/]];
  var RGN = { // [fr, en]: the titles of the games (the Hebrew list above keeps its short parent wording)
    bubbles: ['Bulles de chats', 'Cat Bubbles'], cats: ['Mémoire des chats', 'Cat Memory'], checkers: ['Dames des chats', 'Cat Checkers'], cups: ['Où est la balle ?', 'Cup Shuffle'], digrod: ['La Canne Muscle', 'Muscle Rod Dig'],
    escape: ['Évasion de la cabane', 'Treehouse Escape'], fishing: ['La pêche', 'Fishing Trip'], fishy: ['Petit Poisson Gourmand', 'Hungry Fishy'], football: ['Foot des chats', 'Cat Football'], hiddencats: ['Trouve les chats', 'Find the Cats'],
    hole: ['Le Gouffre Gourmand', 'Hungry Hole'], kitchen: ['Le Resto des Chats', 'Cat Kitchen'], lionking: ['Aventure du petit lion', "Little Lion's Adventure"], magic: ['Magie des cartes', 'Card Magic'], magic2: ['Magie des chats', 'Magic Cats'],
    minesweeper: ['Jardin des chats', 'Cat Garden'], pacman: ['Le tigre gourmand', 'Hungry Tiger'], runner: ['Course dans la savane', 'Savanna Run'], runner3d: ['Savane 3D', 'Savanna Run 3D'], soya: ['Soya le chat', 'Soya the Cat'],
    soyahome: ['Soya à la maison', 'Soya at Home'], streetcats: ['Chats du quartier', 'Street Cats'], thunderkittens: ['Guerriers de la Foudre', 'Lightning Kittens'], tictactoe: ['Morpion des chats', 'Cat Tic-Tac-Toe'],
    towerdefense: ['Gardiens de la tanière', 'Tiger Den Defense'], bowling: ['Bowling des chats', 'Bowling Cats'], invaders: ['Envahisseurs', 'Space Rescue'], tetris: ['Tetris des chats', 'Kitty Blocks'], breakout: ['Casse-cages', 'Cage Breaker'],
    snake: ['Queue de tigre', 'Tiger Tail'], crossing: ['Passage des animaux', 'Animal Crossing'], pong: ['Ping-pong des pattes', 'Paw Pong'], safari: ['Safari photo', 'Photo Safari'], simon: ['La chorale des animaux', 'Animal Choir'],
    funrun: ['La course aux farces', 'Prank Race'], carrace: ['Course de karts des chats', 'Kitty Kart Race'], mathquest: ['La quête des maths', 'Math Quest'], wordcity: ['La ville des mots', 'Word City'],
    sciencelab: ['Le labo des sciences', 'Science Lab'], critters: ["Le monde des créatures", 'Critter World'], bagrut: ["Objectif Bagrout", 'Bagrut Track'], reading: ["L'échelle de lecture", 'Reading Ladder'],
    thinking: ["Défis de logique", 'Thinking Lab'], city: ["Chat-Ville", 'Kitty City']};
  function rgName(g) { var l = plang(), n = RGN[g[0]]; return l === 'he' || !n ? g[2] : n[l === 'fr' ? 0 : 1]; }
  var KEEPK = /^annabelle-(lang|muted|music|turn|desk|installed|pwa.*|playtime|parent|launcher|profiles|profdata-.*|device|tq|telemetry|say|saytest|family.*)$/;
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
    var card = shell('🗑️ ' + esc(t('rst')),
      '<div class="stat" style="font-size:14px">' + esc(t('rstInfo')) + '</div>' +
      '<label class="row" style="font-weight:800"><input type="checkbox" data-all style="flex:none;width:22px;height:22px"><span class="lbl">' + esc(t('rstAll')) + '</span></label>' +
      '<div data-list style="display:grid;grid-template-columns:1fr 1fr;gap:4px;max-height:42dvh;overflow:auto">' + RG.map(function (g) { return '<label style="display:flex;align-items:center;gap:6px;font-size:15px;padding:4px"><input type="checkbox" data-g="' + g[0] + '" style="flex:none;width:20px;height:20px"><span>' + g[1] + ' ' + esc(rgName(g)) + '</span></label>'; }).join('') + '</div>' +
      '<div class="msg" data-m></div>' +
      '<div class="row"><button type="button" class="pri" data-a="go" style="background:#c0392b">' + esc(t('rstGo')) + '</button><button type="button" class="soft" data-a="cancel">' + esc(t('back')) + '</button></div>');
    var all = card.querySelector('[data-all]'), boxes = [].slice.call(card.querySelectorAll('[data-g]')), msg = card.querySelector('[data-m]'), step = 0;
    all.onchange = function () { boxes.forEach(function (b) { b.checked = false; b.disabled = all.checked; }); };
    card.querySelector('[data-a=cancel]').onclick = function () { showPanel('', fromMath); };
    var go = card.querySelector('[data-a=go]');
    go.onclick = function () {
      var ids = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.getAttribute('data-g'); });
      if (!all.checked && !ids.length) { msg.textContent = t('rstNone'); return; }
      if (step === 0) { step = 1; msg.textContent = all.checked ? t('rstSureAll') : t('rstSure').replace('{n}', ids.length); go.textContent = t('rstYes'); return; }
      aud('progress_reset', all.checked ? 'all' : ids.join(',').slice(0, 120), {all: all.checked, games: ids, count: ids.length});
      doReset(ids, all.checked); msg.className = 'msg ok'; msg.textContent = t('rstDone'); go.disabled = true; setTimeout(function () { location.reload(); }, 900);
    };
  }
  /* ---------- parent: evidence note, learning time today, privacy & personalisation (he / fr / en, follows 'annabelle-lang') ---------- */
  var PX = {
    he: {ev: '💡 מחקרים מראים ש־10–15 דקות ממוקדות ביום מספיקות לילדים צעירים. המגבלות שקבעתם נשמרות תמיד — שום דבר במשחקים לא דוחף לשחק מעבר להן.',
      sToday: 'היום', sMore: 'עוד הגדרות', lt: '📚 זמן למידה היום', min: 'דק׳', back: 'חזרה', saved: 'נשמר ✓', ltDone: '✔ מספיק להיום', open: '🔒 פרטיות והתאמה אישית', title: 'פרטיות והתאמה אישית',
      dev: '<b>מה נשמר במכשיר:</b> השם, הגיל, ההתקדמות, המטבעות וההגדרות — רק בדפדפן הזה. אין חשבון, אין פרסומות.',
      sent: '<b>מה נשלח, באופן אנונימי:</b> מזהה אקראי, גיל, מגדר ואירועי שימוש (איזה משחק נפתח, שלב, משך). השם אף פעם לא נשלח.',
      tel: 'נתוני שימוש אנונימיים', on: 'פעיל', off: 'כבוי',
      diff: '<b>התאמת הקושי:</b> רמת המשחקים מתאימה את עצמה רק כדי שהילדים ילמדו ברמה שנכונה להם. היא נקבעת במכשיר, מהחימום הקצר ומהתשובות במשחקים — לא לצורך פרסום ולא לבניית פרופיל.',
      band: 'התאמת התצוגה לגיל (לשחקן הנוכחי)', b: {'': 'אוטומטי', little: 'צעירים 4–7', kid: 'רגילה', teen: 'נוער 11+'},
      bandH: 'אוטומטי = לפי הגיל שבפרופיל. לצעירים התצוגה רגועה יותר (החיה והמדבקות, בלי מספרי מטבעות); לנוער — נקייה יותר, עם תצוגת כישורים. המטבעות וההתקדמות נצברים תמיד, בכל תצוגה.'},
    fr: {ev: '💡 Les études montrent que 10 à 15 minutes concentrées par jour suffisent aux jeunes enfants. Les limites que vous fixez sont toujours respectées : rien dans les jeux ne pousse à jouer plus longtemps.',
      sToday: 'Aujourd’hui', sMore: 'Autres réglages', lt: '📚 Temps d’apprentissage aujourd’hui', min: 'min', back: 'Retour', saved: 'Enregistré ✓', ltDone: '✔ assez pour aujourd’hui', open: '🔒 Confidentialité et personnalisation', title: 'Confidentialité et personnalisation',
      dev: '<b>Ce qui reste sur l’appareil :</b> le prénom, l’âge, la progression, les pièces et les réglages, uniquement dans ce navigateur. Pas de compte, pas de publicité.',
      sent: '<b>Ce qui est envoyé, de façon anonyme :</b> un identifiant aléatoire, l’âge, le genre et des événements d’utilisation (jeu ouvert, niveau, durée). Le prénom n’est jamais envoyé.',
      tel: 'Données d’utilisation anonymes', on: 'Activé', off: 'Désactivé',
      diff: '<b>Difficulté adaptée :</b> le niveau des jeux s’ajuste uniquement pour que l’enfant apprenne à son niveau. Il est calculé sur l’appareil, à partir du petit échauffement et des réponses dans les jeux, jamais pour de la publicité ni pour établir un profil.',
      band: 'Adapter la présentation à l’âge (joueur actuel)', b: {'': 'Automatique', little: 'Petits 4–7', kid: 'Classique', teen: 'Ados 11+'},
      bandH: 'Automatique = selon l’âge du profil. Pour les petits, l’affichage est plus calme (le compagnon et les autocollants, sans compteurs de pièces) ; pour les ados, plus sobre, avec une vue des compétences. Les pièces et la progression continuent de compter dans tous les cas.'},
    en: {ev: '💡 Research shows that 10–15 focused minutes a day are enough for young children. The limits you set are always respected: nothing in the games pushes for longer play.',
      sToday: 'Today', sMore: 'More settings', lt: '📚 Learning time today', min: 'min', back: 'Back', saved: 'Saved ✓', ltDone: '✔ plenty for today', open: '🔒 Privacy & personalisation', title: 'Privacy & personalisation',
      dev: '<b>Stored on this device:</b> the name, age, progress, coins and settings, in this browser only. No account, no ads.',
      sent: '<b>Sent, anonymously:</b> a random id, age, gender and usage events (which game was opened, level, duration). The name is never sent.',
      tel: 'Anonymous usage data', on: 'On', off: 'Off',
      diff: '<b>Adapted difficulty:</b> the level of the games adjusts only to help the child learn at the right level. It is worked out on the device, from the short warm-up and the answers in the games, never for advertising or profiling.',
      band: 'Adapt the presentation to age (current player)', b: {'': 'Automatic', little: 'Little 4–7', kid: 'Classic', teen: 'Teen 11+'},
      bandH: 'Automatic = from the age in the profile. For little ones the display is calmer (the pet and stickers, no coin counters); for teens it is cleaner, with a skills view. Coins and progress keep counting in every mode.'}
  };
  function plang() { var l = null; try { l = localStorage.getItem('annabelle-lang'); } catch (e) {} return l === 'fr' || l === 'en' ? l : 'he'; }
  function px(k) { return PX[plang()][k]; }
  function telOn() { try { return localStorage.getItem('annabelle-telemetry') !== '0'; } catch (e) { return true; } }
  function bandPref() {
    try { var R = window.AnnabelleRewards; if (R && R.bandPref) return R.bandPref(); } catch (e) {}
    var b = rd('annabelle-rewards', {}).band; return b === 'little' || b === 'kid' || b === 'teen' ? b : '';
  }
  function setBand(b) { // per profile: kept in the rewards save of the current player
    try { var R = window.AnnabelleRewards; if (R && R.setBand) { R.setBand(b); return; } } catch (e) {}
    var o = rd('annabelle-rewards', null) || {}; o.band = b; wr('annabelle-rewards', o);
  }
  function learnMin() { // minutes on the learning pages today (measured by rewards.js)
    try { var R = window.AnnabelleRewards; if (R && R.learnToday) { var x = R.learnToday(); return {min: x.min, done: x.done}; } } catch (e) {}
    var lt = rd('annabelle-rewards', {}).lt, s = lt && lt.d === today() && lt.s > 0 ? Math.floor(lt.s) : 0; return {min: Math.floor(s / 60), done: s >= 600};
  }
  function privacyScreen(fromMath, note) {
    var on = telOn(), bp = bandPref(), ltr = plang() !== 'he';
    var card = shell('🔒 ' + esc(px('title')),
      '<div class="stat pvt">' + px('dev') + '</div><div class="stat pvt">' + px('sent') + '</div>' +
      '<div class="row"><span class="lbl">' + esc(px('tel')) + '</span><button type="button" data-a="tel" aria-pressed="' + on + '" class="' + (on ? 'pri' : 'soft') + '">' + esc(on ? px('on') : px('off')) + '</button></div>' +
      '<div class="stat pvt">' + px('diff') + '</div>' +
      '<div class="lbl" style="flex:none">' + esc(px('band')) + '</div><div class="row pvb">' + ['', 'little', 'kid', 'teen'].map(function (b) {
        return '<button type="button" data-b="' + b + '" aria-pressed="' + (bp === b) + '" class="' + (bp === b ? 'pri' : 'soft') + '">' + esc(px('b')[b]) + '</button>'; }).join('') + '</div>' +
      '<div class="pvh">' + esc(px('bandH')) + '</div><div class="msg ok">' + esc(note || '') + '</div>' +
      '<div class="row"><button type="button" class="soft" data-a="back">' + esc(px('back')) + '</button></div>');
    card.setAttribute('dir', ltr ? 'ltr' : 'rtl'); card.setAttribute('data-s', 'privacy');
    card.querySelector('[data-a=tel]').onclick = function () {
      var now = !telOn();
      try { if (now) localStorage.removeItem('annabelle-telemetry'); else localStorage.setItem('annabelle-telemetry', '0'); } catch (e) {}
      if (now) aud('privacy_changed', 'telemetry', {on: true}); // switching it off sends nothing, not even this
      privacyScreen(fromMath, px('saved'));
    };
    card.querySelectorAll('[data-b]').forEach(function (b) { b.onclick = function () {
      var v = b.getAttribute('data-b'); setBand(v); aud('band_changed', 'presentation', {band: v || 'auto'}); privacyScreen(fromMath, px('saved')); }; });
    card.querySelector('[data-a=back]').onclick = function () { showPanel('', fromMath); };
  }
  function showPanel(note, fromMath) {
    var s = play(), p = par(), r = lockReason(), playedMin = Math.floor(s.seconds / 60), bed = p.bed, lm = learnMin();
    var lockedNow = r === 'parent' || r === 'bed';
    // five clear sections, one main action in each: today · daily limit · lock · bedtime · more
    var sec = function (title, body) { return '<div class="sec">' + (title ? '<div class="st">' + esc(title) + '</div>' : '') + body + '</div>'; };
    var card = shell('⚙️ ' + esc(t('panel')),
      '<div class="cols"><div>' +
      sec(px('sToday'), '<div class="stat">' + esc(t('played')) + ': <b>' + playedMin + '</b> ' + esc(t('min')) + ' ' + esc(t('of')) + ' ' + Math.round(limitSec(s, p) / 60) + ' · ' + esc(t('left')) + ' <b>' + Math.ceil(left(s, p) / 60) + '</b></div>' +
        '<div class="row"><button type="button" class="pri" data-a="bonus">' + esc(t('plus')) + '</button><button type="button" class="soft" data-a="reset">' + esc(t('reset')) + '</button></div>') +
      sec('', '<div class="row"><span class="lbl">' + esc(t('limit')) + '</span><button type="button" class="soft" data-a="minus" aria-label="-5">−5</button><span class="ptbig" data-v="limit">' + p.limit + '</span><button type="button" class="soft" data-a="plus5" aria-label="+5">+5</button></div>') +
      sec('', '<button type="button" class="dark" data-a="lock">' + esc(lockedNow ? t('unlock') : t('lock')) + '</button>') +
      '</div><div>' +
      sec('', '<div class="row"><span class="lbl">🌙 ' + esc(t('bedtime')) + '</span><button type="button" data-a="bed" aria-pressed="' + !!bed.on + '" class="' + (bed.on ? 'pri' : 'soft') + '">' + esc(bed.on ? t('on') : t('off')) + '</button></div>' +
        '<div class="row" dir="ltr"><input type="time" data-a="from" value="' + esc(bed.from) + '" aria-label="' + esc(t('from')) + '"><span style="flex:0">→</span><input type="time" data-a="to" value="' + esc(bed.to) + '" aria-label="' + esc(t('to')) + '"></div>') +
      sec(px('sMore'), '<div class="row"><button type="button" class="soft" data-a="priv">' + esc(px('open')) + '</button></div>' +
        '<div class="row"><button type="button" class="soft" data-a="rst">🗑️ ' + esc(t('rst')) + '</button><button type="button" class="' + (fromMath ? 'pri' : 'soft') + '" data-a="pin">' + esc(fromMath ? t('newpin') : t('chpin')) + '</button></div>') +
      '</div></div>' +
      '<div class="msg ok">' + esc(note || '') + '</div>' +
      '<div class="pvh" data-v="learn" dir="' + (plang() === 'he' ? 'rtl' : 'ltr') + '">' + (lm.min > 0 ? '<b>' + esc(px('lt')) + ': ' + lm.min + ' ' + esc(px('min')) + (lm.done ? ' · ' + esc(px('ltDone')) : '') + '</b><br>' : '') + esc(px('ev')) + '</div>' +
      '<div class="row"><button type="button" class="soft" data-a="done">' + esc(t('close')) + '</button></div>');
    card.classList.add('wide');
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
    card.querySelector('[data-a=priv]').onclick = function () { privacyScreen(fromMath); };
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
    // vibe.js (the WebGL ambience, 40 KB) never boots in calm mode (the site default), so it is not even downloaded then;
    // it is fetched the first time the 'annabelle-calm' event turns calm off (see the listener below).
    var calmNow = true; try { calmNow = localStorage.getItem('annabelle-calm') !== '0'; } catch (e) {}
    var mods = ['kid.js', 'telemetry.js', 'feedback.js', 'juice.js'], wrote = false;
    if (!calmNow) mods.splice(3, 0, 'vibe.js');
    function loadVibe() {
      if (window.Vibe || window.__vibeAsked) return; window.__vibeAsked = 1;
      try { var s = document.createElement('script'); s.src = base + 'vibe.js'; (document.head || document.documentElement).appendChild(s); } catch (e) {}
    }
    try { window.addEventListener('annabelle-calm', function () { var c = true; try { c = localStorage.getItem('annabelle-calm') !== '0'; } catch (e) {} if (!c) loadVibe(); }); } catch (e) {}
    try {
      if (me && document.currentScript === me && document.readyState === 'loading' && !me.async && !me.defer && me.type !== 'module') {
        document.write('<script src="' + base + 'kid.js"><\/script><script src="' + base + 'telemetry.js"><\/script><script src="' + base + 'feedback.js" defer><\/script>' + (calmNow ? '' : '<script src="' + base + 'vibe.js" defer><\/script>') + '<script src="' + base + 'juice.js" defer><\/script>');
        wrote = true;
      }
    } catch (e) {}
    if (!wrote) mods.forEach(function (f) {
      try { var s = document.createElement('script'); s.src = base + f; s.async = false; (document.head || document.documentElement).appendChild(s); } catch (e) {}
    });
  })();

  window.AnnabellePlaytime = {DEFAULT_LIMIT_MIN: DEFAULT_LIMIT_MIN, left: function () { return left(); }, reason: lockReason, isLocked: function () { return locked; }, openPanel: openPanel, tick: tick, render: render, peek: peek, calm: calm};
})();

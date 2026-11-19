/* juice.js – the shared "game feel" layer of every page (loaded, deferred, by playtime.js; needs rewards.js, tolerates everything else missing).
   What it does:
     · a tiny floating PLAYER CHIP (avatar + level ring + coins, pet, brain-boost tag) that appears for a moment when coins / XP are earned and
       tucks away again. It never takes a tap (pointer-events:none) and looks for a free corner so it does not cover buttons.
       On the home page and in the album the existing counters are used instead of the chip.
     · +coin / +XP particles that fly to the chip (or to the home counter)
     · a full LEVEL-UP celebration on any page (confetti, rank, what unlocked). It is only shown at calm moments: when the game calls
       AnnabelleRewards.flush() (result / menu cards) or when the next page opens – never in the middle of a round.
     · a small UI sound kit (WebAudio), haptics (navigator.vibrate) – both silent when 'annabelle-muted' is '1' –
       and pulses / bursts on window.Vibe (the WebGL background) when it is there.
   Presentation bands (AnnabelleRewards.band(), from the kid's age; a parent can fix one): "little" 4-7 = calm and play-first: no flying coins, no sound on every
   earn, no level-up screen; the chip only comes with a banner and shows avatar + pet + stars. "teen" 11-18 = a cleaner chip (level, coins, streak), fewer particles,
   a quieter level-up card. "kid" (8-10 and unknown age) = the classic behaviour.
   Parents' play-time limits always win: nothing is shown while the play-time lock is up.  prefers-reduced-motion: no particles, no confetti.
   API: window.Juice = { sfx(name), buzz(pattern), levelUp(level), confetti(n), burst(x, y), chip() }   sfx names: earn boost level quest badge chest pet tap */
(function () {
  'use strict';
  var W = window, D = document;
  if (W.Juice) return;
  var R = null, page = location.pathname.split('/').pop() || 'index.html', HOME = page === 'index.html', ALBUM = page === 'album.html';
  var rmq = null; try { rmq = W.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) {}
  function calm() { return !!(rmq && rmq.matches); }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function muted() { return ls('annabelle-muted') === '1'; }
  function lang() { var l = ls('annabelle-lang'); return l === 'fr' || l === 'en' ? l : 'he'; }
  function locked() { try { return !!(W.AnnabellePlaytime && W.AnnabellePlaytime.isLocked()); } catch (e) { return false; } }
  function G(f, m, x) { var K = W.KidApp; return K && K.g ? K.g(f, m, x) : f; }
  function band() { try { return R && R.band ? R.band() : 'kid'; } catch (e) { return 'kid'; } }
  var TX = {
    he: {lv: 'רמה {n}!', up: G('עלית רמה!', 'עלית רמה!', 'עולים רמה!'), rank: 'תואר חדש: {t}', th: '🎨 ערכת נושא חדשה: {t}', use: '🎨 לעבור לערכת {t}', used: '✔ הערכה תחכה לך בעמוד הבית',
      pet: '🐾 {t} — החיה שלך גדלה!', next: 'ברמה {n} נפתח: {t}', nextR: 'ברמה {n}: התואר {t}', yes: 'יש! 🎉', ok: 'ממשיכים', chip: 'רמה {n}',
      themes: {ocean: 'אוקיינוס', jungle: 'ג׳ונגל', sunset: 'שקיעה', galaxy: 'גלקסיה', gold: 'זהב'}},
    fr: {lv: 'Niveau {n} !', up: 'Tu montes de niveau !', rank: 'Nouveau titre : {t}', th: '🎨 Nouveau thème : {t}', use: '🎨 Utiliser le thème {t}', used: '✔ Le thème t’attend sur la page d’accueil',
      pet: '🐾 {t} — ton compagnon a grandi !', next: 'Au niveau {n} : {t}', nextR: 'Au niveau {n} : le titre {t}', yes: 'Youpi ! 🎉', ok: 'Continuer', chip: 'Niveau {n}',
      themes: {ocean: 'Océan', jungle: 'Jungle', sunset: 'Coucher de soleil', galaxy: 'Galaxie', gold: 'Or'}},
    en: {lv: 'Level {n}!', up: 'Level up!', rank: 'New title: {t}', th: '🎨 New theme: {t}', use: '🎨 Switch to {t}', used: '✔ The theme is waiting on the home page',
      pet: '🐾 {t} — your pet grew!', next: 'Level {n} unlocks: {t}', nextR: 'Level {n}: the title {t}', yes: 'Yay! 🎉', ok: 'Continue', chip: 'Level {n}',
      themes: {ocean: 'Ocean', jungle: 'Jungle', sunset: 'Sunset', galaxy: 'Galaxy', gold: 'Gold'}}
  };
  function t(k) { return (TX[lang()] || TX.he)[k]; }
  function F(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : ''; }); }
  var THEMES = [['ocean', '🌊', 3], ['jungle', '🌴', 5], ['sunset', '🌅', 8], ['galaxy', '✨', 12], ['gold', '👑', 16]]; // same levels as the home page
  function el(tag, cls, txt) { var e = D.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  /* ---------- gestures (sound and vibration only after the kid touched the page) ---------- */
  var gest = false, lastPt = null;
  function onPt(e) { gest = true; if (e && e.clientX != null) lastPt = {x: e.clientX, y: e.clientY, t: Date.now()}; }
  W.addEventListener('pointerdown', onPt, true); W.addEventListener('keydown', function () { gest = true; }, true);

  /* ---------- sound kit ---------- */
  var SFX = {
    earn: [[880, 0, .07, 'triangle', .05], [1320, .07, .1, 'triangle', .05]],
    boost: [[660, 0, .08, 'square', .03], [990, .07, .08, 'square', .03], [1480, .14, .16, 'triangle', .05]],
    quest: [[659, 0, .1, 'triangle', .08], [880, .1, .1, 'triangle', .08], [1175, .2, .22, 'triangle', .08]],
    badge: [[523, 0, .12, 'triangle', .09], [659, .11, .12, 'triangle', .09], [784, .22, .12, 'triangle', .09], [1047, .33, .34, 'triangle', .1], [1568, .36, .3, 'sine', .04]],
    level: [[523, 0, .11, 'triangle', .1], [659, .1, .11, 'triangle', .1], [784, .2, .11, 'triangle', .1], [1047, .3, .16, 'triangle', .1], [784, .46, .1, 'triangle', .08], [1047, .56, .5, 'triangle', .11], [2093, .6, .45, 'sine', .04]],
    chest: [[196, 0, .14, 'sine', .12], [392, .12, .1, 'triangle', .08], [784, .22, .12, 'triangle', .08], [1175, .32, .3, 'triangle', .08]],
    pet: [[988, 0, .08, 'sine', .07], [1319, .09, .08, 'sine', .07], [1175, .18, .16, 'sine', .07]],
    tap: [[1200, 0, .04, 'triangle', .03]]
  };
  var lastS = {};
  function sfx(name) {
    try {
      var def = SFX[name]; if (!def || muted() || !gest || D.hidden) return;
      var now = Date.now(); if (now - (lastS[name] || 0) < (name === 'earn' ? 700 : 250)) return; lastS[name] = now;
      var AC = W.AudioContext || W.webkitAudioContext; if (!AC) return;
      var a = W.__arAC || (W.__arAC = new AC()); if (a.state === 'suspended') a.resume();
      var t0 = a.currentTime + .01;
      def.forEach(function (n) {
        var o = a.createOscillator(), g = a.createGain(); o.type = n[3]; o.frequency.value = n[0];
        g.gain.setValueAtTime(0, t0 + n[1]); g.gain.linearRampToValueAtTime(n[4], t0 + n[1] + .015); g.gain.exponentialRampToValueAtTime(.0008, t0 + n[1] + n[2] + .08);
        o.connect(g); g.connect(a.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + .1);
      });
    } catch (e) {}
  }
  function buzz(p) { try { if (gest && !muted() && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function vibe(strength, color, x, y) {
    try { var V = W.Vibe; if (!V) return; if (V.pulse) V.pulse(strength, color); if (x != null && V.burst) V.burst(x, y, color); } catch (e) {}
  }

  /* ---------- styles ---------- */
  var styled = false;
  function css() {
    if (styled) return; styled = true;
    var s = el('style');
    s.textContent =
      '#jz-chip{position:fixed;z-index:2147482500;pointer-events:none;display:flex;align-items:center;gap:7px;height:44px;padding:4px 12px 4px 4px;border-radius:24px;box-sizing:border-box;direction:ltr;' +
      'background:linear-gradient(135deg,#2a1d66f2,#4a2f9af2);color:#fff;font:800 14px/1.1 Rubik,"Varela Round",system-ui,Arial,sans-serif;box-shadow:0 4px 0 #0003,0 6px 18px #0005,inset 0 0 0 2px #ffffff30;' +
      'opacity:0;transform:translateY(-70px) scale(.8);transition:transform .38s cubic-bezier(.2,1.5,.4,1),opacity .22s;white-space:nowrap;max-width:calc(100vw - 16px)}' +
      '#jz-chip.b{transform:translateY(70px) scale(.8)}#jz-chip.on{opacity:1;transform:none}#jz-chip.bump .jz-co{animation:jzb .32s ease}' +
      '@keyframes jzb{40%{transform:scale(1.28)}}' +
      '.jz-ring{position:relative;width:36px;height:36px;border-radius:50%;flex:none;background:conic-gradient(#ffd24d calc(var(--p,0)*1%),#ffffff38 0);display:flex;align-items:center;justify-content:center}' +
      '.jz-av{width:30px;height:30px;border-radius:50%;overflow:hidden;display:block;background:#bfe5ff}.jz-av svg{width:30px;height:30px;display:block}' +
      '.jz-lv{position:absolute;bottom:-4px;right:-5px;min-width:17px;height:17px;padding:0 3px;border-radius:9px;background:#ff8a3d;color:#fff;font-size:11px;line-height:17px;text-align:center;box-shadow:0 0 0 2px #2a1d66;box-sizing:border-box}' +
      '.jz-tx{display:flex;flex-direction:column;gap:2px;align-items:flex-start}.jz-co{font-size:14px;display:inline-block}.jz-d{font-style:normal;font-size:11.5px;color:#ffe27a}' +
      '.jz-pet{width:28px;height:28px;flex:none;display:block}.jz-pet svg{width:28px;height:28px;display:block}.jz-bo{font-style:normal;font-size:11.5px;background:#38d39f;color:#06301f;border-radius:9px;padding:2px 6px;flex:none}' +
      '#jz-chip.lt .jz-lv,#jz-chip.lt .jz-d,#jz-chip.lt .jz-bo,#jz-chip.tn .jz-pet{display:none!important}#jz-chip.lt .jz-ring{background:#ffffff38}#jz-chip.lt{padding-right:8px}' +
      '#jz-chip.tn{border-radius:14px;background:#17142ff2;box-shadow:0 6px 18px #0006,inset 0 0 0 1px #ffffff40;font-weight:700}#jz-chip.tn .jz-lv{background:#7c6cff}#jz-chip.tn .jz-ring{background:conic-gradient(#8f7bff calc(var(--p,0)*1%),#ffffff30 0)}' +
      '#jz-lv.tn .jz-big{animation:none;font-size:56px}#jz-lv.tn .jz-card{border-radius:18px;background:linear-gradient(160deg,#2b2466,#17122f)}#jz-lv.tn .jz-btn{background:#7c6cff;color:#fff;border-radius:12px}' +
      '.jz-p{position:fixed;left:0;top:0;z-index:2147482490;pointer-events:none;font:900 15px/1 Rubik,system-ui,Arial,sans-serif;color:#ffe27a;text-shadow:0 1px 0 #0008,0 0 6px #0006;will-change:transform,opacity}' +
      '.jz-hit{animation:jzb .32s ease}' +
      '#jz-lv{position:fixed;inset:0;z-index:2147482800;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:radial-gradient(circle at 50% 40%,#3b2a9af7,#120a33fa);' +
      'font-family:Rubik,"Varela Round",system-ui,Arial,sans-serif;color:#fff;text-align:center;opacity:0;transition:opacity .25s;touch-action:manipulation}' +
      '#jz-lv.on{opacity:1}#jz-lv canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}' +
      '.jz-card{position:relative;width:min(100%,400px);max-height:100%;overflow:auto;padding:18px 18px 16px;border-radius:28px;background:linear-gradient(160deg,#5a45c8,#2c1e78);box-shadow:inset 0 0 0 2px #ffffff40,0 14px 40px #0008;transform:scale(.7);transition:transform .45s cubic-bezier(.2,1.5,.4,1)}' +
      '#jz-lv.on .jz-card{transform:none}.jz-big{font-size:76px;line-height:1.1;display:inline-block;animation:jzw 1.3s ease-in-out infinite}' +
      '@keyframes jzw{0%,100%{transform:rotate(0) scale(1)}30%{transform:rotate(-8deg) scale(1.12)}60%{transform:rotate(8deg) scale(1.12)}}' +
      '.jz-card small{display:block;font-size:14px;font-weight:800;letter-spacing:.04em;color:#ffe27a}.jz-card h2{margin:2px 0 6px;font-size:36px;font-weight:900;text-shadow:0 3px 0 #0004}' +
      '.jz-card p{margin:6px 0;font-size:16px;font-weight:800;line-height:1.3}.jz-card p.r{font-size:19px;color:#ffe27a}.jz-card p.n{font-size:13.5px;opacity:.8;font-weight:700}' +
      '.jz-btn{display:block;width:100%;min-height:50px;margin-top:10px;padding:8px 14px;border:0;border-radius:16px;font:inherit;font-weight:900;font-size:18px;color:#3a2100;background:linear-gradient(135deg,#ffd24d,#ff9a3d);box-shadow:0 4px 0 #0004;cursor:pointer}' +
      '.jz-btn.s{background:#ffffff26;color:#fff;font-size:15px;min-height:44px;box-shadow:none}.jz-btn:active{transform:translateY(2px)}' +
      '@media (max-height:520px){.jz-big{font-size:44px}.jz-card h2{font-size:26px}.jz-card{padding:10px 16px}}' +
      '@media (prefers-reduced-motion:reduce){#jz-chip,.jz-card{transition:opacity .2s;transform:none!important}.jz-big,#jz-chip.bump .jz-co,.jz-hit{animation:none}}';
    (D.head || D.documentElement).appendChild(s);
  }

  /* ---------- the player chip ---------- */
  var chip = null, parts = {}, hideT = 0, shown = 0;
  function buildChip() {
    if (chip) return chip; css();
    chip = el('div'); chip.id = 'jz-chip'; chip.setAttribute('aria-hidden', 'true');
    var ring = el('span', 'jz-ring'); parts.ring = ring; parts.av = el('span', 'jz-av'); parts.lv = el('b', 'jz-lv'); ring.appendChild(parts.av); ring.appendChild(parts.lv);
    var tx = el('span', 'jz-tx'); parts.co = el('b', 'jz-co'); parts.d = el('i', 'jz-d'); tx.appendChild(parts.co); tx.appendChild(parts.d);
    parts.pet = el('span', 'jz-pet'); parts.bo = el('em', 'jz-bo');
    chip.appendChild(ring); chip.appendChild(tx); chip.appendChild(parts.pet); chip.appendChild(parts.bo);
    D.body.appendChild(chip); return chip;
  }
  var avKey = '', petKey = '';
  function fillChip(delta) {
    var L = R.level(), b = R.boost ? R.boost() : {on: false}, a = JSON.stringify(R.avatar()), bd = band();
    chip.classList.toggle('lt', bd === 'little'); chip.classList.toggle('tn', bd === 'teen');
    if (a !== avKey) { avKey = a; parts.av.innerHTML = R.avatarSVG(30); } // markup built by rewards.js from its own fixed tables
    parts.lv.textContent = L.level; parts.ring.style.setProperty('--p', L.pct);
    if (bd === 'little') { parts.co.textContent = '⭐ ' + (R.stars ? R.stars() : 0); delta = ''; } // stars, not coin / XP numbers
    else { var sn = 0; if (bd === 'teen') try { sn = R.streak().n; } catch (e) {} parts.co.textContent = '💰 ' + R.coins() + (sn > 1 ? '  🔥 ' + sn : ''); }
    parts.d.textContent = delta || ''; parts.d.style.display = delta ? '' : 'none';
    if (R.pet) { var p = R.pet(), pk = p.kind + p.stage + p.mood; if (pk !== petKey) { petKey = pk; parts.pet.innerHTML = R.petSVG(28); } }
    else parts.pet.style.display = 'none';
    parts.bo.textContent = '🧠 ×2'; parts.bo.style.display = b.on ? '' : 'none';
  }
  // a corner where the chip covers no button (like the report button of feedback.js); the chip itself never takes a tap
  function hits() {
    var out = [], els = D.querySelectorAll('button,a[href],input,select,textarea,[role=button],[onclick],#fb-btn,.ar-toast.on,[data-juice-keep]');
    for (var i = 0; i < els.length && out.length < 160; i++) {
      var e = els[i]; if (chip && chip.contains(e)) continue;
      var r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > W.innerHeight || r.right < 0 || r.left > W.innerWidth) continue;
      if (r.width > W.innerWidth * .9 && r.height > W.innerHeight * .6) continue; // a full-screen tap layer is not a button
      var cs = W.getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || cs.pointerEvents === 'none' && e.id !== 'fb-btn' && !e.classList.contains('ar-toast')) continue;
      out.push(r);
    }
    return out;
  }
  function place() {
    var w = chip.offsetWidth || 170, h = 44, vw = W.innerWidth, vh = W.innerHeight, m = 8, H = hits(), best = null, bs = 1e9;
    var c = [['t', vw - w - m, m], ['t', m, m], ['t', (vw - w) / 2, m], ['t', vw - w - m, m + 76], ['t', m, m + 76], ['b', m, vh - h - m], ['b', vw - w - m, vh - h - m], ['b', (vw - w) / 2, vh - h - m], ['t', vw - w - m, vh * .3], ['t', m, vh * .3]];
    for (var i = 0; i < c.length; i++) {
      var x = c[i][1], y = c[i][2], n = 0;
      for (var j = 0; j < H.length; j++) { var r = H[j]; if (r.left < x + w + 4 && r.right > x - 4 && r.top < y + h + 4 && r.bottom > y - 4) n++; }
      if (n < bs) { bs = n; best = c[i]; if (!n) break; }
    }
    chip.style.left = Math.max(4, Math.round(best[1])) + 'px'; chip.style.top = Math.round(best[2]) + 'px';
    chip.classList.toggle('b', best[0] === 'b');
    return best;
  }
  function showChip(delta, ms) {
    if (!D.body || locked()) return null;
    buildChip(); fillChip(delta);
    if (!chip.classList.contains('on')) place();
    void chip.offsetWidth; chip.classList.add('on'); shown = Date.now();
    clearTimeout(hideT); hideT = setTimeout(function () { chip.classList.remove('on'); }, ms || 2600);
    return chip;
  }
  function bump(node, cls) { try { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); setTimeout(function () { node.classList.remove(cls); }, 400); } catch (e) {} }

  /* ---------- flying particles ---------- */
  function origin() {
    if (lastPt && Date.now() - lastPt.t < 2500) return {x: lastPt.x, y: lastPt.y};
    return {x: W.innerWidth / 2, y: W.innerHeight * .55};
  }
  function fly(n, glyph, target, done) {
    if (calm() || !target || !D.body || !D.body.animate) { if (done) done(); return; }
    css();
    var r = target.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2, o = origin(), left = n;
    for (var i = 0; i < n; i++) (function (i) {
      var p = el('span', 'jz-p', glyph), sx = o.x + (Math.random() - .5) * 46, sy = o.y + (Math.random() - .5) * 30, mx = (sx + tx) / 2 + (Math.random() - .5) * 90, my = Math.min(sy, ty) - 30 - Math.random() * 50;
      D.body.appendChild(p);
      var an = p.animate([
        {transform: 'translate(' + sx + 'px,' + sy + 'px) translate(-50%,-50%) scale(.3)', opacity: 0},
        {transform: 'translate(' + sx + 'px,' + (sy - 14) + 'px) translate(-50%,-50%) scale(1.15)', opacity: 1, offset: .18},
        {transform: 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%) scale(1)', opacity: 1, offset: .6},
        {transform: 'translate(' + tx + 'px,' + ty + 'px) translate(-50%,-50%) scale(.45)', opacity: .2}
      ], {duration: 620 + i * 70, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards'});
      var fin = function () { p.remove(); if (--left === 0 && done) done(); };
      an.onfinish = fin; an.oncancel = fin;
    })(i);
  }

  /* ---------- earn ---------- */
  var acc = {c: 0, x: 0, b: false}, accT = 0;
  function onEarn(ev) {
    acc.c += Math.max(0, +ev.coins || 0); acc.x += Math.max(0, +ev.xp || 0); acc.b = acc.b || !!ev.boost;
    clearTimeout(accT); accT = setTimeout(showEarn, 130);
  }
  function showEarn() {
    var a = acc; acc = {c: 0, x: 0, b: false};
    if ((a.c <= 0 && a.x <= 0) || locked() || !D.body) return;
    var bd = band(); if (bd === 'little') return; // play first: nothing flies and nothing rings on every earn (the coins still count)
    var delta = (a.c > 0 ? '+' + a.c + ' 💰' : '') + (a.x > a.c ? (a.c > 0 ? ' · ' : '') + '+' + a.x + ' XP' + (a.b ? ' 🧠' : '') : '');
    var target = HOME ? D.getElementById('pco') : ALBUM ? D.getElementById('coins') : null, n = Math.max(1, Math.min(bd === 'teen' ? 3 : 6, Math.ceil(Math.max(a.c, a.x / 2) / 3)));
    if (target) fly(n, a.b ? '✨' : '💰', target, function () { bump(target, 'jz-hit'); });
    else { var c = showChip(delta); if (c) fly(n, a.b ? '✨' : '💰', parts.co, function () { bump(chip, 'bump'); }); }
    sfx(a.b ? 'boost' : 'earn'); if (a.c >= 5) buzz(10);
  }

  /* ---------- confetti (own canvas, only while something falls) ---------- */
  function confetti(n, host) {
    if (calm()) return;
    var cv = el('canvas'); if (!host) { cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147482790'; host = D.body; }
    host.appendChild(cv);
    var ctx = cv.getContext('2d'), dpr = Math.min(2, W.devicePixelRatio || 1), w = W.innerWidth, h = W.innerHeight, ps = [], last = performance.now();
    cv.width = w * dpr; cv.height = h * dpr; ctx.scale(dpr, dpr);
    var cols = ['#ffe14d', '#ff6fb5', '#5ff0ff', '#7CFC8A', '#fff', '#ff8a3d', '#b79bff'];
    for (var i = 0; i < n; i++) ps.push({x: w / 2 + (Math.random() - .5) * w * .3, y: h * .38, vx: (Math.random() - .5) * 640, vy: -260 - Math.random() * 520, s: 5 + Math.random() * 7, c: cols[i % cols.length], r: Math.random() * 6, life: 2.6 + Math.random() * 1.6});
    (function tick(now) {
      var dt = Math.min(.05, (now - last) / 1000); last = now; ctx.clearRect(0, 0, w, h);
      ps = ps.filter(function (p) { p.vy += 900 * dt; p.vx *= 1 - 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 7; p.life -= dt; return p.life > 0 && p.y < h + 30; });
      ps.forEach(function (p) { ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s * (.45 + .55 * Math.abs(Math.sin(p.r)))); });
      if (ps.length && cv.isConnected) requestAnimationFrame(tick); else cv.remove();
    })(last);
  }

  /* ---------- level-up celebration ---------- */
  var lvEl = null, lvShown = 0, lvT = 0;
  function homeState() { try { var o = JSON.parse(ls('annabelle-home') || 'null'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function homeSet(k, v) { try { var o = homeState(); o[k] = v; localStorage.setItem('annabelle-home', JSON.stringify(o)); } catch (e) {} }
  function closeLv() {
    if (!lvEl) return; var e = lvEl; lvEl = null; clearTimeout(lvT);
    D.removeEventListener('keydown', lvKey, true); e.classList.remove('on'); setTimeout(function () { e.remove(); }, 260);
  }
  function lvKey(e) { if (!lvEl) return; if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); closeLv(); } }
  function levelUp(n) {
    try {
      if (!R || HOME || !D.body) return false; // the home page has its own sheet
      n = Math.floor(+n) || 0; var L = R.level(); n = Math.min(Math.max(n, 1), L.level);
      if (lvEl || n <= lvShown || locked()) return false;
      var bd = band();
      if (bd === 'little') { lvShown = n; R.ackLevel && R.ackLevel(); homeSet('lv', n); return false; } // the little ones see their pet grow instead
      lvShown = n; R.ackLevel && R.ackLevel();
      var seen = homeState().lv, from = typeof seen === 'number' && seen < n ? seen : n - 1;
      if (!(typeof seen === 'number' && seen >= n)) homeSet('lv', n); // the home page will not celebrate the same level again
      css();
      var rk = R.rankOf ? R.rankOf(n) : {level: 1, e: L.e, title: L.title}, box = el('div'), card = el('div', 'jz-card');
      box.id = 'jz-lv'; if (bd === 'teen') box.className = 'tn'; box.dir = lang() === 'he' ? 'rtl' : 'ltr'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', F(t('lv'), {n: n}));
      card.appendChild(el('span', 'jz-big', rk.e)); card.appendChild(el('small', null, t('up'))); card.appendChild(el('h2', null, F(t('lv'), {n: n})));
      card.appendChild(el('p', rk.level > from ? 'r' : null, rk.level > from ? F(t('rank'), {t: rk.title}) : rk.e + ' ' + rk.title));
      var un = THEMES.filter(function (x) { return x[2] > from && x[2] <= n; }), th = t('themes');
      if (un.length) card.appendChild(el('p', null, F(t('th'), {t: un.map(function (x) { return x[1] + ' ' + th[x[0]]; }).join(', ')})));
      try { var pg = R.pending('pet'); if (pg.length) card.appendChild(el('p', null, F(t('pet'), {t: R.pet().name}))); } catch (e) {}
      var nx = THEMES.filter(function (x) { return x[2] > n; })[0];
      if (!un.length && L.next && (!nx || L.next.level <= nx[2])) card.appendChild(el('p', 'n', F(t('nextR'), {n: L.next.level, t: L.next.e + ' ' + L.next.title})));
      else if (!un.length && nx) card.appendChild(el('p', 'n', F(t('next'), {n: nx[2], t: nx[1] + ' ' + th[nx[0]]})));
      var ok = el('button', 'jz-btn', bd === 'teen' ? t('ok') : t('yes')); ok.type = 'button'; ok.onclick = function (e) { e.stopPropagation(); closeLv(); };
      if (un.length) {
        var u = un[un.length - 1], ub = el('button', 'jz-btn s', F(t('use'), {t: th[u[0]]})); ub.type = 'button';
        ub.onclick = function (e) { e.stopPropagation(); homeSet('th', u[0]); ub.textContent = t('used'); ub.disabled = true; sfx('tap'); };
        card.appendChild(ub);
      }
      card.appendChild(ok); box.appendChild(card);
      box.addEventListener('click', function (e) { if (e.target === box) closeLv(); });
      ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach(function (k) { box.addEventListener(k, function (e) { e.stopPropagation(); }); });
      D.body.appendChild(box); lvEl = box; void box.offsetWidth; box.classList.add('on');
      D.addEventListener('keydown', lvKey, true);
      confetti(bd === 'teen' ? 50 : 150, box); sfx('level'); buzz([30, 50, 30, 50, 90]); vibe(1, '#ffd24d', W.innerWidth / 2, W.innerHeight * .4);
      try { ok.focus({preventScroll: true}); } catch (e) {}
      lvT = setTimeout(closeLv, 12000); // it never stays in the way
      try { W.KidApp && W.KidApp.track && W.KidApp.track('meta', {k: 'level', level: n, page: page}); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  /* ---------- banners of rewards.js: sound, haptics, background reaction ---------- */
  function onFlush(ev) {
    if (locked()) return;
    var x = W.innerWidth / 2, y = 60;
    if (ev.band === 'little') { // one soft sound, no confetti, no rumble; the chip (avatar, pet, stars) keeps the banner company
      if (ev.toasts) { sfx(ev.pet >= 0 || ev.back ? 'pet' : 'quest'); if (!HOME && !ALBUM) showChip('', 3600); setTimeout(function () { try { if (chip && chip.classList.contains('on')) place(); } catch (e) {} }, 520); }
      return;
    }
    if (ev.level && !HOME) return; // the celebration has its own fanfare
    if (ev.badges || ev.milestone) { sfx('badge'); buzz([20, 40, 20, 40, 60]); vibe(.9, '#ffd24d', x, y); if (!calm() && ev.badges && ev.band !== 'teen') confetti(60); }
    else if (ev.qall || ev.quests) { sfx('quest'); buzz([18, 30, 18]); vibe(.7, '#38d39f', x, y); }
    else if (ev.pet >= 0) { sfx('pet'); buzz(15); vibe(.6, '#ff9ec7', x, y); }
    else if (ev.boost) { sfx('boost'); buzz(15); vibe(.7, '#5ff0ff', x, y); }
    else if (ev.streak || ev.stickers || ev.road || ev.back) { sfx('quest'); buzz(12); vibe(.5, '#ff8a3d', x, y); }
    else if (ev.toasts) sfx('earn');
    if (!HOME && !ALBUM && ev.toasts && (ev.boost || ev.streak)) showChip('', 3200);
    if (ev.toasts) setTimeout(function () { try { if (chip && chip.classList.contains('on')) place(); } catch (e) {} }, 520); // make room for the banner
  }

  /* ---------- online play (for the "good friend" badge): a WebRTC connection that is up marks wins as online wins ---------- */
  function watchOnline() {
    try {
      var O = W.RTCPeerConnection; if (!O || O.__jz) return;
      var live = 0;
      var N = class extends O {
        constructor(a, b) {
          super(a, b);
          var on = false, self = this;
          this.addEventListener('connectionstatechange', function () {
            var st = self.connectionState;
            if (st === 'connected' && !on) { on = true; live++; } else if (on && (st === 'closed' || st === 'failed' || st === 'disconnected')) { on = false; live = Math.max(0, live - 1); }
            W.__arOnline = live > 0;
          });
        }
      };
      N.__jz = 1; W.RTCPeerConnection = N;
    } catch (e) {}
  }

  /* ---------- boot ---------- */
  var tries = 0;
  function boot() {
    R = W.AnnabelleRewards;
    if (!R || typeof R.on !== 'function') { if (++tries < 12) setTimeout(boot, 400); return; }
    R.on(function (ev) { try { if (ev.t === 'earn') onEarn(ev); else if (ev.t === 'flush') onFlush(ev); } catch (e) {} });
    if (!HOME) setTimeout(function () { // a level reached on the page before: celebrate it now, before the kid starts a round
      try { var p = R.pending('level'); if (p.length) levelUp(p.reduce(function (m, q) { return Math.max(m, +q.n || 0); }, 0)); } catch (e) {}
    }, 1100);
  }
  watchOnline();
  W.Juice = {sfx: sfx, buzz: buzz, levelUp: levelUp, confetti: function (n) { try { confetti(Math.max(1, Math.min(240, n || 80))); } catch (e) {} },
    burst: function (x, y, color) { vibe(.6, color || '#ffd24d', x, y); }, chip: function (ms) { try { return R ? showChip('', ms) : null; } catch (e) { return null; } }, calm: calm};
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();

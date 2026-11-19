/* Kids games platform – shared REWARDS: coins, cat stickers, daily gift, dress-up cosmetics.
   <script src="rewards.js" defer></script>   (safe to call from any game: always write  window.AnnabelleRewards&&AnnabelleRewards.xxx(...) )

   ── INTEGRATION SNIPPET (for game authors) ───────────────────────────────────────────────
     const R=()=>window.AnnabelleRewards;
     R()&&R().award({game:'cups',event:'play'});                         // when a run starts   (counts plays + 'first play' sticker)
     R()&&R().award({game:'cups',event:'levelClear',level:7,score:120}); // a level/stage/round cleared  (+2 coins)
     R()&&R().award({game:'cups',event:'star',stars:2});                 // stars newly earned (1-3)  (+2 coins per star; 3 stars = 'perfect')
     R()&&R().award({game:'cups',event:'combo',score:6});                // combo / streak length reached
     R()&&R().award({game:'cups',event:'score',score:340});              // final score of a run  (best score kept per game)
     R()&&R().award({game:'cups',event:'win'});                          // the child won a match / beat a boss / finished a stage (+5 coins)
     R()&&R().award({game:'cups',event:'win',coins:12});                 // coins:N overrides the default coins of the event
     R()&&R().flush();                                                   // show the queued '🎁 new sticker!' banners – call it on result / game-over cards (calm moments)
   Ids of games: bubbles cats checkers cups digrod escape fishing football hiddencats lionking magic magic2 minesweeper
                 pacman runner runner3d soya soyahome streetcats thunderkittens towerdefense bowling tictactoe hole fishy kitchen
   Coins per game per day are capped (kid-safe: no endless grinding).  Toasts never block play: they are queued until flush()
   (home page / album flush automatically).
   Other API: get(), coins(), spend(n)->bool, stickers() , has(id), catalog(), dailyStatus(), claimDaily(), shop(), buy(id), equip(id,on),
              avatar() -> {color,hat,bow,glass,bg}, avatarSVG(px, cfg?), lang(), t(obj), GAMES, onChange(fn).
   Storage: localStorage 'annabelle-rewards' = {v:1, coins, earned, st:{stickerId:ts}, stats:{...}, daily:{last,streak,best,count,days:[]}, own:{itemId:1}, av:{...}, pend:[...] }
   Per-game progress keys read by album.html (if a game writes them): 'annabelle-<game>-best' (number or JSON), games may also keep their own.
   Test hook: window.__annabelleToday = 'YYYY-M-D' overrides "today" (daily gift);  window.__annabelleNow = ms overrides the clock of the brain boost.
   META LAYER (all inside the same save, see "meta layer" below; every part is optional, positive and never punishes a missed day):
     streak()  play streak {n,today,best,shield,saved,next,ms[]}   (one automatic shield per ISO week keeps the streak over ONE missed day)
     road() / claimChest(i) / ackRecap()   weekly trophy road: XP of this ISO week fills 8 chests; unopened chests are opened for the kid at the week change
     boost()   brain boost {on,left,min}: finishing a learning session (mathquest / wordcity / sciencelab) = x2 XP (never coins) for 15 minutes, once per learning game per day
     badges() / title() / setTitle(id)   7 cross-game badges x 3 tiers (bronze, silver, gold); each earned badge is a title the kid can wear
     pet() / petCare('feed'|'pat') / petKind('cat'|'tiger') / petSVG(px)   companion that hatches and grows with total XP (5 stages)
     on(fn)    events for juice.js: {t:'earn',coins,xp,boost,game} and {t:'flush',...};  award({... online:true}) marks an online win.
   ───────────────────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.AnnabelleRewards) return;
  var KEY = 'annabelle-rewards', VER = 1, CAP_PER_GAME_DAY = 80;

  /* ---------- tiny helpers ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lang() { var l = lsGet('annabelle-lang') || 'he'; return l === 'fr' || l === 'en' ? l : 'he'; }
  function T(o) { if (!o) return ''; var s = typeof o === 'string' ? o : (o[lang()] || o.he || ''), K = window.KidApp; return K && K.gt ? K.gt(s) : s; } // texts are written for a girl; kid.js adapts them
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function today() { return typeof window.__annabelleToday === 'string' ? window.__annabelleToday : dayKey(); }
  function parseKey(k) { var p = String(k).split('-'); return new Date(+p[0], (+p[1]) - 1, +p[2]); }
  function addDays(k, n) { var d = parseKey(k); d.setDate(d.getDate() + n); return dayKey(d); }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function clampInt(x, lo, hi) { x = Math.floor(+x); if (!isFinite(x)) x = lo; return Math.max(lo, Math.min(hi, x)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---------- the games ---------- id: [emoji, he, fr, en] ---------- */
  var GAMES = {
    bubbles: ['💧', 'בועות החתולים', 'Bulles de chats', 'Cat Bubbles'],
    cats: ['🃏', 'זוגות של חתולים', 'Mémoire des chats', 'Cat Memory'],
    checkers: ['♟️', 'דמקת חתולים', 'Dames des chats', 'Cat Checkers'],
    cups: ['🥤', 'איפה הכדור?', 'Où est la balle ?', 'Cup Shuffle'],
    digrod: ['💪', 'חכת השריר', 'La Canne Muscle', 'Muscle Rod Dig'],
    escape: ['🔑', 'הבריחה מבית העץ', 'Évasion de la cabane', 'Treehouse Escape'],
    fishing: ['🎣', 'מסע הדיג', 'La pêche', 'Fishing Trip'],
    football: ['⚽', 'כדורגל חתולים', 'Foot des chats', 'Cat Football'],
    hiddencats: ['🔍', 'מצאי את החתולים', 'Trouve les chats', 'Find the Cats'],
    lionking: ['🦁', 'הרפתקת האריה הקטן', 'Aventure du petit lion', "Little Lion's Adventure"],
    magic: ['🎩', 'קסם הקלפים', 'Magie des cartes', 'Card Magic'],
    magic2: ['😺', 'קסם החתולים', 'Magie des chats', 'Magic Cats'],
    minesweeper: ['🐶', 'גינת החתולים', 'Jardin des chats', 'Cat Garden'],
    pacman: ['🐯', 'הטיגריס הרעבתן', 'Le tigre gourmand', 'Hungry Tiger'],
    runner: ['🐆', 'המרוץ בסוואנה', 'Course dans la savane', 'Savanna Run'],
    runner3d: ['🏞️', 'המרוץ בסוואנה 3D', 'Savane 3D', 'Savanna Run 3D'],
    soya: ['🐈', 'סויה החתול', 'Soya le chat', 'Soya the Cat'],
    soyahome: ['🌱', 'סויה בבית', 'Soya à la maison', 'Soya at Home'],
    streetcats: ['🐾', 'חתולי השכונה', 'Chats du quartier', 'Street Cats'],
    thunderkittens: ['⚡', 'לוחמי הברק', 'Guerriers de la Foudre', 'Lightning Kittens'],
    towerdefense: ['🏰', 'שומרי המאורה', 'Gardiens de la tanière', 'Tiger Den Defense'],
    bowling: ['🎳', 'באולינג חתולים', 'Bowling des chats', 'Bowling Cats'],
    tictactoe: ['❌', 'איקס עיגול חתולים', 'Morpion des chats', 'Cat Tic-Tac-Toe'],
    hole: ['🕳️', 'החור הרעבתן', 'Le Gouffre Gourmand', 'Hungry Hole'],
    fishy: ['🐟', 'דגיגון רעבתן', 'Petit Poisson Gourmand', 'Hungry Fishy'],
    kitchen: ['🍳', 'מסעדת החתולים', 'Le Resto des Chats', 'Cat Kitchen'],
    invaders: ['🚀', 'פולשי החלל', 'Envahisseurs', 'Space Rescue'],
    tetris: ['🧱', 'טטריס חתולים', 'Tetris des chats', 'Kitty Blocks'],
    breakout: ['🐾', 'שוברת הכלובים', 'Casse-cages', 'Cage Breaker'],
    snake: ['🐯', 'זנב הנמר', 'Queue de tigre', 'Tiger Tail'],
    crossing: ['🐥', 'מעבר החיות', 'Passage des animaux', 'Animal Crossing'],
    pong: ['🏓', 'פינג־פונג כפות', 'Ping-pong des pattes', 'Paw Pong'],
    safari: ['📸', 'ספארי צילום', 'Safari photo', 'Photo Safari'],
    simon: ['🎶', 'מקהלת החיות', 'La chorale des animaux', 'Animal Choir'],
    funrun: ['👟', 'מרוץ התעלולים', 'La course aux farces', 'Prank Race'],
    carrace: ['🏎️', 'מרוץ מכוניות החתולים', 'Course de karts des chats', 'Kitty Kart Race'],
    mathquest: ['🧮', 'מסע החשבון', 'La quête des maths', 'Math Quest'],
    wordcity: ['🔤', 'עיר המילים', 'La ville des mots', 'Word City'],
    sciencelab: ['🔬', 'מעבדת המדע', 'Le labo des sciences', 'Science Lab'],
    reading: ['📖', 'סולם הקריאה', "L'échelle de lecture", 'Reading Ladder'],
    thinking: ['🧩', 'חידות חשיבה', "Défis de logique", 'Thinking Lab'],
    city: ['🏙️', 'עיר החתולים', "Chat-Ville", 'Kitty City'],
    retro: ['🕹️', 'פינת הרטרו', 'Coin rétro', 'Retro Corner']
  };
  function gname(id) { var g = GAMES[id]; return g ? T(g[{he: 1, fr: 2, en: 3}[lang()]]) : id; }

  /* ---------- state ---------- */
  function fresh() {
    return {v: VER, coins: 0, earned: 0, st: {}, stats: {plays: {}, wins: {}, stars: {}, best: {}, perfects: 0, starsTotal: 0, winsTotal: 0, levelMax: 0, comboMax: 0, gifts: 0, bought: 0, albumVisits: 0, quests: 0, daily: {}, onl: 0, top5: 0, lrn: 0, roads: 0, top: {}},
      daily: {last: '', streak: 0, best: 0, count: 0, days: []}, own: {}, av: {color: 'orange', hat: '', bow: '', glass: '', bg: 'sky'}, pend: [],
      lv: 1, rec: [], q: {day: '', ids: [], g: {}, c: {}, done: {}, all: false}, ch: [],
      mv: 0, ps: {last: '', n: 0, best: 0, sh: '', sd: '', ms: {}}, wk: {id: '', xp: 0, cl: {}, rc: null}, bo: {until: 0, d: {}}, bd: {}, ti: '', pet: {k: 'cat', fed: '', pat: '', n: 0, st: -1}};
  }
  var S = null;
  function sane(o) { // accept anything from localStorage, rebuild a valid state
    var f = fresh();
    if (!o || typeof o !== 'object') return f;
    try {
      f.coins = clampInt(o.coins, 0, 1e7); f.earned = clampInt(o.earned, 0, 1e8);
      if (o.st && typeof o.st === 'object') for (var k in o.st) if (/^[a-z0-9_-]{1,40}$/i.test(k) && isNum(o.st[k])) f.st[k] = o.st[k];
      var s = o.stats && typeof o.stats === 'object' ? o.stats : {};
      ['plays', 'wins', 'stars', 'best'].forEach(function (m) { if (s[m] && typeof s[m] === 'object') for (var g in s[m]) if (/^[a-z0-9_-]{1,40}$/i.test(g) && !(g in Object.prototype) && isNum(s[m][g])) f.stats[m][g] = clampInt(s[m][g], 0, 1e9); });
      if (s.daily && typeof s.daily === 'object') for (var dk in s.daily) if (/^[a-z0-9_-]{1,40}\|\d{4}-\d{1,2}-\d{1,2}$/i.test(dk) && isNum(s.daily[dk])) f.stats.daily[dk] = clampInt(s.daily[dk], 0, 1e6); // per-game daily coin caps
      ['perfects', 'starsTotal', 'winsTotal', 'levelMax', 'comboMax', 'gifts', 'bought', 'albumVisits', 'quests', 'onl', 'top5', 'lrn', 'roads'].forEach(function (m) { f.stats[m] = clampInt(s[m], 0, 1e9); });
      var d = o.daily && typeof o.daily === 'object' ? o.daily : {};
      f.daily.last = /^\d{4}-\d{1,2}-\d{1,2}$/.test(d.last) ? d.last : ''; f.daily.streak = clampInt(d.streak, 0, 9999); f.daily.best = clampInt(d.best, 0, 9999); f.daily.count = clampInt(d.count, 0, 99999);
      if (Array.isArray(d.days)) f.daily.days = d.days.filter(function (x) { return /^\d{4}-\d{1,2}-\d{1,2}$/.test(x); }).slice(-14);
      if (o.own && typeof o.own === 'object') for (var i in o.own) if (SHOP_BY[i] && o.own[i]) f.own[i] = 1;
      var a = o.av && typeof o.av === 'object' ? o.av : {};
      ['color', 'hat', 'bow', 'glass', 'bg'].forEach(function (p) { var v = a[p]; if (v === '' || (typeof v === 'string' && SHOP_BY[p + ':' + v] && (f.own[p + ':' + v] || SHOP_BY[p + ':' + v].price === 0))) f.av[p] = v; });
      if (Array.isArray(o.pend)) f.pend = o.pend.filter(function (p) { return p && (p.t === 'sticker' && STK_BY[p.id] || p.t === 'coins' && isNum(p.n) || p.t === 'level' && isNum(p.n) || p.t === 'quest' && QUEST_BY[p.id] || p.t === 'qall' || p.t === 'chal' && isGame(p.g) && typeof p.n === 'string' ||
        (p.t === 'streak' || p.t === 'ms' || p.t === 'pet' || p.t === 'road') && isNum(p.n) || p.t === 'boost' || p.t === 'badge' && BADGE_BY[p.id] && isNum(p.n)); }).slice(-30);
      // platform layer: player level, recently played, daily quests, friend challenges
      f.lv = clampInt(o.lv, 0, 9999) || levelOf(f.earned);
      if (Array.isArray(o.rec)) f.rec = o.rec.filter(function (g, i, r) { return isGame(g) && g !== 'retro' && r.indexOf(g) === i; }).slice(0, 8);
      var q = o.q && typeof o.q === 'object' ? o.q : null;
      if (q && /^\d{4}-\d{1,2}-\d{1,2}$/.test(q.day)) {
        f.q.day = q.day; f.q.all = !!q.all;
        if (Array.isArray(q.ids)) f.q.ids = q.ids.filter(function (id) { return QUEST_BY[id]; }).slice(0, 3);
        ['g', 'c', 'done'].forEach(function (m) { if (q[m] && typeof q[m] === 'object') for (var k in q[m]) if (/^[a-z0-9_-]{1,30}$/i.test(k) && !(k in Object.prototype) && isNum(q[m][k])) f.q[m][k] = clampInt(q[m][k], 0, 1e6); });
      }
      if (Array.isArray(o.ch)) f.ch = o.ch.filter(function (c) { return c && isGame(c.g) && c.g !== 'retro' && isNum(c.s) && typeof c.n === 'string'; }).slice(0, 6).map(function (c) { return {g: c.g, s: clampInt(c.s, 1, 1e9), n: cleanName(c.n) || '?', t: clampInt(c.t, 0, 1e13), won: !!c.won}; });
      saneMeta(f, o, s);
    } catch (e) { return fresh(); }
    return f;
  }
  var DAY_RE = /^\d{4}-\d{1,2}-\d{1,2}$/, WK_RE = /^\d{4}-W\d{2}$/;
  function saneMeta(f, o, s) { // the meta layer of a save: every field is rebuilt from scratch
    f.mv = o.mv === 1 ? 1 : 0;
    if (s.top && typeof s.top === 'object') for (var g in s.top) if (isGame(g) && Array.isArray(s.top[g])) f.stats.top[g] = s.top[g].filter(isNum).map(function (x) { return clampInt(x, 0, 1e9); }).sort(function (a, b) { return b - a; }).slice(0, 5);
    var p = o.ps && typeof o.ps === 'object' ? o.ps : {};
    if (DAY_RE.test(p.last)) { f.ps.last = p.last; f.ps.n = clampInt(p.n, 1, 9999); }
    f.ps.best = Math.max(f.ps.n, clampInt(p.best, 0, 9999)); f.ps.sh = WK_RE.test(p.sh) ? p.sh : ''; f.ps.sd = DAY_RE.test(p.sd) ? p.sd : '';
    STREAK_MS.forEach(function (m) { if (p.ms && typeof p.ms === 'object' && p.ms[m[0]]) f.ps.ms[m[0]] = 1; });
    var w = o.wk && typeof o.wk === 'object' ? o.wk : {};
    if (WK_RE.test(w.id)) {
      f.wk.id = w.id; f.wk.xp = clampInt(w.xp, 0, 1e6);
      ROAD.forEach(function (c, i) { if (w.cl && typeof w.cl === 'object' && w.cl[i]) f.wk.cl[i] = 1; });
    }
    var rc = w.rc && typeof w.rc === 'object' ? w.rc : null;
    if (rc && WK_RE.test(rc.id)) f.wk.rc = {id: rc.id, xp: clampInt(rc.xp, 0, 1e6), n: clampInt(rc.n, 0, ROAD.length), c: clampInt(rc.c, 0, 1e4), g: clampInt(rc.g, 0, ROAD.length)};
    var b = o.bo && typeof o.bo === 'object' ? o.bo : {};
    f.bo.until = clampInt(b.until, 0, 1e14);
    if (b.d && typeof b.d === 'object') for (var k in b.d) if (/^(reading|mathquest|wordcity|sciencelab|thinking)\|\d{4}-\d{1,2}-\d{1,2}$/.test(k) && b.d[k]) f.bo.d[k] = 1;
    if (o.bd && typeof o.bd === 'object') BADGES.forEach(function (B) { var t = clampInt(o.bd[B.id], 0, 3); if (t > 0) f.bd[B.id] = t; });
    f.ti = typeof o.ti === 'string' && BADGE_BY[o.ti] && f.bd[o.ti] ? o.ti : '';
    var pt = o.pet && typeof o.pet === 'object' ? o.pet : {};
    f.pet.k = pt.k === 'tiger' ? 'tiger' : 'cat'; f.pet.fed = DAY_RE.test(pt.fed) ? pt.fed : ''; f.pet.pat = DAY_RE.test(pt.pat) ? pt.pat : '';
    f.pet.n = clampInt(pt.n, 0, 1e6); f.pet.st = isNum(pt.st) ? clampInt(pt.st, -1, PET_XP.length - 1) : -1;
  }
  var SHOP_BY = Object.create(null), STK_BY = Object.create(null); // filled below (state sanitising needs them); no prototype keys
  function isGame(g) { return typeof g === 'string' && Object.prototype.hasOwnProperty.call(GAMES, g); }
  var listeners = [];
  function load() {
    var raw = lsGet(KEY), o = null; try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; } S = sane(o);
    // a save from before the meta layer: what was already achieved becomes badges / pet size quietly (no coins, no banners)
    if (!S.mv) { try { checkBadges(true); S.pet.st = petStage(S.earned); S.mv = 1; } catch (e) {} }
  }
  function save() { S.v = VER; lsSet(KEY, JSON.stringify(S)); listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  /* ---------- platform layer: player level (XP = coins ever earned), daily quests, friend challenges ---------- */
  function levelOf(xp) { return Math.max(1, Math.floor((1 + Math.sqrt(1 + 0.4 * Math.max(0, +xp || 0))) / 2)); }
  function needFor(L) { return 10 * L * (L - 1); }
  var RANKS = [[1, '🐱', {he: 'גורה סקרנית', fr: 'Chaton curieux', en: 'Curious Kitten'}], [3, '🐈', {he: 'חתולת רחוב זריזה', fr: 'Chat des rues', en: 'Street Cat'}], [5, '⭐', {he: 'ציידת כוכבים', fr: "Chasseuse d'étoiles", en: 'Star Hunter'}],
    [8, '🐯', {he: 'נמרה צעירה', fr: 'Jeune tigresse', en: 'Young Tiger'}], [12, '🦁', {he: 'לביאה אמיצה', fr: 'Lionne courageuse', en: 'Brave Lioness'}], [16, '👑', {he: "מלכת הג'ונגל", fr: 'Reine de la jungle', en: 'Jungle Queen'}], [21, '🐉', {he: 'אגדת החתולים', fr: 'Légende des chats', en: 'Cat Legend'}]];
  function rankOf(L) { var r = RANKS[0]; RANKS.forEach(function (x) { if (L >= x[0]) r = x; }); return r; }
  function level() {
    if (!S) load();
    var L = levelOf(S.earned), a = needFor(L), b = needFor(L + 1), r = rankOf(L), nx = null;
    RANKS.forEach(function (x) { if (!nx && x[0] > L) nx = x; });
    return {level: L, xp: S.earned, cur: S.earned - a, need: b - a, pct: Math.max(0, Math.min(100, Math.round((S.earned - a) / (b - a) * 100))), e: r[1], title: T(r[2]), next: nx ? {level: nx[0], e: nx[1], title: T(nx[2])} : null};
  }
  function checkLevel() { var L = levelOf(S.earned); if (L > (S.lv || 1)) { S.lv = L; S.pend = S.pend.filter(function (p) { return p.t !== 'level'; }); S.pend.push({t: 'level', n: L}); } }
  // names come from links: drop control, zero-width and bidi-override characters (keeps ZWJ / variation selectors so emoji survive)
  function cleanName(n) {
    n = String(n == null ? '' : n).replace(/[\u0000-\u0008\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u180E\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0]/g, '')
      .replace(/[<>&"'`\\\/]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
    return /[^ \u200D\uFE0E\uFE0F]/.test(n) ? n : '';
  }
  function escH(x) { return String(x).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  var RETRO = {invaders: 1, tetris: 1, breakout: 1, snake: 1, crossing: 1, pong: 1, safari: 1, simon: 1};
  var MIND = {reading: 1, city: 1, mathquest: 1, wordcity: 1, sciencelab: 1, thinking: 1, magic: 1, magic2: 1, cups: 1, tictactoe: 1, minesweeper: 1, checkers: 1, cats: 1, hiddencats: 1, escape: 1, towerdefense: 1, tetris: 1, simon: 1};
  var SPORT = {funrun: 1, carrace: 1, football: 1, bowling: 1, pong: 1, thunderkittens: 1, runner: 1, runner3d: 1, pacman: 1, lionking: 1};
  var HIDDEN = {retro: 1, runner3d: 1}; // no tile of their own on the home page
  var QUEST_COINS = 15, QUEST_BONUS = 25;
  var QUESTS = [
    {id: 'play3', e: '🎮', goal: 3, t: {he: 'שחקי ב-3 משחקים שונים', fr: 'Joue à 3 jeux différents', en: 'Play 3 different games'}},
    {id: 'win2', e: '🏆', goal: 2, t: {he: 'נצחי פעמיים', fr: 'Gagne 2 fois', en: 'Win twice'}},
    {id: 'star5', e: '⭐', goal: 5, t: {he: 'אספי 5 כוכבים', fr: 'Récolte 5 étoiles', en: 'Collect 5 stars'}},
    {id: 'lvl3', e: '🚩', goal: 3, t: {he: 'סיימי 3 שלבים', fr: 'Termine 3 niveaux', en: 'Clear 3 levels'}},
    {id: 'retro', e: '🕹️', goal: 1, t: {he: 'שחקי במשחק מפינת הרטרו', fr: 'Joue à un jeu du coin rétro', en: 'Play a Retro Corner game'}},
    {id: 'mind', e: '🧩', goal: 1, t: {he: 'שחקי במשחק חשיבה', fr: 'Joue à un jeu de réflexion', en: 'Play a thinking game'}},
    {id: 'sport', e: '⚽', goal: 1, t: {he: 'שחקי במשחק ספורט או אקשן', fr: "Joue à un jeu de sport ou d'action", en: 'Play a sports or action game'}},
    {id: 'perfect', e: '🎯', goal: 1, t: {he: 'קבלי 3 כוכבים בשלב אחד', fr: 'Obtiens 3 étoiles dans un niveau', en: 'Get 3 stars in one stage'}},
    {id: 'coin30', e: '💰', goal: 30, t: {he: 'הרוויחי 30 מטבעות במשחקים', fr: 'Gagne 30 pièces en jouant', en: 'Earn 30 coins by playing'}},
    {id: 'new1', e: '✨', goal: 1, t: {he: 'נסי משחק שעוד לא שיחקת בו', fr: "Essaie un jeu que tu n'as jamais joué", en: 'Try a game you have never played'}}
  ];
  var QUEST_BY = Object.create(null); QUESTS.forEach(function (q) { QUEST_BY[q.id] = q; });
  function seedRnd(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ h >>> 15, 1 | h); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pickQuests(day) {
    var r = seedRnd('q' + day), ids = QUESTS.map(function (q) { return q.id; }), out = [];
    for (var i = ids.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = ids[i]; ids[i] = ids[j]; ids[j] = x; }
    var unplayed = Object.keys(GAMES).some(function (g) { return !HIDDEN[g] && !S.stats.plays[g]; });
    ids.forEach(function (id) { if (out.length < 3 && (id !== 'new1' || unplayed)) out.push(id); });
    return out;
  }
  function questState() {
    var td = today();
    if (S.q.day !== td || !S.q.ids.length) S.q = {day: td, ids: pickQuests(td), g: {}, c: {}, done: {}, all: false};
    return S.q;
  }
  function qprog(q, id) { return id === 'play3' ? Object.keys(q.g).length : (q.c[{win2: 'win', star5: 'star', lvl3: 'lvl', retro: 'retro', mind: 'mind', sport: 'sport', perfect: 'perfect', coin30: 'coin', new1: 'new'}[id]] || 0); }
  function questTick(game, ev, o, c, first) {
    if (!isGame(game) || game === 'retro') return;
    var q = questState();
    if (!q.g[game]) { q.g[game] = 1; if (RETRO[game]) q.c.retro = 1; if (MIND[game]) q.c.mind = 1; if (SPORT[game]) q.c.sport = 1; }
    if (first) q.c['new'] = 1;
    if (ev === 'win') q.c.win = (q.c.win || 0) + 1;
    if (ev === 'levelClear') q.c.lvl = (q.c.lvl || 0) + 1;
    if (ev === 'star') { var n = clampInt(o.stars, 0, 3); q.c.star = (q.c.star || 0) + n; if (n === 3) q.c.perfect = 1; }
    if (c > 0) q.c.coin = (q.c.coin || 0) + c;
    q.ids.forEach(function (id) { var Q = QUEST_BY[id]; if (!Q || q.done[id]) return; if (qprog(q, id) >= Q.goal) { q.done[id] = 1; S.stats.quests++; S.coins += QUEST_COINS; addXP(QUEST_COINS); S.pend.push({t: 'quest', id: id}); } });
    if (!q.all && q.ids.length && q.ids.every(function (id) { return q.done[id]; })) { q.all = true; S.coins += QUEST_BONUS; addXP(QUEST_BONUS); S.pend.push({t: 'qall'}); }
  }
  function quests() {
    if (!S) load();
    var before = S.q.day, q = questState(); if (before !== q.day) save();
    return {day: q.day, all: q.all, coins: QUEST_COINS, bonus: QUEST_BONUS, list: q.ids.map(function (id) { var Q = QUEST_BY[id]; return {id: id, e: Q.e, text: T(Q.t), goal: Q.goal, prog: Math.min(Q.goal, qprog(q, id)), done: !!q.done[id]}; })};
  }
  function addChallenge(g, sc, n) {
    if (!S) load();
    if (!isGame(g) || g === 'retro') return null;
    sc = Math.floor(+sc); if (!isFinite(sc) || sc < 1 || sc > 1e9) return null;
    n = cleanName(n) || '?';
    S.ch = S.ch.filter(function (c) { return !(c.g === g && c.n === n); });
    var c = {g: g, s: sc, n: n, t: Date.now(), won: (S.stats.best[g] || 0) >= sc};
    S.ch.unshift(c);
    while (S.ch.length > 6) { // beaten challenges make room first
      var di = S.ch.length - 1;
      for (var k = di; k > 0; k--) if (S.ch[k].won) { di = k; break; }
      S.ch.splice(di, 1);
    }
    save();
    return {g: c.g, s: c.s, n: c.n, won: c.won, e: GAMES[g][0], name: gname(g)};
  }
  function removeChallenge(g, n) {
    if (!S) load();
    var k = S.ch.length;
    S.ch = S.ch.filter(function (c) { return !(c.g === g && c.n === n); });
    if (S.ch.length !== k) save();
  }
  function challenges() { if (!S) load(); return S.ch.map(function (c) { return {g: c.g, s: c.s, n: c.n, won: c.won, t: c.t, e: GAMES[c.g][0], name: gname(c.g), mine: S.stats.best[c.g] || 0}; }); }
  function bests() {
    if (!S) load();
    var ids = Object.keys(S.stats.best).filter(function (g) { return isGame(g) && g !== 'retro' && S.stats.best[g] > 0; });
    ids.sort(function (a, b) { var x = S.rec.indexOf(a), y = S.rec.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    return ids.map(function (g) { return {g: g, s: S.stats.best[g], e: GAMES[g][0], name: gname(g)}; });
  }
  function recent() { if (!S) load(); return S.rec.slice(); }

  /* ---------- sticker catalog (~63 original cat stickers) ---------- */
  var CAT = [];
  function add(id, e, he, fr, en, dhe, dfr, den, rule, group) {
    var s = {id: id, e: e, n: {he: he, fr: fr, en: en}, d: {he: dhe, fr: dfr, en: den}, rule: rule || null, g: group || 'misc'};
    CAT.push(s); STK_BY[id] = s;
  }
  // 1) first play of each game (26)
  var GS = {reading: 'תולעת ספרים', city: 'בעלת בית', thinking: 'מוח על', mathquest: 'אלופת החשבון', wordcity: 'אלופת המילים', sciencelab: 'מדענית צעירה', funrun: 'אלופת התעלולים', carrace: 'נהגת מרוצים', bubbles: 'מגלת בועות', cats: 'זוגית זוגות', checkers: 'מלכת הדמקה', cups: 'עין הנץ', digrod: 'חופרת בשריר', escape: 'בורחת מהעץ', fishing: 'דייגית צעירה', football: 'כוכבת הכדורגל', hiddencats: 'עין הבולשת', lionking: 'אריה קטן', magic: 'קוסמת קלפים', magic2: 'קוסמת חתולים', minesweeper: 'גננית חתולים', pacman: 'טיגריס רעב', runner: 'רצה בסוואנה', runner3d: 'רצה ב-3D', soya: 'חברה של סויה', soyahome: 'בית של סויה', streetcats: 'חתולת שכונה', thunderkittens: 'לוחמת ברק', towerdefense: 'שומרת המאורה', bowling: 'כוכבת באולינג', tictactoe: 'מלכת איקס עיגול', hole: 'חור רעבתן', fishy: 'דג גדול', kitchen: 'שפית חתולית', invaders: 'מצילה בחלל', tetris: 'מלכת הקוביות', breakout: 'פותחת הכלובים', snake: 'זנב הנמר', crossing: 'שומרת המעבר', pong: 'אלופת הפינג־פונג', safari: 'צלמת ספארי', simon: 'מנצחת המקהלה', retro: 'מבקרת בפינת הרטרו'};
  var GSF = {reading: 'Rat de bibliothèque', city: 'Jeune propriétaire', thinking: 'Super cerveau', mathquest: 'As des maths', wordcity: 'As des mots', sciencelab: 'Jeune scientifique', funrun: 'Reine des farces', carrace: 'Pilote de course', bubbles: 'Reine des bulles', cats: 'Maître des paires', checkers: 'Reine des dames', cups: 'Œil de lynx', digrod: 'Super muscles', escape: 'Évadée', fishing: 'Jeune pêcheuse', football: 'Star du foot', hiddencats: 'Détective', lionking: 'Petit lion', magic: 'Magicienne', magic2: 'Magie des chats', minesweeper: 'Jardinière', pacman: 'Tigre affamé', runner: 'Coureuse', runner3d: 'Coureuse 3D', soya: 'Amie de Soya', soyahome: 'Maison de Soya', streetcats: 'Chat du quartier', thunderkittens: 'Guerrière', towerdefense: 'Gardienne', bowling: 'Star du bowling', tictactoe: 'Reine du morpion', hole: 'Gouffre gourmand', fishy: 'Gros poisson', kitchen: 'Cheffe chat', invaders: 'Sauveteuse de l\'espace', tetris: 'Reine des blocs', breakout: 'Ouvre-cages', snake: 'Queue de tigre', crossing: 'Gardienne du passage', pong: 'Championne de ping-pong', safari: 'Photographe safari', simon: 'Cheffe de chorale', retro: 'Visiteuse rétro'};
  var GSE = {reading: 'Bookworm', city: 'City Builder', thinking: 'Master Mind', mathquest: 'Math Champion', wordcity: 'Word Champion', sciencelab: 'Young Scientist', funrun: 'Prank Champion', carrace: 'Race Driver', bubbles: 'Bubble Queen', cats: 'Memory Master', checkers: 'Checkers Queen', cups: 'Eagle Eye', digrod: 'Super Muscles', escape: 'Escape Artist', fishing: 'Young Angler', football: 'Football Star', hiddencats: 'Cat Detective', lionking: 'Little Lion', magic: 'Card Magician', magic2: 'Cat Magician', minesweeper: 'Garden Hero', pacman: 'Hungry Tiger', runner: 'Savanna Runner', runner3d: '3D Runner', soya: 'Soya\'s Friend', soyahome: 'Soya\'s Home', streetcats: 'Street Cat', thunderkittens: 'Lightning Fighter', towerdefense: 'Den Guardian', bowling: 'Bowling Star', tictactoe: 'Tic-Tac-Queen', hole: 'Hungry Hole', fishy: 'Big Fish', kitchen: 'Chef Cat', invaders: 'Space Rescuer', tetris: 'Block Queen', breakout: 'Cage Opener', snake: 'Tiger Tail', crossing: 'Crossing Guard', pong: 'Pong Champion', safari: 'Safari Photographer', simon: 'Choir Conductor', retro: 'Retro Visitor'};
  Object.keys(GAMES).forEach(function (g) {
    add('g-' + g, GAMES[g][0], GS[g], GSF[g], GSE[g], 'שחקי ב' + GAMES[g][1] + ' בפעם הראשונה', 'Joue à ' + GAMES[g][2] + ' pour la première fois', 'Play ' + GAMES[g][3] + ' for the first time',
      (function (id) { return function (s) { return (s.stats.plays[id] || 0) >= 1; }; })(g), 'games');
  });
  // 2) wins
  [[1, '🏆', 'ניצחון ראשון', 'Première victoire', 'First win'], [5, '🥇', 'חמישה ניצחונות', 'Cinq victoires', 'Five wins'], [25, '👑', 'מלכת הניצחונות', 'Reine des victoires', 'Victory queen'], [100, '🌟', 'אלופה', 'Championne', 'Champion']].forEach(function (w) {
    add('w' + w[0], w[1], w[2], w[3], w[4], 'נצחי ' + w[0] + ' פעמים', 'Gagne ' + w[0] + ' fois', 'Win ' + w[0] + ' times', function (s) { return s.stats.winsTotal >= w[0]; }, 'wins');
  });
  // 3) explorer: distinct games played
  [[3, '🧭', 'חוקרת קטנה', 'Petite exploratrice', 'Little explorer'], [10, '🗺️', 'חוקרת גדולה', 'Grande exploratrice', 'Big explorer'], [20, '🚀', 'חוקרת על', 'Super exploratrice', 'Super explorer']].forEach(function (w) {
    add('x' + w[0], w[1], w[2], w[3], w[4], 'שחקי ב-' + w[0] + ' משחקים שונים', 'Joue à ' + w[0] + ' jeux différents', 'Play ' + w[0] + ' different games', function (s) { return Object.keys(s.stats.plays).filter(function (g) { return s.stats.plays[g] > 0; }).length >= w[0]; }, 'explore');
  });
  // 4) daily streak
  [[3, '🔥', 'שלושה ימים ברצף', 'Trois jours de suite', 'Three days in a row'], [7, '🌈', 'שבוע שלם', 'Une semaine entière', 'A whole week'], [14, '💎', 'שבועיים ברצף', 'Deux semaines', 'Two weeks'], [30, '🐉', 'חודש של קסם', 'Un mois magique', 'A magic month']].forEach(function (w) {
    add('s' + w[0], w[1], w[2], w[3], w[4], 'פתחי את המתנה היומית ' + w[0] + ' ימים ברצף', 'Ouvre le cadeau du jour ' + w[0] + ' jours de suite', 'Open the daily gift ' + w[0] + ' days in a row', function (s) { return s.daily.best >= w[0]; }, 'streak');
  });
  // 5) stars
  [[10, '⭐', 'עשרה כוכבים', 'Dix étoiles', 'Ten stars'], [50, '💫', 'חמישים כוכבים', 'Cinquante étoiles', 'Fifty stars'], [150, '🌠', 'מאה וחמישים כוכבים', 'Cent cinquante étoiles', '150 stars']].forEach(function (w) {
    add('t' + w[0], w[1], w[2], w[3], w[4], 'אספי ' + w[0] + ' כוכבים', 'Récolte ' + w[0] + ' étoiles', 'Collect ' + w[0] + ' stars', function (s) { return s.stats.starsTotal >= w[0]; }, 'stars');
  });
  // 6) coins earned
  [[100, '💰', 'אוצר קטן', 'Petit trésor', 'Small treasure'], [500, '💰', 'אוצר גדול', 'Grand trésor', 'Big treasure'], [2000, '🏴‍☠️', 'אוצר הפיראטים', 'Trésor de pirates', 'Pirate treasure']].forEach(function (w) {
    add('c' + w[0], w[1], w[2], w[3], w[4], 'הרוויחי ' + w[0] + ' מטבעות', 'Gagne ' + w[0] + ' pièces', 'Earn ' + w[0] + ' coins', function (s) { return s.earned >= w[0]; }, 'coins');
  });
  // 7) levels / combos / perfect
  [[5, '🐣', 'שלב 5', 'Niveau 5', 'Level 5'], [10, '🐥', 'שלב 10', 'Niveau 10', 'Level 10'], [20, '🦅', 'שלב 20', 'Niveau 20', 'Level 20']].forEach(function (w) {
    add('l' + w[0], w[1], w[2], w[3], w[4], 'הגיעי לשלב ' + w[0] + ' בכל משחק', 'Atteins le niveau ' + w[0] + ' dans un jeu', 'Reach level ' + w[0] + ' in any game', function (s) { return s.stats.levelMax >= w[0]; }, 'levels');
  });
  [[3, '✨', 'קומבו קטן', 'Petit combo', 'Small combo'], [6, '🎆', 'קומבו גדול', 'Grand combo', 'Big combo'], [12, '🌋', 'קומבו אדיר', 'Combo géant', 'Huge combo']].forEach(function (w) {
    add('k' + w[0], w[1], w[2], w[3], w[4], 'עשי קומבו של ' + w[0], 'Fais un combo de ' + w[0], 'Make a combo of ' + w[0], function (s) { return s.stats.comboMax >= w[0]; }, 'combo');
  });
  [[1, '🎯', 'מושלמת', 'Parfait', 'Perfect'], [5, '🏅', 'חמש פעמים מושלמת', 'Cinq fois parfait', 'Perfect x5'], [20, '🎖️', 'מושלמת מושלמת', 'Super parfait', 'Super perfect']].forEach(function (w) {
    add('p' + w[0], w[1], w[2], w[3], w[4], 'קבלי 3 כוכבים ' + (w[0] > 1 ? w[0] + ' פעמים' : 'בשלב'), 'Obtiens 3 étoiles ' + (w[0] > 1 ? w[0] + ' fois' : 'dans un niveau'), 'Get 3 stars ' + (w[0] > 1 ? w[0] + ' times' : 'in a stage'), function (s) { return s.stats.perfects >= w[0]; }, 'perfect');
  });
  [[5, '⭐', 'שחקנית רמה 5', 'Joueuse niveau 5', 'Player level 5'], [10, '🐯', 'שחקנית רמה 10', 'Joueuse niveau 10', 'Player level 10'], [20, '👑', 'שחקנית רמה 20', 'Joueuse niveau 20', 'Player level 20']].forEach(function (w) {
    add('pl' + w[0], w[1], w[2], w[3], w[4], 'הגיעי לרמת שחקנית ' + w[0], 'Atteins le niveau de joueuse ' + w[0], 'Reach player level ' + w[0], function (s) { return levelOf(s.earned) >= w[0]; }, 'levels');
  });
  [[5, '📋', 'חמש משימות', 'Cinq missions', 'Five quests'], [30, '🗓️', 'אלופת המשימות', 'Championne des missions', 'Quest champion']].forEach(function (w) {
    add('q' + w[0], w[1], w[2], w[3], w[4], 'השלימי ' + w[0] + ' משימות יומיות', 'Termine ' + w[0] + ' missions du jour', 'Complete ' + w[0] + ' daily quests', function (s) { return (s.stats.quests || 0) >= w[0]; }, 'misc');
  });
  // 8) gifts / shop / album
  add('d1', '🎁', 'מתנה ראשונה', 'Premier cadeau', 'First gift', 'פתחי מתנה יומית', 'Ouvre un cadeau du jour', 'Open a daily gift', function (s) { return s.stats.gifts >= 1; }, 'gift');
  add('d10', '🎀', 'עשר מתנות', 'Dix cadeaux', 'Ten gifts', 'פתחי 10 מתנות יומיות', 'Ouvre 10 cadeaux', 'Open 10 daily gifts', function (s) { return s.stats.gifts >= 10; }, 'gift');
  add('b1', '🛍️', 'קניה ראשונה', 'Premier achat', 'First purchase', 'קני משהו בחנות הלבוש', 'Achète un article à la boutique', 'Buy something in the dress-up shop', function (s) { return s.stats.bought >= 1; }, 'shop');
  add('b5', '👗', 'ארון מלא', 'Garde-robe pleine', 'Full wardrobe', 'קני 5 פריטים', 'Achète 5 articles', 'Buy 5 items', function (s) { return s.stats.bought >= 5; }, 'shop');
  add('a1', '📖', 'מבקרת באלבום', "Visiteuse de l'album", 'Album visitor', 'בקרי באלבום', "Visite l'album", 'Visit the album', function (s) { return s.stats.albumVisits >= 1; }, 'misc');
  // 9) rare chest-only stickers (6)
  [['r-unicorn', '🦄', 'חתול חד קרן', 'Chat licorne', 'Unicorn cat'], ['r-rainbow', '🌈', 'קשת בענן', 'Arc-en-ciel', 'Rainbow'], ['r-clover', '🍀', 'תלתן המזל', 'Trèfle porte-bonheur', 'Lucky clover'], ['r-saturn', '🪐', 'חתול החלל', 'Chat de l\'espace', 'Space cat'], ['r-cupcake', '🧁', 'קאפקייק', 'Cupcake', 'Cupcake'], ['r-crown', '🔱', 'שרביט הקסם', 'Sceptre magique', 'Magic scepter']].forEach(function (w) {
    add(w[0], w[1], w[2], w[3], w[4], 'מתנה נדירה – מופיעה לפעמים בתיבת המתנה היומית', 'Cadeau rare – sort parfois du coffre du jour', 'Rare gift – sometimes found in the daily chest', null, 'rare');
  });

  /* ---------- shop (cosmetics for the shared kitten avatar) ---------- */
  var SHOP = [];
  function shopAdd(kind, id, e, price, he, fr, en, extra) {
    var it = {id: kind + ':' + id, kind: kind, key: id, e: e, price: price, n: {he: he, fr: fr, en: en}};
    if (extra) for (var k in extra) it[k] = extra[k];
    SHOP.push(it); SHOP_BY[it.id] = it;
  }
  var COLORS = {orange: ['#ffa94d', '#ffe0b8', '#f08a24'], gray: ['#b8bfc9', '#eceff3', '#8e97a4'], cream: ['#ffe8b8', '#fff7e3', '#e7c27f'], black: ['#5a5368', '#8c8499', '#3b3547'], white: ['#ffffff', '#ffeaf0', '#d8d8e2'], pink: ['#ff9ec7', '#ffe0ee', '#e0629b'], blue: ['#8ec5ff', '#e3f1ff', '#4d93e6'], purple: ['#b79bff', '#ece4ff', '#7d5ce0']};
  shopAdd('color', 'orange', '🟠', 0, 'כתום', 'Orange', 'Orange'); shopAdd('color', 'gray', '⚪', 0, 'אפור', 'Gris', 'Gray');
  shopAdd('color', 'cream', '🟡', 15, 'קרם', 'Crème', 'Cream'); shopAdd('color', 'black', '⚫', 25, 'שחור', 'Noir', 'Black'); shopAdd('color', 'white', '🤍', 25, 'לבן', 'Blanc', 'White');
  shopAdd('color', 'pink', '💗', 35, 'ורוד', 'Rose', 'Pink'); shopAdd('color', 'blue', '💙', 35, 'כחול', 'Bleu', 'Blue'); shopAdd('color', 'purple', '💜', 45, 'סגול', 'Violet', 'Purple');
  shopAdd('hat', 'party', '🎉', 12, 'כובע מסיבה', 'Chapeau de fête', 'Party hat'); shopAdd('hat', 'crown', '👑', 60, 'כתר', 'Couronne', 'Crown');
  shopAdd('hat', 'top', '🎩', 40, 'צילינדר', 'Haut-de-forme', 'Top hat'); shopAdd('hat', 'chef', '👨‍🍳', 30, 'כובע שפית', 'Toque', 'Chef hat');
  shopAdd('hat', 'flower', '🌸', 20, 'פרח', 'Fleur', 'Flower'); shopAdd('hat', 'cap', '🧢', 25, 'כובע מצחייה', 'Casquette', 'Cap'); shopAdd('hat', 'wizard', '🧙', 70, 'כובע קוסמים', 'Chapeau de magicien', 'Wizard hat');
  shopAdd('bow', 'red', '🎀', 10, 'פפיון אדום', 'Nœud rouge', 'Red bow'); shopAdd('bow', 'blue', '🦋', 14, 'פפיון כחול', 'Nœud bleu', 'Blue bow');
  shopAdd('bow', 'scarf', '🧣', 28, 'צעיף', 'Écharpe', 'Scarf'); shopAdd('bow', 'bell', '🔔', 22, 'פעמון', 'Clochette', 'Bell');
  shopAdd('glass', 'round', '👓', 18, 'משקפיים', 'Lunettes', 'Glasses'); shopAdd('glass', 'sun', '🕶️', 32, 'משקפי שמש', 'Lunettes de soleil', 'Sunglasses'); shopAdd('glass', 'heart', '😍', 40, 'משקפי לב', 'Lunettes cœur', 'Heart glasses');
  shopAdd('bg', 'sky', '☁️', 0, 'שמיים', 'Ciel', 'Sky'); shopAdd('bg', 'stars', '🌙', 30, 'כוכבים', 'Étoiles', 'Stars'); shopAdd('bg', 'hearts', '💞', 30, 'לבבות', 'Cœurs', 'Hearts'); shopAdd('bg', 'candy', '🍭', 45, 'ממתקים', 'Bonbons', 'Candy');
  var AV_DEFAULT = {color: 'orange', hat: '', bow: '', glass: '', bg: 'sky'};

  /* ---------- meta layer: play streak, weekly trophy road, brain boost, badges / titles, companion pet ----------
     Kid-safe by design: nothing is ever taken away, a missed day costs nothing (weekly shield, then simply a new streak),
     chests left unopened are opened for the kid, no countdowns. Everything lives in the same save and is rebuilt by saneMeta(). */
  function nowMs() { return isNum(window.__annabelleNow) ? window.__annabelleNow : Date.now(); }
  function dayDiff(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 864e5); }
  function weekId(k) { // ISO week of a day key
    var d = parseKey(k), t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), dn = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dn);
    var y = t.getUTCFullYear(); return y + '-W' + pad(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7));
  }
  function TG(o) { // text with gender forms: a string, or [feminine, masculine, neutral?]
    if (!o) return ''; var v = o[lang()] || o.he, K = window.KidApp;
    if (Array.isArray(v)) return K && K.g ? (v.length > 2 ? K.g(v[0], v[1], v[2]) : K.g(v[0], v[1])) : v[0];
    return v;
  }
  function meta(k, d) { try { var K = window.KidApp; d = d || {}; d.k = k; if (K && K.track) K.track('meta', d); } catch (e) {} }
  var subs = [];
  function emit(ev) { subs.forEach(function (f) { try { f(ev); } catch (e) {} }); }
  // XP = coins ever earned. noWeek: gifts of the meta layer itself (chests, milestones, badges, pet) do not feed the weekly road
  function addXP(n, noWeek) {
    if (!(n > 0)) return;
    S.earned += n;
    if (noWeek) return;
    weekRoll();
    var before = S.wk.xp; S.wk.xp += n;
    ROAD.forEach(function (c, i) { if (before < c.xp && S.wk.xp >= c.xp) S.pend.push({t: 'road', n: i}); });
  }
  function gift(n) { S.coins += n; addXP(n, true); return n; }

  /* -- play streak -- */
  var STREAK_MS = [[3, 15], [7, 40], [14, 80], [30, 150]]; // [days, coins] – each milestone pays once
  function streakTick(td) {
    var p = S.ps; if (p.last === td) return;
    var gap = p.last ? dayDiff(p.last, td) : 0, wid = weekId(td), saved = false;
    if (!p.last || p.n < 1) p.n = 1;
    else if (gap === 1) p.n++;
    else if (gap === 2 && p.sh !== wid) { p.n++; p.sh = wid; p.sd = addDays(td, -1); saved = true; } // the weekly shield covered yesterday
    else if (gap > 1) p.n = 1; // a new streak simply starts: nothing is lost but the counter
    p.last = td; p.best = Math.max(p.best, p.n);
    S.pend = S.pend.filter(function (x) { return x.t !== 'streak'; });
    if (p.n >= 2) S.pend.push({t: 'streak', n: p.n, sh: saved ? 1 : 0});
    meta('streak', {n: p.n, shield: saved});
    STREAK_MS.forEach(function (m) { if (p.n >= m[0] && !p.ms[m[0]]) { p.ms[m[0]] = 1; gift(m[1]); S.pend.push({t: 'ms', n: m[0]}); meta('streak', {milestone: m[0], coins: m[1]}); } });
  }
  function streak() {
    if (!S) load();
    var td = today(), p = S.ps, gap = p.last ? dayDiff(p.last, td) : 99, wid = weekId(td), free = p.sh !== wid;
    var alive = p.n > 0 && (gap <= 1 || (gap === 2 && free)), n = alive ? p.n : 0, nx = null;
    var ms = STREAK_MS.map(function (m) { var o = {n: m[0], coins: m[1], done: !!p.ms[m[0]]}; if (!nx && !o.done) nx = o; return o; });
    return {n: n, today: gap === 0, best: p.best, shield: free, saved: !free && p.sd ? p.sd : '', saving: alive && gap === 2, next: nx, ms: ms};
  }

  /* -- weekly trophy road -- */
  var ROAD = [{xp: 20, k: 'c', c: 10}, {xp: 50, k: 'c', c: 15}, {xp: 100, k: 's', c: 25}, {xp: 160, k: 'c', c: 20}, {xp: 240, k: 'i', c: 30}, {xp: 340, k: 'c', c: 30}, {xp: 460, k: 's', c: 25}, {xp: 600, k: 't', c: 40}];
  function grantChest(i) { // k: c coins · s sticker (rare pool, else coins) · i avatar item (else coins) · t the weekly champion title + coins
    var c = ROAD[i], r = {i: i, kind: c.k, coins: 0, sticker: null, item: null, title: false}, pool;
    if (c.k === 's') { pool = CAT.filter(function (s) { return s.g === 'rare' && !S.st[s.id]; }); if (pool.length) { r.sticker = pick(pool).id; S.st[r.sticker] = Date.now(); } }
    if (c.k === 'i') { pool = SHOP.filter(function (it) { return it.price > 0 && it.price <= 45 && !S.own[it.id]; }); if (pool.length) { r.item = pick(pool).id; S.own[r.item] = 1; } }
    if (c.k === 't') { S.stats.roads++; r.title = true; }
    if (c.k === 'c' || c.k === 't' || (!r.sticker && !r.item)) r.coins = gift(c.c);
    return r;
  }
  function weekRoll() {
    var id = weekId(today()); if (S.wk.id === id) return false;
    var old = S.wk, rc = null;
    if (old.id && old.xp > 0) { // last week's recap; chests the kid reached but did not open are opened now
      var n = 0, c = 0, g = 0;
      ROAD.forEach(function (ch, i) { if (old.xp >= ch.xp) { n++; if (!old.cl[i]) { var r = grantChest(i); c += r.coins; if (r.sticker || r.item || r.title) g++; } } });
      rc = {id: old.id, xp: old.xp, n: n, c: c, g: g};
    }
    S.wk = {id: id, xp: 0, cl: {}, rc: rc};
    S.pend = S.pend.filter(function (p) { return p.t !== 'road'; });
    if (rc) { checkLevel(); checkBadges(); checkStickers(); }
    return true;
  }
  function road() {
    if (!S) load();
    if (weekRoll()) save();
    var w = S.wk, nx = null, got = 0;
    var chests = ROAD.map(function (c, i) {
      var o = {i: i, xp: c.xp, kind: c.k, e: {c: '💰', s: '🏷️', i: '🎩', t: '👑'}[c.k], coins: c.c, reached: w.xp >= c.xp, claimed: !!w.cl[i]};
      o.ready = o.reached && !o.claimed; if (o.reached) got++; if (!nx && !o.reached) nx = o; return o;
    });
    return {id: w.id, xp: w.xp, max: ROAD[ROAD.length - 1].xp, chests: chests, reached: got, next: nx, ready: chests.filter(function (c) { return c.ready; }).length,
      recap: w.rc ? {xp: w.rc.xp, chests: w.rc.n, coins: w.rc.c, gifts: w.rc.g || 0} : null};
  }
  function claimChest(i) {
    if (!S) load();
    weekRoll(); i = clampInt(i, 0, ROAD.length - 1);
    if (S.wk.xp < ROAD[i].xp || S.wk.cl[i]) return null;
    S.wk.cl[i] = 1;
    var r = grantChest(i);
    S.pend = S.pend.filter(function (p) { return !(p.t === 'road' && p.n === i); });
    checkLevel(); checkBadges(); checkStickers();
    if (r.sticker) S.pend = S.pend.filter(function (p) { return !(p.t === 'sticker' && p.id === r.sticker); }); // the chest shows it itself
    if (r.sticker) r.stickerE = STK_BY[r.sticker].e, r.stickerN = T(STK_BY[r.sticker].n);
    if (r.item) r.itemE = SHOP_BY[r.item].e, r.itemN = T(SHOP_BY[r.item].n);
    save(); meta('chest', {i: i, kind: r.kind, coins: r.coins});
    emit({t: 'earn', coins: r.coins, xp: r.coins, src: 'chest'});
    return r;
  }
  function ackRecap() { if (!S) load(); if (S.wk.rc) { S.wk.rc = null; save(); } }

  /* -- brain boost: learning is the smart way to level up -- */
  var LEARN = {reading: 1, mathquest: 1, wordcity: 1, sciencelab: 1, thinking: 1}, BOOST_MS = 15 * 60000;
  function boostLeft() { var l = S.bo.until - nowMs(); return l > 0 ? Math.min(l, BOOST_MS) : 0; } // a doctored save never buys more than 15 minutes
  function boostTick(game, ev, o, td) {
    if (!LEARN[game]) return;
    var fin = ev === 'levelClear' || ev === 'win' || (ev === 'star' && clampInt(o.stars, 0, 3) > 0) || (ev === 'score' && o.score > 0);
    var k = game + '|' + td; if (!fin || S.bo.d[k]) return;
    Object.keys(S.bo.d).forEach(function (x) { if (x.split('|')[1] !== td) delete S.bo.d[x]; });
    S.bo.d[k] = 1; S.bo.until = nowMs() + BOOST_MS;
    S.pend = S.pend.filter(function (x) { return x.t !== 'boost'; });
    S.pend.push({t: 'boost'}); meta('boost', {game: game});
  }
  function boost() {
    if (!S) load();
    var l = boostLeft(), td = today(), used = Object.keys(LEARN).filter(function (g) { return S.bo.d[g + '|' + td]; });
    return {on: l > 0, left: l, min: Math.ceil(l / 60000), mult: 2, minutes: BOOST_MS / 60000, used: used, can: Object.keys(LEARN).filter(function (g) { return used.indexOf(g) < 0; })};
  }

  /* -- badges (7 x bronze / silver / gold = 21 achievements); an earned badge is a title the kid can wear -- */
  var BADGE_COINS = [10, 25, 50];
  function distinct(s) { return Object.keys(s.stats.plays).filter(function (g) { return isGame(g) && s.stats.plays[g] > 0; }).length; }
  var BADGES = [
    {id: 'explorer', e: '🧭', th: [5, 15, 30], v: distinct,
      n: {he: ['חוקרת', 'חוקר'], fr: ['Exploratrice', 'Explorateur', 'Explorateur·rice'], en: 'Explorer'},
      d: {he: 'לשחק ב-{n} משחקים שונים', fr: 'Jouer à {n} jeux différents', en: 'Play {n} different games'}},
    {id: 'scholar', e: '🎓', th: [10, 50, 150], v: function (s) { return s.stats.lrn; },
      n: {he: ['מלומדת', 'מלומד'], fr: ['Savante', 'Savant', 'Savant·e'], en: 'Scholar'},
      d: {he: 'לאסוף {n} כוכבים ושלבים במשחקי הלמידה', fr: 'Gagner {n} étoiles et niveaux dans les jeux pour apprendre', en: 'Earn {n} stars and levels in the learning games'}},
    {id: 'friend', e: '🤝', th: [1, 5, 20], v: function (s) { return s.stats.onl; },
      n: {he: ['חברה טובה', 'חבר טוב', 'חבר/ה טוב/ה'], fr: ['Super amie', 'Super ami', 'Super ami·e'], en: 'Good Friend'},
      d: {he: 'לנצח {n} פעמים במשחק אונליין עם חברים', fr: 'Gagner {n} fois en ligne avec des amis', en: 'Win {n} online games with friends'}},
    {id: 'collector', e: '📒', th: [10, 30, 60], v: function (s) { return Object.keys(s.st).length; },
      n: {he: ['אספנית', 'אספן'], fr: ['Collectionneuse', 'Collectionneur', 'Collectionneur·se'], en: 'Collector'},
      d: {he: 'לאסוף {n} סטיקרים', fr: 'Collectionner {n} autocollants', en: 'Collect {n} stickers'}},
    {id: 'marathon', e: '🔥', th: [3, 7, 14], v: function (s) { return s.ps.best; },
      n: {he: ['מתמידה', 'מתמיד'], fr: ['Marathonienne', 'Marathonien', 'Marathonien·ne'], en: 'Marathoner'},
      d: {he: 'לשחק {n} ימים ברצף', fr: 'Jouer {n} jours de suite', en: 'Play {n} days in a row'}},
    {id: 'ace', e: '🏅', th: [5, 25, 60], v: function (s) { return s.stats.top5; },
      n: {he: ['שיאנית', 'שיאן'], fr: ['Reine des records', 'Roi des records', 'As des records'], en: 'High Scorer'},
      d: {he: 'להיכנס {n} פעמים לטבלת 5 השיאים של משחק', fr: 'Entrer {n} fois dans le top 5 d’un jeu', en: 'Enter a game’s top 5 {n} times'}},
    {id: 'weekly', e: '🏆', th: [1, 3, 8], v: function (s) { return s.stats.roads; },
      n: {he: ['אלופת השבוע', 'אלוף השבוע', 'אלוף/ת השבוע'], fr: ['Championne de la semaine', 'Champion de la semaine', 'Champion·ne de la semaine'], en: 'Champion of the Week'},
      d: {he: 'לסיים את דרך הגביעים השבועית {n} פעמים', fr: 'Finir la route des trophées {n} fois', en: 'Finish the weekly trophy road {n} times'}}
  ];
  var BADGE_BY = Object.create(null); BADGES.forEach(function (b) { BADGE_BY[b.id] = b; });
  var MEDAL = ['', '🥉', '🥈', '🥇'];
  function tierOf(B, s) { var v = B.v(s), t = 0; B.th.forEach(function (x, i) { if (v >= x) t = i + 1; }); return t; }
  function checkBadges(silent) {
    var got = [];
    BADGES.forEach(function (B) {
      var t = tierOf(B, S), had = S.bd[B.id] || 0; if (t <= had) return;
      S.bd[B.id] = t; if (silent) return;
      for (var k = had; k < t; k++) gift(BADGE_COINS[k]);
      S.pend.push({t: 'badge', id: B.id, n: t}); got.push(B.id); meta('badge', {id: B.id, tier: t});
    });
    return got;
  }
  function badgeTitle(B, t) { return B.e + ' ' + TG(B.n) + (t ? ' ' + MEDAL[t] : ''); }
  function badges() {
    if (!S) load();
    return BADGES.map(function (B) {
      var t = S.bd[B.id] || 0, v = B.v(S), nx = t < 3 ? B.th[t] : null, lo = t ? B.th[t - 1] : 0;
      return {id: B.id, e: B.e, name: TG(B.n), title: badgeTitle(B, t), tier: t, medal: MEDAL[t], val: v, goal: nx, coins: nx ? BADGE_COINS[t] : 0,
        pct: nx ? Math.max(0, Math.min(100, Math.round((v - lo) / (nx - lo) * 100))) : 100, desc: T(B.d).replace('{n}', nx || B.th[2]), on: S.ti === B.id};
    });
  }
  function title() { if (!S) load(); var B = BADGE_BY[S.ti], t = B ? S.bd[B.id] || 0 : 0; return B && t ? {id: B.id, e: B.e, tier: t, text: badgeTitle(B, t)} : null; }
  function setTitle(id) { if (!S) load(); if (id && !(BADGE_BY[id] && S.bd[id])) return false; S.ti = id || ''; save(); meta('badge', {title: S.ti || 'none'}); return true; }

  /* -- companion pet: an egg that hatches and grows with total XP; purely cosmetic and always glad to see the kid -- */
  var PET_XP = [0, 40, 250, 800, 2000], PET_COINS = {feed: 3, pat: 2};
  var PET_N = {
    cat: [{he: 'ביצה מסתורית', fr: 'Œuf mystère', en: 'Mystery egg'}, {he: 'גור חתולים', fr: 'Bébé chat', en: 'Baby kitten'}, {he: 'חתלתול שובב', fr: 'Chaton joueur', en: 'Playful kitten'}, {he: 'חתול הרפתקן', fr: 'Chat aventurier', en: 'Adventure cat'}, {he: 'חתול מלכותי', fr: 'Chat royal', en: 'Royal cat'}],
    tiger: [{he: 'ביצה מסתורית', fr: 'Œuf mystère', en: 'Mystery egg'}, {he: 'גור טיגריסים', fr: 'Bébé tigre', en: 'Baby tiger'}, {he: 'טיגריסון שובב', fr: 'Tigron joueur', en: 'Playful cub'}, {he: 'טיגריס הרפתקן', fr: 'Tigre aventurier', en: 'Adventure tiger'}, {he: 'טיגריס מלכותי', fr: 'Tigre royal', en: 'Royal tiger'}]
  };
  function petStage(xp) { var s = 0; PET_XP.forEach(function (t, i) { if (xp >= t) s = i; }); return s; }
  function checkPet() {
    var st = petStage(S.earned);
    if (S.pet.st < 0) { S.pet.st = st; return; }
    if (st > S.pet.st) { S.pet.st = st; S.pend.push({t: 'pet', n: st}); meta('pet', {stage: st, kind: S.pet.k}); }
  }
  function pet() {
    if (!S) load();
    var td = today(), p = S.pet, st = petStage(S.earned), fed = p.fed === td, pat = p.pat === td, h = new Date().getHours();
    var mood = fed && pat ? 'love' : fed || pat ? 'happy' : (h >= 21 || h < 6) ? 'sleepy' : S.ps.last === td ? 'playful' : 'hello';
    var lo = PET_XP[st], hi = st < PET_XP.length - 1 ? PET_XP[st + 1] : null;
    return {kind: p.k, stage: st, stages: PET_XP.length, name: T(PET_N[p.k][st]), mood: mood, fed: fed, pat: pat, cares: p.n, feedCoins: PET_COINS.feed, patCoins: PET_COINS.pat,
      need: hi ? hi - S.earned : 0, pct: hi ? Math.max(0, Math.min(100, Math.round((S.earned - lo) / (hi - lo) * 100))) : 100, next: hi ? T(PET_N[p.k][st + 1]) : ''};
  }
  function petCare(a) { // one feed and one cuddle a day; skipping a day changes nothing
    if (!S) load();
    if (a !== 'feed' && a !== 'pat') return null;
    var td = today(), f = a === 'feed' ? 'fed' : 'pat'; if (S.pet[f] === td) return null;
    S.pet[f] = td; S.pet.n++;
    var c = gift(PET_COINS[a]); checkLevel(); checkPet(); checkBadges(); checkStickers(); save();
    meta('pet', {a: a, stage: petStage(S.earned), kind: S.pet.k});
    emit({t: 'earn', coins: c, xp: c, src: 'pet'});
    return {coins: c};
  }
  function petKind(k) { if (!S) load(); if (k !== 'cat' && k !== 'tiger') return false; if (S.pet.k !== k) { S.pet.k = k; save(); meta('pet', {kind: k}); } return true; }
  function petSVG(px, o) {
    var p = pet(); o = o || {}; px = px || 96;
    var kind = o.kind || p.kind, st = o.stage != null ? o.stage : p.stage, mood = o.mood || p.mood, g = [];
    var C = kind === 'tiger' ? ['#ff9f2e', '#fff1d6', '#3a2718', '#e07a10'] : ['#b9c2d0', '#f4f6fa', '#6f7a8c', '#8e99ab'];
    g.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + px + '" height="' + px + '" role="img" aria-label="' + escH(T(PET_N[kind][st])) + '">');
    g.push('<ellipse cx="50" cy="92" rx="30" ry="5" fill="#000" opacity=".16"/>');
    if (st === 0) { // the egg (it wiggles when it is cared for)
      g.push('<path d="M50 14 C30 14 20 46 20 62 a30 28 0 0 0 60 0 C80 46 70 14 50 14Z" fill="' + C[1] + '" stroke="' + C[3] + '" stroke-width="3"/>');
      g.push('<circle cx="38" cy="44" r="6" fill="' + C[0] + '"/><circle cx="62" cy="58" r="8" fill="' + C[0] + '"/><circle cx="44" cy="72" r="5" fill="' + C[0] + '"/><circle cx="60" cy="32" r="4" fill="' + C[0] + '"/>');
      if (mood === 'love' || mood === 'happy') g.push('<path d="M34 30 l6 7 l5 -7 l6 7 l5 -7 l6 7" fill="none" stroke="' + C[2] + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>');
    } else {
      var k = [0, .62, .76, .9, 1][st], tx = 50 - 50 * k, ty = 90 - 90 * k;
      g.push('<g transform="translate(' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ') scale(' + k + ')">');
      g.push('<path d="M76 84 C96 82 98 60 86 56" fill="none" stroke="' + C[0] + '" stroke-width="8" stroke-linecap="round"/>');
      g.push('<ellipse cx="50" cy="74" rx="26" ry="19" fill="' + C[0] + '"/><ellipse cx="50" cy="78" rx="14" ry="12" fill="' + C[1] + '"/>');
      g.push('<path d="M22 44 L24 14 L44 30Z" fill="' + C[0] + '"/><path d="M78 44 L76 14 L56 30Z" fill="' + C[0] + '"/><path d="M27 36 L28 22 L38 31Z" fill="#ff9ec7"/><path d="M73 36 L72 22 L62 31Z" fill="#ff9ec7"/>');
      g.push('<ellipse cx="50" cy="48" rx="31" ry="27" fill="' + C[0] + '"/><ellipse cx="50" cy="58" rx="15" ry="10" fill="' + C[1] + '"/>');
      if (kind === 'tiger') g.push('<path d="M42 23 q2 6 0 10 M50 21 v12 M58 23 q-2 6 0 10 M20 46 h9 M21 54 h8 M80 46 h-9 M79 54 h-8" stroke="' + C[2] + '" stroke-width="3.2" stroke-linecap="round" fill="none"/>');
      else g.push('<path d="M43 24 q2 5 0 9 M50 22 v10 M57 24 q-2 5 0 9" stroke="' + C[2] + '" stroke-width="2.6" stroke-linecap="round" fill="none"/>');
      if (mood === 'sleepy') g.push('<path d="M32 49 q5 4 10 0 M58 49 q5 4 10 0" stroke="#2b2140" stroke-width="2.6" fill="none" stroke-linecap="round"/><text x="74" y="22" font-size="13" font-weight="900" fill="#8fb4ff">z</text>');
      else if (mood === 'love' || mood === 'happy') g.push('<path d="M32 50 q5 -7 10 0 M58 50 q5 -7 10 0" stroke="#2b2140" stroke-width="2.8" fill="none" stroke-linecap="round"/>');
      else g.push('<ellipse cx="37" cy="48" rx="5" ry="6.5" fill="#2b2140"/><ellipse cx="63" cy="48" rx="5" ry="6.5" fill="#2b2140"/><circle cx="39" cy="45.5" r="1.8" fill="#fff"/><circle cx="65" cy="45.5" r="1.8" fill="#fff"/>');
      g.push('<path d="M46.5 55 h7 l-3.5 4Z" fill="#ff6f91"/><path d="M50 59 q-4 5 -8 1.5 M50 59 q4 5 8 1.5" stroke="#7a2b1b" stroke-width="1.8" fill="none" stroke-linecap="round"/>');
      g.push('<circle cx="27" cy="58" r="4.2" fill="#ff9ec7" opacity=".6"/><circle cx="73" cy="58" r="4.2" fill="#ff9ec7" opacity=".6"/>');
      if (st >= 3) g.push('<path d="M38 80 q12 8 24 0" stroke="#ff4d6d" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="50" cy="86" r="4.5" fill="#ffd24a" stroke="#c99a1b" stroke-width="1.4"/>');
      if (st >= 4) g.push('<path d="M34 23 L34 7 L43 15 L50 3 L57 15 L66 7 L66 23Z" fill="#ffd24a" stroke="#c99a1b" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="17" r="2.4" fill="#ff4d6d"/>');
      g.push('</g>');
    }
    if (mood === 'love') g.push('<path d="M82 20 c-4 -7 -13 -1 -7 6 l7 7 l7 -7 c6 -7 -3 -13 -7 -6Z" fill="#ff4d8d"/>');
    if (mood === 'playful') g.push('<path d="M14 18 l2.2 5 l5 2.2 l-5 2.2 l-2.2 5 l-2.2 -5 l-5 -2.2 l5 -2.2Z" fill="#ffd24a"/>');
    g.push('</svg>');
    return g.join('');
  }

  /* ---------- text ---------- */
  var TXT = {
    new: {he: 'סטיקר חדש!', fr: 'Nouvel autocollant !', en: 'New sticker!'},
    coins: {he: 'מטבעות', fr: 'pièces', en: 'coins'},
    gift: {he: 'מתנה יומית מחכה!', fr: 'Cadeau du jour !', en: 'Daily gift waiting!'},
    more: {he: 'ועוד {n}…', fr: 'et {n} de plus…', en: 'and {n} more…'},
    level: {he: 'עלית לרמה {n}!', fr: 'Niveau {n} atteint !', en: 'Level {n} reached!'},
    quest: {he: 'משימה הושלמה!', fr: 'Mission accomplie !', en: 'Quest complete!'},
    questN: {he: '{n} משימות הושלמו!', fr: '{n} missions accomplies !', en: '{n} quests complete!'},
    qall: {he: 'כל משימות היום הושלמו!', fr: 'Toutes les missions du jour !', en: 'All daily quests done!'},
    bonus: {he: 'בונוס', fr: 'bonus', en: 'bonus'},
    chal: {he: 'ניצחת את האתגר של {n}!', fr: 'Tu as battu le défi de {n} !', en: "You beat {n}'s challenge!"},
    chalGo: {he: 'האתגר של {n}', fr: 'Le défi de {n}', en: "{n}'s challenge"},
    pts: {he: 'נקודות — נראה אותך עוברת!', fr: 'points à battre !', en: 'points to beat!'},
    streak: {he: '{n} ימים ברצף!', fr: '{n} jours de suite !', en: '{n} days in a row!'},
    streakS: {he: 'כל הכבוד על ההתמדה', fr: 'Bravo pour ta régularité', en: 'Great going'},
    shield: {he: '🛡️ המגן שמר על הרצף אתמול', fr: '🛡️ Le bouclier a gardé ta série hier', en: '🛡️ The shield kept your streak yesterday'},
    ms: {he: 'אבן דרך: {n} ימים!', fr: 'Étape : {n} jours !', en: 'Milestone: {n} days!'},
    badge: {he: 'תג חדש!', fr: 'Nouveau badge !', en: 'New badge!'},
    boost: {he: 'בוסט מוח! XP כפול', fr: 'Boost cerveau ! XP x2', en: 'Brain boost! Double XP'},
    boostS: {he: 'בכל המשחקים, ל-{n} דקות', fr: 'Dans tous les jeux, pendant {n} minutes', en: 'In every game, for {n} minutes'},
    pet: {he: 'החיה שלך גדלה!', fr: 'Ton compagnon a grandi !', en: 'Your pet grew!'},
    petH: {he: 'הביצה בקעה!', fr: 'L’œuf a éclos !', en: 'The egg hatched!'},
    road: {he: 'תיבה מחכה בדרך הגביעים!', fr: 'Un coffre t’attend sur la route des trophées !', en: 'A chest is waiting on the trophy road!'},
    roadS: {he: 'פותחים אותה בעמוד הבית', fr: 'Ouvre-le sur la page d’accueil', en: 'Open it on the home page'}
  };

  /* ---------- core: award ---------- */
  var DEFAULT_COINS = {win: 5, levelClear: 2, combo: 0, score: 0, play: 0, firstPlay: 0};
  function award(o) {
    try {
      if (!S) load();
      if (!o || typeof o !== 'object') return {coins: 0, stickers: []};
      var game = typeof o.game === 'string' && /^[a-z0-9_-]{1,30}$/i.test(o.game) && !(o.game in Object.prototype) ? o.game : 'misc', ev = String(o.event || 'play'), c = 0;
      var st = S.stats, td = today(), first = !st.plays[game], real = isGame(game) && game !== 'retro', boosted = boostLeft() > 0, xp0 = S.earned, co0 = S.coins;
      if (ev === 'play' || ev === 'firstPlay') { st.plays[game] = (st.plays[game] || 0) + 1; }
      else if (ev === 'win') { st.wins[game] = (st.wins[game] || 0) + 1; st.winsTotal++; c = DEFAULT_COINS.win; if (real && (o.online === true || window.__arOnline === true)) st.onl++; }
      else if (ev === 'levelClear') { if (isNum(o.level)) st.levelMax = Math.max(st.levelMax, clampInt(o.level, 0, 9999)); c = DEFAULT_COINS.levelClear; if (!st.plays[game]) st.plays[game] = 1; if (LEARN[game]) st.lrn++; }
      else if (ev === 'star') { var n = clampInt(o.stars, 0, 3); if (n > 0) { st.stars[game] = (st.stars[game] || 0) + n; st.starsTotal += n; if (LEARN[game]) st.lrn += n; c = 2 * n; if (n === 3) { st.perfects++; c += 5; } } }
      else if (ev === 'combo') { if (isNum(o.score)) { var cb = clampInt(o.score, 0, 9999); st.comboMax = Math.max(st.comboMax, cb); if (cb >= 5) c = 1; } }
      else if (ev === 'score') {
        if (isNum(o.score)) {
          st.best[game] = Math.max(st.best[game] || 0, clampInt(o.score, 0, 1e9));
          if (real && o.score >= 1) { // the game's own top 5 (for the high-scorer badge)
            var tp = st.top[game] || (st.top[game] = []), sc = clampInt(o.score, 1, 1e9);
            if (tp.length < 5 || sc > tp[tp.length - 1]) { tp.push(sc); tp.sort(function (a, b) { return b - a; }); if (tp.length > 5) tp.length = 5; st.top5++; }
          }
          S.ch.forEach(function (ch) {
            if (ch.won || ch.g !== game || !(o.score >= ch.s)) return;
            var ck = 'chal|' + td, paid = (st.daily[ck] || 0) < 3 ? 10 : 0; // at most 3 paid challenge wins a day
            ch.won = true; if (paid) { st.daily[ck] = (st.daily[ck] || 0) + 1; S.coins += paid; addXP(paid); }
            S.pend.push({t: 'chal', g: game, n: ch.n, c: paid});
          });
        }
      }
      if (isNum(o.level) && ev !== 'levelClear') st.levelMax = Math.max(st.levelMax, clampInt(o.level, 0, 9999));
      if (isNum(o.coins)) c = clampInt(o.coins, 0, 200);
      // daily cap per game (kid-safe: no endless grinding)
      var key = game + '|' + td, used = st.daily[key] || 0;
      if (c > 0) { c = Math.max(0, Math.min(c, CAP_PER_GAME_DAY - used)); st.daily[key] = used + c; trimDaily(td); }
      if (c > 0) { S.coins += c; addXP(boosted ? 2 * c : c); queueCoins(c); } // brain boost doubles XP, never coins
      if (real) { streakTick(td); boostTick(game, ev, o, td); }
      if (isGame(game) && game !== 'retro') { var ri = S.rec.indexOf(game); if (ri !== 0) { if (ri > 0) S.rec.splice(ri, 1); S.rec.unshift(game); S.rec = S.rec.slice(0, 8); } }
      questTick(game, ev, o, c, first);
      checkBadges(); checkLevel(); checkPet();
      var got = checkStickers();
      save();
      if (S.earned > xp0 || S.coins > co0) emit({t: 'earn', coins: S.coins - co0, xp: S.earned - xp0, boost: boosted && c > 0, game: game});
      return {coins: c, xp: S.earned - xp0, boost: boosted && c > 0, stickers: got};
    } catch (e) { return {coins: 0, stickers: []}; }
  }
  function trimDaily(td) { var d = S.stats.daily, ks = Object.keys(d); if (ks.length > 120) ks.forEach(function (k) { if (k.split('|')[1] !== td) delete d[k]; }); }
  function checkStickers() {
    var got = [];
    CAT.forEach(function (s) { if (!S.st[s.id] && s.rule && s.rule(S)) { S.st[s.id] = Date.now(); S.pend.push({t: 'sticker', id: s.id}); got.push(s.id); } });
    if (S.pend.length > 30) S.pend = S.pend.slice(-30);
    return got;
  }
  function queueCoins(n) {
    var last = S.pend[S.pend.length - 1];
    if (last && last.t === 'coins') last.n += n; else S.pend.push({t: 'coins', n: n});
  }

  /* ---------- daily gift ---------- */
  var GIFT_COINS = [10, 12, 15, 20, 25, 30, 60];
  function dailyStatus() {
    if (!S) load();
    var td = today(), d = S.daily, avail = d.last !== td;
    var cont = d.last === addDays(td, -1) || d.last === td;
    var nextStreak = avail ? (cont ? d.streak + 1 : 1) : d.streak;
    var days = []; for (var i = 6; i >= 0; i--) { var k = addDays(td, -i); days.push({key: k, got: d.days.indexOf(k) >= 0, today: i === 0}); }
    return {available: avail, streak: avail ? (cont ? d.streak : 0) : d.streak, nextStreak: nextStreak, best: d.best, days: days, nextCoins: GIFT_COINS[(nextStreak - 1) % 7]};
  }
  function claimDaily() {
    if (!S) load();
    var st = dailyStatus(); if (!st.available) return null;
    var td = today(), d = S.daily;
    d.streak = st.nextStreak; d.best = Math.max(d.best, d.streak); d.last = td; d.count++;
    d.days.push(td); d.days = d.days.slice(-14); S.stats.gifts++;
    var coins = GIFT_COINS[(d.streak - 1) % 7], sticker = null;
    var pool = CAT.filter(function (s) { return s.g === 'rare' && !S.st[s.id]; });
    if (pool.length && (d.streak % 7 === 0 || Math.random() < 0.3)) { sticker = pick(pool).id; S.st[sticker] = Date.now(); }
    S.coins += coins; addXP(coins);
    checkBadges(); checkLevel(); checkPet();
    var more = checkStickers();
    save();
    // the gift reveal is shown by the album itself: drop the gift's own sticker from the queue to avoid double toasts
    if (sticker) S.pend = S.pend.filter(function (p) { return !(p.t === 'sticker' && p.id === sticker); });
    save();
    emit({t: 'earn', coins: coins, xp: coins, src: 'gift'});
    return {coins: coins, sticker: sticker, streak: d.streak, extra: more};
  }

  /* ---------- shop ---------- */
  function shop() {
    if (!S) load();
    return SHOP.map(function (it) { return {id: it.id, kind: it.kind, key: it.key, e: it.e, price: it.price, n: it.n, owned: it.price === 0 || !!S.own[it.id], on: S.av[it.kind] === it.key}; });
  }
  function buy(id) {
    if (!S) load();
    var it = SHOP_BY[id]; if (!it) return false;
    if (it.price === 0 || S.own[id]) return true;
    if (S.coins < it.price) return false;
    S.coins -= it.price; S.own[id] = 1; S.stats.bought++;
    checkStickers(); save(); return true;
  }
  function equip(id, on) {
    if (!S) load();
    var it = SHOP_BY[id]; if (!it) return false;
    if (it.price > 0 && !S.own[id]) return false;
    if (on === false) { if (it.kind === 'color' || it.kind === 'bg') return false; S.av[it.kind] = ''; }
    else S.av[it.kind] = it.key;
    save(); return true;
  }
  function spend(n) { if (!S) load(); n = clampInt(n, 0, 1e7); if (S.coins < n) return false; S.coins -= n; save(); return true; }

  /* ---------- the kitten avatar (inline SVG) ---------- */
  function avatar() { if (!S) load(); var a = S.av; return {color: a.color || 'orange', hat: a.hat || '', bow: a.bow || '', glass: a.glass || '', bg: a.bg || 'sky'}; }
  function avatarSVG(px, cfg) {
    cfg = cfg || avatar(); px = px || 120;
    var c = COLORS[cfg.color] || COLORS.orange, f = c[0], belly = c[1], dk = c[2], g = [];
    var uid = 'av' + Math.floor(Math.random() * 1e6);
    g.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="' + px + '" height="' + px + '" role="img" aria-label="kitten">');
    // background
    var bgc = {sky: ['#bfe5ff', '#e9f6ff'], stars: ['#3a2a73', '#5b46a8'], hearts: ['#ffd1e3', '#fff0f6'], candy: ['#ffe4a8', '#ffc4de']}[cfg.bg] || ['#bfe5ff', '#e9f6ff'];
    g.push('<defs><linearGradient id="' + uid + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + bgc[0] + '"/><stop offset="1" stop-color="' + bgc[1] + '"/></linearGradient></defs>');
    g.push('<rect width="120" height="120" rx="26" fill="url(#' + uid + 'b)"/>');
    if (cfg.bg === 'stars') for (var i = 0; i < 9; i++) g.push('<circle cx="' + (10 + (i * 37) % 100) + '" cy="' + (10 + (i * 23) % 50) + '" r="' + (1.3 + (i % 3) * .5) + '" fill="#ffe14d"/>');
    if (cfg.bg === 'hearts') for (var j = 0; j < 6; j++) g.push('<text x="' + (8 + (j * 41) % 100) + '" y="' + (18 + (j * 27) % 60) + '" font-size="12" fill="#ff7aa8">♥</text>');
    if (cfg.bg === 'candy') for (var k = 0; k < 6; k++) g.push('<circle cx="' + (12 + (k * 43) % 96) + '" cy="' + (14 + (k * 29) % 64) + '" r="5" fill="' + (k % 2 ? '#ff7ab8' : '#7acfff') + '"/>');
    // body + tail
    g.push('<path d="M92 104 C112 100 114 76 100 70" fill="none" stroke="' + f + '" stroke-width="9" stroke-linecap="round"/>');
    g.push('<ellipse cx="60" cy="100" rx="30" ry="22" fill="' + f + '"/><ellipse cx="60" cy="104" rx="17" ry="15" fill="' + belly + '"/>');
    // ears
    g.push('<path d="M26 56 L30 22 L54 40 Z" fill="' + f + '"/><path d="M94 56 L90 22 L66 40 Z" fill="' + f + '"/>');
    g.push('<path d="M32 46 L33 30 L45 40 Z" fill="#ff9ec7"/><path d="M88 46 L87 30 L75 40 Z" fill="#ff9ec7"/>');
    // head
    g.push('<ellipse cx="60" cy="62" rx="36" ry="32" fill="' + f + '"/>');
    g.push('<path d="M50 34 q3 6 0 10 M60 32 q0 7 0 11 M70 34 q-3 6 0 10" stroke="' + dk + '" stroke-width="3" stroke-linecap="round" fill="none"/>');
    g.push('<ellipse cx="60" cy="74" rx="17" ry="12" fill="' + belly + '"/>');
    // eyes
    if (cfg.glass === 'heart') { g.push('<text x="36" y="68" font-size="22" fill="#ff4d8d">♥</text><text x="62" y="68" font-size="22" fill="#ff4d8d">♥</text>'); }
    else {
      g.push('<ellipse cx="45" cy="62" rx="7.5" ry="9" fill="#fff"/><ellipse cx="75" cy="62" rx="7.5" ry="9" fill="#fff"/>');
      g.push('<ellipse cx="46.5" cy="63" rx="4.2" ry="6" fill="#2b2140"/><ellipse cx="73.5" cy="63" rx="4.2" ry="6" fill="#2b2140"/>');
      g.push('<circle cx="48" cy="60" r="1.8" fill="#fff"/><circle cx="75" cy="60" r="1.8" fill="#fff"/>');
    }
    // nose, mouth, cheeks, whiskers
    g.push('<path d="M56 70 h8 l-4 5 Z" fill="#ff6f91"/><path d="M60 75 q-5 6 -10 2 M60 75 q5 6 10 2" stroke="#7a2b1b" stroke-width="2" fill="none" stroke-linecap="round"/>');
    g.push('<circle cx="32" cy="74" r="5" fill="#ff9ec7" opacity=".55"/><circle cx="88" cy="74" r="5" fill="#ff9ec7" opacity=".55"/>');
    g.push('<path d="M30 70 l-16 -3 M30 76 l-16 3 M90 70 l16 -3 M90 76 l16 3" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>');
    // glasses
    if (cfg.glass === 'round') g.push('<circle cx="45" cy="62" r="12" fill="#bfe5ff" fill-opacity=".25" stroke="#3b3547" stroke-width="2.4"/><circle cx="75" cy="62" r="12" fill="#bfe5ff" fill-opacity=".25" stroke="#3b3547" stroke-width="2.4"/><path d="M57 62 h6" stroke="#3b3547" stroke-width="2.4"/>');
    if (cfg.glass === 'sun') g.push('<rect x="31" y="54" width="27" height="17" rx="7" fill="#2b2140"/><rect x="62" y="54" width="27" height="17" rx="7" fill="#2b2140"/><path d="M58 60 h4" stroke="#2b2140" stroke-width="3"/><path d="M36 58 l8 0 M67 58 l8 0" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>');
    // bow / scarf / bell
    if (cfg.bow === 'red' || cfg.bow === 'blue') { var bc = cfg.bow === 'red' ? '#ff4d6d' : '#4d9dff'; g.push('<path d="M60 90 L44 82 L44 98 Z M60 90 L76 82 L76 98 Z" fill="' + bc + '"/><circle cx="60" cy="90" r="5" fill="' + bc + '" stroke="#fff" stroke-width="1.5"/>'); }
    if (cfg.bow === 'scarf') g.push('<path d="M32 88 q28 14 56 0 l0 10 q-28 14 -56 0 Z" fill="#ff7a59"/><path d="M40 90 v20 h10 v-16" fill="#ff7a59"/><path d="M34 92 q26 10 52 0" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none" stroke-dasharray="4 4"/>');
    if (cfg.bow === 'bell') g.push('<path d="M36 90 q24 10 48 0" stroke="#ff4d6d" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="60" cy="98" r="7" fill="#ffd24a" stroke="#c99a1b" stroke-width="2"/><path d="M56 99 h8" stroke="#c99a1b" stroke-width="2"/>');
    // hats
    var hat = cfg.hat;
    if (hat === 'party') g.push('<path d="M44 34 L60 4 L76 34 Z" fill="#ff7ab8"/><path d="M50 26 h20 M54 18 h12" stroke="#fff" stroke-width="3"/><circle cx="60" cy="4" r="4.5" fill="#ffd24a"/>');
    if (hat === 'crown') g.push('<path d="M38 34 L38 14 L50 24 L60 8 L70 24 L82 14 L82 34 Z" fill="#ffd24a" stroke="#c99a1b" stroke-width="2.4" stroke-linejoin="round"/><circle cx="50" cy="28" r="2.6" fill="#ff4d6d"/><circle cx="60" cy="27" r="2.6" fill="#4d9dff"/><circle cx="70" cy="28" r="2.6" fill="#38d39f"/>');
    if (hat === 'top') g.push('<rect x="44" y="6" width="32" height="28" rx="3" fill="#2b2140"/><rect x="44" y="24" width="32" height="6" fill="#e23b6a"/><rect x="34" y="32" width="52" height="7" rx="3.5" fill="#2b2140"/>');
    if (hat === 'chef') g.push('<path d="M42 36 L42 22 q-12 -4 -4 -16 q10 -6 14 2 q8 -10 16 0 q10 -8 14 2 q8 12 -4 14 L78 36 Z" fill="#fff" stroke="#d8d8e2" stroke-width="2"/>');
    if (hat === 'flower') g.push('<g transform="translate(78 32)"><circle r="5" fill="#ffd24a"/><circle cx="0" cy="-9" r="5.5" fill="#ff7ab8"/><circle cx="9" cy="-3" r="5.5" fill="#ff7ab8"/><circle cx="6" cy="8" r="5.5" fill="#ff7ab8"/><circle cx="-6" cy="8" r="5.5" fill="#ff7ab8"/><circle cx="-9" cy="-3" r="5.5" fill="#ff7ab8"/><circle r="4.6" fill="#ffd24a"/></g>');
    if (hat === 'cap') g.push('<path d="M34 38 q2 -26 26 -26 q24 0 26 26 Z" fill="#4d9dff"/><path d="M60 38 h36 q0 8 -16 8 h-20 Z" fill="#2f6fd0"/><circle cx="60" cy="12" r="3" fill="#2f6fd0"/>');
    if (hat === 'wizard') g.push('<path d="M36 38 L60 -6 L84 38 Z" fill="#6a4bd6"/><ellipse cx="60" cy="38" rx="34" ry="6" fill="#4b32a8"/><text x="52" y="30" font-size="14" fill="#ffd24a">★</text>');
    g.push('</svg>');
    return g.join('');
  }

  /* ---------- toasts (never block play; shown on flush()) ---------- */
  var toastEl = null, flushing = false, reflush = false, styled = false;
  function addStyle() {
    if (styled) return; styled = true;
    var st = document.createElement('style');
    st.textContent = '.ar-toast{position:fixed;left:50%;width:max-content;top:max(10px,env(safe-area-inset-top));transform:translate(-50%,-140%);z-index:2147482000;pointer-events:none;display:flex;align-items:center;gap:12px;max-width:min(92vw,420px);' +
      'padding:10px 18px 10px 14px;border-radius:26px;background:linear-gradient(135deg,#fff7d6,#ffe1f0);border:3px solid #ffb84d;box-shadow:0 8px 0 #0002,0 10px 24px #0004;color:#5b3b8c;font:800 17px/1.15 Rubik,"Varela Round",Arial,sans-serif;opacity:0;transition:transform .45s cubic-bezier(.2,1.4,.4,1),opacity .25s}' +
      '.ar-toast.on{transform:translate(-50%,0);opacity:1}.ar-toast .e{font-size:38px;line-height:1;filter:drop-shadow(0 2px 0 #0002)}.ar-toast small{display:block;font-size:13px;font-weight:700;opacity:.8}';
    document.head.appendChild(st);
  }
  function chime() {
    try {
      if (lsGet('annabelle-muted') === '1') return;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var a = window.__arAC || (window.__arAC = new AC()); if (a.state === 'suspended') a.resume();
      var t0 = a.currentTime;
      [[784, 0], [988, .1], [1319, .2]].forEach(function (n) {
        var o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = n[0];
        g.gain.setValueAtTime(0, t0 + n[1]); g.gain.linearRampToValueAtTime(.12, t0 + n[1] + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + n[1] + .3);
        o.connect(g); g.connect(a.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + .32);
      });
    } catch (e) {}
  }
  function showToast(html, ms, cb) {
    addStyle();
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ar-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastEl); }
    toastEl.dir = lang() === 'he' ? 'rtl' : 'ltr'; toastEl.innerHTML = html;
    void toastEl.offsetWidth; toastEl.classList.add('on');
    setTimeout(function () { toastEl.classList.remove('on'); setTimeout(cb, 500); }, ms);
  }
  function flush() {
    try {
      if (!S) load();
      if (!S.pend.length || !document.body) return false;
      var J = window.Juice, home = /(^|\/)(index\.html)?$/.test(location.pathname), jl = !!(J && typeof J.levelUp === 'function') && !home;
      if (flushing && !(jl && S.pend.every(function (p) { return p.t === 'level'; }))) { reflush = true; return false; } // shown right after the banners that are on screen
      if (jl && S.pend.every(function (p) { return p.t === 'level'; })) { try { J.levelUp(S.pend.reduce(function (m, p) { return Math.max(m, clampInt(p.n, 1, 9999)); }, 1)); } catch (e) {} return false; }
      var q = S.pend.slice(), coins = 0, stk = [], pre = [], lvMax = 0, qs = [], qall = false, chs = [], sk = null, msN = 0, bdg = [], bst = false, petN = -1, roadN = 0;
      q.forEach(function (p) {
        if (p.t === 'coins') coins += p.n;
        else if (p.t === 'level') lvMax = Math.max(lvMax, clampInt(p.n, 1, 9999));
        else if (p.t === 'quest') { if (QUEST_BY[p.id]) qs.push(QUEST_BY[p.id]); }
        else if (p.t === 'qall') qall = true;
        else if (p.t === 'chal') { if (isGame(p.g)) chs.push(p); }
        else if (p.t === 'streak') sk = p;
        else if (p.t === 'ms') msN = Math.max(msN, clampInt(p.n, 0, 999));
        else if (p.t === 'badge') { if (BADGE_BY[p.id]) bdg.push(p); }
        else if (p.t === 'boost') bst = true;
        else if (p.t === 'pet') petN = Math.max(petN, clampInt(p.n, 0, 9));
        else if (p.t === 'road') roadN++;
        else if (STK_BY[p.id]) stk.push(STK_BY[p.id]);
      });
      if (lvMax && !home && !jl && !document.querySelector('.lvup')) pre.push('<span class="e">' + rankOf(lvMax)[1] + '</span><span>' + T(TXT.level).replace('{n}', lvMax) + '<small>' + T(rankOf(lvMax)[2]) + '</small></span>');
      if (qall) pre.push('<span class="e">🎉</span><span>' + T(TXT.qall) + '<small>💰 +' + (qs.length * QUEST_COINS + QUEST_BONUS) + ' (' + T(TXT.bonus) + ' +' + QUEST_BONUS + ')</small></span>');
      else if (qs.length > 1) pre.push('<span class="e">✅</span><span>' + T(TXT.questN).replace('{n}', qs.length) + '<small>💰 +' + qs.length * QUEST_COINS + '</small></span>');
      else if (qs.length) pre.push('<span class="e">✅</span><span>' + T(TXT.quest) + '<small>' + T(qs[0].t) + ' · 💰 +' + QUEST_COINS + '</small></span>');
      chs.slice(0, 2).forEach(function (p) { pre.push('<span class="e">🏆</span><span>' + T(TXT.chal).replace('{n}', escH(cleanName(p.n))) + '<small>' + escH(gname(p.g)) + (p.c === 0 ? '' : ' · 💰 +10') + '</small></span>'); });
      if (msN) { var mc = 0; STREAK_MS.forEach(function (m) { if (m[0] === msN) mc = m[1]; }); pre.push('<span class="e">🔥</span><span>' + T(TXT.ms).replace('{n}', msN) + '<small>💰 +' + mc + '</small></span>'); }
      else if (sk) pre.push('<span class="e">🔥</span><span>' + T(TXT.streak).replace('{n}', clampInt(sk.n, 0, 9999)) + '<small>' + T(sk.sh ? TXT.shield : TXT.streakS) + '</small></span>');
      bdg.slice(-2).forEach(function (p) { var B = BADGE_BY[p.id], t = clampInt(p.n, 1, 3); pre.push('<span class="e">' + B.e + '</span><span>' + T(TXT.badge) + '<small>' + escH(TG(B.n)) + ' ' + MEDAL[t] + ' · 💰 +' + BADGE_COINS[t - 1] + '</small></span>'); });
      if (bst && boostLeft() > 0) pre.push('<span class="e">🧠</span><span>' + T(TXT.boost) + '<small>' + T(TXT.boostS).replace('{n}', BOOST_MS / 60000) + '</small></span>');
      if (petN >= 0 && !home) pre.push('<span class="e">' + (petN === 1 ? '🐣' : '🐾') + '</span><span>' + T(petN === 1 ? TXT.petH : TXT.pet) + '<small>' + escH(T(PET_N[S.pet.k][Math.min(petN, PET_XP.length - 1)])) + '</small></span>');
      if (roadN && !home) pre.push('<span class="e">🎁</span><span>' + T(TXT.road) + '<small>' + T(TXT.roadS) + '</small></span>');
      // the home page celebrates a new level with its own sheet; elsewhere juice.js does (it keeps the entry until it could show it)
      S.pend = lvMax && jl ? [{t: 'level', n: lvMax}] : []; save();
      if (pre.length > 4) pre.length = 4;
      var items = [];
      stk.slice(0, 3).forEach(function (s) { items.push('<span class="e">' + s.e + '</span><span>' + T(TXT.new) + '<small>' + T(s.n) + '</small></span>'); });
      if (stk.length > 3) items.push('<span class="e">🎁</span><span>' + T(TXT.more).replace('{n}', stk.length - 3) + '</span>');
      if (!items.length && coins >= 3) items.push('<span class="e">💰</span><span>+' + coins + ' ' + T(TXT.coins) + '</span>');
      else if (items.length && coins >= 3) items[0] = items[0].replace('</small>', ' · 💰 +' + coins + '</small>');
      items = pre.concat(items);
      emit({t: 'flush', level: lvMax, quests: qs.length, qall: qall, streak: sk ? sk.n : 0, milestone: msN, badges: bdg.length, boost: bst, pet: petN, road: roadN, stickers: stk.length, coins: coins, toasts: items.length});
      if (lvMax && jl) { try { J.levelUp(lvMax); } catch (e) {} }
      if (!items.length) return false;
      flushing = true; if (!(J && J.sfx)) chime();
      (function next(i) { if (i >= items.length) { flushing = false; if (reflush) { reflush = false; flush(); } return; } showToast(items[i], 2300, function () { next(i + 1); }); })(0);
      return true;
    } catch (e) { flushing = false; return false; }
  }

  /* ---------- public ---------- */
  function catalog() { return CAT.map(function (s) { return {id: s.id, e: s.e, n: s.n, d: s.d, g: s.g, earned: !!(S && S.st[s.id]) }; }); }
  function stickers() { if (!S) load(); return catalog().map(function (s) { s.earned = !!S.st[s.id]; s.at = S.st[s.id] || 0; return s; }); }
  window.AnnabelleRewards = {
    award: award, flush: flush, coins: function () { if (!S) load(); return S.coins; }, spend: spend, get: function () { if (!S) load(); return JSON.parse(JSON.stringify(S)); },
    has: function (id) { if (!S) load(); return !!S.st[id]; }, stickers: stickers, catalog: catalog, dailyStatus: dailyStatus, claimDaily: claimDaily,
    shop: shop, buy: buy, equip: equip, avatar: avatar, avatarSVG: avatarSVG, lang: lang, t: T, GAMES: GAMES, gname: gname, COLORS: COLORS,
    level: level, levelOf: levelOf, quests: quests, recent: recent, challenges: challenges, addChallenge: addChallenge, removeChallenge: removeChallenge, bests: bests, cleanName: cleanName,
    visitAlbum: function () { if (!S) load(); S.stats.albumVisits++; checkStickers(); save(); },
    onChange: function (f) { if (typeof f === 'function') listeners.push(f); },
    on: function (f) { if (typeof f === 'function') subs.push(f); },
    streak: streak, road: road, claimChest: claimChest, ackRecap: ackRecap, boost: boost, badges: badges, title: title, setTitle: setTitle,
    pet: pet, petCare: petCare, petKind: petKind, petSVG: petSVG, rankOf: function (L) { var r = rankOf(clampInt(L, 1, 9999)); return {level: r[0], e: r[1], title: T(r[2])}; },
    pending: function (t) { if (!S) load(); return S.pend.filter(function (p) { return !t || p.t === t; }).map(function (p) { return JSON.parse(JSON.stringify(p)); }); },
    ackLevel: function () { if (!S) load(); var k = S.pend.length; S.pend = S.pend.filter(function (p) { return p.t !== 'level'; }); if (S.pend.length !== k) save(); },
    _reload: function () { load(); }, _reset: function () { S = fresh(); save(); }
  };
  load();
  // the home page and the album show queued banners on their own
  function auto() {
    var p = location.pathname.split('/').pop() || 'index.html', id = p.replace(/\.html$/, '');
    if (p === 'index.html' || p === 'album.html') { setTimeout(flush, 900); return; }
    // inside a game: remind the player of a friend's open challenge for this game (never blocks play)
    try {
      var c = isGame(id) && S ? S.ch.filter(function (x) { return x.g === id && !x.won; })[0] : null;
      if (c) setTimeout(function () { if (!flushing && document.body) showToast('<span class="e">⚔️</span><span>' + T(TXT.chalGo).replace('{n}', escH(cleanName(c.n))) + '<small>' + c.s + ' ' + T(TXT.pts) + '</small></span>', 3400, function () {}); }, 1600);
    } catch (e) {}
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) { load(); listeners.forEach(function (f) { try { f(); } catch (x) {} }); } }, true);
  window.addEventListener('storage', function (e) { if (e.key === KEY) { load(); listeners.forEach(function (f) { try { f(); } catch (x) {} }); } });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', auto) : auto();
})();

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
   GENDER:  a text that addresses or describes the player is [feminine, masculine, neutral] inside catalog() / stickers() / shop() (n, d): always show
              it through t(obj) – it picks the language and the form for the CURRENT profile at render time. Only ids are ever stored.
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
   RESEARCH ADJUSTMENTS (measured and reversible; nothing is ever removed from a save, an old save loads unchanged):
     band() / bandPref() / setBand(''|'little'|'kid'|'teen')   presentation band from KidApp.kid().age: little 4-7 (calm, play first: the pet and
               stickers, no coin / XP numbers, at most 2 gentle banners), kid 8-10 and unknown age (the classic look), teen 11-18 (cleaner look, skills view).
               '' = automatic; a parent can fix a band in the parent panel. Coins and XP accrue the same in every band.
     MASTERY badges (ids m-*): tied to DEMONSTRATED skill in a learning game (mathquest wordcity sciencelab thinking reading bagrut), never to the amount
               of play. They count 3-star results:  award({game:'mathquest', event:'star', stars:3})  and the optional richer event
               award({game:'mathquest', event:'mastery', skill:'add-20', level:2})   // skill = short id [a-z0-9_.-], level 1..3 (kept: best level per skill)
               A mastery badge pays no coins: its message says what the kid can do.  skills() lists them for the teen "skills" view.
     CHOICE:   quests() now also returns {n, offered[], canSwap}: the kid picks n of the offered missions (3 of 5; little band: 1 of 3 pictures) with
               chooseQuests([ids]) and may swapQuest(id) once a day.  chestChoices(i) -> two rewards for a sticker / item chest, claimChest(i, id) takes one.
               goal() / setGoal('l'|'r'|'b') = personal weekly goal (light / regular / big): the same 8 chests at x0.5 / x1 / x1.5 XP.
     STREAK:   never loss-framed. After a break the kid gets one warm welcome-back banner ("new streak starts today, your best was N"); streak().back says so.
     ENOUGH:   coins from play are capped per game per day (80) and per day overall (little 200, kid / teen 800: only marathon play ever meets it);
               reaching a cap says kindly, once, that it is plenty for today. More play then earns nothing, so there is no reason to grind.
               learnToday() -> {sec, min, goal, done}: visible, active time on the learning pages today (soft goal 10 min for little / kid; never a deficit).
     CALM MODE (docs/CALM-UI.md; localStorage 'annabelle-calm' !== '0', the default):  quiet() -> bool.  In calm mode flush() shows at most ONE small,
               still banner at a time and only for a new sticker / badge / level / pet stage (two per flush, the second one is "and N more");
               coins, quests, streaks, caps ... are not shown as banners. In BOTH modes every message is kept in a small list inside the save
               ('news': the last 20, sanitised like 'pend'):  news() -> [{t, e, title, text, at, seen, pending, important}] newest first (plain text,
               in the current language; pending = not flushed yet),  newsSeen() marks them as read and returns how many were unread.
               window event 'annabelle-play' {detail:{on:bool, game}}: on = a run started (award event 'play'), off = flush() (result / menu).
     TELEMETRY (KidApp.track('meta', {k, ...}), numbers and fixed words only): streak chest badge boost pet level, plus
               streak_break {len} · streak_back {gap} · open {what, band} (opened(what): journey album badges pet road missions) · choice {what, v} · cap {kind}.
   ───────────────────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.AnnabelleRewards) return;
  var KEY = 'annabelle-rewards', VER = 1, CAP_PER_GAME_DAY = 80, CAP_DAY = {little: 200, kid: 800, teen: 800}; // coins from play: per game per day, and per day overall (by band)

  /* ---------- tiny helpers ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lang() { var l = lsGet('annabelle-lang') || 'he'; return l === 'fr' || l === 'en' ? l : 'he'; }
  /* Every text that addresses or describes the player is written explicitly in three forms: [feminine, masculine, neutral].
     The form is picked at RENDER time for the CURRENT profile (profiles can be switched): nothing about gender is ever stored in the save,
     sticker / badge / quest ids are the only thing kept. A plain string is the same for everybody. */
  function G3(v) {
    if (!Array.isArray(v)) return v == null ? '' : String(v);
    var K = window.KidApp;
    try { if (K && K.g) return v.length > 2 ? K.g(v[0], v[1], v[2]) : K.g(v[0], v[1]); } catch (e) {} // [f, m] only: KidApp writes the neutral form (חוקר/ת)
    return v[0];
  }
  function T(o) { if (!o) return ''; return G3(typeof o === 'string' || Array.isArray(o) ? o : (o[lang()] || o.he || '')); }
  function V3(f, m, x, rest) { return [f + rest, m + rest, x + rest]; } // one sentence, three verb forms
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
    hiddencats: ['🔍', 'מצאו את החתולים', 'Trouve les chats', 'Find the Cats'],
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
    dogrun: ['🐕', 'מרוץ הכדור של הכלבים', "La course de balle des chiens", 'Dog Ball Dash'],
    critters: ['🐾', 'עולם היצורים', "Le monde des créatures", 'Critter World'],
    bagrut: ['🎓', 'מסלול הבגרות', "Objectif Bagrout", 'Bagrut Track'],
    reading: ['📖', 'סולם הקריאה', "L'échelle de lecture", 'Reading Ladder'],
    thinking: ['🧩', 'חידות חשיבה', "Défis de logique", 'Thinking Lab'],
    city: ['🏙️', 'עיר החתולים', "Chat-Ville", 'Kitty City'],
    retro: ['🕹️', 'פינת הרטרו', 'Coin rétro', 'Retro Corner']
  };
  // a game title that is itself gendered (the same forms the home page shows through catalog.js)
  var GN3 = {breakout: {he: ['שוברת הכלובים', 'שובר הכלובים', 'שובר/ת הכלובים']}};
  var LIDX = {he: 1, fr: 2, en: 3};
  function gn3(id, l) { var o = GN3[id], v = (o && o[l]) || GAMES[id][LIDX[l]]; return Array.isArray(v) ? v : [v, v, v]; }
  function gname(id) { var g = GAMES[id], l = lang(); return g ? G3((GN3[id] && GN3[id][l]) || g[LIDX[l]]) : id; }

  /* ---------- state ---------- */
  function fresh() {
    return {v: VER, coins: 0, earned: 0, st: {}, stats: {plays: {}, wins: {}, stars: {}, best: {}, perfects: 0, starsTotal: 0, winsTotal: 0, levelMax: 0, comboMax: 0, gifts: 0, bought: 0, albumVisits: 0, quests: 0, daily: {}, onl: 0, top5: 0, lrn: 0, roads: 0, top: {}, m3: {}, mk: {}},
      daily: {last: '', streak: 0, best: 0, count: 0, days: []}, own: {}, av: {color: 'orange', hat: '', bow: '', glass: '', bg: 'sky'}, pend: [],
      lv: 1, rec: [], q: {day: '', ids: [], off: [], n: 3, sw: 0, pk: 0, g: {}, c: {}, done: {}, all: false}, ch: [],
      mv: 0, ps: {last: '', n: 0, best: 0, sh: '', sd: '', ms: {}, bk: 0, wb: ''}, wk: {id: '', xp: 0, cl: {}, rc: null}, bo: {until: 0, d: {}}, bd: {}, ti: '', pet: {k: 'cat', fed: '', pat: '', n: 0, st: -1},
      band: '', wg: 'r', lt: {d: '', s: 0}, news: [], ns: 0};
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
      if (Array.isArray(o.pend)) f.pend = o.pend.filter(pendOk).slice(-30);
      if (Array.isArray(o.news)) f.news = o.news.map(function (p) { return newsClean(p, p && p.at); }).filter(Boolean).slice(-NEWS_MAX); // the small "news" list: rebuilt field by field
      f.ns = clampInt(o.ns, 0, 1e13);
      // platform layer: player level, recently played, daily quests, friend challenges
      f.lv = clampInt(o.lv, 0, 9999) || levelOf(f.earned);
      if (Array.isArray(o.rec)) f.rec = o.rec.filter(function (g, i, r) { return isGame(g) && g !== 'retro' && r.indexOf(g) === i; }).slice(0, 8);
      var q = o.q && typeof o.q === 'object' ? o.q : null;
      if (q && /^\d{4}-\d{1,2}-\d{1,2}$/.test(q.day)) {
        f.q.day = q.day; f.q.all = !!q.all;
        if (Array.isArray(q.ids)) f.q.ids = q.ids.filter(function (id) { return QUEST_BY[id]; }).slice(0, 3);
        if (Array.isArray(q.off)) f.q.off = q.off.filter(function (id, i, r) { return QUEST_BY[id] && r.indexOf(id) === i; }).slice(0, 5);
        f.q.n = q.n === 1 ? 1 : 3; f.q.sw = q.sw ? 1 : 0; f.q.pk = q.pk ? 1 : 0;
        ['g', 'c', 'done'].forEach(function (m) { if (q[m] && typeof q[m] === 'object') for (var k in q[m]) if (/^[a-z0-9_-]{1,30}$/i.test(k) && !(k in Object.prototype) && isNum(q[m][k])) f.q[m][k] = clampInt(q[m][k], 0, 1e6); });
      }
      if (Array.isArray(o.ch)) f.ch = o.ch.filter(function (c) { return c && isGame(c.g) && c.g !== 'retro' && isNum(c.s) && typeof c.n === 'string'; }).slice(0, 6).map(function (c) { return {g: c.g, s: clampInt(c.s, 1, 1e9), n: cleanName(c.n) || '?', t: clampInt(c.t, 0, 1e13), won: !!c.won}; });
      saneMeta(f, o, s);
    } catch (e) { return fresh(); }
    return f;
  }
  function pendOk(p) {
    return !!(p && (p.t === 'sticker' && STK_BY[p.id] || p.t === 'coins' && isNum(p.n) || p.t === 'level' && isNum(p.n) || p.t === 'quest' && QUEST_BY[p.id] || p.t === 'qall' || p.t === 'chal' && isGame(p.g) && typeof p.n === 'string' ||
      (p.t === 'streak' || p.t === 'ms' || p.t === 'pet' || p.t === 'road' || p.t === 'back') && isNum(p.n) || p.t === 'boost' || p.t === 'cap' && (p.k === 'g' || p.k === 'd') || p.t === 'badge' && BADGE_BY[p.id] && isNum(p.n)));
  }
  var NEWS_MAX = 20;
  function newsClean(p, at) { // one entry of the news list: only known fields, bounded
    if (!pendOk(p)) return null;
    var o = {t: p.t, at: clampInt(at, 0, 1e13)};
    if (p.t === 'sticker' || p.t === 'quest' || p.t === 'badge') o.id = p.id;
    if (p.t === 'chal') { o.g = p.g; o.n = cleanName(p.n) || '?'; if (p.c === 0) o.c = 0; }
    else if (isNum(p.n)) o.n = clampInt(p.n, 0, 1e7);
    if (p.t === 'cap') o.k = p.k;
    if (p.t === 'streak' && p.sh) o.sh = 1;
    return o;
  }
  var DAY_RE = /^\d{4}-\d{1,2}-\d{1,2}$/, WK_RE = /^\d{4}-W\d{2}$/;
  var MAST = {mathquest: 1, wordcity: 1, sciencelab: 1, thinking: 1, reading: 1, bagrut: 1}, SKILL_RE = /^[a-z0-9_.-]{1,24}$/i; // learning games that can show mastery
  function saneMeta(f, o, s) { // the meta layer of a save: every field is rebuilt from scratch
    f.mv = o.mv === 1 ? 1 : 0;
    if (s.top && typeof s.top === 'object') for (var g in s.top) if (isGame(g) && Array.isArray(s.top[g])) f.stats.top[g] = s.top[g].filter(isNum).map(function (x) { return clampInt(x, 0, 1e9); }).sort(function (a, b) { return b - a; }).slice(0, 5);
    var p = o.ps && typeof o.ps === 'object' ? o.ps : {};
    if (DAY_RE.test(p.last)) { f.ps.last = p.last; f.ps.n = clampInt(p.n, 1, 9999); }
    f.ps.best = Math.max(f.ps.n, clampInt(p.best, 0, 9999)); f.ps.sh = WK_RE.test(p.sh) ? p.sh : ''; f.ps.sd = DAY_RE.test(p.sd) ? p.sd : '';
    STREAK_MS.forEach(function (m) { if (p.ms && typeof p.ms === 'object' && p.ms[m[0]]) f.ps.ms[m[0]] = 1; });
    f.ps.bk = f.ps.last ? clampInt(p.bk, 0, 9999) : 0; f.ps.wb = DAY_RE.test(p.wb) ? p.wb : '';
    f.band = o.band === 'little' || o.band === 'kid' || o.band === 'teen' ? o.band : ''; f.wg = o.wg === 'l' || o.wg === 'b' ? o.wg : 'r';
    var lt = o.lt && typeof o.lt === 'object' ? o.lt : {}; if (DAY_RE.test(lt.d)) f.lt = {d: lt.d, s: clampInt(lt.s, 0, 86400)};
    Object.keys(MAST).forEach(function (g) { // mastery counters of the learning games
      if (s.m3 && typeof s.m3 === 'object' && isNum(s.m3[g]) && s.m3[g] > 0) f.stats.m3[g] = clampInt(s.m3[g], 0, 1e6);
      var mk = s.mk && typeof s.mk === 'object' && s.mk[g] && typeof s.mk[g] === 'object' ? s.mk[g] : null, n = 0;
      if (mk) for (var sk in mk) if (SKILL_RE.test(sk) && !(sk in Object.prototype) && isNum(mk[sk]) && n < 80) { (f.stats.mk[g] || (f.stats.mk[g] = {}))[sk] = clampInt(mk[sk], 1, 3); n++; }
    });
    var w = o.wk && typeof o.wk === 'object' ? o.wk : {};
    if (WK_RE.test(w.id)) {
      f.wk.id = w.id; f.wk.xp = clampInt(w.xp, 0, 1e6);
      ROAD.forEach(function (c, i) { if (w.cl && typeof w.cl === 'object' && w.cl[i]) f.wk.cl[i] = 1; });
    }
    var rc = w.rc && typeof w.rc === 'object' ? w.rc : null;
    if (rc && WK_RE.test(rc.id)) f.wk.rc = {id: rc.id, xp: clampInt(rc.xp, 0, 1e6), n: clampInt(rc.n, 0, ROAD.length), c: clampInt(rc.c, 0, 1e4), g: clampInt(rc.g, 0, ROAD.length)};
    var b = o.bo && typeof o.bo === 'object' ? o.bo : {};
    f.bo.until = clampInt(b.until, 0, 1e14);
    if (b.d && typeof b.d === 'object') for (var k in b.d) if (/^(reading|mathquest|wordcity|sciencelab|bagrut|thinking)\|\d{4}-\d{1,2}-\d{1,2}$/.test(k) && b.d[k]) f.bo.d[k] = 1;
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
  var RANKS = [[1, '🐱', {he: ['גורה סקרנית', 'גור סקרן', 'גור סקרן'], fr: 'Chaton curieux', en: 'Curious Kitten'}],
    [3, '🐈', {he: ['חתולת רחוב זריזה', 'חתול רחוב זריז', 'חתול רחוב זריז'], fr: 'Chat des rues', en: 'Street Cat'}],
    [5, '⭐', {he: ['ציידת כוכבים', 'צייד כוכבים', 'ציידי כוכבים'], fr: ["Chasseuse d'étoiles", "Chasseur d'étoiles", "Chasse aux étoiles"], en: 'Star Hunter'}],
    [8, '🐯', {he: ['נמרה צעירה', 'נמר צעיר', 'נמר צעיר'], fr: ['Jeune tigresse', 'Jeune tigre', 'Jeune tigre'], en: 'Young Tiger'}],
    [12, '🦁', {he: ['לביאה אמיצה', 'אריה אמיץ', 'לב אריה'], fr: ['Lionne courageuse', 'Lion courageux', 'Cœur de lion'], en: ['Brave Lioness', 'Brave Lion', 'Lionheart']}],
    [16, '👑', {he: ["מלכת הג'ונגל", "מלך הג'ונגל", "כתר הג'ונגל"], fr: ['Reine de la jungle', 'Roi de la jungle', 'Couronne de la jungle'], en: ['Jungle Queen', 'Jungle King', 'Jungle Champion']}],
    [21, '🐉', {he: 'אגדת החתולים', fr: 'Légende des chats', en: 'Cat Legend'}]];
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
  var MIND = {dogrun: 1, critters: 1, bagrut: 1, reading: 1, city: 1, mathquest: 1, wordcity: 1, sciencelab: 1, thinking: 1, magic: 1, magic2: 1, cups: 1, tictactoe: 1, minesweeper: 1, checkers: 1, cats: 1, hiddencats: 1, escape: 1, towerdefense: 1, tetris: 1, simon: 1};
  var SPORT = {funrun: 1, carrace: 1, football: 1, bowling: 1, pong: 1, thunderkittens: 1, runner: 1, runner3d: 1, pacman: 1, lionking: 1};
  var HIDDEN = {retro: 1, runner3d: 1}; // no tile of their own on the home page
  var QUEST_COINS = 15, QUEST_BONUS = 25;
  var QUESTS = [
    {id: 'play3', e: '🎮', goal: 3, t: {he: V3('שחקי', 'שחק', 'שחקו', ' ב-3 משחקים שונים'), fr: 'Joue à 3 jeux différents', en: 'Play 3 different games'}},
    {id: 'win2', e: '🏆', goal: 2, t: {he: V3('נצחי', 'נצח', 'נצחו', ' פעמיים'), fr: 'Gagne 2 fois', en: 'Win twice'}},
    {id: 'star5', e: '⭐', goal: 5, t: {he: V3('אספי', 'אסוף', 'אספו', ' 5 כוכבים'), fr: 'Récolte 5 étoiles', en: 'Collect 5 stars'}},
    {id: 'lvl3', e: '🚩', goal: 3, t: {he: V3('סיימי', 'סיים', 'סיימו', ' 3 שלבים'), fr: 'Termine 3 niveaux', en: 'Clear 3 levels'}},
    {id: 'retro', e: '🕹️', goal: 1, t: {he: V3('שחקי', 'שחק', 'שחקו', ' במשחק מפינת הרטרו'), fr: 'Joue à un jeu du coin rétro', en: 'Play a Retro Corner game'}},
    {id: 'mind', e: '🧩', goal: 1, t: {he: V3('שחקי', 'שחק', 'שחקו', ' במשחק חשיבה'), fr: 'Joue à un jeu de réflexion', en: 'Play a thinking game'}},
    {id: 'sport', e: '⚽', goal: 1, t: {he: V3('שחקי', 'שחק', 'שחקו', ' במשחק ספורט או אקשן'), fr: "Joue à un jeu de sport ou d'action", en: 'Play a sports or action game'}},
    {id: 'perfect', e: '🎯', goal: 1, t: {he: V3('קבלי', 'קבל', 'קבלו', ' 3 כוכבים בשלב אחד'), fr: 'Obtiens 3 étoiles dans un niveau', en: 'Get 3 stars in one stage'}},
    {id: 'coin30', e: '💰', goal: 30, t: {he: V3('הרוויחי', 'הרוויח', 'הרוויחו', ' 30 מטבעות במשחקים'), fr: 'Gagne 30 pièces en jouant', en: 'Earn 30 coins by playing'}},
    {id: 'new1', e: '✨', goal: 1, t: {he: ['נסי משחק שעוד לא שיחקת בו', 'נסה משחק שעוד לא שיחקת בו', 'נסו משחק שעוד לא שיחקתם בו'], fr: "Essaie un jeu auquel tu n'as jamais joué", en: 'Try a game you have never played'}}
  ];
  // the little band (4-7) gets ONE simple picture mission, chosen among three
  var LQUESTS = [
    {id: 'l-learn', e: '📚', goal: 1, t: {he: 'משחק למידה אחד', fr: 'Un jeu pour apprendre', en: 'One learning game'}},
    {id: 'l-mind', e: '🧩', goal: 1, t: {he: 'משחק חשיבה אחד', fr: 'Un jeu de réflexion', en: 'One thinking game'}},
    {id: 'l-sport', e: '⚽', goal: 1, t: {he: 'משחק ספורט אחד', fr: 'Un jeu de sport', en: 'One sports game'}},
    {id: 'l-retro', e: '🕹️', goal: 1, t: {he: 'משחק רטרו אחד', fr: 'Un jeu rétro', en: 'One retro game'}},
    {id: 'l-star', e: '⭐', goal: 1, t: {he: 'כוכב אחד', fr: 'Une étoile', en: 'One star'}}
  ];
  var QUEST_BY = Object.create(null); QUESTS.concat(LQUESTS).forEach(function (q) { QUEST_BY[q.id] = q; });
  var QKEY = {win2: 'win', star5: 'star', lvl3: 'lvl', retro: 'retro', mind: 'mind', sport: 'sport', perfect: 'perfect', coin30: 'coin', new1: 'new', 'l-learn': 'learn', 'l-mind': 'mind', 'l-sport': 'sport', 'l-retro': 'retro', 'l-star': 'star'};
  function seedRnd(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ h >>> 15, 1 | h); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function shuffled(ids, r) { for (var i = ids.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = ids[i]; ids[i] = ids[j]; ids[j] = x; } return ids; }
  function pickQuests(day, k) { // the first three are the same three as before the kid could choose
    var ids = shuffled(QUESTS.map(function (q) { return q.id; }), seedRnd('q' + day)), out = [];
    var unplayed = Object.keys(GAMES).some(function (g) { return !HIDDEN[g] && !S.stats.plays[g]; });
    ids.forEach(function (id) { if (out.length < (k || 3) && (id !== 'new1' || unplayed)) out.push(id); });
    return out;
  }
  function pickLittle(day) { return shuffled(LQUESTS.map(function (q) { return q.id; }), seedRnd('l' + day)).slice(0, 3); }
  function questState() { // q.off = the missions offered today, q.ids = the q.n the kid goes for (the first ones until the kid chooses)
    var td = today(), n = band() === 'little' ? 1 : 3, q = S.q, same = q.day === td && q.ids.length > 0;
    if (same && (q.n || 3) !== n && !Object.keys(q.done).length) same = false; // the band changed and nothing is done yet: offer the right set
    if (!same) {
      var keep = q.day === td, off = n === 1 ? pickLittle(td) : pickQuests(td, 5);
      S.q = q = {day: td, ids: off.slice(0, n), off: off, n: n, sw: keep ? q.sw : 0, pk: 0, g: keep ? q.g : {}, c: keep ? q.c : {}, done: {}, all: false};
    } else if (!q.off || q.off.length < q.ids.length) { // a save from before the choice existed: today's three stay, two more are offered
      var o = q.ids.slice();
      if ((q.n || 3) !== 1) pickQuests(td, 5).forEach(function (id) { if (o.length < 5 && o.indexOf(id) < 0) o.push(id); });
      q.off = o; q.n = q.n === 1 ? 1 : 3;
    }
    return q;
  }
  function qprog(q, id) { return id === 'play3' ? Object.keys(q.g).length : (q.c[QKEY[id]] || 0); }
  function questCheck(q) {
    q.ids.forEach(function (id) { var Q = QUEST_BY[id]; if (!Q || q.done[id]) return; if (qprog(q, id) >= Q.goal) { q.done[id] = 1; S.stats.quests++; S.coins += QUEST_COINS; addXP(QUEST_COINS); S.pend.push({t: 'quest', id: id}); } });
    if (!q.all && q.ids.length && q.ids.every(function (id) { return q.done[id]; })) { q.all = true; S.coins += QUEST_BONUS; addXP(QUEST_BONUS); S.pend.push({t: 'qall'}); }
  }
  // CHOICE: the kid picks which of the offered missions to go for (as often as wanted; a finished mission stays), and may swap one a day for a new one
  function chooseQuests(ids) {
    if (!S) load();
    var q = questState(), u = [];
    if (!Array.isArray(ids) || q.all) return false;
    ids.forEach(function (id) { if (q.off.indexOf(id) >= 0 && u.indexOf(id) < 0) u.push(id); });
    if (u.length !== q.n || Object.keys(q.done).some(function (id) { return u.indexOf(id) < 0; })) return false;
    q.ids = q.off.filter(function (id) { return u.indexOf(id) >= 0; }); q.pk = 1;
    questCheck(q); checkLevel(); checkBadges(); checkPet(); checkStickers(); save();
    meta('choice', {what: 'mission', v: q.n});
    return true;
  }
  function swapQuest(id) {
    if (!S) load();
    var q = questState(), i = q.off.indexOf(id);
    if (i < 0 || q.sw || q.all || q.done[id]) return null;
    var unplayed = Object.keys(GAMES).some(function (g) { return !HIDDEN[g] && !S.stats.plays[g]; });
    var pool = (q.n === 1 ? LQUESTS : QUESTS).map(function (x) { return x.id; }).filter(function (x) { return q.off.indexOf(x) < 0 && (x !== 'new1' || unplayed); });
    if (!pool.length) return null;
    var nw = shuffled(pool, seedRnd('s' + q.day + id))[0], a = q.ids.indexOf(id);
    q.off[i] = nw; if (a >= 0) q.ids[a] = nw; q.sw = 1;
    questCheck(q); checkLevel(); checkBadges(); checkPet(); checkStickers(); save();
    meta('choice', {what: 'swap', v: 1});
    return nw;
  }
  function questTick(game, ev, o, c, first) {
    if (!isGame(game) || game === 'retro') return;
    var q = questState();
    if (!q.g[game]) { q.g[game] = 1; if (RETRO[game]) q.c.retro = 1; if (MIND[game]) q.c.mind = 1; if (SPORT[game]) q.c.sport = 1; if (LEARN[game]) q.c.learn = 1; }
    if (first) q.c['new'] = 1;
    if (ev === 'win') q.c.win = (q.c.win || 0) + 1;
    if (ev === 'levelClear') q.c.lvl = (q.c.lvl || 0) + 1;
    if (ev === 'star') { var n = clampInt(o.stars, 0, 3); q.c.star = (q.c.star || 0) + n; if (n === 3) q.c.perfect = 1; }
    if (c > 0) q.c.coin = (q.c.coin || 0) + c;
    questCheck(q);
  }
  function quests() {
    if (!S) load();
    var before = S.q.day, q = questState(); if (before !== q.day) save();
    var view = function (id) { var Q = QUEST_BY[id]; return {id: id, e: Q.e, text: T(Q.t), goal: Q.goal, prog: Math.min(Q.goal, qprog(q, id)), done: !!q.done[id], on: q.ids.indexOf(id) >= 0}; };
    return {day: q.day, all: q.all, coins: QUEST_COINS, bonus: QUEST_BONUS, n: q.n, picked: !!q.pk, canSwap: !q.sw && !q.all, list: q.ids.map(view), offered: q.off.map(view)};
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
  // names: a plain string is the same for everybody; [feminine, masculine, neutral] describes the player
  var GS = {dogrun: ['אלופת הכדור', 'אלוף הכדור', 'אלופי הכדור'], critters: ['חברה של יצורים', 'חבר של יצורים', 'חברים של יצורים'], bagrut: ['מוכנה לבגרות', 'מוכן לבגרות', 'מוכנים לבגרות'], reading: 'תולעת ספרים', city: ['בעלת בית', 'בעל בית', 'בעלי בית'], thinking: 'מוח על',
    mathquest: ['אלופת החשבון', 'אלוף החשבון', 'אלופי החשבון'], wordcity: ['אלופת המילים', 'אלוף המילים', 'אלופי המילים'], sciencelab: ['מדענית צעירה', 'מדען צעיר', 'מדענים צעירים'],
    funrun: ['אלופת התעלולים', 'אלוף התעלולים', 'אלופי התעלולים'], carrace: ['נהגת מרוצים', 'נהג מרוצים', 'נהגי מרוצים'], bubbles: ['מגלת בועות', 'מגלה בועות', 'מגלי בועות'], cats: ['מלכת הזוגות', 'מלך הזוגות', 'אלופי הזוגות'],
    checkers: ['מלכת הדמקה', 'מלך הדמקה', 'אלופי הדמקה'], cups: 'עין הנץ', digrod: ['חופרת בשריר', 'חופר בשריר', 'חופרים בשריר'], escape: ['בורחת מהעץ', 'בורח מהעץ', 'בורחים מהעץ'],
    fishing: ['דייגית צעירה', 'דייג צעיר', 'דייגים צעירים'], football: ['כוכבת הכדורגל', 'כוכב הכדורגל', 'כוכבי הכדורגל'], hiddencats: ['עין הבולשת', 'עין הבלש', 'עיני בלשים'], lionking: 'אריה קטן',
    magic: ['קוסמת קלפים', 'קוסם קלפים', 'קוסמי קלפים'], magic2: ['קוסמת חתולים', 'קוסם חתולים', 'קוסמי חתולים'], minesweeper: ['גננית חתולים', 'גנן חתולים', 'גנני חתולים'], pacman: 'טיגריס רעב',
    runner: ['רצה בסוואנה', 'רץ בסוואנה', 'רצים בסוואנה'], runner3d: ['רצה ב-3D', 'רץ ב-3D', 'רצים ב-3D'], soya: ['חברה של סויה', 'חבר של סויה', 'חברים של סויה'], soyahome: 'בית של סויה',
    streetcats: ['חתולת שכונה', 'חתול שכונה', 'חתולי שכונה'], thunderkittens: ['לוחמת ברק', 'לוחם ברק', 'לוחמי ברק'], towerdefense: ['שומרת המאורה', 'שומר המאורה', 'שומרי המאורה'],
    bowling: ['כוכבת באולינג', 'כוכב באולינג', 'כוכבי באולינג'], tictactoe: ['מלכת איקס עיגול', 'מלך איקס עיגול', 'אלופי איקס עיגול'], hole: 'חור רעבתן', fishy: 'דג גדול',
    kitchen: ['שפית חתולית', 'שף חתולי', 'שפים חתוליים'], invaders: ['מצילה בחלל', 'מציל בחלל', 'מצילים בחלל'], tetris: ['מלכת הקוביות', 'מלך הקוביות', 'אלופי הקוביות'],
    breakout: ['פותחת הכלובים', 'פותח הכלובים', 'פותחי הכלובים'], snake: 'זנב הנמר', crossing: ['שומרת המעבר', 'שומר המעבר', 'שומרי המעבר'], pong: ['אלופת הפינג־פונג', 'אלוף הפינג־פונג', 'אלופי הפינג־פונג'],
    safari: ['צלמת ספארי', 'צלם ספארי', 'צלמי ספארי'], simon: ['מנצחת המקהלה', 'מנצח המקהלה', 'מנצחי המקהלה'], retro: ['מבקרת בפינת הרטרו', 'מבקר בפינת הרטרו', 'מבקרים בפינת הרטרו']};
  var GSF = {dogrun: ['Reine de la balle', 'Roi de la balle', 'As de la balle'], critters: ['Amie des créatures', 'Ami des créatures', 'Ami·e des créatures'], bagrut: ['Prête pour le Bagrout', 'Prêt pour le Bagrout', 'Cap sur le Bagrout'], reading: 'Rat de bibliothèque', city: 'Jeune propriétaire', thinking: 'Super cerveau',
    mathquest: 'As des maths', wordcity: 'As des mots', sciencelab: 'Jeune scientifique', funrun: ['Reine des farces', 'Roi des farces', 'As des farces'], carrace: 'Pilote de course',
    bubbles: ['Reine des bulles', 'Roi des bulles', 'As des bulles'], cats: ['Reine des paires', 'Roi des paires', 'As des paires'], checkers: ['Reine des dames', 'Roi des dames', 'As des dames'], cups: 'Œil de lynx', digrod: 'Super muscles',
    escape: ['Évadée', 'Évadé', 'Évasion réussie'], fishing: ['Jeune pêcheuse', 'Jeune pêcheur', 'As de la pêche'], football: 'Star du foot', hiddencats: 'Détective', lionking: 'Petit lion',
    magic: ['Magicienne', 'Magicien', 'As de la magie'], magic2: 'Magie des chats', minesweeper: ['Jardinière', 'Jardinier', 'Main verte'], pacman: 'Tigre affamé',
    runner: ['Coureuse', 'Coureur', 'Sprint de la savane'], runner3d: ['Coureuse 3D', 'Coureur 3D', 'Sprint 3D'], soya: ['Amie de Soya', 'Ami de Soya', 'Ami·e de Soya'], soyahome: 'Maison de Soya', streetcats: 'Chat du quartier',
    thunderkittens: ['Guerrière', 'Guerrier', 'Force de la foudre'], towerdefense: ['Gardienne', 'Gardien', 'Garde de la tanière'], bowling: 'Star du bowling', tictactoe: ['Reine du morpion', 'Roi du morpion', 'As du morpion'],
    hole: 'Gouffre gourmand', fishy: 'Gros poisson', kitchen: ['Cheffe chat', 'Chef chat', 'Chef·fe chat'], invaders: ["Sauveteuse de l'espace", "Sauveteur de l'espace", "Secours de l'espace"],
    tetris: ['Reine des blocs', 'Roi des blocs', 'As des blocs'], breakout: 'Ouvre-cages', snake: 'Queue de tigre', crossing: ['Gardienne du passage', 'Gardien du passage', 'Garde du passage'],
    pong: ['Championne de ping-pong', 'Champion de ping-pong', 'As du ping-pong'], safari: 'Photographe safari', simon: ['Cheffe de chorale', 'Chef de chorale', 'Chef·fe de chorale'], retro: ['Visiteuse rétro', 'Visiteur rétro', 'Visite rétro']};
  var GSE = {dogrun: 'Ball Champion', critters: 'Critter Friend', bagrut: 'Exam Ready', reading: 'Bookworm', city: 'City Builder', thinking: 'Master Mind', mathquest: 'Math Champion', wordcity: 'Word Champion', sciencelab: 'Young Scientist', funrun: 'Prank Champion', carrace: 'Race Driver',
    bubbles: ['Bubble Queen', 'Bubble King', 'Bubble Champion'], cats: 'Memory Master', checkers: ['Checkers Queen', 'Checkers King', 'Checkers Champion'], cups: 'Eagle Eye', digrod: 'Super Muscles', escape: 'Escape Artist', fishing: 'Young Angler',
    football: 'Football Star', hiddencats: 'Cat Detective', lionking: 'Little Lion', magic: 'Card Magician', magic2: 'Cat Magician', minesweeper: 'Garden Hero', pacman: 'Hungry Tiger', runner: 'Savanna Runner', runner3d: '3D Runner',
    soya: 'Soya\'s Friend', soyahome: 'Soya\'s Home', streetcats: 'Street Cat', thunderkittens: 'Lightning Fighter', towerdefense: 'Den Guardian', bowling: 'Bowling Star', tictactoe: ['Tic-Tac-Queen', 'Tic-Tac-King', 'Tic-Tac-Champ'],
    hole: 'Hungry Hole', fishy: 'Big Fish', kitchen: 'Chef Cat', invaders: 'Space Rescuer', tetris: ['Block Queen', 'Block King', 'Block Champion'], breakout: 'Cage Opener', snake: 'Tiger Tail', crossing: 'Crossing Guard',
    pong: 'Pong Champion', safari: 'Safari Photographer', simon: 'Choir Conductor', retro: 'Retro Visitor'};
  Object.keys(GAMES).forEach(function (g) {
    var nh = gn3(g, 'he');
    add('g-' + g, GAMES[g][0], GS[g], GSF[g], GSE[g], ['שחקי ב' + nh[0] + ' בפעם הראשונה', 'שחק ב' + nh[1] + ' בפעם הראשונה', 'שחקו ב' + nh[2] + ' בפעם הראשונה'], 'Joue à ' + GAMES[g][2] + ' pour la première fois', 'Play ' + GAMES[g][3] + ' for the first time',
      (function (id) { return function (s) { return (s.stats.plays[id] || 0) >= 1; }; })(g), 'games');
  });
  // 2) wins
  [[1, '🏆', 'ניצחון ראשון', 'Première victoire', 'First win'], [5, '🥇', 'חמישה ניצחונות', 'Cinq victoires', 'Five wins'],
    [25, '👑', ['מלכת הניצחונות', 'מלך הניצחונות', 'אלופי הניצחונות'], ['Reine des victoires', 'Roi des victoires', 'As des victoires'], ['Victory queen', 'Victory king', 'Victory champion']],
    [100, '🌟', ['אלופה', 'אלוף', 'אליפות'], ['Championne', 'Champion', 'Champion·ne'], 'Champion']].forEach(function (w) {
    add('w' + w[0], w[1], w[2], w[3], w[4], V3('נצחי', 'נצח', 'נצחו', w[0] > 1 ? ' ' + w[0] + ' פעמים' : ' פעם אחת'), 'Gagne ' + w[0] + ' fois', w[0] > 1 ? 'Win ' + w[0] + ' times' : 'Win once', function (s) { return s.stats.winsTotal >= w[0]; }, 'wins');
  });
  // 3) explorer: distinct games played
  [[3, '🧭', ['חוקרת קטנה', 'חוקר קטן', 'חוקרים קטנים'], ['Petite exploratrice', 'Petit explorateur', 'Petite exploration'], 'Little explorer'],
    [10, '🗺️', ['חוקרת גדולה', 'חוקר גדול', 'חוקרים גדולים'], ['Grande exploratrice', 'Grand explorateur', 'Grande exploration'], 'Big explorer'],
    [20, '🚀', ['חוקרת על', 'חוקר על', 'חוקרי על'], ['Super exploratrice', 'Super explorateur', 'Super exploration'], 'Super explorer']].forEach(function (w) {
    add('x' + w[0], w[1], w[2], w[3], w[4], V3('שחקי', 'שחק', 'שחקו', ' ב-' + w[0] + ' משחקים שונים'), 'Joue à ' + w[0] + ' jeux différents', 'Play ' + w[0] + ' different games', function (s) { return Object.keys(s.stats.plays).filter(function (g) { return s.stats.plays[g] > 0; }).length >= w[0]; }, 'explore');
  });
  // 4) daily streak
  [[3, '🔥', 'שלושה ימים ברצף', 'Trois jours de suite', 'Three days in a row'], [7, '🌈', 'שבוע שלם', 'Une semaine entière', 'A whole week'], [14, '💎', 'שבועיים ברצף', 'Deux semaines', 'Two weeks'], [30, '🐉', 'חודש של קסם', 'Un mois magique', 'A magic month']].forEach(function (w) {
    add('s' + w[0], w[1], w[2], w[3], w[4], V3('פתחי', 'פתח', 'פתחו', ' את המתנה היומית ' + w[0] + ' ימים ברצף'), 'Ouvre le cadeau du jour ' + w[0] + ' jours de suite', 'Open the daily gift ' + w[0] + ' days in a row', function (s) { return s.daily.best >= w[0]; }, 'streak');
  });
  // 5) stars
  [[10, '⭐', 'עשרה כוכבים', 'Dix étoiles', 'Ten stars'], [50, '💫', 'חמישים כוכבים', 'Cinquante étoiles', 'Fifty stars'], [150, '🌠', 'מאה וחמישים כוכבים', 'Cent cinquante étoiles', '150 stars']].forEach(function (w) {
    add('t' + w[0], w[1], w[2], w[3], w[4], V3('אספי', 'אסוף', 'אספו', ' ' + w[0] + ' כוכבים'), 'Récolte ' + w[0] + ' étoiles', 'Collect ' + w[0] + ' stars', function (s) { return s.stats.starsTotal >= w[0]; }, 'stars');
  });
  // 6) coins earned
  [[100, '💰', 'אוצר קטן', 'Petit trésor', 'Small treasure'], [500, '💰', 'אוצר גדול', 'Grand trésor', 'Big treasure'], [2000, '🏴‍☠️', 'אוצר הפיראטים', 'Trésor de pirates', 'Pirate treasure']].forEach(function (w) {
    add('c' + w[0], w[1], w[2], w[3], w[4], V3('הרוויחי', 'הרוויח', 'הרוויחו', ' ' + w[0] + ' מטבעות'), 'Gagne ' + w[0] + ' pièces', 'Earn ' + w[0] + ' coins', function (s) { return s.earned >= w[0]; }, 'coins');
  });
  // 7) levels / combos / perfect
  [[5, '🐣', 'שלב 5', 'Niveau 5', 'Level 5'], [10, '🐥', 'שלב 10', 'Niveau 10', 'Level 10'], [20, '🦅', 'שלב 20', 'Niveau 20', 'Level 20']].forEach(function (w) {
    add('l' + w[0], w[1], w[2], w[3], w[4], V3('הגיעי', 'הגע', 'הגיעו', ' לשלב ' + w[0] + ' בכל משחק'), 'Atteins le niveau ' + w[0] + ' dans un jeu', 'Reach level ' + w[0] + ' in any game', function (s) { return s.stats.levelMax >= w[0]; }, 'levels');
  });
  [[3, '✨', 'קומבו קטן', 'Petit combo', 'Small combo'], [6, '🎆', 'קומבו גדול', 'Grand combo', 'Big combo'], [12, '🌋', 'קומבו אדיר', 'Combo géant', 'Huge combo']].forEach(function (w) {
    add('k' + w[0], w[1], w[2], w[3], w[4], V3('עשי', 'עשה', 'עשו', ' קומבו של ' + w[0]), 'Fais un combo de ' + w[0], 'Make a combo of ' + w[0], function (s) { return s.stats.comboMax >= w[0]; }, 'combo');
  });
  [[1, '🎯', ['מושלמת', 'מושלם', 'מושלם'], 'Parfait', 'Perfect'], [5, '🏅', ['חמש פעמים מושלמת', 'חמש פעמים מושלם', 'חמש פעמים מושלם'], 'Cinq fois parfait', 'Perfect x5'], [20, '🎖️', ['מושלמת מושלמת', 'מושלם מושלם', 'מושלם מושלם'], 'Super parfait', 'Super perfect']].forEach(function (w) {
    add('p' + w[0], w[1], w[2], w[3], w[4], V3('קבלי', 'קבל', 'קבלו', ' 3 כוכבים ' + (w[0] > 1 ? w[0] + ' פעמים' : 'בשלב')), 'Obtiens 3 étoiles ' + (w[0] > 1 ? w[0] + ' fois' : 'dans un niveau'), 'Get 3 stars ' + (w[0] > 1 ? w[0] + ' times' : 'in a stage'), function (s) { return s.stats.perfects >= w[0]; }, 'perfect');
  });
  [[5, '⭐'], [10, '🐯'], [20, '👑']].forEach(function (w) {
    add('pl' + w[0], w[1], ['שחקנית רמה ' + w[0], 'שחקן רמה ' + w[0], 'רמת משחק ' + w[0]], ['Joueuse niveau ' + w[0], 'Joueur niveau ' + w[0], 'Niveau de jeu ' + w[0]], 'Player level ' + w[0],
      ['הגיעי לרמת שחקנית ' + w[0], 'הגע לרמת שחקן ' + w[0], 'הגיעו לרמת משחק ' + w[0]], ['Atteins le niveau de joueuse ' + w[0], 'Atteins le niveau de joueur ' + w[0], 'Atteins le niveau de jeu ' + w[0]], 'Reach player level ' + w[0], function (s) { return levelOf(s.earned) >= w[0]; }, 'levels');
  });
  [[5, '📋', 'חמש משימות', 'Cinq missions', 'Five quests'], [30, '🗓️', ['אלופת המשימות', 'אלוף המשימות', 'אלופי המשימות'], ['Championne des missions', 'Champion des missions', 'As des missions'], 'Quest champion']].forEach(function (w) {
    add('q' + w[0], w[1], w[2], w[3], w[4], V3('השלימי', 'השלם', 'השלימו', ' ' + w[0] + ' משימות יומיות'), 'Termine ' + w[0] + ' missions du jour', 'Complete ' + w[0] + ' daily quests', function (s) { return (s.stats.quests || 0) >= w[0]; }, 'misc');
  });
  // 8) gifts / shop / album
  add('d1', '🎁', 'מתנה ראשונה', 'Premier cadeau', 'First gift', V3('פתחי', 'פתח', 'פתחו', ' מתנה יומית'), 'Ouvre un cadeau du jour', 'Open a daily gift', function (s) { return s.stats.gifts >= 1; }, 'gift');
  add('d10', '🎀', 'עשר מתנות', 'Dix cadeaux', 'Ten gifts', V3('פתחי', 'פתח', 'פתחו', ' 10 מתנות יומיות'), 'Ouvre 10 cadeaux', 'Open 10 daily gifts', function (s) { return s.stats.gifts >= 10; }, 'gift');
  add('b1', '🛍️', 'קניה ראשונה', 'Premier achat', 'First purchase', V3('קני', 'קנה', 'קנו', ' משהו בחנות הלבוש'), 'Achète un article à la boutique', 'Buy something in the dress-up shop', function (s) { return s.stats.bought >= 1; }, 'shop');
  add('b5', '👗', 'ארון מלא', 'Garde-robe pleine', 'Full wardrobe', V3('קני', 'קנה', 'קנו', ' 5 פריטים'), 'Achète 5 articles', 'Buy 5 items', function (s) { return s.stats.bought >= 5; }, 'shop');
  add('a1', '📖', ['מבקרת באלבום', 'מבקר באלבום', 'ביקור באלבום'], ["Visiteuse de l'album", "Visiteur de l'album", "Visite de l'album"], 'Album visitor', V3('בקרי', 'בקר', 'בקרו', ' באלבום'), "Visite l'album", 'Visit the album', function (s) { return s.stats.albumVisits >= 1; }, 'misc');
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
  shopAdd('hat', 'top', '🎩', 40, 'צילינדר', 'Haut-de-forme', 'Top hat'); shopAdd('hat', 'chef', '👨‍🍳', 30, ['כובע שפית', 'כובע שף', 'כובע שף'], 'Toque', 'Chef hat');
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
  function TG(o) { return T(o); } // (kept as a name: the texts that were three-form from the start)
  function meta(k, d) { try { var K = window.KidApp; d = d || {}; d.k = k; if (K && K.track) K.track('meta', d); } catch (e) {} }
  // presentation band (research: gamification motivates far less at primary age than in middle / high school)
  function bandOf(age) { return isNum(age) && age >= 4 && age <= 7 ? 'little' : isNum(age) && age >= 11 && age <= 18 ? 'teen' : 'kid'; }
  function band() {
    if (!S) load();
    if (S.band) return S.band;
    var a = null; try { var K = window.KidApp; a = K && K.kid ? K.kid().age : null; } catch (e) {}
    return bandOf(a);
  }
  function setBand(b) { if (!S) load(); if (b !== '' && b !== 'little' && b !== 'kid' && b !== 'teen') return false; if (S.band !== b) { S.band = b; save(); } return true; }
  var seen = {};
  function opened(what) { // which element of the meta layer the kid opened (once per page view each)
    if (!/^(journey|album|badges|pet|road|missions)$/.test(what) || seen[what]) return false;
    seen[what] = 1; meta('open', {what: what, band: band()}); return true;
  }
  var subs = [];
  function emit(ev) { subs.forEach(function (f) { try { f(ev); } catch (e) {} }); }
  // XP = coins ever earned. noWeek: gifts of the meta layer itself (chests, milestones, badges, pet) do not feed the weekly road
  function addXP(n, noWeek) {
    if (!(n > 0)) return;
    S.earned += n;
    if (noWeek) return;
    weekRoll();
    var before = S.wk.xp; S.wk.xp += n;
    ROAD.forEach(function (c, i) { var x = rxp(i); if (before < x && S.wk.xp >= x) S.pend.push({t: 'road', n: i}); });
  }
  function gift(n) { S.coins += n; addXP(n, true); return n; }

  /* -- play streak -- */
  var STREAK_MS = [[3, 15], [7, 40], [14, 80], [30, 150]]; // [days, coins] – each milestone pays once
  // A streak that can no longer go on is closed quietly, once: p.bk keeps its length until the kid plays again. The kid never sees a "lost" message.
  function streakSeen(td) {
    var p = S.ps; if (!p.last || p.n < 1 || p.bk) return false;
    var gap = dayDiff(p.last, td);
    if (!(gap > 2 || (gap === 2 && p.sh === weekId(td)))) return false;
    p.bk = p.n; if (p.n >= 2) meta('streak_break', {len: p.n});
    return true;
  }
  function streakTick(td) {
    var p = S.ps; if (p.last === td) return;
    var gap = p.last ? dayDiff(p.last, td) : 0, wid = weekId(td), saved = false, back = false;
    streakSeen(td);
    if (!p.last || p.n < 1) p.n = 1;
    else if (p.bk) { // first play day after a break: a warm welcome back, the best stays
      if (p.bk >= 2) { back = true; p.wb = td; meta('streak_back', {gap: Math.min(gap, 999)}); }
      p.bk = 0; p.n = 1;
    }
    else if (gap === 1) p.n++;
    else if (gap === 2 && p.sh !== wid) { p.n++; p.sh = wid; p.sd = addDays(td, -1); saved = true; } // the weekly shield covered yesterday
    else if (gap > 1) p.n = 1; // a new streak simply starts: nothing is lost but the counter
    p.last = td; p.best = Math.max(p.best, p.n);
    S.pend = S.pend.filter(function (x) { return x.t !== 'streak' && x.t !== 'back'; });
    if (back) S.pend.push({t: 'back', n: p.best});
    if (p.n >= 2) S.pend.push({t: 'streak', n: p.n, sh: saved ? 1 : 0});
    meta('streak', {n: p.n, shield: saved});
    STREAK_MS.forEach(function (m) { if (p.n >= m[0] && !p.ms[m[0]]) { p.ms[m[0]] = 1; gift(m[1]); S.pend.push({t: 'ms', n: m[0]}); meta('streak', {milestone: m[0], coins: m[1]}); } });
  }
  function streak() {
    if (!S) load();
    var td = today(), p = S.ps, gap = p.last ? dayDiff(p.last, td) : 99, wid = weekId(td), free = p.sh !== wid;
    if (streakSeen(td)) save();
    var alive = p.n > 0 && !p.bk && (gap <= 1 || (gap === 2 && free)), n = alive ? p.n : 0, nx = null;
    var ms = STREAK_MS.map(function (m) { var o = {n: m[0], coins: m[1], done: !!p.ms[m[0]]}; if (!nx && !o.done) nx = o; return o; });
    return {n: n, today: gap === 0, best: p.best, shield: free, saved: !free && p.sd ? p.sd : '', saving: alive && gap === 2, next: nx, ms: ms, back: p.wb === td};
  }

  /* -- weekly trophy road -- */
  var ROAD = [{xp: 20, k: 'c', c: 10}, {xp: 50, k: 'c', c: 15}, {xp: 100, k: 's', c: 25}, {xp: 160, k: 'c', c: 20}, {xp: 240, k: 'i', c: 30}, {xp: 340, k: 'c', c: 30}, {xp: 460, k: 's', c: 25}, {xp: 600, k: 't', c: 40}];
  // personal weekly goal: the same 8 chests and gifts, nearer or further apart (the lighter goal is never worth less)
  var GOALS = {l: .5, r: 1, b: 1.5};
  function rxp(i) { return Math.round(ROAD[i].xp * (GOALS[S.wg] || 1)); }
  function setGoal(g) { if (!S) load(); if (!GOALS[g]) return false; if (S.wg !== g) { S.wg = g; save(); meta('choice', {what: 'goal', v: g}); } return true; }
  function chestPool(k) {
    if (k === 's') return CAT.filter(function (s) { return s.g === 'rare' && !S.st[s.id]; }).map(function (s) { return s.id; });
    if (k === 'i') return SHOP.filter(function (it) { return it.price > 0 && it.price <= 45 && !S.own[it.id]; }).map(function (it) { return it.id; });
    return [];
  }
  function chestChoices(i) { // CHOICE: a sticker / item chest offers two gifts (the same two all week); [] = nothing to choose
    if (!S) load();
    i = clampInt(i, 0, ROAD.length - 1);
    var k = ROAD[i].k, pool = chestPool(k).sort();
    if (pool.length < 2) return [];
    return shuffled(pool, seedRnd('c' + S.wk.id + '|' + i)).slice(0, 2).map(function (id) { var x = k === 's' ? STK_BY[id] : SHOP_BY[id]; return {id: id, kind: k, e: x.e, name: T(x.n)}; });
  }
  function grantChest(i, want) { // k: c coins · s sticker (rare pool, else coins) · i avatar item (else coins) · t the weekly champion title + coins
    var c = ROAD[i], r = {i: i, kind: c.k, coins: 0, sticker: null, item: null, title: false}, pool = chestPool(c.k);
    if (pool.length) { var id = want && pool.indexOf(want) >= 0 ? want : pick(pool); if (c.k === 's') { r.sticker = id; S.st[id] = Date.now(); } else { r.item = id; S.own[id] = 1; } }
    if (c.k === 't') { S.stats.roads++; r.title = true; }
    if (c.k === 'c' || c.k === 't' || (!r.sticker && !r.item)) r.coins = gift(c.c);
    return r;
  }
  function weekRoll() {
    var id = weekId(today()); if (S.wk.id === id) return false;
    var old = S.wk, rc = null;
    if (old.id && old.xp > 0) { // last week's recap; chests the kid reached but did not open are opened now
      var n = 0, c = 0, g = 0;
      ROAD.forEach(function (ch, i) { if (old.xp >= rxp(i)) { n++; if (!old.cl[i]) { var r = grantChest(i); c += r.coins; if (r.sticker || r.item || r.title) g++; } } });
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
      var x = rxp(i), o = {i: i, xp: x, kind: c.k, e: {c: '💰', s: '🏷️', i: '🎩', t: '👑'}[c.k], coins: c.c, reached: w.xp >= x, claimed: !!w.cl[i]};
      o.ready = o.reached && !o.claimed; o.choice = o.ready && (c.k === 's' || c.k === 'i') && chestPool(c.k).length > 1; if (o.reached) got++; if (!nx && !o.reached) nx = o; return o;
    });
    return {id: w.id, xp: w.xp, max: rxp(ROAD.length - 1), goal: S.wg, chests: chests, reached: got, next: nx, ready: chests.filter(function (c) { return c.ready; }).length,
      recap: w.rc ? {xp: w.rc.xp, chests: w.rc.n, coins: w.rc.c, gifts: w.rc.g || 0} : null};
  }
  function claimChest(i, want) {
    if (!S) load();
    weekRoll(); i = clampInt(i, 0, ROAD.length - 1);
    if (S.wk.xp < rxp(i) || S.wk.cl[i]) return null;
    var chosen = typeof want === 'string' && chestChoices(i).some(function (x) { return x.id === want; });
    S.wk.cl[i] = 1;
    var r = grantChest(i, chosen ? want : null);
    S.pend = S.pend.filter(function (p) { return !(p.t === 'road' && p.n === i); });
    checkLevel(); checkBadges(); checkStickers();
    if (r.sticker) S.pend = S.pend.filter(function (p) { return !(p.t === 'sticker' && p.id === r.sticker); }); // the chest shows it itself
    if (r.sticker) r.stickerE = STK_BY[r.sticker].e, r.stickerN = T(STK_BY[r.sticker].n);
    if (r.item) r.itemE = SHOP_BY[r.item].e, r.itemN = T(SHOP_BY[r.item].n);
    save(); meta('chest', {i: i, kind: r.kind, coins: r.coins}); if (chosen) meta('choice', {what: 'chest', v: i});
    emit({t: 'earn', coins: r.coins, xp: r.coins, src: 'chest'});
    return r;
  }
  function ackRecap() { if (!S) load(); if (S.wk.rc) { S.wk.rc = null; save(); } }

  /* -- brain boost: learning is the smart way to level up -- */
  var LEARN = {bagrut: 1, reading: 1, mathquest: 1, wordcity: 1, sciencelab: 1, thinking: 1}, BOOST_MS = 15 * 60000;
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
  // demonstrated skill in one learning game: 3-star results + the levels of the skills reported with event:'mastery'
  function mval(s, g) { var n = s.stats.m3[g] || 0, mk = s.stats.mk[g]; if (mk) for (var k in mk) n += mk[k]; return n; }
  function mast(id, g, e, n) {
    return {id: id, m: g, e: e, th: [3, 10, 25], v: function (s) { return mval(s, g); }, n: n,
      d: {he: '3 כוכבים ב-{n} שלבים', fr: '3 étoiles dans {n} niveaux', en: '3 stars on {n} levels'}};
  }
  var BADGES = [
    mast('m-math', 'mathquest', '🧮', {he: ['אשפית חשבון', 'אשף חשבון', 'אשפ/ית חשבון'], fr: 'As des maths', en: 'Maths Ace'}),
    mast('m-words', 'wordcity', '🔤', {he: ['אשפית מילים', 'אשף מילים', 'אשפ/ית מילים'], fr: 'As des mots', en: 'Word Ace'}),
    mast('m-science', 'sciencelab', '🔬', {he: ['חוקרת מדע', 'חוקר מדע', 'חוקר/ת מדע'], fr: 'Scientifique en herbe', en: 'Science Ace'}),
    mast('m-think', 'thinking', '🧩', {he: ['פותרת חידות', 'פותר חידות', 'פותר/ת חידות'], fr: 'As de la logique', en: 'Puzzle Solver'}),
    mast('m-read', 'reading', '📖', {he: ['קוראת מצוינת', 'קורא מצוין', 'קורא/ת מצוינ/ת'], fr: ['Super lectrice', 'Super lecteur', 'Super lecteur·rice'], en: 'Strong Reader'}),
    mast('m-bagrut', 'bagrut', '📝', {he: ['מוכנה לבגרות', 'מוכן לבגרות', 'מוכנ/ה לבגרות'], fr: ['Prête pour l’examen', 'Prêt pour l’examen', 'Prêt·e pour l’examen'], en: 'Exam Ready'}),
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
      if (!B.m) for (var k = had; k < t; k++) gift(BADGE_COINS[k]); // a mastery badge is not a prize: it pays nothing, it says what the kid can do
      S.pend.push({t: 'badge', id: B.id, n: t}); got.push(B.id); meta('badge', {id: B.id, tier: t});
    });
    return got;
  }
  function badgeTitle(B, t) { return B.e + ' ' + TG(B.n) + (t ? ' ' + MEDAL[t] : ''); }
  function shownBadge(B) { // the exam badge only where it means something (older teens, or once the exam track was used)
    if (B.id !== 'm-bagrut') return true;
    var a = null; try { a = window.KidApp && KidApp.kid ? KidApp.kid().age : null; } catch (e) {}
    return (isNum(a) && a >= 14) || B.v(S) > 0 || !!S.bd[B.id];
  }
  function badgeView(B) {
    var t = S.bd[B.id] || 0, v = B.v(S), nx = t < 3 ? B.th[t] : null, lo = t ? B.th[t - 1] : 0;
    return {id: B.id, e: B.e, name: TG(B.n), title: badgeTitle(B, t), tier: t, medal: MEDAL[t], val: v, goal: nx, coins: nx && !B.m ? BADGE_COINS[t] : 0,
      pct: nx ? Math.max(0, Math.min(100, Math.round((v - lo) / (nx - lo) * 100))) : 100, desc: T(B.d).replace('{n}', nx || B.th[2]), on: S.ti === B.id};
  }
  // badges() = the 7 "how much" badges (unchanged); skills() = the mastery badges, which the pages show first
  function badges() { if (!S) load(); return BADGES.filter(function (B) { return !B.m; }).map(badgeView); }
  function skills() {
    if (!S) load();
    return BADGES.filter(function (B) { return B.m && shownBadge(B); }).map(function (B) {
      var b = badgeView(B); b.m = B.m; b.game = isGame(B.m) ? gname(B.m) : ''; b.gameE = isGame(B.m) ? GAMES[B.m][0] : B.e;
      b.can = b.tier ? T(B.d).replace('{n}', B.th[b.tier - 1]) : ''; b.stars = S.stats.stars[B.m] || 0; b.played = (S.stats.plays[B.m] || 0) > 0;
      return b;
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
    pts: {he: ['נקודות — נראה אותך עוברת!', 'נקודות — נראה אותך עובר!', 'נקודות — נראה אתכם עוברים!'], fr: 'points à battre !', en: 'points to beat!'},
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
    roadS: {he: 'פותחים אותה בעמוד הבית', fr: 'Ouvre-le sur la page d’accueil', en: 'Open it on the home page'},
    // competence, not prizes
    mast: {he: ['את יודעת את זה!', 'אתה יודע את זה!', 'יודעים את זה!'], fr: 'Tu sais le faire !', en: 'You can do this!'},
    // a break in the streak is never a loss: a warm welcome, and the best stays
    back: {he: 'טוב לראות אותך!', fr: 'Content de te revoir !', en: 'Good to see you!'},
    backS: {he: 'רצף חדש מתחיל היום · השיא שלך: {n}', fr: 'Une nouvelle série commence aujourd’hui · ton record : {n}', en: 'A new streak starts today · your best was {n}'},
    backL: {he: 'החיה שלך שמחה לראות אותך! 💗', fr: 'Ton compagnon est content de te voir ! 💗', en: 'Your pet is happy to see you! 💗'},
    // short sessions are enough: a cap is good news
    capG: {he: 'אספת מספיק מטבעות במשחק הזה להיום 👏', fr: 'Assez de pièces dans ce jeu pour aujourd’hui 👏', en: 'Plenty of coins from this game for today 👏'},
    capGS: {he: 'אפשר להמשיך בשביל הכיף, או לחזור מחר', fr: 'Continue pour le plaisir, ou reviens demain', en: 'Keep playing for fun, or come back tomorrow'},
    capD: {he: 'זה מספיק להיום — כל הכבוד! 🌙', fr: 'C’est bien assez pour aujourd’hui, bravo ! 🌙', en: 'That’s plenty for today — well done! 🌙'},
    capDS: {he: 'המטבעות יחכו לך מחר', fr: 'Les pièces t’attendent demain', en: 'More coins will be waiting tomorrow'},
    capL: {he: 'שיחקנו המון היום! 🐾', fr: 'On a beaucoup joué aujourd’hui ! 🐾', en: 'We played a lot today! 🐾'},
    capLS: {he: 'נתראה מחר', fr: 'À demain', en: 'See you tomorrow'},
    questL: {he: 'המשימה הושלמה! 🎉', fr: 'Mission réussie ! 🎉', en: 'Mission done! 🎉'},
    roadL: {he: 'מתנה מחכה לך!', fr: 'Un cadeau t’attend !', en: 'A present is waiting!'}
  };

  /* ---------- core: award ---------- */
  var DEFAULT_COINS = {win: 5, levelClear: 2, combo: 0, score: 0, play: 0, firstPlay: 0};
  function award(o) {
    try {
      if (!S) load();
      if (!o || typeof o !== 'object') return {coins: 0, stickers: []};
      var game = typeof o.game === 'string' && /^[a-z0-9_-]{1,30}$/i.test(o.game) && !(o.game in Object.prototype) ? o.game : 'misc', ev = String(o.event || 'play'), c = 0;
      var st = S.stats, td = today(), first = !st.plays[game], real = isGame(game) && game !== 'retro', boosted = boostLeft() > 0, xp0 = S.earned, co0 = S.coins;
      if (ev === 'play' || ev === 'firstPlay') { st.plays[game] = (st.plays[game] || 0) + 1; signal(true, game); }
      else if (ev === 'win') { st.wins[game] = (st.wins[game] || 0) + 1; st.winsTotal++; c = DEFAULT_COINS.win; if (real && (o.online === true || window.__arOnline === true)) st.onl++; }
      else if (ev === 'levelClear') { if (isNum(o.level)) st.levelMax = Math.max(st.levelMax, clampInt(o.level, 0, 9999)); c = DEFAULT_COINS.levelClear; if (!st.plays[game]) st.plays[game] = 1; if (LEARN[game]) st.lrn++; }
      else if (ev === 'star') { var n = clampInt(o.stars, 0, 3); if (n > 0) { st.stars[game] = (st.stars[game] || 0) + n; st.starsTotal += n; if (LEARN[game]) st.lrn += n; c = 2 * n; if (n === 3) { st.perfects++; c += 5; if (MAST[game]) st.m3[game] = (st.m3[game] || 0) + 1; } } }
      else if (ev === 'mastery') { // optional richer signal from a learning game: the kid showed skill `skill` at level 1..3 (no coins: it feeds the mastery badges)
        var skl = typeof o.skill === 'string' ? o.skill : '';
        if (MAST[game] && SKILL_RE.test(skl) && !(skl in Object.prototype)) { var mk = st.mk[game] || (st.mk[game] = {}); if (mk[skl] || Object.keys(mk).length < 80) mk[skl] = Math.max(mk[skl] || 0, clampInt(o.level, 1, 3)); }
      }
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
      // (short sessions are enough: after the cap of a game, or of the day, more play earns nothing, and the kid is told so kindly, once)
      var key = game + '|' + td, used = st.daily[key] || 0, dkey = '_day|' + td, dused = st.daily[dkey] || 0, dcap = CAP_DAY[band()] || 800;
      if (c > 0) {
        c = Math.max(0, Math.min(c, CAP_PER_GAME_DAY - used, dcap - dused)); st.daily[key] = used + c; st.daily[dkey] = dused + c; trimDaily(td);
        var capK = dused < dcap && dused + c >= dcap ? 'd' : used < CAP_PER_GAME_DAY && used + c >= CAP_PER_GAME_DAY ? 'g' : '';
        if (capK) { S.pend = S.pend.filter(function (x) { return x.t !== 'cap'; }); S.pend.push({t: 'cap', k: capK}); meta('cap', {kind: capK === 'd' ? 'day' : 'game'}); }
      }
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
      '.ar-toast.on{transform:translate(-50%,0);opacity:1}.ar-toast .e{font-size:38px;line-height:1;filter:drop-shadow(0 2px 0 #0002)}.ar-toast small{display:block;font-size:13px;font-weight:700;opacity:.8}' +
      /* calm mode: one small still card, top or bottom edge (data-at), a short fade and nothing else */
      '.ar-toast.q{top:auto;bottom:auto;transform:translateX(-50%);gap:10px;max-width:min(92vw,360px);padding:8px 14px;border-radius:14px;background:#fff;border:1px solid #e3ded4;box-shadow:0 2px 8px #2b314022;color:#2b3140;font-weight:600;font-size:15px;line-height:1.3;transition:opacity .15s linear}' +
      '.ar-toast.q.on{transform:translateX(-50%)}.ar-toast.q[data-at=top]{top:max(10px,env(safe-area-inset-top))}.ar-toast.q[data-at=bottom]{bottom:max(10px,env(safe-area-inset-bottom))}' +
      '.ar-toast.q .e{font-size:22px;filter:none}.ar-toast.q small{font-size:13px;font-weight:500;color:#5a6272;opacity:1}' +
      '.ar-toast.tn{background:#1f1a44f5;color:#fff;border:2px solid #8f7bff;border-radius:16px;box-shadow:0 8px 24px #0006;font-weight:700;font-size:16px;transition:transform .3s ease,opacity .25s}.ar-toast.tn .e{font-size:28px;filter:none}';
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
    toastEl.dir = lang() === 'he' ? 'rtl' : 'ltr'; toastEl.innerHTML = html; toastEl.className = 'ar-toast' + (band() === 'teen' ? ' tn' : '');
    void toastEl.offsetWidth; toastEl.classList.add('on');
    setTimeout(function () { toastEl.classList.remove('on'); setTimeout(cb, 500); }, ms);
  }
  /* ---------- calm mode (docs/CALM-UI.md): the quiet banner, the play signal, the news list ---------- */
  function quiet() { return lsGet('annabelle-calm') !== '0'; }
  function signal(on, game) { try { window.dispatchEvent(new CustomEvent('annabelle-play', {detail: {on: !!on, game: game || ''}})); } catch (e) {} }
  function busyAt(r) { // how many controls of the page a banner at rect r would sit on
    var n = 0, list = document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[onclick]');
    for (var i = 0; i < list.length; i++) {
      var b = list[i].getBoundingClientRect(); if (b.width < 2 || b.height < 2 || b.bottom <= r.top || b.top >= r.bottom || b.right <= r.left || b.left >= r.right) continue;
      var cs = getComputedStyle(list[i]); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      n++;
    }
    return n;
  }
  function showQuiet(d, ms, cb) { // d = {e, a, b} plain text; built with textContent only
    addStyle();
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); document.body.appendChild(toastEl); }
    toastEl.dir = lang() === 'he' ? 'rtl' : 'ltr'; toastEl.className = 'ar-toast q'; toastEl.textContent = '';
    var e = document.createElement('span'); e.className = 'e'; e.setAttribute('aria-hidden', 'true'); e.textContent = d.e;
    var tx = document.createElement('span'); tx.appendChild(document.createTextNode(d.a));
    if (d.b) { var sm = document.createElement('small'); sm.textContent = d.b; tx.appendChild(sm); }
    toastEl.appendChild(e); toastEl.appendChild(tx);
    var at = 'top';
    try { toastEl.setAttribute('data-at', 'top'); var n1 = busyAt(toastEl.getBoundingClientRect()); if (n1) { toastEl.setAttribute('data-at', 'bottom'); if (busyAt(toastEl.getBoundingClientRect()) < n1) at = 'bottom'; } } catch (x) {}
    toastEl.setAttribute('data-at', at);
    void toastEl.offsetWidth; toastEl.classList.add('on');
    setTimeout(function () { toastEl.classList.remove('on'); setTimeout(cb, 200); }, ms);
  }
  var NEWS_IMP = {sticker: 1, badge: 1, level: 1, pet: 1}, NEWS_LITTLE = {sticker: 1, badge: 1, pet: 1, quest: 1, qall: 1, road: 1, back: 1, cap: 1};
  function describe(p, little) { // {e, a, b} in plain text for one message; null = nothing to say in this band
    var t = p.t, n = clampInt(p.n, 0, 1e7);
    if (little && (!NEWS_LITTLE[t] || t === 'badge' && !(BADGE_BY[p.id] && BADGE_BY[p.id].m) || t === 'cap' && p.k !== 'd')) return null;
    if (t === 'sticker') { var s = STK_BY[p.id]; return s ? {e: s.e, a: T(TXT.new), b: T(s.n)} : null; }
    if (t === 'coins') return n > 0 ? {e: '💰', a: '+' + n + ' ' + T(TXT.coins), b: ''} : null;
    if (t === 'level') { var L = Math.max(1, n), r = rankOf(L); return {e: r[1], a: T(TXT.level).replace('{n}', L), b: T(r[2])}; }
    if (t === 'quest') { var q = QUEST_BY[p.id]; return q ? {e: '✅', a: T(little ? TXT.questL : TXT.quest), b: T(q.t)} : null; }
    if (t === 'qall') return {e: little ? '✅' : '🎉', a: T(little ? TXT.questL : TXT.qall), b: ''};
    if (t === 'chal') return isGame(p.g) ? {e: '🏆', a: T(TXT.chal).replace('{n}', cleanName(p.n) || '?'), b: gname(p.g)} : null;
    if (t === 'streak') return {e: '🔥', a: T(TXT.streak).replace('{n}', n), b: T(p.sh ? TXT.shield : TXT.streakS)};
    if (t === 'ms') { var mc = 0; STREAK_MS.forEach(function (m) { if (m[0] === n) mc = m[1]; }); return {e: '🔥', a: T(TXT.ms).replace('{n}', n), b: mc ? '💰 +' + mc : ''}; }
    if (t === 'back') return little ? {e: '🐾', a: T(TXT.backL), b: ''} : {e: '👋', a: T(TXT.back), b: T(TXT.backS).replace('{n}', Math.max(1, n))};
    if (t === 'cap') return little ? {e: '🌙', a: T(TXT.capL), b: T(TXT.capLS)} : p.k === 'd' ? {e: '🌙', a: T(TXT.capD).replace(/ 🌙$/, ''), b: T(TXT.capDS)} : {e: '👏', a: T(TXT.capG).replace(/ 👏$/, ''), b: T(TXT.capGS)};
    if (t === 'badge') {
      var B = BADGE_BY[p.id], tr = clampInt(p.n, 1, 3); if (!B) return null;
      return B.m ? {e: B.e, a: TG(TXT.mast), b: T(B.d).replace('{n}', B.th[tr - 1]) + (isGame(B.m) ? ' · ' + gname(B.m) : '') + ' ' + MEDAL[tr]} : {e: B.e, a: T(TXT.badge), b: TG(B.n) + ' ' + MEDAL[tr]};
    }
    if (t === 'boost') return {e: '🧠', a: T(TXT.boost), b: T(TXT.boostS).replace('{n}', BOOST_MS / 60000)};
    if (t === 'pet') return {e: n === 1 ? '🐣' : '🐾', a: T(n === 1 ? TXT.petH : TXT.pet), b: T(PET_N[S.pet.k][Math.min(n, PET_XP.length - 1)])};
    if (t === 'road') return little ? {e: '🎁', a: T(TXT.roadL), b: ''} : {e: '🎁', a: T(TXT.road), b: T(TXT.roadS)};
    return null;
  }
  function noteNews(p) { // append one message to the news list (coins of the same day are summed, a level is listed once)
    var o = newsClean(p, nowMs()); if (!o) return;
    var last = S.news[S.news.length - 1];
    if (o.t === 'coins') {
      if (o.n < 1) return;
      for (var i = S.news.length - 1; i >= 0; i--) if (S.news[i].t === 'coins') { if (dayKey(new Date(S.news[i].at)) === dayKey(new Date(o.at))) { o.n = clampInt(S.news[i].n + o.n, 0, 1e7); S.news.splice(i, 1); } break; }
    }
    if (o.t === 'level' && S.news.some(function (x) { return x.t === 'level' && x.n === o.n; })) return;
    if (o.t === 'cap' && last && last.t === 'cap' && last.k === o.k) { last.at = o.at; return; }
    S.news.push(o); if (S.news.length > NEWS_MAX) S.news = S.news.slice(-NEWS_MAX);
  }
  var heldQ = [];                        // calm banners that waited for a level card (this page view only; they are in the news anyway)
  function runQuiet(qi, little) {
    if (!qi.length) return false;
    if (little) qi = qi.slice(0, 1);
    else if (qi.length > 2) qi = [qi[0], {e: '📰', a: T(TXT.more).replace('{n}', qi.length - 1).replace(/^[a-z]/, function (m) { return m.toUpperCase(); }), b: ''}];
    flushing = true;
    (function nextQ(i) { if (i >= qi.length) { flushing = false; if (reflush) { reflush = false; flush(); } return; } showQuiet(qi[i], little ? 3800 : 3400, function () { nextQ(i + 1); }); })(0);
    return true;
  }
  function news() {
    if (!S) load();
    var little = band() === 'little', out = [], coins = 0, at = nowMs();
    function put(p, pending) {
      var d = describe(p, little); if (!d) return;
      out.push({t: p.t, e: d.e, title: d.a, text: d.b || '', at: p.at, seen: !pending && p.at <= S.ns, pending: !!pending, important: !!NEWS_IMP[p.t]});
    }
    S.news.forEach(function (p) { put(p, false); });
    S.pend.forEach(function (p) { if (p.t === 'coins') { coins += clampInt(p.n, 0, 1e7); return; } if (p.t === 'level' && S.news.some(function (x) { return x.t === 'level' && x.n === p.n; })) return; var o = newsClean(p, at); if (o) put(o, true); });
    if (coins > 0) put({t: 'coins', n: coins, at: at}, true);
    return out.reverse();
  }
  function newsSeen() {
    if (!S) load();
    var n = S.news.filter(function (p) { return p.at > S.ns; }).length, top = S.news.reduce(function (m, p) { return Math.max(m, p.at); }, 0);
    if (top > S.ns) { S.ns = top; save(); }
    return n;
  }
  function flush() {
    try {
      if (!S) load();
      signal(false);
      if (!S.pend.length || !document.body) { if (heldQ.length && document.body && !flushing && quiet()) { var hq = heldQ; heldQ = []; return runQuiet(hq, band() === 'little'); } return false; }
      var J = window.Juice, home = /(^|\/)(index\.html)?$/.test(location.pathname), bd = band(), little = bd === 'little', jl = !!(J && typeof J.levelUp === 'function') && !home && !little;
      if (little && S.pend.some(function (p) { return p.t === 'level'; })) { S.pend.forEach(function (p) { if (p.t === 'level') noteNews(p); }); S.pend = S.pend.filter(function (p) { return p.t !== 'level'; }); save(); if (!S.pend.length) return false; } // little band: the pet growing is the celebration
      var lvOnly = jl && !quiet() && S.pend.every(function (p) { return p.t === 'level'; }); // (calm mode: a level is a quiet banner like the others, see below)
      if (flushing && !lvOnly) { reflush = true; return false; } // shown right after the banners that are on screen
      if (lvOnly) { try { J.levelUp(S.pend.reduce(function (m, p) { return Math.max(m, clampInt(p.n, 1, 9999)); }, 1)); } catch (e) {} return false; }
      var q = S.pend.slice(), coins = 0, stk = [], pre = [], lvMax = 0, qs = [], qall = false, chs = [], sk = null, msN = 0, bdg = [], bst = false, petN = -1, roadN = 0, bk = null, capK = '';
      q.forEach(function (p) {
        if (p.t === 'coins') coins += p.n;
        else if (p.t === 'level') lvMax = Math.max(lvMax, clampInt(p.n, 1, 9999));
        else if (p.t === 'quest') { if (QUEST_BY[p.id]) qs.push(QUEST_BY[p.id]); }
        else if (p.t === 'qall') qall = true;
        else if (p.t === 'chal') { if (isGame(p.g)) chs.push(p); }
        else if (p.t === 'streak') sk = p;
        else if (p.t === 'back') bk = p;
        else if (p.t === 'cap') capK = p.k === 'd' ? 'd' : 'g';
        else if (p.t === 'ms') msN = Math.max(msN, clampInt(p.n, 0, 999));
        else if (p.t === 'badge') { if (BADGE_BY[p.id]) { bdg = bdg.filter(function (x) { return x.id !== p.id; }); bdg.push(p); } } // one banner per badge: its highest tier
        else if (p.t === 'boost') bst = true;
        else if (p.t === 'pet') petN = Math.max(petN, clampInt(p.n, 0, 9));
        else if (p.t === 'road') roadN++;
        else if (STK_BY[p.id]) stk.push(STK_BY[p.id]);
      });
      var one = function (e, a, b) { return '<span class="e">' + e + '</span><span>' + a + (b ? '<small>' + b + '</small>' : '') + '</span>'; };
      var badgeToast = function (p) {
        var B = BADGE_BY[p.id], t = clampInt(p.n, 1, 3);
        if (B.m) return one(B.e, TG(TXT.mast), T(B.d).replace('{n}', B.th[t - 1]) + (isGame(B.m) ? ' · ' + escH(gname(B.m)) : '') + ' ' + MEDAL[t]); // competence wording, no prize
        return one(B.e, T(TXT.badge), escH(TG(B.n)) + ' ' + MEDAL[t] + ' · 💰 +' + BADGE_COINS[t - 1]);
      };
      var petToast = function () { return one(petN === 1 ? '🐣' : '🐾', T(petN === 1 ? TXT.petH : TXT.pet), escH(T(PET_N[S.pet.k][Math.min(petN, PET_XP.length - 1)]))); };
      var items = [], max = 4;
      if (little) {
        // calm, play first: at most two gentle banners, about the pet, a sticker or something the kid can now do. No coins, levels, streak counts or road numbers.
        max = 2;
        if (bk) pre.push(one('🐾', T(TXT.backL)));
        if (capK === 'd') pre.push(one('🌙', T(TXT.capL), T(TXT.capLS)));
        if (petN >= 0 && !home) pre.push(petToast());
        if (stk.length) pre.push(one(stk[0].e, T(TXT.new), T(stk[0].n)));
        bdg.filter(function (p) { return BADGE_BY[p.id].m; }).slice(-1).forEach(function (p) { pre.push(badgeToast(p)); });
        if (qs.length || qall) pre.push(one('✅', T(TXT.questL), qs.length ? T(qs[0].t) : ''));
        if (roadN && !home) pre.push(one('🎁', T(TXT.roadL)));
      } else {
        if (bd === 'teen') max = 3;
        if (lvMax && !home && !jl && !document.querySelector('.lvup')) pre.push(one(rankOf(lvMax)[1], T(TXT.level).replace('{n}', lvMax), T(rankOf(lvMax)[2])));
        if (qall) pre.push(one('🎉', T(TXT.qall), '💰 +' + (qs.length * QUEST_COINS + QUEST_BONUS) + ' (' + T(TXT.bonus) + ' +' + QUEST_BONUS + ')'));
        else if (qs.length > 1) pre.push(one('✅', T(TXT.questN).replace('{n}', qs.length), '💰 +' + qs.length * QUEST_COINS));
        else if (qs.length) pre.push(one('✅', T(TXT.quest), T(qs[0].t) + ' · 💰 +' + QUEST_COINS));
        chs.slice(0, 2).forEach(function (p) { pre.push(one('🏆', T(TXT.chal).replace('{n}', escH(cleanName(p.n))), escH(gname(p.g)) + (p.c === 0 ? '' : ' · 💰 +10'))); });
        var mb = bdg.filter(function (p) { return BADGE_BY[p.id].m; }).slice(-2), ob = mb.length < 2 ? bdg.filter(function (p) { return !BADGE_BY[p.id].m; }).slice(mb.length - 2) : [];
        mb.forEach(function (p) { pre.push(badgeToast(p)); }); // what the kid can do comes before streaks and the "how much" badges
        if (bk) pre.push(one('👋', T(TXT.back), T(TXT.backS).replace('{n}', clampInt(bk.n, 1, 9999)))); // instead of any "streak lost" message
        if (msN) { var mc = 0; STREAK_MS.forEach(function (m) { if (m[0] === msN) mc = m[1]; }); pre.push(one('🔥', T(TXT.ms).replace('{n}', msN), '💰 +' + mc)); }
        else if (sk && !bk) pre.push(one('🔥', T(TXT.streak).replace('{n}', clampInt(sk.n, 0, 9999)), T(sk.sh ? TXT.shield : TXT.streakS)));
        ob.forEach(function (p) { pre.push(badgeToast(p)); });
        if (bst && boostLeft() > 0) pre.push(one('🧠', T(TXT.boost), T(TXT.boostS).replace('{n}', BOOST_MS / 60000)));
        if (petN >= 0 && !home) pre.push(petToast());
        if (roadN && !home) pre.push(one('🎁', T(TXT.road), T(TXT.roadS)));
        if (capK) { if (pre.length >= max) pre.length = max - 1; pre.push(one(capK === 'd' ? '🌙' : '👏', T(capK === 'd' ? TXT.capD : TXT.capG).replace(/ (👏|🌙)$/, ''), T(capK === 'd' ? TXT.capDS : TXT.capGS))); }
      }
      // the home page celebrates a new level with its own sheet; elsewhere juice.js does (it keeps the entry until it could show it)
      q.forEach(function (p) { if (p.t !== 'coins' && p.t !== 'level') noteNews(p); }); if (lvMax) noteNews({t: 'level', n: lvMax}); if (coins > 0) noteNews({t: 'coins', n: coins});
      S.pend = lvMax && jl ? [{t: 'level', n: lvMax}] : []; save();
      var calm = quiet(), qi = [];
      if (calm) { // calm mode: only what matters (a sticker, a badge, a level, the pet), small and one at a time; everything else stays in news()
        stk.forEach(function (s) { qi.push(describe({t: 'sticker', id: s.id}, little)); });
        bdg.forEach(function (p) { qi.push(describe(p, little)); });
        // the level: juice.js is asked first. In calm mode it shows no card over a game (it returns false): then the level is one of the quiet banners.
        // If a card of juice.js did open, one thing at a time: the banners wait for the next pause of this page view (they are in news() anyway).
        var lvCard = false; if (lvMax && jl) { try { lvCard = J.levelUp(lvMax) !== false; } catch (e) {} }
        if (lvMax && !little && !home && !lvCard && !document.querySelector('.lvup,#jz-lv')) { qi.unshift(describe({t: 'level', n: lvMax}, false)); if (jl && S.pend.length) { S.pend = S.pend.filter(function (p) { return p.t !== 'level'; }); save(); } } // said once
        if (petN >= 0 && !home) qi.push(describe({t: 'pet', n: petN}, little));
        qi = heldQ.concat(qi.filter(Boolean)); heldQ = [];
        if (lvCard) { heldQ = qi; qi = []; }
      }
      if (pre.length > max) pre.length = max;
      if (!little) {
        stk.slice(0, 3).forEach(function (s) { items.push(one(s.e, T(TXT.new), T(s.n))); });
        if (stk.length > 3) items.push('<span class="e">🎁</span><span>' + T(TXT.more).replace('{n}', stk.length - 3) + '</span>');
        if (!items.length && coins >= 3) items.push('<span class="e">💰</span><span>+' + coins + ' ' + T(TXT.coins) + '</span>');
        else if (items.length && coins >= 3) items[0] = items[0].replace('</small>', ' · 💰 +' + coins + '</small>');
      }
      items = pre.concat(items);
      emit({t: 'flush', band: bd, level: little ? 0 : lvMax, quests: qs.length, qall: qall, streak: sk && !little ? sk.n : 0, back: !!bk, milestone: little ? 0 : msN, badges: little ? bdg.filter(function (p) { return BADGE_BY[p.id].m; }).length : bdg.length, boost: bst && !little, pet: petN, road: roadN, stickers: stk.length, coins: little ? 0 : coins, cap: capK, toasts: calm ? Math.min(qi.length, little ? 1 : 2) : items.length, quiet: calm});
      if (calm) return runQuiet(qi, little);
      if (lvMax && jl) { try { J.levelUp(lvMax); } catch (e) {} }
      if (!items.length) return false;
      flushing = true; if (!(J && J.sfx)) chime();
      (function next(i) { if (i >= items.length) { flushing = false; if (reflush) { reflush = false; flush(); } return; } showToast(items[i], little ? 2800 : 2300, function () { next(i + 1); }); })(0);
      return true;
    } catch (e) { flushing = false; return false; }
  }

  /* ---------- learning time today (research: about 10-15 focused minutes a day are enough for young children) ----------
     Counted by this file itself on the learning pages: the page is visible and the kid did something in the last 90 seconds. */
  var LEARN_PAGE = {reading: 1, mathquest: 1, wordcity: 1, sciencelab: 1, thinking: 1, bagrut: 1}, LEARN_GOAL_MIN = 10;
  function learnAdd(sec) {
    if (!S) load();
    var td = today(); if (S.lt.d !== td) S.lt = {d: td, s: 0};
    S.lt.s = Math.min(86400, S.lt.s + clampInt(sec, 0, 3600)); save();
  }
  function learnToday() { // shown as done, never as a deficit: there is no "left" value on purpose
    if (!S) load();
    var s = S.lt.d === today() ? S.lt.s : 0, goal = band() === 'teen' ? 0 : LEARN_GOAL_MIN;
    return {sec: s, min: Math.floor(s / 60), goal: goal, done: goal > 0 && s >= goal * 60};
  }
  function learnWatch() {
    try {
      var id = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
      if (!LEARN_PAGE[id] || typeof setInterval !== 'function') return;
      var last = Date.now(), act = function () { last = Date.now(); };
      window.addEventListener('pointerdown', act, true); window.addEventListener('keydown', act, true);
      setInterval(function () {
        try {
          var P = window.AnnabellePlaytime;
          if (document.visibilityState === 'visible' && Date.now() - last < 90000 && !(P && P.isLocked && P.isLocked())) learnAdd(10);
        } catch (e) {}
      }, 10000);
    } catch (e) {}
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
    band: band, bandPref: function () { if (!S) load(); return S.band; }, setBand: setBand, bandOf: bandOf, opened: opened, skills: skills,
    chooseQuests: chooseQuests, swapQuest: swapQuest, chestChoices: chestChoices, goal: function () { if (!S) load(); return S.wg; }, setGoal: setGoal,
    learnToday: learnToday, stars: function () { if (!S) load(); return S.stats.starsTotal; }, _learnAdd: learnAdd,
    pet: pet, petCare: petCare, petKind: petKind, petSVG: petSVG, rankOf: function (L) { var r = rankOf(clampInt(L, 1, 9999)); return {level: r[0], e: r[1], title: T(r[2])}; },
    pending: function (t) { if (!S) load(); return S.pend.filter(function (p) { return !t || p.t === t; }).map(function (p) { return JSON.parse(JSON.stringify(p)); }); },
    ackLevel: function () { if (!S) load(); var k = S.pend.length; S.pend.forEach(function (p) { if (p.t === 'level') noteNews(p); }); S.pend = S.pend.filter(function (p) { return p.t !== 'level'; }); if (S.pend.length !== k) save(); },
    quiet: quiet, news: news, newsSeen: newsSeen,
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
      if (c && !quiet()) setTimeout(function () { if (!flushing && document.body) showToast('<span class="e">⚔️</span><span>' + T(TXT.chalGo).replace('{n}', escH(cleanName(c.n))) + '<small>' + c.s + ' ' + T(TXT.pts) + '</small></span>', 3400, function () {}); }, 1600);
    } catch (e) {}
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted) { load(); listeners.forEach(function (f) { try { f(); } catch (x) {} }); } }, true);
  window.addEventListener('storage', function (e) { if (e.key === KEY) { load(); listeners.forEach(function (f) { try { f(); } catch (x) {} }); } });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', auto) : auto();
  learnWatch();
})();

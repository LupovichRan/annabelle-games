/* Annabelle games – shared REWARDS: coins, cat stickers, daily gift, dress-up cosmetics.
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
   Test hook: window.__annabelleToday = 'YYYY-M-D' overrides "today" (daily gift).
   ───────────────────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.AnnabelleRewards) return;
  var KEY = 'annabelle-rewards', VER = 1, CAP_PER_GAME_DAY = 80;

  /* ---------- tiny helpers ---------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lang() { var l = lsGet('annabelle-lang') || 'he'; return l === 'fr' || l === 'en' ? l : 'he'; }
  function T(o) { if (!o) return ''; if (typeof o === 'string') return o; return o[lang()] || o.he || ''; }
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
    fishing: ['🎣', 'הדיג של אנאבל', 'La pêche', 'Fishing Trip'],
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
    kitchen: ['🍳', 'מסעדת החתולים', 'Le Resto des Chats', 'Cat Kitchen']
  };
  function gname(id) { var g = GAMES[id]; return g ? g[{he: 1, fr: 2, en: 3}[lang()]] : id; }

  /* ---------- state ---------- */
  function fresh() {
    return {v: VER, coins: 0, earned: 0, st: {}, stats: {plays: {}, wins: {}, stars: {}, best: {}, perfects: 0, starsTotal: 0, winsTotal: 0, levelMax: 0, comboMax: 0, gifts: 0, bought: 0, albumVisits: 0, daily: {}},
      daily: {last: '', streak: 0, best: 0, count: 0, days: []}, own: {}, av: {color: 'orange', hat: '', bow: '', glass: '', bg: 'sky'}, pend: []};
  }
  var S = null;
  function sane(o) { // accept anything from localStorage, rebuild a valid state
    var f = fresh();
    if (!o || typeof o !== 'object') return f;
    try {
      f.coins = clampInt(o.coins, 0, 1e7); f.earned = clampInt(o.earned, 0, 1e8);
      if (o.st && typeof o.st === 'object') for (var k in o.st) if (/^[a-z0-9_-]{1,40}$/i.test(k) && isNum(o.st[k])) f.st[k] = o.st[k];
      var s = o.stats && typeof o.stats === 'object' ? o.stats : {};
      ['plays', 'wins', 'stars', 'best', 'daily'].forEach(function (m) { if (s[m] && typeof s[m] === 'object') for (var g in s[m]) if (/^[a-z0-9_-]{1,40}$/i.test(g) && isNum(s[m][g])) f.stats[m][g] = clampInt(s[m][g], 0, 1e9); });
      ['perfects', 'starsTotal', 'winsTotal', 'levelMax', 'comboMax', 'gifts', 'bought', 'albumVisits'].forEach(function (m) { f.stats[m] = clampInt(s[m], 0, 1e9); });
      var d = o.daily && typeof o.daily === 'object' ? o.daily : {};
      f.daily.last = /^\d{4}-\d{1,2}-\d{1,2}$/.test(d.last) ? d.last : ''; f.daily.streak = clampInt(d.streak, 0, 9999); f.daily.best = clampInt(d.best, 0, 9999); f.daily.count = clampInt(d.count, 0, 99999);
      if (Array.isArray(d.days)) f.daily.days = d.days.filter(function (x) { return /^\d{4}-\d{1,2}-\d{1,2}$/.test(x); }).slice(-14);
      if (o.own && typeof o.own === 'object') for (var i in o.own) if (SHOP_BY[i] && o.own[i]) f.own[i] = 1;
      var a = o.av && typeof o.av === 'object' ? o.av : {};
      ['color', 'hat', 'bow', 'glass', 'bg'].forEach(function (p) { var v = a[p]; if (v === '' || (typeof v === 'string' && SHOP_BY[p + ':' + v] && (f.own[p + ':' + v] || SHOP_BY[p + ':' + v].price === 0))) f.av[p] = v; });
      if (Array.isArray(o.pend)) f.pend = o.pend.filter(function (p) { return p && (p.t === 'sticker' && STK_BY[p.id] || p.t === 'coins' && isNum(p.n)); }).slice(-30);
    } catch (e) { return fresh(); }
    return f;
  }
  var SHOP_BY = {}, STK_BY = {}; // filled below (state sanitising needs them)
  var listeners = [];
  function load() { var raw = lsGet(KEY), o = null; try { o = raw ? JSON.parse(raw) : null; } catch (e) { o = null; } S = sane(o); }
  function save() { S.v = VER; lsSet(KEY, JSON.stringify(S)); listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  /* ---------- sticker catalog (~63 original cat stickers) ---------- */
  var CAT = [];
  function add(id, e, he, fr, en, dhe, dfr, den, rule, group) {
    var s = {id: id, e: e, n: {he: he, fr: fr, en: en}, d: {he: dhe, fr: dfr, en: den}, rule: rule || null, g: group || 'misc'};
    CAT.push(s); STK_BY[id] = s;
  }
  // 1) first play of each game (26)
  var GS = {bubbles: 'מגלת בועות', cats: 'זוגית זוגות', checkers: 'מלכת הדמקה', cups: 'עין הנץ', digrod: 'חופרת בשריר', escape: 'בורחת מהעץ', fishing: 'דייגית צעירה', football: 'כוכבת הכדורגל', hiddencats: 'עין הבולשת', lionking: 'אריה קטן', magic: 'קוסמת קלפים', magic2: 'קוסמת חתולים', minesweeper: 'גננית חתולים', pacman: 'טיגריס רעב', runner: 'רצה בסוואנה', runner3d: 'רצה ב-3D', soya: 'חברה של סויה', soyahome: 'בית של סויה', streetcats: 'חתולת שכונה', thunderkittens: 'לוחמת ברק', towerdefense: 'שומרת המאורה', bowling: 'כוכבת באולינג', tictactoe: 'מלכת איקס עיגול', hole: 'חור רעבתן', fishy: 'דג גדול', kitchen: 'שפית חתולית'};
  var GSF = {bubbles: 'Reine des bulles', cats: 'Maître des paires', checkers: 'Reine des dames', cups: 'Œil de lynx', digrod: 'Super muscles', escape: 'Évadée', fishing: 'Jeune pêcheuse', football: 'Star du foot', hiddencats: 'Détective', lionking: 'Petit lion', magic: 'Magicienne', magic2: 'Magie des chats', minesweeper: 'Jardinière', pacman: 'Tigre affamé', runner: 'Coureuse', runner3d: 'Coureuse 3D', soya: 'Amie de Soya', soyahome: 'Maison de Soya', streetcats: 'Chat du quartier', thunderkittens: 'Guerrière', towerdefense: 'Gardienne', bowling: 'Star du bowling', tictactoe: 'Reine du morpion', hole: 'Gouffre gourmand', fishy: 'Gros poisson', kitchen: 'Cheffe chat'};
  var GSE = {bubbles: 'Bubble Queen', cats: 'Memory Master', checkers: 'Checkers Queen', cups: 'Eagle Eye', digrod: 'Super Muscles', escape: 'Escape Artist', fishing: 'Young Angler', football: 'Football Star', hiddencats: 'Cat Detective', lionking: 'Little Lion', magic: 'Card Magician', magic2: 'Cat Magician', minesweeper: 'Garden Hero', pacman: 'Hungry Tiger', runner: 'Savanna Runner', runner3d: '3D Runner', soya: 'Soya\'s Friend', soyahome: 'Soya\'s Home', streetcats: 'Street Cat', thunderkittens: 'Lightning Fighter', towerdefense: 'Den Guardian', bowling: 'Bowling Star', tictactoe: 'Tic-Tac-Queen', hole: 'Hungry Hole', fishy: 'Big Fish', kitchen: 'Chef Cat'};
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

  /* ---------- text ---------- */
  var TXT = {
    new: {he: 'סטיקר חדש!', fr: 'Nouvel autocollant !', en: 'New sticker!'},
    coins: {he: 'מטבעות', fr: 'pièces', en: 'coins'},
    gift: {he: 'מתנה יומית מחכה!', fr: 'Cadeau du jour !', en: 'Daily gift waiting!'},
    more: {he: 'ועוד {n}…', fr: 'et {n} de plus…', en: 'and {n} more…'}
  };

  /* ---------- core: award ---------- */
  var DEFAULT_COINS = {win: 5, levelClear: 2, combo: 0, score: 0, play: 0, firstPlay: 0};
  function award(o) {
    try {
      if (!S) load();
      if (!o || typeof o !== 'object') return {coins: 0, stickers: []};
      var game = typeof o.game === 'string' && /^[a-z0-9_-]{1,30}$/i.test(o.game) ? o.game : 'misc', ev = String(o.event || 'play'), c = 0;
      var st = S.stats, td = today();
      if (ev === 'play' || ev === 'firstPlay') { st.plays[game] = (st.plays[game] || 0) + 1; }
      else if (ev === 'win') { st.wins[game] = (st.wins[game] || 0) + 1; st.winsTotal++; c = DEFAULT_COINS.win; }
      else if (ev === 'levelClear') { if (isNum(o.level)) st.levelMax = Math.max(st.levelMax, clampInt(o.level, 0, 9999)); c = DEFAULT_COINS.levelClear; if (!st.plays[game]) st.plays[game] = 1; }
      else if (ev === 'star') { var n = clampInt(o.stars, 0, 3); if (n > 0) { st.stars[game] = (st.stars[game] || 0) + n; st.starsTotal += n; c = 2 * n; if (n === 3) { st.perfects++; c += 5; } } }
      else if (ev === 'combo') { if (isNum(o.score)) { var cb = clampInt(o.score, 0, 9999); st.comboMax = Math.max(st.comboMax, cb); if (cb >= 5) c = 1; } }
      else if (ev === 'score') { if (isNum(o.score)) st.best[game] = Math.max(st.best[game] || 0, clampInt(o.score, 0, 1e9)); }
      if (isNum(o.level) && ev !== 'levelClear') st.levelMax = Math.max(st.levelMax, clampInt(o.level, 0, 9999));
      if (isNum(o.coins)) c = clampInt(o.coins, 0, 200);
      // daily cap per game (kid-safe: no endless grinding)
      var key = game + '|' + td, used = st.daily[key] || 0;
      if (c > 0) { c = Math.max(0, Math.min(c, CAP_PER_GAME_DAY - used)); st.daily[key] = used + c; trimDaily(td); }
      if (c > 0) { S.coins += c; S.earned += c; queueCoins(c); }
      var got = checkStickers();
      save();
      return {coins: c, stickers: got};
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
    S.coins += coins; S.earned += coins;
    var more = checkStickers();
    save();
    // the gift reveal is shown by the album itself: drop the gift's own sticker from the queue to avoid double toasts
    if (sticker) S.pend = S.pend.filter(function (p) { return !(p.t === 'sticker' && p.id === sticker); });
    save();
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
  var toastEl = null, flushing = false, styled = false;
  function addStyle() {
    if (styled) return; styled = true;
    var st = document.createElement('style');
    st.textContent = '.ar-toast{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translate(-50%,-140%);z-index:2147482000;pointer-events:none;display:flex;align-items:center;gap:12px;max-width:min(92vw,420px);' +
      'padding:10px 18px 10px 14px;border-radius:26px;background:linear-gradient(135deg,#fff7d6,#ffe1f0);border:3px solid #ffb84d;box-shadow:0 8px 0 #0002,0 10px 24px #0004;color:#5b3b8c;font:800 17px/1.15 Rubik,"Varela Round",Arial,sans-serif;transition:transform .45s cubic-bezier(.2,1.4,.4,1)}' +
      '.ar-toast.on{transform:translate(-50%,0)}.ar-toast .e{font-size:38px;line-height:1;filter:drop-shadow(0 2px 0 #0002)}.ar-toast small{display:block;font-size:13px;font-weight:700;opacity:.8}';
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
      if (flushing || !S.pend.length || !document.body) return false;
      var q = S.pend.slice(), coins = 0, stk = [];
      q.forEach(function (p) { if (p.t === 'coins') coins += p.n; else if (STK_BY[p.id]) stk.push(STK_BY[p.id]); });
      S.pend = []; save();
      var items = [];
      stk.slice(0, 3).forEach(function (s) { items.push('<span class="e">' + s.e + '</span><span>' + T(TXT.new) + '<small>' + T(s.n) + '</small></span>'); });
      if (stk.length > 3) items.push('<span class="e">🎁</span><span>' + T(TXT.more).replace('{n}', stk.length - 3) + '</span>');
      if (!items.length && coins >= 3) items.push('<span class="e">💰</span><span>+' + coins + ' ' + T(TXT.coins) + '</span>');
      else if (items.length && coins >= 3) items[0] = items[0].replace('</small>', ' · 💰 +' + coins + '</small>');
      if (!items.length) return false;
      flushing = true; chime();
      (function next(i) { if (i >= items.length) { flushing = false; return; } showToast(items[i], 2300, function () { next(i + 1); }); })(0);
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
    visitAlbum: function () { if (!S) load(); S.stats.albumVisits++; checkStickers(); save(); },
    onChange: function (f) { if (typeof f === 'function') listeners.push(f); },
    _reload: function () { load(); }, _reset: function () { S = fresh(); save(); }
  };
  load();
  // the home page and the album show queued banners on their own
  function auto() { var p = location.pathname.split('/').pop() || 'index.html'; if (p === 'index.html' || p === 'album.html') setTimeout(flush, 900); }
  window.addEventListener('storage', function (e) { if (e.key === KEY) { load(); listeners.forEach(function (f) { try { f(); } catch (x) {} }); } });
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', auto) : auto();
})();

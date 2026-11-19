/* Kids platform – the KID PROFILE (name, age, gender, skill) shared by every page.
   Loaded on every page by playtime.js; index.html and welcome.html also load it directly (loading twice is safe).
   Storage: localStorage 'annabelle-profiles' = {cur:"p1", list:[{id, name, emo, age, gender, kid, skill, sk, ob, role}]}
     age 4..18 · gender "f" | "m" | "x" · kid = random UUID v4 (anonymous id; THE NAME NEVER LEAVES THE DEVICE)
     skill 1..4 overall · sk = {react, memory, math, english, device} each 1..4 · ob = ISO date when onboarding finished
     role (optional) 'adult' = a grown-up of the family (family.html): no age, no onboarding, skill 4 by default; absent = 'kid'
   Old profiles without the new fields stay valid (age unknown, gender "f", skill 2, onboarding offered).
   'annabelle-profdata-_device' = 'n' | 'l' (device-level, written once, the first time this file runs on a device):
     'n' = the device was born on the generic platform (no profile and no play data before) -> nobody is feminine by default here;
     'l' = a legacy device (it had a profile or play data from the time every text was feminine) -> a profile without a gender stays "f".
   API (window.KidApp):
     kid() -> {id,name,emo,age,gender,kid,skill,sk,ob,role}      g(f, m, x) -> string for the kid's gender
     he(text) -> Hebrew text written in the feminine, turned masculine / neutral for the kid (word table, used by shared modules)
     gt(text) -> the same for a text in any of the three languages (rewards.js / pwa.js / album use it)
     save(patch)   needsOnboarding()   level(subject)   applySkill() -> [keys written]   hasLegacy()   bornGeneric() -> bool
     newProfile(fields) -> id | null   brand(lang?)   title(lang?)   lang()   cleanName(s)   onChange(fn)
   telemetry.js adds KidApp.track / audit / report later: always call them as  KidApp.track && KidApp.track(...). */
(function () {
  'use strict';
  var K = window.KidApp = window.KidApp || {};
  if (K._kid) return;
  K._kid = 1;
  var MK = 'annabelle-profiles', DK = 'annabelle-profdata-';
  // device-level keys: never part of a profile snapshot (same list as album.html)
  var KEEP = /^annabelle-(lang|muted|music|turn|desk|installed|pwa.*|playtime.*|parent|profiles|profdata-.*|device|tq|telemetry|family.*)$/;
  var SUBJ = ['react', 'memory', 'math', 'english', 'device'];
  var listeners = [];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function int(x, lo, hi) { x = Math.round(+x); return isFinite(x) && x >= lo && x <= hi ? x : null; }
  function lang() { var l = lsGet('annabelle-lang'); return l === 'fr' || l === 'en' ? l : 'he'; }
  function uuid() {
    var b = new Uint8Array(16), i, h = '';
    try { crypto.getRandomValues(b); } catch (e) { for (i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    for (i = 0; i < 16; i++) { h += (b[i] < 16 ? '0' : '') + b[i].toString(16); if (i === 3 || i === 5 || i === 7 || i === 9) h += '-'; }
    return h;
  }
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  // same cleaning as rewards.js cleanName: no control / zero-width / bidi-override characters, no markup characters, max 14
  function cleanName(n) {
    n = String(n == null ? '' : n).replace(/[\u0000-\u0008\u000E-\u001F\u007F-\u009F­͏؜ᅟᅠ᠎​‌‎‏‪-‮⁠-⁯ㅤ﻿ﾠ]/g, '')
      .replace(/[<>&"'`\\\/]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14).trim();
    return /[^ ‍︎️]/.test(n) ? n : '';
  }
  function cleanEmo(e) { e = typeof e === 'string' ? e.replace(/[\u0000-\u007F<>&"'`]/g, '').slice(0, 8) : ''; return e || '🐱'; }

  /* ---------- the profile map ---------- */
  function readMeta() {
    var m = null;
    try { m = JSON.parse(lsGet(MK) || 'null'); } catch (e) { m = null; }
    if (!m || typeof m !== 'object' || !Array.isArray(m.list)) return null;
    m.list = m.list.filter(function (p) { return p && typeof p === 'object' && typeof p.id === 'string' && p.id; });
    if (!m.list.length) return null;
    if (!m.list.some(function (p) { return p.id === m.cur; })) return null; // album.html rebuilds such a map: do not touch it here
    return m;
  }
  function writeMeta(m) { return lsSet(MK, JSON.stringify(m)); }
  function curOf(m) { return m.list.filter(function (p) { return p.id === m.cur; })[0]; }
  function hasLegacy() {
    try {
      var r = JSON.parse(lsGet('annabelle-rewards') || 'null');
      if (!r || typeof r !== 'object') return false;
      if (+r.coins > 0 || +r.earned > 0) return true;
      var pl = r.stats && r.stats.plays;
      if (pl && typeof pl === 'object') for (var g in pl) if (+pl[g] > 0) return true;
    } catch (e) {}
    return false;
  }
  /* ---------- legacy device or a device born on the generic platform? ----------
     Decided ONCE, the first time this file runs on a device, before the page and rewards.js write anything, and never changed afterwards:
     a visitor with empty storage who opens a game directly must stay neutral after the first play is recorded (hasLegacy() turns true then),
     while a device that already had play data or a real profile keeps the feminine default of the legacy texts.
     The key name matches the device-level KEEP lists of every module (like 'annabelle-profdata-_family'), so a profile switch or a reset keeps it. */
  var GK = DK + '_device';
  var BORN = (function () {
    var v = lsGet(GK);
    if (v === 'n' || v === 'l') return v === 'n';
    var fresh = !hasLegacy();
    if (fresh) { // any game save or collection of the old site = legacy as well
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if ((/^annabelle-/.test(k) || /^soya-/.test(k)) && !KEEP.test(k)) { fresh = false; break; } } } catch (e) {}
    }
    if (fresh) { // a profile map is "nothing yet" only when it holds the single anonymous player this file creates itself
      var raw = lsGet(MK), m = readMeta(), p = m && m.list.length === 1 ? m.list[0] : null;
      if (raw !== null && !(p && !(typeof p.name === 'string' && p.name) && !p.ob && !p.gender && !p.role && p.age == null)) fresh = false;
    }
    lsSet(GK, fresh ? 'n' : 'l');
    return fresh;
  })();
  function agePrior(age) { return age == null ? 2 : age <= 5 ? 1 : age <= 9 ? 2 : 3; }
  function view(p, bare) {
    p = p || {};
    var age = int(p.age, 4, 18), sk = {}, raw = p.sk && typeof p.sk === 'object' ? p.sk : {};
    var adult = p.role === 'adult', skill = int(p.skill, 1, 4) || (adult ? 4 : 2);
    SUBJ.forEach(function (s) { var v = int(raw[s], 1, 4); if (v) sk[s] = v; });
    return {
      id: typeof p.id === 'string' ? p.id : 'p1', role: adult ? 'adult' : 'kid',
      name: typeof p.name === 'string' ? cleanName(p.name) : '',
      emo: cleanEmo(p.emo), age: adult ? null : age,
      // an old profile of a LEGACY device is feminine, as every legacy text was; somebody who never had a profile, and everybody
      // on a device born on the generic platform, is addressed neutrally until a gender is chosen
      gender: p.gender === 'f' || p.gender === 'm' || p.gender === 'x' ? p.gender : (bare || adult || BORN ? 'x' : 'f'),
      kid: typeof p.kid === 'string' && UUID.test(p.kid) ? p.kid : '',
      skill: skill, sk: sk, ob: typeof p.ob === 'string' ? p.ob.slice(0, 30) : ''
    };
  }
  var memKid = '';
  function kid() {
    var m = readMeta(), p = m ? curOf(m) : null, v = view(p, !(p && typeof p.name === 'string' && p.name) && !hasLegacy());
    if (!v.kid) { // the anonymous id is created once and kept with the profile
      if (!memKid) memKid = uuid();
      v.kid = memKid;
      if (p) { p.kid = v.kid; writeMeta(m); }
      else if (!lsGet(MK)) writeMeta({cur: 'p1', list: [{id: 'p1', name: '', emo: '🐱', kid: v.kid}]});
    }
    return v;
  }
  function norm(patch, into) {
    var o = into || {};
    if (!patch || typeof patch !== 'object') return o;
    if ('name' in patch) o.name = cleanName(patch.name);
    if ('emo' in patch) o.emo = cleanEmo(patch.emo);
    if ('age' in patch) { var a = int(patch.age, 4, 18); if (a) o.age = a; else delete o.age; }
    if ('gender' in patch && /^[fmx]$/.test(patch.gender)) o.gender = patch.gender;
    if ('skill' in patch) { var s = int(patch.skill, 1, 4); if (s) o.skill = s; }
    if ('sk' in patch && patch.sk && typeof patch.sk === 'object') {
      var sk = {}; SUBJ.forEach(function (k) { var v = int(patch.sk[k], 1, 4); if (v) sk[k] = v; });
      o.sk = sk;
    }
    if ('role' in patch) { if (patch.role === 'adult') { o.role = 'adult'; delete o.age; } else delete o.role; }
    if ('ob' in patch) { if (typeof patch.ob === 'string' && patch.ob) o.ob = patch.ob.slice(0, 30); else delete o.ob; }
    return o;
  }
  function fire() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }
  function save(patch) {
    var m = readMeta();
    if (!m) { var id0 = kid().kid; m = readMeta() || {cur: 'p1', list: [{id: 'p1', name: '', emo: '🐱', kid: id0}]}; }
    var p = curOf(m);
    norm(patch, p);
    if (!p.kid || !UUID.test(p.kid)) p.kid = memKid || (memKid = uuid());
    var ok = writeMeta(m);
    fire();
    return ok;
  }
  function needsOnboarding() { var m = readMeta(), p = m ? curOf(m) : null; return !(p && (p.role === 'adult' || (typeof p.ob === 'string' && p.ob))); }
  function level(subject) {
    var k = kid(), v;
    if (!subject) return k.skill;
    if (subject === 'motor') { v = Math.round(((k.sk.react || k.skill) + (k.sk.device || k.skill)) / 2); return Math.max(1, Math.min(4, v)); }
    if (subject === 'science') { v = Math.round(((k.sk.math || k.skill) + (k.sk.memory || k.skill)) / 2); return Math.max(1, Math.min(4, v)); }
    return k.sk[subject] || k.skill;
  }

  /* ---------- gender ---------- */
  function g(f, m, x) {
    var G = kid().gender;
    if (G === 'f') return f;
    if (G === 'm') return m;
    if (x != null) return x;
    f = String(f); m = String(m);
    if (f === m) return f;
    if (m && f.indexOf(m) === 0) return m + '/' + f.slice(m.length);   // שחק + שחקי -> שחק/י
    return f + '/' + m;
  }
  // feminine -> [masculine, neutral?]  (whole words only; used by he() for the shared texts of rewards.js / pwa.js / game names)
  var HE = {
    'שחקי': ['שחק'], 'נצחי': ['נצח'], 'אספי': ['אסוף', 'לאסוף'], 'סיימי': ['סיים'], 'קבלי': ['קבל'], 'הרוויחי': ['הרוויח'], 'נסי': ['נסה', 'נסו'],
    'פתחי': ['פתח'], 'קני': ['קנה', 'קנו'], 'בקרי': ['בקר'], 'הגיעי': ['הגע', 'להגיע'], 'עשי': ['עשה', 'עשו'], 'השלימי': ['השלם', 'להשלים'], 'מצאי': ['מצא'],
    'לחצי': ['לחץ'], 'הוסיפי': ['הוסף', 'הוסיפו'], 'גללי': ['גלול', 'גללו'], 'בחרי': ['בחר'], 'אשרי': ['אשר'], 'חזרי': ['חזור', 'חזרו'], 'בואי': ['בוא'],
    'שלחי': ['שלח'], 'העתיקי': ['העתק', 'העתיקו'], 'הפתיעי': ['הפתע', 'הפתיעו'], 'שתפי': ['שתף'], 'קבעי': ['קבע'], 'תוכלי': ['תוכל', 'אפשר'],
    'עוברת': ['עובר'], 'מאתגרת': ['מאתגר'], 'אוהבת': ['אוהב'], 'רוצה': ['רוצה', 'רוצים'],
    'חוקרת': ['חוקר'], 'שחקנית': ['שחקן'], 'אלופת': ['אלוף'], 'אלופה': ['אלוף'], 'מלכת': ['מלך'], 'מבקרת': ['מבקר'], 'מושלמת': ['מושלם'],
    'קטנה': ['קטן'], 'גדולה': ['גדול'], 'צעירה': ['צעיר'], 'גורה': ['גור'], 'סקרנית': ['סקרן'], 'חתולת': ['חתול'], 'זריזה': ['זריז'], 'ציידת': ['צייד'],
    'נמרה': ['נמר'], 'לביאה': ['אריה'], 'אמיצה': ['אמיץ'], 'בורחת': ['בורח'], 'זוגית': ['אלוף'], 'חופרת': ['חופר'], 'דייגית': ['דייג'], 'כוכבת': ['כוכב'],
    'לוחמת': ['לוחם'], 'מגלת': ['מגלה'], 'מנצחת': ['מנצח'], 'מצילה': ['מציל'], 'נהגת': ['נהג'], 'פותחת': ['פותח'], 'צלמת': ['צלם'], 'קוסמת': ['קוסם'],
    'רצה': ['רץ'], 'שומרת': ['שומר'], 'שוברת': ['שובר'], 'שפית': ['שף'], 'גננית': ['גנן'], 'חברה': ['חבר', 'חברים'], 'חתולית': ['חתולי'], 'הבולשת': ['הבלש'], 'חקרנית': ['חקרן']
  };
  var HE_RE = null;
  function he(text) {
    text = String(text == null ? '' : text);
    var G = kid().gender;
    if (G === 'f' || !/[א-ת]/.test(text)) return text;
    if (!HE_RE) HE_RE = new RegExp('(^|[^\\u05D0-\\u05EA\\u05F3\\u05F4"\'])(' + Object.keys(HE).sort(function (a, b) { return b.length - a.length; }).join('|') + ')(?![\\u05D0-\\u05EA\\u05F3\\u05F4"\'])', 'g');
    return text.replace(HE_RE, function (all, pre, w) {
      var r = HE[w], m = r[0];
      if (G === 'm') return pre + m;
      if (r[1]) return pre + r[1];
      return pre + (m === w ? w : w.indexOf(m) === 0 ? m + '/' + w.slice(m.length) : m + '/' + w);
    });
  }

  // French / English titles written in the feminine (stickers, ranks): masculine form, and for English a neutral one
  var LAT = {
    fr: {'Petite exploratrice': 'Petit explorateur', 'Grande exploratrice': 'Grand explorateur', 'Super exploratrice': 'Super explorateur', 'Exploratrice': 'Explorateur', 'Chasseuse': 'Chasseur',
      'joueuse': 'joueur', 'Joueuse': 'Joueur', 'Championne': 'Champion', 'Coureuse': 'Coureur', 'Gardienne': 'Gardien', 'Guerrière': 'Guerrier', 'Jardinière': 'Jardinier', 'Jeune pêcheuse': 'Jeune pêcheur',
      'Jeune tigresse': 'Jeune tigre', 'Lionne courageuse': 'Lion courageux', 'Magicienne': 'Magicien', 'Reine': 'Roi', 'Sauveteuse': 'Sauveteur', 'Visiteuse': 'Visiteur', 'Évadée': 'Évadé'},
    en: {'Queen': ['King', 'Champion'], 'queen': ['king', 'champion'], 'Lioness': ['Lion', 'Lion']}
  };
  var LAT_RE = {};
  function lat(text, l, G) {
    var tb = LAT[l];
    if (!tb) return text;
    if (!LAT_RE[l]) LAT_RE[l] = new RegExp('(^|[^A-Za-z\\u00C0-\\u00FF])(' + Object.keys(tb).sort(function (a, b) { return b.length - a.length; }).join('|') + ')(?![A-Za-z\\u00C0-\\u00FF])', 'g');
    return text.replace(LAT_RE[l], function (all, pre, w) { var r = tb[w]; return pre + (typeof r === 'string' ? r : r[G === 'm' ? 0 : 1]); });
  }
  // any shared text (he / fr / en) written for a girl -> the right form for this kid
  function gt(text) {
    text = String(text == null ? '' : text);
    var G = kid().gender;
    if (G === 'f') return text;
    return /[\u05D0-\u05EA]/.test(text) ? he(text) : lat(text, lang(), G);
  }

  /* ---------- brand / titles ---------- */
  var BRAND = {he: 'ארץ המשחקים', fr: 'Le pays des jeux', en: 'Game Land'};
  function brand(l) { return BRAND[l || lang()] || BRAND.he; }
  function title(l) {
    l = l || lang(); var n = kid().name;
    if (!n) return brand(l);
    if (l === 'fr') return 'Les jeux ' + (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(n) ? 'd’' : 'de ') + n;
    if (l === 'en') return n + (/s$/i.test(n) ? '’' : '’s') + ' games';
    return 'המשחקים של ' + n;
  }

  /* ---------- default difficulty from the kid's skill ----------
     Only keys that do not exist yet are written: a difficulty the child (or an earlier run) chose is never touched.
     v = value for skill 1,2,3,4 (null = leave the game's own default); the top tier of a game (expert / pro) is never selected here.
     s: which skill decides – 'motor' (pointer + reaction), 'mind' (memory + overall) or overall.
     json: the game keeps `diff` inside a JSON save 'annabelle-retro-<id>'; every one of them merges a partial object into its defaults
           (checked game by game), so {diff:"normal"} is created only when the save does not exist at all. */
  var DIFF_TABLE = [
    {g: 'football', k: 'annabelle-football-diff', v: ['easy', 'easy', 'normal', 'normal'], s: 'motor'},
    {g: 'thunderkittens', k: 'annabelle-tk-diff', v: ['easy', 'easy', 'normal', 'normal'], s: 'motor'},
    {g: 'bowling', k: 'annabelle-bowling-diff', v: ['easy', 'easy', 'normal', 'normal'], s: 'motor'},
    {g: 'bubbles', k: 'annabelle-bubbles-diff', v: ['easy', 'easy', 'normal', 'normal'], s: 'motor'},
    {g: 'pacman', k: 'annabelle-pacman-diff', v: ['easy', 'easy', 'normal', 'normal'], s: 'motor'},
    {g: 'runner', k: 'annabelle-runner-diff', v: ['easy', 'easy', 'normal', 'normal'], s: 'motor'},      // shared with runner3d
    {g: 'lionking', k: 'annabelle-lion-diff', v: ['easy', 'easy', 'normal', 'hard'], s: 'motor'},
    {g: 'fishing', k: 'annabelle-fishing-diff', v: ['easy', 'easy', 'normal', 'hard'], s: 'motor'},
    {g: 'fishy', k: 'annabelle-fishy-diff', v: ['easy', 'normal', 'normal', 'hard'], s: 'motor'},
    {g: 'hole', k: 'annabelle-hole-diff', v: ['0', '1', '1', '2'], s: 'motor'},
    {g: 'cups', k: 'annabelle-cups-mode', v: ['easy', 'norm', 'norm', 'hard'], s: 'mind'},
    {g: 'tictactoe', k: 'annabelle-ttt-diff', v: ['easy', 'easy', 'norm', 'norm'], s: 'mind'},
    {g: 'towerdefense', k: 'annabelle-td-diff', v: ['easy', 'normal', 'normal', 'hard'], s: 'mind'},
    {g: 'invaders', k: 'annabelle-retro-invaders', json: 1, v: [null, null, 'normal', 'normal'], s: 'motor'},
    {g: 'tetris', k: 'annabelle-retro-tetris', json: 1, v: [null, null, 'normal', 'normal'], s: 'mind'},
    {g: 'breakout', k: 'annabelle-retro-breakout', json: 1, v: [null, null, 'normal', 'normal'], s: 'motor'},
    {g: 'snake', k: 'annabelle-retro-snake', json: 1, v: [null, null, 'normal', 'normal'], s: 'motor'},
    {g: 'crossing', k: 'annabelle-retro-crossing', json: 1, v: [null, null, 'normal', 'normal'], s: 'motor'},
    {g: 'pong', k: 'annabelle-retro-pong', json: 1, v: [null, null, 'normal', 'normal'], s: 'motor'},
    {g: 'safari', k: 'annabelle-retro-safari', json: 1, v: [null, null, 'normal', 'normal'], s: 'motor'},
    {g: 'simon', k: 'annabelle-retro-simon', json: 1, v: [null, null, 'normal', 'normal'], s: 'mind'}
  ];
  function applySkill() {
    var k = kid(), out = [];
    if (!k.ob && k.role !== 'adult') return out; // nothing measured yet: the games keep their own defaults
    var cap = k.age != null && k.age <= 5 ? 2 : 4; // the very youngest never start above "easy / normal"
    DIFF_TABLE.forEach(function (d) {
      var lv = d.s === 'motor' ? level('motor') : d.s === 'mind' ? Math.round(((k.sk.memory || k.skill) + k.skill) / 2) : k.skill;
      lv = Math.max(1, Math.min(cap, lv));
      var v = d.v[lv - 1];
      if (v == null || lsGet(d.k) !== null) return;
      if (lsSet(d.k, d.json ? JSON.stringify({diff: v}) : v)) out.push(d.k);
    });
    return out;
  }

  /* ---------- a new player on this device (same snapshot logic as album.html) ---------- */
  function profKeys() {
    var ks = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if ((/^annabelle-/.test(k) || /^soya-/.test(k)) && !KEEP.test(k)) ks.push(k); } } catch (e) {}
    return ks;
  }
  function newProfile(fields) {
    kid(); // makes sure the current player has a profile entry to come back to
    var m = readMeta();
    if (!m || m.list.length >= 8) return null;
    var snap = {};
    profKeys().forEach(function (k) { snap[k] = lsGet(k); });
    if (!lsSet(DK + m.cur, JSON.stringify(snap))) return null; // no room: keep everything as it is
    profKeys().forEach(lsDel);
    var id = 'p' + Date.now().toString(36), p = norm(fields, {id: id, name: '', emo: '🐱'});
    p.kid = uuid();
    m.list.push(p); m.cur = id;
    writeMeta(m); memKid = '';
    fire();
    return id;
  }
  function canStore() { try { localStorage.setItem('annabelle-kid-t', '1'); localStorage.removeItem('annabelle-kid-t'); return true; } catch (e) { return false; } }

  K.kid = kid; K.g = g; K.he = he; K.gt = gt; K.save = save; K.needsOnboarding = needsOnboarding; K.level = level;
  K.applySkill = applySkill; K.hasLegacy = hasLegacy; K.newProfile = newProfile; K.canStore = canStore;
  K.brand = brand; K.title = title; K.lang = lang; K.cleanName = cleanName; K.agePrior = agePrior;
  K.count = function () { var m = readMeta(); return m ? m.list.length : 1; };
  K.onChange = function (f) { if (typeof f === 'function') listeners.push(f); };
  K.DIFF_TABLE = DIFF_TABLE;
  K.bornGeneric = function () { return BORN; };
})();

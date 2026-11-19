/* Kids games platform – share.js v2: one share button that opens a small share sheet.
   The sheet offers: the phone's own share menu (navigator.share), WhatsApp (wa.me text; the sender picks the contact),
   copy link, a QR code of the link for sharing in person, and "install this game" when the page can be installed (pwa.js).
   Nothing is sent automatically and a shared link never carries the player's name, score or any profile data.

   Shared links are STANDALONE links:  <base>/<game>.html?solo=1&lang=he   (solo mode itself lives in nav.js).

   Tags (all backwards compatible):
     <script src="share.js" data-slot="#langs" defer>            the button is appended to that element (kept in place while the page re-renders)
     <script src="share.js" data-slot="#langs" data-icon="1" defer>   icon only
     <script src="share.js" data-slot=".tools" data-all="1" data-icon="1" defer>   launcher: shares the whole collection (no solo)
     <script src="share.js" defer>                               no slot: attaches by itself next to the home button of nav.js, icon only
     <script src="share.js" data-manual="1" defer>               no button: the page calls AnnabelleShare.open() / .button(el) itself

   API: window.AnnabelleShare = {
     open(opts)        opens the sheet. opts (all optional): page 'x.html' · all:true (the whole site) · title · text (string or {he,fr,en}) ·
                       lang · params {k:v} · from (element that gets the focus back)
     url(page, opts)   the link that would be shared. opts: solo (default true) · lang ('he'|'fr'|'en', false = none; default the sender's language) ·
                       params {k:v} (extra query parameters) · all:true
     button(el, opts)  makes any element open the sheet (click / Enter / Space); returns el
     The game's name in the message comes from catalog.js (loaded on demand: it only reads, and sets <html data-calm>).
     close()  text(opts)  wa(text, url)  qr(text, opts) -> {size, ver, mask, m:[rows of 0/1]}
   }
   Telemetry (anonymous): KidApp.track('share', {how:'native'|'wa'|'copy'|'qr'|'install', page}). */
(function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : null, D = W && W.document;
  var BASE = 'https://lupovichran.github.io/annabelle-games/';
  var LANGS = {he: 1, fr: 1, en: 1};

  /* ================= link builder (pure) ================= */
  function cleanPage(p) { p = String(p == null ? '' : p).split('/').pop().split('?')[0].split('#')[0]; return /^[A-Za-z0-9_-]{1,40}\.html$/.test(p) ? p : ''; }
  function buildUrl(page, o) {
    o = o || {};
    var pg = o.all ? '' : cleanPage(page), q = [], seen = {solo: 1, lang: 1}, k;
    if (pg === 'index.html') pg = '';
    if (pg && o.solo !== false) q.push('solo=1');           // the launcher is never "solo"
    if (pg && o.lang && LANGS[o.lang] === 1) q.push('lang=' + o.lang); // only game pages read it (nav.js)
    if (o.params && typeof o.params === 'object') for (k in o.params) {
      if (!Object.prototype.hasOwnProperty.call(o.params, k) || seen[k] || o.params[k] == null) continue;
      seen[k] = 1; q.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(o.params[k])));
    }
    return (o.base || BASE) + pg + (q.length ? '?' + q.join('&') : '');
  }
  function waHref(text, url) { return 'https://wa.me/?text=' + encodeURIComponent((text ? text + ' ' : '') + url).replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); }); }

  /* ================= QR encoder (byte mode, error correction M, versions 1-10, pure) =================
     Small and self-contained: UTF-8 bytes -> data codewords -> Reed-Solomon blocks -> interleave -> module matrix -> best of the 8 masks. */
  var QR_EC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];      // EC codewords per block (level M), index = version
  var QR_BL = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];                // number of blocks (level M)
  var QR_TOT = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346]; // total codewords
  var QR_AL = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
  var EXP = [], LOG = [];
  (function () { var x = 1, i; for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function gmul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsGen(n) { var g = [1], i, j; for (i = 0; i < n; i++) { g.push(0); for (j = g.length - 1; j > 0; j--) g[j] = g[j - 1] ^ gmul(g[j], EXP[i]); g[0] = gmul(g[0], EXP[i]); } return g; } // lowest degree first
  function rsRem(data, n) {
    var g = rsGen(n), r = [], i, j, f; for (i = 0; i < n; i++) r.push(0);
    for (i = 0; i < data.length; i++) { f = data[i] ^ r[0]; r.shift(); r.push(0); for (j = 0; j < n; j++) r[j] ^= gmul(g[n - 1 - j], f); }
    return r;
  }
  function utf8(s) {
    s = String(s); var o = [], i, c;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { var d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
      if (c < 0x80) o.push(c);
      else if (c < 0x800) o.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) o.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else o.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return o;
  }
  function qrData(v) { return QR_TOT[v] - QR_EC[v] * QR_BL[v]; }
  function qrCodewords(bytes, v) {
    var nd = qrData(v), bits = [], i, k;
    function put(val, n) { for (var b = n - 1; b >= 0; b--) bits.push(val >> b & 1); }
    put(4, 4); put(bytes.length, v < 10 ? 8 : 16);
    for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
    for (i = 0; i < 4 && bits.length < nd * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var cw = []; for (i = 0; i < bits.length; i += 8) { k = 0; for (var b = 0; b < 8; b++) k = k << 1 | bits[i + b]; cw.push(k); }
    for (i = 0; cw.length < nd; i++) cw.push(i % 2 ? 0x11 : 0xec);
    // split into blocks (the longer blocks come last), add EC, interleave
    var nb = QR_BL[v], ec = QR_EC[v], small = Math.floor(nd / nb), nLong = nd % nb, blocks = [], ecs = [], p = 0, len, out = [];
    for (i = 0; i < nb; i++) { len = small + (i >= nb - nLong ? 1 : 0); blocks.push(cw.slice(p, p + len)); ecs.push(rsRem(blocks[i], ec)); p += len; }
    for (k = 0; k <= small; k++) for (i = 0; i < nb; i++) if (k < blocks[i].length) out.push(blocks[i][k]);
    for (k = 0; k < ec; k++) for (i = 0; i < nb; i++) out.push(ecs[i][k]);
    return out;
  }
  function qrMaskFn(m, x, y) { // x = column, y = row
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return x * y % 2 + x * y % 3 === 0;
      case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
      default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
    }
  }
  function qrPenalty(m, n) {
    var p = 0, x, y, run, c, dark = 0, i;
    function line(get) { // rule 1 (runs of 5+) and rule 3 (finder-like 1:1:3:1:1 with 4 light modules on a side)
      for (var a = 0; a < n; a++) {
        run = 1;
        for (var b = 1; b < n; b++) { if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
        for (b = 0; b + 10 < n; b++) {
          var s = ''; for (i = 0; i < 11; i++) s += get(a, b + i);
          if (s === '10111010000' || s === '00001011101') p += 40;
        }
      }
    }
    line(function (a, b) { return m[a][b]; }); line(function (a, b) { return m[b][a]; });
    for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) { c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) dark += m[y][x];
    p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
    return p;
  }
  function qrMatrix(text, o) {
    o = o || {};
    var bytes = utf8(text), v = 0, i, j, x, y;
    for (i = 1; i <= 10; i++) if (bytes.length <= qrData(i) - (i < 10 ? 2 : 3)) { v = i; break; }
    if (!v) return null;                                        // too long for a version-10 code (213 bytes)
    var n = 17 + 4 * v, m = [], fn = [];
    for (y = 0; y < n; y++) { m.push([]); fn.push([]); for (x = 0; x < n; x++) { m[y].push(0); fn[y].push(0); } }
    function set(x, y, d) { m[y][x] = d ? 1 : 0; fn[y][x] = 1; }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var xx = cx + dx, yy = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (xx >= 0 && xx < n && yy >= 0 && yy < n) set(xx, yy, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
    for (i = 8; i < n - 8; i++) { set(i, 6, i % 2 === 0); set(6, i, i % 2 === 0); }
    var al = QR_AL[v];
    for (i = 0; i < al.length; i++) for (j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (y = -2; y <= 2; y++) for (x = -2; x <= 2; x++) set(al[i] + x, al[j] + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
    }
    function format(mask) { // level M = 00
      var data = mask, rem = data, b;
      for (b = 0; b < 10; b++) rem = rem << 1 ^ (rem >> 9) * 0x537;
      var bits = (data << 10 | rem) ^ 0x5412;
      function bit(k) { return bits >> k & 1; }
      for (b = 0; b <= 5; b++) set(8, b, bit(b));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (b = 9; b < 15; b++) set(14 - b, 8, bit(b));
      for (b = 0; b < 8; b++) set(n - 1 - b, 8, bit(b));
      for (b = 8; b < 15; b++) set(8, n - 15 + b, bit(b));
      set(8, n - 8, 1);
    }
    format(0);
    if (v >= 7) {
      var rem = v; for (i = 0; i < 12; i++) rem = rem << 1 ^ (rem >> 11) * 0x1f25;
      var vb = v << 12 | rem;
      for (i = 0; i < 18; i++) { var a = n - 11 + i % 3, b2 = Math.floor(i / 3); set(a, b2, vb >> i & 1); set(b2, a, vb >> i & 1); }
    }
    // data in the zigzag, from the bottom right corner
    var cw = qrCodewords(bytes, v), k = 0, up = true;
    for (var right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < n; vert++) for (j = 0; j < 2; j++) {
        x = right - j; y = up ? n - 1 - vert : vert;
        if (!fn[y][x]) { if (k < cw.length * 8) m[y][x] = cw[k >> 3] >> (7 - (k & 7)) & 1; k++; }
      }
      up = !up;
    }
    function apply(mask) { for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) if (!fn[yy][xx] && qrMaskFn(mask, xx, yy)) m[yy][xx] ^= 1; }
    var best = o.mask >= 0 && o.mask <= 7 ? o.mask | 0 : -1;
    if (best < 0) {
      var bp = Infinity;
      for (i = 0; i < 8; i++) { apply(i); format(i); var pen = qrPenalty(m, n); if (pen < bp) { bp = pen; best = i; } apply(i); }
    }
    apply(best); format(best);
    return {size: n, ver: v, mask: best, m: m};
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = {url: buildUrl, wa: waHref, qr: qrMatrix, cleanPage: cleanPage, BASE: BASE};
  if (!W || !D || W.AnnabelleShare) return;

  /* ================= browser part ================= */
  var me = D.currentScript, DS = (me && me.dataset) || {};
  var PAGE = cleanPage(location.pathname) || 'index.html';
  // the button speaks to the kid (gender through KidApp.g); the message goes to somebody we know nothing about, so it stays neutral
  function G(f, m, x) { var K = W.KidApp; return K && K.g ? K.g(f, m, x) : f; }
  var T = {
    he: {b: function () { return G('שתפי עם חברה', 'שתף עם חבר', 'שיתוף עם חברים'); }, g: 'רוצים לשחק איתי ב{n}? 🐱', a: 'רוצים לשחק איתי בארץ המשחקים? 🎮',
      h: 'שיתוף', nat: 'שיתוף מהטלפון', wa: 'וואטסאפ', copy: 'העתקת הקישור', copied: 'הקישור הועתק ✓', manual: 'אפשר להעתיק את הקישור מכאן', qr: 'קוד QR לסריקה',
      qrHint: 'סורקים עם המצלמה של טלפון אחר', inst: 'התקנת המשחק בטלפון', x: 'סגירה'},
    fr: {b: function () { return 'Partager avec un ami'; }, g: 'Tu viens jouer avec moi à {n} ? 🐱', a: 'Tu viens jouer avec moi au Pays des jeux ? 🎮',
      h: 'Partager', nat: 'Partager depuis le téléphone', wa: 'WhatsApp', copy: 'Copier le lien', copied: 'Lien copié ✓', manual: 'Le lien peut être copié ici', qr: 'Code QR à scanner',
      qrHint: 'À scanner avec l’appareil photo d’un autre téléphone', inst: 'Installer ce jeu sur le téléphone', x: 'Fermer'},
    en: {b: function () { return 'Share with a friend'; }, g: 'Come play {n} with me! 🐱', a: 'Come play with me on Game Land! 🎮',
      h: 'Share', nat: 'Share from this phone', wa: 'WhatsApp', copy: 'Copy link', copied: 'Link copied ✓', manual: 'The link can be copied from here', qr: 'QR code to scan',
      qrHint: 'Scan it with another phone’s camera', inst: 'Install this game on your phone', x: 'Close'}
  };
  /* pages whose audience is not a small kid get their own neutral wording (b = the button, g = the message) */
  var PAGES = {
    'bagrut.html': {
      he: {b: 'שיתוף המסלול', g: 'מתרגלים לבגרות במתמטיקה 5 יח"ל? שווה לנסות:', inst: 'התקנת המסלול בטלפון'},
      fr: {b: 'Partager ce parcours', g: 'En pleine révision du bagrout de maths 5 unités ? Ça vaut le coup d’essayer :', inst: 'Installer ce parcours sur le téléphone'},
      en: {b: 'Share this track', g: 'Practising for the 5-unit maths Bagrut? Worth a try:', inst: 'Install this track on your phone'}
    }
  };
  function lang() { var l = 'he'; try { l = localStorage.getItem('annabelle-lang') || 'he'; } catch (e) {} return T[l] ? l : 'he'; }
  function tx(k, page) { var l = lang(), p = PAGES[page || PAGE]; return (p && p[l] && p[l][k]) || T[l][k]; }
  function str(v) { return typeof v === 'function' ? v() : v; }
  // the game's name: from the catalog (clean, in three languages; catalog.js is fetched once by start() when the page has not loaded it),
  // else the old way (the page's own title)
  function name(page) {
    try { var C = W.GameCatalog, id = String(page || PAGE).replace(/\.html$/, ''); if (C && C.byId && C.byId(id)) { var n = C.name(id, lang()); if (n) return n; } } catch (e) {}
    var h = lang() !== 'he' && D.querySelector('h1'); if (h && h.textContent.trim()) return h.textContent.replace(/\s+/g, ' ').trim();
    var m = D.querySelector('meta[name="apple-mobile-web-app-title"]'); return (m && m.content) || D.title;
  }
  function needCatalog() {
    try {
      if (W.GameCatalog || D.querySelector('script[src$="catalog.js"]')) return;
      var base = me && me.getAttribute('src') ? me.getAttribute('src').replace(/[^\/]*$/, '') : ''; if (/["<>\s]/.test(base)) base = '';
      var sc = el('script'); sc.src = base + 'catalog.js'; sc.async = true; (D.head || D.documentElement).appendChild(sc);
    } catch (e) {}
  }
  function track(how, page) { try { W.KidApp && W.KidApp.track && W.KidApp.track('share', {how: how, page: page || PAGE}); } catch (e) {} }
  function el(tag, cls, txt) { var e = D.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function norm(o) { // one place that turns tag attributes + call options into {page, all, url, text, title}
    o = o || {};
    var all = o.all != null ? !!o.all : !!DS.all && !o.page, page = all ? '' : cleanPage(o.page) || PAGE;
    if (page === 'index.html') { all = true; page = ''; }
    var l = lang(), text = o.text;
    if (text && typeof text === 'object') text = text[l] || text.he || '';
    if (text == null) text = all ? T[l].a : (PAGES[page] && PAGES[page][l] ? PAGES[page][l].g : T[l].g.replace('{n}', o.title || name(page)));
    return {page: page || 'index.html', all: all, text: String(text), title: o.title || (all ? D.title : name(page)),
      url: buildUrl(page, {all: all, solo: o.solo, lang: o.lang === false ? '' : (LANGS[o.lang] === 1 ? o.lang : l), params: o.params})};
  }
  function url(page, o) {
    o = o || {};
    return buildUrl(page == null ? PAGE : page, {all: o.all, solo: o.solo, lang: o.lang === false ? '' : (LANGS[o.lang] === 1 ? o.lang : lang()), params: o.params});
  }

  /* ---------- "install this game": reuse the install handling of pwa.js (its button knows the prompt / the how-to card) ---------- */
  function pwaBtn() {
    try {
      var P = W.AnnabellePWA; if (P && typeof P.can === 'function' && typeof P.install === 'function') return P.can() ? {click: function () { P.install(); }} : null;
      var bs = D.querySelectorAll('.pwa-btn'), i, h;
      for (i = 0; i < bs.length; i++) { h = bs[i].closest('.pwa-launch') || bs[i].closest('.pwa-wrap') || bs[i]; if (h.style.display !== 'none') return bs[i]; }
    } catch (e) {}
    return null;
  }
  function pwaSlot() { // pages whose menu has no install button point pwa.js at this hidden holder: data-slots='[["#an-pwa","append"]]'
    try { if (D.body && !D.getElementById('an-pwa')) { var s = el('span'); s.id = 'an-pwa'; s.hidden = true; s.setAttribute('aria-hidden', 'true'); D.body.appendChild(s); } } catch (e) {}
  }

  /* ---------- copy ---------- */
  function copyText(s) {
    function legacy() {
      try {
        var ta = el('textarea'); ta.value = s; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
        (sheet || D.body).appendChild(ta); ta.select(); ta.setSelectionRange(0, s.length);
        var ok = D.execCommand('copy'); ta.remove(); return !!ok;
      } catch (e) { return false; }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(s).then(function () { return true; }, function () { return legacy(); });
    } catch (e) {}
    return Promise.resolve(legacy());
  }

  /* ---------- QR drawing ---------- */
  function drawQR(cv, text) {
    var q = qrMatrix(text); if (!q) return false;
    var quiet = 4, n = q.size + quiet * 2, sc = Math.max(3, Math.floor(264 / n)), ctx = cv.getContext('2d'), x, y;
    cv.width = cv.height = n * sc; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.fillStyle = '#000';
    for (y = 0; y < q.size; y++) for (x = 0; x < q.size; x++) if (q.m[y][x]) ctx.fillRect((x + quiet) * sc, (y + quiet) * sc, sc, sc);
    return true;
  }

  /* ---------- the sheet ---------- */
  var css = 'a.an-share{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:44px;min-height:44px;box-sizing:border-box;padding:4px 12px;border-radius:999px;border:2px solid #34639f;background:#fff;color:#24456f;' +
    'font:800 15px/1.1 "Rubik","Varela Round",Arial,sans-serif;text-decoration:none;box-shadow:0 3px 0 #0002;white-space:nowrap;cursor:pointer;flex:0 0 auto;-webkit-tap-highlight-color:transparent}a.an-share:active{transform:translateY(2px)}' +
    'a.an-share:focus-visible{outline:3px solid #34639f;outline-offset:3px}' +
    '.ans-bk{position:fixed;inset:0;z-index:2147482900;display:flex;align-items:flex-end;justify-content:center;background:#141a2499;font-family:"Rubik","Varela Round",system-ui,Arial,sans-serif;' +
    'opacity:0;transition:opacity .12s;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.ans-bk.on{opacity:1}' +
    '.ans-sh{box-sizing:border-box;width:100%;max-width:440px;max-height:100%;overflow:auto;background:#f5f2ec;color:#2b3140;border-radius:20px 20px 0 0;padding:16px 16px max(16px,env(safe-area-inset-bottom));' +
    'box-shadow:0 -6px 30px #0006;text-align:start;font-size:17px;font-weight:400;line-height:1.45;-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
    '@media (min-width:620px) and (min-height:520px){.ans-bk{align-items:center;padding:16px;box-sizing:border-box}.ans-sh{border-radius:20px;box-shadow:0 10px 40px #0007}}' +
    '.ans-hd{display:flex;align-items:center;gap:10px;margin:0 0 4px}.ans-hd h2{flex:1;min-width:0;margin:0;font-size:20px;font-weight:800;line-height:1.25;color:#2b3140;text-shadow:none}' +
    '.ans-x{flex:none;width:44px;height:44px;border-radius:50%;border:2px solid #d9d4c8;background:#fff;color:#2b3140;font-family:inherit;font-size:18px;font-weight:700;line-height:1;cursor:pointer;padding:0;margin:0}' +
    '.ans-u{margin:0 0 12px;font-size:14px;color:#5a6272;direction:ltr;text-align:left;overflow-wrap:anywhere;user-select:all;-webkit-user-select:all}' +
    '.ans-ls{display:flex;flex-direction:column;gap:10px}' +
    '.ans-b{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;min-height:52px;margin:0;padding:8px 16px;border-radius:14px;border:2px solid #d9d4c8;background:#fff;color:#2b3140;' +
    'font-family:inherit;font-size:17px;font-weight:700;line-height:1.25;letter-spacing:normal;text-transform:none;text-decoration:none;text-align:start;cursor:pointer;box-shadow:none;text-shadow:none}' +
    '.ans-b .i{flex:none;width:28px;text-align:center;font-size:22px;line-height:1}.ans-b .t{flex:1;min-width:0}' +
    '.ans-b.p{background:#34639f;border-color:#34639f;color:#fff}.ans-b.ok{border-color:#2c6e52;color:#2c6e52}' +
    '.ans-b:focus-visible,.ans-x:focus-visible{outline:3px solid #34639f;outline-offset:3px}.ans-b.p:focus-visible{outline-color:#2b3140}' +
    '.ans-q{margin:12px 0 0;text-align:center}.ans-q canvas{display:block;margin:0 auto;width:min(264px,70vw);height:auto;background:#fff;border-radius:12px;image-rendering:pixelated}' +
    '.ans-q p{margin:8px 0 0;font-size:14px;color:#5a6272}.ans-q[hidden],.ans-m[hidden]{display:none}' +
    '.ans-m{margin:10px 0 0;font-size:14px;color:#5a6272}.ans-m input{display:block;box-sizing:border-box;width:100%;min-height:44px;margin-top:6px;padding:6px 10px;border:2px solid #d9d4c8;border-radius:10px;background:#fff;color:#2b3140;font:14px/1.2 monospace;direction:ltr}' +
    '.ans-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    '@media (prefers-reduced-motion:reduce){.ans-bk{transition:none}}';
  var styled = false;
  function style() { if (styled) return; styled = true; var st = el('style'); st.textContent = css; (D.head || D.documentElement).appendChild(st); }

  var back = null, sheet = null, opener = null;
  function close() {
    if (!back) return;
    var b = back, o = opener; back = sheet = opener = null;
    W.removeEventListener('keydown', onKey, true);
    b.remove();
    try { if (o && o.isConnected && o.focus) o.focus({preventScroll: true}); } catch (e) {}
  }
  function focusables() { return sheet ? Array.prototype.filter.call(sheet.querySelectorAll('button,a[href],input'), function (e) { return !e.hidden && e.offsetParent !== null; }) : []; }
  function onKey(e) {
    if (!back) return;
    e.stopPropagation();                                       // the game underneath never sees keys while the sheet is open
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      var f = focusables(); if (!f.length) return;
      var a = D.activeElement, first = f[0], last = f[f.length - 1], inside = sheet.contains(a);
      if (e.shiftKey && (a === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !inside)) { e.preventDefault(); first.focus(); }
    }
  }
  function row(tag, icon, label, primary) {
    var b = el(tag, 'ans-b' + (primary ? ' p' : '')); if (tag === 'button') b.type = 'button';
    var i = el('span', 'i', icon); i.setAttribute('aria-hidden', 'true'); b.appendChild(i); b.appendChild(el('span', 't', label));
    return b;
  }
  function open(o) {
    try {
      o = o || {};
      if (!D.body) return false;
      close(); style();
      var s = norm(o), l = lang(), t = T[l], canNative = false;
      try { canNative = typeof navigator.share === 'function'; } catch (e) {}
      opener = o.from && o.from.nodeType === 1 ? o.from : D.activeElement;
      back = el('div', 'ans-bk'); back.dir = l === 'he' ? 'rtl' : 'ltr'; back.lang = l;
      sheet = el('div', 'ans-sh'); sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'ans-h');
      var hd = el('div', 'ans-hd'), h = el('h2', null, t.h + (s.all ? '' : ' · ' + s.title)); h.id = 'ans-h';
      var x = el('button', 'ans-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', t.x); x.title = t.x; x.addEventListener('click', close);
      hd.appendChild(h); hd.appendChild(x); sheet.appendChild(hd);
      sheet.appendChild(el('p', 'ans-u', s.url));
      var ls = el('div', 'ans-ls'), live = el('span', 'ans-sr'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');

      if (canNative) {
        var nb = row('button', '📤', t.nat, true); nb.dataset.how = 'native';
        nb.addEventListener('click', function () {
          track('native', s.page);
          try { var pr = navigator.share({title: s.title, text: s.text, url: s.url}); if (pr && pr.then) pr.then(close, function () {}); } catch (e) {}
        });
        ls.appendChild(nb);
      }
      var wa = row('a', '💬', t.wa, !canNative); wa.dataset.how = 'wa'; wa.href = waHref(s.text, s.url); wa.target = '_blank'; wa.rel = 'noopener';
      wa.addEventListener('click', function () { track('wa', s.page); });
      ls.appendChild(wa);

      var manual = el('div', 'ans-m'); manual.hidden = true;
      var cp = row('button', '🔗', t.copy); cp.dataset.how = 'copy';
      cp.addEventListener('click', function () {
        track('copy', s.page);
        copyText(s.url).then(function (ok) {
          if (!back) return;
          if (ok) { cp.classList.add('ok'); cp.querySelector('.t').textContent = t.copied; cp.querySelector('.i').textContent = '✅'; live.textContent = t.copied; }
          else { // no clipboard at all: show the link in a field that is already selected
            manual.hidden = false; var inp = manual.querySelector('input'); try { inp.focus(); inp.select(); } catch (e) {}
          }
        });
      });
      ls.appendChild(cp);
      manual.appendChild(el('span', null, t.manual)); var inp = el('input'); inp.type = 'text'; inp.readOnly = true; inp.value = s.url; inp.setAttribute('aria-label', t.copy); manual.appendChild(inp);

      var qbox = el('div', 'ans-q'); qbox.hidden = true; qbox.id = 'ans-q';
      var qb = row('button', '🔳', t.qr); qb.dataset.how = 'qr'; qb.setAttribute('aria-expanded', 'false'); qb.setAttribute('aria-controls', 'ans-q');
      qb.addEventListener('click', function () {
        if (!qbox.hidden) { qbox.hidden = true; qb.setAttribute('aria-expanded', 'false'); return; }
        if (!qbox.firstChild) {
          var cv = el('canvas'); cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', t.qr); cv.dataset.url = s.url;
          if (!drawQR(cv, s.url)) return;
          qbox.appendChild(cv); qbox.appendChild(el('p', null, t.qrHint));
        }
        qbox.hidden = false; qb.setAttribute('aria-expanded', 'true'); track('qr', s.page);
        try { qbox.scrollIntoView({block: 'nearest'}); } catch (e) {}
      });
      if (qrMatrix(s.url)) ls.appendChild(qb);

      var pb = !s.all && s.page === PAGE ? pwaBtn() : null;
      if (pb) {
        var ib = row('button', '📲', tx('inst', s.page)); ib.dataset.how = 'install';
        ib.addEventListener('click', function () { track('install', s.page); close(); try { pb.click(); } catch (e) {} });
        ls.appendChild(ib);
      }
      sheet.appendChild(ls); sheet.appendChild(manual); sheet.appendChild(qbox); sheet.appendChild(live);
      back.appendChild(sheet);
      back.addEventListener('click', function (e) { if (e.target === back) close(); });
      ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'wheel'].forEach(function (ev) { back.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); });
      D.body.appendChild(back); void back.offsetWidth; back.classList.add('on');
      W.addEventListener('keydown', onKey, true);
      try { (ls.firstChild || x).focus({preventScroll: true}); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  /* ---------- the button ---------- */
  function button(node, o) {
    if (!node || node.nodeType !== 1 || node.__anShare) return node;
    node.__anShare = 1; node.setAttribute('data-share', '1');
    if (node.tagName !== 'BUTTON' && node.tagName !== 'A') { node.setAttribute('role', 'button'); if (!node.hasAttribute('tabindex')) node.tabIndex = 0; }
    if (!node.hasAttribute('aria-haspopup')) node.setAttribute('aria-haspopup', 'dialog');
    function go(e) { if (e) { e.preventDefault(); e.stopPropagation(); } var p = {}, k; if (o) for (k in o) p[k] = o[k]; p.from = node; open(p); }
    node.addEventListener('click', go);
    node.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Spacebar' || (e.key === 'Enter' && node.tagName !== 'BUTTON' && node.tagName !== 'A')) go(e); else if (e.key === 'Enter') e.stopPropagation(); });
    ['pointerdown', 'touchstart', 'mousedown'].forEach(function (ev) { node.addEventListener(ev, function (e) { e.stopPropagation(); }, {passive: true}); });
    return node;
  }
  var a = null, auto = !DS.slot && !DS.manual, iconOnly = !!DS.icon || auto;
  function target() {
    if (DS.slot) return {el: D.querySelector(DS.slot)};
    if (!auto) return null;
    var hs = D.querySelectorAll('.an-nav[data-kind="home"]'), i;                // nav.js home button of the menu (not the one of a pause card)
    for (i = 0; i < hs.length; i++) if (!hs[i].closest('.an-navrow') && hs[i].parentNode) return {el: hs[i].parentNode, after: hs[i]};
    return null;
  }
  function place() {
    pwaSlot();
    var tg = target(); if (!tg || !tg.el) return;
    if (!a) { a = el('a', 'an-share'); a.setAttribute('role', 'button'); button(a); }
    if (!a.isConnected || a.parentNode !== tg.el) { if (tg.after && tg.after.parentNode === tg.el) tg.after.insertAdjacentElement('afterend', a); else tg.el.appendChild(a); }
    var s = str(tx('b')), h = url(DS.all ? '' : PAGE, {all: !!DS.all});
    if (a.getAttribute('href') !== h) a.href = h;                                 // a real link too: long-press / right-click still gives the address
    var lbl = iconOnly ? '📤' : '📤 ' + s; if (a.title !== s) a.title = s;
    if (a.textContent !== lbl) { a.textContent = lbl; a.setAttribute('aria-label', s); }
  }
  function start() { style(); needCatalog(); place(); setInterval(place, 1000); }

  W.AnnabelleShare = {open: open, close: close, url: url, button: button, text: function (o) { return norm(o).text; }, wa: waHref, qr: qrMatrix, BASE: BASE};
  D.readyState === 'loading' ? D.addEventListener('DOMContentLoaded', start) : start();
})();

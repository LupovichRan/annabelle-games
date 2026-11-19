#!/usr/bin/env node
/* tools/gameinfo.js – builds  gameinfo.js  (the "about this game" data of the Game Shop). DEV TOOL: the site never loads this file.

   gameinfo.js = FACTS from git + WORDS from a hand-written file:
     facts   for every available game of catalog.js, read with `git log --follow --date=short -- <id>.html` (read-only):
               created = date of the first commit of the file         updated = date of the last one
               ver     = "1.N", N = number of commits that touched the file, minus 1 (the first commit is 1.0)
               shots   = how many pictures  shots/<id>-1.webp .. -3.webp  exist (made by tools/shots.js)
     words   tools/gameinfo-text.json: the summary, the kid-readable change log, and the credits (who asked, who gave ideas).
             It starts with instructions for the owner. This tool only READS it, so the wording is never lost.

   Run from the repo root, after a commit that changed a game, after new pictures, or after editing the text file:
       node tools/gameinfo.js            rebuild gameinfo.js (and tools/gameinfo-git.json, the raw commit subjects, for reference)
       node tools/gameinfo.js --check    change nothing; exit 1 when gameinfo.js is out of date or something is missing
       node tools/gameinfo.js --raw snake   print the raw commit subjects of one game (to write its log lines from)
   The tool warns when a game has a commit that is newer than its newest log line: add a line for it to gameinfo-text.json
   (your own faithful, friendly wording of the commit subject – only what concerns that game, no invented features) and run again.

   Shape of the result (store.html loads it lazily, after first paint):
     window.GameInfo = {v:1, people:{key:{n:{he,fr,en}, role:{he,fr,en}}}, made:{he,fr,en},
       byId:{<id>:{created:'YYYY-MM-DD', updated:'YYYY-MM-DD', ver:'1.N', shots:n, sum:{he,fr,en},
                   log:[{d:'YYYY-MM-DD', v:'1.N', t:{he,fr,en}}, ...]   newest first, at most 8
                   asked:{by:[person keys]}, ideas:[{by:person key, t?:{he,fr,en}}]}}}
   (inside the file, sentences shared by many games are stored once and expanded when the file loads). */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..'), TEXT = path.join(__dirname, 'gameinfo-text.json'), OUT = path.join(ROOT, 'gameinfo.js'), RAWOUT = path.join(__dirname, 'gameinfo-git.json');
const LANGS = ['he', 'fr', 'en'], MAXLOG = 8, MAXSHOTS = 3;
const args = process.argv.slice(2), CHECK = args[0] === '--check';
let warns = 0, errors = 0;
const warn = m => { warns++; console.log('  warn  ' + m); }, err = m => { errors++; console.log('  ERROR ' + m); };

function catalog() {
  const W = {localStorage: {getItem: () => null, setItem: () => {}}, addEventListener: () => {}}, D = {documentElement: {setAttribute: () => {}}};
  new Function('window', 'document', fs.readFileSync(path.join(ROOT, 'catalog.js'), 'utf8'))(W, D);
  return W.GameCatalog.list.filter(g => W.GameCatalog.available(g.id));
}
function history(file) { // oldest first: [{d, s}]
  const out = cp.execFileSync('git', ['log', '--follow', '--format=%ad|%s', '--date=short', '--', file], {cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24});
  return out.split('\n').filter(Boolean).map(l => { const i = l.indexOf('|'); return {d: l.slice(0, i), s: l.slice(i + 1)}; }).reverse();
}
const tri = (o, where) => { const r = {}; LANGS.forEach(l => { if (!o || typeof o[l] !== 'string' || !o[l].trim()) err(where + ': missing "' + l + '"'); r[l] = o && typeof o[l] === 'string' ? o[l].trim() : ''; }); return r; };

const games = catalog();
if (args[0] === '--raw') { const id = args[1]; history(id + '.html').reverse().forEach((c, i, a) => console.log('1.' + (a.length - 1 - i) + '  ' + c.d + '  ' + c.s)); process.exit(0); }
const text = JSON.parse(fs.readFileSync(TEXT, 'utf8'));
const people = {}, strings = [], sIndex = new Map();
const S = t => { const k = JSON.stringify(t); if (!sIndex.has(k)) { sIndex.set(k, strings.length); strings.push(t); } return sIndex.get(k); };
Object.keys(text.people || {}).forEach(k => { if (!/^[a-z0-9]{1,20}$/.test(k)) err('people: bad key "' + k + '"'); const p = text.people[k]; people[k] = {n: tri(p, 'people.' + k), role: tri(p.role, 'people.' + k + '.role')}; });
const common = {}; Object.keys(text.common || {}).forEach(k => { common[k] = tri(text.common[k], 'common.' + k); });
const byId = {}, raw = {};
games.forEach(g => {
  const id = g.id, h = history(g.file), tx = (text.games || {})[id];
  raw[id] = h;
  if (!h.length) { err(id + ': ' + g.file + ' has no commit yet (commit the page first)'); return; }
  if (!tx) { err(id + ': no entry in gameinfo-text.json'); return; }
  const verAt = n => '1.' + n, lastOn = d => { let n = -1; h.forEach((c, i) => { if (c.d === d) n = i; }); return n; };
  const log = [];
  (tx.log || []).forEach((e, i) => {
    const where = id + '.log[' + i + ']';
    let n = typeof e.n === 'number' ? e.n : lastOn(e.d);
    if (n < 0 || !h[n]) { err(where + ': no commit of ' + g.file + ' on ' + e.d); return; }
    if (h[n].d !== e.d) { err(where + ': commit ' + n + ' is dated ' + h[n].d + ', not ' + e.d); return; }
    const t = e.c ? common[e.c] : tri(e.t, where);
    if (!t) { err(where + ': unknown common sentence "' + e.c + '"'); return; }
    log.push({d: e.d, n: n, t: t});
  });
  for (let i = 1; i < log.length; i++) if (log[i].n > log[i - 1].n) err(id + '.log: not newest first (line ' + i + ')');
  if (log.length > MAXLOG) err(id + '.log: ' + log.length + ' lines (max ' + MAXLOG + ')');
  if (!log.length) err(id + ': empty log');
  const newest = log.length ? log[0].n : -1;
  if (newest < h.length - 1) warn(id + ': ' + (h.length - 1 - newest) + ' commit(s) newer than the newest log line – add a line to gameinfo-text.json:\n' + h.slice(newest + 1).map(c => '          ' + c.d + '  ' + c.s).join('\n'));
  let shots = 0; for (let n = 1; n <= MAXSHOTS; n++) { if (fs.existsSync(path.join(ROOT, 'shots', id + '-' + n + '.webp'))) shots = n; else break; }
  if (shots < MAXSHOTS) warn(id + ': only ' + shots + ' picture(s) in shots/ – run  node tools/shots.js ' + id);
  if (shots && !fs.existsSync(path.join(ROOT, 'shots', id + '-1t.webp'))) warn(id + ': the thumbnail shots/' + id + '-1t.webp is missing');
  const who = k => { if (!people[k]) err(id + ': unknown person "' + k + '" (add it to "people")'); return k; };
  byId[id] = {created: h[0].d, updated: h[h.length - 1].d, ver: verAt(h.length - 1), shots: shots, sum: S(tri(tx.sum, id + '.sum')),
    log: log.map(e => ({d: e.d, v: verAt(e.n), t: S(e.t)})),
    asked: {by: (tx.asked || []).map(who)},
    ideas: (tx.ideas || []).map((x, i) => { const o = {by: who(x.by)}; if (x.t) o.t = S(tri(x.t, id + '.ideas[' + i + ']')); return o; })};
});
Object.keys(text.games || {}).forEach(id => { if (!games.some(g => g.id === id)) warn('gameinfo-text.json has "' + id + '", which is not an available game of catalog.js (kept out of gameinfo.js)'); });
const made = tri(text.made, 'made');

const js = '/* gameinfo.js – GENERATED by  node tools/gameinfo.js  – do not edit by hand.\n' +
  '   Facts (dates, version, pictures) come from git and shots/; the words come from tools/gameinfo-text.json (edit THAT file).\n' +
  '   Loaded only by store.html, lazily. window.GameInfo = {v, people, made, byId:{id:{created, updated, ver, shots, sum, log:[{d, v, t}], asked:{by}, ideas:[{by, t?}]}}} */\n' +
  '(function(){var S=' + JSON.stringify(strings) + ';\nvar G=' + JSON.stringify({v: 1, people: people, made: made, byId: byId}).replace(/("[a-z0-9]+":\{"created")/g, '\n$1') + ';\n' +
  'function x(i){return typeof i===\'number\'?S[i]:i}\n' +
  'Object.keys(G.byId).forEach(function(k){var g=G.byId[k];g.sum=x(g.sum);g.log.forEach(function(e){e.t=x(e.t)});g.ideas.forEach(function(e){if(e.t!=null)e.t=x(e.t)})});\n' +
  'window.GameInfo=G})();\n';
const rawJs = JSON.stringify(raw, null, 1) + '\n';
if (errors) { console.log(errors + ' error(s): gameinfo.js was NOT written'); process.exit(1); }
if (CHECK) {
  const same = fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') === js;
  console.log(same ? 'gameinfo.js is up to date (' + Object.keys(byId).length + ' games, ' + warns + ' warning(s))' : 'gameinfo.js is OUT OF DATE – run  node tools/gameinfo.js');
  process.exit(same ? 0 : 1);
}
fs.writeFileSync(OUT, js); fs.writeFileSync(RAWOUT, rawJs);
console.log('gameinfo.js written: ' + Object.keys(byId).length + ' games, ' + Math.round(js.length / 1024) + ' KB, ' + warns + ' warning(s)');

#!/usr/bin/env node
/* tools/gameinfo-check.js – checks gameinfo.js and shots/ (DEV TOOL, not loaded by the site).   Run:  node tools/gameinfo-check.js
   Every available game of catalog.js must have: a summary and a change log in he / fr / en, created <= updated, a version that matches the
   git history of its page ("1.N", N = commits - 1), valid credits, and its pictures in shots/ within the size budget. */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..'), LANGS = ['he', 'fr', 'en'];
const BIG_MAX = 46 * 1024, BIG_MIN = 8 * 1024, THUMB_MAX = 10 * 1024, TOTAL_MAX = 6 * 1024 * 1024;
let n = 0, fails = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL ' + m); } };
const W = {localStorage: {getItem: () => null, setItem: () => {}}, addEventListener: () => {}}, D = {documentElement: {setAttribute: () => {}}};
new Function('window', 'document', fs.readFileSync(path.join(ROOT, 'catalog.js'), 'utf8'))(W, D);
new Function('window', fs.readFileSync(path.join(ROOT, 'gameinfo.js'), 'utf8'))(W);
const C = W.GameCatalog, G = W.GameInfo, ids = C.list.filter(g => C.available(g.id)).map(g => g.id);
const tri = (o, min, where, he) => { LANGS.forEach(l => ok(o && typeof o[l] === 'string' && o[l].trim().length >= min, where + ' ' + l)); if (o && he !== false) { ok(/[֐-׿]/.test(o.he || ''), where + ' he is Hebrew'); ok(!/[֐-׿]/.test((o.fr || '') + (o.en || '')), where + ' fr/en have no Hebrew'); } };
const DATE = /^\d{4}-\d{2}-\d{2}$/, NAME = /אנאבל|annabelle/i;
ok(G && G.v === 1 && G.byId && G.people, 'GameInfo shape'); tri(G.made, 40, 'made');
['family', 'players', 'omer', 'ai'].forEach(k => { ok(!!G.people[k], 'person ' + k); if (G.people[k]) { tri(G.people[k].n, 3, 'people.' + k + '.n', k !== 'ai'); tri(G.people[k].role, 5, 'people.' + k + '.role'); } });
ok(!NAME.test(JSON.stringify(G)), 'no personal name anywhere in gameinfo.js');
ok(Object.keys(G.byId).every(id => ids.includes(id)), 'no info for hidden games: ' + Object.keys(G.byId).filter(id => !ids.includes(id)));
let total = 0, files = 0;
for (const id of ids) {
  const o = G.byId[id]; ok(!!o, id + ' has gameinfo'); if (!o) continue;
  const h = cp.execFileSync('git', ['log', '--follow', '--format=%ad', '--date=short', '--', id + '.html'], {cwd: ROOT, encoding: 'utf8'}).split('\n').filter(Boolean).reverse();
  ok(DATE.test(o.created) && DATE.test(o.updated) && o.created <= o.updated, id + ' dates ' + o.created + ' <= ' + o.updated);
  ok(o.created === h[0] && o.updated === h[h.length - 1], id + ' dates match git (' + h[0] + ' .. ' + h[h.length - 1] + ')');
  ok(o.ver === '1.' + (h.length - 1), id + ' version ' + o.ver + ' matches the git count (' + h.length + ' commits)');
  tri(o.sum, 60, id + '.sum'); LANGS.forEach(l => { const k = (o.sum[l].match(/[.!?](\s|$)/g) || []).length; ok(k >= 2 && k <= 4 && o.sum[l].length <= 330, id + '.sum ' + l + ': ' + k + ' sentences, ' + o.sum[l].length + ' chars'); });
  ok(Array.isArray(o.log) && o.log.length >= 1 && o.log.length <= 8, id + ' log length ' + (o.log || []).length);
  (o.log || []).forEach((e, i) => { tri(e.t, 8, id + '.log[' + i + ']'); LANGS.forEach(l => ok(e.t[l].length <= 170, id + '.log[' + i + '] ' + l + ' is short (' + e.t[l].length + ')'));
    ok(DATE.test(e.d) && h.includes(e.d), id + '.log[' + i + '] date is a commit date'); const k = +String(e.v).split('.')[1];
    ok(/^1\.\d+$/.test(e.v) && h[k] === e.d, id + '.log[' + i + '] version ' + e.v + ' belongs to ' + e.d);
    if (i) ok(+String(o.log[i - 1].v).split('.')[1] >= k, id + '.log newest first'); });
  if (o.log && o.log.length) { ok(o.log[0].v === o.ver, id + ' newest log line is the current version (' + o.log[0].v + ' vs ' + o.ver + ')'); ok(o.log[o.log.length - 1].d === o.created, id + ' the oldest log line is the birth of the game'); }
  ok(o.asked && Array.isArray(o.asked.by) && o.asked.by.every(k => G.people[k] && k !== 'ai'), id + ' asked');
  ok(Array.isArray(o.ideas) && o.ideas.every(x => G.people[x.by] && x.by !== 'ai' && (x.t === undefined || LANGS.every(l => typeof x.t[l] === 'string' && x.t[l]))), id + ' ideas');
  ok(o.shots === 3, id + ' has 3 pictures (' + o.shots + ')');
  for (let k = 1; k <= o.shots; k++) { const f = path.join(ROOT, 'shots', id + '-' + k + '.webp'), ex = fs.existsSync(f); ok(ex, id + ' picture ' + k + ' exists');
    if (ex) { const b = fs.readFileSync(f), sz = b.length; total += sz; files++; ok(sz <= BIG_MAX && sz >= BIG_MIN, id + '-' + k + '.webp size ' + Math.round(sz / 1024) + ' KB');
      ok(b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP', id + '-' + k + ' is WebP'); } }
  const t = path.join(ROOT, 'shots', id + '-1t.webp'), tex = fs.existsSync(t); ok(tex, id + ' thumbnail exists'); if (tex) { const sz = fs.statSync(t).size; total += sz; files++; ok(sz <= THUMB_MAX, id + ' thumbnail ' + Math.round(sz / 1024) + ' KB'); }
}
const extra = fs.existsSync(path.join(ROOT, 'shots')) ? fs.readdirSync(path.join(ROOT, 'shots')).filter(f => !ids.some(id => new RegExp('^' + id + '-(?:[123]|1t)\\.webp$').test(f))) : [];
ok(!extra.length, 'no stray files in shots/: ' + extra.join(' '));
ok(total <= TOTAL_MAX, 'shots/ total ' + (total / 1048576).toFixed(2) + ' MB <= 6 MB');
const st = fs.readFileSync(path.join(ROOT, 'store.html'), 'utf8');
ok(!/<script[^>]+src="gameinfo\.js"/.test(st) && /sc\.src='gameinfo\.js'/.test(st), 'store.html loads gameinfo.js lazily, not with a script tag');
const others = fs.readdirSync(ROOT).filter(f => /\.(html|js)$/.test(f) && !['store.html', 'gameinfo.js', 'sw.js'].includes(f)).filter(f => /gameinfo\.js/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
ok(!others.length, 'only store.html (and the sw.js cache list) mention gameinfo.js: ' + others.join(' '));
console.log(ids.length + ' games, ' + files + ' picture files, ' + (total / 1048576).toFixed(2) + ' MB; ' + n + ' checks, ' + fails + ' failed');
process.exit(fails ? 1 : 0);

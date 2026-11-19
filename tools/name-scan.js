#!/usr/bin/env node
/* tools/name-scan.js – makes sure the site is generic: the first name the site was built for must not be shown to anybody.
   DEV TOOL: the site never loads this file.

   Run from the repo root:
       node tools/name-scan.js             exit 1 (with the list) when the name appears in a user-visible place
       node tools/name-scan.js --comments  also list the code comments that still mention it (never an error)

   What is scanned: every text file of the repo (.html .js .json .webmanifest .css .svg .txt .xml .md), except docs/, tools/, vendor/,
   shots/, icons/, .git/ and node_modules/.
   User-visible = anything outside code comments: strings, markup text, <title>, <meta>, manifest name / short_name / description.
   Allowed (technical names nobody sees):
     - storage keys, peer ids and manifest ids:  annabelle-xxx   (also inside a regex:  annabelle-(a|b)…, /^annabelle-/, annabelle[-_]…)
     - identifiers:  AnnabelleRewards, AnnabellePlaytime, AnnabelleDesk, AnnabelleShare, AnnabelleSolo, AnnabellePWA and any other  Annabelle<Capital>…
     - the repository / GitHub Pages address:  …/annabelle-games…,  github.com/<owner>/annabelle-games
     - test hooks  window.__annabelleToday / __annabelleNow,  and the fixed prefix  'annabelle|' + salt  of the parent-PIN hash
   Hebrew spellings looked for: אנאבל, אנבל (with any prefix letter).  Latin: annabelle, in any letter case. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'docs', 'tools', 'vendor', 'shots', 'icons']);
const EXT = /\.(html?|js|mjs|json|webmanifest|css|svg|txt|xml|md)$/i;
const SHOW_COMMENTS = process.argv.includes('--comments');

const NAME = /annabelle|אנאבל|אנבל/gi;
// allowed technical forms, tested on the text around a Latin hit (hit = the 9 letters)
function allowed(src, i) {
  const after = src.slice(i + 9, i + 60), before = src.slice(Math.max(0, i - 80), i), word = src.substr(i, 9);
  if (word === 'annabelle' && /^(-|\[-_\]|\\-|_)/.test(after)) return true;            // annabelle-key, annabelle-(a|b), annabelle[-_]x
  if (word === 'annabelle' && /^(\)|\||\/)/.test(after) && /[(|^/]$/.test(before)) return true; // inside a regex alternative: (annabelle|soya)
  if (word === 'Annabelle' && /^[A-Z][A-Za-z]/.test(after) && !/[A-Za-z]$/.test(before)) return true; // AnnabelleRewards…
  if (/^-games/.test(after)) return true;                                               // repo / pages address
  if (word === 'annabelle' && /__$/.test(before) && /^[A-Z]\w*/.test(after)) return true;  // test hooks: window.__annabelleToday / __annabelleNow
  if (word === 'annabelle' && /^\|['"]\s*\+/.test(after) && /['"]$/.test(before)) return true; // 'annabelle|' + salt: prefix of the parent-PIN hash
  if (word === 'annabelle' && /^\|/.test(after) && /\(\?:$/.test(before)) return true;      // regex (?:annabelle|soya)
  return false;
}
// blank out code comments, keeping every offset and line break (strings are respected, so a URL like https://… is not a comment)
function stripComments(src, isHtml) {
  const out = src.split(''), n = src.length, comments = [];
  const blank = (a, b) => { comments.push([a, b]); for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  function js(from, to) {
    let i = from, prev = ''; // prev = last significant char (to tell a regex from a division)
    while (i < to) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 || e > to ? to : e + 2; blank(i, end); i = end; continue; }
      if (c === '/' && d === '/') { let e = src.indexOf('\n', i); if (e < 0 || e > to) e = to; blank(i, e); i = e; continue; }
      if (c === '"' || c === "'" || c === '`') {
        let k = i + 1;
        while (k < to && src[k] !== c) { if (src[k] === '\\') k++; else if (c !== '`' && src[k] === '\n') break; k++; }
        i = k + 1; prev = 'x'; continue;
      }
      if (c === '/' && (prev === '' || /[=(,:;!&|?{}[\n+\-*%<>~^]/.test(prev) || /(?:^|[^\w$.])(?:return|typeof|case|in|of|do|else|void)\s*$/.test(src.slice(Math.max(from, i - 12), i)))) { // a regex literal
        let k = i + 1, cls = false;
        while (k < to && src[k] !== '\n' && (cls || src[k] !== '/')) { if (src[k] === '\\') k++; else if (src[k] === '[') cls = true; else if (src[k] === ']') cls = false; k++; }
        i = k + 1; prev = 'x'; continue;
      }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  if (!isHtml) { js(0, n); return {text: out.join(''), comments}; }
  let i = 0;
  const lower = src.toLowerCase();
  while (i < n) {
    const c1 = src.indexOf('<!--', i), s1 = lower.indexOf('<script', i), y1 = lower.indexOf('<style', i);
    const cands = [c1, s1, y1].filter(x => x >= 0);
    if (!cands.length) break;
    const at = Math.min.apply(null, cands);
    if (at === c1) { const e = src.indexOf('-->', at + 4); const end = e < 0 ? n : e + 3; blank(at, end); i = end; continue; }
    const open = src.indexOf('>', at); if (open < 0) break;
    if (at === s1) { let e = lower.indexOf('</script', open); if (e < 0) e = n; js(open + 1, e); i = e + 9; continue; }
    let e = lower.indexOf('</style', open); if (e < 0) e = n;
    for (let k = open + 1; k < e;) { const a = src.indexOf('/*', k); if (a < 0 || a >= e) break; let b = src.indexOf('*/', a + 2); b = b < 0 || b > e ? e : b + 2; blank(a, b); k = b; }
    i = e + 8;
  }
  return {text: out.join(''), comments};
}
function files(dir, acc) {
  fs.readdirSync(dir, {withFileTypes: true}).forEach(function (e) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) files(path.join(dir, e.name), acc); }
    else if (EXT.test(e.name)) acc.push(path.join(dir, e.name));
  });
  return acc;
}
function where(src, i) { const line = src.lastIndexOf('\n', i - 1); return {ln: src.slice(0, i).split('\n').length, col: i - line}; }
function ctx(src, i, len) { return src.slice(Math.max(0, i - 45), i + len + 45).replace(/\s+/g, ' '); }
function kind(file, src, i) { // a hint for the report
  const rel = path.relative(ROOT, file);
  if (/\.webmanifest$/.test(rel)) { const l = src.slice(src.lastIndexOf('\n', i) + 1, i); const m = l.match(/"(\w+)"\s*:/); return 'manifest ' + (m ? m[1] : 'value'); }
  const before = src.slice(Math.max(0, i - 300), i);
  if (/<title[^>]*>[^<]*$/i.test(before)) return '<title>';
  if (/<meta[^>]*$/i.test(before)) return '<meta>';
  return 'text';
}

const hits = [], inComments = [];
let scanned = 0;
files(ROOT, []).sort().forEach(function (file) {
  const src = fs.readFileSync(file, 'utf8'), rel = path.relative(ROOT, file);
  if (!NAME.test(src)) { NAME.lastIndex = 0; return; }
  NAME.lastIndex = 0; scanned++;
  const isJson = /\.(json|webmanifest)$/i.test(rel), isHtml = /\.html?$/i.test(rel), isCode = isHtml || /\.(js|mjs|css)$/i.test(rel);
  const st = isCode ? (/\.css$/i.test(rel) ? stripComments('<style>' + src + '</style>', true) : stripComments(src, isHtml)) : {text: src, comments: []};
  const text = /\.css$/i.test(rel) ? st.text.slice(7, 7 + src.length) : st.text;
  let m;
  while ((m = NAME.exec(src))) {
    const i = m.index, latin = /^[a-z]/i.test(m[0]);
    if (latin && allowed(src, i)) continue;
    if (isJson && latin && /"id"\s*:\s*"[^"]*$/.test(src.slice(src.lastIndexOf('\n', i) + 1, i))) continue; // manifest id
    const w = where(src, i), row = {file: rel, ln: w.ln, col: w.col, kind: kind(file, src, i), ctx: ctx(src, i, m[0].length)};
    if (text.substr(i, m[0].length) !== m[0]) inComments.push(row); else hits.push(row);
  }
});

if (SHOW_COMMENTS && inComments.length) {
  console.log('Code comments that mention the name (not shown to anybody, not an error): ' + inComments.length);
  inComments.forEach(r => console.log('  ' + r.file + ':' + r.ln + '  ' + r.ctx));
}
if (hits.length) {
  console.log('NAME FOUND in ' + hits.length + ' user-visible place(s):');
  hits.forEach(r => console.log('  ' + r.file + ':' + r.ln + ':' + r.col + '  [' + r.kind + ']  ' + r.ctx));
  console.log('name-scan: FAILED (' + hits.length + ' place(s) in ' + new Set(hits.map(h => h.file)).size + ' file(s))');
  process.exit(1);
}
console.log('name-scan: OK – no user-visible "Annabelle" / "אנאבל" (' + scanned + ' files mention the technical namespace; ' + inComments.length + ' code comment(s) still mention the name' + (SHOW_COMMENTS ? '' : ', list them with --comments') + ')');

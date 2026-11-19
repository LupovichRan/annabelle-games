#!/usr/bin/env node
/* tools/shots.js – takes the Game Shop pictures ("pictures from inside the game"). DEV TOOL: the site never loads this file.

   What it does: opens every game in a headless Chromium at phone size (390x800), really plays it for a moment (taps, keys and the
   page's own test hook window.__<id>), and saves 3 pictures per game + one tiny thumbnail into  shots/ :
       shots/<id>-1.webp .. <id>-3.webp   540 px wide, about 25-45 KB each   (1 = the most typical moment of play, 2 = another level /
                                          mode, 3 = a result, collection or special view)
       shots/<id>-1t.webp                 160 px wide thumbnail of picture 1

   How to run (from the repo root; needs `playwright` with chromium, and python3 with Pillow for the WebP conversion):
       node tools/shots.js                 every available game of catalog.js (pages listed in PENDING are skipped)
       node tools/shots.js snake pong      only these games (use this after changing one game)
       node tools/shots.js --list          print the ids that have a recipe
       node tools/shots.js --convert [ids] only convert the raw PNGs kept in SHOTS_RAW again (no browser)
   Then:  node tools/gameinfo.js           (it counts the pictures per game into gameinfo.js)
   Environment: SHOTS_RAW=<dir> keeps the raw PNGs there (default: a temp folder) · SHOTS_KEEP=1 does not convert (PNG only).

   Privacy: the pictures are taken with a generic profile (name "שחקן"), sound off, the QA flag on (so nothing counts as a real player
   in the statistics) and no network except this folder. The tool warns when a personal name is visible in the page text – LOOK at
   every new picture before publishing it: no child's name may ever appear in the shop.

   Adding a game: add a recipe to R below:  async (p, t) => { ...play...; await t.shot(1); ...; await t.shot(2); ...; await t.shot(3) }
   p = the Playwright page; t = helpers (tap, tapText, wait, ev, key, hook, shot). */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'shots');
const RAW = process.env.SHOTS_RAW || path.join(os.tmpdir(), 'annabelle-shots-raw');
const VW = 390, VH = 800;
const PROFILE = {cur: 'p1', list: [{id: 'p1', name: 'שחקן', emo: '🐱', age: 9, gender: 'x', kid: '00000000-0000-4000-8000-000000000011', skill: 3,
  sk: {react: 3, memory: 3, math: 3, english: 3, device: 3}, ob: '2026-01-01'}]};
const NAME_RE = /אנאבל|annabelle/i;
/* shared chrome that must not be in a picture: report button, play-time badge and toasts, level-up overlay, coin chip, install tip */
const HIDE = '#fb-btn,#fb-dlg,#pt-badge,#pt-toast,#jz-chip,#jz-lv,.jz-p,.ar-toast,.pwa-btn,.pwa-tip,#vibe-bg,canvas.vibe{display:none!important;visibility:hidden!important}';

/* ------------------------------------------------------------------ recipes ------------------------------------------------------------------ */
const R = {};
/* ---- learning ---- */
R.mathquest = async (p, t) => {
  await t.ev(() => __mathquest.start('quest', 0)); await t.wait(900);
  for (let i = 0; i < 3; i++) { await t.ev(() => __mathquest.answer(true)); await t.wait(500); await t.ev(() => { if (__mathquest.state().phase !== 'ask') __mathquest.next(); }); await t.wait(500); }
  await t.shot(1);
  await t.ev(() => __mathquest.ask(__mathquest.newSkills[0], 2, 7, false)); await t.wait(900); await t.shot(2);
  await t.ev(() => __mathquest.start('quest', 0)); await t.wait(600); await t.ev(() => __mathquest.win()); await t.wait(1800); await t.shot(3);
};
R.wordcity = async (p, t) => {
  await t.ev(() => __wordcity.start('city', 0)); await t.wait(1200);
  await t.ev(() => __wordcity.answer(true)); await t.wait(1600); await t.ev(() => __wordcity.next()); await t.wait(900); await t.shot(1);
  for (let i = 0; i < 3; i++) { await t.ev(() => { __wordcity.answer(true); }); await t.wait(1300); await t.ev(() => __wordcity.next()); await t.wait(600); }
  await t.shot(2);
  await t.ev(() => __wordcity.win()); await t.wait(1200); await t.ev(() => { __wordcity.toMenu(); __wordcity.openMap(); }); await t.wait(1500); await t.shot(3);
};
R.sciencelab = async (p, t) => {
  await t.ev(() => __sciencelab.start('circuit', 1, 0)); await t.wait(2200); await t.shot(1);
  await t.ev(() => __sciencelab.menu()); await t.wait(400);
  await t.ev(() => __sciencelab.start('sink', 1, 0)); await t.wait(2200); await t.shot(2);
  await t.ev(() => __sciencelab.menu()); await t.wait(400);
  await t.ev(() => __sciencelab.start('space', 1, 0)); await t.wait(2200); await t.shot(3);
};
R.reading = async (p, t) => {
  await t.ev(() => __reading.start('ladder', 2, 1)); await t.wait(1200); await t.shot(1);
  await t.ev(() => __reading.toMenu()); await t.wait(400);
  await t.ev(() => __reading.start('ladder', 6, 2)); await t.wait(1200); await t.shot(2);
  await t.ev(() => __reading.win()); await t.wait(1500); await t.shot(3);
};
R.thinking = async (p, t) => {
  await t.ev(() => __thinking.start('prac', 'matrix', 2)); await t.wait(1200); await t.shot(1);
  await t.ev(() => __thinking.toMenu()); await t.wait(400);
  await t.ev(() => __thinking.start('prac', 'balance', 2)); await t.wait(1200); await t.shot(2);
  await t.ev(() => __thinking.toMenu()); await t.wait(400);
  await t.ev(() => __thinking.start('prac', 'cubes', 2)); await t.wait(1200); await t.shot(3);
};
R.city = async (p, t) => {
  await t.cv('.btn.g'); await t.wait(900); await t.shot(1);
  await t.ev(() => { __city.pay(); __city.go('bank'); }); await t.wait(800); await t.shot(2);
  await t.ev(() => __city.go('home')); await t.wait(800); await t.shot(3);
};
R.bagrut = async (p, t) => {
  await t.ev(() => __bagrut.start('train', __bagrut.topics()[0].id)); await t.wait(1200); await t.shot(1);
  await t.ev(() => __bagrut.start('formulas')); await t.wait(900); await t.shot(2);
  await t.ev(() => __bagrut.start('topics')); await t.wait(900); await t.shot(3);
};
/* ---- cats ---- */
R.bubbles = async (p, t) => {
  const pop = async n => { const pts = await t.ev(n => __bubbles.info().bubbles.filter(b => b.correct && b.y > 120 && b.y < 760).slice(0, n).map(b => [b.x, b.y]), n); for (const q of pts) { await t.xy(q[0], q[1]); await t.wait(120); } };
  await t.click('#playBtn'); await t.wait(500); await t.click('#goBtn'); await t.wait(2600);
  await pop(2); await t.wait(1200); await pop(1); await t.wait(250); await t.shot(1);
  await t.open(); await t.click('#rushBtn'); await t.wait(500); await t.click('#goBtn'); await t.wait(3200); await pop(2); await t.wait(600); await t.shot(2);
  await t.open(); await t.click('#playBtn'); await t.wait(500); await t.click('#goBtn'); await t.wait(1500);
  await t.ev(() => { __bubbles.setScore(72); __bubbles.setTime(0.2); }); await t.wait(2600); await t.shot(3);
};
R.streetcats = async (p, t) => {
  await t.click('#playBtn'); await t.wait(4000); await t.shot(1);
  await t.ev(() => __sc.rain()); await t.wait(2600); await t.shot(2);
  await t.ev(() => __jy.open()); await t.wait(1600); await t.shot(3);
};
R.soya = async (p, t) => {
  await t.click('#goNoCam'); await t.wait(2200);
  await t.tap('.act >> nth=0'); await t.wait(2600); await t.shot(1);
  await t.tap('.act >> nth=2'); await t.wait(2200); await t.shot(2);
  await t.ev(() => __soyaHunt.start('timed')); await t.wait(3500); await t.shot(3);
};
R.soyahome = async (p, t) => {
  await t.click('#playBtn'); await t.wait(5000); await t.shot(1);
  await t.open(); await t.ev(() => __sh.room(1)); await t.wait(300); await t.click('#playBtn'); await t.wait(5000); await t.shot(2);
  await t.open(); await t.ev(() => __sh.room(2)); await t.wait(300); await t.click('#playBtn'); await t.wait(5000); await t.shot(3);
};
R.kitchen = async (p, t) => {
  await t.ev(() => __kitchen.start(1)); await t.wait(800); await t.ev(() => __kitchen.step(6)); await t.wait(500);
  await t.cv('.ing', 0); await t.wait(300); await t.cv('.ing', 1); await t.wait(500); await t.shot(1);
  await t.ev(() => { __kitchen.toMenu(); __kitchen.setDay(8); __kitchen.start(8); }); await t.wait(800); await t.ev(() => __kitchen.step(14)); await t.wait(500); await t.shot(2);
  await t.ev(() => { __kitchen.toMenu(); __kitchen.startRush(); }); await t.wait(800); await t.ev(() => __kitchen.step(9)); await t.wait(500); await t.shot(3);
};
/* ---- thinking / puzzle ---- */
R.cats = async (p, t) => {
  const pair = async () => { const ix = await t.ev(() => { const c = __cats.cards.filter(c => !c.classList.contains('matched') && !c.classList.contains('done') && !c.classList.contains('flip')), k = c[0].dataset.key; return c.filter(x => x.dataset.key === k).slice(0, 2).map(x => +x.dataset.idx); });
    for (const i of ix) { await t.tap('.card[data-idx="' + i + '"]'); await t.wait(450); } await t.wait(900); };
  await t.tap('.level >> nth=2'); await t.wait(1200); await pair(); await pair();
  await t.tap('.card[data-idx="' + await t.ev(() => +__cats.cards.filter(c => !/matched|done|flip|open/.test(c.className))[0].dataset.idx) + '"]'); await t.wait(600); await t.shot(1);
  await t.open(); await t.tap('.mode >> nth=1'); await t.wait(300); await t.tap('.level >> nth=1'); await t.wait(1200); await pair(); 
  await t.tap('.card[data-idx="' + await t.ev(() => +__cats.cards.filter(c => !/matched|done|flip|open/.test(c.className))[1].dataset.idx) + '"]'); await t.wait(600); await t.shot(2);
  await t.open(); await t.tap('.level >> nth=4'); await t.wait(1200); for (let i = 0; i < 5; i++) await pair(); await t.shot(3); // not the win card: it greets the player by name
};
R.hiddencats = async (p, t) => {
  await t.click('#playBtn'); await t.wait(2600); await t.shot(1);
  await t.ev(() => __hc.start(6)); await t.wait(2600); await t.shot(2);
  await t.ev(() => __hc.start(3)); await t.wait(2600); await t.shot(3);
};
R.escape = async (p, t) => {
  /* some riddles and the first speech bubble still address the player by an old personal name: such moments are skipped */
  const named = () => t.ev(() => /אנאבל|annabelle/i.test(document.body.innerText));
  const open = async i => { await t.tap('.hot >> nth=' + i); await t.wait(800); };
  const answer = async () => { await t.ev(() => { const a = +__esc.answer(__esc.state.puzzle), b = document.querySelectorAll('.card .big'); if (b[a]) b[a].click(); }); await t.wait(1400); await t.click('#pClose'); await t.wait(700); };
  await t.click('#goBtn'); await t.wait(1500); await open(2); await answer(); await t.shot(1);
  for (const i of [0, 1, 3, 4, 5]) { await open(i); if ((await t.cv('.card .big', 99)) > 1 && !(await named())) break; await t.click('#pClose'); await t.wait(500); }
  await t.shot(2);
  await t.open(); await t.click('#rushBtn'); await t.wait(1800); await t.shot(3);
};
R.minesweeper = async (p, t) => {
  const open = n => t.ev(n => { const g = __G(); let k = 0; for (let i = 0; i < g.cells.length && k < n; i++) { const c = g.cells[i]; if (!c.o && !c.dog && !c.f) { __tap(i); k++; } } }, n);
  await t.click('#bEasy'); await t.wait(1000);
  await t.ev(() => { const g = __G(); __tap(Math.floor(g.R / 2) * g.C + Math.floor(g.C / 2)); }); await t.wait(900); await open(3);
  await t.ev(() => { const g = __G(); let k = 0; g.cells.forEach((c, i) => { if (c.dog && !c.f && k < 2) { __tap(i, true); k++; } }); }); await t.wait(700); await t.shot(1);
  await t.open(); await t.click('#bHard'); await t.wait(1000);
  await t.ev(() => { const g = __G(); __tap(Math.floor(g.R / 2) * g.C + Math.floor(g.C / 2)); }); await t.wait(900); await open(14);
  await t.ev(() => { const g = __G(); let k = 0; g.cells.forEach((c, i) => { if (c.dog && !c.f && k < 5) { __tap(i, true); k++; } }); }); await t.wait(700); await t.shot(2);
  await t.open(); await t.click('#bExpert'); await t.wait(1000); // not the win card: it greets the player by name
  await t.ev(() => { const g = __G(); __tap(Math.floor(g.R / 2) * g.C + Math.floor(g.C / 2)); }); await t.wait(900); await open(40);
  await t.ev(() => { const g = __G(); let k = 0; g.cells.forEach((c, i) => { if (c.dog && !c.f && k < 9) { __tap(i, true); k++; } }); }); await t.wait(700); await t.shot(3);
};
R.checkers = async (p, t) => {
  const move = async () => { await t.until(() => __G().turn === 1 || __G().over || __legal().length > 0 && !__G().busy, null, 5000); await t.wait(500);
    const m = await t.ev(() => { const L = __legal(); if (!L.length) return null; const m = L.find(x => x.cap || x.caps) || L[Math.floor(L.length / 2)]; return [m.fr, m.fc, m.r, m.c]; });
    if (!m) return; await t.ev(m => __tap(m[0], m[1]), m); await t.wait(350); await t.ev(m => __tap(m[2], m[3]), m); await t.wait(1900); };
  await t.click('#bEasy'); await t.wait(1400); for (let i = 0; i < 3; i++) await move();
  await t.ev(() => { const L = __legal(); if (L.length) __tap(L[0].fr, L[0].fc); }); await t.wait(500); await t.shot(1);
  await t.ev(() => { const L = __legal(); if (L.length) __tap(L[0].r, L[0].c); }); await t.wait(1900);
  for (let i = 0; i < 7; i++) await move(); await t.shot(2);
  for (let i = 0; i < 8; i++) await move(); await t.shot(3);
};
R.tictactoe = async (p, t) => {
  await t.ev(() => __ttt.start({game: 'classic', diff: 'easy'})); await t.wait(2500);
  await t.ev(() => __ttt.play(4)); await t.wait(2600); await t.ev(() => { const b = __ttt.state().board; __ttt.play(b.findIndex(x => !x)); }); await t.wait(2600); await t.shot(1);
  await t.ev(() => __ttt.start({game: 'big', diff: 'easy'})); await t.wait(2500);
  for (let i = 0; i < 3; i++) { await t.ev(() => { const b = __ttt.state().board; const free = b.map((x, i) => x ? -1 : i).filter(i => i >= 0); __ttt.play(free[Math.floor(free.length / 2)]); }); await t.wait(2600); }
  await t.shot(2);
  await t.ev(() => __ttt.start({game: 'powers', diff: 'easy'})); await t.wait(2500);
  for (let i = 0; i < 2; i++) { await t.ev(() => { const b = __ttt.state().board; const free = b.map((x, i) => x ? -1 : i).filter(i => i >= 0); __ttt.play(free[0]); }); await t.wait(2600); }
  await t.shot(3);
};
R.cups = async (p, t) => {
  await t.ev(() => __cups.start('easy')); await t.wait(2300); await t.shot(1);
  await t.until(() => __cups.info().ph === 'choose', null, 20000); await t.wait(400); await t.shot(2);
  await t.ev(() => { const i = __cups.info(); __cups.pickSlot(i.cupAt.indexOf(i.ballCup) >= 0 ? i.cupAt.indexOf(i.ballCup) : 0); }); await t.until(() => __cups.info().ballVisible, null, 5000); await t.wait(500); await t.shot(3);
};
R.magic = async (p, t) => {
  await t.click('#bComp'); await t.wait(900); await t.cv('.big'); await t.wait(1500); await t.shot(1);
  await t.cv('.big.y'); await t.wait(1300); await t.cv('.big.n'); await t.wait(1300); await t.shot(2);
  for (let i = 0; i < 6; i++) { if (!(await t.cv('.big.y'))) break; await t.wait(1300); }
  await t.wait(5000); await t.shot(3);
};
R.magic2 = async (p, t) => {
  await t.click('#bPlay'); await t.wait(1500); await t.shot(1);
  await t.cv('.big'); await t.wait(2500); await t.shot(2);
  for (let i = 0; i < 3; i++) { await t.cv('.col', 1); await t.wait(2600); }
  await t.wait(5000); await t.shot(3);
};
R.funrun = async (p, t) => {
  await t.ev(() => __funrun.start('cup', 0, 0)); await t.wait(900); await t.ev(() => { __funrun.skipCd(); __funrun.auto(true); }); await t.wait(4500); await t.shot(1);
  await t.ev(() => __funrun.start('cup', 1, 1)); await t.wait(900); await t.ev(() => { __funrun.skipCd(); __funrun.auto(true); }); await t.wait(6500); await t.shot(2);
  await t.ev(() => __funrun.win()); await t.wait(3500); await t.shot(3);
};
R.carrace = async (p, t) => {
  await t.ev(() => __carrace.start({mode: 'single', ti: 0})); await t.wait(1500); await t.ev(() => { const e = document.getElementById('tip'); if (e) e.style.display = 'none'; __carrace.auto(true, true); __carrace.step(9); }); await t.wait(1500); await t.shot(1);
  await t.ev(() => __carrace.start({mode: 'single', ti: 2})); await t.wait(1500); await t.ev(() => { const e = document.getElementById('tip'); if (e) e.style.display = 'none'; __carrace.auto(true, true); __carrace.step(12); }); await t.wait(1500); await t.shot(2);
  await t.ev(() => __carrace.finishAs(1)); await t.wait(3500); await t.shot(3);
};
/* ---- sport & action ---- */
R.football = async (p, t) => {
  await t.ev(() => __fb.startMatch()); await t.until(() => __fb.G.state === 'play', null, 9000); await t.wait(600);
  await t.ev(() => { const g = __fb.G; g.ball.x = g.ball.x + 40; g.ball.vy = -260; g.ball.vx = 30; }); await t.wait(700); await t.shot(1);
  await t.wait(3000); await t.shot(2);
  await t.open(); await t.ev(() => __fb.startPen()); await t.wait(3500); await t.shot(3);
};
R.thunderkittens = async (p, t) => {
  await t.click('#b1p'); await t.wait(900); await t.cv('.cc', 0); await t.wait(300); await t.click('#bGo'); await t.wait(5600); await t.shot(1);
  await t.down('ArrowRight'); await t.wait(900); await t.up('ArrowRight'); await t.wait(1600); await t.shot(2);
  await t.open(); await t.click('#bSurv'); await t.wait(900); await t.cv('.cc', 1); await t.wait(300); await t.click('#bGo'); await t.wait(6500); await t.shot(3);
};
R.bowling = async (p, t) => {
  await t.click('#playBtn'); await t.wait(2500); await t.shot(1);
  await t.tap('#go'); await t.wait(900); await t.tap('#go'); await t.wait(900); await t.tryTap('#go'); await t.wait(1500); await t.shot(2);
  await t.wait(6500); await t.shot(3);
};
R.runner = async (p, t) => {
  await t.click('#playBtn'); await t.wait(600); await t.ev(() => __run.setInv(999)); await t.wait(2600); await t.xy(195, 500); await t.wait(330); await t.shot(1);
  await t.ev(() => __run.setDist(1400)); await t.wait(2200); await t.xy(195, 500); await t.wait(300); await t.shot(2);
  await t.ev(() => __run.setDist(3200)); await t.wait(2200); await t.shot(3);
};
R.runner3d = async (p, t) => {
  await t.click('#playBtn'); await t.wait(600); await t.ev(() => __run3.setInv(999)); await t.wait(3500); await t.shot(1);
  await t.ev(() => __run3.setDist(900)); await t.wait(2500); await t.xy(195, 500); await t.wait(350); await t.shot(2);
  await t.ev(() => __run3.setDist(2400)); await t.wait(2500); await t.shot(3);
};
R.pacman = async (p, t) => {
  await t.click('#playBtn'); await t.wait(2500); await t.key('ArrowLeft'); await t.wait(1500); await t.key('ArrowUp'); await t.wait(1400); await t.shot(1);
  await t.ev(() => __pac.startLevel(3)); await t.wait(2600); await t.key('ArrowRight'); await t.wait(1500); await t.key('ArrowUp'); await t.wait(1200); await t.shot(2);
  await t.ev(() => __pac.startLevel(5)); await t.wait(2600); await t.key('ArrowLeft'); await t.wait(1600); await t.shot(3);
};
/* ---- adventures ---- */
R.lionking = async (p, t) => {
  await t.click('#playBtn'); await t.wait(2500); await t.ev(() => __lion.tp(900)); await t.ev(() => __lion.press('r', true)); await t.wait(900); await t.ev(() => __lion.press('j', true)); await t.wait(350); await t.shot(1);
  await t.ev(() => { __lion.press('j', false); __lion.press('r', false); __lion.tp(3300); }); await t.wait(1500); await t.shot(2);
  await t.ev(() => __lion.tp(5600)); await t.wait(1500); await t.shot(3);
};
R.hole = async (p, t) => {
  /* glide onto the nearest things that fit into the hole, one by one */
  const eat = async n => { for (let i = 0; i < n; i++) { await t.ev(() => { const g = __hole.G; if (g.over) return; const m = g.me, o = g.objs.filter(o => o.alive && !o.sw && o.r < m.R * 0.8).sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0]; if (o) __hole.tp(o.x + 6, o.y + 4); }); await t.wait(420); } };
  await t.ev(() => __hole.start(0, 0, 0)); await t.wait(1800); await eat(7); await t.shot(1);
  await t.ev(() => __hole.start(1, 1, 0)); await t.wait(1800); await eat(14); await t.shot(2);
  await t.ev(() => __hole.start(4, 0, 0)); await t.wait(1800); await eat(10); await t.shot(3);
};
R.fishy = async (p, t) => {
  await t.ev(() => __fishy.start(0)); await t.wait(4000); await t.shot(1);
  await t.ev(() => __fishy.start(6)); await t.wait(4000); await t.shot(2);
  await t.ev(() => __fishy.endless()); await t.wait(4000); await t.shot(3);
};
R.fishing = async (p, t) => {
  await t.click('#playBtn'); await t.wait(3000); await t.shot(1);
  await t.ev(() => __fish.drop()); await t.wait(1600); await t.shot(2);
  await t.ev(() => __fish.startBlitz()); await t.wait(3000); await t.shot(3);
};
R.digrod = async (p, t) => {
  await t.click('#playBtn'); await t.wait(3500); await t.shot(1);
  await t.tap('#bThrow'); await t.wait(3600); await t.shot(2);
  await t.ev(() => __dr.forceWave()); await t.wait(6500); await t.shot(3);
};
R.towerdefense = async (p, t) => {
  /* place tigers on free cells that touch the path, then call the waves */
  const place = async (n, kind) => { for (let i = 0; i < n; i++) { await t.cv('button.min-h-16', kind); await t.wait(150);
    await t.ev(() => { const g = __tdGame, c = g.canvas.getBoundingClientRect(), cells = []; for (let y = c.top + g.cell / 2; y < c.bottom; y += g.cell) for (let x = c.left + g.cell / 2; x < c.right; x += g.cell) { const q = g.cellAt(x - c.left, y - c.top); if (q) cells.push(q); }
      const free = q => g.buildable(q.c, q.r), near = q => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(d => cells.some(z => z.c === q.c + d[0] && z.r === q.r + d[1]) && !g.buildable(q.c + d[0], q.r + d[1]) && !g.towerAt(q.c + d[0], q.r + d[1])).length;
      const best = cells.filter(free).map(q => ({q: q, n: near(q)})).filter(o => o.n >= 2).sort((a, b) => b.n - a.n || a.q.r - b.q.r); const pick = best[Math.floor(best.length / 3)] || best[0]; if (pick) g.tryPlace(pick.q.c, pick.q.r); }); await t.wait(250); } };
  await t.tapText('יוצאים לשמור'); await t.wait(2500); await place(4, 0); await t.ev(() => __tdGame.callWave()); await t.wait(7000); await t.shot(1);
  await place(2, 1); await t.ev(() => { __tdGame.toggleSpeed(); }); await t.wait(9000); await t.ev(() => __tdGame.callWave()); await t.wait(5000); await t.shot(2);
  await place(1, 2); await t.wait(9000); await t.ev(() => __tdGame.callWave()); await t.wait(4000); await t.shot(3);
};
/* ---- retro ---- */
R.retro = async (p, t) => {
  /* the hub's title sign still carries an old personal name: every picture is taken scrolled below it */
  const seed = async n => { await t.ev(n => { const ids = ['tiger', 'lion', 'leopard', 'cheetah']; localStorage.setItem('annabelle-retro-zoo', JSON.stringify(__retro.animals ? ids.slice(0, n) : ids)); }, n); await t.open(); };
  await t.ev(() => scrollTo(0, 650)); await t.wait(600); await t.shot(1);
  await seed(4); await t.ev(() => scrollTo(0, 262)); await t.wait(900); await t.shot(2);
  await t.ev(() => scrollTo(0, 1100)); await t.wait(600); await t.shot(3);
};
R.invaders = async (p, t) => {
  const fire = async n => { for (let i = 0; i < n; i++) { await t.ev(i => { __invaders.moveTo(90 + (i * 53) % 220); __invaders.fire(); }, i); await t.wait(420); } };
  await t.ev(() => __invaders.start(1)); await t.wait(3200); await fire(5); await t.shot(1);
  await t.ev(() => __invaders.start(4)); await t.wait(3200); await fire(4); await t.shot(2);
  await t.ev(() => __invaders.arcade()); await t.wait(3200); await fire(6); await t.shot(3);
};
R.tetris = async (p, t) => {
  const drop = async n => { for (let i = 0; i < n; i++) { await t.ev(i => { __tetris.move((i % 5 - 2) * 2); __tetris.move((i % 5 - 2) * 2 > 0 ? 1 : -1); if (i % 2) __tetris.rotate(); __tetris.hardDrop(); }, i); await t.wait(450); } };
  await t.ev(() => __tetris.start(1)); await t.wait(2200); await drop(7); await t.wait(700); await t.shot(1);
  await t.ev(() => __tetris.arcade()); await t.wait(2200); await drop(11); await t.wait(700); await t.shot(2);
  await t.ev(() => __tetris.sprint()); await t.wait(2200); await drop(5); await t.wait(700); await t.shot(3);
};
R.breakout = async (p, t) => {
  /* the paw follows the ball, like a careful player */
  const play = async ms => { await t.wait(1500); await t.cv('#inGo'); await t.wait(1200); await t.ev(() => __breakout.launch());
    for (let i = 0; i < ms / 60; i++) { await t.ev(() => { const s = __breakout.state(); if (s.stuck) __breakout.launch(); if (s.ball) __breakout.setX(s.ball.x + 9); }); await t.wait(60); } };
  await t.ev(() => __breakout.start(1)); await play(6000); await t.shot(1);
  await t.ev(() => __breakout.start(5)); await play(6000); await t.shot(2);
  await t.ev(() => __breakout.startArcade()); await play(7000); await t.shot(3);
};
R.snake = async (p, t) => {
  /* steer toward the nearest food a few times so the tail grows */
  const steer = async n => { for (let i = 0; i < n; i++) { await t.ev(() => { const s = __snake.state(), h = s.head, f = s.foods[0]; if (!f) return; const dx = f.x - h.x, dy = f.y - h.y; const want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'); window.dispatchEvent(new KeyboardEvent('keydown', {key: want, code: want, bubbles: true})); }); await t.wait(240); } };
  await t.ev(() => __snake.start(1)); await t.wait(2500); await steer(22); await t.shot(1);
  await t.ev(() => __snake.start(4)); await t.wait(2500); await steer(22); await t.shot(2);
  await t.ev(() => __snake.arcade()); await t.wait(2500); await steer(22); await t.shot(3);
};
R.crossing = async (p, t) => {
  const hop = async n => { for (let i = 0; i < n; i++) { await t.ev(() => { const d = __crossing.suggest && __crossing.suggest(); __crossing.hop(d || 'u'); }); await t.wait(420); } };
  await t.ev(() => __crossing.start(1)); await t.wait(2500); await hop(3); await t.shot(1);
  await t.ev(() => __crossing.start(3)); await t.wait(2500); await hop(5); await t.shot(2);
  await t.ev(() => __crossing.arcade()); await t.wait(2500); await hop(4); await t.shot(3);
};
R.pong = async (p, t) => {
  await t.ev(() => { __pong.start(1); }); await t.wait(1200); await t.ev(() => __pong.begin()); await t.wait(3200); await t.shot(1);
  await t.ev(() => { __pong.start(3); }); await t.wait(1200); await t.ev(() => __pong.begin()); await t.wait(3600); await t.shot(2);
  await t.ev(() => { __pong.start2p(); }); await t.wait(1200); await t.ev(() => __pong.begin()); await t.wait(2600); await t.shot(3);
};
R.safari = async (p, t) => {
  const live = () => t.until(() => __safari.netTargets().length > 0, null, 9000);
  const snap = async () => { const q = await t.ev(() => __safari.netTargets()[0] || null); if (q) await t.xy(q.x, q.y); };
  await t.ev(() => { __safari.start(1); }); await t.wait(800); await t.ev(() => __safari.skipIntro && __safari.skipIntro()); await live(); await t.wait(350); await t.shot(1);
  await snap(); await t.wait(600);
  await t.ev(() => { __safari.start(5); }); await t.wait(800); await t.ev(() => __safari.skipIntro && __safari.skipIntro()); await live(); await t.wait(300); await snap(); await t.wait(180); await t.shot(2);
  await t.ev(() => __safari.openAlbum()); await t.wait(1200); await t.shot(3);
};
R.simon = async (p, t) => {
  await t.ev(() => __simon.start(1)); await t.wait(3600); await t.shot(1);
  await t.ev(() => __simon.start(6)); await t.wait(4200); await t.shot(2);
  await t.ev(() => __simon.piano()); await t.wait(1500); await t.ev(() => __simon.press(2)); await t.wait(250); await t.shot(3);
};
/* critters.html is still PENDING in catalog.js (hidden): its recipe is ready for the day it is published – then run  node tools/shots.js critters */
R.critters = async (p, t) => {
  await t.ev(() => __critters.start('tufti')); await t.wait(1200);
  await t.ev(() => { __critters.match({r: 0, kind: 'rival'}); }); await t.wait(3500); await t.cv('.mv', 0); await t.wait(1300); await t.shot(1);
  await t.open(); await t.ev(() => __critters.start('tufti')); await t.wait(900); await t.ev(() => __critters.meet(0)); await t.wait(1600); await t.shot(2);
  await t.open(); await t.ev(() => __critters.start('tufti')); await t.wait(1500); await t.shot(3);
};
/*RECIPES*/

/* ------------------------------------------------------------------ engine ------------------------------------------------------------------- */
function serve() {
  const MIME = {html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css', json: 'application/json', webmanifest: 'application/manifest+json',
    png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', woff2: 'font/woff2', glb: 'model/gltf-binary'};
  const srv = http.createServer((q, s) => {
    let f = path.normalize(path.join(ROOT, decodeURIComponent(q.url.split('?')[0])));
    if (f.indexOf(ROOT) !== 0) { s.writeHead(403); s.end(); return; }
    fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, {'Content-Type': MIME[path.extname(f).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); s.end(b); });
  });
  return new Promise(res => srv.listen(0, '127.0.0.1', () => res(srv)));
}
function catalogIds() { // available ids, straight from catalog.js
  const W = {localStorage: {getItem: () => null, setItem: () => {}}, addEventListener: () => {}};
  const D = {documentElement: {setAttribute: () => {}}};
  new Function('window', 'document', fs.readFileSync(path.join(ROOT, 'catalog.js'), 'utf8'))(W, D);
  return W.GameCatalog.list.filter(g => W.GameCatalog.available(g.id)).map(g => g.id);
}
async function capture(browser, base, id) {
  const ctx = await browser.newContext({viewport: {width: VW, height: VH}, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block', locale: 'he-IL', reducedMotion: 'no-preference'});
  await ctx.route(u => u.toString().indexOf(base) !== 0, r => r.abort());
  await ctx.addInitScript(([prof, hide]) => {
    try {
      if (!localStorage.getItem('__shots')) {
        localStorage.setItem('__shots', '1');
        localStorage.setItem('annabelle-profiles', JSON.stringify(prof));
        localStorage.setItem('annabelle-vibe', '0'); localStorage.setItem('annabelle-muted', '1'); localStorage.setItem('kidapp-qa', '1'); localStorage.setItem('annabelle-lang', 'he');
      }
    } catch (e) {}
    /* a personal name painted on a canvas (an old boat name, an old "well done, <name>" banner) is simply not painted */
    try { ['fillText', 'strokeText'].forEach(k => { const o = CanvasRenderingContext2D.prototype[k]; CanvasRenderingContext2D.prototype[k] = function (s) {
      if (/אנאבל|annabelle/i.test(String(s))) { window.__nameSkipped = (window.__nameSkipped || 0) + 1; return; } return o.apply(this, arguments); }; }); } catch (e) {}
    const add = () => { if (document.getElementById('__hide')) return; const s = document.createElement('style'); s.id = '__hide'; s.textContent = hide; (document.head || document.documentElement).appendChild(s); };
    document.addEventListener('DOMContentLoaded', add); window.addEventListener('load', add);
  }, [PROFILE, HIDE]);
  const p = await ctx.newPage(), errs = [], done = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 140)));
  const t = {
    wait: ms => p.waitForTimeout(ms),
    ev: (f, a) => p.evaluate(f, a),
    tap: async (sel, o) => { const l = p.locator(sel).first(); await l.tap(Object.assign({timeout: 4000}, o || {})); },
    tryTap: async sel => { try { const l = p.locator(sel).first(); if (await l.isVisible()) { await l.tap({timeout: 1500}); return true; } } catch (e) {} return false; },
    click: sel => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel), // a DOM click: for buttons that animate (a real tap waits for them to hold still)
    cv: (sel, n) => p.evaluate(([s, n]) => { const v = [...document.querySelectorAll(s)].filter(e => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || getComputedStyle(e).visibility === 'hidden') return false;
      const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === e || e.contains(h)); }); if (v[n || 0]) v[n || 0].click(); return v.length; }, [sel, n || 0]), // click the n-th VISIBLE match
    tapText: async txt => { await p.getByText(txt).first().tap({timeout: 4000}); },
    xy: (x, y) => p.touchscreen.tap(x, y),
    key: k => p.keyboard.press(k),
    down: k => p.keyboard.down(k), up: k => p.keyboard.up(k),
    until: (f, a, ms) => p.waitForFunction(f, a, {timeout: ms || 8000}).catch(() => { console.log('   (' + id + ': a wait timed out)'); }),
    open: async file => { await p.goto(base + (file || id + '.html'), {waitUntil: 'load'}); await p.waitForTimeout(900); },
    shot: async (n, clip) => {
      const txt = await p.evaluate(() => { const o = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let x;
        while ((x = w.nextNode())) { const e = x.parentElement; if (!e || !x.nodeValue.trim()) continue; const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
          if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05) o.push(x.nodeValue); } return o.join(' '); });
      if (NAME_RE.test(txt)) console.log('   !! ' + id + '-' + n + ': a personal name is visible in the page text – change the recipe');
      const f = path.join(RAW, id + '-' + n + '.png'); await p.screenshot(Object.assign({path: f}, clip ? {clip: clip} : {})); done.push(n);
    }
  };
  try { await t.open(); await R[id](p, t); } catch (e) { errs.push('recipe: ' + String(e.message || e).split('\n')[0].slice(0, 200)); }
  try { const k = await p.evaluate(() => window.__nameSkipped || 0); if (k) console.log('   note ' + id + ': a personal name painted on the canvas was left out of the picture (' + k + ' draw calls) – the game page itself still paints it'); } catch (e) {}
  await ctx.close();
  return {n: done, errs: errs};
}
/* PNG -> WebP at 540 px (quality searched so each file lands in the 25-45 KB budget) + the 160 px thumbnail */
const PY = `
import sys, io, os
from PIL import Image
raw, out, ids = sys.argv[1], sys.argv[2], sys.argv[3:]
def enc(im, lo, hi):
    best = None
    for q in (82, 76, 70, 64, 58, 52, 46, 40, 34, 28, 22):
        b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); n = b.tell()
        best = (b.getvalue(), q)
        if n <= hi: break
    return best
for i in ids:
    for n in (1, 2, 3):
        f = os.path.join(raw, '%s-%d.png' % (i, n))
        if not os.path.exists(f): continue
        im = Image.open(f).convert('RGB'); w, h = im.size
        big = im.resize((540, round(h * 540 / w)), Image.LANCZOS)
        data, q = enc(big, 25000, 44000)
        open(os.path.join(out, '%s-%d.webp' % (i, n)), 'wb').write(data)
        msg = '%s-%d.webp %d KB q%d' % (i, n, len(data) // 1024, q)
        if n == 1:
            th = im.resize((160, round(h * 160 / w)), Image.LANCZOS); b = io.BytesIO(); th.save(b, 'WEBP', quality=60, method=6)
            open(os.path.join(out, '%s-1t.webp' % i), 'wb').write(b.getvalue()); msg += ' + thumb %d KB' % (b.tell() // 1024)
        print('   ' + msg)
`;
(async () => {
  const args = process.argv.slice(2);
  if (args[0] === '--list') { console.log(Object.keys(R).join(' ')); return; }
  const CONVERT = args[0] === '--convert'; if (CONVERT) args.shift(); // --convert [ids]: only turn the raw PNGs already in SHOTS_RAW into WebP (no browser)
  const avail = catalogIds(), ids = args.length ? args : avail.filter(id => R[id]);
  const missing = avail.filter(id => !R[id]); if (!args.length && missing.length) console.log('no recipe yet for: ' + missing.join(' '));
  const bad = ids.filter(id => !R[id]); if (bad.length) { console.error('unknown game id (no recipe): ' + bad.join(' ')); process.exit(1); }
  fs.mkdirSync(RAW, {recursive: true}); fs.mkdirSync(OUT, {recursive: true});
  if (CONVERT) { const py = cp.spawnSync('python3', ['-c', PY, RAW, OUT].concat(ids), {encoding: 'utf8'}); process.stdout.write(py.stdout || ''); if (py.status !== 0) { console.error(py.stderr); process.exit(1); } return; }
  const {chromium} = require('playwright');
  const srv = await serve(), base = 'http://127.0.0.1:' + srv.address().port + '/';
  /* two browsers: a plain one (fast) and one with the software-GL flags that the 3D pages (three.js) need in a headless browser */
  const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], browsers = {};
  const is3d = id => /vendor\/three|three(\.min|\.module)?\.js/.test(fs.readFileSync(path.join(ROOT, id + '.html'), 'utf8'));
  const browserFor = async id => { const k = is3d(id) ? 'gl' : 'std'; if (!browsers[k]) browsers[k] = await chromium.launch({args: k === 'gl' ? GL : []}); return browsers[k]; };
  let fail = 0;
  for (const id of ids) {
    [1, 2, 3].forEach(n => { try { fs.unlinkSync(path.join(RAW, id + '-' + n + '.png')); } catch (e) {} });
    const t0 = Date.now(), r = await capture(await browserFor(id), base, id);
    console.log(Math.round((Date.now() - t0) / 1000) + 's ' + (r.n.length === 3 && !r.errs.length ? 'ok   ' : 'WARN ') + id + ' pictures ' + r.n.join(',') + (r.errs.length ? '  ' + r.errs.join(' | ') : ''));
    if (r.n.length < 3) fail++;
  }
  for (const k in browsers) await browsers[k].close();
  srv.close();
  if (!process.env.SHOTS_KEEP) {
    const py = cp.spawnSync('python3', ['-c', PY, RAW, OUT].concat(ids), {encoding: 'utf8'});
    process.stdout.write(py.stdout || ''); if (py.status !== 0) { console.error(py.stderr); process.exit(1); }
  }
  console.log(fail ? fail + ' game(s) have fewer than 3 pictures' : 'done: ' + ids.length + ' game(s)');
})();

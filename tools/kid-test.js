#!/usr/bin/env node
/* tools/kid-test.js – node tests of kid.js: who is addressed in the feminine by default. DEV TOOL: the site never loads this file.
   Run from the repo root:   node tools/kid-test.js        (exit 1 on a failure)
   kid.js runs in a vm with a fake localStorage; a "reload" = a new vm on the same storage (as a new page does).
   The legacy scenarios are also compared with the kid.js of the last commit (git show HEAD:kid.js, read-only):
   a device that had play data or a profile before the generic platform must behave exactly as it did. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const NEW = fs.readFileSync(path.join(ROOT, 'kid.js'), 'utf8');
let OLD = null;
try { OLD = cp.execFileSync('git', ['show', 'HEAD:kid.js'], {cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}); } catch (e) {}
if (OLD && /_device/.test(OLD)) OLD = null; // the fix is already committed: nothing older to compare with

let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('  FAIL ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }

function Store(init) {
  const d = Object.assign({}, init || {});
  return {
    d,
    api: {
      getItem: k => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null),
      setItem: (k, v) => { d[k] = String(v); },
      removeItem: k => { delete d[k]; },
      key: i => Object.keys(d)[i] || null,
      get length() { return Object.keys(d).length; }
    }
  };
}
function load(src, store) { // one page load
  const w = {localStorage: store.api, crypto: require('crypto').webcrypto};
  w.window = w;
  vm.runInNewContext(src, w, {filename: 'kid.js'});
  return w.KidApp;
}
const J = JSON.stringify;
const PLAYED = J({coins: 12, earned: 12, stats: {plays: {snake: 1}}});
const UUID = '11111111-2222-4333-8444-555555555555';
const MARK = 'annabelle-profdata-_device';
const SHAPE = ['age', 'emo', 'gender', 'id', 'kid', 'name', 'ob', 'role', 'sk', 'skill'];
const noKid = k => { const o = Object.assign({}, k); delete o.kid; return o; };

console.log('1. brand-new device (empty storage, opens a game directly)');
(function () {
  const s = Store();
  let K = load(NEW, s);
  eq(K.kid().gender, 'x', 'first visit is neutral');
  eq(s.d[MARK], 'n', 'device marker written once: born generic');
  eq(Object.keys(K.kid()).sort(), SHAPE, 'kid() shape');
  s.api.setItem('annabelle-rewards', PLAYED);            // rewards.js records the first play
  s.api.setItem('annabelle-retro-snake', J({diff: 'easy'}));
  ok(K.hasLegacy() === true, 'hasLegacy() is true once a play is recorded (unchanged API)');
  eq(K.kid().gender, 'x', 'still neutral in the same page after the first play');
  K = load(NEW, s);
  eq(K.kid().gender, 'x', 'still neutral on the next page');
  eq(K.g('F', 'M', 'X'), 'X', 'g() picks the neutral form');
  eq(K.he('שחקי'), 'שחק/י', 'he() gives the neutral form');
  for (let i = 0; i < 5; i++) { s.api.setItem('annabelle-rewards', J({coins: 50 + i, earned: 90, stats: {plays: {snake: 3 + i, pong: 2}}})); K = load(NEW, s); }
  eq(K.kid().gender, 'x', 'neutral after many plays and page loads');
  eq(s.d[MARK], 'n', 'marker never changes');
  K.save({name: 'נועם'});
  eq(load(NEW, s).kid().gender, 'x', 'a name alone does not make the profile feminine on this device');
  K.save({gender: 'f'});
  eq(load(NEW, s).kid().gender, 'f', 'a chosen gender is used');
  K.save({gender: 'm'});
  eq(load(NEW, s).kid().gender, 'm', 'and can be changed');
})();
(function () {
  // visitor of the generic platform from before this marker existed: only the anonymous profile kid.js creates, nothing played yet
  const s = Store({'annabelle-profiles': J({cur: 'p1', list: [{id: 'p1', name: '', emo: '🐱', kid: UUID}]}), 'annabelle-lang': 'fr', 'annabelle-muted': '1', 'annabelle-device': 'abc', 'annabelle-playtime': '{}'});
  let K = load(NEW, s);
  eq(s.d[MARK], 'n', 'anonymous profile + device-level keys only = born generic');
  s.api.setItem('annabelle-rewards', PLAYED);
  K = load(NEW, s);
  eq(K.kid().gender, 'x', 'stays neutral after plays');
  eq(K.kid().kid, UUID, 'anonymous id kept');
  // a second player added on this device without a gender is neutral too, and the marker survives the profile switch
  const id = K.newProfile({name: 'Lia'});
  ok(!!id, 'newProfile works');
  eq(load(NEW, s).kid().gender, 'x', 'new player without a gender: neutral');
  eq(s.d[MARK], 'n', 'marker survives a profile switch');
  ok(!/_device/.test(s.d['annabelle-profdata-p1'] || ''), 'marker is not part of a profile snapshot');
})();
(function () {
  const s = Store(); s.api.setItem = () => { throw new Error('denied'); }; // storage blocked
  const K = load(NEW, s);
  eq(K.kid().gender, 'x', 'no storage: neutral, no crash');
})();

console.log('2. true legacy devices (data from before the generic platform)');
const LEGACY = {
  'rewards only, no profile map': {'annabelle-rewards': PLAYED},
  'coins only': {'annabelle-rewards': J({coins: 3, earned: 0})},
  'album profile with a name': {'annabelle-profiles': J({cur: 'p1', list: [{id: 'p1', name: 'אנאבל', emo: '🐱'}]})},
  'album profile with a name + plays': {'annabelle-profiles': J({cur: 'p1', list: [{id: 'p1', name: 'אנאבל', emo: '🐱'}]}), 'annabelle-rewards': PLAYED},
  'unnamed profile + plays': {'annabelle-profiles': J({cur: 'p1', list: [{id: 'p1', name: '', emo: '🐱'}]}), 'annabelle-rewards': PLAYED},
  'two album profiles': {'annabelle-profiles': J({cur: 'p2', list: [{id: 'p1', name: 'אנאבל', emo: '🐱'}, {id: 'p2', name: 'Tom', emo: '🐯'}]}), 'annabelle-profdata-p1': J({'annabelle-rewards': PLAYED})},
  'game saves but no rewards yet': {'annabelle-retro-snake': J({diff: 'easy'}), 'soya-pet': '{}'}
};
Object.keys(LEGACY).forEach(function (name) {
  const sN = Store(LEGACY[name]), sO = Store(LEGACY[name]);
  const steps = [];
  const step = (label, fn) => {
    if (fn) { fn(sN); fn(sO); }
    const kn = load(NEW, sN).kid(); steps.push([label, kn]);
    if (OLD) eq(noKid(kn), noKid(load(OLD, sO).kid()), name + ' / ' + label + ': same as the last commit');
  };
  step('first load');
  eq(sN.d[MARK], 'l', name + ': marker = legacy');
  step('after a play', s => s.api.setItem('annabelle-rewards', PLAYED));
  step('next page');
  const last = steps[steps.length - 1][1];
  eq(last.gender, 'f', name + ': feminine by default once it has plays, as before');
  eq(sN.d[MARK], 'l', name + ': marker never changes');
});
eq(load(NEW, Store({'annabelle-rewards': PLAYED})).kid().gender, 'f', 'legacy plays, first load: feminine');
eq(load(NEW, Store({'annabelle-profiles': J({cur: 'p1', list: [{id: 'p1', name: 'אנאבל', emo: '🐱'}]})})).kid().gender, 'f', 'legacy named profile: feminine');
eq(load(NEW, Store({'annabelle-rewards': PLAYED})).he('שחקי'), 'שחקי', 'legacy texts stay feminine');

console.log('3. onboarded profiles and profiles with an explicit gender: unchanged');
const PROFILES = {
  'boy': {id: 'p1', name: 'דני', emo: '🐯', age: 8, gender: 'm', kid: UUID, skill: 3, sk: {react: 3, math: 2}, ob: '2026-11-18'},
  'girl': {id: 'p1', name: 'מיה', emo: '🐱', age: 6, gender: 'f', kid: UUID, skill: 2, sk: {}, ob: '2026-11-18'},
  'neutral': {id: 'p1', name: 'Alex', emo: '🦊', age: 10, gender: 'x', kid: UUID, skill: 4, sk: {memory: 4}, ob: '2026-11-18'},
  'adult': {id: 'p1', name: 'Mom', emo: '🦁', role: 'adult', kid: UUID},
  'adult with gender': {id: 'p1', name: 'Dad', emo: '🦁', role: 'adult', gender: 'm', kid: UUID},
  'gender but not onboarded': {id: 'p1', name: 'Tal', emo: '🐱', gender: 'm', kid: UUID}
};
Object.keys(PROFILES).forEach(function (name) {
  [['legacy device', 'l'], ['generic device', 'n'], ['no marker yet', null]].forEach(function (dev) {
    [{}, {'annabelle-rewards': PLAYED}].forEach(function (extra, xi) {
      const base = Object.assign({'annabelle-profiles': J({cur: 'p1', list: [PROFILES[name]]})}, extra);
      if (dev[1]) base[MARK] = dev[1];
      const sN = Store(base), kn = load(NEW, sN).kid(), tag = name + ' / ' + dev[0] + (xi ? ' / with plays' : '');
      const want = PROFILES[name].gender || 'x'; // (an adult without a gender is neutral, as before)
      eq(kn.gender, want, tag + ': gender');
      eq(kn.name, PROFILES[name].name, tag + ': name');
      eq(Object.keys(kn).sort(), SHAPE, tag + ': shape');
      if (OLD) { const baseO = Object.assign({}, base); delete baseO[MARK]; eq(kn, load(OLD, Store(baseO)).kid(), tag + ': identical to the last commit'); }
      eq(JSON.parse(sN.d['annabelle-profiles']), JSON.parse(base['annabelle-profiles']), tag + ': stored profile untouched');
      if (dev[1]) eq(sN.d[MARK], dev[1], tag + ': marker untouched');
    });
  });
});
(function () { // an onboarded device is never re-classified as "born generic" by accident, and old profiles without a gender stay feminine
  const s = Store({'annabelle-profiles': J({cur: 'p1', list: [PROFILES.girl, {id: 'p2', name: 'Old', emo: '🐱'}]})});
  load(NEW, s);
  eq(s.d[MARK], 'l', 'existing profiles = not a brand-new device');
  s.d['annabelle-profiles'] = J({cur: 'p2', list: [PROFILES.girl, {id: 'p2', name: 'Old', emo: '🐱'}]});
  eq(load(NEW, s).kid().gender, 'f', 'old profile without a gender on a legacy device: feminine');
})();

console.log((OLD ? '' : '(no older kid.js to compare with) ') + pass + ' checks passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

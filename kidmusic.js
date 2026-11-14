/* Annabelle games – tiny shared background-music loop (pentatonic, synthesized by the game itself).
   const M=KidMusic(function play(freq,dur,type,vol){...}, {canPlay:()=>!muted&&AC&&AC.state==="running", mel:[...], bas:[...], base:262, ms:270, defaultOn:false});
   M.on  M.set(bool)  M.toggle()  – the choice is kept in localStorage "annabelle-music" ("1" = on) and respects the game's own mute. */
(function () {
  'use strict';
  if (window.KidMusic) return;
  window.KidMusic = function (play, o) {
    o = o || {};
    var mel = o.mel || [0, 4, 7, 12, 9, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 0], bas = o.bas || [0, 0, -5, -5, -3, -3, -7, -7], base = o.base || 262, ms = o.ms || 270;
    var on = !!o.defaultOn, id = 0, step = 0, cb = null;
    try { var v = localStorage.getItem('annabelle-music'); if (v === '1') on = true; else if (v === '0') on = false; } catch (e) {}
    function tick() {
      if (!on || document.hidden || (o.canPlay && !o.canPlay())) return;
      var s = step++, m = mel[s % mel.length];
      if (m !== null && m !== undefined) play(base * Math.pow(2, m / 12), .3, "triangle", .04);
      if (s % 2 === 0) play(base / 2 * Math.pow(2, bas[(s >> 1) % bas.length] / 12), .55, "sine", .045);
    }
    var api = {
      get on() { return on; },
      set: function (v) {
        on = !!v; try { localStorage.setItem('annabelle-music', on ? '1' : '0'); } catch (e) {}
        clearInterval(id); id = 0; if (on) id = setInterval(tick, ms); if (cb) cb(on);
      },
      toggle: function () { api.set(!on); return on; },
      onChange: function (f) { cb = f; f(on); },
      start: function () { if (on && !id) id = setInterval(tick, ms); }
    };
    if (on) id = setInterval(tick, ms);
    return api;
  };
})();

/* Join any online room by its 6-digit code, straight from the home page.
   Rooms are named <game prefix> + code on the PeerJS server, so we ask each game's name for that code and
   open the game that answers. Nothing is sent but a connect attempt that is closed straight away.
   The room owner is often in WhatsApp for a moment (sending the code), so the question is asked again a few times before giving up.
   Anonymous diagnostics: KidApp.track('net', {game:'home', role:'guest', ev:'code_try'|'code_found'|'code_none', ms, n}) - never the code. */
(function () {
  // the form for the player (kid.js): girl | boy | neutral; neutral when there is no profile module
  function kg(f, m, x) { try { var K = window.KidApp; return K && K.g ? K.g(f, m, x) : x; } catch (e) { return x; } }
  var GAMES = [["annabelle-fb-", "football.html", "⚽"], ["annabelle-tk-", "thunderkittens.html", "⚡"], ["annabelle-bowling-", "bowling.html", "🎳"], ["annabelle-ck-", "checkers.html", "♟️"], ["annabelle-ttt-", "tictactoe.html", "❌"], ["annabelle-cups-", "cups.html", "🥤"], ["annabelle-cats-", "cats.html", "🐱"], ["annabelle-funrun-", "funrun.html", "👟"], ["annabelle-pong-", "pong.html", "🏓"], ["annabelle-simon-", "simon.html", "🎶"], ["annabelle-carrace-", "carrace.html", "🏎️"], ["annabelle-tetris-", "tetris.html", "🧱"], ["annabelle-safari-", "safari.html", "📸"], ["annabelle-snake-", "snake.html", "🐯"], ["annabelle-crossing-", "crossing.html", "🐥"], ["annabelle-breakout-", "breakout.html", "🐾"], ["annabelle-invaders-", "invaders.html", "🚀"]];
  var tools = document.querySelector(".tools"); if (!tools) return;
  var TX = {
    he: { t: "הצטרפות לחדר עם קוד", h: "🔑 הצטרפות עם קוד", p: function () { return kg('הקלידי את 6 הספרות שקיבלת', 'הקלד את 6 הספרות שקיבלת', 'הקלידו את 6 הספרות שקיבלתם') + ', ונפתח את המשחק הנכון'; }, go: function () { return "▶ " + kg('הצטרפי', 'הצטרף', 'הצטרפו'); }, x: "סגירה", six: "צריך 6 ספרות 🙂", look: "מחפשים את החדר… ⏳", look2: "עדיין מחפשים… אולי החדר עוד נפתח בטלפון השני ⏳", found: " נמצא! פותחים…", none: function () { return "לא נמצא חדר עם הקוד הזה. " + kg("בדקי", "בדוק", "בדקו") + " את הספרות, " + kg("ובקשי", "ובקש", "ובקשו") + " מהחבר או מהחברה להשאיר את המשחק פתוח (החדר פתוח 5 דקות)"; }, off: "אין חיבור לאינטרנט" },
    fr: { t: "Rejoindre une salle avec un code", h: "🔑 Rejoindre avec un code", p: function () { return "Tape les 6 chiffres que tu as reçus, et on ouvre le bon jeu"; }, go: function () { return "▶ Rejoindre"; }, x: "Fermer", six: "Il faut 6 chiffres 🙂", look: "On cherche la salle… ⏳", look2: "On cherche encore… la salle s'ouvre peut-être sur l'autre téléphone ⏳", found: " trouvé ! On ouvre…", none: function () { return "Aucune salle avec ce code. Vérifie les chiffres et demande à ton ami(e) de garder le jeu ouvert (la salle reste ouverte 5 minutes)"; }, off: "Pas de connexion internet" },
    en: { t: "Join a room with a code", h: "🔑 Join with a code", p: function () { return "Type the 6 digits you got, and we open the right game"; }, go: function () { return "▶ Join"; }, x: "Close", six: "It takes 6 digits 🙂", look: "Looking for the room… ⏳", look2: "Still looking… the room may just be opening on the other phone ⏳", found: " found! Opening…", none: function () { return "No room with this code. Check the digits and ask your friend to keep the game open (a room stays open for 5 minutes)"; }, off: "No internet connection" }
  };
  function L() { var l = null; try { l = localStorage.getItem("annabelle-lang"); } catch (e) {} return TX[l] || TX.he; }
  function tr(k) { var v = L()[k]; return typeof v === "function" ? v() : v; }
  function dg(ev, x) { try { var K = window.KidApp, o = { game: "home", role: "guest", ev: ev }; for (var k in x) o[k] = x[k]; K && K.track && K.track("net", o); } catch (e) {} }
  var css = document.createElement("style");
  css.textContent = "#jcBtn{margin-inline-end:6px;font-size:24px!important;width:48px!important;height:48px!important;padding:0!important;cursor:pointer}#jcBox{position:fixed;inset:0;background:#0008;display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}#jcBox.on{display:flex}#jcCard{background:#fff;color:#3a2459;border-radius:22px;padding:20px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 30px #0006;font-family:inherit}#jcCard h3{margin:0 0 8px;font-size:22px}#jcCard p{margin:0 0 12px;color:#555;font-size:15px}#jcIn{width:100%;font-size:32px;letter-spacing:6px;text-align:center;padding:10px;border:3px solid #ffb84d;border-radius:14px;box-sizing:border-box;direction:ltr}#jcSt{min-height:22px;margin:10px 0;font-size:16px;font-weight:700}#jcGo,#jcX{font-size:20px;padding:12px 18px;border-radius:14px;border:0;cursor:pointer;font-family:inherit;margin:4px}#jcGo{background:#27ae60;color:#fff;font-weight:800}#jcX{background:#eee}";
  document.head.appendChild(css);
  var b = document.createElement("button"); b.id = "jcBtn"; b.className = "albbtn"; b.type = "button"; b.textContent = "🔑"; b.title = tr("t"); b.setAttribute("aria-label", tr("t"));
  tools.insertBefore(b, tools.firstChild);
  var box = document.createElement("div"); box.id = "jcBox";
  box.innerHTML = '<div id="jcCard"><h3 id="jcH"></h3><p id="jcP"></p><input id="jcIn" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="______"><div id="jcSt"></div><button id="jcGo" type="button"></button><button id="jcX" type="button"></button></div>';
  document.body.appendChild(box);
  function draw() { var set = function (id, k) { document.getElementById(id).textContent = tr(k); }; set("jcH", "h"); set("jcP", "p"); set("jcGo", "go"); set("jcX", "x"); document.getElementById("jcCard").dir = L() === TX.he ? "rtl" : "ltr"; b.title = tr("t"); b.setAttribute("aria-label", tr("t")); }
  draw();
  var $ = function (i) { return document.getElementById(i); }, peer = null, busy = 0;
  function st(m, c) { var e = $("jcSt"); e.textContent = m; e.style.color = c || "#333"; }
  function stop() { busy++; if (peer) { try { peer.destroy(); } catch (e) {} peer = null; } }
  function open() { draw(); box.classList.add("on"); st(""); $("jcIn").value = ""; setTimeout(function () { $("jcIn").focus(); }, 50); }
  function close() { stop(); box.classList.remove("on"); }
  function loadPeer() { return new Promise(function (res, rej) { if (window.Peer) return res(); var s = document.createElement("script"); s.src = "vendor/peerjs.min.js"; s.onload = function () { window.Peer ? res() : rej(); }; s.onerror = rej; document.head.appendChild(s); }); }
  var ROUNDS = [0, 5000, 12000, 21000], LAST_WAIT = 12000; // when each round of questions starts (ms), and how long the last one may take
  function go() {
    var code = $("jcIn").value.replace(/\D/g, ""); if (code.length !== 6) { st(tr("six"), "#c0392b"); return; }
    stop(); var my = busy, t0 = Date.now(); st(tr("look")); dg("code_try", {});
    loadPeer().then(function () {
      if (my !== busy) return; var found = false, p = null, tried = [];
      var drop = function () { tried.forEach(function (c) { try { c.close(); } catch (e) {} }); tried = []; };
      var ask = function (n) { // one round: the same question to every game's room name
        if (found || my !== busy) return; drop(); if (n) st(tr("look2"));
        if (!p || p.destroyed) { p = peer = new Peer(undefined, { config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] } }); p.on("error", function () {}); p.on("open", function () { ask2(); }); }
        else if (p.disconnected) { try { p.reconnect(); } catch (e) {} }
        else if (p.open) ask2();
      };
      var ask2 = function () {
        if (found || my !== busy || tried.length) return;
        GAMES.forEach(function (g) {
          try {
            var c = p.connect(g[0] + code, { reliable: true }); tried.push(c);
            c.on("open", function () { if (found || my !== busy) return; found = true; try { c.close(); } catch (e) {} dg("code_found", { ms: Date.now() - t0 }); st(g[2] + tr("found"), "#27ae60"); setTimeout(function () { location.href = g[1] + "?room=" + code; }, 350); });
            c.on("error", function () {});
          } catch (e) {}
        });
      };
      ROUNDS.forEach(function (ms, n) { setTimeout(function () { ask(n); }, ms); });
      setTimeout(function () { if (!found && my === busy) { drop(); dg("code_none", { ms: Date.now() - t0 }); st(tr("none"), "#c0392b"); } }, ROUNDS[ROUNDS.length - 1] + LAST_WAIT);
    }).catch(function () { if (my === busy) st(tr("off"), "#c0392b"); });
  }
  b.onclick = open; $("jcX").onclick = close; $("jcGo").onclick = go;
  $("jcIn").addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
  box.addEventListener("click", function (e) { if (e.target === box) close(); });
  var q = new URLSearchParams(location.search).get("join"); if (/^\d{6}$/.test(q || "")) { open(); $("jcIn").value = q; go(); }
})();

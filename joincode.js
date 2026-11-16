/* Join any online room by its 6-digit code, straight from the home page.
   Rooms are named <game prefix> + code on the PeerJS server, so we ask each game's name for that code and
   open the game that answers. Nothing is sent but a connect attempt that is closed straight away. */
(function () {
  var GAMES = [["annabelle-fb-", "football.html", "⚽"], ["annabelle-tk-", "thunderkittens.html", "⚡"], ["annabelle-bowling-", "bowling.html", "🎳"], ["annabelle-ck-", "checkers.html", "♟️"], ["annabelle-ttt-", "tictactoe.html", "❌"], ["annabelle-cups-", "cups.html", "🥤"], ["annabelle-cats-", "cats.html", "🐱"], ["annabelle-funrun-", "funrun.html", "👟"]];
  var tools = document.querySelector(".tools"); if (!tools) return;
  var css = document.createElement("style");
  css.textContent = "#jcBtn{margin-inline-end:6px;font-size:24px!important;width:48px!important;height:48px!important;padding:0!important;cursor:pointer}#jcBox{position:fixed;inset:0;background:#0008;display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}#jcBox.on{display:flex}#jcCard{background:#fff;color:#3a2459;border-radius:22px;padding:20px;max-width:340px;width:100%;text-align:center;box-shadow:0 8px 30px #0006;font-family:inherit}#jcCard h3{margin:0 0 8px;font-size:22px}#jcCard p{margin:0 0 12px;color:#555;font-size:15px}#jcIn{width:100%;font-size:32px;letter-spacing:6px;text-align:center;padding:10px;border:3px solid #ffb84d;border-radius:14px;box-sizing:border-box;direction:ltr}#jcSt{min-height:22px;margin:10px 0;font-size:16px;font-weight:700}#jcGo,#jcX{font-size:20px;padding:12px 18px;border-radius:14px;border:0;cursor:pointer;font-family:inherit;margin:4px}#jcGo{background:#27ae60;color:#fff;font-weight:800}#jcX{background:#eee}";
  document.head.appendChild(css);
  var b = document.createElement("button"); b.id = "jcBtn"; b.className = "albbtn"; b.type = "button"; b.textContent = "🔑"; b.title = "הצטרפות לחדר עם קוד"; b.setAttribute("aria-label", "הצטרפות לחדר עם קוד");
  tools.insertBefore(b, tools.firstChild);
  var box = document.createElement("div"); box.id = "jcBox";
  box.innerHTML = '<div id="jcCard"><h3>🔑 הצטרפות עם קוד</h3><p>הקלידי את 6 הספרות שחברה שלחה, ונפתח את המשחק הנכון</p><input id="jcIn" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="______"><div id="jcSt"></div><button id="jcGo" type="button">▶ הצטרפי</button><button id="jcX" type="button">סגירה</button></div>';
  document.body.appendChild(box);
  var $ = function (i) { return document.getElementById(i); }, peer = null, busy = 0;
  function st(m, c) { var e = $("jcSt"); e.textContent = m; e.style.color = c || "#333"; }
  function stop() { busy++; if (peer) { try { peer.destroy(); } catch (e) {} peer = null; } }
  function open() { box.classList.add("on"); st(""); $("jcIn").value = ""; setTimeout(function () { $("jcIn").focus(); }, 50); }
  function close() { stop(); box.classList.remove("on"); }
  function loadPeer() { return new Promise(function (res, rej) { if (window.Peer) return res(); var s = document.createElement("script"); s.src = "vendor/peerjs.min.js"; s.onload = function () { window.Peer ? res() : rej(); }; s.onerror = rej; document.head.appendChild(s); }); }
  function go() {
    var code = $("jcIn").value.replace(/\D/g, ""); if (code.length !== 6) { st("צריך 6 ספרות 🙂", "#c0392b"); return; }
    stop(); var my = busy; st("מחפשת את החדר… ⏳");
    loadPeer().then(function () {
      if (my !== busy) return; var found = false, p = peer = new Peer(undefined, { config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] } });
      p.on("error", function () {});
      p.on("open", function () {
        if (my !== busy) return;
        GAMES.forEach(function (g) {
          try {
            var c = p.connect(g[0] + code, { reliable: true });
            c.on("open", function () { if (found || my !== busy) return; found = true; try { c.close(); } catch (e) {} st(g[2] + " מצאתי! פותחת…", "#27ae60"); setTimeout(function () { location.href = g[1] + "?room=" + code; }, 350); });
            c.on("error", function () {});
          } catch (e) {}
        });
        setTimeout(function () { if (!found && my === busy) st("לא מצאתי חדר עם הקוד הזה. בדקי את הספרות, או שהחדר נסגר (הוא פתוח 5 דקות)", "#c0392b"); }, 12000);
      });
    }).catch(function () { st("אין חיבור לאינטרנט", "#c0392b"); });
  }
  b.onclick = open; $("jcX").onclick = close; $("jcGo").onclick = go;
  $("jcIn").addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
  box.addEventListener("click", function (e) { if (e.target === box) close(); });
  var q = new URLSearchParams(location.search).get("join"); if (/^\d{6}$/.test(q || "")) { open(); $("jcIn").value = q; go(); }
})();

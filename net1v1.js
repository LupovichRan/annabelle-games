/* Annabelle games – shared ONLINE 1-vs-1 module (WebRTC via PeerJS). Turn-based, host-authoritative.
   Same secure design as the online bowling / football / thunderkittens:
     room code (6 digits) + secret in the WhatsApp invitation link, host approval for typed codes, mutual HMAC challenge
     (game secret) for every reconnect, 5-minute open-room countdown, weak-connection pill (4 s) and hard pause (20 s),
     quiet reconnect loops, every message from the network validated by the game before use.
   Usage (see tictactoe.html / cups.html / cats.html):
     const N=Net1v1({pid:"annabelle-xxx-", shareTxt:{he:"..",fr:"..",en:".."}, hideMenu(){}, showMenu(){},
        cleanStart(d){return {...}|null}, makeStart(){return {...}}, onHostStart(isRematch){}, onGuestStart(clean,isRematch){},
        onResume(){}, onData(d){}, onLeft(){}, onPause(on){}, sfx:{join(),click(),drop(),back(),huh()}});
     N.showLobby();  N.send(obj);  N.gameOn / N.over / N.host;  N.rematch();  N.leave();
   The game's own messages must use  t:<short string>  and are delivered to onData() only after authentication. */
(function () {
  'use strict';
  if (window.Net1v1) return;
  var TXO = {
    he: { back: "◀ חזרה", npaused: "החברה התנתקה… ממתינים שתתחבר מחדש ⏳", npausedS: "המשחק מושהה וימשיך בדיוק מאותו מקום", leave: "🏠 יציאה מהמשחק", left: "החברה יצאה מהמשחק 👋", roomLeft: "החדר פתוח עוד", expired: "⏰ הזמן נגמר והקוד כבר לא תקף. צרי חדר חדש", apprT: "מישהי מבקשת להצטרף למשחק 🔐", apprS: "אשרי רק אם גם אצל החברה שלך מופיע בדיוק המספר הזה", apprYes: "✅ אשרי", apprNo: "❌ דחי", pairMsg: "קוד אימות: N 🔐 מחכים שהחברה תאשר…", lobT: "משחק אונליין", create: "🏠 צרי חדר", join: "🔑 הצטרפי עם קוד", codeIs: "קוד החדר:", waitF: "מחכה לחברה… 🕐", share: "💬 שלחי לחברה בוואטסאפ", enter: "הקלידי את הקוד של החברה:", goC: "התחברי ▶", conn: "מתחבר… 🔌", reconn: "מתחבר מחדש… 🔌", failC: "לא הצלחתי להתחבר 😿 בדקי את הקוד ואת האינטרנט ונסי שוב", waitRe: "מחכה לחברה למשחק נוסף… 🕐", weakL: ["החיבור התעטש 🤧 ממשיכים!", "החתלתול של החברה נרדם על הקו 😴", "דג קטן נתקע בכבל 🐟", "פרפר ישב על הראוטר 🦋", "רגע, החתול מחפש את הוויי-פיי 📶😹"], friendN: "חברה 🐾" },
    fr: { back: "◀ Retour", npaused: "Ton ami s'est déconnecté… on attend sa reconnexion ⏳", npausedS: "Le match est en pause et reprendra au même endroit", leave: "🏠 Quitter la partie", left: "Ton ami a quitté la partie 👋", roomLeft: "Salle ouverte encore", expired: "⏰ Temps écoulé, le code n'est plus valable. Crée une nouvelle salle", apprT: "Quelqu'un veut rejoindre la partie 🔐", apprS: "Accepte seulement si ton amie voit exactement ce même nombre", apprYes: "✅ Accepter", apprNo: "❌ Refuser", pairMsg: "Code de vérification : N 🔐 on attend que ton amie accepte…", lobT: "Jeu en ligne", create: "🏠 Créer une salle", join: "🔑 Rejoindre avec un code", codeIs: "Code de la salle :", waitF: "J'attends ton ami… 🕐", share: "💬 Envoyer sur WhatsApp", enter: "Tape le code de ton ami :", goC: "Se connecter ▶", conn: "Connexion… 🔌", reconn: "Reconnexion… 🔌", failC: "Connexion impossible 😿 Vérifie le code et internet, puis réessaie", waitRe: "J'attends ton ami pour rejouer… 🕐", weakL: ["La connexion a éternué 🤧 on continue !", "Le chaton de ton ami dort sur la ligne 😴", "Un petit poisson est coincé dans le câble 🐟", "Un papillon s'est posé sur le routeur 🦋", "Une seconde, le chat cherche le Wi-Fi 📶😹"], friendN: "Ami(e) 🐾" },
    en: { back: "◀ Back", npaused: "Your friend disconnected… waiting for them to reconnect ⏳", npausedS: "The match is paused and will continue exactly where it stopped", leave: "🏠 Leave the game", left: "Your friend left the game 👋", roomLeft: "Room open for", expired: "⏰ Time's up, the code is no longer valid. Create a new room", apprT: "Someone wants to join the game 🔐", apprS: "Accept only if your friend sees exactly this same number", apprYes: "✅ Accept", apprNo: "❌ Decline", pairMsg: "Verification code: N 🔐 waiting for your friend to accept…", lobT: "Online game", create: "🏠 Create a room", join: "🔑 Join with a code", codeIs: "Room code:", waitF: "Waiting for your friend… 🕐", share: "💬 Send on WhatsApp", enter: "Type your friend's code:", goC: "Connect ▶", conn: "Connecting… 🔌", reconn: "Reconnecting… 🔌", failC: "Couldn't connect 😿 Check the code and internet, then try again", waitRe: "Waiting for your friend to rematch… 🕐", weakL: ["The connection sneezed 🤧 keep going!", "Your friend's kitten fell asleep on the line 😴", "A little fish got stuck in the cable 🐟", "A butterfly sat on the router 🦋", "Hang on, the cat is looking for Wi-Fi 📶😹"], friendN: "Friend 🐾" }
  };
  var CSS = '.n1ov{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:safe center;gap:12px;padding:max(14px,env(safe-area-inset-top)) 16px max(14px,env(safe-area-inset-bottom));z-index:90;text-align:center;overflow-y:auto;background:radial-gradient(circle at 50% 20%,#6a35b8,#2a1458 72%);color:#fff;font-family:Rubik,"Varela Round",Arial,sans-serif;direction:ltr}' +
    '.n1ov.show{display:flex}.n1ov h1{margin:0;font-size:clamp(30px,9vw,52px);color:#ffe14d;text-shadow:0 4px 0 #a2410f;line-height:1.1}' +
    '.n1b{min-width:200px;min-height:60px;border-radius:22px;font:900 22px Rubik,Arial,sans-serif;padding:8px 22px;box-shadow:0 6px 0 #0005;color:#fff;border:none;cursor:pointer;width:min(92vw,360px);background:linear-gradient(#a58bff,#7c5cff);touch-action:manipulation;display:flex;align-items:center;justify-content:center;text-decoration:none}' +
    '.n1b:active{transform:translateY(4px);box-shadow:0 2px 0 #0005}.n1b.g{background:linear-gradient(#5fd38d,#2fb36a)}.n1b.s{background:linear-gradient(#8aa0b8,#5b6f88)}' +
    '.n1pane{display:none;flex-direction:column;align-items:center;gap:10px}.n1pane.on{display:flex}.n1row{display:flex;flex-direction:column;gap:12px;align-items:center}' +
    '#n1Code{font-size:clamp(40px,13vw,72px);font-weight:900;letter-spacing:.12em;color:#ffe14d;direction:ltr;text-shadow:0 4px 0 #0006;line-height:1}' +
    '#n1In{width:min(80vw,300px);height:70px;border-radius:18px;border:3px solid #ffe14d;background:#fff;text-align:center;font:900 34px Rubik,Arial;color:#2c2150;letter-spacing:.12em;direction:ltr;user-select:text;-webkit-user-select:text}' +
    '#n1Cd{font-weight:900;font-size:26px;color:#9fe0ff;direction:ltr;min-height:32px}#n1Cd.low{color:#ff7a7a}' +
    '#n1St,#n1Wait{font-weight:800;font-size:18px;text-align:center;min-height:24px;max-width:90vw}' +
    '#n1Weak{position:fixed;left:50%;top:12%;transform:translateX(-50%);background:#fff8dc;color:#4a3300;border:2px solid #f2a900;border-radius:999px;padding:3px 12px;font-weight:800;font-size:14px;z-index:70;pointer-events:none;display:none;white-space:normal;text-align:center;box-shadow:0 2px 0 #0002;font-family:Rubik,Arial,sans-serif}#n1Weak.on{display:block}' +
    '#n1Appr,#n1Np{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#0008;font-family:Rubik,Arial,sans-serif;color:#fff}#n1Appr{z-index:95}#n1Np{z-index:92}#n1Appr.on,#n1Np.on{display:flex}' +
    '.n1card{background:#2c2150;border:3px solid #ffe14d;border-radius:22px;padding:18px;text-align:center;max-width:90vw;display:flex;flex-direction:column;gap:10px;align-items:center}.n1card h2{margin:0;font-size:22px;color:#ffe14d}#n1ApprN{font-size:64px;font-weight:900;color:#ffe14d;letter-spacing:.1em;direction:ltr;line-height:1}' +
    '.n1dance{display:inline-block;animation:n1dn .6s infinite alternate;font-size:54px}@keyframes n1dn{from{transform:rotate(-12deg)}to{transform:rotate(12deg)}}' +
    '#n1Dot{display:none;position:fixed;left:8px;bottom:8px;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 0 #0003;transition:background .4s;z-index:50;pointer-events:none}';
  var ROOM_SECS = 300, SOFT = 4000, HARD = 20000, PEER_SRC = "vendor/peerjs.min.js";
  function iceServers() {
    var own = null; try { own = JSON.parse(localStorage.getItem("annabelle-turn") || "null"); } catch (e) {}
    var base = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" },
      { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:80?transport=tcp", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp", "turns:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" }];
    return Array.isArray(own) && own.length ? own.concat(base) : base;
  }
  var rnd = function (n) { return Array.from(crypto.getRandomValues(new Uint8Array(n)), function (b) { return b.toString(16).padStart(2, "0"); }).join(""); };
  async function hmac(key, msg) { var e = new TextEncoder(), k = await crypto.subtle.importKey("raw", e.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, e.encode(msg))), function (b) { return b.toString(16).padStart(2, "0"); }).join(""); }
  function loadPeer() { return new Promise(function (res, rej) { if (window.Peer) return res(); var s = document.createElement("script"); s.src = PEER_SRC; s.onload = function () { window.Peer ? res() : rej(); }; s.onerror = function () { rej(); }; document.head.appendChild(s); setTimeout(rej, 12000); }); }

  window.Net1v1 = function (opts) {
    var PID = opts.pid, PEER_CFG = { config: { iceServers: iceServers(), iceCandidatePoolSize: 2 } };
    var sfx = Object.assign({ join: function () {}, click: function () {}, drop: function () {}, back: function () {}, huh: function () {} }, opts.sfx || {});
    var NET = { waitCode: null, rs: null, cand: null, joinSec: null, key: null, pend: new Set(), cd: null, peer: null, conn: null, host: false, code: "", myRe: false, oppRe: false, gen: 0, tm: null, rt: null, paused: false, last: 0, rec: false, wt: null, wi: -1, tickAt: 0, gameOn: false, over: false, weak: false, msgN: 0, msgT: 0 };
    var N = { NET: NET, t: t, send: netSend, leave: netLeave, close: netClose, showLobby: showLobby, rematch: rematch, setOver: function (v) { NET.over = !!v; if (!v) { NET.myRe = NET.oppRe = false; } }, lang: lang, TXO: TXO };
    Object.defineProperties(N, { gameOn: { get: function () { return NET.gameOn; } }, over: { get: function () { return NET.over; } }, host: { get: function () { return NET.host; } }, paused: { get: function () { return NET.paused; } }, connected: { get: function () { return !!(NET.conn && NET.conn.open); } }, myRe: { get: function () { return NET.myRe; } } });
    function lang() { var l = null; try { l = localStorage.getItem("annabelle-lang"); } catch (e) {} return l === "fr" || l === "en" ? l : "he"; }
    function t(k) { var L = TXO[lang()]; return (L && L[k] !== undefined) ? L[k] : TXO.he[k]; }
    var $ = function (id) { return document.getElementById(id); };
    // ---- DOM ----
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var box = document.createElement("div");
    box.innerHTML = '<div class="n1ov" id="n1Lob"><h1 id="n1T"></h1><div style="font-size:54px">📱🐾📱</div>' +
      '<div class="n1row" id="n1Main"><button class="n1b" id="n1Create"></button><button class="n1b g" id="n1Join"></button></div>' +
      '<div class="n1pane" id="n1CreateP"><div style="font-weight:800" id="n1CodeL"></div><div id="n1Code"></div><a class="n1b" id="n1Wa" target="_blank" rel="noopener"></a><div id="n1Wait"></div><div id="n1Cd"></div></div>' +
      '<div class="n1pane" id="n1JoinP"><div style="font-weight:800" id="n1InL"></div><input id="n1In" type="text" inputmode="numeric" maxlength="6" autocomplete="off"><button class="n1b" id="n1Conn"></button></div>' +
      '<div id="n1St"></div><button class="n1b s" id="n1Back"></button></div>' +
      '<div id="n1Np"><div class="n1card"><div class="n1dance">🔌</div><h2 id="n1NpT"></h2><div id="n1NpS" style="font-weight:700"></div><button class="n1b g" id="n1NpLeave"></button></div></div>' +
      '<div id="n1Appr"><div class="n1card"><h2 id="n1ApprT"></h2><div id="n1ApprN"></div><div id="n1ApprS" style="font-weight:700"></div><div style="display:flex;gap:10px"><button class="n1b g" id="n1Yes" style="min-width:0;width:auto"></button><button class="n1b s" id="n1No" style="min-width:0;width:auto"></button></div></div></div>' +
      '<div id="n1Weak"></div><i id="n1Dot" aria-hidden="true"></i>';
    while (box.firstChild) document.body.appendChild(box.firstChild);
    function drawLang() {
      var set = function (id, k) { var e = $(id); if (e) e.textContent = t(k); };
      set("n1T", "lobT"); set("n1Create", "create"); set("n1Join", "join"); set("n1CodeL", "codeIs"); set("n1InL", "enter"); set("n1Conn", "goC"); set("n1Back", "back"); set("n1NpLeave", "leave");
      set("n1ApprT", "apprT"); set("n1ApprS", "apprS"); set("n1Yes", "apprYes"); set("n1No", "apprNo"); set("n1Wa", "share"); set("n1Wait", "waitF");
      var lb = $("n1Lob"); lb.dir = lang() === "he" ? "rtl" : "ltr";
      if (NET.paused && NET.gameOn) { $("n1NpT").textContent = t(NET.host ? "npaused" : "reconn"); $("n1NpS").textContent = t("npausedS"); }
    }
    N.drawLang = drawLang; drawLang();
    function setPaused(on) {
      if (on !== NET.paused && NET.gameOn) on ? sfx.drop() : sfx.back();
      NET.paused = on; $("n1Np").classList.toggle("on", on);
      if (on) { $("n1NpT").textContent = t(NET.host ? "npaused" : "reconn"); $("n1NpS").textContent = t("npausedS"); }
      else { clearTimeout(NET.rt); NET.rt = null; }
      if (opts.onPause) opts.onPause(on);
    }
    function stopCd() { clearInterval(NET.cd); NET.cd = null; $("n1Cd").textContent = ""; $("n1Cd").classList.remove("low"); }
    function startCd(gen) {
      stopCd(); var end = Date.now() + ROOM_SECS * 1000;
      var tick = function () {
        if (gen !== NET.gen) { stopCd(); return; } var left = Math.max(0, Math.round((end - Date.now()) / 1000));
        $("n1Cd").textContent = t("roomLeft") + " " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0"); $("n1Cd").classList.toggle("low", left <= 30);
        if (left <= 0) { lobFail(); $("n1St").textContent = t("expired"); }
      };
      tick(); NET.cd = setInterval(tick, 500);
    }
    function netClose() {
      stopCd(); NET.gen++; clearTimeout(NET.tm); clearTimeout(NET.rt); var c = NET.conn, p = NET.peer; NET.conn = null; NET.peer = null; NET.myRe = NET.oppRe = false; NET.paused = false; NET.rec = false; weakHide(); NET.key = null; NET.waitCode = null; NET.rs = null; NET.cand = null; NET.joinSec = null; NET.gameOn = false;
      $("n1Appr").classList.remove("on"); $("n1Np").classList.remove("on"); NET.pend.forEach(function (x) { try { x.close(); } catch (e) {} }); NET.pend.clear(); try { c && c.close(); } catch (e) {} try { p && p.destroy(); } catch (e) {}
    }
    function netLeave() {
      var c = NET.conn, p = NET.peer; if (NET.gameOn) netSend({ t: "bye" }); NET.conn = null; NET.peer = null; netClose();
      setTimeout(function () { try { c && c.close(); } catch (e) {} try { p && p.destroy(); } catch (e) {} }, 400); hideLob();
    }
    function netSend(o) { try { if (NET.conn && NET.conn.open) NET.conn.send(o); } catch (e) {} }
    function rematch() { if (!NET.gameOn || NET.myRe) return; NET.myRe = true; netSend({ t: "rematch" }); maybeRematch(); }
    function lobPane(w) { ["n1Main", "n1CreateP", "n1JoinP"].forEach(function (id) { var e = $(id); if (id === "n1Main") e.style.display = w === "n1Main" ? "" : "none"; else e.classList.toggle("on", id === w); }); }
    function showLob() { if (opts.hideMenu) opts.hideMenu(); drawLang(); $("n1Lob").classList.add("show"); }
    function hideLob() { $("n1Lob").classList.remove("show"); }
    function showLobby() { netClose(); $("n1St").textContent = ""; lobPane("n1Main"); showLob(); }
    function lobFail() { netClose(); $("n1St").textContent = t("failC"); lobPane("n1Main"); }
    function hostPeer(code, gen, resume) {
      var p = new Peer(PID + code, PEER_CFG); NET.peer = p;
      p.on("open", function () {
        if (gen !== NET.gen) return; NET.host = true; NET.code = code;
        if (resume === "wait") { $("n1St").textContent = ""; return; }
        if (resume) return;
        NET.rs = rnd(16); NET.waitCode = code;
        $("n1Code").textContent = code; var url = location.origin + location.pathname + "?room=" + code + "&s=" + NET.rs;
        var st2 = opts.shareTxt || {}; $("n1Wa").href = "https://wa.me/?text=" + encodeURIComponent((st2[lang()] || st2.he || "") + " " + url);
        $("n1St").textContent = ""; lobPane("n1CreateP"); startCd(gen);
      });
      p.on("disconnected", function () { if (gen !== NET.gen || p.destroyed) return; if (NET.waitCode && !NET.gameOn) hostRecover(); else try { p.reconnect(); } catch (e) {} });
      p.on("connection", function (c) {
        if (gen !== NET.gen) return;
        if (!NET.key) { // fresh room: the first friend in is accepted (the room code is the secret, valid only for the countdown)
          if (NET.conn || NET.gameOn || NET.pend.size >= 4) { try { c.close(); } catch (e) {} return; }
          c.fresh = true; attach(c, gen, true);
        } else { // a game exists: only someone who proves they know the game secret can (re)connect
          if (NET.pend.size >= 3) { try { c.close(); } catch (e) {} return; }
          attach(c, gen, true);
        }
      });
      p.on("error", function (e) {
        if (gen !== NET.gen) return;
        if (NET.waitCode && !NET.gameOn) {
          if (e && e.type === "unavailable-id") { clearTimeout(NET.rt); NET.rt = setTimeout(function () { if (gen === NET.gen && NET.waitCode && !NET.gameOn) { try { p.destroy(); } catch (x) {} hostPeer(NET.waitCode, gen, "wait"); } }, 2000); }
          else hostRecover();
          return;
        }
        if (NET.gameOn) {
          if (e && e.type === "unavailable-id" && NET.rec) { clearTimeout(NET.rt); NET.rt = setTimeout(function () { if (gen === NET.gen && NET.rec) { try { p.destroy(); } catch (x) {} hostPeer(NET.code, gen, true); } }, 3000); }
          return;
        }
        if (e && e.type === "unavailable-id") createRoom(); else lobFail();
      });
    }
    function hostRecover(force) {
      if (!NET.waitCode || NET.gameOn) return; var gen = NET.gen, p = NET.peer;
      if (!force && p && !p.destroyed && p.open && !p.disconnected) return;
      try { p && p.destroy(); } catch (e) {}
      $("n1St").textContent = t("reconn");
      clearTimeout(NET.rt); NET.rt = setTimeout(function () { if (gen === NET.gen && NET.waitCode && !NET.gameOn) hostPeer(NET.waitCode, gen, "wait"); }, 1200);
    }
    function createRoom() {
      netClose(); var gen = NET.gen; $("n1St").textContent = t("conn"); lobPane("none");
      loadPeer().then(function () { if (gen !== NET.gen) return; hostPeer(String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000), gen, false); }).catch(function () { if (gen === NET.gen) lobFail(); });
    }
    function joinRoom(code, sec) {
      netClose(); var gen = NET.gen; NET.code = code; NET.joinSec = sec || null; $("n1St").textContent = t("conn"); lobPane("none"); showLob();
      loadPeer().then(function () {
        if (gen !== NET.gen) return;
        var p = new Peer(undefined, PEER_CFG); NET.peer = p; var cur = null, attempt = 0;
        var joined = function () { return NET.conn && NET.conn.open; };
        var go = function () {
          if (gen !== NET.gen || joined()) return; attempt++;
          if (attempt > 4) { lobFail(); return; }
          $("n1St").textContent = t("conn") + (attempt > 1 ? " (" + attempt + "/4)" : "");
          if (cur) { try { cur.close(); } catch (e) {} }
          NET.host = false; cur = p.connect(PID + code, { reliable: true }); attach(cur, gen);
          clearTimeout(NET.tm); NET.tm = setTimeout(function () { if (gen === NET.gen && !joined()) go(); }, 13000);
        };
        p.on("open", function () { if (gen === NET.gen) go(); });
        p.on("error", function (e) {
          if (gen !== NET.gen || NET.gameOn) return; var ty = e && e.type;
          if (ty === "peer-unavailable" || ty === "webrtc" || ty === "negotiation" || ty === "socket-error" || ty === "socket-closed") { clearTimeout(NET.tm); NET.tm = setTimeout(go, 3000); }
          else lobFail();
        });
      }).catch(function () { if (gen === NET.gen) lobFail(); });
    }
    function admit(c) {
      if (NET.cand && NET.cand !== c) { try { NET.cand.close(); } catch (e) {} } NET.cand = null; $("n1Appr").classList.remove("on");
      if (NET.conn || !c.open) return; c.authed = true; NET.pend.delete(c); clearTimeout(c.to); c.fin();
    }
    function askApproval(c) {
      c.pair = String(10 + crypto.getRandomValues(new Uint32Array(1))[0] % 90); clearTimeout(c.to); c.to = setTimeout(function () { if (NET.cand === c) { try { c.close(); } catch (e) {} } }, 60000);
      try { c.send({ t: "pair", n: c.pair }); } catch (e) {}
      $("n1ApprN").textContent = c.pair; $("n1Appr").classList.add("on"); sfx.join();
      $("n1Yes").onclick = function () { sfx.click(); if (NET.cand === c) admit(c); };
      $("n1No").onclick = function () { sfx.click(); NET.cand = null; $("n1Appr").classList.remove("on"); try { c.close(); } catch (e) {} };
    }
    function attach(c, gen, pending) {
      c.myN = rnd(16); if (c.authed === undefined) c.authed = false;
      if (pending) NET.pend.add(c); else NET.conn = c;
      var opened = false;
      var finish = function () {
        if (gen !== NET.gen) return; NET.pend.delete(c); clearTimeout(c.to);
        if (NET.conn && NET.conn !== c) { var o = NET.conn; NET.conn = null; try { o.close(); } catch (e) {} }
        NET.conn = c; NET.last = Date.now(); clearTimeout(NET.tm); NET.rec = false;
        if (NET.host) { if (NET.gameOn) hostResume(); else startOnlineHost(); } else netSend({ t: "hello" });
      };
      var op = function () {
        if (opened || gen !== NET.gen) return; opened = true;
        c.to = setTimeout(function () { if (!c.authed) { NET.pend.delete(c); try { c.close(); } catch (e) {} } }, 10000);
        if (NET.key) { try { c.send({ t: "ch", n: c.myN }); } catch (e) {} }
        else if (!NET.host) { try { c.send({ t: "join", s: NET.joinSec }); } catch (e) {} }
      };
      c.fin = finish;
      var watchIce = function () {
        var pc = c.peerConnection; if (!pc || c._w) return; c._w = 1;
        pc.addEventListener("iceconnectionstatechange", function () {
          var s = pc.iceConnectionState; clearTimeout(c.iceT);
          if (s === "failed" || s === "closed") gone();
          else if (s === "disconnected") c.iceT = setTimeout(function () { var x = pc.iceConnectionState; if (x !== "connected" && x !== "completed") gone(); }, 15000);
        });
      };
      setTimeout(watchIce, 0); setTimeout(watchIce, 800);
      c.on("open", function () { watchIce(); op(); });
      c.on("data", async function (d) {
        try {
          if (gen !== NET.gen || !d || typeof d !== "object" || Array.isArray(d)) return;
          var ty = d.t; if (typeof ty !== "string" || ty.length > 12) return;
          if (ty === "ch" && NET.key && typeof d.n === "string" && /^[0-9a-f]{32}$/.test(d.n)) { var h = await hmac(NET.key, "R" + (NET.host ? "h" : "g") + d.n); try { c.send({ t: "pr", h: h }); } catch (e) {} return; }
          if (ty === "pr" && NET.key && typeof d.h === "string") { if (c.authed) return; var want = await hmac(NET.key, "R" + (NET.host ? "g" : "h") + c.myN); if (gen !== NET.gen) return; if (d.h === want) { c.authed = true; finish(); } else { NET.pend.delete(c); try { c.close(); } catch (e) {} } return; }
          if (c.fresh && NET.host && !NET.key) { // room still open: invitation link (secret) joins directly, a typed code needs the host's approval
            if (ty !== "join") return;
            var sec = typeof d.s === "string" && /^[0-9a-f]{32}$/.test(d.s) ? d.s : null;
            if (NET.conn) { try { c.close(); } catch (e) {} return; }
            if (sec && NET.rs && sec === NET.rs) admit(c);
            else if (!sec && !NET.cand) { NET.cand = c; askApproval(c); }
            else { try { c.close(); } catch (e) {} }
            return;
          }
          if (!c.authed && !NET.host && ty === "pair" && !NET.key && typeof d.n === "string" && /^\d{2}$/.test(d.n)) { $("n1St").textContent = t("pairMsg").replace("N", d.n); clearTimeout(NET.tm); NET.tm = setTimeout(function () { if (gen === NET.gen && !NET.key) lobFail(); }, 70000); return; }
          if (!c.authed) { // first contact of a joining friend: take the game secret from the host's first "start"
            if (ty === "start" && !NET.host && !NET.key && typeof d.k === "string" && /^[0-9a-f]{32}$/.test(d.k) && opts.cleanStart(d)) { NET.key = d.k; c.authed = true; clearTimeout(c.to); NET.last = Date.now(); onNetData(d); }
            return;
          }
          if (NET.conn !== c) return;
          // simple flood limiter: at most 80 messages per second from the friend
          var now = Date.now(); if (now - NET.msgT > 1000) { NET.msgT = now; NET.msgN = 0; } if (++NET.msgN > 80) return;
          NET.last = Date.now(); onNetData(d);
        } catch (e) {}
      });
      var gone = function () { NET.pend.delete(c); if (NET.cand === c) { NET.cand = null; $("n1Appr").classList.remove("on"); } if (gen === NET.gen && NET.conn === c) onNetClose(); };
      c.on("close", gone); c.on("error", gone);
      if (c.open) op();
    }
    // ---- match flow ----
    function startMsg(resume) { return Object.assign({}, opts.makeStart ? opts.makeStart() : {}, { t: "start", k: NET.key, r: resume ? 1 : 0 }); }
    function startOnlineHost(isRe) {
      stopCd(); NET.waitCode = null; sfx.join(); if (!NET.key) NET.key = rnd(16); hideLob(); NET.gameOn = true; NET.over = false; NET.myRe = NET.oppRe = false;
      opts.onHostStart(!!isRe); netSend(startMsg(false));
    }
    function hostResume() { weakHide(); setPaused(false); netSend(startMsg(true)); if (opts.onResume) opts.onResume(); }
    function maybeRematch() { if (NET.host && NET.myRe && NET.oppRe && NET.conn) { NET.myRe = NET.oppRe = false; startOnlineHost(true); } }
    function onNetData(d) {
      var ty = d.t;
      if (ty === "start" && !NET.host) {
        var c = opts.cleanStart(d); if (!c || d.k !== NET.key) return;
        if (d.r === 1 && NET.gameOn && !NET.over) { weakHide(); setPaused(false); if (opts.onResume) opts.onResume(); }
        else { sfx.join(); setPaused(false); hideLob(); NET.gameOn = true; NET.over = false; NET.myRe = NET.oppRe = false; opts.onGuestStart(c, d.r === 2); }
        return;
      }
      if (ty === "rematch" && NET.gameOn) { sfx.click(); NET.oppRe = true; maybeRematch(); return; }
      if (ty === "bye") { var had = NET.gameOn; if (had) sfx.drop(); netClose(); setPaused(false); if (had) { if (opts.onLeft) opts.onLeft(); } else lobFail(); return; }
      if (ty === "ping" || ty === "hello" || ty === "start" || ty === "rematch") return;
      if (NET.gameOn && opts.onData) opts.onData(d);
    }
    function onNetClose() {
      if (!NET.gameOn) { if (NET.conn || NET.peer) lobFail(); return; }
      var c = NET.conn; NET.conn = null; try { c && c.close(); } catch (e) {}
      if (NET.over) { netClose(); setPaused(false); if (opts.onLeft) opts.onLeft(); return; }
      startRecover();
    }
    function startRecover() { if (!NET.gameOn || NET.over) return; NET.rec = true; if (NET.host) hostLoop(); else guestLoop(); }
    function hardLost() { setPaused(true); weakHide(); if (NET.conn) onNetClose(); else if (!NET.rec) startRecover(); }
    function netResume() { if (!NET.paused) return; setPaused(false); NET.rec = false; weakHide(); if (NET.host && opts.onResume) opts.onResume(); }
    function weakLine() { var L = t("weakL"); NET.wi = (NET.wi + 1 + Math.random() * (L.length - 1) | 0) % L.length; var e = $("n1Weak"); e.textContent = L[NET.wi]; e.style.maxWidth = Math.max(160, innerWidth - 16) + "px"; }
    function weakSet(on) { if (!NET.gameOn || on === NET.weak) return; NET.weak = on; if (on) { weakLine(); $("n1Weak").classList.add("on"); clearInterval(NET.wt); NET.wt = setInterval(weakLine, 3500); sfx.huh(); } else weakHide(); }
    function weakHide() { clearInterval(NET.wt); NET.wt = null; $("n1Weak").classList.remove("on"); NET.weak = false; }
    function guestLoop() {
      clearTimeout(NET.rt); if (!NET.rec || NET.host || !NET.gameOn) return; var gen = NET.gen;
      function tryConnect() {
        if (gen !== NET.gen || !NET.rec || !NET.peer) return; if (NET.conn && NET.conn.open) return;
        if (NET.conn) { var o = NET.conn; NET.conn = null; try { o.close(); } catch (e) {} }
        try { attach(NET.peer.connect(PID + NET.code, { reliable: true }), gen); } catch (e) {}
      }
      function go() {
        if (gen !== NET.gen || !NET.rec) return; var p = NET.peer;
        if (!p || p.destroyed || p.disconnected || !p.open) {
          try { p && p.destroy(); } catch (e) {}
          loadPeer().then(function () { if (gen !== NET.gen || !NET.rec) return; var np = new Peer(undefined, PEER_CFG); NET.peer = np; np.on("open", function () { if (gen === NET.gen && NET.rec) tryConnect(); }); np.on("error", function () {}); }).catch(function () {});
        } else tryConnect();
        NET.rt = setTimeout(go, 4500);
      }
      go();
    }
    function hostLoop() {
      clearTimeout(NET.rt); if (!NET.rec || !NET.host || !NET.gameOn) return; var gen = NET.gen;
      (function go() {
        if (gen !== NET.gen || !NET.rec) return; var p = NET.peer;
        if (!p || p.destroyed) { loadPeer().then(function () { if (gen === NET.gen && NET.rec && (!NET.peer || NET.peer.destroyed)) hostPeer(NET.code, gen, true); }).catch(function () {}); }
        else if (p.disconnected) { try { p.reconnect(); } catch (e) {} }
        NET.rt = setTimeout(go, 4500);
      })();
    }
    function netKick() {
      if (NET.waitCode && !NET.gameOn) { var lg = Date.now() - (window.__hidAt || Date.now()) > 2500; window.__hidAt = 0; hostRecover(lg); return; }
      if (!NET.gameOn) return;
      if (NET.rec) { if (NET.host) { var p = NET.peer; if (p && p.disconnected && !p.destroyed) try { p.reconnect(); } catch (e) {} } else guestLoop(); }
      else netSend({ t: "ping" });
    }
    function netQ() {
      var d = $("n1Dot"); if (!d) return; if (!NET.gameOn) { d.style.display = "none"; return; }
      var a = NET.paused ? 9e9 : Date.now() - NET.last; d.style.display = "block"; d.style.background = a < SOFT ? "#2fb36a" : a < HARD ? "#f2c94c" : "#e23b3b";
    }
    var hbN = 0;
    setInterval(function () {
      var now = Date.now();
      if (NET.tickAt && now - NET.tickAt > 3000) NET.last = now; // our own timers were frozen (phone asleep): says nothing about the friend
      NET.tickAt = now; netQ();
      if (!NET.gameOn) { weakHide(); return; }
      if (++hbN % 4 === 0) netSend({ t: "ping" });
      if (document.hidden || NET.over) return;
      var q = now - NET.last;
      if (NET.paused) { if (NET.conn && NET.conn.open && q < 2500) netResume(); return; }
      if (q > HARD) hardLost(); else weakSet(q > SOFT);
    }, 500);
    document.addEventListener("visibilitychange", function () { if (document.hidden) window.__hidAt = Date.now(); if (document.visibilityState === "visible") { NET.last = Date.now(); NET.tickAt = Date.now(); netKick(); } });
    addEventListener("online", netKick); addEventListener("pageshow", netKick); addEventListener("focus", netKick);
    $("n1NpLeave").addEventListener("click", function () { sfx.click(); netLeave(); if (opts.showMenu) opts.showMenu(); });
    $("n1Create").addEventListener("click", function () { sfx.click(); createRoom(); });
    $("n1Join").addEventListener("click", function () { sfx.click(); lobPane("n1JoinP"); $("n1St").textContent = ""; $("n1In").value = ""; $("n1In").focus(); });
    $("n1Conn").addEventListener("click", function () { var c = $("n1In").value.replace(/\D/g, ""); if (c.length === 6) { sfx.click(); joinRoom(c); } });
    $("n1In").addEventListener("input", function (e) { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
    $("n1In").addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") $("n1Conn").click(); });
    $("n1Back").addEventListener("click", function () { sfx.click(); netClose(); hideLob(); if (opts.showMenu) opts.showMenu(); });
    N.hideLobby = hideLob;
    N.leaveToMenu = function () { if (NET.gameOn || NET.conn || NET.peer || NET.waitCode) netLeave(); hideLob(); };
    // invitation link:  ?room=123456&s=<secret>
    var U = new URLSearchParams(location.search), q = U.get("room") || "", sc = /^[0-9a-f]{32}$/.test(U.get("s") || "") ? U.get("s") : null;
    if (q || U.has("s")) try { history.replaceState(null, "", location.pathname); } catch (e) {}
    if (/^\d{6}$/.test(q)) setTimeout(function () { if (opts.onLink) opts.onLink(); lobPane("none"); joinRoom(q, sc); }, 0);
    return N;
  };
})();

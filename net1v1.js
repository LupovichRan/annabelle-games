/* Annabelle games – shared ONLINE 1-vs-1 module (WebRTC via PeerJS). Turn-based, host-authoritative.
   Same secure design as the online bowling / football / thunderkittens:
     room code (6 digits) + secret in the WhatsApp invitation link, host approval for typed codes, mutual HMAC challenge
     (game secret) for every reconnect, 5-minute open-room countdown, weak-connection pill (4 s) and hard pause (20 s),
     quiet reconnect loops, every message from the network validated by the game before use.
   Getting two phones together (the part that used to fail when the room owner was in WhatsApp while the friend opened the link):
     · the friend keeps trying for the whole life of the room (backoff, plain words about what is happening, a "try again" button,
       and at the very end the room code as a second way in); a link that dropped in the middle is tried again, never a dead end;
     · the room owner keeps the SAME place on the signalling server when the app comes back to the front (same id + same private
       token, only the socket is renewed), so a friend who is in the middle of joining, or waiting for approval, is not thrown out;
     · {t:"no"} tells a refused friend to stop (room full / wrong invitation / declined) - it carries nothing else;
     · anonymous diagnostics: KidApp.track('net', {game, role, ev, ms, a, n, ice, cand, err, hid, gap, sig, via, pwa}) at every stage
       (docs/TELEMETRY.md) - never a room code, a secret, an address or a name - and the last stages in the bug report (N.diag()).
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
    he: { back: "◀ חזרה", npaused: "החיבור התנתק… ממתינים לחיבור מחדש ⏳", npausedS: "המשחק מושהה וימשיך בדיוק מאותו מקום", leave: "🏠 יציאה מהמשחק", left: "מי ששיחק איתך יצא מהמשחק 👋", roomLeft: "החדר פתוח עוד", expired: "⏰ הזמן נגמר והקוד כבר לא תקף. [[צרי|צור|צרו]] חדר חדש", apprT: "יש בקשה להצטרף למשחק 🔐", apprS: "[[אשרי|אשר|אשרו]] רק אם בדיוק אותו מספר מופיע גם בטלפון השני", apprYes: "✅ [[אשרי|אשר|אשרו]]", apprNo: "❌ [[דחי|דחה|דחו]]", pairMsg: "קוד אימות: N 🔐 מחכים לאישור מהטלפון השני…", lobT: "משחק אונליין", create: "🏠 [[צרי|צור|צרו]] חדר", join: "🔑 [[הצטרפי|הצטרף|הצטרפו]] עם קוד", codeIs: "קוד החדר:", waitF: "מחכים שיצטרפו למשחק… 🕐", share: "💬 [[שלחי|שלח|שלחו]] הזמנה בוואטסאפ", enter: "[[הקלידי את הקוד שקיבלת|הקלד את הקוד שקיבלת|הקלידו את הקוד שקיבלתם]]:", goC: "[[התחברי|התחבר|התחברו]] ▶", conn: "מתחבר… 🔌", reconn: "מתחבר מחדש… 🔌", failC: "החיבור לא הצליח 😿 [[בדקי את הקוד ואת האינטרנט ונסי|בדוק את הקוד ואת האינטרנט ונסה|בדקו את הקוד ואת האינטרנט ונסו]] שוב", waitRe: "מחכים למשחק נוסף… 🕐", weakL: ["החיבור התעטש 🤧 ממשיכים!", "חתלתול נרדם על הקו 😴", "דג קטן נתקע בכבל 🐟", "פרפר ישב על הראוטר 🦋", "רגע, החתול מחפש את הוויי-פיי 📶😹"], friendN: "חברים 🐾", hint: "[[אחרי ששלחת את ההזמנה, חזרי לכאן והשאירי|אחרי ששלחת את ההזמנה, חזור לכאן והשאר|אחרי ששלחתם את ההזמנה, חזרו לכאן והשאירו]] את המשחק פתוח 📱", share2: "📤 [[שלחי|שלח|שלחו]] בדרך אחרת", roomOk: "✅ החדר עדיין פתוח", jWait: "מחכים שהחבר או החברה יחזרו למשחק… ⏳", jAsk: "הטלפון השני לא עונה 📵 [[בקשי|בקש|בקשו]] מהחבר או מהחברה לפתוח את המשחק ולהשאיר אותו פתוח", retry: "🔄 [[נסי|נסה|נסו]] שוב", failJ: "לא הצלחנו להתחבר 😿 [[בקשי|בקש|בקשו]] מהחבר או מהחברה לפתוח את המשחק, ואז [[נסי|נסה|נסו]] שוב", codeAlt: "אפשר גם להצטרף עם קוד החדר:", rejJ: "אי אפשר להצטרף: החדר כבר מלא או שההזמנה כבר לא בתוקף. [[בקשי|בקש|בקשו]] הזמנה חדשה 💌", verJ: "צריך את הגרסה החדשה של המשחק 🔄 [[רענני|רענן|רעננו]] את הדף בשני הטלפונים [[ונסי|ונסה|ונסו]] שוב" },
    fr: { back: "◀ Retour", npaused: "La connexion est coupée… on attend la reconnexion ⏳", npausedS: "Le match est en pause et reprendra au même endroit", leave: "🏠 Quitter la partie", left: "Ton ami(e) a quitté la partie 👋", roomLeft: "Salle ouverte encore", expired: "⏰ Temps écoulé, le code n'est plus valable. Crée une nouvelle salle", apprT: "Quelqu'un veut rejoindre la partie 🔐", apprS: "Accepte seulement si l'autre téléphone montre exactement ce même nombre", apprYes: "✅ Accepter", apprNo: "❌ Refuser", pairMsg: "Code de vérification : N 🔐 on attend l'accord de l'autre téléphone…", lobT: "Jeu en ligne", create: "🏠 Créer une salle", join: "🔑 Rejoindre avec un code", codeIs: "Code de la salle :", waitF: "J'attends ton ami(e)… 🕐", share: "💬 Envoyer sur WhatsApp", enter: "Tape le code que tu as reçu :", goC: "Se connecter ▶", conn: "Connexion… 🔌", reconn: "Reconnexion… 🔌", failC: "Connexion impossible 😿 Vérifie le code et internet, puis réessaie", waitRe: "J'attends ton ami(e) pour rejouer… 🕐", weakL: ["La connexion a éternué 🤧 on continue !", "Un chaton dort sur la ligne 😴", "Un petit poisson est coincé dans le câble 🐟", "Un papillon s'est posé sur le routeur 🦋", "Une seconde, le chat cherche le Wi-Fi 📶😹"], friendN: "Ami(e) 🐾", hint: "Après avoir envoyé l'invitation, reviens ici et garde le jeu ouvert 📱", share2: "📤 Envoyer autrement", roomOk: "✅ La salle est toujours ouverte", jWait: "On attend que ton ami(e) revienne dans le jeu… ⏳", jAsk: "Le téléphone de ton ami(e) ne répond pas 📵 Demande-lui d'ouvrir le jeu et de le garder ouvert", retry: "🔄 Réessayer", failJ: "Connexion impossible 😿 Demande à ton ami(e) d'ouvrir le jeu, puis réessaie", codeAlt: "Tu peux aussi rejoindre avec le code de la salle :", rejJ: "Impossible de rejoindre : la salle est déjà pleine ou l'invitation n'est plus valable. Demande une nouvelle invitation 💌", verJ: "Il faut la nouvelle version du jeu 🔄 Rechargez la page sur les deux téléphones, puis réessayez" },
    en: { back: "◀ Back", npaused: "Your friend disconnected… waiting for them to reconnect ⏳", npausedS: "The match is paused and will continue exactly where it stopped", leave: "🏠 Leave the game", left: "Your friend left the game 👋", roomLeft: "Room open for", expired: "⏰ Time's up, the code is no longer valid. Create a new room", apprT: "Someone wants to join the game 🔐", apprS: "Accept only if your friend sees exactly this same number", apprYes: "✅ Accept", apprNo: "❌ Decline", pairMsg: "Verification code: N 🔐 waiting for your friend to accept…", lobT: "Online game", create: "🏠 Create a room", join: "🔑 Join with a code", codeIs: "Room code:", waitF: "Waiting for your friend… 🕐", share: "💬 Send on WhatsApp", enter: "Type your friend's code:", goC: "Connect ▶", conn: "Connecting… 🔌", reconn: "Reconnecting… 🔌", failC: "Couldn't connect 😿 Check the code and internet, then try again", waitRe: "Waiting for your friend to rematch… 🕐", weakL: ["The connection sneezed 🤧 keep going!", "Your friend's kitten fell asleep on the line 😴", "A little fish got stuck in the cable 🐟", "A butterfly sat on the router 🦋", "Hang on, the cat is looking for Wi-Fi 📶😹"], friendN: "Friend 🐾", hint: "After you send the invite, come back here and keep the game open 📱", share2: "📤 Send another way", roomOk: "✅ The room is still open", jWait: "Waiting for your friend to come back to the game… ⏳", jAsk: "Your friend's phone is not answering 📵 Ask them to open the game and keep it open", retry: "🔄 Try again", failJ: "Couldn't connect 😿 Ask your friend to open the game, then try again", codeAlt: "You can also join with the room code:", rejJ: "Can't join: the room is already full or the invitation is no longer valid. Ask for a new invitation 💌", verJ: "The game needs its new version 🔄 Reload the page on both phones, then try again" }
  };
  // "[[girl|boy|neutral]]" inside a text = the form for the player (KidApp.g of kid.js); resolved each time a text is shown
  function kidForm(v) {
    if (Array.isArray(v)) return v.map(kidForm);
    if (typeof v !== "string" || v.indexOf("[[") < 0) return v;
    return v.replace(/\[\[([^|\]]*)\|([^|\]]*)\|([^\]]*)\]\]/g, function (all, f, m, x) { try { var K = window.KidApp; return K && K.g ? K.g(f, m, x) : x; } catch (e) { return x; } });
  }
  var CSS = '.n1ov{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:safe center;gap:12px;padding:max(14px,env(safe-area-inset-top)) 16px max(14px,env(safe-area-inset-bottom));z-index:90;text-align:center;overflow-y:auto;background:radial-gradient(circle at 50% 20%,#6a35b8,#2a1458 72%);color:#fff;font-family:Rubik,"Varela Round",Arial,sans-serif;direction:ltr}' +
    '.n1ov.show{display:flex}.n1ov h1{margin:0;font-size:clamp(30px,9vw,52px);color:#ffe14d;text-shadow:0 4px 0 #a2410f;line-height:1.1}' +
    '.n1b{min-width:200px;min-height:60px;border-radius:22px;font:900 22px Rubik,Arial,sans-serif;padding:8px 22px;box-shadow:0 6px 0 #0005;color:#fff;border:none;cursor:pointer;width:min(92vw,360px);background:linear-gradient(#a58bff,#7c5cff);touch-action:manipulation;display:flex;align-items:center;justify-content:center;text-decoration:none}' +
    '.n1b:active{transform:translateY(4px);box-shadow:0 2px 0 #0005}.n1b.g{background:linear-gradient(#5fd38d,#2fb36a)}.n1b.s{background:linear-gradient(#8aa0b8,#5b6f88)}' +
    '.n1pane{display:none;flex-direction:column;align-items:center;gap:10px}.n1pane.on{display:flex}.n1row{display:flex;flex-direction:column;gap:12px;align-items:center}' +
    '#n1Code{font-size:clamp(40px,13vw,72px);font-weight:900;letter-spacing:.12em;color:#ffe14d;direction:ltr;text-shadow:0 4px 0 #0006;line-height:1}' +
    '#n1In{width:min(80vw,300px);height:70px;border-radius:18px;border:3px solid #ffe14d;background:#fff;text-align:center;font:900 34px Rubik,Arial;color:#2c2150;letter-spacing:.12em;direction:ltr;user-select:text;-webkit-user-select:text}' +
    '#n1Cd{font-weight:900;font-size:26px;color:#9fe0ff;direction:ltr;min-height:32px}#n1Cd.low{color:#ff7a7a}' +
    '#n1St,#n1Wait{font-weight:800;font-size:18px;text-align:center;min-height:24px;max-width:90vw}' +
    '.n1b.n1sm{min-height:48px;font-size:17px;box-shadow:0 4px 0 #0005}#n1Hint,#n1FailT,#n1Alt{font-weight:700;font-size:15px;line-height:1.35;max-width:min(92vw,360px)}#n1FailT{font-weight:800;font-size:18px}#n1AltC{font-size:30px;font-weight:900;letter-spacing:.1em;color:#ffe14d;direction:ltr;line-height:1.1}' +
    '#n1Weak{position:fixed;left:50%;top:12%;transform:translateX(-50%);background:#fff8dc;color:#4a3300;border:2px solid #f2a900;border-radius:999px;padding:3px 12px;font-weight:800;font-size:14px;z-index:70;pointer-events:none;display:none;white-space:normal;text-align:center;box-shadow:0 2px 0 #0002;font-family:Rubik,Arial,sans-serif}#n1Weak.on{display:block}' +
    '#n1Appr,#n1Np{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#0008;font-family:Rubik,Arial,sans-serif;color:#fff}#n1Appr{z-index:95}#n1Np{z-index:92}#n1Appr.on,#n1Np.on{display:flex}' +
    '.n1card{background:#2c2150;border:3px solid #ffe14d;border-radius:22px;padding:18px;text-align:center;max-width:90vw;display:flex;flex-direction:column;gap:10px;align-items:center}.n1card h2{margin:0;font-size:22px;color:#ffe14d}.n1card .n1b{width:auto;max-width:100%;box-sizing:border-box}#n1ApprN{font-size:64px;font-weight:900;color:#ffe14d;letter-spacing:.1em;direction:ltr;line-height:1}' +
    '.n1dance{display:inline-block;animation:n1dn .6s infinite alternate;font-size:54px}@keyframes n1dn{from{transform:rotate(-12deg)}to{transform:rotate(12deg)}}' +
    '#n1Dot{display:none;position:fixed;left:8px;bottom:8px;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 0 #0003;transition:background .4s;z-index:50;pointer-events:none}';
  var ROOM_SECS = 300, SOFT = 4000, HARD = 20000, PEER_SRC = "vendor/peerjs.min.js";
  var TRY_MS = 13000, BACKOFF = [1500, 2500, 3000, 4000, 6000, 8000], TYPED_SECS = 45, RETRY_SECS = 120, DIAG_MAX = 40;
  function iceServers() {
    var own = null; try { own = JSON.parse(localStorage.getItem("annabelle-turn") || "null"); } catch (e) {}
    // No shared relay (TURN) any more: the free openrelay.metered.ca one is gone (the name now answers with the test address 192.0.2.1),
    // so it only cost time. A relay of our own can be supplied in 'annabelle-turn' (a JSON array of RTCIceServer); see docs/TELEMETRY.md.
    var base = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }];
    return Array.isArray(own) && own.length ? own.concat(base) : base;
  }
  var rnd = function (n) { return Array.from(crypto.getRandomValues(new Uint8Array(n)), function (b) { return b.toString(16).padStart(2, "0"); }).join(""); };
  async function hmac(key, msg) { var e = new TextEncoder(), k = await crypto.subtle.importKey("raw", e.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, e.encode(msg))), function (b) { return b.toString(16).padStart(2, "0"); }).join(""); }
  function loadPeer() { return new Promise(function (res, rej) { if (window.Peer) return res(); var s = document.createElement("script"); s.src = PEER_SRC; s.onload = function () { window.Peer ? res() : rej(); }; s.onerror = function () { rej(); }; document.head.appendChild(s); setTimeout(rej, 12000); }); }

  window.Net1v1 = function (opts) {
    var PID = opts.pid, PEER_CFG = { config: { iceServers: iceServers(), iceCandidatePoolSize: 2 } };
    var sfx = Object.assign({ join: function () {}, click: function () {}, drop: function () {}, back: function () {}, huh: function () {} }, opts.sfx || {});
    var NET = { waitCode: null, rs: null, cand: null, joinSec: null, key: null, pend: new Set(), cd: null, peer: null, conn: null, host: false, code: "", myRe: false, oppRe: false, gen: 0, tm: null, rt: null, paused: false, last: 0, rec: false, wt: null, wi: -1, tickAt: 0, gameOn: false, over: false, weak: false, msgN: 0, msgT: 0, tok: null, inv: "", jr: null, jnow: null, cdEnd: 0, okT: null, reg: 0 };
    var LAST = null; // the invitation this page is trying to join {code, sec}: kept in memory only, for the "try again" button, and forgotten when the match starts or the lobby is left
    // ---- diagnostics: where did a connection attempt get to? (anonymous; never a room code, a secret, an address or a name) ----
    var GAME = (location.pathname.split("/").pop() || "").replace(/\.html?$/, "").slice(0, 24) || String(PID).replace(/^annabelle-|-$/g, "").slice(0, 24);
    var DG = { log: [], n: 0, a: 0, k: "", t0: Date.now(), role: "", hidAt: 0, gap: 0, frz: 0, cand: {}, ice: "" };
    function newTry(role) { // a new attempt: its own random label (8 letters, nothing to do with the room) so its rows can be read together
      DG.role = role; DG.a++; DG.t0 = Date.now(); DG.cand = {}; DG.ice = ""; DG.k = Array.from(crypto.getRandomValues(new Uint8Array(8)), function (b) { return String.fromCharCode(97 + b % 26); }).join("");
    }
    function isPwa() { try { return !!((window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone); } catch (e) { return false; } }
    function candStr() { return ["host", "srflx", "prflx", "relay"].filter(function (k) { return DG.cand[k]; }).join(","); }
    function diag(ev, x, must) {
      try {
        var o = { game: GAME, role: DG.role || "-", ev: ev, ms: Date.now() - DG.t0, a: DG.a, k: DG.k, pwa: isPwa() }, k, line;
        if (x) for (k in x) if (x[k] !== undefined && x[k] !== null && x[k] !== "") o[k] = typeof x[k] === "number" ? Math.round(x[k]) : String(x[k]).replace(/[^a-z_,\-]/gi, "").slice(0, 24);
        line = o.role.charAt(0) + o.a + " " + ev + " +" + (o.ms / 1000).toFixed(1) + "s";
        for (k in o) if (!/^(game|role|ev|ms|a|k|pwa)$/.test(k)) line += " " + k + "=" + o[k];
        DG.log.push(line); if (DG.log.length > 14) DG.log.shift();
        var K = window.KidApp;
        try { K && K._tel && K._tel.note && K._tel.note("net", line); } catch (e) {} // the reproduction trail of a bug report (stays on the device until a report is sent)
        if (DG.n >= DIAG_MAX + (must ? 8 : 0)) return; DG.n++;
        K && K.track && K.track("net", o);
      } catch (e) {}
    }
    function diagN(ev, n, x) { if (n <= 3 || n === 5 || n === 8 || n % 10 === 0) diag(ev, Object.assign({ n: n }, x || {})); } // a long wait must not use up the budget
    function hookDiag() { // the page's own test hook (window.__<page>.state(), read by feedback.js) also tells the last network stages
      try {
        var h = window["__" + GAME];
        if (!h || typeof h.state !== "function") { // same search as feedback.js: the first window.__xyz that has a state()
          h = null; var ks = Object.keys(window);
          for (var i = 0; i < ks.length && !h; i++) if (/^__[a-z0-9]+$/i.test(ks[i]) && ks[i] !== "__net1v1" && window[ks[i]] && typeof window[ks[i]].state === "function") h = window[ks[i]];
        }
        if (h) {
          if (h.state.__n1) return; var orig = h.state;
          var w = function () {
            var s = orig.apply(this, arguments);
            try {
              if (!DG.log.length || !s || typeof s !== "object" || Array.isArray(s) || "net" in s) return s;
              var o = {}, k; for (k in s) o[k] = s[k]; o.net = DG.log.slice(-10); return o; // a copy: the page's own object is never touched
            } catch (e) { return s; }
          };
          w.__n1 = 1; h.state = w;
        } else if (!window.__net1v1) window.__net1v1 = { state: function () { return { net: DG.log.slice(-10) }; } };
      } catch (e) {}
    }
    setTimeout(hookDiag, 0); addEventListener("load", hookDiag);
    var N = { NET: NET, diag: function () { return DG.log.slice(); }, t: t, send: netSend, leave: netLeave, close: netClose, showLobby: showLobby, rematch: rematch, setOver: function (v) { NET.over = !!v; if (!v) { NET.myRe = NET.oppRe = false; } }, lang: lang, TXO: TXO };
    Object.defineProperties(N, { gameOn: { get: function () { return NET.gameOn; } }, over: { get: function () { return NET.over; } }, host: { get: function () { return NET.host; } }, paused: { get: function () { return NET.paused; } }, connected: { get: function () { return !!(NET.conn && NET.conn.open); } }, myRe: { get: function () { return NET.myRe; } } });
    function lang() { var l = null; try { l = localStorage.getItem("annabelle-lang"); } catch (e) {} return l === "fr" || l === "en" ? l : "he"; }
    function t(k) { var L = TXO[lang()]; return kidForm((L && L[k] !== undefined) ? L[k] : TXO.he[k]); }
    var $ = function (id) { return document.getElementById(id); };
    // ---- DOM ----
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    var box = document.createElement("div");
    box.innerHTML = '<div class="n1ov" id="n1Lob"><h1 id="n1T"></h1><div style="font-size:54px">📱🐾📱</div>' +
      '<div class="n1row" id="n1Main"><button class="n1b" id="n1Create"></button><button class="n1b g" id="n1Join"></button></div>' +
      '<div class="n1pane" id="n1CreateP"><div style="font-weight:800" id="n1CodeL"></div><div id="n1Code"></div><a class="n1b" id="n1Wa" target="_blank" rel="noopener"></a><button class="n1b s n1sm" id="n1Sh" style="display:none"></button><div id="n1Hint"></div><div id="n1Wait"></div><div id="n1Cd"></div></div>' +
      '<div class="n1pane" id="n1JoinP"><div style="font-weight:800" id="n1InL"></div><input id="n1In" type="text" inputmode="numeric" maxlength="6" autocomplete="off"><button class="n1b" id="n1Conn"></button></div>' +
      '<div class="n1pane" id="n1FailP"><div id="n1FailT"></div><button class="n1b g" id="n1Retry"></button><div id="n1Alt"></div><div id="n1AltC"></div><button class="n1b s n1sm" id="n1AltGo"></button></div>' +
      '<div id="n1St"></div><button class="n1b s n1sm" id="n1Now" style="display:none"></button><button class="n1b s" id="n1Back"></button></div>' +
      '<div id="n1Np"><div class="n1card"><div class="n1dance">🔌</div><h2 id="n1NpT"></h2><div id="n1NpS" style="font-weight:700"></div><button class="n1b g" id="n1NpLeave"></button></div></div>' +
      '<div id="n1Appr"><div class="n1card"><h2 id="n1ApprT"></h2><div id="n1ApprN"></div><div id="n1ApprS" style="font-weight:700"></div><div style="display:flex;gap:10px"><button class="n1b g" id="n1Yes" style="min-width:0;width:auto"></button><button class="n1b s" id="n1No" style="min-width:0;width:auto"></button></div></div></div>' +
      '<div id="n1Weak"></div><i id="n1Dot" aria-hidden="true"></i>';
    while (box.firstChild) document.body.appendChild(box.firstChild);
    function drawLang() {
      var set = function (id, k) { var e = $(id); if (e) e.textContent = t(k); };
      set("n1T", "lobT"); set("n1Create", "create"); set("n1Join", "join"); set("n1CodeL", "codeIs"); set("n1InL", "enter"); set("n1Conn", "goC"); set("n1Back", "back"); set("n1NpLeave", "leave");
      set("n1ApprT", "apprT"); set("n1ApprS", "apprS"); set("n1Yes", "apprYes"); set("n1No", "apprNo"); set("n1Wa", "share"); set("n1Wait", "waitF");
      set("n1Sh", "share2"); set("n1Hint", "hint"); set("n1Retry", "retry"); set("n1Now", "retry"); set("n1Alt", "codeAlt"); set("n1AltGo", "join");
      var lb = $("n1Lob"); lb.dir = lang() === "he" ? "rtl" : "ltr";
      // the lobby box itself stays left-to-right (codes, digits); each line of words gets the language's own direction, so a colon or an emoji ends up on the right side
      ["n1CodeL", "n1Hint", "n1Wait", "n1St", "n1FailT", "n1Alt", "n1InL", "n1ApprT", "n1ApprS"].forEach(function (id) { var e = $(id); if (e) e.dir = lb.dir; });
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
    function stopCd() { clearInterval(NET.cd); NET.cd = null; NET.cdEnd = 0; $("n1Cd").textContent = ""; $("n1Cd").classList.remove("low"); }
    function roomExpired() { lobFail("expired"); $("n1St").textContent = t("expired"); }
    function startCd(gen) {
      stopCd(); var end = Date.now() + ROOM_SECS * 1000; NET.cdEnd = end;
      var tick = function () {
        if (gen !== NET.gen) { stopCd(); return; } var left = Math.max(0, Math.round((end - Date.now()) / 1000));
        $("n1Cd").textContent = t("roomLeft") + " " + Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0"); $("n1Cd").classList.toggle("low", left <= 30);
        if (left <= 0) roomExpired();
      };
      tick(); NET.cd = setInterval(tick, 500);
    }
    function roomOk() { // the room owner is told that the room survived the trip to another app
      var e = $("n1St"), s = t("roomOk"); e.textContent = s; clearTimeout(NET.okT); NET.okT = setTimeout(function () { if (e.textContent === s) e.textContent = ""; }, 6000);
    }
    function netClose() {
      stopCd(); NET.gen++; clearTimeout(NET.tm); clearTimeout(NET.rt); var c = NET.conn, p = NET.peer; NET.conn = null; NET.peer = null; NET.myRe = NET.oppRe = false; NET.paused = false; NET.rec = false; weakHide(); NET.key = null; NET.waitCode = null; NET.rs = null; NET.cand = null; NET.joinSec = null; NET.gameOn = false; NET.tok = null; NET.inv = ""; NET.jr = null; NET.jnow = null; NET.reg = 0; NET.lostN = 0; NET.refN = 0; clearTimeout(NET.okT);
      $("n1Wa").removeAttribute("href"); $("n1Now").style.display = "none"; // the invitation (it holds the room secret) does not stay in the page after the room is gone
      $("n1Appr").classList.remove("on"); $("n1Np").classList.remove("on"); NET.pend.forEach(function (x) { try { x.close(); } catch (e) {} }); NET.pend.clear(); try { c && c.close(); } catch (e) {} try { p && p.destroy(); } catch (e) {}
    }
    function netLeave() {
      var c = NET.conn, p = NET.peer; if (NET.gameOn) netSend({ t: "bye" }); NET.conn = null; NET.peer = null; netClose();
      setTimeout(function () { try { c && c.close(); } catch (e) {} try { p && p.destroy(); } catch (e) {} }, 400); hideLob();
    }
    function netSend(o) { try { if (NET.conn && NET.conn.open) NET.conn.send(o); } catch (e) {} }
    function rematch() { if (!NET.gameOn || NET.myRe) return; NET.myRe = true; netSend({ t: "rematch" }); maybeRematch(); }
    function lobPane(w) { ["n1Main", "n1CreateP", "n1JoinP", "n1FailP"].forEach(function (id) { var e = $(id); if (id === "n1Main") e.style.display = w === "n1Main" ? "" : "none"; else e.classList.toggle("on", id === w); }); }
    function showLob() { if (opts.hideMenu) opts.hideMenu(); drawLang(); $("n1Lob").classList.add("show"); }
    function hideLob() { $("n1Lob").classList.remove("show"); }
    function showLobby() { netClose(); LAST = null; $("n1St").textContent = ""; lobPane("n1Main"); showLob(); }
    function lobFail(err) { if (DG.role) diag("fail", { err: err || "lobby", ice: DG.ice, cand: candStr() }, true); netClose(); $("n1St").textContent = t("failC"); lobPane("n1Main"); }
    function joinFail(key, err, n) { // the friend could not get in: say why in plain words, offer "try again" and, as a second way in, the room code
      diag("fail", { err: err, n: n, ice: DG.ice, cand: candStr() }, true); netClose();
      $("n1FailT").textContent = t(key); $("n1St").textContent = "";
      var code = LAST && key !== "rejJ" ? LAST.code : ""; $("n1Alt").style.display = $("n1AltC").style.display = $("n1AltGo").style.display = code ? "" : "none"; $("n1AltC").textContent = code;
      $("n1Retry").style.display = LAST ? "" : "none"; lobPane("n1FailP"); if (!$("n1Lob").classList.contains("show")) showLob();
    }
    function peerOpts() { return NET.tok ? Object.assign({ token: NET.tok }, PEER_CFG) : PEER_CFG; }
    function sigRefresh(p) { // a new signalling socket for the SAME peer (same id and token): friends who are joining or waiting for approval stay connected
      try { if (!p.disconnected) { p._q = 1; try { p.disconnect(); } finally { p._q = 0; } } p.reconnect(); return true; } catch (e) { return false; }
    }
    function hostPeer(code, gen, resume) {
      var p = new Peer(PID + code, peerOpts()); NET.peer = p; var opens = 0;
      p.on("open", function () {
        if (gen !== NET.gen || p !== NET.peer) return; NET.host = true; NET.code = code; opens++;
        // the same room again (the signalling socket came back, also in the middle of a match): never a new secret and never a new countdown
        if (resume || opens > 1 || NET.waitCode || NET.gameOn) { diag("sig_back", { n: ++NET.reg }); if (NET.waitCode && !NET.gameOn) roomOk(); return; }
        NET.rs = rnd(16); NET.waitCode = code; NET.reg = 1; diag("sig_open");
        $("n1Code").textContent = code; var url = location.origin + location.pathname + "?room=" + code + "&s=" + NET.rs;
        var st2 = opts.shareTxt || {}; NET.inv = (st2[lang()] || st2.he || "") + " " + url; $("n1Wa").href = "https://wa.me/?text=" + encodeURIComponent(NET.inv);
        $("n1St").textContent = ""; lobPane("n1CreateP"); startCd(gen);
      });
      // PeerJS reports a lost socket or an error in the middle of its own clean-up (it may be destroying this very peer): decide what to do once it is done
      var settle = function () {
        setTimeout(function () {
          if (gen !== NET.gen || p._q || p !== NET.peer) return;
          if (NET.waitCode && !NET.gameOn) hostRecover(false, p.destroyed);
          else if (p.disconnected && !p.destroyed) try { p.reconnect(); } catch (e) {}
        }, 0);
      };
      p.on("disconnected", function () { if (gen !== NET.gen || p._q || p !== NET.peer) return; diagN("sig_lost", NET.lostN = (NET.lostN || 0) + 1); settle(); });
      p.on("connection", function (c) {
        if (gen !== NET.gen) return;
        if (!NET.gameOn) { DG.cand = {}; diagN("conn_in", c._n1n = (p._n1c = (p._n1c || 0) + 1)); }
        // tries that never opened (the friend gave them up while we were away) must not fill the waiting list and lock the real one out
        if (NET.pend.size >= 3) NET.pend.forEach(function (x) { if (!x.open && x !== NET.cand) { NET.pend.delete(x); x._x = 1; try { x.close(); } catch (e) {} } });
        if (!NET.key) { // fresh room: the first friend in is accepted (the room code is the secret, valid only for the countdown)
          if (NET.conn || NET.gameOn || NET.pend.size >= 4) { try { c.close(); } catch (e) {} return; }
          c.fresh = true; attach(c, gen, true);
        } else { // a game exists: only someone who proves they know the game secret can (re)connect
          if (NET.pend.size >= 3) { try { c.close(); } catch (e) {} return; }
          attach(c, gen, true);
        }
      });
      p.on("error", function (e) {
        if (gen !== NET.gen || p !== NET.peer) return;
        if (NET.waitCode && !NET.gameOn) {
          diagN("sig_lost", NET.lostN = (NET.lostN || 0) + 1, { err: e && e.type });
          if (e && e.type === "unavailable-id") { clearTimeout(NET.rt); NET.rt = setTimeout(function () { if (gen === NET.gen && NET.waitCode && !NET.gameOn) { try { p._q = 1; p.destroy(); } catch (x) {} hostPeer(NET.waitCode, gen, "wait"); } }, 2000); }
          else settle();
          return;
        }
        if (NET.gameOn) {
          if (e && e.type === "unavailable-id" && NET.rec) { clearTimeout(NET.rt); NET.rt = setTimeout(function () { if (gen === NET.gen && NET.rec) { try { p.destroy(); } catch (x) {} hostPeer(NET.code, gen, true); } }, 3000); }
          return;
        }
        if (e && e.type === "unavailable-id") createRoom(true); else lobFail(e && e.type);
      });
    }
    // The open room lost its place on the signalling server (or may have: the app was in the background). First choice: renew only the
    // socket (sigRefresh), at once. Only when that does not work within a few seconds is the peer rebuilt - with the same private token,
    // so the server gives the room's name back even while it still believes in the old, dead socket.
    function hostRecover(force, hard) {
      if (!NET.waitCode || NET.gameOn) return; var gen = NET.gen, p = NET.peer;
      if (!force && p && !p.destroyed && p.open && !p.disconnected) return;
      if (!force && p && !p.destroyed && p._rc && Date.now() - p._rc < 4000) return; // already on its way
      $("n1St").textContent = t("reconn"); clearTimeout(NET.okT);
      var watch = function () { clearTimeout(NET.rt); NET.rt = setTimeout(function () { if (gen !== NET.gen || !NET.waitCode || NET.gameOn) return; var q = NET.peer; if (q && q.open && !q.disconnected && !q.destroyed) return; hostRecover(true, true); }, 4500); };
      if (!hard && p && !p.destroyed) { p._rc = Date.now(); if (sigRefresh(p)) { watch(); return; } }
      try { if (p) { p._q = 1; p.destroy(); } } catch (e) {} // _q: its own "disconnected" event must not start another recovery of the peer we are throwing away
      var soon = Date.now() - (NET.hardAt || 0) > 6000; NET.hardAt = Date.now(); // no internet at all: a new peer every few seconds, not in a tight loop
      clearTimeout(NET.rt); NET.rt = setTimeout(function () { if (gen === NET.gen && NET.waitCode && !NET.gameOn) { hostPeer(NET.waitCode, gen, "wait"); watch(); } }, soon ? 400 : 3000);
    }
    function createRoom(again) {
      netClose(); var gen = NET.gen; $("n1St").textContent = t("conn"); lobPane("none"); LAST = null;
      if (!again || DG.role !== "host") { newTry("host"); diag("create"); }
      NET.tok = rnd(16); // our private token for this room's name on the signalling server (never shown, never sent to the friend)
      loadPeer().then(function () { if (gen !== NET.gen) return; hostPeer(String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000), gen, false); }).catch(function () { if (gen === NET.gen) lobFail("no_script"); });
    }
    // The friend's side. It keeps trying for as long as the room can still be open (5 minutes from the first try; less for a typed code or
    // a manual "try again"): the room owner is probably in WhatsApp, sending this very invitation, and comes back in a moment.
    function joinRoom(code, sec, again, link) {
      netClose(); var gen = NET.gen; NET.code = code; NET.joinSec = sec || null; NET.host = false; lobPane("none"); showLob();
      if (!again || !LAST) LAST = { code: code, sec: sec || null, link: !!(link || sec) };
      newTry("guest");
      var until = Date.now() + (again ? RETRY_SECS : LAST.link ? ROOM_SECS : TYPED_SECS) * 1000; // LAST.link: opened from an invitation link (a code typed by hand may simply be wrong, so it gets a shorter wait)
      var p = null, cur = null, attempt = 0, una = 0, drops = 0, wait = false, sigN = 0, slow = false, slowT = null;
      var joined = function () { return !!(cur && NET.conn === cur && cur.open); };
      // what the friend reads while waiting: "connecting" for the first seconds, then that we are waiting for the room owner, then what to ask them
      var status = function () { var late = attempt >= 2 || slow; $("n1St").textContent = t(!late ? "conn" : una >= 2 || attempt >= 5 ? "jAsk" : "jWait"); $("n1Now").style.display = late && !(cur && cur.gotPair) ? "" : "none"; };
      var fin = function (key, err) { if (gen === NET.gen && !NET.gameOn) joinFail(key, err, attempt); };
      var drop = function () { if (cur) { cur._x = 1; if (NET.conn === cur) NET.conn = null; try { cur.close(); } catch (e) {} cur = null; } };
      var retry = function (why, now) {
        if (gen !== NET.gen || NET.gameOn || wait) return; drop();
        if (Date.now() >= until) { fin(LAST && LAST.link || again ? "failJ" : "failC", una ? "no_host" : why === "closed" ? "dropped" : "timeout"); return; }
        wait = true; status(); clearTimeout(NET.tm); NET.tm = setTimeout(function () { wait = false; go(); }, now ? 0 : BACKOFF[Math.min(Math.max(attempt - 1, 0), BACKOFF.length - 1)]);
      };
      var newPeer = function () {
        try { if (p && !p.destroyed) p.destroy(); } catch (e) {}
        var me = p = new Peer(undefined, PEER_CFG); NET.peer = p;
        p.on("open", function () { if (me !== p || gen !== NET.gen || NET.gameOn) return; diagN(sigN ? "sig_back" : "sig_open", ++sigN); if (joined()) return; wait = false; clearTimeout(NET.tm); go(); });
        p.on("disconnected", function () { if (me !== p || gen !== NET.gen || NET.gameOn) return; if (!joined()) retry("sig"); });
        p.on("error", function (e) {
          if (me !== p || gen !== NET.gen || NET.gameOn) return; var ty = (e && e.type) || "error";
          if (ty === "peer-unavailable") { una++; diagN("peer_unavailable", una); retry(ty); } // the room owner is not on the signalling server right now
          else if (ty === "browser-incompatible" || ty === "invalid-id" || ty === "invalid-key" || ty === "ssl-unavailable") fin("failC", ty);
          else { diagN("sig_lost", ++p._n1e, { err: ty }); if (!joined()) retry(ty); } // our own line to the server, or one WebRTC negotiation: try again
        });
        p._n1e = 0; clearTimeout(NET.tm); NET.tm = setTimeout(function () { if (gen === NET.gen && !NET.gameOn && !joined()) retry("sig_timeout"); }, 15000);
      };
      var go = function () {
        if (gen !== NET.gen || NET.gameOn || joined()) return;
        if (Date.now() >= until) { retry("timeout"); return; }
        if (!p || p.destroyed) { newPeer(); return; }
        if (p.disconnected || !p.open) { // our own signalling line dropped: the open event starts the next try
          if (p.disconnected) try { p.reconnect(); } catch (e) { newPeer(); return; }
          clearTimeout(NET.tm); NET.tm = setTimeout(function () { if (gen !== NET.gen || NET.gameOn || joined()) return; try { p.destroy(); } catch (e) {} retry("sig_timeout"); }, 8000); return;
        }
        attempt++; DG.cand = {}; diagN("join_try", attempt); status();
        if (!slowT) slowT = setTimeout(function () { if (gen === NET.gen && !NET.gameOn && !joined() && NET.jr) { slow = true; status(); } }, 5000);
        try { cur = p.connect(PID + code, { reliable: true }); } catch (e) { cur = null; retry("connect"); return; }
        attach(cur, gen);
        clearTimeout(NET.tm); NET.tm = setTimeout(function () { if (gen === NET.gen && !NET.gameOn && !joined()) retry("timeout"); }, TRY_MS);
      };
      // attach() / the data handler report here whatever happens to a connection before the match exists
      NET.jr = function (why, c) {
        if (gen !== NET.gen || NET.gameOn) return;
        // "pair": the room owner is looking at the approval card. That can take a minute, so our own "nobody answered" timer (c.to) must not close the line meanwhile
        if (why === "pair") { if (c === cur) { c.gotPair = true; $("n1Now").style.display = "none"; clearTimeout(c.to); clearTimeout(NET.tm); NET.tm = setTimeout(function () { fin("failJ", "appr_timeout"); }, 70000); } return; }
        if (c && c !== cur) return;
        if (why === "rejected") { fin("rejJ", "rejected"); return; }  // the room owner said no (full room, wrong invitation, declined)
        if (why === "version") { fin("verJ", "start_bad"); return; }   // the two phones run different versions of the game
        if (c && c.gotPair) { fin("failJ", "appr_closed"); return; }   // we were waiting for approval: never ask a second time by ourselves
        if (c && c.wasOpen && ++drops >= 3) { fin("failJ", "dropped"); return; }
        retry(why);
      };
      NET.jnow = function () { if (gen !== NET.gen || NET.gameOn || (cur && cur.gotPair) || joined()) return; diag("retry"); wait = false; clearTimeout(NET.tm); retry("manual", true); };
      $("n1St").textContent = t("conn");
      loadPeer().then(function () { if (gen === NET.gen) go(); }).catch(function () { if (gen === NET.gen) fin("failC", "no_script"); });
    }
    function admit(c) {
      if (NET.cand && NET.cand !== c) { try { NET.cand.close(); } catch (e) {} } NET.cand = null; $("n1Appr").classList.remove("on");
      if (NET.conn || !c.open) return; c.authed = true; NET.pend.delete(c); clearTimeout(c.to); c.fin();
    }
    function refuse(c) { // tell the other side to stop trying, then close. Nothing from a refused connection is read any more
      if (c.dead) return; c.dead = true; clearTimeout(c.to); NET.pend.delete(c); try { c.send({ t: "no" }); } catch (e) {} setTimeout(function () { try { c.close(); } catch (e) {} }, 200);
    }
    function askApproval(c) {
      c.pair = String(10 + crypto.getRandomValues(new Uint32Array(1))[0] % 90); clearTimeout(c.to); c.to = setTimeout(function () { if (NET.cand === c) { NET.cand = null; $("n1Appr").classList.remove("on"); diag("appr_no", { err: "timeout" }); refuse(c); } }, 60000);
      try { c.send({ t: "pair", n: c.pair }); } catch (e) {}
      $("n1ApprN").textContent = c.pair; $("n1Appr").classList.add("on"); sfx.join(); diag("appr_shown", { hid: document.hidden ? 1 : 0 });
      $("n1Yes").onclick = function () { sfx.click(); if (NET.cand === c) { diag("appr_yes"); admit(c); } };
      $("n1No").onclick = function () { sfx.click(); if (NET.cand !== c) return; NET.cand = null; $("n1Appr").classList.remove("on"); diag("appr_no"); refuse(c); };
    }
    function attach(c, gen, pending) {
      c.myN = rnd(16); if (c.authed === undefined) c.authed = false;
      if (pending) { NET.pend.add(c); c.to = setTimeout(function () { if (!c.open && !c.authed) { NET.pend.delete(c); c._x = 1; try { c.close(); } catch (e) {} } }, 25000); } else NET.conn = c;
      var opened = false;
      var finish = function () {
        if (gen !== NET.gen) return; NET.pend.delete(c); clearTimeout(c.to);
        if (NET.conn && NET.conn !== c) { var o = NET.conn; NET.conn = null; try { o.close(); } catch (e) {} }
        NET.conn = c; NET.last = Date.now(); clearTimeout(NET.tm); NET.rec = false;
        if (NET.host) { if (NET.gameOn) hostResume(); else startOnlineHost(); } else netSend({ t: "hello" });
      };
      var op = function () {
        if (opened || gen !== NET.gen || c._x) return; opened = true; c.wasOpen = true;
        if (!NET.gameOn) diagN("conn_open", NET.host ? (c._n1n || 1) : 1);
        c.to = setTimeout(function () { if (!c.authed) { NET.pend.delete(c); try { c.close(); } catch (e) {} } }, 10000);
        if (NET.key) { try { c.send({ t: "ch", n: c.myN }); } catch (e) {} }
        else if (!NET.host) { try { c.send({ t: "join", s: NET.joinSec }); } catch (e) {} }
      };
      c.fin = finish;
      var watchIce = function () {
        var pc = c.peerConnection; if (!pc || c._w) return; c._w = 1;
        pc.addEventListener("icecandidate", function (e) { try { var cd = e.candidate; if (!cd) return; var ct = cd.type || (/ typ (\w+)/.exec(cd.candidate || "") || [])[1]; if (ct) DG.cand[ct] = 1; } catch (x) {} }); // the kinds of our own candidates only, never an address
        pc.addEventListener("iceconnectionstatechange", function () {
          var s = pc.iceConnectionState; clearTimeout(c.iceT);
          if (!c._x && c.iceS !== s && s !== "new" && s !== "checking" && s !== "closed" && (!NET.gameOn || s === "failed" || s === "disconnected")) { DG.ice = s; diagN("ice", c.iceN = (c.iceN || 0) + 1, { ice: s, cand: candStr() }); } c.iceS = s;
          if (s === "failed" || s === "closed") gone();
          else if (s === "disconnected") c.iceT = setTimeout(function () { var x = pc.iceConnectionState; if (x !== "connected" && x !== "completed") gone(); }, 15000);
        });
      };
      setTimeout(watchIce, 0); setTimeout(watchIce, 800);
      c.on("open", function () { watchIce(); op(); });
      c.on("data", async function (d) {
        try {
          if (gen !== NET.gen || c.dead || c._x || !d || typeof d !== "object" || Array.isArray(d)) return;
          var ty = d.t; if (typeof ty !== "string" || ty.length > 12) return;
          if (ty === "ch" && NET.key && typeof d.n === "string" && /^[0-9a-f]{32}$/.test(d.n)) { var h = await hmac(NET.key, "R" + (NET.host ? "h" : "g") + d.n); try { c.send({ t: "pr", h: h }); } catch (e) {} return; }
          if (ty === "pr" && NET.key && typeof d.h === "string") { if (c.authed) return; var want = await hmac(NET.key, "R" + (NET.host ? "g" : "h") + c.myN); if (gen !== NET.gen) return; if (d.h === want) { c.authed = true; finish(); } else { NET.pend.delete(c); try { c.close(); } catch (e) {} } return; }
          if (c.fresh && NET.host && !NET.key) { // room still open: invitation link (secret) joins directly, a typed code needs the host's approval
            if (ty !== "join") return;
            var sec = typeof d.s === "string" && /^[0-9a-f]{32}$/.test(d.s) ? d.s : null;
            if (NET.conn) { refuse(c); return; }
            if (sec && NET.rs && sec === NET.rs) admit(c);
            else if (!sec && !NET.cand) { NET.cand = c; askApproval(c); }
            else { diagN("refuse", NET.refN = (NET.refN || 0) + 1, { err: sec ? "secret" : "busy" }); refuse(c); }
            return;
          }
          // a match exists and a stranger asks to join it: a clear no (the real friend comes back with the challenge above, never with "join")
          if (ty === "join" && NET.host && NET.key && !c.authed) { refuse(c); return; }
          if (!c.authed && !NET.host && !NET.key && NET.jr) { // the friend's side, before the match exists
            if (ty === "no") { NET.jr("rejected", c); return; }
            if (ty === "pair" && typeof d.n === "string" && /^\d{2}$/.test(d.n)) { $("n1St").textContent = t("pairMsg").replace("N", d.n); NET.jr("pair", c); return; }
          }
          if (!c.authed) { // first contact of a joining friend: take the game secret from the host's first "start"
            if (ty === "start" && !NET.host && !NET.key && typeof d.k === "string" && /^[0-9a-f]{32}$/.test(d.k)) {
              if (opts.cleanStart(d)) { NET.key = d.k; c.authed = true; clearTimeout(c.to); NET.last = Date.now(); onNetData(d); }
              else if (NET.jr) NET.jr("version", c);
            }
            return;
          }
          if (NET.conn !== c) return;
          // simple flood limiter: at most 80 messages per second from the friend
          var now = Date.now(); if (now - NET.msgT > 1000) { NET.msgT = now; NET.msgN = 0; } if (++NET.msgN > 80) return;
          NET.last = Date.now(); onNetData(d);
        } catch (e) {}
      });
      var gone = function () { if (c._x) return; NET.pend.delete(c); if (NET.cand === c) { NET.cand = null; $("n1Appr").classList.remove("on"); } if (gen === NET.gen && NET.conn === c) onNetClose(); };
      c.on("close", gone); c.on("error", gone);
      if (c.open) op();
    }
    // ---- match flow ----
    function startMsg(resume) { return Object.assign({}, opts.makeStart ? opts.makeStart() : {}, { t: "start", k: NET.key, r: resume ? 1 : 0 }); }
    function startOnlineHost(isRe) {
      stopCd(); NET.waitCode = null; NET.inv = ""; $("n1Wa").removeAttribute("href"); if (!isRe) diag("ok", { ice: DG.ice, cand: candStr() }, true); sfx.join(); if (!NET.key) NET.key = rnd(16); hideLob(); NET.gameOn = true; NET.over = false; NET.myRe = NET.oppRe = false;
      opts.onHostStart(!!isRe); netSend(startMsg(false));
    }
    function hostResume() { weakHide(); setPaused(false); netSend(startMsg(true)); if (opts.onResume) opts.onResume(); }
    function maybeRematch() { if (NET.host && NET.myRe && NET.oppRe && NET.conn) { NET.myRe = NET.oppRe = false; startOnlineHost(true); } }
    function onNetData(d) {
      var ty = d.t;
      if (ty === "start" && !NET.host) {
        var c = opts.cleanStart(d); if (!c || d.k !== NET.key) return;
        if (d.r === 1 && NET.gameOn && !NET.over) { weakHide(); setPaused(false); if (opts.onResume) opts.onResume(); }
        else { if (!NET.gameOn) { NET.jr = NET.jnow = null; LAST = null; clearTimeout(NET.tm); $("n1Now").style.display = "none"; diag("ok", { ice: DG.ice, cand: candStr() }, true); } sfx.join(); setPaused(false); hideLob(); NET.gameOn = true; NET.over = false; NET.myRe = NET.oppRe = false; opts.onGuestStart(c, d.r === 2); }
        return;
      }
      if (ty === "rematch" && NET.gameOn) { sfx.click(); NET.oppRe = true; maybeRematch(); return; }
      if (ty === "bye") { var had = NET.gameOn; if (had) sfx.drop(); netClose(); setPaused(false); if (had) { if (opts.onLeft) opts.onLeft(); } else lobFail("bye"); return; }
      if (ty === "ping" || ty === "hello" || ty === "start" || ty === "rematch") return;
      if (NET.gameOn && opts.onData) opts.onData(d);
    }
    function onNetClose() {
      if (!NET.gameOn) { var c0 = NET.conn; if (NET.jr) NET.jr("closed", c0); else if (NET.conn || NET.peer) lobFail("closed"); return; } // a friend who is still joining tries again
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
    function netKick(hid) {
      if (NET.waitCode && !NET.gameOn) { // the room owner is back: is the room still there?
        if (NET.cdEnd && Date.now() >= NET.cdEnd) { roomExpired(); return; }
        var lg = hid > 2500, q = NET.peer; hostRecover(lg); // away for a while: the socket may be dead without knowing it, so it is renewed at once (same id, same token)
        if (hid > 0 && !lg && q && q.open && !q.disconnected) roomOk();
        return;
      }
      if (!NET.gameOn) { if (NET.jnow && hid > 2500) NET.jnow(); return; } // a friend who is still joining: try now
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
      if (NET.tickAt && now - NET.tickAt > DG.gap) DG.gap = now - NET.tickAt;
      if (NET.tickAt && now - NET.tickAt > 3000) NET.last = now; // our own timers were frozen (phone asleep): says nothing about the friend
      NET.tickAt = now; netQ();
      if (!NET.gameOn) { weakHide(); return; }
      if (++hbN % 4 === 0) netSend({ t: "ping" });
      if (document.hidden || NET.over) return;
      var q = now - NET.last;
      if (NET.paused) { if (NET.conn && NET.conn.open && q < 2500) netResume(); return; }
      if (q > HARD) hardLost(); else weakSet(q > SOFT);
    }, 500);
    document.addEventListener("visibilitychange", function () {
      var now = Date.now(), live = !!(NET.peer || NET.waitCode);
      if (document.hidden) { DG.hidAt = now; DG.gap = 0; DG.frz = 0; if (live && !NET.gameOn) diag("bg"); }
      if (document.visibilityState === "visible") {
        var hid = DG.hidAt ? now - DG.hidAt : 0, gap = Math.max(DG.gap, NET.tickAt ? now - NET.tickAt : 0), q = NET.peer; DG.hidAt = 0;
        // hid = how long we were away; gap = the longest pause of our own timers meanwhile (about hid = the page was frozen); sig = did our signalling socket still look alive
        if (live && hid > 0 && (!NET.gameOn || hid > 5000)) diag("fg", { hid: hid, gap: gap, sig: q && q.open && !q.disconnected && !q.destroyed ? 1 : 0, err: DG.frz ? "frozen" : "" });
        NET.last = now; NET.tickAt = now; netKick(hid);
      }
    });
    document.addEventListener("freeze", function () { DG.frz = 1; });
    addEventListener("online", function () { netKick(0); }); addEventListener("pageshow", function () { netKick(0); }); addEventListener("focus", function () { netKick(0); });
    $("n1NpLeave").addEventListener("click", function () { sfx.click(); netLeave(); if (opts.showMenu) opts.showMenu(); });
    $("n1Create").addEventListener("click", function () { sfx.click(); createRoom(); });
    $("n1Join").addEventListener("click", function () { sfx.click(); lobPane("n1JoinP"); $("n1St").textContent = ""; $("n1In").value = ""; $("n1In").focus(); });
    $("n1Conn").addEventListener("click", function () { var c = $("n1In").value.replace(/\D/g, ""); if (c.length === 6) { sfx.click(); joinRoom(c); } });
    $("n1Now").addEventListener("click", function () { sfx.click(); if (NET.jnow) NET.jnow(); });
    $("n1Retry").addEventListener("click", function () { sfx.click(); if (LAST) joinRoom(LAST.code, LAST.sec, true); });
    $("n1AltGo").addEventListener("click", function () { sfx.click(); var c = LAST ? LAST.code : ""; lobPane("n1JoinP"); $("n1St").textContent = ""; $("n1In").value = c; $("n1In").focus(); });
    $("n1Wa").addEventListener("click", function () { diag("share", { via: "wa" }); });
    var canShare = false; try { canShare = typeof navigator.share === "function"; } catch (e) {}
    if (canShare) $("n1Sh").style.display = ""; // the system share sheet: on a phone it usually comes straight back to the game after sending
    $("n1Sh").addEventListener("click", function () { sfx.click(); if (!NET.inv) return; diag("share", { via: "api" }); try { var r = navigator.share({ text: NET.inv }); if (r && r.catch) r.catch(function () {}); } catch (e) {} });
    $("n1In").addEventListener("input", function (e) { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); });
    $("n1In").addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Enter") $("n1Conn").click(); });
    $("n1Back").addEventListener("click", function () { sfx.click(); if (DG.role && (NET.peer || NET.waitCode) && !NET.gameOn) diag("fail", { err: "back" }, true); LAST = null; netClose(); hideLob(); if (opts.showMenu) opts.showMenu(); });
    N.hideLobby = hideLob;
    N.leaveToMenu = function () { if (NET.gameOn || NET.conn || NET.peer || NET.waitCode) netLeave(); hideLob(); };
    // invitation link:  ?room=123456&s=<secret>
    var U = new URLSearchParams(location.search), q = U.get("room") || "", sc = /^[0-9a-f]{32}$/.test(U.get("s") || "") ? U.get("s") : null;
    if (q || U.has("s")) try { history.replaceState(null, "", location.pathname); } catch (e) {}
    if (/^\d{6}$/.test(q)) setTimeout(function () { if (opts.onLink) opts.onLink(); lobPane("none"); joinRoom(q, sc, false, true); }, 0);
    return N;
  };
})();

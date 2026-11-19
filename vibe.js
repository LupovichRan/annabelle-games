/* vibe.js – shared WebGL ambience layer for every page of the site.
   Drop-in:  <script src="vibe.js" defer></script>   (no dependencies, never loads three.js)

   What it draws (raw WebGL2, WebGL1 fallback, three tiny shader programs):
     1. a flowing aurora / mesh-gradient background,
     2. a parallax bokeh + sparkle field (all motion in the vertex shader, no per-frame uploads),
     3. a few slowly tumbling ray-marched 3D shapes (yarn ball, rounded cube, star, paw) with fresnel rim + glow,
     4. reward pulses, tap ripples and small sparkle bursts.

   Modes (picked per page, re-checked every few seconds):
     behind   canvas at z-index:-1 under all content (visible wherever the page is not covered by something opaque)
     overlay  page is covered by an opaque full-screen game canvas -> the same canvas sits ABOVE the content at 10% opacity,
              pointer-events:none, and is only drawn while a pulse / burst is fading (zero cost while idle)
     css      the page runs its own WebGL (three.js games) -> no second GL context, three compositor-animated gradient blobs
     idle     covered by opaque DOM (text-heavy menus) -> nothing is drawn

   API:  window.Vibe = { set(opts), pulse(strength, color), burst(x, y, color), pause(), resume(), off(), on(), quality, mode }
         set({colors:['#..','#..','#..'], dark:bool, intensity:0..1.5, fps:30|60, quality:'high'|'mid'|'low'|'static'|'auto', mode:'auto'|...})
   Owner switch:  localStorage 'annabelle-vibe' = '0' (off) | 'low' (force low quality)
   Calm mode (docs/CALM-UI.md, the site default): while localStorage 'annabelle-calm' is not '0' this layer does NOT boot at all (no canvas, no GL
                  context, no frame loop); the API stays as harmless no-ops. The window event 'annabelle-calm' switches it on / off without a reload.
*/
(function () {
  'use strict';
  var W = window, D = document, H = D.documentElement;
  if (W.Vibe) return;

  var NAMES = ['low', 'mid', 'high'];
  var S = {
    on: false, mode: 'off', level: 2, lock: false, isStatic: false, paused: false, running: false,
    fps: 60, userFps: 0, userMode: '', userPal: null, userDark: null, intensity: 1, game: false,
    pulse: 0, pulseCol: [1, 0.82, 0.3], rip: [0, 0, 9, 0], ripCol: [1, 1, 1], lastBurst: -9,
    par: [0, 0], parT: [0, 0], cur: null, tgt: null, dark: true, darkF: 1
  };
  var cv = null, gl = null, P = null, B = null, cssBox = null, raf = 0, timer = 0, obs = null, mq = null;
  var t0 = 0, last = 0, acc = 0, needSize = true, scale = 1, lostCtx = false, softGL = false, hoisted = null, hooked = false;
  var mFrom = 0, mSum = 0, mN = 0, mSkip = 20, mWin = 0, mBad = 0, dSum = 0, dN = 0;
  var NP = 72, NS = 8, NB = 64, FL = 10, burstData = null, burstAt = 0;
  var GOLD = '#ffd24d', pref = null;

  function safe(f) { return function () { try { return f.apply(this, arguments); } catch (e) { fail(e); } }; }
  function fail() { try { teardown(true); S.on = false; S.mode = 'off'; } catch (e) {} }
  function now() { return (W.performance && performance.now) ? performance.now() : Date.now(); }

  /* ---------------- colours ---------------- */
  function parseCol(s) {
    if (!s) return null;
    if (Array.isArray(s)) return [+s[0] || 0, +s[1] || 0, +s[2] || 0, 1];
    s = String(s).trim();
    var m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
      var h = m[1];
      if (h.length < 6) h = h.replace(/./g, '$&$&');
      var n = parseInt(h.slice(0, 6), 16);
      return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    }
    m = /rgba?\(([^)]+)\)/i.exec(s);
    if (m) {
      var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      if (p.length >= 3) return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 && !isNaN(p[3]) ? p[3] : 1];
    }
    return null;
  }
  function lum(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function toHsl(c) {
    var r = c[0], g = c[1], b = c[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0, s = 0, l = (mx + mn) / 2, d = mx - mn;
    if (d > 1e-4) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsl(h, s, l) {
    h = ((h % 1) + 1) % 1;
    function f(n) { var k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }
    return [f(0), f(8), f(4)];
  }
  var TH = { // [dark?, c1, c2, c3]
    neon: [1, '#7c5cff', '#5ff0ff', '#ff5fd2'], ocean: [1, '#38d3c5', '#5fd0ff', '#2f7dff'], jungle: [1, '#9be870', '#ffd24d', '#2fd18a'],
    sunset: [1, '#ffd24d', '#ff8a4d', '#ff5fa2'], galaxy: [1, '#b48bff', '#ff9fe6', '#5f8bff'], gold: [1, '#ffd24d', '#ff9d2e', '#fff0b0'],
    classic: [0, '#ff9fc0', '#ffcf6b', '#8fd0ff']
  };
  function firstBg(el) { // first non-transparent background colour (or first gradient stop) of an element
    try {
      var cs = getComputedStyle(el), c = parseCol(cs.backgroundColor);
      if (c && c[3] > 0.5) return c;
      var m = /(#[0-9a-f]{3,8}|rgba?\([^)]+\))/i.exec(cs.backgroundImage || '');
      if (m) { c = parseCol(m[1]); if (c && c[3] > 0.5) return c; }
    } catch (e) {}
    return null;
  }
  function derive() {
    var th = H.getAttribute('data-th'), home = /(^|\/)(index\.html)?$/.test(location.pathname), t = null;
    if (S.userPal) return { dark: S.userDark == null ? true : !!S.userDark, c: S.userPal };
    if (th && TH[th]) t = TH[th]; else if (home && !th) t = TH.classic;
    if (t) return { dark: S.userDark == null ? !!t[0] : !!S.userDark, c: [parseCol(t[1]), parseCol(t[2]), parseCol(t[3])] };
    var meta = D.querySelector('meta[name="theme-color"]'), tc = meta && parseCol(meta.getAttribute('content'));
    var bg = (D.body && firstBg(D.body)) || firstBg(H) || tc || [1, 1, 1, 1];
    var dark = lum(bg) < 0.42, a = toHsl(tc || bg), b = toHsl(bg);
    if (a[1] < 0.12) a = b[1] >= 0.12 ? b : [0.72, 0.5, 0.5]; // grey theme colour -> use the background hue (or a soft violet)
    var s = Math.max(a[1], dark ? 0.62 : 0.78), l = dark ? 0.62 : 0.7, h2 = b[1] >= 0.12 && Math.abs(b[0] - a[0]) > 0.06 ? b[0] : a[0] + 0.1;
    return { dark: S.userDark == null ? dark : !!S.userDark, c: [hsl(a[0], s, l), hsl(h2, Math.max(b[1], dark ? 0.6 : 0.75), l), hsl(a[0] - 0.11, s * 0.9, l + 0.05)] };
  }
  function retheme(snap) {
    var d = derive();
    S.tgt = d.c.map(function (c) { return [c[0], c[1], c[2]]; });
    S.dark = d.dark;
    if (snap || !S.cur) { S.cur = S.tgt.map(function (c) { return c.slice(); }); S.darkF = S.dark ? 1 : 0; }
    if (cssBox) paintCss();
    if (S.isStatic || !S.running) drawOnce();
  }

  /* ---------------- page analysis ---------------- */
  function clearBg(cs) { var c = parseCol(cs.backgroundColor); return (!c || c[3] < 0.06) && (!cs.backgroundImage || cs.backgroundImage === 'none'); }
  var BGP = ['background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-attachment', 'background-origin', 'background-clip'];
  /* <html> and <body> both paint an opaque background on many pages ("html,body{background:#123}"), which would hide a
     z-index:-1 layer. Move the body's background up to <html> (pixel-identical) and make the body transparent. */
  function hoist() {
    var b = D.body; if (!b) return;
    if (hoisted && !bgDirty) return;
    bgDirty = false;
    if (hoisted) {
      // the page changed its own background meanwhile? then start over from its new value
      if (b.style.backgroundColor === 'transparent' && b.style.backgroundImage === 'none') { BGP.forEach(function (p) { b.style.setProperty(p, hoisted.b[p]); }); }
      else hoisted.b = snapBg(b);
    }
    var hs = getComputedStyle(H), bs = getComputedStyle(b), htmlClear = hoisted ? hoisted.clear : clearBg(hs);
    if (clearBg(bs) || htmlClear) { // nothing to do: body is see-through, or its background already propagates to the viewport
      if (hoisted) unhoist();
      return;
    }
    var vals = {}; BGP.forEach(function (p) { vals[p] = bs.getPropertyValue(p); });
    if (!hoisted) hoisted = { h: snapBg(H), b: snapBg(b), clear: false };
    BGP.forEach(function (p) { H.style.setProperty(p, vals[p]); });
    b.style.setProperty('background-color', 'transparent'); b.style.setProperty('background-image', 'none');
  }
  function snapBg(el) { var o = {}; BGP.forEach(function (p) { o[p] = el.style.getPropertyValue(p); }); return o; }
  function unhoist() {
    if (!hoisted) return;
    var b = D.body, h = hoisted; hoisted = null;
    BGP.forEach(function (p) { H.style.setProperty(p, h.h[p]); if (!H.style.getPropertyValue(p)) H.style.removeProperty(p); });
    if (b && b.style.backgroundColor === 'transparent' && b.style.backgroundImage === 'none') BGP.forEach(function (p) { b.style.setProperty(p, h.b[p]); if (!h.b[p]) b.style.removeProperty(p); });
  }
  function ours(el) { return el === cv || el === cssBox || (cssBox && cssBox.contains(el)); }
  function analyse() { // -> {c: fraction of the viewport hidden by opaque content, k: fraction hidden by a canvas/video, game: big canvas present}
    var w = W.innerWidth, h = W.innerHeight, n = 0, c = 0, k = 0, game = false, seen = [], op = [], i, j, x, y;
    function opaque(el) {
      var ix = seen.indexOf(el); if (ix >= 0) return op[ix];
      var r = 0, tag = el.tagName;
      if (tag === 'CANVAS' || tag === 'VIDEO' || tag === 'IFRAME') r = 2;
      else {
        var cs = getComputedStyle(el), col = parseCol(cs.backgroundColor);
        if (+cs.opacity < 0.5) r = 0;
        else if (col && col[3] > 0.8) r = 1;
        else if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/rgba\([^)]*,\s*0?\.[0-6]\d*\)|#[0-9a-f]{6}[0-9][0-9a-f]\b|transparent/i.test(cs.backgroundImage)) r = 1;
        if (tag === 'IMG' && el.clientWidth * el.clientHeight > w * h * 0.2) r = 1;
      }
      seen.push(el); op.push(r); return r;
    }
    for (i = 0; i < 5; i++) for (j = 0; j < 5; j++) {
      x = w * (0.06 + 0.22 * i); y = h * (0.06 + 0.22 * j); n++;
      var els = D.elementsFromPoint(x, y), q, e, o;
      for (q = 0; q < els.length; q++) {
        e = els[q];
        if (ours(e)) continue;
        if (e === H) break;
        if (e === D.body) { if (hoisted || clearBg(getComputedStyle(e)) || clearBg(getComputedStyle(H))) break; c++; break; }
        o = opaque(e);
        if (o) { c++; if (o === 2) k++; break; }
      }
    }
    var cs2 = D.getElementsByTagName('canvas');
    for (i = 0; i < cs2.length; i++) {
      e = cs2[i]; if (ours(e)) continue;
      var r = e.getBoundingClientRect();
      if (r.width * r.height > w * h * 0.12 && getComputedStyle(e).pointerEvents !== 'none') { game = true; break; }
    }
    return { c: c / n, k: k / n, game: game };
  }
  function otherGL(deep) { // does the page run (or is it about to run) its own WebGL / three.js?
    try {
      if (W.THREE || W.__THREE__) return true;
      if (D.querySelector('script[type="importmap"],canvas[data-engine]')) return true;
      if (!deep) return false;
      var s = D.scripts, i, t;
      for (i = 0; i < s.length; i++) {
        if (/three|babylon|pixi|webgl/i.test(s[i].getAttribute('src') || '')) return true;
        t = s[i].textContent;
        if (t && /three\.module|getContext\(\s*['"](webgl2?|experimental-webgl)/.test(t)) return true;
      }
    } catch (e) {}
    return false;
  }
  var glPage = null, bgDirty = true, scans = 0;
  function evaluate() {
    if (!S.on) return;
    if (glPage !== true) glPage = otherGL(scans++ < 2);
    hoist();
    var a = analyse(), want, prev = S.mode;
    S.game = a.game;
    S.fps = S.userFps || (a.game || S.level < 1 ? 30 : 60);
    if (S.userMode) want = S.userMode;
    else if (a.c < (prev === 'overlay' || prev === 'idle' ? 0.85 : 0.93)) want = glPage ? 'css' : 'behind';
    else want = glPage ? 'idle' : (a.k >= 0.6 ? 'overlay' : 'idle');
    if (want === 'css' && glPage === false) want = 'behind';
    if (want !== prev) setMode(want);
    if (obs) obs.takeRecords(); // drop the attribute records caused by our own background hoist
  }

  /* ---------------- GL ---------------- */
  var VS_BG = 'attribute vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}';
  var PREC = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  var FS_BG = PREC +
    'uniform vec2 uRes,uPar;uniform float uT,uDark,uInt,uOv,uPulse;uniform vec3 uC1,uC2,uC3,uPC,uRC;uniform vec4 uRip;' +
    'void main(){vec2 uv=gl_FragCoord.xy/uRes;vec2 p=uv*2.-1.;float asp=uRes.x/uRes.y;p.x*=asp;vec3 col=vec3(0.);float al=0.;' +
    'if(uOv<.5){float t=uT*.07;vec2 q=p*.9+uPar*.07;' +
    'q+=.38*vec2(sin(q.y*1.7+t*1.3)+sin(q.y*.9-t*.8),cos(q.x*1.4-t*1.1)+sin(q.x*.7+t*.7));' +
    'q+=.17*vec2(sin(q.y*3.1+t*2.1),cos(q.x*2.7-t*1.7));' +
    'float a=.5+.5*sin(q.x*1.5+q.y*1.1+t*2.);float b=.5+.5*sin(q.y*1.9-q.x*1.2-t*1.5+2.);float c=.5+.5*sin((q.x+q.y)*.9+t+4.);' +
    'vec3 g=mix(mix(uC1,uC2,a),uC3,b*.65);' +
    'float r1=q.y-.3-.25*sin(q.x*1.3+t*2.4);float rib=exp(-r1*r1*6.5);' +
    'float r2=q.y+.75-.3*sin(q.x*.9-t*1.7+1.);float rib2=exp(-r2*r2*9.);' +
    'vec2 v=uv-.5;float vig=dot(v,v)*2.;' +
    'vec3 dk=g*(.05+.20*c*c+.36*rib+.24*rib2)*uInt+mix(uC2,vec3(1.),.45)*rib*rib*.10*uInt;' +
    'float dka=max(max(dk.r,max(dk.g,dk.b)),vig*.22);' +
    'float la=clamp((.17+.25*c+.22*rib+.15*rib2)*uInt,0.,.72);' +
    'col=mix(g*la,dk,uDark);al=mix(la,dka,uDark);}' +
    'float d=length(p-uRip.xy);float rr=(d-uRip.z*1.1)*7.;float ring=exp(-rr*rr)*exp(-uRip.z*2.6)*uRip.w;' +
    'float pl=uPulse*(.05+.20*exp(-dot(p,p)*.7));vec3 add=uRC*ring+uPC*pl;col+=add;al+=max(add.r,max(add.g,add.b))*.7;' +
    'float n=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);col+=(n-.5)/200.;' +
    'gl_FragColor=vec4(max(col,0.),clamp(al,0.,1.));}';
  var ATTR = 'attribute vec2 aC;attribute vec4 aS;attribute vec4 aE;uniform float uT,uSc,uDark;uniform vec2 uRes,uPar;uniform vec3 uC1,uC2,uC3;';
  var VS_PT = ATTR + 'uniform float uMode,uA;varying vec2 vU;varying vec4 vC;varying float vK;' +
    'void main(){vec2 p;float sz;float al;vec3 col;float k;vU=aC;' +
    'if(uMode<.5){float z=aS.z;p=vec2(aS.x+.05*sin(uT*.23+aS.w*40.),mod(aS.y+uT*(.010+.026*z)+1.2,2.4)-1.2);p+=uPar*(.03+.11*z);' +
    'k=step(.7,aE.w);sz=mix(mix(5.,36.,aE.x*aE.x)*(.5+z),5.+8.*aE.x,k);' +
    'float tw=.62+.38*sin(uT*(.5+aE.z*1.7)+aE.z*30.);al=mix(.10+.20*(1.-z*.6),.8,k)*tw*mix(2.3,1.,uDark);' +
    'col=aE.y<.33?uC1:(aE.y<.66?uC2:uC3);col=mix(col,vec3(1.),mix(.72,.38,uDark));}' +
    'else{float age=uT-aE.x;if(age<0.||age>1.15){gl_Position=vec4(3.,3.,0.,1.);vC=vec4(0.);vK=1.;return;}' +
    'float e=1.-exp(-age*3.4);p=aS.xy+aS.zw*e;p.y-=.22*age*age;k=1.;sz=(7.+9.*fract(aS.z*91.7+aS.w*13.3))*(1.-.5*age);' +
    'al=1.-age/1.15;col=mix(aE.yzw,vec3(1.),.25);}' +
    'vC=vec4(col,al*uA);vK=k;gl_Position=vec4(p+aC*sz*uSc*2./uRes,0.,1.);}';
  var FS_PT = PREC + 'uniform float uAdd;varying vec2 vU;varying vec4 vC;varying float vK;' +
    'void main(){float d=length(vU);float bok=smoothstep(1.,.5,d)*(.5+.5*smoothstep(.4,.92,d));' +
    'float sp=(exp(-d*d*9.)+.6*exp(-abs(vU.x)*14.-abs(vU.y)*2.6)+.6*exp(-abs(vU.y)*14.-abs(vU.x)*2.6))*smoothstep(1.,.55,d);' +
    'float a=mix(bok,sp,vK)*vC.a;gl_FragColor=vec4(vC.rgb*a,a*uAdd);}';
  var VS_SH = ATTR + 'uniform float uSz;varying vec2 vU;varying vec3 vCol;varying float vTy;varying mat3 vR;' +
    'mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}' +
    'mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}' +
    'mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}' +
    'void main(){float z=aS.z;vec2 p=vec2(aS.x+.07*sin(uT*.11+aS.w*20.),mod(aS.y+uT*(.005+.008*z)+1.35,2.7)-1.35+.04*sin(uT*.17+aS.w*9.));' +
    'p+=uPar*(.05+.15*z);float sz=aE.z*(.7+.5*z)*uSz;vU=aC;vTy=aE.x;' +
    'if(aE.x<1.5)vR=rx(uT*.13+aS.w*3.)*ry(uT*(.16+.2*aS.w)+aS.w*6.);' +
    'else vR=rz(.5*sin(uT*.21+aS.w*8.)+aS.w*2.-1.)*rx(.55*sin(uT*.33+aS.w*4.))*ry(.8*sin(uT*.41+aS.w*6.));' +
    'vec3 col=aE.y<.33?uC1:(aE.y<.66?uC2:uC3);vCol=mix(col,vec3(1.),mix(.34,.18,uDark));' +
    'gl_Position=vec4(p+aC*sz*uSc*2./uRes,0.,1.);}';
  var FS_SH = PREC + 'uniform float uDark,uA;varying vec2 vU;varying vec3 vCol;varying float vTy;varying mat3 vR;' +
    'float star(vec2 p){const vec2 k1=vec2(.809016994,-.587785252);const vec2 k2=vec2(-.809016994,-.587785252);' +
    'p.x=abs(p.x);p-=2.*max(dot(k1,p),0.)*k1;p-=2.*max(dot(k2,p),0.)*k2;p.x=abs(p.x);p.y-=.56;' +
    'vec2 ba=.5*vec2(.587785252,.809016994)-vec2(0.,1.);float h=clamp(dot(p,ba)/dot(ba,ba),0.,.56);return length(p-ba*h)*sign(p.y*ba.x-p.x*ba.y);}' +
    'float paw(vec2 p){p.x=abs(p.x);float d=length((p-vec2(0.,-.17))*vec2(1.,1.22))-.29;' +
    'd=min(d,length(p-vec2(.40,.06))-.125);d=min(d,length(p-vec2(.15,.36))-.135);return d;}' +
    'float map(vec3 p){if(vTy<.5)return length(p)-.56;' +
    'if(vTy<1.5){vec3 q=abs(p)-.31;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-.13;}' +
    'float d2=vTy<2.5?star(p.xy)-.02:paw(p.xy);vec2 w=vec2(d2,abs(p.z)-.09);return min(max(w.x,w.y),0.)+length(max(w,0.))-.07;}' +
    'void main(){vec3 ro=vec3(vU*1.3,1.3);float t=0.,md=9.,d=1.;bool hit=false;vec3 p=vec3(0.);' +
    'if(dot(vU,vU)>1.){discard;}' +
    'for(int i=0;i<20;i++){p=vR*(ro-vec3(0.,0.,t));d=map(p);md=min(md,d);if(d<.006){hit=true;break;}t+=d;if(t>2.6)break;}' +
    'float fade=smoothstep(1.,.62,length(vU));float halo=exp(-max(md,0.)*5.5)*.30*fade*mix(.6,1.,uDark);vec3 col=vec3(0.);float a=0.;' +
    'if(hit){vec2 e=vec2(.012,-.012);vec3 n=normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));' +
    'vec3 base=vCol;if(vTy<.5){float th=sin(dot(p,vec3(.25,1.,.2))*17.)*.5+.5;float th2=sin(dot(p,vec3(1.,.3,-.4))*17.)*.5+.5;' +
    'base*=.74+.26*mix(th,th2,smoothstep(-.15,.15,p.z+p.x*.5));}' +
    'n=n*vR;float dif=clamp(dot(n,normalize(vec3(-.45,.6,.65))),0.,1.);float fr=pow(1.-clamp(n.z,0.,1.),2.4);' +
    'float sp=pow(clamp(dot(n,normalize(vec3(-.35,.5,1.))),0.,1.),28.);' +
    'col=base*(mix(.64,.40,uDark)+mix(.40,.62,uDark)*dif)+fr*mix(base,vec3(1.),.65)*.75+sp*.45;a=mix(.86,.50,uDark);}' +
    'a*=uA;gl_FragColor=vec4(col*a+vCol*halo*uA,a+halo*uA*mix(.9,.35,uDark));}';

  function prog(vs, fs, names) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('vibe shader: ' + gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, vs === VS_BG ? 'aP' : 'aC'); gl.bindAttribLocation(p, 1, 'aS'); gl.bindAttribLocation(p, 2, 'aE');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('vibe link: ' + gl.getProgramInfoLog(p));
    var u = { p: p };
    names.split(' ').forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
    return u;
  }
  var rs = 1;
  function rnd() { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; }
  function sprites(n, fill) { // n quads, 6 vertices each, 10 floats per vertex: corner(2) seed(4) extra(4)
    var a = new Float32Array(n * 6 * FL), cx = [-1, 1, -1, -1, 1, 1], cy = [-1, -1, 1, 1, -1, 1], i, v, o, s;
    for (i = 0; i < n; i++) {
      s = fill ? fill(i) : [0, 0, 0, 0, -9, 0, 0, 0];
      for (v = 0; v < 6; v++) { o = (i * 6 + v) * FL; a[o] = cx[v]; a[o + 1] = cy[v]; a.set(s, o + 2); }
    }
    return a;
  }
  function buf(data, dyn) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return b; }
  function initGL() {
    var opt = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power', desynchronized: false };
    gl = cv.getContext('webgl2', opt) || cv.getContext('webgl', opt) || cv.getContext('experimental-webgl', opt);
    if (!gl) return false;
    try {
      var dbg = gl.getExtension('WEBGL_debug_renderer_info'), ren = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      softGL = /swiftshader|llvmpipe|software|softpipe|basic render/i.test(ren);
    } catch (e) {}
    var U = 'uT uSc uDark uRes uPar uC1 uC2 uC3 ';
    P = {
      bg: prog(VS_BG, FS_BG, 'uRes uPar uT uDark uInt uOv uPulse uC1 uC2 uC3 uPC uRC uRip'),
      pt: prog(VS_PT, FS_PT, U + 'uMode uA uAdd'),
      sh: prog(VS_SH, FS_SH, U + 'uA uSz')
    };
    rs = 20240611;
    burstData = sprites(NB);
    B = {
      quad: buf(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])),
      pt: buf(sprites(NP, function (i) { // spread evenly, the first ones are used at every quality level
        return [((i * 0.618034) % 1) * 2.3 - 1.15 + (rnd() - 0.5) * 0.2, rnd() * 2.4 - 1.2, rnd(), rnd(), rnd(), rnd(), rnd(), rnd()];
      })),
      sh: buf(sprites(NS, function (i) {
        var x = ((i * 0.618034 + 0.13) % 1) * 2 - 1;
        return [x * 0.92, rnd() * 2.7 - 1.35, 0.25 + 0.75 * rnd(), rnd(), i % 4, (i * 0.37 + 0.1) % 1, 52 + 40 * rnd(), rnd()];
      })),
      bu: buf(burstData, true)
    };
    gl.disable(gl.DEPTH_TEST); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);
    needSize = true; lostCtx = false;
    return true;
  }
  function size() {
    needSize = false;
    var w = Math.max(1, W.innerWidth), h = Math.max(1, W.innerHeight), dpr = Math.min(W.devicePixelRatio || 1, 1.5);
    var small = Math.min(W.screen ? screen.width : w, W.screen ? screen.height : h) < 420 || (navigator.hardwareConcurrency || 8) <= 4;
    if (small) dpr = Math.min(dpr, 1.25);
    var sc = S.level >= 2 ? dpr * 0.8 : S.level === 1 ? Math.min(dpr, 1.25) * 0.62 : 0.5;
    var cap = S.level >= 2 ? 1.0e6 : S.level === 1 ? 5.5e5 : 2.6e5, px = w * h * sc * sc;
    if (px > cap) sc *= Math.sqrt(cap / px);
    if (S.mode === 'overlay') sc = Math.min(sc, 0.6);
    scale = sc;
    var cw = Math.max(2, Math.round(w * sc)), ch = Math.max(2, Math.round(h * sc));
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  }
  function bind(b) {
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, FL * 4, 0); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FL * 4, 8); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, FL * 4, 24);
  }
  function common(u, t) {
    gl.useProgram(u.p);
    gl.uniform1f(u.uT, t); gl.uniform1f(u.uDark, S.darkF); gl.uniform2f(u.uRes, cv.width, cv.height); gl.uniform2f(u.uPar, S.par[0], S.par[1]);
    if (u.uSc) gl.uniform1f(u.uSc, scale);
    gl.uniform3fv(u.uC1, S.cur[0]); gl.uniform3fv(u.uC2, S.cur[1]); gl.uniform3fv(u.uC3, S.cur[2]);
  }
  function draw(ms, dt) {
    if (!gl || lostCtx || !S.cur) return;
    if (needSize) size();
    var t = S.isStatic ? 21.7 : (ms - t0) / 1000, k = Math.min(1, dt / 1000), i, j, ov = S.mode === 'overlay';
    // ease palette, parallax, pulse
    var e = S.isStatic ? 1 : Math.min(1, k * 2.5);
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) S.cur[i][j] += (S.tgt[i][j] - S.cur[i][j]) * e;
    S.darkF += ((S.dark ? 1 : 0) - S.darkF) * e;
    S.par[0] += (S.parT[0] - S.par[0]) * Math.min(1, k * 3); S.par[1] += (S.parT[1] - S.par[1]) * Math.min(1, k * 3);
    S.pulse *= Math.exp(-k * 2.2); if (S.pulse < 0.004) S.pulse = 0;
    S.rip[2] += k;
    var fx = S.pulse > 0 || S.rip[2] < 1.6, burstLive = t - S.lastBurst < 1.2;
    gl.viewport(0, 0, cv.width, cv.height);
    gl.disable(gl.BLEND);
    if (!ov || fx) {
      var u = P.bg; common(u, t);
      gl.uniform1f(u.uInt, S.intensity); gl.uniform1f(u.uOv, ov ? 1 : 0); gl.uniform1f(u.uPulse, S.pulse);
      gl.uniform3fv(u.uPC, S.pulseCol); gl.uniform3fv(u.uRC, S.ripCol);
      gl.uniform4f(u.uRip, S.rip[0], S.rip[1], S.rip[2], S.rip[2] < 1.6 ? S.rip[3] : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, B.quad); gl.enableVertexAttribArray(0); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    var np = ov ? 0 : S.level >= 2 ? NP : S.level === 1 ? 44 : 24, ns = ov ? 0 : S.level >= 2 ? NS : S.level === 1 ? 5 : 3;
    u = P.pt; common(u, t); gl.uniform1f(u.uAdd, 0.45 + 0.55 * (1 - S.darkF)); gl.uniform1f(u.uA, Math.min(1.2, S.intensity));
    if (np) { gl.uniform1f(u.uMode, 0); bind(B.pt); gl.drawArrays(gl.TRIANGLES, 0, np * 6); }
    if (ns) {
      var us = P.sh; common(us, t); gl.uniform1f(us.uA, Math.min(1, S.intensity)); gl.uniform1f(us.uSz, Math.max(0.85, Math.min(1.5, Math.min(W.innerWidth, W.innerHeight) / 620))); bind(B.sh); gl.drawArrays(gl.TRIANGLES, 0, ns * 6);
    }
    if (burstLive) { gl.useProgram(u.p); gl.uniform1f(u.uMode, 1); gl.uniform1f(u.uA, 1); bind(B.bu); gl.drawArrays(gl.TRIANGLES, 0, NB * 6); }
    return fx || burstLive;
  }
  function drawOnce() { try { if (gl && !lostCtx && cv && S.mode !== 'idle' && S.mode !== 'css' && S.mode !== 'off') draw(now(), 16); } catch (e) { fail(e); } }

  /* ---------------- loop + self-tuning ---------------- */
  var frame = safe(function (ms) {
    raf = 0;
    if (!S.running) return;
    raf = W.requestAnimationFrame(frame);
    var dt = ms - last; last = ms;
    if (dt > 0) measure(dt);
    acc += dt;
    var iv = 1000 / S.fps;
    if (acc < iv - 3) return;
    var step = Math.min(acc, 100); acc = acc > iv * 3 ? 0 : acc - iv; if (acc < 0) acc = 0;
    var a = now(), live = draw(ms, step);
    dSum += now() - a; dN++;
    if (S.mode === 'overlay' && !live) stop(); // overlay only runs while an effect is fading
  });
  function measure(dt) {
    if (S.lock || S.mode === 'overlay') return;
    if (mSkip > 0) { mSkip--; return; }
    if (D.readyState !== 'complete' || now() < mFrom) return; // page still loading: its jank is not ours
    if (dt > 400) return; // tab switch / debugger pause
    mSum += dt; mN++;
    if (mN < 50 && mSum < 900) return;
    var avg = mSum / mN, cpu = dN ? dSum / dN : 0;
    mSum = mN = dSum = dN = 0; mWin++;
    if (avg > 23 || cpu > 3.5) mBad++; else mBad = 0; // < ~43 fps on the page, or our own draw calls cost > 3.5 ms of CPU
    if (mBad >= (mWin <= 5 ? 1 : 3)) { mBad = 0; stepDown(); if (avg > 45) stepDown(); } // under ~22 fps: drop two steps at once
  }
  function stepDown() {
    if (S.level > 0) { S.level--; needSize = true; mSkip = 8; S.fps = S.userFps || (S.game || S.level < 1 ? 30 : 60); }
    else if (!S.isStatic) { S.isStatic = true; drawOnce(); stop(); } // too slow even at low quality: keep one still frame, cost nothing
  }
  function start() {
    if (S.running || !S.on || S.paused || S.isStatic || D.hidden || lostCtx || !gl) return;
    if (S.mode !== 'behind' && S.mode !== 'overlay') return;
    S.running = true; last = now(); acc = 1e3; mSkip = Math.max(mSkip, 8);
    raf = W.requestAnimationFrame(frame);
  }
  function stop() { S.running = false; if (raf) { W.cancelAnimationFrame(raf); raf = 0; } if (S.mode === 'overlay' && cv && gl && !lostCtx) { try { gl.clear(gl.COLOR_BUFFER_BIT); } catch (e) {} } }

  /* ---------------- DOM ---------------- */
  function layer(el) {
    var s = el.style;
    s.position = 'fixed'; s.left = '0'; s.top = '0'; s.width = '100%'; s.height = '100%'; s.margin = '0'; s.padding = '0'; s.border = '0';
    s.pointerEvents = 'none'; s.zIndex = '-1'; s.display = 'block'; s.userSelect = 'none'; s.contain = 'strict'; s.background = 'none';
    el.setAttribute('aria-hidden', 'true'); el.setAttribute('data-vibe', '1');
  }
  function ensureCanvas() {
    if (cv) return true;
    cv = D.createElement('canvas'); cv.width = 2; cv.height = 2; layer(cv);
    cv.style.opacity = '0'; cv.style.transition = 'opacity .7s ease';
    cv.addEventListener('webglcontextlost', function (e) { try { e.preventDefault(); lostCtx = true; stop(); } catch (x) {} }, false);
    cv.addEventListener('webglcontextrestored', safe(function () { if (initGL()) { if (S.isStatic) drawOnce(); else start(); } }), false);
    var ok = false;
    try { ok = initGL(); } catch (e) { ok = false; }
    if (!ok) { dropGL(); return false; }
    if (softGL && !S.lock && pref !== 'force') { S.level = 0; S.isStatic = true; } // software rasteriser (no real GPU): one still frame only
    H.appendChild(cv); // a sibling of <body>: never disturbs body child selectors / flex layouts
    return true;
  }
  function dropGL() {
    try { stop(); if (gl) { var x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } } catch (e) {}
    try { if (cv && cv.parentNode) cv.parentNode.removeChild(cv); } catch (e) {}
    cv = null; gl = null; P = null; B = null;
  }
  function paintCss() {
    if (!cssBox || !S.tgt) return;
    var k = cssBox.children, i, c;
    for (i = 0; i < k.length; i++) {
      c = S.tgt[i % 3];
      k[i].style.background = 'radial-gradient(circle closest-side,rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (S.dark ? 0.42 : 0.5) + '),rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',0))';
    }
  }
  function ensureCss() { // no-GL ambience for pages that own a WebGL context: 3 soft blobs moved by the compositor only
    if (cssBox) return;
    cssBox = D.createElement('div'); layer(cssBox); cssBox.style.overflow = 'hidden';
    var pos = [[-18, -22], [42, 18], [8, 52], [0, 0]], i, b;
    for (i = 0; i < 4; i++) {
      b = D.createElement('div'); b.style.cssText = 'position:absolute;width:86vmax;height:86vmax;border-radius:50%;will-change:transform;left:' + pos[i][0] + 'vw;top:' + pos[i][1] + 'vh';
      if (i === 3) b.style.cssText = 'position:absolute;left:-10%;top:-10%;width:120%;height:120%;opacity:0';
      cssBox.appendChild(b);
      if (i < 3 && b.animate && !S.isStatic) {
        try {
          b.animate([{ transform: 'translate3d(0,0,0) scale(1)' }, { transform: 'translate3d(' + (i === 1 ? -22 : 18) + 'vw,' + (i === 2 ? -20 : 14) + 'vh,0) scale(1.18)' }],
            { duration: 23000 + i * 7000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
        } catch (e) {}
      }
    }
    paintCss(); H.appendChild(cssBox);
  }
  function dropCss() { try { if (cssBox && cssBox.parentNode) cssBox.parentNode.removeChild(cssBox); } catch (e) {} cssBox = null; }
  function setMode(m) {
    var prev = S.mode;
    if (m === 'behind' || m === 'overlay') {
      if (glPage) { m = m === 'behind' ? 'css' : 'idle'; } else if (!ensureCanvas()) { S.mode = 'off'; S.on = false; return; }
    }
    S.mode = m;
    if (m === 'css') { dropGL(); ensureCss(); return; }
    dropCss();
    if (m === 'idle' || m === 'off') { stop(); if (cv) cv.style.display = 'none'; return; }
    var s = cv.style; s.display = 'block';
    if (m === 'overlay') { s.zIndex = '2147483000'; s.opacity = '0.1'; s.transition = 'none'; }
    else { s.zIndex = '-1'; s.transition = prev === 'overlay' ? 'none' : 'opacity .7s ease'; s.opacity = '1'; }
    needSize = true;
    if (m === 'overlay') { stop(); return; } // event driven
    if (S.isStatic) drawOnce(); else start();
  }
  function teardown(all) {
    stop(); if (timer) { clearInterval(timer); timer = 0; }
    dropGL(); dropCss(); unhoist(); bgDirty = true; if (obs) obs.takeRecords();
    if (all && obs) { try { obs.disconnect(); } catch (e) {} obs = null; }
  }

  /* ---------------- effects ---------------- */
  function col3(c, d) { var p = parseCol(c); return p ? [p[0], p[1], p[2]] : d; }
  function live() { return S.on && !S.paused && !S.isStatic && !D.hidden; }
  var pulse = safe(function (strength, color) {
    if (!live()) return;
    var st = Math.max(0, Math.min(1.5, strength == null ? 0.6 : +strength || 0)), c = col3(color, S.tgt ? S.tgt[1] : [1, 1, 1]);
    if (S.mode === 'css') {
      var f = cssBox && cssBox.lastChild;
      if (f && f.animate) {
        f.style.background = 'radial-gradient(circle closest-side,rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',.6),rgba(255,255,255,0))';
        f.animate([{ opacity: 0 }, { opacity: Math.min(0.5, 0.3 * st) }, { opacity: 0 }], { duration: 900, easing: 'ease-out' });
      }
      return;
    }
    if (S.mode !== 'behind' && S.mode !== 'overlay') return;
    S.pulse = Math.max(S.pulse, st); S.pulseCol = c; start();
  });
  function emit(x, y, color, n, power, ring) {
    if (!live() || !gl || lostCtx || (S.mode !== 'behind' && S.mode !== 'overlay')) return;
    var w = W.innerWidth, h = W.innerHeight, cx = x / w * 2 - 1, cy = 1 - y / h * 2, asp = w / h, t = (now() - t0) / 1000, i, v, o, a, r;
    var c = col3(color, null), pal = S.tgt || [[1, 1, 1], [1, 1, 1], [1, 1, 1]];
    for (i = 0; i < n; i++) {
      a = Math.random() * 6.2832; r = (0.35 + 0.65 * Math.random()) * power;
      var cc = c || pal[(Math.random() * 3) | 0], s = [cx, cy, Math.cos(a) * r / asp, Math.sin(a) * r + power * 0.25, t, cc[0], cc[1], cc[2]];
      for (v = 0; v < 6; v++) { o = (burstAt * 6 + v) * FL + 2; burstData.set(s, o); }
      burstAt = (burstAt + 1) % NB;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, B.bu); gl.bufferSubData(gl.ARRAY_BUFFER, 0, burstData);
    S.lastBurst = t;
    if (ring) { S.rip = [cx * asp, cy, 0, ring]; S.ripCol = c || pal[0]; }
    start();
  }
  var burst = safe(function (x, y, color) {
    if (x == null) x = W.innerWidth / 2; if (y == null) y = W.innerHeight / 2;
    emit(+x, +y, color, S.level >= 1 ? 16 : 9, 0.34, 0.55);
  });
  var lastTap = 0;
  var onDown = safe(function (e) {
    var t = now(); if (t - lastTap < 140 || !live() || S.mode !== 'behind') return; lastTap = t;
    emit(e.clientX, e.clientY, null, 4, 0.11, 0.2);
  });
  var onMove = function (e) { // parallax target only – nothing else happens per event
    if (e.pointerType === 'touch') return;
    S.parT[0] = (e.clientX / W.innerWidth - 0.5) * -2; S.parT[1] = (e.clientY / W.innerHeight - 0.5) * 2;
  };
  var onTilt = function (e) {
    if (e.gamma == null || e.beta == null) return;
    S.parT[0] = Math.max(-1, Math.min(1, e.gamma / 25)); S.parT[1] = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
  };
  function hookRewards() {
    var R = W.AnnabelleRewards;
    if (hooked || !R || typeof R.onChange !== 'function') return;
    hooked = true;
    function coins() { try { return +R.coins() || 0; } catch (e) { return 0; } }
    function lvl() { try { var l = R.level(); return +(l && l.level != null ? l.level : l) || 0; } catch (e) { return 0; } }
    var c = coins(), l = lvl();
    R.onChange(function () {
      try {
        var c2 = coins(), l2 = lvl();
        if (l2 > l) { pulse(1, GOLD); burst(W.innerWidth / 2, W.innerHeight * 0.42, GOLD); }
        else if (c2 > c) pulse(Math.min(0.9, 0.3 + (c2 - c) / 40), GOLD);
        c = c2; l = l2;
      } catch (e) {}
    });
  }

  /* ---------------- lifecycle ---------------- */
  function reduced() { try { return !!(mq && mq.matches); } catch (e) { return false; } }
  /* calm mode (default ON): no ambient motion anywhere. Read straight from the key, catalog.js is not on every page. */
  function calmOn() { try { return W.localStorage.getItem('annabelle-calm') !== '0'; } catch (e) { return true; } }
  var boot = safe(function () {
    if (S.on || calmOn()) return; // calm: never boot (also refuses Vibe.on() from a page)
    S.on = true; S.paused = false;
    S.isStatic = reduced();
    if (!t0) t0 = now() - 4000;
    mFrom = now() + 700;
    if (D.readyState !== 'complete') W.addEventListener('load', function () { mFrom = now() + 700; mSum = mN = 0; });
    retheme(true);
    evaluate();
    if (!S.on) return;
    if (!timer) timer = setInterval(safe(function () { if (!D.hidden && S.on) { evaluate(); hookRewards(); } }), 3500);
    hookRewards();
  });
  var off = safe(function () { S.on = false; teardown(false); S.mode = 'off'; });
  var api = {
    set: safe(function (o) {
      o = o || {};
      if (o.colors) { var c = o.colors.map(function (x) { return col3(x, null); }).filter(Boolean); if (c.length) { while (c.length < 3) c.push(c[c.length - 1]); S.userPal = c.slice(0, 3); } }
      if (o.colors === null) S.userPal = null;
      if ('dark' in o) S.userDark = o.dark;
      if (o.intensity != null) S.intensity = Math.max(0, Math.min(1.5, +o.intensity || 0));
      if ('fps' in o) S.userFps = o.fps ? Math.max(10, Math.min(60, +o.fps)) : 0;
      if ('mode' in o) S.userMode = /^(behind|overlay|css|idle)$/.test(o.mode) ? o.mode : '';
      if (o.quality) {
        var q = String(o.quality), ix = NAMES.indexOf(q);
        if (q === 'auto') { S.lock = false; S.isStatic = reduced() || (softGL && pref !== 'force'); S.level = baseLevel(); mWin = 0; mSkip = 8; }
        else if (q === 'static') { S.lock = true; S.isStatic = true; stop(); }
        else if (ix >= 0) { S.lock = true; S.level = ix; S.isStatic = reduced(); }
        needSize = true;
      }
      if (S.on) { retheme(false); evaluate(); if (S.isStatic) drawOnce(); else start(); }
    }),
    pulse: pulse, burst: burst,
    pause: safe(function () { S.paused = true; stop(); }),
    resume: safe(function () { S.paused = false; if (S.on) start(); }),
    off: off, on: function () { boot(); }
  };
  Object.defineProperty(api, 'quality', { enumerable: true, get: function () { return !S.on || S.mode === 'off' ? 'off' : S.isStatic ? 'static' : NAMES[S.level]; } });
  Object.defineProperty(api, 'mode', { enumerable: true, get: function () { return S.mode; } });
  W.Vibe = api;

  function baseLevel() {
    var mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8, l = 2;
    if (mem <= 4 || cores <= 4) l = 1;
    if (mem <= 2 || cores <= 2) l = 0;
    return l;
  }
  try { pref = W.localStorage.getItem('annabelle-vibe'); } catch (e) {}
  if (pref === '0' || pref === 'off') return; // API stays as harmless no-ops until Vibe.on()
  try {
    if (navigator.connection && navigator.connection.saveData) return;
    S.level = baseLevel();
    if (pref === 'low') { S.level = 0; S.lock = true; }
    mq = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var onMq = safe(function () {
      if (!S.on) return;
      S.isStatic = reduced() || (softGL && !S.lock && pref !== 'force');
      if (S.isStatic) { stop(); drawOnce(); } else start();
      if (cssBox) { dropCss(); if (S.mode === 'css') ensureCss(); }
    });
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }
    D.addEventListener('visibilitychange', safe(function () { if (D.hidden) stop(); else if (S.mode === 'behind') start(); }));
    W.addEventListener('pagehide', function () { try { stop(); } catch (e) {} });
    W.addEventListener('pageshow', safe(function () { if (S.on && S.mode === 'behind') start(); }));
    W.addEventListener('resize', safe(function () { needSize = true; if (S.isStatic || !S.running) drawOnce(); }), { passive: true });
    W.addEventListener('pointerdown', onDown, { passive: true, capture: true });
    W.addEventListener('pointermove', onMove, { passive: true });
    if ('ondeviceorientation' in W && W.matchMedia && W.matchMedia('(pointer: coarse)').matches) W.addEventListener('deviceorientation', onTilt, { passive: true });
    if (W.MutationObserver) {
      var deb = 0, lastObs = 0;
      obs = new MutationObserver(function () { // page theme / background changed (rate limited: some games restyle <html> a lot)
        if (deb) return;
        deb = setTimeout(safe(function () { deb = 0; lastObs = now(); if (S.on) { bgDirty = true; retheme(false); evaluate(); } }), Math.max(150, 1200 - (now() - lastObs)));
      });
      obs.observe(H, { attributes: true, attributeFilter: ['data-th', 'class', 'style'] });
      var arm = function () {
        try {
          if (D.body) obs.observe(D.body, { attributes: true, attributeFilter: ['class', 'style'] });
          var m = D.querySelector('meta[name="theme-color"]'); if (m) obs.observe(m, { attributes: true, attributeFilter: ['content'] });
        } catch (e) {}
      };
      arm();
    }
    /* the calm switch (store / home "more") was flipped: stop and remove everything, or start, without a reload */
    W.addEventListener('annabelle-calm', safe(function () { if (calmOn()) { if (S.on) off(); } else { boot(); if (S.on) { retheme(false); evaluate(); hookRewards(); } } }));
    var go = function () { boot(); setTimeout(safe(function () { if (S.on) { retheme(false); evaluate(); hookRewards(); } }), 900); };
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', go); else go();
  } catch (e) { fail(e); }
})();

/* Shared bottom/top inset helper: --sab/--sat = safe-area inset + small margin; --app-h = real visible height. */
(function(){
  var r=document.documentElement, p=document.createElement('div');
  p.style.cssText='position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px);padding-top:env(safe-area-inset-top,0px)';
  var dbg=+(localStorage.getItem('annabelle-debug-sab')||0);
  function up(){
    if(!p.parentNode&&document.body) document.body.appendChild(p);
    var cs=p.parentNode?getComputedStyle(p):null, b=cs?parseFloat(cs.paddingBottom)||0:0;
    var standalone=matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone||localStorage.getItem('annabelle-debug-standalone')==='1';
    var extra=standalone?10:4;
    // Android edge-to-edge PWAs: page draws under the 3-button nav bar but env() may report 0.
    var android=/Android/i.test(navigator.userAgent)||localStorage.getItem('annabelle-debug-android')==='1';
    if(standalone&&android&&b<8) b=48;
    r.style.setProperty('--sab',(Math.max(b,dbg)+extra)+'px');
    var h=(window.visualViewport&&visualViewport.height)||innerHeight;
    r.style.setProperty('--app-h',h+'px');
  }
  up(); document.addEventListener('DOMContentLoaded',up); addEventListener('load',up);
  addEventListener('resize',up); addEventListener('orientationchange',function(){setTimeout(up,300)});
  if(window.visualViewport){ var vt=0; visualViewport.addEventListener('resize',function(){ up(); clearTimeout(vt); vt=setTimeout(function(){ try{ dispatchEvent(new Event('resize')); }catch(e){} },60); }); }
  window.__sab=function(){ return parseFloat(getComputedStyle(r).getPropertyValue('--sab'))||8; };
})();

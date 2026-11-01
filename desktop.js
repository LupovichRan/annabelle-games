/* Annabelle games – laptop/desktop helpers (mouse + keyboard). Loaded by every page.
   - adds class "desk" on <html> when the primary pointer is a mouse/trackpad (hover:hover + pointer:fine)
   - pointer cursor + hover + visible keyboard-focus outline for all buttons/links
   - window.AnnabelleDesk.isDesk(): true on such devices; .typing(e): true when the key event comes from a text field */
(function () {
  'use strict';
  var mq = window.matchMedia ? matchMedia('(hover: hover) and (pointer: fine)') : {matches: false};
  function isDesk() { return !!mq.matches; }
  function apply() { document.documentElement.classList.toggle('desk', isDesk()); }
  apply(); if (mq.addEventListener) mq.addEventListener('change', apply);
  var css = '.desk button:not(:disabled),.desk a[href],.desk [role=button],.desk [data-mode],.desk [data-lang],.desk summary,.desk label{cursor:pointer}' +
    '.desk button:not(:disabled):not(.nohover):hover{filter:brightness(1.07)}' +
    '.desk :focus{outline:none}.desk :focus-visible{outline:3px solid #2a8fd0;outline-offset:3px;border-radius:8px}' +
    '.desk input,.desk textarea{user-select:text;-webkit-user-select:text}';
  function inject() { var s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); }
  inject();
  window.AnnabelleDesk = {
    isDesk: isDesk,
    typing: function (e) { var t = e && e.target; return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)); }
  };
})();

(function () {
  "use strict";
  window.App = window.App || {};

  App.utils = {
    /** Format dollar amount as $X.XX */
    formatFee: function (amount) {
      if (amount === null || amount === undefined) return "";
      return "$" + Number(amount).toFixed(2);
    },

    /** Create DOM element with optional className and textContent */
    el: function (tag, className, text) {
      var elem = document.createElement(tag);
      if (className) elem.className = className;
      if (text !== undefined) elem.textContent = text;
      return elem;
    },

    /** Debounce a function */
    debounce: function (fn, delay) {
      var timer;
      return function () {
        var args = arguments;
        var ctx = this;
        clearTimeout(timer);
        timer = setTimeout(function () {
          fn.apply(ctx, args);
        }, delay);
      };
    },

    /** Return display-friendly code (e.g. "UVC-CLAV" → "UVC") */
    displayCode: function (code) {
      if (code.indexOf("UVC-") === 0) return "UVC";
      return code;
    },

    /** Escape HTML to prevent XSS */
    escapeHtml: function (str) {
      if (!str) return "";
      var div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    },
  };
})();

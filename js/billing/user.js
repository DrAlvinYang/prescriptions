(function () {
  "use strict";
  window.App = window.App || {};

  var ALVIN_NAME = "alvin yang";
  var ALVIN_CPSO = "118749";

  /** Check unified provider storage for identity */
  App.checkUser = function () {
    var stored = localStorage.getItem("edprescriptions_provider");
    if (stored) {
      try {
        var provider = JSON.parse(stored);
        var name = (provider.name || "").toLowerCase();
        var cpso = provider.cpso || "";
        if (name === ALVIN_NAME && cpso === ALVIN_CPSO) {
          App.state.isAlvin = true;
        }
      } catch (e) {}
    }
  };
})();

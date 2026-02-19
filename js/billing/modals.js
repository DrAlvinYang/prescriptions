(function () {
  "use strict";
  window.App = window.App || {};

  /** Open the modal overlay */
  App.openModal = function () {
    document.getElementById("modal-overlay").classList.add("active");
    document.body.classList.add("modal-open");
  };

  /** Close the modal overlay */
  App.closeModal = function () {
    document.getElementById("modal-overlay").classList.remove("active");
    document.body.classList.remove("modal-open");
  };

  // Close on overlay click (outside modal box)
  document.getElementById("modal-overlay").addEventListener("click", function (e) {
    if (e.target === this) App.closeModal();
  });

  // Close on X button
  document.getElementById("modal-close").addEventListener("click", App.closeModal);

  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var overlay = document.getElementById("modal-overlay");
      if (overlay.classList.contains("active")) {
        App.closeModal();
      }
    }
  });

  /** Show General Tips modal */
  App.showTipsModal = function () {
    var tips = App.data.generalTips;
    var content = document.getElementById("modal-content");

    var html = '<h2 class="modal__title">General Billing Tips</h2><ul class="tips-list">';
    tips.forEach(function (tip) {
      html += '<li class="tips-list__item">' + App.utils.escapeHtml(tip) + "</li>";
    });
    html += "</ul>";
    content.innerHTML = html;
    App.openModal();
  };

  /** Show On-Call Calculator modal */
  App.showOnCallModal = function () {
    var tables = App.data.oncallTables;
    var content = document.getElementById("modal-content");

    var timePeriods = [
      { key: "weekday_daytime", label: "Weekday Daytime (07:00\u201317:00)" },
      { key: "weekday_daytime_sacrifice", label: "Weekday Daytime with Sacrifice of Office Hours" },
      { key: "weekend_holiday", label: "Weekend or Holiday (07:00\u201323:59)" },
      { key: "weekday_evening", label: "Weekday Evening (17:00\u201323:59)" },
      { key: "night", label: "Night (00:00\u201307:00)" },
    ];

    var tableKeys = Object.keys(tables);
    var tableOptions = tableKeys.map(function (key) {
      var t = tables[key];
      var title = typeof t === "string" ? t : t.title || key;
      return { key: key, label: key.replace("table", "Table ") + " \u2014 " + title };
    });

    var timeOptionsHtml = timePeriods
      .map(function (tp) {
        return '<option value="' + tp.key + '">' + App.utils.escapeHtml(tp.label) + "</option>";
      })
      .join("");

    var tableOptionsHtml = tableOptions
      .map(function (to) {
        return '<option value="' + to.key + '">' + App.utils.escapeHtml(to.label) + "</option>";
      })
      .join("");

    content.innerHTML =
      '<h2 class="modal__title">On-Call Billing Calculator</h2>' +
      '<div class="form-group">' +
      '<label for="oncall-time">Time Period</label>' +
      '<select id="oncall-time"><option value="">Select time period...</option>' +
      timeOptionsHtml +
      "</select></div>" +
      '<div class="form-group">' +
      '<label for="oncall-table">Table</label>' +
      '<select id="oncall-table"><option value="">Select table...</option>' +
      tableOptionsHtml +
      "</select></div>" +
      '<div id="oncall-results" class="oncall-results"></div>';

    function updateResults() {
      var timeKey = document.getElementById("oncall-time").value;
      var tableKey = document.getElementById("oncall-table").value;
      var resultsDiv = document.getElementById("oncall-results");

      if (!timeKey || !tableKey) {
        resultsDiv.innerHTML = "";
        return;
      }

      var table = tables[tableKey];
      if (!table || typeof table === "string" || !table.scenarios || !table.scenarios[timeKey]) {
        resultsDiv.innerHTML =
          '<p class="empty-state">No data available for this combination.</p>';
        return;
      }

      var scenario = table.scenarios[timeKey];
      var html = "";
      Object.keys(scenario).forEach(function (role) {
        var data = scenario[role];
        var code = data.code || "\u2014";
        var name = data.name || "";
        var fee = data.fee != null ? App.utils.formatFee(data.fee) : "TBD";
        html +=
          '<div class="oncall-result-item">' +
          '<span class="oncall-result-item__code">' + App.utils.escapeHtml(String(code)) + "</span>" +
          '<span class="oncall-result-item__name">' + App.utils.escapeHtml(name) + "</span>" +
          '<span class="oncall-result-item__fee">' + App.utils.escapeHtml(String(fee)) + "</span>" +
          "</div>";
      });

      resultsDiv.innerHTML = html;
    }

    // Bind after DOM inserted
    setTimeout(function () {
      document.getElementById("oncall-time").addEventListener("change", updateResults);
      document.getElementById("oncall-table").addEventListener("change", updateResults);
    }, 0);

    App.openModal();
  };

  /** Open Sedation Calculator placeholder modal */
  App.openSedationModal = function (code) {
    var content = document.getElementById("modal-content");
    content.innerHTML =
      '<h2 class="modal__title">Sedation Calculator</h2>' +
      '<p class="modal__text">Sedation calculator for <strong>' +
      App.utils.escapeHtml(code.code) +
      " \u2014 " +
      App.utils.escapeHtml(code.name) +
      "</strong></p>" +
      '<p class="modal__text">Base units: ' +
      (code.sedation_base_units || "N/A") +
      "</p>" +
      '<p class="modal__text" style="color: var(--color-text-muted); margin-top: var(--space-lg);">' +
      "This calculator will be functional in V2. It will calculate total sedation units based on procedure time, base units, and applicable premiums." +
      "</p>";
    App.openModal();
  };
})();

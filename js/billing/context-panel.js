(function () {
  "use strict";
  window.App = window.App || {};

  /** Main render: populate the context panel for a code */
  App.renderContextPanel = function (code) {
    var container = document.getElementById("context-panel");
    container.innerHTML = "";

    if (!code) {
      container.innerHTML =
        '<div class="empty-state">Select a billing code to see details</div>';
      return;
    }

    // Section 1: Sedation button
    if (code.sedation_affiliated) {
      container.appendChild(buildSedationButton(code));
    }

    // Section 2: Ortho fee breakdown
    if (code.is_ortho_code && code.fee > 0) {
      container.appendChild(buildOrthoBreakdown(code));
    }

    // Section 3: Modifiers
    if (code.related_modifiers && code.related_modifiers.length > 0) {
      container.appendChild(buildModifiersSection(code));
    }

    // Section 4: Commonly billed with
    if (code.commonly_billed_with && code.commonly_billed_with.length > 0) {
      container.appendChild(
        buildRelatedCodesSection("Often Billed With", "section--billed-with", code.commonly_billed_with)
      );
    }

    // Section 5: Conflicts with
    if (code.conflicts_with && code.conflicts_with.length > 0) {
      container.appendChild(
        buildRelatedCodesSection("Conflicts With", "section--conflicts", code.conflicts_with)
      );
    }

    // Section 6: Notes
    if (code.notes && code.notes.trim()) {
      container.appendChild(buildNotesSection(code.notes));
    }

    // Section 7: Hidden notes (Alvin only)
    if (App.state.isAlvin && code.hidden_notes && code.hidden_notes.trim()) {
      container.appendChild(buildHiddenNotesSection(code.hidden_notes));
    }
  };

  /**
   * Render context panel sections into an arbitrary container (for mobile inline expand).
   */
  App.renderContextPanelInto = function (container, code) {
    if (code.sedation_affiliated) {
      container.appendChild(buildSedationButton(code));
    }
    if (code.is_ortho_code && code.fee > 0) {
      container.appendChild(buildOrthoBreakdown(code));
    }
    if (code.related_modifiers && code.related_modifiers.length > 0) {
      container.appendChild(buildModifiersSection(code));
    }
    if (code.commonly_billed_with && code.commonly_billed_with.length > 0) {
      container.appendChild(
        buildRelatedCodesSection("Often Billed With", "section--billed-with", code.commonly_billed_with)
      );
    }
    if (code.conflicts_with && code.conflicts_with.length > 0) {
      container.appendChild(
        buildRelatedCodesSection("Conflicts With", "section--conflicts", code.conflicts_with)
      );
    }
    if (code.notes && code.notes.trim()) {
      container.appendChild(buildNotesSection(code.notes));
    }
    if (App.state.isAlvin && code.hidden_notes && code.hidden_notes.trim()) {
      container.appendChild(buildHiddenNotesSection(code.hidden_notes));
    }
  };

  function buildSedationButton(code) {
    var section = App.utils.el("div", "context-section section--sedation");
    var btn = App.utils.el("button", "sedation-btn", "Open Sedation Calculator");
    btn.addEventListener("click", function () {
      App.openSedationModal(code);
    });
    section.appendChild(btn);
    return section;
  }

  function buildOrthoBreakdown(code) {
    var section = App.utils.el("div", "context-section section--ortho");
    var title = App.utils.el("h3", "section__title", "Ortho Referral Fee Breakdown");
    section.appendChild(title);

    var rows = App.calculations.orthoBreakdown(code.fee);
    var table = App.utils.el("table", "ortho-table");

    rows.forEach(function (row) {
      var tr = document.createElement("tr");
      var tdLabel = App.utils.el("td", "ortho-table__label", row.label);
      var tdFormula = App.utils.el("td", "ortho-table__formula", row.formula);
      var tdAmount = App.utils.el("td", "ortho-table__amount", App.utils.formatFee(row.amount));
      tr.appendChild(tdLabel);
      tr.appendChild(tdFormula);
      tr.appendChild(tdAmount);
      table.appendChild(tr);
    });

    section.appendChild(table);
    return section;
  }

  function buildModifiersSection(parentCode) {
    var section = App.utils.el("div", "context-section section--modifiers");
    var title = App.utils.el("h3", "section__title", "Modifiers");
    section.appendChild(title);

    parentCode.related_modifiers.forEach(function (modCodeStr) {
      var modObj = App.data.codeIndex[modCodeStr];
      if (!modObj) {
        var unknown = App.utils.el("div", "code-item code-item--unknown");
        unknown.textContent = modCodeStr;
        section.appendChild(unknown);
        return;
      }

      var display = App.calculations.modifierDisplay(parentCode, modObj);
      var item = App.utils.el("div", "code-item code-item--modifier");
      item.dataset.code = modCodeStr;
      if (App.isTimeHighlighted && App.isTimeHighlighted(modCodeStr)) {
        item.classList.add("code-item--time-active");
      }

      var codeSpan = App.utils.el("span", "code-item__code", modObj.code);
      var nameSpan = App.utils.el("span", "code-item__name", modObj.name);

      item.appendChild(codeSpan);
      item.appendChild(nameSpan);

      if (display.displayText) {
        var feeClass = display.isPercentage
          ? "code-item__fee code-item__fee--calculated"
          : "code-item__fee";
        var feeSpan = App.utils.el("span", feeClass, display.displayText);
        item.appendChild(feeSpan);
      }

      section.appendChild(item);

      // E420 inline note
      if (modCodeStr === "E420") {
        var note = App.utils.el(
          "div",
          "modifier-note",
          "Requires ISS >15 (age \u226516) or ISS >12 (age <16). ISS must be documented."
        );
        section.appendChild(note);
      }
    });

    return section;
  }

  function buildRelatedCodesSection(titleText, className, codeCodes) {
    var section = App.utils.el("div", "context-section " + className);
    var title = App.utils.el("h3", "section__title", titleText);
    section.appendChild(title);

    codeCodes.forEach(function (codeStr) {
      var codeObj = App.data.codeIndex[codeStr];
      if (!codeObj) {
        var unknown = App.utils.el("div", "code-item code-item--unknown", codeStr);
        section.appendChild(unknown);
        return;
      }

      var item = App.utils.el("div", "code-item");
      item.dataset.code = codeStr;
      if (App.isTimeHighlighted && App.isTimeHighlighted(codeStr)) {
        item.classList.add("code-item--time-active");
      }

      var codeSpan = App.utils.el("span", "code-item__code", codeObj.code);
      var nameSpan = App.utils.el("span", "code-item__name", codeObj.name);
      var feeSpan = App.utils.el("span", "code-item__fee", App.utils.formatFee(codeObj.fee));

      item.appendChild(codeSpan);
      item.appendChild(nameSpan);
      item.appendChild(feeSpan);
      section.appendChild(item);
    });

    return section;
  }

  function buildNotesSection(notes) {
    var section = App.utils.el("div", "context-section section--notes");
    var title = App.utils.el("h3", "section__title", "Notes");
    section.appendChild(title);

    var content = App.utils.el("div", "notes-content");
    content.textContent = notes;
    section.appendChild(content);
    return section;
  }

  function buildHiddenNotesSection(notes) {
    var section = App.utils.el("div", "context-section section--hidden-notes");
    var title = App.utils.el("h3", "section__title", "Personal Notes (Alvin only)");
    section.appendChild(title);

    var content = App.utils.el("div", "notes-content");
    content.textContent = notes;
    section.appendChild(content);
    return section;
  }

  /** Select a code: update state, render context panel, highlight in list */
  App.selectCode = function (codeStr) {
    var codeObj = App.data.codeIndex[codeStr];
    if (!codeObj) return;

    App.state.selectedCode = codeObj;
    App.state.contextMode = "details";

    // Update context header
    var contextHeader = document.getElementById("context-header");
    if (contextHeader) contextHeader.textContent = "Details";

    App.renderContextPanel(codeObj);

    // Highlight in billing list
    var prev = document.querySelectorAll(".code-item--selected");
    for (var i = 0; i < prev.length; i++) {
      prev[i].classList.remove("code-item--selected");
    }
    var sel = document.querySelector('.code-item[data-code="' + codeStr + '"]');
    if (sel) sel.classList.add("code-item--selected");

    // On tablet, show the context drawer
    document.getElementById("col-context").classList.add("active");

    // Scroll context panel to top
    document.getElementById("context-panel").scrollTop = 0;
  };
})();

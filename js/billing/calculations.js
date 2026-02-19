(function () {
  "use strict";
  window.App = window.App || {};

  App.calculations = {
    /**
     * Ortho fee breakdown — 6 rows from base fee.
     * Returns array of { label, formula, amount }
     */
    orthoBreakdown: function (baseFee) {
      return [
        { label: "Base Fee", formula: "100%", amount: baseFee },
        {
          label: "Referred to Ortho",
          formula: "75%",
          amount: baseFee * 0.75,
        },
        {
          label: "Multiple \u2014 first code",
          formula: "75%",
          amount: baseFee * 0.75,
        },
        {
          label: "Multiple \u2014 subsequent codes",
          formula: "85% of 75%",
          amount: baseFee * 0.75 * 0.85,
        },
        {
          label: "Repeat reduction \u2014 initial",
          formula: "85% of 75%",
          amount: baseFee * 0.75 * 0.85,
        },
        {
          label: "Repeat reduction \u2014 final",
          formula: "75%",
          amount: baseFee * 0.75,
        },
      ];
    },

    /**
     * Modifier display data.
     * @param {Object} parentCode — the code being viewed (need its fee)
     * @param {Object} modifierCode — the modifier code object from codeIndex
     * @returns {{ isPercentage, percentage, calculatedAmount, displayText }}
     */
    modifierDisplay: function (parentCode, modifierCode) {
      if (modifierCode.modifier_percentage != null) {
        var pct = modifierCode.modifier_percentage;
        var amount = parentCode.fee * (pct / 100);
        return {
          isPercentage: true,
          percentage: pct,
          calculatedAmount: amount,
          displayText: "+" + pct + "% (" + App.utils.formatFee(amount) + ")",
        };
      } else if (modifierCode.fee > 0) {
        return {
          isPercentage: false,
          percentage: null,
          calculatedAmount: modifierCode.fee,
          displayText: App.utils.formatFee(modifierCode.fee),
        };
      } else {
        return {
          isPercentage: false,
          percentage: null,
          calculatedAmount: null,
          displayText: "",
        };
      }
    },
  };
})();

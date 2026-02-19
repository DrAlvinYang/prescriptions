/**
 * OHIP ED Billing Reference — Time-Period Highlighting
 *
 * Detects the current OHIP billing time period and highlights
 * applicable assessment H-codes and premium codes.
 *
 * Time periods:
 *   night           00:00-08:00  (any day)
 *   weekday_day     08:00-17:00  (non-holiday weekday)
 *   weekday_evening 17:00-24:00  (non-holiday weekday)
 *   weekend_holiday 08:00-24:00  (weekend or statutory holiday)
 *
 * Holiday computation follows the OHIP SOB H-code holiday definition.
 */
(function () {
  "use strict";
  window.App = window.App || {};

  // ─── Code-to-period mapping ──────────────────────────────────────
  var TIME_PERIOD_CODES = {
    night:           ["H121", "H122", "H123", "H124", "H112", "E413"],
    weekday_day:     ["H101", "H102", "H103", "H104"],
    weekday_evening: ["H131", "H132", "H133", "H134", "E412"],
    weekend_holiday: ["H151", "H152", "H153", "H154", "H113", "E412"],
  };

  var PERIOD_LABELS = {
    night:           "Night (00:00\u201308:00)",
    weekday_day:     "Weekday Day (08:00\u201317:00)",
    weekday_evening: "Weekday Evening (17:00\u201324:00)",
    weekend_holiday: "Weekend / Holiday (08:00\u201324:00)",
  };

  // ─── Holiday computation ─────────────────────────────────────────

  var holidayCache = {}; // year → Set of "YYYY-MM-DD"

  /** Format a Date as "YYYY-MM-DD" */
  function fmtDate(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  /** Add days to a Date, return new Date */
  function addDays(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  /** Nth weekday of a month (weekday: 0=Sun..6=Sat, n: 1-based) */
  function nthWeekday(year, month, weekday, n) {
    var d = new Date(year, month, 1);
    while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + (n - 1) * 7);
    return d;
  }

  /** Easter Sunday via Anonymous Gregorian algorithm */
  function easterSunday(year) {
    var a = year % 19;
    var b = Math.floor(year / 100);
    var c = year % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31);
    var day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  /**
   * Build the set of holiday date strings for a given year.
   * Uses the OHIP SOB H-code holiday definition.
   */
  function buildHolidays(year) {
    var dates = [];

    // Helper: add a date
    function add(d) { dates.push(fmtDate(d)); }

    // 1. New Year's Day + observed Monday if Sat/Sun
    var ny = new Date(year, 0, 1);
    add(ny);
    if (ny.getDay() === 6) add(new Date(year, 0, 3));      // Sat → Mon
    else if (ny.getDay() === 0) add(new Date(year, 0, 2));  // Sun → Mon

    // 2. Family Day — 3rd Monday of February
    add(nthWeekday(year, 1, 1, 3));

    // 3. Good Friday — Easter Sunday minus 2
    add(addDays(easterSunday(year), -2));

    // 4. Victoria Day — Monday on or before May 24
    var may24 = new Date(year, 4, 24);
    var vicDay = new Date(may24);
    while (vicDay.getDay() !== 1) vicDay.setDate(vicDay.getDate() - 1);
    add(vicDay);

    // 5. Canada Day (Jul 1) — if Sat/Sun, include BOTH Fri before AND Mon after
    var canada = new Date(year, 6, 1);
    add(canada);
    if (canada.getDay() === 6) {          // Sat
      add(addDays(canada, -1));           // Fri Jun 30
      add(addDays(canada, 2));            // Mon Jul 3
    } else if (canada.getDay() === 0) {   // Sun
      add(addDays(canada, -2));           // Fri Jun 29
      add(addDays(canada, 1));            // Mon Jul 2
    }

    // 6. Civic Holiday — 1st Monday of August
    add(nthWeekday(year, 7, 1, 1));

    // 7. Labour Day — 1st Monday of September
    add(nthWeekday(year, 8, 1, 1));

    // 8. Thanksgiving — 2nd Monday of October
    add(nthWeekday(year, 9, 1, 2));

    // 9. December 25–31 inclusive
    for (var d = 25; d <= 31; d++) {
      add(new Date(year, 11, d));
    }

    // 10. If Christmas (Dec 25) falls on Sat or Sun, also Friday before
    var xmas = new Date(year, 11, 25);
    if (xmas.getDay() === 6) add(new Date(year, 11, 24));      // Sat → Fri Dec 24
    else if (xmas.getDay() === 0) add(new Date(year, 11, 23)); // Sun → Fri Dec 23

    return new Set(dates);
  }

  /** Check if a date is a statutory holiday (H-code definition) */
  function isHoliday(date) {
    var year = date.getFullYear();
    if (!holidayCache[year]) {
      holidayCache[year] = buildHolidays(year);
    }
    return holidayCache[year].has(fmtDate(date));
  }

  // ─── Time period detection ───────────────────────────────────────

  function detectTimePeriod(date) {
    var hour = date.getHours();

    // Night: 00:00-07:59, any day
    if (hour < 8) return "night";

    // Weekend or holiday: 08:00-23:59
    var day = date.getDay();
    if (day === 0 || day === 6 || isHoliday(date)) return "weekend_holiday";

    // Weekday: 08:00-16:59 = day, 17:00-23:59 = evening
    if (hour < 17) return "weekday_day";
    return "weekday_evening";
  }

  // ─── Public API ──────────────────────────────────────────────────

  App.timePeriod = null;         // { id, label }
  App.timeHighlightCodes = null; // Set of code strings

  /** Detect current time period and build the active code set */
  App.detectTimePeriod = function (dateOverride) {
    var now = dateOverride || new Date();
    var id = detectTimePeriod(now);
    App.timePeriod = { id: id, label: PERIOD_LABELS[id] };
    App.timeHighlightCodes = new Set(TIME_PERIOD_CODES[id] || []);
  };

  /** Check if a code should be highlighted for the current time period */
  App.isTimeHighlighted = function (codeStr) {
    return App.timeHighlightCodes != null && App.timeHighlightCodes.has(codeStr);
  };

  // ─── Periodic refresh (every 60s) ───────────────────────────────

  function refreshTimeHighlights() {
    var items = document.querySelectorAll(".code-item[data-code]");
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle(
        "code-item--time-active",
        App.timeHighlightCodes.has(items[i].dataset.code)
      );
    }
  }

  setInterval(function () {
    var prev = App.timePeriod ? App.timePeriod.id : null;
    App.detectTimePeriod();
    if (App.timePeriod.id !== prev) {
      refreshTimeHighlights();
    }
  }, 60000);
})();

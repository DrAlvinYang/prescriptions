(function () {
  "use strict";
  window.App = window.App || {};

  // ─── State ──────────────────────────────────────────────────────
  App.state = {
    view: "browse", // 'browse' | 'search'
    navPath: [], // e.g., ['Ortho & MSK', 'Hand']
    selectedCode: null, // billing code object or null
    searchQuery: "",
    searchResults: null,
    highlightIndex: -1, // arrow-key index into billing search results (-1 = none)
    browseHighlightIndex: -1, // arrow-key index into browse view items (-1 = none)
    isAlvin: false,
    expandedMobileCode: null,
    contextMode: "empty", // 'empty' | 'preview' | 'details'
    previewGroup: null, // group key when right column shows preview
    previewSubgroup: null, // subgroup key when right column shows preview
  };

  // ─── Data ───────────────────────────────────────────────────────
  App.data = {
    billingCodes: [],
    diagnosticCodes: [],
    generalTips: [],
    oncallTables: {},
    codeIndex: {}, // code string -> code object
    folderTree: {}, // built by navigation.js
    anatomySections: {}, // anatomy_sections.json (Ortho & MSK)
  };

  // ─── Column Resizing (Desktop Only) ─────────────────────────────
  function initColumnResizers() {
    var dashboard = document.getElementById("billing-dashboard");
    var resizer1 = document.getElementById("resizer-1");
    var resizer2 = document.getElementById("resizer-2");
    if (!resizer1 || !resizer2) return;

    var activeResizer = null;
    var MIN_DIAG = 200;    // px — code + name
    var MIN_BILLING = 250; // px — code + name + fee
    var MIN_CONTEXT = 300; // px — detail sections

    function onMouseDown(e) {
      if (window.innerWidth < 1024) return;
      e.preventDefault();
      activeResizer = e.currentTarget;
      activeResizer.classList.add("billing-col-resizer--active");
      document.body.classList.add("is-col-resizing");
    }

    function onMouseMove(e) {
      if (!activeResizer) return;

      var rect = dashboard.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var totalWidth = rect.width;

      var colDiag = document.getElementById("col-diagnostic");
      var colBilling = document.getElementById("col-billing");
      var colContext = document.getElementById("col-context");

      var w1, w2, w3;

      if (activeResizer === resizer1) {
        w1 = x;
        w3 = colContext.offsetWidth;
        w2 = totalWidth - w1 - w3;

        if (w1 < MIN_DIAG) { w1 = MIN_DIAG; w2 = totalWidth - w1 - w3; }
        if (w2 < MIN_BILLING) { w2 = MIN_BILLING; w1 = totalWidth - w2 - w3; }
        if (w1 < MIN_DIAG) return;
      } else {
        w1 = colDiag.offsetWidth;
        w3 = totalWidth - x;
        w2 = totalWidth - w1 - w3;

        if (w3 < MIN_CONTEXT) { w3 = MIN_CONTEXT; w2 = totalWidth - w1 - w3; }
        if (w2 < MIN_BILLING) { w2 = MIN_BILLING; w3 = totalWidth - w1 - w2; }
        if (w3 < MIN_CONTEXT) return;
      }

      var pct1 = (w1 / totalWidth * 100).toFixed(4);
      var pct2 = (w2 / totalWidth * 100).toFixed(4);
      var pct3 = (w3 / totalWidth * 100).toFixed(4);

      dashboard.style.gridTemplateColumns = pct1 + "% 0px " + pct2 + "% 0px " + pct3 + "%";
    }

    function onMouseUp() {
      if (!activeResizer) return;
      activeResizer.classList.remove("billing-col-resizer--active");
      activeResizer = null;
      document.body.classList.remove("is-col-resizing");
    }

    resizer1.addEventListener("mousedown", onMouseDown);
    resizer2.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  // ─── Initialization (called by Shell) ──────────────────────────
  async function init() {
    try {
      // Load billing + diagnostic codes into search engine
      await loadSearchData("data/billing/");

      // Load all data files in parallel
      var results = await Promise.all([
        fetch("data/billing/billing_codes.json").then(function (r) { return r.json(); }),
        fetch("data/billing/diagnostic_codes.json").then(function (r) { return r.json(); }),
        fetch("data/billing/general_tips.json").then(function (r) { return r.json(); }),
        fetch("data/billing/oncall_tables.json").then(function (r) { return r.json(); }),
        fetch("data/billing/anatomy_sections.json").then(function (r) { return r.json(); }),
      ]);

      App.data.billingCodes = results[0];
      App.data.diagnosticCodes = results[1];
      App.data.generalTips = results[2].tips || [];
      App.data.oncallTables = results[3].tables || {};
      App.data.anatomySections = results[4] || {};

      // Build code index for O(1) lookup
      buildCodeIndex();

      // Detect current billing time period
      App.detectTimePeriod();

      // Build folder tree
      App.buildFolderTree();

      // Check user identity
      App.checkUser();

      // Render initial view
      App.renderBrowse();
      App.renderDiagnosticColumn(null);

      // Bind events
      bindEvents();

      // Init column resizers (desktop only)
      initColumnResizers();

      // Init folder-back swipe gesture (mobile only)
      App.initSwipe();
    } catch (err) {
      console.error("Failed to initialize billing app:", err);
      document.getElementById("billing-list").innerHTML =
        '<div class="empty-state">Failed to load data. Please refresh the page.</div>';
    }
  }

  // Expose init for Shell to call
  App.init = init;

  function buildCodeIndex() {
    App.data.codeIndex = {};
    App.data.billingCodes.forEach(function (code) {
      App.data.codeIndex[code.code] = code;
    });
    // Also index diagnostic codes (for potential cross-reference)
    App.data.diagnosticCodes.forEach(function (code) {
      // Don't overwrite billing codes with same code string
      if (!App.data.codeIndex[code.code]) {
        App.data.codeIndex[code.code] = code;
      }
    });
  }

  // ─── Public search API (called by Shell) ──────────────────────
  App.doSearch = function (query) {
    if (query.trim().length === 0) {
      App.state.view = "browse";
      App.state.searchResults = null;
      App.state.searchQuery = "";
      App.state.selectedCode = null;
      App.state.highlightIndex = -1;
      App.updateColumnHeaders(null, null);
      App.renderBrowse();
      App.renderDiagnosticColumn(null);
      return { billing: [], diagnostic: [], billingTotal: 0, diagnosticTotal: 0 };
    }

    App.state.view = "search";
    App.state.searchQuery = query;
    App.state.highlightIndex = -1;
    App.state.contextMode = "empty";
    var contextHeader = document.getElementById("context-header");
    if (contextHeader) contextHeader.textContent = "Details";
    App.renderContextPanel(null);
    var results = search(query); // global from search.js
    App.state.searchResults = results;

    App.updateColumnHeaders(results.billingTotal, results.diagnosticTotal);
    App.renderBillingSearchResults(results.billing);
    App.renderDiagnosticColumn(results.diagnostic);

    return results;
  };

  // ─── Arrow-key highlight helper ─────────────────────────────────
  function highlightBillingResult(index) {
    var items = document.getElementById("billing-list").querySelectorAll(".code-item");
    if (items.length === 0) return;
    if (index < 0 || index >= items.length) return;

    // Remove previous highlight
    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove("code-item--selected");
    }

    // Apply highlight
    items[index].classList.add("code-item--selected");
    items[index].scrollIntoView({ block: "nearest" });

    // Show details in context panel
    var codeStr = items[index].dataset.code;
    if (codeStr) {
      App.selectCode(codeStr);
    }
  }

  // ─── Event Binding ──────────────────────────────────────────────
  function bindEvents() {
    // Shell search input reference (for focus checks in keyboard nav)
    var shellSearchInput = document.getElementById("shell-search-input");

    // ── Browse-mode keyboard navigation helpers ──
    function handleBrowseKeyNav(e) {
      var inputFocused = document.activeElement === shellSearchInput;

      // Left/Right: preserve cursor movement only when input has text
      if (inputFocused && shellSearchInput.value.length > 0 && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;

      var keys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"];
      if (keys.indexOf(e.key) === -1) return;

      var billingList = document.getElementById("billing-list");
      if (billingList.classList.contains("is-animating")) return;

      e.preventDefault();

      var items = billingList.querySelectorAll(".folder-item, .code-item, .action-btn");
      var idx = App.state.browseHighlightIndex;

      if (e.key === "ArrowDown") {
        if (items.length === 0) return;
        idx = idx < 0 ? 0 : Math.min(idx + 1, items.length - 1);
        applyBrowseHighlight(items, idx);
      } else if (e.key === "ArrowUp") {
        if (items.length === 0) return;
        idx = idx <= 0 ? 0 : idx - 1;
        applyBrowseHighlight(items, idx);
      } else if (e.key === "ArrowRight") {
        if (idx < 0 || idx >= items.length) return;
        var item = items[idx];
        if (item.classList.contains("folder-item")) {
          var group = item.dataset.group;
          var subgroup = item.dataset.subgroup;
          if (group) {
            App.state.navPath = [group];
          } else if (subgroup) {
            App.state.navPath = App.state.navPath.concat([subgroup]);
          }
          App.state.pendingBrowseHighlight = 0;
          App.animateBrowse("forward");
        }
      } else if (e.key === "ArrowLeft") {
        if (App.state.navPath.length === 0) return;
        var exitingSegment = App.state.navPath[App.state.navPath.length - 1];
        App.state.navPath = App.state.navPath.slice(0, -1);
        App.state.selectedCode = null;
        App.state.pendingBrowseHighlight = exitingSegment;
        App.animateBrowse("back");
      }
    }

    function applyBrowseHighlight(items, index) {
      var prev = document.querySelector(".browse-highlighted");
      if (prev) prev.classList.remove("browse-highlighted");

      App.state.browseHighlightIndex = index;
      if (index < 0 || index >= items.length) return;

      var item = items[index];
      item.classList.add("browse-highlighted");

      // Scroll: first item → snap to top (reveals dividers/headers above);
      // otherwise scrollIntoView (CSS scroll-margin-top clears sticky headers)
      if (index === 0) {
        var col = item.closest(".billing-col__content");
        if (col) col.scrollTop = 0;
      } else {
        item.scrollIntoView({ block: "nearest" });
      }

      // Update right column + selection highlight
      if (item.classList.contains("code-item") && item.dataset.code) {
        App.selectCode(item.dataset.code);
        // selectCode highlights the first DOM match, but duplicate codes (e.g. E584)
        // appear multiple times — ensure only the navigated-to item is selected
        ensureOnlySelected(item);
      } else if (item.classList.contains("folder-item")) {
        var group = item.dataset.group;
        var subgroup = item.dataset.subgroup;
        if (group) {
          App.renderPreview(group, null);
        } else if (subgroup && App.state.navPath.length >= 1) {
          App.renderPreview(App.state.navPath[0], subgroup);
        }
      }
    }

    function ensureOnlySelected(item) {
      var selected = document.querySelectorAll(".code-item--selected");
      for (var i = 0; i < selected.length; i++) {
        if (selected[i] !== item) selected[i].classList.remove("code-item--selected");
      }
      item.classList.add("code-item--selected");
    }

    // Billing-specific keyboard shortcuts (gated to billing active page)
    document.addEventListener("keydown", function (e) {
      // Gate: only handle when billing page is active
      if (window.Shell && window.Shell.activePage !== "billing" && window.Shell.activeDesktopView !== "billing") return;

      var modalOpen = document.getElementById("modal-overlay").classList.contains("active");
      if (modalOpen) return;

      // Browse mode: folder/code navigation with arrow keys
      if (App.state.view === "browse") {
        handleBrowseKeyNav(e);
        return;
      }

      // Search mode: arrow-key navigation through billing code items
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;

      var items = document.getElementById("billing-list").querySelectorAll(".code-item");
      if (items.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        var next = App.state.highlightIndex + 1;
        if (next >= items.length) next = items.length - 1;
        App.state.highlightIndex = next;
        highlightBillingResult(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        var prev2 = App.state.highlightIndex - 1;
        if (prev2 < 0) prev2 = 0;
        App.state.highlightIndex = prev2;
        highlightBillingResult(prev2);
      } else if (e.key === "Enter") {
        if (App.state.highlightIndex >= 0 && document.activeElement === shellSearchInput) {
          e.preventDefault();
          shellSearchInput.blur();
        }
      }
    });

    // ── Event delegation on billing column ──
    document.getElementById("billing-list").addEventListener("click", function (e) {
      // Block clicks during slide animation
      if (this.classList.contains("is-animating")) return;

      // Clear browse keyboard highlight on mouse interaction
      var prevHL = this.querySelector(".browse-highlighted");
      if (prevHL) prevHL.classList.remove("browse-highlighted");
      App.state.browseHighlightIndex = -1;

      // Code item click
      var codeEl = e.target.closest(".code-item");
      if (codeEl && codeEl.dataset.code) {
        if (window.innerWidth < 768) {
          handleMobileCodeClick(codeEl.dataset.code);
        } else {
          // Sync highlightIndex so arrow keys continue from clicked position
          var allItems = document.getElementById("billing-list").querySelectorAll(".code-item");
          for (var ci = 0; ci < allItems.length; ci++) {
            if (allItems[ci] === codeEl) { App.state.highlightIndex = ci; break; }
          }
          App.selectCode(codeEl.dataset.code);
        }
        return;
      }

      // Folder item click
      var folderItem = e.target.closest(".folder-item");
      if (folderItem) {
        var group = folderItem.dataset.group;
        var subgroup = folderItem.dataset.subgroup;
        if (group) {
          App.state.navPath = [group];
        } else if (subgroup) {
          App.state.navPath = App.state.navPath.concat([subgroup]);
        }
        App.animateBrowse("forward");
        return;
      }

      // On-Call Calculator button
      var oncallBtn = e.target.closest("#oncall-btn");
      if (oncallBtn) {
        App.showOnCallModal();
        return;
      }
    });

    // ── Event delegation on context panel (preview clicks) ──
    document.getElementById("context-panel").addEventListener("click", function (e) {
      // Block clicks during slide animation
      if (this.classList.contains("is-animating")) return;
      // Preview mode: handle clicks on codes and folders
      if (App.state.contextMode === "preview") {
        // Code item click → glide transition
        var codeEl = e.target.closest(".code-item");
        if (codeEl && codeEl.dataset.code) {
          App.glideToCodeView(
            App.state.previewGroup,
            App.state.previewSubgroup,
            codeEl.dataset.code
          );
          return;
        }

        // Folder item click → navigate into that folder
        var folderItem = e.target.closest(".folder-item");
        if (folderItem) {
          var subgroup = folderItem.dataset.subgroup;
          var group = folderItem.dataset.group;
          if (group && subgroup) {
            App.state.navPath = [group, subgroup];
          } else if (group) {
            App.state.navPath = [group];
          }
          App.state.pendingBrowseHighlight = 0;
          App.animateBrowse("forward");
          return;
        }

        // On-Call Calculator button in preview
        var oncallBtn = e.target.closest("#preview-oncall-btn");
        if (oncallBtn) {
          App.showOnCallModal();
          return;
        }
      }
    });

    // ── General Tips button ──
    document.getElementById("tips-btn").addEventListener("click", function () {
      App.showTipsModal();
    });

    // ── Tablet: close context drawer on overlay area ──
    document.getElementById("col-context").addEventListener("click", function (e) {
      // Only close if clicking the backdrop-like area (not the content)
      // This is handled by CSS overlay in tablet mode
    });
  }

  // ─── Glide transition: preview code → code view ────────────────
  App.glideToCodeView = function (groupKey, subgroupKey, codeStr) {
    // Determine target navPath
    var meta = App.GROUP_META[groupKey];
    var tree = App.data.folderTree[groupKey];
    var targetNavPath;

    if (subgroupKey) {
      targetNavPath = [groupKey, subgroupKey];
    } else if (meta && meta.flatSections && meta.flatSections.length > 0) {
      targetNavPath = [groupKey];
    } else if (tree) {
      var subNames = Object.keys(tree.subgroups).filter(function (s) { return s !== "_flat"; });
      if (subNames.length === 0) {
        targetNavPath = [groupKey];
      } else {
        targetNavPath = [groupKey];
      }
    } else {
      targetNavPath = [groupKey];
    }

    App.state.navPath = targetNavPath;
    App.state.pendingBrowseHighlight = codeStr;
    App.animateBrowse("forward");
  };

  // ─── Resize listener ─────────────────────────────────────────
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      // Clear custom column widths on tablet/mobile
      if (window.innerWidth < 1024) {
        var dashboard = document.getElementById("billing-dashboard");
        if (dashboard) dashboard.style.gridTemplateColumns = "";
      }
      if (App.state.view === "browse" && window.innerWidth >= 1024) {
        App.updatePreviewForBrowse();
      }
    }, 200);
  });

  // ─── Mobile code expand/collapse ────────────────────────────────
  function handleMobileCodeClick(codeStr) {
    var currentExpanded = App.state.expandedMobileCode;

    // Collapse currently expanded
    if (currentExpanded) {
      var existing = document.querySelector(".code-item--expanded");
      if (existing) {
        existing.classList.remove("code-item--expanded");
        var detail = existing.querySelector(".mobile-context");
        if (detail) detail.remove();
      }
    }

    // Toggle off if same code
    if (currentExpanded === codeStr) {
      App.state.expandedMobileCode = null;
      return;
    }

    App.state.expandedMobileCode = codeStr;
    var codeObj = App.data.codeIndex[codeStr];
    var codeItem = document.querySelector('.code-item[data-code="' + codeStr + '"]');

    if (codeItem && codeObj) {
      codeItem.classList.add("code-item--expanded");
      var detail = App.utils.el("div", "mobile-context");
      App.renderContextPanelInto(detail, codeObj);
      codeItem.appendChild(detail);
    }
  }
})();

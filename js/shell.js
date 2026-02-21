/**
 * Shell — Orchestration layer for EM Hub
 *
 * Manages: page switching, header state, search coordination,
 * hash routing, mobile carousel (circular 3-page swipe),
 * desktop dropdown, and modal auto-close.
 */
(function () {
  "use strict";

  // ─── Page Registry ──────────────────────────────────────────────
  var PAGES = ["diagnostic", "billing", "prescriptions"];

  var PAGE_CONFIG = {
    diagnostic: {
      brandText: "ED Dx Codes",
      placeholder: "Search diagnoses...",
      showTips: false,
      showRxButtons: false,
      showProvider: false,
      showLocation: false
    },
    billing: {
      brandText: "ED Billing Codes",
      placeholder: "Search billing codes...",
      showTips: true,
      showRxButtons: false,
      showProvider: false,
      showLocation: false
    },
    prescriptions: {
      brandText: "ED Prescriptions",
      placeholder: "Search medications...",
      showTips: false,
      showRxButtons: true,
      showProvider: true,
      showLocation: true
    }
  };

  var Shell = {
    activePage: "billing",           // mobile: currently visible page
    activeDesktopView: "billing",    // desktop: "billing" or "prescriptions"
    searchResults: null,             // cached search results from both engines
    _rxFirstActivated: false,
    _initialized: false
  };

  window.Shell = Shell;

  Shell.isMobile = function () {
    return window.innerWidth < 768;
  };

  // ─── Initialization ────────────────────────────────────────────
  Shell.init = async function () {
    if (Shell._initialized) return;
    Shell._initialized = true;

    // Initialize billing module
    if (window.App && window.App.init) {
      await window.App.init();
    }

    // Initialize prescriptions module
    var rxApp = new Application();
    await rxApp.initialize();
    window.app = rxApp;

    // Read initial hash
    var hash = location.hash.slice(1) || "billing";
    if (!Shell.isMobile() && hash === "diagnostic") hash = "billing";
    if (PAGES.indexOf(hash) === -1) hash = "billing";

    // Set initial page
    Shell.activePage = hash;
    Shell.activeDesktopView = (hash === "diagnostic") ? "billing" : hash;

    // Set up UI
    Shell._updateHeader();
    Shell._updatePageVisibility();
    Shell._bindEvents();
    Shell._initCarousel();
    Shell._initDesktopDropdown();
    Shell._initHelpSystem();

    // Update hash without pushing history
    if (!location.hash || location.hash === "#") {
      history.replaceState(null, "", "#billing");
    }
  };

  // ─── Page Switching ────────────────────────────────────────────
  Shell.switchToPage = function (page, pushHistory) {
    if (PAGES.indexOf(page) === -1) return;

    // Desktop: diagnostic is inside billing view
    if (!Shell.isMobile() && page === "diagnostic") page = "billing";

    var prev = Shell.activePage;
    Shell.activePage = page;

    if (!Shell.isMobile()) {
      Shell.activeDesktopView = page;
    }

    Shell._updateHeader();
    Shell._updatePageVisibility();

    // First-activate for prescriptions
    if (page === "prescriptions" && !Shell._rxFirstActivated) {
      Shell._rxFirstActivated = true;
      if (window.app && window.app.handleResize) {
        window.app.handleResize();
      }
    }

    // Update hash
    if (pushHistory !== false) {
      history.replaceState(null, "", "#" + page);
    }

    // Render cached search results on new page
    if (Shell.searchResults) {
      Shell._renderSearchResultsForPage(page);
    }
  };

  // ─── Header State Management ───────────────────────────────────
  Shell._updateHeader = function () {
    var page = Shell.isMobile() ? Shell.activePage : Shell.activeDesktopView;
    var config = PAGE_CONFIG[page] || PAGE_CONFIG.billing;

    // Brand text
    var brandText = document.getElementById("shell-brand-text");
    if (brandText) brandText.textContent = config.brandText;

    // Search placeholder
    var searchInput = document.getElementById("shell-search-input");
    if (searchInput && !searchInput.value) {
      if (Shell.isMobile()) {
        searchInput.placeholder = "Search here";
      } else if (page === "prescriptions" && window.app && window.app.managers &&
          window.app.managers.provider && window.app.managers.provider.isOwner()) {
        searchInput.placeholder = "Search indication (e.g. ped otitis media) or med (e.g. keflex 5d)";
      } else {
        searchInput.placeholder = config.placeholder;
      }
    }

    // Tips button (billing only)
    var tipsBtn = document.getElementById("tips-btn");
    if (tipsBtn) {
      tipsBtn.hidden = !config.showTips;
    }

    // Rx buttons (prescriptions only)
    var rxBtns = document.getElementById("rx-header-right");
    if (rxBtns) {
      rxBtns.hidden = !config.showRxButtons;
    }

    // Provider button (prescriptions only)
    var providerWrapper = document.querySelector(".provider-wrapper");
    var mobileProviderBtn = document.getElementById("mobileProviderBtn");
    if (providerWrapper) providerWrapper.hidden = !config.showProvider;
    if (mobileProviderBtn) mobileProviderBtn.hidden = !config.showProvider;

    // Location button (prescriptions only)
    var locationWrapper = document.getElementById("locationWrapper");
    var mobileLocationBtn = document.getElementById("mobileLocationBtn");
    if (locationWrapper) locationWrapper.hidden = !config.showLocation;
    if (mobileLocationBtn) mobileLocationBtn.hidden = !config.showLocation;

    // Desktop dropdown options
    Shell._updateDropdown(page);

    // Action button visibility
    Shell._updateActionButton();
  };

  Shell._updateActionButton = function () {
    var actionBtn = document.getElementById("shell-search-action-btn");
    if (!actionBtn) return;

    var page = Shell.isMobile() ? Shell.activePage : Shell.activeDesktopView;
    var searchInput = document.getElementById("shell-search-input");
    var hasText = searchInput && searchInput.value.trim().length > 0;

    if (Shell.isMobile()) {
      if (page === "prescriptions") {
        // Rx mobile: always show (+ when no text, × when text via CSS)
        actionBtn.hidden = false;
      } else if (hasText && document.body.classList.contains("search-focused")) {
        // Billing/diagnostic mobile: show × only with text while focused
        actionBtn.hidden = false;
      } else {
        actionBtn.hidden = true;
      }
    } else {
      // Desktop: only show on Rx with no text (+ New Med button)
      if (page === "prescriptions" && !hasText) {
        actionBtn.hidden = false;
      } else {
        actionBtn.hidden = true;
      }
    }
  };

  Shell._updateDropdown = function (currentPage) {
    var dropdown = document.getElementById("page-dropdown");
    if (!dropdown) return;

    dropdown.innerHTML = "";
    if (currentPage === "billing" || currentPage === "diagnostic") {
      var item = document.createElement("a");
      item.href = "#prescriptions";
      item.className = "shell-header__dropdown-item";
      item.dataset.page = "prescriptions";
      item.textContent = "ED Prescriptions";
      dropdown.appendChild(item);
    } else {
      var item2 = document.createElement("a");
      item2.href = "#billing";
      item2.className = "shell-header__dropdown-item";
      item2.dataset.page = "billing";
      item2.textContent = "ED Billing Codes";
      dropdown.appendChild(item2);
    }
  };

  // ─── Page Visibility ──────────────────────────────────────────
  Shell._updatePageVisibility = function () {
    if (Shell.isMobile()) {
      // Carousel handles visibility via transform
      Shell._updateCarouselPosition(false);
      return;
    }

    // Desktop: toggle active class
    var pages = document.querySelectorAll(".shell-page");
    for (var i = 0; i < pages.length; i++) {
      var pageEl = pages[i];
      var pageName = pageEl.dataset.page;
      if (pageName === Shell.activeDesktopView) {
        pageEl.classList.add("shell-page--active");
      } else {
        pageEl.classList.remove("shell-page--active");
      }
    }
  };

  // ─── Search Coordinator ────────────────────────────────────────
  Shell._bindEvents = function () {
    var searchInput = document.getElementById("shell-search-input");
    var clearBtn = document.getElementById("shell-clear-search");

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        var query = this.value;
        Shell._onSearchInput(query);

        // Show/hide clear button
        if (clearBtn) clearBtn.hidden = !query;

        // Toggle body class for Rx dashboard vs search results
        document.body.classList.toggle("has-search-query", query.trim().length > 0);
      });

      // Prevent iOS zoom
      searchInput.style.fontSize = "16px";
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        searchInput.value = "";
        Shell._onSearchInput("");
        clearBtn.hidden = true;
        document.body.classList.remove("has-search-query");
        searchInput.focus();
      });
    }

    // Search action button ("+ New Med" on Rx, "×" clear on all pages)
    var actionBtn = document.getElementById("shell-search-action-btn");
    var _blurTimeout = null;
    if (actionBtn && searchInput) {
      actionBtn.addEventListener("click", function () {
        clearTimeout(_blurTimeout);
        var page = Shell.isMobile() ? Shell.activePage : Shell.activeDesktopView;
        var hasText = searchInput.value.trim().length > 0;

        if (Shell.isMobile() && hasText) {
          // Mobile × mode: clear and dismiss
          searchInput.value = "";
          Shell._onSearchInput("");
          if (clearBtn) clearBtn.hidden = true;
          document.body.classList.remove("has-search-query");
          document.body.classList.remove("search-focused");
          searchInput.blur();
          Shell._updateActionButton();
          return;
        }

        // + mode (Rx only): open Add New Med modal
        if (page === "prescriptions" && window.app && window.app.managers && window.app.managers.modal) {
          window.app.managers.modal.openAddNewMed();
        }

        // Dismiss search on mobile
        if (Shell.isMobile()) {
          document.body.classList.remove("search-focused");
          searchInput.blur();
          Shell._updateActionButton();
        }
      });

      // Show/hide action button based on input state
      searchInput.addEventListener("focus", function () {
        clearTimeout(_blurTimeout);
        document.body.classList.add("search-focused");
        Shell._updateActionButton();
      });
      searchInput.addEventListener("blur", function () {
        // Delay to allow action button click to fire before hiding it
        _blurTimeout = setTimeout(function () {
          document.body.classList.remove("search-focused");
          Shell._updateActionButton();
        }, 100);
      });
      searchInput.addEventListener("input", function () {
        Shell._updateActionButton();
      });
    }

    // Hash change
    window.addEventListener("hashchange", function () {
      var hash = location.hash.slice(1) || "billing";
      if (!Shell.isMobile() && hash === "diagnostic") hash = "billing";
      if (PAGES.indexOf(hash) === -1) hash = "billing";
      Shell.switchToPage(hash, false);
    });

    // Resize handler
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        Shell._handleResize();
      }, 150);
    });

    // Global keyboard shortcuts (Shell-level)
    document.addEventListener("keydown", function (e) {
      // Cmd+F / Ctrl+F to focus search
      if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }

      // "/" to focus search (unless typing in an input)
      var tag = document.activeElement ? document.activeElement.tagName : "";
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
        e.preventDefault();
        searchInput.focus();
        return;
      }

      // Escape: close modals, then clear search
      if (e.key === "Escape") {
        if (Shell._closeAnyOpenModal()) return;
        if (searchInput.value) {
          searchInput.value = "";
          Shell._onSearchInput("");
          if (clearBtn) clearBtn.hidden = true;
          document.body.classList.remove("has-search-query");
          searchInput.blur();
        }
      }
    });

    // Reset button: clear everything
    var resetBtn = document.getElementById("resetViewBtn");
    if (resetBtn) {
      // The reset button's click is bound in Rx app's setupActionButtons.
      // We add a Shell-level handler to also clear the shared search bar.
      resetBtn.addEventListener("click", function () {
        if (searchInput) {
          searchInput.value = "";
          if (clearBtn) clearBtn.hidden = true;
          document.body.classList.remove("has-search-query");
        }
        // Clear billing search state too
        if (window.App && window.App.doSearch) {
          window.App.doSearch("");
        }
      });
    }
  };

  Shell._onSearchInput = function (query) {
    // Run billing search
    var billingResults = null;
    if (window.App && window.App.doSearch) {
      billingResults = window.App.doSearch(query);
    }

    // Run prescription search
    var rxResults = null;
    if (window.app && window.app.controllers && window.app.controllers.search) {
      window.app.controllers.search.search(query);
      // Get result count from the search manager
      if (window.app.managers && window.app.managers.search && query && query.trim()) {
        var groups = window.app.managers.search.search(query);
        if (groups) {
          rxResults = [].concat(groups.adult || [], groups.pediatric || [], groups.other || []);
        }
      }
    }

    // Cache results
    Shell.searchResults = {
      billing: billingResults,
      rx: rxResults
    };

    // Smart auto-switch
    Shell._handleAutoSwitch(billingResults, rxResults);
  };

  Shell._handleAutoSwitch = function (billingResults, rxResults) {
    if (!billingResults && !rxResults) return;

    var hasBilling = billingResults && billingResults.billingTotal > 0;
    var hasDiagnostic = billingResults && billingResults.diagnosticTotal > 0;
    var hasRx = rxResults && rxResults.length > 0;

    if (Shell.isMobile()) {
      // Mobile: 3 distinct pages
      var matchPages = [];
      if (hasBilling) matchPages.push("billing");
      if (hasDiagnostic) matchPages.push("diagnostic");
      if (hasRx) matchPages.push("prescriptions");

      if (matchPages.length === 1 && matchPages[0] !== Shell.activePage) {
        Shell.switchToPage(matchPages[0]);
      }
    } else {
      // Desktop: billing+dx count as one view
      var hasBillingOrDx = hasBilling || hasDiagnostic;
      if (hasRx && !hasBillingOrDx && Shell.activeDesktopView !== "prescriptions") {
        Shell.switchToPage("prescriptions");
      } else if (hasBillingOrDx && !hasRx && Shell.activeDesktopView !== "billing") {
        Shell.switchToPage("billing");
      }
    }
  };

  Shell._renderSearchResultsForPage = function (page) {
    // Results are already rendered by the individual search calls in _onSearchInput.
    // This function is called when switching pages to ensure cached results display.
    // Since both engines run on every keystroke, the DOM is already up-to-date.
  };

  // ─── Modal Coordinator ────────────────────────────────────────
  Shell._closeAnyOpenModal = function () {
    // Mobile top-sheet modals (weight/provider/location)
    if (window.app && window.app._closeActiveMobileModal) {
      var mobileClasses = ["mobile-weight-active", "mobile-provider-active",
                           "mobile-location-active", "mobile-addlocation-active"];
      for (var i = 0; i < mobileClasses.length; i++) {
        if (document.body.classList.contains(mobileClasses[i])) {
          window.app._closeActiveMobileModal();
          return true;
        }
      }
    }

    // Mobile action overlays
    var openOverlays = document.querySelectorAll(".mobile-actions-open");
    if (openOverlays.length > 0) {
      for (var j = 0; j < openOverlays.length; j++) {
        openOverlays[j].classList.remove("mobile-actions-open");
      }
      return true;
    }

    // Billing modals
    var billingModal = document.getElementById("modal-overlay");
    if (billingModal && billingModal.classList.contains("active")) {
      if (window.App && window.App.closeModal) window.App.closeModal();
      return true;
    }

    // Prescription modals
    var rxModals = ["weightModal", "editModal", "addNewMedModal", "searchEditModal", "locationModal"];
    for (var k = 0; k < rxModals.length; k++) {
      var m = document.getElementById(rxModals[k]);
      if (m && !m.classList.contains("hidden")) {
        m.classList.add("hidden");
        return true;
      }
    }

    // Cart dropdown
    if (window.cartController && window.cartController.isCartDropdownOpen) {
      window.cartController.closeCartDropdown();
      return true;
    }

    // Provider dropdown
    if (window.modalManager) {
      var provDropdown = document.getElementById("providerEditDropdown");
      if (provDropdown && !provDropdown.classList.contains("hidden")) {
        window.modalManager.closeProvider();
        return true;
      }
    }

    // Help popup
    var help = document.getElementById("helpPopup");
    if (help && !help.classList.contains("hidden")) {
      help.classList.add("hidden");
      return true;
    }

    return false;
  };

  // ─── Mobile Carousel (Circular 3-page) ─────────────────────────
  var carousel = {
    container: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    startTime: 0,
    isDragging: false,
    directionLocked: false,
    isHorizontal: false,
    wrapMode: null, // "diag-right" | "rx-left" | null
    SWIPE_THRESHOLD: 50,
    VELOCITY_THRESHOLD: 0.3,
    ANGLE_LOCK: 1.2,
    EDGE_ZONE: 25
  };

  // Page index mapping
  var PAGE_INDEX = { diagnostic: 0, billing: 1, prescriptions: 2 };
  var INDEX_PAGE = ["diagnostic", "billing", "prescriptions"];

  Shell._initCarousel = function () {
    carousel.container = document.getElementById("shell-pages");
    if (!carousel.container) return;

    carousel.container.addEventListener("touchstart", Shell._carouselTouchStart, { passive: true });
    carousel.container.addEventListener("touchmove", Shell._carouselTouchMove, { passive: false });
    carousel.container.addEventListener("touchend", Shell._carouselTouchEnd, { passive: true });
    carousel.container.addEventListener("touchcancel", Shell._carouselTouchEnd, { passive: true });

    // Handle transition end for wrap-around resets
    carousel.container.addEventListener("transitionend", function (e) {
      if (e.target === carousel.container && e.propertyName === "transform") {
        Shell._carouselTransitionEnd();
      }
    });

    // Set initial position
    Shell._updateCarouselPosition(false);
  };

  Shell._getCarouselTranslate = function (page) {
    var idx = PAGE_INDEX[page];
    if (idx == null) idx = 1;
    return -(idx * 33.333);
  };

  // During circular edge drags, temporarily reorder pages so the wrap target
  // is adjacent and can glide in under the finger.
  Shell._getWrapModeForDrag = function (dx) {
    if (Shell.activePage === "diagnostic" && dx > 0) return "diag-right";
    if (Shell.activePage === "prescriptions" && dx < 0) return "rx-left";
    return null;
  };

  Shell._applyWrapMode = function (mode) {
    if (!carousel.container) return;
    if (carousel.wrapMode === mode) return;

    var pages = carousel.container.querySelectorAll(".shell-page");
    for (var i = 0; i < pages.length; i++) {
      pages[i].style.order = "";
    }

    if (mode === "diag-right") {
      var rxEl = document.getElementById("page-prescriptions");
      if (rxEl) rxEl.style.order = "-1";
    } else if (mode === "rx-left") {
      var dxEl = document.getElementById("page-diagnostic");
      if (dxEl) dxEl.style.order = String(PAGES.length);
    }

    carousel.wrapMode = mode;
    carousel.container.offsetHeight;
  };

  Shell._updateCarouselPosition = function (animate) {
    if (!carousel.container || !Shell.isMobile()) return;

    if (animate) {
      carousel.container.classList.remove("no-transition");
    } else {
      carousel.container.classList.add("no-transition");
    }

    // Reset any CSS order overrides
    var pages = carousel.container.querySelectorAll(".shell-page");
    for (var i = 0; i < pages.length; i++) {
      pages[i].style.order = "";
    }
    carousel.wrapMode = null;

    var pct = Shell._getCarouselTranslate(Shell.activePage);
    carousel.container.style.transform = "translateX(" + pct + "%)";

    if (!animate) {
      // Force reflow then remove no-transition
      carousel.container.offsetHeight;
      carousel.container.classList.remove("no-transition");
    }
  };

  Shell._carouselTouchStart = function (e) {
    if (!Shell.isMobile()) return;
    if (e.touches.length !== 1) return;

    // Check if touch is on an input/textarea/select
    var tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    // Check if billing should handle folder-back
    var touch = e.touches[0];
    if (Shell.activePage === "billing" && window.App && window.App.shouldHandleFolderBack &&
        window.App.shouldHandleFolderBack(touch.clientX)) {
      return; // Let billing's swipe.js handle it
    }

    // Check if prescriptions should handle folder-back
    if (Shell.activePage === "prescriptions" && window.app && window.app.shouldHandleFolderBack &&
        window.app.shouldHandleFolderBack(touch.clientX)) {
      return; // Let prescriptions' swipe handler handle it
    }

    carousel.startX = touch.clientX;
    carousel.startY = touch.clientY;
    carousel.currentX = touch.clientX;
    carousel.startTime = Date.now();
    carousel.isDragging = false;
    carousel.directionLocked = false;
    carousel.isHorizontal = false;
    carousel.wrapMode = null;

    // Remove transition for direct manipulation
    carousel.container.classList.add("no-transition");
  };

  Shell._carouselTouchMove = function (e) {
    if (!Shell.isMobile()) return;
    if (e.touches.length !== 1) return;
    if (carousel.startTime === 0) return; // No valid start

    var touch = e.touches[0];
    var dx = touch.clientX - carousel.startX;
    var dy = touch.clientY - carousel.startY;

    // Direction lock
    if (!carousel.directionLocked) {
      var absDx = Math.abs(dx);
      var absDy = Math.abs(dy);
      if (absDx < 8 && absDy < 8) return;

      carousel.directionLocked = true;
      if (absDx > absDy * carousel.ANGLE_LOCK) {
        carousel.isHorizontal = true;
      } else {
        carousel.isHorizontal = false;
        carousel.startTime = 0; // Cancel
        return;
      }
    }

    if (!carousel.isHorizontal) return;

    e.preventDefault();

    // Close any open modal on first drag
    if (!carousel.isDragging) {
      Shell._closeAnyOpenModal();
    }

    carousel.isDragging = true;
    carousel.currentX = touch.clientX;

    var wrapMode = Shell._getWrapModeForDrag(dx);
    Shell._applyWrapMode(wrapMode);

    // Calculate drag position
    var basePct = wrapMode ? -33.333 : Shell._getCarouselTranslate(Shell.activePage);
    var containerWidth = carousel.container.offsetWidth / 3; // Each page is 1/3 of container
    var dragPct = (dx / containerWidth) * 33.333;
    var newPct = basePct + dragPct;

    if (wrapMode === "diag-right") {
      newPct = Math.max(-33.333, Math.min(0, newPct));
    } else if (wrapMode === "rx-left") {
      newPct = Math.max(-66.666, Math.min(-33.333, newPct));
    } else {
      newPct = Math.max(-66.666, Math.min(0, newPct));
    }

    carousel.container.style.transform = "translateX(" + newPct + "%)";
  };

  Shell._carouselTouchEnd = function () {
    if (!Shell.isMobile()) return;

    if (!carousel.isDragging) {
      carousel.startTime = 0;
      carousel.container.classList.remove("no-transition");
      return;
    }

    var dx = carousel.currentX - carousel.startX;
    var dt = Date.now() - carousel.startTime;
    var velocity = Math.abs(dx) / Math.max(dt, 1);
    var shouldComplete = Math.abs(dx) > carousel.SWIPE_THRESHOLD || velocity > carousel.VELOCITY_THRESHOLD;

    carousel.container.classList.remove("no-transition");

    if (shouldComplete && dx !== 0) {
      var currentIdx = PAGE_INDEX[Shell.activePage];
      var targetIdx;

      if (dx > 0) {
        // Swipe right -> previous page
        targetIdx = currentIdx - 1;
      } else {
        // Swipe left -> next page
        targetIdx = currentIdx + 1;
      }

      // Circular wrapping
      if (targetIdx < 0) {
        // diagnostic -> prescriptions
        Shell._applyWrapMode("diag-right");
        carousel.container.style.transform = "translateX(0%)";
        Shell._pendingWrap = { toPage: "prescriptions" };
      } else if (targetIdx >= PAGES.length) {
        // prescriptions -> diagnostic
        Shell._applyWrapMode("rx-left");
        carousel.container.style.transform = "translateX(-66.666%)";
        Shell._pendingWrap = { toPage: "diagnostic" };
      } else {
        // Normal (non-wrapping) transition
        Shell._applyWrapMode(null);
        Shell.activePage = INDEX_PAGE[targetIdx];
        if (!Shell.isMobile()) {
          Shell.activeDesktopView = Shell.activePage;
        }
        Shell._updateHeader();
        history.replaceState(null, "", "#" + Shell.activePage);

        var pct = Shell._getCarouselTranslate(Shell.activePage);
        carousel.container.style.transform = "translateX(" + pct + "%)";

        // First-activate prescriptions
        if (Shell.activePage === "prescriptions" && !Shell._rxFirstActivated) {
          Shell._rxFirstActivated = true;
          if (window.app && window.app.handleResize) {
            setTimeout(function () { window.app.handleResize(); }, 350);
          }
        }
      }
    } else {
      // Snap back (in wrap mode, snap to wrapped center then reset on transitionend)
      if (carousel.wrapMode) {
        carousel.container.style.transform = "translateX(-33.333%)";
        Shell._pendingWrap = { toPage: Shell.activePage };
      } else {
        var pct2 = Shell._getCarouselTranslate(Shell.activePage);
        carousel.container.style.transform = "translateX(" + pct2 + "%)";
      }
    }

    carousel.isDragging = false;
    carousel.startTime = 0;
  };

  Shell._carouselTransitionEnd = function () {
    if (!Shell._pendingWrap) return;

    var wrap = Shell._pendingWrap;
    Shell._pendingWrap = null;

    // Update state
    Shell.activePage = wrap.toPage;
    Shell._updateHeader();
    history.replaceState(null, "", "#" + Shell.activePage);

    // Reset: remove order override, snap to canonical position
    Shell._updateCarouselPosition(false);

    // First-activate prescriptions
    if (Shell.activePage === "prescriptions" && !Shell._rxFirstActivated) {
      Shell._rxFirstActivated = true;
      if (window.app && window.app.handleResize) {
        setTimeout(function () { window.app.handleResize(); }, 50);
      }
    }
  };

  // ─── Desktop Dropdown ──────────────────────────────────────────
  Shell._initDesktopDropdown = function () {
    var dropdown = document.getElementById("page-dropdown");
    if (!dropdown) return;

    dropdown.addEventListener("click", function (e) {
      var item = e.target.closest(".shell-header__dropdown-item");
      if (!item) return;
      e.preventDefault();
      var page = item.dataset.page;
      if (page) {
        Shell.switchToPage(page);
      }
    });
  };

  // ─── Help System ──────────────────────────────────────────────
  Shell._initHelpSystem = function () {
    var helpBtn = document.getElementById("helpBtn");
    var mobileHelpBtn = document.getElementById("mobileHelpBtn");
    var helpPopup = document.getElementById("helpPopup");
    var helpCloseBtn = document.getElementById("helpCloseBtn");

    function showHelp() {
      if (!helpPopup) return;

      // Show page-specific help content
      var sections = ["prescriptions", "billing", "diagnostic"];
      var activePage = Shell.isMobile() ? Shell.activePage : Shell.activeDesktopView;

      for (var i = 0; i < sections.length; i++) {
        var el = document.getElementById("helpContent-" + sections[i]);
        if (el) {
          el.hidden = (sections[i] !== activePage);
        }
      }

      helpPopup.classList.remove("hidden");
    }

    if (helpBtn) helpBtn.addEventListener("click", showHelp);
    if (mobileHelpBtn) mobileHelpBtn.addEventListener("click", showHelp);

    // On mobile, tapping the brand text opens help (replaces hidden ? icon)
    var brandBtn = document.getElementById("shell-brand");
    if (brandBtn) {
      brandBtn.addEventListener("click", function () {
        if (Shell.isMobile()) showHelp();
      });
    }

    if (helpCloseBtn) {
      helpCloseBtn.addEventListener("click", function () {
        if (helpPopup) helpPopup.classList.add("hidden");
      });
    }

    if (helpPopup) {
      helpPopup.addEventListener("click", function (e) {
        if (e.target === helpPopup) {
          helpPopup.classList.add("hidden");
        }
      });
    }
  };

  // ─── Resize Handler ────────────────────────────────────────────
  Shell._handleResize = function () {
    if (Shell.isMobile()) {
      // Entering/staying in mobile: update carousel position
      Shell._updateCarouselPosition(false);
    } else {
      // Entering/staying in desktop: ensure correct view
      if (Shell.activePage === "diagnostic") {
        Shell.activeDesktopView = "billing";
      } else {
        Shell.activeDesktopView = Shell.activePage;
      }
      Shell._updatePageVisibility();
      Shell._updateHeader();

      // Reset any carousel transforms
      if (carousel.container) {
        carousel.container.style.transform = "";
        var pages = carousel.container.querySelectorAll(".shell-page");
        for (var i = 0; i < pages.length; i++) {
          pages[i].style.order = "";
        }
      }
    }

    // Clear custom billing column widths on tablet/mobile
    if (window.innerWidth < 1024) {
      var dashboard = document.getElementById("billing-dashboard");
      if (dashboard) dashboard.style.gridTemplateColumns = "";
    }
  };

  // ─── Start ────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    Shell.init();
  });
})();

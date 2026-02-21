(function () {
  "use strict";
  window.App = window.App || {};

  // ─── Constants ──────────────────────────────────────────────────
  var EDGE_ZONE = 25;           // px from left edge — edge swipes go to Shell carousel
  var SWIPE_THRESHOLD = 50;     // px minimum to complete folder-back
  var VELOCITY_THRESHOLD = 0.3; // px/ms — fast flick completes regardless of distance
  var ANGLE_LOCK = 1.2;         // horizontal must exceed vertical by this ratio
  var MOBILE_BP = 768;

  // ─── State ──────────────────────────────────────────────────────
  var startX = 0;
  var startY = 0;
  var currentX = 0;
  var startTime = 0;
  var isDragging = false;
  var directionLocked = false;
  var isHorizontal = false;
  var active = false;           // true when this handler owns the gesture
  var folderPanelsReady = false;
  var folderOldPanel = null;
  var folderNewPanel = null;
  var folderSavedScrollTop = 0;

  // ─── Init ───────────────────────────────────────────────────────
  App.initSwipe = function () {
    var billingPage = document.getElementById("page-billing");
    if (!billingPage) return;

    billingPage.addEventListener("touchstart", onTouchStart, { passive: true });
    billingPage.addEventListener("touchmove", onTouchMove, { passive: false });
    billingPage.addEventListener("touchend", onTouchEnd, { passive: true });
    billingPage.addEventListener("touchcancel", onTouchEnd, { passive: true });
  };

  /** Check if billing should handle folder-back for a given touch X position.
   *  Shell carousel calls this to decide whether to delegate or handle page transition. */
  App.shouldHandleFolderBack = function (touchX) {
    if (window.innerWidth >= MOBILE_BP) return false;
    if (App.state.view !== "browse") return false;
    if (App.state.navPath.length === 0) return false;
    // Edge zone touches go to Shell for page transitions
    if (touchX <= EDGE_ZONE) return false;
    return true;
  };

  // ─── Touch Start ───────────────────────────────────────────────
  function onTouchStart(e) {
    if (window.innerWidth >= MOBILE_BP) return;
    if (e.touches.length !== 1) return;

    var touch = e.touches[0];

    // Only handle folder-back gestures
    if (!App.shouldHandleFolderBack(touch.clientX)) return;

    // Guard: block during ongoing animations
    var billingList = document.getElementById("billing-list");
    if (billingList && (billingList.classList.contains("is-animating") || billingList.classList.contains("folder-dragging"))) return;

    startX = touch.clientX;
    startY = touch.clientY;
    currentX = startX;
    startTime = Date.now();
    isDragging = false;
    directionLocked = false;
    isHorizontal = false;
    folderPanelsReady = false;
    active = true;
  }

  // ─── Touch Move ────────────────────────────────────────────────
  function onTouchMove(e) {
    if (!active) return;
    if (window.innerWidth >= MOBILE_BP) return;
    if (e.touches.length !== 1) return;

    var touch = e.touches[0];
    var dx = touch.clientX - startX;
    var dy = touch.clientY - startY;

    // Direction lock after small movement
    if (!directionLocked) {
      var absDx = Math.abs(dx);
      var absDy = Math.abs(dy);
      if (absDx < 8 && absDy < 8) return; // dead zone

      directionLocked = true;
      if (absDx > absDy * ANGLE_LOCK) {
        isHorizontal = true;
      } else {
        isHorizontal = false;
        active = false;
        return; // locked to vertical — let scroll happen
      }
    }

    if (!isHorizontal) return;

    // Folder-back can only swipe right (dx > 0)
    if (dx < 0) return;

    e.preventDefault();
    isDragging = true;
    currentX = touch.clientX;
    handleFolderDrag(dx);
  }

  // ─── Touch End ─────────────────────────────────────────────────
  function onTouchEnd() {
    if (!active) return;

    if (!isDragging) {
      resetState();
      return;
    }

    var dx = currentX - startX;
    var dt = Date.now() - startTime;
    var velocity = Math.abs(dx) / Math.max(dt, 1);
    var shouldComplete = Math.abs(dx) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    finishFolderBack(dx, shouldComplete);
    resetState();
  }

  // ─── Folder Back: Setup Panels ─────────────────────────────────
  function setupFolderBackPanels() {
    var billingList = document.getElementById("billing-list");
    var headerEl = document.getElementById("billing-header");

    // Save state
    folderSavedScrollTop = billingList.scrollTop;
    var savedHeaderHTML = headerEl.innerHTML;
    var savedHeaderNav = headerEl.classList.contains("billing-col__header--nav");
    var savedHighlightIndex = App.state.browseHighlightIndex;
    var savedNavPath = App.state.navPath.slice();

    // Wrap current content in old panel
    folderOldPanel = document.createElement("div");
    folderOldPanel.className = "folder-drag-panel";
    folderOldPanel.style.transform = "translateX(0)";
    folderOldPanel.style.top = -folderSavedScrollTop + "px";
    while (billingList.firstChild) {
      folderOldPanel.appendChild(billingList.firstChild);
    }

    // Temporarily render parent content
    App.state.navPath = savedNavPath.slice(0, -1);
    App.renderBrowse();

    // Wrap new (parent) content in new panel
    folderNewPanel = document.createElement("div");
    folderNewPanel.className = "folder-drag-panel";
    folderNewPanel.style.transform = "translateX(-100%)";
    while (billingList.firstChild) {
      folderNewPanel.appendChild(billingList.firstChild);
    }

    // Restore state
    App.state.navPath = savedNavPath;
    App.state.browseHighlightIndex = savedHighlightIndex;
    headerEl.innerHTML = savedHeaderHTML;
    headerEl.classList.toggle("billing-col__header--nav", savedHeaderNav);

    // Add panels
    billingList.classList.add("folder-dragging");
    billingList.appendChild(folderNewPanel);
    billingList.appendChild(folderOldPanel);

    folderPanelsReady = true;
  }

  // ─── Folder Back: Drag ─────────────────────────────────────────
  function handleFolderDrag(dx) {
    if (!folderPanelsReady) {
      setupFolderBackPanels();
    }

    var offset = Math.max(0, dx);
    folderOldPanel.style.transform = "translateX(" + offset + "px)";
    folderNewPanel.style.transform = "translateX(calc(-100% + " + offset + "px))";
  }

  // ─── Folder Back: Finish ───────────────────────────────────────
  function finishFolderBack(dx, shouldComplete) {
    if (!folderPanelsReady) {
      // Never set up panels (too little movement)
      return;
    }

    var billingList = document.getElementById("billing-list");

    // Enable transition for snap animation
    folderOldPanel.classList.add("animate");
    folderNewPanel.classList.add("animate");

    if (shouldComplete && dx > 0) {
      // Complete: old exits right, new settles at 0
      folderOldPanel.style.transform = "translateX(100%)";
      folderNewPanel.style.transform = "translateX(0)";

      folderNewPanel.addEventListener("transitionend", function onEnd(e) {
        if (e.target !== folderNewPanel || e.propertyName !== "transform") return;
        folderNewPanel.removeEventListener("transitionend", onEnd);

        // Commit navigation
        App.state.navPath = App.state.navPath.slice(0, -1);
        App.state.expandedMobileCode = null;
        App.state.selectedCode = null;

        // Unwrap new panel content into billingList
        billingList.classList.remove("folder-dragging");
        if (folderOldPanel.parentNode) folderOldPanel.remove();
        while (folderNewPanel.firstChild) {
          billingList.appendChild(folderNewPanel.firstChild);
        }
        folderNewPanel.remove();

        // Update header to reflect new navPath
        App.renderBillingHeader();

        cleanupFolderPanels();
      });
    } else {
      // Cancel: snap back
      folderOldPanel.style.transform = "translateX(0)";
      folderNewPanel.style.transform = "translateX(-100%)";

      folderOldPanel.addEventListener("transitionend", function onEnd(e) {
        if (e.target !== folderOldPanel || e.propertyName !== "transform") return;
        folderOldPanel.removeEventListener("transitionend", onEnd);

        // Restore original content
        billingList.classList.remove("folder-dragging");
        if (folderNewPanel.parentNode) folderNewPanel.remove();
        while (folderOldPanel.firstChild) {
          billingList.appendChild(folderOldPanel.firstChild);
        }
        folderOldPanel.remove();
        billingList.scrollTop = folderSavedScrollTop;

        cleanupFolderPanels();
      });
    }
  }

  function cleanupFolderPanels() {
    folderOldPanel = null;
    folderNewPanel = null;
    folderPanelsReady = false;
    folderSavedScrollTop = 0;
  }

  // ─── State Reset ───────────────────────────────────────────────
  function resetState() {
    isDragging = false;
    directionLocked = false;
    isHorizontal = false;
    active = false;
  }
})();

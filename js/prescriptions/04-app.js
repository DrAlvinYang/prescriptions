// ============================================================================
// APPLICATION INITIALIZATION & SETUP
// ============================================================================

class Application {
  constructor() {
    this.state = null;
    this.controllers = {};
    this.renderers = {};
    this.managers = {};
  }

  async initialize() {
    try {
      await this.initializeCore();
      this.initializeRenderers();
      await this.loadData(); // Load data BEFORE controllers/listeners to avoid race conditions
      this.initializeControllers();
      this.setupEventListeners();
      this.render();
      this.focus();
      
    } catch (error) {
      console.error("Failed to initialize prescriptions:", error);

      // Show error in the prescriptions page container only (don't destroy the whole app)
      const rxPage = document.getElementById("page-prescriptions");
      if (rxPage) {
        rxPage.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:center;height:100%;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
            <div style="background:var(--panel);padding:30px;border-radius:22px;max-width:500px;box-shadow:var(--shadow-lg);">
              <h2 style="color:var(--danger);margin-top:0;">Prescriptions Error</h2>
              <p style="color:var(--muted);line-height:1.6;">${error.message || "An unknown error occurred"}</p>
              <button onclick="location.reload()" style="background:var(--accent);color:white;border:none;padding:10px 20px;border-radius:12px;cursor:pointer;font-size:14px;">
                Refresh Page
              </button>
            </div>
          </div>
        `;
      }
    }
  }

  async initializeCore() {
    // Create state
    this.state = new AppState();

    // Create undo manager
    this.undoManager = new UndoManager(this.state);
    window.undoManager = this.undoManager;

    // Create managers
    this.managers.location = new LocationManager(this.state);
    this.managers.provider = new ProviderManager();
    this.managers.data = new DataLoader();
    this.managers.modal = new ModalManager(this.state);
    
    // Load locations (now async to load from JSON)
    await this.managers.location.load();
    
    // Load provider from localStorage and authorized providers list
    this.managers.provider.load();
    await this.managers.provider.loadAuthorizedProviders();
    
    // Expose for global access
    window.appState = this.state;
    window.locationManager = this.managers.location;
    window.providerManager = this.managers.provider;
    window.modalManager = this.managers.modal;
  }

  initializeRenderers() {
    const medRenderer = new MedicationRenderer(this.state);

    this.renderers = {
      medication: medRenderer,
      folder: new FolderNavigationRenderer(this.state, medRenderer),
      mobileFolder: new MobileFolderRenderer(this.state, medRenderer),
      search: new SearchResultsRenderer(this.state, medRenderer),
      cart: new CartRenderer(this.state),
      location: new LocationUIRenderer(this.managers.location),
      provider: new ProviderUIRenderer(this.managers.provider)
    };

    // Update location and provider headers
    this.renderers.location.updateHeader();
    this.renderers.provider.updateHeader();

    // Expose cart renderer globally
    window.cartRenderer = this.renderers.cart;
  }

  initializeControllers() {
    this.controllers.cart = new CartController(
      this.state,
      this.renderers.cart,
      this.renderers.folder,
      this.renderers.search,
      this.managers.modal,
      this.managers.provider,
      this.managers.location
    );

    this.controllers.search = new SearchController(
      this.state,
      this.renderers.search,
      this.controllers.cart,
      this.renderers.cart
    );

    this.controllers.location = new LocationController(
      this.managers.location,
      this.renderers.location,
      this.managers.modal
    );

    this.controllers.provider = new ProviderController(
      this.managers.provider,
      this.renderers.provider,
      this.managers.modal,
      () => this.handleProviderChange()
    );

    this.controllers.weight = new WeightController(
      this.state,
      this.controllers.cart
    );

    this.controllers.print = new PrintController(
      this.state,
      this.managers.location,
      this.controllers.weight,
      this.managers.provider
    );

    this.controllers.reset = new ResetController(
      this.state,
      this.controllers.cart,
      this.controllers.search,
      this.controllers.weight
    );

    this.controllers.keyboard = new KeyboardController(
      this.state,
      this.controllers.search,
      this.controllers.print,
      this.controllers.location
    );

    this.controllers.searchEdit = new SearchEditController(
      this.state,
      this.managers.modal,
      this.managers.provider,
      this.managers.location,
      this.controllers.cart,
      this.controllers.print
    );

    // Expose globally for onclick handlers
    window.cartController = this.controllers.cart;
    window.locationController = this.controllers.location;
    window.providerController = this.controllers.provider;
    window.printController = this.controllers.print;
    window.searchEditController = this.controllers.searchEdit;
    window.cartActions = {
      remove: (uid) => this.controllers.cart.remove(uid),
      edit: (uid) => this.managers.modal.openEdit(uid),
      print: (uid) => {
        const med = this.state.cart.find(m => m.uid === uid);
        if (med && window.printController) window.printController.quickPrint(med);
      },
      toggleOverlay: (el, e) => {
        e.stopPropagation();
        const item = el.closest(".cart-item");
        if (!item) return;
        const wasOpen = item.classList.contains("mobile-actions-open");
        const otherWasOpen = document.querySelector(".cart-item.mobile-actions-open:not([data-uid='" + item.dataset.uid + "'])");
        document.querySelectorAll(".cart-item.mobile-actions-open").forEach(c => c.classList.remove("mobile-actions-open"));
        document.querySelectorAll(".med-item.mobile-actions-open").forEach(c => c.classList.remove("mobile-actions-open"));
        if (!wasOpen && !otherWasOpen) item.classList.add("mobile-actions-open");
      },
      dismissOverlay: (btn) => {
        const item = btn.closest(".cart-item");
        if (item) item.classList.remove("mobile-actions-open");
      }
    };
  }

  setupEventListeners() {
    this.setupSearchListeners();
    this.setupWeightListeners();
    this.setupModalListeners();
    this.setupLocationListeners();
    this.setupProviderListeners();
    this.setupActionButtons();
    this.setupHelpListeners();
    this.setupGlobalKeyboard();
    this.setupResizeListener();
    this.setupColumnResizers();
    this.setupMobileSwipe();
    this.setupMobileListeners();
  }

  setupResizeListener() {
    let resizeRAF;
    window.addEventListener('resize', () => {
      if (resizeRAF) cancelAnimationFrame(resizeRAF);
      resizeRAF = requestAnimationFrame(() => {
        this.handleResize();
      });
    });
  }

  // ── Column Resizers (Desktop Only) ──────────────────────────────

  setupColumnResizers() {
    const dashboard = document.getElementById("dashboardView");
    const resizer1 = document.getElementById("rx-resizer-1");
    const resizer2 = document.getElementById("rx-resizer-2");
    const resizer3 = document.getElementById("rx-resizer-3");
    if (!dashboard || !resizer1 || !resizer2 || !resizer3) return;

    let activeResizer = null;
    const MIN_POP = 120;     // px — population column
    const MIN_SPEC = 180;    // px — specialty column
    const MIN_SUB = 120;     // px — subcategory column (nested only)
    const MIN_MEDS = 200;    // px — meds column

    const onMouseDown = (e) => {
      if (Utils.isMobile()) return;
      if (this.state.nav.population === "Non-Med") return;
      e.preventDefault();
      activeResizer = e.currentTarget;
      activeResizer.classList.add("rx-col-resizer--active");
      document.body.classList.add("is-col-resizing");
    };

    const onMouseMove = (e) => {
      if (!activeResizer) return;

      const rect = dashboard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const totalWidth = rect.width;

      const colPop = document.getElementById("rx-col-population");
      const colSpec = document.getElementById("rx-col-specialty");
      const colSub = document.getElementById("rx-col-subcategory");
      const colMeds = document.getElementById("rx-col-meds");

      let w1 = colPop.offsetWidth;
      let w2 = colSpec.offsetWidth;
      let w3 = colSub.offsetWidth;
      let w4 = colMeds.offsetWidth;
      const nested = w3 > 0;

      if (activeResizer === resizer1) {
        // Resize population ↔ specialty (keep subcat + meds fixed)
        w1 = x;
        w2 = totalWidth - w1 - w3 - w4;
        if (w1 < MIN_POP) { w1 = MIN_POP; w2 = totalWidth - w1 - w3 - w4; }
        if (w2 < MIN_SPEC) { w2 = MIN_SPEC; w1 = totalWidth - w2 - w3 - w4; }
        if (w1 < MIN_POP) return;

      } else if (activeResizer === resizer2 && nested) {
        // Nested: resize specialty ↔ subcategory (keep pop + meds fixed)
        w2 = x - w1;
        w3 = totalWidth - w1 - w2 - w4;
        if (w2 < MIN_SPEC) { w2 = MIN_SPEC; w3 = totalWidth - w1 - w2 - w4; }
        if (w3 < MIN_SUB) { w3 = MIN_SUB; w2 = totalWidth - w1 - w3 - w4; }
        if (w2 < MIN_SPEC) return;

      } else {
        // resizer-3 (or resizer-2 in non-nested): resize right boundary
        w4 = totalWidth - x;
        if (nested) {
          // Nested: resize subcategory ↔ meds
          w3 = totalWidth - w1 - w2 - w4;
          if (w4 < MIN_MEDS) { w4 = MIN_MEDS; w3 = totalWidth - w1 - w2 - w4; }
          if (w3 < MIN_SUB) { w3 = MIN_SUB; w4 = totalWidth - w1 - w2 - w3; }
          if (w4 < MIN_MEDS) return;
        } else {
          // Non-nested: resize specialty ↔ meds (subcat stays 0)
          w2 = totalWidth - w1 - w4;
          if (w4 < MIN_MEDS) { w4 = MIN_MEDS; w2 = totalWidth - w1 - w4; }
          if (w2 < MIN_SPEC) { w2 = MIN_SPEC; w4 = totalWidth - w1 - w2; }
          if (w4 < MIN_MEDS) return;
        }
      }

      const pct1 = (w1 / totalWidth * 100).toFixed(4);
      const pct2 = (w2 / totalWidth * 100).toFixed(4);
      const pct3 = (w3 / totalWidth * 100).toFixed(4);
      const pct4 = (w4 / totalWidth * 100).toFixed(4);

      dashboard.style.gridTemplateColumns =
        pct1 + "% 0px " + pct2 + "% 0px " + pct3 + "% 0px " + pct4 + "%";
    };

    const onMouseUp = () => {
      if (!activeResizer) return;
      activeResizer.classList.remove("rx-col-resizer--active");
      activeResizer = null;
      document.body.classList.remove("is-col-resizing");
    };

    resizer1.addEventListener("mousedown", onMouseDown);
    resizer2.addEventListener("mousedown", onMouseDown);
    resizer3.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  // ── Mobile Swipe (Folder-back gesture) ──────────────────────────

  setupMobileSwipe() {
    const rxPage = document.getElementById("page-prescriptions");
    if (!rxPage) return;

    const EDGE_ZONE = 25;
    const SWIPE_THRESHOLD = 50;
    const VELOCITY_THRESHOLD = 0.3;
    const ANGLE_LOCK = 1.2;

    let startX = 0, startY = 0, currentX = 0, startTime = 0;
    let isDragging = false, directionLocked = false, isHorizontal = false, active = false;
    let panelsReady = false, oldPanel = null, newPanel = null, savedScrollTop = 0;
    let savedContainerMinHeight = "", savedContainerHeight = "";
    let panelWidth = 0;

    const renderer = this.renderers.mobileFolder;

    rxPage.addEventListener("touchstart", (e) => {
      if (!Utils.isMobile()) return;
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      if (!this.shouldHandleFolderBack(touch.clientX)) return;

      const container = document.getElementById("rx-meds-list");
      if (container && (container.classList.contains("is-animating") || container.classList.contains("folder-dragging"))) return;

      startX = touch.clientX;
      startY = touch.clientY;
      currentX = startX;
      startTime = Date.now();
      isDragging = false;
      directionLocked = false;
      isHorizontal = false;
      panelsReady = false;
      active = true;
    }, { passive: true });

    rxPage.addEventListener("touchmove", (e) => {
      if (!active || !Utils.isMobile() || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!directionLocked) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx < 8 && absDy < 8) return;

        directionLocked = true;
        if (absDx > absDy * ANGLE_LOCK) {
          isHorizontal = true;
        } else {
          isHorizontal = false;
          active = false;
          return;
        }
      }

      if (!isHorizontal || dx < 0) return;

      e.preventDefault();
      isDragging = true;
      currentX = touch.clientX;

      // Setup panels on first drag
      if (!panelsReady) {
        // Dismiss any open action overlays so they don't interfere with swipe
        document.querySelectorAll(".med-item.mobile-actions-open").forEach(el =>
          el.classList.remove("mobile-actions-open")
        );

        const container = document.getElementById("rx-meds-list");
        if (!container) return;

        // Lock container height while children are moved into absolutely positioned drag panels.
        // Prevents transient flex collapse/blank frames on iOS during interactive swipe.
        savedContainerMinHeight = container.style.minHeight;
        savedContainerHeight = container.style.height;
        const lockHeight = container.offsetHeight;
        container.style.minHeight = lockHeight + "px";
        container.style.height = lockHeight + "px";
        panelWidth = container.clientWidth || window.innerWidth;

        savedScrollTop = container.scrollTop;

        // Wrap current content
        oldPanel = document.createElement("div");
        oldPanel.className = "folder-drag-panel";
        oldPanel.style.transform = "translate3d(0, 0, 0)";
        oldPanel.style.top = "0";
        while (container.firstChild) oldPanel.appendChild(container.firstChild);
        container.classList.add("folder-dragging");
        container.appendChild(oldPanel);
        oldPanel.scrollTop = savedScrollTop;

        // Render parent content
        const nav = this.state.nav;
        const savedNavPath = nav.navPath.slice();
        const savedPop = nav.population;

        if (nav.navPath.length > 0) {
          nav.navPath = nav.navPath.slice(0, -1);
        } else if (nav.population) {
          nav.population = "";
        }
        // Render parent level offscreen so the current panel never flashes blank.
        const originalContainerId = container.id;
        const liveContainerId = originalContainerId + "-live";
        const scratch = document.createElement("div");
        scratch.id = originalContainerId;
        scratch.className = "rx-col__content";
        scratch.style.display = "none";
        document.body.appendChild(scratch);

        container.id = liveContainerId;
        try {
          renderer.renderCurrentLevel();

          // Wrap new content
          newPanel = document.createElement("div");
          newPanel.className = "folder-drag-panel";
          newPanel.style.transform = "translate3d(" + (-panelWidth) + "px, 0, 0)";
          while (scratch.firstChild) newPanel.appendChild(scratch.firstChild);
        } finally {
          container.id = originalContainerId;
          if (scratch.parentNode) scratch.remove();
        }

        // Restore state
        nav.navPath = savedNavPath;
        nav.population = savedPop;
        renderer.renderMobileBreadcrumb();

        if (!newPanel) {
          container.classList.remove("folder-dragging");
          container.style.minHeight = savedContainerMinHeight;
          container.style.height = savedContainerHeight;
          savedContainerMinHeight = "";
          savedContainerHeight = "";
          if (oldPanel.parentNode) oldPanel.remove();
          const restored = document.createDocumentFragment();
          while (oldPanel.firstChild) restored.appendChild(oldPanel.firstChild);
          container.appendChild(restored);
          oldPanel = null;
          active = false;
          return;
        }

        container.insertBefore(newPanel, oldPanel);
        panelsReady = true;
      }

      const offset = Math.max(0, dx);
      oldPanel.style.transform = "translate3d(" + offset + "px, 0, 0)";
      newPanel.style.transform = "translate3d(" + (-panelWidth + offset) + "px, 0, 0)";
    }, { passive: false });

    const onTouchEnd = () => {
      if (!active) return;

      if (!isDragging) {
        active = false;
        return;
      }

      const dx = currentX - startX;
      const dt = Date.now() - startTime;
      const velocity = Math.abs(dx) / Math.max(dt, 1);
      const shouldComplete = Math.abs(dx) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

      if (!panelsReady) {
        active = false;
        return;
      }

      const container = document.getElementById("rx-meds-list");

      // Add transition class then force reflow so the browser registers
      // the current transform as the "from" value before we set the "to" value
      oldPanel.classList.add("animate");
      newPanel.classList.add("animate");
      void newPanel.offsetWidth;

      let cleaned = false;

      if (shouldComplete && dx > 0) {
        oldPanel.style.transform = "translate3d(" + panelWidth + "px, 0, 0)";
        newPanel.style.transform = "translate3d(0, 0, 0)";

        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;

          // Commit navigation directly (don't call goBack which triggers a second animation)
          const nav = renderer.state.nav;
          if (nav.navPath.length > 0) {
            nav.navPath.pop();
          } else if (nav.population) {
            nav.population = "";
          }

          // Unwrap new panel content into container
          container.classList.remove("folder-dragging");
          container.style.minHeight = savedContainerMinHeight;
          container.style.height = savedContainerHeight;
          savedContainerMinHeight = "";
          savedContainerHeight = "";
          if (oldPanel.parentNode) oldPanel.remove();
          if (newPanel.parentNode) newPanel.remove();
          const restored = document.createDocumentFragment();
          while (newPanel.firstChild) restored.appendChild(newPanel.firstChild);
          container.appendChild(restored);

          // Update header to reflect new nav state
          renderer.renderMobileBreadcrumb();

          // Update cart indicators
          if (window.cartRenderer) {
            window.cartRenderer.updateSelectedIndicators();
          }

          oldPanel = null;
          newPanel = null;
          panelsReady = false;
        };

        newPanel.addEventListener("transitionend", function onEnd(ev) {
          if (ev.target !== newPanel || ev.propertyName !== "transform") return;
          newPanel.removeEventListener("transitionend", onEnd);
          cleanup();
        });
        // Safety: if transitionend doesn't fire, clean up after transition duration + buffer
        setTimeout(cleanup, 400);
      } else {
        oldPanel.style.transform = "translate3d(0, 0, 0)";
        newPanel.style.transform = "translate3d(" + (-panelWidth) + "px, 0, 0)";

        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;

          container.classList.remove("folder-dragging");
          container.style.minHeight = savedContainerMinHeight;
          container.style.height = savedContainerHeight;
          savedContainerMinHeight = "";
          savedContainerHeight = "";
          if (newPanel.parentNode) newPanel.remove();
          if (oldPanel.parentNode) oldPanel.remove();
          const restored = document.createDocumentFragment();
          while (oldPanel.firstChild) restored.appendChild(oldPanel.firstChild);
          container.appendChild(restored);
          container.scrollTop = savedScrollTop;
          oldPanel = null;
          newPanel = null;
          panelsReady = false;
        };

        oldPanel.addEventListener("transitionend", function onEnd(ev) {
          if (ev.target !== oldPanel || ev.propertyName !== "transform") return;
          oldPanel.removeEventListener("transitionend", onEnd);
          cleanup();
        });
        // Safety: if transitionend doesn't fire, clean up after transition duration + buffer
        setTimeout(cleanup, 400);
      }

      isDragging = false;
      directionLocked = false;
      isHorizontal = false;
      active = false;
    };

    rxPage.addEventListener("touchend", onTouchEnd, { passive: true });
    rxPage.addEventListener("touchcancel", onTouchEnd, { passive: true });
  }

  /** Check if prescriptions should handle folder-back for a given touch X position. */
  shouldHandleFolderBack(touchX) {
    if (!Utils.isMobile()) return false;
    if (!this.renderers.mobileFolder.shouldHandleFolderBack()) return false;
    // Edge zone touches go to Shell for page transitions
    if (touchX <= 25) return false;
    if (touchX >= window.innerWidth - 25) return false;
    return true;
  }

  setupSearchListeners() {
    // Shell handles search input dispatch — no bindings needed here.
    // Shell calls this.controllers.search.search(query) directly.
  }

  setupWeightListeners() {
    const weightInput = Utils.getElement("weightInput");

    if (!weightInput) {
      console.error("Weight input not found");
      return;
    }

    weightInput.value = "";

    // Select all text when focusing the input
    weightInput.addEventListener("focus", (e) => {
      setTimeout(() => {
        e.target.select();
      }, 0);
    });

    // Prevent mouseup from deselecting text
    weightInput.addEventListener("mouseup", (e) => {
      e.preventDefault();
    });

    // Blur on Enter key
    weightInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.blur();
      }
    });

    // Real-time update with sanitization
    weightInput.addEventListener("input", (e) => {
      const sanitized = Utils.sanitizeWeightInput(e.target.value);
      if (sanitized !== e.target.value) {
        e.target.value = sanitized;
      }
      this.controllers.weight.update(sanitized);
    });

    // Format on blur/enter
    weightInput.addEventListener("change", (e) => {
      this.controllers.weight.format(e.target.value);
    });
  }

  setupModalListeners() {
    // Weight Modal
    const modalSaveBtn = Utils.getElement("modalSaveBtn");
    const modalSkipBtn = Utils.getElement("modalSkipBtn");
    const modalWeightInput = Utils.getElement("modalWeightInput");

    if (modalSaveBtn && modalSkipBtn && modalWeightInput) {
      // Select all text when clicking/focusing the modal weight input
      modalWeightInput.addEventListener("focus", (e) => {
        e.target.select();
      });

      modalWeightInput.addEventListener("click", (e) => {
        e.target.select();
      });

      // Sanitize input on every change to ensure only valid numeric values
      modalWeightInput.addEventListener("input", (e) => {
        const sanitized = Utils.sanitizeWeightInput(e.target.value);
        if (sanitized !== e.target.value) {
          e.target.value = sanitized;
        }
      });

      modalSaveBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.managers.modal.saveWeight((med) => {
          this.controllers.cart.add(med);
        });
      });

      modalSkipBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.managers.modal.skipWeight((med) => {
          this.controllers.cart.add(med);
        });
      });

      modalWeightInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          this.managers.modal.saveWeight((med) => {
            this.controllers.cart.add(med);
          });
        }

        // Prevent arrow keys from adjusting the number
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
        }
      });
    }

    // Edit Modal
    const saveEditBtn = Utils.getElement("saveEditBtn");
    const cancelEditBtn = Utils.getElement("cancelEditBtn");

    if (saveEditBtn && cancelEditBtn) {
      saveEditBtn.addEventListener("click", () => {
        this.managers.modal.saveEdit();
        this.controllers.cart.render();
      });

      cancelEditBtn.addEventListener("click", () => {
        this.managers.modal.closeEdit();
      });
    }

    // Add New Med Modal
    const saveAddBtn = Utils.getElement("saveAddBtn");
    const cancelAddBtn = Utils.getElement("cancelAddBtn");

    if (saveAddBtn && cancelAddBtn) {
      saveAddBtn.addEventListener("click", () => {
        const modalBox = document.querySelector("#addNewMedModal .modal-box");
        this.managers.modal.saveAddNewMed((med) => {
          this.controllers.cart.add(med, modalBox);
        });
        this.controllers.cart.render();
      });

      cancelAddBtn.addEventListener("click", () => {
        this.managers.modal.closeAddNewMed();
      });
    }

    // Search Edit Modal
    const cancelSearchEditBtn = Utils.getElement("cancelSearchEditBtn");
    const addToCartSearchEditBtn = Utils.getElement("addToCartSearchEditBtn");
    const printSearchEditBtn = Utils.getElement("printSearchEditBtn");

    if (cancelSearchEditBtn && addToCartSearchEditBtn && printSearchEditBtn) {
      cancelSearchEditBtn.addEventListener("click", () => {
        this.controllers.searchEdit.cancel();
      });

      addToCartSearchEditBtn.addEventListener("click", () => {
        this.controllers.searchEdit.addToCart();
      });

      printSearchEditBtn.addEventListener("click", () => {
        this.controllers.searchEdit.print();
      });
    }

    // Location Modal
    const saveLocBtn = Utils.getElement("saveLocBtn");
    const cancelLocBtn = Utils.getElement("cancelLocBtn");

    if (saveLocBtn && cancelLocBtn) {
      saveLocBtn.addEventListener("click", () => {
        this.controllers.location.saveNewLocation();
      });

      cancelLocBtn.addEventListener("click", () => {
        this.managers.modal.closeLocation();
      });
    }

    // Escape key handler for modals
    // NOTE: Weight modal Escape is handled by KeyboardController (supports quick-print mode)
    // NOTE: Cart dropdown Escape is handled by KeyboardController
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        // Cart dropdown Escape is handled by KeyboardController - skip here
        if (this.controllers.cart && this.controllers.cart.isCartDropdownOpen) {
          return;
        }

        const weightModal = Utils.getElement("weightModal");
        const editModal = Utils.getElement("editModal");
        const addNewMedModal = Utils.getElement("addNewMedModal");
        const searchEditModal = Utils.getElement("searchEditModal");
        const locationModal = Utils.getElement("locationModal");
        const providerDropdown = Utils.getElement("providerEditDropdown");

        // Skip weight modal - handled by KeyboardController with quick-print support
        if (weightModal && !weightModal.classList.contains("hidden")) {
          return;
        }

        // Close whichever modal is currently open
        if (searchEditModal && !searchEditModal.classList.contains("hidden")) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.controllers.searchEdit.cancel();
          return; // Prevent other handlers from clearing search
        } else if (editModal && !editModal.classList.contains("hidden")) {
          e.stopImmediatePropagation();
          this.managers.modal.closeEdit();
          return;
        } else if (addNewMedModal && !addNewMedModal.classList.contains("hidden")) {
          e.stopImmediatePropagation();
          this.managers.modal.closeAddNewMed();
          return;
        } else if (locationModal && !locationModal.classList.contains("hidden")) {
          e.stopImmediatePropagation();
          this.managers.modal.closeLocation();
          return;
        } else if (providerDropdown && !providerDropdown.classList.contains("hidden")) {
          e.stopImmediatePropagation();
          this.managers.modal.closeProvider();
          return;
        }
      }
    });

    // Click-outside-to-close handler for all modals
    const setupModalClickOutside = (modalId, closeMethod) => {
      const modal = Utils.getElement(modalId);
      if (modal) {
        modal.addEventListener("click", (e) => {
          // Only close if clicking the overlay itself, not the modal content
          if (e.target === modal) {
            closeMethod();
          }
        });
      }
    };

    // Weight modal: clicking outside does nothing (user must use buttons)
    setupModalClickOutside("editModal", () => this.managers.modal.closeEdit());
    setupModalClickOutside("addNewMedModal", () => this.managers.modal.closeAddNewMed());
    setupModalClickOutside("locationModal", () => this.managers.modal.closeLocation());
    setupModalClickOutside("searchEditModal", () => this.controllers.searchEdit.cancel());

    // Provider edit uses a backdrop instead of a modal overlay
    const providerBackdrop = Utils.getElement("providerEditBackdrop");
    if (providerBackdrop) {
      providerBackdrop.addEventListener("click", () => {
        this.managers.modal.closeProvider();
      });
    }
  }

  setupLocationListeners() {
    const locationBtn = document.getElementById("locationBtn");
    const locationWrapper = locationBtn?.parentElement;

    if (!locationBtn) {
      console.error("Location button not found");
      return;
    }

    // Add id to wrapper for easier reference
    if (locationWrapper) {
      locationWrapper.id = "locationWrapper";
    }

    locationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.controllers.location.toggleMenu();
    });

    // Close search mode when clicking outside
    document.addEventListener("click", (e) => {
      const locationWrapper = document.getElementById("locationWrapper");
      const mobileLocBtn = document.getElementById("mobileLocationBtn");

      // Don't close if clicking the mobile location button (it handles its own toggle)
      if (mobileLocBtn && mobileLocBtn.contains(e.target)) return;

      if (locationWrapper && !locationWrapper.contains(e.target)) {
        this.controllers.location.exitSearchMode();
      }
    });
  }

  setupProviderListeners() {
    const providerBtn = Utils.getElement("providerBtn");
    const saveProviderBtn = Utils.getElement("saveProviderBtn");
    const cancelProviderBtn = Utils.getElement("cancelProviderBtn");
    const providerNameInput = Utils.getElement("newProviderName");
    const providerCpsoInput = Utils.getElement("newProviderCpso");

    if (!providerBtn) {
      console.error("Provider button not found");
      return;
    }

    providerBtn.addEventListener("click", () => {
      this.controllers.provider.openEditModal();
    });

    if (saveProviderBtn && cancelProviderBtn) {
      saveProviderBtn.addEventListener("click", () => {
        this.controllers.provider.saveProvider();
      });

      cancelProviderBtn.addEventListener("click", () => {
        this.managers.modal.closeProvider();
      });
    }

    // Enter key to save in provider modal
    if (providerNameInput) {
      providerNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.controllers.provider.saveProvider();
        }
      });
    }

    if (providerCpsoInput) {
      providerCpsoInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.controllers.provider.saveProvider();
        }
      });

      // Only allow numeric input in CPSO field
      providerCpsoInput.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, "");
      });
    }
  }

  setupActionButtons() {
    const printBtn = Utils.getElement("printBtn");
    const clearCartBtn = Utils.getElement("clearCartBtn");
    const resetViewBtn = Utils.getElement("resetViewBtn");
    const cartBtn = Utils.getElement("cartBtn");
    const cartOverlay = Utils.getElement("cartOverlay");

    if (printBtn) {
      printBtn.addEventListener("click", () => {
        this.controllers.print.print();
      });
    }

    if (clearCartBtn) {
      clearCartBtn.addEventListener("click", () => {
        this.controllers.cart.clear();
      });
    }

    if (resetViewBtn) {
      resetViewBtn.addEventListener("click", () => {
        this.controllers.reset.reset();
        // Re-render folder view with reset nav state
        if (Utils.isMobile()) {
          this.renderers.mobileFolder.renderCurrentLevel();
        } else {
          this.renderers.folder.render();
        }
      });
    }

    // Cart button toggles dropdown
    if (cartBtn) {
      cartBtn.addEventListener("click", () => {
        this.controllers.cart.toggleCartDropdown();
      });
    }

    // Cart overlay click closes dropdown
    if (cartOverlay) {
      cartOverlay.addEventListener("click", () => {
        this.controllers.cart.closeCartDropdown();
      });
    }
  }

  setupHelpListeners() {
    // Shell manages the help button and page-specific help content.
    // Help popup close/escape handlers are set up by Shell.
  }

  setupGlobalKeyboard() {
    document.addEventListener("keydown", (e) => {
      this.controllers.keyboard.handleGlobalKeydown(e);
    });
  }

  // ---- Mobile-specific setup ----

  setupMobileListeners() {
    // Prevent browser scroll restoration pushing header off-screen
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    // Dismiss med/cart action overlays when tapping outside
    document.addEventListener("click", () => {
      document.querySelectorAll(".med-item.mobile-actions-open").forEach(el =>
        el.classList.remove("mobile-actions-open")
      );
      document.querySelectorAll(".cart-item.mobile-actions-open").forEach(el =>
        el.classList.remove("mobile-actions-open")
      );
    });

    // Mobile help button: Shell handles via _initHelpSystem

    // Mobile provider button
    const mobileProviderBtn = document.getElementById("mobileProviderBtn");
    if (mobileProviderBtn) {
      mobileProviderBtn.addEventListener("click", () => {
        const isOpen = document.body.classList.contains("mobile-provider-active");
        this._closeActiveMobileModal();
        if (!isOpen) this.openMobileProvider();
      });
    }

    // Mobile location button
    const mobileLocationBtn = document.getElementById("mobileLocationBtn");
    if (mobileLocationBtn) {
      mobileLocationBtn.addEventListener("click", () => {
        const isOpen = document.body.classList.contains("mobile-location-active");
        this._closeActiveMobileModal();
        if (!isOpen) this.openMobileLocation();
      });
    }

    // Mobile weight button
    const mobileWeightBtn = document.getElementById("mobileWeightBtn");
    if (mobileWeightBtn) {
      mobileWeightBtn.addEventListener("click", () => {
        const isOpen = this.state._mobileWeightMode;
        this._closeActiveMobileModal();
        if (!isOpen) this.openMobileWeightModal();
      });
    }

    // Mobile cart close button
    const mobileCartClose = document.getElementById("mobileCartClose");
    if (mobileCartClose) {
      mobileCartClose.addEventListener("click", () => {
        this.controllers.cart.closeCartDropdown();
      });
    }

    // Shell handles search input focus and has-search-query body class
  }

  // enterMobileSearch / exitMobileSearch removed — Shell's always-visible search bar replaces the takeover

  _closeActiveMobileModal() {
    if (document.body.classList.contains("mobile-provider-active")) {
      this.managers.modal.closeProvider();
    }
    if (document.body.classList.contains("mobile-location-active")) {
      this.controllers.location.exitSearchMode();
    }
    if (document.body.classList.contains("mobile-addlocation-active")) {
      this.managers.modal.closeLocation();
    }
    if (this.state._mobileWeightMode) {
      this.closeMobileWeightModal();
    }
  }

  openMobileProvider() {
    const dropdown = document.getElementById("providerEditDropdown");

    // Add body class for weight-modal style takeover
    document.body.classList.add("mobile-provider-active");
    document.documentElement.classList.add("mobile-provider-active");

    // Inject close button into the name row if not already present
    if (dropdown && !dropdown.querySelector(".mobile-provider-close")) {
      const nameRow = dropdown.querySelector(".provider-edit-row");
      if (nameRow) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "mobile-provider-close";
        closeBtn.type = "button";
        closeBtn.innerHTML = "&times;";
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.managers.modal.closeProvider();
        });
        nameRow.appendChild(closeBtn);
      }
    }

    this.controllers.provider.openEditModal();

    // Override placeholder for mobile (match weight modal style)
    const nameInput = document.getElementById("newProviderName");
    if (nameInput && nameInput.placeholder.startsWith("e.g.")) {
      nameInput.placeholder = "Name";
    }
  }

  openMobileLocation() {
    document.body.classList.add("mobile-location-active");
    document.documentElement.classList.add("mobile-location-active");
    const wrapper = document.getElementById("locationWrapper");
    if (wrapper) {
      wrapper.classList.add("mobile-location-active");
    }
    this.controllers.location.toggleMenu();
  }

  openMobileWeightModal() {
    const modal = document.getElementById("weightModal");
    const title = document.getElementById("weightModalTitle");
    const input = document.getElementById("modalWeightInput");
    const saveBtn = document.getElementById("modalSaveBtn");
    const skipBtn = document.getElementById("modalSkipBtn");

    if (!modal || !title || !input || !saveBtn || !skipBtn) return;

    // Set mobile weight mode flag
    this.state._mobileWeightMode = true;

    // Add body class for takeover styling
    document.body.classList.add("mobile-weight-active");
    document.documentElement.classList.add("mobile-weight-active");

    // Hide title, update button text
    title.style.display = "none";
    saveBtn.textContent = "Set Weight";
    skipBtn.textContent = "Clear";

    // Inject close button if not already present
    const modalBox = modal.querySelector(".modal-box");
    if (modalBox && !modal.querySelector(".mobile-weight-close")) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "mobile-weight-close";
      closeBtn.type = "button";
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeMobileWeightModal();
      });
      // Insert close button into the input row area
      const inputGroup = modal.querySelector(".modal-input-group");
      if (inputGroup) inputGroup.appendChild(closeBtn);
    }

    // Pre-fill current weight if set
    input.value = this.state.currentWeight ? this.state.currentWeight.toString() : "";
    modal.classList.remove("hidden");
    setTimeout(() => input.focus(), 100);
  }

  closeMobileWeightModal() {
    this.managers.modal._resetMobileWeightModal();
    this.managers.modal.closeWeight();
  }

  updateMobileWeightBadge() {
    const badge = document.getElementById("mobileWeightBadge");
    if (badge) {
      badge.textContent = this.state.currentWeight
        ? this.state.currentWeight + "kg"
        : "";
    }
  }

  async loadData() {
    this.state.medications = await this.managers.data.loadMedications();
    
    if (this.state.medications.length === 0) {
      console.error("No medications loaded - medication data file may be missing or invalid");
      throw new Error("Failed to load medication data. Please check that Prescriptions.json exists and is valid.");
    }
    
    // Create SearchManager now that medications are loaded
    this.managers.search = new SearchManager(this.state.medications);
    
    // Update the search renderer with the SearchManager
    this.renderers.search.setSearchManager(this.managers.search);
  }

  render() {
    if (Utils.isMobile()) {
      // Mobile default: start at population picker (not preselected Adult).
      if (!this.state._mobileDefaultApplied) {
        this.state.nav.population = "";
        this.state.nav.navPath = [];
        this.state._mobileDefaultApplied = true;
      }
      this.renderers.mobileFolder.renderCurrentLevel();
    } else {
      // Desktop default remains Adult.
      if (!this.state.nav.population) {
        this.state.nav.population = "Adult";
      }
      this.renderers.folder.render();
    }

    // Render initial cart
    this.controllers.cart.render();

    // Set search placeholder based on provider
    this.updateSearchPlaceholder();
  }

  // checkLocationCollapse removed — Shell CSS handles responsive collapse via media queries

  // checkMinWidthOverlay removed — desktop-only overlay no longer exists in merged Shell

  handleResize() {
    // Reposition cart dropdown if open (desktop only - mobile uses CSS full-screen)
    if (!Utils.isMobile() && this.controllers.cart && this.controllers.cart.isCartDropdownOpen) {
      const dropdown = document.getElementById("cartDropdown");
      const cartBtn = document.getElementById("cartBtn");
      if (dropdown && cartBtn) {
        const btnRect = cartBtn.getBoundingClientRect();
        dropdown.style.right = (window.innerWidth - btnRect.right) + "px";
        dropdown.style.top = (btnRect.bottom + 4) + "px";
      }
    }
  }

  updateSearchPlaceholder() {
    // Shell manages the shared search input placeholder per active page.
    // This is called for compatibility but does nothing — Shell reads
    // provider.isOwner() when switching to the prescriptions page.
  }

  updateHelpText() {
    const el = document.getElementById("helpSearchText");
    if (el) {
      el.innerHTML = this.managers.provider.isOwner()
        ? "<strong>Advanced Search:</strong> You can search by indications (e.g. ped otitis media), brand names (e.g. keflex), and dosings (e.g., 400mg, PO, q4h, 7 day)."
        : "<strong>Advanced Search:</strong> You can search by generic/brand names (e.g. cephalexin/keflex), and dosings (e.g., 400mg, PO, q4h, 7 day).";
    }
  }

  handleProviderChange() {
    // Re-render folder view (indications visibility + sort order)
    if (Utils.isMobile()) {
      this.renderers.mobileFolder.renderCurrentLevel();
    } else {
      this.renderers.folder.render();
    }
    this.renderers.cart.updateSelectedIndicators();

    // Refresh search results if search is active
    const shellSearch = document.getElementById("shell-search-input");
    if (shellSearch && shellSearch.value.trim()) {
      this.controllers.search.search(shellSearch.value);
    }

    // Propagate provider change to billing (isAlvin check)
    if (window.App && window.App.checkUser) {
      window.App.checkUser();
      // Re-render billing context panel if a code is selected
      if (window.App.state && window.App.state.selectedCode && window.App.renderContextPanel) {
        window.App.renderContextPanel(window.App.state.selectedCode);
      }
    }
  }

  focus() {
    // Shell manages search input focus — no auto-focus from Rx
  }
}

// ============================================================================
// START APPLICATION
// ============================================================================

// Application class is initialized by Shell via:
//   window.app = new Application();
//   await window.app.initialize();

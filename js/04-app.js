// ============================================================================
// APPLICATION INITIALIZATION & SETUP
// ============================================================================

class Application {
  constructor() {
    this.state = null;
    this.controllers = {};
    this.renderers = {};
    this.managers = {};
    this.isTwoColumn = false;
    this.isOneColumn = false;
    this.TWO_COLUMN_BREAKPOINT = 1050;
    this.ONE_COLUMN_BREAKPOINT = 700;
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
      console.error("Failed to initialize application:", error);
      
      // Show user-friendly error message
      const errorMsg = error.message || "An unknown error occurred";
      alert(`Failed to load application.\n\n${errorMsg}\n\nPlease refresh the page or contact support if the problem persists.`);
      
      // Show error state in UI instead of blank page
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
          <div style="background:var(--panel);padding:30px;border-radius:22px;max-width:500px;box-shadow:var(--shadow-lg);">
            <h2 style="color:var(--danger);margin-top:0;">Application Error</h2>
            <p style="color:var(--muted);line-height:1.6;">${errorMsg}</p>
            <p style="color:var(--calc-note);line-height:1.6;">Please try:</p>
            <ul style="color:var(--calc-note);line-height:1.8;">
              <li>Refreshing the page</li>
              <li>Clearing your browser cache</li>
              <li>Checking your internet connection</li>
              <li>Ensuring Prescriptions.json is in the same directory</li>
            </ul>
            <button onclick="location.reload()" style="background:var(--accent);color:white;border:none;padding:10px 20px;border-radius:12px;cursor:pointer;font-size:14px;">
              Refresh Page
            </button>
          </div>
        </div>
      `;
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
      dashboard: new DashboardRenderer(this.state, medRenderer),
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
      this.renderers.dashboard,
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
      edit: (uid) => this.managers.modal.openEdit(uid)
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

  setupSearchListeners() {
    const searchInput = Utils.getElement("searchInput");
    const clearBtn = Utils.getElement("clearSearchBtn");

    if (!searchInput || !clearBtn) {
      console.error("Search elements not found");
      return;
    }

    searchInput.value = "";
    
    searchInput.addEventListener("input", (e) => {
      this.controllers.search.search(e.target.value);
    });

    clearBtn.addEventListener("click", () => {
      this.controllers.search.clear();
    });
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
    const helpBtn = Utils.getElement("helpBtn");
    const helpPopup = Utils.getElement("helpPopup");
    const helpCloseBtn = Utils.getElement("helpCloseBtn");

    if (!helpBtn || !helpPopup || !helpCloseBtn) {
      console.warn("Help elements not found");
      return;
    }

    // Open help popup when clicking the help button
    helpBtn.addEventListener("click", () => {
      this.updateHelpText();
      helpPopup.classList.remove("hidden");
    });

    // Close help popup when clicking the X button
    helpCloseBtn.addEventListener("click", () => {
      helpPopup.classList.add("hidden");
    });

    // Close help popup when clicking outside the popup box
    helpPopup.addEventListener("click", (e) => {
      if (e.target === helpPopup) {
        helpPopup.classList.add("hidden");
      }
    });

    // Close help popup with Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !helpPopup.classList.contains("hidden")) {
        helpPopup.classList.add("hidden");
      }
    });
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

    // Mobile help button
    const mobileHelpBtn = document.getElementById("mobileHelpBtn");
    if (mobileHelpBtn) {
      mobileHelpBtn.addEventListener("click", () => {
        this.updateHelpText();
        const helpPopup = document.getElementById("helpPopup");
        if (helpPopup) helpPopup.classList.remove("hidden");
      });
    }

    // Mobile provider button
    const mobileProviderBtn = document.getElementById("mobileProviderBtn");
    if (mobileProviderBtn) {
      mobileProviderBtn.addEventListener("click", () => {
        this.openMobileProvider();
      });
    }

    // Mobile location button
    const mobileLocationBtn = document.getElementById("mobileLocationBtn");
    if (mobileLocationBtn) {
      mobileLocationBtn.addEventListener("click", () => {
        this.openMobileLocation();
      });
    }

    // Mobile weight button
    const mobileWeightBtn = document.getElementById("mobileWeightBtn");
    if (mobileWeightBtn) {
      mobileWeightBtn.addEventListener("click", () => {
        this.openMobileWeightModal();
      });
    }

    // Mobile search cancel button
    const mobileSearchCancel = document.getElementById("mobileSearchCancel");
    if (mobileSearchCancel) {
      mobileSearchCancel.addEventListener("click", () => {
        this.exitMobileSearch();
      });
    }

    // Mobile cart close button
    const mobileCartClose = document.getElementById("mobileCartClose");
    if (mobileCartClose) {
      mobileCartClose.addEventListener("click", () => {
        this.controllers.cart.closeCartDropdown();
      });
    }

    // Search input focus triggers mobile takeover
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("focus", () => {
        if (Utils.isMobile()) {
          this.enterMobileSearch();
        }
      });
      // Toggle empty state vs results based on input content
      searchInput.addEventListener("input", () => {
        if (Utils.isMobile()) {
          document.body.classList.toggle("has-search-query", searchInput.value.trim().length > 0);
        }
      });
    }
  }

  enterMobileSearch() {
    if (this._exitingMobileSearch) return;
    window.scrollTo(0, 0);
    document.body.classList.add("mobile-search-active");
    document.documentElement.classList.add("mobile-search-active");
  }

  exitMobileSearch() {
    this._exitingMobileSearch = true;
    document.body.classList.remove("mobile-search-active");
    document.body.classList.remove("has-search-query");
    document.documentElement.classList.remove("mobile-search-active");
    // Clear search without re-focusing (clear() calls safeFocus which would re-trigger)
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.value = "";
      searchInput.blur();
    }
    this.controllers.search.search("");
    Utils.safeRemoveClass("clearSearchBtn", "visible");
    // Allow re-entry after a tick
    requestAnimationFrame(() => {
      this._exitingMobileSearch = false;
    });
  }

  openMobileProvider() {
    // Move provider dropdown to body so it's visible (it's inside a hidden wrapper on mobile)
    const dropdown = document.getElementById("providerEditDropdown");
    if (dropdown && Utils.isMobile()) {
      this._providerDropdownParent = dropdown.parentElement;
      document.body.appendChild(dropdown);
    }
    this.controllers.provider.openEditModal();
  }

  closeMobileProvider() {
    // Move provider dropdown back to its original parent
    const dropdown = document.getElementById("providerEditDropdown");
    if (dropdown && this._providerDropdownParent) {
      this._providerDropdownParent.appendChild(dropdown);
      this._providerDropdownParent = null;
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

    // Change modal text for direct weight entry
    title.innerHTML = "Enter patient weight.";
    saveBtn.textContent = "Set Weight";
    skipBtn.textContent = "Clear";

    // Pre-fill current weight if set
    input.value = this.state.currentWeight ? this.state.currentWeight.toString() : "";
    modal.classList.remove("hidden");
    setTimeout(() => input.focus(), 100);
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

  getColumnConfig() {
    if (this.isOneColumn) {
      return { col1: SPECIALTY_SINGLE_COLUMN, col2: [], col3: [] };
    } else if (this.isTwoColumn) {
      return { col1: SPECIALTY_2_COLUMNS.col1, col2: SPECIALTY_2_COLUMNS.col2, col3: [] };
    }
    return { col1: SPECIALTY_COLUMNS.col1, col2: SPECIALTY_COLUMNS.col2, col3: SPECIALTY_COLUMNS.col3 };
  }

  updateLayoutMode() {
    if (Utils.isMobile()) {
      this.isOneColumn = true;
      this.isTwoColumn = false;
      return;
    }
    const width = window.innerWidth;
    this.isOneColumn = width <= this.ONE_COLUMN_BREAKPOINT;
    this.isTwoColumn = !this.isOneColumn && width <= this.TWO_COLUMN_BREAKPOINT;
  }

  render() {
    this.updateLayoutMode();

    this.renderers.dashboard.render(
      this.getColumnConfig(),
      (med, element) => this.controllers.cart.toggle(med, element)
    );

    // Render initial cart
    this.controllers.cart.render();

    // Set search placeholder based on provider
    this.updateSearchPlaceholder();

    // Check location collapse and overlay on initial render
    this.checkLocationCollapse();
    this.checkMinWidthOverlay();
  }

  checkLocationCollapse() {
    if (Utils.isMobile()) return;
    const locationWrapper = document.getElementById("locationWrapper") ||
      document.querySelector(".location-wrapper");
    const providerWrapper = document.querySelector(".provider-wrapper");
    const topbarRight = document.querySelector(".topbar-right");
    const resetBtn = document.getElementById("resetViewBtn");
    if (!locationWrapper || !topbarRight) return;

    const isLocationCollapsed = locationWrapper.classList.contains("icon-only");
    const isResetCollapsed = resetBtn?.classList.contains("icon-only");

    // Step 1: Collapse/expand reset button first (text -> icon)
    if (resetBtn) {
      const locRect = locationWrapper.getBoundingClientRect();
      const rightRect = topbarRight.getBoundingClientRect();
      const gap = rightRect.left - locRect.right;

      if (!isResetCollapsed && gap < 20) {
        resetBtn.classList.add("icon-only");
        this._resetCollapseWidth = window.innerWidth;
      } else if (isResetCollapsed && !isLocationCollapsed &&
                 window.innerWidth > (this._resetCollapseWidth || 0) + 30) {
        // Try expanding reset button back
        resetBtn.classList.remove("icon-only");

        const newLocRect = locationWrapper.getBoundingClientRect();
        const newRightRect = topbarRight.getBoundingClientRect();
        const newGap = newRightRect.left - newLocRect.right;

        if (newGap < 20) {
          // Still too tight, re-collapse
          resetBtn.classList.add("icon-only");
          this._resetCollapseWidth = window.innerWidth;
        } else {
          this._resetCollapseWidth = 0;
        }
      }
    }

    // Step 2: Collapse/expand location (existing logic)
    if (!isLocationCollapsed) {
      const locRect = locationWrapper.getBoundingClientRect();
      const rightRect = topbarRight.getBoundingClientRect();
      const gap = rightRect.left - locRect.right;

      if (gap < 12 && locRect.width <= 101) {
        locationWrapper.classList.add("icon-only");
        if (providerWrapper) providerWrapper.classList.add("can-shrink");
        this._locationCollapseWidth = window.innerWidth;
      }
    } else if (window.innerWidth > (this._locationCollapseWidth || 0) + 30) {
      locationWrapper.classList.remove("icon-only");
      if (providerWrapper) providerWrapper.classList.remove("can-shrink");

      const locRect = locationWrapper.getBoundingClientRect();
      const rightRect = topbarRight.getBoundingClientRect();
      const gap = rightRect.left - locRect.right;

      if (gap < 12 && locRect.width <= 101) {
        locationWrapper.classList.add("icon-only");
        if (providerWrapper) providerWrapper.classList.add("can-shrink");
        this._locationCollapseWidth = window.innerWidth;
      } else {
        this._locationCollapseWidth = 0;
      }
    }
  }

  checkMinWidthOverlay() {
    const overlay = document.getElementById("desktopOnlyOverlay");
    if (Utils.isMobile()) {
      if (overlay) overlay.classList.remove("active");
      return;
    }
    const providerWrapper = document.querySelector(".provider-wrapper");
    const topbarRight = document.querySelector(".topbar-right");
    const locationWrapper = document.querySelector(".location-wrapper");
    if (!overlay || !providerWrapper || !topbarRight || !locationWrapper) return;

    // When location search is active, provider is hidden so normal gap check
    // won't work. Simulate the normal layout: would it fit at this viewport?
    if (locationWrapper.classList.contains("search-active")) {
      const topbar = document.querySelector(".topbar");
      const menuBtn = document.querySelector(".menu-btn");
      const cs = getComputedStyle(topbar);
      const padL = parseFloat(cs.paddingLeft);
      const padR = parseFloat(cs.paddingRight);
      const gap = parseFloat(cs.gap) || 12;
      const menuW = menuBtn ? menuBtn.getBoundingClientRect().width : 0;
      const rightW = topbarRight.getBoundingClientRect().width;
      // Normal layout minimum: padding + menu + provider(130) + location-icon(35) + topbar-right + gaps
      const minNeeded = padL + menuW + gap + 130 + gap + 35 + gap + rightW + padR;
      if (window.innerWidth <= minNeeded) {
        overlay.classList.add("active");
      } else {
        overlay.classList.remove("active");
      }
      return;
    }

    // Check if provider is at its minimum and gap to location is being squeezed
    const provRect = providerWrapper.getBoundingClientRect();
    const locRect = locationWrapper.getBoundingClientRect();
    const rightRect = topbarRight.getBoundingClientRect();
    const gapProvToLoc = locRect.left - provRect.right;
    const gapLocToRight = rightRect.left - locRect.right;

    // Show overlay when any gap drops below 12px with everything at minimum
    const providerAtMin = provRect.width <= 131;
    const locationCollapsed = locationWrapper.classList.contains("icon-only");

    if (locationCollapsed && providerAtMin && (gapProvToLoc < 12 || gapLocToRight < 12)) {
      overlay.classList.add("active");
    } else {
      overlay.classList.remove("active");
    }
  }

  handleResize() {
    // Check if location field should collapse to icon
    this.checkLocationCollapse();

    // Check if overlay should show
    this.checkMinWidthOverlay();

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

    const wasTwoColumn = this.isTwoColumn;
    const wasOneColumn = this.isOneColumn;
    this.updateLayoutMode();

    // Only re-render if layout mode changed
    if (wasTwoColumn !== this.isTwoColumn || wasOneColumn !== this.isOneColumn) {
      // Save open folder states
      const openFolders = new Set();
      document.querySelectorAll('details[open]').forEach(details => {
        const summary = details.querySelector('summary');
        if (summary) {
          openFolders.add(summary.textContent.trim());
        }
      });

      // Re-render dashboard
      this.renderers.dashboard.render(
        this.getColumnConfig(),
        (med, element) => this.controllers.cart.toggle(med, element)
      );

      // Restore open folder states
      document.querySelectorAll('details').forEach(details => {
        const summary = details.querySelector('summary');
        if (summary && openFolders.has(summary.textContent.trim())) {
          details.open = true;
        }
      });

      // Update cart indicators
      this.renderers.cart.updateSelectedIndicators();
    }
  }

  updateSearchPlaceholder() {
    const searchInput = Utils.getElement("searchInput");
    if (searchInput) {
      const isOwner = this.managers.provider.isOwner();
      if (Utils.isMobile()) {
        searchInput.placeholder = isOwner
          ? "Search indication or med"
          : "Search med (e.g. keflex 5d)";
      } else {
        searchInput.placeholder = isOwner
          ? "Search indication (e.g. ped otitis media) or med (e.g. keflex 5d)"
          : "Search med (e.g. keflex 5d)";
      }
    }
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
    // Re-render dashboard (indications visibility + sort order)
    this.renderers.dashboard.render(
      this.getColumnConfig(),
      (med, element) => this.controllers.cart.toggle(med, element)
    );
    this.renderers.cart.updateSelectedIndicators();

    // Refresh search results if search is active
    const searchInput = Utils.getElement("searchInput");
    if (searchInput && searchInput.value.trim()) {
      this.controllers.search.search(searchInput.value);
    }

    // Update search placeholder
    this.updateSearchPlaceholder();
  }

  focus() {
    // Skip auto-focus on mobile to avoid triggering the keyboard on load
    if (Utils.isMobile()) return;
    // Focus search input for immediate use
    Utils.safeFocus("searchInput");
  }
}

// ============================================================================
// START APPLICATION
// ============================================================================

(async function bootstrap() {
  const app = new Application();
  await app.initialize();
  
  // Expose app globally for debugging
  window.app = app;
})();
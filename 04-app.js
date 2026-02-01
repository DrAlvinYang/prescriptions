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
    this.TWO_COLUMN_BREAKPOINT = 1180;
  }

  async initialize() {
    try {
      await this.initializeCore();
      this.initializeRenderers();
      await this.loadData(); // Load data BEFORE controllers/listeners to avoid race conditions
      this.initializeControllers();
      this.setupEventListeners();
      this.setupGlobalActions();
      this.render();
      this.focus();
      
      console.log("✓ Application initialized successfully");
    } catch (error) {
      console.error("Failed to initialize application:", error);
      
      // Show user-friendly error message
      const errorMsg = error.message || "An unknown error occurred";
      alert(`Failed to load application.\n\n${errorMsg}\n\nPlease refresh the page or contact support if the problem persists.`);
      
      // Show error state in UI instead of blank page
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#f4f6f8;font-family:sans-serif;">
          <div style="background:white;padding:30px;border-radius:8px;max-width:500px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color:#d32f2f;margin-top:0;">⚠️ Application Error</h2>
            <p style="color:#666;line-height:1.6;">${errorMsg}</p>
            <p style="color:#666;line-height:1.6;">Please try:</p>
            <ul style="color:#666;line-height:1.8;">
              <li>Refreshing the page</li>
              <li>Clearing your browser cache</li>
              <li>Checking your internet connection</li>
              <li>Ensuring Prescriptions.json is in the same directory</li>
            </ul>
            <button onclick="location.reload()" style="background:#0056b3;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:14px;">
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
    
    // Create managers
    this.managers.location = new LocationManager(this.state);
    this.managers.provider = new ProviderManager();
    this.managers.data = new DataLoader();
    this.managers.modal = new ModalManager(this.state);
    
    // Load locations (now async to load from JSON)
    await this.managers.location.load();
    
    // Load provider from localStorage
    this.managers.provider.load();
    
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
      this.managers.modal
    );

    this.controllers.search = new SearchController(
      this.state,
      this.renderers.search,
      this.controllers.cart
    );

    this.controllers.location = new LocationController(
      this.managers.location,
      this.renderers.location,
      this.managers.modal
    );

    this.controllers.provider = new ProviderController(
      this.managers.provider,
      this.renderers.provider,
      this.managers.modal
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

    // Expose globally for onclick handlers
    window.cartController = this.controllers.cart;
    window.locationController = this.controllers.location;
    window.providerController = this.controllers.provider;
    window.printController = this.controllers.print;
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
  }

  setupResizeListener() {
    // Debounce resize handler for performance
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 100);
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

    // Helper function to sanitize weight input - only allow valid numeric characters
    const sanitizeWeightInput = (value) => {
      // Remove all characters except digits and decimal point
      let sanitized = value.replace(/[^0-9.]/g, '');

      // Handle multiple decimal points - keep only the first one
      const parts = sanitized.split('.');
      if (parts.length > 2) {
        sanitized = parts[0] + '.' + parts.slice(1).join('');
      }

      return sanitized;
    };

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
      const sanitized = sanitizeWeightInput(e.target.value);
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

    // Helper function to sanitize weight input - only allow valid numeric characters
    const sanitizeWeightInput = (value) => {
      // Remove all characters except digits and decimal point
      let sanitized = value.replace(/[^0-9.]/g, '');

      // Handle multiple decimal points - keep only the first one
      const parts = sanitized.split('.');
      if (parts.length > 2) {
        sanitized = parts[0] + '.' + parts.slice(1).join('');
      }

      return sanitized;
    };

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
        const sanitized = sanitizeWeightInput(e.target.value);
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
        this.managers.modal.saveAddNewMed((med) => {
          this.controllers.cart.add(med);
        });
        this.controllers.cart.render();
      });

      cancelAddBtn.addEventListener("click", () => {
        this.managers.modal.closeAddNewMed();
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
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const weightModal = Utils.getElement("weightModal");
        const editModal = Utils.getElement("editModal");
        const addNewMedModal = Utils.getElement("addNewMedModal");
        const locationModal = Utils.getElement("locationModal");
        const providerDropdown = Utils.getElement("providerEditDropdown");

        // Skip weight modal - handled by KeyboardController with quick-print support
        if (weightModal && !weightModal.classList.contains("hidden")) {
          return;
        }

        // Close whichever modal is currently open
        if (editModal && !editModal.classList.contains("hidden")) {
          this.managers.modal.closeEdit();
        } else if (addNewMedModal && !addNewMedModal.classList.contains("hidden")) {
          this.managers.modal.closeAddNewMed();
        } else if (locationModal && !locationModal.classList.contains("hidden")) {
          this.managers.modal.closeLocation();
        } else if (providerDropdown && !providerDropdown.classList.contains("hidden")) {
          this.managers.modal.closeProvider();
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

    setupModalClickOutside("weightModal", () => {
      // During quick-print mode, clicking outside weight modal does nothing
      if (this.state.isQuickPrintMode) return;
      this.managers.modal.closeWeight();
    });
    setupModalClickOutside("editModal", () => this.managers.modal.closeEdit());
    setupModalClickOutside("addNewMedModal", () => this.managers.modal.closeAddNewMed());
    setupModalClickOutside("locationModal", () => this.managers.modal.closeLocation());

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
      const dropdown = document.getElementById("locationSearchDropdown");
      
      if (locationWrapper && !locationWrapper.contains(e.target)) {
        this.controllers.location.exitSearchMode();
      }
    });

    // Remove the old location menu close handler since we're using a new approach
    // The old locationMenu element is no longer used
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

  setupGlobalActions() {
    // These are called from onclick in HTML
    window.removeFromCartById = (uid) => {
      this.controllers.cart.remove(uid);
    };

    window.openEditModal = (uid) => {
      this.managers.modal.openEdit(uid);
    };

    window.saveEdit = () => {
      this.managers.modal.saveEdit();
      this.controllers.cart.render();
    };

    window.closeEditModal = () => {
      this.managers.modal.closeEdit();
    };

    window.printCart = () => {
      this.controllers.print.print();
    };

    window.clearCart = () => {
      this.controllers.cart.clear();
    };
  }

  async loadData() {
    this.state.medications = await this.managers.data.loadMedications();
    
    if (this.state.medications.length === 0) {
      console.error("No medications loaded - medication data file may be missing or invalid");
      throw new Error("Failed to load medication data. Please check that Prescriptions.json exists and is valid.");
    }
    
    console.log(`✓ Loaded ${this.state.medications.length} medications`);

    // Create SearchManager now that medications are loaded
    this.managers.search = new SearchManager(this.state.medications);
    
    // Update the search renderer with the SearchManager
    this.renderers.search.setSearchManager(this.managers.search);
  }

  render() {
    // Check current layout mode
    this.isTwoColumn = window.innerWidth <= this.TWO_COLUMN_BREAKPOINT;

    // Render dashboard based on layout mode
    if (this.isTwoColumn) {
      // Two columns: consolidated layout for narrower screens
      this.renderers.dashboard.render(
        {
          col1: SPECIALTY_2_COLUMNS.col1,
          col2: SPECIALTY_2_COLUMNS.col2,
          col3: []
        },
        (med, element) => this.controllers.cart.toggle(med, element)
      );
    } else {
      // Three columns: original layout
      this.renderers.dashboard.render(
        {
          col1: SPECIALTY_COLUMNS.col1,
          col2: SPECIALTY_COLUMNS.col2,
          col3: SPECIALTY_COLUMNS.col3
        },
        (med, element) => this.controllers.cart.toggle(med, element)
      );
    }

    // Render initial cart
    this.controllers.cart.render();
  }

  handleResize() {
    const wasTwoColumn = this.isTwoColumn;
    this.isTwoColumn = window.innerWidth <= this.TWO_COLUMN_BREAKPOINT;

    // Only re-render if layout mode changed
    if (wasTwoColumn !== this.isTwoColumn) {
      // Save open folder states
      const openFolders = new Set();
      document.querySelectorAll('details[open]').forEach(details => {
        const summary = details.querySelector('summary');
        if (summary) {
          openFolders.add(summary.textContent.trim());
        }
      });

      // Re-render dashboard
      if (this.isTwoColumn) {
        this.renderers.dashboard.render(
          {
            col1: SPECIALTY_2_COLUMNS.col1,
            col2: SPECIALTY_2_COLUMNS.col2,
            col3: []
          },
          (med, element) => this.controllers.cart.toggle(med, element)
        );
      } else {
        this.renderers.dashboard.render(
          {
            col1: SPECIALTY_COLUMNS.col1,
            col2: SPECIALTY_COLUMNS.col2,
            col3: SPECIALTY_COLUMNS.col3
          },
          (med, element) => this.controllers.cart.toggle(med, element)
        );
      }

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

  focus() {
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
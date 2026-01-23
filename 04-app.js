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
      this.initializeControllers();
      this.setupEventListeners();
      this.setupGlobalActions();
      await this.loadData();
      this.render();
      this.focus();
      
      console.log("✓ Application initialized successfully");
    } catch (error) {
      console.error("Failed to initialize application:", error);
      alert("Failed to load application. Please refresh the page.");
    }
  }

  initializeCore() {
    // Create state
    this.state = new AppState();
    
    // Create managers
    this.managers.location = new LocationManager(this.state);
    this.managers.data = new DataLoader();
    this.managers.modal = new ModalManager(this.state);
    
    // Load locations
    this.managers.location.load();
    
    // Expose for global access
    window.appState = this.state;
    window.locationManager = this.managers.location;
    window.modalManager = this.managers.modal;
  }

  initializeRenderers() {
    const medRenderer = new MedicationRenderer(this.state);
    
    this.renderers = {
      medication: medRenderer,
      dashboard: new DashboardRenderer(this.state, medRenderer),
      search: new SearchResultsRenderer(this.state, medRenderer),
      cart: new CartRenderer(this.state),
      location: new LocationUIRenderer(this.managers.location)
    };
    
    // Update location header
    this.renderers.location.updateHeader();
    
    // Expose cart renderer globally
    window.cartRenderer = this.renderers.cart;
  }

  initializeControllers() {
    this.controllers.cart = new CartController(
      this.state,
      this.renderers.cart,
      this.renderers.dashboard,
      this.renderers.search
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

    this.controllers.weight = new WeightController(
      this.state,
      this.renderers.cart
    );

    this.controllers.print = new PrintController(
      this.state,
      this.managers.location,
      this.controllers.weight
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
      this.controllers.print
    );

    // Link modal manager to cart controller
    this.controllers.cart.setModalManager(this.managers.modal);

    // Expose globally for onclick handlers
    window.cartController = this.controllers.cart;
    window.locationController = this.controllers.location;
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
    this.setupActionButtons();
    this.setupGlobalKeyboard();
  }

  setupSearchListeners() {
    const searchInput = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearSearchBtn");

    searchInput.value = "";
    
    searchInput.addEventListener("input", (e) => {
      this.controllers.search.search(e.target.value);
    });

    clearBtn.addEventListener("click", () => {
      this.controllers.search.clear();
    });
  }

  setupWeightListeners() {
    const weightInput = document.getElementById("weightInput");

    weightInput.value = "";

    // Real-time update
    weightInput.addEventListener("input", (e) => {
      this.controllers.weight.update(e.target.value);
    });

    // Format on blur/enter
    weightInput.addEventListener("change", (e) => {
      this.controllers.weight.format(e.target.value);
    });
  }

  setupModalListeners() {
    // Weight Modal
    const modalSaveBtn = document.getElementById("modalSaveBtn");
    const modalSkipBtn = document.getElementById("modalSkipBtn");
    const modalWeightInput = document.getElementById("modalWeightInput");

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
    });

    // Edit Modal
    const saveEditBtn = document.getElementById("saveEditBtn");
    const cancelEditBtn = document.getElementById("cancelEditBtn");

    saveEditBtn.addEventListener("click", () => {
      this.managers.modal.saveEdit();
      this.controllers.cart.render();
    });

    cancelEditBtn.addEventListener("click", () => {
      this.managers.modal.closeEdit();
    });

    // Location Modal
    const saveLocBtn = document.getElementById("saveLocBtn");
    const cancelLocBtn = document.getElementById("cancelLocBtn");
    const openAddLocationBtn = document.getElementById("openAddLocationBtn");

    saveLocBtn.addEventListener("click", () => {
      this.controllers.location.saveNewLocation();
    });

    cancelLocBtn.addEventListener("click", () => {
      this.managers.modal.closeLocation();
    });

    openAddLocationBtn.addEventListener("click", () => {
      this.controllers.location.openAddModal();
    });
  }

  setupLocationListeners() {
    const locationBtn = document.getElementById("locationBtn");
    const locationMenu = document.getElementById("locationMenu");

    locationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.controllers.location.toggleMenu();
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!locationMenu.contains(e.target) && !locationBtn.contains(e.target)) {
        locationMenu.classList.add("hidden");
      }
    });
  }

  setupActionButtons() {
    const printBtn = document.getElementById("printBtn");
    const clearCartBtn = document.getElementById("clearCartBtn");
    const resetViewBtn = document.getElementById("resetViewBtn");

    printBtn.addEventListener("click", () => {
      this.controllers.print.print();
    });

    clearCartBtn.addEventListener("click", () => {
      this.controllers.cart.clear();
    });

    resetViewBtn.addEventListener("click", () => {
      this.controllers.reset.reset();
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
      console.warn("No medications loaded");
    } else {
      console.log(`✓ Loaded ${this.state.medications.length} medications`);
    }
  }

  render() {
    // Render dashboard
    this.renderers.dashboard.render(
      {
        col1: SPECIALTY_COLUMNS.col1,
        col2: SPECIALTY_COLUMNS.col2,
        col3: SPECIALTY_COLUMNS.col3
      },
      (med, element) => this.controllers.cart.toggle(med, element)
    );

    // Render initial cart
    this.controllers.cart.render();
  }

  focus() {
    // Focus search input for immediate use
    document.getElementById("searchInput").focus();
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
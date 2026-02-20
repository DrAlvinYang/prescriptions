// ============================================================================
// CART CONTROLLER
// ============================================================================

class CartController {
  constructor(state, cartRenderer, dashboardRenderer, searchRenderer, modalManager, providerManager, locationManager) {
    this.state = state;
    this.cartRenderer = cartRenderer;
    this.dashboardRenderer = dashboardRenderer;
    this.searchRenderer = searchRenderer;
    this.modalManager = modalManager;
    this.providerManager = providerManager;
    this.locationManager = locationManager;
    this.isCartDropdownOpen = false;
    this.pendingFlySource = null; // Source element for fly-to-cart animation
  }

  validateProviderLocation() {
    return ValidationUtils.validateProviderLocation(this.providerManager, this.locationManager);
  }

  toggle(medication, element = null) {
    // Clear keyboard highlights
    document.querySelectorAll("#searchResults .med-item").forEach(item => {
      item.classList.remove("is-active");
    });

    // Update active index if triggered from search
    if (element && !document.getElementById("searchView").classList.contains("hidden")) {
      const results = Array.from(document.querySelectorAll("#searchResults .med-item"));
      this.state.activeSearchIndex = results.indexOf(element);
      element.focus();
    }

    const templateKey = MedicationUtils.getCartKey(medication);
    const existingIndex = this.state.cart.findIndex(
      item => !item.wasEdited && MedicationUtils.getCartKey(item) === templateKey
    );

    if (existingIndex >= 0) {
      this.remove(this.state.cart[existingIndex].uid);
      return;
    }

    // Store source element for fly-to-cart animation
    if (element) {
      this.pendingFlySource = element;
    }

    if (medication.weight_based && this.state.currentWeight === null) {
      this.modalManager.openWeight(medication);
    } else {
      this.add(medication);
    }
  }

  async add(medication, sourceEl = null) {
    // Validate provider and location before adding
    if (!this.validateProviderLocation()) {
      this.pendingFlySource = null;
      return;
    }

    // Resolve fly animation source: explicit param > stored pending source
    const flySource = sourceEl || this.pendingFlySource;
    this.pendingFlySource = null;

    // Check for duplicate medication name - confirm before adding
    const dupName = this._findDuplicateName(medication);
    if (dupName) {
      const confirmed = await ConfirmModal.show(`${dupName} is already in your cart. Add anyway?`);
      if (!confirmed) return;
    }

    if (window.undoManager) {
      window.undoManager.snapshot(`added ${medication.med || 'item'}`);
    }
    this.state.addToCart(medication);
    this.render();

    // Trigger fly-to-cart animation if we have a source element
    if (flySource) {
      FlyToCart.animate(flySource);
    }
  }

  _findDuplicateName(medication) {
    const newName = (medication.med || '').toLowerCase().trim();
    if (!newName) return null;
    const match = this.state.cart.find(item =>
      (item.med || '').toLowerCase().trim() === newName
    );
    return match ? medication.med : null;
  }

  remove(uid) {
    if (window.undoManager) {
      const item = this.state.findCartItem(uid);
      window.undoManager.snapshot(`removed ${item?.med || 'item'}`);
    }
    this.state.removeFromCart(uid);
    this.render();
  }

  clear() {
    if (window.undoManager && this.state.cart.length > 0) {
      window.undoManager.snapshot(`cleared ${this.state.cart.length} item(s)`);
    }
    this.state.clearCart();
    this.render();
  }

  render() {
    this.cartRenderer.render(
      (uid) => this.remove(uid),
      (uid) => this.modalManager.openEdit(uid)
    );
    this.cartRenderer.updateSelectedIndicators();
  }

  // --- Cart Dropdown Methods ---

  openCartDropdown() {
    const overlay = document.getElementById("cartOverlay");
    const dropdown = document.getElementById("cartDropdown");
    const cartBtn = document.getElementById("cartBtn");
    const cartBtnWrapper = cartBtn ? cartBtn.closest(".cart-btn-wrapper") : null;

    if (!dropdown || !cartBtn) return;

    this.isCartDropdownOpen = true;

    if (!Utils.isMobile()) {
      // Desktop: position dropdown relative to cart button
      const btnRect = cartBtn.getBoundingClientRect();
      dropdown.style.right = (window.innerWidth - btnRect.right) + "px";
      dropdown.style.top = (btnRect.bottom + 4) + "px";

      // Keep cart button above overlay
      if (cartBtnWrapper) cartBtnWrapper.classList.add("dropdown-active");
      if (overlay) overlay.classList.remove("hidden");
    }
    // Mobile: CSS handles full-screen positioning, no overlay needed

    dropdown.classList.remove("hidden");

    // Re-render cart to ensure up-to-date
    this.render();
  }

  closeCartDropdown() {
    const overlay = document.getElementById("cartOverlay");
    const dropdown = document.getElementById("cartDropdown");
    const cartBtnWrapper = document.querySelector(".cart-btn-wrapper");

    if (overlay) overlay.classList.add("hidden");
    if (dropdown) {
      dropdown.classList.add("hidden");
      // Clear inline position styles (set by desktop positioning)
      dropdown.style.right = "";
      dropdown.style.top = "";
    }
    if (cartBtnWrapper) cartBtnWrapper.classList.remove("dropdown-active");

    this.isCartDropdownOpen = false;
  }

  toggleCartDropdown() {
    if (this.isCartDropdownOpen) {
      this.closeCartDropdown();
    } else {
      this.openCartDropdown();
    }
  }
}

// ============================================================================
// SEARCH CONTROLLER
// ============================================================================

class SearchController {
  constructor(state, searchRenderer, cartController, cartRenderer) {
    this.state = state;
    this.searchRenderer = searchRenderer;
    this.cartController = cartController;
    this.cartRenderer = cartRenderer;
  }

  search(query) {
    // Reset active index when search changes to prevent out-of-bounds issues
    this.state.activeSearchIndex = -1;

    // Hide enter hint
    const enterHint = document.getElementById("searchEnterHint");
    if (enterHint) {
      enterHint.classList.remove("visible");
    }

    this.searchRenderer.render(
      query,
      (med, element) => this.cartController.toggle(med, element)
    );

    // Sync cart state to newly rendered search results
    // This ensures in-cart items show the Remove button and in-cart styling
    if (this.cartRenderer) {
      this.cartRenderer.updateSelectedIndicators();
    }

    const clearBtn = Utils.getElement("clearSearchBtn");
    if (clearBtn) {
      if (query.trim().length > 0) {
        clearBtn.classList.add("visible");
      } else {
        clearBtn.classList.remove("visible");
      }
    }
  }

  clear() {
    // Shell manages the shared search input; just clear Rx search state
    this.search("");
    Utils.safeRemoveClass("clearSearchBtn", "visible");
  }

  navigateResults(direction) {
    const searchView = Utils.getElement("searchView");
    if (!searchView || searchView.classList.contains("hidden")) return;

    const results = Utils.queryElements("#searchResults .med-item");
    if (results.length === 0) return;

    if (direction === "down") {
      this.state.activeSearchIndex = Math.min(
        this.state.activeSearchIndex + 1,
        results.length - 1
      );
    } else if (direction === "up") {
      this.state.activeSearchIndex = Math.max(
        this.state.activeSearchIndex - 1,
        0
      );
    }

    this.updateActiveItem(results, direction);
  }

  selectActiveResult() {
    const results = Utils.queryElements("#searchResults .med-item");

    // If no results, check for "Add new medication" button
    if (results.length === 0) {
      const addBtn = document.getElementById("addNewMedFromSearch");
      if (addBtn) {
        addBtn.click();
        return true;
      }
      return false;
    }

    // If focused on a med item, click it
    if (document.activeElement && document.activeElement.classList.contains("med-item")) {
      document.activeElement.click();
      return true;
    }

    // If only one result, auto-select it
    if (results.length === 1) {
      results[0].click();
      // Don't clear search here - if weight modal opened, we need to keep focus there
      // The search will be cleared naturally when user continues workflow
      return true;
    }

    // If an item is highlighted via keyboard
    if (this.state.activeSearchIndex >= 0 && results[this.state.activeSearchIndex]) {
      results[this.state.activeSearchIndex].click();
      return true;
    }

    return false;
  }

  updateActiveItem(results, direction = null) {
    const enterHint = document.getElementById("searchEnterHint");

    results.forEach((element, index) => {
      if (index === this.state.activeSearchIndex) {
        element.classList.add("is-active");
        // Prevent automatic scroll on focus to avoid flickering
        element.focus({ preventScroll: true });

        // Check if element is already visible in the viewport
        const container = document.querySelector(".content-scroll");
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const isFullyVisible =
          elementRect.top >= containerRect.top &&
          elementRect.bottom <= containerRect.bottom;

        const scrollOptions = {
          behavior: "auto" // Instant scroll for seamless item replacement
        };

        // Only use directional scrolling if element is not fully visible
        if (direction === "up" && !isFullyVisible) {
          scrollOptions.block = "start"; // Align to top when going up
        } else if (direction === "down" && !isFullyVisible) {
          scrollOptions.block = "end"; // Align to bottom when going down
        } else {
          scrollOptions.block = "nearest"; // Use nearest if already visible or no direction
        }

        element.scrollIntoView(scrollOptions);

        // Position and show enter hint
        if (enterHint) {
          const searchView = document.getElementById("searchView");
          const searchViewRect = searchView.getBoundingClientRect();
          const updatedElementRect = element.getBoundingClientRect();
          const topOffset = updatedElementRect.top - searchViewRect.top + (updatedElementRect.height / 2) - 10;
          enterHint.style.top = topOffset + "px";
          enterHint.classList.add("visible");
        }
      } else {
        element.classList.remove("is-active");
      }
    });

    // Hide enter hint if no active item
    if (this.state.activeSearchIndex < 0 && enterHint) {
      enterHint.classList.remove("visible");
    }
  }
}

// ============================================================================
// LOCATION CONTROLLER
// ============================================================================

class LocationController {
  constructor(locationManager, locationUIRenderer, modalManager) {
    this.locationManager = locationManager;
    this.locationUIRenderer = locationUIRenderer;
    this.modalManager = modalManager;
  }

  select(name) {
    this.locationManager.selectLocation(name);
    this.locationUIRenderer.updateHeader();
  }

  delete(name) {
    this.locationManager.deleteCustomLocation(name);
    this.locationUIRenderer.updateHeader();
  }

  toggleMenu() {
    this.locationUIRenderer.toggleMenu(
      (name) => this.select(name),
      (name) => this.delete(name),
      () => this.openAddModal()
    );
  }

  exitSearchMode() {
    this.locationUIRenderer.exitSearchMode();
  }

  openAddModal() {
    this.modalManager.openLocation();
  }

  saveNewLocation() {
    this.modalManager.saveLocation(this.locationManager, () => {
      this.locationUIRenderer.updateHeader();
    });
  }
}

// ============================================================================
// PROVIDER CONTROLLER
// ============================================================================

class ProviderController {
  constructor(providerManager, providerUIRenderer, modalManager, onProviderChange) {
    this.providerManager = providerManager;
    this.providerUIRenderer = providerUIRenderer;
    this.modalManager = modalManager;
    this.onProviderChange = onProviderChange;
  }

  openEditModal() {
    const currentProvider = this.providerManager.getProvider();
    this.modalManager.openProvider(currentProvider);
  }

  saveProvider() {
    this.modalManager.saveProvider(this.providerManager, () => {
      this.providerUIRenderer.updateHeader();
      if (this.onProviderChange) this.onProviderChange();
    });
  }
}

// ============================================================================
// WEIGHT CONTROLLER
// ============================================================================

class WeightController {
  constructor(state, cartController) {
    this.state = state;
    this.cartController = cartController;
  }

  update(value) {
    const parsed = parseFloat(value);
    this.state.setWeight(parsed);
    this.cartController.render();
  }

  format(value) {
    const formatted = Utils.formatWeight(value);
    const MAX_WEIGHT = 500;

    if (formatted) {
      const numValue = parseFloat(formatted);
      if (numValue > MAX_WEIGHT) {
        alert(`Weight cannot exceed ${MAX_WEIGHT} kg.`);
        document.getElementById("weightInput").value = "";
        this.state.setWeight(null);
      } else {
        document.getElementById("weightInput").value = formatted;
        this.state.setWeight(numValue);
      }
      this.cartController.render();
    }
  }
}

// ============================================================================
// KEYBOARD CONTROLLER
// ============================================================================

class KeyboardController {
  constructor(state, searchController, printController, locationController) {
    this.state = state;
    this.searchController = searchController;
    this.printController = printController;
    this.locationController = locationController;
  }

  handleGlobalKeydown(event) {
    // Gate: only handle keys when prescriptions page is active
    if (window.Shell && Shell.activePage !== 'prescriptions' && Shell.activeDesktopView !== 'prescriptions') return;

    // Block all keyboard shortcuts when cart dropdown is open (except Escape)
    if (window.cartController && window.cartController.isCartDropdownOpen) {
      // If a modal is open on top of the dropdown, let normal input through to the modal
      const editModal = document.getElementById("editModal");
      const addNewMedModal = document.getElementById("addNewMedModal");
      const searchEditModal = document.getElementById("searchEditModal");
      const modalOpen = (editModal && !editModal.classList.contains("hidden")) ||
                        (addNewMedModal && !addNewMedModal.classList.contains("hidden")) ||
                        (searchEditModal && !searchEditModal.classList.contains("hidden"));

      if (!modalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.cartController.closeCartDropdown();
          return;
        }
        // Allow Tab through for brand name display in cart
        if (event.key === "Tab") {
          // Fall through to Tab handler below
        }
        // Allow Ctrl/Cmd+P through for printing from cart
        else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
          // Fall through to print handler below
        } else {
          // Block everything else when only dropdown is open
          event.preventDefault();
          return;
        }
      }
      // Modal is open on top of dropdown - fall through to normal modal key handling
    }

    // Allow normal keyboard input in location search field (except special keys)
    const locationSearchInput = document.getElementById("locationSearchInput");
    if (locationSearchInput && document.activeElement === locationSearchInput) {
      // Only allow special keys like Escape, Enter, and Arrow keys to be handled
      // All other keys (including space) should work normally for typing
      const specialKeys = ["Escape", "Enter", "ArrowUp", "ArrowDown"];
      if (!specialKeys.includes(event.key)) {
        return; // Let the event proceed normally
      }
    }

    // Check if weight modal is open - if so, disable Tab completely
    const weightModal = document.getElementById("weightModal");
    if (weightModal && !weightModal.classList.contains("hidden") && event.key === "Tab") {
      event.preventDefault();
      return;
    }

    // Handle Tab key for brand name display (only when no modal is active)
    // Uses CSS class toggle for performance instead of full re-render
    if (event.key === "Tab") {
      const onlyCartOpen = this.isOnlyCartOpen();
      const anyModalOpen = this.isAnyModalOpen();

      if (!anyModalOpen) {
        event.preventDefault();

        if (!this.state.showingBrands) {
          this.state.showingBrands = true;
          document.body.classList.add("show-brands");

          // Set up keyup listener to hide brands when Tab is released
          const handleKeyUp = (e) => {
            if (e.key === "Tab") {
              this.state.showingBrands = false;
              document.body.classList.remove("show-brands");
              document.removeEventListener("keyup", handleKeyUp);
            }
          };

          document.addEventListener("keyup", handleKeyUp);
        }

        return;
      }

      // When only the cart is open, show brands inside the cart only
      if (onlyCartOpen) {
        event.preventDefault();
        const cartDropdown = document.querySelector(".cart-dropdown");

        if (!this.state.showingBrands && cartDropdown) {
          this.state.showingBrands = true;
          cartDropdown.classList.add("show-brands");

          const handleKeyUp = (e) => {
            if (e.key === "Tab") {
              this.state.showingBrands = false;
              cartDropdown.classList.remove("show-brands");
              document.removeEventListener("keyup", handleKeyUp);
            }
          };

          document.addEventListener("keyup", handleKeyUp);
        }

        return;
      }
    }

    // Cmd+F and "/" are handled by Shell globally

    // Cmd/Ctrl + Z: Undo last cart action (only when not in a text field)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        return; // Let native text undo work
      }
      event.preventDefault();
      if (window.undoManager && window.undoManager.canUndo) {
        const description = window.undoManager.undo();
        if (window.cartController) {
          window.cartController.render();
        }
        if (description) {
          ToastManager.show(`Undid: ${description}`);
        }
      }
      return;
    }

    // Cmd/Ctrl + P: Print
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.printController.print();
      return;
    }

    // Handle modal-specific keys
    if (this.handleModalKeys(event)) return;

    // Handle search navigation
    if (this.handleSearchKeys(event)) return;

    // Handle folder browse navigation (desktop only, no search active)
    if (this.handleBrowseKeydown(event)) return;
  }

  isAnyModalOpen() {
    const weightModal = document.getElementById("weightModal");
    const locationModal = document.getElementById("locationModal");
    const providerDropdown = document.getElementById("providerEditDropdown");
    const editModal = document.getElementById("editModal");
    const addNewMedModal = document.getElementById("addNewMedModal");
    const searchEditModal = document.getElementById("searchEditModal");
    const confirmModal = document.getElementById("confirmModal");

    return (
      !weightModal.classList.contains("hidden") ||
      !locationModal.classList.contains("hidden") ||
      !providerDropdown.classList.contains("hidden") ||
      !editModal.classList.contains("hidden") ||
      !addNewMedModal.classList.contains("hidden") ||
      !searchEditModal.classList.contains("hidden") ||
      (confirmModal && !confirmModal.classList.contains("hidden")) ||
      (window.cartController && window.cartController.isCartDropdownOpen)
    );
  }

  isOnlyCartOpen() {
    const weightModal = document.getElementById("weightModal");
    const locationModal = document.getElementById("locationModal");
    const providerDropdown = document.getElementById("providerEditDropdown");
    const editModal = document.getElementById("editModal");
    const addNewMedModal = document.getElementById("addNewMedModal");
    const searchEditModal = document.getElementById("searchEditModal");
    const confirmModal = document.getElementById("confirmModal");

    const anyRealModalOpen =
      !weightModal.classList.contains("hidden") ||
      !locationModal.classList.contains("hidden") ||
      !providerDropdown.classList.contains("hidden") ||
      !editModal.classList.contains("hidden") ||
      !addNewMedModal.classList.contains("hidden") ||
      !searchEditModal.classList.contains("hidden") ||
      (confirmModal && !confirmModal.classList.contains("hidden"));

    return !anyRealModalOpen && window.cartController && window.cartController.isCartDropdownOpen;
  }

  handleModalKeys(event) {
    const weightModal = document.getElementById("weightModal");
    const locationModal = document.getElementById("locationModal");
    const editModal = document.getElementById("editModal");
    const addNewMedModal = document.getElementById("addNewMedModal");
    const searchEditModal = document.getElementById("searchEditModal");

    // Edit Modal
    if (!editModal.classList.contains("hidden")) {
      return this.handleEditModalKeys(event);
    }

    // Add New Med Modal
    if (!addNewMedModal.classList.contains("hidden")) {
      return this.handleAddNewMedModalKeys(event);
    }

    // Search Edit Modal - Enter does nothing, Escape closes
    if (!searchEditModal.classList.contains("hidden")) {
      return this.handleSearchEditModalKeys(event);
    }

    // Escape key for all modals
    if (event.key === "Escape") {
      if (!weightModal.classList.contains("hidden")) {
        // Prevent other Escape handlers from also firing
        event.preventDefault();
        event.stopImmediatePropagation();
        window.modalManager.skipWeight((med) => window.cartController.add(med));
        return true;
      }
      if (!locationModal.classList.contains("hidden")) {
        window.modalManager.closeLocation();
        return true;
      }
    }

    // Enter in location modal
    if (!locationModal.classList.contains("hidden") && event.key === "Enter") {
      window.locationController.saveNewLocation();
      return true;
    }

    return false;
  }

  handleEditModalKeys(event) {
    // Tab navigation
    if (event.key === "Tab") {
      if (event.shiftKey) {
        event.preventDefault();
        return true;
      }

      if (!this.state.tabbingUnlocked) {
        event.preventDefault();
        return true;
      }

      if (document.activeElement.id === "editComments") {
        event.preventDefault();
        return true;
      }
    }

    // Enter to save (except in comments)
    if (event.key === "Enter" && document.activeElement.id !== "editComments") {
      event.preventDefault();
      window.modalManager.saveEdit();
      window.cartController.render();
      return true;
    }

    // Escape to cancel
    if (event.key === "Escape") {
      window.modalManager.closeEdit();
      return true;
    }

    return true;
  }

  handleAddNewMedModalKeys(event) {
    // Tab navigation
    if (event.key === "Tab") {
      if (event.shiftKey) {
        event.preventDefault();
        return true;
      }

      if (!this.state.tabbingUnlocked) {
        event.preventDefault();
        return true;
      }

      if (document.activeElement.id === "addComments") {
        event.preventDefault();
        return true;
      }
    }

    // Enter to save (except in comments)
    if (event.key === "Enter" && document.activeElement.id !== "addComments") {
      event.preventDefault();
      const modalBox = document.querySelector("#addNewMedModal .modal-box");
      window.modalManager.saveAddNewMed((med) => window.cartController.add(med, modalBox));
      window.cartController.render();
      return true;
    }

    // Escape to cancel
    if (event.key === "Escape") {
      window.modalManager.closeAddNewMed();
      return true;
    }

    return true;
  }

  handleSearchEditModalKeys(event) {
    // Prevent arrow key scrolling in background
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      return true;
    }

    // Escape to close
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.searchEditController.cancel();
      return true;
    }

    // Enter does nothing in search edit modal
    // Just consume the event to prevent default behavior
    if (event.key === "Enter") {
      event.preventDefault();
      return true;
    }

    return true;
  }

  handleBrowseKeydown(event) {
    // Only handle on desktop, when no search is active
    if (Utils.isMobile()) return false;
    const searchView = document.getElementById("searchView");
    if (searchView && !searchView.classList.contains("hidden")) return false;

    // Only arrow keys and Enter
    const validKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
    if (!validKeys.includes(event.key)) return false;

    // Don't handle if typing in an input
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return false;

    // Don't handle if any modal is open
    if (this.isAnyModalOpen()) return false;

    event.preventDefault();

    const nav = this.state.nav;
    const renderer = window.app?.renderers?.folder;
    if (!renderer) return false;

    const col = nav.activeColumn;

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const dir = event.key === "ArrowDown" ? 1 : -1;

      if (col === 1) {
        const items = document.querySelectorAll("#rx-population-list .rx-population-item");
        const newIndex = Math.max(0, Math.min(items.length - 1, nav.col1Index + dir));
        if (newIndex !== nav.col1Index) {
          nav.col1Index = newIndex;
          // Update keyboard focus indicator
          items.forEach((el, i) => el.classList.toggle("keyboard-focused", i === newIndex));
          // Select the population
          const popKey = items[newIndex]?.dataset.popKey;
          if (popKey) renderer.selectPopulation(popKey);
        }
      } else if (col === 2) {
        const items = document.querySelectorAll("#rx-specialty-list .rx-folder-item");
        const newIndex = Math.max(0, Math.min(items.length - 1, nav.col2Index + dir));
        if (newIndex !== nav.col2Index) {
          nav.col2Index = newIndex;
          renderer._highlightBrowseItem(newIndex);
        }
      } else if (col === 3) {
        const items = document.querySelectorAll("#rx-meds-list .rx-folder-item, #rx-meds-list .med-item");
        const newIndex = Math.max(0, Math.min(items.length - 1, nav.col3Index + dir));
        nav.col3Index = newIndex;
        // Scroll item into view and highlight
        items.forEach((el, i) => el.classList.toggle("browse-highlighted", i === newIndex));
        items[newIndex]?.scrollIntoView({ block: "nearest" });
      }
      return true;
    }

    if (event.key === "ArrowRight") {
      if (col === 1) {
        nav.activeColumn = 2;
        // Remove Column 1 keyboard focus
        document.querySelectorAll("#rx-population-list .keyboard-focused").forEach(el =>
          el.classList.remove("keyboard-focused")
        );
        renderer._highlightBrowseItem(nav.col2Index);
      } else if (col === 2) {
        const items = document.querySelectorAll("#rx-specialty-list .rx-folder-item");
        const item = items[nav.col2Index];
        const isNested = item?.querySelector(".rx-folder-item__arrow");

        if (isNested) {
          // Drill into subcategories
          const name = item.querySelector(".rx-folder-item__name")?.textContent;
          if (name && nav.navPath.length === 0) {
            nav.navPath = [name];
            nav.col2Index = 0;
            renderer.animateBrowse("forward", () => {
              renderer.renderBrowse();
            });
          }
        } else {
          // Move to Column 3 (meds)
          nav.activeColumn = 3;
          nav.col3Index = 0;
          const medItems = document.querySelectorAll("#rx-meds-list .rx-folder-item, #rx-meds-list .med-item");
          medItems.forEach((el, i) => el.classList.toggle("browse-highlighted", i === 0));
          medItems[0]?.scrollIntoView({ block: "nearest" });
        }
      }
      return true;
    }

    if (event.key === "ArrowLeft") {
      if (col === 3) {
        nav.activeColumn = 2;
        nav.col3Index = -1;
        // Remove Column 3 highlights
        document.querySelectorAll("#rx-meds-list .browse-highlighted").forEach(el =>
          el.classList.remove("browse-highlighted")
        );
        renderer._highlightBrowseItem(nav.col2Index);
      } else if (col === 2) {
        if (nav.navPath.length > 0) {
          // Go back up in browse
          renderer.navigateBack();
        } else {
          // Move to Column 1
          nav.activeColumn = 1;
          // Remove Column 2 highlights
          document.querySelectorAll("#rx-specialty-list .browse-highlighted").forEach(el =>
            el.classList.remove("browse-highlighted")
          );
          // Add keyboard focus to current population item
          const popItems = document.querySelectorAll("#rx-population-list .rx-population-item");
          popItems.forEach((el, i) => el.classList.toggle("keyboard-focused", i === nav.col1Index));
        }
      }
      return true;
    }

    if (event.key === "Enter") {
      if (col === 1) {
        nav.activeColumn = 2;
        document.querySelectorAll("#rx-population-list .keyboard-focused").forEach(el =>
          el.classList.remove("keyboard-focused")
        );
        renderer._highlightBrowseItem(nav.col2Index);
      } else if (col === 2) {
        const items = document.querySelectorAll("#rx-specialty-list .rx-folder-item");
        const item = items[nav.col2Index];
        if (item) item.click();
      } else if (col === 3) {
        const items = document.querySelectorAll("#rx-meds-list .rx-folder-item, #rx-meds-list .med-item");
        const item = items[nav.col3Index];
        if (item) {
          if (item.classList.contains("rx-folder-item")) {
            // Subfolder preview: glide
            item.click();
          } else {
            // Med item: quick-print
            item.click();
          }
        }
      }
      return true;
    }

    return false;
  }

  handleSearchKeys(event) {
    const searchView = document.getElementById("searchView");
    if (searchView.classList.contains("hidden")) return false;

    // Prevent search navigation when weight modal is active
    const weightModal = document.getElementById("weightModal");
    if (weightModal && !weightModal.classList.contains("hidden")) {
      return false;
    }

    // Prevent search navigation when search edit modal is active
    const searchEditModal = document.getElementById("searchEditModal");
    if (searchEditModal && !searchEditModal.classList.contains("hidden")) {
      return false;
    }

    // Prevent search navigation when location dropdown is active
    const locationWrapper = document.getElementById("locationWrapper");
    if (locationWrapper && locationWrapper.classList.contains("search-active")) {
      return false;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.searchController.navigateResults("down");
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.searchController.navigateResults("up");
      return true;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this.searchController.selectActiveResult();
      return true;
    }

    if (event.key === "Escape") {
      this.searchController.clear();
      return true;
    }

    // E key to edit highlighted result (only when med-item has focus, no modifiers)
    if (event.key.toLowerCase() === "e" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const activeItem = document.activeElement;
      if (activeItem && activeItem.classList.contains("med-item")) {
        event.preventDefault();
        const editBtn = activeItem.querySelector(".med-item-actions .med-action-btn-edit");
        if (editBtn) editBtn.click();
        return true;
      }
    }

    // A key to add highlighted result to cart (only when med-item has focus and NOT in cart)
    if (event.key.toLowerCase() === "a" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const activeItem = document.activeElement;
      if (activeItem && activeItem.classList.contains("med-item") && !activeItem.classList.contains("in-cart")) {
        event.preventDefault();
        const addBtn = activeItem.querySelector(".med-item-actions .med-action-btn-add");
        if (addBtn) addBtn.click();
        return true;
      }
    }

    // R key to remove highlighted result from cart (only when med-item has focus and IS in cart)
    if (event.key.toLowerCase() === "r" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const activeItem = document.activeElement;
      if (activeItem && activeItem.classList.contains("med-item") && activeItem.classList.contains("in-cart")) {
        event.preventDefault();
        const removeBtn = activeItem.querySelector(".med-item-actions .med-action-btn-add");
        if (removeBtn) removeBtn.click();
        return true;
      }
    }

    return false;
  }

}

// ============================================================================
// RESET CONTROLLER
// ============================================================================

class ResetController {
  constructor(state, cartController, searchController, weightController) {
    this.state = state;
    this.cartController = cartController;
    this.searchController = searchController;
    this.weightController = weightController;
  }

  reset() {
    // Reset state
    this.state.currentWeight = null;
    this.state.activeSearchIndex = -1;

    // Reset folder navigation state
    this.state.nav.population = "Adult";
    this.state.nav.navPath = [];
    this.state.nav.activeColumn = 2;
    this.state.nav.col1Index = 0;
    this.state.nav.col2Index = 0;
    this.state.nav.col3Index = -1;
    this.state.nav._flatSpecialty = false;

    // Clear inputs
    document.getElementById("weightInput").value = "";

    // Clear Rx search state
    this.searchController.search("");
    Utils.safeRemoveClass("clearSearchBtn", "visible");

    // Close cart dropdown if open
    this.cartController.closeCartDropdown();

    // Clear cart
    this.cartController.clear();

    // Clear undo stack
    if (window.undoManager) {
      window.undoManager.clear();
    }

    // On mobile: close all modals and return to dashboard view
    if (Utils.isMobile()) {
      document.body.classList.remove("has-search-query");

      // Close all mobile modals (provider, location, add-location, weight)
      if (window.app) {
        window.app._closeActiveMobileModal();
      }
    }

    // Shell handles clearing the shared search bar via resetViewBtn listener
  }
}


// ============================================================================
// PRINT CONTROLLER
// ============================================================================
// 
// ARCHITECTURE NOTE: This generates a PDF using jsPDF library for complete
// control over page layout. Each page explicitly includes the header, and
// prescriptions are never split across pages.
//
// This approach is 100% browser-agnostic - we control every pixel of the PDF.
//
// ============================================================================

class PrintController {
  constructor(state, locationManager, weightController, providerManager) {
    this.state = state;
    this.locationManager = locationManager;
    this.weightController = weightController;
    this.providerManager = providerManager;
  }

  // Helper: Disable all print buttons during print flow
  disableAllPrintButtons() {
    // Disable main cart print button
    const mainPrintBtn = document.getElementById("printBtn");
    if (mainPrintBtn) {
      mainPrintBtn.disabled = true;
    }

    // Disable all quick-print buttons in search results
    document.querySelectorAll(".med-action-btn-print").forEach(btn => {
      btn.disabled = true;
    });
  }

  // Helper: Re-enable all print buttons after print flow
  enableAllPrintButtons() {
    // Enable main cart print button
    const mainPrintBtn = document.getElementById("printBtn");
    if (mainPrintBtn) {
      mainPrintBtn.disabled = false;
    }

    // Enable all quick-print buttons in search results
    document.querySelectorAll(".med-action-btn-print").forEach(btn => {
      btn.disabled = false;
    });
  }

  print() {
    // Guard: Check if print already in progress
    if (this.state.isPrintInProgress) return;

    if (this.state.cart.length === 0) return;

    const provider = this.providerManager.getProvider();

    // Require provider info before printing
    if (!provider.name || !provider.cpso) {
      alert('Please set your provider information before printing.\n\nClick the "Set Provider" button in the top bar.');
      return;
    }

    // Set print in progress and disable all print buttons
    this.state.isPrintInProgress = true;
    this.disableAllPrintButtons();

    // Use shared print execution logic
    this.executePrint();
  }

  generatePDF(data) {
    // Load jsPDF dynamically if not already loaded
    if (typeof window.jspdf === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.integrity = 'sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==';
      script.crossOrigin = 'anonymous';
      script.onload = () => this.createAndOpenPDF(data);
      script.onerror = () => {
        alert('Failed to load PDF library. Please check your internet connection.');
        this.handlePrintFailure();
      };
      document.head.appendChild(script);
    } else {
      this.createAndOpenPDF(data);
    }
  }

  // Handle print failure - keep cart and weight intact, re-enable buttons
  handlePrintFailure() {
    this.state.isPrintInProgress = false;
    this.enableAllPrintButtons();
  }

  // Handle print success - clear cart, reset weight, re-enable buttons, close dropdown
  handlePrintSuccess() {
    // Clear cart and undo stack (no undoing after print)
    if (window.undoManager) {
      window.undoManager.clear();
    }
    this.state.clearCart();

    // Reset weight
    this.state.currentWeight = null;
    const weightInput = document.getElementById("weightInput");
    if (weightInput) {
      weightInput.value = "";
    }

    // Re-render cart to show empty state
    if (window.cartRenderer) {
      window.cartRenderer.render();
      window.cartRenderer.updateSelectedIndicators();
    }

    // Close cart dropdown if open
    if (window.cartController && window.cartController.isCartDropdownOpen) {
      window.cartController.closeCartDropdown();
    }

    // Re-enable print buttons
    this.state.isPrintInProgress = false;
    this.enableAllPrintButtons();
  }

  /**
   * Quick-print: Add medication to cart and print immediately
   * Flow:
   * 1. Validate provider is set
   * 2. If weight-based and no global weight, show weight modal (in quick-print mode)
   * 3. Add med to cart (if not already present)
   * 4. Print all cart items
   * 5. Clear cart and reset weight on success
   */
  quickPrint(medication) {
    // Guard: Check if print already in progress
    if (this.state.isPrintInProgress) return;

    // Guard: Check if weight modal is open
    const weightModal = document.getElementById("weightModal");
    if (weightModal && !weightModal.classList.contains("hidden")) return;

    const provider = this.providerManager.getProvider();

    // Validate provider is set
    if (!provider.name || !provider.cpso) {
      alert('Please set your provider information before printing.\n\nClick the "Set Provider" button in the top bar.');
      return;
    }

    // Disable all print buttons immediately
    this.state.isPrintInProgress = true;
    this.disableAllPrintButtons();

    // Check if medication is weight-based and no global weight is set
    if (medication.weight_based && this.state.currentWeight === null) {
      // Set quick-print mode and store callback
      this.state.isQuickPrintMode = true;
      this.state.quickPrintCallback = (med) => {
        this.addToCartAndPrint(med);
      };

      // Open weight modal - the modal will call the callback when done
      window.modalManager.openWeight(medication);
    } else {
      // Not weight-based or weight already set - proceed directly
      this.addToCartAndPrint(medication);
    }
  }

  /**
   * Helper: Add medication to cart (if not already present) and trigger print
   */
  async addToCartAndPrint(medication) {
    // Check if med is already in cart (based on cart key, excluding edited items)
    const templateKey = MedicationUtils.getCartKey(medication);
    const alreadyInCart = this.state.cart.some(
      item => !item.wasEdited && MedicationUtils.getCartKey(item) === templateKey
    );

    // Add to cart if not already present
    if (!alreadyInCart) {
      // Check for duplicate medication name - confirm before adding
      const newName = (medication.med || '').toLowerCase().trim();
      const hasDupe = newName && this.state.cart.some(item =>
        (item.med || '').toLowerCase().trim() === newName
      );
      if (hasDupe) {
        const confirmed = await ConfirmModal.show(`${medication.med} is already in your cart. Add anyway?`);
        if (!confirmed) {
          this.handlePrintFailure();
          this.state.isQuickPrintMode = false;
          this.state.quickPrintCallback = null;
          return;
        }
      }

      if (window.undoManager) {
        window.undoManager.snapshot(`added ${medication.med || 'item'}`);
      }
      this.state.addToCart(medication);
      // Re-render cart to show the new item
      if (window.cartRenderer) {
        window.cartRenderer.render();
        window.cartRenderer.updateSelectedIndicators();
      }
    }

    // Reset quick-print mode state
    this.state.isQuickPrintMode = false;
    this.state.quickPrintCallback = null;

    // Now trigger the actual print (which will clear cart on success)
    // Note: isPrintInProgress is already true, so we call the internal print logic directly
    this.executePrint();
  }

  /**
   * Internal print execution - called after cart is ready
   * Separated from print() to avoid double-checking guards
   */
  executePrint() {
    if (this.state.cart.length === 0) {
      this.handlePrintFailure();
      return;
    }

    const provider = this.providerManager.getProvider();
    const dateStr = new Date().toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const location = this.locationManager.getCurrentLocation();

    const payload = {
      prescriber: {
        name: provider.name,
        cpso: provider.cpso,
        address: location.address
      },
      dateStr,
      items: this.state.cart.map(med => {
        let dose = med.dose_text;

        // Recalculate dose if weight-based and not edited
        if (med.weight_based && this.state.currentWeight && !med.wasEdited) {
          const calc = MedicationUtils.calculateDose(med, this.state.currentWeight);
          if (calc) {
            // Strip HTML for PDF - extract just the text
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = calc.html;
            dose = tempDiv.textContent || tempDiv.innerText || calc.html;
          }
        }

        // Truncate comments to 1000 characters (safety enforcement)
        const comments = (med.comments || "").substring(0, 1000);

        return { ...med, dose_text: dose, comments };
      })
    };

    this.generatePDF(payload);
  }

  createAndOpenPDF(data) {
    const { jsPDF } = window.jspdf;
    
    const ROUTES = this.getRouteExpansions();
    const FREQS = this.getFrequencyExpansions();
    const TERMS = this.getTermExpansions();
    
    // Page setup: Letter size (8.5" x 11") with 0.5" margins
    // jsPDF uses points: 72 points = 1 inch
    const PAGE_WIDTH = 612;
    const PAGE_HEIGHT = 792;
    const MARGIN = 36; // 0.5 inch
    const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN);
    
    // Header dimensions
    const STICKER_WIDTH = 216; // 3 inches
    const STICKER_HEIGHT = 144; // 2 inches
    
    // Font sizes
    const FONT_TITLE = 14;
    const FONT_NORMAL = 11;
    const FONT_SMALL = 10;
    const FONT_META = 9;
    
    // Line heights
    const LINE_HEIGHT = 14;
    const ITEM_PADDING = 12;
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter'
    });
    
    // Helper: expand abbreviations
    const expand = (s, dict) => {
      if (!s) return "";
      const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
      let result = s;
      keys.forEach(key => {
        const regex = new RegExp("\\b" + key + "\\b", "gi");
        result = result.replace(regex, dict[key.toUpperCase()] || key);
      });
      return result;
    };
    
    // Helper: format duration
    const fmtDur = (d) => {
      if (!d) return "";
      const match = d.match(/^(\d+)\s*(d|day|wk|week|mo|mth|month|yr|year)s?$/i);
      if (match) {
        let num = match[1];
        let unit = match[2].toLowerCase();
        if (unit === 'd') unit = 'day';
        if (unit === 'wk') unit = 'week';
        if (unit.startsWith('mo') || unit.startsWith('mt')) unit = 'month';
        if (unit.startsWith('y')) unit = 'year';
        return "for " + num + " " + unit + (num == 1 ? '' : 's');
      }
      return d;
    };
    
    // Helper: wrap text and return array of lines
    const wrapText = (text, maxWidth, fontSize) => {
      pdf.setFontSize(fontSize);
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      words.forEach(word => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const testWidth = pdf.getTextWidth(testLine);
        
        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      });
      
      if (currentLine) {
        lines.push(currentLine);
      }
      
      return lines.length > 0 ? lines : [''];
    };
    
    // Draw header on current page, returns Y position after header
    const drawHeader = (startY) => {
      // Patient label box (left side)
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(1.5);
      pdf.rect(MARGIN, startY, STICKER_WIDTH, STICKER_HEIGHT);
      
      // "Patient Label" text centered in box
      pdf.setFontSize(FONT_SMALL);
      pdf.setTextColor(200, 200, 200);
      pdf.setFont('helvetica', 'normal');
      const labelText = "Patient Label";
      const labelWidth = pdf.getTextWidth(labelText);
      pdf.text(labelText, MARGIN + (STICKER_WIDTH - labelWidth) / 2, startY + STICKER_HEIGHT / 2 + 4);
      
      // Provider info (right side)
      pdf.setTextColor(0, 0, 0);
      const rightX = PAGE_WIDTH - MARGIN;
      let providerY = startY + 5;
      
      // Doctor name
      pdf.setFontSize(FONT_TITLE);
      pdf.setFont('helvetica', 'bold');
      const drName = "Dr. " + data.prescriber.name;
      pdf.text(drName, rightX, providerY + 12, { align: 'right' });
      providerY += 20;
      
      // CPSO
      pdf.setFontSize(FONT_SMALL);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      pdf.text("CPSO: " + data.prescriber.cpso, rightX, providerY + 10, { align: 'right' });
      providerY += 14;
      
      // Address (may wrap)
      const addressLines = wrapText(data.prescriber.address, 250, FONT_SMALL);
      addressLines.forEach(line => {
        pdf.text(line, rightX, providerY + 10, { align: 'right' });
        providerY += 12;
      });
      
      // Date
      providerY += 8;
      pdf.setTextColor(60, 60, 60);
      pdf.setFont('helvetica', 'bold');
      const dateLabel = "Date: ";
      const dateText = data.dateStr;
      pdf.text(dateLabel + dateText, rightX, providerY + 10, { align: 'right' });
      
      // Signature line (at bottom of header area)
      const sigY = startY + STICKER_HEIGHT - 5;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(FONT_SMALL);
      const sigLabel = "Signature:";
      const sigLabelWidth = pdf.getTextWidth(sigLabel);
      pdf.text(sigLabel, rightX - 155, sigY);
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(0, 0, 0);
      pdf.line(rightX - 150 + sigLabelWidth, sigY, rightX, sigY);
      
      // Divider line below header
      const dividerY = startY + STICKER_HEIGHT + 15;
      pdf.setLineWidth(2);
      pdf.setDrawColor(0, 0, 0);
      pdf.line(MARGIN, dividerY, PAGE_WIDTH - MARGIN, dividerY);
      
      return dividerY + 15;
    };
    
    // Calculate height needed for a prescription item
    const measureItem = (med) => {
      let height = ITEM_PADDING;
      height += LINE_HEIGHT + 4; // Title
      
      let dose = med.dose_text || "";
      let expandedDose = expand(dose, TERMS);
      let form = expand(med.form || "", TERMS);
      
      let formLower = form.toLowerCase();
      let doseLower = expandedDose.toLowerCase();
      let formSingular = formLower.endsWith('s') ? formLower.slice(0, -1) : formLower;
      
      let showForm = form && !doseLower.includes(formLower) && !doseLower.includes(formSingular) && !doseLower.includes("see instructions");
      
      let prnSuffix = "";
      if (med.prn) {
        prnSuffix = (med.frequency || "").toUpperCase() === "PRN" 
          ? "for " + med.prn 
          : "as needed for " + med.prn;
      }
      
      let sigParts = [
        expandedDose,
        showForm ? form : "",
        expand(med.route || "", ROUTES),
        expand(med.frequency || "", FREQS),
        prnSuffix,
        fmtDur(med.duration)
      ].filter(Boolean);
      
      let sig = sigParts.join(" ");
      let sigLines = wrapText(sig, CONTENT_WIDTH - 20, FONT_NORMAL);
      height += sigLines.length * LINE_HEIGHT;
      
      if (med.dispense || med.refill) {
        height += LINE_HEIGHT + 4;
      }
      
      if (med.comments) {
        let commentLines = wrapText("Note: " + med.comments, CONTENT_WIDTH - 20, FONT_META);
        height += 8 + (commentLines.length * (LINE_HEIGHT - 2));
      }
      
      height += ITEM_PADDING + 1;
      return height;
    };
    
    // Draw a prescription item, returns Y position after item
    const drawItem = (med, index, y) => {
      let currentY = y + ITEM_PADDING;
      
      // Title
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text((index + 1) + ". " + med.med, MARGIN, currentY + 10);
      currentY += LINE_HEIGHT + 4;
      
      // Build sig
      let dose = med.dose_text || "";
      let expandedDose = expand(dose, TERMS);
      let form = expand(med.form || "", TERMS);
      
      let formLower = form.toLowerCase();
      let doseLower = expandedDose.toLowerCase();
      let formSingular = formLower.endsWith('s') ? formLower.slice(0, -1) : formLower;
      
      let showForm = form && !doseLower.includes(formLower) && !doseLower.includes(formSingular) && !doseLower.includes("see instructions");
      
      let prnSuffix = "";
      if (med.prn) {
        prnSuffix = (med.frequency || "").toUpperCase() === "PRN" 
          ? "for " + med.prn 
          : "as needed for " + med.prn;
      }
      
      let sigParts = [
        expandedDose,
        showForm ? form : "",
        expand(med.route || "", ROUTES),
        expand(med.frequency || "", FREQS),
        prnSuffix,
        fmtDur(med.duration)
      ].filter(Boolean);
      
      let sig = sigParts.join(" ");
      
      // Sig text (indented)
      pdf.setFontSize(FONT_NORMAL);
      pdf.setFont('helvetica', 'normal');
      let sigLines = wrapText(sig, CONTENT_WIDTH - 20, FONT_NORMAL);
      sigLines.forEach(line => {
        pdf.text(line, MARGIN + 20, currentY + 10);
        currentY += LINE_HEIGHT;
      });
      
      // Meta (dispense, refills)
      if (med.dispense || med.refill) {
        currentY += 4;
        pdf.setFontSize(FONT_SMALL);
        pdf.setTextColor(80, 80, 80);
        
        let metaParts = [];
        if (med.dispense) metaParts.push("Dispense: " + med.dispense);
        if (med.refill) metaParts.push("Refills: " + med.refill);
        
        pdf.text(metaParts.join("   |   "), MARGIN + 20, currentY + 10);
        currentY += LINE_HEIGHT;
      }
      
      // Comments
      if (med.comments) {
        currentY += 8;
        pdf.setFontSize(FONT_META);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(80, 80, 80);
        
        let commentLines = wrapText("Note: " + med.comments, CONTENT_WIDTH - 20, FONT_META);
        commentLines.forEach(line => {
          pdf.text(line, MARGIN + 20, currentY + 8);
          currentY += LINE_HEIGHT - 2;
        });
      }
      
      currentY += ITEM_PADDING;
      
      // Bottom border
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN, currentY, PAGE_WIDTH - MARGIN, currentY);
      
      return currentY + 1;
    };
    
    // Main: paginate and render
    let y = MARGIN;
    const pageBottomY = PAGE_HEIGHT - MARGIN;
    
    // Draw header on first page
    y = drawHeader(y);
    
    // Process each item
    data.items.forEach((med, index) => {
      const itemHeight = measureItem(med);
      
      if (y + itemHeight > pageBottomY) {
        pdf.addPage();
        y = MARGIN;
        y = drawHeader(y);
      }
      
      y = drawItem(med, index, y);
    });
    
    // Get PDF as blob and open in new tab
    try {
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Open PDF in new tab - this works because we're in the main window context
      window.open(pdfUrl, '_blank');

      // Handle successful print
      this.handlePrintSuccess();
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Failed to generate PDF. Please try again.");
      this.handlePrintFailure();
    }
  }

  getRouteExpansions() {
    return {
      "PO": "orally", "IM": "intramuscularly", "IV": "intravenously",
      "SC": "subcutaneously", "SQ": "subcutaneously", "TOP": "topically",
      "PR": "rectally", "PV": "vaginally", "SL": "sublingually",
      "INH": "by inhalation", "NEB": "by nebulizer",
      "OU": "in both eyes", "OD": "in right eye", "OS": "in left eye",
      "AU": "in both ears", "AD": "in right ear", "AS": "in left ear",
      "NASAL": "intranasally", "VAG": "vaginally", "TD": "transdermally",
      "CHEWED": "chewed"
    };
  }

  getFrequencyExpansions() {
    return {
      "QD": "once daily", "OD": "once daily", "DAILY": "once daily",
      "BID": "twice daily", "TID": "three times daily", "QID": "four times daily",
      "QHS": "at bedtime", "QAM": "in the morning", "QPM": "in the evening",
      "Q4H": "every 4 hours", "Q6H": "every 6 hours", "Q8H": "every 8 hours",
      "Q12H": "every 12 hours", "Q2H": "every 2 hours", "Q5MINS": "every 5 minutes",
      "QMWF": "every Monday, Wednesday, and Friday", "PRN": "as needed"
    };
  }

  getTermExpansions() {
    return {
      "SUSP": "suspension", "SOLN": "solution", "TAB": "tablet",
      "CAP": "capsule", "CAPLT": "caplet", "OINT": "ointment",
      "CRM": "cream", "LOT": "lotion", "GTT": "drops",
      "INJ": "injection", "BTL": "bottle", "SUPP": "suppository",
      "PWDR": "powder", "MDI": "inhaler", "CAPT": "capsule",
      "CHEW": "chewable tablet", "EC TAB": "enteric-coated tablet",
      "ER TAB": "extended-release tablet", "DEV": "device"
    };
  }
}

// ============================================================================
// SEARCH EDIT CONTROLLER
// ============================================================================
// Handles the edit flow from search results:
// 1. Pre-validate provider/location
// 2. Handle weight-based medications (show weight modal first)
// 3. Open search edit modal
// 4. Handle Add to Cart (with duplicate detection)
// 5. Handle Print (add to cart, print all, clear cart)
// ============================================================================

class SearchEditController {
  constructor(state, modalManager, providerManager, locationManager, cartController, printController) {
    this.state = state;
    this.modalManager = modalManager;
    this.providerManager = providerManager;
    this.locationManager = locationManager;
    this.cartController = cartController;
    this.printController = printController;
  }

  validateProviderLocation() {
    return ValidationUtils.validateProviderLocation(this.providerManager, this.locationManager);
  }

  /**
   * Main entry point: Open edit modal for a medication from search results
   * Validates provider/location first, then handles weight-based medications
   */
  openEdit(medication) {
    // Step 1: Validate provider and location
    if (!this.validateProviderLocation()) {
      return;
    }

    // Step 2: Check if weight-based medication
    if (medication.weight_based) {
      // Store medication for after weight modal
      this.state.searchEditPendingMed = medication;

      // Set up callback for after weight modal completes
      this.state.isSearchEditMode = true;
      this.state.searchEditCallback = (med) => {
        this.openModalWithDose(med);
      };

      // Open weight modal
      this.modalManager.openWeight(medication);
    } else {
      // Not weight-based - open modal directly
      this.openModalWithDose(medication);
    }
  }

  /**
   * Open the search edit modal with the appropriate dose
   * Called after weight modal (if applicable)
   */
  openModalWithDose(medication) {
    let calculatedDose = null;

    // If weight-based and weight is available, calculate dose
    if (medication.weight_based && this.state.currentWeight) {
      const calc = MedicationUtils.calculateDose(medication, this.state.currentWeight);
      if (calc) {
        calculatedDose = `${calc.value} mg`;
      }
    } else if (medication.weight_based) {
      // No weight entered - show dose/kg
      if (medication.dose_per_kg_mg) {
        calculatedDose = `${medication.dose_per_kg_mg} mg/kg`;
      }
    }

    // Reset search edit mode flags
    this.state.isSearchEditMode = false;
    this.state.searchEditCallback = null;
    this.state.searchEditPendingMed = null;

    // Open the modal
    this.modalManager.openSearchEdit(medication, calculatedDose);
  }

  /**
   * Handle Add to Cart button click from search edit modal
   */
  async addToCart() {
    // Validate form
    const validation = this.modalManager.validateSearchEdit();
    if (!validation.valid) {
      alert(validation.message);
      return false;
    }

    // Get current form values
    const medValues = this.modalManager.getSearchEditValues();

    // Check for duplicates in cart
    if (DuplicateChecker.existsInCart(medValues, this.state.cart)) {
      alert("Exact same prescription already in cart.");
      return false;
    }

    // Check for duplicate medication name - confirm before adding
    const dupName = (medValues.med || '').trim();
    const hasDupe = dupName && this.state.cart.some(item =>
      (item.med || '').toLowerCase().trim() === dupName.toLowerCase()
    );
    if (hasDupe) {
      const confirmed = await ConfirmModal.show(`${dupName} is already in your cart. Add anyway?`);
      if (!confirmed) return false;
    }

    // Capture modal box rect before closing (modal will be hidden)
    const modalBox = document.querySelector("#searchEditModal .modal-box");

    // Add to cart
    if (window.undoManager) {
      window.undoManager.snapshot(`added ${medValues.med || 'item'}`);
    }
    this.state.addToCart(medValues);

    // Re-render cart
    this.cartController.render();

    // Trigger fly animation from search edit modal
    if (modalBox) {
      FlyToCart.animate(modalBox);
    }

    // Close modal
    this.modalManager.closeSearchEdit();

    return true;
  }

  /**
   * Handle Print button click from search edit modal
   * Adds medication to cart, prints all cart items, then clears cart
   */
  async print() {
    // Validate form
    const validation = this.modalManager.validateSearchEdit();
    if (!validation.valid) {
      alert(validation.message);
      return false;
    }

    // Get current form values
    const medValues = this.modalManager.getSearchEditValues();

    // Check for duplicates in cart
    if (DuplicateChecker.existsInCart(medValues, this.state.cart)) {
      alert("Exact same prescription already in cart.");
      return false;
    }

    // Check for duplicate medication name - confirm before adding
    const dupName = (medValues.med || '').trim();
    const hasDupe = dupName && this.state.cart.some(item =>
      (item.med || '').toLowerCase().trim() === dupName.toLowerCase()
    );
    if (hasDupe) {
      const confirmed = await ConfirmModal.show(`${dupName} is already in your cart. Add anyway?`);
      if (!confirmed) return false;
    }

    // Disable buttons during print
    this.modalManager.disableSearchEditButtons();

    // Add medication to cart
    if (window.undoManager) {
      window.undoManager.snapshot(`added ${medValues.med || 'item'}`);
    }
    this.state.addToCart(medValues);

    // Re-render cart to show the new item
    this.cartController.render();

    // Set print in progress
    this.state.isPrintInProgress = true;
    this.printController.disableAllPrintButtons();

    // Execute print
    this.printController.executePrint();

    // Close modal (print success/failure will handle cart clearing)
    this.modalManager.closeSearchEdit();

    return true;
  }

  /**
   * Handle Cancel button click from search edit modal
   */
  cancel() {
    this.modalManager.closeSearchEdit();
  }
}

// ============================================================================
// EXPORT FOR USE
// ============================================================================

window.CartController = CartController;
window.SearchController = SearchController;
window.LocationController = LocationController;
window.ProviderController = ProviderController;
window.WeightController = WeightController;
window.KeyboardController = KeyboardController;
window.ResetController = ResetController;
window.PrintController = PrintController;
window.SearchEditController = SearchEditController;
// ============================================================================
// CART CONTROLLER
// ============================================================================

class CartController {
  constructor(state, cartRenderer, dashboardRenderer, searchRenderer, modalManager) {
    this.state = state;
    this.cartRenderer = cartRenderer;
    this.dashboardRenderer = dashboardRenderer;
    this.searchRenderer = searchRenderer;
    this.modalManager = modalManager;
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

    if (medication.weight_based && this.state.currentWeight === null) {
      this.modalManager.openWeight(medication);
    } else {
      this.add(medication);
    }
  }

  add(medication) {
    this.state.addToCart(medication);
    this.render();
  }

  remove(uid) {
    this.state.removeFromCart(uid);
    this.render();
  }

  clear() {
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
}

// ============================================================================
// SEARCH CONTROLLER
// ============================================================================

class SearchController {
  constructor(state, searchRenderer, cartController) {
    this.state = state;
    this.searchRenderer = searchRenderer;
    this.cartController = cartController;
  }

  search(query) {
    // Reset active index when search changes to prevent out-of-bounds issues
    this.state.activeSearchIndex = -1;
    
    this.searchRenderer.render(
      query,
      (med, element) => this.cartController.toggle(med, element)
    );

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
    const searchInput = Utils.getElement("searchInput");
    if (searchInput) {
      searchInput.value = "";
    }
    
    this.search("");
    Utils.safeRemoveClass("clearSearchBtn", "visible");
    Utils.safeFocus("searchInput");
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
      } else {
        element.classList.remove("is-active");
      }
    });
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
  constructor(providerManager, providerUIRenderer, modalManager) {
    this.providerManager = providerManager;
    this.providerUIRenderer = providerUIRenderer;
    this.modalManager = modalManager;
  }

  openEditModal() {
    this.modalManager.openProvider();
  }

  saveProvider() {
    this.modalManager.saveProvider(this.providerManager, () => {
      this.providerUIRenderer.updateHeader();
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
    }

    // Cmd/Ctrl + F: Focus search
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();

      // Close location dropdown if open
      if (this.locationController) {
        this.locationController.exitSearchMode();
      }

      const searchInput = document.getElementById("searchInput");
      searchInput.focus();
      searchInput.select();
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

    // Handle location menu jump-to-letter
    this.handleLocationJump(event);
  }

  isAnyModalOpen() {
    const weightModal = document.getElementById("weightModal");
    const locationModal = document.getElementById("locationModal");
    const providerModal = document.getElementById("providerModal");
    const editModal = document.getElementById("editModal");
    const addNewMedModal = document.getElementById("addNewMedModal");
    
    return (
      !weightModal.classList.contains("hidden") ||
      !locationModal.classList.contains("hidden") ||
      !providerModal.classList.contains("hidden") ||
      !editModal.classList.contains("hidden") ||
      !addNewMedModal.classList.contains("hidden")
    );
  }

  reRenderAll() {
    // Save the state of all open folders before re-rendering
    const openFolders = new Set();
    document.querySelectorAll('details[open]').forEach(details => {
      // Create a unique identifier for this folder
      const summary = details.querySelector('summary');
      if (summary) {
        openFolders.add(summary.textContent.trim());
      }
    });
    
    // Save active search index - critical to save BEFORE calling search()
    const savedActiveSearchIndex = this.state.activeSearchIndex;
    
    // Re-render dashboard (respecting current layout mode)
    const isSingleColumn = window.innerWidth <= 1200;
    if (isSingleColumn) {
      window.app.renderers.dashboard.render(
        {
          col1: SPECIALTY_SINGLE_COLUMN,
          col2: [],
          col3: []
        },
        (med, element) => window.cartController.toggle(med, element)
      );
    } else {
      window.app.renderers.dashboard.render(
        {
          col1: SPECIALTY_COLUMNS.col1,
          col2: SPECIALTY_COLUMNS.col2,
          col3: SPECIALTY_COLUMNS.col3
        },
        (med, element) => window.cartController.toggle(med, element)
      );
    }
    
    // Restore open state for folders
    document.querySelectorAll('details').forEach(details => {
      const summary = details.querySelector('summary');
      if (summary && openFolders.has(summary.textContent.trim())) {
        details.open = true;
      }
    });
    
    // Re-render search results if search is active
    const searchInput = document.getElementById("searchInput");
    if (searchInput && searchInput.value.trim()) {
      // Call search() which will reset activeSearchIndex to -1
      this.searchController.search(searchInput.value);
      
      // Immediately restore the saved index
      this.state.activeSearchIndex = savedActiveSearchIndex;
      
      // Restore the active search item highlight if there was one
      // Use requestAnimationFrame to ensure DOM is fully updated
      if (savedActiveSearchIndex >= 0) {
        requestAnimationFrame(() => {
          const results = document.querySelectorAll("#searchResults .med-item");
          if (results.length > 0 && savedActiveSearchIndex < results.length) {
            results.forEach((element, index) => {
              if (index === savedActiveSearchIndex) {
                element.classList.add("is-active");
                element.scrollIntoView({ block: "nearest", behavior: "instant" });
              } else {
                element.classList.remove("is-active");
              }
            });
          }
        });
      }
    }
    
    // Re-render cart
    window.cartController.render();
  }

  handleModalKeys(event) {
    const weightModal = document.getElementById("weightModal");
    const locationModal = document.getElementById("locationModal");
    const editModal = document.getElementById("editModal");
    const addNewMedModal = document.getElementById("addNewMedModal");

    // Edit Modal
    if (!editModal.classList.contains("hidden")) {
      return this.handleEditModalKeys(event);
    }

    // Add New Med Modal
    if (!addNewMedModal.classList.contains("hidden")) {
      return this.handleAddNewMedModalKeys(event);
    }

    // Escape key for all modals
    if (event.key === "Escape") {
      if (!weightModal.classList.contains("hidden")) {
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
      window.modalManager.saveAddNewMed((med) => window.cartController.add(med));
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

  handleSearchKeys(event) {
    const searchView = document.getElementById("searchView");
    if (searchView.classList.contains("hidden")) return false;

    // Prevent search navigation when weight modal is active
    const weightModal = document.getElementById("weightModal");
    if (weightModal && !weightModal.classList.contains("hidden")) {
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

    return false;
  }

  handleLocationJump(event) {
    // Location dropdown now uses search mode - this handler is no longer needed
    // The search dropdown handles its own keyboard navigation
    return;
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
    // Close all details
    document.querySelectorAll("details").forEach(el => el.open = false);

    // Reset state
    this.state.currentWeight = null;
    this.state.activeSearchIndex = -1;

    // Clear inputs
    document.getElementById("weightInput").value = "";
    
    // Clear search
    this.searchController.clear();

    // Clear cart
    this.cartController.clear();

    // Focus search
    document.getElementById("searchInput").focus();
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

  print() {
    if (this.state.cart.length === 0) return;

    const provider = this.providerManager.getProvider();

    // Require provider info before printing
    if (!provider.name || !provider.cpso) {
      alert('Please set your provider information before printing.\n\nClick the "Set Provider" button in the top bar.');
      return;
    }

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

  generatePDF(data) {
    // Load jsPDF dynamically if not already loaded
    if (typeof window.jspdf === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.integrity = 'sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==';
      script.crossOrigin = 'anonymous';
      script.onload = () => this.createAndOpenPDF(data);
      script.onerror = () => alert('Failed to load PDF library. Please check your internet connection.');
      document.head.appendChild(script);
    } else {
      this.createAndOpenPDF(data);
    }
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
    const pdfBlob = pdf.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Open PDF in new tab - this works because we're in the main window context
    window.open(pdfUrl, '_blank');
    
    // Reset weight after generating
    this.state.currentWeight = null;
    const weightInput = document.getElementById("weightInput");
    if (weightInput) {
      weightInput.value = "";
    }
    if (window.cartRenderer) {
      window.cartRenderer.render();
    }
  }

  buildPDFGeneratorHTML(data) {
    // This method is no longer used but kept for reference
    return '';
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
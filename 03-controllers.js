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

    this.updateActiveItem(results);
  }

  selectActiveResult() {
    const results = Utils.queryElements("#searchResults .med-item");
    
    // If focused on a med item, click it
    if (document.activeElement && document.activeElement.classList.contains("med-item")) {
      document.activeElement.click();
      return true;
    }
    
    // If only one result, auto-select it
    if (results.length === 1) {
      results[0].click();
      this.clear(); // Clear search after selection
      return true;
    }
    
    // If an item is highlighted via keyboard
    if (this.state.activeSearchIndex >= 0 && results[this.state.activeSearchIndex]) {
      results[this.state.activeSearchIndex].click();
      return true;
    }

    return false;
  }

  updateActiveItem(results) {
    results.forEach((element, index) => {
      if (index === this.state.activeSearchIndex) {
        element.classList.add("is-active");
        element.focus();
        element.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
    document.getElementById("locationMenu").classList.add("hidden");
  }

  delete(name) {
    this.locationManager.deleteCustomLocation(name);
    this.locationUIRenderer.updateHeader();
    this.locationUIRenderer.renderDropdown(
      (name) => this.select(name),
      (name) => this.delete(name)
    );
  }

  toggleMenu() {
    this.locationUIRenderer.toggleMenu(
      (name) => this.select(name),
      (name) => this.delete(name)
    );
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
    if (formatted) {
      document.getElementById("weightInput").value = formatted;
      this.state.setWeight(parseFloat(formatted));
      this.cartController.render();
    }
  }
}

// ============================================================================
// KEYBOARD CONTROLLER
// ============================================================================

class KeyboardController {
  constructor(state, searchController, printController) {
    this.state = state;
    this.searchController = searchController;
    this.printController = printController;
  }

  handleGlobalKeydown(event) {
    // Handle Tab key for brand name display (only when no modal is active)
    if (event.key === "Tab") {
      const anyModalOpen = this.isAnyModalOpen();
      
      if (!anyModalOpen) {
        event.preventDefault();
        
        if (!this.state.showingBrands) {
          this.state.showingBrands = true;
          this.reRenderAll();
          
          // Set up keyup listener to restore generic names when Tab is released
          const handleKeyUp = (e) => {
            if (e.key === "Tab") {
              this.state.showingBrands = false;
              this.reRenderAll(); // This will preserve the highlight using the same logic
              document.removeEventListener("keyup", handleKeyUp);
            }
          };
          
          // Bind the context properly using arrow function (already done above)
          document.addEventListener("keyup", handleKeyUp);
        }
        
        return;
      }
    }
    
    // Cmd/Ctrl + F: Focus search
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
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
    
    return (
      !weightModal.classList.contains("hidden") ||
      !locationModal.classList.contains("hidden") ||
      !providerModal.classList.contains("hidden") ||
      !editModal.classList.contains("hidden")
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
    
    // Re-render dashboard
    window.app.renderers.dashboard.render(
      {
        col1: SPECIALTY_COLUMNS.col1,
        col2: SPECIALTY_COLUMNS.col2,
        col3: SPECIALTY_COLUMNS.col3
      },
      (med, element) => window.cartController.toggle(med, element)
    );
    
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

    // Edit Modal
    if (!editModal.classList.contains("hidden")) {
      return this.handleEditModalKeys(event);
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

  handleSearchKeys(event) {
    const searchView = document.getElementById("searchView");
    if (searchView.classList.contains("hidden")) return false;

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
    const locationMenu = document.getElementById("locationMenu");
    
    if (locationMenu.classList.contains("hidden")) return;
    if (event.key.length !== 1 || !event.key.match(/[a-z]/i)) return;

    event.preventDefault();
    
    const char = event.key.toLowerCase();
    const items = document.querySelectorAll("#locationList .loc-item");

    for (let item of items) {
      const name = item.querySelector(".loc-name").textContent.trim().toLowerCase();
      if (name.startsWith(char)) {
        item.scrollIntoView({ block: "start", behavior: "auto" });
        break;
      }
    }
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

class PrintController {
  constructor(state, locationManager, weightController, providerManager) {
    this.state = state;
    this.locationManager = locationManager;
    this.weightController = weightController;
    this.providerManager = providerManager;
  }

  print() {
    if (this.state.cart.length === 0) return;

    const dateStr = new Date().toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const location = this.locationManager.getCurrentLocation();
    const provider = this.providerManager.getProvider();

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
            dose = calc.html;
          }
        }

        // Truncate comments to 1000 characters (safety enforcement)
        const comments = (med.comments || "").substring(0, 1000);

        return { ...med, dose_text: dose, comments };
      })
    };

    this.generatePrintDocument(payload);
  }

  generatePrintDocument(data) {
    const html = this.buildPrintHTML(data);

    let frame = document.getElementById('printFrame');
    if (frame) frame.remove();

    frame = document.createElement('iframe');
    frame.id = 'printFrame';
    frame.style.display = 'none';
    document.body.appendChild(frame);

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  }

  buildPrintHTML(data) {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Print</title>
  ${this.getPrintStyles()}
</head>
<body>
  <div id="print-content"></div>
  ${this.getPrintScript(data)}
</body>
</html>`;
  }

  getPrintStyles() {
    return `<style>
    @page { 
      size: letter; 
      margin: 0.5in;
    }
    
    * { box-sizing: border-box; }
    body { 
      margin: 0; padding: 0; 
      font-family: -apple-system, sans-serif; 
      font-size: 11pt; color: #000; background: #fff; 
    }
    
    .print-page {
      width: 7.5in;
      min-height: 10in;
      max-height: 10in;
      overflow: hidden;
      page-break-after: always;
      position: relative;
    }
    
    .print-page:last-child {
      page-break-after: auto;
    }
    
    .page-header { 
      margin-bottom: 15px;
    }
    
    .header-wrapper { 
      display: flex; justify-content: space-between; 
      align-items: flex-start; padding-bottom: 15px; 
      margin-bottom: 10px; border-bottom: 3px solid #000; 
    }
    .sticker-box { 
      width: 3in; height: 2in; border: 2px solid #ccc; 
      display: flex; align-items: center; justify-content: center; 
      color: #ccc; font-size: 10pt; 
    }
    .provider-col { 
      text-align: right; width: 3.5in; 
      display: flex; flex-direction: column; 
      justify-content: space-between; height: 2in; 
    }
    .provider-name { font-weight: 700; font-size: 14pt; margin-bottom: 4px; }
    .provider-meta { font-size: 10pt; color: #333; }
    .sig-area { margin-top: auto; display: flex; flex-direction: column; align-items: flex-end; }
    .sig-line-wrap { display: flex; align-items: baseline; gap: 10px; width: 100%; justify-content: flex-end; }
    .sig-rule { border-bottom: 1px solid #000; width: 200px; height: 1px; }
    
    .rx-item { 
      padding: 12px 0; 
      border-bottom: 1px solid #ddd; 
    }
    .rx-title { font-weight: 700; font-size: 12pt; margin-bottom: 4px; }
    .rx-details { margin-left: 20px; line-height: 1.4; }
    .rx-meta { margin-top: 6px; font-size: 10pt; color: #444; }
    .rx-comments { 
      margin-top: 8px; font-style: italic; 
      background: #f4f4f4; padding: 6px 10px; 
      border-radius: 6px; display: inline-block;
      max-width: 100%;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    /* Hidden measurement container */
    .measure-container {
      position: absolute;
      visibility: hidden;
      width: 7.5in;
    }
  </style>`;
  }

  getPrintScript(data) {
    return `<script>
    try {
      const DATA = ${JSON.stringify(data)};
      const ROUTES = ${JSON.stringify(this.getRouteExpansions())};
      const FREQS = ${JSON.stringify(this.getFrequencyExpansions())};
      const TERMS = ${JSON.stringify(this.getTermExpansions())};
      
      // Page dimensions in pixels (at 96 DPI)
      // Letter size: 8.5" x 11" with 0.5" margins = 7.5" x 10" usable
      const PAGE_HEIGHT_PX = 10 * 96; // 960px usable height
      const HEADER_HEIGHT_PX = 220;   // Approximate header height (sticker box + provider info + border)
      const CONTENT_AREA_PX = PAGE_HEIGHT_PX - HEADER_HEIGHT_PX - 20; // 20px safety buffer
      
      ${this.getPrintFunctions()}
      
      // Create measurement container
      const measureDiv = document.createElement('div');
      measureDiv.className = 'measure-container';
      document.body.appendChild(measureDiv);
      
      // Pre-render all items to measure their heights
      const itemHeights = [];
      DATA.items.forEach((m, i) => {
        const itemHtml = getItem(m, i);
        measureDiv.innerHTML = itemHtml;
        const height = measureDiv.firstElementChild.offsetHeight;
        itemHeights.push(height);
      });
      
      // Remove measurement container
      measureDiv.remove();
      
      // Build pages with dynamic height calculation
      const pages = [];
      let currentPage = { items: [], usedHeight: 0 };
      
      DATA.items.forEach((m, i) => {
        const itemHeight = itemHeights[i];
        
        // Check if item fits on current page
        if (currentPage.items.length === 0) {
          // First item on page - always add it (it will fit due to 1000 char limit)
          currentPage.items.push({ med: m, index: i });
          currentPage.usedHeight = itemHeight;
        } else if (currentPage.usedHeight + itemHeight <= CONTENT_AREA_PX) {
          // Item fits on current page
          currentPage.items.push({ med: m, index: i });
          currentPage.usedHeight += itemHeight;
        } else {
          // Item doesn't fit - start new page
          pages.push(currentPage);
          currentPage = { 
            items: [{ med: m, index: i }], 
            usedHeight: itemHeight 
          };
        }
      });
      
      // Don't forget the last page
      if (currentPage.items.length > 0) {
        pages.push(currentPage);
      }
      
      // Render all pages
      const container = document.getElementById("print-content");
      let html = '';
      
      pages.forEach((page, pageIndex) => {
        html += '<div class="print-page">';
        html += '<div class="page-header">' + getHead() + '</div>';
        html += '<div class="page-content">';
        
        page.items.forEach(item => {
          html += getItem(item.med, item.index);
        });
        
        html += '</div>';
        html += '</div>';
      });
      
      container.innerHTML = html;
      
      window.focus();
      
      // Reset weight in parent window after print dialog closes
      window.addEventListener('afterprint', function() {
        if (window.parent && window.parent.appState) {
          window.parent.appState.currentWeight = null;
          const weightInput = window.parent.document.getElementById("weightInput");
          if (weightInput) {
            weightInput.value = "";
          }
          if (window.parent.cartRenderer) {
            window.parent.cartRenderer.render();
          }
        }
      }, { once: true });
      
      setTimeout(() => window.print(), 150);
    } catch(err) {
      console.error("Print generation error:", err);
      alert("Print generation error: " + err.message);
    }
  </script>`;
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

  getPrintFunctions() {
    return `
      function esc(s) {
        return (s || "").toString()
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      }
      
      function strip(h) {
        let t = document.createElement("div");
        t.innerHTML = h;
        return t.textContent || t.innerText || "";
      }
      
      function expand(s, d) {
        if (!s) return "";
        const keys = Object.keys(d).sort((a, b) => b.length - a.length).join("|");
        const pattern = new RegExp("\\\\b(" + keys + ")\\\\b", "gi");
        return s.replace(pattern, m => d[m.toUpperCase()] || m);
      }
      
      function fmtDur(d) {
        if (!d) return "";
        return d.replace(/^(\\d+)\\s*(d|day|wk|week|mo|mth|month|yr|year)s?$/i, (m, p1, p2) => {
          let u = p2.toLowerCase();
          if (u === 'd') u = 'day';
          if (u === 'wk') u = 'week';
          if (u.startsWith('m')) u = 'month';
          return \`for \${p1} \${u}\${p1 == 1 ? '' : 's'}\`;
        });
      }
      
      function getHead() {
        return \`<div class="header-wrapper">
          <div class="sticker-box"></div>
          <div class="provider-col">
            <div class="provider-info">
              <div class="provider-name">Dr. \${esc(DATA.prescriber.name)}</div>
              <div class="provider-meta">CPSO: \${esc(DATA.prescriber.cpso)}</div>
              <div class="provider-meta">\${esc(DATA.prescriber.address)}</div>
              <div class="provider-meta" style="margin-top:8px;">
                <strong>Date:</strong> \${DATA.dateStr}
              </div>
            </div>
            <div class="sig-area">
              <div class="sig-line-wrap">
                <strong>Signature:</strong>
                <div class="sig-rule"></div>
              </div>
            </div>
          </div>
        </div>\`;
      }
      
      function getItem(m, i) {
        let dose = m.dose_text || "";
        let plain = strip(dose).trim();
        let expandedDose = expand(plain, TERMS);
        let expDoseLower = expandedDose.toLowerCase();
        
        let form = (m.form || "").trim();
        let expandedForm = expand(form, TERMS);
        let expFormLower = expandedForm.toLowerCase();
        let expFormSingular = expFormLower.endsWith('s') 
          ? expFormLower.slice(0, -1) 
          : expFormLower;
        
        let line2 = "";
        if (expandedForm && 
            !expDoseLower.includes(expFormLower) && 
            !expDoseLower.includes(expFormSingular) &&
            !plain.toLowerCase().includes("see instructions")) {
          line2 = expandedForm;
        }
        
        let finalDose = dose.includes("<span") ? dose : esc(expandedDose);
        
        let prnSuffix = "";
        if (m.prn) {
          if ((m.frequency || "").toUpperCase() === "PRN") {
            prnSuffix = "for " + esc(m.prn);
          } else {
            prnSuffix = "as needed for " + esc(m.prn);
          }
        }
        
        let sig = [
          finalDose,
          esc(line2),
          esc(expand(m.route || "", ROUTES)),
          esc(expand(m.frequency || "", FREQS)),
          prnSuffix,
          fmtDur(m.duration)
        ].filter(Boolean).join(" ");
        
        let metaParts = [];
        if (m.dispense) metaParts.push(\`Dispense: <strong>\${esc(m.dispense)}</strong>\`);
        if (m.refill) metaParts.push(\`Refills: <strong>\${esc(m.refill)}</strong>\`);
        let meta = metaParts.join(" &nbsp;|&nbsp; ");
        
        // Truncate comments to 1000 chars (safety)
        let comments = (m.comments || "").substring(0, 1000);
        
        return \`<div class="rx-item">
          <div class="rx-title">\${i + 1}. \${esc(m.med)}</div>
          <div class="rx-details">
            <div>\${sig}</div>
            \${meta ? \`<div class="rx-meta">\${meta}</div>\` : ""}
            \${comments ? \`<div class="rx-comments">Note: \${esc(comments)}</div>\` : ""}
          </div>
        </div>\`;
      }
    `;
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
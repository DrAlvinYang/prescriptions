// ============================================================================
// CART CONTROLLER
// ============================================================================

class CartController {
  constructor(state, cartRenderer, dashboardRenderer, searchRenderer) {
    this.state = state;
    this.cartRenderer = cartRenderer;
    this.dashboardRenderer = dashboardRenderer;
    this.searchRenderer = searchRenderer;
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

  setModalManager(modalManager) {
    this.modalManager = modalManager;
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
    this.searchRenderer.render(
      query,
      (med, element) => this.cartController.toggle(med, element)
    );

    const clearBtn = document.getElementById("clearSearchBtn");
    if (query.trim().length > 0) {
      clearBtn.classList.add("visible");
    } else {
      clearBtn.classList.remove("visible");
    }
  }

  clear() {
    const searchInput = document.getElementById("searchInput");
    searchInput.value = "";
    this.search("");
    document.getElementById("clearSearchBtn").classList.remove("visible");
    searchInput.focus();
  }

  navigateResults(direction) {
    const searchView = document.getElementById("searchView");
    if (searchView.classList.contains("hidden")) return;

    const results = document.querySelectorAll("#searchResults .med-item");
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
    const results = document.querySelectorAll("#searchResults .med-item");
    
    // If focused on a med item, click it
    if (document.activeElement.classList.contains("med-item")) {
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
// WEIGHT CONTROLLER
// ============================================================================

class WeightController {
  constructor(state, cartRenderer) {
    this.state = state;
    this.cartRenderer = cartRenderer;
  }

  update(value) {
    const parsed = parseFloat(value);
    this.state.setWeight(parsed);
    this.cartRenderer.render();
  }

  format(value) {
    const formatted = Utils.formatWeight(value);
    if (formatted) {
      document.getElementById("weightInput").value = formatted;
      this.state.setWeight(parseFloat(formatted));
      this.cartRenderer.render();
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
  constructor(state, locationManager, weightController) {
    this.state = state;
    this.locationManager = locationManager;
    this.weightController = weightController;
  }

  print() {
    if (this.state.cart.length === 0) return;

    const dateStr = new Date().toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });

    const location = this.locationManager.getCurrentLocation();

    const payload = {
      prescriber: {
        name: CONFIG.prescriber.name,
        cpso: CONFIG.prescriber.cpso,
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

        return { ...med, dose_text: dose };
      })
    };

    this.generatePrintDocument(payload);

    // Reset weight after printing
    this.state.currentWeight = null;
    document.getElementById("weightInput").value = "";
    window.cartRenderer.render();
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
  <table>
    <thead>
      <tr><td><div id="header-container"></div></td></tr>
    </thead>
    <tbody id="med-list-body"></tbody>
  </table>
  ${this.getPrintScript(data)}
</body>
</html>`;
  }

  getPrintStyles() {
    return `<style>
    @page { size: letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    body { 
      margin: 0; padding: 0; 
      font-family: -apple-system, sans-serif; 
      font-size: 11pt; color: #000; background: #fff; 
    }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tbody { display: table-row-group; }
    tr { page-break-inside: avoid; }
    td { vertical-align: top; padding: 0; }
    
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
    
    .rx-item { padding: 12px 0; border-bottom: 1px solid #ddd; }
    .rx-title { font-weight: 700; font-size: 12pt; margin-bottom: 4px; }
    .rx-details { margin-left: 20px; line-height: 1.4; }
    .rx-meta { margin-top: 6px; font-size: 10pt; color: #444; }
    .rx-comments { 
      margin-top: 8px; font-style: italic; 
      background: #f4f4f4; padding: 6px 10px; 
      border-radius: 6px; display: inline-block; 
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
      
      ${this.getPrintFunctions()}
      
      document.getElementById("header-container").innerHTML = getHead();
      const tbody = document.getElementById("med-list-body");
      tbody.innerHTML = DATA.items.map((m, i) => 
        \`<tr><td>\${getItem(m, i)}</td></tr>\`
      ).join("");
      
      window.focus();
      setTimeout(() => window.print(), 100);
    } catch(err) {
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
              <div class="provider-name">\${esc(DATA.prescriber.name)}</div>
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
        
        return \`<div class="rx-item">
          <div class="rx-title">\${i + 1}. \${esc(m.med)}</div>
          <div class="rx-details">
            <div>\${sig}</div>
            \${meta ? \`<div class="rx-meta">\${meta}</div>\` : ""}
            \${m.comments ? \`<div class="rx-comments">Note: \${esc(m.comments)}</div>\` : ""}
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
window.WeightController = WeightController;
window.KeyboardController = KeyboardController;
window.ResetController = ResetController;
window.PrintController = PrintController;
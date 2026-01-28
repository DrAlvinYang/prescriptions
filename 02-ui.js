// ============================================================================
// DOM ELEMENT CREATORS
// ============================================================================

class DOMBuilder {
  static createElement(tag, className, attributes = {}) {
    const element = document.createElement(tag);
    
    if (className) {
      element.className = className;
    }
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key.startsWith('on')) {
        element[key] = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    return element;
  }

  static createButton(text, className, onClick) {
    return this.createElement('button', className, {
      textContent: text,
      type: 'button',
      onclick: onClick
    });
  }

  static createInput(type, className, attributes = {}) {
    return this.createElement('input', className, {
      type,
      autocomplete: 'off',
      ...attributes
    });
  }
}

// ============================================================================
// MEDICATION ITEM RENDERER
// ============================================================================

class MedicationRenderer {
  constructor(state) {
    this.state = state;
  }

  renderHTML(med, options = {}) {
    const { showPopulation = false, highlightTerms = [] } = options;
    
    const detailsString = MedicationUtils.getDetailsArray(med, null).join(", ");
    const format = (txt) => highlightTerms.length > 0 
      ? Utils.highlightText(txt, highlightTerms) 
      : Utils.escapeHtml(txt);

    // Indication
    let indicationHtml = "";
    if (med.indication) {
      indicationHtml = `<div class="med-indication">${format(med.indication)}</div>`;
    }

    // Med name - append brands if state.showingBrands is true
    let medNameHtml = format(med.med);
    if (this.state.showingBrands && med.brands && med.brands.length > 0) {
      const brandText = MedicationUtils.formatBrandNames(med.brands);
      medNameHtml += ` <span class="brand-name">${Utils.escapeHtml(brandText)}</span>`;
    }
    
    const detailsHtml = format(detailsString);
    
    // Population label
    const popLabel = (showPopulation && med.population) 
      ? `<span style="font-weight:normal; color:#666; font-size:0.9em; margin-left:4px;">(${Utils.escapeHtml(med.population)})</span>` 
      : "";

    // Brand matching hint (only show when NOT showing brands)
    let brandHint = "";
    if (!this.state.showingBrands && highlightTerms.length > 0 && Array.isArray(med.brands)) {
      const matchedBrand = med.brands.find(brand => 
        highlightTerms.some(term => brand.toLowerCase().includes(term))
      );
      
      if (matchedBrand) {
        brandHint = `<span class="brand-match-hint">(matches ${Utils.highlightText(matchedBrand, highlightTerms)})</span>`;
      }
    }

    return `${indicationHtml}<div><span class="med-name-text">${medNameHtml}${popLabel}${brandHint}</span> <span class="med-details-text">${detailsHtml}</span></div>`;
  }

  createMedItem(med, options = {}) {
    const { showPopulation = false, highlightTerms = [], onClick } = options;
    
    const div = DOMBuilder.createElement('div', 'med-item', {
      tabIndex: 0,
      innerHTML: this.renderHTML(med, { showPopulation, highlightTerms })
    });
    
    div.dataset.key = MedicationUtils.getCartKey(med);
    
    if (onClick) {
      div.onclick = (e) => {
        e.stopPropagation();
        onClick(med, div);
      };
    }
    
    return div;
  }

  createSubfolder(label, nodes, isNested = false) {
    const details = DOMBuilder.createElement('details', isNested ? 'subfolder nested-level' : 'subfolder');
    const summary = DOMBuilder.createElement('summary', 'subfolder-summary', {
      innerHTML: `<span class="subfolder-arrow">▶</span> ${Utils.escapeHtml(label)}`
    });
    const content = DOMBuilder.createElement('div', 'subfolder-content');
    
    nodes.forEach(node => content.appendChild(node));
    
    details.appendChild(summary);
    details.appendChild(content);
    
    return details;
  }
}

// ============================================================================
// DASHBOARD RENDERER
// ============================================================================

class DashboardRenderer {
  constructor(state, medRenderer) {
    this.state = state;
    this.medRenderer = medRenderer;
  }

  renderSpecialtyCard(specialty, medications, onMedClick) {
    const details = DOMBuilder.createElement('details', 'specialty-card');
    const summary = DOMBuilder.createElement('summary', 'specialty-header', {
      textContent: specialty
    });
    const body = DOMBuilder.createElement('div', 'specialty-body');

    const sortMeds = (list) => list.sort(MedicationUtils.compareByIndication);

    if (NESTED_SPECIALTIES.includes(specialty)) {
      this.renderNestedSpecialty(body, medications, sortMeds, onMedClick);
    } else {
      this.renderFlatSpecialty(body, specialty, medications, sortMeds, onMedClick);
    }

    details.appendChild(summary);
    details.appendChild(body);
    
    return details;
  }

  renderNestedSpecialty(body, medications, sortMeds, onMedClick) {
    const byPopulation = this.groupByField(medications, 'population', 'Unspecified');
    
    const populations = [...byPopulation.keys()].sort(
      (a, b) => this.getPopulationOrder(a) - this.getPopulationOrder(b)
    );

    populations.forEach(population => {
      const popMeds = byPopulation.get(population);
      const bySubcategory = this.groupByField(popMeds, 'subcategory', 'General');

      const subNodes = [];
      const subcategories = [...bySubcategory.keys()].sort(
        (a, b) => this.getSubcategoryOrder(a) - this.getSubcategoryOrder(b)
      );

      subcategories.forEach(subcategory => {
        const meds = sortMeds(bySubcategory.get(subcategory));
        const medNodes = meds.map(med => 
          this.medRenderer.createMedItem(med, { onClick: onMedClick })
        );
        subNodes.push(this.medRenderer.createSubfolder(subcategory, medNodes, true));
      });

      body.appendChild(this.medRenderer.createSubfolder(population, subNodes, false));
    });
  }

  renderFlatSpecialty(body, specialty, medications, sortMeds, onMedClick) {
    const grouped = new Map();

    medications.forEach(med => {
      const sub = Utils.normalize(med.subcategory);
      const pop = Utils.normalize(med.population);
      
      let label = "General";
      
      if (specialty === "Substance Use") {
        label = sub || "General";
      } else if (sub && pop) {
        label = `${sub} (${pop})`;
      } else if (sub) {
        label = sub;
      } else if (pop) {
        label = pop;
      }

      if (!grouped.has(label)) {
        grouped.set(label, []);
      }
      grouped.get(label).push(med);
    });

    const isSingle = grouped.size === 1;
    const labels = [...grouped.keys()].sort(
      (a, b) => this.getSubcategoryOrder(a) - this.getSubcategoryOrder(b)
    );

    labels.forEach(label => {
      const meds = sortMeds(grouped.get(label));
      
      if (isSingle) {
        meds.forEach(med => {
          body.appendChild(this.medRenderer.createMedItem(med, { onClick: onMedClick }));
        });
      } else {
        const medNodes = meds.map(med => 
          this.medRenderer.createMedItem(med, { onClick: onMedClick })
        );
        body.appendChild(this.medRenderer.createSubfolder(label, medNodes, false));
      }
    });
  }

  groupByField(items, field, defaultValue) {
    const map = new Map();
    
    items.forEach(item => {
      const value = Utils.normalize(item[field]) || defaultValue;
      
      if (!map.has(value)) {
        map.set(value, []);
      }
      map.get(value).push(item);
    });
    
    return map;
  }

  getPopulationOrder(population) {
    return SORT_ORDER.population[population] || 99;
  }

  getSubcategoryOrder(subcategory) {
    return SORT_ORDER.subcategory[subcategory] || 99;
  }

  render(columns, onMedClick) {
    const groups = MedicationUtils.groupBySpecialty(this.state.medications);

    Object.entries(columns).forEach(([colId, specialties]) => {
      const column = document.getElementById(colId);
      column.innerHTML = "";

      specialties.forEach(specialty => {
        // Special case: "Add New Med" button
        if (specialty === "Add New Med") {
          const button = DOMBuilder.createElement('button', 'specialty-card add-new-med-btn', {
            textContent: 'Add New Med',
            type: 'button',
            onclick: () => {
              // Placeholder - functionality to be implemented later
            }
          });
          column.appendChild(button);
        } else if (groups.has(specialty)) {
          const card = this.renderSpecialtyCard(
            specialty, 
            groups.get(specialty),
            onMedClick
          );
          column.appendChild(card);
        }
      });
    });
  }
}

// ============================================================================
// SEARCH RESULTS RENDERER
// ============================================================================

class SearchResultsRenderer {
  constructor(state, medRenderer, searchManager = null) {
    this.state = state;
    this.medRenderer = medRenderer;
    this.searchManager = searchManager;
  }

  setSearchManager(searchManager) {
    this.searchManager = searchManager;
  }

  render(query, onMedClick) {
    this.state.activeSearchIndex = -1;
    
    const dashboardView = document.getElementById("dashboardView");
    const searchView = document.getElementById("searchView");
    const resultsContainer = document.getElementById("searchResults");

    if (!query || query.trim() === "") {
      searchView.classList.add("hidden");
      dashboardView.classList.remove("hidden");
      return;
    }

    dashboardView.classList.add("hidden");
    searchView.classList.remove("hidden");
    resultsContainer.innerHTML = "";

    // Use provided searchManager or create new one as fallback
    const searchManager = this.searchManager || new SearchManager(this.state.medications);
    const terms = searchManager.normalizeSearchTerms(query);
    const groups = searchManager.search(query);

    const totalResults = groups.adult.length + groups.pediatric.length + groups.other.length;

    if (totalResults === 0) {
      resultsContainer.innerHTML = `<div style="padding:15px; color:#666;">No matches found.</div>`;
      return;
    }

    this.renderGroup("Adult", groups.adult, resultsContainer, terms, onMedClick);
    this.renderGroup("Pediatric", groups.pediatric, resultsContainer, terms, onMedClick);
    this.renderGroup("Other", groups.other, resultsContainer, terms, onMedClick);

    // Highlight sole match
    if (totalResults === 1) {
      const onlyItem = resultsContainer.querySelector(".med-item");
      if (onlyItem) {
        onlyItem.classList.add("is-sole-match");
      }
    }
  }

  renderGroup(title, items, container, terms, onMedClick) {
    if (items.length === 0) return;

    const header = DOMBuilder.createElement('div', '', {
      innerHTML: title,
      style: 'background: #eef3f8; color: #2c3e50; padding: 10px 12px; font-weight: 700; font-size: 14px; border-bottom: 1px solid #dbe0e6;'
    });
    
    container.appendChild(header);

    items.forEach(med => {
      const item = this.medRenderer.createMedItem(med, {
        showPopulation: false,
        highlightTerms: terms,
        onClick: onMedClick
      });
      
      item.style.borderBottom = "1px solid #eee";
      container.appendChild(item);
    });
  }
}

// ============================================================================
// CART RENDERER
// ============================================================================

class CartRenderer {
  constructor(state) {
    this.state = state;
  }

  render(onRemove, onEdit) {
    const cartList = document.getElementById("cartList");
    const countLabel = document.querySelector(".cart-count");

    if (countLabel) {
      const count = this.state.cart.length;
      countLabel.textContent = `${count} prescription${count === 1 ? '' : 's'}`;
    }

    if (this.state.cart.length === 0) {
      cartList.innerHTML = `<div class="cart-empty">None selected</div>`;
      return;
    }

    cartList.innerHTML = this.state.cart.map(med => 
      this.renderCartItem(med, onRemove, onEdit)
    ).join("");
  }

  renderCartItem(med, onRemove, onEdit) {
    let dose = med.dose_text;
    let isCalculated = false;

    // Calculate dose if weight-based and not edited
    if (med.weight_based && this.state.currentWeight && !med.wasEdited) {
      const calc = MedicationUtils.calculateDose(med, this.state.currentWeight);
      if (calc) {
        dose = calc.html;
        isCalculated = true;
      }
    }

    // Build details with proper escaping
    const detailsParts = MedicationUtils.getDetailsArray(med, dose);
    const safeDetails = detailsParts.map(part => {
      if (isCalculated && part === dose) {
        return part; // Keep HTML
      }
      return Utils.escapeHtml(part);
    }).join(", ");

    // Build med name display - append brands if showing
    let medNameDisplay = Utils.escapeHtml(med.med);
    if (this.state.showingBrands && med.brands && med.brands.length > 0) {
      const brandText = MedicationUtils.formatBrandNames(med.brands);
      medNameDisplay += ` <span class="brand-name">${Utils.escapeHtml(brandText)}</span>`;
    }

    return `
      <div class="cart-item">
        <div class="cart-med-name">${medNameDisplay}</div>
        <button class="icon-btn" onclick="cartActions.remove('${med.uid}')">×</button>
        <div class="cart-med-details">${safeDetails}</div>
        <button class="edit-btn" onclick="cartActions.edit('${med.uid}')">Edit</button>
      </div>`;
  }

  updateSelectedIndicators() {
    document.querySelectorAll(".med-item").forEach(element => {
      const isSelected = this.state.cart.some(
        item => !item.wasEdited && MedicationUtils.getCartKey(item) === element.dataset.key
      );
      
      element.classList.toggle("in-cart", isSelected);
    });
  }
}

// ============================================================================
// LOCATION UI RENDERER
// ============================================================================

class LocationUIRenderer {
  constructor(locationManager) {
    this.locationManager = locationManager;
  }

  updateHeader() {
    const button = document.getElementById("locationBtn");
    const locationName = this.locationManager.state.currentLocationName;
    button.innerHTML = `<span class="loc-label">${Utils.escapeHtml(locationName)}</span> <span class="arrow">▼</span>`;
  }

  renderDropdown(onSelect, onDelete) {
    const listElement = document.getElementById("locationList");
    listElement.innerHTML = "";

    const allLocations = this.locationManager.getAllLocations();
    const baseNames = new Set(BASE_LOCATIONS.map(loc => loc.name));
    const currentName = this.locationManager.state.currentLocationName;

    allLocations.forEach(location => {
      const isBase = baseNames.has(location.name);
      const isSelected = location.name === currentName;

      const div = DOMBuilder.createElement('div', `loc-item ${isSelected ? 'selected' : ''}`, {
        onclick: () => onSelect(location.name)
      });

      const span = DOMBuilder.createElement('span', 'loc-name', {
        textContent: location.name
      });
      
      div.appendChild(span);

      if (!isBase) {
        const deleteBtn = DOMBuilder.createElement('button', 'loc-delete-btn', {
          innerHTML: "&times;",
          title: "Delete Location",
          onclick: (e) => {
            e.stopPropagation();
            onDelete(location.name);
          }
        });
        div.appendChild(deleteBtn);
      }

      listElement.appendChild(div);
    });
  }

  toggleMenu(onSelect, onDelete) {
    const menu = document.getElementById("locationMenu");
    const isHidden = menu.classList.contains("hidden");

    if (isHidden) {
      this.renderDropdown(onSelect, onDelete);
      menu.classList.remove("hidden");
    } else {
      menu.classList.add("hidden");
    }
  }
}

// ============================================================================
// PROVIDER UI RENDERER
// ============================================================================

class ProviderUIRenderer {
  constructor(providerManager) {
    this.providerManager = providerManager;
  }

  updateHeader() {
    const btn = document.getElementById("providerBtn");
    const label = document.getElementById("providerLabel");
    
    if (!btn || !label) return;
    
    const provider = this.providerManager.getProvider();
    label.textContent = `Dr. ${provider.name}`;
    btn.title = `${provider.name} (CPSO: ${provider.cpso})`;
  }
}

// ============================================================================
// MODAL MANAGER
// ============================================================================

class ModalManager {
  constructor(state) {
    this.state = state;
    this.focusTrapHandler = null; // Store handler for cleanup
  }

  // Focus Trap Helper
  trapFocus(modalElement) {
    // Remove any existing trap handler
    if (this.focusTrapHandler) {
      document.removeEventListener("keydown", this.focusTrapHandler);
    }

    // Get all focusable elements in the modal
    const focusableElements = modalElement.querySelectorAll(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    // Create and store the handler
    this.focusTrapHandler = (e) => {
      if (e.key !== "Tab") return;

      // If shift+tab on first element, go to last
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } 
      // If tab on last element, go to first
      else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    
    document.addEventListener("keydown", this.focusTrapHandler);
  }

  removeFocusTrap() {
    if (this.focusTrapHandler) {
      document.removeEventListener("keydown", this.focusTrapHandler);
      this.focusTrapHandler = null;
    }
  }

  // Weight Modal
  openWeight(medication) {
    this.state.pendingMed = medication;
    const modal = document.getElementById("weightModal");
    const input = document.getElementById("modalWeightInput");
    
    input.value = "";
    modal.classList.remove("hidden");
    input.focus();
    
    // Do NOT trap focus for weight modal - we want Tab to be completely disabled
    // (handled in KeyboardController)
  }

  closeWeight() {
    this.removeFocusTrap();
    document.getElementById("weightModal").classList.add("hidden");
    
    // Return focus to active search item
    const results = document.querySelectorAll("#searchResults .med-item");
    if (this.state.activeSearchIndex >= 0 && results[this.state.activeSearchIndex]) {
      results[this.state.activeSearchIndex].focus();
    }
  }

  saveWeight(onSuccess) {
    const input = document.getElementById("modalWeightInput");
    const value = parseFloat(input.value);

    if (!isNaN(value) && value >= 0.01) {
      this.state.setWeight(value);
      document.getElementById("weightInput").value = value.toFixed(2);
      
      if (this.state.pendingMed) {
        onSuccess(this.state.pendingMed);
        this.state.pendingMed = null;
      }
      
      this.closeWeight();
    } else {
      alert("Please enter a valid weight greater than 0 kg.");
    }
  }

  skipWeight(onSkip) {
    if (this.state.pendingMed) {
      onSkip(this.state.pendingMed);
      this.state.pendingMed = null;
    }
    this.closeWeight();
  }

  // Edit Modal
  openEdit(uid) {
    const item = this.state.findCartItem(uid);
    if (!item) return;

    this.state.editingId = uid;
    this.state.tabbingUnlocked = false;

    let displayDose = item.dose_text;
    
    if (item.weight_based && !item.wasEdited && this.state.currentWeight) {
      const calc = MedicationUtils.calculateDose(item, this.state.currentWeight);
      if (calc) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = calc.html;
        displayDose = tempDiv.querySelector(".calc-dose").textContent;
      }
    }

    document.getElementById("editModalTitle").textContent = `Edit ${item.med}`;
    document.getElementById("editDose").value = displayDose;
    document.getElementById("editRoute").value = item.route || "";
    document.getElementById("editFreq").value = item.frequency || "";
    document.getElementById("editDur").value = item.duration || "";
    document.getElementById("editDispense").value = item.dispense || "";
    document.getElementById("editRefill").value = item.refill || "";
    document.getElementById("editForm").value = item.form || "";
    document.getElementById("editPrn").value = item.prn || "";
    
    // Enforce 1000 character limit on comments
    const commentsField = document.getElementById("editComments");
    commentsField.value = (item.comments || "").substring(0, 1000);
    commentsField.maxLength = 1000;

    // Unlock tabbing on click
    const fields = ["editDose", "editRoute", "editFreq", "editDur", "editDispense", "editRefill", "editForm", "editPrn", "editComments"];
    fields.forEach(id => {
      document.getElementById(id).onclick = () => {
        this.state.tabbingUnlocked = true;
      };
    });

    const modal = document.getElementById("editModal");
    modal.classList.remove("hidden");
    
    // Trap focus in modal
    this.trapFocus(modal);
  }

  saveEdit() {
    this.state.updateCartItem(this.state.editingId, {
      dose_text: document.getElementById("editDose").value,
      route: document.getElementById("editRoute").value,
      frequency: document.getElementById("editFreq").value,
      duration: document.getElementById("editDur").value,
      dispense: document.getElementById("editDispense").value,
      refill: document.getElementById("editRefill").value,
      form: document.getElementById("editForm").value,
      prn: document.getElementById("editPrn").value,
      comments: document.getElementById("editComments").value,
      wasEdited: true
    });
    
    this.closeEdit();
  }

  closeEdit() {
    this.removeFocusTrap();
    document.getElementById("editModal").classList.add("hidden");
    this.state.editingId = null;
  }

  // Location Modal
  openLocation() {
    document.getElementById("locationMenu").classList.add("hidden");
    document.getElementById("newLocName").value = "";
    document.getElementById("newLocAddress").value = "";
    
    const modal = document.getElementById("locationModal");
    modal.classList.remove("hidden");
    document.getElementById("newLocName").focus();
    
    // Trap focus in modal
    this.trapFocus(modal);
  }

  closeLocation() {
    this.removeFocusTrap();
    document.getElementById("locationModal").classList.add("hidden");
  }

  saveLocation(locationManager, onSuccess) {
    const name = document.getElementById("newLocName").value;
    const address = document.getElementById("newLocAddress").value;

    try {
      locationManager.addCustomLocation(name, address);
      onSuccess();
      this.closeLocation();
    } catch (error) {
      alert(error.message);
    }
  }

  // Provider Modal
  openProvider() {
    document.getElementById("newProviderName").value = "";
    document.getElementById("newProviderCpso").value = "";
    
    const modal = document.getElementById("providerModal");
    modal.classList.remove("hidden");
    document.getElementById("newProviderName").focus();
    
    // Trap focus in modal
    this.trapFocus(modal);
  }

  closeProvider() {
    this.removeFocusTrap();
    document.getElementById("providerModal").classList.add("hidden");
  }

  saveProvider(providerManager, onSuccess) {
    const name = document.getElementById("newProviderName").value;
    const cpso = document.getElementById("newProviderCpso").value;

    try {
      providerManager.updateProvider(name, cpso);
      onSuccess();
      this.closeProvider();
    } catch (error) {
      alert(error.message);
    }
  }
}

// ============================================================================
// EXPORT FOR USE
// ============================================================================

window.DOMBuilder = DOMBuilder;
window.MedicationRenderer = MedicationRenderer;
window.DashboardRenderer = DashboardRenderer;
window.SearchResultsRenderer = SearchResultsRenderer;
window.CartRenderer = CartRenderer;
window.LocationUIRenderer = LocationUIRenderer;
window.ProviderUIRenderer = ProviderUIRenderer;
window.ModalManager = ModalManager;
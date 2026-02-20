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

    // Indication (only shown for owner provider)
    let indicationHtml = "";
    if (med.indication && window.providerManager?.isOwner()) {
      indicationHtml = `<div class="med-indication">${format(med.indication)}</div>`;
    }

    // Med name - always include brand span (visibility controlled by CSS)
    let medNameHtml = format(med.med);
    if (med.brands && med.brands.length > 0) {
      const brandText = MedicationUtils.formatBrandNames(med.brands);
      medNameHtml += ` <span class="brand-name">${Utils.escapeHtml(brandText)}</span>`;
    }

    const detailsHtml = format(detailsString);

    // Population label
    const popLabel = (showPopulation && med.population)
      ? `<span style="font-weight:normal; color:var(--calc-note); font-size:0.9em; margin-left:4px;">(${Utils.escapeHtml(med.population)})</span>`
      : "";

    // Brand matching hint (shown when brands are hidden and search matches a brand)
    let brandHint = "";
    if (highlightTerms.length > 0 && Array.isArray(med.brands)) {
      const matchedBrand = med.brands.find(brand =>
        highlightTerms.some(term => brand.toLowerCase().includes(term))
      );

      if (matchedBrand) {
        brandHint = `<span class="brand-match-hint">(matches ${Utils.highlightText(matchedBrand, highlightTerms)})</span>`;
      }
    }

    return `${indicationHtml}<div><span class="med-name-text">${medNameHtml}${popLabel}${brandHint}</span> <span class="med-details-text">${detailsHtml}</span></div>`;
  }

  createActionButtons(med, medItemDiv, { containerClass, editLabel, addLabel, useHTML }) {
    const container = DOMBuilder.createElement('div', containerClass);
    const labelProp = useHTML ? 'innerHTML' : 'textContent';

    const editBtn = DOMBuilder.createElement('button', 'med-action-btn med-action-btn-edit', {
      [labelProp]: editLabel,
      type: 'button'
    });
    editBtn.onclick = (e) => {
      e.stopPropagation();
      medItemDiv.classList.remove("mobile-actions-open");
      if (window.searchEditController) {
        window.searchEditController.openEdit(med);
      }
    };

    const addRemoveBtn = DOMBuilder.createElement('button', 'med-action-btn med-action-btn-add', {
      [labelProp]: addLabel,
      type: 'button'
    });
    addRemoveBtn.onclick = (e) => {
      e.stopPropagation();
      if (medItemDiv.classList.contains('in-cart')) {
        // Removing from cart: dismiss overlay
        medItemDiv.classList.remove("mobile-actions-open");
        if (window.cartController) {
          const key = medItemDiv.dataset.key;
          const item = window.cartController.state.cart.find(
            c => !c.wasEdited && MedicationUtils.getCartKey(c) === key
          );
          if (item) {
            window.cartController.remove(item.uid);
          }
        }
      } else {
        // Adding to cart: keep overlay open on mobile to show Remove button
        if (!Utils.isMobile()) medItemDiv.classList.remove("mobile-actions-open");
        if (window.cartController) {
          window.cartController.pendingFlySource = medItemDiv;
          if (med.weight_based && window.cartController.state.currentWeight === null) {
            medItemDiv.classList.remove("mobile-actions-open");
            window.modalManager.openWeight(med);
          } else {
            window.cartController.add(med);
          }
        }
      }
    };

    container.appendChild(editBtn);
    container.appendChild(addRemoveBtn);

    // On mobile, add a Print button
    if (Utils.isMobile()) {
      const printBtn = DOMBuilder.createElement('button', 'med-action-btn med-action-btn-print', {
        textContent: 'Print',
        type: 'button'
      });
      printBtn.onclick = (e) => {
        e.stopPropagation();
        medItemDiv.classList.remove("mobile-actions-open");
        if (window.printController) {
          window.printController.quickPrint(med);
        }
      };
      container.appendChild(printBtn);
    }

    return container;
  }

  createMedItem(med, options = {}) {
    const { showPopulation = false, highlightTerms = [], onClick, showActions = false, overlayActions = false } = options;

    let className = 'med-item';
    if (showActions) className += ' has-actions';
    if (overlayActions) className += ' has-overlay-actions';

    const div = DOMBuilder.createElement('div', className, {
      tabIndex: 0
    });

    div.dataset.key = MedicationUtils.getCartKey(med);

    // Wrap content in a container for flexbox layout when actions are present
    if (showActions) {
      const contentDiv = DOMBuilder.createElement('div', 'med-item-content', {
        innerHTML: this.renderHTML(med, { showPopulation, highlightTerms })
      });
      div.appendChild(contentDiv);
      div.appendChild(this.createActionButtons(med, div, {
        containerClass: 'med-item-actions',
        editLabel: '<u class="shortcut-hint">E</u>dit',
        addLabel: '<u class="shortcut-hint">A</u>dd',
        useHTML: true
      }));
    } else {
      // Set innerHTML directly
      div.innerHTML = this.renderHTML(med, { showPopulation, highlightTerms });

      // Add overlay action buttons for folder view
      if (overlayActions) {
        div.appendChild(this.createActionButtons(med, div, {
          containerClass: 'med-item-overlay-actions',
          editLabel: 'Edit',
          addLabel: 'Add',
          useHTML: false
        }));
      }
    }

    // Click/Enter on med item
    div.onclick = (e) => {
      e.stopPropagation();
      if (Utils.isMobile()) {
        // Toggle action overlay
        const wasOpen = div.classList.contains("mobile-actions-open");
        const otherWasOpen = document.querySelector(".med-item.mobile-actions-open:not([data-key='" + div.dataset.key + "'])")
          || document.querySelector(".cart-item.mobile-actions-open");
        document.querySelectorAll(".med-item.mobile-actions-open").forEach(el =>
          el.classList.remove("mobile-actions-open")
        );
        document.querySelectorAll(".cart-item.mobile-actions-open").forEach(el =>
          el.classList.remove("mobile-actions-open")
        );
        // Open only if toggling this med (not if dismissing another)
        if (!wasOpen && !otherWasOpen) {
          div.classList.add("mobile-actions-open");
          // Briefly disable button pointer-events to prevent the opening
          // tap from activating a button underneath the finger
          const actions = div.querySelector(".med-item-overlay-actions, .med-item-actions");
          if (actions) {
            actions.style.pointerEvents = "none";
            setTimeout(() => { actions.style.pointerEvents = ""; }, 300);
          }
        }
      } else {
        // Desktop: quick-print
        if (window.printController) {
          window.printController.quickPrint(med);
        }
      }
    };

    return div;
  }

}

// ============================================================================
// FOLDER NAVIGATION RENDERER (3-column browse + preview)
// ============================================================================

class FolderNavigationRenderer {
  constructor(state, medRenderer) {
    this.state = state;
    this.medRenderer = medRenderer;
  }

  /** Full initial render — populations, specialties, preview. */
  render() {
    this.renderPopulationColumn();
    this.renderBrowse();
  }

  /** Column 1: Population items with counts. */
  renderPopulationColumn() {
    const container = document.getElementById("rx-population-list");
    if (!container) return;
    container.innerHTML = "";

    POPULATION_ITEMS.forEach((pop, i) => {
      const div = document.createElement("div");
      div.className = "rx-population-item";
      if (pop.key === this.state.nav.population) {
        div.classList.add("selected");
      }
      div.dataset.popKey = pop.key;

      const label = document.createElement("span");
      label.textContent = pop.label;

      const count = document.createElement("span");
      count.className = "rx-population-item__count";
      count.textContent = NavigationDataHelper.countMeds(this.state.medications, pop.key);

      div.appendChild(label);
      div.appendChild(count);

      div.addEventListener("click", () => this.selectPopulation(pop.key));
      div.addEventListener("mouseenter", () => {
        // Hover highlight for Column 1
        this.state.nav.col1Index = i;
      });

      container.appendChild(div);
    });
  }

  /** Switch population, reset navPath, animate, auto-select first.
   *  @param {string} key - Population key
   *  @param {object} [opts] - Options
   *  @param {boolean} [opts.fromKeyboard=false] - True when called from keyboard nav (stay in Col 1)
   */
  selectPopulation(key, { fromKeyboard = false } = {}) {
    if (this.state.nav.population === key) return;
    const stayInCol1 = fromKeyboard && this.state.nav.activeColumn === 1;
    this.state.nav.population = key;
    this.state.nav.navPath = [];
    this.state.nav.col1Index = POPULATION_ITEMS.findIndex(p => p.key === key);
    this.state.nav.col2Index = 0;
    this.state.nav.col3Index = -1;
    if (!stayInCol1) {
      this.state.nav.activeColumn = 2;
    }

    this.renderPopulationColumn();
    this.renderBrowse();

    // Re-apply keyboard focus after re-render if still in Column 1
    if (stayInCol1) {
      const popItems = document.querySelectorAll("#rx-population-list .rx-population-item");
      popItems.forEach((el, i) => el.classList.toggle("keyboard-focused", i === this.state.nav.col1Index));
    }
  }

  /** Column 2: Render browse content based on navPath. */
  renderBrowse() {
    const container = document.getElementById("rx-specialty-list");
    if (!container) return;
    container.innerHTML = "";

    this.renderBrowseHeader();
    this.clearSubcategoryColumn();
    this.renderPreviewEmpty();

    const pop = this.state.nav.population;

    // Adjust grid columns based on population
    if (pop === "Non-Med") {
      this._updateGridLayout("non-med");
      const meds = NavigationDataHelper.getNonMedMedications(this.state.medications);
      meds.forEach(med => {
        const item = this.medRenderer.createMedItem(med, { overlayActions: true });
        container.appendChild(item);
      });
      return;
    }

    // Default grid (subcategory hidden)
    this._updateGridLayout("default");

    const specialties = NavigationDataHelper.getSpecialtiesForPopulation(this.state.medications, pop);
    specialties.forEach((spec, i) => {
      const count = NavigationDataHelper.countMeds(this.state.medications, pop, spec);
      const item = this._createFolderItem(spec, count, false);
      item.dataset.specialty = spec;

      item.addEventListener("click", () => {
        this.state.nav.col2Index = i;
        this.state.nav.col3Index = -1;
        this.state.nav.col4Index = -1;
        // Clear keyboard-nav dimming classes
        container.classList.remove("col3-active");
        document.getElementById("rx-subcategory-list")?.classList.remove("col4-active");
        this._highlightBrowseItem(i);

        if (NESTED_SPECIALTIES.includes(spec)) {
          this.renderSubcategories(pop, spec);
        } else {
          this.renderPreviewMeds(pop, spec);
        }
      });

      container.appendChild(item);
    });
  }

  /** Column 2 header: breadcrumb or "Specialties". */
  renderBrowseHeader() {
    const header = document.getElementById("rx-specialty-header");
    if (!header) return;
    header.innerHTML = "";

    const navPath = this.state.nav.navPath;
    const pop = this.state.nav.population;

    if (pop === "Non-Med") {
      header.textContent = "Non-Med Items";
      header.classList.remove("rx-col__header--nav");
      return;
    }

    if (navPath.length === 0) {
      header.textContent = "Specialties";
      header.classList.remove("rx-col__header--nav");
      return;
    }

    header.classList.add("rx-col__header--nav");

    // Root "Specialties" link
    const root = document.createElement("span");
    root.className = "rx-breadcrumb__item";
    root.textContent = "Specialties";
    root.addEventListener("click", () => this.navigateBack(0));
    header.appendChild(root);

    // Separator + current segment
    const sep = document.createElement("span");
    sep.className = "rx-breadcrumb__sep";
    sep.textContent = "\u203A";
    header.appendChild(sep);

    const current = document.createElement("span");
    current.className = "rx-breadcrumb__item rx-breadcrumb__item--current";
    current.textContent = navPath[0];
    header.appendChild(current);
  }

  /** Subcategory column: Show subcategory folders for a nested specialty. */
  renderSubcategories(population, specialty) {
    const container = document.getElementById("rx-subcategory-list");
    const header = document.getElementById("rx-subcategory-header");
    if (!container || !header) return;

    header.textContent = specialty;
    container.innerHTML = "";

    // Expand grid to show subcategory column
    this._updateGridLayout("nested");

    // Clear meds column (empty until subcategory is clicked)
    this.renderPreviewEmpty();

    const subs = NavigationDataHelper.getSubcategories(this.state.medications, population, specialty);
    subs.forEach((sub, i) => {
      const count = NavigationDataHelper.getMedications(this.state.medications, population, specialty, sub).length;
      const item = this._createFolderItem(sub, count, false);
      item.dataset.subcategory = sub;

      item.addEventListener("click", () => {
        this.state.nav.col3Index = i;
        this.state.nav.col4Index = -1;
        // Clear keyboard-nav dimming on subcategory column
        container.classList.remove("col4-active");
        this._highlightSubcategoryItem(i);
        this.renderSubcategoryMeds(population, specialty, sub);
      });

      container.appendChild(item);
    });
  }

  /** Meds column: Show meds for a specific subcategory of a nested specialty. */
  renderSubcategoryMeds(population, specialty, subcategory) {
    const container = document.getElementById("rx-meds-list");
    const header = document.getElementById("rx-meds-header");
    if (!container || !header) return;

    header.textContent = subcategory;
    container.innerHTML = "";

    const meds = NavigationDataHelper.getMedications(this.state.medications, population, specialty, subcategory);
    meds.forEach(med => {
      container.appendChild(this.medRenderer.createMedItem(med, { overlayActions: true }));
    });

    if (window.cartRenderer) {
      window.cartRenderer.updateSelectedIndicators();
    }
  }

  /** Meds column: Show meds for a non-nested specialty. */
  renderPreviewMeds(population, specialty) {
    const container = document.getElementById("rx-meds-list");
    const header = document.getElementById("rx-meds-header");
    if (!container || !header) return;

    header.textContent = specialty;
    container.innerHTML = "";

    // Hide subcategory column for non-nested specialties
    this.clearSubcategoryColumn();
    this._updateGridLayout("default");

    const meds = NavigationDataHelper.getMedications(this.state.medications, population, specialty);
    meds.forEach(med => {
      container.appendChild(this.medRenderer.createMedItem(med, { overlayActions: true }));
    });

    if (window.cartRenderer) {
      window.cartRenderer.updateSelectedIndicators();
    }
  }

  /** Clear meds column. */
  renderPreviewEmpty() {
    const container = document.getElementById("rx-meds-list");
    const header = document.getElementById("rx-meds-header");
    if (!container) return;
    if (header) header.textContent = "";
    container.innerHTML = "";
  }

  /** Clear subcategory column. */
  clearSubcategoryColumn() {
    const container = document.getElementById("rx-subcategory-list");
    const header = document.getElementById("rx-subcategory-header");
    if (container) container.innerHTML = "";
    if (header) header.textContent = "";
  }

  /** Navigate back to a specific level (pop navPath). */
  navigateBack(level) {
    this.state.nav.navPath = this.state.nav.navPath.slice(0, level);
    this.state.nav.col2Index = 0;
    this.state.nav.col3Index = -1;
    this.state.nav.col4Index = -1;
    this.animateBrowse("back");
  }

  /** Auto-select/highlight first item in Column 2 and update preview. */
  autoSelectFirst() {
    const container = document.getElementById("rx-specialty-list");
    if (!container) return;

    const items = container.querySelectorAll(".rx-folder-item, .med-item");
    if (items.length === 0) return;

    const idx = this.state.nav.col2Index;
    const target = idx >= 0 && idx < items.length ? idx : 0;
    this.state.nav.col2Index = target;
    this._highlightBrowseItem(target);

    const pop = this.state.nav.population;
    if (pop === "Non-Med") return;

    const specialties = NavigationDataHelper.getSpecialtiesForPopulation(this.state.medications, pop);
    if (specialties[target]) {
      if (NESTED_SPECIALTIES.includes(specialties[target])) {
        this.renderSubcategories(pop, specialties[target]);
      } else {
        this.renderPreviewMeds(pop, specialties[target]);
      }
    }
  }

  /** Update preview for the currently highlighted Column 2 item. */
  updatePreviewForIndex(index) {
    const pop = this.state.nav.population;
    if (pop === "Non-Med") return;

    const specialties = NavigationDataHelper.getSpecialtiesForPopulation(this.state.medications, pop);
    if (specialties[index]) {
      if (NESTED_SPECIALTIES.includes(specialties[index])) {
        this.renderSubcategories(pop, specialties[index]);
      } else {
        this.renderPreviewMeds(pop, specialties[index]);
      }
    }
  }

  /** Update meds preview for the currently highlighted subcategory item. */
  updateSubcategoryPreviewForIndex(index) {
    const pop = this.state.nav.population;
    const specialties = NavigationDataHelper.getSpecialtiesForPopulation(this.state.medications, pop);
    const specialty = specialties[this.state.nav.col2Index];
    if (!specialty || !NESTED_SPECIALTIES.includes(specialty)) return;

    const subs = NavigationDataHelper.getSubcategories(this.state.medications, pop, specialty);
    if (subs[index]) {
      this.renderSubcategoryMeds(pop, specialty, subs[index]);
    }
  }

  /** Slide animation for Column 2 (and Column 3) transitions. */
  animateBrowse(direction, onComplete) {
    const container = document.getElementById("rx-specialty-list");
    const ctxContainer = document.getElementById("rx-meds-list");

    // Skip animation if reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.renderBrowse();
      if (onComplete) onComplete();
      return;
    }

    // Capture old Column 2 content
    const scrollTop = container.scrollTop;
    const oldPanel = document.createElement("div");
    oldPanel.className = "rx-slide-panel";
    oldPanel.style.top = -scrollTop + "px";
    while (container.firstChild) oldPanel.appendChild(container.firstChild);

    // Capture old Column 3 content
    const ctxScrollTop = ctxContainer.scrollTop;
    const ctxOldPanel = document.createElement("div");
    ctxOldPanel.className = "rx-slide-panel";
    ctxOldPanel.style.top = -ctxScrollTop + "px";
    while (ctxContainer.firstChild) ctxOldPanel.appendChild(ctxContainer.firstChild);

    // Render new content (fills both columns)
    this.renderBrowse();

    // Wrap new Column 2 content
    const newPanel = document.createElement("div");
    newPanel.className = "rx-slide-panel";
    while (container.firstChild) newPanel.appendChild(container.firstChild);

    // Wrap new Column 3 content
    const ctxNewPanel = document.createElement("div");
    ctxNewPanel.className = "rx-slide-panel";
    while (ctxContainer.firstChild) ctxNewPanel.appendChild(ctxContainer.firstChild);

    // Lock and animate Column 2
    container.classList.add("is-animating");
    container.scrollTop = 0;
    container.appendChild(oldPanel);
    container.appendChild(newPanel);

    // Lock and animate Column 3
    ctxContainer.classList.add("is-animating");
    ctxContainer.scrollTop = 0;
    ctxContainer.appendChild(ctxOldPanel);
    ctxContainer.appendChild(ctxNewPanel);

    // Force layout to complete before starting animation so entire list renders
    void newPanel.offsetHeight;
    void ctxNewPanel.offsetHeight;

    if (direction === "forward") {
      oldPanel.classList.add("rx-slide-panel--exit-left");
      newPanel.classList.add("rx-slide-panel--enter-right");
      ctxOldPanel.classList.add("rx-slide-panel--exit-left");
      ctxNewPanel.classList.add("rx-slide-panel--enter-right");
    } else {
      oldPanel.classList.add("rx-slide-panel--exit-right");
      newPanel.classList.add("rx-slide-panel--enter-left");
      ctxOldPanel.classList.add("rx-slide-panel--exit-right");
      ctxNewPanel.classList.add("rx-slide-panel--enter-left");
    }

    // Cleanup Column 2
    newPanel.addEventListener("animationend", () => {
      container.classList.remove("is-animating");
      if (oldPanel.parentNode) oldPanel.remove();
      while (newPanel.firstChild) container.appendChild(newPanel.firstChild);
      newPanel.remove();
      if (onComplete) onComplete();
    }, { once: true });

    // Cleanup Column 3
    ctxNewPanel.addEventListener("animationend", () => {
      ctxContainer.classList.remove("is-animating");
      if (ctxOldPanel.parentNode) ctxOldPanel.remove();
      while (ctxNewPanel.firstChild) ctxContainer.appendChild(ctxNewPanel.firstChild);
      ctxNewPanel.remove();
    }, { once: true });
  }

  /** Create a folder item element. */
  _createFolderItem(name, count, hasArrow) {
    const div = document.createElement("div");
    div.className = "rx-folder-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "rx-folder-item__name";
    nameSpan.textContent = name;

    const countSpan = document.createElement("span");
    countSpan.className = "rx-folder-item__count";
    countSpan.textContent = count;

    div.appendChild(nameSpan);
    div.appendChild(countSpan);

    if (hasArrow) {
      const arrow = document.createElement("span");
      arrow.className = "rx-folder-item__arrow";
      arrow.textContent = "\u203A";
      div.appendChild(arrow);
    }

    return div;
  }

  /** Highlight the item at the given index in Column 2. */
  _highlightBrowseItem(index) {
    const container = document.getElementById("rx-specialty-list");
    if (!container) return;
    const items = container.querySelectorAll(".rx-folder-item, .med-item");
    items.forEach((item, i) => {
      item.classList.toggle("browse-highlighted", i === index);
    });
  }

  /** Highlight the item at the given index in the subcategory column. */
  _highlightSubcategoryItem(index) {
    const container = document.getElementById("rx-subcategory-list");
    if (!container) return;
    const items = container.querySelectorAll(".rx-folder-item");
    items.forEach((item, i) => {
      item.classList.toggle("browse-highlighted", i === index);
    });
  }

  /** Update grid layout mode: "non-med", "nested", or "default". */
  _updateGridLayout(mode) {
    const dashboard = document.getElementById("dashboardView");
    if (!dashboard) return;
    switch (mode) {
      case "non-med":
        dashboard.style.gridTemplateColumns = "120px 0px max-content 0px 0 0px 1fr";
        break;
      case "nested":
        dashboard.style.gridTemplateColumns = "120px 0px 180px 0px 220px 0px 1fr";
        break;
      default:
        dashboard.style.gridTemplateColumns = "";
        break;
    }
  }
}

// ============================================================================
// MOBILE FOLDER RENDERER (single column drill-down)
// ============================================================================

class MobileFolderRenderer {
  constructor(state, medRenderer) {
    this.state = state;
    this.medRenderer = medRenderer;
  }

  /** Render the current navigation level into the meds column. */
  renderCurrentLevel() {
    const container = document.getElementById("rx-meds-list");
    const header = document.getElementById("rx-meds-header");
    if (!container || !header) return;
    container.innerHTML = "";

    const nav = this.state.nav;

    // Level 0: Population selection
    if (!nav.population || nav.population === "") {
      header.textContent = "Population";
      POPULATION_ITEMS.forEach(pop => {
        const count = NavigationDataHelper.countMeds(this.state.medications, pop.key);
        const item = this._createMobileFolder(pop.label, count);
        item.addEventListener("click", () => {
          nav.population = pop.key;
          this.animateForward();
        });
        container.appendChild(item);
      });
      return;
    }

    // Non-Med: show items directly
    if (nav.population === "Non-Med") {
      this.renderMobileBreadcrumb();
      const meds = NavigationDataHelper.getNonMedMedications(this.state.medications);
      meds.forEach(med => {
        container.appendChild(this.medRenderer.createMedItem(med, { overlayActions: true }));
      });
      return;
    }

    // Level 1: Specialty folders (navPath empty)
    if (nav.navPath.length === 0) {
      this.renderMobileBreadcrumb();
      const specialties = NavigationDataHelper.getSpecialtiesForPopulation(this.state.medications, nav.population);
      specialties.forEach(spec => {
        const count = NavigationDataHelper.countMeds(this.state.medications, nav.population, spec);
        const item = this._createMobileFolder(spec, count);
        item.addEventListener("click", () => {
          nav.navPath = [spec];
          this.animateForward();
        });
        container.appendChild(item);
      });
      return;
    }

    // Level 2: Nested specialties show subcategory folders, non-nested show meds
    if (nav.navPath.length === 1) {
      this.renderMobileBreadcrumb();
      const specialty = nav.navPath[0];
      const isNested = NESTED_SPECIALTIES.includes(specialty);

      if (isNested) {
        // Show subcategory folders (user clicks into one to see meds)
        const subs = NavigationDataHelper.getSubcategories(this.state.medications, nav.population, specialty);
        subs.forEach(sub => {
          const count = NavigationDataHelper.getMedications(this.state.medications, nav.population, specialty, sub).length;
          const item = this._createMobileFolder(sub, count);
          item.addEventListener("click", () => {
            nav.navPath = [specialty, sub];
            this.animateForward();
          });
          container.appendChild(item);
        });
      } else {
        // Flat specialty: show meds
        const meds = NavigationDataHelper.getMedications(this.state.medications, nav.population, specialty);
        meds.forEach(med => {
          container.appendChild(this.medRenderer.createMedItem(med, { overlayActions: true }));
        });
        if (window.cartRenderer) {
          window.cartRenderer.updateSelectedIndicators();
        }
      }
      return;
    }

    // Level 3: Meds for a subcategory of a nested specialty
    if (nav.navPath.length === 2) {
      this.renderMobileBreadcrumb();
      const specialty = nav.navPath[0];
      const subcategory = nav.navPath[1];
      const meds = NavigationDataHelper.getMedications(this.state.medications, nav.population, specialty, subcategory);
      meds.forEach(med => {
        container.appendChild(this.medRenderer.createMedItem(med, { overlayActions: true }));
      });
      if (window.cartRenderer) {
        window.cartRenderer.updateSelectedIndicators();
      }
      return;
    }
  }

  /** Update the header with full breadcrumb path (e.g. Population › Adult › ENT › Ear). */
  renderMobileBreadcrumb() {
    const header = document.getElementById("rx-meds-header");
    if (!header) return;
    header.innerHTML = "";
    header.classList.add("rx-col__header--nav");

    const nav = this.state.nav;
    const parts = [];

    if (nav.population) {
      parts.push(nav.population);
    }
    nav.navPath.forEach(seg => parts.push(seg));

    if (parts.length === 0) {
      header.textContent = "Population";
      header.classList.remove("rx-col__header--nav");
      return;
    }

    // Full path: Population › Adult › ENT
    // Each segment except the last is clickable (navigates back to that level)
    const allSegments = ["Population", ...parts];

    allSegments.forEach((seg, i) => {
      const isLast = i === allSegments.length - 1;

      if (i > 0) {
        header.appendChild(this._sep());
      }

      const span = document.createElement("span");
      span.className = "rx-breadcrumb__item" + (isLast ? " rx-breadcrumb__item--current" : "");
      span.textContent = seg;

      if (!isLast) {
        // Clicking navigates back to this level
        const targetLevel = i; // 0 = Population root, 1 = population, 2 = specialty, 3 = subcategory
        span.addEventListener("click", () => {
          if (targetLevel === 0) {
            // Back to root (Level 0: population selection)
            nav.population = "";
            nav.navPath = [];
          } else if (targetLevel === 1) {
            // Back to specialty list (Level 1)
            nav.navPath = [];
          } else if (targetLevel === 2) {
            // Back to subcategory list (Level 2)
            nav.navPath = nav.navPath.slice(0, 1);
          }
          this.animateBack();
        });
      }

      header.appendChild(span);
    });
  }

  /** Navigate back one level. */
  goBack() {
    const nav = this.state.nav;
    if (nav.navPath.length > 0) {
      nav.navPath.pop();
    } else if (nav.population) {
      nav.population = "";
    }
    this.animateBack();
  }

  /** Slide forward animation. */
  animateForward() {
    this._animate("forward");
  }

  /** Slide back animation. */
  animateBack() {
    this._animate("back");
  }

  _animate(direction) {
    const container = document.getElementById("rx-meds-list");
    if (!container) { this.renderCurrentLevel(); return; }

    if (
      !container.children.length ||
      container.classList.contains("is-animating") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      this.renderCurrentLevel();
      return;
    }

    // Capture old content
    const scrollTop = container.scrollTop;
    const oldPanel = document.createElement("div");
    oldPanel.className = "rx-slide-panel";
    oldPanel.style.top = -scrollTop + "px";
    while (container.firstChild) oldPanel.appendChild(container.firstChild);

    // Render new content
    this.renderCurrentLevel();

    // Wrap new content
    const newPanel = document.createElement("div");
    newPanel.className = "rx-slide-panel";
    while (container.firstChild) newPanel.appendChild(container.firstChild);

    // Animate
    container.classList.add("is-animating");
    container.scrollTop = 0;
    container.appendChild(oldPanel);
    container.appendChild(newPanel);

    if (direction === "forward") {
      oldPanel.classList.add("rx-slide-panel--exit-left");
      newPanel.classList.add("rx-slide-panel--enter-right");
    } else {
      oldPanel.classList.add("rx-slide-panel--exit-right");
      newPanel.classList.add("rx-slide-panel--enter-left");
    }

    // Cleanup after animation (matches billing's animateBrowse exactly)
    newPanel.addEventListener("animationend", function () {
      container.classList.remove("is-animating");
      if (oldPanel.parentNode) oldPanel.remove();
      while (newPanel.firstChild) container.appendChild(newPanel.firstChild);
      newPanel.remove();
    }, { once: true });
  }

  _createMobileFolder(name, count, hasArrow = false) {
    const div = document.createElement("div");
    div.className = "rx-folder-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "rx-folder-item__name";
    nameSpan.textContent = name;

    const countSpan = document.createElement("span");
    countSpan.className = "rx-folder-item__count";
    countSpan.textContent = count;

    div.appendChild(nameSpan);
    div.appendChild(countSpan);

    if (hasArrow) {
      const arrow = document.createElement("span");
      arrow.className = "rx-folder-item__arrow";
      arrow.textContent = "\u203A";
      div.appendChild(arrow);
    }

    // All mobile folders show arrow (clickable)
    if (!hasArrow) {
      const arrow = document.createElement("span");
      arrow.className = "rx-folder-item__arrow";
      arrow.textContent = "\u203A";
      div.appendChild(arrow);
    }

    return div;
  }

  _sep() {
    const sep = document.createElement("span");
    sep.className = "rx-breadcrumb__sep";
    sep.textContent = "\u203A";
    return sep;
  }

  /** Check if we should handle folder-back (for Shell carousel coordination). */
  shouldHandleFolderBack() {
    const nav = this.state.nav;
    return nav.population !== "" && nav.population !== undefined;
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
      resultsContainer.innerHTML = `
        <div class="search-no-results">
          <span>No matches found.</span>
          <button id="addNewMedFromSearch" class="add-new-med-from-search-btn" type="button">
            Add new medication <span class="enter-symbol"></span>
          </button>
        </div>`;

      const addBtn = document.getElementById("addNewMedFromSearch");
      if (addBtn) {
        addBtn.onclick = () => {
          window.modalManager.openAddNewMed();
        };
      }
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

    // Set up sticky header shadow detection
    this.setupStickyHeaders(resultsContainer);
  }

  setupStickyHeaders(container) {
    const contentScroll = document.querySelector('.content-scroll');
    if (!contentScroll) return;

    const headers = container.querySelectorAll('.search-group-header');
    if (headers.length === 0) return;

    // Remove any existing scroll listener
    if (this._stickyScrollHandler) {
      contentScroll.removeEventListener('scroll', this._stickyScrollHandler);
    }

    this._stickyScrollHandler = () => {
      const scrollTop = contentScroll.scrollTop;
      const containerTop = container.getBoundingClientRect().top - contentScroll.getBoundingClientRect().top;

      headers.forEach(header => {
        const headerTop = header.offsetTop + containerTop;
        // Header is stuck when its natural position would be above the scroll position
        if (scrollTop > headerTop) {
          header.classList.add('is-stuck');
        } else {
          header.classList.remove('is-stuck');
        }
      });
    };

    contentScroll.addEventListener('scroll', this._stickyScrollHandler);
  }

  renderGroup(title, items, container, terms, onMedClick) {
    if (items.length === 0) return;

    const header = DOMBuilder.createElement('div', 'search-group-header', {
      innerHTML: `${title} <span class="group-count">(${items.length} result${items.length === 1 ? '' : 's'})</span>`
    });

    container.appendChild(header);

    items.forEach(med => {
      const item = this.medRenderer.createMedItem(med, {
        showPopulation: false,
        highlightTerms: terms,
        onClick: onMedClick,
        showActions: true
      });

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
    const badge = document.getElementById("cartBadge");
    const clearBtn = document.getElementById("clearCartBtn");
    const printBtn = document.getElementById("printBtn");

    const count = this.state.cart.length;

    // Update count label
    if (countLabel) {
      countLabel.textContent = `${count} prescription${count === 1 ? '' : 's'}`;
    }

    // Update badge
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    }

    // Update trash button visibility (hidden when empty)
    if (clearBtn) {
      if (count > 0) {
        clearBtn.classList.remove("hidden");
      } else {
        clearBtn.classList.add("hidden");
      }
    }

    // Update print button disabled state (disabled when empty)
    if (printBtn) {
      printBtn.disabled = count === 0;
    }

    // Update mobile weight badge
    const mobileWeightBadge = document.getElementById("mobileWeightBadge");
    if (mobileWeightBadge) {
      mobileWeightBadge.textContent = this.state.currentWeight
        ? this.state.currentWeight + "kg"
        : "";
    }

    // Render cart items or empty state
    if (count === 0) {
      cartList.innerHTML = `<div class="cart-empty">No medication added</div>`;
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

    // Build med name display - always include brand span (visibility controlled by CSS)
    let medNameDisplay = Utils.escapeHtml(med.med);
    if (med.brands && med.brands.length > 0) {
      const brandText = MedicationUtils.formatBrandNames(med.brands);
      medNameDisplay += ` <span class="brand-name">${Utils.escapeHtml(brandText)}</span>`;
    }

    const isMobile = Utils.isMobile();

    return `
      <div class="cart-item" data-uid="${med.uid}"${isMobile ? ` onclick="cartActions.toggleOverlay(this, event)"` : ""}>
        <div class="cart-item-overlay-actions">
          <button class="med-action-btn med-action-btn-edit" type="button" onclick="event.stopPropagation(); cartActions.dismissOverlay(this); cartActions.edit('${med.uid}')">Edit</button>
          <button class="med-action-btn med-action-btn-remove" type="button" onclick="event.stopPropagation(); cartActions.dismissOverlay(this); cartActions.remove('${med.uid}')">Remove</button>
        </div>
        <div class="cart-med-name">${medNameDisplay}</div>
        <div class="cart-med-details">${safeDetails}</div>
      </div>`;
  }

  updateSelectedIndicators() {
    document.querySelectorAll(".med-item").forEach(element => {
      const isSelected = this.state.cart.some(
        item => !item.wasEdited && MedicationUtils.getCartKey(item) === element.dataset.key
      );

      element.classList.toggle("in-cart", isSelected);

      // Update Add/Remove button state
      const addRemoveBtn = element.querySelector(".med-action-btn-add");
      if (addRemoveBtn) {
        if (isSelected) {
          addRemoveBtn.innerHTML = '<u class="shortcut-hint">R</u>emove';
          addRemoveBtn.classList.add("med-action-btn-remove");
        } else {
          addRemoveBtn.innerHTML = '<u class="shortcut-hint">A</u>dd';
          addRemoveBtn.classList.remove("med-action-btn-remove");
        }
      }
    });
  }
}

// ============================================================================
// LOCATION UI RENDERER
// ============================================================================

class LocationUIRenderer {
  constructor(locationManager) {
    this.locationManager = locationManager;
    this.isSearchMode = false;
    this.searchInput = null;
    this.dropdown = null;
    this.activeLocationIndex = -1; // Track highlighted item via keyboard
  }

  updateHeader() {
    const button = document.getElementById("locationBtn");
    const locationName = this.locationManager.state.currentLocationName;
    
    if (!this.isSearchMode) {
      button.innerHTML = `<span class="loc-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 23C8 17 4 14 4 10A8 8 0 1 1 20 10C20 14 16 17 12 23ZM12 7A3 3 0 1 0 12 13A3 3 0 1 0 12 7Z"/></svg></span><span class="loc-label">${Utils.escapeHtml(locationName)}</span> <span class="arrow">▼</span>`;
    }
  }

  enterSearchMode(onSelect, onDelete, onAddNew) {
    const button = document.getElementById("locationBtn");
    const wrapper = document.getElementById("locationWrapper") || button.parentElement;

    this.isSearchMode = true;
    this.activeLocationIndex = -1; // Reset keyboard navigation

    // Add search-active class to wrapper (keeps it above backdrop)
    wrapper.classList.add("search-active");
    wrapper.classList.add("typing-mode"); // Start in typing mode

    // Replace button content with search input
    button.innerHTML = `<input id="locationSearchInput" type="text" class="location-search-input" placeholder="Search hospital" autocomplete="off" />`;

    // Add close button on mobile
    if (Utils.isMobile()) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "mobile-location-close";
      closeBtn.type = "button";
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.exitSearchMode();
      });
      button.appendChild(closeBtn);
    }

    this.searchInput = document.getElementById("locationSearchInput");
    
    // Create dropdown if it doesn't exist
    this.createDropdown(wrapper);
    
    // Show dropdown with initial results (first 10 alphabetically)
    this.updateDropdownResults("", onSelect, onDelete, onAddNew);
    this.showDropdown();
    
    // Scroll to currently selected location
    this.scrollToSelectedLocation();
    
    // Focus the search input immediately
    this.searchInput.focus();
    
    // Setup search input listeners
    this.searchInput.addEventListener("input", (e) => {
      this.activeLocationIndex = -1; // Reset navigation on new search
      // Switch back to typing mode when user types
      wrapper.classList.add("typing-mode");
      this.updateDropdownResults(e.target.value, onSelect, onDelete, onAddNew);
    });
    
    // Prevent button click from triggering while in search mode
    this.searchInput.addEventListener("click", (e) => {
      e.stopPropagation();
      // Restore typing mode when clicking back into input
      wrapper.classList.add("typing-mode");
    });

    // Restore typing mode when focusing the input
    this.searchInput.addEventListener("focus", () => {
      wrapper.classList.add("typing-mode");
    });
    
    // Handle keyboard navigation
    this.searchInput.addEventListener("keydown", (e) => {
      // Stop all keydown events from bubbling to the parent button
      e.stopPropagation();

      // Special handling for space to prevent button click but allow typing
      if (e.key === " ") {
        e.preventDefault();
        // Manually insert space at cursor position
        const start = this.searchInput.selectionStart;
        const end = this.searchInput.selectionEnd;
        const value = this.searchInput.value;
        this.searchInput.value = value.substring(0, start) + " " + value.substring(end);
        this.searchInput.selectionStart = this.searchInput.selectionEnd = start + 1;
        // Trigger input event to update search results
        this.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.exitSearchMode();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        // Switch to navigation mode (remove typing mode)
        wrapper.classList.remove("typing-mode");
        this.navigateLocations("down", onSelect, onDelete, onAddNew);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        // Switch to navigation mode (remove typing mode)
        wrapper.classList.remove("typing-mode");
        this.navigateLocations("up", onSelect, onDelete, onAddNew);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        this.selectActiveLocation(onSelect);
      }
    });
  }

  navigateLocations(direction, onSelect, onDelete, onAddNew) {
    const items = this.dropdown.querySelectorAll(".loc-search-item");
    if (items.length === 0) return;

    if (direction === "down") {
      // Move down, but stop at last item
      this.activeLocationIndex = Math.min(
        this.activeLocationIndex + 1,
        items.length - 1
      );
    } else if (direction === "up") {
      // Move up, but stop at first item
      this.activeLocationIndex = Math.max(
        this.activeLocationIndex - 1,
        0
      );
    }

    this.updateActiveLocationItem(items, direction);
  }

  updateActiveLocationItem(items, direction = null, focusItem = true) {
    items.forEach((element, index) => {
      if (index === this.activeLocationIndex) {
        element.classList.add("is-active");

        // Only focus and scroll if focusItem is true (keyboard navigation)
        if (focusItem) {
          // Prevent automatic scroll on focus to avoid flickering
          element.focus({ preventScroll: true });

          // Check if element is already visible in the dropdown
          const dropdownResults = this.dropdown.querySelector(".location-search-results");
          const elementRect = element.getBoundingClientRect();
          const containerRect = dropdownResults.getBoundingClientRect();

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
        }
      } else {
        element.classList.remove("is-active");
      }
    });
  }

  selectActiveLocation(onSelect) {
    const items = this.dropdown.querySelectorAll(".loc-search-item");
    
    // If only one result, auto-select it
    if (items.length === 1) {
      const locationName = items[0].querySelector(".loc-search-name").textContent;
      onSelect(locationName);
      this.exitSearchMode();
      return true;
    }
    
    // If an item is highlighted via keyboard
    if (this.activeLocationIndex >= 0 && items[this.activeLocationIndex]) {
      const locationName = items[this.activeLocationIndex].querySelector(".loc-search-name").textContent;
      onSelect(locationName);
      this.exitSearchMode();
      return true;
    }

    return false;
  }

  scrollToSelectedLocation() {
    const currentName = this.locationManager.state.currentLocationName;

    // Use setTimeout to ensure the dropdown is rendered
    setTimeout(() => {
      const items = this.dropdown.querySelectorAll(".loc-search-item");
      items.forEach((item, index) => {
        const nameSpan = item.querySelector(".loc-search-name");
        if (nameSpan && nameSpan.textContent === currentName) {
          // On mobile, position as 3rd row so it's visible above keyboard
          if (Utils.isMobile() && index >= 2) {
            const scrollContainer = this.dropdown.querySelector(".location-search-results") || this.dropdown;
            const targetItem = items[index - 2];
            scrollContainer.scrollTop = targetItem.offsetTop - scrollContainer.offsetTop;
          } else {
            item.scrollIntoView({ block: "center", behavior: "smooth" });
          }
          // Set active index so arrow keys continue from this position
          this.activeLocationIndex = index;
          // Apply visual highlight with enter hint (don't steal focus from search input)
          this.updateActiveLocationItem(Array.from(items), null, false);
        }
      });
    }, 50);
  }

  exitSearchMode() {
    if (!this.isSearchMode) return;

    this.isSearchMode = false;
    this.activeLocationIndex = -1; // Reset navigation state

    // Remove search mode classes from wrapper
    const wrapper = document.getElementById("locationWrapper");
    if (wrapper) {
      wrapper.classList.remove("search-active");
      wrapper.classList.remove("typing-mode");
      wrapper.classList.remove("mobile-location-active");
    }

    // Remove body/html lock classes (mobile location takeover)
    document.body.classList.remove("mobile-location-active");
    document.documentElement.classList.remove("mobile-location-active");

    this.hideDropdown();
    this.updateHeader();
  }

  createDropdown(wrapper) {
    // Remove existing dropdown if any
    const existingDropdown = document.getElementById("locationSearchDropdown");
    if (existingDropdown) {
      existingDropdown.remove();
    }
    
    // Create new dropdown
    this.dropdown = document.createElement("div");
    this.dropdown.id = "locationSearchDropdown";
    this.dropdown.className = "location-search-dropdown hidden";
    
    this.dropdown.innerHTML = `
      <div class="location-search-results"></div>
      <div class="location-search-footer">
        <button id="dropdownAddLocationBtn" class="btn btn-sm" type="button">+ Add New Location</button>
      </div>
    `;
    
    wrapper.appendChild(this.dropdown);
  }

  showDropdown() {
    if (this.dropdown) {
      this.dropdown.classList.remove("hidden");
    }
    this.showBackdrop();
  }

  hideDropdown() {
    if (this.dropdown) {
      this.dropdown.classList.add("hidden");
    }
    this.hideBackdrop();
  }

  showBackdrop() {
    let backdrop = document.getElementById("locationSearchBackdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = "locationSearchBackdrop";
      backdrop.className = "location-search-backdrop";
      backdrop.addEventListener("click", () => this.exitSearchMode());
      document.body.appendChild(backdrop);
    }
    backdrop.classList.remove("hidden");
  }

  hideBackdrop() {
    const backdrop = document.getElementById("locationSearchBackdrop");
    if (backdrop) {
      backdrop.classList.add("hidden");
    }
  }

  updateDropdownResults(query, onSelect, onDelete, onAddNew) {
    if (!this.dropdown) return;
    
    const resultsContainer = this.dropdown.querySelector(".location-search-results");
    const matches = this.locationManager.searchLocations(query);
    const currentName = this.locationManager.state.currentLocationName;
    
    resultsContainer.innerHTML = "";
    
    // Create result items (up to 10 visible, rest scrollable)
    matches.forEach((location, index) => {
      const isCustom = this.locationManager.isCustomLocation(location.name);
      const isSelected = location.name === currentName;

      const div = document.createElement("div");
      div.className = `loc-search-item ${isSelected ? 'selected' : ''}`;
      div.tabIndex = 0; // Make focusable for keyboard navigation

      const span = document.createElement("span");
      span.className = "loc-search-name";
      span.textContent = location.name;
      div.appendChild(span);

      // Add enter hint icon (visible only when item is active)
      const enterHint = document.createElement("span");
      enterHint.className = "loc-enter-hint";
      div.appendChild(enterHint);

      // Show delete button only for custom locations
      if (isCustom) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "loc-delete-btn";
        deleteBtn.innerHTML = "&times;";
        deleteBtn.title = "Delete Location";
        deleteBtn.type = "button";
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          onDelete(location.name);
          // Refresh results after deletion
          this.updateDropdownResults(query, onSelect, onDelete, onAddNew);
        };
        div.appendChild(deleteBtn);
      }
      
      div.onclick = () => {
        onSelect(location.name);
        this.exitSearchMode();
      };
      
      // Handle keyboard events on location items
      div.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onSelect(location.name);
          this.exitSearchMode();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          this.exitSearchMode();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          const items = Array.from(this.dropdown.querySelectorAll(".loc-search-item"));
          const currentIndex = items.indexOf(div);
          if (currentIndex < items.length - 1) {
            this.activeLocationIndex = currentIndex + 1;
            this.updateActiveLocationItem(items, "down");
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const items = Array.from(this.dropdown.querySelectorAll(".loc-search-item"));
          const currentIndex = items.indexOf(div);
          if (currentIndex > 0) {
            this.activeLocationIndex = currentIndex - 1;
            this.updateActiveLocationItem(items, "up");
          }
        } else if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
          // Letter jump: find first location starting with this letter
          e.preventDefault();
          const char = e.key.toLowerCase();
          const items = Array.from(this.dropdown.querySelectorAll(".loc-search-item"));

          for (let i = 0; i < items.length; i++) {
            const nameSpan = items[i].querySelector(".loc-search-name");
            if (nameSpan && nameSpan.textContent.trim().toLowerCase().startsWith(char)) {
              this.activeLocationIndex = i;
              // Use "up" direction to align matched item to top of dropdown
              this.updateActiveLocationItem(items, "up");
              break;
            }
          }
        }
      });
      
      resultsContainer.appendChild(div);
    });

    // Auto-highlight if there's exactly one match (don't steal focus from search input)
    if (matches.length === 1) {
      this.activeLocationIndex = 0;
      const items = resultsContainer.querySelectorAll(".loc-search-item");
      this.updateActiveLocationItem(Array.from(items), null, false);
    }

    // If no results, show a message
    if (matches.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "loc-search-no-results";
      noResults.textContent = "No hospitals found";
      resultsContainer.appendChild(noResults);
    }
    
    // Setup add new location button
    const addBtn = this.dropdown.querySelector("#dropdownAddLocationBtn");
    addBtn.onclick = (e) => {
      e.stopPropagation();
      this.exitSearchMode();
      onAddNew();
    };
  }

  toggleMenu(onSelect, onDelete, onAddNew) {
    if (this.isSearchMode) {
      this.exitSearchMode();
    } else {
      this.enterSearchMode(onSelect, onDelete, onAddNew);
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

    if (provider.name && provider.cpso) {
      label.textContent = `Dr. ${provider.name}`;
      btn.title = `${provider.name} (CPSO: ${provider.cpso})`;
    } else {
      label.textContent = "Set Provider";
      btn.title = "Click to set your provider information";
    }
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

  _clearFields(ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
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

    // On mobile, use the same top takeover styling as the weight button
    if (Utils.isMobile()) {
      document.body.classList.add("mobile-weight-active");
      document.documentElement.classList.add("mobile-weight-active");
      const title = document.getElementById("weightModalTitle");
      if (title) title.style.display = "none";

      // Inject close button if not present
      const inputGroup = modal.querySelector(".modal-input-group");
      if (inputGroup && !modal.querySelector(".mobile-weight-close")) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "mobile-weight-close";
        closeBtn.type = "button";
        closeBtn.innerHTML = "&times;";
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.skipWeight(() => {});
        });
        inputGroup.appendChild(closeBtn);
      }
    }

    input.value = "";
    modal.classList.remove("hidden");
    input.focus();

    // Do NOT trap focus for weight modal - we want Tab to be completely disabled
    // (handled in KeyboardController)
  }

  closeWeight() {
    this.removeFocusTrap();
    document.getElementById("weightModal").classList.add("hidden");

    // Clean up mobile takeover if active
    document.body.classList.remove("mobile-weight-active");
    document.documentElement.classList.remove("mobile-weight-active");
    const title = document.getElementById("weightModalTitle");
    if (title) title.style.display = "";
    const closeBtn = document.querySelector(".mobile-weight-close");
    if (closeBtn) closeBtn.remove();

    // Dismiss any open med action overlays
    document.querySelectorAll(".med-item.mobile-actions-open").forEach(el =>
      el.classList.remove("mobile-actions-open")
    );

    // Return focus to active search item
    const results = document.querySelectorAll("#searchResults .med-item");
    if (this.state.activeSearchIndex >= 0 && results[this.state.activeSearchIndex]) {
      results[this.state.activeSearchIndex].focus();
    }
  }

  saveWeight(onSuccess) {
    const input = document.getElementById("modalWeightInput");
    const value = parseFloat(input.value);
    const MIN_WEIGHT = 0.01;
    const MAX_WEIGHT = 500;

    // Mobile weight mode: just set weight and close, no pending med
    if (this.state._mobileWeightMode) {
      if (!isNaN(value) && value >= MIN_WEIGHT && value <= MAX_WEIGHT) {
        this.state.setWeight(value);
        document.getElementById("weightInput").value = value.toFixed(2);
      } else if (!isNaN(value) && value > MAX_WEIGHT) {
        alert(`Weight cannot exceed ${MAX_WEIGHT} kg. Please enter a valid weight.`);
        return;
      } else {
        alert("Please enter a valid weight greater than 0 kg.");
        return;
      }
      this._resetMobileWeightModal();
      this.closeWeight();
      if (window.cartController) window.cartController.render();
      if (window.app) window.app.updateMobileWeightBadge();
      return;
    }

    if (!isNaN(value) && value >= MIN_WEIGHT && value <= MAX_WEIGHT) {
      this.state.setWeight(value);
      document.getElementById("weightInput").value = value.toFixed(2);

      if (this.state.pendingMed) {
        const med = this.state.pendingMed;
        this.state.pendingMed = null;

        // Check if in search edit mode - use stored callback
        if (this.state.isSearchEditMode && this.state.searchEditCallback) {
          const callback = this.state.searchEditCallback;
          this.closeWeight();
          callback(med);
        }
        // Check if in quick-print mode - use stored callback
        else if (this.state.isQuickPrintMode && this.state.quickPrintCallback) {
          const callback = this.state.quickPrintCallback;
          this.closeWeight();
          callback(med);
        } else {
          onSuccess(med);
          this.closeWeight();
        }
      } else {
        this.closeWeight();
      }
    } else if (!isNaN(value) && value > MAX_WEIGHT) {
      alert(`Weight cannot exceed ${MAX_WEIGHT} kg. Please enter a valid weight.`);
    } else {
      alert("Please enter a valid weight greater than 0 kg.");
    }
  }

  _resetMobileWeightModal() {
    this.state._mobileWeightMode = false;

    // Remove body/html takeover classes
    document.body.classList.remove("mobile-weight-active");
    document.documentElement.classList.remove("mobile-weight-active");

    const title = document.getElementById("weightModalTitle");
    const saveBtn = document.getElementById("modalSaveBtn");
    const skipBtn = document.getElementById("modalSkipBtn");
    if (title) {
      title.innerHTML = "Medication is weight-based.<br>Enter weight to calculate dose.";
      title.style.display = "";
    }
    if (saveBtn) saveBtn.textContent = "Calculate & Add";
    if (skipBtn) skipBtn.textContent = "Skip";

    // Remove injected close button
    const closeBtn = document.querySelector(".mobile-weight-close");
    if (closeBtn) closeBtn.remove();
  }

  skipWeight(onSkip) {
    // Mobile weight mode: clear weight and close
    if (this.state._mobileWeightMode) {
      this.state.setWeight(null);
      document.getElementById("weightInput").value = "";
      this._resetMobileWeightModal();
      this.closeWeight();
      if (window.cartController) window.cartController.render();
      if (window.app) window.app.updateMobileWeightBadge();
      return;
    }

    if (this.state.pendingMed) {
      const med = this.state.pendingMed;
      this.state.pendingMed = null;

      // Check if in search edit mode - use stored callback
      if (this.state.isSearchEditMode && this.state.searchEditCallback) {
        const callback = this.state.searchEditCallback;
        this.closeWeight();
        callback(med);
      }
      // Check if in quick-print mode - use stored callback
      else if (this.state.isQuickPrintMode && this.state.quickPrintCallback) {
        const callback = this.state.quickPrintCallback;
        this.closeWeight();
        callback(med);
      } else {
        onSkip(med);
        this.closeWeight();
      }
    } else {
      this.closeWeight();
    }
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
    
    // Show medication name field only for custom meds
    const medNameRow = document.getElementById("editMedNameRow");
    const medNameInput = document.getElementById("editMedName");
    if (item.isCustomMed) {
      medNameRow.classList.remove("hidden");
      medNameInput.value = item.med || "";
    } else {
      medNameRow.classList.add("hidden");
      medNameInput.value = "";
    }
    
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
    const fields = item.isCustomMed 
      ? ["editMedName", "editDose", "editRoute", "editFreq", "editDur", "editDispense", "editRefill", "editForm", "editPrn", "editComments"]
      : ["editDose", "editRoute", "editFreq", "editDur", "editDispense", "editRefill", "editForm", "editPrn", "editComments"];
    
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
    const item = this.state.findCartItem(this.state.editingId);
    const updates = {
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
    };
    
    // Update medication name for custom meds
    if (item && item.isCustomMed) {
      const medName = document.getElementById("editMedName").value.trim();
      if (!medName) {
        alert("Medication name is required.");
        return;
      }
      updates.med = medName;
    }
    
    if (window.undoManager) {
      const editItem = this.state.findCartItem(this.state.editingId);
      window.undoManager.snapshot(`edited ${editItem?.med || 'item'}`);
    }
    this.state.updateCartItem(this.state.editingId, updates);
    this.closeEdit();
  }

  closeEdit() {
    this.removeFocusTrap();
    document.getElementById("editModal").classList.add("hidden");
    this.state.editingId = null;
  }

  // Location Modal
  openLocation() {
    this._clearFields(["newLocName", "newLocAddress"]);

    const modal = document.getElementById("locationModal");

    // Mobile top-sheet mode
    if (Utils.isMobile()) {
      document.body.classList.add("mobile-addlocation-active");
      document.documentElement.classList.add("mobile-addlocation-active");

      // Inject close button into first input group
      const firstGroup = modal.querySelector(".modal-input-group");
      if (firstGroup && !firstGroup.querySelector(".mobile-addloc-close")) {
        const closeBtn = document.createElement("button");
        closeBtn.className = "mobile-addloc-close";
        closeBtn.type = "button";
        closeBtn.innerHTML = "&times;";
        closeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.closeLocation();
        });
        firstGroup.appendChild(closeBtn);
      }
    }

    modal.classList.remove("hidden");
    document.getElementById("newLocName").focus();

    // Trap focus in modal
    this.trapFocus(modal);
  }

  closeLocation() {
    this.removeFocusTrap();
    const modal = document.getElementById("locationModal");
    modal.classList.add("hidden");

    // Clean up mobile top-sheet
    document.body.classList.remove("mobile-addlocation-active");
    document.documentElement.classList.remove("mobile-addlocation-active");
    const closeBtn = modal.querySelector(".mobile-addloc-close");
    if (closeBtn) closeBtn.remove();
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

  // Provider Edit Dropdown (inline form)
  openProvider(currentProvider = null) {
    const nameInput = document.getElementById("newProviderName");
    const cpsoInput = document.getElementById("newProviderCpso");
    const backdrop = document.getElementById("providerEditBackdrop");
    const dropdown = document.getElementById("providerEditDropdown");
    const wrapper = document.querySelector(".provider-wrapper");

    // Default placeholders
    const defaultNamePlaceholder = "e.g. John Smith";
    const defaultCpsoPlaceholder = "e.g. 123456";

    // Clear field values
    nameInput.value = "";
    cpsoInput.value = "";

    // If there's existing provider info, show it as placeholder
    const hasExistingProvider = currentProvider && currentProvider.name && currentProvider.cpso;
    if (hasExistingProvider) {
      nameInput.placeholder = currentProvider.name;
      cpsoInput.placeholder = currentProvider.cpso;
    } else {
      nameInput.placeholder = defaultNamePlaceholder;
      cpsoInput.placeholder = defaultCpsoPlaceholder;
    }

    // Remove any existing listeners to avoid duplicates
    if (this.providerInputHandler) {
      nameInput.removeEventListener("input", this.providerInputHandler);
      cpsoInput.removeEventListener("input", this.providerInputHandler);
    }

    // Add listener to clear both placeholders when user types in either field
    if (hasExistingProvider) {
      this.providerInputHandler = () => {
        nameInput.placeholder = defaultNamePlaceholder;
        cpsoInput.placeholder = defaultCpsoPlaceholder;
        // Remove listeners after first input
        nameInput.removeEventListener("input", this.providerInputHandler);
        cpsoInput.removeEventListener("input", this.providerInputHandler);
      };
      nameInput.addEventListener("input", this.providerInputHandler);
      cpsoInput.addEventListener("input", this.providerInputHandler);
    }

    // Show backdrop and dropdown with animation
    backdrop.classList.remove("hidden");
    dropdown.classList.remove("hidden");
    dropdown.classList.add("animating");
    wrapper.classList.add("edit-active");

    // Remove animating class after animation completes
    setTimeout(() => {
      dropdown.classList.remove("animating");
    }, 400);

    nameInput.focus();

    // Trap focus in dropdown
    this.trapFocus(dropdown);
  }

  closeProvider() {
    this.removeFocusTrap();
    const backdrop = document.getElementById("providerEditBackdrop");
    const dropdown = document.getElementById("providerEditDropdown");
    const wrapper = document.querySelector(".provider-wrapper");

    backdrop.classList.add("hidden");
    dropdown.classList.add("hidden");
    if (wrapper) wrapper.classList.remove("edit-active");

    // Clean up mobile provider mode
    document.body.classList.remove("mobile-provider-active");
    document.documentElement.classList.remove("mobile-provider-active");

    // Remove mobile close button
    if (dropdown) {
      const closeBtn = dropdown.querySelector(".mobile-provider-close");
      if (closeBtn) closeBtn.remove();
    }

    // On mobile, move dropdown back to its original parent if it was moved to body
    if (dropdown && dropdown.parentElement === document.body && wrapper) {
      wrapper.appendChild(dropdown);
    }
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

  // Add New Med Modal
  openAddNewMed() {
    this.state.tabbingUnlocked = true; // Unlock tabbing immediately since we auto-focus
    
    const fields = ["addMedName", "addDose", "addRoute", "addFreq", "addDur", "addDispense", "addRefill", "addForm", "addPrn", "addComments"];
    this._clearFields(fields);
    fields.forEach(id => {
      document.getElementById(id).onclick = () => {
        this.state.tabbingUnlocked = true;
      };
    });
    
    const modal = document.getElementById("addNewMedModal");
    modal.classList.remove("hidden");
    
    // Focus on medication name field
    setTimeout(() => {
      document.getElementById("addMedName").focus();
    }, 0);
    
    // Trap focus in modal
    this.trapFocus(modal);
  }

  saveAddNewMed(onSuccess) {
    const medName = document.getElementById("addMedName").value.trim();
    
    if (!medName) {
      alert("Medication name is required.");
      return;
    }
    
    const newMed = {
      med: medName,
      dose_text: document.getElementById("addDose").value,
      route: document.getElementById("addRoute").value,
      frequency: document.getElementById("addFreq").value,
      duration: document.getElementById("addDur").value,
      dispense: document.getElementById("addDispense").value,
      refill: document.getElementById("addRefill").value,
      form: document.getElementById("addForm").value,
      prn: document.getElementById("addPrn").value,
      comments: document.getElementById("addComments").value,
      isCustomMed: true,
      wasEdited: false
    };
    
    onSuccess(newMed);
    this.closeAddNewMed();
  }

  closeAddNewMed() {
    this.removeFocusTrap();
    document.getElementById("addNewMedModal").classList.add("hidden");
  }

  // Search Edit Modal - for editing medications from search results
  // Stores the original medication being edited (fresh from database each time)
  openSearchEdit(medication, calculatedDose = null) {
    // Store the original medication for reference
    this.state.searchEditMed = medication;
    this.state.searchEditCalculatedDose = calculatedDose;

    // Populate form fields with fresh database values
    document.getElementById("searchEditMedName").value = medication.med || "";

    // Use calculated dose if provided (for weight-based meds), otherwise use original dose
    if (calculatedDose) {
      document.getElementById("searchEditDose").value = calculatedDose;
    } else {
      document.getElementById("searchEditDose").value = medication.dose_text || "";
    }

    document.getElementById("searchEditRoute").value = medication.route || "";
    document.getElementById("searchEditFreq").value = medication.frequency || "";
    document.getElementById("searchEditDur").value = medication.duration || "";
    document.getElementById("searchEditDispense").value = medication.dispense || "";
    document.getElementById("searchEditRefill").value = medication.refill || "";
    document.getElementById("searchEditForm").value = medication.form || "";
    document.getElementById("searchEditPrn").value = medication.prn || "";
    document.getElementById("searchEditComments").value = medication.comments || "";

    // Show the modal
    const modal = document.getElementById("searchEditModal");
    modal.classList.remove("hidden");

    // Enable buttons (they may have been disabled from previous print)
    document.getElementById("cancelSearchEditBtn").disabled = false;
    document.getElementById("addToCartSearchEditBtn").disabled = false;
    document.getElementById("printSearchEditBtn").disabled = false;
  }

  closeSearchEdit() {
    this.removeFocusTrap();
    document.getElementById("searchEditModal").classList.add("hidden");
    this.state.searchEditMed = null;
    this.state.searchEditCalculatedDose = null;
  }

  /**
   * Get the current values from the search edit modal form
   * Returns a medication object with all the edited values
   */
  getSearchEditValues() {
    const originalMed = this.state.searchEditMed || {};

    return {
      // Keep original metadata that isn't editable
      specialty: originalMed.specialty,
      subcategory: originalMed.subcategory,
      population: originalMed.population,
      indication: originalMed.indication,
      brands: originalMed.brands,
      weight_based: originalMed.weight_based,
      dose_per_kg_mg: originalMed.dose_per_kg_mg,
      max_dose_mg: originalMed.max_dose_mg,

      // Editable fields from the form
      med: document.getElementById("searchEditMedName").value.trim(),
      dose_text: document.getElementById("searchEditDose").value.trim(),
      route: document.getElementById("searchEditRoute").value.trim(),
      frequency: document.getElementById("searchEditFreq").value.trim(),
      duration: document.getElementById("searchEditDur").value.trim(),
      dispense: document.getElementById("searchEditDispense").value.trim(),
      refill: document.getElementById("searchEditRefill").value.trim(),
      form: document.getElementById("searchEditForm").value.trim(),
      prn: document.getElementById("searchEditPrn").value.trim(),
      comments: document.getElementById("searchEditComments").value.trim(),

      // Mark as edited if any field differs from original
      wasEdited: true
    };
  }

  /**
   * Validate search edit form - currently just checks that name is not empty
   * Returns { valid: boolean, message: string }
   */
  validateSearchEdit() {
    const name = document.getElementById("searchEditMedName").value.trim();
    if (!name) {
      return { valid: false, message: "Please enter a medication name." };
    }
    return { valid: true, message: "" };
  }

  /**
   * Disable all buttons in the search edit modal (during print)
   */
  disableSearchEditButtons() {
    document.getElementById("cancelSearchEditBtn").disabled = true;
    document.getElementById("addToCartSearchEditBtn").disabled = true;
    document.getElementById("printSearchEditBtn").disabled = true;
  }

  /**
   * Enable all buttons in the search edit modal
   */
  enableSearchEditButtons() {
    document.getElementById("cancelSearchEditBtn").disabled = false;
    document.getElementById("addToCartSearchEditBtn").disabled = false;
    document.getElementById("printSearchEditBtn").disabled = false;
  }
}

// ============================================================================
// EXPORT FOR USE
// ============================================================================

window.DOMBuilder = DOMBuilder;
window.MedicationRenderer = MedicationRenderer;
window.FolderNavigationRenderer = FolderNavigationRenderer;
window.MobileFolderRenderer = MobileFolderRenderer;
window.SearchResultsRenderer = SearchResultsRenderer;
window.CartRenderer = CartRenderer;
window.LocationUIRenderer = LocationUIRenderer;
window.ProviderUIRenderer = ProviderUIRenderer;
window.ModalManager = ModalManager;

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
  prescriber: {
    name: "Alvin Yang",
    cpso: "118749"
  },
  defaultLocation: "Michael Garron Hospital",
  storage: {
    locations: "rx_custom_locations",
    currentLocation: "rx_current_location",
    provider: "edprescriptions_provider"
  }
};

// Fallback location if JSON fails to load
const FALLBACK_LOCATION = { name: "Michael Garron Hospital", address: "825 Coxwell Ave, East York, M4C 3E7" };

// Will be populated from Locations.json
let BASE_LOCATIONS = [FALLBACK_LOCATION];

const SPECIALTY_COLUMNS = {
  col1: ["Add New Med", "Neuro & Endocrine", "Cardiac & Heme", "OBGYN", "Substance Use"],
  col2: ["Allergy, Analgesia, Antiemetic", "ENT", "Respiratory", "STI", "Psych"],
  col3: ["Anti-infective", "Eye", "GI & GU", "Derm", "Non-Med"]
};

const NESTED_SPECIALTIES = ["Allergy, Analgesia, Antiemetic", "ENT", "GI & GU"];

const SORT_ORDER = {
  subcategory: {
    "Ear": 1, "Nose": 2, "Throat": 3, "Other": 4,
    "Allergy": 1, "Analgesia": 2, "Antiemetic": 3,
    "GI": 1, "GU": 2,
    "Withdrawal Management": 1, "Symptom Relief": 2
  },
  population: { "Adult": 1, "Pediatric": 2 }
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

class AppState {
  constructor() {
    this.medications = [];
    this.cart = [];
    this.currentWeight = null;
    this.pendingMed = null;
    this.customLocations = [];
    this.currentLocationName = CONFIG.defaultLocation;
    this.editingId = null;
    this.tabbingUnlocked = false;
    this.activeSearchIndex = -1;
    this.showingBrands = false;
  }

  addToCart(medication) {
    const entry = {
      ...JSON.parse(JSON.stringify(medication)),
      uid: crypto.randomUUID(),
      wasEdited: false,
      isCustomMed: medication.isCustomMed || false
    };
    this.cart.push(entry);
  }

  removeFromCart(uid) {
    const index = this.cart.findIndex(item => item.uid === uid);
    if (index >= 0) {
      this.cart.splice(index, 1);
    }
  }

  clearCart() {
    this.cart = [];
  }

  findCartItem(uid) {
    return this.cart.find(item => item.uid === uid);
  }

  updateCartItem(uid, updates) {
    const item = this.findCartItem(uid);
    if (item) {
      Object.assign(item, updates);
    }
  }

  setWeight(weight) {
    this.currentWeight = weight && !isNaN(weight) && weight > 0 ? weight : null;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const Utils = {
  normalize(value) {
    return (value ?? "").toString().trim();
  },

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return (text ?? "").toString().replace(/[&<>"']/g, char => map[char]);
  },

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  // DOM Helper Methods
  getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with id "${id}" not found`);
    }
    return element;
  },

  getElementRequired(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Required element with id "${id}" not found`);
    }
    return element;
  },

  queryElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`Element with selector "${selector}" not found`);
    }
    return element;
  },

  queryElements(selector) {
    return document.querySelectorAll(selector);
  },

  safeSetValue(id, value) {
    const element = this.getElement(id);
    if (element && 'value' in element) {
      element.value = value;
    }
  },

  safeAddClass(id, className) {
    const element = this.getElement(id);
    if (element) {
      element.classList.add(className);
    }
  },

  safeRemoveClass(id, className) {
    const element = this.getElement(id);
    if (element) {
      element.classList.remove(className);
    }
  },

  safeToggleClass(id, className, force) {
    const element = this.getElement(id);
    if (element) {
      element.classList.toggle(className, force);
    }
  },

  safeFocus(id) {
    const element = this.getElement(id);
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  },

  highlightText(text, terms) {
    const cleanText = (text ?? "").toString();
    if (!terms || terms.length === 0) {
      return Utils.escapeHtml(cleanText);
    }

    const pattern = new RegExp(`(${terms.map(Utils.escapeRegex).join('|')})`, 'gi');
    const parts = cleanText.split(pattern);

    return parts.map(part => {
      if (terms.some(term => term.toLowerCase() === part.toLowerCase())) {
        return `<span class="highlight">${Utils.escapeHtml(part)}</span>`;
      }
      return Utils.escapeHtml(part);
    }).join('');
  },

  formatWeight(value) {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && parsed > 0 ? parsed.toFixed(2) : "";
  }
};

// ============================================================================
// MEDICATION UTILITIES
// ============================================================================

const MedicationUtils = {
  getCartKey(med) {
    const fields = [
      'specialty', 'subcategory', 'population', 'med', 'dose_text',
      'route', 'frequency', 'duration', 'dispense', 'refill', 'prn', 'form', 'comments'
    ];
    return fields.map(field => Utils.normalize(med[field])).join("||");
  },

  getSearchDedupeKey(med) {
    const fields = [
      'population', 'med', 'dose_text', 'route', 'frequency',
      'duration', 'dispense', 'refill', 'prn', 'form', 'comments'
    ];
    return fields.map(field => Utils.normalize(med[field])).join("||");
  },

  formatBrandNames(brands) {
    if (!brands || !Array.isArray(brands) || brands.length === 0) {
      return "";
    }
    return `[${brands.join(" | ")}]`;
  },

  compareByIndication(a, b) {
    const indA = Utils.normalize(a.indication).toLowerCase();
    const indB = Utils.normalize(b.indication).toLowerCase();
    const medA = Utils.normalize(a.med).toLowerCase();
    const medB = Utils.normalize(b.med).toLowerCase();

    if (indA && indB) {
      if (indA !== indB) {
        return indA.localeCompare(indB, undefined, { numeric: true });
      }
      return medA.localeCompare(medB, undefined, { numeric: true });
    }

    if (indA && !indB) return -1;
    if (!indA && indB) return 1;

    return medA.localeCompare(medB, undefined, { numeric: true });
  },

  calculateDose(med, weight) {
    if (!med.weight_based || !weight || isNaN(weight) || weight <= 0) {
      return null;
    }

    const perKg = parseFloat(med.dose_per_kg_mg);
    const maxDose = parseFloat(med.max_dose_mg);

    if (!perKg) return null;

    let calculated = weight * perKg;
    let isMaxed = false;

    if (maxDose && calculated > maxDose) {
      calculated = maxDose;
      isMaxed = true;
    }

    const finalDose = calculated >= 10 
      ? Math.floor(calculated) 
      : Math.floor(calculated * 10) / 10;

    const info = isMaxed 
      ? `Max Dose reached; Ref: ${perKg} mg/kg`
      : `${perKg} mg/kg`;

    return {
      value: finalDose,
      info,
      html: `<span class="calc-dose">${finalDose} mg</span> <span class="calc-note">(${info})</span>`
    };
  },

  getDetailsArray(med, overrideDose = null) {
    const dose = overrideDose || med.dose_text;
    
    return [
      dose,
      med.form ? `${med.form} form` : null,
      med.route,
      med.frequency,
      med.duration,
      med.prn ? `PRN: ${med.prn}` : null,
      med.comments,
      med.dispense ? `Dispense: ${med.dispense}` : null,
      med.refill ? `Refills: ${med.refill}` : null
    ].filter(val => val && String(val).trim() !== "");
  },

  groupBySpecialty(medications) {
    const groups = new Map();
    
    for (const med of medications) {
      const specialty = Utils.normalize(med.specialty) || "Uncategorized";
      
      if (!groups.has(specialty)) {
        groups.set(specialty, []);
      }
      
      groups.get(specialty).push(med);
    }
    
    return groups;
  }
};

// ============================================================================
// LOCATION MANAGER
// ============================================================================

class LocationManager {
  constructor(state) {
    this.state = state;
    this.locationsLoaded = false;
  }

  async load() {
    await this.loadBaseLocations();
    this.loadCustomLocations();
    this.loadCurrentLocation();
    this.validateCurrentLocation();
  }

  async loadBaseLocations() {
    try {
      const response = await fetch("Locations.json", { cache: "no-store" });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (Array.isArray(data.locations) && data.locations.length > 0) {
        BASE_LOCATIONS = data.locations;
        this.locationsLoaded = true;
        console.log(`✓ Loaded ${BASE_LOCATIONS.length} locations from JSON`);
      } else {
        console.warn("Locations.json is empty or invalid, using fallback");
        BASE_LOCATIONS = [FALLBACK_LOCATION];
      }
    } catch (error) {
      console.error("Failed to load locations from JSON, using fallback:", error);
      BASE_LOCATIONS = [FALLBACK_LOCATION];
    }
  }

  loadCustomLocations() {
    try {
      const stored = localStorage.getItem(CONFIG.storage.locations);
      if (stored) {
        this.state.customLocations = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load custom locations:", error);
    }
  }

  loadCurrentLocation() {
    try {
      const stored = localStorage.getItem(CONFIG.storage.currentLocation);
      if (stored) {
        this.state.currentLocationName = stored;
      }
    } catch (error) {
      console.error("Failed to load current location:", error);
    }
  }

  validateCurrentLocation() {
    const all = this.getAllLocations();
    const exists = all.some(loc => loc.name === this.state.currentLocationName);
    
    if (!exists) {
      this.state.currentLocationName = CONFIG.defaultLocation;
      
      if (!all.some(loc => loc.name === this.state.currentLocationName)) {
        this.state.currentLocationName = all[0]?.name || "Unknown";
      }
    }
  }

  getAllLocations() {
    const baseNames = new Set(BASE_LOCATIONS.map(loc => loc.name));
    const uniqueCustom = this.state.customLocations.filter(
      loc => !baseNames.has(loc.name)
    );
    
    const all = [...BASE_LOCATIONS, ...uniqueCustom];
    all.sort((a, b) => a.name.localeCompare(b.name));
    
    return all;
  }

  searchLocations(query) {
    const all = this.getAllLocations();
    
    if (!query || query.trim() === "") {
      // Return all locations alphabetically when no query
      return all;
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    // Filter locations where name contains the search term (case-insensitive)
    const matches = all.filter(loc => 
      loc.name.toLowerCase().includes(searchTerm)
    );
    
    return matches;
  }

  getCurrentLocation() {
    const all = this.getAllLocations();
    return all.find(loc => loc.name === this.state.currentLocationName) || FALLBACK_LOCATION;
  }

  selectLocation(name) {
    this.state.currentLocationName = name;
    localStorage.setItem(CONFIG.storage.currentLocation, name);
  }

  addCustomLocation(name, address) {
    const cleanName = Utils.normalize(name);
    const cleanAddr = Utils.normalize(address);
    
    if (!cleanName || !cleanAddr) {
      throw new Error("Name and Address are required");
    }
    
    const all = this.getAllLocations();
    if (all.some(loc => loc.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error("This location name already exists");
    }
    
    this.state.customLocations.push({ name: cleanName, address: cleanAddr });
    localStorage.setItem(CONFIG.storage.locations, JSON.stringify(this.state.customLocations));
    
    this.selectLocation(cleanName);
  }

  deleteCustomLocation(name) {
    this.state.customLocations = this.state.customLocations.filter(
      loc => loc.name !== name
    );
    localStorage.setItem(CONFIG.storage.locations, JSON.stringify(this.state.customLocations));
    
    if (this.state.currentLocationName === name) {
      this.selectLocation(CONFIG.defaultLocation);
    }
  }

  isCustomLocation(name) {
    return this.state.customLocations.some(loc => loc.name === name);
  }
}

// ============================================================================
// PROVIDER MANAGER
// ============================================================================

class ProviderManager {
  constructor() {
    this.currentProvider = { ...CONFIG.prescriber };
  }

  load() {
    try {
      const stored = localStorage.getItem(CONFIG.storage.provider);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name && parsed.cpso) {
          this.currentProvider = parsed;
        }
      }
    } catch (error) {
      console.error("Failed to load provider info:", error);
    }
  }

  getProvider() {
    return { ...this.currentProvider };
  }

  updateProvider(name, cpso) {
    const cleanName = Utils.normalize(name);
    const cleanCpso = Utils.normalize(cpso);
    
    if (!cleanName) {
      throw new Error("Provider name is required");
    }
    
    if (!cleanCpso) {
      throw new Error("CPSO number is required");
    }
    
    // Validate CPSO format: must be numeric and 5 or 6 digits
    if (!/^\d{5,6}$/.test(cleanCpso)) {
      throw new Error("CPSO number must be 5 or 6 digits");
    }
    
    this.currentProvider = { name: cleanName, cpso: cleanCpso };
    localStorage.setItem(CONFIG.storage.provider, JSON.stringify(this.currentProvider));
  }

  reset() {
    this.currentProvider = { ...CONFIG.prescriber };
    localStorage.removeItem(CONFIG.storage.provider);
  }
}

// ============================================================================
// DATA LOADER
// ============================================================================

class DataLoader {
  async loadMedications() {
    try {
      const response = await fetch("Prescriptions.json", { cache: "no-store" });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return Array.isArray(data.meds) ? data.meds : [];
    } catch (error) {
      console.error("Failed to load medications:", error);
      return [];
    }
  }
}

// ============================================================================
// SEARCH MANAGER
// ============================================================================

class SearchManager {
  constructor(medications) {
    this.medications = medications;
  }

  search(query) {
    if (!query || query.trim() === "") {
      return [];
    }

    const terms = this.normalizeSearchTerms(query);
    const matches = this.findMatches(terms);
    const unique = this.deduplicateMatches(matches);
    
    return this.groupByPopulation(unique);
  }

  normalizeSearchTerms(query) {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map(term => term
        .replace(/>=|≥/g, "greater than")
        .replace(/<=|≤/g, "less than")
        .replace(/>/g, "greater than")
        .replace(/</g, "less than")
      );
  }

  findMatches(terms) {
    return this.medications.filter(med => {
      let searchText = med.search_text || [
        med.med, med.dose_text, med.comments,
        med.indication, med.prn, med.specialty
      ].join(" ");

      let normalized = searchText
        .toLowerCase()
        .replace(/>=|≥/g, "greater than")
        .replace(/<=|≤/g, "less than")
        .replace(/>/g, "greater than")
        .replace(/</g, "less than");

      if ((med.population || "").toLowerCase() === "pediatric") {
        normalized += " pediatric paediatric pediatrics paediatrics child children infant toddler peds ped paeds";
      }

      return terms.every(term => normalized.includes(term));
    });
  }

  deduplicateMatches(matches) {
    const seen = new Set();
    const unique = [];

    for (const med of matches) {
      const key = MedicationUtils.getSearchDedupeKey(med);
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(med);
      }
    }

    return unique;
  }

  groupByPopulation(medications) {
    const groups = {
      adult: [],
      pediatric: [],
      other: []
    };

    for (const med of medications) {
      const population = Utils.normalize(med.population).toLowerCase();
      
      if (population === "adult") {
        groups.adult.push(med);
      } else if (population === "pediatric") {
        groups.pediatric.push(med);
      } else {
        groups.other.push(med);
      }
    }

    // Sort each group
    groups.adult.sort(MedicationUtils.compareByIndication);
    groups.pediatric.sort(MedicationUtils.compareByIndication);
    groups.other.sort(MedicationUtils.compareByIndication);

    return groups;
  }
}

// ============================================================================
// EXPORT FOR USE IN UI
// ============================================================================

// Export utility classes and functions for global access
// Note: Actual instances are created by the Application class in 04-app.js
window.Utils = Utils;
window.MedicationUtils = MedicationUtils;
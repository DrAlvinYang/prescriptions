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

const BASE_LOCATIONS = [
  { name: "Michael Garron Hospital", address: "825 Coxwell Ave, East York, M4C 3E7" },
  { name: "Bancroft - North Hastings Hospital", address: "1H Manor Lane, Bancroft, K0L 1C0" },
  { name: "Barry's Bay - St. Francis Memorial Hospital", address: "7 St. Francis Memorial Dr, Barry's Bay, K0J 1B0" },
  { name: "Blind River Site; North Shore Health Network", address: "525 Causley St, Blind River, P0R 1B0" },
  { name: "Bracebridge - South Muskoka Memorial Hospital", address: "75 Ann St, Bracebridge, P1L 2E4" },
  { name: "Campbellford Memorial Hospital", address: "146 Oliver Rd, Campbellford, K0L 1L0" },
  { name: "Deep River and District Hospital", address: "117 Banting Dr, Deep River, K0J 1P0" },
  { name: "Dryden Regional Health Centre", address: "58 Goodall St, Dryden, P8N 2Z6" },
  { name: "Dunnville - Haldimand War Memorial Hospital", address: "400 Broad St W, Dunnville, N1A 2P7" },
  { name: "Elliot Lake - St. Joseph's General Hospital", address: "70 Spine Rd, Elliot Lake, P5A 1X2" },
  { name: "Exeter - South Huron Hospital", address: "24 Huron St W, Exeter, N0M 1S2" },
  { name: "Fort Frances La Verendrye Hospital", address: "110 Victoria Ave, Fort Frances, P9A 2B7" },
  { name: "Goderich - Alexandra Marine and General Hospital", address: "120 Napier St, Goderich, N7A 1W5" },
  { name: "Grimsby - West Lincoln Memorial Hospital", address: "169 Main St E, Grimsby, L3M 1P3" },
  { name: "Hagersville - West Haldimand General Hospital", address: "75 Parkview Rd, Hagersville, N0A 1H0" },
  { name: "Haliburton Highlands Health Services", address: "7199 Gelert Rd, Haliburton, K0M 1S0" },
  { name: "Hanover and District Hospital", address: "90 7th Ave, Hanover, N4N 1N1" },
  { name: "Hearst - Notre-Dame Hospital", address: "1405 Edward St, Hearst, P0L 1N0" },
  { name: "Iroquois Falls - Anson General Hospital", address: "58 Anson Dr, Iroquois Falls, P0K 1E0" },
  { name: "Kapuskasing - Sensenbrenner Hospital", address: "101 Progress Cres, Kapuskasing, P5N 3H5" },
  { name: "Kemptville District Hospital", address: "2675 Concession Rd, Kemptville, K0G 1J0" },
  { name: "Kenora - Lake of The Woods District Hospital", address: "21 Sylvan St W, Kenora, P9N 3W7" },
  { name: "Kincardine Site; South Bruce Grey Health Centre", address: "1199 Queen St, Kincardine, N2Z 1G6" },
  { name: "Kirkland Lake - Kirkland & District Hospital", address: "145 Government Rd E, Kirkland Lake, P2N 3P4" },
  { name: "Lion's Head Hospital", address: "22 Moore St, Lion's Head, N0H 1W0" },
  { name: "Listowel Memorial Hospital", address: "255 Elizabeth St E, Listowel, N4W 2P5" },
  { name: "Markdale Hospital", address: "220 Toronto St S, Markdale, N0C 1H0" },
  { name: "Mattawa Hospital", address: "217 Turcotte Park Rd, Mattawa, P0H 1V0" },
  { name: "Meaford Hospital", address: "229 Nelson St W, Meaford, N4L 1A3" },
  { name: "Moose Factory - Weeneebayko Area Health Authority", address: "19 Hospital Dr, Moose Factory, P0L 1W0" },
  { name: "New Liskeard - Temiskaming Hospital", address: "421 Shepherdson Rd, New Liskeard, P0J 1P0" },
  { name: "Newbury - Four Counties Health Services", address: "1824 Concession Dr, Newbury, N0L 1Z0" },
  { name: "North Bay Regional Health Centre", address: "50 College Dr, North Bay, P1B 5A4" },
  { name: "Owen Sound Hospital", address: "1800 8th St E, Owen Sound, N4K 6M9" },
  { name: "Renfrew Victoria Hospital", address: "499 Raglan St N, Renfrew, K7V 1P6" },
  { name: "Seaforth Community Hospital; Huron Perth Healthcare Alliance", address: "24 Centennial Dr, Seaforth, N0K 1W0" },
  { name: "Simcoe - Norfolk General Hospital", address: "365 West St, Simcoe, N3Y 1T7" },
  { name: "Sioux Lookout - Meno Ya Win Health Centre", address: "1 Meno Ya Win Way, Sioux Lookout, P8T 1B4" },
  { name: "Southampton Hospital", address: "340 High St, Southampton, N0H 2L0" },
  { name: "Sturgeon Falls - West Nipissing General Hospital", address: "725 chemin Coursol Rd, Sturgeon Falls, P2B 2Y6" },
  { name: "Tillsonburg District Memorial Hospital", address: "167 Rolph St, Tillsonburg, N4G 3Y9" },
  { name: "Wiarton Hospital", address: "369 Mary St, Wiarton, N0H 2T0" },
  { name: "Wingham and District Hospital", address: "270 Carling Terrace, Wingham, N0G 2W0" }
];

const SPECIALTY_COLUMNS = {
  col1: ["Orders +", "Non-Med", "Allergy, Analgesia, Antiemetic", "Anti-infective", "Neuro & Endocrine"],
  col2: ["Eye", "ENT", "Cardiac & Heme", "Respiratory", "GI & GU"],
  col3: ["OBGYN", "STI", "Derm", "Psych", "Detox"]
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
  }

  addToCart(medication) {
    const entry = {
      ...JSON.parse(JSON.stringify(medication)),
      uid: crypto.randomUUID(),
      wasEdited: false
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
  }

  load() {
    this.loadCustomLocations();
    this.loadCurrentLocation();
    this.validateCurrentLocation();
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

  getCurrentLocation() {
    const all = this.getAllLocations();
    return all.find(loc => loc.name === this.state.currentLocationName) || BASE_LOCATIONS[0];
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
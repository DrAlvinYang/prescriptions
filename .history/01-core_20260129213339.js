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
const FALLBACK_LOCATION = { name: "Michael Garron Hospital (MGH)", address: "825 Coxwell Ave, East York, M4C 3E7" };

// Will be populated from Locations.json
let BASE_LOCATIONS = [FALLBACK_LOCATION];

const SPECIALTY_COLUMNS = {
  col1: ["Add New Med", "Neuro & Endocrine", "Cardiac & Heme", "STI", "Substance Use"],
  col2: ["Allergy, Analgesia, Antiemetic", "ENT", "Respiratory", "OBGYN", "Psych"],
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

    // Short route/frequency abbreviations that need word boundary matching
    // to prevent false positives (e.g., "im" matching within "time")
    const wordBoundaryTerms = new Set([
      // Routes (2-3 char abbreviations)
      'po', 'im', 'iv', 'sc', 'sq', 'sl', 'pr', 'pv', 'td', 'in', 'id', 'io', 'it', 'ia',
      'top', 'neb', 'inh', 'ng', 'gt', 'ad', 'as', 'au', 'od', 'os', 'ou',
      // Frequencies (short abbreviations)
      'bid', 'tid', 'qid', 'qd', 'prn', 'qhs', 'qam'
    ]);

    // Extract numeric values from terms for range matching
    const numericTerms = terms
      .map(t => parseFloat(t))
      .filter(n => !isNaN(n));

    // Sort terms by length descending to match longer terms first
    const sortedTerms = [...terms].sort((a, b) => b.length - a.length);

    // Build pattern for range matching (e.g., "7-10" or "7 to 10")
    const rangePattern = /(\d+\.?\d*)\s*[-to]+\s*(\d+\.?\d*)/gi;

    // First pass: find all ranges that contain any of our numeric search values
    const rangesToHighlight = new Set();
    let rangeMatch;
    while ((rangeMatch = rangePattern.exec(cleanText)) !== null) {
      const rangeMin = parseFloat(rangeMatch[1]);
      const rangeMax = parseFloat(rangeMatch[2]);
      // Check if any numeric term falls within this range
      for (const numVal of numericTerms) {
        if (numVal >= rangeMin && numVal <= rangeMax) {
          rangesToHighlight.add(rangeMatch[0]);
          break;
        }
      }
    }

    // Combine direct terms with ranges to highlight
    const allHighlightPatterns = [...sortedTerms];
    for (const range of rangesToHighlight) {
      allHighlightPatterns.push(range);
    }

    if (allHighlightPatterns.length === 0) {
      return Utils.escapeHtml(cleanText);
    }

    // Sort again by length to match longer patterns first
    allHighlightPatterns.sort((a, b) => b.length - a.length);

    // Build pattern - use word boundaries for short route/frequency terms
    const patternParts = allHighlightPatterns.map(term => {
      const escaped = Utils.escapeRegex(term);
      if (wordBoundaryTerms.has(term.toLowerCase())) {
        return `\\b${escaped}\\b`;
      }
      return escaped;
    });

    const finalPattern = new RegExp(`(${patternParts.join('|')})`, 'gi');
    const parts = cleanText.split(finalPattern);

    const allHighlightLower = new Set(allHighlightPatterns.map(p => p.toLowerCase()));

    return parts.map(part => {
      if (allHighlightLower.has(part.toLowerCase())) {
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
// SEARCH MANAGER - Clinical Search Engine
// ============================================================================

/**
 * Clinical search engine with:
 * - Weighted scoring (med name, brand, indication, route, frequency, numeric, notes)
 * - Strict route/frequency filtering
 * - Numeric parsing with range matching and g<->mg conversion
 * - Typo tolerance (Levenshtein) for medication names and indications
 * - Delimiter parity (space/hyphen/slash treated identically)
 * - Plural stripping for units and timeframes only
 * - Dynamic route-to-keyword pivot for live typing
 * - Ambiguous token expansion (e.g., OD = once daily OR right eye)
 * - NEVER searches the refill field
 */
class SearchManager {
  constructor(medications) {
    this.medications = medications;
    this.initializeMaps();
  }

  // ============================================================================
  // CONFIGURATION MAPS
  // ============================================================================

  initializeMaps() {
    // Frequency normalization map - maps variants to internal keys
    this.frequencyMap = {
      // Daily
      'od': 'freq_daily', 'daily': 'freq_daily', 'qdaily': 'freq_daily',
      'once daily': 'freq_daily', 'qd': 'freq_daily', 'once': 'freq_daily',
      // BID
      'bid': 'freq_bid', 'twice daily': 'freq_bid', 'q12h': 'freq_bid',
      'every 12 hours': 'freq_bid', 'every 12 hour': 'freq_bid',
      'every 12h': 'freq_bid',
      // TID
      'tid': 'freq_tid', 'three times daily': 'freq_tid', 'q8h': 'freq_q8h',
      'every 8 hours': 'freq_q8h', 'every 8 hour': 'freq_q8h', 'every 8h': 'freq_q8h',
      // QID
      'qid': 'freq_qid', 'four times daily': 'freq_qid',
      // q4h
      'q4h': 'freq_q4h', 'every 4 hours': 'freq_q4h', 'every 4 hour': 'freq_q4h',
      'every 4h': 'freq_q4h', 'q 4 h': 'freq_q4h', 'q 4h': 'freq_q4h',
      // q6h
      'q6h': 'freq_q6h', 'every 6 hours': 'freq_q6h', 'every 6 hour': 'freq_q6h',
      'every 6h': 'freq_q6h', 'q 6 h': 'freq_q6h', 'q 6h': 'freq_q6h',
      // q4-6h (range frequencies)
      'q4-6h': 'freq_q4-6h', 'q 4-6 h': 'freq_q4-6h', 'q 4-6h': 'freq_q4-6h',
      'every 4 to 6 hours': 'freq_q4-6h', 'every 4 to 6 hour': 'freq_q4-6h',
      'every 4-6 hours': 'freq_q4-6h', 'every 4-6 hour': 'freq_q4-6h',
      'every 4-6h': 'freq_q4-6h',
      // q2h
      'q2h': 'freq_q2h', 'every 2 hours': 'freq_q2h', 'every 2 hour': 'freq_q2h',
      'every 2h': 'freq_q2h',
      // q3h
      'q3h': 'freq_q3h', 'every 3 hours': 'freq_q3h', 'every 3 hour': 'freq_q3h',
      'every 3h': 'freq_q3h',
      // qHS (bedtime)
      'qhs': 'freq_qhs', 'at bedtime': 'freq_qhs', 'bedtime': 'freq_qhs',
      'nightly': 'freq_qhs',
      // qAM (morning)
      'qam': 'freq_qam', 'in the morning': 'freq_qam', 'every morning': 'freq_qam',
      // qMWF
      'qmwf': 'freq_qmwf', 'monday wednesday friday': 'freq_qmwf',
      // q5mins
      'q5mins': 'freq_q5mins', 'q5min': 'freq_q5mins', 'every 5 minutes': 'freq_q5mins',
      'every 5 minute': 'freq_q5mins',
      // PRN
      'prn': 'freq_prn', 'as needed': 'freq_prn'
    };

    // Reverse frequency map - internal key to display variants
    this.frequencyDisplayMap = {
      'freq_daily': ['od', 'daily', 'once daily', 'qd', 'once'],
      'freq_bid': ['bid', 'twice daily', 'q12h'],
      'freq_tid': ['tid', 'three times daily'],
      'freq_q8h': ['q8h', 'every 8 hours'],
      'freq_qid': ['qid', 'four times daily'],
      'freq_q4h': ['q4h', 'every 4 hours'],
      'freq_q6h': ['q6h', 'every 6 hours'],
      'freq_q4-6h': ['q4-6h', 'every 4-6 hours', 'every 4 to 6 hours'],
      'freq_q2h': ['q2h', 'every 2 hours'],
      'freq_q3h': ['q3h', 'every 3 hours'],
      'freq_qhs': ['qhs', 'at bedtime', 'bedtime'],
      'freq_qam': ['qam', 'in the morning'],
      'freq_qmwf': ['qmwf'],
      'freq_q5mins': ['q5mins', 'every 5 minutes'],
      'freq_prn': ['prn', 'as needed']
    };

    // Route normalization map - maps all variants to internal keys
    // Based on authoritative route list for clinical safety
    this.routeMap = {
      // PO (by mouth) - oral administration
      'po': 'route_po', 'oral': 'route_po', 'orally': 'route_po',
      'by mouth': 'route_po', 'mouth': 'route_po',
      // TOP (topical)
      'top': 'route_topical', 'topical': 'route_topical', 'topically': 'route_topical',
      // Ophthalmic (to affected eye(s))
      'ophth': 'route_ophthalmic', 'ophthalmic': 'route_ophthalmic',
      'to affected eye': 'route_ophthalmic', 'to affected eyes': 'route_ophthalmic',
      'to affected eye(s)': 'route_ophthalmic', 'eye drops': 'route_ophthalmic',
      // Specific eye routes
      'od': 'route_od', 'right eye': 'route_od',
      'os': 'route_os', 'left eye': 'route_os',
      'ou': 'route_ou', 'both eyes': 'route_ou',
      // INH (inhalation)
      'inh': 'route_inhalation', 'inhalation': 'route_inhalation',
      'inhaled': 'route_inhalation', 'by inhalation': 'route_inhalation',
      // NEB (nebulized)
      'neb': 'route_nebulized', 'nebulized': 'route_nebulized', 'nebulizer': 'route_nebulized',
      // IM (intramuscular)
      'im': 'route_im', 'intramuscular': 'route_im', 'intramuscularly': 'route_im',
      // IV (intravenous)
      'iv': 'route_iv', 'intravenous': 'route_iv', 'intravenously': 'route_iv',
      // PV (per vaginal)
      'pv': 'route_pv', 'per vaginal': 'route_pv', 'vaginal': 'route_pv', 'vaginally': 'route_pv',
      // IN / nasal (intranasal)
      'in': 'route_nasal', 'nasal': 'route_nasal', 'intranasal': 'route_nasal',
      'intranasally': 'route_nasal',
      // PR (per rectum)
      'pr': 'route_pr', 'per rectum': 'route_pr', 'rectal': 'route_pr', 'rectally': 'route_pr',
      // SL (sublingual)
      'sl': 'route_sl', 'sublingual': 'route_sl', 'sublingually': 'route_sl',
      // PO/SL (by mouth or sublingual)
      'po sl': 'route_po_sl', 'po/sl': 'route_po_sl',
      // Otic (to affected ear(s))
      'otic': 'route_otic', 'to affected ear': 'route_otic',
      'to affected ears': 'route_otic', 'to affected ear(s)': 'route_otic',
      'ear drops': 'route_otic',
      // Specific ear routes
      'ad': 'route_ad', 'right ear': 'route_ad',
      'as': 'route_as', 'left ear': 'route_as',
      'au': 'route_au', 'both ears': 'route_au',
      // TD (transdermal)
      'td': 'route_td', 'transdermal': 'route_td', 'transdermally': 'route_td',
      'patch': 'route_td',
      // Chewed
      'chewed': 'route_chewed',
      // SC / SQ / subcut (subcutaneous)
      'sc': 'route_sc', 'sq': 'route_sc', 'subcut': 'route_sc',
      'subcutaneous': 'route_sc', 'subcutaneously': 'route_sc',
      // ID (intradermal)
      'id': 'route_id', 'intradermal': 'route_id',
      // IO (intraosseous)
      'io': 'route_io', 'intraosseous': 'route_io',
      // IT (intrathecal)
      'it': 'route_it', 'intrathecal': 'route_it',
      // IA (intraarticular)
      'ia': 'route_ia', 'intraarticular': 'route_ia',
      // NG (nasogastric tube)
      'ng': 'route_ng', 'nasogastric': 'route_ng', 'nasogastric tube': 'route_ng',
      'ng tube': 'route_ng',
      // GT / PEG / G-tube (gastrostomy tube)
      'gt': 'route_gt', 'peg': 'route_gt', 'g tube': 'route_gt', 'g-tube': 'route_gt',
      'gastrostomy': 'route_gt', 'gastrostomy tube': 'route_gt', 'peg tube': 'route_gt',
      // J-tube (jejunostomy tube)
      'j tube': 'route_jt', 'j-tube': 'route_jt', 'jtube': 'route_jt',
      'jejunostomy': 'route_jt', 'jejunostomy tube': 'route_jt',
      // Buccal
      'buccal': 'route_buccal'
    };

    // Tokens that are ambiguous between frequency and route (treated as OR)
    this.ambiguousTokens = new Set(['od']);

    // Unit aliases for normalization - maps all variants to canonical form
    this.unitAliases = {
      // Duration units
      'd': 'day', 'day': 'day', 'days': 'day',
      'wk': 'week', 'wks': 'week', 'week': 'week', 'weeks': 'week',
      'h': 'hour', 'hr': 'hour', 'hrs': 'hour', 'hour': 'hour', 'hours': 'hour',
      'mo': 'month', 'mth': 'month', 'mths': 'month', 'month': 'month', 'months': 'month',
      'yr': 'year', 'yrs': 'year', 'year': 'year', 'years': 'year',
      // Dose form units
      'tab': 'tablet', 'tabs': 'tablet', 'tablet': 'tablet', 'tablets': 'tablet',
      'cap': 'capsule', 'caps': 'capsule', 'capsule': 'capsule', 'capsules': 'capsule',
      // Volume/mass units
      'ml': 'ml', 'mls': 'ml',
      'mg': 'mg', 'mgs': 'mg',
      'g': 'g', 'gm': 'g', 'gms': 'g', 'gram': 'g', 'grams': 'g',
      'mcg': 'mcg', 'ug': 'mcg', 'microgram': 'mcg', 'micrograms': 'mcg',
      'unit': 'unit', 'units': 'unit', 'iu': 'unit',
      // Delivery units
      'puff': 'puff', 'puffs': 'puff',
      'drop': 'drop', 'drops': 'drop', 'gtt': 'drop', 'gtts': 'drop',
      'spray': 'spray', 'sprays': 'spray',
      'application': 'application', 'applications': 'application'
    };

    // Recognized units for numeric parsing (singular forms)
    this.recognizedUnits = new Set([
      'mg', 'g', 'mcg', 'ml', 'l', 'unit', 'tablet', 'capsule',
      'puff', 'drop', 'spray', 'application', 'day', 'week', 'hour', 'month', 'year'
    ]);

    // Score weights
    this.weights = {
      medName: 100,
      brandName: 100,
      indication: 50,
      route: 30,
      frequency: 30,
      numeric: 20,
      notes: 5
    };
  }

  // ============================================================================
  // NORMALIZATION LAYER
  // ============================================================================

  /**
   * Normalize text for consistent comparison
   * - Lowercase
   * - Collapse whitespace
   * - Treat hyphens, slashes, spaces as identical delimiters
   * - Normalize decimals (.5 -> 0.5)
   */
  normalizeText(text) {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .trim()
      // Collapse multiple whitespace into single space
      .replace(/\s+/g, ' ')
      // Normalize common separators to space for tokenization
      .replace(/[-\/]/g, ' ')
      // Normalize decimal notation (.5 -> 0.5)
      .replace(/(?<![0-9])\.(\d)/g, '0.$1')
      // Remove comparison symbols and replace with words
      .replace(/>=|≥/g, ' gte ')
      .replace(/<=|≤/g, ' lte ')
      .replace(/>/g, ' gt ')
      .replace(/</g, ' lt ');
  }

  /**
   * Normalize a unit string to its canonical form
   */
  normalizeUnit(unit) {
    if (!unit) return '';
    const lower = unit.toLowerCase().trim();
    return this.unitAliases[lower] || lower;
  }

  /**
   * Strip trailing 's' from recognized units/timeframes only
   */
  stripUnitPlural(token) {
    if (!token || token.length <= 2) return token;
    if (token.endsWith('s')) {
      const stripped = token.slice(0, -1);
      // Only strip if it results in a recognized unit
      if (this.recognizedUnits.has(stripped) || this.unitAliases[stripped]) {
        return stripped;
      }
    }
    return token;
  }

  // ============================================================================
  // TOKENIZATION
  // ============================================================================

  /**
   * Tokenize query into meaningful search tokens
   * Handles multi-word frequency phrases like "every 4 hours"
   * Handles space-separated number+unit pairs like "7 day", "500 mg"
   */
  tokenizeQuery(query) {
    const normalized = this.normalizeText(query);
    const tokens = [];

    // First, try to extract multi-word frequency phrases
    let remaining = normalized;

    // Sort frequency keys by length (longest first) to match longer phrases first
    const freqPhrases = Object.keys(this.frequencyMap)
      .filter(k => k.includes(' '))
      .sort((a, b) => b.length - a.length);

    for (const phrase of freqPhrases) {
      const normalizedPhrase = this.normalizeText(phrase);
      if (remaining.includes(normalizedPhrase)) {
        tokens.push({
          raw: phrase,
          normalized: normalizedPhrase,
          type: 'frequency_phrase',
          frequencyKey: this.frequencyMap[phrase]
        });
        remaining = remaining.replace(normalizedPhrase, ' ').trim();
      }
    }

    // Next, extract space-separated number+unit patterns like "7 day", "500 mg", "7 d"
    // Pattern: number followed by space followed by recognized unit
    // Includes all common abbreviations: d/day/days, wk/week/weeks, h/hr/hrs/hour/hours, etc.
    const numUnitPattern = /(\d+\.?\d*)\s+(d|day|days|wk|wks|week|weeks|h|hr|hrs|hour|hours|mo|mth|month|months|yr|year|years|mg|mgs|g|gm|mcg|ug|ml|mls|l|unit|units|iu|tab|tabs|tablet|tablets|cap|caps|capsule|capsules|puff|puffs|drop|drops|gtt|gtts|spray|sprays|application|applications)\b/gi;

    let numUnitMatch;
    const numUnitMatches = [];
    while ((numUnitMatch = numUnitPattern.exec(remaining)) !== null) {
      numUnitMatches.push({
        fullMatch: numUnitMatch[0],
        value: parseFloat(numUnitMatch[1]),
        unit: this.normalizeUnit(numUnitMatch[2]),
        index: numUnitMatch.index
      });
    }

    // Remove matched number+unit pairs from remaining and add as tokens
    // Process in reverse order to preserve indices
    for (let i = numUnitMatches.length - 1; i >= 0; i--) {
      const match = numUnitMatches[i];
      remaining = remaining.slice(0, match.index) + ' ' + remaining.slice(match.index + match.fullMatch.length);

      // Determine if this is a duration unit or dose unit
      const durationUnits = new Set(['day', 'week', 'hour', 'month', 'year']);
      const isDuration = durationUnits.has(match.unit);

      tokens.unshift({
        raw: match.fullMatch.trim(),
        normalized: match.fullMatch.trim(),
        type: 'numeric_with_unit',
        value: match.value,
        unit: match.unit,
        isRange: false,
        isDuration: isDuration,
        isDose: !isDuration
      });
    }

    // Split remaining text into individual tokens
    const words = remaining.split(/\s+/).filter(Boolean);

    for (const word of words) {
      const token = this.classifyToken(word);
      // Skip tokens that are just unit words (already captured in number+unit pairs)
      if (token.type === 'text' && this.isUnitWord(token.normalized)) {
        continue;
      }
      tokens.push(token);
    }

    return tokens;
  }

  /**
   * Check if a word is a unit word that shouldn't match as plain text
   */
  isUnitWord(word) {
    const unitWords = new Set([
      // Duration
      'd', 'day', 'days', 'wk', 'wks', 'week', 'weeks',
      'h', 'hr', 'hrs', 'hour', 'hours',
      'mo', 'mth', 'month', 'months',
      'yr', 'year', 'years',
      // Mass/volume
      'mg', 'mgs', 'g', 'gm', 'mcg', 'ug',
      'ml', 'mls', 'l',
      'unit', 'units', 'iu',
      // Dose forms
      'tab', 'tabs', 'tablet', 'tablets',
      'cap', 'caps', 'capsule', 'capsules',
      'puff', 'puffs', 'drop', 'drops', 'gtt', 'gtts',
      'spray', 'sprays', 'application', 'applications'
    ]);
    return unitWords.has(word.toLowerCase());
  }

  /**
   * Classify a single token into its type
   */
  classifyToken(word) {
    const stripped = this.stripUnitPlural(word);

    // Check for numeric with unit (e.g., "500mg", "7day", "7d")
    const numericWithUnit = this.parseNumericWithUnit(word);
    if (numericWithUnit) {
      return {
        raw: word,
        normalized: word,
        type: 'numeric_with_unit',
        value: numericWithUnit.value,
        unit: numericWithUnit.unit,
        isRange: numericWithUnit.isRange,
        rangeMin: numericWithUnit.rangeMin,
        rangeMax: numericWithUnit.rangeMax,
        isDuration: numericWithUnit.isDuration,
        isDose: numericWithUnit.isDose
      };
    }

    // Check for standalone numeric
    const numericOnly = this.parseNumericOnly(word);
    if (numericOnly) {
      return {
        raw: word,
        normalized: word,
        type: 'numeric_only',
        value: numericOnly.value,
        isRange: numericOnly.isRange,
        rangeMin: numericOnly.rangeMin,
        rangeMax: numericOnly.rangeMax
      };
    }

    // Check for route token
    const routeKey = this.routeMap[stripped];
    if (routeKey) {
      // Check if this is an ambiguous token
      if (this.ambiguousTokens.has(stripped)) {
        return {
          raw: word,
          normalized: stripped,
          type: 'ambiguous',
          routeKey: routeKey,
          frequencyKey: this.frequencyMap[stripped]
        };
      }
      return {
        raw: word,
        normalized: stripped,
        type: 'route',
        routeKey: routeKey
      };
    }

    // Check for frequency token
    const freqKey = this.frequencyMap[stripped];
    if (freqKey) {
      return {
        raw: word,
        normalized: stripped,
        type: 'frequency',
        frequencyKey: freqKey
      };
    }

    // Default to text token (for med name, indication, notes search)
    return {
      raw: word,
      normalized: stripped,
      type: 'text'
    };
  }

  /**
   * Parse a token that may contain a number with a unit
   * Handles: "500mg", "7day", "7d", "1g", "0.5ml", "25-50mg"
   */
  parseNumericWithUnit(token) {
    const durationUnits = new Set(['day', 'week', 'hour', 'month', 'year']);

    // Match patterns like: 500mg, 0.5ml, 25-50mg, 7day, 7d, 1-2tab
    const rangeWithUnit = token.match(/^(\d+\.?\d*)\s*[-to]+\s*(\d+\.?\d*)\s*([a-z]+)$/i);
    if (rangeWithUnit) {
      const unit = this.normalizeUnit(rangeWithUnit[3]);
      if (this.recognizedUnits.has(unit) || this.unitAliases[rangeWithUnit[3].toLowerCase()]) {
        const normalizedUnit = this.unitAliases[rangeWithUnit[3].toLowerCase()] || unit;
        const isDuration = durationUnits.has(normalizedUnit);
        return {
          value: null,
          unit: normalizedUnit,
          isRange: true,
          rangeMin: parseFloat(rangeWithUnit[1]),
          rangeMax: parseFloat(rangeWithUnit[2]),
          isDuration: isDuration,
          isDose: !isDuration
        };
      }
    }

    const singleWithUnit = token.match(/^(\d+\.?\d*)\s*([a-z]+)$/i);
    if (singleWithUnit) {
      const rawUnit = singleWithUnit[2].toLowerCase();
      const normalizedUnit = this.unitAliases[rawUnit] || this.normalizeUnit(rawUnit);
      // Check if it's a recognized unit (either directly or via alias)
      if (this.recognizedUnits.has(normalizedUnit) || this.unitAliases[rawUnit]) {
        const isDuration = durationUnits.has(normalizedUnit);
        return {
          value: parseFloat(singleWithUnit[1]),
          unit: normalizedUnit,
          isRange: false,
          isDuration: isDuration,
          isDose: !isDuration
        };
      }
    }

    return null;
  }

  /**
   * Parse a standalone numeric token
   * Handles: "500", "0.5", "25-50"
   */
  parseNumericOnly(token) {
    // Range pattern: 25-50
    const range = token.match(/^(\d+\.?\d*)\s*[-to]+\s*(\d+\.?\d*)$/);
    if (range) {
      return {
        value: null,
        isRange: true,
        rangeMin: parseFloat(range[1]),
        rangeMax: parseFloat(range[2])
      };
    }

    // Single number
    if (/^\d+\.?\d*$/.test(token)) {
      return {
        value: parseFloat(token),
        isRange: false
      };
    }

    return null;
  }

  // ============================================================================
  // NUMERIC MATCHING
  // ============================================================================

  /**
   * Extract all numeric values from a text string
   * Returns array of { value, unit, isRange, rangeMin, rangeMax, original, fieldType }
   * @param {string} text - The text to extract numerics from
   * @param {string} fieldType - 'dose' or 'duration' to tag where this numeric came from
   */
  extractNumericsFromText(text, fieldType = 'unknown') {
    if (!text) return [];
    // Use light normalization that preserves hyphens for range detection
    // Only lowercase and collapse whitespace, don't replace hyphens with spaces
    const normalized = text.toString().toLowerCase().trim().replace(/\s+/g, ' ');
    const numerics = [];
    const durationUnits = new Set(['day', 'week', 'hour', 'month', 'year']);

    // Match ranges with units: 25-50mg, 5-7 days, 7 to 10 days
    const rangeWithUnitPattern = /(\d+\.?\d*)\s*(?:[-]|to)\s*(\d+\.?\d*)\s*([a-z]+)/gi;
    let match;
    while ((match = rangeWithUnitPattern.exec(normalized)) !== null) {
      const unit = this.normalizeUnit(match[3]);
      const isDuration = durationUnits.has(unit);
      numerics.push({
        value: null,
        unit: unit,
        isRange: true,
        rangeMin: parseFloat(match[1]),
        rangeMax: parseFloat(match[2]),
        original: match[0],
        fieldType: fieldType,
        isDuration: isDuration
      });
    }

    // Match single values with units: 500mg, 7day, 7 days
    // Use negative lookbehind/lookahead to avoid matching parts of ranges
    const singleWithUnitPattern = /(?<!\d\s*[-]\s*)(?<!\d\s+to\s+)(\d+\.?\d*)\s*([a-z]+)(?!\s*[-]\s*\d)(?!\s+to\s+\d)/gi;
    while ((match = singleWithUnitPattern.exec(normalized)) !== null) {
      const unit = this.normalizeUnit(match[2]);
      const isDuration = durationUnits.has(unit);
      // Skip if this was already captured as part of a range
      if (!numerics.some(n => n.original && normalized.indexOf(n.original) <= match.index &&
          normalized.indexOf(n.original) + n.original.length >= match.index + match[0].length)) {
        numerics.push({
          value: parseFloat(match[1]),
          unit: unit,
          isRange: false,
          original: match[0],
          fieldType: fieldType,
          isDuration: isDuration
        });
      }
    }

    return numerics;
  }

  /**
   * Check if a query numeric matches a field numeric
   * Handles exact match, range containment, g<->mg conversion, and day<->week conversion
   */
  numericMatches(queryNumeric, fieldNumeric) {
    // If query has unit and field has unit, they must be compatible
    if (queryNumeric.unit && fieldNumeric.unit) {
      // Check for g <-> mg conversion
      let queryValue = queryNumeric.value;
      let queryMin = queryNumeric.rangeMin;
      let queryMax = queryNumeric.rangeMax;
      let fieldValue = fieldNumeric.value;
      let fieldMin = fieldNumeric.rangeMin;
      let fieldMax = fieldNumeric.rangeMax;

      // Convert g to mg for comparison
      if (queryNumeric.unit === 'g' && fieldNumeric.unit === 'mg') {
        queryValue = queryValue !== null ? queryValue * 1000 : null;
        queryMin = queryMin !== undefined ? queryMin * 1000 : undefined;
        queryMax = queryMax !== undefined ? queryMax * 1000 : undefined;
      } else if (queryNumeric.unit === 'mg' && fieldNumeric.unit === 'g') {
        fieldValue = fieldValue !== null ? fieldValue * 1000 : null;
        fieldMin = fieldMin !== undefined ? fieldMin * 1000 : undefined;
        fieldMax = fieldMax !== undefined ? fieldMax * 1000 : undefined;
      }
      // Convert day <-> week for duration fields only (exact multiples of 7)
      else if (queryNumeric.isDuration && fieldNumeric.isDuration) {
        if (queryNumeric.unit === 'day' && fieldNumeric.unit === 'week') {
          // Convert query days to weeks for comparison
          // Only if query is an exact multiple of 7 days
          if (!queryNumeric.isRange && queryValue !== null && queryValue % 7 === 0) {
            queryValue = queryValue / 7;
            queryMin = queryMin !== undefined ? queryMin / 7 : undefined;
            queryMax = queryMax !== undefined ? queryMax / 7 : undefined;
          } else if (queryNumeric.isRange && queryMin !== undefined && queryMax !== undefined &&
                     queryMin % 7 === 0 && queryMax % 7 === 0) {
            queryMin = queryMin / 7;
            queryMax = queryMax / 7;
          } else {
            // Not an exact multiple of 7 - no conversion possible
            return false;
          }
        } else if (queryNumeric.unit === 'week' && fieldNumeric.unit === 'day') {
          // Convert query weeks to days for comparison
          queryValue = queryValue !== null ? queryValue * 7 : null;
          queryMin = queryMin !== undefined ? queryMin * 7 : undefined;
          queryMax = queryMax !== undefined ? queryMax * 7 : undefined;
        } else if (queryNumeric.unit !== fieldNumeric.unit) {
          // Units don't match and can't be converted
          return false;
        }
      }
      else if (queryNumeric.unit !== fieldNumeric.unit) {
        // Units don't match and can't be converted
        return false;
      }

      // Now compare values
      return this.compareNumericValues(
        { value: queryValue, isRange: queryNumeric.isRange, rangeMin: queryMin, rangeMax: queryMax },
        { value: fieldValue, isRange: fieldNumeric.isRange, rangeMin: fieldMin, rangeMax: fieldMax }
      );
    }

    // If query has no unit (unitless search), match any unit
    if (!queryNumeric.unit) {
      return this.compareNumericValues(queryNumeric, fieldNumeric);
    }

    return false;
  }

  /**
   * Compare numeric values with strict boundary rules
   * 50 must not match 500, range containment supported
   */
  compareNumericValues(query, field) {
    if (query.isRange) {
      // Query is a range
      if (field.isRange) {
        // Both ranges - check for overlap
        return !(query.rangeMax < field.rangeMin || query.rangeMin > field.rangeMax);
      } else {
        // Query range, field single - check if field falls within query range
        return field.value >= query.rangeMin && field.value <= query.rangeMax;
      }
    } else {
      // Query is single value
      if (field.isRange) {
        // Query single, field range - check if query falls within field range
        return query.value >= field.rangeMin && query.value <= field.rangeMax;
      } else {
        // Both single - exact match only
        return query.value === field.value;
      }
    }
  }

  /**
   * Check if a numeric value exists in text with strict word boundaries
   * "50" must not match "500"
   */
  numericExistsInText(value, text) {
    const normalized = this.normalizeText(text);
    // Create pattern that matches the number with word boundaries
    // Word boundary before number and either end/space/unit after
    const pattern = new RegExp(`(?<![0-9])${value}(?![0-9])`, 'g');
    return pattern.test(normalized);
  }

  // ============================================================================
  // ROUTE AND FREQUENCY MATCHING
  // ============================================================================

  /**
   * Get normalized route key for a medication's route field
   */
  getMedRouteKey(med) {
    const rawRoute = (med.route || '').toLowerCase().trim();

    // Direct mapping for raw route values (before heavy normalization)
    const directMapping = {
      'po': 'route_po',
      'oral': 'route_po',
      'topical': 'route_topical',
      'top': 'route_topical',
      'to affected eye(s)': 'route_ophthalmic',
      'to affected eye': 'route_ophthalmic',
      'ophthalmic': 'route_ophthalmic',
      'ophth': 'route_ophthalmic',
      'inhalation': 'route_inhalation',
      'inh': 'route_inhalation',
      'im': 'route_im',
      'intramuscular': 'route_im',
      'iv': 'route_iv',
      'intravenous': 'route_iv',
      'pv': 'route_pv',
      'vaginal': 'route_pv',
      'per vaginal': 'route_pv',
      'nasal': 'route_nasal',
      'in': 'route_nasal',
      'intranasal': 'route_nasal',
      'pr': 'route_pr',
      'rectal': 'route_pr',
      'per rectum': 'route_pr',
      'sl': 'route_sl',
      'sublingual': 'route_sl',
      'to affected ear(s)': 'route_otic',
      'to affected ear': 'route_otic',
      'otic': 'route_otic',
      'td': 'route_td',
      'transdermal': 'route_td',
      'po/sl': 'route_po_sl',
      'chewed': 'route_chewed',
      'sc': 'route_sc',
      'sq': 'route_sc',
      'subcut': 'route_sc',
      'subcutaneous': 'route_sc',
      'neb': 'route_nebulized',
      'nebulized': 'route_nebulized',
      'buccal': 'route_buccal',
      'ng': 'route_ng',
      'nasogastric': 'route_ng',
      'gt': 'route_gt',
      'peg': 'route_gt',
      'g-tube': 'route_gt',
      'j-tube': 'route_jt'
    };

    if (directMapping[rawRoute]) {
      return directMapping[rawRoute];
    }

    // Try normalized route
    const normalized = this.normalizeText(rawRoute);
    if (this.routeMap[normalized]) {
      return this.routeMap[normalized];
    }

    // Handle compound routes
    if (normalized.includes('po') && normalized.includes('sl')) {
      return 'route_po_sl';
    }

    return null;
  }

  /**
   * Get normalized frequency key for a medication's frequency field
   */
  getMedFrequencyKey(med) {
    const freq = this.normalizeText(med.frequency || '');

    // Try direct mapping
    const key = this.frequencyMap[freq];
    if (key) return key;

    // Try with spaces collapsed
    const collapsed = freq.replace(/\s+/g, '');
    return this.frequencyMap[collapsed] || null;
  }

  /**
   * Check if route filter should be applied based on token context
   * Implements dynamic pivot: "PR" = rectal, but "PRN" = as needed
   */
  shouldApplyRouteFilter(tokens, routeToken) {
    // Check if this route token is part of a longer word that changes meaning
    const idx = tokens.indexOf(routeToken);
    if (idx === -1) return true;

    // Check adjacent tokens to see if they form a different term
    // e.g., "P" + "R" + "N" should not filter by rectal
    const adjacentText = tokens.slice(Math.max(0, idx - 1), idx + 2)
      .map(t => t.normalized || t.raw)
      .join('');

    // Common patterns that override route interpretation
    const overridePatterns = ['prn'];

    return !overridePatterns.some(p => adjacentText.includes(p));
  }

  // ============================================================================
  // LEVENSHTEIN DISTANCE (Typo Tolerance)
  // ============================================================================

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;

    // Create distance matrix
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Fill in the rest
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Check if two strings match with typo tolerance
   * Only applied to medication names and indications
   * Stricter for short words to avoid false positives (e.g., "lice" matching "line")
   */
  fuzzyMatches(query, target, maxDistance = null) {
    if (!query || !target) return false;

    const q = query.toLowerCase();
    const t = target.toLowerCase();

    // Exact substring match
    if (t.includes(q) || q.includes(t)) return true;

    // Don't fuzzy match very short tokens (<=2 chars)
    if (q.length <= 2) return false;

    // For fuzzy matching, compare word by word
    const queryWords = q.split(/\s+/);
    const targetWords = t.split(/\s+/);

    for (const qWord of queryWords) {
      if (qWord.length <= 2) continue; // Skip short words

      let foundMatch = false;
      for (const tWord of targetWords) {
        if (tWord.length <= 2) continue;

        // Check prefix match first (always allowed)
        if (tWord.startsWith(qWord) || qWord.startsWith(tWord)) {
          foundMatch = true;
          break;
        }

        // Levenshtein distance - stricter for short words to avoid false positives
        // (e.g., "lice" should NOT match "line", "like", "live", etc.)
        // Words <= 4 chars: NO Levenshtein (too many false positives)
        // Words 5-6 chars: distance 1
        // Words 7+ chars: distance 2
        if (qWord.length >= 5) {
          const allowedDist = maxDistance !== null ? maxDistance : (qWord.length <= 6 ? 1 : 2);
          const dist = this.levenshteinDistance(qWord, tWord);
          if (dist <= allowedDist) {
            foundMatch = true;
            break;
          }
        }
      }

      if (!foundMatch) return false;
    }

    return true;
  }

  // ============================================================================
  // FIELD EXTRACTION (Building searchable text from medication)
  // ============================================================================

  /**
   * Build searchable text from medication, EXCLUDING refill field
   */
  buildSearchableFields(med) {
    return {
      medName: this.normalizeText(med.med || ''),
      brands: (med.brands || []).map(b => this.normalizeText(b)),
      indication: this.normalizeText(med.indication || ''),
      route: this.normalizeText(med.route || ''),
      frequency: this.normalizeText(med.frequency || ''),
      doseText: this.normalizeText(med.dose_text || ''),
      duration: this.normalizeText(med.duration || ''),
      notes: this.normalizeText([
        med.comments,
        med.prn,
        med.specialty,
        med.form,
        med.dispense
        // NOTE: med.refill is NEVER included
      ].filter(Boolean).join(' '))
    };
  }

  // ============================================================================
  // SCORING
  // ============================================================================

  /**
   * Score a medication against parsed query tokens
   * Returns { score, matched, failed }
   */
  scoreMedication(med, tokens) {
    const fields = this.buildSearchableFields(med);
    let score = 0;
    const matchedTokens = new Set();
    let routeFilterFailed = false;
    let frequencyFilterFailed = false;
    let doseFilterFailed = false;
    let durationFilterFailed = false;
    let numericFilterFailed = false;

    // Get medication's normalized route and frequency
    const medRouteKey = this.getMedRouteKey(med);
    const medFreqKey = this.getMedFrequencyKey(med);

    // Extract numerics from medication fields SEPARATELY
    // Tag each with its source field for proper matching
    const doseNumerics = this.extractNumericsFromText(med.dose_text, 'dose');
    const durationNumerics = this.extractNumericsFromText(med.duration, 'duration');

    // Population synonym lists for filtering by adult/pediatric
    const population = (med.population || '').toLowerCase().trim();
    const pediatricSynonyms = ['pediatric', 'pediatrics', 'paediatric', 'paediatrics', 'child', 'children', 'infant', 'toddler', 'peds', 'ped', 'paeds', 'paed'];
    const adultSynonyms = ['adult', 'adults'];

    for (const token of tokens) {
      let tokenMatched = false;

      switch (token.type) {
        case 'route':
          // Hard filter - route must match exactly
          if (this.shouldApplyRouteFilter(tokens, token)) {
            // Check if medication route matches query route
            if (medRouteKey === token.routeKey) {
              score += this.weights.route;
              tokenMatched = true;
            } else {
              // Check for compatible routes (e.g., PO matches PO/SL)
              if (token.routeKey === 'route_po' && medRouteKey === 'route_po_sl') {
                score += this.weights.route;
                tokenMatched = true;
              } else if (token.routeKey === 'route_sl' && medRouteKey === 'route_po_sl') {
                score += this.weights.route;
                tokenMatched = true;
              } else {
                routeFilterFailed = true;
              }
            }
          } else {
            // Route token is overridden by context (e.g., PRN)
            tokenMatched = true;
          }
          break;

        case 'frequency':
        case 'frequency_phrase':
          // Hard filter - frequency must match exactly
          // If user specifies a frequency, medication MUST have that exact frequency
          if (medFreqKey === token.frequencyKey) {
            score += this.weights.frequency;
            tokenMatched = true;
          } else {
            // Frequency doesn't match (including when medication has no frequency)
            frequencyFilterFailed = true;
          }
          break;

        case 'ambiguous':
          // Token like "OD" can be frequency OR route
          // Use OR logic - match if either interpretation works
          let ambiguousMatched = false;

          // Try as frequency (once daily)
          if (token.frequencyKey && medFreqKey === token.frequencyKey) {
            score += this.weights.frequency;
            ambiguousMatched = true;
          }

          // Try as route (right eye)
          if (token.routeKey && medRouteKey === token.routeKey) {
            score += this.weights.route;
            ambiguousMatched = true;
          }

          // Also check if it appears in text fields
          if (!ambiguousMatched) {
            if (fields.medName.includes(token.normalized) ||
                fields.brands.some(b => b.includes(token.normalized)) ||
                fields.indication.includes(token.normalized)) {
              score += this.weights.indication; // Lower weight for text match
              ambiguousMatched = true;
            }
          }

          tokenMatched = ambiguousMatched;
          break;

        case 'numeric_with_unit':
          // Numeric WITH unit is a HARD filter
          // Duration tokens must match duration field, dose tokens must match dose field
          let numericWithUnitMatched = false;

          if (token.isDuration) {
            // Duration token - must match duration field
            for (const fieldNumeric of durationNumerics) {
              if (this.numericMatches(token, fieldNumeric)) {
                score += this.weights.numeric;
                numericWithUnitMatched = true;
                break;
              }
            }
            if (!numericWithUnitMatched) {
              durationFilterFailed = true;
            }
          } else {
            // Dose token - must match dose field
            for (const fieldNumeric of doseNumerics) {
              if (this.numericMatches(token, fieldNumeric)) {
                score += this.weights.numeric;
                numericWithUnitMatched = true;
                break;
              }
            }

            // Also check concentration strings (e.g., "250mg" in "250mg/5mL")
            if (!numericWithUnitMatched) {
              const concPattern = `${token.value}${token.unit}`;
              if (fields.doseText.includes(concPattern) ||
                  fields.medName.includes(concPattern)) {
                score += this.weights.numeric;
                numericWithUnitMatched = true;
              }
            }

            if (!numericWithUnitMatched) {
              doseFilterFailed = true;
            }
          }

          tokenMatched = numericWithUnitMatched;
          break;

        case 'numeric_only':
          // Unitless numeric is a HARD filter - must find the number somewhere
          // It can match any unit (500 matches 500mg, 500mL, etc.) but must exist
          let numericOnlyMatched = false;
          const allNumerics = [...doseNumerics, ...durationNumerics];

          for (const fieldNumeric of allNumerics) {
            if (this.numericMatches(token, fieldNumeric)) {
              score += this.weights.numeric;
              numericOnlyMatched = true;
              break;
            }
          }

          // Also check if the raw number appears anywhere with strict boundaries
          if (!numericOnlyMatched) {
            const searchStr = [fields.doseText, fields.duration, fields.notes].join(' ');
            if (this.numericExistsInText(token.value, searchStr)) {
              score += this.weights.numeric;
              numericOnlyMatched = true;
            }
          }

          // Unitless numerics ARE hard filters - if not matched, exclude the medication
          if (!numericOnlyMatched) {
            numericFilterFailed = true;
          }
          tokenMatched = numericOnlyMatched;
          break;

        case 'text':
          // Text matching with scoring priorities
          const term = token.normalized;

          // First check population filters - these match the medication's population field
          // Adult synonyms match adult medications
          if (adultSynonyms.includes(term)) {
            if (population === 'adult') {
              score += this.weights.indication;
              tokenMatched = true;
            }
            // Don't continue to other checks - this is a population filter
            break;
          }
          // Pediatric synonyms match pediatric medications
          if (pediatricSynonyms.includes(term)) {
            if (population === 'pediatric') {
              score += this.weights.indication;
              tokenMatched = true;
            }
            // Don't continue to other checks - this is a population filter
            break;
          }

          // Check medication name (exact/prefix)
          if (fields.medName.includes(term) || fields.medName.startsWith(term)) {
            score += this.weights.medName;
            tokenMatched = true;
          }
          // Check brand names
          else if (fields.brands.some(b => b.includes(term) || b.startsWith(term))) {
            score += this.weights.brandName;
            tokenMatched = true;
          }
          // Check indication
          else if (fields.indication.includes(term) || fields.indication.startsWith(term)) {
            score += this.weights.indication;
            tokenMatched = true;
          }
          // Check notes/sites
          else if (fields.notes.includes(term)) {
            score += this.weights.notes;
            tokenMatched = true;
          }
          // Fuzzy matching fallback for med name and indication only
          else if (this.fuzzyMatches(term, fields.medName)) {
            score += this.weights.medName * 0.7; // Reduced score for fuzzy match
            tokenMatched = true;
          }
          else if (fields.brands.some(b => this.fuzzyMatches(term, b))) {
            score += this.weights.brandName * 0.7;
            tokenMatched = true;
          }
          else if (this.fuzzyMatches(term, fields.indication)) {
            score += this.weights.indication * 0.7;
            tokenMatched = true;
          }
          break;
      }

      if (tokenMatched) {
        matchedTokens.add(token);
      }
    }

    // Hard filter failures
    if (routeFilterFailed) {
      return { score: 0, matched: false, reason: 'route_mismatch' };
    }
    if (frequencyFilterFailed) {
      return { score: 0, matched: false, reason: 'frequency_mismatch' };
    }
    if (doseFilterFailed) {
      return { score: 0, matched: false, reason: 'dose_mismatch' };
    }
    if (durationFilterFailed) {
      return { score: 0, matched: false, reason: 'duration_mismatch' };
    }
    if (numericFilterFailed) {
      return { score: 0, matched: false, reason: 'numeric_mismatch' };
    }

    // All text tokens must match for the result to be included
    const textTokens = tokens.filter(t => t.type === 'text');
    const textMatched = textTokens.every(t => matchedTokens.has(t));

    if (textTokens.length > 0 && !textMatched) {
      return { score: 0, matched: false, reason: 'text_mismatch' };
    }

    // If we have any route or frequency tokens, at least one must match
    const routeFreqTokens = tokens.filter(t =>
      t.type === 'route' || t.type === 'frequency' || t.type === 'frequency_phrase' || t.type === 'ambiguous'
    );
    const routeFreqMatched = routeFreqTokens.length === 0 || routeFreqTokens.some(t => matchedTokens.has(t));

    if (!routeFreqMatched) {
      return { score: 0, matched: false, reason: 'filter_mismatch' };
    }

    return { score, matched: score > 0, matchedTokens };
  }

  // ============================================================================
  // MAIN SEARCH API
  // ============================================================================

  /**
   * Search medications with the query
   * Returns { adult: [], pediatric: [], other: [] }
   */
  search(query) {
    if (!query || query.trim() === '') {
      return { adult: [], pediatric: [], other: [] };
    }

    // Parse query into tokens
    const tokens = this.tokenizeQuery(query);

    if (tokens.length === 0) {
      return { adult: [], pediatric: [], other: [] };
    }

    // Score all medications
    const scoredResults = [];

    for (const med of this.medications) {
      const result = this.scoreMedication(med, tokens);

      if (result.matched && result.score > 0) {
        scoredResults.push({
          med,
          score: result.score
        });
      }
    }

    // Sort by score descending
    scoredResults.sort((a, b) => b.score - a.score);

    // Deduplicate
    const seen = new Set();
    const unique = [];

    for (const { med, score } of scoredResults) {
      const key = MedicationUtils.getSearchDedupeKey(med);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ med, score });
      }
    }

    // Group by population
    return this.groupByPopulation(unique.map(r => r.med));
  }

  /**
   * Get all highlight terms for UI highlighting
   * Expands tokens to include all synonyms and variations
   * (Public API used by SearchResultsRenderer)
   */
  normalizeSearchTerms(query) {
    const tokens = this.tokenizeQuery(query);
    const highlightTerms = new Set();

    for (const token of tokens) {
      // Always add the raw token
      if (token.raw) {
        highlightTerms.add(token.raw.toLowerCase());
      }

      switch (token.type) {
        case 'frequency':
        case 'frequency_phrase':
          // Add all frequency synonyms
          if (token.frequencyKey && this.frequencyDisplayMap[token.frequencyKey]) {
            for (const synonym of this.frequencyDisplayMap[token.frequencyKey]) {
              highlightTerms.add(synonym.toLowerCase());
            }
          }
          break;

        case 'route':
          // Add all route synonyms that map to the same route key
          for (const [routeText, routeKey] of Object.entries(this.routeMap)) {
            if (routeKey === token.routeKey) {
              highlightTerms.add(routeText.toLowerCase());
            }
          }
          break;

        case 'ambiguous':
          // Add both frequency and route synonyms
          if (token.frequencyKey && this.frequencyDisplayMap[token.frequencyKey]) {
            for (const synonym of this.frequencyDisplayMap[token.frequencyKey]) {
              highlightTerms.add(synonym.toLowerCase());
            }
          }
          if (token.routeKey) {
            for (const [routeText, routeKey] of Object.entries(this.routeMap)) {
              if (routeKey === token.routeKey) {
                highlightTerms.add(routeText.toLowerCase());
              }
            }
          }
          break;

        case 'numeric_with_unit':
          // Add variations of the numeric+unit (e.g., 7d, 7 day, 7 days, 7day)
          this.addNumericHighlightVariants(highlightTerms, token.value, token.unit, token.isRange, token.rangeMin, token.rangeMax);
          break;

        case 'numeric_only':
          // For unitless numerics, add the number itself
          // Also add common patterns that might contain this number
          if (token.value !== null) {
            highlightTerms.add(token.value.toString());
          }
          if (token.isRange) {
            highlightTerms.add(`${token.rangeMin}-${token.rangeMax}`);
            highlightTerms.add(`${token.rangeMin} to ${token.rangeMax}`);
          }
          break;

        case 'text':
          // Text tokens - just the normalized term
          if (token.normalized) {
            highlightTerms.add(token.normalized.toLowerCase());
          }
          break;
      }
    }

    return Array.from(highlightTerms).filter(Boolean);
  }

  /**
   * Add numeric highlight variants for a given value and unit
   * Handles both exact values and ranges
   * Also adds g<->mg conversions for dose highlighting
   * Also adds day<->week conversions for duration highlighting (exact multiples only)
   */
  addNumericHighlightVariants(terms, value, unit, isRange, rangeMin, rangeMax) {
    if (!unit) return;

    // Get all unit variations for this canonical unit
    const unitVariants = [];
    for (const [alias, canonical] of Object.entries(this.unitAliases)) {
      if (canonical === unit) {
        unitVariants.push(alias);
      }
    }
    // Also add the canonical unit itself
    unitVariants.push(unit);

    if (isRange && rangeMin !== undefined && rangeMax !== undefined) {
      // Add range patterns
      for (const unitVar of unitVariants) {
        terms.add(`${rangeMin}-${rangeMax}${unitVar}`);
        terms.add(`${rangeMin}-${rangeMax} ${unitVar}`);
        terms.add(`${rangeMin} to ${rangeMax} ${unitVar}`);
      }

      // Add g<->mg conversions for ranges
      if (unit === 'g') {
        const convertedMin = rangeMin * 1000;
        const convertedMax = rangeMax * 1000;
        const mgVariants = ['mg', 'mgs'];
        for (const mgVar of mgVariants) {
          terms.add(`${convertedMin}-${convertedMax}${mgVar}`);
          terms.add(`${convertedMin}-${convertedMax} ${mgVar}`);
          terms.add(`${convertedMin} to ${convertedMax} ${mgVar}`);
        }
      } else if (unit === 'mg') {
        const convertedMin = rangeMin / 1000;
        const convertedMax = rangeMax / 1000;
        const gVariants = ['g', 'gm', 'gms', 'gram', 'grams'];
        for (const gVar of gVariants) {
          terms.add(`${convertedMin}-${convertedMax}${gVar}`);
          terms.add(`${convertedMin}-${convertedMax} ${gVar}`);
          terms.add(`${convertedMin} to ${convertedMax} ${gVar}`);
        }
      }
    } else if (value !== null) {
      // Add single value patterns with all unit variations
      for (const unitVar of unitVariants) {
        terms.add(`${value}${unitVar}`);
        terms.add(`${value} ${unitVar}`);
      }

      // Add g<->mg conversions for single values
      if (unit === 'g') {
        const convertedValue = value * 1000;
        const mgVariants = ['mg', 'mgs'];
        for (const mgVar of mgVariants) {
          terms.add(`${convertedValue}${mgVar}`);
          terms.add(`${convertedValue} ${mgVar}`);
        }
      } else if (unit === 'mg') {
        const convertedValue = value / 1000;
        const gVariants = ['g', 'gm', 'gms', 'gram', 'grams'];
        for (const gVar of gVariants) {
          terms.add(`${convertedValue}${gVar}`);
          terms.add(`${convertedValue} ${gVar}`);
        }
      }

      // Note: We intentionally do NOT add the bare number here.
      // Range matching in highlightText uses parseFloat() on terms like "5d" to extract
      // the numeric value for range checking, so "6d" will still highlight "5-7 days".
      // Adding bare numbers would incorrectly highlight "5mg" when searching "5d".

      // Add day<->week conversions for duration values (exact multiples only)
      if (unit === 'day' && value % 7 === 0) {
        // Convert days to weeks
        const weeks = value / 7;
        const weekVariants = ['week', 'weeks', 'wk', 'wks'];
        for (const weekVar of weekVariants) {
          terms.add(`${weeks} ${weekVar}`);
          terms.add(`${weeks}${weekVar}`);
        }
      } else if (unit === 'week') {
        // Convert weeks to days
        const days = value * 7;
        const dayVariants = ['day', 'days', 'd'];
        for (const dayVar of dayVariants) {
          terms.add(`${days} ${dayVar}`);
          terms.add(`${days}${dayVar}`);
        }
      }
    }
  }

  /**
   * Group medications by population
   */
  groupByPopulation(medications) {
    const groups = {
      adult: [],
      pediatric: [],
      other: []
    };

    for (const med of medications) {
      const population = (med.population || '').toLowerCase().trim();

      if (population === 'adult') {
        groups.adult.push(med);
      } else if (population === 'pediatric') {
        groups.pediatric.push(med);
      } else {
        groups.other.push(med);
      }
    }

    // Sort each group by indication then med name
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
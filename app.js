// app.js

// -----------------------
// Config: Locations
// -----------------------
const DEFAULT_PRESCRIBER = {
  name: "Alvin Yang",
  cpso: "118749"
};

const DEFAULT_LOCATION_NAME = "Michael Garron Hospital";

// Hardcoded Base List (Read-Only)
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

// -----------------------
// App Config & State
// -----------------------
const COL_1_SPECS = ["Orders +", "Non-Med", "Allergy, Analgesia, Antiemetic", "Anti-infective", "Neuro & Endocrine"];
const COL_2_SPECS = ["Eye", "ENT", "Cardiac & Heme", "Respiratory", "GI & GU"];
const COL_3_SPECS = ["OBGYN", "STI", "Derm", "Psych", "Detox"];
const NESTED_SPECS = ["Allergy, Analgesia, Antiemetic", "ENT", "GI & GU"];

const SUBCAT_ORDER = { 
  "Ear": 1, "Nose": 2, "Throat": 3, "Other": 4, 
  "Allergy": 1, "Analgesia": 2, "Antiemetic": 3, 
  "GI": 1, "GU": 2,
  "Withdrawal Management": 1, "Symptom Relief": 2 
};

const POP_ORDER = { "Adult": 1, "Pediatric": 2 };

// Global State
let MEDS = [];
let cart = [];
let currentWeight = null;
let pendingMed = null;
let customLocations = []; 
let currentLocationName = DEFAULT_LOCATION_NAME;
let editingId = null;
let tabbingUnlocked = false;

// -----------------------
// Helpers
// -----------------------
function norm(x) { return (x ?? "").toString().trim(); }
function escapeHtml(s) {
  return (s ?? "").toString().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// Uniqueness key for CART (includes specialty so we know where it came from)
function cartKey(m) {
  return [norm(m.specialty), norm(m.subcategory), norm(m.population), norm(m.med), norm(m.dose_text), norm(m.route), norm(m.frequency), norm(m.duration), norm(m.dispense), norm(m.refill), norm(m.prn), norm(m.form), norm(m.comments)].join("||");
}

// Uniqueness key for SEARCH (EXCLUDES specialty/subcategory to prevent dupes)
function getSearchDedupeKey(m) {
  return [
    norm(m.population),
    norm(m.med),
    norm(m.dose_text),
    norm(m.route),
    norm(m.frequency),
    norm(m.duration),
    norm(m.dispense),
    norm(m.refill),
    norm(m.prn),
    norm(m.form),
    norm(m.comments)
  ].join("||");
}

// -- Highlighting Helpers --
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text, terms) {
  const cleanText = (text ?? "").toString();
  if (!terms || terms.length === 0) return escapeHtml(cleanText);

  // Match any term case-insensitively
  const pattern = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi');
  const parts = cleanText.split(pattern);

  return parts.map(part => {
    // If this part matches one of our terms (case insensitive check)
    if (terms.some(t => t.toLowerCase() === part.toLowerCase())) {
      return `<span class="highlight">${escapeHtml(part)}</span>`;
    }
    return escapeHtml(part);
  }).join('');
}

// -- Sorting Helper for Indications --
function compareMedsByIndication(a, b) {
  const indA = norm(a.indication).toLowerCase();
  const indB = norm(b.indication).toLowerCase();
  const medA = norm(a.med).toLowerCase();
  const medB = norm(b.med).toLowerCase();

  // Scenario 1: Both have indications
  if (indA && indB) {
    // If indications are different, sort by indication
    // Added numeric:true here just in case indications have numbers
    if (indA !== indB) return indA.localeCompare(indB, undefined, { numeric: true });
    
    // If indications are identical, secondary sort by Med Name
    // ENABLE NUMERIC SORT: This treats "16" as greater than "4"
    return medA.localeCompare(medB, undefined, { numeric: true });
  }

  // Scenario 2: Only A has indication (A comes first)
  if (indA && !indB) return -1;

  // Scenario 3: Only B has indication (B comes first)
  if (!indA && indB) return 1;

  // Scenario 4: Neither has indication (Sort by Med Name)
  return medA.localeCompare(medB, undefined, { numeric: true });
}

// -----------------------
// Location Logic
// -----------------------
function loadLocations() {
  // 1. Load Custom Locations
  try {
    const stored = localStorage.getItem("rx_custom_locations");
    if (stored) {
      customLocations = JSON.parse(stored);
    }
  } catch(e) { console.error("Loc load error", e); }

  // 2. Load Selected Location Name
  try {
    const lastLoc = localStorage.getItem("rx_current_location");
    if (lastLoc) {
      currentLocationName = lastLoc;
    }
  } catch(e) {}
  
  // Validate current selection still exists
  const all = getAllLocations();
  const exists = all.some(x => x.name === currentLocationName);
  if (!exists) {
    currentLocationName = DEFAULT_LOCATION_NAME;
    if (!all.some(x => x.name === currentLocationName)) {
      currentLocationName = all[0]?.name || "Unknown";
    }
  }
  
  updateHeaderLocation();
}

function getAllLocations() {
  const baseNames = new Set(BASE_LOCATIONS.map(x => x.name));
  const uniqueCustom = customLocations.filter(x => !baseNames.has(x.name));
  
  const all = [...BASE_LOCATIONS, ...uniqueCustom];
  all.sort((a,b) => a.name.localeCompare(b.name));
  return all;
}

function getCurrentLocationObj() {
  const all = getAllLocations();
  return all.find(x => x.name === currentLocationName) || BASE_LOCATIONS[0];
}

function updateHeaderLocation() {
  const btn = document.getElementById("locationBtn");
  btn.innerHTML = `<span class="loc-label">${escapeHtml(currentLocationName)}</span> <span class="arrow">▼</span>`;
}

function selectLocation(name) {
  currentLocationName = name;
  localStorage.setItem("rx_current_location", name);
  updateHeaderLocation();
  document.getElementById("locationMenu").classList.add("hidden");
}

function addCustomLocation(name, address) {
  const cleanName = norm(name);
  const cleanAddr = norm(address);
  
  if(!cleanName || !cleanAddr) {
    alert("Name and Address are required.");
    return false;
  }
  
  const all = getAllLocations();
  if(all.some(x => x.name.toLowerCase() === cleanName.toLowerCase())) {
    alert("This location name already exists.");
    return false;
  }
  
  customLocations.push({ name: cleanName, address: cleanAddr });
  localStorage.setItem("rx_custom_locations", JSON.stringify(customLocations));
  
  selectLocation(cleanName);
  return true;
}

function deleteCustomLocation(name) {
  customLocations = customLocations.filter(x => x.name !== name);
  localStorage.setItem("rx_custom_locations", JSON.stringify(customLocations));
  
  if(currentLocationName === name) {
    selectLocation(DEFAULT_LOCATION_NAME);
  } else {
    updateHeaderLocation();
  }
  renderLocationDropdown();
}

// -----------------------
// Location UI
// -----------------------
function renderLocationDropdown() {
  const listEl = document.getElementById("locationList");
  listEl.innerHTML = "";
  
  const all = getAllLocations();
  const baseNames = new Set(BASE_LOCATIONS.map(x => x.name));
  
  all.forEach(loc => {
    const isBase = baseNames.has(loc.name);
    const isSelected = loc.name === currentLocationName;
    
    const div = document.createElement("div");
    div.className = `loc-item ${isSelected ? 'selected' : ''}`;
    div.onclick = (e) => {
      selectLocation(loc.name);
    };
    
    const span = document.createElement("span");
    span.className = "loc-name";
    span.textContent = loc.name;
    div.appendChild(span);
    
    if (!isBase) {
      const btn = document.createElement("button");
      btn.className = "loc-delete-btn";
      btn.innerHTML = "&times;"; 
      btn.title = "Delete Location";
      btn.onclick = (e) => {
        e.stopPropagation(); 
        deleteCustomLocation(loc.name);
      };
      div.appendChild(btn);
    }
    
    listEl.appendChild(div);
  });
}

function toggleLocationMenu() {
  const menu = document.getElementById("locationMenu");
  const isHidden = menu.classList.contains("hidden");
  if(isHidden) {
    renderLocationDropdown();
    menu.classList.remove("hidden");
  } else {
    menu.classList.add("hidden");
  }
}

// -----------------------
// Dose Calculation Logic
// -----------------------
function calculateDoseDisplay(m, weight) {
  if (!m.weight_based || !weight || isNaN(weight) || weight <= 0) return null;
  const perKg = parseFloat(m.dose_per_kg_mg);
  const maxDose = parseFloat(m.max_dose_mg);
  if (!perKg) return null;
  let rawCalc = weight * perKg;
  let isMax = false;
  if (maxDose && rawCalc > maxDose) { rawCalc = maxDose; isMax = true; }
  let finalDose;
  if (rawCalc >= 10) finalDose = Math.floor(rawCalc);
  else finalDose = Math.floor(rawCalc * 10) / 10;
  let infoStr = `${perKg} mg/kg`;
  if (isMax) infoStr = `Max Dose reached; Ref: ${perKg} mg/kg`;
  return `<span class="calc-dose">${finalDose} mg</span> <span class="calc-note">(${infoStr})</span>`;
}

// -----------------------
// Cart Logic
// -----------------------
function generateUid() { return crypto.randomUUID(); }
function toggleCart(m) {
  // Check if a PURE (unedited) version of this template is already in cart
  // This allows the "selected" blue highlight to work for unedited templates.
  const templateKey = cartKey(m);
  const idx = cart.findIndex(x => !x.wasEdited && cartKey(x) === templateKey);

  if (idx >= 0) {
    cart.splice(idx, 1);
    renderCart(); markSelectedInLists();
    return;
  }

  if (m.weight_based && currentWeight === null) {
    pendingMed = m;
    openWeightModal(m);
  } else {
    addToCart(m);
  }
}
function addToCart(m) {
  const newEntry = JSON.parse(JSON.stringify(m));
  newEntry.uid = generateUid();
  newEntry.wasEdited = false; 
  cart.push(newEntry);
  renderCart();
  markSelectedInLists();
}
function removeFromCartById(uid) {
  const idx = cart.findIndex(x => x.uid === uid);
  if (idx >= 0) cart.splice(idx, 1);
  renderCart();
  markSelectedInLists();
}
function clearCart() { cart.length = 0; renderCart(); markSelectedInLists(); }

// -----------------------
// Modals
// -----------------------
function openEditModal(uid) {
  const item = cart.find(x => x.uid === uid);
  if (!item) return;
  editingId = uid;
  tabbingUnlocked = false; // Reset lock state when opening

  let displayDose = item.dose_text;
  if (item.weight_based && !item.wasEdited && currentWeight) {
    const calc = calculateDoseDisplay(item, currentWeight);
    if (calc) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = calc;
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
  document.getElementById("editComments").value = item.comments || "";

  // Add click listeners to all fields to unlock tabbing
  const fields = ["editDose", "editRoute", "editFreq", "editDur", "editDispense", "editRefill", "editForm", "editPrn", "editComments"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    el.onclick = () => { tabbingUnlocked = true; };
  });

  document.getElementById("editModal").classList.remove("hidden");
}
function saveEdit() {
  const item = cart.find(x => x.uid === editingId);
  if (item) {
    item.dose_text = document.getElementById("editDose").value;
    item.route = document.getElementById("editRoute").value;
    item.frequency = document.getElementById("editFreq").value;
    item.duration = document.getElementById("editDur").value;
    item.dispense = document.getElementById("editDispense").value;
    item.refill = document.getElementById("editRefill").value;
    item.form = document.getElementById("editForm").value;
    item.prn = document.getElementById("editPrn").value;
    item.comments = document.getElementById("editComments").value;
    
    item.wasEdited = true; // Strips weight metadata on print
  }
  closeEditModal();
  renderCart();
  markSelectedInLists();
}
function closeEditModal() {
  document.getElementById("editModal").classList.add("hidden");
  editingId = null;
}
function openWeightModal(m) {
  pendingMed = m;
  const modal = document.getElementById("weightModal");
  document.getElementById("modalWeightInput").value = "";
  modal.classList.remove("hidden");
  document.getElementById("modalWeightInput").focus();
}
function closeWeightModal() { document.getElementById("weightModal").classList.add("hidden"); pendingMed = null; }
function saveModalWeight() {
  const val = parseFloat(document.getElementById("modalWeightInput").value);
  if (!isNaN(val) && val > 0) {
    currentWeight = val;
    document.getElementById("weightInput").value = val.toFixed(2);
    if (pendingMed) addToCart(pendingMed); // Use addToCart to generate UID
  } else if (pendingMed) { 
    alert("Please enter valid weight or Skip."); 
    return; 
  }
  closeWeightModal();
}
function skipModalWeight() {
  if (pendingMed) addToCart(pendingMed); // Use addToCart to generate UID
  closeWeightModal();
}

// Location Modal
function openAddLocationModal() {
  document.getElementById("locationMenu").classList.add("hidden"); 
  document.getElementById("newLocName").value = "";
  document.getElementById("newLocAddress").value = "";
  document.getElementById("locationModal").classList.remove("hidden");
  document.getElementById("newLocName").focus();
}
function closeLocationModal() {
  document.getElementById("locationModal").classList.add("hidden");
}
function saveNewLocation() {
  const name = document.getElementById("newLocName").value;
  const addr = document.getElementById("newLocAddress").value;
  if(addCustomLocation(name, addr)) {
    closeLocationModal();
  }
}

// -----------------------
// Data Load
// -----------------------
async function loadMeds() {
  try {
    const res = await fetch("Prescriptions.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed");
    const data = await res.json();
    MEDS = Array.isArray(data.meds) ? data.meds : [];
  } catch (e) { console.error(e); }
}

// -----------------------
// Rendering
// -----------------------
function getMedDetailsArray(m, overrideDose = null) {
  const dose = overrideDose || m.dose_text;
  
  return [
    dose, 
    m.form ? `${m.form} form` : null, 
    m.route, 
    m.frequency, 
    m.duration, 
    // PRN PLACEMENT: After frequency/duration, before dispense
    m.prn ? `PRN: ${m.prn}` : null,
    m.comments, 
    m.dispense ? `Dispense: ${m.dispense}` : null, 
    m.refill ? `Refills: ${m.refill}` : null
  ].filter(val => val && String(val).trim() !== "");
}

function renderMedHTML(m, showPopulation = false, highlightTerms = []) {
  const detailsString = getMedDetailsArray(m, null).join(", ");
  
  const format = (txt) => (highlightTerms.length > 0) 
    ? highlightText(txt, highlightTerms) 
    : escapeHtml(txt);

  // PREPARE INDICATION HTML (New Line, Italics, No Colon)
  let indicationHtml = "";
  if (m.indication) {
    const safeInd = format(m.indication);
    // Using <div> triggers the new line structure defined in CSS
    indicationHtml = `<div class="med-indication">${safeInd}</div>`;
  }

  const medNameHtml = format(m.med);
  const detailsHtml = format(detailsString);
  
  const popLabel = (showPopulation && m.population) 
    ? `<span style="font-weight:normal; color:#666; font-size:0.9em; margin-left:4px;">(${escapeHtml(m.population)})</span>` 
    : "";

  let brandHint = "";
  if (highlightTerms.length > 0 && Array.isArray(m.brands)) {
    const matchedBrand = m.brands.find(brand => 
      highlightTerms.some(term => brand.toLowerCase().includes(term))
    );
    if (matchedBrand) {
      const safeBrand = highlightText(matchedBrand, highlightTerms);
      brandHint = `<span class="brand-match-hint">(matches ${safeBrand})</span>`;
    }
  }

  // RETURN: Indication on line 1 (if exists), rest on line 2
  return `${indicationHtml}<div><span class="med-name-text">${medNameHtml}${popLabel}${brandHint}</span> <span class="med-details-text">${detailsHtml}</span></div>`;
}

function groupBySpecialty(meds) {
  const map = new Map();
  for (const m of meds) { const s = norm(m.specialty) || "Uncategorized"; if (!map.has(s)) map.set(s, []); map.get(s).push(m); }
  return map;
}
function getPopOrder(p) { return POP_ORDER[p] || 99; }
function getSubOrder(s) { return SUBCAT_ORDER[s] || 99; }

function createMedItemElement(m, showPop = false, highlightTerms = []) {
  const div = document.createElement("div");
  div.className = "med-item";
  div.dataset.key = cartKey(m);
  div.innerHTML = renderMedHTML(m, showPop, highlightTerms);
  div.onclick = () => toggleCart(m);
  return div;
}

function createSubfolder(label, nodes, isNested = false) {
  const d = document.createElement("details");
  d.className = isNested ? "subfolder nested-level" : "subfolder";
  const s = document.createElement("summary");
  s.className = "subfolder-summary";
  s.innerHTML = `<span class="subfolder-arrow">▶</span> ${escapeHtml(label)}`;
  const c = document.createElement("div");
  c.className = "subfolder-content";
  nodes.forEach(n => c.appendChild(n));
  d.appendChild(s); d.appendChild(c);
  return d;
}

function renderSpecialtyCard(spec, specMeds) {
  const d = document.createElement("details");
  d.className = "specialty-card";
  const s = document.createElement("summary");
  s.className = "specialty-header";
  s.textContent = spec;
  d.appendChild(s);
  const b = document.createElement("div");
  b.className = "specialty-body";

  // Use the new comparison function here
  const sortMeds = (list) => list.sort(compareMedsByIndication);

  if (NESTED_SPECS.includes(spec)) {
    const byPop = new Map();
    specMeds.forEach(m => { const p = norm(m.population)||"Unspecified"; if(!byPop.has(p)) byPop.set(p,[]); byPop.get(p).push(m); });
    [...byPop.keys()].sort((x,y) => getPopOrder(x)-getPopOrder(y)).forEach(pop => {
       const popMeds = byPop.get(pop);
       const bySub = new Map();
       popMeds.forEach(m => { const sb = norm(m.subcategory)||"General"; if(!bySub.has(sb)) bySub.set(sb,[]); bySub.get(sb).push(m); });

       const subNodes = [];
       [...bySub.keys()].sort((x,y) => getSubOrder(x)-getSubOrder(y)).forEach(sub => {
         const meds = sortMeds(bySub.get(sub));
         subNodes.push(createSubfolder(sub, meds.map(m=>createMedItemElement(m,false)), true));
       });
       b.appendChild(createSubfolder(pop, subNodes, false));
    });
  } else {
    const map = new Map();
    specMeds.forEach(m => {
       const sub = norm(m.subcategory); const pop = norm(m.population);
       let label = "General";
       if (spec === "Detox") label = sub || "General";
       else if (sub && pop) label = `${sub} (${pop})`;
       else if (sub) label = sub;
       else if (pop) label = pop;
       if(!map.has(label)) map.set(label,[]); map.get(label).push(m);
    });
    const isSingle = map.size === 1;
    [...map.keys()].sort((x,y) => {
        return getSubOrder(x) - getSubOrder(y); 
    }).forEach(lbl => {
       const meds = sortMeds(map.get(lbl));
       if (isSingle) meds.forEach(m => b.appendChild(createMedItemElement(m,false)));
       else b.appendChild(createSubfolder(lbl, meds.map(m=>createMedItemElement(m,false)), false));
    });
  }
  d.appendChild(b);
  return d;
}

function renderDashboard() {
  const c1 = document.getElementById("col1"), c2 = document.getElementById("col2"), c3 = document.getElementById("col3");
  c1.innerHTML=""; c2.innerHTML=""; c3.innerHTML="";
  const bySpec = groupBySpecialty(MEDS);
  const add = (list, col) => list.forEach(s => { if(bySpec.has(s)) col.appendChild(renderSpecialtyCard(s, bySpec.get(s))); });
  add(COL_1_SPECS, c1); add(COL_2_SPECS, c2); add(COL_3_SPECS, c3);
  markSelectedInLists();
}

function renderSearchResults(q) {
  const d = document.getElementById("dashboardView"), 
        s = document.getElementById("searchView"), 
        r = document.getElementById("searchResults");

  if (!q || q.trim() === "") { 
    s.classList.add("hidden"); 
    d.classList.remove("hidden"); 
    return; 
  }

  d.classList.add("hidden"); 
  s.classList.remove("hidden"); 
  r.innerHTML = "";
  
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  
  // List of terms that should strictly match Pediatric items
  const pedsSynonyms = "pediatric paediatric pediatrics paediatrics child children infant toddler peds ped paeds";

  // 1. Find matches
  const rawHits = MEDS.filter(m => {
    let t = m.search_text || [m.med, m.dose_text, m.comments, m.indication, m.prn, m.specialty].join(" ");
    
    // If this is a pediatric med, inject the synonyms into the search string
    // so that searching "child", "infant", etc. will return true for this item.
    if ((m.population || "").toLowerCase() === "pediatric") {
      t += " " + pedsSynonyms;
    }

    t = t.toLowerCase();
    return terms.every(term => t.includes(term));
  });

  // 2. Deduplicate matches
  const seen = new Set();
  const uniqueHits = [];
  
  rawHits.forEach(m => {
    const key = getSearchDedupeKey(m);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueHits.push(m);
    }
  });

  if (uniqueHits.length === 0) {
    r.innerHTML = `<div style="padding:15px; color:#666;">No matches found.</div>`;
    return;
  }

  // 3. Separate into Groups
  const adultMatches = uniqueHits.filter(m => norm(m.population).toLowerCase() === "adult");
  const pedsMatches = uniqueHits.filter(m => norm(m.population).toLowerCase() === "pediatric");
  const otherMatches = uniqueHits.filter(m => {
     const p = norm(m.population).toLowerCase();
     return p !== "adult" && p !== "pediatric";
  });

  // 4. Sort each group
  adultMatches.sort(compareMedsByIndication);
  pedsMatches.sort(compareMedsByIndication);
  otherMatches.sort(compareMedsByIndication);

  // 5. Helper to render a group section
  const renderGroup = (title, items) => {
    if (items.length === 0) return;

    const header = document.createElement("div");
    header.style.background = "#eef3f8"; 
    header.style.color = "#2c3e50";
    header.style.padding = "10px 12px";
    header.style.fontWeight = "700";
    header.style.fontSize = "14px";
    header.style.borderBottom = "1px solid #dbe0e6";
    header.textContent = title;
    r.appendChild(header);

    items.forEach(m => { 
      const row = createMedItemElement(m, false, terms); 
      row.style.borderBottom = "1px solid #eee"; 
      r.appendChild(row); 
    });
  };

  // 6. Render groups
  renderGroup("Adult", adultMatches);
  renderGroup("Pediatric", pedsMatches);
  renderGroup("Other", otherMatches);
  
  markSelectedInLists();
}

function renderCart() {
  const el = document.getElementById("cartList");
  const countLabel = document.querySelector(".cart-count");
  if (countLabel) countLabel.textContent = `${cart.length} prescription${cart.length === 1 ? '' : 's'}`;

  if (cart.length === 0) {
    el.innerHTML = `<div class="cart-empty">None selected</div>`;
    return;
  }

  el.innerHTML = cart.map((m) => {
    let d = m.dose_text;
    if (m.weight_based && currentWeight && !m.wasEdited) {
      const c = calculateDoseDisplay(m, currentWeight);
      if (c) d = c;
    }
    
    const details = getMedDetailsArray(m, d).join(", ");

    return `
      <div class="cart-item">
        <div class="cart-med-name">${escapeHtml(m.med)}</div>
        <button class="icon-btn" onclick="removeFromCartById('${m.uid}')">×</button>
        <div class="cart-med-details">${escapeHtml(details)}</div>
        <button class="edit-btn" onclick="openEditModal('${m.uid}')">Edit</button>
      </div>`;
  }).join("");
}

function markSelectedInLists() {
  document.querySelectorAll(".med-item").forEach(el => {
    // Only highlight if the cart contains a version that matches the template AND hasn't been edited
    const isSelected = cart.some(x => !x.wasEdited && cartKey(x) === el.dataset.key);
    if (isSelected) el.classList.add("in-cart");
    else el.classList.remove("in-cart");
  });
}

// -----------------------
// Print
// -----------------------
function printCart() {
  if (cart.length === 0) return;
  const dateStr = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  
  const loc = getCurrentLocationObj();
  
  const payload = {
    prescriber: { 
      name: DEFAULT_PRESCRIBER.name,
      cpso: DEFAULT_PRESCRIBER.cpso,
      address: loc.address 
    },
    dateStr,
    items: cart.map(m => {
      let d = m.dose_text;
      if (m.weight_based && currentWeight) {
        const c = calculateDoseDisplay(m, currentWeight);
        if (c) d = c;
      }
      return { ...m, dose_text: d };
    })
  };

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Print</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; font-size: 11pt; color: #000; background: #fff; }
    
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tbody { display: table-row-group; }
    tr { page-break-inside: avoid; } 
    
    .header-wrapper { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      padding-bottom: 15px; 
      margin-bottom: 10px; 
      border-bottom: 3px solid #000; 
    }
    .sticker-box { width: 3in; height: 2in; border: 2px solid #ccc; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 10pt; }
    .provider-col { text-align: right; width: 3.5in; display: flex; flex-direction: column; justify-content: space-between; height: 2in; }
    .provider-name { font-weight: 700; font-size: 14pt; margin-bottom: 4px; }
    .provider-meta { font-size: 10pt; color: #333; }
    .sig-area { margin-top: auto; display: flex; flex-direction: column; align-items: flex-end; }
    .sig-line-wrap { display: flex; align-items: baseline; gap: 10px; width: 100%; justify-content: flex-end; }
    .sig-rule { border-bottom: 1px solid #000; width: 200px; height: 1px; }
    
    .rx-item { padding: 12px 0; border-bottom: 1px solid #ddd; }
    .rx-title { font-weight: 700; font-size: 12pt; margin-bottom: 4px; }
    .rx-details { margin-left: 20px; line-height: 1.4; }
    .rx-meta { margin-top: 6px; font-size: 10pt; color: #444; }
    .rx-comments { margin-top: 8px; font-style: italic; background: #f4f4f4; padding: 6px 10px; border-radius: 6px; display: inline-block; }
    
    td { vertical-align: top; padding: 0; }
  </style></head><body>
  
  <table>
    <thead>
      <tr>
        <td>
           <div id="header-container"></div>
        </td>
      </tr>
    </thead>
    <tbody id="med-list-body">
      </tbody>
  </table>

  <script>
    try {
      const DATA = ${JSON.stringify(payload)};
      const ROUTES={"PO":"orally","IM":"intramuscularly","IV":"intravenously","SC":"subcutaneously","SQ":"subcutaneously","TOP":"topically","PR":"rectally","PV":"vaginally","SL":"sublingually","INH":"by inhalation","NEB":"by nebulizer","OU":"in both eyes","OD":"in right eye","OS":"in left eye","AU":"in both ears","AD":"in right ear","AS":"in left ear","NASAL":"intranasally","VAG":"vaginally","TD":"transdermally","CHEWED":"chewed"};
      const FREQS={"QD":"once daily","OD":"once daily","DAILY":"once daily","BID":"twice daily","TID":"three times daily","QID":"four times daily","QHS":"at bedtime","QAM":"in the morning","QPM":"in the evening","Q4H":"every 4 hours","Q6H":"every 6 hours","Q8H":"every 8 hours","Q12H":"every 12 hours","Q2H":"every 2 hours","Q5MINS":"every 5 minutes","QMWF":"every Monday, Wednesday, and Friday","PRN":"as needed"};
      const TERMS={"SUSP":"suspension","SOLN":"solution","TAB":"tablet","CAP":"capsule","CAPLT":"caplet","OINT":"ointment","CRM":"cream","LOT":"lotion","GTT":"drops","INJ":"injection","BTL":"bottle","SUPP":"suppository","PWDR":"powder","MDI":"inhaler","CAPT":"capsule","CHEW":"chewable tablet","EC TAB":"enteric-coated tablet","ER TAB":"extended-release tablet","DEV":"device"};
      
      function esc(s){return (s||"").toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
      function strip(h){let t=document.createElement("div");t.innerHTML=h;return t.textContent||t.innerText||"";}
      function expand(s,d){
        if(!s)return"";
        // Create a single regex for all keys to prevent double-replacement
        const keys = Object.keys(d).sort((a,b)=>b.length-a.length).join("|");
        const pattern = new RegExp("\\\\b("+keys+")\\\\b", "gi");
        return s.replace(pattern, m => d[m.toUpperCase()] || m);
      }
      function fmtDur(d){if(!d)return"";return d.replace(/^(\\d+)\\s*(d|day|wk|week|mo|mth|month|yr|year)s?$/i,(m,p1,p2)=>{
        let u=p2.toLowerCase(); if(u==='d')u='day'; if(u==='wk')u='week'; if(u.startsWith('m'))u='month';
        return \`for \${p1} \${u}\${p1==1?'':'s'}\`;
      });}
      
      function getHead(){
        return \`<div class="header-wrapper"><div class="sticker-box"></div><div class="provider-col"><div class="provider-info">
        <div class="provider-name">\${esc(DATA.prescriber.name)}</div><div class="provider-meta">CPSO: \${esc(DATA.prescriber.cpso)}</div>
        <div class="provider-meta">\${esc(DATA.prescriber.address)}</div><div class="provider-meta" style="margin-top:8px;"><strong>Date:</strong> \${DATA.dateStr}</div></div>
        <div class="sig-area"><div class="sig-line-wrap"><strong>Signature:</strong><div class="sig-rule"></div></div></div></div></div>\`;
      }
      
      function getItem(m,i){
        let dose=m.dose_text||""; 
        let plain=strip(dose).trim(); 
        let expandedDose = expand(plain, TERMS);
        let expDoseLower = expandedDose.toLowerCase();
        let form=(m.form||"").trim(); 
        let expandedForm = expand(form,TERMS);
        let expFormLower = expandedForm.toLowerCase();
        let expFormSingular = expFormLower.endsWith('s') ? expFormLower.slice(0, -1) : expFormLower;
        let line2 = ""; 
        if(expandedForm && 
           !expDoseLower.includes(expFormLower) && 
           !expDoseLower.includes(expFormSingular) && 
           !plain.toLowerCase().includes("see instructions")) {
          line2 = expandedForm;
        }
        let finalDose = dose.includes("<span") ? dose : esc(expandedDose);
        
        // 1. Calculate PRN Suffix
        let prnSuffix = "";
        if (m.prn) {
           // If freq is explicitly 'PRN', text is already 'as needed', so just add ' for ...'
           // Otherwise add ' as needed for ...'
           if ((m.frequency||"").toUpperCase() === "PRN") {
              prnSuffix = "for " + esc(m.prn);
           } else {
              prnSuffix = "as needed for " + esc(m.prn);
           }
        }

        // 2. Build the SIG (Instructions) Line
        let sig=[
          finalDose, 
          esc(line2), 
          esc(expand(m.route||"",ROUTES)), 
          esc(expand(m.frequency||"",FREQS)), 
          prnSuffix, // Added PRN here
          fmtDur(m.duration)
        ].filter(Boolean).join(" ");

        // 3. Build the META (Disp/Refill) Line - PRN REMOVED
        let metaParts = [];
        if(m.dispense) metaParts.push(\`Dispense: <strong>\${esc(m.dispense)}</strong>\`);
        if(m.refill) metaParts.push(\`Refills: <strong>\${esc(m.refill)}</strong>\`);

        let meta = metaParts.join(" &nbsp;|&nbsp; ");

        // 4. Construct HTML
        return \`<div class="rx-item"><div class="rx-title">\${i+1}. \${esc(m.med)}</div><div class="rx-details"><div>\${sig}</div>\${meta?\`<div class="rx-meta">\${meta}</div>\`:""}\${m.comments?\`<div class="rx-comments">Note: \${esc(m.comments)}</div>\`:""}</div></div>\`;
      }
      
      // Init
      document.getElementById("header-container").innerHTML = getHead();
      
      const tbody = document.getElementById("med-list-body");
      const rowsHtml = DATA.items.map((m,i) => {
         return \`<tr><td>\${getItem(m,i)}</td></tr>\`;
      }).join("");
      tbody.innerHTML = rowsHtml;

      window.focus(); 
      setTimeout(() => window.print(), 100);
      
    } catch(err) {
      alert("Print generation error: " + err.message);
    }
  </script></body></html>`;

  let f = document.getElementById('printFrame');
  if (f) f.remove();
  f = document.createElement('iframe');
  f.id = 'printFrame'; f.style.display='none';
  document.body.appendChild(f);
  const d = f.contentWindow.document;
  d.open(); d.write(html); d.close();
  
  // Clean up
  currentWeight = null;
  document.getElementById("weightInput").value = "";
  renderCart();
}

// -----------------------
// Initialization
// -----------------------
(async function init() {
  loadLocations(); 

  // Event Listeners
  document.getElementById("locationBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleLocationMenu();
  });
  
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("locationMenu");
    const btn = document.getElementById("locationBtn");
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.add("hidden");
    }
  });

  document.getElementById("openAddLocationBtn").addEventListener("click", openAddLocationModal);
  document.getElementById("cancelLocBtn").addEventListener("click", closeLocationModal);
  document.getElementById("saveLocBtn").addEventListener("click", saveNewLocation);

  // Allow Enter key to save new location
  ["newLocName", "newLocAddress"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveNewLocation();
    });
  });

  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  
  searchInput.addEventListener("input", (e) => {
    renderSearchResults(e.target.value);
    if(e.target.value.trim().length > 0) clearSearchBtn.classList.add("visible");
    else clearSearchBtn.classList.remove("visible");
  });

  // NEW: Search Input ESC Handler
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      searchInput.value = "";
      renderSearchResults("");
      clearSearchBtn.classList.remove("visible");
    }
  });
  
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = ""; renderSearchResults("");
    clearSearchBtn.classList.remove("visible"); searchInput.focus();
  });

  // Weight Input: Real-time update
  document.getElementById("weightInput").addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    currentWeight = (!isNaN(val) && val > 0) ? val : null;
    renderCart();
  });

  // Weight Input: Formatting on finish (blur/enter)
  document.getElementById("weightInput").addEventListener("change", (e) => {
    let val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      const formatted = val.toFixed(2);
      e.target.value = formatted;
      currentWeight = parseFloat(formatted);
      renderCart();
    }
  });

  document.getElementById("modalSaveBtn").addEventListener("click", saveModalWeight);
  document.getElementById("modalSkipBtn").addEventListener("click", skipModalWeight);
  document.getElementById("modalWeightInput").addEventListener("keydown", (e) => { if (e.key === "Enter") saveModalWeight(); });
  
  // Updated Global Keydown
  document.addEventListener("keydown", (e) => {
  const weightModal = document.getElementById("weightModal");
  const locationModal = document.getElementById("locationModal");
  const editModal = document.getElementById("editModal");

  // --- Edit Modal Specific Logic ---
  if (!editModal.classList.contains("hidden")) {
    
    // 1. Handle Tabbing
    if (e.key === "Tab") {
      // Disable backward navigation (Shift + Tab)
      if (e.shiftKey) {
        e.preventDefault();
        return;
      }

      // If user hasn't clicked a field yet, block all tabbing
      if (!tabbingUnlocked) {
        e.preventDefault();
        return;
      }

      // If focus is in the Note field, block advancing
      if (document.activeElement.id === "editComments") {
        e.preventDefault();
        return;
      }
    }

    // 2. Handle Enter (Save)
    if (e.key === "Enter") {
      if (document.activeElement.id !== "editComments") {
        e.preventDefault();
        saveEdit();
        return;
      }
    }

    // 3. Handle Escape (Cancel)
    if (e.key === "Escape") {
      closeEditModal();
      return;
    }
  }

  // --- Other Modal/UI Logic ---
  if (e.key === "Escape") {
    if (!weightModal.classList.contains("hidden")) skipModalWeight();
    if (!locationModal.classList.contains("hidden")) closeLocationModal();
  }

  if (!locationModal.classList.contains("hidden") && e.key === "Enter") {
    saveNewLocation();
  }

  const locMenu = document.getElementById("locationMenu");
  if (!locMenu.classList.contains("hidden") && e.key.length === 1 && e.key.match(/[a-z]/i)) {
    e.preventDefault();
    const char = e.key.toLowerCase();
    const items = document.querySelectorAll("#locationList .loc-item");
    for (let item of items) {
      const name = item.querySelector(".loc-name").textContent.trim().toLowerCase();
      if (name.startsWith(char)) {
        item.scrollIntoView({ block: "start", behavior: "auto" });
        break;
      }
    }
  }
});

  document.getElementById("printBtn").addEventListener("click", printCart);
  document.getElementById("clearCartBtn").addEventListener("click", clearCart);
  document.getElementById("cancelEditBtn").addEventListener("click", closeEditModal);
  document.getElementById("saveEditBtn").addEventListener("click", saveEdit);
  document.getElementById("resetViewBtn").addEventListener("click", () => {
    document.querySelectorAll("details").forEach(el => el.open = false);
    currentWeight = null; document.getElementById("weightInput").value = "";
    searchInput.value = ""; renderSearchResults(""); clearSearchBtn.classList.remove("visible");
    clearCart();
  });

  await loadMeds();
  renderDashboard();
  renderCart();
})();
/**
 * OHIP ED Billing Reference — Search Engine (Simple Matching)
 *
 * Pipeline:
 *  1. Normalize input (lowercase, strip punctuation)
 *  2. Tokenize (split on whitespace)
 *  3. Score each code (tiered matching per token)
 *  4. AND logic (all tokens must match)
 *  5. Multi-token bonus (1.5×)
 *  6. Group by name prefix, sort groups by best score, cap, return
 */

// ─── Scoring weights ────────────────────────────────────────────────
const TIER_WEIGHTS = {
  CODE_EXACT: 100,
  CODE_PREFIX: 60,
  SEARCH_TERMS_EXACT: 50,
  NAME_EXACT_WORD: 45,
  SEARCH_TERMS_SUBSTRING: 25,
  NAME_SUBSTRING: 20,
};

const ALL_TOKENS_BONUS = 1.5;
const MAX_RESULTS = 50;
const MIN_PREFIX_LENGTH = 2;
const MIN_SUBSTRING_LENGTH = 3;

// ─── State — populated by loadSearchData() ──────────────────────────
let billingCodes = [];
let diagnosticCodes = [];

// ─── Data loading ───────────────────────────────────────────────────

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

async function loadSearchData(basePath = "data/billing/") {
  const [billing, diagnostic] = await Promise.all([
    loadJSON(basePath + "billing_codes.json"),
    loadJSON(basePath + "diagnostic_codes.json"),
  ]);

  billingCodes = billing;
  diagnosticCodes = diagnostic;

  // Pre-compute lowercase search data on each code for faster matching
  for (const code of [...billingCodes, ...diagnosticCodes]) {
    code._lowerCode = (code.code || "").toLowerCase();
    var fullName = code.subcategory
      ? code.subcategory + " " + code.name
      : code.name || "";
    code._lowerName = fullName.toLowerCase();
    code._lowerNameWords = code._lowerName.split(/\s+/);
    code._lowerSearchTerms = (code.search_terms || []).map(function (t) {
      return t.toLowerCase();
    });
  }
}

// ─── Pipeline steps ─────────────────────────────────────────────────

/** Step 1: Normalize input */
function normalize(query) {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s&\-'/]/g, "") // keep &, -, ', / for medical terms
    .replace(/\s+/g, " ");
}

/** Step 2: Tokenize */
function tokenize(normalized) {
  return normalized.split(" ").filter(function (t) {
    return t.length > 0;
  });
}

/** Step 3: Score a single token against a code. Returns best tier score. */
function bestTierScore(code, token) {
  var best = 0;

  // Tier 1: Code exact match
  if (code._lowerCode === token) {
    return TIER_WEIGHTS.CODE_EXACT;
  }

  // Tier 2: Code prefix match (≥2 chars)
  if (token.length >= MIN_PREFIX_LENGTH && code._lowerCode.indexOf(token) === 0) {
    best = TIER_WEIGHTS.CODE_PREFIX;
  }

  // Tier 3: search_terms exact word match
  for (var i = 0; i < code._lowerSearchTerms.length; i++) {
    if (code._lowerSearchTerms[i] === token) {
      return Math.max(best, TIER_WEIGHTS.SEARCH_TERMS_EXACT);
    }
  }

  // Tier 4: Name exact word match
  for (var j = 0; j < code._lowerNameWords.length; j++) {
    if (code._lowerNameWords[j] === token) {
      best = Math.max(best, TIER_WEIGHTS.NAME_EXACT_WORD);
      break;
    }
  }

  if (token.length >= MIN_SUBSTRING_LENGTH) {
    // Tier 5: search_terms substring match
    for (var k = 0; k < code._lowerSearchTerms.length; k++) {
      if (code._lowerSearchTerms[k].indexOf(token) !== -1) {
        best = Math.max(best, TIER_WEIGHTS.SEARCH_TERMS_SUBSTRING);
        break;
      }
    }

    // Tier 6: Name substring match
    if (code._lowerName.indexOf(token) !== -1) {
      best = Math.max(best, TIER_WEIGHTS.NAME_SUBSTRING);
    }
  }

  return best;
}

/** Score a code against all tokens. Returns 0 if any token fails to match (AND logic). */
function scoreCode(code, tokens) {
  var total = 0;
  for (var i = 0; i < tokens.length; i++) {
    var tokenScore = bestTierScore(code, tokens[i]);
    if (tokenScore === 0) return 0; // AND logic: all tokens must match
    total += tokenScore;
  }
  // Multi-token bonus
  if (tokens.length > 1) {
    total *= ALL_TOKENS_BONUS;
  }
  return total;
}

/** Group results by name prefix (text before " – ") and sort groups by best score. */
function groupedSort(results) {
  if (results.length === 0) return results;

  function groupKey(result) {
    var name = result.code.name || "";
    var idx = name.indexOf(" \u2013 "); // en-dash
    if (idx === -1) idx = name.indexOf(" - ");
    return idx !== -1 ? name.substring(0, idx) : name;
  }

  // Build groups
  var groupMap = {};
  var groupKeys = [];
  for (var i = 0; i < results.length; i++) {
    var key = groupKey(results[i]);
    if (!groupMap[key]) {
      groupMap[key] = { bestScore: 0, firstIndex: results[i]._dataIndex, items: [] };
      groupKeys.push(key);
    }
    var grp = groupMap[key];
    grp.items.push(results[i]);
    if (results[i].score > grp.bestScore) {
      grp.bestScore = results[i].score;
    }
    if (results[i]._dataIndex < grp.firstIndex) {
      grp.firstIndex = results[i]._dataIndex;
    }
  }

  // Sort groups by best score desc, then by earliest data position
  groupKeys.sort(function (a, b) {
    return groupMap[b].bestScore - groupMap[a].bestScore
      || groupMap[a].firstIndex - groupMap[b].firstIndex;
  });

  // Within each group: score desc, then data order for ties
  for (var j = 0; j < groupKeys.length; j++) {
    groupMap[groupKeys[j]].items.sort(function (a, b) {
      return b.score - a.score || a._dataIndex - b._dataIndex;
    });
  }

  // Flatten
  var sorted = [];
  for (var k = 0; k < groupKeys.length; k++) {
    var items = groupMap[groupKeys[k]].items;
    for (var l = 0; l < items.length; l++) {
      sorted.push(items[l]);
    }
  }
  return sorted;
}

// ─── Main search function ───────────────────────────────────────────

function search(query) {
  if (!query || query.trim().length === 0) {
    return { billing: [], diagnostic: [], billingTotal: 0, diagnosticTotal: 0 };
  }

  // Step 1: Normalize
  var normalized = normalize(query);
  if (normalized.length === 0) {
    return { billing: [], diagnostic: [], billingTotal: 0, diagnosticTotal: 0 };
  }

  // Step 2: Tokenize
  var tokens = tokenize(normalized);
  if (tokens.length === 0) {
    return { billing: [], diagnostic: [], billingTotal: 0, diagnosticTotal: 0 };
  }

  // Step 3-5: Score all codes
  var billingResults = [];
  for (var i = 0; i < billingCodes.length; i++) {
    var score = scoreCode(billingCodes[i], tokens);
    if (score > 0) {
      billingResults.push({ code: billingCodes[i], score: score, _dataIndex: i });
    }
  }

  var diagnosticResults = [];
  for (var j = 0; j < diagnosticCodes.length; j++) {
    var score2 = scoreCode(diagnosticCodes[j], tokens);
    if (score2 > 0) {
      diagnosticResults.push({ code: diagnosticCodes[j], score: score2, _dataIndex: j });
    }
  }

  // Step 6: Group by name prefix, sort groups by best score, then flatten
  billingResults = groupedSort(billingResults);
  diagnosticResults = groupedSort(diagnosticResults);

  return {
    billing: billingResults.slice(0, MAX_RESULTS),
    diagnostic: diagnosticResults.slice(0, MAX_RESULTS),
    billingTotal: billingResults.length,
    diagnosticTotal: diagnosticResults.length,
  };
}

// ─── Exports ────────────────────────────────────────────────────────
// Support both ES modules and script tag usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    loadSearchData,
    search,
    normalize,
    tokenize,
    scoreCode,
    bestTierScore,
    groupedSort,
  };
}

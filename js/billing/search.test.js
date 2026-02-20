#!/usr/bin/env node
/**
 * Search engine tests — run with: node js/search.test.js
 * Tests against actual data files in /data directory.
 */

const path = require("path");
const fs = require("fs");

// Patch global fetch for Node.js (loads from filesystem)
global.fetch = async function (url) {
  const filePath = path.resolve(__dirname, "..", url);
  const data = fs.readFileSync(filePath, "utf8");
  return {
    ok: true,
    json: async () => JSON.parse(data),
  };
};

const {
  loadSearchData,
  search,
  normalize,
  levenshtein,
} = require("./search.js");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    console.log(`  ✗ ${testName}`);
  }
}

function assertIncludes(results, code, testName) {
  const found = results.some((r) => r.code.code === code);
  assert(found, `${testName} — includes ${code}`);
}

function assertNotIncludes(results, code, testName) {
  const found = results.some((r) => r.code.code === code);
  assert(!found, `${testName} — excludes ${code}`);
}

function assertFirstResult(results, code, testName) {
  assert(
    results.length > 0 && results[0].code.code === code,
    `${testName} — first result is ${code}`
  );
}

async function runTests() {
  console.log("Loading search data...");
  await loadSearchData("data/");
  console.log("Data loaded.\n");

  // ── Normalize ──
  console.log("normalize():");
  assert(normalize("  Hello WORLD  ") === "hello world", "trims and lowercases");
  assert(normalize("I&D test") === "i&d test", "preserves &");
  assert(normalize("re-assessment") === "re-assessment", "preserves -");

  // ── Levenshtein ──
  console.log("\nlevenshtein():");
  assert(levenshtein("abc", "abc") === 0, "identical = 0");
  assert(levenshtein("abc", "abd") === 1, "one substitution = 1");
  assert(levenshtein("abc", "abcd") === 1, "one insertion = 1");
  assert(levenshtein("abcd", "abc") === 1, "one deletion = 1");
  assert(levenshtein("abc", "xyz") > 1, "completely different > 1");
  assert(levenshtein("colles", "colees") === 1, "colles/colees = 1");

  // ── Code exact match ──
  console.log("\nCode exact match:");
  let r = search("H102");
  assertFirstResult(r.billing, "H102", "H102 exact");

  r = search("813");
  assertFirstResult(r.diagnostic, "813", "813 exact");

  // ── Code prefix match ──
  console.log("\nCode prefix match:");
  r = search("H1");
  assert(r.billing.length > 0, "H1 returns billing results");
  assert(
    r.billing.every((item) => item.code.code.startsWith("H1")),
    "H1 — all results start with H1"
  );

  r = search("G5");
  assert(r.billing.length > 0, "G5 returns billing results");

  // ── Single character — too short for prefix ──
  console.log("\nMinimum prefix length:");
  r = search("H");
  // Should still work via name substring matches, but not code prefix
  // (single char code prefix is disabled)

  // ── Alias expansion ──
  console.log("\nAlias expansion:");
  r = search("fx");
  assert(
    r.diagnostic.some((item) =>
      item.code._lowerSearchTerms.some((t) => t.includes("fracture"))
    ),
    "fx → fracture codes found"
  );

  r = search("lac");
  assert(
    r.diagnostic.length > 0 || r.billing.length > 0,
    "lac → laceration results"
  );

  // ── Assessment exclusion logic ──
  console.log("\nExclusion logic — Assessments:");

  r = search("assessment weekday");
  assertIncludes(r.billing, "H101", "weekday includes H101");
  assertIncludes(r.billing, "H102", "weekday includes H102");
  assertIncludes(r.billing, "H103", "weekday includes H103");
  assertIncludes(r.billing, "H104", "weekday includes H104");
  assertIncludes(r.billing, "H131", "weekday includes H131");
  assertIncludes(r.billing, "H132", "weekday includes H132");
  assertIncludes(r.billing, "H133", "weekday includes H133");
  assertIncludes(r.billing, "H134", "weekday includes H134");
  assertNotIncludes(r.billing, "H121", "weekday excludes H121 (night)");
  assertNotIncludes(r.billing, "H122", "weekday excludes H122 (night)");
  assertNotIncludes(r.billing, "H151", "weekday excludes H151 (weekend)");
  assertNotIncludes(r.billing, "H152", "weekday excludes H152 (weekend)");

  r = search("weekday evening assessment");
  assertIncludes(r.billing, "H131", "weekday evening includes H131");
  assertIncludes(r.billing, "H132", "weekday evening includes H132");
  assertIncludes(r.billing, "H133", "weekday evening includes H133");
  assertIncludes(r.billing, "H134", "weekday evening includes H134");
  assertNotIncludes(r.billing, "H101", "weekday evening excludes H101 (daytime)");
  assertNotIncludes(r.billing, "H102", "weekday evening excludes H102 (daytime)");
  assertNotIncludes(r.billing, "H121", "weekday evening excludes H121 (night)");
  assertNotIncludes(r.billing, "H151", "weekday evening excludes H151 (weekend)");

  r = search("night assessment");
  assertIncludes(r.billing, "H121", "night includes H121");
  assertIncludes(r.billing, "H122", "night includes H122");
  assertIncludes(r.billing, "H123", "night includes H123");
  assertIncludes(r.billing, "H124", "night includes H124");
  assertNotIncludes(r.billing, "H101", "night excludes H101 (weekday)");
  assertNotIncludes(r.billing, "H131", "night excludes H131 (weekday)");
  assertNotIncludes(r.billing, "H151", "night excludes H151 (weekend)");

  // ── Multi-word search ──
  console.log("\nMulti-word search:");
  r = search("shoulder dislocation");
  assert(r.diagnostic.length > 0 || r.billing.length > 0, "shoulder dislocation returns results");

  // ── Anatomy umbrella terms ──
  console.log("\nAnatomy umbrella terms:");
  r = search("wrist");
  assert(
    r.diagnostic.some((item) => item.code.code === "813"),
    "wrist → includes diagnostic 813 (radius/ulna)"
  );

  r = search("eye");
  const eyeDiagCodes = r.diagnostic.map((item) => item.code.code);
  assert(eyeDiagCodes.length >= 5, `eye → returns ≥5 diagnostic codes (got ${eyeDiagCodes.length})`);

  // ── Fuzzy matching ──
  console.log("\nFuzzy matching:");
  r = search("colees");
  assert(
    r.diagnostic.some((item) =>
      item.code._lowerSearchTerms.some((t) => t.includes("colles"))
    ),
    "colees (typo) → finds colles fracture"
  );

  // ── Premium search ──
  console.log("\nPremium search:");
  r = search("premium");
  assert(r.billing.length > 0, "premium → returns billing results");
  assert(
    r.billing.some((item) => item.code.code.startsWith("H1")),
    "premium → includes H-code premiums"
  );

  // ── All assessments ──
  console.log("\nAll assessments (no time filter):");
  r = search("assessment");
  assert(
    r.billing.length >= 16,
    `assessment → returns ≥16 codes (got ${r.billing.length})`
  );

  // ── Spelling variants ──
  console.log("\nSpelling variants:");
  r = search("anaemia");
  const anaemiaResults1 = r.diagnostic.length;
  r = search("anemia");
  const anaemiaResults2 = r.diagnostic.length;
  assert(
    anaemiaResults1 > 0 && anaemiaResults2 > 0,
    `Both spellings return results (anaemia: ${anaemiaResults1}, anemia: ${anaemiaResults2})`
  );

  // ── Summary ──
  console.log(`\n${"═".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

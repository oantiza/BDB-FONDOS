/**
 * REFACTOR-1: Unit tests for extracted modules
 *
 * Validates that each extracted module works identically to the
 * monolith's original implementation. These are standalone tests
 * — no Gemini, no PDF, no Firestore.
 *
 * Run: node MORNINGSTAR_PDF_PARSER/tests/test_refactor1_modules.js
 */

"use strict";

const assert = require("assert");
const path = require("path");

// Modules under test
const numberUtils = require("../src/utils/number_utils");
const textNormalizer = require("../src/normalize/text_normalizer");
const regionNormalizer = require("../src/normalize/region_normalizer");
const assetMixNormalizer = require("../src/normalize/asset_mix_normalizer");
const sectorNormalizer = require("../src/normalize/sector_normalizer");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(`  ${e.message}`);
  }
}

// ============================
// number_utils
// ============================
test("parseNum: number passthrough", () => {
  assert.strictEqual(numberUtils.parseNum(42), 42);
});

test("parseNum: string with percent", () => {
  assert.strictEqual(numberUtils.parseNum("12.5%"), 12.5);
});

test("parseNum: comma decimal", () => {
  assert.strictEqual(numberUtils.parseNum("3,14"), 3.14);
});

test("parseNum: null/undefined/empty", () => {
  assert.strictEqual(numberUtils.parseNum(null), null);
  assert.strictEqual(numberUtils.parseNum(undefined), null);
  assert.strictEqual(numberUtils.parseNum(""), null);
});

test("parseNum: NaN string", () => {
  assert.strictEqual(numberUtils.parseNum("abc"), null);
});

test("parseNum: Infinity", () => {
  assert.strictEqual(numberUtils.parseNum(Infinity), null);
});

test("clampPct: normal range", () => {
  assert.strictEqual(numberUtils.clampPct(50), 50);
});

test("clampPct: below zero", () => {
  assert.strictEqual(numberUtils.clampPct(-5), 0);
});

test("clampPct: above 100", () => {
  assert.strictEqual(numberUtils.clampPct(150), 100);
});

test("clamp01: normal range", () => {
  assert.strictEqual(numberUtils.clamp01(0.5), 0.5);
});

test("clamp01: clamps above 1", () => {
  assert.strictEqual(numberUtils.clamp01(1.5), 1);
});

test("approxEqual: within tolerance", () => {
  assert.strictEqual(numberUtils.approxEqual(1.005, 1.0, 0.01), true);
});

test("approxEqual: outside tolerance", () => {
  assert.strictEqual(numberUtils.approxEqual(1.02, 1.0, 0.01), false);
});

test("cleanString: trims and collapses", () => {
  assert.strictEqual(numberUtils.cleanString("  hello   world  "), "hello world");
});

test("cleanString: null passthrough", () => {
  assert.strictEqual(numberUtils.cleanString(null), null);
});

test("isPlainObject: positive", () => {
  assert.strictEqual(numberUtils.isPlainObject({}), true);
});

test("isPlainObject: array is false", () => {
  assert.strictEqual(numberUtils.isPlainObject([]), false);
});

test("isPlainObject: null is falsy", () => {
  assert.ok(!numberUtils.isPlainObject(null));
});

// ============================
// text_normalizer
// ============================
test("normalizeTextForTokens: accents removed + uppercased", () => {
  assert.strictEqual(textNormalizer.normalizeTextForTokens("café"), "CAFE");
});

test("normalizeTextForTokens: empty input", () => {
  assert.strictEqual(textNormalizer.normalizeTextForTokens(""), "");
});

test("normalizeTextForTokens: null returns empty", () => {
  assert.strictEqual(textNormalizer.normalizeTextForTokens(null), "");
});

// ============================
// region_normalizer
// ============================
test("cleanRegionKey: normalizes diacritics + spaces", () => {
  assert.strictEqual(regionNormalizer.cleanRegionKey("América Latina"), "america_latina");
});

test("cleanRegionKey: handles slashes", () => {
  assert.strictEqual(regionNormalizer.cleanRegionKey("europa/o_medio/africa"), "europa_o_medio_africa");
});

test("REGION_LOOKUP: usa maps to united_states", () => {
  const lookup = regionNormalizer.REGION_LOOKUP;
  assert.strictEqual(lookup["usa"], "united_states");
});

test("REGION_LOOKUP: emu maps to eurozone", () => {
  assert.strictEqual(regionNormalizer.REGION_LOOKUP["emu"], "eurozone");
});

test("normalizeRegions: canonical mapping", () => {
  const warnings = [];
  const result = regionNormalizer.normalizeRegions({ "USA": 60, "Europe": 30 }, warnings);
  assert.ok(result);
  assert.strictEqual(result.united_states, 60);
  assert.strictEqual(result.europe, 30);
});

test("normalizeRegions: null for empty object", () => {
  const result = regionNormalizer.normalizeRegions({});
  assert.strictEqual(result, null);
});

test("normalizeRegions: null for array input", () => {
  assert.strictEqual(regionNormalizer.normalizeRegions([1, 2]), null);
});

test("hasExcludedJapanRegionText: ex-Japan detected", () => {
  assert.strictEqual(regionNormalizer.hasExcludedJapanRegionText("ASIA EX-JAPAN FUND"), true);
});

test("hasExcludedJapanRegionText: no exclusion", () => {
  assert.strictEqual(regionNormalizer.hasExcludedJapanRegionText("JAPAN EQUITY"), false);
});

test("hasJapanRegionText: positive", () => {
  assert.strictEqual(regionNormalizer.hasJapanRegionText("JAPAN EQUITY"), true);
});

test("hasLatinAmericaIdentity: LATAM detected", () => {
  assert.strictEqual(regionNormalizer.hasLatinAmericaIdentity("LATAM FUND"), true);
});

test("derivePrimaryRegion: Europe from category text", () => {
  assert.strictEqual(regionNormalizer.derivePrimaryRegion(null, "EUROPE EQUITY", ""), "Europa");
});

test("derivePrimaryRegion: Global from balanced regions", () => {
  const regions = { detail: { united_states: 30, eurozone: 25, japan: 15 } };
  assert.strictEqual(regionNormalizer.derivePrimaryRegion(regions, "", ""), "Global");
});

test("derivePrimaryRegion: USA from dominant region", () => {
  const regions = { detail: { united_states: 60, eurozone: 10 } };
  assert.strictEqual(regionNormalizer.derivePrimaryRegion(regions, "", ""), "USA");
});

// ============================
// asset_mix_normalizer
// ============================
test("validateAssetMix: valid mix sums to 1", () => {
  const result = assetMixNormalizer.validateAssetMix({ equity: 0.6, bond: 0.3, cash: 0.05, other: 0.05 });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.errors.length, 0);
});

test("validateAssetMix: missing object", () => {
  const result = assetMixNormalizer.validateAssetMix(null);
  assert.strictEqual(result.ok, false);
});

test("sanitizeAssetMixForExposureBuilder: 0-100 scale", () => {
  const result = assetMixNormalizer.sanitizeAssetMixForExposureBuilder({ equity: 60, bond: 30, cash: 5, other: 5 });
  assert.ok(result);
  assert.ok(result.asset_mix.equity > 0.5);
  assert.ok(result.asset_mix.equity < 0.7);
});

test("sanitizeAssetMixForExposureBuilder: null for empty", () => {
  assert.strictEqual(assetMixNormalizer.sanitizeAssetMixForExposureBuilder(null), null);
});

test("normalizeExposureMapToParent01: scales to parent", () => {
  const result = assetMixNormalizer.normalizeExposureMapToParent01({ a: 50, b: 50 }, 0.6);
  assert.ok(result);
  assert.ok(Math.abs(result.a - 0.3) < 0.01);
  assert.ok(Math.abs(result.b - 0.3) < 0.01);
});

// ============================
// sector_normalizer
// ============================
test("normalizeSectors: cleans and filters", () => {
  const warnings = [];
  const result = sectorNormalizer.normalizeSectors({ "Technology": 30, "Healthcare": 20 }, warnings);
  assert.ok(result);
  assert.strictEqual(result.technology, 30);
  assert.strictEqual(result.healthcare, 20);
});

test("normalizeSectors: null for empty object", () => {
  assert.strictEqual(sectorNormalizer.normalizeSectors({}), null);
});

test("normalizeSectors: null for null input", () => {
  assert.strictEqual(sectorNormalizer.normalizeSectors(null), null);
});

// ============================
// Cross-module: modules match monolith re-exports
// ============================
test("monolith re-exports match modules: parseNum", () => {
  const parser = require("../src/cargador_lotes_v_2");
  assert.strictEqual(parser.parseNum("42%"), 42);
  assert.strictEqual(parser.parseNum("42%"), numberUtils.parseNum("42%"));
});

test("monolith re-exports match modules: normalizeTextForTokens", () => {
  const parser = require("../src/cargador_lotes_v_2");
  assert.strictEqual(parser.normalizeTextForTokens("café"), "CAFE");
  assert.strictEqual(parser.normalizeTextForTokens("café"), textNormalizer.normalizeTextForTokens("café"));
});

test("monolith re-exports match modules: normalizeRegions", () => {
  const parser = require("../src/cargador_lotes_v_2");
  const w1 = [], w2 = [];
  const r1 = parser.normalizeRegions({ "USA": 50 }, w1);
  const r2 = regionNormalizer.normalizeRegions({ "USA": 50 }, w2);
  assert.deepStrictEqual(r1, r2);
});

// Summary
console.log(`\n==================================================`);
console.log(`Module unit tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("refactor-1 module tests passed");
}

/**
 * REFACTOR-2: Unit tests for classifier and exposure builder extraction.
 *
 * No Gemini, no PDF reads, no Firestore writes.
 */

"use strict";

const assert = require("assert");
const path = require("path");

const parser = require("../src/cargador_lotes_v_2");
const assetTypeClassifier = require("../src/classify/asset_type_classifier");
const subtypeClassifier = require("../src/classify/subtype_classifier");
const classificationBuilder = require("../src/classify/classification_builder");
const portfolioExposureBuilder = require("../src/exposure/portfolio_exposure_builder");

let passed = 0;
let failed = 0;

function fixture(name) {
  return require(path.join(__dirname, "fixtures", "golden", name));
}

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(`  ${err.message}`);
  }
}

function buildClassificationAndExposure(fixtureName) {
  const fx = fixture(fixtureName);
  const input = fx.input;
  const expected = fx.expected;
  const catUpper = parser.normalizeTextForTokens(input.category_morningstar || "");
  const nameUpper = parser.normalizeTextForTokens(input.name || "");
  const derivedAssetClass = assetTypeClassifier.deriveAssetClassFromCategory(
    catUpper,
    nameUpper,
    input.sectors
  );
  const subcats = parser.deriveSubcategories(
    input.sectors,
    input.name,
    input.category_morningstar,
    input.objective || ""
  );
  const topSector = subtypeClassifier.topSector(input.sectors || null);
  const rawSubtype = subtypeClassifier.deriveAssetSubtype(
    catUpper,
    subcats,
    nameUpper,
    topSector.top_sector_weight,
    derivedAssetClass
  );
  const flags = subtypeClassifier.deriveFlags(
    catUpper,
    subcats,
    nameUpper,
    topSector.top_sector_weight,
    derivedAssetClass
  );
  const regions = {
    detail: input.regions_detail ? parser.normalizeRegions(input.regions_detail) : null,
    macro: null,
  };
  const regionPrimary = parser.derivePrimaryRegion(regions, catUpper, nameUpper);
  const sanitizedMix = parser.sanitizeAssetMixForExposureBuilder(input.asset_allocation);
  const classificationV2 = classificationBuilder.buildClassificationV2({
    derivedAssetClass,
    assetSubtype: rawSubtype,
    ms: {
      category_morningstar: input.category_morningstar,
      sectors: input.sectors,
      regions,
      equity_style: {
        style_box_cell: input.equity_style_box_cell,
        market_cap: input.equity_market_cap,
        style: input.equity_style,
      },
      fixed_income: input.fixed_income,
    },
    derivedPrimaryRegion: regionPrimary,
    styleBoxCell: input.equity_style_box_cell || null,
    sizeBucket: expected.market_cap_bias || null,
    fixedIncomeType: expected.fixed_income_type || null,
    creditBucket: expected.credit_bucket || null,
    durationBucket: expected.duration_bucket || null,
    subcats,
    flags,
    confidence: 0.9,
  });
  const portfolioExposureV2 = portfolioExposureBuilder.buildPortfolioExposureV2({
    sanitizedMix,
    equityRegionsTotal: null,
    equitySectorsTotal: null,
    styleWeightsTotal: null,
    sizeWeightsTotal: null,
    fixedIncomeType: expected.fixed_income_type || null,
    creditBucket: expected.credit_bucket || null,
    durationBucket: expected.duration_bucket || null,
    classificationV2,
    confidence: 0.9,
  });

  return {
    input,
    expected,
    derivedAssetClass,
    rawSubtype,
    classificationV2,
    portfolioExposureV2,
  };
}

function assertAssetMixClose(actual, expected, label) {
  for (const key of ["equity", "bond", "cash", "other"]) {
    assert.ok(Math.abs(actual[key] - expected[key]) < 0.000001, `${label}.${key}`);
  }
}

test("asset type mapping preserves equity/allocation fixture behaviour", () => {
  const { expected, derivedAssetClass, classificationV2 } = buildClassificationAndExposure("equity_global_normal.json");
  assert.strictEqual(derivedAssetClass, expected.derived_asset_class);
  assert.strictEqual(classificationV2.asset_type, expected.asset_type);
  assert.strictEqual(classificationV2.asset_subtype, expected.asset_subtype_after_normalization);
});

test("asset type mapping preserves fixed income corporate behaviour", () => {
  const { expected, derivedAssetClass, classificationV2 } = buildClassificationAndExposure("fixed_income_corporate.json");
  assert.strictEqual(derivedAssetClass, expected.derived_asset_class);
  assert.strictEqual(classificationV2.asset_type, expected.asset_type);
  assert.strictEqual(classificationV2.asset_subtype, expected.asset_subtype);
  assert.strictEqual(classificationV2.fixed_income_type, expected.fixed_income_type);
});

test("asset type mapping preserves money market behaviour", () => {
  const { expected, derivedAssetClass, classificationV2 } = buildClassificationAndExposure("money_market_short.json");
  assert.strictEqual(derivedAssetClass, expected.derived_asset_class);
  assert.strictEqual(classificationV2.asset_type, expected.asset_type);
  assert.strictEqual(classificationV2.asset_subtype, expected.asset_subtype_after_normalization);
});

test("subtype classifier preserves raw subtype expectations", () => {
  const equity = buildClassificationAndExposure("equity_global_normal.json");
  const fixed = buildClassificationAndExposure("fixed_income_corporate.json");
  const money = buildClassificationAndExposure("money_market_short.json");
  assert.strictEqual(equity.rawSubtype, equity.expected.asset_subtype);
  assert.strictEqual(fixed.rawSubtype, fixed.expected.asset_subtype);
  assert.strictEqual(money.rawSubtype, money.expected.asset_subtype_raw);
});

test("classification builder preserves strategy and warning shape", () => {
  const { classificationV2 } = buildClassificationAndExposure("equity_global_normal.json");
  assert.strictEqual(classificationV2.version, "v2");
  assert.ok(Array.isArray(classificationV2.strategy_tags));
  assert.ok(Array.isArray(classificationV2.sources_used));
  assert.ok(Array.isArray(classificationV2.warnings));
  assert.ok(classificationV2.warnings.includes("subtype_incompatible_with_asset_type:allocation:GLOBAL_EQUITY"));
  assert.ok(classificationV2.warnings.includes("subtype_downgraded_to_safe_family:FLEXIBLE_ALLOCATION"));
});

test("portfolio exposure builder preserves asset_mix for all golden fixtures", () => {
  for (const fixtureName of [
    "equity_global_normal.json",
    "fixed_income_corporate.json",
    "money_market_short.json",
  ]) {
    const { expected, portfolioExposureV2 } = buildClassificationAndExposure(fixtureName);
    assert.ok(portfolioExposureV2);
    assert.strictEqual(portfolioExposureV2.version, "v2");
    assertAssetMixClose(portfolioExposureV2.asset_mix, expected.asset_mix, fixtureName);
  }
});

test("portfolio exposure builder preserves fixed income exposure buckets", () => {
  const { portfolioExposureV2 } = buildClassificationAndExposure("fixed_income_corporate.json");
  assert.deepStrictEqual(portfolioExposureV2.bond_types, { corporate: 0.925 });
  assert.deepStrictEqual(portfolioExposureV2.credit, { investment_grade: 0.925 });
  assert.deepStrictEqual(portfolioExposureV2.duration, { intermediate: 0.925 });
});

test("monolith reexports classifier builders", () => {
  assert.strictEqual(parser.assetTypeFromDerivedAssetClass("RV"), classificationBuilder.assetTypeFromDerivedAssetClass("RV"));
  assert.strictEqual(parser.assetTypeFromDerivedAssetClass("RF"), "fixed_income");
  assert.strictEqual(typeof parser.buildClassificationV2, "function");
  assert.strictEqual(typeof parser.buildPortfolioExposureV2, "function");
});

test("module and monolith buildClassificationV2 return identical output", () => {
  const fx = buildClassificationAndExposure("fixed_income_corporate.json");
  const args = {
    derivedAssetClass: fx.expected.derived_asset_class,
    assetSubtype: fx.expected.asset_subtype,
    ms: {
      category_morningstar: fx.input.category_morningstar,
      sectors: fx.input.sectors,
      regions: { detail: fx.input.regions_detail, macro: null },
      equity_style: {},
      fixed_income: fx.input.fixed_income,
    },
    derivedPrimaryRegion: fx.expected.region_primary,
    styleBoxCell: null,
    sizeBucket: null,
    fixedIncomeType: fx.expected.fixed_income_type,
    creditBucket: fx.expected.credit_bucket,
    durationBucket: fx.expected.duration_bucket,
    subcats: [],
    flags: { is_index_like: false, is_thematic: false, is_sector_fund: false },
    confidence: 0.9,
  };
  assert.deepStrictEqual(parser.buildClassificationV2(args), classificationBuilder.buildClassificationV2(args));
});

console.log(`\n==================================================`);
console.log(`REFACTOR-2 classifier/exposure tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log("refactor-2 classifier/exposure tests passed");

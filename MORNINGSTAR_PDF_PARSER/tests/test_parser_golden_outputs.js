/**
 * REFACTOR-0 Golden output tests
 *
 * Purpose: freeze the parser's classification / exposure outputs against
 * synthetic fixtures so that REFACTOR-1 (module extraction) can verify
 * behaviour is preserved.
 *
 * Rules:
 *  - NO Gemini calls.
 *  - NO PDF reads.
 *  - NO Firestore writes.
 *  - Only pure functions imported from the monolith.
 */

"use strict";

const path = require("path");

const parser = require(path.resolve(
  __dirname,
  "..",
  "src",
  "cargador_lotes_v_2.js"
));

// ── Helpers ──────────────────────────────────────────────────────────
function loadFixture(name) {
  return require(path.join(__dirname, "fixtures", "golden", name));
}

let passed = 0;
let failed = 0;

function ok(label, condition, detail) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  ok(label, a === e, `got ${a}, expected ${e}`);
}

// ── Test suite ───────────────────────────────────────────────────────
function testFixture(fixtureName) {
  const fixture = loadFixture(fixtureName);
  const input = fixture.input;
  const exp = fixture.expected;
  const prefix = `[${input.isin}]`;

  console.log(`\n${prefix} Running golden tests for ${fixtureName}...`);

  // 1. asset_class / asset_type
  const catUpper = parser.normalizeTextForTokens(input.category_morningstar || "");
  const nameUpper = parser.normalizeTextForTokens(input.name || "");
  const derivedClass = parser.deriveAssetClassFromCategory(catUpper, nameUpper, input.sectors);
  eq(`${prefix} derived_asset_class`, derivedClass, exp.derived_asset_class);

  // 2. asset_subtype (raw, before normalization)
  const subcats = parser.deriveSubcategories(
    input.sectors,
    input.name,
    input.category_morningstar,
    input.objective || ""
  );

  const topSectorInfo = input.sectors
    ? Object.entries(input.sectors).reduce(
        (best, [k, v]) => (v > (best.w || -1) ? { k, w: v } : best),
        { k: null, w: -1 }
      )
    : { k: null, w: null };

  const rawSubtype = parser.deriveAssetSubtype(
    catUpper,
    subcats,
    nameUpper,
    topSectorInfo.w,
    derivedClass
  );

  // Check raw subtype if fixture specifies it
  if (exp.asset_subtype_raw) {
    eq(`${prefix} asset_subtype (raw)`, rawSubtype, exp.asset_subtype_raw);
  } else if (exp.asset_subtype) {
    eq(`${prefix} asset_subtype`, rawSubtype, exp.asset_subtype);
  }

  // 3. subtype normalization
  const norm = parser.normalizeSubtypeByAssetType(exp.asset_type, rawSubtype, null);
  if (exp.subtype_incompatible !== undefined) {
    eq(`${prefix} subtype incompatible`, norm.incompatible, exp.subtype_incompatible);
  }
  if (exp.asset_subtype_after_normalization) {
    eq(`${prefix} subtype after normalization`, norm.subtype, exp.asset_subtype_after_normalization);
  }

  // 4. primary_region
  const msRegions = {
    detail: input.regions_detail ? parser.normalizeRegions(input.regions_detail) : null,
    macro: null,
  };
  const region = parser.derivePrimaryRegion(msRegions, catUpper, nameUpper);
  eq(`${prefix} region_primary`, region, exp.region_primary);

  // 5. asset_mix normalization & sum
  const sanitized = parser.sanitizeAssetMixForExposureBuilder(input.asset_allocation);
  if (sanitized) {
    const mix = sanitized.asset_mix;
    const sum = +(mix.equity + mix.bond + mix.cash + mix.other).toFixed(6);
    ok(`${prefix} asset_mix_sum_valid`, parser.approxEqual(sum, 1.0, 0.01), `sum=${sum}`);

    for (const key of ["equity", "bond", "cash", "other"]) {
      ok(
        `${prefix} asset_mix.${key}`,
        Math.abs(mix[key] - exp.asset_mix[key]) < 0.02,
        `got ${mix[key]}, expected ~${exp.asset_mix[key]}`
      );
    }
  } else {
    ok(`${prefix} asset_mix not null`, false, "sanitizeAssetMixForExposureBuilder returned null");
  }

  // 6. validateAssetMix
  if (sanitized) {
    const mixValid = parser.validateAssetMix(sanitized.asset_mix);
    ok(`${prefix} validateAssetMix.ok`, mixValid.ok === true);
  }

  // 7. manual.* must NOT appear in parser payload
  const fakePayload = {
    isin: input.isin,
    ms: {},
    derived: { asset_class: derivedClass },
    classification_v2: { version: "v2", asset_type: exp.asset_type },
    portfolio_exposure_v2: sanitized ? { version: "v2", asset_mix: sanitized.asset_mix } : null,
    quality: { ok: true },
  };
  ok(`${prefix} manual_fields_absent`, !parser.hasManualField(fakePayload));

  // 8. Verify hasManualField detects actual manual fields (positive test)
  ok(`${prefix} hasManualField detects manual`, parser.hasManualField({ manual: { costs: { retrocession: 0.5 } } }));

  // 9. No retrocession or economic_exposure in parser payload
  ok(`${prefix} no retrocession in payload`, fakePayload.manual === undefined);
  ok(`${prefix} economic_exposure absent`, fakePayload.portfolio_exposure_v2?.economic_exposure === undefined);

  // 10. Fixed income specifics
  if (input.fixed_income && exp.fixed_income_type) {
    const fi = parser.normalizeFixedIncome(input.fixed_income);
    ok(`${prefix} fixed_income normalized not null`, fi !== null);
    if (fi && fi.effective_duration !== null) {
      ok(`${prefix} effective_duration is a number`, typeof fi.effective_duration === "number");
    }
  }

  // 11. Schema validation on a synthetic LLM-like response
  const schemaCheck = parser.validateRawLlMSchema({
    isin: input.isin,
    name: input.name,
    category_morningstar: input.category_morningstar,
    asset_allocation: input.asset_allocation,
    regions_detail: input.regions_detail,
    sectors: input.sectors,
    equity_style: input.equity_style,
    fixed_income: input.fixed_income,
  });
  ok(`${prefix} schema validation ok`, schemaCheck.ok === true, schemaCheck.errors?.join("|"));

  // 12. deriveFlags consistency
  const flags = parser.deriveFlags(catUpper, subcats, nameUpper, topSectorInfo.w, derivedClass);
  ok(`${prefix} flags.is_sector_fund is boolean`, typeof flags.is_sector_fund === "boolean");
  ok(`${prefix} flags.is_thematic is boolean`, typeof flags.is_thematic === "boolean");
  ok(`${prefix} flags.is_index_like is boolean`, typeof flags.is_index_like === "boolean");

  // 13. parseGeminiJsonResponse (JSON parsing robustness)
  const testJson = JSON.stringify({ isin: input.isin, category_morningstar: input.category_morningstar });
  const parsed = parser.parseGeminiJsonResponse(testJson);
  eq(`${prefix} parseGeminiJsonResponse.isin`, parsed.isin, input.isin);

  // 14. parseStyleBoxCell
  if (input.equity_style_box_cell) {
    const styleBox = parser.parseStyleBoxCell(input.equity_style_box_cell);
    ok(`${prefix} parseStyleBoxCell.size exists`, styleBox.size !== null);
    ok(`${prefix} parseStyleBoxCell.style exists`, styleBox.style !== null);
  }
}

// ── Run all fixtures ─────────────────────────────────────────────────
try {
  testFixture("equity_global_normal.json");
  testFixture("fixed_income_corporate.json");
  testFixture("money_market_short.json");
} catch (err) {
  console.error(`\nFATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}

// ── Report ───────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(50)}`);
console.log(`Golden tests: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error("GOLDEN TEST SUITE FAILED");
  process.exit(1);
}

console.log("parser golden output tests passed");

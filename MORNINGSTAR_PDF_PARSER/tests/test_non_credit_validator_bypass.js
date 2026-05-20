/**
 * Test: Non-credit asset type validator bypass for credit_missing/duration_missing.
 *
 * Verifies that credit_missing/duration_missing warnings do NOT trigger REVIEW
 * for asset types where credit quality is not material (alternative, real_asset, other),
 * and for allocation funds with negligible bond exposure.
 *
 * No Gemini, no PDF reads, no Firestore writes.
 */

"use strict";

const assert = require("assert");
const { decidePipelineStatus } = require("../src/cargador_lotes_v_2");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}: ${err.message}`);
  }
}

function makeInput({ assetType, assetSubtype, bondPct, warnings, ok = true }) {
  return {
    schemaValidation: { ok: true, errors: [] },
    canonicalValidation: { ok, errors: [], warnings: warnings || [] },
    classification_v2: {
      asset_type: assetType,
      asset_subtype: assetSubtype || "UNKNOWN",
      warnings: [...(warnings || [])],
    },
    portfolio_exposure_v2: {
      asset_mix: { bond: bondPct ?? 0, equity: 1 - (bondPct ?? 0) },
      warnings: [...(warnings || [])],
    },
  };
}

console.log("\n=== Non-credit validator bypass tests ===\n");

// ───────────────── real_asset ─────────────────

test("real_asset + credit_missing + bond=0 → OK (not REVIEW)", () => {
  const input = makeInput({ assetType: "real_asset", bondPct: 0, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

test("real_asset + credit_missing + bond=0.10 → OK (10% bond, under 25% threshold)", () => {
  const input = makeInput({ assetType: "real_asset", bondPct: 0.10, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

test("real_asset + credit_missing + bond=0.30 → REVIEW (30% bond, over threshold)", () => {
  const input = makeInput({ assetType: "real_asset", bondPct: 0.30, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "review", `Expected review, got ${result.status}`);
});

// ───────────────── alternative ─────────────────

test("alternative + credit_missing + bond=0 → OK", () => {
  const input = makeInput({ assetType: "alternative", bondPct: 0, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

test("alternative + credit_missing + bond=0.23 → OK (23%, under 25%)", () => {
  const input = makeInput({ assetType: "alternative", bondPct: 0.23, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

test("alternative + credit_missing + bond=0.30 → REVIEW (30%, over threshold)", () => {
  const input = makeInput({ assetType: "alternative", bondPct: 0.30, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "review", `Expected review, got ${result.status}`);
});

test("alternative + duration_missing + bond=0 → OK", () => {
  const input = makeInput({ assetType: "alternative", bondPct: 0, warnings: ["duration_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

test("alternative + credit_missing + region_incomplete + bond=0 → OK (both bypassed)", () => {
  const input = makeInput({ assetType: "alternative", bondPct: 0, warnings: ["credit_missing", "region_incomplete"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

// ───────────────── other ─────────────────

test("other + credit_missing + bond=0 → OK", () => {
  const input = makeInput({ assetType: "other", bondPct: 0, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

// ───────────────── allocation ─────────────────

test("allocation + credit_missing + bond=0 → OK (no bonds, credit irrelevant)", () => {
  const input = makeInput({ assetType: "allocation", bondPct: 0, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

test("allocation + credit_missing + bond=0.03 → OK (3% residual bonds, under 5%)", () => {
  const input = makeInput({ assetType: "allocation", bondPct: 0.03, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

test("allocation + credit_missing + bond=0.20 → REVIEW (20% bonds, material exposure)", () => {
  const input = makeInput({ assetType: "allocation", bondPct: 0.20, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "review", `Expected review, got ${result.status}`);
});

test("allocation + credit_missing + bond=0.06 → REVIEW (6%, just over 5% threshold)", () => {
  const input = makeInput({ assetType: "allocation", bondPct: 0.06, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "review", `Expected review, got ${result.status}`);
});

// ───────────────── equity (existing behavior) ─────────────────

test("equity + credit_missing → OK (existing bypass, unchanged)", () => {
  const input = makeInput({ assetType: "equity", bondPct: 0, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

// ───────────────── fixed_income (unchanged) ─────────────────

test("fixed_income + credit_missing → REVIEW (credit IS material for FI)", () => {
  const input = makeInput({ assetType: "fixed_income", assetSubtype: "UNKNOWN", bondPct: 0.80, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "review", `Expected review, got ${result.status}`);
});

// ───────────────── money_market (unchanged) ─────────────────

test("money_market + credit_missing → OK (existing bypass, unchanged)", () => {
  const input = makeInput({ assetType: "money_market", bondPct: 0, warnings: ["credit_missing"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "ok", `Expected ok, got ${result.status} (${result.reason})`);
});

// ───────────────── non-credit warning should still trigger REVIEW ─────────────────

test("alternative + fund_of_funds → REVIEW (non-RF warning, NOT bypassed)", () => {
  const input = makeInput({ assetType: "alternative", bondPct: 0, warnings: ["fund_of_funds"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "review", `Expected review, got ${result.status}`);
});

test("alternative + class_exposure_tension → REVIEW (not a credit warning)", () => {
  const input = makeInput({ assetType: "alternative", bondPct: 0, warnings: ["class_exposure_tension:something"] });
  const result = decidePipelineStatus(input);
  assert.strictEqual(result.status, "review", `Expected review, got ${result.status}`);
});

// ───────────────── Summary ─────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

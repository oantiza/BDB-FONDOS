/**
 * BDB_OPT_PAYLOAD_CONTRACT_TESTS_0
 *
 * Static/contractual tests for the optimizer payload shape.
 * These tests protect the documented contract between frontend and backend
 * BEFORE any cleanup or refactoring changes are made.
 *
 * Rules:
 * - No UI render
 * - No backend calls
 * - No Firestore / Gemini / parser
 * - No optimizer execution
 * - Source-text analysis only (readFileSync)
 *
 * Reference: docs/BDB_OPT_PAYLOAD_CONTRACT_CLEANUP_0.md
 */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── HELPERS ──────────────────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url));

function readSource(relativePath: string): string {
  return readFileSync(resolve(here, relativePath), 'utf8');
}

function usePortfolioActionsSource(): string {
  return readSource('../hooks/usePortfolioActions.ts');
}

function typesSource(): string {
  return readSource('../types/index.ts');
}

function contractDocSource(): string {
  return readFileSync(resolve(here, '../../../docs/BDB_OPT_PAYLOAD_CONTRACT_CLEANUP_0.md'), 'utf8');
}

// ─── 1. MAIN PAYLOAD SHAPE ───────────────────────────────────────────────

describe('optimizer payload shape — main optimization path', () => {
  const source = usePortfolioActionsSource();

  test('buildOptimizationPayload sends risk_level from riskLevel', () => {
    expect(source).toMatch(/risk_level: riskLevel/);
  });

  test('buildOptimizationPayload sends profile_id as String(riskLevel) alias', () => {
    expect(source).toMatch(/profile_id: String\(riskLevel\)/);
  });

  test('buildOptimizationPayload sends optimization_mode as rebalance_to_profile at root', () => {
    expect(source).toMatch(/optimization_mode: 'rebalance_to_profile'/);
  });

  test('buildOptimizationPayload sends constraints block with nested optimization_mode', () => {
    expect(source).toMatch(/constraints:\s*{[\s\S]*optimization_mode: 'rebalance_to_profile'/);
  });

  test('buildOptimizationPayload sends locked_positions canonical with mode and positions', () => {
    expect(source).toMatch(/locked_positions:\s*{[\s\S]*mode:/);
    expect(source).toMatch(/locked_positions:\s*{[\s\S]*positions:/);
  });

  test('buildOptimizationPayload sends constraints.fixed_weights as legacy alias', () => {
    expect(source).toMatch(/constraints:\s*{[\s\S]*fixed_weights:/);
  });

  test('buildOptimizationPayload sends constraints.lock_mode as legacy alias', () => {
    expect(source).toMatch(/constraints:\s*{[\s\S]*lock_mode:/);
  });

  test('buildOptimizationPayload sends constraints.apply_profile: true', () => {
    expect(source).toMatch(/constraints:\s*{[\s\S]*apply_profile: true/);
  });

  test('buildOptimizationPayload sends assets from assetUniverse', () => {
    expect(source).toMatch(/assets: Array\.from\(assetUniverse\)/);
  });

  test('buildOptimizationPayload sends asset_metadata', () => {
    expect(source).toMatch(/asset_metadata: assetMetadata/);
  });

  test('manualSwap is display/provenance only, not an optimizer lock', () => {
    expect(source).toMatch(/const lockedSet = new Set\(portfolio\.filter\(p => p\.isLocked\)\.map\(p => p\.isin\)\)/);
    expect(source).not.toMatch(/portfolio\.filter\(p => p\.manualSwap \|\| p\.isLocked\)/);
    expect(source).not.toMatch(/locked_assets:\s*portfolio\.filter\(p => p\.manualSwap\)/);
  });

  test('buildOptimizationPayload conditionally includes tactical_views', () => {
    expect(source).toMatch(/payload\.tactical_views = tacticalViews/);
  });
});

// ─── 2. RETRY PATH — contractual hardening (resolved gap) ────────────────

describe('optimizer retry path — contractual hardening (resolved known_contract_gap)', () => {
  const source = usePortfolioActionsSource();

  test('retry path exists for infeasible status', () => {
    expect(source).toMatch(/retryPayload/);
    expect(source).toMatch(/const retryPayload:\s*any\s*=/);
  });

  test('[resolved] retry payload spreads lastPayloadRef.current for contract preservation', () => {
    // All retry blocks should spread the stored contractual payload
    const retryBlocks = source.match(/const retryPayload:\s*any\s*=\s*{[\s\S]*?};/g) || [];
    expect(retryBlocks.length).toBeGreaterThan(0);

    const firstRetry = retryBlocks[0];
    expect(firstRetry).toMatch(/\.\.\..*lastPayloadRef\.current/);
  });

  test('[resolved] all retry blocks spread lastPayloadRef.current', () => {
    const retryBlocks = source.match(/const retryPayload:\s*any\s*=\s*{[\s\S]*?};/g) || [];
    // H3 removed the obsolete fallback_no_history branch; the remaining retry
    // paths still have to preserve the full contractual payload.
    expect(retryBlocks.length).toBeGreaterThanOrEqual(2);

    for (const block of retryBlocks) {
      expect(block).toMatch(/lastPayloadRef\.current/);
    }
  });

  test('[resolved] lastPayloadRef is stored during primary optimization', () => {
    // proceedWithOptimization stores payload in lastPayloadRef
    expect(source).toMatch(/lastPayloadRef\.current\s*=\s*payload/);
  });

  test('[resolved] retry payload overrides assets (expanded or original)', () => {
    const retryBlocks = source.match(/const retryPayload:\s*any\s*=\s*{[\s\S]*?};/g) || [];
    expect(retryBlocks.length).toBeGreaterThan(0);

    // All retry blocks override assets
    for (const block of retryBlocks) {
      expect(block).toMatch(/assets:/);
    }
  });

  test('[resolved] retry payload overrides locked_assets', () => {
    const retryBlocks = source.match(/const retryPayload:\s*any\s*=\s*{[\s\S]*?};/g) || [];
    expect(retryBlocks.length).toBeGreaterThan(0);

    for (const block of retryBlocks) {
      expect(block).toMatch(/locked_assets:/);
    }
  });

  test('[resolved] infeasible retry expands the asset universe before retrying', () => {
    const infeasibleIdx = source.indexOf("result.status === 'infeasible'");
    expect(infeasibleIdx).toBeGreaterThanOrEqual(0);

    const block = source.slice(infeasibleIdx, infeasibleIdx + 3600);
    expect(block).toMatch(/getMinAssetsNeededFromResult\(result\)/);
    expect(block).toMatch(/selectAutoExpandCandidates\(/);
    expect(block).toMatch(/expandedAssets\.push\(candidate\.isin\)/);
    expect(block).toMatch(/const newPortfolio\s*=/);
    expect(block).toMatch(/setPortfolio\(newPortfolio\)/);
    expect(block).toMatch(/auto_expand_universe:\s*true/);
    expect(block).toMatch(/Hay que modificar la cartera/);
  });

  test('[resolved] equity-floor retry adds visible RV funds before retrying', () => {
    const equityIdx = source.indexOf("result.status === 'infeasible_equity_floor'");
    expect(equityIdx).toBeGreaterThanOrEqual(0);

    const block = source.slice(equityIdx, equityIdx + 4200);
    expect(block).toMatch(/selectAutoExpandCandidates\(/);
    expect(block).toMatch(/preferEquity:\s*true/);
    expect(block).toMatch(/const newPortfolio\s*=/);
    expect(block).toMatch(/setPortfolio\(newPortfolio\)/);
    expect(block).toMatch(/assets:\s*expandedAssets/);
    expect(block).toMatch(/auto_expand_universe:\s*true/);
    expect(block).toMatch(/He añadido .*fondo\(s\) de RV a la cartera/);
  });

  test('[resolved] contract fields preserved via spread: risk_level, profile_id, optimization_mode, constraints, locked_positions', () => {
    // lastPayloadRef.current contains the full contractual payload from buildOptimizationPayload.
    // Verify that buildOptimizationPayload (the source of lastPayloadRef) contains these fields.
    expect(source).toMatch(/lastPayloadRef\.current\s*=\s*payload/);
    // And that buildOptimizationPayload produces them (already validated by Section 1 tests).
    expect(source).toMatch(/risk_level: riskLevel/);
    expect(source).toMatch(/profile_id: String\(riskLevel\)/);
    expect(source).toMatch(/optimization_mode: 'rebalance_to_profile'/);
    expect(source).toMatch(/constraints:\s*{[\s\S]*apply_profile: true/);
    expect(source).toMatch(/locked_positions:\s*{[\s\S]*mode:/);
  });

  test('[traceability] retry path comments reference BDB-OPT-PAYLOAD-CONTRACT-TESTS-0 gap resolution', () => {
    expect(source).toMatch(/known_contract_gap|Resolves known_contract_gap|BDB-OPT-PAYLOAD-CONTRACT-TESTS-0/);
  });
});

// ─── 3. CANONICAL vs LEGACY FIELD DOCUMENTATION ──────────────────────────

describe('OptimizationRequest type documents canonical and legacy fields', () => {
  const types = typesSource();

  test('OptimizationRequest includes assets as required field', () => {
    expect(types).toMatch(/export interface OptimizationRequest\s*{[\s\S]*assets:\s*string\[\]/);
  });

  test('OptimizationRequest includes risk_level as required field', () => {
    expect(types).toMatch(/export interface OptimizationRequest\s*{[\s\S]*risk_level:\s*number/);
  });

  test('OptimizationRequest includes profile_id as optional (alias) field', () => {
    expect(types).toMatch(/export interface OptimizationRequest\s*{[\s\S]*profile_id\?:\s*string/);
  });

  test('OptimizationRequest includes optimization_mode as optional field', () => {
    expect(types).toMatch(/export interface OptimizationRequest\s*{[\s\S]*optimization_mode\?:\s*string/);
  });

  test('OptimizationRequest includes locked_positions canonical structure', () => {
    expect(types).toMatch(/locked_positions\?:\s*{[\s\S]*mode:\s*LockMode/);
    expect(types).toMatch(/locked_positions\?:\s*{[\s\S]*positions:\s*Record<string,\s*number>/);
  });

  test('OptimizationRequest includes constraints block with legacy aliases', () => {
    expect(types).toMatch(/constraints:\s*{[\s\S]*lock_mode:\s*LockMode/);
    expect(types).toMatch(/constraints:\s*{[\s\S]*fixed_weights:\s*Record<string,\s*number>/);
  });

  test('OptimizationRequest includes constraints_v1 as optional backend-only field', () => {
    expect(types).toMatch(/constraints_v1\?:\s*PortfolioConstraintsV1/);
  });
});

// ─── 4. DUPLICATE FIELDS CONTRACT ────────────────────────────────────────

describe('duplicate fields contract — source code acknowledges duplications', () => {
  const source = usePortfolioActionsSource();

  test('D1: risk_level and profile_id are both sent (acknowledged duplication)', () => {
    // buildOptimizationPayload sends both
    expect(source).toMatch(/risk_level: riskLevel/);
    expect(source).toMatch(/profile_id: String\(riskLevel\)/);
  });

  test('D2: optimization_mode appears in root and constraints (acknowledged duplication)', () => {
    // Root level
    const rootMatch = source.match(/optimization_mode: 'rebalance_to_profile'/g);
    expect(rootMatch).not.toBeNull();
    // Should appear at least twice: once at root, once in constraints
    expect(rootMatch!.length).toBeGreaterThanOrEqual(2);
  });

  test('D3: locked_positions canonical and constraints.fixed_weights legacy coexist', () => {
    expect(source).toMatch(/locked_positions:\s*{/);
    expect(source).toMatch(/fixed_weights:\s*fixedWeights/);
  });

  test('D3: locked_positions.mode and constraints.lock_mode are identical in source', () => {
    // Both use the same expression: isAddCapital ? 'keep_money' : 'keep_weight'
    const modePattern = /isAddCapital \? 'keep_money' : 'keep_weight'/g;
    const matches = source.match(modePattern);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── 5. MIXTO IS REPORTING/METADATA, NOT HARD CONSTRAINT ─────────────────

describe('Mixto contract — reporting/metadata only, not hard solver constraint', () => {
  test('mixedFunds.test.ts verifies MIXED look-through as reporting logic', () => {
    const mixedTest = readSource('../__tests__/mixedFunds.test.ts');
    // Test validates look-through decomposition, not constraint injection
    expect(mixedTest).toMatch(/look-through/i);
    expect(mixedTest).toMatch(/MIXED/);
    expect(mixedTest).toMatch(/ALLOCATION/);
  });

  test('OptimizationAsset interface does NOT include mixed/Mixto as constraint field', () => {
    const types = typesSource();
    const optimizationAssetMatch = types.match(/export interface OptimizationAsset\s*{([\s\S]*?)\n}/);
    expect(optimizationAssetMatch).not.toBeNull();
    const body = optimizationAssetMatch![1];

    // OptimizationAsset is minimal: asset_class + name
    expect(body).not.toMatch(/mixto/i);
    expect(body).not.toMatch(/mixed_constraint/i);
  });

  test('buildOptimizationPayload does not inject Mixto as constraint', () => {
    const source = usePortfolioActionsSource();
    // The buildOptimizationPayload function should not have Mixto constraint logic
    const buildPayloadFn = source.match(/function buildOptimizationPayload[\s\S]*?^}/m);
    if (buildPayloadFn) {
      expect(buildPayloadFn[0]).not.toMatch(/mixto.*constraint/i);
      expect(buildPayloadFn[0]).not.toMatch(/mixed.*constraint/i);
    }
  });

  test('contract doc confirms Mixto is reporting, not solver constraint', () => {
    const doc = contractDocSource();
    expect(doc).toMatch(/Mixto/);
    expect(doc).toMatch(/Label decorativo \/ reporting/);
    expect(doc).toMatch(/No es hard constraint/i);
  });
});

// ─── 6. CLASSIFICATION_V2 vs PORTFOLIO_EXPOSURE_V2 SEPARATION ────────────

describe('classification_v2 / portfolio_exposure_v2 separation contract', () => {
  test('OptimizationAsset does NOT merge classification_v2 with exposure fields', () => {
    const types = typesSource();
    const optimizationAssetMatch = types.match(/export interface OptimizationAsset\s*{([\s\S]*?)\n}/);
    expect(optimizationAssetMatch).not.toBeNull();
    const body = optimizationAssetMatch![1];

    expect(body).not.toMatch(/classification_v2/);
    expect(body).not.toMatch(/portfolio_exposure_v2/);
  });

  test('Fund interface keeps classification_v2 and portfolio_exposure_v2 as separate optional fields', () => {
    const types = typesSource();
    expect(types).toMatch(/classification_v2\?:\s*ClassificationV2/);
    expect(types).toMatch(/portfolio_exposure_v2\?:\s*PortfolioExposureV2/);
  });

  test('contract doc warns about classification_v2 silent fallback risk', () => {
    const doc = contractDocSource();
    expect(doc).toMatch(/classification_v2.*fallback/i);
    expect(doc).toMatch(/portfolio_exposure_v2/);
    expect(doc).toMatch(/fuente económica primaria/i);
  });

  test('contract doc states portfolio_exposure_v2.asset_mix is primary for solver', () => {
    const doc = contractDocSource();
    expect(doc).toMatch(/portfolio_exposure_v2\.asset_mix.*fuente económica primaria/i);
  });

  test('contract doc recognizes classification_v2 as identity/metadata/suitability', () => {
    const doc = contractDocSource();
    expect(doc).toMatch(/classification_v2.*identidad\/metadata\/suitability/i);
  });
});

// ─── 7. CONTRACT DOC COVERAGE VERIFICATION ───────────────────────────────

describe('contract doc (BDB_OPT_PAYLOAD_CONTRACT_CLEANUP_0.md) field coverage', () => {
  const doc = contractDocSource();

  test('doc covers D1: risk_level vs profile_id', () => {
    expect(doc).toMatch(/risk_level.*profile_id|profile_id.*risk_level/);
  });

  test('doc covers D2: optimization_mode', () => {
    expect(doc).toMatch(/optimization_mode/);
    expect(doc).toMatch(/D2.*optimization_mode|optimization_mode.*duplicado/i);
  });

  test('doc covers D3: locked_positions', () => {
    expect(doc).toMatch(/locked_positions/);
  });

  test('doc covers D3: fixed_weights legacy', () => {
    expect(doc).toMatch(/fixed_weights/);
    expect(doc).toMatch(/legacy/i);
  });

  test('doc covers D3: lock_mode', () => {
    expect(doc).toMatch(/lock_mode/);
  });

  test('doc covers D4: bucket_bounds_v1', () => {
    expect(doc).toMatch(/bucket_bounds_v1/);
  });

  test('doc covers D4: current_risk_buckets', () => {
    expect(doc).toMatch(/current_risk_buckets/);
  });

  test('doc covers D5: portfolio_exposure_v2', () => {
    expect(doc).toMatch(/portfolio_exposure_v2/);
  });

  test('doc covers D5: classification_v2', () => {
    expect(doc).toMatch(/classification_v2/);
  });

  test('doc covers retry path with known risk', () => {
    expect(doc).toMatch(/retry.*payload|Retry payload/i);
    expect(doc).toMatch(/mínimo|minimal/i);
  });

  test('doc covers Mixto', () => {
    expect(doc).toMatch(/Mixto/);
    expect(doc).toMatch(/D6.*Mixto|Mixto.*Mixed/);
  });
});

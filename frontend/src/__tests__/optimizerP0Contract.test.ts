import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type OptimizerStatus =
  | 'optimal_compliant'
  | 'optimal_with_warnings'
  | 'fallback_compliant'
  | 'fallback_non_compliant'
  | 'infeasible_constraints'
  | 'infeasible_data'
  | 'error';

const applicableStatuses: OptimizerStatus[] = [
  'optimal_compliant',
  'optimal_with_warnings',
  'fallback_compliant',
];

function targetCanOpenApplyFlow(status: OptimizerStatus): boolean {
  return applicableStatuses.includes(status);
}

function usePortfolioActionsSource(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '../hooks/usePortfolioActions.ts'), 'utf8');
}

function dashboardPageSource(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '../pages/DashboardPage.tsx'), 'utf8');
}

function portfolioTableSource(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '../components/PortfolioTable.tsx'), 'utf8');
}

function optimizationReviewModalSource(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '../components/modals/OptimizationReviewModal.tsx'), 'utf8');
}

function typesSource(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(here, '../types/index.ts'), 'utf8');
}

function optimizationAssetInterfaceSource(): string {
  const match = typesSource().match(/export interface OptimizationAsset\s*{([\s\S]*?)\n}/);
  return match?.[1] ?? '';
}

describe('OPT1-T006 frontend optimizer fallback gating contract', () => {
  test('target status table only allows compliant optimizer results to open apply flow', () => {
    expect(targetCanOpenApplyFlow('optimal_compliant')).toBe(true);
    expect(targetCanOpenApplyFlow('optimal_with_warnings')).toBe(true);
    expect(targetCanOpenApplyFlow('fallback_compliant')).toBe(true);
    expect(targetCanOpenApplyFlow('fallback_non_compliant')).toBe(false);
    expect(targetCanOpenApplyFlow('infeasible_constraints')).toBe(false);
    expect(targetCanOpenApplyFlow('infeasible_data')).toBe(false);
    expect(targetCanOpenApplyFlow('error')).toBe(false);
  });

  test('runtime hook blocks fallback_non_compliant before setting a proposed portfolio', () => {
    const source = usePortfolioActionsSource();
    const nonCompliantIdx = source.indexOf('fallback_non_compliant');
    expect(nonCompliantIdx).toBeGreaterThanOrEqual(0);

    const gateWindow = source.slice(Math.max(0, nonCompliantIdx - 300), nonCompliantIdx + 800);
    expect(gateWindow).toMatch(/toast\.error|setConfirmDialog|return/);
    expect(gateWindow).not.toMatch(/setProposedPortfolio|toggleModal\([^)]*review/);
    expect(source).toMatch(/fallback_compliant/);
  });

  test('runtime hook opens an actionable portfolio edit dialog for non-applicable proposals', () => {
    const source = usePortfolioActionsSource();
    const nonCompliantIdx = source.indexOf("!isOptimizerResultApplicable(result)");
    expect(nonCompliantIdx).toBeGreaterThanOrEqual(0);

    const gateWindow = source.slice(nonCompliantIdx, nonCompliantIdx + 1600);
    expect(gateWindow).toMatch(/setConfirmDialog\(\{/);
    expect(gateWindow).toMatch(/title:\s*"Propuesta no aplicable"/);
    expect(gateWindow).toMatch(/subtitle:\s*"Ajuste de cartera"/);
    expect(gateWindow).toMatch(/confirmLabel:\s*"Modificar cartera"/);
    expect(gateWindow).toMatch(/onEditPortfolio\(\)|onEditPortfolio\?\.\(\)/);
    expect(gateWindow).not.toMatch(/onOpenPositions\(\)|onOpenPositions\?\.\(\)/);
    expect(gateWindow).not.toMatch(/toast\.error\(result\.message/);
  });

  test('portfolio edit dialog targets the dashboard portfolio table, not the global positions page', () => {
    const source = dashboardPageSource();

    expect(source).toMatch(/portfolioTableRef/);
    expect(source).toMatch(/handleEditCurrentPortfolio/);
    expect(source).toMatch(/onEditPortfolio:\s*handleEditCurrentPortfolio/);
    expect(source).toMatch(/aria-label="Editor de cartera actual"/);
    expect(source).not.toMatch(/onEditPortfolio:\s*onOpenPositions/);
  });

  test('portfolio edit focus highlights the actionable fund rows and controls', () => {
    const dashboard = dashboardPageSource();
    const table = portfolioTableSource();

    expect(dashboard).toMatch(/highlightActions={portfolioEditFocus}/);
    expect(table).toMatch(/highlightActions\?: boolean/);
    expect(table).toMatch(/rowFocusClass/);
    expect(table).toMatch(/editableInputClass/);
    expect(table).toMatch(/swapFocusClass/);
  });

  test('runtime hook extracts UX explainability metrics (target_vol, achieved_vol, warnings)', () => {
    const source = usePortfolioActionsSource();
    expect(source).toMatch(/target_vol: result\.metrics\?\.target_vol \?\? result\.target_vol/);
    expect(source).toMatch(/achieved_vol: result\.metrics\?\.achieved_vol \?\? result\.achieved_vol/);
    expect(source).toMatch(/vol_deviation: result\.metrics\?\.vol_deviation \?\? result\.vol_deviation/);
    expect(source).toMatch(/warnings: result\.warnings \|\| \[\]/);
  });
});

describe('canonical optimizer constraints payload contract', () => {
  test('payload preserves profile_id and risk_level compatibility during cleanup period', () => {
    const source = usePortfolioActionsSource();

    expect(source).toMatch(/risk_level: riskLevel/);
    expect(source).toMatch(/profile_id: String\(riskLevel\)/);
  });

  test('payload keeps optimization_mode deterministic across root and legacy constraints', () => {
    const source = usePortfolioActionsSource();

    expect(source).toMatch(/optimization_mode: 'rebalance_to_profile'/);
    expect(source).toMatch(/constraints:\s*{[\s\S]*optimization_mode: 'rebalance_to_profile'/);
  });

  test('payload keeps locked_positions canonical while preserving legacy fixed_weights compatibility', () => {
    const source = usePortfolioActionsSource();

    expect(source).toMatch(/locked_positions:\s*{[\s\S]*mode: isAddCapital \? 'keep_money' : 'keep_weight'/);
    expect(source).toMatch(/locked_positions:\s*{[\s\S]*positions: fixedWeights/);
    expect(source).toMatch(/constraints:\s*{[\s\S]*lock_mode: isAddCapital \? 'keep_money' : 'keep_weight'/);
    expect(source).toMatch(/constraints:\s*{[\s\S]*fixed_weights: fixedWeights/);
  });

  test('response mapping preserves status, solver path, volatility diagnostics and warnings', () => {
    const source = usePortfolioActionsSource();
    const types = typesSource();

    expect(source).toMatch(/status: result\.status/);
    expect(source).toMatch(/solver_path: result\.solver_path/);
    expect(source).toMatch(/target_vol: result\.metrics\?\.target_vol \?\? result\.target_vol/);
    expect(source).toMatch(/achieved_vol: result\.metrics\?\.achieved_vol \?\? result\.achieved_vol/);
    expect(source).toMatch(/vol_deviation: result\.metrics\?\.vol_deviation \?\? result\.vol_deviation/);
    expect(source).toMatch(/warnings: result\.warnings \|\| \[\]/);
    expect(types).toMatch(/target_vol\?: number/);
    expect(types).toMatch(/achieved_vol\?: number/);
    expect(types).toMatch(/vol_deviation\?: number/);
    expect(types).toMatch(/vol_band_compliant\?: boolean/);
    expect(types).toMatch(/vol_band_enforcement\?: 'soft_warning' \| 'strict_postcheck'/);
    expect(types).toMatch(/solver_path\?: string/);
  });

  test('review modal surfaces warnings even when the result is not a fallback', () => {
    const source = optimizationReviewModalSource();

    expect(source).toMatch(/const hasWarnings = Array\.isArray\(explainabilityData\?\.warnings\)/);
    expect(source).toMatch(/\{\(isFallback \|\| hasWarnings\) && \(/);
    expect(source).toMatch(/translateTechnicalWarning\(w\)/);
  });

  test('frontend optimization metadata remains minimal and does not merge classification with exposure', () => {
    const optimizationAsset = optimizationAssetInterfaceSource();

    expect(optimizationAsset).toMatch(/asset_class\?: string/);
    expect(optimizationAsset).toMatch(/name: string/);
    expect(optimizationAsset).not.toMatch(/classification_v2/);
    expect(optimizationAsset).not.toMatch(/portfolio_exposure_v2/);
  });
});

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

  test('runtime hook extracts UX explainability metrics (target_vol, achieved_vol, warnings)', () => {
    const source = usePortfolioActionsSource();
    expect(source).toMatch(/target_vol: result\.metrics\?\.target_vol \?\? result\.target_vol/);
    expect(source).toMatch(/achieved_vol: result\.metrics\?\.achieved_vol \?\? result\.achieved_vol/);
    expect(source).toMatch(/vol_deviation: result\.metrics\?\.vol_deviation \?\? result\.vol_deviation/);
    expect(source).toMatch(/warnings: result\.warnings \|\| \[\]/);
  });
});

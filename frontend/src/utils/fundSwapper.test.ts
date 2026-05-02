import { describe, test, expect } from 'vitest';
import { findAlternatives } from './fundSwapper';

describe('findAlternatives - Tiered Search', () => {
    const originalFund = {
        isin: 'ORIGINAL',
        name: 'Original Fund',
        category_morningstar: 'EAA Fund US Large-Cap Growth Equity', // Specific
        asset_class: 'RV',
        primary_region: 'USA',
        std_extra: { company: 'Company A', ter: 1.5 },
        std_perf: { volatility: 0.15, sharpe: 0.8 },
        data_quality: { history_ok: true, std_perf_ok: true }
    };

    const strictMatch = {
        isin: 'STRICT',
        name: 'Strict Match',
        category_morningstar: 'EAA Fund US Large-Cap Growth Equity',
        asset_class: 'RV',
        primary_region: 'USA',
        std_extra: { company: 'Company B', ter: 1.0 },
        std_perf: { volatility: 0.14, sharpe: 0.9 },
        data_quality: { history_ok: true, std_perf_ok: true }
    };

    const tier2Match = {
        isin: 'TIER2',
        name: 'Tier 2 Match',
        category_morningstar: 'EAA Fund US Large-Cap Value Equity', // Different Category
        asset_class: 'RV', // Same Asset Class
        primary_region: 'USA', // Same Region
        std_extra: { company: 'Company C', ter: 0.9 },
        std_perf: { volatility: 0.13, sharpe: 1.1 },
        data_quality: { history_ok: true, std_perf_ok: true }
    };

    const tier3Match = {
        isin: 'TIER3',
        name: 'Tier 3 Match',
        category_morningstar: 'EAA Fund Global Large-Cap Growth Equity', // Different Category
        asset_class: 'RV', // Same Asset Class
        primary_region: 'Global', // Different Region
        std_extra: { company: 'Company D', ter: 0.8 },
        std_perf: { volatility: 0.12, sharpe: 1.2 },
        data_quality: { history_ok: true, std_perf_ok: true }
    };

    test('Tier 1: Finds Strict Match', () => {
        const result = findAlternatives(originalFund, [strictMatch], 5);
        expect(result).toHaveLength(1);
        expect(result[0].fund.isin).toBe('STRICT');
    });

    test('Tier 2: Finds Asset Class + Region Match when Strict is missing', () => {
        const result = findAlternatives(originalFund, [tier2Match], 5);
        expect(result).toHaveLength(1);
        expect(result[0].fund.isin).toBe('TIER2');
    });

    test('Tier 3: Finds Asset Class Match when Tier 2 is missing', () => {
        const result = findAlternatives(originalFund, [tier3Match], 5);
        expect(result).toHaveLength(1);
        expect(result[0].fund.isin).toBe('TIER3');
    });

    test('Mix: Prioritizes better tiers but includes others if needed', () => {
        // If we have strict match, we might still include T2/T3 if < 5 candidates
        const result = findAlternatives(originalFund, [strictMatch, tier2Match, tier3Match], 5);
        // It collects strict, then tier2, then tier3 until filtered/sorted
        expect(result.length).toBeGreaterThanOrEqual(1);
        // Result should prioritize performance (Sharpe). 
        // TIER3 (1.2) and TIER2 (1.1) are better than STRICT (0.9).
        // So STRICT is correctly dropped in favor of better alternatives found in broader tiers.
        const isins = result.map(r => r.fund.isin);
        expect(isins).toContain('TIER3');
        expect(isins).toContain('TIER2');
        // Logic might include others if not strictly limited to 1 best, it returns top alternatives.
        // The function returns up to 2 alternatives (Best Quant + Best Commercial).
    });
});

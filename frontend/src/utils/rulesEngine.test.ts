import { describe, it, expect } from 'vitest';
import { generateSmartPortfolio, isFundSafeForProfile, RiskProfile } from './rulesEngine';
import { Fund } from '../types';

describe('rulesEngine', () => {
    const conservativeProfile = 1; // 1-3
    const aggressiveProfile = 9; // 6-9 Agresivo

    const safeFund = {
        isin: 'SAFE',
        name: 'Safe Fund',
        std_type: 'Bond',
        profile: { risk_score: 2, profile_type: 'CONSERVATIVE' }
    } as any;

    const riskyFund = {
        isin: 'RISKY',
        name: 'Risky Fund',
        std_type: 'RV',
        profile: { risk_score: 6, profile_type: 'AGGRESSIVE' },
        metrics: { equity: 100 }
    } as any;

    describe('isFundSafeForProfile', () => {
        it('allows safe fund for conservative profile', () => {
            // Assuming logic checks if fund risk <= profile risk + buffer (usually strict for conservative)
            // Implementation detail: for level 1-2, only allows 1-3.
            expect(isFundSafeForProfile(safeFund, conservativeProfile)).toBe(true);
        });

        it('rejects risky fund for conservative profile', () => {
            expect(isFundSafeForProfile(riskyFund, conservativeProfile)).toBe(false);
        });

        it('allows risky fund for aggressive profile', () => {
            expect(isFundSafeForProfile(riskyFund, aggressiveProfile)).toBe(true);
        });
    });

    describe('generateSmartPortfolio', () => {
        const pool = [safeFund, riskyFund];

        it('generates conservative portfolio with only safe funds', () => {
            const portfolio = generateSmartPortfolio(conservativeProfile, pool, 5);
            expect(portfolio.every(p => p.isin === 'SAFE')).toBe(true);
        });

        it('generates portfolio with weights summing to approx 100', () => {
            const portfolio = generateSmartPortfolio(aggressiveProfile, pool, 5);
            if (portfolio.length > 0) {
                const totalWeight = portfolio.reduce((sum, p) => sum + p.weight, 0);
                expect(totalWeight).toBeCloseTo(100, 1);
            }
        });
    });
});

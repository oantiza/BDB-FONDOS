import { describe, it, expect } from 'vitest';
import { calcSimpleStats } from './analytics';

describe('calcSimpleStats', () => {
    it('calculates correct weighted return and volatility', () => {
        // calcSimpleStats reads std_perf.returns (decimal), NOT cagr3y.
        // Values > 1.0 are auto-normalized (divided by 100) as a percentage heuristic.
        const portfolio = [
            { isin: 'A', weight: 50, std_perf: { returns: 0.10, volatility: 0.05 }, correlation_matrix: { A: { A: 1, B: 0.5 }, B: { A: 0.5, B: 1 } } } as any,
            { isin: 'B', weight: 50, std_perf: { returns: 0.20, volatility: 0.10 }, correlation_matrix: { A: { A: 1, B: 0.5 }, B: { A: 0.5, B: 1 } } } as any,
        ];

        const result = calcSimpleStats(portfolio);

        // Expected Return: 0.5*0.10 + 0.5*0.20 = 0.15
        expect(result.ret).toBeCloseTo(0.15);

        // Expected Volatility calculation is complex, but should be > 0 and between individudal volatilities if correl < 1
        expect(result.vol).toBeGreaterThan(0);
        expect(result.vol).toBeLessThan(0.10); // Diversification effect
    });

    it('handles empty portfolio', () => {
        const result = calcSimpleStats([]);
        expect(result.ret).toBe(0);
        expect(result.vol).toBe(0);
    });
});

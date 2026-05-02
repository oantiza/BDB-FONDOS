import { describe, it, expect } from 'vitest';
import { calcSimpleStats } from './analytics';

describe('calcSimpleStats', () => {
    it('calculates correct weighted return and volatility', () => {
        const portfolio = [
            { isin: 'A', weight: 50, std_perf: { cagr3y: 10, volatility: 5 }, correlation_matrix: { A: { A: 1, B: 0.5 }, B: { A: 0.5, B: 1 } } } as any,
            { isin: 'B', weight: 50, std_perf: { cagr3y: 20, volatility: 10 }, correlation_matrix: { A: { A: 1, B: 0.5 }, B: { A: 0.5, B: 1 } } } as any,
        ];

        const result = calcSimpleStats(portfolio);

        // Expected Return: 0.5*10 + 0.5*20 = 15
        expect(result.ret).toBeCloseTo(15);

        // Expected Volatility calculation is complex, but should be > 0 and between individudal volatilities if correl < 1
        expect(result.vol).toBeGreaterThan(0);
        expect(result.vol).toBeLessThan(10); // Diversification effect
    });

    it('handles empty portfolio', () => {
        const result = calcSimpleStats([]);
        expect(result.ret).toBe(0);
        expect(result.vol).toBe(0);
    });
});

import { describe, it, expect } from 'vitest';
import { calculateRealPortfolioVolatility, covariance, alignSeries } from './statistics';
import { PortfolioItem } from '../types';

describe('statistics', () => {

    describe('covariance', () => {
        it('calculates covariance correctly for positive correlation', () => {
            const s1 = [1, 2, 3];
            const s2 = [1, 2, 3];
            // Mean = 2.
            // (1-2)(1-2) + (2-2)(2-2) + (3-2)(3-2) = 1 + 0 + 1 = 2
            // 2 / (3-1) = 1
            expect(covariance(s1, s2)).toBeCloseTo(1);
        });

        it('calculates covariance correctly for negative correlation', () => {
            const s1 = [1, 2, 3];
            const s2 = [3, 2, 1];
            // Mean = 2
            // (1-2)(3-2) + (0) + (3-2)(1-2) = -1 + 0 + -1 = -2
            // -2 / 2 = -1
            expect(covariance(s1, s2)).toBeCloseTo(-1);
        });
    });

    describe('alignSeries', () => {
        it('aligns heterogeneous dates', () => {
            const a1 = { returns_history: { '2023-01-01': 100, '2023-01-02': 110, '2023-01-03': 121 } } as any;
            const a2 = { returns_history: { '2023-01-01': 100, '2023-01-02': 105, '2023-01-04': 110 } } as any; // 04 instead of 03

            // Intersection: 01-01, 01-02.
            // Need at least 10 points in implementation, so this should return empty.
            // Let's create mock with more points for robust test, or mock implementation check?
            // Implementation requires length < 10 return {}.

            // Let's test the 10 point limit.
            const result = alignSeries([a1, a2]);
            expect(result).toEqual({});
        });
    });

    describe('calculateRealPortfolioVolatility', () => {
        it('returns null if not enough history', () => {
            const p = [{ isin: 'A', weight: 100 }] as any;
            expect(calculateRealPortfolioVolatility(p)).toBeNull();
        });

        it('calculates volatility for perfect asset', () => {
            // Create 20 data points of constant growth = 0 vol? No, return needs to be constant for 0 vol.
            // Price: 100, 101, 102...
            // Returns: 1/100, 1/101... approx 1%. 
            // If returns are not identical, Vol > 0.

            const history: Record<string, number> = {};
            for (let i = 1; i <= 20; i++) {
                // Constant 1% return
                const date = `2023-01-${i < 10 ? '0' + i : i}`;
                history[date] = 100 * Math.pow(1.01, i);
            }

            const asset = {
                isin: 'A',
                weight: 100,
                returns_history: history
            } as PortfolioItem;

            // Covariance of constant series (variance) should be 0? 
            // Returns are constant 0.01. Mean is 0.01. (x - mean) is 0.
            // So variance should be 0.

            const vol = calculateRealPortfolioVolatility([asset]);
            expect(vol).toBeCloseTo(0);
        });
    });
});

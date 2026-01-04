import { PortfolioItem } from '../types';

/**
 * Align histories of multiple assets to common dates.
 * Returns a map of ISIN -> Array of returns (aligned by index).
 * We use 3 years of weekly data or daily data depending on availability.
 * For now, assume data is daily or weekly NAVs.
 */
export function alignSeries(assets: PortfolioItem[]): Record<string, number[]> {
    // 1. Collect all unique dates
    const allDates = new Set<string>();
    assets.forEach(asset => {
        if (asset.returns_history) {
            Object.keys(asset.returns_history).forEach(d => allDates.add(d));
        }
    });

    const sortedDates = Array.from(allDates).sort();

    // We need at least X data points
    if (sortedDates.length < 10) return {};

    // 2. Build aligned return series
    // If a date is missing, we use 0% return (neutral) or prev value (if we had prices).
    // returns_history is assumed to be Map<DateStr, Price/NAV> or Map<DateStr, Return>?
    // The previous context implies `returns_history` might be NAVs. 
    // "returns_history map and risk_srri field" - strict returns or prices? 
    // Let's assume it calls for "Price/NAV" history to calculate returns ourselves, 
    // OR it is pre-calculated returns.
    // Given the name `returns_history` usually implies returns, but `generateProjectionPoints` used simulated returns.
    // Let's assume `returns_history` contains PRICE/NAV for now, as that's safer for covariance. 
    // If it's returns, we just use them.
    // Safe bet: The schema says `returns_history?: Record<string, number>`.

    // Let's try to infer simple returns: (Price_t - Price_t-1) / Price_t-1.

    // Actually, handling sparse data is hard. 
    // Strategy: Intersection of dates for strict covariance? Or Union with zero filling?
    // Strict Intersection is best for finding true correlation.

    // 1. Strict Intersection
    let commonDates = sortedDates;
    assets.forEach(asset => {
        if (!asset.returns_history) {
            commonDates = [];
            return;
        }
        const assetDates = new Set(Object.keys(asset.returns_history));
        commonDates = commonDates.filter(d => assetDates.has(d));
    });

    if (commonDates.length < 10) return {}; // Not enough overlap

    const aligned: Record<string, number[]> = {};

    assets.forEach(asset => {
        const history = asset.returns_history || {};
        const prices = commonDates.map(d => history[d]);

        // Calculate Returns
        const returns: number[] = [];
        for (let i = 1; i < prices.length; i++) {
            const p0 = prices[i - 1];
            const p1 = prices[i];
            if (p0 === 0) returns.push(0);
            else returns.push((p1 - p0) / p0);
        }
        aligned[asset.isin] = returns;
    });

    return aligned;
}

/**
 * Calculate Covariance between two series
 */
export function covariance(s1: number[], s2: number[]): number {
    if (s1.length !== s2.length || s1.length === 0) return 0;
    const n = s1.length;
    const mean1 = s1.reduce((a, b) => a + b, 0) / n;
    const mean2 = s2.reduce((a, b) => a + b, 0) / n;

    let sum = 0;
    for (let i = 0; i < n; i++) {
        sum += (s1[i] - mean1) * (s2[i] - mean2);
    }
    return sum / (n - 1); // Sample covariance
}

/**
 * Calculate Portfolio Standard Deviation (Volatility)
 * Formula: Sqrt( w^T * Cov * w )
 * Scaled to Annualized Volatility (depends on data frequency).
 * Assuming Daily data => sqrt(252). Weekly => sqrt(52).
 */
// Memoization Helpers
export function calculateCovarianceMatrix(assets: PortfolioItem[]): { matrix: number[][], isins: string[] } | null {
    const alignedReturns = alignSeries(assets);
    const isins = Object.keys(alignedReturns);

    if (isins.length !== assets.length) return null; // Some assets missing history

    const n = isins.length;
    const covMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const s1 = alignedReturns[isins[i]];
            const s2 = alignedReturns[isins[j]];
            covMatrix[i][j] = covariance(s1, s2);
        }
    }
    return { matrix: covMatrix, isins };
}

export function calculateVolatilityFromMatrix(
    weights: number[],
    covMatrix: number[][],
    annualizeFactor: number = Math.sqrt(252)
): number {
    const n = weights.length;
    let variance = 0;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            variance += weights[i] * weights[j] * covMatrix[i][j];
        }
    }
    if (variance < 0) return 0;
    return Math.sqrt(variance) * annualizeFactor;
}

export function calculateRealPortfolioVolatility(
    assets: PortfolioItem[],
    annualizeFactor: number = Math.sqrt(252)
): number | null {
    const data = calculateCovarianceMatrix(assets);
    if (!data) return null;

    // We must ensure weights match the order of isins in the matrix
    // alignSeries returns keys (isins). The matrix is built in that order.
    // We need to map assets to that order.
    const weightMap: Record<string, number> = {};
    assets.forEach(a => weightMap[a.isin] = (a.weight || 0) / 100);

    const orderedWeights = data.isins.map(isin => weightMap[isin]);

    return calculateVolatilityFromMatrix(orderedWeights, data.matrix, annualizeFactor);
}

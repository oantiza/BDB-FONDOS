import { PortfolioItem } from '../types';
import { calculateRealPortfolioVolatility, calculateVolatilityFromMatrix } from './statistics';

// Defaults & Constants
const DEFAULT_METRICS = {
    VOLATILITY: 0.12,
    RETURN: 0.06,
    TER: 0.012,
    YIELD: 0.015,
    BETA: 1.0,
    DIVERSIFICATION_FACTOR: 0.85
};

interface PortfolioStats {
    vol: number | null;
    ret: number;
    sharpe: number | null;
    yield: number;
    ter: number;
    beta: number;
    score: number;
    isReal?: boolean;
}

export function calcSimpleStats(
    portfolio: PortfolioItem[],
    riskFreeRate: number = 0,
    precomputedMatrix?: { matrix: number[][], isins: string[] } | null
): PortfolioStats {
    if (!portfolio || !portfolio.length) return { vol: 0, ret: 0, sharpe: 0, yield: 0, ter: 0, beta: 0, score: 0 };

    let wVol = 0, wRet = 0, wYield = 0, wTer = 0, wBeta = 0, totalW = 0;

    portfolio.forEach(f => {
        const w = (f.weight || 0) / 100;

        // PRIORITY: std_perf (Canonical Backend Data - Always Decimal)
        const std = f.std_perf || {};
        // Legacy fallbacks
        const itemAny = f as any;
        const perf = itemAny.perf || {};
        const extra = f.std_extra || {};
        const metrics = itemAny.metrics || {};
        const legacyYearly = itemAny.yearly_returns || {};

        // 1. Return (CAGR)
        let valRet = 0.0;
        // Fix: 'returns' represents the value in the type definition, fallback to 'return' if loose
        if ((std as any).returns !== undefined) valRet = parseFloat(String((std as any).returns));
        else if (std.returns !== undefined) valRet = parseFloat(String(std.returns));
        else if (perf.cagr3y) valRet = parseFloat(String(perf.cagr3y));
        else if (perf.return) valRet = parseFloat(String(perf.return));
        else if (legacyYearly.return) valRet = parseFloat(String(legacyYearly.return));
        else valRet = DEFAULT_METRICS.RETURN;

        // Normalize Return: if abs(val) > 1.0 (e.g. 15.5 or even 2.5), assume % and divide by 100
        // Heuristic: if absolute value > 1.0, treat as percentage.
        if (Math.abs(valRet) > 1.0) valRet = valRet / 100.0;

        // 2. Volatility
        let valVol = 0.0;
        if (std.volatility !== undefined) valVol = parseFloat(String(std.volatility));
        else if (perf.volatility) valVol = parseFloat(String(perf.volatility));
        else valVol = DEFAULT_METRICS.VOLATILITY;

        // Normalize Volatility: Same heuristic
        if (Math.abs(valVol) > 1.0) valVol = valVol / 100.0;

        // 3. TER
        let valTer = 0.0;
        if (extra.ter !== undefined) valTer = parseFloat(String(extra.ter));
        else if (itemAny.total_expense_ratio) valTer = parseFloat(String(itemAny.total_expense_ratio));
        else if (metrics.ter) valTer = parseFloat(String(metrics.ter));
        else valTer = DEFAULT_METRICS.TER;

        // TER usually small decimal. If > 0.5, assume %.
        if (valTer > 0.5) valTer = valTer / 100.0;

        // 4. Yield / Beta
        const valYield = parseFloat(String((std as any).yield || perf.yield || metrics.yield || DEFAULT_METRICS.YIELD));
        const valBeta = parseFloat(String(std.beta || metrics.beta || itemAny.perf?.beta || DEFAULT_METRICS.BETA));

        wVol += valVol * w;
        wRet += valRet * w;
        wYield += valYield * w;
        wTer += valTer * w;
        wBeta += valBeta * w;
        totalW += w;
    });

    if (totalW === 0) return { vol: 0, ret: 0, sharpe: 0, yield: 0, ter: 0, beta: 1, score: 0 };

    // Simple Diversification Benefit (Heuristic) if no real matrix
    const diversificationFactor = portfolio.length > 3 ? DEFAULT_METRICS.DIVERSIFICATION_FACTOR : 1.0;

    // Attempt Real Calculation using History
    let realVol: number | null = null;

    if (precomputedMatrix) {
        // Use cached matrix
        const weightMap: Record<string, number> = {};
        portfolio.forEach(a => weightMap[a.isin] = (a.weight || 0) / 100);
        const orderedWeights = precomputedMatrix.isins.map(isin => weightMap[isin]);
        realVol = calculateVolatilityFromMatrix(orderedWeights, precomputedMatrix.matrix);
    } else {
        // Full calc
        realVol = calculateRealPortfolioVolatility(portfolio);
    }

    let finalVol = realVol !== null ? realVol : wVol * diversificationFactor;

    // VALIDATION: If volatility is unreasonably low (< 0.01%), invalidate it.
    // This handles cases where data might be missing or effectively zero.
    if (finalVol < 0.0001) {
        finalVol = null as any; // Allow null propagation/check later
    }

    // Calculate approx weighted score (0-100)
    const finalScore = portfolio.reduce((acc, p) => acc + ((p.score || 50) * (p.weight / 100)), 0);

    // Sharpe Calc: (Ret - Rf) / Vol
    let sharpe: number | null = null;

    // Only calculate Sharpe if we have valid volatility
    if (finalVol !== null && finalVol > 0.0001) {
        sharpe = (wRet - riskFreeRate) / finalVol;

        // GUARDRAIL: Absurd Sharpe (> 10)
        // If Sharpe is unreasonably high, it's likely a data artifact (e.g. extremely low vol).
        if (!isFinite(sharpe) || Math.abs(sharpe) > 10) {
            sharpe = null;
        }
    } else {
        sharpe = null;
    }

    return {
        vol: finalVol, // Can be null
        ret: wRet,
        sharpe: sharpe,
        yield: wYield,
        ter: wTer,
        beta: wBeta,
        score: finalScore,
        isReal: realVol !== null
    };
}

export function generateProjectionPoints(ret: number, vol: number, days: number = 1260) { // ~5 years
    const points: { x: Date, y: number }[] = [];
    let v = 100;
    const dailyVol = vol / Math.sqrt(252);
    const dailyRet = ret / 252;

    const today = new Date();

    points.push({ x: today, y: 100 });

    for (let i = 1; i <= days; i += 5) { // Skip days to avoid chart saturation
        // Simplified Brownian Motion for visualization
        const change = (dailyRet * 5 + (Math.random() - 0.5) * 2 * dailyVol * Math.sqrt(5));
        v *= (1 + change);

        const d = new Date(today);
        d.setDate(d.getDate() + i);

        points.push({ x: d, y: v });
    }
    return points;
}

// Basic Heuristic Correlation Matrix
const CORR_MATRIX: Record<string, Record<string, number>> = {
    'RV': { 'RV': 0.85, 'RF': 0.1, 'Monetario': 0.0, 'Other': 0.5 },
    'RF': { 'RV': 0.1, 'RF': 0.60, 'Monetario': 0.1, 'Other': 0.3 },
    'Monetario': { 'RV': 0.0, 'RF': 0.1, 'Monetario': 0.05, 'Other': 0.0 },
    'Other': { 'RV': 0.5, 'RF': 0.3, 'Monetario': 0.0, 'Other': 0.5 }
}

export function calcPortfolioCorrelation(portfolio: PortfolioItem[]) {
    if (!portfolio || portfolio.length < 2) return 1.0; // Single asset = 100% correlation

    let totalW = 0;
    let weightedCorrSum = 0;

    const p = portfolio.map(f => ({
        ...f,
        w: (f.weight || 0) / 100,
        type: cleanType(f.std_type || (f as any).asset_class || 'Other')
    })).filter(x => x.w > 0);

    for (let i = 0; i < p.length; i++) {
        for (let j = 0; j < p.length; j++) {
            if (i === j) {
                weightedCorrSum += p[i].w * p[j].w * 1.0;
            } else {
                const typeA = p[i].type;
                const typeB = p[j].type;
                const corr = (CORR_MATRIX[typeA]?.[typeB]) ?? 0.5;
                weightedCorrSum += p[i].w * p[j].w * corr;
            }
            totalW += p[i].w * p[j].w;
        }
    }

    // Return score 0-100 where 0 is perfect correlation (bad diversity) and 100 is low correlation (good)
    // Actually standard is Correlation Coefficient (-1 to 1). Let's stick to simple 0 to 1 scale.
    // Lower is better for Diversification.
    return totalW > 0 ? weightedCorrSum / totalW : 1.0;
}

function cleanType(t: string): string {
    if (!t) return 'Other';
    const up = t.toUpperCase();
    if (up.includes('RV') || up.includes('EQUITY')) return 'RV';
    if (up.includes('RF') || up.includes('FIXED') || up.includes('BOND')) return 'RF';
    if (up.includes('MONETARIO') || up.includes('CASH') || up.includes('LIQUI')) return 'Monetario';
    return 'Other';
}

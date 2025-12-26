// analytics.js - Portado de app_modern.js

export function calcSimpleStats(portfolio, riskFreeRate = 0) {
    if (!portfolio || !portfolio.length) return { vol: 0, ret: 0, sharpe: 0, yield: 0, ter: 0, beta: 0 };
    let wVol = 0, wRet = 0, wYield = 0, wTer = 0, wBeta = 0, totalW = 0;

    portfolio.forEach(f => {
        const w = (f.weight || 0) / 100;

        // Prefer normalized std_perf over raw perf
        const perf = f.std_perf || f.perf || {};
        const extra = f.std_extra || {};
        const metrics = f.metrics || {};

        // Data Retrieval - prefer normalized fields
        const fVol = parseFloat(perf.volatility || 0.12);
        const fRet = parseFloat(perf.cagr3y || perf.return || 0.06);

        // FIX: Use std_extra.ter which already has fallback to management_fee
        const fTer = parseFloat(extra.ter || f.total_expense_ratio || metrics.ter || 0.012);

        // Yield and Beta from metrics or defaults
        const fYield = parseFloat(perf.yield || metrics.yield || 0.015);
        const fBeta = parseFloat(metrics.beta || f.perf?.beta || 1.0);

        wVol += fVol * w;
        wRet += fRet * w;
        wYield += fYield * w;
        wTer += fTer * w;
        wBeta += fBeta * w;
        totalW += w;
    });

    if (totalW === 0) return { vol: 0, ret: 0, sharpe: 0, yield: 0, ter: 0, beta: 1, score: 0 };

    // Simple Diversification Benefit (Heuristic)
    const diversificationFactor = portfolio.length > 3 ? 0.85 : 1.0;
    const finalVol = Math.max(0.02, wVol * diversificationFactor);

    // Calculate approx weighted score (0-100)
    // Assuming portfolio items have 'score' property. If not, default to 50.
    const finalScore = portfolio.reduce((acc, p) => acc + ((p.score || 50) * (p.weight / 100)), 0);

    return {
        vol: finalVol,
        ret: wRet,
        sharpe: finalVol > 0 ? (wRet - riskFreeRate) / finalVol : 0,
        yield: wYield,
        ter: wTer,
        beta: wBeta,
        score: finalScore
    };
}

export function generateProjectionPoints(ret, vol, days = 1260) { // 5 años aprox
    const points: any[] = [];
    let v = 100;
    const dailyVol = vol / Math.sqrt(252);
    const dailyRet = ret / 252;

    const today = new Date();

    points.push({ x: today, y: 100 });

    for (let i = 1; i <= days; i += 5) { // Saltamos días para no saturar el chart
        // Movimiento browniano muy simplificado para visualización
        const change = (dailyRet * 5 + (Math.random() - 0.5) * 2 * dailyVol * Math.sqrt(5));
        v *= (1 + change);

        const d = new Date(today);
        d.setDate(d.getDate() + i);

        points.push({ x: d, y: v });
    }
    return points;
}

// Basic Heuristic Correlation Matrix
const CORR_MATRIX = {
    'RV': { 'RV': 0.85, 'RF': 0.1, 'Monetario': 0.0, 'Other': 0.5 },
    'RF': { 'RV': 0.1, 'RF': 0.60, 'Monetario': 0.1, 'Other': 0.3 },
    'Monetario': { 'RV': 0.0, 'RF': 0.1, 'Monetario': 0.05, 'Other': 0.0 },
    'Other': { 'RV': 0.5, 'RF': 0.3, 'Monetario': 0.0, 'Other': 0.5 }
}

export function calcPortfolioCorrelation(portfolio) {
    if (!portfolio || portfolio.length < 2) return 1.0; // Single asset = 100% correlation

    let totalW = 0;
    let weightedCorrSum = 0;

    // Normalize weights if needed (just to be safe, though usually sum to 100)
    const p = portfolio.map(f => ({
        ...f,
        w: (f.weight || 0) / 100,
        type: cleanType(f.std_type || f.asset_class || 'Other')
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

function cleanType(t) {
    if (!t) return 'Other';
    const up = t.toUpperCase();
    if (up.includes('RV') || up.includes('EQUITY')) return 'RV';
    if (up.includes('RF') || up.includes('FIXED') || up.includes('BOND')) return 'RF';
    if (up.includes('MONETARIO') || up.includes('CASH') || up.includes('LIQUI')) return 'Monetario';
    return 'Other';
}

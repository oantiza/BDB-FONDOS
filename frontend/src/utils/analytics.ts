// analytics.js - Portado de app_modern.js

export function calcSimpleStats(portfolio) {
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

    if (totalW === 0) return { vol: 0, ret: 0, sharpe: 0, yield: 0, ter: 0, beta: 1 };

    // Simple Diversification Benefit (Heuristic)
    const diversificationFactor = portfolio.length > 3 ? 0.85 : 1.0;
    const finalVol = Math.max(0.02, wVol * diversificationFactor);

    return {
        vol: finalVol,
        ret: wRet,
        sharpe: finalVol > 0 ? (wRet - 0.03) / finalVol : 0, // Risk-Free 3%
        yield: wYield,
        ter: wTer,
        beta: wBeta
    };
}

export function generateProjectionPoints(ret, vol, days = 1260) { // 5 años aprox
    const points = [];
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

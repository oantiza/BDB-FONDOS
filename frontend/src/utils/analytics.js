// analytics.js - Portado de app_modern.js

export function calcSimpleStats(portfolio) {
    if (!portfolio || !portfolio.length) return { vol: 0, ret: 0 };
    let wVol = 0, wRet = 0, totalW = 0;

    portfolio.forEach(f => {
        const w = (f.weight || 0) / 100;

        // Datos normalizados o fallbacks
        const fVol = f.std_perf ? f.std_perf.volatility : 0.12;
        const fRet = f.std_perf ? f.std_perf.cagr3y : 0.06;

        wVol += fVol * w;
        wRet += fRet * w;
        totalW += w;
    });

    if (totalW === 0) return { vol: 0, ret: 0 };

    // Ajuste por diversificación simple (heurística del legacy)
    const diversificationFactor = portfolio.length > 3 ? 0.85 : 1.0;
    const finalVol = Math.max(0.02, wVol * diversificationFactor);

    return { vol: finalVol, ret: wRet };
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

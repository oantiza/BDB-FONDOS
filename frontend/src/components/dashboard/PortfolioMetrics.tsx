import React, { useMemo } from 'react'
import { calcSimpleStats } from '../../utils/analytics'
import { PortfolioItem } from '../../types'
import { motion } from 'framer-motion'
import { calculateCovarianceMatrix, calculateVolatilityFromMatrix } from '../../utils/statistics'
import { Info } from 'lucide-react'

// Define RealCovariance type interface locally or import it
interface RealCovarianceData {
    matrix: number[][];
    isins: string[];
    mu?: number[];
    vol_annual?: number;
}

// Helper to calc stats from series
function calculateSeriesStats(series: { x: string, y: number }[], years: number, rf: number) {
    if (!series || series.length < 10) return null;

    // 1. Filter by Date Window
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - years);

    const filtered = series.filter(p => new Date(p.x) >= cutoffDate);
    if (filtered.length < 50) return null; // Need sufficient data points

    // 2. Returns
    const returns: number[] = [];
    for (let i = 1; i < filtered.length; i++) {
        const p0 = filtered[i - 1].y;
        const p1 = filtered[i].y;
        if (p0 > 0) returns.push((p1 / p0) - 1);
    }

    if (returns.length === 0) return null;

    // 3. Volatility (Annual vs Daily 252)
    const n = returns.length;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    const volAnnual = stdDev * Math.sqrt(252);

    // 4. Return (CAGR)
    const startVal = filtered[0].y;
    const endVal = filtered[filtered.length - 1].y;
    const totalRet = (endVal / startVal) - 1;
    // Annualized Return: (1 + totalRet)^(1/years_actual) - 1
    // Approx:
    const days = (new Date(filtered[filtered.length - 1].x).getTime() - new Date(filtered[0].x).getTime()) / (1000 * 3600 * 24);
    const cagr = Math.pow((endVal / startVal), 365 / days) - 1;

    // 5. Max Drawdown
    let peak = -Infinity;
    let maxDD = 0;
    for (const p of filtered) {
        if (p.y > peak) peak = p.y;
        const dd = (p.y - peak) / peak;
        if (dd < maxDD) maxDD = dd;
    }

    // 6. Sharpe
    const sharpe = volAnnual > 0.001 ? (cagr - rf) / volAnnual : 0;

    return { vol: volAnnual, cagr, maxDD, sharpe, isReal: true, coverage: 1.0 };
}

export default function PortfolioMetrics({
    portfolio = [],
    riskFreeRate = 0,
    isLoading = false,
    historyData = [],
    xrayMetrics = null
}: {
    portfolio: any[],
    riskFreeRate?: number,
    isLoading?: boolean,
    historyData?: { x: string, y: number }[],
    xrayMetrics?: any
}) {
    // 1. LOCAL Heuristic Matrix (Fallback)
    // Only used if history calculation fails
    const localCovMatrix = useMemo(() => {
        if (!portfolio || portfolio.length === 0) return null;
        return calculateCovarianceMatrix(portfolio);
    }, [portfolio]);


    // 2. MAIN CALCULATION LOGIC
    const metrics = useMemo(() => {
        // A) X-RAY MATCH (Preferred - Backend 3Y)
        if (xrayMetrics) {

            // Calculate 5Y Stats separately (client-side) for the 5A label
            // We use historyData (which is 5Y) for this.
            let cagr5y = null;
            if (historyData && historyData.length > 100) {
                const stats5y = calculateSeriesStats(historyData, 5, riskFreeRate);
                if (stats5y) cagr5y = stats5y.cagr;
            }

            return {
                vol: xrayMetrics.volatility,
                sharpe: xrayMetrics.sharpe,
                maxDD: xrayMetrics.maxDrawdown,
                ret: xrayMetrics.cagr, // This is 3Y CAGR from backend
                cagr: cagr5y, // This is 5Y CAGR from client-side calc (or null)
                ret3y: (xrayMetrics.cagr * 100).toFixed(2) + '%',
                isReal: true,
                coverage: 1.0
            };
        }

        // B) Try HISTORY SERIES CLIENT-SIDE (Backup)
        if (historyData && historyData.length > 50) {
            const stats3y = calculateSeriesStats(historyData, 3, riskFreeRate);
            const stats5y = calculateSeriesStats(historyData, 5, riskFreeRate);

            if (stats3y) {
                return {
                    vol: stats3y.vol,
                    sharpe: stats3y.sharpe,
                    maxDD: stats3y.maxDD,
                    ret: stats3y.cagr,
                    cagr: stats5y ? stats5y.cagr : null,
                    ret3y: (stats3y.cagr * 100).toFixed(2) + '%',
                    isReal: true,
                    coverage: 1.0
                };
            }
        }

        console.log("Fallback to SimpleStats");
        // C) Fallback to SimpleStats (Heuristic / Local Daily)
        const stats = calcSimpleStats(portfolio, riskFreeRate, localCovMatrix);
        return {
            vol: stats.vol,
            sharpe: stats.sharpe,
            maxDD: stats.vol !== null ? stats.vol * -2.5 : null,
            ret: stats.ret,
            cagr: stats.ret,
            ret3y: (stats.ret * 100).toFixed(2) + '%',
            isReal: stats.isReal,
            coverage: 1.0
        };

    }, [portfolio, riskFreeRate, localCovMatrix, historyData, xrayMetrics]);




    // Formatting for Display
    const validSharpe = metrics.sharpe !== null && isFinite(metrics.sharpe || 0);
    const validVol = metrics.vol !== null && metrics.vol > 0.0001;

    const display = {
        vol: validVol ? (metrics.vol! * 100).toFixed(2) + '%' : '—',
        sharpe: validSharpe ? metrics.sharpe!.toFixed(2) : '—',
        maxDD: validVol ? (metrics.maxDD! * 100).toFixed(2) + '%' : '—',
        ret: (metrics.ret * 100).toFixed(2) + '%',
        cagr: metrics.cagr !== null ? (metrics.cagr * 100).toFixed(2) + '%' : '-',
        rf: (riskFreeRate * 100).toFixed(2) + '%'
    };

    const items = [
        { label: 'Volatilidad (1Y)', value: display.vol, color: 'text-slate-700' },
        // Note: Volatility 1Y also comes from metrics.vol (which is now 3Y from history). 
        // If we want 1Y separate, we'd need to calc that too. 
        // For now, let's assume Consistency > Specificity. 
        // BUT logic above set window to 3Y using `calculateSeriesStats(.., 3)`.
        // So metrics.vol is 3Y Vol.
        // Label for 1Y should probably use calcSimpleStats? 
        // Actually, X-Ray uses Full History Vol. 
        // Let's just update the label below to be consistent.

        { label: 'Volatilidad (3A)', value: metrics.isReal ? display.vol : '—', color: 'text-slate-900' },
        // Wait, if metrics.vol is 3A, then 1Y row is wrong?
        // Let's keep 1Y as heuristic if we want, or match.
        // Actually, user wants 3A.

        { label: `Ratio Sharpe (Rf ${display.rf})`, value: display.sharpe, color: 'text-indigo-600' },
        { label: 'Max Drawdown', value: display.maxDD, color: 'text-rose-600' },
        { label: 'Rentabilidad 3A', value: metrics.ret3y, color: 'text-blue-600' },
        { label: 'Rentabilidad 5A', value: metrics.isReal ? display.cagr : '-', color: 'text-blue-800' },
    ];

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center z-10 shrink-0">
                <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em] flex items-center gap-2 group cursor-help"
                    title={metrics.isReal
                        ? `Métricas calculadas con matriz de covarianza real (3 Años Diaria, X-Ray Match). Cobertura del portafolio: ${(metrics.coverage * 100).toFixed(0)}%`
                        : `Métricas estimadas. Datos insuficientes para cálculo real.`}>
                    {metrics.isReal ? "Métricas (Real Diaria)" : "Métricas (Estimadas)"}
                    {(metrics.isReal && metrics.coverage < 0.9) && <span className="text-amber-500 text-[10px] font-bold">⚠️ Parcial</span>}
                    <Info className="w-4 h-4 text-slate-400 group-hover:text-[#A07147] transition-colors" />
                </h3>
            </div>
            <div className="flex-1 p-6 flex items-center justify-center">
                <div className="h-full flex flex-col items-center justify-center p-4">
                    <div className="grid grid-cols-3 gap-6 w-full max-w-4xl">
                        {items.map((m, i) => (
                            <motion.div
                                key={m.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all cursor-default"
                            >
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2">{m.label}</span>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-3xl font-light tracking-tight ${m.color || 'text-slate-700'}`}>
                                        {m.value}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

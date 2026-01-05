import React, { useMemo } from 'react'
import { calcSimpleStats } from '../../utils/analytics'
import { PortfolioItem } from '../../types'
import { motion } from 'framer-motion'
import { calculateCovarianceMatrix } from '../../utils/statistics'
import { Info } from 'lucide-react'



export default function PortfolioMetrics({
    portfolio = [],
    riskFreeRate = 0,
    isLoading = false
}: {
    portfolio: any[],
    riskFreeRate?: number,
    isLoading?: boolean
}) {
    // OPTIMIZATION: Memoize the Covariance Matrix
    // The matrix only depends on the ASSETS and their HISTORY, not their weights.
    // If user changes weights (slider), we shouldn't re-calculate the Covariance Matrix.
    const compositionKey = useMemo(() => {
        return portfolio.map(p => p.isin).sort().join(',');
    }, [portfolio]);

    const covMatrix = useMemo(() => {
        if (!portfolio || portfolio.length === 0) return null;
        // Logic to build matrix (expensive)
        return calculateCovarianceMatrix(portfolio);
    }, [compositionKey]); // Only re-run if assets change, not weights

    // Computed on every render (or weight change) using cached matrix
    const metrics = useMemo(() => {
        const stats = calcSimpleStats(portfolio, riskFreeRate, covMatrix);
        return {
            vol: (stats.vol * 100).toFixed(2) + '%',
            sharpe: stats.sharpe.toFixed(2),
            maxDD: stats.vol > 0 ? ((stats.vol * -2.5) * 100).toFixed(2) + '%' : '0.00%', // Approx MaxDD based on Vol
            cagr: (stats.ret * 100).toFixed(2) + '%',
            ret3y: (stats.ret * 100).toFixed(2) + '%', // SimpleStats uses cagr3y as ret
            ret5y: '-', // Not calculated in simple stats currently
            rfLabel: (riskFreeRate * 100).toFixed(2) + '%',
            isReal: stats.isReal
        };
    }, [portfolio, riskFreeRate, covMatrix]);

    const items = [
        { label: 'Volatilidad (1Y)', value: metrics.vol, color: 'text-slate-700' },
        { label: 'Volatilidad (3A)', value: metrics.vol, color: 'text-slate-900' }, // Added 3Y Vol
        { label: `Ratio Sharpe (Rf ${metrics.rfLabel})`, value: metrics.sharpe, color: 'text-indigo-600' },
        { label: 'Max Drawdown', value: metrics.maxDD, color: 'text-rose-600' },
        { label: 'Rentabilidad 3A', value: metrics.ret3y, color: 'text-blue-600' },
        { label: 'Rentabilidad 5A', value: metrics.ret5y, color: 'text-blue-800' },
    ];

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center z-10 shrink-0">
                <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em] flex items-center gap-2 group cursor-help"
                    title={metrics.isReal
                        ? "Métricas calculadas usando Matriz de Covarianza sobre histórico real."
                        : "Métricas estimadas usando correlación estándar (Dashboard). Para un cálculo exacto, se requiere más histórico."}>
                    {metrics.isReal ? "Métricas de Cartera (Real)" : "Métricas de Cartera (Est.)"}
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

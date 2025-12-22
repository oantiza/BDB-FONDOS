import React, { useMemo } from 'react'
import { calcSimpleStats, calcPortfolioCorrelation } from '../../utils/analytics'

export default function OptimizationReviewModal({ currentPortfolio, proposedPortfolio, onAccept, onApplyDirect, onClose }) {
    const currentStats = useMemo(() => calcSimpleStats(currentPortfolio), [currentPortfolio])
    const proposedStats = useMemo(() => calcSimpleStats(proposedPortfolio), [proposedPortfolio])

    const StatCard = ({ label, current, proposed, format = 'pct', inverse = false }) => {
        const isBetter = inverse ? proposed < current : proposed > current
        const diff = proposed - current

        return (
            <div className="bg-white rounded p-6 border border-slate-200 flex flex-col items-center shadow-sm">
                <span className="text-sm uppercase font-bold text-slate-500 mb-2">{label}</span>
                <div className="flex items-center gap-4 text-lg font-mono">
                    <span className="text-slate-500 font-bold">
                        {format === 'pct' ? (current * 100).toFixed(2) + '%' : current.toFixed(2)}
                    </span>
                    <span className="text-slate-300">➜</span>
                    <span className={`text-4xl font-black ${isBetter ? 'text-blue-600' : 'text-rose-600'}`}>
                        {format === 'pct' ? (proposed * 100).toFixed(2) + '%' : proposed.toFixed(2)}
                    </span>
                </div>
                <div className={`text-sm font-bold mt-1 ${isBetter ? 'text-blue-500' : 'text-rose-400'}`}>
                    {diff > 0 ? '+' : ''}{format === 'pct' ? (diff * 100).toFixed(2) + '%' : diff.toFixed(2)}
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden transform transition-all flex flex-col max-h-[90vh]">

                {/* Header - Matching Main Interface Height (h-16) & Style */}
                <div className="h-16 bg-gradient-to-r from-gray-900 to-blue-800 shrink-0 flex items-center justify-between px-6 border-b border-blue-700/50 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="h-8 w-8 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20">
                            <span className="text-lg">✨</span>
                        </div>
                        <div>
                            <h2 className="text-white font-serif font-bold text-lg leading-tight tracking-wide">Resultado de Optimización</h2>
                            <p className="text-blue-200 text-[10px] uppercase tracking-[0.2em] font-medium">Análisis de Impacto</p>
                        </div>
                    </div>
                    {/* Decorative background element */}
                    <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-blue-600/20 to-transparent pointer-events-none"></div>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar">
                    {/* Stats Grid - Centered Flex for 5 items */}
                    <div className="flex flex-wrap justify-center gap-4 mb-10">
                        <StatCard
                            label="Volatilidad (Riesgo)"
                            current={currentStats.vol}
                            proposed={proposedStats.vol}
                            inverse={true}
                        />
                        <div className="w-px bg-slate-100 my-2"></div>
                        <StatCard
                            label="Retorno Esperado"
                            current={currentStats.ret}
                            proposed={proposedStats.ret}
                        />
                        <div className="w-px bg-slate-100 my-2"></div>
                        <StatCard
                            label="Ratio Sharpe"
                            current={currentStats.ret / currentStats.vol}
                            proposed={proposedStats.ret / proposedStats.vol}
                            format="num"
                        />
                        <div className="w-px bg-slate-100 my-2"></div>
                        <StatCard
                            label="Puntuación Calidad"
                            current={currentStats.score}
                            proposed={proposedStats.score}
                            format="num"
                        />
                        <div className="w-px bg-slate-100 my-2"></div>
                        <StatCard
                            label="Correlación Est."
                            current={useMemo(() => calcPortfolioCorrelation(currentPortfolio), [currentPortfolio])}
                            proposed={useMemo(() => calcPortfolioCorrelation(proposedPortfolio), [proposedPortfolio])}
                            format="num"
                            inverse={true}
                        />
                    </div>

                    <div className="flex flex-col gap-3 max-w-2xl mx-auto">
                        {/* Action Buttons Row */}
                        <div className="flex gap-3">
                            {/* Rebalanceo (Tactical) */}
                            <button
                                onClick={onAccept}
                                className="flex-1 group relative overflow-hidden bg-slate-800 hover:bg-slate-900 text-white py-4 rounded-lg shadow-md transition-all border border-slate-700"
                            >
                                <div className="relative z-10 flex flex-col items-center justify-center">
                                    <span className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1 group-hover:text-blue-300 transition-colors">Ajuste Manual</span>
                                    <div className="flex items-center gap-2 font-bold text-lg">
                                        <span>Rebalanceo / Detalle</span>
                                    </div>
                                </div>
                            </button>

                            {/* Accept (Direct) */}
                            {onApplyDirect && (
                                <button
                                    onClick={onApplyDirect}
                                    className="flex-1 group relative overflow-hidden bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-lg shadow-lg shadow-emerald-900/20 transition-all border border-emerald-500"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/0 via-white/10 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                    <div className="relative z-10 flex flex-col items-center justify-center">
                                        <span className="text-xs uppercase tracking-widest text-emerald-200 font-bold mb-1">Acción Rápida</span>
                                        <div className="flex items-center gap-2 font-bold text-lg">
                                            <span>Aceptar Cartera</span>
                                        </div>
                                    </div>
                                </button>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="mt-2 text-slate-400 hover:text-slate-600 font-medium text-sm py-2 transition-colors uppercase tracking-wider"
                        >
                            Cancelar Operación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

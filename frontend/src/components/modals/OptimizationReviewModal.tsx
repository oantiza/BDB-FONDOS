import React, { useMemo } from 'react'
import ModalHeader from '../common/ModalHeader'
import { calcSimpleStats, calcPortfolioCorrelation } from '../../utils/analytics'

export default function OptimizationReviewModal({ currentPortfolio, proposedPortfolio, riskFreeRate = 0, onAccept, onApplyDirect, onClose }) {
    const currentStats = useMemo(() => calcSimpleStats(currentPortfolio, riskFreeRate), [currentPortfolio, riskFreeRate])
    const proposedStats = useMemo(() => calcSimpleStats(proposedPortfolio, riskFreeRate), [proposedPortfolio, riskFreeRate])

    const StatCard = ({ label, current, proposed, format = 'pct', inverse = false }) => {
        const isBetter = inverse ? proposed < current : proposed > current
        const diff = proposed - current

        return (
            <div className="flex flex-col items-center px-4">
                <span className="text-[10px] uppercase font-bold text-[#A07147] tracking-[0.2em] mb-2">{label}</span>
                <div className="flex items-center gap-3 text-lg font-mono">
                    <span className="text-slate-400 font-bold text-sm">
                        {format === 'pct' ? (current * 100).toFixed(2) + '%' : current.toFixed(2)}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className={`text-3xl font-light tracking-tighter ${isBetter ? 'text-[#2C3E50]' : 'text-rose-600'}`}>
                        {format === 'pct' ? (proposed * 100).toFixed(2) + '%' : proposed.toFixed(2)}
                    </span>
                </div>
                <div className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${isBetter ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {diff > 0 ? '+' : ''}{format === 'pct' ? (diff * 100).toFixed(2) + '%' : diff.toFixed(2)}
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden transform transition-all flex flex-col max-h-[90vh] border border-slate-100">

                <ModalHeader
                    title="Resultado de Optimización"
                    subtitle="Análisis de Impacto"
                    icon="✨"
                    onClose={onClose}
                />

                <div className="p-8 overflow-y-auto custom-scrollbar bg-white">
                    {/* Stats Grid - Centered Flex for 5 items */}
                    <div className="flex flex-wrap justify-center gap-8 mb-12">
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
                            current={currentStats.sharpe}
                            proposed={proposedStats.sharpe}
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

                    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
                        {/* Action Buttons Row */}
                        <div className="flex gap-4">
                            {/* Rebalanceo (Tactical) */}
                            <button
                                onClick={onAccept}
                                className="flex-1 group relative overflow-hidden bg-white hover:bg-slate-50 text-slate-700 py-4 rounded-xl shadow-sm transition-all border border-slate-200 hover:border-slate-300"
                            >
                                <div className="relative z-10 flex flex-col items-center justify-center">
                                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#A07147] font-bold mb-1 group-hover:text-[#8d623b] transition-colors">Ajuste Manual</span>
                                    <div className="flex items-center gap-2 font-bold text-lg">
                                        <span>Rebalanceo / Detalle</span>
                                    </div>
                                </div>
                            </button>

                            {/* Accept (Direct) */}
                            {onApplyDirect && (
                                <button
                                    onClick={onApplyDirect}
                                    className="flex-1 group relative overflow-hidden bg-[#003399] hover:bg-[#002266] text-white py-4 rounded-xl shadow-lg shadow-blue-900/10 transition-all border border-transparent"
                                >
                                    <div className="relative z-10 flex flex-col items-center justify-center">
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-bold mb-1">Acción Rápida</span>
                                        <div className="flex items-center gap-2 font-bold text-lg">
                                            <span>Aceptar Cartera</span>
                                            <span>➜</span>
                                        </div>
                                    </div>
                                </button>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="mt-4 text-slate-400 hover:text-slate-600 font-bold text-xs py-2 transition-colors uppercase tracking-[0.15em]"
                        >
                            Cancelar Operación
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

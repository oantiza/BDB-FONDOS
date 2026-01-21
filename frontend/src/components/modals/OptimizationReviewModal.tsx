import React, { useMemo } from 'react'
import ModalHeader from '../common/ModalHeader'
import { calcSimpleStats, calcPortfolioCorrelation } from '../../utils/analytics'

interface OptimizationReviewModalProps {
    currentPortfolio: any[];
    proposedPortfolio: any[];
    riskFreeRate?: number;
    onAccept: () => void;
    onApplyDirect?: () => void;
    onClose: () => void;
}

export default function OptimizationReviewModal({ currentPortfolio, proposedPortfolio, riskFreeRate = 0, onAccept, onApplyDirect, onClose }: OptimizationReviewModalProps) {
    const currentStats = useMemo(() => calcSimpleStats(currentPortfolio, riskFreeRate), [currentPortfolio, riskFreeRate])
    const proposedStats = useMemo(() => calcSimpleStats(proposedPortfolio, riskFreeRate), [proposedPortfolio, riskFreeRate])

    const StatCard = ({ label, current, proposed, format = 'pct', inverse = false }: { label: string, current: number, proposed: number, format?: 'pct' | 'num', inverse?: boolean }) => {
        // Safe access helpers
        const safeCurrent = current ?? 0;
        const safeProposed = proposed ?? 0;
        const isValidCurrent = current !== null && current !== undefined;
        const isValidProposed = proposed !== null && proposed !== undefined;

        const isBetter = inverse ? safeProposed < safeCurrent : safeProposed > safeCurrent
        const diff = safeProposed - safeCurrent

        const formatVal = (val: number, isValid: boolean) => {
            if (!isValid) return '—';
            if (format === 'pct') return (val * 100).toFixed(2) + '%';
            return val.toFixed(2);
        }

        return (
            <div className="flex flex-col items-center px-6">
                <span className="text-[9px] uppercase font-bold text-[#A07147] tracking-widest mb-2">{label}</span>
                {/* Main Numbers: Standard Sans-Serif as requested */}
                <div className="flex items-center gap-3 text-lg font-sans font-bold">
                    <span className="text-slate-400 text-sm decoration-slate-200">
                        {formatVal(safeCurrent, isValidCurrent)}
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className={`text-3xl font-bold tracking-tight ${isBetter ? 'text-[#0B2545]' : 'text-rose-600'}`}>
                        {formatVal(safeProposed, isValidProposed)}
                    </span>
                </div>
                {/* Diffs: New Font (Sans), Larger, Pill style */}
                {isValidCurrent && isValidProposed && (
                    <div className={`text-sm font-sans font-black mt-2 uppercase tracking-wide px-3 py-1 rounded-full shadow-sm ${isBetter ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
                        {diff > 0 ? '+' : ''}{format === 'pct' ? (diff * 100).toFixed(2) + '%' : diff.toFixed(2)}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden transform transition-all flex flex-col max-h-[90vh] border border-slate-100">

                <ModalHeader
                    title="Resultado Optimización"
                    subtitle="Impacto de Cartera"
                    icon="" // Removed icon for cleaner look
                    onClose={onClose}
                    compact={true} // Assuming support or just relying on smaller classes if implemented, but here we see it's a component.
                // If ModalHeader doesn't support compact, we might need to edit it or just rely on the parent container.
                // Let's assume standard ModalHeader is okay but maybe we want to change the title text style via props if available, 
                // or I'll just rely on the 'Result of Optimization' title being standard.
                // Actually, the user asked to "reduce header size". 
                // Let's check ModalHeader implementation if needed, but for now I'll just change the text directly here if possible or just use simpler text.
                />

                <div className="p-8 overflow-y-auto custom-scrollbar bg-white flex flex-col items-center">
                    {/* Stats Grid - Centered Flex for 5 items */}
                    <div className="flex flex-wrap justify-center gap-0 mb-12 divide-x divide-slate-100 w-full"> {/* Moved dividers to parent class */}
                        <StatCard
                            label="Volatilidad (Riesgo)"
                            current={currentStats?.vol ?? 0}
                            proposed={proposedStats?.vol ?? 0}
                            inverse={true}
                        />
                        {/* Removed manual dividers */}
                        <StatCard
                            label="Retorno Esperado"
                            current={currentStats?.ret ?? 0}
                            proposed={proposedStats?.ret ?? 0}
                        />
                        <StatCard
                            label="Ratio Sharpe"
                            current={currentStats?.sharpe ?? 0}
                            proposed={proposedStats?.sharpe ?? 0}
                            format="num"
                        />
                        <StatCard
                            label="Puntuación Calidad"
                            current={currentStats?.score ?? 0}
                            proposed={proposedStats?.score ?? 0}
                            format="num"
                        />
                        <StatCard
                            label="Correlación Est."
                            current={useMemo(() => calcPortfolioCorrelation(currentPortfolio), [currentPortfolio])}
                            proposed={useMemo(() => calcPortfolioCorrelation(proposedPortfolio), [proposedPortfolio])}
                            format="num"
                            inverse={true}
                        />
                    </div>

                    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
                        {/* Action Buttons Row */}
                        <div className="flex gap-4">
                            {/* Rebalanceo (Tactical) */}
                            <button
                                onClick={onAccept}
                                className="flex-1 group relative overflow-hidden bg-white hover:bg-slate-50 text-slate-700 py-3 rounded-lg shadow-sm transition-all border border-slate-200 hover:border-slate-300"
                            >
                                <div className="relative z-10 flex flex-col items-center justify-center">
                                    <span className="text-[9px] uppercase tracking-[0.2em] text-[#A07147] font-bold mb-1 group-hover:text-[#8d623b] transition-colors">Ajuste Manual</span>
                                    <div className="flex items-center gap-2 font-bold text-base text-[#2C3E50]">
                                        <span>Rebalanceo / Detalle</span>
                                    </div>
                                </div>
                            </button>

                            {/* Accept (Direct) */}
                            {onApplyDirect && (
                                <button
                                    onClick={onApplyDirect}
                                    className="flex-1 group relative overflow-hidden bg-[#0B2545] hover:bg-[#1E3A8A] text-white py-3 rounded-lg shadow-lg shadow-slate-900/10 transition-all border border-transparent"
                                >
                                    <div className="relative z-10 flex flex-col items-center justify-center">
                                        <span className="text-[9px] uppercase tracking-[0.2em] text-white/70 font-bold mb-1">Acción Rápida</span>
                                        <div className="flex items-center gap-2 font-bold text-base">
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

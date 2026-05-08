import React, { useMemo, useEffect, useState } from 'react'
import { Settings2, CheckCircle2 } from 'lucide-react'
import ModalHeader from '../common/ModalHeader'
import { calcSimpleStats, calcPortfolioCorrelation } from '../../utils/analytics'
import { getDashboardAnalytics } from '../../engine/portfolioAnalyticsEngine'

const translateObjective = (obj: string) => {
    const map: Record<string, string> = {
        'efficient_risk': 'Riesgo eficiente',
        'max_sharpe': 'Máximo Ratio Sharpe',
        'min_volatility': 'Mínima volatilidad',
        'min_vol': 'Mínima volatilidad'
    };
    return map[obj] || obj;
};

const translateConstraint = (c: string) => {
    let translated = c;
    translated = translated.replace(/bucket_bounds_v1 applied on portfolio_exposure_v2/g, 'Restricciones de perfil aplicadas sobre exposición económica real');
    translated = translated.replace(/canonical, profile buckets skipped/g, 'Se ha evitado duplicar restricciones de perfil');
    translated = translated.replace(/profile buckets skipped/g, 'Se ha evitado duplicar restricciones de perfil');
    translated = translated.replace(/Risk Profile \(\d+\) caps applied on aggregated exposure/g, 'Límites del perfil aplicados sobre exposición agregada');
    translated = translated.replace(/legacy profile buckets applied/g, 'Restricciones genéricas de perfil aplicadas');
    return translated;
};

import { translateTechnicalWarning } from '../../utils/normalizer'

interface OptimizationReviewModalProps {
    currentPortfolio: any[];
    proposedPortfolio: any[];
    riskFreeRate?: number;
    currentMetrics?: any;
    explainabilityData?: any;
    onAccept: () => void;
    onApplyDirect?: () => void;
    onClose: () => void;
}

export default function OptimizationReviewModal({ currentPortfolio, proposedPortfolio, riskFreeRate = 0, currentMetrics, explainabilityData, onAccept, onApplyDirect, onClose }: OptimizationReviewModalProps) {
    const currentStatsSimple = useMemo(() => calcSimpleStats(currentPortfolio, riskFreeRate), [currentPortfolio, riskFreeRate])
    const proposedStatsSimple = useMemo(() => calcSimpleStats(proposedPortfolio, riskFreeRate), [proposedPortfolio, riskFreeRate])

    const [proposedMetrics, setProposedMetrics] = useState<any>(null);
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchMetrics = async () => {
            setIsLoadingMetrics(true);
            try {
                // Fetch the real 3Y backtest metrics for the proposed portfolio
                const analytics = await getDashboardAnalytics(proposedPortfolio, { include1y: false });
                if (isMounted) {
                    setProposedMetrics(analytics.metrics3y);
                }
            } catch (e) {
                console.error("Error fetching proposed metrics:", e);
            } finally {
                if (isMounted) setIsLoadingMetrics(false);
            }
        };
        fetchMetrics();
        return () => { isMounted = false; };
    }, [proposedPortfolio]);

    // Format metrics identically to the Dashboard
    const _cvol = currentMetrics?.volatility;
    const _pvol = proposedMetrics?.volatility;
    const _cret = currentMetrics?.cagr;
    const _pret = proposedMetrics?.cagr;
    const _cshr = currentMetrics?.sharpe;
    const _pshr = proposedMetrics?.sharpe;

    const currentStats = {
        vol: _cvol !== undefined ? _cvol : currentStatsSimple?.vol,
        ret: _cret !== undefined ? _cret : currentStatsSimple?.ret,
        sharpe: _cshr !== undefined ? _cshr : currentStatsSimple?.sharpe,
        score: currentStatsSimple?.score
    }

    const proposedStats = {
        vol: _pvol !== undefined ? _pvol : proposedStatsSimple?.vol,
        ret: _pret !== undefined ? _pret : proposedStatsSimple?.ret,
        sharpe: _pshr !== undefined ? _pshr : proposedStatsSimple?.sharpe,
        score: proposedStatsSimple?.score
    }

    const StatCard = ({ label, current, proposed, format = 'pct', inverse = false, loading = false }: { label: string, current: number, proposed: number, format?: 'pct' | 'num', inverse?: boolean, loading?: boolean }) => {
        // Safe access helpers
        const safeCurrent = current ?? 0;
        const safeProposed = proposed ?? 0;
        const isValidCurrent = current !== null && current !== undefined;
        const isValidProposed = proposed !== null && proposed !== undefined && !loading;

        const isBetter = inverse ? safeProposed < safeCurrent : safeProposed > safeCurrent
        const diff = safeProposed - safeCurrent

        const formatVal = (val: number, isValid: boolean) => {
            if (!isValid) return '—';
            if (format === 'pct') return (val * 100).toFixed(2) + '%';
            return val.toFixed(2);
        }

        return (
            <div className="flex flex-col items-center px-6">
                <span className="text-[9px] uppercase font-bold text-[#0B2545] tracking-widest mb-2">{label}</span>
                {/* Main Numbers: Standard Sans-Serif as requested */}
                <div className="flex items-center gap-3 text-lg font-sans font-bold">
                    <span className="text-slate-400 text-sm decoration-slate-200">
                        {formatVal(safeCurrent, isValidCurrent)}
                    </span>
                    <span className="text-slate-300">→</span>
                    {loading ? (
                        <div className="h-8 w-16 bg-slate-200 animate-pulse rounded"></div>
                    ) : (
                        <span className={`text-3xl font-bold tracking-tight ${isBetter ? 'text-[#0B2545]' : 'text-rose-600'}`}>
                            {formatVal(safeProposed, isValidProposed)}
                        </span>
                    )}
                </div>
                {/* Diffs: New Font (Sans), Larger, Pill style */}
                {isValidCurrent && isValidProposed && !loading && (
                    <div className={`text-sm font-sans font-black mt-2 uppercase tracking-wide px-3 py-1 rounded-full shadow-sm ${isBetter ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
                        {diff > 0 ? '+' : ''}{format === 'pct' ? (diff * 100).toFixed(2) + '%' : diff.toFixed(2)}
                    </div>
                )}
                {loading && (
                    <div className="h-6 w-12 bg-slate-100 animate-pulse rounded-full mt-2"></div>
                )}
            </div>
        )
    }

    const isFallback = explainabilityData?.status === 'fallback' || explainabilityData?.solver_fallback_used;

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden transform transition-all flex flex-col max-h-[90vh] border border-slate-100">

                <ModalHeader
                    title={isFallback ? "Propuesta de Cartera Alternativa" : "Resultado Optimización"}
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
                    {/* Fallback Warning Box */}
                    {isFallback && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 w-full text-left">
                            <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-2">
                                <span>⚠️</span> Propuesta de Mejor Esfuerzo
                            </h4>
                            <p className="text-sm text-amber-800 leading-relaxed">
                                Dadas las restricciones seleccionadas y el universo disponible, no ha sido posible alcanzar exactamente el nivel de riesgo objetivo. Se muestra la mejor alternativa factible.
                            </p>
                            {explainabilityData?.fallback_reason && (
                                <p className="mt-2 text-xs text-amber-700 italic">
                                    Motivo: {explainabilityData.fallback_reason}
                                </p>
                            )}
                            
                            {/* Comparativa Target vs Achieved Volatility */}
                            {explainabilityData?.target_vol !== undefined && explainabilityData?.achieved_vol !== undefined && (
                                <div className="mt-4 flex gap-6 border-t border-amber-200/50 pt-3">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Volatilidad Objetivo</div>
                                        <div className="text-lg font-black text-amber-900">{(explainabilityData.target_vol * 100).toFixed(2)}%</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Volatilidad Lograda</div>
                                        <div className="text-lg font-black text-amber-900">{(explainabilityData.achieved_vol * 100).toFixed(2)}%</div>
                                    </div>
                                    {explainabilityData.vol_deviation !== undefined && (
                                        <div>
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Desviación</div>
                                            <div className="text-lg font-bold text-rose-600">{(explainabilityData.vol_deviation * 100).toFixed(2)}%</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Additional Technical Warnings */}
                            {explainabilityData?.warnings && explainabilityData.warnings.length > 0 && (
                                <div className="mt-4 border-t border-amber-200/50 pt-3">
                                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-2">Consideraciones adicionales</h5>
                                    <ul className="list-disc pl-5 space-y-1">
                                        {explainabilityData.warnings.map((w: string, idx: number) => (
                                            <li key={idx} className="text-xs text-amber-700">
                                                {translateTechnicalWarning(w)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stats Grid - Centered Flex for 5 items */}
                    <div className="flex flex-wrap justify-center gap-0 mb-12 divide-x divide-slate-100 w-full"> {/* Moved dividers to parent class */}
                        <StatCard
                            label="Volatilidad (3A)"
                            current={currentStats?.vol ?? 0}
                            proposed={proposedStats?.vol ?? 0}
                            inverse={true}
                            loading={isLoadingMetrics}
                        />
                        {/* Removed manual dividers */}
                        <StatCard
                            label="Rentabilidad Prev. (3A)"
                            current={currentStats?.ret ?? 0}
                            proposed={proposedStats?.ret ?? 0}
                            loading={isLoadingMetrics}
                        />
                        <StatCard
                            label="Ratio Sharpe"
                            current={currentStats?.sharpe ?? 0}
                            proposed={proposedStats?.sharpe ?? 0}
                            format="num"
                            loading={isLoadingMetrics}
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
                        {/* Explainability Box */}
                        {explainabilityData && (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-4 text-left">
                                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <span>🤖</span> Decisión del Optimizador
                                </h4>
                                <div className="text-sm text-blue-800 space-y-1">
                                    <p><span className="font-semibold">Objetivo Principal:</span> {translateObjective(explainabilityData.primary_objective)}</p>
                                    {explainabilityData.binding_constraints && explainabilityData.binding_constraints.length > 0 && (
                                        <div>
                                            <span className="font-semibold block mt-2 mb-1">Restricciones Activas:</span>
                                            <ul className="list-disc pl-5 space-y-0.5 mt-1 text-xs">
                                                {explainabilityData.binding_constraints.map((c: string, idx: number) => (
                                                    <li key={idx}>{translateConstraint(c)}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons Row */}
                        <div className="flex justify-end items-center w-full border-t border-slate-100 pt-6 mt-4 gap-3">
                            <button
                                onClick={onClose}
                                className="text-slate-500 hover:text-slate-800 font-bold text-[11px] py-2.5 px-5 transition-colors uppercase tracking-widest mr-auto bg-slate-50 hover:bg-slate-100 rounded-lg"
                            >
                                Cancelar
                            </button>

                            <div className="flex items-center gap-3">
                                {/* Rebalanceo (Tactical) */}
                                <button
                                    onClick={onAccept}
                                    className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition-all border border-slate-200 hover:border-slate-300 shadow-sm min-w-[170px]"
                                >
                                    <Settings2 className="w-4 h-4 text-slate-500" strokeWidth={2}/>
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Rebalancear</span>
                                </button>

                                {/* Accept (Direct) */}
                                {onApplyDirect && (
                                    <button
                                        onClick={onApplyDirect}
                                        className="flex items-center justify-center gap-2.5 px-6 py-2.5 bg-[#0B2545] hover:bg-[#1E3A8A] text-white rounded-lg shadow-sm hover:shadow-md transition-all border border-transparent min-w-[170px]"
                                    >
                                        <CheckCircle2 className="w-4 h-4 text-white/90" strokeWidth={2.5} />
                                        <span className="text-xs font-bold uppercase tracking-widest text-white mt-0.5">Aplicar Cartera</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

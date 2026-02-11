import { useState, useEffect, useMemo } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import CorrelationHeatmap from '../components/charts/CorrelationHeatmap'
import RiskMap from '../components/charts/RiskMap'
import XRayChart from '../components/charts/XRayChart'

import { generateBenchmarkProfiles, getRiskProfileExplanation, EXCLUDED_BENCHMARK_ISINS } from '../utils/benchmarkUtils'
import { Fund, PortfolioItem } from '../types'

interface XRayAnalyticsPageProps {
    portfolio: PortfolioItem[];
    fundDatabase: Fund[];
    totalCapital: number;
    onBack: () => void;
    // Shared State
    metrics: any;
    loading: boolean;
    errorMsg: string | null;
    period: string;
    setPeriod: (p: string) => void;
    benchmarkId: string;
    setBenchmarkId: (b: string) => void;
}

export default function XRayAnalyticsPage({
    portfolio,
    fundDatabase,
    onBack,
    metrics,
    loading,
    errorMsg,
    period,
    setPeriod,
    benchmarkId,
    setBenchmarkId
}: XRayAnalyticsPageProps) {

    // Removed local state and fetching logic since it's now lifted to parent
    const [riskExplanation, setRiskExplanation] = useState('Analizando perfil...')

    // Generate Static Benchmark Profiles (for Risk Map)
    const syntheticProfiles = useMemo(() => {
        if (!fundDatabase || !fundDatabase.length) return [];
        return generateBenchmarkProfiles(fundDatabase);
    }, [fundDatabase]);

    // Dynamic Risk Explanation Update
    useEffect(() => {
        if (metrics?.metrics && metrics?.synthetics) {
            const pVol = metrics.metrics.volatility || 0;
            const pRet = metrics.metrics.cagr || 0;
            const analysis = getRiskProfileExplanation(pVol, pRet, metrics.synthetics);
            if (typeof analysis === 'object' && analysis !== null) {
                setRiskExplanation(analysis.message);
            } else {
                setRiskExplanation(analysis as string);
            }
        }
    }, [metrics, syntheticProfiles]);


    return (
        <div className="h-screen overflow-y-auto bg-[#f8fafc] font-sans text-slate-700">
            {/* PREMIER EDITORIAL HEADER */}
            {/* STANDARD HEADER */}
            <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center justify-between px-6 border-b border-white/10 sticky top-0 z-10 w-full shadow-md">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="text-white/70 hover:text-white transition-colors flex items-center gap-1 text-xs uppercase tracking-widest font-bold"
                    >
                        ← Volver
                    </button>
                    <div className="h-4 w-px bg-white/20 mx-2"></div>
                    <span className="font-light text-xl tracking-tight leading-none">Analítica <span className="font-bold">Avanzada</span></span>
                </div>
            </div>

            <div className="p-12">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] opacity-50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2C3E50] mb-4"></div>
                        <p className="text-xs font-bold text-[#95a5a6] uppercase tracking-widest animate-pulse">Calculando...</p>
                    </div>
                ) : errorMsg ? (
                    <div className="text-center py-20 text-[#95a5a6]">
                        <span className="text-4xl block mb-2">⚠️</span>
                        {errorMsg}
                    </div>
                ) : !metrics ? (
                    <div className="text-center py-20 text-[#95a5a6]">No Data</div>
                ) : (
                    <div className="max-w-[1200px] mx-auto space-y-16">
                        {/* SECTION 1: HISTORICAL */}
                        <div>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Evolución Histórica</h3>
                                <div className="flex gap-2">
                                    <select
                                        value={benchmarkId}
                                        onChange={(e) => setBenchmarkId(e.target.value)}
                                        className="bg-transparent text-[#A07147] text-[10px] font-bold uppercase tracking-widest outline-none border-b border-[#A07147] pb-1 cursor-pointer"
                                    >
                                        <option value="conservative">Conservador</option>
                                        <option value="moderate">Moderado</option>
                                        <option value="balanced">Equilibrado</option>
                                        <option value="dynamic">Dinámico</option>
                                        <option value="aggressive">Agresivo</option>
                                    </select>
                                    <select
                                        value={period}
                                        onChange={(e) => setPeriod(e.target.value)}
                                        className="bg-transparent text-[#A07147] text-[10px] font-bold uppercase tracking-widest outline-none border-b border-[#A07147] pb-1 cursor-pointer"
                                    >
                                        <option value="1y">1 Año</option>
                                        <option value="3y">3 Años</option>
                                        <option value="5y">5 Años</option>
                                    </select>
                                </div>
                            </div>
                            <div className="h-[500px] bg-[#fcfcfc] border border-[#f0f0f0] p-4">
                                <XRayChart
                                    portfolioData={metrics.portfolioSeries}
                                    benchmarkData={metrics?.containerBenchmarkSeries?.[benchmarkId] || metrics?.benchmarkSeries?.[benchmarkId]}
                                    benchmarkLabel={benchmarkId ? benchmarkId.charAt(0).toUpperCase() + benchmarkId.slice(1) : 'Benchmark'}
                                />
                            </div>
                        </div>

                        {/* SECTION 2: MAP & CORRELATION */}
                        {/* SECTION 2: MAP & CORRELATION */}
                        <div className="space-y-16">
                            {/* Risk Map */}
                            <div>
                                <h3 className="text-[#2C3E50] text-3xl font-light mb-6 tracking-tight">Mapa de Riesgo/Retorno</h3>
                                <div className="bg-[#fcfcfc] border border-[#f0f0f0] p-4 relative">
                                    <div className="h-[400px]">
                                        <RiskMap
                                            portfolioMetrics={{
                                                volatility: metrics.metrics?.volatility,
                                                annual_return: metrics.metrics?.cagr
                                            }}
                                            benchmarks={(metrics.synthetics || []).map((s: any) => ({
                                                ...s,
                                                color: s.color || '#95a5a6'
                                            }))}
                                        />
                                    </div>
                                    {riskExplanation && (
                                        <div className="mt-8 pt-4 border-t border-slate-100 text-lg text-[#2C3E50] leading-relaxed">
                                            <div dangerouslySetInnerHTML={{ __html: riskExplanation.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') }} />
                                        </div>
                                    )}
                                </div>
                            </div>



                            {/* Correlation Matrix */}
                            <div>
                                <h3 className="text-[#2C3E50] text-3xl font-light mb-6 tracking-tight">Matriz de Correlación</h3>
                                <div className="h-[700px] bg-[#fcfcfc] border border-[#f0f0f0] p-4 flex items-center justify-center overflow-hidden">
                                    <CorrelationHeatmap
                                        matrix={metrics.correlationMatrix}
                                        assets={(metrics.effectiveISINs || Array.from(new Set(portfolio.map(p => p.isin)))).map((isin: string) => {
                                            const f = portfolio.find(p => p.isin === isin)
                                            return (f ? f.name : isin).substring(0, 15) + '...'
                                        })}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    )
}

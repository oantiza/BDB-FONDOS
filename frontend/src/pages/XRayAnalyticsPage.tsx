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
    totalCapital: number; // Kept for consistency though mostly unneeded for pure charts
    onBack: () => void; // Not used really if new window, but good practice
}

export default function XRayAnalyticsPage({ portfolio, fundDatabase }: XRayAnalyticsPageProps) {

    const [metrics, setMetrics] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [benchmarkId, _setBenchmarkId] = useState('moderate') // Default: Moderate
    const [period, setPeriod] = useState('3y')
    const [riskExplanation, setRiskExplanation] = useState('Analizando perfil...')

    // Generate Static Benchmark Profiles (for Risk Map)
    const syntheticProfiles = useMemo(() => {
        if (!fundDatabase || !fundDatabase.length) return [];
        return generateBenchmarkProfiles(fundDatabase);
    }, [fundDatabase]);

    useEffect(() => {
        runAnalysis()
    }, [period])

    const runAnalysis = async () => {
        setErrorMsg(null)
        if (!portfolio || portfolio.length === 0) {
            setLoading(false)
            setErrorMsg("La cartera está vacía. Añade fondos antes de analizar.")
            return
        }
        setLoading(true)
        try {
            const analyzeFn = httpsCallable(functions, 'backtest_portfolio')
            const res = await analyzeFn({
                portfolio: portfolio.map(p => ({ isin: p.isin, weight: p.weight })),
                period: period,
                benchmarks: EXCLUDED_BENCHMARK_ISINS
            })

            const rawData = res.data as any;
            const syntheticSeries = rawData.benchmarkSeries || {};

            setMetrics({
                ...rawData,
                containerBenchmarkSeries: syntheticSeries
            })

        } catch (error: any) {
            console.error("Error X-Ray Analytics:", error)
            setErrorMsg(error.message || "Error desconocido al contactar el servidor")
        } finally {
            setLoading(false)
        }
    }

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
        <div className="h-screen overflow-y-auto bg-white font-sans text-slate-700">
            {/* PREMIER EDITORIAL HEADER */}
            {/* STANDARD HEADER */}
            <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center justify-between px-6 border-b border-white/10 sticky top-0 z-10 w-full shadow-md">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            window.close();
                            // Fallback if close is blocked
                            if (!window.closed) {
                                window.location.href = '/x-ray';
                            }
                        }}
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
                                        onChange={(e) => _setBenchmarkId(e.target.value)}
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
                                    benchmarkData={metrics.containerBenchmarkSeries?.[benchmarkId]}
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
                                <div className="h-[400px] bg-[#fcfcfc] border border-[#f0f0f0] p-2 relative">
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
                                    {riskExplanation && (
                                        <div className="mt-4 text-xs text-[#7f8c8d] italic leading-relaxed">
                                            <div dangerouslySetInnerHTML={{ __html: riskExplanation }} />
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

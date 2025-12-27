import { useState, useEffect, useMemo } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import CorrelationHeatmap from '../components/charts/CorrelationHeatmap'
import RiskMap from '../components/charts/RiskMap'
import XRayChart from '../components/charts/XRayChart'

import DiversificationDonut from '../components/charts/DiversificationDonut'
import { generateBenchmarkProfiles, getRiskProfileExplanation, EXCLUDED_BENCHMARK_ISINS, BENCHMARK_PROFILES } from '../utils/benchmarkUtils'
import { Fund, PortfolioItem } from '../types'

interface XRayPageProps {
    portfolio: PortfolioItem[];
    fundDatabase: Fund[];
    totalCapital: number;
    onBack: () => void;
}

export default function XRayPage({ portfolio, fundDatabase, totalCapital, onBack }: XRayPageProps) {
    // ... existing state

    // AGGREGATE CATEGORIES FOR DONUT
    const categoryAllocation = useMemo(() => {
        const catMap: Record<string, number> = {};
        portfolio.forEach(p => {
            const cat = p.std_extra?.category || p.std_type || 'Otros';
            // Clean up category names (remove "RV" prefix if redundant or shorten)
            // Keeping raw for now as per user image which has "RV Global", etc.
            catMap[cat] = (catMap[cat] || 0) + p.weight;
        });
        return Object.entries(catMap).map(([name, value]) => ({ name, value }));
    }, [portfolio]);

    // ... existing useEffects

    const [metrics, setMetrics] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [benchmarkId, setBenchmarkId] = useState('moderate') // Default: Moderate
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
            // Request base benchmarks explicitly
            const res = await analyzeFn({
                portfolio: portfolio.map(p => ({ isin: p.isin, weight: p.weight })),
                period: period,
                benchmarks: EXCLUDED_BENCHMARK_ISINS
            })

            const rawData = res.data as any;

            // The backend already calculates the synthetic profiles (conservative, moderate, etc.)
            // So we use them directly.
            const syntheticSeries = rawData.benchmarkSeries || {};

            // Merge everything
            setMetrics({
                ...rawData,
                containerBenchmarkSeries: syntheticSeries
            })

        } catch (error: any) {
            console.error("Error X-Ray:", error)
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
            // Use backend synthetics which are period-specific
            const analysis = getRiskProfileExplanation(pVol, pRet, metrics.synthetics);
            if (typeof analysis === 'object' && analysis !== null) {
                setRiskExplanation(analysis.message);
            } else {
                setRiskExplanation(analysis as string);
            }
        }
    }, [metrics, syntheticProfiles]);


    // Top 10 Aggregated Holdings (from real fund.holdings data)
    const sortedHoldings = useMemo(() => {
        const m = metrics as any;
        // If backend provided topHoldings, use them directly
        if (m?.topHoldings && m.topHoldings.length > 0) {
            return m.topHoldings;
        }

        // Otherwise, aggregate from portfolio funds' real holdings
        const holdingsMap: any = {};

        (portfolio as any[]).forEach(fund => {
            const fundWeight = fund.weight / 100; // Normalize fund weight
            const fundHoldings = fund.holdings || []; // Real holdings array from Firestore

            fundHoldings.forEach((h: any) => {
                const key = h.name;
                const contribution = (h.weight / 100) * fundWeight * 100; // Weighted contribution

                if (holdingsMap[key]) {
                    holdingsMap[key].weight += contribution;
                } else {
                    holdingsMap[key] = {
                        name: h.name,
                        sector: h.sector || 'Unknown',
                        weight: contribution
                    };
                }
            });
        });

        // If no real holdings found, fallback to showing funds themselves
        if (Object.keys(holdingsMap).length === 0) {
            return [...portfolio].sort((a, b) => b.weight - a.weight).slice(0, 10);
        }

        // Sort by weight and take top 10
        return Object.values(holdingsMap)
            .sort((a: any, b: any) => b.weight - a.weight)
            .slice(0, 10);
    }, [metrics, portfolio]);

    return (
        <div className="h-screen flex flex-col bg-white font-sans text-slate-700 overflow-hidden">
            {/* MINIMALIST HEADER (Simplified to match Main Dashboard) */}
            <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center justify-between px-6 z-20 shrink-0 border-b border-white/10 shadow-md">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="text-white/70 hover:text-white transition-colors flex items-center gap-1 text-xs uppercase tracking-widest font-bold"
                    >
                        ← Volver
                    </button>
                    <div className="h-4 w-px bg-white/20 mx-2"></div>
                    <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span></span>

                    {/* ANALYTICS TAB */}
                    <a
                        href="/x-ray/analytics"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-8 text-white/70 hover:text-[#D4AF37] transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-1 group bg-white/5 px-3 py-1 rounded-full border border-white/10 hover:border-white/30"
                    >
                        Gráficos Avanzados <span className="group-hover:translate-x-0.5 transition-transform">↗</span>
                    </a>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white p-12 scrollbar-thin">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-50">
                        <p className="text-xs font-bold text-[#95a5a6] uppercase tracking-widest animate-pulse">Calculando...</p>
                    </div>
                ) : errorMsg ? (
                    <div className="text-center py-20 text-[#95a5a6]">
                        <span className="text-4xl block mb-2">⚠️</span>
                        {errorMsg}
                        <div className="mt-4">
                            <button onClick={onBack} className="text-[#2C3E50] underline text-sm">Volver al Dashboard</button>
                        </div>
                    </div>
                ) : !metrics ? (
                    <div className="text-center py-20 text-[#95a5a6]">
                        Error en el cálculo o sin datos
                    </div>
                ) : (
                    <div className="max-w-[1200px] mx-auto space-y-12 pb-20">

                        {/* SECTION 1: EDITORIAL TABLE (Moved to Top) */}
                        <div>
                            <div className="mb-6 flex justify-between items-end">
                                <h1 className="text-[#2C3E50] text-3xl font-light tracking-tight">Composición de la Cartera</h1>
                                <div className="text-right">
                                    <div className="text-[#2C3E50] font-bold text-3xl tracking-tighter leading-none">{portfolio.length}</div>
                                    <div className="text-[#A07147] text-[10px] uppercase tracking-widest font-bold">Activos</div>
                                </div>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[#eeeeee] h-10">
                                        <th className="py-2 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold w-[40%]">Fondo / Estrategia</th>
                                        <th className="py-2 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold text-right">Peso</th>
                                        <th className="py-2 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold text-right">Capital</th>
                                        <th className="py-2 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold text-right">Riesgo (Vol)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {portfolio.sort((a, b) => b.weight - a.weight).map((fund) => (
                                        <tr key={fund.isin} className="border-b border-[#f8f9f9] last:border-0 hover:bg-[#fcfcfc] transition-colors group">
                                            <td className="py-4 pr-8 align-top">
                                                <div className="text-[#2C3E50] font-bold text-lg leading-tight mb-1">
                                                    {fund.name}
                                                </div>
                                                <div className="text-[#A07147] text-[10px] uppercase tracking-widest font-medium">
                                                    {fund.std_extra?.category || fund.std_type || 'General'}
                                                </div>
                                            </td>
                                            <td className="py-4 align-top text-right text-[#2C3E50] font-medium text-lg tabular-nums">
                                                {fund.weight.toFixed(2)}%
                                            </td>
                                            <td className="py-4 align-top text-right text-[#2C3E50] font-medium text-lg tabular-nums">
                                                {((fund.weight / 100) * totalCapital).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                            </td>
                                            <td className="py-4 align-top text-right text-[#7f8c8d] font-normal text-base tabular-nums">
                                                {(metrics.assets?.[fund.isin]?.volatility !== undefined)
                                                    ? (metrics.assets[fund.isin].volatility * 100).toFixed(2) + '%'
                                                    : (fund.std_perf?.volatility !== undefined)
                                                        ? (fund.std_perf.volatility * 100).toFixed(2) + '%'
                                                        : '-'}
                                            </td>
                                        </tr>
                                    ))}

                                    {/* THICK TOTALS ROW */}
                                    <tr className="border-t-[3px] border-[#2C3E50]">
                                        <td className="py-6 text-xl font-bold text-[#2C3E50] tracking-tight">TOTAL CARTERA</td>
                                        <td className="py-6 text-right font-bold text-[#2C3E50] text-xl tabular-nums">100.00%</td>
                                        <td className="py-6 text-right font-bold text-[#2C3E50] text-xl tabular-nums">
                                            {totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                        </td>
                                        <td className="py-6"></td> {/* EMPTY VOLATILITY CELL AS REQUESTED */}
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* SECTION 2: METRICS GRID (Moved Below) */}
                        <div>
                            <div className="mb-6 border-t border-[#eeeeee] pt-12">
                                <h2 className="text-[#2C3E50] text-3xl font-light tracking-tight">Métricas de Cartera</h2>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-8 pb-4">
                                <MetricCard label="Rentabilidad (CAGR)" value={metrics.metrics?.cagr} fmt="%" color="text-[#2C3E50]" />
                                <MetricCard label="Volatilidad" value={metrics.metrics?.volatility} fmt="%" color="text-[#2C3E50]" />
                                <MetricCard label="Ratio Sharpe" value={metrics.metrics?.sharpe} fmt="num" color="text-[#2C3E50]" />
                                <MetricCard label="Max Drawdown" value={metrics.metrics?.maxDrawdown} fmt="%" color="text-[#C0392B]" />
                                <MetricCard label="Tasa Libre Riesgo" value={metrics.metrics?.rf_rate} fmt="%" color="text-[#7f8c8d]" />
                                <MetricCard label="Diversificación" value={metrics.metrics?.diversificationScore} fmt="num" color="text-[#2C3E50]" />
                            </div>
                        </div>

                        {/* SECTION 2b: TOP 10 HOLDINGS & DIVERSIFICATION (Side-by-Side) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-16 lg:gap-x-0 border-t border-[#eeeeee] pt-12">

                            {/* LEFT COL: Top 10 Holdings */}
                            {sortedHoldings && sortedHoldings.length > 0 && (
                                <div className="lg:pr-12">
                                    <div className="flex items-center gap-4 mb-6">
                                        <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">10 Principales Posiciones</h3>
                                        <span className="text-[#A07147] text-[10px] uppercase tracking-[0.2em] font-bold">Agregadas</span>
                                    </div>

                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-[#eeeeee] h-10">
                                                <th className="py-2 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold w-[60%]">Activo / Sector</th>
                                                <th className="py-2 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold text-right">Peso</th>
                                                <th className="py-2 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold text-right">Contribución</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedHoldings.map((holding: any, idx: number) => (
                                                <tr key={idx} className="border-b border-[#f8f9f9] last:border-0 hover:bg-[#fcfcfc] transition-colors group">
                                                    <td className="py-3 pr-8 align-top">
                                                        <div className="text-[#2C3E50] font-bold text-base leading-tight mb-1">
                                                            {holding.name || holding.isin}
                                                        </div>
                                                        <div className="text-[#A07147] text-[10px] uppercase tracking-widest font-medium">
                                                            {holding.sector || holding.std_type || 'General'}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 align-top text-right text-[#2C3E50] font-bold text-base tabular-nums">
                                                        {holding.weight.toFixed(2)}%
                                                    </td>
                                                    <td className="py-3 align-top text-right text-[#7f8c8d] font-normal text-sm tabular-nums">
                                                        {((holding.weight / 100) * totalCapital).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* THICK TOTALS ROW FOR TOP 10 */}
                                            <tr className="border-t-[3px] border-[#2C3E50]">
                                                <td className="py-4 text-sm font-bold text-[#2C3E50] tracking-tight text-right w-full pr-4" colSpan={1}>TOP 10 TOTAL</td>
                                                <td className="py-4 text-right font-bold text-[#2C3E50] text-base tabular-nums">
                                                    {sortedHoldings.reduce((acc: number, h: any) => acc + h.weight, 0).toFixed(2)}%
                                                </td>
                                                <td className="py-4"></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* RIGHT COL: Diversification Chart */}
                            <div className="h-full flex flex-col lg:pl-12 lg:border-l lg:border-[#eeeeee]">
                                <div className="flex items-center gap-4 mb-6">
                                    <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Diversificación</h3>
                                    <span className="text-[#A07147] text-[10px] uppercase tracking-[0.2em] font-bold">Por Categorías</span>
                                </div>
                                <div className="flex-1 flex items-center justify-center">
                                    <DiversificationDonut assets={categoryAllocation} />
                                </div>
                            </div>
                        </div>


                        {/* SECTION 3 & 4 MOVED TO ANALYTICS PAGE */}

                    </div >
                )
                }
            </div >
        </div >
    )
}

function MetricCard({ label, value, fmt, color = "text-[#2C3E50]" }: any) {
    let display = '-'
    if (value !== undefined && value !== null) {
        if (fmt === '%') display = (value * 100).toFixed(2) + '%'
        else display = value.toFixed(2)
    }
    return (
        <div className="text-center group cursor-default">
            <div className="text-[10px] uppercase font-bold text-[#A07147] tracking-[0.2em] mb-2 leading-tight opacity-80 group-hover:opacity-100 transition-opacity">{label}</div>
            <div className={`text-4xl font-light ${color} tracking-tighter`}>{display}</div>
        </div>
    )
}

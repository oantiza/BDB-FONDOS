import { useState, useEffect, useMemo } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'
import CorrelationHeatmap from '../charts/CorrelationHeatmap'
import RiskMap from '../charts/RiskMap'
import XRayChart from '../charts/XRayChart'
import { generateBenchmarkProfiles, generateSyntheticSeries, getRiskProfileExplanation, EXCLUDED_BENCHMARK_ISINS } from '../../utils/benchmarkUtils'

export default function AnalysisModal({ portfolio, fundDatabase, onClose }) {
    const [metrics, setMetrics] = useState(null)
    const [loading, setLoading] = useState(true)
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
        if (!portfolio || portfolio.length === 0) {
            setLoading(false)
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

            const rawData = res.data;

            // The backend already calculates the synthetic profiles (conservative, moderate, etc.)
            // So we use them directly.
            const syntheticSeries = rawData.benchmarkSeries || {};

            // Merge everything
            setMetrics({
                ...rawData,
                containerBenchmarkSeries: syntheticSeries
            })

        } catch (error) {
            console.error("Error X-Ray:", error)
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
            setRiskExplanation(analysis.message);
        }
    }, [metrics, syntheticProfiles]);


    // Top 10 Aggregated Holdings (from real fund.holdings data)
    const sortedHoldings = useMemo(() => {
        // If backend provided topHoldings, use them directly
        if (metrics?.topHoldings && metrics.topHoldings.length > 0) {
            return metrics.topHoldings;
        }

        // Otherwise, aggregate from portfolio funds' real holdings
        const holdingsMap = {};

        portfolio.forEach(fund => {
            const fundWeight = fund.weight / 100; // Normalize fund weight
            const fundHoldings = fund.holdings || []; // Real holdings array from Firestore

            fundHoldings.forEach(h => {
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
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 10);
    }, [metrics, portfolio]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 font-sans text-slate-700">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-2 border-b flex justify-between items-center bg-white text-brand shrink-0">
                    <h2 className="text-xs font-bold flex items-center gap-2 text-[#0B2545] uppercase tracking-wider">
                        🔍 X-RAY Report
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-4xl leading-none">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 p-6 scrollbar-thin">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-50">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#0B2545] mb-4"></div>
                            <p className="text-sm font-bold text-slate-500 animate-pulse">Computing Quantum Analytics...</p>
                        </div>
                    ) : !metrics ? (
                        <div className="text-center py-20 text-slate-400">
                            <span className="text-4xl block mb-2">⚠️</span>
                            Calculation Failed or No Data
                        </div>
                    ) : (
                        <div className="space-y-6">

                            {/* 1. CHART AREA */}
                            <div className="bg-slate-50 p-2 rounded border border-slate-200 h-80 flex flex-col">
                                <div className="flex justify-end gap-2 mb-2 px-2">
                                    <select
                                        value={period}
                                        onChange={(e) => setPeriod(e.target.value)}
                                        className="bg-white border border-slate-200 text-[#0B2545] text-[10px] font-bold rounded px-2 py-1 outline-none uppercase"
                                    >
                                        <option value="1y">1 Year</option>
                                        <option value="3y">3 Years</option>
                                        <option value="5y">5 Years</option>
                                    </select>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 self-center">VS</span>
                                    <select
                                        value={benchmarkId}
                                        onChange={(e) => setBenchmarkId(e.target.value)}
                                        className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-bold rounded px-2 py-1 outline-none uppercase focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">Select Benchmark</option>
                                        <option value="conservative">Conservative (100% FI)</option>
                                        <option value="moderate">Moderate (25/75)</option>
                                        <option value="dynamic">Dynamic (75/25)</option>
                                        <option value="aggressive">Aggressive (100% Eq)</option>
                                    </select>
                                </div>
                                <div className="flex-1 relative w-full min-h-0 bg-white border border-slate-100 rounded">
                                    <XRayChart
                                        portfolioData={metrics.portfolioSeries}
                                        benchmarkData={metrics.containerBenchmarkSeries?.[benchmarkId]}
                                        benchmarkLabel={benchmarkId ? benchmarkId.charAt(0).toUpperCase() + benchmarkId.slice(1) : ''}
                                    />
                                </div>
                            </div>

                            {/* 2. METRICS GRID (Below Chart) */}
                            <div className="grid grid-cols-4 gap-4">
                                <MetricCard label="CAGR 3Y" value={metrics.metrics?.cagr} fmt="%" color="text-[#0B2545]" />
                                <MetricCard label="Volatility" value={metrics.metrics?.volatility} fmt="%" color="text-[#0B2545]" />
                                <MetricCard label="Sharpe" value={metrics.metrics?.sharpe} fmt="num" color="text-[#D4AF37]" />
                                <MetricCard label="Max Drawdown" value={metrics.metrics?.maxDrawdown} fmt="%" color="text-rose-500" />
                            </div>

                            {/* 3. TOP HOLDINGS */}
                            <div className="bg-white rounded border border-slate-200 p-4">
                                <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">Top 10 Aggregated Holdings</h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    {sortedHoldings.map((h, i) => (
                                        <div key={i} className="bg-slate-50 p-2 rounded border border-slate-100 hover:bg-white transition-colors">
                                            <div className="text-xs font-bold text-[#0B2545] truncate" title={h.name}>{h.name}</div>
                                            <div className="flex justify-between items-end mt-1 border-t border-slate-200 pt-1">
                                                <span className="text-[10px] text-slate-400">Asset</span>
                                                <span className="text-sm font-mono font-black text-slate-700">{(h.weight).toFixed(2)}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 4. RISK MAP (2/3) + EXPLANATION (1/3) */}
                            <div className="flex flex-col md:flex-row gap-4 h-80">
                                <div className="w-full md:w-2/3 bg-slate-50 rounded border border-slate-200 p-2 relative flex flex-col">
                                    <RiskMap
                                        portfolioMetrics={{
                                            volatility: metrics.metrics?.volatility,
                                            annual_return: metrics.metrics?.cagr
                                        }}
                                        benchmarks={(metrics.synthetics || []).map(s => ({
                                            ...s,
                                            color: s.name.includes('Conservador') ? '#10B981' :
                                                s.name.includes('Moderado') ? '#3B82F6' :
                                                    s.name.includes('inámico') ? '#F59E0B' :
                                                        s.name.includes('Agresivo') ? '#EF4444' : '#94a3b8'
                                        }))}
                                    />
                                </div>
                                <div className="w-full md:w-1/3 bg-indigo-50/50 rounded border border-indigo-100 p-5 flex flex-col justify-center">
                                    <h4 className="font-bold text-[#0B2545] mb-2 flex items-center gap-2 text-base">
                                        <svg className="w-6 h-6 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Risk/Return Profile
                                    </h4>
                                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                                        This map compares your portfolio's efficiency against standard model profiles.
                                    </p>
                                    <ul className="text-sm space-y-2 text-slate-500 mb-2">
                                        <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#10B981]"></div> Conservador (Low Risk)</li>
                                        <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#EF4444]"></div> Agresivo (High Risk)</li>
                                        <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#0B2545]"></div> <b>Your Portfolio</b></li>
                                    </ul>
                                    <div className="mt-auto text-xs font-mono p-3 bg-white rounded border border-indigo-100 text-indigo-800 leading-snug"
                                        dangerouslySetInnerHTML={{ __html: riskExplanation }}
                                    />
                                </div>
                            </div>

                            {/* 5. CORRELATION */}
                            <div className="bg-white rounded border border-slate-200 p-4">
                                <h4 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">Correlation Matrix</h4>
                                <div className="w-full overflow-hidden min-h-[250px]">
                                    <CorrelationHeatmap
                                        matrix={metrics.correlationMatrix}
                                        assets={(metrics.effectiveISINs || Array.from(new Set(portfolio.map(p => p.isin)))).map(isin => {
                                            const f = portfolio.find(p => p.isin === isin)
                                            return (f ? f.name : isin).substring(0, 15) + '...'
                                        })}
                                    />
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function MetricCard({ label, value, fmt, color }) {
    let display = '-'
    if (value !== undefined && value !== null) {
        if (fmt === '%') display = (value * 100).toFixed(2) + '%'
        else display = value.toFixed(2)
    }
    return (
        <div className="bg-slate-50 p-3 rounded border border-slate-200 text-center">
            <div className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">{label}</div>
            <div className={`text-2xl font-mono font-bold ${color}`}>{display}</div>
        </div>
    )
}

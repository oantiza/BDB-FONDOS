import React, { useState, useEffect, useMemo } from 'react';
import { PortfolioItem } from '../../types';
import { useSavedPortfolios } from '../../hooks/useSavedPortfolios';
import ComparatorControlDeck from './ComparatorControlDeck';
import ComparatorRiskMap from './ComparatorRiskMap';
import ComparatorGroupedBarChart from './ComparatorGroupedBarChart';
import { getDashboardAnalytics } from '../../engine/portfolioAnalyticsEngine';
import { usePortfolioStats } from '../../hooks/usePortfolioStats';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { generateComparatorPDF } from '../../utils/comparatorPdfGenerator';
import { Download } from 'lucide-react';

const REGION_LABELS: Record<string, string> = {
    'united_states': 'Estados Unidos',
    'canada': 'Canadá',
    'latin_america': 'Latinoamérica',
    'united_kingdom': 'Reino Unido',
    'eurozone': 'Eurozona',
    'europe_ex_euro': 'Europa (ex-Euro)',
    'europe_emerging': 'Europa Emergente',
    'africa': 'África',
    'middle_east': 'Oriente Medio',
    'japan': 'Japón',
    'australasia': 'Australasia',
    'asia_developed': 'Asia Desarrollada',
    'asia_emerging': 'Asia Emergente',
    'other': 'Otros',
    'others': 'Otros'
};

export default function PortfolioComparator() {
    const [portfolioA, setPortfolioA] = useState<PortfolioItem[] | null>(null);
    const [portfolioB, setPortfolioB] = useState<PortfolioItem[] | null>(null);

    // UI selections (persist names for display)
    const [nameA, setNameA] = useState<string>('');
    const [nameB, setNameB] = useState<string>('');

    // Analytics State
    const [metricsA, setMetricsA] = useState<any>(null);
    const [metricsB, setMetricsB] = useState<any>(null);
    const [historyA, setHistoryA] = useState<any[]>([]);
    const [historyB, setHistoryB] = useState<any[]>([]);
    const [loadingA, setLoadingA] = useState(false);
    const [loadingB, setLoadingB] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Chart Options
    const [chartPeriod, setChartPeriod] = useState<3 | 5 | 10>(5);

    // Fetch Logic
    useEffect(() => {
        if (!portfolioA) {
            setMetricsA(null);
            setHistoryA([]);
            return;
        }
        setLoadingA(true);
        getDashboardAnalytics(portfolioA, { include1y: true }).then(res => {
            setMetricsA(res);
            setHistoryA(res.series10y || res.series5y || []);
        }).finally(() => setLoadingA(false));
    }, [portfolioA]);

    useEffect(() => {
        if (!portfolioB) {
            setMetricsB(null);
            setHistoryB([]);
            return;
        }
        setLoadingB(true);
        getDashboardAnalytics(portfolioB, { include1y: true }).then(res => {
            setMetricsB(res);
            setHistoryB(res.series10y || res.series5y || []);
        }).finally(() => setLoadingB(false));
    }, [portfolioB]);

    // Derived Stats
    const statsA = usePortfolioStats({
        portfolio: portfolioA || [],
        metrics: {
            ...metricsA?.metrics3y,
            regionAllocation: metricsA?.raw?.r3y?.regionAllocation
        }
    });

    const statsB = usePortfolioStats({
        portfolio: portfolioB || [],
        metrics: {
            ...metricsB?.metrics3y,
            regionAllocation: metricsB?.raw?.r3y?.regionAllocation
        }
    });

    // Chart Data Preparation
    const chartData = useMemo(() => {
        if (!historyA.length && !historyB.length) return [];

        // 1. Determine cutoff date
        const cutoff = new Date();
        cutoff.setFullYear(cutoff.getFullYear() - chartPeriod);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        // 2. Filter and Map
        const map = new Map<string, any>();

        // Helper to process history
        const processHistory = (hist: any[], key: 'valA' | 'valB') => {
            hist.forEach((pt: any) => {
                const d = pt.x.split('T')[0];
                if (d >= cutoffStr) {
                    if (!map.has(d)) map.set(d, { date: d });
                    map.get(d)[key] = pt.y;
                }
            });
        };

        processHistory(historyA, 'valA');
        processHistory(historyB, 'valB');

        let data = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

        // 3. Rebase to 100
        if (data.length > 0) {
            // Find first valid value for A and B
            const firstA = data.find(p => p.valA !== undefined)?.valA;
            const firstB = data.find(p => p.valB !== undefined)?.valB;

            data = data.map(p => ({
                ...p,
                valA: (p.valA !== undefined && firstA) ? (p.valA / firstA) * 100 : p.valA,
                valB: (p.valB !== undefined && firstB) ? (p.valB / firstB) * 100 : p.valB,
            }));
        }

        return data;
    }, [historyA, historyB, chartPeriod]);

    const formatPct = (val: number | undefined) => val !== undefined ? (val * 100).toFixed(2) + '%' : '-';

    const renderMetricRow = (label: string, valA: any, valB: any, format: (v: any) => string = String, better: 'high' | 'low' = 'high', index: number) => {
        const isNumber = typeof valA === 'number' && typeof valB === 'number';
        const diff = isNumber ? valA - valB : 0;

        let isBetterA = false;
        let isBetterB = false;

        if (isNumber) {
            if (better === 'high') {
                isBetterA = valA > valB;
                isBetterB = valB > valA;
            } else {
                isBetterA = valA < valB;
                isBetterB = valB < valA;
            }
        }

        // Calculate visual delta
        const deltaVal = Math.abs(diff);
        // For risk metrics (volatility, drawstring), a lower value is better, but we still want to show the difference
        const percentBetter = isNumber && (valA !== 0 || valB !== 0)
            ? Math.abs(diff / (isBetterA ? valB : valA)) // Improvement relative to the worse one
            : 0;

        const deltaText = isNumber ? (better === 'high' || label.includes('Sharpe') ? '+' : '') + format(diff).replace('%', '') : '-';

        // Color logic
        const colorA = isBetterA ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100' : 'text-slate-600';
        const colorB = isBetterB ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100' : 'text-slate-600';

        return (
            <div className={`flex items-center py-3 border-b border-slate-50 last:border-0 px-3 rounded-lg transition-colors group hover:bg-slate-50 ${index % 2 === 1 ? 'bg-slate-50' : ''}`}>
                <span className="text-slate-500 font-medium w-4/12 truncate text-sm" title={label}>{label}</span>

                {/* Val A */}
                <div className="w-3/12 text-center">
                    <span className={`font-mono font-bold text-sm ${colorA}`}>{format(valA)}</span>
                </div>

                {/* VS / Delta - ENHANCED */}
                <div className="w-2/12 flex flex-col items-center justify-center">
                    {isNumber && deltaVal > 0.0001 ? (
                        <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border ${isBetterA ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>
                            {isBetterA ? '◄' : ''}
                            {format(deltaVal).replace('-', '')}
                            {isBetterB ? '►' : ''}
                        </div>
                    ) : (
                        <div className="h-1 w-4 bg-slate-200 rounded-full"></div>
                    )}
                </div>

                {/* Val B */}
                <div className="w-3/12 text-center">
                    <span className={`font-mono font-bold text-sm ${colorB}`}>{format(valB)}</span>
                </div>
            </div>
        );
    };



    const handleDownloadPDF = async () => {

        if (!nameA || !nameB) return;
        setGeneratingPdf(true);
        try {
            await generateComparatorPDF(nameA, nameB, metricsA, metricsB, {
                chart: 'comparator-chart',
                riskMap: 'comparator-risk-map'
            });
        } catch (e) {
            console.error(e);
        } finally {
            setGeneratingPdf(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <ComparatorControlDeck
                nameA={nameA}
                nameB={nameB}
                portfolioA={portfolioA}
                portfolioB={portfolioB}
                loadingA={loadingA}
                loadingB={loadingB}
                onSelectA={(p) => { setPortfolioA(p.items); setNameA(p.name); }}
                onSelectB={(p) => { setPortfolioB(p.items); setNameB(p.name); }}
                onRemoveA={() => { setPortfolioA(null); setNameA(''); }}
                onRemoveB={() => { setPortfolioB(null); setNameB(''); }}
                onDownloadPDF={handleDownloadPDF}
                generatingPdf={generatingPdf}
            />

            {/* COMPARISON CONTENT */}
            {portfolioA && portfolioB ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* 1. CHARTS ROW (History + Risk Map) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                        {/* HISTORICAL EVOLUTION */}
                        <div id="comparator-chart" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[480px] flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-[#0B2545]">Evolución Histórica (Base 100)</h3>
                                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                    {[3, 5, 10].map((y) => (
                                        <button
                                            key={y}
                                            onClick={() => setChartPeriod(y as any)}
                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${chartPeriod === y ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            {y}Y
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="w-full h-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(date) => new Date(date).getFullYear().toString()}
                                            tick={{ fontSize: 12, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                            minTickGap={30}
                                        />
                                        <YAxis
                                            domain={['auto', 'auto']}
                                            tick={{ fontSize: 12, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ color: '#64748b', marginBottom: '0.25rem', fontSize: '0.75rem' }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                                        <Line type="monotone" dataKey="valA" name={nameA || 'Cartera A'} stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                                        <Line type="monotone" dataKey="valB" name={nameB || 'Cartera B'} stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* RISK/RETURN MAP */}
                        <div id="comparator-risk-map" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[480px] flex flex-col">
                            <h3 className="text-lg font-bold text-[#0B2545] mb-4">Mapa Riesgo / Retorno (3 Años)</h3>
                            <div className="h-[410px] flex-1 w-full min-h-0">
                                <ComparatorRiskMap
                                    metricsA={metricsA?.metrics3y}
                                    metricsB={metricsB?.metrics3y}
                                    nameA={nameA}
                                    nameB={nameB}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. METRICS GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Performance */}
                        <div id="comparator-metrics" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">
                            <h3 className="text-lg font-bold text-[#0B2545] mb-4 border-b pb-2 flex items-center gap-2">🚀 Rendimiento y Riesgo</h3>
                            {/* HEADERS */}
                            <div className="flex justify-between items-center py-2 px-3 border-b-2 border-slate-100 mb-2 bg-slate-50 rounded-t-lg">
                                <span className="w-4/12 text-xs font-bold text-slate-400 uppercase tracking-wider">Métrica</span>
                                <span className="w-3/12 text-center font-bold text-blue-600 text-xs uppercase tracking-wider truncate px-1">{nameA}</span>
                                <span className="w-2/12 text-center font-bold text-slate-400 text-[10px] uppercase tracking-wider">Delta</span>
                                <span className="w-3/12 text-center font-bold text-amber-600 text-xs uppercase tracking-wider truncate px-1">{nameB}</span>
                            </div>

                            {/* Rentabilidad Section */}
                            <div className="mb-6 space-y-1">
                                <div className="px-2 py-1">
                                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                                        Rentabilidad
                                    </h4>
                                </div>
                                {renderMetricRow("1 Año", metricsA?.metrics1y?.cagr, metricsB?.metrics1y?.cagr, formatPct, 'high', 0)}
                                {renderMetricRow("3 Años (Anual)", metricsA?.metrics3y?.cagr, metricsB?.metrics3y?.cagr, formatPct, 'high', 1)}
                                {renderMetricRow("5 Años (Anual)", metricsA?.metrics5y?.cagr, metricsB?.metrics5y?.cagr, formatPct, 'high', 2)}
                            </div>

                            {/* Riesgo Section */}
                            <div className="space-y-1">
                                <div className="px-2 py-1 mt-4">
                                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-1 h-3 bg-red-500 rounded-full"></span>
                                        Riesgo (3A)
                                    </h4>
                                </div>
                                {renderMetricRow("Volatilidad", metricsA?.metrics3y?.volatility, metricsB?.metrics3y?.volatility, formatPct, 'low', 0)}
                                {renderMetricRow("Ratio Sharpe", metricsA?.metrics3y?.sharpe, metricsB?.metrics3y?.sharpe, (v) => typeof v === 'number' ? v.toFixed(2) : '-', 'high', 1)}
                                {renderMetricRow("Max Drawdown", metricsA?.metrics3y?.maxDrawdown, metricsB?.metrics3y?.maxDrawdown, formatPct, 'high', 2)}
                            </div>
                        </div>

                        {/* Allocation */}
                        <div id="comparator-allocation" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
                            <h3 className="text-lg font-bold text-[#0B2545] mb-4 border-b pb-2 flex items-center gap-2">📊 Asignación de Activos</h3>

                            {/* HEADERS */}
                            <div className="flex justify-between items-center py-2 px-2 border-b-2 border-slate-100 mb-4">
                                <span className="w-5/12 text-xs font-bold text-blue-600 uppercase tracking-wider text-left pl-2 truncate" title={nameA}>{nameA || 'Cartera A'} (Izq)</span>
                                <span className="w-2/12 text-center font-bold text-slate-300 text-xs uppercase tracking-wider">vs</span>
                                <span className="w-5/12 text-xs font-bold text-amber-600 uppercase tracking-wider text-right pr-2 truncate" title={nameB}>{nameB || 'Cartera B'} (Der)</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                                <div className="h-full min-h-[250px] border-r border-slate-100 pr-2">
                                    <ComparatorGroupedBarChart
                                        title="Por Categoría"
                                        dataA={statsA.categoryAllocation.map((c: any) => ({ ...c, label: c.name }))}
                                        dataB={statsB.categoryAllocation.map((c: any) => ({ ...c, label: c.name }))}
                                        portfolioNameA={nameA || 'Cartera A'}
                                        portfolioNameB={nameB || 'Cartera B'}
                                    />
                                </div>

                                <div className="h-full min-h-[250px] pl-2">
                                    <ComparatorGroupedBarChart
                                        title="Por Región"
                                        dataA={statsA.regionAllocation.map((r: any) => ({ name: r.name, value: r.value, label: REGION_LABELS[r.name] || r.name }))}
                                        dataB={statsB.regionAllocation.map((r: any) => ({ name: r.name, value: r.value, label: REGION_LABELS[r.name] || r.name }))}
                                        portfolioNameA={nameA || 'Cartera A'}
                                        portfolioNameB={nameB || 'Cartera B'}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-slate-400 gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">⚖️</div>
                    <p className="text-lg">Selecciona ambas carteras arriba para ver la comparativa detallada.</p>
                </div>
            )}
        </div>
    );
}

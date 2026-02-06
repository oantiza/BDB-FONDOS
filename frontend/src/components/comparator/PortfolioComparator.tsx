import React, { useState, useEffect, useMemo } from 'react';
import { PortfolioItem } from '../../types';
import { useSavedPortfolios } from '../../hooks/useSavedPortfolios';
import ComparisonSelector from './ComparisonSelector';
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

    const renderMetricRow = (label: string, valA: any, valB: any, format: (v: any) => string = String, better: 'high' | 'low' = 'high') => {
        const isBetterA = typeof valA === 'number' && typeof valB === 'number' ? (better === 'high' ? valA > valB : valA < valB) : false;
        const isBetterB = typeof valA === 'number' && typeof valB === 'number' ? (better === 'high' ? valB > valA : valB < valA) : false;

        return (
            <div className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-2 rounded transition-colors">
                <span className="text-slate-500 font-medium w-1/3">{label}</span>
                <span className={`font-mono font-bold w-1/4 text-center ${isBetterA ? 'text-emerald-600' : 'text-slate-700'}`}>{format(valA)}</span>
                <div className="text-xs text-slate-300">vs</div>
                <span className={`font-mono font-bold w-1/4 text-center ${isBetterB ? 'text-emerald-600' : 'text-slate-700'}`}>{format(valB)}</span>
            </div>
        );
    };

    const handleDownloadPDF = async () => {
        if (!nameA || !nameB) return;
        setGeneratingPdf(true);
        try {
            await generateComparatorPDF(nameA, nameB, {
                chart: 'comparator-chart',
                metrics: 'comparator-metrics',
                allocation: 'comparator-allocation'
            });
        } catch (e) {
            console.error(e);
        } finally {
            setGeneratingPdf(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <header className="mb-5 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        <span className="text-amber-500 text-3xl">★</span>
                        Comparador de <span className="text-[#003399]">Carteras</span>
                    </h1>
                    <p className="text-slate-500 mt-1 text-base font-light ml-11">
                        Selecciona dos carteras de tus guardadas para analizar sus diferencias en rendimiento, riesgo y composición.
                    </p>
                </div>
                {portfolioA && portfolioB && (
                    <button
                        onClick={handleDownloadPDF}
                        disabled={generatingPdf}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all font-medium text-sm shadow-sm disabled:opacity-50"
                    >
                        {generatingPdf ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-500 border-t-transparent"></div>
                                Generando PDF...
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Descargar Informe PDF
                            </>
                        )}
                    </button>
                )}
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                {/* SELECTOR A */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-blue-200 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-[#0B2545] flex items-center gap-2">
                                <span className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">A</span>
                                {nameA || 'Cartera A'}
                            </h2>
                            {portfolioA && (
                                <span className="ml-2 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {portfolioA.length} Activos
                                </span>
                            )}
                        </div>
                        {portfolioA && <button onClick={() => { setPortfolioA(null); setNameA(''); }} className="text-xs text-red-500 hover:underline">Quitar</button>}
                    </div>

                    {!portfolioA ? (
                        <ComparisonSelector
                            label="Seleccionar de Mis Carteras"
                            onSelect={(p) => { setPortfolioA(p.items); setNameA(p.name); }}
                        />
                    ) : (
                        <div className="flex-1">
                            {loadingA && <div className="text-sm text-blue-500 animate-pulse mt-2">Analizando...</div>}
                        </div>
                    )}
                </div>

                {/* SELECTOR B */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:border-amber-200 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-[#0B2545] flex items-center gap-2">
                                <span className="bg-amber-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">B</span>
                                {nameB || 'Cartera B'}
                            </h2>
                            {portfolioB && (
                                <span className="ml-2 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {portfolioB.length} Activos
                                </span>
                            )}
                        </div>
                        {portfolioB && <button onClick={() => { setPortfolioB(null); setNameB(''); }} className="text-xs text-red-500 hover:underline">Quitar</button>}
                    </div>

                    {!portfolioB ? (
                        <ComparisonSelector
                            label="Seleccionar de Mis Carteras"
                            onSelect={(p) => { setPortfolioB(p.items); setNameB(p.name); }}
                        />
                    ) : (
                        <div className="flex-1">
                            {loadingB && <div className="text-sm text-amber-500 animate-pulse mt-2">Analizando...</div>}
                        </div>
                    )}
                </div>
            </div>

            {/* COMPARISON CONTENT */}
            {portfolioA && portfolioB ? (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* 1. CHART */}
                    <div id="comparator-chart" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-[350px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-[#0B2545]">Evolución Histórica Comparada (Base 100)</h3>
                            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                {[3, 5, 10].map((y) => (
                                    <button
                                        key={y}
                                        onClick={() => setChartPeriod(y as any)}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition ${chartPeriod === y ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        {y} Años
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="w-full h-[350px]">
                            <ResponsiveContainer width="99%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => new Date(val).getFullYear().toString()} minTickGap={50} />
                                    <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend />
                                    <Line type="monotone" dataKey="valA" name={nameA || 'Cartera A'} stroke="#2563eb" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="valB" name={nameB || 'Cartera B'} stroke="#f59e0b" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. METRICS GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Performance */}
                        <div id="comparator-metrics" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-[#0B2545] mb-4 border-b pb-2 flex items-center gap-2">🚀 Rendimiento y Riesgo</h3>
                            {/* HEADERS */}
                            <div className="flex justify-between items-center py-2 px-2 border-b-2 border-slate-100 mb-2">
                                <span className="w-1/3"></span>
                                <span className="w-1/4 text-center font-bold text-blue-600 text-xs uppercase tracking-wider truncate px-1">{nameA}</span>
                                <div className="text-xs text-transparent select-none">vs</div>
                                <span className="w-1/4 text-center font-bold text-amber-600 text-xs uppercase tracking-wider truncate px-1">{nameB}</span>
                            </div>

                            {renderMetricRow("Rentabilidad 1 año", metricsA?.metrics1y?.cagr, metricsB?.metrics1y?.cagr, formatPct)}
                            {renderMetricRow("Rentabilidad 3 años (Anual)", metricsA?.metrics3y?.cagr, metricsB?.metrics3y?.cagr, formatPct)}
                            {renderMetricRow("Rentabilidad 5 años (Anual)", metricsA?.metrics5y?.cagr, metricsB?.metrics5y?.cagr, formatPct)}
                            {renderMetricRow("Volatilidad (3A)", metricsA?.metrics3y?.volatility, metricsB?.metrics3y?.volatility, formatPct, 'low')}
                            {renderMetricRow("Ratio de Sharpe", metricsA?.metrics3y?.sharpe, metricsB?.metrics3y?.sharpe, (v) => typeof v === 'number' ? v.toFixed(2) : '-')}
                            {renderMetricRow("Max. Drawdown", metricsA?.metrics3y?.maxDrawdown, metricsB?.metrics3y?.maxDrawdown, formatPct, 'high')}
                        </div>

                        {/* Allocation */}
                        <div id="comparator-allocation" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-[#0B2545] mb-4 border-b pb-2 flex items-center gap-2">📊 Asignación de Activos</h3>

                            {/* HEADERS */}
                            <div className="flex justify-between items-center py-2 px-2 border-b-2 border-slate-100 mb-4">
                                <span className="w-1/3 text-xs font-bold text-slate-400 uppercase tracking-wider">Desglose</span>
                                <span className="w-1/3 text-center font-bold text-blue-600 text-xs uppercase tracking-wider truncate px-1">{nameA}</span>
                                <div className="text-xs text-transparent select-none">vs</div>
                                <span className="w-1/3 text-center font-bold text-amber-600 text-xs uppercase tracking-wider truncate px-1">{nameB}</span>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 mb-2">Por Categoría</h4>
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            {statsA.categoryAllocation.slice(0, 3).map((c: any) => (
                                                <div key={c.name} className="flex justify-between text-sm py-0.5 border-b border-slate-50">
                                                    <span className="truncate pr-2" title={c.name}>{c.name}</span>
                                                    <span className="font-mono">{c.value.toFixed(1)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="w-px bg-slate-100 self-stretch"></div>
                                        <div className="flex-1">
                                            {statsB.categoryAllocation.slice(0, 3).map((c: any) => (
                                                <div key={c.name} className="flex justify-between text-sm py-0.5 border-b border-slate-50">
                                                    <span className="truncate pr-2" title={c.name}>{c.name}</span>
                                                    <span className="font-mono">{c.value.toFixed(1)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold text-slate-500 mb-2">Top Regiones</h4>
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            {statsA.regionAllocation.slice(0, 3).map((c: any) => {
                                                const label = REGION_LABELS[c.name] || c.name.replace(/_/g, ' ');
                                                return (
                                                    <div key={c.name} className="flex justify-between text-sm py-0.5 border-b border-slate-50">
                                                        <span className="truncate pr-2 capitalize" title={label}>{label}</span>
                                                        <span className="font-mono">{c.value.toFixed(1)}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="w-px bg-slate-100 self-stretch"></div>
                                        <div className="flex-1">
                                            {statsB.regionAllocation.slice(0, 3).map((c: any) => {
                                                const label = REGION_LABELS[c.name] || c.name.replace(/_/g, ' ');
                                                return (
                                                    <div key={c.name} className="flex justify-between text-sm py-0.5 border-b border-slate-50">
                                                        <span className="truncate pr-2 capitalize" title={label}>{label}</span>
                                                        <span className="font-mono">{c.value.toFixed(1)}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
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

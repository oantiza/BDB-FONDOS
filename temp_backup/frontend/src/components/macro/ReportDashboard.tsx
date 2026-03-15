import React, { useMemo, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
    AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, BarChart
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Info, ArrowUpRight, ArrowDownRight, Minus, Calendar, Globe, Target, AlertCircle, BookOpen, Clock, Activity, ShieldAlert, BarChart3, LayoutGrid, Quote } from 'lucide-react';
import { EconomicCalendarTab } from './EconomicCalendarTab';

// Interfaces for TypeScript definitions
export interface KPI {
    label: string;
    value: string;
    trend: 'up' | 'down' | 'neutral';
}

export interface TailRisk {
    risk: string;
    probability: string;
    impact: string;
}

export interface AssetAllocationItem {
    assetClass?: string;
    region?: string;
    tacticalWeight?: number;
    strategicWeight?: number;
    weight?: number;
    view: 'Positiva' | 'Neutral' | 'Negativa';
    rationale: string;
}

export interface ReportData {
    summary: {
        headline: string;
        narrative: string;
        keyEvents: string[];
        kpis: KPI[];
        marketTemperature: string;
        tailRisks: TailRisk[];
    };
    assetAllocation: {
        overview: string;
        classes: AssetAllocationItem[];
        regionsEquity: AssetAllocationItem[];
        regionsFixedIncome: AssetAllocationItem[];
    };
    fullReport: {
        narrative: string;
    };
}

interface ReportDashboardProps {
    reportData: ReportData;
}

// Color Palettes for Premium Look
const COLORS_CORE = ['#3b82f6', '#8b5cf6', '#0ea5e9', '#6366f1', '#14b8a6'];
const COLORS_RISK = ['#ef4444', '#f59e0b', '#10b981'];

export default function ReportDashboard({ reportData }: ReportDashboardProps) {
    const [activeTab, setActiveTab] = useState<'summary' | 'allocation' | 'full' | 'calendar'>('summary');
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!reportData) return null;

    const { summary = {}, assetAllocation = {}, fullReport = {} } = (reportData || {}) as any;

    // --- Lógica de Respaldo (Fallbacks) para Reportes Incompletos ---
    // A veces el LLM agrupa todo el informe markdown dentro de `summary.narrative`.
    const rawNarrativeRoot = (reportData as any).narrative || '';
    const rawNarrativeSummary = summary.narrative || '';
    const rawNarrativeFull = fullReport?.narrative || '';

    let actualFullReport = rawNarrativeFull;
    if (!actualFullReport || actualFullReport.length < 50) {
        if (rawNarrativeRoot.length > 50) actualFullReport = rawNarrativeRoot;
        else if (rawNarrativeSummary.includes('###') || rawNarrativeSummary.length > 500) {
            actualFullReport = rawNarrativeSummary;
        }
    }

    // Limpiar el saludo si ha quedado de informes generados previamente
    if (actualFullReport) {
        actualFullReport = actualFullReport.replace(/A la atención del Comité de Inversiones,?\s*/gi, '');
        actualFullReport = actualFullReport.replace(/A la atención del Comité de Inversiones\n*/gi, '');
        actualFullReport = actualFullReport.replace(/A la atención del Comité de Inversiones:?\s*/gi, '');
    }

    // Hero Text corto y sin Markdown
    let heroNarrative = summary.narrative || '';
    if (heroNarrative) {
        heroNarrative = heroNarrative.replace(/A la atención del Comité de Inversiones,?\s*/gi, '');
        heroNarrative = heroNarrative.replace(/A la atención del Comité de Inversiones\n*/gi, '');
        heroNarrative = heroNarrative.replace(/A la atención del Comité de Inversiones:?\s*/gi, '');
    }

    if (heroNarrative === actualFullReport || heroNarrative.includes('###')) {
        // Limpiar el markdown básico si se filtró al hero
        heroNarrative = heroNarrative.replace(/[#*`>]/g, '').trim().substring(0, 200) + '...';
    } else if (heroNarrative.length > 250) {
        heroNarrative = heroNarrative.substring(0, 250) + '...';
    }

    // KPIs Fallback
    const kpisToRender = summary.kpis?.length > 0 ? summary.kpis : [
        { label: "Volatilidad del Mercado", value: "Pendiente", trend: "neutral" },
        { label: "Sentimiento Inversor", value: summary.marketTemperature?.substring(0, 10) || "Mixto", trend: "neutral" }
    ];

    // --- Formatters and Helpers ---
    const getTemperatureColor = (temp: string) => {
        const t = temp?.toLowerCase() || '';
        if (t.includes('bull') || t.includes('positiv') || t.includes('risk-on')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        if (t.includes('bear') || t.includes('negativ') || t.includes('risk-off')) return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
        return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    };

    const getViewBadge = (view: string) => {
        if (view === 'Positiva') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><TrendingUp className="w-3 h-3 mr-1" /> Overweight</span>;
        if (view === 'Negativa') return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><TrendingDown className="w-3 h-3 mr-1" /> Underweight</span>;
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"><Target className="w-3 h-3 mr-1" /> Neutral</span>;
    };

    // Mapping Tail Risks for Radar Chart
    const probMap: Record<string, number> = { 'Alta': 90, 'Media': 50, 'Baja': 20, 'High': 90, 'Medium': 50, 'Low': 20 };
    const impactMap: Record<string, number> = { 'Alto': 90, 'Medio': 50, 'Bajo': 20, 'High': 90, 'Medium': 50, 'Low': 20 };

    const radarData = Array.isArray(summary.tailRisks) ? summary.tailRisks.map((risk: any) => ({
        subject: risk.risk?.length > 20 ? risk.risk.substring(0, 20) + '...' : (risk.risk || ''),
        Probabilidad: probMap[risk.probability || 'Media'] || 50,
        Impacto: impactMap[risk.impact || 'Medio'] || 50,
        fullRisk: risk.risk
    })) : [];

    const tailRiskParams = useMemo(() => {
        if (!Array.isArray(summary.tailRisks) || summary.tailRisks.length === 0) return [];
        return summary.tailRisks.map((risk: any) => {
            const prob = probMap[risk.probability || 'Media'] / 10 || 5; // Scale to 0-10
            const impact = impactMap[risk.impact || 'Medio'] / 10 || 5; // Scale to 0-10
            return {
                risk: risk.risk?.length > 15 ? risk.risk.substring(0, 15) + '...' : (risk.risk || ''),
                score: (prob + impact) / 2, // Average score for radar
                fullProbability: risk.probability,
                fullImpact: risk.impact,
                fullRisk: risk.risk
            };
        });
    }, [summary.tailRisks]);

    // Mock Area Data for KPI Sparklines
    const sparklineDataUp = [{ v: 0 }, { v: 5 }, { v: 10 }, { v: 15 }, { v: 30 }];
    const sparklineDataDown = [{ v: 30 }, { v: 20 }, { v: 15 }, { v: 5 }, { v: 0 }];
    const sparklineDataFlat = [{ v: 15 }, { v: 16 }, { v: 15 }, { v: 14 }, { v: 15 }];

    return (
        <div className="w-full bg-[#f8fafc] text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20 pt-8">

            {/* HERO SECTION: Global context (visible on all tabs) */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                <div className="bg-slate-900 text-white relative overflow-hidden rounded-2xl flex flex-col justify-end pt-8 pb-0 px-6 sm:px-10 border border-slate-800 shadow-xl">
                    {/* Background Decorators */}
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[150%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
                    <div className="absolute top-[0%] right-[-10%] w-[40%] h-[100%] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none" />

                    <div className="relative z-10 w-full">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-4">
                            <div className="max-w-4xl">
                                <h2 className="text-indigo-400 font-semibold tracking-wider text-xs uppercase mb-1 flex items-center">
                                    <Activity className="w-3 h-3 mr-2" />
                                    Strategic Executive Summary
                                </h2>
                                <h1 className="text-2xl md:text-3xl font-serif font-medium leading-tight text-white mb-2 shadow-sm">
                                    {summary.headline || "Weekly Market Strategy"}
                                </h1>
                                <p className="text-slate-300 text-sm font-light leading-relaxed max-w-4xl border-l-2 border-indigo-500/50 pl-3 line-clamp-2">
                                    {heroNarrative || "Visión estratégica global y posicionamiento de carteras."}
                                </p>
                            </div>
                            <div className="flex-shrink-0 text-right mb-1">
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold block mb-1">Market Sentiment</span>
                                <div className={`inline-flex items-center px-4 py-1.5 rounded-full border shadow-sm backdrop-blur-md text-sm ${getTemperatureColor(summary.marketTemperature)}`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-current mr-2 animate-pulse" />
                                    <span className="font-bold tracking-wide">{summary.marketTemperature || "Neutral"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Tabs Overlaid on Hero Base */}
                        <div className="flex space-x-1 md:space-x-4 mt-2 border-t border-white/5 pt-1">
                            <button
                                onClick={() => setActiveTab('summary')}
                                className={`flex items-center px-3 py-2.5 text-sm font-semibold transition-all border-b-2 ${activeTab === 'summary' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400 hover:text-white'} `}
                            >
                                <LayoutGrid className="w-4 h-4 mr-2" /> Resumen Global
                            </button>
                            <button
                                onClick={() => setActiveTab('allocation')}
                                className={`flex items-center px-3 py-2.5 text-sm font-semibold transition-all border-b-2 ${activeTab === 'allocation' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400 hover:text-white'} `}
                            >
                                <BarChart3 className="w-4 h-4 mr-2" /> Asignación Táctica
                            </button>
                            <button
                                onClick={() => setActiveTab('full')}
                                className={`flex items-center px-3 py-2.5 text-sm font-semibold transition-all border-b-2 ${activeTab === 'full' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400 hover:text-white'} `}
                            >
                                <BookOpen className="w-4 h-4 mr-2" /> Informe Completo
                            </button>
                            <button
                                onClick={() => setActiveTab('calendar')}
                                className={`flex items-center px-3 py-2.5 text-sm font-semibold transition-all border-b-2 ${activeTab === 'calendar' ? 'border-indigo-400 text-white' : 'border-transparent text-slate-400 hover:text-white'} `}
                            >
                                <Calendar className="w-4 h-4 mr-2" /> Calendario
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN PORTAL CONTENT */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 min-h-[500px]">

                {/* --- TAB 1: RESUMEN --- */}
                {activeTab === 'summary' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* KPIs Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
                            {kpisToRender.map((kpi: KPI, idx: number) => {
                                const isUp = kpi.trend === 'up';
                                const isDown = kpi.trend === 'down';
                                const sparkData = isUp ? sparklineDataUp : (isDown ? sparklineDataDown : sparklineDataFlat);
                                const glowColor = isUp ? 'emerald' : (isDown ? 'rose' : 'indigo');
                                const bgIconStr = isUp ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : (isDown ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100');

                                return (
                                    <div key={idx} className="relative bg-white border border-slate-200 rounded-2xl p-6 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
                                        <div className="relative z-10 flex justify-between items-start">
                                            <div>
                                                <p className="text-slate-500 text-[11px] font-bold mb-0.5 uppercase tracking-wider">{kpi.label}</p>
                                                <p className="text-[18px] font-sans font-medium tracking-tight text-slate-800 truncate" title={String(kpi.value)}>{kpi.value}</p>
                                            </div>
                                            <div className={`p-1.5 rounded-md ${bgIconStr}`}>
                                                {isUp ? <ArrowUpRight className="w-4 h-4" /> : (isDown ? <ArrowDownRight className="w-4 h-4" /> : <Minus className="w-4 h-4" />)}
                                            </div>
                                        </div>
                                        {/* Mini Sparkline */}
                                        <div className="absolute bottom-0 left-0 w-full h-16 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none" style={{ minWidth: 0, minHeight: 0 }}>
                                            {isClient && (
                                                <ResponsiveContainer width="99%" height={64} minWidth={1} minHeight={1}>
                                                    <AreaChart data={sparkData}>
                                                        <defs>
                                                            <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor={isUp ? '#10b981' : (isDown ? '#f43f5e' : '#6366f1')} stopOpacity={0.8} />
                                                                <stop offset="100%" stopColor={isUp ? '#10b981' : (isDown ? '#f43f5e' : '#6366f1')} stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <Area type="monotone" dataKey="v" stroke="none" fill={`url(#grad-${idx})`} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Key Events */}
                            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                                <div className="flex items-center mb-8 border-b border-slate-100 pb-4">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl mr-4"><Clock className="w-6 h-6" /></div>
                                    <h3 className="text-xl font-bold text-slate-800 font-serif">Drivers Semanales Específicos</h3>
                                </div>
                                <div className="grid gap-4">
                                    {(summary.keyEvents || []).map((event: any, idx: number) => {
                                        let displayText = "Elemento vacío o irreconocible.";
                                        if (typeof event === 'string') {
                                            displayText = event;
                                        } else if (typeof event === 'object' && event !== null) {
                                            // Fallback to extract text if LLM sends an object implicitly
                                            displayText = event.event || event.description || event.title || event.texto || event.punto || JSON.stringify(event);
                                        }
                                        return (
                                            <div key={idx} className="flex p-4 rounded-xl bg-slate-50/50 border border-slate-100 hover:border-indigo-200 transition-colors">
                                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-indigo-500 font-bold flex items-center justify-center shadow-sm border border-slate-100 mr-4">
                                                    {idx + 1}
                                                </span>
                                                <p className="text-slate-700 leading-relaxed font-medium">{displayText}</p>
                                            </div>
                                        );
                                    })}
                                    {(!summary.keyEvents || summary.keyEvents.length === 0) && (
                                        <p className="text-slate-500 italic">No se han extraído drivers específicos para esta semana.</p>
                                    )}
                                </div>
                            </div>

                            {/* Tail Risks Radar */}
                            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col">
                                <div className="flex items-center mb-6 border-b border-slate-100 pb-3">
                                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg mr-3"><ShieldAlert className="w-5 h-5" /></div>
                                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 tracking-tight mb-2">
                                        Dashboard Macroeconómico
                                    </h1>
                                </div>
                                {tailRiskParams && tailRiskParams.length >= 3 ? (
                                    <div className="h-[250px] w-full">
                                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={tailRiskParams}>
                                                <PolarGrid stroke="#e2e8f0" />
                                                <PolarAngleAxis dataKey="risk" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                                                <Radar name="Impacto vs Probabilidad" dataKey="score" stroke="#f43f5e" strokeWidth={2} fill="#f43f5e" fillOpacity={0.2} />
                                                <RechartsTooltip
                                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                    itemStyle={{ fontWeight: 'bold' }}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : tailRiskParams && tailRiskParams.length > 0 ? (
                                    <div className="h-[250px] w-full overflow-y-auto pr-1 space-y-3">
                                        {tailRiskParams.map((risk: any, i: number) => (
                                            <div key={i} className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 flex flex-col justify-between hover:border-rose-200 transition-colors">
                                                <span className="font-bold text-slate-800 mb-3 text-sm" title={risk.fullRisk}>{risk.fullRisk || risk.risk}</span>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 font-medium">Impacto: <span className="text-rose-600 font-bold ml-1">{risk.fullImpact || 'Medio'}</span></span>
                                                    <span className="text-slate-500 font-medium">Probabilidad: <span className="text-rose-600 font-bold ml-1">{risk.fullProbability || 'Media'}</span></span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-[250px] space-y-4">
                                        {summary.kpis && summary.kpis.length > 0 ? (
                                            // Fallback chart if no tail risks but we have KPIs to show something visual
                                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                <BarChart data={summary.kpis} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                                                    <RechartsTooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                        {summary.kpis.map((entry: any, index: number) => (
                                                            <Cell key={`cell-${index}`} fill={entry.trend === 'up' ? '#10b981' : entry.trend === 'down' ? '#f43f5e' : '#6366f1'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full w-full bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100 p-6 text-center">
                                                <div className="relative flex items-center justify-center mb-6 mt-4">
                                                    <div className="absolute w-20 h-20 rounded-full bg-rose-50/80 animate-ping opacity-75" />
                                                    <div className="relative z-10 w-14 h-14 bg-white rounded-full shadow-sm border border-rose-100 flex items-center justify-center">
                                                        <ShieldAlert className="w-7 h-7 text-rose-400" />
                                                    </div>
                                                </div>
                                                <span className="text-base text-slate-700 font-bold mb-1">Sin anomalías detectadas</span>
                                                <span className="text-sm text-slate-500 max-w-[200px]">El modelo no ha identificado riesgos de cola inminentes.</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 2: ASIGNACIÓN TÁCTICA --- */}
                {activeTab === 'allocation' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-slate-50 px-8 py-6 border-b border-slate-200">
                            <h2 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">Matriz de Asignación Táctica</h2>
                            <p className="text-slate-600 mt-2 max-w-4xl text-base">
                                {assetAllocation.overview}
                            </p>
                        </div>

                        <div className="p-8">
                            {/* Macro Bar Chart overlaying Strategic vs Tactical */}
                            <div className="w-full h-[400px] mb-16">
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">Desviación Táctica vs Estratégica (%)</h4>
                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                    <ComposedChart
                                        data={assetAllocation.classes || []}
                                        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                                        barGap={0}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="assetClass" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontWeight: 600, fontSize: 13 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dx={-10} />
                                        <RechartsTooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '30px' }} />
                                        <Bar dataKey="strategicWeight" name="Strategic Weight (%)" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                        <Bar dataKey="tacticalWeight" name="Tactical Weight (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                                        <Line type="monotone" dataKey="tacticalWeight" name="Trend" stroke="#0f172a" strokeWidth={3} dot={{ r: 6, fill: '#0f172a', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Breakdown Grids */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 mb-12">
                                {/* Equity Breakdown */}
                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                    <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-slate-100 pb-3">
                                        <div className="w-2 h-5 bg-blue-500 rounded-full mr-3" /> Breakdown Renta Variable
                                    </h4>
                                    <div className="flex flex-col md:flex-row gap-6 items-center">
                                        <div className="w-48 h-48 flex-shrink-0 relative">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                <PieChart>
                                                    <Pie
                                                        data={assetAllocation.regionsEquity || []}
                                                        innerRadius={60}
                                                        outerRadius={85}
                                                        paddingAngle={3}
                                                        dataKey="weight"
                                                        nameKey="region"
                                                        stroke="none"
                                                    >
                                                        {(assetAllocation.regionsEquity || []).map((_: any, i: number) => (
                                                            <Cell key={`cell-eq-${i}`} fill={COLORS_CORE[i % COLORS_CORE.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-xs font-semibold text-slate-400">Total Eq.</span>
                                                <span className="text-lg font-bold text-slate-800">100%</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 w-full space-y-3">
                                            {(assetAllocation.regionsEquity || []).map((item: any, idx: number) => (
                                                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: COLORS_CORE[idx % COLORS_CORE.length] }} />
                                                        <span className="font-semibold text-slate-700 text-sm">{item.region}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-4">
                                                        {getViewBadge(item.view)}
                                                        <span className="font-bold text-slate-900 border-l border-slate-200 pl-4 w-12 text-right">{item.weight}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Fixed Income Breakdown */}
                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                    <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-slate-100 pb-3">
                                        <div className="w-2 h-5 bg-teal-500 rounded-full mr-3" /> Breakdown Renta Fija
                                    </h4>
                                    <div className="flex flex-col md:flex-row gap-6 items-center">
                                        <div className="w-48 h-48 flex-shrink-0 relative">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                <PieChart>
                                                    <Pie
                                                        data={assetAllocation.regionsFixedIncome || []}
                                                        innerRadius={60}
                                                        outerRadius={85}
                                                        paddingAngle={3}
                                                        dataKey="weight"
                                                        nameKey="region"
                                                        stroke="none"
                                                    >
                                                        {(assetAllocation.regionsFixedIncome || []).map((_: any, i: number) => (
                                                            <Cell key={`cell-fi-${i}`} fill={['#14b8a6', '#0ea5e9', '#6366f1'][i % 3]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className="text-xs font-semibold text-slate-400">Total F.I.</span>
                                                <span className="text-lg font-bold text-slate-800">100%</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 w-full space-y-3">
                                            {(assetAllocation.regionsFixedIncome || []).map((item: any, idx: number) => (
                                                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: ['#14b8a6', '#0ea5e9', '#6366f1'][idx % 3] }} />
                                                        <span className="font-semibold text-slate-700 text-sm">{item.region}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-4">
                                                        {getViewBadge(item.view)}
                                                        <span className="font-bold text-slate-900 border-l border-slate-200 pl-4 w-12 text-right">{item.weight}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Rationale Table */}
                            <div className="border-t border-slate-100 pt-8">
                                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Investment Rationale Master</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse bg-white rounded-lg overflow-hidden border border-slate-200">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="py-4 px-6 text-sm font-bold text-slate-700">Clase/Región</th>
                                                <th className="py-4 px-6 text-sm font-bold text-slate-700">View</th>
                                                <th className="py-4 px-6 text-sm font-bold text-slate-700">Justificación Táctica</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {assetAllocation.classes.filter((cls: any) => cls.rationale && cls.rationale.trim() !== '').map((cls: any, i: number) => (
                                                <tr key={i} className="border-b last:border-b-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 px-4 font-semibold text-slate-800 text-sm whitespace-nowrap">{cls.assetClass}</td>
                                                    <td className="py-4 px-4">
                                                        <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                                                            ${cls.view.includes('Positiva') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                                cls.view.includes('Negativa') ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                                                    'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                            {cls.view.includes('Positiva') ? <TrendingUp className="w-3.5 h-3.5" /> :
                                                                cls.view.includes('Negativa') ? <TrendingDown className="w-3.5 h-3.5" /> :
                                                                    <Minus className="w-3.5 h-3.5" />}
                                                            <span>{cls.view === 'Positiva' ? 'Overweight' : cls.view === 'Negativa' ? 'Underweight' : 'Neutral'}</span>
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4 text-sm text-slate-600/90 leading-relaxed italic">{cls.rationale}</td>
                                                </tr>
                                            ))}
                                            {(!assetAllocation.classes || assetAllocation.classes.filter((cls: any) => cls.rationale && cls.rationale.trim() !== '').length === 0) && (
                                                <tr>
                                                    <td colSpan={3} className="py-20 text-center">
                                                        <div className="flex flex-col items-center justify-center space-y-4">
                                                            <div className="p-4 bg-slate-50 rounded-full border border-slate-100 shadow-sm flex items-center justify-center">
                                                                <Target className="w-10 h-10 text-slate-300" />
                                                            </div>
                                                            <div className="flex flex-col space-y-1">
                                                                <span className="font-bold text-slate-700 text-lg">Posicionamiento en revisión</span>
                                                                <span className="text-slate-500 text-sm max-w-sm mx-auto">No hay justificaciones tácticas extraordinarias publicadas para la visión de esta semana.</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    </div>
                )}

                {/* --- TAB 3: INFORME COMPLETO --- */}
                {activeTab === 'full' && (
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden py-12 px-6 md:px-16 lg:px-24 xl:px-32 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="max-w-6xl mx-auto">

                            <div className="border-b border-slate-200 pb-6 mb-12 flex flex-col md:flex-row justify-between items-end">
                                <div>
                                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 tracking-tight leading-tight">Investment Strategy Document</h2>
                                    <p className="text-slate-500 mt-2 font-mono text-sm tracking-widest uppercase">{new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <div className="mt-6 md:mt-0 text-right">
                                    <span className="block text-sm font-semibold text-indigo-600 mb-1">Global Alpha Engine</span>
                                    <span className="block text-3xl font-bold text-slate-800 tracking-tighter -mt-1">{summary.marketTemperature || "NEUTRAL"}</span>
                                </div>
                            </div>

                            {/* The Main Markdown Body with Automatic Visual Injections */}
                            {(!actualFullReport || actualFullReport.length < 10) ? (
                                <div className="flex flex-col h-full justify-center mb-16">
                                    <div className="text-center py-20 text-slate-500 flex flex-col items-center bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
                                        <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
                                        <p className="text-lg font-medium">No se ha generado el reporte detallado.</p>
                                        <p className="text-sm text-slate-400 mt-2">Prueba a forzar la actualización desde el backend.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="report-sections-container w-full max-w-none">
                                    {heroNarrative && (
                                        <div className="relative mb-16 max-w-4xl border-l-4 border-indigo-500 pl-8 ml-4 break-inside-avoid">
                                            <Quote className="absolute -top-6 -left-6 w-12 h-12 text-indigo-100 -z-10" />
                                            <p className="text-xl md:text-2xl font-serif text-slate-700 leading-relaxed font-light italic">
                                                "{heroNarrative}"
                                            </p>
                                        </div>
                                    )}

                                    {(() => {
                                        const fullMd = actualFullReport.replace(/\\\\n/g, '\\n');
                                        const blocks: { number: number, content: string }[] = [];

                                        // Regex robusta para capturar cabeceras (H1-H3) o líneas en mayúsculas en negrita que actúan como cabeceras
                                        const sectionsRegex = /(?:^|\n)(#{1,3}\s*(?:\d{1,2}\.\s*)?[^\n]+|(?:\*\*(?:\d{1,2}\.\s*)?[A-ZÁÉÍÓÚÑ:\s]+\*\*))(?=\n|$)/g;

                                        let match;
                                        const headingMatches = [];
                                        while ((match = sectionsRegex.exec(fullMd)) !== null) {
                                            if (match[1].trim().length > 0) {
                                                headingMatches.push({ text: match[1], index: match.index });
                                            }
                                        }

                                        if (headingMatches.length === 0) {
                                            blocks.push({ number: 1, content: fullMd });
                                        } else {
                                            if (headingMatches[0].index > 0) {
                                                const intro = fullMd.substring(0, headingMatches[0].index).trim();
                                                if (intro) blocks.push({ number: 0, content: intro });
                                            }
                                            for (let i = 0; i < headingMatches.length; i++) {
                                                const start = headingMatches[i].index;
                                                const end = headingMatches[i + 1] ? headingMatches[i + 1].index : fullMd.length;
                                                let content = fullMd.substring(start, end).trim();

                                                // Convertir negritas raras (pseudo-headings) a verdaderas cabeceras H3 para formateo consistente
                                                if (content.startsWith('**') && (content.indexOf('**\n') > 0 || content.endsWith('**'))) {
                                                    content = content.replace(/^\*\*(.*?)\*\*/, '### $1');
                                                }

                                                // Extraer número de sección si existe (e.g. "1.", "### 1.", "**1.**")
                                                const numMatch = headingMatches[i].text.match(/(?:^|\s|\*|#)(\d{1,2})\.\s/);
                                                const sectionNum = numMatch ? parseInt(numMatch[1]) : (i + 1);

                                                blocks.push({ number: sectionNum, content: content });
                                            }
                                        }

                                        if (blocks.length === 0 || (blocks.length === 1 && blocks[0].number === 1)) {
                                            return (
                                                <article className="prose prose-slate max-w-none lg:columns-2 lg:gap-16">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{blocks.length > 0 ? blocks[0].content : fullMd}</ReactMarkdown>
                                                </article>
                                            );
                                        }

                                        return blocks.map((block, index) => {
                                            const markdownBlock = (
                                                <article className="prose prose-slate max-w-none text-slate-700 leading-relaxed
                                                    prose-headings:font-serif prose-headings:text-slate-900 prose-headings:font-bold
                                                    prose-h1:text-4xl prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:pb-3 prose-h2:border-b-2 prose-h2:border-slate-800
                                                    prose-h3:text-2xl prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-slate-900 prose-h3:font-bold
                                                    prose-h4:text-xl prose-h4:mt-8 prose-h4:mb-3 prose-h4:text-slate-800
                                                    prose-p:mb-6 prose-p:text-base md:prose-p:text-[17px] prose-p:text-slate-600 prose-p:text-justify
                                                    prose-li:text-slate-600 prose-ul:mb-6 prose-ol:mb-6
                                                    prose-strong:text-slate-900 prose-strong:font-bold
                                                    prose-blockquotes:border-l-4 prose-blockquotes:border-indigo-500 prose-blockquotes:pl-4 prose-blockquotes:italic prose-blockquotes:text-slate-600
                                                    prose-hr:border-slate-200 prose-hr:my-12 prose-hr:border-t-2
                                                    mb-8 clear-both
                                                    [&>h1]:[column-span:all] [&>h2]:[column-span:all] [&>h3]:[column-span:all] [&>h4]:[column-span:all] [&>hr]:[column-span:all]">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
                                                </article>
                                            );

                                            let visualInjection = null;

                                            if (block.number === 1 && summary.kpis && summary.kpis.length > 0) {
                                                visualInjection = (
                                                    <div className="mt-8 mb-20 bg-slate-50 rounded-[2rem] p-8 border border-slate-200 shadow-sm w-full clear-both">
                                                        <div className="mb-6 pb-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center px-4">
                                                            <div>
                                                                <h3 className="text-xl font-serif font-black text-slate-800 uppercase tracking-widest text-left">Macro Spider Web</h3>
                                                                <p className="text-sm text-slate-500 text-left mt-1">Polaridad direccional de tracción exógena</p>
                                                            </div>
                                                            <div className="mt-4 md:mt-0 text-right">
                                                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Global Sentiment</span>
                                                                <span className="text-xl font-black text-indigo-600">{summary.marketTemperature || "NEUTRAL"}</span>
                                                            </div>
                                                        </div>
                                                        <div className="w-full h-[400px]">
                                                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={summary.kpis.map((k: KPI) => ({
                                                                    subject: k.label,
                                                                    Trend: k.trend === 'up' ? 80 : k.trend === 'down' ? 20 : 50,
                                                                    fullMark: 100
                                                                }))}>
                                                                    <PolarGrid stroke="#e2e8f0" />
                                                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }} />
                                                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                                                    <Radar name="Expansión" dataKey="Trend" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.4} />
                                                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                                </RadarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                );
                                            } else if (block.number === 3 && assetAllocation && assetAllocation.classes) {
                                                const regions = assetAllocation.classes.filter((c: any) =>
                                                    c.assetClass?.toLowerCase().match(/eeuu|europa|emergente|jap|us |eu /)
                                                );
                                                if (regions.length > 0) {
                                                    visualInjection = (
                                                        <div className="mt-8 mb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 clear-both w-full mx-auto">
                                                            <div className="col-span-full mb-2">
                                                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Convulsos Regionales Detectados</h3>
                                                            </div>
                                                            {regions.map((reg: any, i: number) => (
                                                                <div key={i} className={`p-6 rounded-2xl border ${reg.view.includes('Positiva') ? 'bg-emerald-50 border-emerald-100' : reg.view.includes('Negativa') ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-200'} flex flex-col justify-between shadow-sm hover:-translate-y-1 transition-transform`}>
                                                                    <span className="text-sm font-bold text-slate-500 uppercase">{reg.assetClass}</span>
                                                                    <div className="mt-6 flex items-end justify-between">
                                                                        <span className={`text-2xl font-black tracking-tight ${reg.view.includes('Positiva') ? 'text-emerald-700' : reg.view.includes('Negativa') ? 'text-rose-700' : 'text-slate-700'}`}>
                                                                            {reg.view.includes('Positiva') ? 'OVERWEIGHT' : reg.view.includes('Negativa') ? 'UNDERWEIGHT' : 'NEUTRAL'}
                                                                        </span>
                                                                        {reg.view.includes('Positiva') ? <TrendingUp className="w-10 h-10 text-emerald-400" /> : reg.view.includes('Negativa') ? <TrendingDown className="w-10 h-10 text-rose-400" /> : <Minus className="w-10 h-10 text-slate-400" />}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                            } else if (block.number === 5 && assetAllocation && assetAllocation.classes && assetAllocation.classes.length > 0) {
                                                visualInjection = (
                                                    <div className="mt-8 mb-20 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm w-full mx-auto clear-both">
                                                        <div className="mb-8 pb-4 border-b border-slate-100">
                                                            <h3 className="text-xl font-serif font-black text-slate-800 uppercase text-center tracking-widest">Peso Estratégico vs Táctico Global</h3>
                                                            <p className="text-sm text-slate-500 text-center mt-1">Desviación en asignación fundamental de la cartera directiva</p>
                                                        </div>
                                                        <div className="w-full h-[400px]">
                                                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                                <ComposedChart data={assetAllocation.classes} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                                    <XAxis dataKey="assetClass" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} angle={-25} textAnchor="end" height={60} />
                                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                                                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                                    <Bar dataKey="strategicWeight" name="Estratégico %" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                                    <Bar dataKey="tacticalWeight" name="Táctico %" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                                                </ComposedChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                );
                                            } else if (block.number === 6 && summary.tailRisks && summary.tailRisks.length > 0) {
                                                visualInjection = (
                                                    <div className="mt-8 mb-20 bg-rose-50/50 rounded-3xl p-8 border border-rose-100 clear-both w-full mx-auto">
                                                        <div className="mb-8 pb-4 border-b border-rose-200/50 flex flex-col md:flex-row items-center justify-between">
                                                            <div className="flex items-center space-x-3 mb-4 md:mb-0">
                                                                <ShieldAlert className="w-8 h-8 text-rose-600" />
                                                                <h3 className="text-xl font-serif font-black text-rose-900 uppercase tracking-widest">Matriz de Cisnes Negros</h3>
                                                            </div>
                                                            <span className="text-xs bg-rose-100 text-rose-700 font-bold px-3 py-1 rounded-full uppercase tracking-wider">High Impact Warnings</span>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                            {summary.tailRisks.map((risk: TailRisk, rIdx: number) => (
                                                                <div key={rIdx} className="bg-white rounded-2xl p-6 shadow-sm border border-rose-100 relative overflow-hidden group hover:border-rose-300 transition-colors">
                                                                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center opacity-40 group-hover:scale-110 transition-transform">
                                                                        <AlertTriangle className="w-8 h-8 text-rose-300" />
                                                                    </div>
                                                                    <h4 className="font-bold text-slate-800 text-base mb-3 relative z-10 pr-8 leading-tight">{risk.risk}</h4>
                                                                    <div className="flex justify-between items-center text-sm font-semibold mt-6 pt-4 border-t border-slate-50 relative z-10 bg-white">
                                                                        <span className="text-slate-500">Probabilidad: <span className="text-rose-600 ml-1">{risk.probability}</span></span>
                                                                        <span className="text-slate-500">Gravedad: <span className="text-rose-600 ml-1">{risk.impact}</span></span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={index} className="w-full clear-both">
                                                    {markdownBlock}
                                                    {visualInjection}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}

                            <div className="mt-20 pt-8 border-t border-slate-200 text-center flex flex-col items-center">
                                <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mb-4">
                                    <Activity className="w-6 h-6 text-white" />
                                </div>
                                <span className="font-serif font-bold text-slate-900 text-lg">Fin del Reporte</span>
                                <span className="text-sm text-slate-400 mt-1">Generado automáticamente por el motor de IA de BDB-Fondos</span>
                            </div>

                        </div>
                    </div>
                )}

                {/* --- TAB 4: CALENDARIO ECONÓMICO --- */}
                {activeTab === 'calendar' && (
                    <EconomicCalendarTab />
                )}

            </div>
        </div>
    );
}

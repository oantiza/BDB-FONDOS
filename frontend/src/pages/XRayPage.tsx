import { useState, useMemo, useEffect } from 'react' // Ensure useMemo removed if unused
import { useXRayAnalytics } from '../hooks/useXRayAnalytics'
import { usePortfolioStats } from '../hooks/usePortfolioStats'
import DiversificationDonut from '../components/charts/DiversificationDonut'

import MetricCard from '../components/common/MetricCard'
import SimpleStyleBox from '../components/charts/SimpleStyleBox'
import ComparativeFundHistoryChart from '../components/charts/ComparativeFundHistoryChart'
import XRayChart from '../components/charts/XRayChart'
import RiskMap from '../components/charts/RiskMap'
import CorrelationHeatmap from '../components/charts/CorrelationHeatmap'
import { generatePortfolioReport } from '../utils/generatePortfolioReport'

import { Fund, PortfolioItem } from '../types'
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

// Simple Interface for limited Macro Data usage
interface MacroReport {
    title: string;
    date: string;
    executive_summary: string;
    equity?: { geo: any[]; sectors: any[] };
    fixed_income?: { subsectors: any[]; geo: any[] };
    real_assets?: { commodities: any[]; currencies: any[] };
    market_pulse?: any;
    house_view_summary?: string;
}

interface XRayPageProps {
    portfolio: PortfolioItem[];
    fundDatabase: Fund[];
    totalCapital: number;
    onBack: () => void;
    onOpenAnalytics: () => void;
}

export default function XRayPage({ portfolio, fundDatabase, totalCapital, onBack, onOpenAnalytics }: XRayPageProps) {
    // ... (rest of file until table) ...
    <tr className="border-t border-black">
        <td className="py-6 pl-4 text-xl font-[550] text-[#2C3E50] tracking-tight">TOTAL CARTERA</td>
        <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">100.00%</td>
        <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">
            {totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
        </td>
        {/* EMPTY VOLATILITY CELL AS REQUESTED */}
        <td className="py-6 pr-4"></td>
    </tr>
    // ... existing state

    // Custom Hooks
    const { metrics, loading, errorMsg, riskExplanation } = useXRayAnalytics({ portfolio, fundDatabase });
    const { categoryAllocation, sortedHoldings, styleStats } = usePortfolioStats({ portfolio, metrics });

    // --- NEW: FETCH REPORT DATA FOR PDF ---
    const [strategyReport, setStrategyReport] = useState<MacroReport | null>(null);
    const [monthlyReport, setMonthlyReport] = useState<MacroReport | null>(null);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                // 1. Get Latest Strategy Report
                const qStrategy = query(collection(db, 'reports'), where('type', '==', 'STRATEGY'), orderBy('createdAt', 'desc'), limit(1));
                const snapStrategy = await getDocs(qStrategy);
                if (!snapStrategy.empty) setStrategyReport(snapStrategy.docs[0].data() as MacroReport);

                // 2. Get Latest Monthly Report (for Macro Context)
                const qMonthly = query(collection(db, 'reports'), where('type', '==', 'MONTHLY'), orderBy('createdAt', 'desc'), limit(1));
                const snapMonthly = await getDocs(qMonthly);
                if (!snapMonthly.empty) setMonthlyReport(snapMonthly.docs[0].data() as MacroReport);

            } catch (err) {
                console.error("Error fetching PDF data:", err);
            }
        };
        fetchReports();
    }, []);


    const handleDownloadReport = () => {
        generatePortfolioReport('pdf-cover-page', 'pdf-tactical-page', 'pdf-page-1', 'pdf-page-2', 'pdf-page-3', 'pdf-page-4');
    };

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

                    {/* PDF REPORT BUTTON */}
                    <button
                        onClick={handleDownloadReport}
                        disabled={loading || !metrics}
                        className="ml-4 bg-white/10 hover:bg-white/20 text-white transition-colors text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-sm border border-white/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>📄</span> Informe de cartera
                    </button>

                    {/* ANALYTICS TAB */}

                    {/* ANALYTICS TAB */}

                    <button
                        onClick={onOpenAnalytics}
                        className="ml-4 text-white/70 hover:text-[#D4AF37] transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-1 group bg-white/5 px-3 py-1 rounded-full border border-white/10 hover:border-white/30"
                    >
                        Gráficos Avanzados <span className="group-hover:translate-x-0.5 transition-transform">↗</span>
                    </button>
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

                        {/* --- PDF PAGE 1: COVER PAGE (Hidden on Screen) --- */}
                        <div id="pdf-cover-page" style={{ position: 'absolute', left: '-9999px', top: 0, width: '1200px', height: '1600px', background: '#0044CC', color: 'white', overflow: 'hidden' }} className="flex flex-col justify-between p-0">

                            {/* Background Gradients to simulate the curves - Adjusted for softer navy */}
                            <div style={{ position: 'absolute', top: '-10%', right: '-30%', width: '1200px', height: '1200px', background: 'radial-gradient(circle, #0055DD 0%, transparent 70%)', borderRadius: '50%', opacity: 0.4 }}></div>
                            <div style={{ position: 'absolute', bottom: '-20%', left: '-20%', width: '1000px', height: '1000px', background: 'radial-gradient(circle, #0055DD 0%, transparent 70%)', borderRadius: '50%', opacity: 0.3 }}></div>

                            {/* Top Brand */}
                            <div className="relative z-10 p-24">
                                <div className="flex items-center gap-6 mb-24">
                                    <div className="w-1.5 h-16 bg-[#FDB913]"></div> {/* Gold Bar */}
                                    <span className="text-4xl font-light tracking-[0.2em] text-white">BDB FONDOS</span>
                                </div>

                                <div className="mt-48">
                                    <h2 className="text-6xl font-light text-white mb-2">Informe de</h2>
                                    <h1 className="text-8xl font-bold text-[#FDB913] mb-8">Cartera</h1>
                                    <p className="text-3xl text-white/80 font-light max-w-2xl leading-normal">
                                        Análisis detallado de composición, métricas de riesgo y proyección histórica.
                                    </p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="relative z-10 p-24 pb-32">
                                <div className="mb-12">
                                    <p className="text-[#FDB913] font-bold text-sm uppercase tracking-widest mb-2">FECHA DE EMISIÓN</p>
                                    <p className="text-4xl text-white font-light">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                    <div className="w-full h-px bg-white/20 mt-8 mb-4"></div>
                                </div>

                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">GENERADO POR</p>
                                        <p className="text-xl text-white font-medium">BDB Analytics Engine</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* --- PDF PAGE 2: TACTICAL ALLOCATION (Hidden on Screen) --- */}
                        <div id="pdf-tactical-page" style={{ position: 'absolute', left: '-9999px', top: 0, width: '1200px', height: '1600px', background: 'white', padding: '0px' }}>
                            {/* Header matched to screenshot */}
                            <div className="h-24 bg-[#0044CC] text-white flex items-center justify-between px-16 w-full mb-16">
                                <div className="text-3xl tracking-tight">
                                    <span className="font-light">Macro y </span><span className="font-bold">Estrategia</span>
                                </div>
                                <span className="text-[#FDB913] font-bold text-sm uppercase tracking-[0.2em]">ASIGNACIÓN DE ACTIVOS</span>
                            </div>

                            <div className="px-16 space-y-12">
                                {/* Quote Box */}
                                <div className="border-t-2 border-[#FDB913] bg-slate-50 p-12 text-center relative mx-12">
                                    <p className="text-[#A07147] text-xs font-bold uppercase tracking-[0.2em] mb-6 absolute -top-3 bg-white px-4 left-1/2 -translate-x-1/2">VISIÓN DE LA CASA</p>
                                    {strategyReport?.house_view_summary ? (
                                        <p className="text-3xl text-[#2C3E50] font-light italic leading-relaxed">
                                            "{strategyReport.house_view_summary}"
                                        </p>
                                    ) : (
                                        <p className="text-xl text-gray-400 font-light italic leading-relaxed text-center">
                                            (Resumen de visión de la casa no disponible)
                                        </p>
                                    )}
                                </div>

                                {/* 3 Columns Grid - Fixed Alignment */}
                                <div className="grid grid-cols-3 gap-12 mt-16">

                                    {/* COL 1: RENTA VARIABLE */}
                                    <div>
                                        <div className="border-b-2 border-[#2C3E50] pb-2 mb-6 flex items-center gap-3">
                                            <span className="text-2xl">📈</span>
                                            <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-sm">RENTA VARIABLE</h3>
                                        </div>

                                        <div className="space-y-8">
                                            {/* Geografico */}
                                            <div>
                                                <h4 className="text-[#A07147] font-bold uppercase tracking-widest text-[10px] mb-4">GEOGRÁFICO</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-3">
                                                        {(strategyReport?.equity?.geo || []).length > 0 ? (
                                                            strategyReport?.equity?.geo?.map((item: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center py-1">
                                                                    <span className="text-[#2C3E50] font-medium text-sm">{item.name}</span>
                                                                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-sm min-w-[80px] text-center
                                                                ${item.action === 'Sobreponderar' || item.action === 'Positivo' ? 'bg-green-50 text-green-700' :
                                                                            item.action === 'Infraponderar' || item.action === 'Negativo' ? 'bg-red-50 text-red-700' :
                                                                                'bg-slate-100 text-slate-500'}`}>
                                                                        {item.action}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : <p className="text-xs text-center text-gray-400 italic">Datos geográficos no disponibles</p>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sectores */}
                                            <div>
                                                <h4 className="text-[#A07147] font-bold uppercase tracking-widest text-[10px] mb-4">SECTORES</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-3">
                                                        {(strategyReport?.equity?.sectors || []).length > 0 ? (
                                                            strategyReport?.equity?.sectors?.map((item: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center py-1">
                                                                    <span className="text-[#2C3E50] font-medium text-sm">{item.name}</span>
                                                                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-sm min-w-[80px] text-center
                                                                ${item.action === 'Sobreponderar' || item.action === 'Positivo' ? 'bg-green-50 text-green-700' :
                                                                            item.action === 'Infraponderar' || item.action === 'Negativo' ? 'bg-red-50 text-red-700' :
                                                                                'bg-slate-100 text-slate-500'}`}>
                                                                        {item.action}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : <p className="text-xs text-center text-gray-400 italic">Datos sectoriales no disponibles</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* COL 2: RENTA FIJA */}
                                    <div>
                                        <div className="border-b-2 border-[#2C3E50] pb-2 mb-6 flex items-center gap-3">
                                            <span className="text-2xl">🛡️</span>
                                            <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-sm">RENTA FIJA</h3>
                                        </div>

                                        <div className="space-y-8">
                                            {/* Subsectores */}
                                            <div>
                                                <h4 className="text-[#A07147] font-bold uppercase tracking-widest text-[10px] mb-4">SUBSECTORES</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-3">
                                                        {(strategyReport?.fixed_income?.subsectors || []).length > 0 ? (
                                                            strategyReport?.fixed_income?.subsectors?.map((item: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center py-1">
                                                                    <span className="text-[#2C3E50] font-medium text-sm">{item.name}</span>
                                                                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-sm min-w-[80px] text-center
                                                                ${item.action === 'Sobreponderar' || item.action === 'Positivo' ? 'bg-green-50 text-green-700' :
                                                                            item.action === 'Infraponderar' || item.action === 'Negativo' ? 'bg-red-50 text-red-700' :
                                                                                'bg-slate-100 text-slate-500'}`}>
                                                                        {item.action}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : <p className="text-xs text-center text-gray-400 italic">Datos de subsectores no disponibles</p>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Geografico */}
                                            <div>
                                                <h4 className="text-[#A07147] font-bold uppercase tracking-widest text-[10px] mb-4">GEOGRÁFICO</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-3">
                                                        {(strategyReport?.fixed_income?.geo || []).length > 0 ? (
                                                            strategyReport?.fixed_income?.geo?.map((item: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center py-1">
                                                                    <span className="text-[#2C3E50] font-medium text-sm">{item.name}</span>
                                                                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-sm min-w-[80px] text-center
                                                                ${item.action === 'Sobreponderar' || item.action === 'Positivo' ? 'bg-green-50 text-green-700' :
                                                                            item.action === 'Infraponderar' || item.action === 'Negativo' ? 'bg-red-50 text-red-700' :
                                                                                'bg-slate-100 text-slate-500'}`}>
                                                                        {item.action}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : <p className="text-xs text-center text-gray-400 italic">Datos geográficos no disponibles</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* COL 3: ACTIVOS REALES */}
                                    <div>
                                        <div className="border-b-2 border-[#2C3E50] pb-2 mb-6 flex items-center gap-3">
                                            <span className="text-2xl">🧱</span>
                                            <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-sm">ACTIVOS REALES</h3>
                                        </div>

                                        <div className="space-y-8">
                                            {/* Materias Primas */}
                                            <div>
                                                <h4 className="text-[#A07147] font-bold uppercase tracking-widest text-[10px] mb-4">MATERIAS PRIMAS</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-3">
                                                        {(strategyReport?.real_assets?.commodities || []).length > 0 ? (
                                                            strategyReport?.real_assets?.commodities?.map((item: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center py-1">
                                                                    <span className="text-[#2C3E50] font-medium text-sm">{item.name}</span>
                                                                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-sm min-w-[80px] text-center
                                                                ${item.action === 'Sobreponderar' || item.action === 'Positivo' ? 'bg-green-50 text-green-700' :
                                                                            item.action === 'Infraponderar' || item.action === 'Negativo' ? 'bg-red-50 text-red-700' :
                                                                                'bg-slate-100 text-slate-500'}`}>
                                                                        {item.action}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : <p className="text-xs text-center text-gray-400 italic">Datos de materias primas no disponibles</p>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Divisas */}
                                            <div>
                                                <h4 className="text-[#A07147] font-bold uppercase tracking-widest text-[10px] mb-4">DIVISAS</h4>
                                                <div className="space-y-3">
                                                    <div className="space-y-3">
                                                        {(strategyReport?.real_assets?.currencies || []).length > 0 ? (
                                                            strategyReport?.real_assets?.currencies?.map((item: any, i: number) => (
                                                                <div key={i} className="flex justify-between items-center py-1">
                                                                    <span className="text-[#2C3E50] font-medium text-sm">{item.name}</span>
                                                                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-sm min-w-[80px] text-center
                                                                ${item.action === 'Sobreponderar' || item.action === 'Positivo' ? 'bg-green-50 text-green-700' :
                                                                            item.action === 'Infraponderar' || item.action === 'Negativo' ? 'bg-red-50 text-red-700' :
                                                                                'bg-slate-100 text-slate-500'}`}>
                                                                        {item.action}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : <p className="text-xs text-center text-gray-400 italic">Datos de divisas no disponibles</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Footer Date */}
                            <div className="absolute bottom-8 left-16 right-16 flex justify-between text-xs text-slate-400 border-t border-slate-100 pt-4">
                                <span>Informe de Estrategia</span>
                                <span>{new Date().toLocaleDateString('es-ES')}</span>
                            </div>
                        </div>

                        {/* SECTION 1: EDITORIAL TABLE (Moved to Top) */}
                        <div id="pdf-page-1" className="bg-white p-8">
                            {/* HEADER PDF PAGE 1 */}
                            <div className="hidden pdf-visible-only h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                                <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span></span>
                            </div>

                            <div className="mb-6 flex justify-between items-end">
                                <h1 className="text-[#2C3E50] text-3xl font-light tracking-tight">Composición de la Cartera</h1>
                            </div>
                            <div className="pdf-hide-during-capture">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-black h-10">
                                            <th className="py-2 pl-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold w-[40%]">Fondo / Estrategia</th>
                                            <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Peso</th>
                                            <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Capital</th>
                                            <th className="py-2 pr-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">RIESGO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...portfolio].sort((a, b) => b.weight - a.weight).map((fund) => (
                                            <tr key={fund.isin} className="last:border-0 hover:bg-[#fcfcfc] transition-colors group">
                                                <td className="pr-8 pl-4 py-3 align-top">
                                                    <div className="text-[#2C3E50] font-[450] text-base leading-tight mb-1">
                                                        {fund.name}
                                                    </div>
                                                </td>
                                                <td className="align-top text-right text-[#2C3E50] font-[450] text-base tabular-nums py-3">
                                                    {fund.weight.toFixed(2)}%
                                                </td>
                                                <td className="align-top text-right text-[#2C3E50] font-[450] text-base tabular-nums py-3">
                                                    {((fund.weight / 100) * totalCapital).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                </td>
                                                <td className="align-top text-right pr-4 text-[#2C3E50] font-[450] text-sm tabular-nums py-3">
                                                    {(metrics.assets?.[fund.isin]?.volatility !== undefined)
                                                        ? (metrics.assets[fund.isin].volatility * 100).toFixed(2) + '%'
                                                        : (fund.std_perf?.volatility !== undefined)
                                                            ? (fund.std_perf.volatility * 100).toFixed(2) + '%'
                                                            : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="border-t border-black">
                                            <td className="py-6 pl-4 text-xl font-[550] text-[#2C3E50] tracking-tight">TOTAL CARTERA</td>
                                            <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">100.00%</td>
                                            <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">
                                                {totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                            </td>
                                            <td className="py-6 pr-4"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* PDF VERSION (Grouped) - Hidden on Screen */}
                            <div className="hidden pdf-show-during-capture">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-black h-10">
                                            <th className="py-2 pl-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold w-[40%]">Fondo / Estrategia</th>
                                            <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Peso</th>
                                            <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Capital</th>
                                            <th className="py-2 pr-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">RIESGO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* GROUPING LOGIC */}
                                        {Object.entries(
                                            [...portfolio].reduce((acc, fund) => {
                                                const category = fund.std_extra?.category || fund.std_type || 'SIN CLASIFICAR';
                                                if (!acc[category]) acc[category] = [];
                                                acc[category].push(fund);
                                                return acc;
                                            }, {} as Record<string, PortfolioItem[]>)
                                        ).sort((a, b) => a[0].localeCompare(b[0])).map(([category, funds]) => (
                                            <>
                                                {/* CATEGORY HEADER ROW */}
                                                <tr key={category} className="bg-slate-50 border-b border-slate-100">
                                                    <td colSpan={4} className="py-2 pl-4 text-[#2C3E50] text-xs font-bold uppercase tracking-widest pt-4">
                                                        {category}
                                                    </td>
                                                </tr>
                                                {/* FUND ROWS */}
                                                {funds.sort((a, b) => b.weight - a.weight).map((fund) => (
                                                    <tr key={fund.isin} className="last:border-0 hover:bg-[#fcfcfc] transition-colors group">
                                                        <td className="pr-8 pl-4 py-3 align-top">
                                                            <div className="text-[#2C3E50] font-[450] text-base leading-tight mb-1">
                                                                {fund.name}
                                                            </div>
                                                        </td>
                                                        <td className="align-top text-right text-[#2C3E50] font-[450] text-base tabular-nums py-3">
                                                            {fund.weight.toFixed(2)}%
                                                        </td>
                                                        <td className="align-top text-right text-[#2C3E50] font-[450] text-base tabular-nums py-3">
                                                            {((fund.weight / 100) * totalCapital).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                        </td>
                                                        <td className="align-top text-right pr-4 text-[#2C3E50] font-[450] text-sm tabular-nums py-3">
                                                            {(metrics.assets?.[fund.isin]?.volatility !== undefined)
                                                                ? (metrics.assets[fund.isin].volatility * 100).toFixed(2) + '%'
                                                                : (fund.std_perf?.volatility !== undefined)
                                                                    ? (fund.std_perf.volatility * 100).toFixed(2) + '%'
                                                                    : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </>
                                        ))}

                                        <tr className="border-t border-black">
                                            <td className="py-6 pl-4 text-xl font-[550] text-[#2C3E50] tracking-tight">TOTAL CARTERA</td>
                                            <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">100.00%</td>
                                            <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">
                                                {totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                            </td>
                                            <td className="py-6 pr-4"></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* SECTION 2 WRAPPER FOR PDF */}
                        <div id="pdf-page-2" className="bg-white p-8">
                            {/* HEADER PDF PAGE 2 */}
                            <div className="hidden pdf-visible-only h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                                <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span></span>
                            </div>

                            {/* SECTION 2: METRICS GRID (UPDATED STYLE) */}
                            <div>
                                <div className="mb-6">
                                    <h2 className="text-[#2C3E50] text-3xl font-light tracking-tight">Métricas de Cartera</h2>
                                </div>
                                <div className="flex justify-between gap-4 pb-8 border-b border-[#eeeeee]">
                                    {/* CUSTOM METRIC CARDS MATCHING SCREENSHOT */}
                                    {[
                                        { label: "RENTABILIDAD (CAGR)", value: metrics.metrics?.cagr ? (metrics.metrics.cagr * 100).toFixed(2) + "%" : "-", color: "text-[#2C3E50]" },
                                        { label: "VOLATILIDAD", value: metrics.metrics?.volatility ? (metrics.metrics.volatility * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" }, // RED
                                        { label: "RATIO SHARPE", value: metrics.metrics?.sharpe?.toFixed(2) || "-", color: "text-[#4d5bf9]" }, // BLUE/PURPLE
                                        { label: "MAX DRAWDOWN", value: metrics.metrics?.maxDrawdown ? (metrics.metrics.maxDrawdown * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" }, // RED
                                        { label: "TASA LIBRE RIESGO", value: metrics.metrics?.rf_rate ? (metrics.metrics.rf_rate * 100).toFixed(2) + "%" : "-", color: "text-[#2C3E50]" }
                                    ].map((m, i) => (
                                        <div key={i} className="flex-1 bg-[#F8FAFC] border border-[#f0f0f0] rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
                                            <div className="text-[10px] uppercase font-bold text-[#95a5a6] tracking-wide mb-2">{m.label}</div>
                                            <div className={`text-2xl font-normal ${m.color}`}>
                                                {m.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* SECTION 2b: TOP 10 HOLDINGS (Left) & DIVERSIFICATION (Right) */}
                            <div className="pt-12 border-t border-[#eeeeee] flex items-start justify-between">
                                {/* LEFT: Top 10 Holdings */}
                                <div className="w-[48%]">
                                    {sortedHoldings && sortedHoldings.length > 0 && (
                                        <div className="mb-0">
                                            <div className="flex items-center gap-4 mb-6">
                                                <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">10 Principales Posiciones</h3>
                                            </div>

                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-black h-10">
                                                        <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold w-[75%]">Activo / Sector</th>
                                                        <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Peso</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sortedHoldings.map((holding: any, idx: number) => (
                                                        <tr key={idx} className="last:border-0 hover:bg-[#fcfcfc] transition-colors group">
                                                            <td className="py-3 pr-8 align-top">
                                                                <div className="text-[#2C3E50] font-normal text-sm leading-tight mb-1">
                                                                    {holding.name || holding.isin}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 align-top text-right text-[#2C3E50] font-[450] text-sm tabular-nums">
                                                                {holding.weight.toFixed(2)}%
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* THICK TOTALS ROW FOR TOP 10 */}
                                                    <tr className="border-t border-black">
                                                        <td className="py-4 text-sm font-[550] text-[#2C3E50] tracking-tight text-right w-full pr-4">TOP 10 TOTAL</td>
                                                        <td className="py-4 text-right font-[550] text-[#2C3E50] text-base tabular-nums">
                                                            {sortedHoldings.reduce((acc: number, h: any) => acc + h.weight, 0).toFixed(2)}%
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT: Diversification Donut */}
                                <div className="w-[48%] flex flex-col items-center justify-start"> {/* Removed justify-center to prevent floating */}
                                    <div className="flex items-center gap-4 mb-8 justify-center shrink-0">
                                        <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Diversificación</h3>
                                        <span className="text-[#A07147] text-[10px] uppercase tracking-[0.2em] font-bold">Por Categorías</span>
                                    </div>
                                    <div className="w-full h-[350px] flex items-center justify-center relative z-0 mt-[60px]"> {/* Keep margin to force 1.5cm gap */}
                                        <DiversificationDonut assets={categoryAllocation} />
                                    </div>
                                </div>
                            </div>

                            {/* ROW 2: Style Boxes (Centered & Larger) */}
                            <div className="mt-12 flex justify-center items-center border-t border-[#eeeeee] pt-12">
                                <div className="flex gap-16 items-center justify-center transform scale-125 origin-top">
                                    <SimpleStyleBox type="equity" vertical={styleStats.equity.cap} horizontal={styleStats.equity.style} />
                                    <SimpleStyleBox type="fixed-income" vertical={styleStats.fi.credit === 'High' ? 'High' : styleStats.fi.credit === 'Low' ? 'Low' : 'Med'} horizontal={styleStats.fi.duration} />
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3: COMPARATIVE HISTORY CHART */}
                        <div className="border-t border-[#eeeeee] pt-12 mt-12 mb-12">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Evolución Comparativa</h3>
                            </div>
                            <ComparativeFundHistoryChart
                                funds={fundDatabase.filter(f => portfolio.some(p => p.isin === f.isin))}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* HIDDEN SECTION FOR PDF PAGE 3 (ADVANCED ANALYTICS) */}
            {metrics && (
                <div id="pdf-page-3" style={{ position: 'absolute', left: '-9999px', top: 0, width: '1200px', background: 'white', padding: '40px' }}>
                    {/* Header for Advanced Analytics */}
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 max-w-[1200px] w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Analítica <span className="font-bold">Avanzada</span></span>
                    </div>

                    {/* Evolución Histórica */}
                    <div className="mb-12">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Evolución Histórica</h3>
                        </div>
                        <div className="h-[400px] bg-[#fcfcfc] border border-[#f0f0f0] p-4">
                            <XRayChart
                                portfolioData={(metrics as any).portfolioSeries}
                                benchmarkData={undefined}
                                benchmarkLabel=""
                                portfolioLabel="10 años"
                            />
                        </div>
                    </div>

                    {/* Mapa de Riesgo */}
                    <div>
                        <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight mb-6">Mapa de Riesgo/Retorno</h3>
                        <div className="bg-[#fcfcfc] border border-[#f0f0f0] p-4 h-[400px]">
                            <RiskMap
                                portfolioMetrics={{
                                    volatility: metrics.metrics?.volatility,
                                    annual_return: metrics.metrics?.cagr
                                }}
                                benchmarks={((metrics as any).synthetics || []).map((s: any) => ({
                                    ...s,
                                    color: s.color || '#95a5a6'
                                }))}
                            />
                        </div>
                        {/* ADDING RISK EXPLANATION */}
                        {riskExplanation && (
                            <div className="mt-6 text-[#2C3E50] text-lg font-light leading-relaxed border-t border-[#eeeeee] pt-4">
                                {riskExplanation}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* HIDDEN PDF PAGE 4: CORRELATION MATRIX (LANDSCAPE) */}
            {metrics && (
                <div id="pdf-page-4" style={{ position: 'absolute', left: '-9999px', top: 0, width: '1500px', background: 'white', padding: '40px' }}>
                    {/* Header */}
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Matriz de <span className="font-bold">Correlaciones</span></span>
                    </div>

                    <div className="bg-[#fcfcfc] border border-[#f0f0f0] p-8 h-[800px] flex items-center justify-center">
                        <CorrelationHeatmap
                            matrix={(metrics as any).correlationMatrix}
                            assets={((metrics as any).effectiveISINs || Array.from(new Set(portfolio.map(p => p.isin)))).map((isin: string) => {
                                const f = portfolio.find(p => p.isin === isin)
                                return (f ? f.name : isin).substring(0, 15) + '...'
                            })}
                        />
                    </div>
                </div>
            )}
        </div >
    )
}

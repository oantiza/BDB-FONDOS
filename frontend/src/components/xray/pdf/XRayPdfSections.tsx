import React from 'react';
import { PortfolioItem } from '../../../types';
import DiversificationDonut from '../../charts/DiversificationDonut';
import DiversificationBars from '../../charts/DiversificationBars';
import EfficientFrontierChart from '../../charts/EfficientFrontierChart';
import XRayChart from '../../charts/XRayChart';
import RiskMap from '../../charts/RiskMap';

interface XRayPdfSectionsProps {
    portfolio: PortfolioItem[];
    totalCapital: number;
    metrics: any;
    globalAllocation: {
        equity: number;
        bond: number;
        cash: number;
        other: number;
        coverage: number;
    };
    categoryAllocation: { name: string; value: number; color?: string }[];
    frontierData: { x: number; y: number }[];
    assetPoints: { x: number; y: number; label: string }[];
    portfolioPoint: { x: number; y: number } | null;
    strategyReport: any;
    clientName: string;
    executionPlanText: string;
    compositionPages: any[][];
    getVolatilitySafe: (fund: any) => string;
}

export default function XRayPdfSections({
    portfolio,
    totalCapital,
    metrics,
    globalAllocation,
    categoryAllocation,
    frontierData,
    assetPoints,
    portfolioPoint,
    strategyReport,
    clientName,
    executionPlanText,
    compositionPages,
    getVolatilitySafe
}: XRayPdfSectionsProps) {

    // Helper for pagination (Removed, passed as prop)
    const pages = compositionPages;

    return (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            {/* 1. PAGINATION PAGES */}
            {pages.map((pageRows, pageIndex) => (
                <div id={`pdf-composition-page-${pageIndex}`} key={pageIndex} className="bg-white p-8" style={{ width: '1200px', marginBottom: '20px' }}>
                    {/* HEADER PDF PAGE */}
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span> {pages.length > 1 ? `(${pageIndex + 1}/${pages.length})` : ''}</span>
                    </div>

                    <div className="mb-6 flex justify-between items-end">
                        <h1 className="text-[#2C3E50] text-3xl font-light tracking-tight">Composición de la Cartera</h1>
                    </div>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-black h-10">
                                <th className="py-2 pl-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold w-[40%]">Fondo / Estrategia</th>
                                <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Peso</th>
                                <th className="py-2 pr-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Capital</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map((row, rIdx) => {
                                if (row.type === 'header') {
                                    return null;
                                }
                                if (row.type === 'fund') {
                                    const fund = row.content;
                                    return (
                                        <tr key={fund.isin} className="last:border-0 hover:bg-[#fcfcfc] transition-colors group">
                                            <td className="pr-8 pl-4 py-3 align-top">
                                                <div className="text-[#2C3E50] font-[450] text-base leading-tight mb-1">
                                                    {fund.name}
                                                </div>
                                            </td>
                                            <td className="align-top text-right text-[#2C3E50] font-[450] text-base tabular-nums py-3">
                                                {(fund.weight || 0).toFixed(2)}%
                                            </td>
                                            <td className="align-top text-right pr-4 text-[#2C3E50] font-[450] text-base tabular-nums py-3">
                                                {((fund.weight / 100) * totalCapital).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                            </td>
                                        </tr>
                                    );
                                }
                                if (row.type === 'total') {
                                    return (
                                        <tr key="total" className="border-t border-black">
                                            <td className="py-6 pl-4 text-xl font-[550] text-[#2C3E50] tracking-tight">TOTAL CARTERA</td>
                                            <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">100.00%</td>
                                            <td className="py-6 pr-4 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">
                                                {totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                            </td>
                                        </tr>
                                    );
                                }
                                return null;
                            })}
                        </tbody>
                    </table>
                </div>
            ))}

            {/* 2. SUMMARY PORTFOLIO FULL */}
            <div id="pdf-summary-portfolio-full" style={{ width: '1200px' }}>
                <div className="bg-white p-8">
                    {/* Header */}
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span></span>
                    </div>

                    <div className="mb-6 flex justify-between items-end">
                        <h1 className="text-black text-4xl font-light tracking-tight">Composición de la Cartera</h1>
                    </div>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-black h-10">
                                <th className="py-2 pl-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold w-[60%]">Fondo</th>
                                <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Peso</th>
                                <th className="py-2 pr-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Capital</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...portfolio].sort((a, b) => b.weight - a.weight).map((fund) => (
                                <tr key={fund.isin} className="last:border-0 hover:bg-[#fcfcfc] transition-colors group">
                                    <td className="pr-8 pl-4 py-3 align-top">
                                        <div className="text-black font-[450] text-xl leading-tight mb-1">
                                            {fund.name}
                                        </div>
                                    </td>
                                    <td className="align-top text-right text-black font-[450] text-xl tabular-nums py-3">
                                        {(fund.weight || 0).toFixed(2)}%
                                    </td>
                                    <td className="align-top text-right pr-4 text-black font-[450] text-xl tabular-nums py-3">
                                        {((fund.weight / 100) * totalCapital).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                </tr>
                            ))}
                            <tr className="border-t border-black">
                                <td className="py-6 pl-4 text-xl font-[550] text-[#2C3E50] tracking-tight">TOTAL CARTERA</td>
                                <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">100.00%</td>
                                <td className="py-6 pr-4 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">
                                    {totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. METRICS + DONUTS + FRONTIER PAGE (CUSTOM PAGE 2) */}
            {metrics && (
                <div id="pdf-page-2-custom" style={{ width: '1200px', background: 'white', padding: '40px' }}>
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span></span>
                    </div>
                    <div className="mb-16">
                        <h2 className="text-black text-4xl font-light tracking-tight">Métricas de Cartera</h2>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-[#eeeeee]" style={{ marginBottom: '60px', paddingBottom: '40px' }}>
                        {[
                            { label: "RENTABILIDAD (CAGR)", value: metrics.metrics?.cagr ? (metrics.metrics.cagr * 100).toFixed(2) + "%" : "-", color: "text-[#2C3E50]" },
                            { label: "VOLATILIDAD", value: metrics.metrics?.volatility ? (metrics.metrics.volatility * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" },
                            { label: "RATIO SHARPE", value: metrics.metrics?.sharpe?.toFixed(2) || "-", color: "text-[#4d5bf9]" },
                            { label: "MAX DRAWDOWN", value: metrics.metrics?.maxDrawdown ? (metrics.metrics.maxDrawdown * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" },
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
                    <div className="flex justify-between items-start" style={{ marginBottom: '80px' }}>
                        <div className="w-[45%] flex flex-col items-center">
                            <h3 className="text-black text-4xl font-light tracking-tight mb-[40px] text-center w-full border-b border-[#eeeeee] pb-4">
                                Composición Global <span className="block text-sm font-bold text-[#A07147] tracking-[0.2em] mt-2 uppercase">Por Activo Subyacente</span>
                            </h3>
                            <div style={{ width: '420px', height: '420px' }}>
                                <DiversificationDonut assets={[
                                    { name: 'Renta Variable', value: globalAllocation.equity },
                                    { name: 'Renta Fija', value: globalAllocation.bond },
                                    { name: 'Efectivo', value: globalAllocation.cash },
                                    { name: 'Otros', value: globalAllocation.other }
                                ].filter(x => x.value > 0.01)}
                                    staticPlot={true}
                                />
                            </div>
                        </div>
                        <div className="w-[50%] flex flex-col items-center">
                            <h3 className="text-black text-4xl font-light tracking-tight mb-[40px] text-center w-full border-b border-[#eeeeee] pb-4">
                                Diversificación <span className="block text-sm font-bold text-[#A07147] tracking-[0.2em] mt-2 uppercase">Por Categoría / Tipo</span>
                            </h3>
                            <div className="w-full mt-4">
                                <DiversificationBars assets={categoryAllocation} animate={false} />
                            </div>
                        </div>
                    </div>
                    <div className="w-full border-t border-[#eeeeee]" style={{ marginTop: '60px', paddingTop: '40px' }}>
                        <div className="p-4 border-b border-slate-50 flex justify-between items-center mb-14">
                            <h3 className="text-4xl font-light text-black tracking-tight">Frontera Eficiente</h3>
                        </div>
                        <div className="w-full h-[360px] relative">
                            <EfficientFrontierChart
                                frontierPoints={frontierData}
                                assetPoints={assetPoints}
                                portfolioPoint={portfolioPoint}
                                isLoading={false}
                                animate={false}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 4. METRICS FULL PAGE (Duplicate? Similar to above but cleaner) */}
            {metrics && (
                <div id="pdf-page-metrics-full" style={{ width: '1200px', background: 'white', padding: '40px' }}>
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span></span>
                    </div>
                    <div className="mb-16">
                        <h2 className="text-black text-4xl font-light tracking-tight">Métricas de Cartera</h2>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-[#eeeeee]" style={{ marginBottom: '60px', paddingBottom: '40px' }}>
                        {[
                            { label: "RENTABILIDAD (CAGR)", value: metrics.metrics?.cagr ? (metrics.metrics.cagr * 100).toFixed(2) + "%" : "-", color: "text-[#2C3E50]" },
                            { label: "VOLATILIDAD", value: metrics.metrics?.volatility ? (metrics.metrics.volatility * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" },
                            { label: "RATIO SHARPE", value: metrics.metrics?.sharpe?.toFixed(2) || "-", color: "text-[#4d5bf9]" },
                            { label: "MAX DRAWDOWN", value: metrics.metrics?.maxDrawdown ? (metrics.metrics.maxDrawdown * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" },
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
                    <div className="flex justify-between items-start" style={{ marginBottom: '80px' }}>
                        <div className="w-[45%] flex flex-col items-center">
                            <h3 className="text-black text-4xl font-light tracking-tight mb-[40px] text-center w-full border-b border-[#eeeeee] pb-4">
                                Composición Global <span className="block text-sm font-bold text-[#A07147] tracking-[0.2em] mt-2 uppercase">Por Activo Subyacente</span>
                            </h3>
                            <div style={{ width: '420px', height: '420px' }}>
                                <DiversificationDonut assets={[
                                    { name: 'Renta Variable', value: globalAllocation.equity },
                                    { name: 'Renta Fija', value: globalAllocation.bond },
                                    { name: 'Efectivo', value: globalAllocation.cash },
                                    { name: 'Otros', value: globalAllocation.other }
                                ].filter(x => x.value > 0.01)}
                                    staticPlot={true}
                                />
                            </div>
                        </div>
                        <div className="w-[50%] flex flex-col items-center">
                            <h3 className="text-black text-4xl font-light tracking-tight mb-[40px] text-center w-full border-b border-[#eeeeee] pb-4">
                                Diversificación <span className="block text-sm font-bold text-[#A07147] tracking-[0.2em] mt-2 uppercase">Por Categoría / Tipo</span>
                            </h3>
                            <div className="w-full mt-4">
                                <DiversificationBars assets={categoryAllocation} animate={false} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. COVER PAGE */}
            <div id="pdf-cover-page" style={{ width: '1200px', height: '1697px', background: '#003399' }}>
                <div className="relative w-full h-full p-20 flex flex-col justify-between text-white">
                    <div className="flex items-center gap-6">
                        <div className="w-2 h-24 bg-[#D4AF37]"></div>
                        <div className="text-4xl font-light tracking-[0.2em] uppercase">
                            FAMILY OFFICE PLANNER
                        </div>
                    </div>
                    <div className="mb-40">
                        <h2 className="text-5xl font-light mb-4 text-white/90">Informe de</h2>
                        <h1 className="text-[120px] font-bold text-[#D4AF37] leading-none mb-8">Cartera</h1>
                        <p className="text-3xl font-light text-white/80 max-w-2xl leading-relaxed">
                            Análisis detallado de composición, métricas de riesgo y proyección histórica.
                        </p>
                    </div>
                    <div className="flex justify-between items-end border-t border-white/20 pt-10">
                        <div>
                            <div className="mb-10">
                                <div className="text-[#D4AF37] text-sm font-bold uppercase tracking-widest mb-2">FECHA DE EMISIÓN</div>
                                <div className="text-4xl font-light">
                                    {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                            <div>
                                <div className="text-[#D4AF37] text-sm font-bold uppercase tracking-widest mb-1">GENERADO POR</div>
                                <div className="text-xl font-medium">O.A.A</div>
                            </div>
                        </div>
                        {clientName && (
                            <div className="text-right">
                                <div className="text-[#D4AF37] text-sm font-bold uppercase tracking-widest mb-2">CLIENTE</div>
                                <div className="text-4xl font-light">
                                    {clientName}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 6. EXECUTION PLAN */}
            {executionPlanText && (
                <div id="pdf-execution-plan" style={{ width: '1200px', background: 'white', padding: '40px' }}>
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Plan de <span className="font-bold">Ejecución</span></span>
                    </div>
                    <div className="mb-8">
                        <h1 className="text-black text-4xl font-light tracking-tight">Plan de Ejecución</h1>
                    </div>
                    <div className="text-black text-xl font-light leading-relaxed whitespace-pre-wrap">
                        {executionPlanText}
                    </div>
                </div>
            )}

            {/* 7. MACRO STRATEGY MATRIX */}
            {strategyReport && (
                <div id="pdf-macro-matrix-page-v2" style={{ width: '1200px', height: '1697px', background: 'white', padding: '60px' }}>
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-12 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Visión de <span className="font-bold">Mercado</span></span>
                    </div>
                    <div className="space-y-12">
                        {strategyReport.house_view_summary && (
                            <div className="bg-[#fcfcfc] border border-[#f0f0f0] p-10 text-center mb-12">
                                <h3 className="text-xs font-bold text-[#A07147] uppercase tracking-[0.2em] mb-6">Visión de la Casa</h3>
                                <p className="font-light italic text-3xl text-[#2C3E50] leading-relaxed">"{strategyReport.house_view_summary}"</p>
                            </div>
                        )}
                        {/* THE MATRIX (Keep it simple here, complex SVG/HTML structure above in original file, I'm simplifying slightly to save space but assuming rendering needed) */}
                        {/* For brevity, I'll include the main structure without every single item loop if possible, OR I must allow it to be fully rendered. 
                            Since this is for PDF generation, it MUST be fully rendered. I will include the loops. */
                        }
                        <div className="grid grid-cols-3 gap-12 items-start">
                            {/* COLUMN 1: RENTA VARIABLE */}
                            <div className="border-t-2 border-[#2C3E50] pt-4">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="text-xl">📈</span>
                                    <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-sm">Renta Variable</h3>
                                </div>
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4 border-b border-[#eeeeee] pb-1 w-full block">Geográfico</h4>
                                        <div className="space-y-3">
                                            {strategyReport.equity?.geo?.map((item: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center group">
                                                    <span className="font-medium text-[#1e293b] text-sm tracking-tight group-hover:text-[#003399] transition-colors">{item.name}</span>
                                                    <div title={item.view}>
                                                        {['POSITIVO', 'SOBREPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
                                                            </div>
                                                        ) : ['NEGATIVO', 'INFRAPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-2 h-0.5 bg-slate-400 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4 border-b border-[#eeeeee] pb-1 w-full block">Sectores</h4>
                                        <div className="space-y-3">
                                            {strategyReport.equity?.sectors?.map((item: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center group">
                                                    <span className="font-medium text-[#1e293b] text-sm tracking-tight group-hover:text-[#003399] transition-colors">{item.name}</span>
                                                    <div title={item.view}>
                                                        {['POSITIVO', 'SOBREPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
                                                            </div>
                                                        ) : ['NEGATIVO', 'INFRAPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-2 h-0.5 bg-slate-400 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* COLUMN 2: RENTA FIJA */}
                            <div className="border-t-2 border-[#2C3E50] pt-4">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="text-xl">🛡️</span>
                                    <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-sm">Renta Fija</h3>
                                </div>
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4 border-b border-[#eeeeee] pb-1 w-full block">Subsectores</h4>
                                        <div className="space-y-3">
                                            {strategyReport.fixed_income?.subsectors?.map((item: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center group">
                                                    <span className="font-medium text-[#1e293b] text-sm tracking-tight group-hover:text-[#003399] transition-colors">{item.name}</span>
                                                    <div title={item.view}>
                                                        {['POSITIVO', 'SOBREPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
                                                            </div>
                                                        ) : ['NEGATIVO', 'INFRAPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-2 h-0.5 bg-slate-400 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4 border-b border-[#eeeeee] pb-1 w-full block">Geográfico</h4>
                                        <div className="space-y-3">
                                            {strategyReport.fixed_income?.geo?.map((item: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center group">
                                                    <span className="font-medium text-[#1e293b] text-sm tracking-tight group-hover:text-[#003399] transition-colors">{item.name}</span>
                                                    <div title={item.view}>
                                                        {['POSITIVO', 'SOBREPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
                                                            </div>
                                                        ) : ['NEGATIVO', 'INFRAPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-2 h-0.5 bg-slate-400 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* COLUMN 3: ACTIVOS REALES */}
                            <div className="border-t-2 border-[#2C3E50] pt-4">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="text-xl">🧱</span>
                                    <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-sm">Activos Reales</h3>
                                </div>
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4 border-b border-[#eeeeee] pb-1 w-full block">Materias Primas</h4>
                                        <div className="space-y-3">
                                            {strategyReport.real_assets?.commodities?.map((item: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center group">
                                                    <span className="font-medium text-[#1e293b] text-sm tracking-tight group-hover:text-[#003399] transition-colors">{item.name}</span>
                                                    <div title={item.view}>
                                                        {['POSITIVO', 'SOBREPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
                                                            </div>
                                                        ) : ['NEGATIVO', 'INFRAPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-2 h-0.5 bg-slate-400 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4 border-b border-[#eeeeee] pb-1 w-full block">Divisas</h4>
                                        <div className="space-y-3">
                                            {strategyReport.real_assets?.currencies?.map((item: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center group">
                                                    <span className="font-medium text-[#1e293b] text-sm tracking-tight group-hover:text-[#003399] transition-colors">{item.name}</span>
                                                    <div title={item.view}>
                                                        {['POSITIVO', 'SOBREPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
                                                            </div>
                                                        ) : ['NEGATIVO', 'INFRAPONDERAR'].includes(item.view) ? (
                                                            <div className="w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                                                            </div>
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                                                                <div className="w-2 h-0.5 bg-slate-400 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. ADVANCED GRAPHICS PAGE (New) */}
            <div id="pdf-advanced-charts-page" className="bg-white p-8" style={{ width: '1200px', marginBottom: '20px' }}>
                <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                    <span className="font-light text-xl tracking-tight leading-none">Análisis <span className="font-bold">Avanzado</span></span>
                </div>

                <div className="space-y-24">
                    {/* Historical Evolution - Fixed 5Y/Moderate */}
                    <div className="h-[450px]">
                        <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight mb-6">Evolución Histórica <span className="text-lg text-slate-400 font-normal">(Backtest 5 Años)</span></h3>
                        <div className="h-[350px] bg-[#fcfcfc] border border-[#f0f0f0] p-4">
                            {metrics && metrics.portfolioSeries ? (
                                <XRayChart
                                    portfolioData={metrics.portfolioSeries}
                                    benchmarkData={metrics.containerBenchmarkSeries?.['moderate']}
                                    benchmarkLabel="Moderado"
                                    staticPlot={true} // Force static for PDF
                                />
                            ) : <div className="h-full flex items-center justify-center text-slate-300">Datos no disponibles</div>}
                        </div>
                    </div>

                    {/* Risk/Return Map */}
                    <div className="h-[450px]">
                        <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight mb-6">Mapa de Riesgo/Retorno</h3>
                        <div className="h-[350px] bg-[#fcfcfc] border border-[#f0f0f0] p-4 relative">
                            {metrics && metrics.metrics ? (
                                <RiskMap
                                    portfolioMetrics={{
                                        volatility: metrics.metrics.volatility,
                                        annual_return: metrics.metrics.cagr
                                    }}
                                    benchmarks={(metrics.synthetics || []).map((s: any) => ({
                                        ...s,
                                        color: s.color || '#95a5a6'
                                    }))}
                                    staticPlot={true} // Force static for PDF
                                />
                            ) : <div className="h-full flex items-center justify-center text-slate-300">Datos no disponibles</div>}
                        </div>
                    </div>
                </div>

                {/* Footer with date */}
                <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center text-slate-400 text-xs">
                    <span>Informe generado el {new Date().toLocaleDateString()}</span>
                    <span>Generado por BBDD Fondos</span>
                </div>
            </div>

            {/* 8. INDEX PAGE */}
            <div id="pdf-index-page" style={{ width: '1200px', height: '1697px', background: 'white', padding: '60px' }}>
                <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-20 w-full">
                    <span className="font-light text-xl tracking-tight leading-none">Contenido del <span className="font-bold">Informe</span></span>
                </div>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-6xl font-light text-[#003399] mb-20 tracking-tight">Índice</h1>
                    <div className="space-y-8 border-l-2 border-[#D4AF37] pl-10">
                        {[
                            { title: 'Resumen Ejecutivo', desc: 'Visión general y estado actual' },
                            { title: 'Matriz de Estrategia', desc: 'Asignación de activos y visión macro' },
                            { title: 'Análisis de Cartera', desc: 'Desglose detallado de posiciones y métricas' },
                            { title: 'Notas y Conclusiones', desc: 'Espacio para observaciones finales' }
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col">
                                <span className="text-4xl text-slate-800 font-light mb-1">{item.title}</span>
                                <span className="text-xl text-slate-400 font-light">{item.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 9. NOTES PAGE */}
            <div id="pdf-notes-page" style={{ width: '1200px', height: '1697px', background: 'white', padding: '60px' }}>
                <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-12 w-full">
                    <span className="font-light text-xl tracking-tight leading-none">Observaciones <span className="font-bold">Finales</span></span>
                </div>
                <h1 className="text-4xl font-light text-black mb-12 tracking-tight">Notas y Conclusiones</h1>
                <div className="w-full h-[1200px] border-2 border-slate-200 rounded-xl bg-slate-50 relative p-8">
                    <div className="absolute top-0 left-0 w-full h-12 border-b border-slate-200 bg-white rounded-t-xl"></div>
                    <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '100% 40px', marginTop: '40px' }}></div>
                </div>
            </div>
        </div>
    );
}

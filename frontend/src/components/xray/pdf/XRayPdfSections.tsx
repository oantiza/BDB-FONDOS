import React from 'react';
import { PortfolioItem } from '../../../types';
import GlobalAllocationChart from '../../charts/GlobalAllocationChart';
import EquityRegionChart from '../../charts/EquityRegionChart';
import EfficientFrontierChart from '../../charts/EfficientFrontierChart';
import XRayChart from '../../charts/XRayChart';
import RiskMap from '../../charts/RiskMap';
import { SmartPortfolioResponse } from '../../../types';

interface XRayPdfSectionsProps {
    portfolio: PortfolioItem[];
    totalCapital: number;
    metrics: SmartPortfolioResponse | null;
    globalAllocation: {
        equity: number;
        bond: number;
        cash: number;
        other: number;
        coverage: number;
    };
    categoryAllocation?: { name: string; value: number }[];
    regionAllocation: { name: string; value: number; color?: string }[];
    frontierData: { x: number; y: number }[];
    assetPoints: { x: number; y: number; label: string }[];
    portfolioPoint: { x: number; y: number } | null;
    strategyReport: any;
    clientName: string;
    executionPlanText: string;
    compositionPages: any[][];
    getVolatilitySafe: (fund: any) => string;
    benchmarkId: string;
    period?: string;
}

const PageFooter = ({ num }: { num: number }) => (
    <div className="absolute bottom-[2px] right-[60px] text-slate-400 text-sm font-light tracking-widest">
        {num < 10 ? `0${num}` : num}
    </div>
);

export default function XRayPdfSections({
    portfolio,
    totalCapital,
    metrics,
    globalAllocation,
    categoryAllocation = [],
    regionAllocation,
    frontierData,
    assetPoints,
    portfolioPoint,
    strategyReport,
    clientName,
    executionPlanText,
    compositionPages,
    getVolatilitySafe,
    benchmarkId,
    period = '3y' // Default
}: XRayPdfSectionsProps) {

    // Page numbering logic
    let pageCounter = 1;
    const getPageNum = () => pageCounter++;

    const getPeriodLabel = (p: string) => {
        switch (p) {
            case '1y': return '1 Año';
            case '3y': return '3 Años';
            case '5y': return '5 Años';
            case '10y': return '10 Años';
            case 'ytd': return 'YTD';
            default: return '3 Años';
        }
    };

    return (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            {/* 1. COVER PAGE (Page 1) - REDESIGN V2 (Blue/Gradient) */}
            <div id="pdf-cover-page" className="relative" style={{
                width: '1200px',
                height: '1697px',
                background: 'linear-gradient(to bottom right, #eff6ff, #ffffff)' // Soft blue to white
            }}>
                <div className="relative w-full h-full p-24 pt-20 flex flex-col justify-center">

                    {/* Top Brand (Generic) */}
                    <div className="absolute top-20 left-24">
                        <div className="flex items-center gap-3">
                            <span className="text-4xl font-light tracking-widest text-slate-800 uppercase">O.A.A.</span>
                            <span className="text-4xl font-light text-[#004481]">/</span>
                            <span className="text-base font-bold tracking-[0.2em] text-[#004481] uppercase mt-2">Independent Private Bankers</span>
                        </div>
                    </div>

                    <div className="flex gap-12 items-start">
                        {/* Vertical Blue Line */}
                        <div className="w-2 h-40 bg-[#004481] mt-2"></div>

                        <div>
                            <h1 className="text-[110px] font-bold text-slate-900 leading-none mb-6 tracking-tight">
                                Análisis de cartera
                            </h1>
                            <h2 className="text-5xl font-medium text-slate-800 mb-12">
                                {clientName || 'Informe de Estrategia'}
                            </h2>

                            <div className="space-y-2">
                                <div className="flex gap-4 items-center">
                                    <span className="text-base font-bold text-slate-500 uppercase tracking-widest w-64">NOMBRE DEL ARCHIVO</span>
                                    <span className="text-2xl font-light text-slate-900">Informe Resumen</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Date at Bottom Left */}
                    <div className="absolute bottom-20 left-24">
                        <div className="flex gap-4 items-baseline">
                            <span className="text-base font-bold text-slate-500 uppercase tracking-widest">FECHA DE CREACIÓN</span>
                            <span className="text-2xl font-light text-slate-900">
                                {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                        </div>
                    </div>

                    {/* Footer decoration or empty */}
                    <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-gradient-to-tl from-blue-50/50 to-transparent rounded-tl-full pointer-events-none"></div>
                </div>
            </div>

            {/* 2. INDEX PAGE (Page 2) */}
            <div id="pdf-index-page" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '40px 60px 22px 60px' }}>
                <div className="h-16 bg-gradient-to-r from-blue-50 to-white text-slate-800 flex items-center px-6 border-b border-blue-100 mb-20 w-full">
                    <span className="font-light text-[26px] tracking-tight leading-none pb-4">Contenido del <span className="font-bold">Informe</span></span>
                </div>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-7xl font-light text-[#003399] mb-20 tracking-tight">Índice</h1>
                    <div className="space-y-8 border-l-2 border-[#D4AF37] pl-10">
                        {[
                            { title: 'Resumen Ejecutivo', desc: 'Visión general y estado actual' },
                            { title: 'Matriz de Estrategia', desc: 'Asignación de activos y visión macro' },
                            { title: 'Análisis de Cartera', desc: 'Desglose detallado de posiciones y métricas' },
                            { title: 'Notas y Conclusiones', desc: 'Espacio para observaciones finales' }
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col">
                                <span className="text-5xl text-slate-800 font-light mb-1">{item.title}</span>
                                <span className="text-2xl text-slate-400 font-light">{item.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <PageFooter num={getPageNum()} />
            </div>

            {/* 3. MACRO STRATEGY MATRIX (Page 3 Optional) */}
            {strategyReport && (
                <div id="pdf-macro-matrix-page-v2" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '40px 60px 22px 60px' }}>
                    <div className="h-16 bg-gradient-to-r from-blue-50 to-white text-slate-800 flex items-center px-6 border-b border-blue-100 mb-12 w-full">
                        <span className="font-light text-[26px] tracking-tight leading-none pb-4">Visión de <span className="font-bold">Mercado</span></span>
                    </div>
                    <div className="space-y-12">
                        {strategyReport.house_view_summary && (
                            <div className="bg-[#fcfcfc] border border-[#f0f0f0] p-10 text-center mb-12">
                                <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em] mb-6">Visión de la Casa</h3>
                                <p className="font-light italic text-4xl text-[#2C3E50] leading-relaxed">"{strategyReport.house_view_summary}"</p>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-12 items-start">
                            {/* ... (Keep existing content logic, simplified for brevity in this view but should be fully present) ... */}
                            {/* Simplified for tool limit, but in real write I would keep content. Assuming I need to verify structure mostly. */}
                            {/* Re-inserting the content logic to ensure no regression */}
                            <StrategyMatrixContent strategyReport={strategyReport} />
                        </div>
                    </div>
                    <PageFooter num={getPageNum()} />
                </div>
            )}

            {/* 4. PAGINATION PAGES (Composition) */}
            {compositionPages.map((pageRows, pageIndex) => (
                <div id={`pdf-composition-page-${pageIndex}`} key={pageIndex} className="relative bg-white px-8 pb-0 pt-3" style={{ width: '1200px', height: '1697px', marginBottom: '20px' }}>
                    {/* ADDED HEIGHT TO FORCE A4 ON THESE TOO for consistency if needed, checking existing code it didn't have height but for pagination it implies pages. */}
                    {/* The layout before relied on auto height maybe? But to put footer at bottom we might need fixed height or just padding bottom. */}
                    {/* I will use min-height or standard height to ensure footer placement. */}

                    <div className="h-16 bg-gradient-to-r from-blue-50 to-white text-slate-800 flex items-center px-6 border-b border-blue-100 mb-8 w-full">
                        <span className="font-light text-[33px] tracking-tight leading-none pb-4">Análisis de <span className="font-bold">Cartera</span> {compositionPages.length > 1 ? `(${pageIndex + 1}/${compositionPages.length})` : ''}</span>
                    </div>

                    <div className="mb-6 flex justify-between items-end">
                        <h1 className="text-[#2C3E50] text-[47px] font-light tracking-tight">Composición de la Cartera</h1>
                    </div>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-black h-10">
                                <th className="py-2 pl-4 text-[#A07147] text-xl uppercase tracking-[0.2em] font-bold w-[40%]">Fondo / Estrategia</th>
                                <th className="py-2 text-[#A07147] text-xl uppercase tracking-[0.2em] font-bold text-right">Peso</th>
                                <th className="py-2 pr-4 text-[#A07147] text-xl uppercase tracking-[0.2em] font-bold text-right">Capital</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.map((row, rIdx) => {
                                if (row.type === 'header') return null;
                                if (row.type === 'fund') {
                                    const fund = row.content;
                                    return (
                                        <tr key={fund.isin} className="last:border-0 hover:bg-[#fcfcfc] transition-colors">
                                            <td className="pr-8 pl-4 py-3 align-top">
                                                <div className="text-[#2C3E50] font-[450] text-xl leading-tight mb-1">{fund.name}</div>
                                            </td>
                                            <td className="align-top text-right text-[#2C3E50] font-[450] text-xl tabular-nums py-3">{Number(fund.weight || 0).toFixed(2)}%</td>
                                            <td className="align-top text-right pr-4 text-[#2C3E50] font-[450] text-xl tabular-nums py-3">{((fund.weight / 100) * totalCapital).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                        </tr>
                                    );
                                }
                                if (row.type === 'total') {
                                    return (
                                        <tr key="total" className="border-t border-black">
                                            <td className="py-6 pl-4 text-3xl font-[550] text-[#2C3E50] tracking-tight">TOTAL CARTERA</td>
                                            <td className="py-6 text-right font-[550] text-[#2C3E50] text-3xl tabular-nums">100.00%</td>
                                            <td className="py-6 pr-4 text-right font-[550] text-[#2C3E50] text-3xl tabular-nums">{totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                        </tr>
                                    );
                                }
                                return null;
                            })}
                        </tbody>
                    </table>
                    <PageFooter num={getPageNum()} />
                </div>
            ))}

            {/* 5. METRICS + DONUTS + FRONTIER PAGE */}
            {metrics && (
                <div id="pdf-page-2-custom" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '20px 40px 2px 40px' }}>
                    <div className="h-16 bg-gradient-to-r from-blue-50 to-white text-slate-800 flex items-center px-6 border-b border-blue-100 mb-8 w-full">
                        <span className="font-light text-[33px] tracking-tight leading-none pb-4">Análisis de <span className="font-bold">Cartera</span></span>
                    </div>
                    {/* ... Content ... */}
                    <div className="mb-16">
                        <h2 className="text-black text-[47px] font-light tracking-tight">Métricas de Cartera</h2>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-[#eeeeee]" style={{ marginBottom: '30px', paddingBottom: '20px' }}>
                        {[
                            { label: "RENTABILIDAD (CAGR)", value: metrics.metrics?.cagr ? (metrics.metrics.cagr * 100).toFixed(2) + "%" : "-", color: "text-[#2C3E50]" },
                            { label: "VOLATILIDAD", value: metrics.metrics?.volatility ? (metrics.metrics.volatility * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" },
                            { label: "RATIO SHARPE", value: metrics.metrics?.sharpe?.toFixed(2) || "-", color: "text-[#4d5bf9]" },
                            { label: "MAX DRAWDOWN", value: metrics.metrics?.maxDrawdown ? (metrics.metrics.maxDrawdown * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" },
                            { label: "TASA LIBRE RIESGO", value: metrics.metrics?.rf_rate ? (metrics.metrics.rf_rate * 100).toFixed(2) + "%" : "-", color: "text-[#2C3E50]" }
                        ].map((m, i) => (
                            <div key={i} className="flex-1 bg-[#F8FAFC] border border-[#f0f0f0] rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
                                <div className="text-sm uppercase font-bold text-black tracking-wide mb-2">{m.label}</div>
                                <div className={`text-4xl font-normal ${m.color}`}>
                                    {m.value}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-start" style={{ marginBottom: '40px' }}>
                        <div className="w-[45%] flex flex-col items-center">
                            <h3 className="text-black text-[47px] font-light tracking-tight mb-[40px] text-center w-full border-b border-[#eeeeee] pb-4">
                                Composición Global <span className="block text-lg font-bold text-[#A07147] tracking-[0.2em] mt-2 uppercase">Por Activo Subyacente</span>
                            </h3>
                            <div className="w-full mt-4 max-w-[360px]">
                                <GlobalAllocationChart data={
                                    categoryAllocation && categoryAllocation.length > 0
                                        ? categoryAllocation.slice(0, 5).concat(
                                            categoryAllocation.length > 5
                                                ? [{ name: 'Otros', value: categoryAllocation.slice(5).reduce((acc, curr) => acc + curr.value, 0) }]
                                                : []
                                        )
                                        : [
                                            { name: 'Renta Variable', value: globalAllocation.equity },
                                            { name: 'Renta Fija', value: globalAllocation.bond },
                                            { name: 'Efectivo', value: globalAllocation.cash },
                                            { name: 'Otros', value: globalAllocation.other }
                                        ].filter(x => x.value > 0.01)
                                } />
                            </div>
                        </div>
                        <div className="w-[50%] flex flex-col items-center">
                            <h3 className="text-black text-[47px] font-light tracking-tight mb-[40px] text-center w-full border-b border-[#eeeeee] pb-4">
                                Diversificación <span className="block text-lg font-bold text-[#A07147] tracking-[0.2em] mt-2 uppercase">Por Geografía (RV)</span>
                            </h3>
                            <div className="w-full mt-4 max-w-[360px]">
                                <EquityRegionChart data={regionAllocation.slice(0, 5)} />
                            </div>
                        </div>
                    </div>
                    <div className="w-full border-t border-[#eeeeee]" style={{ marginTop: '20px', paddingTop: '20px' }}>
                        <div className="p-4 border-b border-slate-50 flex justify-between items-center mb-14">
                            <h3 className="text-[47px] font-light text-black tracking-tight">Frontera Eficiente</h3>
                        </div>
                        <div className="w-[90%] mx-auto h-[324px] relative border border-slate-200 rounded-sm p-4 bg-[#fcfcfc]">
                            <EfficientFrontierChart
                                frontierPoints={frontierData}
                                assetPoints={assetPoints}
                                portfolioPoint={portfolioPoint}
                                isLoading={false}
                                animate={false}
                                printMode={true}
                            />
                        </div>
                        <div className="w-[90%] mx-auto mt-6 px-1">
                            <h4 className="text-base font-bold text-[#A07147] uppercase tracking-widest mb-1">Curva de Rendimiento Ideal</h4>
                            <p className="text-lg text-slate-500 font-light leading-relaxed">
                                Representa el límite del "mejor resultado posible": es la línea que marca el máximo beneficio que se puede obtener para cada nivel de riesgo asumido.
                            </p>
                        </div>
                    </div>

                    <PageFooter num={getPageNum()} />
                </div>
            )}

            {/* 6. ADVANCED GRAPHICS PAGE */}
            <div id="pdf-advanced-charts-page" className="relative bg-white px-8 pb-0 pt-3" style={{ width: '1200px', height: '1697px', marginBottom: '20px' }}>
                <div className="h-16 bg-gradient-to-r from-blue-50 to-white text-slate-800 flex items-center px-6 border-b border-blue-100 mb-8 w-full">
                    {/* Increased size from text-2xl to text-3xl */}
                    <span className="font-light text-[33px] tracking-tight leading-none pb-4">Análisis <span className="font-bold">Avanzado</span></span>
                </div>

                <div className="space-y-[115px]">
                    <div>
                        {/* Increased size from text-4xl to text-5xl */}
                        <h3 className="text-[#2C3E50] text-[47px] font-light tracking-tight mb-[80px]">Evolución Histórica <span className="text-2xl text-slate-400 font-normal">(Backtest {getPeriodLabel(period)})</span></h3>
                        <div className="h-[410px] bg-[#fcfcfc] border border-[#f0f0f0] p-4">
                            {metrics && metrics.portfolioSeries ? (
                                <XRayChart
                                    portfolioData={metrics.portfolioSeries}
                                    benchmarkData={(metrics as any).containerBenchmarkSeries?.[benchmarkId] || metrics.benchmarkSeries?.[benchmarkId]}
                                    benchmarkLabel={benchmarkId ? benchmarkId.charAt(0).toUpperCase() + benchmarkId.slice(1) : 'Benchmark'}
                                    staticPlot={true}
                                    printMode={true}
                                />
                            ) : <div className="h-full flex items-center justify-center text-slate-300">Datos no disponibles</div>}
                        </div>
                    </div>

                    <div>
                        {/* INCREASED TITLE SIZE */}
                        <h3 className="text-[#2C3E50] text-[47px] font-light tracking-tight mb-[80px]">Mapa de Riesgo/Retorno</h3>
                        <div className="h-[410px] bg-[#fcfcfc] border border-[#f0f0f0] p-4 relative">
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
                                    staticPlot={true}
                                    printMode={true}
                                />
                            ) : <div className="h-full flex items-center justify-center text-slate-300">Datos no disponibles</div>}
                        </div>
                        <div className="mt-6 px-1">
                            {/* INCREASED LABEL AND TEXT SIZE */}
                            <h4 className="text-base font-bold text-[#A07147] uppercase tracking-widest mb-1">Balance de Eficiencia</h4>
                            <p className="text-xl text-slate-500 font-light leading-relaxed">
                                Este gráfico mide el beneficio frente a la estabilidad: cuanto más alto está su punto, más gana; cuanto más a la izquierda, más protegida está su inversión. Buscamos situarle siempre en la zona de máxima rentabilidad con el menor riesgo posible.
                            </p>
                        </div>
                        {metrics && metrics.metrics && metrics.synthetics && (
                            <div className="mt-8 text-xl text-[#2C3E50] font-light leading-relaxed bg-[#f8fafc] p-6 border border-slate-100 rounded-lg">
                                {(() => {
                                    const pVol = (metrics.metrics.volatility || 0) * 100;
                                    const pRet = (metrics.metrics.cagr || 0) * 100;

                                    // Find closest benchmark
                                    let closest: { vol: number; ret: number; name: string } | null = null;
                                    let minDist = Infinity;

                                    metrics.synthetics.forEach((b: any) => {
                                        const bVol = b.vol < 1 ? b.vol * 100 : b.vol;
                                        const bRet = b.ret < 1 ? b.ret * 100 : b.ret;
                                        const dist = Math.sqrt(Math.pow(bVol - pVol, 2) + Math.pow(bRet - pRet, 2));
                                        if (dist < minDist) {
                                            minDist = dist;
                                            closest = { ...b, vol: bVol, ret: bRet };
                                        }
                                    });

                                    if (!closest) return null;

                                    // Force cast to known structure to avoid TS never error if inference failed strangely
                                    const safeClosest = closest as { vol: number; ret: number; name: string };

                                    const alpha = pRet - safeClosest.ret;
                                    const alphaSign = alpha >= 0 ? '+' : '';

                                    return (
                                        <p>
                                            Su cartera (<b>{pVol.toFixed(1)}% Vol</b>) se comporta similar al perfil <b>{safeClosest.name}</b>.
                                            Sin embargo, genera un <b>Alpha</b> (Retorno Extra) de <b>{alphaSign}{alpha.toFixed(2)}%</b> respecto al mismo.
                                            {alpha > 0 ? ' ¡Buena eficiencia!' : ''}
                                        </p>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
                <PageFooter num={getPageNum()} />
            </div>

            {/* 7. EXECUTION PLAN */}
            {executionPlanText && (
                <div id="pdf-execution-plan" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '20px 40px 2px 40px' }}>
                    <div className="h-16 bg-gradient-to-r from-blue-50 to-white text-slate-800 flex items-center px-6 border-b border-blue-100 mb-8 w-full">
                        <span className="font-light text-[26px] tracking-tight leading-none pb-4">Plan de <span className="font-bold">Ejecución</span></span>
                    </div>
                    <div className="mb-8">
                        <h1 className="text-black text-[47px] font-light tracking-tight">Plan de Ejecución</h1>
                    </div>
                    <div className="text-black text-2xl font-light leading-relaxed whitespace-pre-wrap">
                        {executionPlanText}
                    </div>
                    <PageFooter num={getPageNum()} />
                </div>
            )}

            {/* 8. NOTES PAGE */}
            {/* Reverting Notes Page font size */}
            <div id="pdf-notes-page" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '40px 60px 22px 60px' }}>
                <div className="h-16 bg-gradient-to-r from-blue-50 to-white text-slate-800 flex items-center px-6 border-b border-blue-100 mb-12 w-full">
                    <span className="font-light text-[22px] tracking-tight leading-none pb-4">Observaciones <span className="font-bold">Finales</span></span>
                </div>
                <h1 className="text-4xl font-light text-black mb-12 tracking-tight">Notas y Conclusiones</h1>
                <div className="w-full h-[1200px] border-2 border-slate-200 rounded-xl bg-slate-50 relative p-8">
                    <div className="absolute top-0 left-0 w-full h-12 border-b border-slate-200 bg-white rounded-t-xl"></div>
                    <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '100% 40px', marginTop: '40px' }}></div>
                </div>
                <PageFooter num={getPageNum()} />
            </div>

            {/* 9. INTERPRETATION GUIDE PAGE */}
            {/* Keeping increased font size, ensuring text coherence */}
            <div id="pdf-interpretation-guide" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '40px 60px 22px 60px' }}>
                <div className="h-16 bg-gradient-to-r from-blue-50 to-white text-slate-800 flex items-center px-6 border-b border-blue-100 mb-9 w-full">
                    <span className="font-light text-[33px] tracking-tight leading-none pb-4">Guía de <span className="font-bold">Interpretación</span></span>
                </div>

                <div className="mb-11">
                    {/* Adjusted text as requested */}
                    <p className="font-light text-3xl text-[#2C3E50] leading-relaxed italic border-l-4 border-[#D4AF37] pl-8 py-2">
                        "Breve guía para ayudarle a interpretar los indicadores clave de su cartera."
                    </p>
                </div>

                <div className="space-y-7">
                    {/* 1. Volatilidad */}
                    <div>
                        <h3 className="text-[#2C3E50] font-bold text-2xl uppercase tracking-widest mb-1">1. Volatilidad</h3>
                        <div className="text-base font-bold text-[#A07147] uppercase tracking-[0.2em] mb-6">El indicador de estabilidad <span className="text-black font-normal normal-case">(¿Cuánto se mueve?)</span></div>

                        <p className="text-xl text-slate-600 font-light leading-relaxed text-justify bg-slate-50 p-4 rounded border border-slate-100">
                            <span className="font-bold text-[#2C3E50]">Interpretación:</span> A menudo se asocia erróneamente con "pérdida", pero técnicamente mide la incertidumbre. Una volatilidad baja refleja un comportamiento estable y tranquilo; una volatilidad alta implica oscilaciones más fuertes en el corto plazo. Nuestro objetivo es mantenerla siempre dentro del nivel de confort que usted ha definido.
                        </p>
                    </div>

                    {/* 2. Ratio de Sharpe */}
                    <div>
                        <h3 className="text-[#2C3E50] font-bold text-2xl uppercase tracking-widest mb-1">2. Ratio de Sharpe</h3>
                        <div className="text-base font-bold text-[#A07147] uppercase tracking-[0.2em] mb-6">La calidad de la rentabilidad <span className="text-black font-normal normal-case">(¿Vale la pena el riesgo?)</span></div>

                        <p className="text-xl text-slate-600 font-light leading-relaxed text-justify bg-slate-50 p-4 rounded border border-slate-100">
                            <span className="font-bold text-[#2C3E50]">Interpretación:</span> Nos dice cuánta rentabilidad extra estamos obteniendo por cada unidad de riesgo que asumimos. Un ratio alto es señal de una gestión excelente: significa que los beneficios se logran mediante decisiones inteligentes y no exponiendo su capital a peligros innecesarios.
                        </p>
                    </div>

                    {/* 3. Max Drawdown */}
                    <div>
                        <h3 className="text-[#2C3E50] font-bold text-2xl uppercase tracking-widest mb-1">3. Max Drawdown (Caída Máxima)</h3>
                        <div className="text-base font-bold text-[#A07147] uppercase tracking-[0.2em] mb-6">La prueba de resistencia <span className="text-black font-normal normal-case">(¿Cuál es el peor escenario?)</span></div>

                        <p className="text-xl text-slate-600 font-light leading-relaxed text-justify bg-slate-50 p-4 rounded border border-slate-100">
                            <span className="font-bold text-[#2C3E50]">Interpretación:</span> Representa la máxima caída acumulada que ha registrado la cartera desde un punto máximo anterior hasta que se recupera. Un dato controlado demuestra que la cartera tiene buenos mecanismos de defensa y solidez para proteger el patrimonio en ciclos bajistas.
                        </p>
                    </div>

                    {/* 4. Frontera Eficiente */}
                    <div>
                        <h3 className="text-[#2C3E50] font-bold text-2xl uppercase tracking-widest mb-1">4. Frontera Eficiente</h3>
                        <div className="text-base font-bold text-[#A07147] uppercase tracking-[0.2em] mb-6">El estándar de optimización <span className="text-black font-normal normal-case">(¿Es mi cartera eficiente?)</span></div>

                        <p className="text-xl text-slate-600 font-light leading-relaxed text-justify bg-slate-50 p-4 rounded border border-slate-100">
                            <span className="font-bold text-[#2C3E50]">Interpretación:</span> Cualquier punto situado sobre esta línea indica que la cartera está obteniendo la máxima rentabilidad posible para ese nivel de riesgo. Estar en la frontera eficiente significa que su dinero está trabajando a su máximo potencial; estar muy por debajo implicaría que podríamos obtener más retorno sin asumir más riesgo.
                        </p>
                    </div>

                    {/* 5. Mapa de Riesgo-Retorno */}
                    <div>
                        <h3 className="text-[#2C3E50] font-bold text-2xl uppercase tracking-widest mb-1">5. Mapa de Riesgo-Retorno</h3>
                        <div className="text-base font-bold text-[#A07147] uppercase tracking-[0.2em] mb-6">El contexto visual <span className="text-black font-normal normal-case">(¿Dónde estoy situado?)</span></div>

                        <p className="text-xl text-slate-600 font-light leading-relaxed text-justify bg-slate-50 p-4 rounded border border-slate-100">
                            <span className="font-bold text-[#2C3E50]">Interpretación:</span> El eje horizontal representa el Riesgo (Volatilidad) y el eje vertical el Retorno (Rentabilidad). <br /><br />
                            Hacia la derecha: Mayor riesgo/movimiento. <br />
                            Hacia arriba: Mayor ganancia esperada. <br /><br />
                            Su posición en este mapa le permite ver de un vistazo cómo se comporta su cartera en comparación con el mercado o con otros perfiles de inversión.
                        </p>
                    </div>
                </div>

                <PageFooter num={getPageNum()} />
            </div>
        </div>
    );
}

// Subcomponent for Matrix Content (Simplified for brevity but functionally keeps logic)
const StrategyMatrixContent = ({ strategyReport }: { strategyReport: any }) => (
    <>
        <div className="border-t-2 border-[#2C3E50] pt-4">
            <div className="flex items-center gap-3 mb-6">
                <span className="text-xl">📈</span>
                <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-sm">Renta Variable</h3>
            </div>
            <div className="space-y-8">
                {['geo', 'sectors'].map(k => (
                    <div key={k}>
                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4 border-b border-[#eeeeee] pb-1 w-full block">{k === 'geo' ? 'Geográfico' : 'Sectores'}</h4>
                        <div className="space-y-3">
                            {strategyReport.equity?.[k]?.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between items-center group">
                                    <span className="font-medium text-[#1e293b] text-sm tracking-tight">{item.name}</span>
                                    <ViewIndicator view={item.view} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <div className="border-t-2 border-[#2C3E50] pt-4">
            <div className="flex items-center gap-3 mb-6">
                <span className="text-xl">🛡️</span>
                <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-sm">Renta Fija</h3>
            </div>
            <div className="space-y-8">
                {['subsectors', 'geo'].map(k => (
                    <div key={k}>
                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4 border-b border-[#eeeeee] pb-1 w-full block">{k === 'geo' ? 'Geográfico' : 'Subsectores'}</h4>
                        <div className="space-y-3">
                            {strategyReport.fixed_income?.[k]?.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between items-center group">
                                    <span className="font-medium text-[#1e293b] text-sm tracking-tight">{item.name}</span>
                                    <ViewIndicator view={item.view} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
        <div className="border-t-2 border-[#2C3E50] pt-4">
            <div className="flex items-center gap-3 mb-6">
                <span className="text-xl">🧱</span>
                <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-sm">Activos Reales</h3>
            </div>
            <div className="space-y-8">
                {['commodities', 'currencies'].map(k => (
                    <div key={k}>
                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4 border-b border-[#eeeeee] pb-1 w-full block">{k === 'commodities' ? 'Materias Primas' : 'Divisas'}</h4>
                        <div className="space-y-3">
                            {strategyReport.real_assets?.[k]?.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between items-center group">
                                    <span className="font-medium text-[#1e293b] text-sm tracking-tight">{item.name}</span>
                                    <ViewIndicator view={item.view} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </>
);

const ViewIndicator = ({ view }: { view: string }) => (
    <div title={view}>
        {['POSITIVO', 'SOBREPONDERAR'].includes(view) ? (
            <div className="w-6 h-6 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm">
                <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
            </div>
        ) : ['NEGATIVO', 'INFRAPONDERAR'].includes(view) ? (
            <div className="w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shadow-sm">
                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
            </div>
        ) : (
            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                <div className="w-2 h-0.5 bg-slate-400 rounded-full"></div>
            </div>
        )}
    </div>
);

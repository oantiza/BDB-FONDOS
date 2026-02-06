import React from 'react';
import { PortfolioItem } from '../../../types';
import DiversificationDonut from '../../charts/DiversificationDonut';
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
}

const PageFooter = ({ num }: { num: number }) => (
    <div className="absolute bottom-[40px] right-[60px] text-slate-400 text-xs font-light tracking-widest">
        {num < 10 ? `0${num}` : num} | BDB FONDOS
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
    getVolatilitySafe
}: XRayPdfSectionsProps) {

    // Page numbering logic
    let pageCounter = 1;
    const getPageNum = () => pageCounter++;

    return (
        <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            {/* 1. COVER PAGE (Page 1) */}
            <div id="pdf-cover-page" className="relative" style={{ width: '1200px', height: '1697px', background: '#003399' }}>
                {/* Page numbering starts after cover */}
                {/* Visual cover usually doesn't have page number or is page 1 */}
                <div className="relative w-full h-full p-20 flex flex-col justify-between text-white">
                    <div className="flex items-center gap-6">
                        <div className="w-2 h-24 bg-[#D4AF37]"></div>
                        <div className="text-4xl font-light tracking-[0.2em] uppercase">
                            G.F.I.
                        </div>
                    </div>
                    <div className="mb-40">
                        <h2 className="text-5xl font-light mb-4 text-white/90">Informe de</h2>
                        <h1 className="text-[120px] font-bold text-[#D4AF37] leading-none mb-8">Cartera</h1>
                        <p className="text-3xl font-light text-white/80 max-w-2xl leading-relaxed">
                            Resumen Ejecutivo de Posiciones
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

            {/* 2. INDEX PAGE (Page 2) */}
            <div id="pdf-index-page" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '60px' }}>
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
                <PageFooter num={getPageNum()} />
            </div>

            {/* 3. MACRO STRATEGY MATRIX (Page 3 Optional) */}
            {strategyReport && (
                <div id="pdf-macro-matrix-page-v2" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '60px' }}>
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
                <div id={`pdf-composition-page-${pageIndex}`} key={pageIndex} className="relative bg-white p-8" style={{ width: '1200px', height: '1697px', marginBottom: '20px' }}>
                    {/* ADDED HEIGHT TO FORCE A4 ON THESE TOO for consistency if needed, checking existing code it didn't have height but for pagination it implies pages. */}
                    {/* The layout before relied on auto height maybe? But to put footer at bottom we might need fixed height or just padding bottom. */}
                    {/* I will use min-height or standard height to ensure footer placement. */}

                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span> {compositionPages.length > 1 ? `(${pageIndex + 1}/${compositionPages.length})` : ''}</span>
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
                                if (row.type === 'header') return null;
                                if (row.type === 'fund') {
                                    const fund = row.content;
                                    return (
                                        <tr key={fund.isin} className="last:border-0 hover:bg-[#fcfcfc] transition-colors">
                                            <td className="pr-8 pl-4 py-3 align-top">
                                                <div className="text-[#2C3E50] font-[450] text-base leading-tight mb-1">{fund.name}</div>
                                            </td>
                                            <td className="align-top text-right text-[#2C3E50] font-[450] text-base tabular-nums py-3">{Number(fund.weight || 0).toFixed(2)}%</td>
                                            <td className="align-top text-right pr-4 text-[#2C3E50] font-[450] text-base tabular-nums py-3">{((fund.weight / 100) * totalCapital).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                        </tr>
                                    );
                                }
                                if (row.type === 'total') {
                                    return (
                                        <tr key="total" className="border-t border-black">
                                            <td className="py-6 pl-4 text-xl font-[550] text-[#2C3E50] tracking-tight">TOTAL CARTERA</td>
                                            <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">100.00%</td>
                                            <td className="py-6 pr-4 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">{totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
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
                <div id="pdf-page-2-custom" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '40px' }}>
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span></span>
                    </div>
                    {/* ... Content ... */}
                    <div className="mb-16">
                        <h2 className="text-black text-4xl font-light tracking-tight">Métricas de Cartera</h2>
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
                                <div className="text-[10px] uppercase font-bold text-[#95a5a6] tracking-wide mb-2">{m.label}</div>
                                <div className={`text-2xl font-normal ${m.color}`}>
                                    {m.value}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-start" style={{ marginBottom: '40px' }}>
                        <div className="w-[45%] flex flex-col items-center">
                            <h3 className="text-black text-4xl font-light tracking-tight mb-[40px] text-center w-full border-b border-[#eeeeee] pb-4">
                                Composición Global <span className="block text-sm font-bold text-[#A07147] tracking-[0.2em] mt-2 uppercase">Por Activo Subyacente</span>
                            </h3>
                            <div style={{ width: '280px', height: '280px' }}>
                                <DiversificationDonut assets={
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
                                }

                                    staticPlot={true}
                                />
                            </div>
                            {/* CUSTOM LEGEND BELOW CHART */}
                            <div className="w-full flex flex-wrap justify-center gap-4 px-4">
                                {(
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
                                ).map((item, i) => (
                                    <div key={i} className="flex items-center gap-2 mb-1">
                                        <div className="w-3 h-3 rounded-sm" style={{
                                            backgroundColor: [
                                                '#0B2545', '#C5A059', '#4F46E5', '#64748B', '#1E3A8A', '#D4AF37', '#3B82F6', '#94A3B8'
                                            ][i % 8]
                                        }}></div>
                                        <span className="text-[#2C3E50] text-xs font-medium uppercase tracking-wider">
                                            {item.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="w-[50%] flex flex-col items-center">
                            <h3 className="text-black text-4xl font-light tracking-tight mb-[40px] text-center w-full border-b border-[#eeeeee] pb-4">
                                Diversificación <span className="block text-sm font-bold text-[#A07147] tracking-[0.2em] mt-2 uppercase">Por Geografía (RV)</span>
                            </h3>
                            <div className="w-full mt-4">
                                <EquityRegionChart data={regionAllocation.slice(0, 5)} />
                            </div>
                        </div>
                    </div>
                    <div className="w-full border-t border-[#eeeeee]" style={{ marginTop: '20px', paddingTop: '20px' }}>
                        <div className="p-4 border-b border-slate-50 flex justify-between items-center mb-14">
                            <h3 className="text-4xl font-light text-black tracking-tight">Frontera Eficiente</h3>
                        </div>
                        <div className="w-[90%] mx-auto h-[324px] relative border border-slate-200 rounded-sm p-4 bg-[#fcfcfc]">
                            <EfficientFrontierChart
                                frontierPoints={frontierData}
                                assetPoints={assetPoints}
                                portfolioPoint={portfolioPoint}
                                isLoading={false}
                                animate={false}
                            />
                        </div>
                        <div className="w-[90%] mx-auto mt-6 px-1">
                            <h4 className="text-xs font-bold text-[#A07147] uppercase tracking-widest mb-1">Curva de Rendimiento Ideal</h4>
                            <p className="text-sm text-slate-500 font-light leading-relaxed">
                                Representa el límite del "mejor resultado posible": es la línea que marca el máximo beneficio que se puede obtener para cada nivel de riesgo asumido.
                            </p>
                        </div>
                    </div>

                    <PageFooter num={getPageNum()} />
                </div>
            )}

            {/* 6. ADVANCED GRAPHICS PAGE */}
            <div id="pdf-advanced-charts-page" className="relative bg-white p-8" style={{ width: '1200px', height: '1697px', marginBottom: '20px' }}>
                <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                    <span className="font-light text-xl tracking-tight leading-none">Análisis <span className="font-bold">Avanzado</span></span>
                </div>

                <div className="space-y-[210px]">
                    <div>
                        <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight mb-[80px]">Evolución Histórica <span className="text-lg text-slate-400 font-normal">(Backtest 5 Años)</span></h3>
                        <div className="h-[410px] bg-[#fcfcfc] border border-[#f0f0f0] p-4">
                            {metrics && metrics.portfolioSeries ? (
                                <XRayChart
                                    portfolioData={metrics.portfolioSeries}
                                    benchmarkData={(metrics as any).containerBenchmarkSeries?.['moderate'] || metrics.benchmarkSeries?.['moderate']}
                                    benchmarkLabel="Moderado"
                                    staticPlot={true}
                                />
                            ) : <div className="h-full flex items-center justify-center text-slate-300">Datos no disponibles</div>}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight mb-[80px]">Mapa de Riesgo/Retorno</h3>
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
                                />
                            ) : <div className="h-full flex items-center justify-center text-slate-300">Datos no disponibles</div>}
                        </div>
                        <div className="mt-6 px-1">
                            <h4 className="text-xs font-bold text-[#A07147] uppercase tracking-widest mb-1">Balance de Eficiencia</h4>
                            <p className="text-sm text-slate-500 font-light leading-relaxed">
                                Este gráfico mide el beneficio frente a la estabilidad: cuanto más alto está su punto, más gana; cuanto más a la izquierda, más protegida está su inversión. Buscamos situarle siempre en la zona de máxima rentabilidad con el menor riesgo posible.
                            </p>
                        </div>
                        {metrics && metrics.metrics && metrics.synthetics && (
                            <div className="mt-8 text-sm text-[#2C3E50] font-light leading-relaxed bg-[#f8fafc] p-6 border border-slate-100 rounded-lg">
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

                                    const alpha = pRet - closest.ret;
                                    const alphaSign = alpha >= 0 ? '+' : '';

                                    return (
                                        <p>
                                            Su cartera (<b>{pVol.toFixed(1)}% Vol</b>) se comporta similar al perfil <b>{closest.name}</b>.
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
                <div id="pdf-execution-plan" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '40px' }}>
                    <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                        <span className="font-light text-xl tracking-tight leading-none">Plan de <span className="font-bold">Ejecución</span></span>
                    </div>
                    <div className="mb-8">
                        <h1 className="text-black text-4xl font-light tracking-tight">Plan de Ejecución</h1>
                    </div>
                    <div className="text-black text-xl font-light leading-relaxed whitespace-pre-wrap">
                        {executionPlanText}
                    </div>
                    <PageFooter num={getPageNum()} />
                </div>
            )}

            {/* 8. NOTES PAGE */}
            <div id="pdf-notes-page" className="relative" style={{ width: '1200px', height: '1697px', background: 'white', padding: '60px' }}>
                <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-12 w-full">
                    <span className="font-light text-xl tracking-tight leading-none">Observaciones <span className="font-bold">Finales</span></span>
                </div>
                <h1 className="text-4xl font-light text-black mb-12 tracking-tight">Notas y Conclusiones</h1>
                <div className="w-full h-[1200px] border-2 border-slate-200 rounded-xl bg-slate-50 relative p-8">
                    <div className="absolute top-0 left-0 w-full h-12 border-b border-slate-200 bg-white rounded-t-xl"></div>
                    <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '100% 40px', marginTop: '40px' }}></div>
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

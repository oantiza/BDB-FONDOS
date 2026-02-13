import React, { useState } from 'react';
import { useXRayData } from '../hooks/useXRayData';
import { generatePortfolioReport } from '../utils/generatePortfolioReport';
import { Fund, PortfolioItem } from '../types';

import Header from '../components/Header';
import HoldingsTable from '../components/xray/HoldingsTable';
import XRayMetrics from '../components/xray/XRayMetrics';
import AssetAllocationSection from '../components/xray/AssetAllocationSection';
import XRayPdfSections from '../components/xray/pdf/XRayPdfSections';
import XRayAnalyticsPage from './XRayAnalyticsPage';

import SimpleStyleBox from '../components/charts/SimpleStyleBox';
import ComparativeFundHistoryChart from '../components/charts/ComparativeFundHistoryChart';
import EfficientFrontierChart from '../components/charts/EfficientFrontierChart';


interface XRayPageProps {
    portfolio: PortfolioItem[];
    fundDatabase: Fund[];
    totalCapital: number;
    onBack: () => void;
}

export default function XRayPage({ portfolio, fundDatabase, totalCapital, onBack }: XRayPageProps) {
    // 1. Data Hook
    const {
        metrics,
        loading,
        errorMsg,
        categoryAllocation,
        regionAllocation,
        styleStats,
        globalAllocation,
        strategyReport,
        frontierData,
        assetPoints,
        portfolioPoint,
        getVolatilitySafe,
        compositionPages,
        equityRegionAllocation,
        // Controls
        period,
        setPeriod,
        benchmarkId,
        setBenchmarkId
    } = useXRayData(portfolio, fundDatabase);

    // 2. UI State
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [showReportConfig, setShowReportConfig] = useState(false);
    const [showPlanInput, setShowPlanInput] = useState(false);
    const [clientName, setClientName] = useState('');
    const [includeExecutionPlan, setIncludeExecutionPlan] = useState(false);
    const [executionPlanText, setExecutionPlanText] = useState('');

    // 3. Handlers
    const handleDownloadFullReport = () => {
        setShowReportConfig(true);
    };

    const handleConfigContinue = () => {
        if (includeExecutionPlan) {
            setShowReportConfig(false);
            setShowPlanInput(true);
        } else {
            handleGenerateFinalReport(false);
        }
    };

    const handleGenerateFinalReport = async (withPlan: boolean) => {
        const reportTitle = `informe_cartera_${new Date().toISOString().slice(0, 10)}.pdf`;

        // Construct IDs list
        const ids = [
            'pdf-cover-page',
            'pdf-index-page'
        ];

        if (strategyReport) ids.push('pdf-macro-matrix-page-v2');



        // Dynamic composition pages
        if (compositionPages && compositionPages.length > 0) {
            compositionPages.forEach((_: any, i: number) => {
                ids.push(`pdf-composition-page-${i}`);
            });
        }

        // Custom metrics page (Metrics + Donuts + Frontier)
        ids.push('pdf-page-2-custom');

        // New Advanced Charts Page (Backtest + Risk Map)
        ids.push('pdf-advanced-charts-page');

        if (withPlan && executionPlanText) {
            ids.push('pdf-execution-plan');
        }

        ids.push('pdf-notes-page');
        ids.push('pdf-interpretation-guide');

        await generatePortfolioReport(ids, reportTitle);
        setShowReportConfig(false);
        setShowPlanInput(false);
    };

    const handleDownloadSummaryReport = async () => {
        const ids = ['pdf-cover-page'];

        // Dynamic composition pages (Paginated)
        if (compositionPages && compositionPages.length > 0) {
            compositionPages.forEach((_: any, i: number) => {
                ids.push(`pdf-composition-page-${i}`);
            });
        }

        // Metrics & Advanced Charts
        ids.push('pdf-page-2-custom');
        ids.push('pdf-advanced-charts-page');
        ids.push('pdf-interpretation-guide');

        const dateStr = new Date().toISOString().slice(0, 10);
        await generatePortfolioReport(ids, `informe_resumen_${dateStr}.pdf`);
    };

    // 4. Render
    if (showAnalytics) {
        return (
            <XRayAnalyticsPage
                portfolio={portfolio}
                fundDatabase={fundDatabase}
                onBack={() => setShowAnalytics(false)}
                totalCapital={totalCapital}
                // Shared State
                metrics={metrics}
                loading={loading}
                errorMsg={errorMsg}
                period={period}
                setPeriod={setPeriod}
                benchmarkId={benchmarkId}
                setBenchmarkId={setBenchmarkId}
            />
        );
    }

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#003399]"></div>
        </div>
    );
    if (errorMsg) return <div className="p-8 text-red-600">Error: {errorMsg}</div>;

    const hasMetrics = !!metrics && !!metrics.metrics;

    return (
        <div className="flex flex-col h-screen bg-[#f8fafc]">
            <div className="fixed top-0 left-0 right-0 z-50">
                <Header onBack={onBack} onLogout={() => { }}>
                    {hasMetrics && (
                        <>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDownloadFullReport}
                                    disabled={loading}
                                    className="bg-white/10 hover:bg-white/20 text-white transition-colors text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-sm border border-white/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span>📄</span> Informe Completo
                                </button>
                                <button
                                    onClick={handleDownloadSummaryReport}
                                    disabled={loading}
                                    className="bg-[#D4AF37] hover:bg-[#b5952f] text-white transition-colors text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-sm border border-white/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    <span>📊</span> Informe Resumen
                                </button>
                            </div>

                            <button
                                onClick={() => setShowAnalytics(true)}
                                className="ml-4 text-white/70 hover:text-[#D4AF37] transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-1 group bg-white/5 px-3 py-1 rounded-full border border-white/10 hover:border-white/30"
                            >
                                Gráficos Avanzados <span className="group-hover:translate-x-0.5 transition-transform">↗</span>
                            </button>
                        </>
                    )}
                </Header>
            </div>
            <div className="flex-1 overflow-y-auto p-8 relative mt-16">
                <div className="max-w-[1400px] mx-auto bg-white p-8 shadow-sm border border-slate-100 min-h-[1000px]">

                    {/* SECTION 1: HOLDINGS TABLE */}
                    <div className="mb-8">
                        <HoldingsTable
                            portfolio={portfolio}
                            totalCapital={totalCapital}
                            getVolatilitySafe={getVolatilitySafe}
                        />
                    </div>

                    {/* SECTION 2: PDF PAGE 2 WRAPPER (Metrics, Allocation, Style) */}
                    <div id="pdf-page-2" className="bg-white pt-8 border-t border-slate-100 mt-8">
                        {/* Hidden Header for PDF (visible only when printing if class matches) */}
                        <div className="hidden pdf-visible-only h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 border-b border-white/10 mb-8 w-full">
                            <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span></span>
                        </div>

                        <XRayMetrics metrics={metrics} />

                        <AssetAllocationSection
                            globalAllocation={globalAllocation}
                            categoryAllocation={categoryAllocation}
                            equityRegionAllocation={equityRegionAllocation}
                        />

                        <div className="mt-20 flex justify-center items-center border-t border-[#eeeeee] pt-20">
                            <div className="flex gap-16 items-center justify-center transform scale-125 origin-top">
                                <SimpleStyleBox type="equity" vertical={styleStats.equity.cap} horizontal={styleStats.equity.style} />
                                <SimpleStyleBox type="fixed-income" vertical={styleStats.fi.credit === 'High' ? 'High' : styleStats.fi.credit === 'Low' ? 'Low' : 'Med'} horizontal={styleStats.fi.duration} />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: COMPARATIVE CHART */}
                    <div className="border-t border-[#eeeeee] pt-20 mt-20 mb-20">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Evolución Comparativa</h3>
                        </div>
                        <ComparativeFundHistoryChart
                            funds={fundDatabase.filter(f => portfolio.some(p => p.isin === f.isin))}
                        />
                    </div>

                    {/* SECTION 4: EFFICIENT FRONTIER (New Screen Visualization) */}
                    <div className="border-t border-[#eeeeee] pt-20 mt-20 mb-20 pb-20">
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Frontera Eficiente</h3>
                            <div className="text-xs font-bold text-[#A07147] uppercase tracking-[0.2em] bg-slate-50 px-3 py-1 rounded">Optimización Markowitz</div>
                        </div>
                        <div className="h-[450px] w-full bg-[#fcfcfc] border border-[#f0f0f0] p-6 relative">
                            <EfficientFrontierChart
                                frontierPoints={frontierData}
                                assetPoints={assetPoints}
                                portfolioPoint={portfolioPoint}
                                isLoading={loading}
                                animate={true}
                            />
                            <div className="mt-6 text-sm text-slate-400 italic font-light">
                                * Puntos calculados en base a la covarianza histórica de los últimos 3 años. El punto <span className="text-[#D4AF37] font-bold">Dorado</span> representa su selección actual.
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* HIDDEN PDF SECTIONS */}
            <XRayPdfSections
                portfolio={portfolio}
                totalCapital={totalCapital}
                metrics={metrics}
                globalAllocation={globalAllocation}
                categoryAllocation={categoryAllocation}
                regionAllocation={equityRegionAllocation} // FIX: Use Equity Region Allocation for PDF to match screen
                frontierData={frontierData}
                assetPoints={assetPoints}
                portfolioPoint={portfolioPoint}
                strategyReport={strategyReport}
                clientName={clientName}
                executionPlanText={executionPlanText}
                compositionPages={compositionPages}
                getVolatilitySafe={getVolatilitySafe}
                benchmarkId={benchmarkId}
                period={period}
            />

            {/* MODALS */}
            {showReportConfig && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-lg shadow-2xl max-w-lg w-full">
                        <h3 className="text-2xl font-light text-[#003399] mb-8 border-b pb-4">Configuración del Informe</h3>
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                                Nombre del Cliente <span className="text-slate-400 font-normal normal-case">(Opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="Ej. Cliente Preferente"
                                className="w-full p-3 border border-slate-300 rounded focus:border-[#003399] outline-none text-lg"
                            />
                        </div>
                        <div className="mb-8 flex items-center gap-4 p-4 bg-slate-50 rounded border border-slate-200 cursor-pointer" onClick={() => setIncludeExecutionPlan(!includeExecutionPlan)}>
                            <div className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${includeExecutionPlan ? 'bg-[#003399] border-[#003399]' : 'bg-white border-slate-400'}`}>
                                {includeExecutionPlan && <span className="text-white text-sm">✓</span>}
                            </div>
                            <div>
                                <div className="font-bold text-slate-700">Añadir Plan de Ejecución</div>
                                <div className="text-xs text-slate-500">Incluye una página extra para redactar instrucciones.</div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => setShowReportConfig(false)}
                                className="px-6 py-3 text-slate-500 hover:text-slate-800 font-bold uppercase text-sm tracking-wider"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfigContinue}
                                className="px-8 py-3 bg-[#D4AF37] text-white rounded hover:bg-[#b5952f] font-bold uppercase text-sm tracking-wider shadow-md"
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPlanInput && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-slate-100 p-8 rounded-xl shadow-2xl max-h-full overflow-y-auto flex flex-col items-center">
                        <div className="flex justify-between w-full max-w-[800px] mb-4">
                            <h3 className="text-white text-lg font-bold">Redactar Plan de Ejecución</h3>
                            <button onClick={() => setShowPlanInput(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="bg-white w-[210mm] min-h-[297mm] p-12 shadow-md relative flex flex-col">
                            <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center px-6 mb-8 w-full opacity-80 pointer-events-none select-none">
                                <span className="font-light text-xl tracking-tight leading-none">Plan de <span className="font-bold">Ejecución</span></span>
                            </div>
                            <h1 className="text-black text-4xl font-light tracking-tight mb-8 pointer-events-none select-none">Plan de Ejecución</h1>
                            <textarea
                                value={executionPlanText}
                                onChange={(e) => setExecutionPlanText(e.target.value)}
                                className="w-full flex-1 resize-none outline-none text-xl font-light leading-relaxed p-4 border border-dashed border-slate-300 hover:border-slate-400 focus:border-[#003399] rounded transition-colors"
                                placeholder="Escribe aquí el plan detallado de compras, ventas y rebalanceo..."
                                autoFocus
                            />
                        </div>
                        <div className="mt-8 flex gap-4">
                            <button
                                onClick={() => setShowPlanInput(false)}
                                className="px-6 py-3 bg-white text-slate-700 rounded shadow hover:bg-slate-50 font-bold uppercase tracking-widest text-xs"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleGenerateFinalReport(true)}
                                className="px-8 py-3 bg-[#D4AF37] text-white rounded shadow-lg hover:bg-[#b5952f] font-bold uppercase tracking-widest text-xs flex items-center gap-2"
                            >
                                <span>📄</span> Generar Informe con Plan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

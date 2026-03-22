import React, { useState, useRef, lazy, Suspense, useMemo } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db, functions } from '../firebase'
import { Download, Upload, Trash2, Lock, Unlock } from 'lucide-react'

// Components
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Controls from '../components/Controls'
import EfficientFrontierChart from '../components/charts/EfficientFrontierChart'
import PortfolioTable from '../components/PortfolioTable'
import { PortfolioMetricsCards } from '../components/PortfolioMetricsCards'
import ComparativeFundHistoryChart from '../components/charts/ComparativeFundHistoryChart'
import { DataQualityBadge, gradePortfolioQuality } from '../components/dashboard/DataQualityBadge'
import AssetDistributionWidget from '../components/dashboard/AssetDistributionWidget'

// Utilities & Services

import { exportToCSV } from '../utils/exportList'

// Hooks & Types
import { useDashboardData } from '../hooks/useDashboardData'
import { usePortfolioActions } from '../hooks/usePortfolioActions'
import { useToast } from '../context/ToastContext'
import { Fund, PortfolioItem, SmartPortfolioResponse, AllocationItem } from '../types'
import { MacroReport } from '../types/MacroReport'

import { lazyWithRetry } from '../utils/lazyWithRetry'

const CostsModal = lazyWithRetry(() => import('../components/modals/CostsModal'))
const TacticalModal = lazyWithRetry(() => import('../components/modals/TacticalModal'))
const MacroTacticalModal = lazyWithRetry(() => import('../components/modals/MacroTacticalModal'))
const OptimizationReviewModal = lazyWithRetry(() => import('../components/modals/OptimizationReviewModal'))
const VipFundsModal = lazyWithRetry(() => import('../components/VipFundsModal'))
const SharpeMaximizerModal = lazyWithRetry(() => import('../components/modals/SharpeMaximizerModal'))
const SavedPortfoliosModal = lazyWithRetry(() => import('../components/SavedPortfoliosModal'))
const FundDetailModal = lazyWithRetry(() => import('../components/FundDetailModal'))
const FundSwapModal = lazyWithRetry(() => import('../components/FundSwapModal').then(m => ({ default: m.FundSwapModal })))
const PortfolioAnalysisModal = lazyWithRetry(() => import('../components/modals/PortfolioAnalysisModal'))
const OptimizationStrategyModal = lazyWithRetry(() => import('../components/modals/OptimizationStrategyModal'))
interface DashboardPageProps {
    onLogout: () => void;
    onOpenMiBoutique: () => void;
    onOpenXRay: () => void;
    onOpenPositions: () => void;
    onOpenRetirement: () => void;
    onOpenComparator: () => void;

    // Portfolio State Props
    isAuthenticated: boolean;
    assets: Fund[];
    portfolio: PortfolioItem[];
    setPortfolio: (p: PortfolioItem[]) => void;
    proposedPortfolio: PortfolioItem[];
    setProposedPortfolio: (p: PortfolioItem[]) => void;
    riskLevel: number;
    setRiskLevel: (n: number) => void;
    numFunds: number;
    setNumFunds: (n: number) => void;
    totalCapital: number;
    setTotalCapital: (n: number) => void;
    vipFunds: string;
    setVipFunds: (s: string) => void;
    allocData: AllocationItem[];
    geoData: AllocationItem[];
}

export default function DashboardPage({
    onLogout,
    onOpenMiBoutique,
    onOpenXRay,
    onOpenPositions,
    onOpenRetirement,
    onOpenComparator,

    isAuthenticated,
    assets,
    portfolio, setPortfolio,
    proposedPortfolio, setProposedPortfolio,
    riskLevel, setRiskLevel,
    numFunds, setNumFunds,
    totalCapital, setTotalCapital,
    vipFunds, setVipFunds,
    allocData,
    geoData
}: DashboardPageProps) {

    // 1. BUSINESS LOGIC HOOKS
    const [isEditingCapital, setIsEditingCapital] = useState(false);
    const [capitalInputValue, setCapitalInputValue] = useState(totalCapital.toString());
    const {
        isOptimizing,
        modals, toggleModal,
        selectedFund, setSelectedFund,
        swapper, setSwapper,
        // Handlers
        handleAddAsset,
        handleRemoveAsset,
        handleUpdateWeight,
        handleOpenSwap,
        performSwap,
        handleManualGenerate,
        handleOptimize,
        handleApplyDirectly,
        handleReviewAccept,
        handleAcceptPortfolio,
        handleMacroApply,
        handleImportCSV,
        handleAnalyzePortfolio, // NEW
        handleFetchInteractiveFrontier, // NEW
        handleToggleLock,
        handleAutoCompletePortfolio,
        handleProceedStrategy,
        analysisResult, // NEW
        interactivePoint, // NEW
        explainabilityData
    } = usePortfolioActions({
        portfolio, setPortfolio,
        assets, riskLevel,
        numFunds,
        setProposedPortfolio,
        setTotalCapital,
        proposedPortfolio,
        vipFunds,
        totalCapital // NEW
    });

    // Removed global exposure hack

    const {
        historyData, frontierData, assetPoints, portfolioPoint,
        metrics1y, xrayMetrics, metrics5y, // New unified metrics
        regionAllocation, warnings, // [NEW] Backend Data
        isLoading, dashboardError
    } = useDashboardData(isAuthenticated, portfolio)

    // 2. UI STATE (View-specific)
    const [strategyReport, setStrategyReport] = useState<MacroReport | null>(null)

    const [riskFreeRate, setRiskFreeRate] = useState(0.0) // State for dynamic Rf

    // Fetch Risk Free Rate on mount
    React.useEffect(() => {
        const fetchRf = async () => {
            try {
                const fn = httpsCallable(functions, 'getRiskRate');
                const res = await fn() as any;
                if (res.data?.rate) setRiskFreeRate(res.data.rate);
            } catch (e) {
                console.warn("Failed to fetch RF rate:", e);
                setRiskFreeRate(0.0); // Fallback
            }
        }
        fetchRf();
    }, []);

    // Fetch Strategy Report
    React.useEffect(() => {
        const fetchStrategy = async () => {
            try {
                const q = query(
                    collection(db, 'reports'),
                    where('type', '==', 'STRATEGY')
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    // Cast to MacroReport and find the latest
                    const docs = snapshot.docs.map(d => d.data() as MacroReport);

                    // Helper for date sorting
                    const getMillis = (d: any) => {
                        if (!d) return 0;
                        if (d.seconds) return d.seconds * 1000;
                        if (d instanceof Date) return d.getTime();
                        return new Date(d).getTime();
                    };

                    docs.sort((a, b) => {
                        const tA = getMillis(a.createdAt || a.date);
                        const tB = getMillis(b.createdAt || b.date);
                        return tB - tA;
                    });

                    setStrategyReport(docs[0]);
                }
            } catch (e) {
                console.error("Failed to fetch strategy report:", e);
            }
        };
        fetchStrategy();
    }, []);

    // --- Performance Optimizations (C) ---
    // Memoize Portfolio Quality Grade
    const portfolioGrade = useMemo(() => {
        return gradePortfolioQuality(portfolio);
    }, [portfolio]);

    // Memoize expensive sorting/filtering for sidebar if assets list is huge (optional but good practice)
    // The Sidebar component likely does some filtering, but passing a stable reference can help if Sidebar is memoized.
    // Here we'll just keep the structure simple as requested (light optimization).

    const fileInputRef = useRef<HTMLInputElement>(null)
    const handleImportClick = () => { fileInputRef.current?.click() }
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (evt) => {
            const text = evt.target?.result as string
            handleImportCSV(text);
        };
        reader.readAsText(file)
        e.target.value = ''
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-100 font-sans text-slate-700">
            <Header
                onLogout={onLogout}
                onOpenMiBoutique={onOpenMiBoutique}
                onOpenXRay={onOpenXRay}
                onOpenPositions={onOpenPositions}
                onOpenRetirement={onOpenRetirement}
                onOpenComparator={onOpenComparator}
                isOptimizing={isOptimizing}
            />

            <div className="flex flex-1 overflow-hidden p-5 gap-5">
                <div className="w-[15%] h-full flex flex-col bg-white">
                    <div className="flex-1 overflow-hidden relative rounded-xl border border-slate-100 shadow-sm">
                        <Sidebar assets={assets} onAddAsset={handleAddAsset} onViewDetail={setSelectedFund} />
                    </div>
                </div>

                <div className="w-[58%] h-full flex flex-col gap-5">
                    <div className="h-1/3 grid grid-cols-2 gap-5 shrink-0">
                        {/* Efficient Frontier Chart */}
                        <div className="bg-white rounded-xl flex flex-col border border-slate-100 shadow-sm relative overflow-hidden group hover:border-slate-200 transition-colors">
                            <div className="py-3.5 px-4 bg-[#F8FAFC] border-b border-slate-200/60 flex justify-between items-center z-10">
                                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                                    Frontera Eficiente
                                </h3>
                            </div>
                            <div className="flex-1 w-full min-h-0 relative">
                                <span className="absolute top-2 left-0 right-0 text-center text-slate-500 font-bold text-[9px] uppercase tracking-widest z-10 pointer-events-none">
                                    Riesgo vs Retorno (3Y)
                                </span>
                                <div className="absolute inset-0 pt-6 pb-2 px-2">
                                    <EfficientFrontierChart
                                        frontierPoints={frontierData}
                                        assetPoints={assetPoints}
                                        portfolioPoint={interactivePoint || portfolioPoint}
                                        isLoading={isLoading}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="bg-white rounded-xl flex flex-col border border-slate-100 shadow-sm relative overflow-hidden group hover:border-slate-200 transition-colors">
                            <div className="py-3.5 px-4 bg-[#F8FAFC] border-b border-slate-200/60 flex justify-between items-center z-10">
                                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                                    Métricas Clave
                                </h3>
                            </div>
                            <div className="flex-1 min-h-0 relative">
                                <PortfolioMetricsCards
                                    metrics1y={metrics1y}
                                    metrics3y={xrayMetrics}
                                    metrics5y={metrics5y}
                                    rfLabel={`RF ${(riskFreeRate * 100).toFixed(2)}%`}
                                />
                            </div>
                        </div>
                    </div>

                    {dashboardError && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 mx-2 mb-2 text-red-700 text-xs flex justify-between items-center rounded-r shrink-0">
                            <span>⚠️ {dashboardError}</span>
                            <button onClick={() => window.location.reload()} className="underline hover:text-red-900 font-bold uppercase tracking-wider text-[10px]">Reintentar</button>
                        </div>
                    )}

                    {warnings && warnings.length > 0 && (
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 mx-2 mb-2 text-amber-700 text-xs flex flex-col gap-1 rounded-r shrink-0">
                            {warnings.map((w, idx) => (
                                <span key={idx}>⚠️ {w}</span>
                            ))}
                        </div>
                    )}

                    {/* Bottom Row: Portfolio Table */}
                    <div className="flex-1 overflow-hidden flex flex-col relative rounded-xl border border-slate-100 shadow-sm transition-colors hover:border-slate-200 bg-white">
                        <div className="py-3 px-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <h3 className="text-[12px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    Cartera de Fondos <span className="text-slate-400">({portfolio.length})</span>
                                </h3>

                                {portfolio.length > 0 && (
                                    <button
                                        onClick={() => {
                                            const allLocked = portfolio.every(p => p.isLocked);
                                            setPortfolio(portfolio.map(p => ({ ...p, isLocked: !allLocked })));
                                        }}
                                        className={`ml-2 text-[10px] font-semibold px-2.5 py-1.5 rounded-md border uppercase tracking-wider flex items-center gap-1.5 transition-colors ${portfolio.every(p => p.isLocked)
                                                ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        {portfolio.every(p => p.isLocked) ? <Unlock className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
                                        {portfolio.every(p => p.isLocked) ? 'Desbloquear Todos' : 'Bloquear Todos'}
                                    </button>
                                )}

                                {portfolio.length > 0 && portfolio.length < numFunds && (
                                    <button
                                        onClick={handleAutoCompletePortfolio}
                                        className="ml-2 bg-blue-50/50 hover:bg-blue-50 text-blue-600 text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-blue-100 uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                                    >
                                        <span>✨</span> Auto-completar (+{numFunds - portfolio.length})
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-2 border border-slate-200 px-3 py-1.5 rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Capital</span>
                                    <div className="flex items-baseline gap-1">
                                        {isEditingCapital ? (
                                            <input
                                                type="number"
                                                value={capitalInputValue}
                                                onChange={(e) => setCapitalInputValue(e.target.value)}
                                                onBlur={() => {
                                                    const val = parseFloat(capitalInputValue);
                                                    if (!isNaN(val) && val > 0) setTotalCapital(val);
                                                    setIsEditingCapital(false);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = parseFloat(capitalInputValue);
                                                        if (!isNaN(val) && val > 0) setTotalCapital(val);
                                                        setIsEditingCapital(false);
                                                    } else if (e.key === 'Escape') {
                                                        setIsEditingCapital(false);
                                                        setCapitalInputValue(totalCapital.toString());
                                                    }
                                                }}
                                                autoFocus
                                                className="w-24 text-slate-800 font-mono text-sm tracking-tight font-semibold bg-slate-50 border border-blue-300 rounded px-1 outline-none focus:ring-2 focus:ring-blue-100"
                                            />
                                        ) : (
                                            <span 
                                                className="text-slate-800 font-mono text-sm tracking-tight font-semibold cursor-text hover:text-blue-600 transition-colors"
                                                onClick={() => {
                                                    setCapitalInputValue(totalCapital.toString());
                                                    setIsEditingCapital(true);
                                                }}
                                                title="Hacer clic para editar"
                                            >
                                                {Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalCapital)}
                                            </span>
                                        )}
                                        <span className="text-slate-500 text-[10px] font-bold">EUR</span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center border border-slate-200 rounded-md bg-white divide-x divide-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                    <button 
                                        onClick={() => exportToCSV(portfolio, totalCapital)} 
                                        className="p-2 hover:bg-slate-50 text-[#00bcda] transition-colors" 
                                        title="Exportar CSV"
                                    >
                                        <Download className="w-4 h-4" strokeWidth={2.5} />
                                    </button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                                    <button 
                                        onClick={handleImportClick} 
                                        className="p-2 hover:bg-slate-50 text-[#00bcda] transition-colors"
                                        title="Importar CSV"
                                    >
                                        <Upload className="w-4 h-4" strokeWidth={2.5} />
                                    </button>
                                    <button 
                                        onClick={() => { if (window.confirm('¿Estás seguro de que quieres vaciar toda la cartera?')) setPortfolio([]) }} 
                                        className="p-2 hover:bg-red-50 text-red-400 transition-colors" 
                                        title="Vaciar Cartera"
                                    >
                                        <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            <PortfolioTable assets={portfolio} totalCapital={totalCapital} onRemove={handleRemoveAsset} onUpdateWeight={handleUpdateWeight} onFundClick={setSelectedFund} onSwap={handleOpenSwap} onToggleLock={handleToggleLock} />
                        </div>
                    </div>

                </div>

                <div className="flex-1 h-full flex flex-col overflow-y-auto scrollbar-thin gap-5 pb-0">
                    <div style={{ flex: 1.15 }} className="flex flex-col min-h-0">
                        <AssetDistributionWidget
                            portfolio={portfolio}
                            allocData={allocData}
                            regionAllocation={regionAllocation}
                        />
                    </div>

                    <div style={{ flex: 1 }} className="min-h-0">
                        <Controls className="h-full" riskLevel={riskLevel} setRiskLevel={setRiskLevel} numFunds={numFunds} setNumFunds={setNumFunds} onOptimize={handleOptimize} isOptimizing={isOptimizing} onManualGenerate={handleManualGenerate} onOpenCosts={() => toggleModal('costs', true)} onOpenXRay={onOpenXRay} onOpenTactical={() => { setProposedPortfolio(portfolio); toggleModal('tactical', true); }} onOpenMacro={() => toggleModal('macro', true)} vipFunds={vipFunds} setVipFunds={setVipFunds} onOpenVipModal={() => toggleModal('vip', true)} onOpenSharpeMaximizer={() => toggleModal('sharpeMaximizer', true)} onOpenSavedPortfolios={() => toggleModal('savedPortfolios', true)} />
                    </div>
                </div>
            </div>

            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center text-white">Cargando...</div>}>
                {modals.costs && <CostsModal portfolio={portfolio} assets={assets} totalCapital={totalCapital} onClose={() => toggleModal('costs', false)} />}
                {modals.vip && <VipFundsModal vipFundsStr={vipFunds} allFunds={assets} onSave={(newVal) => { setVipFunds(newVal); localStorage.setItem('ft_vipFunds', newVal); }} onClose={() => toggleModal('vip', false)} />}
                {modals.tactical && <TacticalModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} riskFreeRate={riskFreeRate} onAccept={handleAcceptPortfolio} onClose={() => toggleModal('tactical', false)} onSwap={handleOpenSwap} />}
                {modals.macro && <MacroTacticalModal portfolio={portfolio} allFunds={assets} numFunds={numFunds} onApply={handleMacroApply} onClose={() => toggleModal('macro', false)} />}
                {modals.review && <OptimizationReviewModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} riskFreeRate={riskFreeRate} currentMetrics={xrayMetrics} explainabilityData={explainabilityData} onAccept={handleReviewAccept} onApplyDirect={handleApplyDirectly} onClose={() => toggleModal('review', false)} />}
                {modals.sharpeMaximizer && <SharpeMaximizerModal isOpen={modals.sharpeMaximizer} onClose={() => toggleModal('sharpeMaximizer', false)} portfolio={portfolio} onAddFund={(fund) => { handleAddAsset(fund); toggleModal('sharpeMaximizer', false); }} currentSharpe={xrayMetrics?.metrics3y?.sharpe || 0} />}
                {modals.savedPortfolios && (
                    <SavedPortfoliosModal
                        isOpen={modals.savedPortfolios}
                        onClose={() => toggleModal('savedPortfolios', false)}
                        currentPortfolio={portfolio}
                        currentTotalCapital={totalCapital}
                        onLoadPortfolio={(items, cap) => {
                            setPortfolio(items);
                            setTotalCapital(cap);
                        }}
                    />
                )}
                {selectedFund && <FundDetailModal fund={selectedFund} onClose={() => setSelectedFund(null)} />}
                {modals.analysis && analysisResult && <PortfolioAnalysisModal result={analysisResult} onClose={() => toggleModal('analysis', false)} />}
                {modals.optimizationStrategy && (
                    <OptimizationStrategyModal
                        isOpen={modals.optimizationStrategy}
                        onClose={() => toggleModal('optimizationStrategy', false)}
                        onProceed={handleProceedStrategy}
                        lockedCount={portfolio.filter(p => p.isLocked).length}
                        newCount={portfolio.filter(p => !p.isLocked).length}
                        currentCapital={totalCapital}
                    />
                )}
                <FundSwapModal isOpen={swapper.isOpen} originalFund={swapper.fund} alternatives={swapper.alternatives} onSelect={performSwap} onClose={() => setSwapper(prev => ({ ...prev, isOpen: false, fund: null }))} onRefresh={handleOpenSwap} />
            </Suspense>
        </div >
    )
}

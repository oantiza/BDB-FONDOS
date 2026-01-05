import React, { useState, useRef, lazy, Suspense } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db, functions } from '../firebase'

// Components
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Controls from '../components/Controls'
import EfficientFrontierChart from '../components/charts/EfficientFrontierChart'
import PortfolioTable from '../components/PortfolioTable'
import PortfolioMetrics from '../components/dashboard/PortfolioMetrics'
import EquityDistribution from '../components/dashboard/EquityDistribution'
import FixedIncomeDistribution from '../components/dashboard/FixedIncomeDistribution'



// Dashboard Components
import SmartDonut from '../components/dashboard/SmartDonut'
import GeoDonut from '../components/dashboard/GeoDonut'

// Utilities & Services

import { exportToCSV } from '../utils/exportList'

// Hooks & Types
import { useDashboardData } from '../hooks/useDashboardData'
import { usePortfolioActions } from '../hooks/usePortfolioActions'
import { useToast } from '../context/ToastContext'
import { Fund, PortfolioItem, SmartPortfolioResponse, AllocationItem } from '../types'
import { MacroReport } from '../types/MacroReport'

// Modals (Code Splitting)
const CostsModal = lazy(() => import('../components/modals/CostsModal'))

const TacticalModal = lazy(() => import('../components/modals/TacticalModal'))
import MacroTacticalModal from '../components/modals/MacroTacticalModal'
const OptimizationReviewModal = lazy(() => import('../components/modals/OptimizationReviewModal'))
import FundDetailModal from '../components/FundDetailModal'
const VipFundsModal = lazy(() => import('../components/VipFundsModal'))
import { FundSwapModal } from '../components/FundSwapModal'




interface DashboardPageProps {
    onLogout: () => void;
    onOpenMiBoutique: () => void;
    onOpenXRay: () => void;
    onOpenPositions: () => void;

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
        handleImportCSV
    } = usePortfolioActions({
        portfolio, setPortfolio,
        assets, riskLevel,
        numFunds,
        setProposedPortfolio,
        setTotalCapital,
        proposedPortfolio
    });

    const {
        historyData,
        frontierData,
        assetPoints,
        portfolioPoint,
        isLoading,
        dashboardError
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
        <div className="h-screen flex flex-col overflow-hidden bg-white font-sans text-slate-700">
            <Header
                onLogout={onLogout}
                onOpenMiBoutique={onOpenMiBoutique}
                onOpenXRay={onOpenXRay}
                onOpenPositions={onOpenPositions}
            >
                {/* Clean header, no version or toggle */}
            </Header>

            <div className="flex flex-1 overflow-hidden p-6 gap-6">
                <div className="w-[15%] h-full flex flex-col bg-white">
                    <div className="flex-1 overflow-hidden relative rounded-xl border border-slate-100 shadow-sm">
                        <Sidebar assets={assets} onAddAsset={handleAddAsset} onViewDetail={setSelectedFund} />
                    </div>
                </div>

                <div className="w-[58%] h-full flex flex-col gap-6">
                    <div className="h-1/3 grid grid-cols-2 gap-6 shrink-0">
                        {/* Efficient Frontier Chart */}
                        <div className="bg-white rounded-xl flex flex-col border border-slate-100 shadow-sm relative overflow-hidden group hover:border-slate-200 transition-colors">
                            <div className="p-4 border-b border-slate-50 flex justify-between items-center z-10">
                                <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em] flex items-center gap-2">
                                    Frontera Eficiente
                                </h3>
                            </div>
                            <div className="flex-1 w-full min-h-0 relative">
                                <span className="absolute top-2 left-0 right-0 text-center text-slate-300 font-bold text-[9px] uppercase tracking-widest z-10 pointer-events-none">
                                    Riesgo vs Retorno (3Y)
                                </span>
                                <div className="absolute inset-0 pt-6 pb-2 px-2">
                                    <EfficientFrontierChart
                                        frontierPoints={frontierData}
                                        assetPoints={assetPoints}
                                        portfolioPoint={portfolioPoint}
                                        isLoading={isLoading}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl flex flex-col border border-slate-100 shadow-sm relative overflow-hidden group hover:border-slate-200 transition-colors">
                            <PortfolioMetrics
                                portfolio={portfolio}
                                riskFreeRate={riskFreeRate}
                                isLoading={isLoading}
                            />
                        </div>
                    </div>

                    {dashboardError && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-3 mx-2 mb-2 text-red-700 text-xs flex justify-between items-center rounded-r">
                            <span>⚠️ {dashboardError}</span>
                            <button onClick={() => window.location.reload()} className="underline hover:text-red-900 font-bold uppercase tracking-wider text-[10px]">Reintentar</button>
                        </div>
                    )}

                    <div className="flex-1 overflow-hidden flex flex-col relative rounded-xl border border-slate-100 shadow-sm transition-colors hover:border-slate-200">
                        <div className="flex-1 bg-white overflow-hidden relative flex flex-col">
                            <div className="p-4 border-b border-slate-50 flex justify-between items-center shrink-0 relative">
                                <h3 className="text-base font-bold text-[#A07147] uppercase tracking-[0.2em] flex items-center gap-2">
                                    Cartera de Fondos
                                </h3>
                                {/* Separator Line with Padding */}
                                <div className="absolute bottom-0 left-0 right-0 mx-6 border-b border-black/80"></div>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Capital</span>
                                    <div className="flex items-center border border-slate-200 rounded px-2 py-1 bg-slate-50">
                                        <input type="number" value={totalCapital} onChange={(e) => setTotalCapital(parseFloat(e.target.value))} className="bg-transparent text-slate-700 font-mono w-20 text-right text-sm outline-none" />
                                        <span className="text-slate-400 text-[10px] font-bold ml-1">EUR</span>
                                    </div>
                                    <div className="h-4 w-px bg-slate-100 mx-1"></div>

                                    <button onClick={() => exportToCSV(portfolio, totalCapital)} className="text-slate-400 hover:text-[#003399] transition-colors">📥</button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                                    <button onClick={handleImportClick} className="text-slate-400 hover:text-[#003399] transition-colors">📂</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden relative">
                                <PortfolioTable assets={portfolio} totalCapital={totalCapital} onRemove={handleRemoveAsset} onUpdateWeight={handleUpdateWeight} onFundClick={setSelectedFund} onSwap={handleOpenSwap} />
                            </div>
                        </div>
                    </div>


                </div>

                <div className="flex-1 h-full flex flex-col bg-white overflow-y-auto scrollbar-thin gap-6">
                    <div className="flex flex-col gap-6 flex-1">
                        <div className="bg-white border border-slate-100 rounded-xl shadow-sm flex flex-col shrink-0 h-full group hover:border-slate-200 transition-colors">
                            <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em]">
                                    Distribución de Activos
                                </h3>
                            </div>

                            <div className="flex flex-col h-full bg-white">

                                {/* Row 1: Equity & Fixed Income Distribution (Floating with Separator) */}
                                <div className="flex px-4 pt-4 border-b border-slate-50 flex-[1.5] min-h-0">
                                    <div className="flex-1 h-full overflow-hidden pr-6 border-r border-slate-100">
                                        <EquityDistribution portfolio={portfolio} />
                                    </div>
                                    <div className="flex-1 h-full overflow-hidden pl-6">
                                        <FixedIncomeDistribution portfolio={portfolio} />
                                    </div>
                                </div>

                                {/* Row 2: Donuts (Smaller) */}
                                {/* Row 2: Donuts (Floating) */}
                                <div className="flex flex-col px-4 pb-6 min-h-0 flex-1">
                                    <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                                        <div className="h-full relative flex flex-col items-center justify-center overflow-hidden">
                                            <SmartDonut allocation={allocData} />
                                        </div>
                                        <div className="h-full relative flex flex-col items-center justify-center overflow-hidden">
                                            <GeoDonut allocation={geoData} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 pb-0">
                        <Controls className="h-full" riskLevel={riskLevel} setRiskLevel={setRiskLevel} numFunds={numFunds} setNumFunds={setNumFunds} onOptimize={handleOptimize} isOptimizing={isOptimizing} onManualGenerate={handleManualGenerate} onOpenCosts={() => toggleModal('costs', true)} onOpenXRay={onOpenXRay} onOpenTactical={() => { setProposedPortfolio(portfolio); toggleModal('tactical', true); }} onOpenMacro={() => toggleModal('macro', true)} vipFunds={vipFunds} setVipFunds={setVipFunds} onOpenVipModal={() => toggleModal('vip', true)} />
                    </div>
                </div>
            </div>

            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center text-white">Cargando...</div>}>
                {modals.costs && <CostsModal portfolio={portfolio} totalCapital={totalCapital} onClose={() => toggleModal('costs', false)} />}
                {modals.vip && <VipFundsModal vipFundsStr={vipFunds} onSave={(newVal) => { setVipFunds(newVal); localStorage.setItem('ft_vipFunds', newVal); }} onClose={() => toggleModal('vip', false)} />}
                {modals.tactical && <TacticalModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} riskFreeRate={riskFreeRate} onAccept={handleAcceptPortfolio} onClose={() => toggleModal('tactical', false)} />}
                {modals.macro && <MacroTacticalModal portfolio={portfolio} onApply={handleMacroApply} onClose={() => toggleModal('macro', false)} />}
                {modals.review && <OptimizationReviewModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} riskFreeRate={riskFreeRate} onAccept={handleReviewAccept} onApplyDirect={handleApplyDirectly} onClose={() => toggleModal('review', false)} />}
                {selectedFund && <FundDetailModal fund={selectedFund} onClose={() => setSelectedFund(null)} />}
                <FundSwapModal isOpen={swapper.isOpen} originalFund={swapper.fund} alternatives={swapper.alternatives} onSelect={performSwap} onClose={() => setSwapper(prev => ({ ...prev, isOpen: false, fund: null }))} />
            </Suspense>
        </div >
    )
}

import React, { useState, useRef, lazy, Suspense } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

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
import { findAlternatives, Alternative } from '../utils/fundSwapper'
import { generateClientReport } from '../utils/pdfGenerator'
import { generateSmartPortfolio } from '../utils/rulesEngine'
import { parsePortfolioCSV } from '../utils/csvImport'
import { exportToCSV } from '../utils/exportList'

// Hooks & Types
import { useDashboardData } from '../hooks/useDashboardData'
import { Fund, PortfolioItem, SmartPortfolioResponse, AllocationItem } from '../types' // Added AllocationItem

// Modals (Code Splitting)
const CostsModal = lazy(() => import('../components/modals/CostsModal'))
// AnalysisModal removed
const TacticalModal = lazy(() => import('../components/modals/TacticalModal'))
import MacroTacticalModal from '../components/modals/MacroTacticalModal'
const OptimizationReviewModal = lazy(() => import('../components/modals/OptimizationReviewModal'))
import FundDetailModal from '../components/FundDetailModal'
const VipFundsModal = lazy(() => import('../components/VipFundsModal'))
import { FundSwapModal } from '../components/FundSwapModal'

interface DashboardPageProps {
    onLogout: () => void;
    onOpenMiBoutique: () => void;
}


interface DashboardPageProps {
    onLogout: () => void;
    onOpenMiBoutique: () => void;
    onOpenXRay: () => void;
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
    // 1. BUSINESS LOGIC HOOKS - REMOVED usePortfolio (LIFTED TO APP)

    // Dashboard Data still local

    const {
        historyData,
        frontierData,
        assetPoints,
        portfolioPoint,
        isLoadingFrontier,
        dashboardError
    } = useDashboardData(isAuthenticated, portfolio)

    // 2. UI STATE (View-specific)
    const [isOptimizing, setIsOptimizing] = useState(false)

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


    // Modals Visibility
    const [showCosts, setShowCosts] = useState(false)
    // showAnalysis removed
    const [showTactical, setShowTactical] = useState(false)
    const [showMacro, setShowMacro] = useState(false)
    const [showVipModal, setShowVipModal] = useState(false)
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [selectedFund, setSelectedFund] = useState<Fund | null>(null)

    // Swapper UI State
    const [isSwapOpen, setIsSwapOpen] = useState(false)
    const [fundToSwap, setFundToSwap] = useState<PortfolioItem | null>(null)
    const [swapAlternatives, setSwapAlternatives] = useState<Alternative[]>([])

    // 3. EVENT HANDLERS
    const handleAddAsset = (asset: Fund) => {
        if (portfolio.some(p => p.isin === asset.isin)) return
        const newItem: PortfolioItem = { ...asset, weight: 0 }
        setPortfolio([...portfolio, newItem])
    }

    const handleRemoveAsset = (isin: string) => {
        setPortfolio(portfolio.filter(p => p.isin !== isin))
    }

    const handleUpdateWeight = (isin: string, value: string) => {
        const newWeight = parseFloat(value) || 0
        setPortfolio(portfolio.map(p => p.isin === isin ? { ...p, weight: newWeight } : p))
    }

    const handleOpenSwap = (fund: PortfolioItem) => {
        const alts = findAlternatives(fund, assets, riskLevel);
        setFundToSwap(fund);
        setSwapAlternatives(alts);
        setIsSwapOpen(true);
    };

    const performSwap = (newFund: Fund) => {
        if (!fundToSwap) return;
        const updatedPortfolio = portfolio.map(item => {
            if (item.isin === fundToSwap.isin) {
                return { ...newFund, weight: item.weight, manualSwap: true };
            }
            return item;
        });
        setPortfolio(updatedPortfolio);
        setIsSwapOpen(false);
        setFundToSwap(null);
    };

    const handleManualGenerate = async () => {
        if (assets.length === 0) {
            alert("Cargando fondos... espera un momento.")
            return
        }
        try {
            setIsOptimizing(true)
            setPortfolio([])
            // Siempre usamos todos los assets, eliminamos filtro de categoría
            const pool = assets;

            const generated = generateSmartPortfolio(riskLevel, pool, numFunds);
            if (generated.length === 0) alert("No se encontraron fondos seguros para este perfil estricto.");
            else setPortfolio(generated.map(p => ({ ...p, weight: Math.round(p.weight * 100) / 100 })));
        } catch (e: any) {
            alert("Error local: " + (e.message || String(e)))
        } finally {
            setIsOptimizing(false)
        }
    }

    const handleOptimize = async () => {
        if (portfolio.length === 0) {
            alert("Añade fondos a la cartera primero")
            return
        }
        setIsOptimizing(true)
        try {
            const optimizeFn = httpsCallable(functions, 'optimize_portfolio_quant')
            const response = await optimizeFn({
                assets: portfolio.map(p => p.isin),
                risk_level: riskLevel,
                locked_assets: portfolio.filter(p => p.manualSwap).map(p => p.isin)
            })
            const result = response.data as SmartPortfolioResponse
            if (result.status === 'optimal' || result.status === 'fallback') {
                const weights = result.weights || {}
                let hasChanges = false
                const optimized = portfolio.map(p => {
                    const rawWeight = (weights[p.isin] || 0) * 100
                    const newWeight = Math.round(rawWeight * 100) / 100
                    if (Math.abs(newWeight - p.weight) > 0.5) hasChanges = true
                    return { ...p, weight: newWeight }
                }).filter(p => p.weight > 0.01)

                if (!hasChanges) {
                    alert("✅ La cartera ya está optimizada.")
                    setProposedPortfolio(optimized)
                    setShowTactical(true)
                } else {
                    setProposedPortfolio(optimized)
                    setShowReviewModal(true)
                }
            } else {
                alert("Error en la optimización: " + (result.warnings?.[0] || 'Desconocido'))
            }
        } catch (error: any) {
            alert("Error crítico al contactar el servidor: " + error.message)
        } finally {
            setIsOptimizing(false)
        }
    }

    const handleApplyDirectly = () => {
        setPortfolio(proposedPortfolio)
        setShowReviewModal(false)
    }

    const handleReviewAccept = () => {
        setShowReviewModal(false)
        setShowTactical(true)
    }

    const handleAcceptPortfolio = (newPortfolio: PortfolioItem[]) => {
        setPortfolio(newPortfolio)
        setShowTactical(false)
    }

    const handleMacroApply = (newProposal: PortfolioItem[]) => {
        setProposedPortfolio(newProposal)
        setShowMacro(false)
        setShowTactical(true)
    }

    const fileInputRef = useRef<HTMLInputElement>(null)
    const handleImportClick = () => { fileInputRef.current?.click() }
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (evt) => {
            const text = evt.target?.result as string
            const result = parsePortfolioCSV(text)
            if (result.error) { alert(result.error); return }
            if (window.confirm(`Se han detectado ${result.portfolio.length} fondos. ¿Reemplazar cartera actual?`)) {
                const enriched: PortfolioItem[] = result.portfolio.map(p => {
                    const known = assets.find(a => a.isin === p.isin) || { isin: p.isin, name: p.name || 'Unknown', std_type: 'Unknown' } as Fund
                    return { ...known, ...p, weight: p.weight }
                })
                setPortfolio(enriched)
                setTotalCapital(result.totalValue)
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-white font-sans text-slate-700">
            <Header
                onLogout={onLogout}
                onOpenMiBoutique={onOpenMiBoutique}
                onOpenXRay={onOpenXRay}
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
                                        isLoading={isLoadingFrontier}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Style & Structure Analytics -> REPLACED BY METRICS */}
                        <div className="bg-white rounded-xl flex flex-col border border-slate-100 shadow-sm relative overflow-hidden group hover:border-slate-200 transition-colors">
                            <PortfolioMetrics portfolio={portfolio} riskFreeRate={riskFreeRate} />
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
                            <div className="p-4 border-b border-slate-50 flex justify-between items-center shrink-0">
                                <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em] flex items-center gap-2">
                                    Cartera de Fondos
                                </h3>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Capital</span>
                                    <div className="flex items-center border border-slate-200 rounded px-2 py-1 bg-slate-50">
                                        <input type="number" value={totalCapital} onChange={(e) => setTotalCapital(parseFloat(e.target.value))} className="bg-transparent text-slate-700 font-mono w-20 text-right text-sm outline-none" />
                                        <span className="text-slate-400 text-[10px] font-bold ml-1">EUR</span>
                                    </div>
                                    <div className="h-4 w-px bg-slate-100 mx-1"></div>
                                    <button onClick={() => generateClientReport(portfolio, totalCapital, riskLevel)} className="text-[#C0392B] hover:text-[#e74c3c] transition-colors font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider" title="Descargar Informe PDF"><span>📄</span> PDF</button>
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
                                    Análisis de Cartera
                                </h3>
                            </div>

                            <div className="flex flex-col h-full bg-white">
                                {/* Row 1: Equity & Fixed Income Distribution (Larger) */}
                                <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-50 flex-[1.5] min-h-0">
                                    <div className="bg-[#fcfcfc] border border-slate-100 rounded-lg h-full overflow-hidden">
                                        <EquityDistribution portfolio={portfolio} />
                                    </div>
                                    <div className="bg-[#fcfcfc] border border-slate-100 rounded-lg h-full overflow-hidden">
                                        <FixedIncomeDistribution portfolio={portfolio} />
                                    </div>
                                </div>

                                {/* Row 2: Donuts (Smaller) */}
                                <div className="grid grid-cols-2 gap-4 p-4 flex-1 min-h-0">
                                    <div className="bg-[#fcfcfc] border border-slate-100 rounded-lg p-2 h-full relative flex flex-col items-center justify-center overflow-hidden">
                                        <SmartDonut allocation={allocData} />
                                    </div>
                                    <div className="bg-[#fcfcfc] border border-slate-100 rounded-lg p-2 h-full relative flex flex-col items-center justify-center overflow-hidden">
                                        <GeoDonut allocation={geoData} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 pb-0">
                        <Controls className="h-full" riskLevel={riskLevel} setRiskLevel={setRiskLevel} numFunds={numFunds} setNumFunds={setNumFunds} onOptimize={handleOptimize} isOptimizing={isOptimizing} onManualGenerate={handleManualGenerate} onOpenCosts={() => setShowCosts(true)} onOpenXRay={onOpenXRay} onOpenTactical={() => { setProposedPortfolio(portfolio); setShowTactical(true); }} onOpenMacro={() => setShowMacro(true)} vipFunds={vipFunds} setVipFunds={setVipFunds} onOpenVipModal={() => setShowVipModal(true)} />
                    </div>
                </div>
            </div>

            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center text-white">Cargando...</div>}>
                {showCosts && <CostsModal portfolio={portfolio} totalCapital={totalCapital} onClose={() => setShowCosts(false)} />}
                {showVipModal && <VipFundsModal vipFundsStr={vipFunds} onSave={(newVal) => { setVipFunds(newVal); localStorage.setItem('ft_vipFunds', newVal); }} onClose={() => setShowVipModal(false)} />}
                {/* AnalysisModal removed */}
                {showTactical && <TacticalModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} riskFreeRate={riskFreeRate} onAccept={handleAcceptPortfolio} onClose={() => setShowTactical(false)} />}
                {showMacro && <MacroTacticalModal portfolio={portfolio} onApply={handleMacroApply} onClose={() => setShowMacro(false)} />}
                {showReviewModal && <OptimizationReviewModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} riskFreeRate={riskFreeRate} onAccept={handleReviewAccept} onApplyDirect={handleApplyDirectly} onClose={() => setShowReviewModal(false)} />}
                {selectedFund && <FundDetailModal fund={selectedFund} onClose={() => setSelectedFund(null)} />}
                <FundSwapModal isOpen={isSwapOpen} originalFund={fundToSwap} alternatives={swapAlternatives} onSelect={performSwap} onClose={() => setIsSwapOpen(false)} />
            </Suspense>
        </div>
    )
}

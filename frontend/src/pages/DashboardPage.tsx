import React, { useState, useRef, lazy, Suspense } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

// Components
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Controls from '../components/Controls'
import EfficientFrontierChart from '../components/charts/EfficientFrontierChart'
import PortfolioTable from '../components/PortfolioTable'
import StyleAnalytics from '../components/dashboard/StyleAnalytics'

// Dashboard Components
import SmartDonut from '../components/dashboard/SmartDonut'
import GeoDonut from '../components/dashboard/GeoDonut'
import KPICards from '../components/dashboard/KPICards'
import RiskMonitor from '../components/dashboard/RiskMonitor'

// Utilities & Services
import { findAlternatives } from '../utils/fundSwapper'
import { generateClientReport } from '../utils/pdfGenerator'
import { generateSmartPortfolio } from '../utils/rulesEngine'
import { parsePortfolioCSV } from '../utils/csvImport'
import { exportToCSV } from '../utils/exportList'

// Hooks & Types
import { usePortfolio } from '../hooks/usePortfolio'
import { useDashboardData } from '../hooks/useDashboardData'
import { Fund, PortfolioItem, SmartPortfolioResponse } from '../types'

// Modals (Code Splitting)
const NewsModal = lazy(() => import('../components/modals/NewsModal'))
const CostsModal = lazy(() => import('../components/modals/CostsModal'))
const AnalysisModal = lazy(() => import('../components/modals/AnalysisModal'))
const TacticalModal = lazy(() => import('../components/modals/TacticalModal'))
const MacroTacticalModal = lazy(() => import('../components/modals/MacroTacticalModal'))
const OptimizationReviewModal = lazy(() => import('../components/modals/OptimizationReviewModal'))
import FundDetailModal from '../components/FundDetailModal'
const VipFundsModal = lazy(() => import('../components/VipFundsModal'))
import { FundSwapModal } from '../components/FundSwapModal'

interface DashboardPageProps {
    onLogout: () => void;
    onOpenMiBoutique: () => void;
}

export default function DashboardPage({ onLogout, onOpenMiBoutique }: DashboardPageProps) {
    // 1. BUSINESS LOGIC HOOKS
    // Note: We assume isAuthenticated is true if this component is rendered
    const {
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
    } = usePortfolio()

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
    const [compactMode, setCompactMode] = useState(false)

    // Modals Visibility
    const [showNews, setShowNews] = useState(false)
    const [showCosts, setShowCosts] = useState(false)
    const [showAnalysis, setShowAnalysis] = useState(false)
    const [showTactical, setShowTactical] = useState(false)
    const [showMacro, setShowMacro] = useState(false)
    const [showVipModal, setShowVipModal] = useState(false)
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [selectedFund, setSelectedFund] = useState<Fund | null>(null)

    // Swapper UI State
    const [isSwapOpen, setIsSwapOpen] = useState(false)
    const [fundToSwap, setFundToSwap] = useState<PortfolioItem | null>(null)
    const [swapAlternatives, setSwapAlternatives] = useState<Fund[]>([])

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

    const [selectedCategory, setSelectedCategory] = useState('All')
    const categories = [...new Set(assets.map(a => a.std_extra?.category || 'Unknown'))].filter(c => c !== 'Unknown').sort()

    const handleManualGenerate = async () => {
        if (assets.length === 0) {
            alert("Cargando fondos... espera un momento.")
            return
        }
        try {
            setIsOptimizing(true)
            setPortfolio([])
            let pool = assets;
            if (selectedCategory !== 'All') {
                pool = assets.filter(a => a.std_extra?.category === selectedCategory);
            }
            const generated = generateSmartPortfolio(riskLevel, pool, numFunds);
            if (generated.length === 0) alert("No se encontraron fondos seguros para este perfil estricto.");
            else setPortfolio(generated);
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
                    const newWeight = (weights[p.isin] || 0) * 100
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
                    return { ...known, ...p, weight: parseFloat(p.weight) }
                })
                setPortfolio(enriched)
                setTotalCapital(result.totalValue)
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    return (
        <div className={`h-screen flex flex-col overflow-hidden bg-gray-50 font-sans text-gray-900 ${compactMode ? 'text-[0.9em]' : ''}`}>
            <Header
                onLogout={onLogout}
                onOpenNews={() => setShowNews(true)}
                onOpenMiBoutique={onOpenMiBoutique}
            >
                <button
                    onClick={() => setCompactMode(!compactMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ml-4 ${compactMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                    {compactMode ? '📱 14"' : '🖥️ Std'}
                </button>
            </Header>

            <div className={`flex flex-1 overflow-hidden ${compactMode ? 'p-1 gap-1' : 'p-2 gap-2'}`}>
                <div className="w-[15%] h-full flex flex-col bg-slate-100">
                    <div className="flex-1 overflow-hidden relative rounded-lg border border-slate-200">
                        <Sidebar assets={assets} onAddAsset={handleAddAsset} onViewDetail={setSelectedFund} />
                    </div>
                </div>

                <div className="w-[58%] h-full flex flex-col bg-slate-100 dark:bg-slate-800 gap-2">
                    <div className={`${compactMode ? 'h-[25vh]' : 'h-1/3'} grid grid-cols-2 gap-2 shrink-0`}>
                        {/* Efficient Frontier Chart */}
                        <div className="bg-white dark:bg-slate-800 rounded-lg flex flex-col border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                            <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center z-10">
                                <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                                    <span className="text-base">🚀</span>
                                    <span>Frontera Eficiente</span>
                                </h3>
                            </div>
                            <div className="flex-1 w-full min-h-0 relative">
                                <span className="absolute top-2 left-0 right-0 text-center text-slate-400 font-medium text-[10px] tracking-tight z-10 pointer-events-none">
                                    RIESGO VS RETORNO (3Y)
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

                        {/* Style & Structure Analytics */}
                        <div className="bg-white rounded-lg flex flex-col border border-slate-200 shadow-sm relative overflow-hidden">
                            <StyleAnalytics portfolio={portfolio} />
                        </div>
                    </div>

                    {dashboardError && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-2 mx-2 mb-2 text-red-700 text-xs flex justify-between items-center">
                            <span>⚠️ {dashboardError}</span>
                            <button onClick={() => window.location.reload()} className="underline hover:text-red-900 font-bold">Reintentar</button>
                        </div>
                    )}

                    <div className="flex-1 overflow-hidden flex flex-col relative rounded-lg border border-slate-200">
                        <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden relative flex flex-col">
                            <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                                <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                                    <span className="text-base">💼</span> Cartera de Fondos
                                </h3>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-slate-500 font-bold uppercase">Capital:</span>
                                    <input type="number" value={totalCapital} onChange={(e) => setTotalCapital(parseFloat(e.target.value))} className="bg-white border border-slate-200 text-slate-800 font-mono px-2 py-0.5 w-24 text-right" />
                                    <span className="text-slate-500 font-bold">€</span>
                                    <button onClick={() => generateClientReport(portfolio, totalCapital, riskLevel)} className="ml-2 text-xs bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 p-1 px-2 border border-red-200 rounded transition-colors font-bold flex items-center gap-1" title="Descargar Informe PDF"><span>📄</span> PDF</button>
                                    <button onClick={() => exportToCSV(portfolio, totalCapital)} className="ml-2 text-xs bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 p-1 border border-slate-200 transition-colors">📥</button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                                    <button onClick={handleImportClick} className="ml-1 text-xs bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 p-1 border border-slate-200 transition-colors">📂</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden relative">
                                <PortfolioTable assets={portfolio} totalCapital={totalCapital} onRemove={handleRemoveAsset} onUpdateWeight={handleUpdateWeight} onFundClick={setSelectedFund} onSwap={handleOpenSwap} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 h-full flex flex-col bg-slate-100 overflow-y-auto scrollbar-thin gap-2">
                    <div className="flex flex-col gap-2 flex-[1.4]">
                        <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col shrink-0">
                            <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                <h3 className="font-sans font-bold text-[#0B2545] text-xs uppercase tracking-wider flex items-center gap-2">
                                    <span className="text-base">📊</span> Análisis de Cartera
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-100">
                                {/* Row 1: Risk & KPIs */}
                                <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 h-[16rem] overflow-hidden">
                                    <RiskMonitor portfolio={portfolio} />
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg p-3 h-[16rem] overflow-hidden">
                                    <KPICards portfolio={portfolio} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 p-4">
                                {/* Row 2: Donuts */}
                                <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 h-[18rem] relative flex flex-col items-center justify-center overflow-hidden">
                                    <SmartDonut allocation={allocData} />
                                </div>
                                <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 h-[18rem] relative flex flex-col items-center justify-center overflow-hidden">
                                    <GeoDonut allocation={geoData} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-[0.6] shrink-0">
                        <Controls className="h-full" riskLevel={riskLevel} setRiskLevel={setRiskLevel} numFunds={numFunds} setNumFunds={setNumFunds} onOptimize={handleOptimize} isOptimizing={isOptimizing} onManualGenerate={handleManualGenerate} onOpenCosts={() => setShowCosts(true)} onOpenXRay={() => setShowAnalysis(true)} onOpenTactical={() => { setProposedPortfolio(portfolio); setShowTactical(true); }} onOpenMacro={() => setShowMacro(true)} categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} vipFunds={vipFunds} setVipFunds={setVipFunds} onOpenVipModal={() => setShowVipModal(true)} />
                    </div>
                </div>
            </div>

            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center text-white">Cargando...</div>}>
                {showNews && <NewsModal onClose={() => setShowNews(false)} />}
                {showCosts && <CostsModal portfolio={portfolio} totalCapital={totalCapital} onClose={() => setShowCosts(false)} />}
                {showVipModal && <VipFundsModal vipFundsStr={vipFunds} onSave={(newVal) => { setVipFunds(newVal); localStorage.setItem('ft_vipFunds', newVal); }} onClose={() => setShowVipModal(false)} />}
                {showAnalysis && <AnalysisModal portfolio={portfolio} fundDatabase={assets} onClose={() => setShowAnalysis(false)} />}
                {showTactical && <TacticalModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} onAccept={handleAcceptPortfolio} onClose={() => setShowTactical(false)} />}
                {showMacro && <MacroTacticalModal portfolio={portfolio} onApply={handleMacroApply} onClose={() => setShowMacro(false)} />}
                {showReviewModal && <OptimizationReviewModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} onAccept={handleReviewAccept} onApplyDirect={handleApplyDirectly} onClose={() => setShowReviewModal(false)} />}
                {selectedFund && <FundDetailModal fund={selectedFund} onClose={() => setSelectedFund(null)} />}
                <FundSwapModal isOpen={isSwapOpen} originalFund={fundToSwap} alternatives={swapAlternatives} onSelect={performSwap} onClose={() => setIsSwapOpen(false)} />
            </Suspense>
        </div>
    )
}

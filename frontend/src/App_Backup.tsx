import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db, auth } from './firebase'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'

// Hooks
import { useDashboardData } from './hooks/useDashboardData'
import { usePortfolio } from './hooks/usePortfolio'
import { useAssets } from './hooks/useAssets'

import Login from './components/Login'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Controls from './components/Controls'
import HistoryChart from './components/charts/HistoryChart'
import YieldCurveChart from './components/charts/YieldCurveChart'
import PortfolioTable from './components/PortfolioTable'

// Dashboard Components
import SmartDonut from './components/dashboard/SmartDonut'
import GeoDonut from './components/dashboard/GeoDonut'
import KPICards from './components/dashboard/KPICards'
import MarketDrivers from './components/dashboard/MarketDrivers'
import RiskMonitor from './components/dashboard/RiskMonitor'

// Modals - Lazy Loaded
const NewsModal = lazy(() => import('./components/modals/NewsModal'))
const CostsModal = lazy(() => import('./components/modals/CostsModal'))
const AnalysisModal = lazy(() => import('./components/modals/AnalysisModal'))
const TacticalModal = lazy(() => import('./components/modals/TacticalModal'))
const MacroTacticalModal = lazy(() => import('./components/modals/MacroTacticalModal'))
const OptimizationReviewModal = lazy(() => import('./components/modals/OptimizationReviewModal'))
import FundDetailModal from './components/FundDetailModal'
const VipFundsModal = lazy(() => import('./components/VipFundsModal'))

// Pages
import MiBoutiquePage from './pages/MiBoutiquePage'

// Utils
import { parsePortfolioCSV } from './utils/csvImport'

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    // --- STATE 1: ASSETS (Managed by Hook with Pagination) ---
    const { assets, loading: loadingAssets, hasMore: assetsHasMore, loadMore: loadMoreAssets } = useAssets(isAuthenticated)

    // --- STATE 2: HOOKS ---
    const dashboard = useDashboardData(isAuthenticated)
    const portfolioState = usePortfolio(assets)
    const {
        portfolio, proposedPortfolio, setProposedPortfolio,
        riskLevel, setRiskLevel, numFunds, setNumFunds,
        totalCapital, setTotalCapital, vipFunds, setVipFunds,
        isOptimizing, allocData, geoData,
        handleAddAsset, handleRemoveAsset, handleUpdateWeight,
        handleManualGenerate, handleOptimize, cleanPortfolio, setPortfolio
    } = portfolioState

    // --- STATE 3: UI/MODALS ---
    const [showNews, setShowNews] = useState(false)
    const [showCosts, setShowCosts] = useState(false)
    const [showAnalysis, setShowAnalysis] = useState(false)
    const [showTactical, setShowTactical] = useState(false)
    const [showMacro, setShowMacro] = useState(false)
    const [showVipModal, setShowVipModal] = useState(false)
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [showAudit, setShowAudit] = useState(false)
    const [selectedFund, setSelectedFund] = useState<any>(null)

    // VIEW NAVIGATION
    const [activeView, setActiveView] = useState<'DASHBOARD' | 'MIBOUTIQUE'>('DASHBOARD')

    // --- OTHERS ---
    const [selectedCategory, setSelectedCategory] = useState('All')
    const categories = [...new Set(assets.map((a: any) => a.std_extra?.category || 'Unknown'))].filter((c: any) => c !== 'Unknown').sort() as string[]

    // Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user)
        })
        return () => unsubscribe()
    }, [])

    // --- HANDLERS ---
    const triggerOptimize = async () => {
        const result = await handleOptimize(() => {
            // On Success logic (UI Flow)
            // If no changes, the hook returns hasChanges=false but we handle flow here
        })

        if (result) {
            if (!result.hasChanges) {
                alert("✅ La cartera ya está optimizada para este perfil de riesgo.")
                // Force update proposed anyway to match
                setShowTactical(true)
            } else {
                setShowReviewModal(true)
                if (result.warnings && result.warnings.length > 0) {
                    const hasSynthetic = result.warnings.some((w: string) => w.includes('Sintéticos'))
                    if (hasSynthetic) console.warn("Avisos optimización:", result.warnings)
                }
            }
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

    const handleAcceptPortfolio = (newPortfolio: any[]) => {
        setPortfolio(newPortfolio)
        setShowTactical(false)
    }

    const handleMacroApply = (newProposal: any[]) => {
        setProposedPortfolio(newProposal)
        setShowMacro(false)
        setShowTactical(true)
    }

    // --- CSV IMPORT ---
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: any) => {
        const file = e.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = async (evt: any) => {
            const text = evt.target.result
            const result = parsePortfolioCSV(text)

            if (result.error) {
                alert(result.error)
                return
            }

            if (!result.portfolio || typeof result.totalValue !== 'number') {
                alert("Error: Datos del CSV inválidos o incompletos.")
                return
            }

            const valStr = result.totalValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
            if (window.confirm(`Se han detectado ${result.portfolio.length} fondos con un valor total de ${valStr}.\n\n¿Desea reemplazar la cartera actual?`)) {
                const enriched = result.portfolio.map((p: any) => {
                    const known = assets.find((a: any) => a.isin === p.isin) || {}
                    return {
                        ...known,
                        ...p,
                        weight: parseFloat(p.weight)
                    }
                })
                setPortfolio(enriched)
                setTotalCapital(result.totalValue)
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    if (!isAuthenticated) {
        return <Login onLogin={() => signInAnonymously(auth).catch((error) => alert("Error iniciando sesión: " + error.message))} />
    }

    // --- RENDER ---
    return (
        <div className="h-screen w-screen flex flex-col bg-[var(--color-bg-main)] text-[var(--color-text-primary)] font-roboto overflow-hidden">

            {/* 1. HEADER (Unified) */}
            <Header />

            {/* 2. MAIN CONTENT */}
            <div className="flex-1 flex overflow-hidden">

                {/* SIDEBAR */}
                <div className="w-[15%] h-full flex flex-col bg-slate-100 p-2">
                    <div className="flex-1 overflow-hidden relative rounded-lg border border-slate-200">
                        <Sidebar
                            assets={assets}
                            onAddAsset={handleAddAsset}
                            onViewDetail={setSelectedFund}
                            onLoadMore={() => loadMoreAssets(false)}
                            hasMore={assetsHasMore}
                            loading={loadingAssets}
                        />
                    </div>
                </div>

                {/* WORKSPACE */}
                <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">

                    {/* MIBOUTIQUE PAGE */}
                    {activeView === 'MIBOUTIQUE' && (
                        <div className="absolute inset-0 z-20 bg-white overflow-auto animate-in fade-in duration-300">
                            <button
                                onClick={() => setActiveView('DASHBOARD')}
                                className="absolute top-4 right-4 bg-slate-800 text-white px-4 py-2 rounded shadow hover:bg-slate-700 z-50"
                            >
                                Volver al Dashboard
                            </button>
                            <MiBoutiquePage />
                        </div>
                    )}

                    {/* DASHBOARD VIEW */}
                    <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">

                        {/* TOP CONTROLS */}
                        <div className="shrink-0">
                            <Controls
                                // ... props ...
                                riskLevel={riskLevel} setRiskLevel={setRiskLevel}
                                numFunds={numFunds} setNumFunds={setNumFunds}
                                totalCapital={totalCapital} setTotalCapital={setTotalCapital} // Added prop
                                vipFunds={vipFunds} setVipFunds={setVipFunds}
                                onGenerate={() => handleManualGenerate(selectedCategory)}
                                onOptimize={triggerOptimize}
                                onClean={cleanPortfolio}
                                isOptimizing={isOptimizing}
                                categories={categories}
                                selectedCategory={selectedCategory}
                                setSelectedCategory={setSelectedCategory}
                                onOpenNews={() => setShowNews(true)}
                                onOpenCosts={() => setShowCosts(true)}
                                onOpenAnalysis={() => setShowAnalysis(true)}
                                onOpenVip={() => setShowVipModal(true)}
                                onImportCSV={handleImportClick}
                                onOpenMiBoutique={() => setActiveView('MIBOUTIQUE')}
                            />
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".csv" />
                        </div>

                        {/* DASHBOARD GRID */}
                        <div className="grid grid-cols-4 gap-4 min-h-0">

                            {/* LEFT: DONUTS (25%) */}
                            <div className="col-span-1 flex flex-col gap-4">
                                <div className="h-[200px] glass-card p-3 rounded-xl relative">
                                    <SmartDonut data={allocData} title="Asignación por Activos" type="asset" />
                                </div>
                                <div className="h-[200px] glass-card p-3 rounded-xl relative">
                                    <GeoDonut data={geoData} title="Exposición Geográfica" />
                                </div>
                            </div>

                            {/* MIDDLE: METRICS & RISK (50%) */}
                            <div className="col-span-2 flex flex-col gap-4">
                                <KPICards portfolio={portfolio} totalCapital={totalCapital} />

                                <div className="flex-1 min-h-[300px] glass-card p-4 rounded-xl">
                                    <RiskMonitor portfolio={portfolio} />
                                </div>
                            </div>

                            {/* RIGHT: MARKET DRIVERS (25%) */}
                            <div className="col-span-1 flex flex-col gap-4">
                                <div className="h-[180px] glass-card p-2 rounded-xl">
                                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Mercados (S&P 500)</h3>
                                    <HistoryChart data={dashboard.historyData} range={dashboard.historyPeriod} />
                                </div>
                                <div className="h-[180px] glass-card p-2 rounded-xl">
                                    <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Curva de Tipos (US)</h3>
                                    <YieldCurveChart data={dashboard.yieldData} />
                                </div>
                                {/* Market Drivers Component */}
                                <div className="flex-1 glass-card p-2 rounded-xl overflow-hidden">
                                    <MarketDrivers />
                                </div>
                            </div>

                        </div>

                        {/* PORTFOLIO TABLE */}
                        <div className="shrink-0 glass-card rounded-xl overflow-hidden mt-4">
                            <PortfolioTable
                                portfolio={portfolio}
                                onRemove={handleRemoveAsset}
                                onUpdateWeight={handleUpdateWeight}
                                totalCapital={totalCapital}
                            />
                        </div>

                    </div>

                </div>
            </div>

            {/* MODALS */}
            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"><div className="text-white">Cargando...</div></div>}>
                {showNews && <NewsModal onClose={() => setShowNews(false)} />}
                {showCosts && <CostsModal portfolio={portfolio} totalCapital={totalCapital} onClose={() => setShowCosts(false)} />}
                {showVipModal && (<VipFundsModal vipFundsStr={vipFunds} onSave={(newVal: string) => setVipFunds(newVal)} onClose={() => setShowVipModal(false)} />)}
                {showAnalysis && <AnalysisModal portfolio={portfolio} fundDatabase={assets} onClose={() => setShowAnalysis(false)} />}

                {showReviewModal && (
                    <OptimizationReviewModal
                        original={portfolio}
                        proposed={proposedPortfolio}
                        onAccept={handleReviewAccept}
                        onApplyDirect={handleApplyDirectly}
                        onClose={() => setShowReviewModal(false)}
                    />
                )}

                {showTactical && (
                    <TacticalModal
                        currentPortfolio={portfolio}
                        proposedPortfolio={proposedPortfolio}
                        onClose={() => setShowTactical(false)}
                        onApply={handleAcceptPortfolio}
                        onOpenMacro={() => { setShowTactical(false); setShowMacro(true); }}
                    />
                )}

                {showMacro && (
                    <MacroTacticalModal
                        portfolio={portfolio}
                        onApply={handleMacroApply}
                        onClose={() => setShowMacro(false)}
                    />
                )}
            </Suspense>

            {selectedFund && <FundDetailModal fund={selectedFund} onClose={() => setSelectedFund(null)} />}

        </div>
    )
}

export default App

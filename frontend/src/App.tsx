import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions, auth } from './firebase'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import Login from './components/Login'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Controls from './components/Controls'
import HistoryChart from './components/charts/HistoryChart'
import YieldCurveChart from './components/charts/YieldCurveChart'
import PortfolioTable from './components/PortfolioTable'

// Nexus Dashboard Components
import SmartDonut from './components/dashboard/SmartDonut'
import GeoDonut from './components/dashboard/GeoDonut'
import KPICards from './components/dashboard/KPICards'
import StyleBox from './components/charts/StyleBox'
import MarketDrivers from './components/dashboard/MarketDrivers'
import RiskMonitor from './components/dashboard/RiskMonitor'

// Modals - Lazy Loaded (Code Splitting)
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
import { generateSmartPortfolio } from './utils/rulesEngine'
import { parsePortfolioCSV } from './utils/csvImport'
import { exportToCSV } from './utils/exportList'
import { normalizeFundData } from './utils/normalizer'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [assets, setAssets] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [proposedPortfolio, setProposedPortfolio] = useState([]) // Para el TacticalModal
  // State with Persistence Initialization
  const [riskLevel, setRiskLevel] = useState(() => parseInt(localStorage.getItem('ft_riskLevel')) || 5)
  const [numFunds, setNumFunds] = useState(() => parseInt(localStorage.getItem('ft_numFunds')) || 7)
  const [totalCapital, setTotalCapital] = useState(() => parseFloat(localStorage.getItem('ft_totalCapital')) || 100000)
  const [vipFunds, setVipFunds] = useState(() => localStorage.getItem('ft_vipFunds') || '')

  const [isOptimizing, setIsOptimizing] = useState(false)

  // Nuevo Estado Phase 8
  const [marketIndex, setMarketIndex] = useState('GSPC.INDX')
  const [historyPeriod, setHistoryPeriod] = useState('1y')
  const [yieldRegion, setYieldRegion] = useState('US')

  // Modals visibility
  const [showNews, setShowNews] = useState(false)
  const [showCosts, setShowCosts] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showTactical, setShowTactical] = useState(false)
  const [showMacro, setShowMacro] = useState(false)
  const [showVipModal, setShowVipModal] = useState(false)

  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [selectedFund, setSelectedFund] = useState(null) // For FundDetailPanel


  // VIEW NAVIGATION
  const [activeView, setActiveView] = useState('DASHBOARD') // 'DASHBOARD' or 'MIBOUTIQUE'

  // Datos visuales Dashboard
  const [historyData, setHistoryData] = useState([])
  const [yieldData, setYieldData] = useState([])
  const [allocData, setAllocData] = useState([])
  const [geoData, setGeoData] = useState([])

  // Cargar fondos al iniciar (SOLO tras autenticación)
  useEffect(() => {
    console.log("App: Initializing Auth Listener")
    // Escuchar cambios de Auth
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("App: Auth State Changed", user ? user.uid : 'No User')
      setIsAuthenticated(!!user)
      if (user) {
        fetchAssets()
      } else {
        setAssets([])
      }
    })
    return () => unsubscribe()
  }, [])

  async function fetchAssets() {
    try {
      console.log("App: Fetching assets from funds_v2...")
      const querySnapshot = await getDocs(collection(db, "funds_v2"))
      console.log("App: Firebase Query Snapshot size:", querySnapshot.size)
      const list = []
      querySnapshot.forEach((doc) => {
        list.push(normalizeFundData({ isin: doc.id, ...doc.data() }))
      })
      setAssets(list)
      console.log("App: Assets loaded and normalized:", list.length)
      if (list.length > 0) {
        console.table(list.slice(0, 5).map(f => ({
          id: f.isin,
          name: f.name,
          ticker: f.eod_ticker || 'N/A'
        })))
      } else {
        console.warn("App: Warning - No assets found in collection funds_v2")
      }
    } catch (error) {
      console.error("App: Error loading funds:", error)
      alert("Error de conexión (Assets): " + error.message)
    }
  }

  useEffect(() => {
    localStorage.setItem('ft_riskLevel', riskLevel)
    localStorage.setItem('ft_numFunds', numFunds)
    localStorage.setItem('ft_totalCapital', totalCapital)
  }, [riskLevel, numFunds, totalCapital])

  // Error Handling
  const [dashboardError, setDashboardError] = useState(null)

  // Cargar Métricas Dashboard (Async) - Dinámico por selectores
  useEffect(() => {
    if (!isAuthenticated) return

    async function loadDashboardData() {
      setDashboardError(null)
      try {
        // Market Index
        const getIndex = httpsCallable(functions, 'getMarketIndex')
        const resIndex = await getIndex({ symbol: marketIndex, range: historyPeriod })
        if (resIndex.data?.series) {
          setHistoryData(resIndex.data.series.map(d => ({ x: d.x, y: d.y })))
        }

        // Yield Curve
        const getCurve = httpsCallable(functions, 'getYieldCurve')
        const resCurve = await getCurve({ region: yieldRegion })
        if (resCurve.data?.curve) {
          setYieldData(resCurve.data.curve)
        }
      } catch (e) {
        console.error("Error cargando dashboard:", e)
        setDashboardError("Error conectando con el servidor de mercado.")
      }
    }
    loadDashboardData()
  }, [isAuthenticated, marketIndex, yieldRegion, historyPeriod]) // Re-run on selector change


  // Recalcular métricas de reparto y geografía (Detailed)
  useEffect(() => {
    const typeMap = {}
    const geoMap = {}

    portfolio.forEach(p => {
      const w = parseFloat(p.weight) || 0
      const extra = p.std_extra || {}

      // Type: Category > Asset Class > Computed Type
      // Type: High-Level Grouping (per user request)
      // Map std_type (RV, RF, Monetario, Mixto) to display labels
      const rawType = p.std_type || 'Mixto'
      let label = 'Otros'
      if (rawType === 'RV') label = 'Renta Variable'
      else if (rawType === 'RF') label = 'Renta Fija'
      else if (rawType === 'Monetario') label = 'Monetarios'

      typeMap[label] = (typeMap[label] || 0) + w

      // Geo: Specific Region > Computed Region
      // Use primary_region directly if available (stored in std_extra.regionDetail)
      const region = extra.regionDetail || p.std_region || 'Global'
      geoMap[region] = (geoMap[region] || 0) + w
    })

    // Helper to sort and group Top 5 + Other
    const processMap = (map) => {
      const entries = Object.entries(map).map(([k, v]) => ({ label: k, value: textToVal(v) }))
      entries.sort((a, b) => b.value - a.value)

      if (entries.length > 5) {
        const top = entries.slice(0, 5)
        const otherVal = entries.slice(5).reduce((s, x) => s + x.value, 0)
        top.push({ label: 'Otros', value: otherVal })
        return top
      }
      return entries
    }

    const textToVal = (val) => typeof val === 'number' ? val : 0;

    setAllocData(processMap(typeMap))
    setGeoData(processMap(geoMap))

  }, [portfolio])

  const handleAddAsset = (asset) => {
    if (portfolio.some(p => p.isin === asset.isin)) return
    setPortfolio([...portfolio, { ...asset, weight: 0 }])
  }

  const handleRemoveAsset = (isin) => {
    setPortfolio(portfolio.filter(p => p.isin !== isin))
  }

  const handleUpdateWeight = (isin, value) => {
    const newWeight = parseFloat(value) || 0
    setPortfolio(portfolio.map(p => p.isin === isin ? { ...p, weight: newWeight } : p))
  }

  // State for Smart Portfolio
  const [selectedCategory, setSelectedCategory] = useState('All')

  // Derive Categories from Assets
  const categories = [...new Set(assets.map(a => a.std_extra?.category || 'Unknown'))].filter(c => c !== 'Unknown').sort()

  const handleManualGenerate = async () => {
    if (assets.length === 0) {
      alert("Cargando fondos... espera un momento.")
      return
    }

    // Call Cloud Function
    try {
      setPortfolio([]) // Clear existing portfolio as per user request
      const generateFn = httpsCallable(functions, 'generateSmartPortfolio')
      // Show loading state? Using isOptimizing for now or add new state
      setIsOptimizing(true) // Reuse loader logic roughly

      const response = await generateFn({
        category: selectedCategory,
        risk_level: riskLevel,
        num_funds: numFunds,
        vip_funds: vipFunds, // NEW: Anchor funds
        optimize: false // Decouple Generation from Optimization
      })

      const result = response.data
      if (result.portfolio) {
        // Need to merge full asset data into result for UI to work (charts etc need extra fields)
        // The cloud function returns basic info { isin, name, weight, score }
        // We find the local asset object and merge

        const enrichedPortfolio = result.portfolio.map(p => {
          const localAsset = assets.find(a => a.isin === p.isin) || {}
          return {
            ...localAsset, // Base data
            ...p,          // Overwrite weight/score from backend
            weight: parseFloat(p.weight)
          }
        })

        setPortfolio(enrichedPortfolio)

        if (result.warnings?.length > 0) {
          console.warn("Smart Portfolio Warnings:", result.warnings)
        }
        if (result.debug) console.log("Smart Portfolio Debug:", result.debug)

      } else if (result.error) {
        alert("Error: " + result.error)
      }
    } catch (e) {
      console.error("Smart Portfolio Error:", e)
      alert("Error generando cartera: " + e.message)
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
        risk_level: riskLevel
      })

      const result = response.data
      if (result.status === 'optimal' || result.status === 'fallback') {
        const weights = result.weights || {}
        let hasChanges = false

        // Crear propuesta basada en la cartera actual pero con nuevos pesos
        const optimized = portfolio.map(p => {
          const newWeight = (weights[p.isin] || 0) * 100
          if (Math.abs(newWeight - p.weight) > 0.5) hasChanges = true // Ignorar cambios menores a 0.5%
          return {
            ...p,
            weight: newWeight
          }
        }).filter(p => p.weight > 0.01)

        if (!hasChanges) {
          alert("✅ La cartera ya está optimizada para este perfil de riesgo.")
          setProposedPortfolio(optimized) // Update anyway just in case of micro diffs
          // Skip review, maybe just flash success?
          // But if user WANTS to see the modal to tweak, we should probably still show it but with a notice?
          // User complaint was "nothing updates". Alert solves the confusion.
          setShowTactical(true) // Go straight to Tactical/Workspace
        } else {
          setProposedPortfolio(optimized)
          setShowReviewModal(true)
        }

        // Show warning if synthetic data was used
        if (result.warnings && result.warnings.length > 0) {
          const hasSynthetic = result.warnings.some(w => w.includes('Sintéticos'))
          if (hasSynthetic) {
            console.warn("Avios optimización:", result.warnings)
            // alert("⚠️ Aviso: Se han utilizado datos simluados...") // Reduce noise if minor
          }
        }

      } else {
        alert("Error en la optimización: " + (result.warnings?.[0] || 'Desconocido'))
      }
    } catch (error) {
      console.error("Critical Error Optimization:", error)
      alert("Error crítico al contactar el servidor: " + error.message)
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleApplyDirectly = () => {
    setPortfolio(proposedPortfolio)
    setShowReviewModal(false)
    // No further modal, stay on main screen
  }



  const handleReviewAccept = () => {
    setShowReviewModal(false)
    setShowTactical(true)
  }

  const handleAcceptPortfolio = (newPortfolio) => {
    setPortfolio(newPortfolio)
    setShowTactical(false)
  }

  const handleMacroApply = (newProposal) => {
    setProposedPortfolio(newProposal)
    setShowMacro(false)
    setShowTactical(true)
  }

  // --- CSV IMPORT ---
  const fileInputRef = useRef(null)

  const handleImportClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target.result
      const result = parsePortfolioCSV(text)

      if (result.error) {
        alert(result.error)
        return
      }

      if (window.confirm(`Se han detectado ${result.portfolio.length} fondos con un valor total de ${result.totalValue.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.\n\n¿Desea reemplazar la cartera actual?`)) {
        // Need to fetch full asset data for these ISINs to satisfy the app's need for regions/categories etc.
        // We can match against 'assets' (the full database list loaded in sidebar)

        const enriched = result.portfolio.map(p => {
          const known = assets.find(a => a.isin === p.isin) || {}
          return {
            ...known,
            ...p, // Imported vals override defaults
            weight: parseFloat(p.weight)
          }
        })

        setPortfolio(enriched)
        setTotalCapital(result.totalValue)
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => {
      console.log("App: Attempting Anonymous Login")
      return signInAnonymously(auth).catch((error) => {
        console.error("App: Login Error", error)
        alert("Error iniciando sesión: " + error.message)
        throw error // Re-throw so Login component knows it failed
      })
    }} />
  }

  // --- RENDER ---
  if (activeView === 'MIBOUTIQUE') {
    return (
      <div className="h-screen flex flex-col overflow-y-auto bg-slate-50 font-sans text-slate-800 relative">
        {/* Back Button Overlay */}
        <button
          onClick={() => setActiveView('DASHBOARD')}
          className="fixed top-4 left-4 z-50 bg-white/90 p-2 rounded-full shadow-lg border border-slate-200 hover:bg-slate-100 transition-colors"
          title="Volver al Dashboard"
        >
          🔙
        </button>
        <MiBoutiquePage />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 font-sans text-gray-900">
      <Header
        onLogout={() => auth.signOut()}
        onOpenNews={() => setShowNews(true)}
        onOpenMiBoutique={() => setActiveView('MIBOUTIQUE')}
        onOpenAudit={() => setShowAudit(true)}
      />

      {/* MAIN CONTAINER: Strict L15% | C60% | R25% Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* COL 1: SIDEBAR (15%) */}
        <div className="w-[15%] h-full flex flex-col bg-slate-100 p-2">
          <div className="flex-1 overflow-hidden relative rounded-lg border border-slate-200">
            <Sidebar assets={assets} onAddAsset={handleAddAsset} onViewDetail={setSelectedFund} />
          </div>
        </div>

        {/* COL 2: CENTER (60%) - Market & Portfolio */}
        <div className="w-[60%] h-full flex flex-col bg-slate-100 dark:bg-slate-800 p-2 gap-2">

          {/* TOP SECTION: MARKET CHARTS (Restored) */}
          <div className="h-1/3 grid grid-cols-2 gap-2 shrink-0">
            {/* Graph 1: Indices */}
            <div className="bg-white dark:bg-slate-800 rounded-lg flex flex-col border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
              <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 flex justify-between items-center z-10">
                <h3 className="font-sans font-bold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1">📈 Indices</h3>
                <select
                  value={marketIndex}
                  onChange={(e) => setMarketIndex(e.target.value)}
                  className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1 outline-none"
                >
                  <option value="GSPC.INDX">S&P 500</option>
                  <option value="IXIC.INDX">Nasdaq</option>
                  <option value="GDAXI.INDX">DAX</option>
                  <option value="IBEX.INDX">IBEX 35</option>
                </select>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => setHistoryPeriod('1m')}
                    className={`text-[9px] px-1.5 py-0.5 font-bold border ${historyPeriod === '1m' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >
                    1M
                  </button>
                  <button
                    onClick={() => setHistoryPeriod('1y')}
                    className={`text-[9px] px-1.5 py-0.5 font-bold border ${historyPeriod === '1y' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >
                    1Y
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full min-h-0 relative">
                <HistoryChart data={historyData} />
              </div>
            </div>

            {/* Graph 2: Yield Curve */}
            <div className="bg-white rounded-lg flex flex-col border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-between items-center z-10">
                <h3 className="font-sans font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1">🏦 Yield Curve</h3>
                <select
                  value={yieldRegion}
                  onChange={(e) => setYieldRegion(e.target.value)}
                  className="text-[10px] bg-white border border-slate-200 text-slate-600 rounded px-1 outline-none"
                >
                  <option value="US">USD</option>
                  <option value="EU">EUR</option>
                  <option value="EURIBOR">Euribor</option>
                </select>
              </div>
              <div className="flex-1 w-full min-h-0 relative flex items-center justify-center">
                <YieldCurveChart data={yieldData} />
              </div>
            </div>
          </div>


          {/* ERROR BANNER */}
          {dashboardError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-2 mx-2 mb-2 text-red-700 text-xs flex justify-between items-center">
              <span>⚠️ {dashboardError}</span>
              <button
                onClick={() => window.location.reload()}
                className="underline hover:text-red-900 font-bold"
              >
                Reintentar
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden flex flex-col relative rounded-lg border border-slate-200">
            <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden relative flex flex-col">
              <div className="p-2 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                <h3 className="font-sans font-bold text-slate-700 text-xs uppercase tracking-wider">Cartera de Fondos</h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-bold uppercase">Capital:</span>
                  <input
                    type="number"
                    value={totalCapital}
                    onChange={(e) => setTotalCapital(parseFloat(e.target.value))}
                    className="bg-white border border-slate-200 text-slate-800 font-mono px-2 py-0.5 w-24 text-right"
                  />
                  <span className="text-slate-500 font-bold">€</span>

                  <button
                    onClick={() => exportToCSV(portfolio, totalCapital)}
                    className="ml-2 text-xs bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 p-1 border border-slate-200 transition-colors"
                    title="Exportar CSV"
                  >
                    📥
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                  />
                  <button
                    onClick={handleImportClick}
                    className="ml-1 text-xs bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 p-1 border border-slate-200 transition-colors"
                    title="Importar Cartera (CSV)"
                  >
                    📂
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <PortfolioTable
                  assets={portfolio}
                  totalCapital={totalCapital}
                  onRemove={handleRemoveAsset}
                  onUpdateWeight={handleUpdateWeight}
                  onFundClick={setSelectedFund}
                />


              </div>
            </div>
          </div>
        </div>


        {/* COL 3: RIGHT (25%) - Analysis & Ops */}
        <div className="w-[25%] h-full flex flex-col bg-slate-100 overflow-y-auto scrollbar-thin p-2 gap-2">

          {/* MODULE 1: ANALYSIS */}
          <div className="flex flex-col gap-2 flex-1">

            {/* Drivers/Risks (RESIZED TO h-[14rem]) */}
            <div className="grid grid-cols-2 h-[14rem] shrink-0 gap-2">
              <div className="overflow-hidden relative rounded-lg border border-slate-200">
                <MarketDrivers />
              </div>
              <div className="overflow-hidden relative rounded-lg border border-slate-200">
                <RiskMonitor portfolio={portfolio} />
              </div>
            </div>

            {/* MERGED CONTAINER: Donuts (Top) + Metrics (Bottom) */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col gap-2 shrink-0 p-2">
              {/* 1. Donuts Row */}
              <div className="grid grid-cols-2 h-[16rem] gap-2">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-1 relative flex flex-col items-center justify-center">
                  <SmartDonut allocation={allocData} />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-1 relative flex flex-col items-center justify-center">
                  <GeoDonut allocation={geoData} />
                </div>
              </div>

              {/* 2. Metrics Table */}
              <div className="p-2">


                <KPICards portfolio={portfolio} />
              </div>
            </div>
          </div>

          {/* MODULE 2: OPERATIONS (Bottom) */}
          <div className="flex-1">
            <Controls
              className="h-full"
              riskLevel={riskLevel}
              setRiskLevel={setRiskLevel}
              numFunds={numFunds}
              setNumFunds={setNumFunds}
              onOptimize={handleOptimize}
              isOptimizing={isOptimizing}
              onManualGenerate={handleManualGenerate}
              onOpenCosts={() => setShowCosts(true)}
              onOpenXRay={() => setShowAnalysis(true)}
              onOpenTactical={() => {
                setProposedPortfolio(portfolio)
                setShowTactical(true)
              }}
              onOpenMacro={() => setShowMacro(true)}
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              vipFunds={vipFunds}
              setVipFunds={setVipFunds}
              onOpenVipModal={() => setShowVipModal(true)}
            />
          </div>

        </div>
      </div>

      {/* MODALS - Lazy Loaded with Suspense */}
      <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"><div className="text-white">Cargando...</div></div>}>
        {showNews && <NewsModal onClose={() => setShowNews(false)} />}
        {showCosts && <CostsModal portfolio={portfolio} totalCapital={totalCapital} onClose={() => setShowCosts(false)} />}
        {showVipModal && (
          <VipFundsModal
            vipFundsStr={vipFunds}
            onSave={(newVal) => {
              setVipFunds(newVal)
              localStorage.setItem('ft_vipFunds', newVal)
            }}
            onClose={() => setShowVipModal(false)}
          />
        )}
        {showAnalysis && <AnalysisModal portfolio={portfolio} fundDatabase={assets} onClose={() => setShowAnalysis(false)} />}

        {showTactical && (
          <TacticalModal
            currentPortfolio={portfolio}
            proposedPortfolio={proposedPortfolio}
            onAccept={handleAcceptPortfolio}
            onClose={() => setShowTactical(false)}
          />
        )}

        {showMacro && (
          <MacroTacticalModal
            portfolio={portfolio}
            onApply={handleMacroApply}
            onClose={() => setShowMacro(false)}
          />
        )}

        {showReviewModal && (
          <OptimizationReviewModal
            currentPortfolio={portfolio}
            proposedPortfolio={proposedPortfolio}
            onAccept={handleReviewAccept}
            onApplyDirect={handleApplyDirectly}
            onClose={() => setShowReviewModal(false)}
          />
        )}

        {selectedFund && (
          <FundDetailModal
            fund={selectedFund}
            onClose={() => setSelectedFund(null)}
          />
        )}
      </Suspense>
    </div>
  )
}

export default App

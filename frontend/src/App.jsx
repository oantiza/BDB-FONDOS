import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions, auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
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

// Modals
import NewsModal from './components/modals/NewsModal'
import CostsModal from './components/modals/CostsModal'
import AnalysisModal from './components/modals/AnalysisModal'
import TacticalModal from './components/modals/TacticalModal'
import MacroTacticalModal from './components/modals/MacroTacticalModal'
import OptimizationReviewModal from './components/modals/OptimizationReviewModal'

// Utils
import { generateSmartPortfolio } from './utils/rulesEngine'
import { exportToCSV } from './utils/exportList'

// --- HELPER DE NORMALIZACIÓN (Portado de app_modern.js) ---
function normalizeFundData(docData) {
  let tipoCalc = 'Mixto';
  const eq = parseFloat(docData.metrics?.equity || 0);
  const bd = parseFloat(docData.metrics?.bond || 0);
  const cash = parseFloat(docData.metrics?.cash || 0);

  // 1. Basic Type Inference
  if (eq >= 60) tipoCalc = 'RV';
  else if (bd >= 60) tipoCalc = 'RF';
  else if (cash >= 60) tipoCalc = 'Monetario';

  if (tipoCalc === 'Mixto' && docData.manual_type) {
    const mt = docData.manual_type.toUpperCase();
    if (mt.includes('RENTA VARIABLE') || mt.includes('EQUITY')) tipoCalc = 'RV';
    else if (mt.includes('RENTA FIJA') || mt.includes('DEUDA')) tipoCalc = 'RF';
    else if (mt.includes('MONETARIO')) tipoCalc = 'Monetario';
  }

  // 1b. Use new Asset Class if available to refine
  if (docData.asset_class) {
    const ac = docData.asset_class.toUpperCase();
    if (ac.includes('EQUITY')) tipoCalc = 'RV';
    else if (ac.includes('BOND') || ac.includes('FIXED')) tipoCalc = 'RF';
    else if (ac.includes('MONEY') || ac.includes('CASH')) tipoCalc = 'Monetario';
  }

  // 2. Region Inference
  let regionCalc = 'Global';
  if (docData.primary_region) {
    const pr = docData.primary_region.toUpperCase();
    if (pr === 'USA' || pr === 'ESTADOS UNIDOS' || pr === 'EEUU') regionCalc = 'USA';
    else if (pr === 'EUROPE' || pr === 'EUROZONA' || pr === 'EURO') regionCalc = 'Europe';
    else if (pr === 'ASIA' || pr === 'EMERGING' || pr === 'LATAM') regionCalc = 'Emerging';
  } else if (docData.regions) {
    if ((docData.regions.americas || 0) > 60) regionCalc = 'USA';
    else if ((docData.regions.europe || 0) > 60) regionCalc = 'Europe';
  }

  // 3. Stats & History
  const vol = (docData.perf?.volatility || 15) / 100;
  const ret3y = (docData.returns?.['3y_annualized'] || 0) / 100;
  const sharpe = docData.perf?.sharpe || 0;
  const alpha = docData.perf?.alpha || 0;

  // New: Calculate History Years for consistency
  let yearsHistory = 0;
  if (docData.history_start) {
    try {
      // Handle Firestore Timestamp or Date string
      const startDate = docData.history_start.toDate ? docData.history_start.toDate() : new Date(docData.history_start);
      const now = new Date();
      yearsHistory = (now - startDate) / (1000 * 60 * 60 * 24 * 365.25);
    } catch (e) { console.warn("Date parse error", e); }
  }

  return {
    ...docData,
    std_type: tipoCalc,
    std_region: regionCalc,
    std_perf: {
      volatility: vol,
      cagr3y: ret3y,
      sharpe: sharpe,
      alpha: alpha
    },
    std_extra: {
      currency: docData.currency || 'EUR',
      company: docData.fund_company || docData.company || 'Unknown',
      category: docData.morningstar_category || '',
      assetClass: docData.asset_class || '',
      regionDetail: docData.primary_region || docData.region || '', // Raw region for chart detail
      yearsHistory: yearsHistory,
      mgmtFee: parseFloat(docData.costs?.management_fee || 0),
      ter: parseFloat(docData.costs?.ter || 0)
    }
  };
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [assets, setAssets] = useState([])
  const [portfolio, setPortfolio] = useState([])
  const [proposedPortfolio, setProposedPortfolio] = useState([]) // Para el TacticalModal
  // State with Persistence Initialization
  const [riskLevel, setRiskLevel] = useState(() => parseInt(localStorage.getItem('ft_riskLevel')) || 5)
  const [numFunds, setNumFunds] = useState(() => parseInt(localStorage.getItem('ft_numFunds')) || 7)
  const [totalCapital, setTotalCapital] = useState(() => parseFloat(localStorage.getItem('ft_totalCapital')) || 100000)

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
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showAudit, setShowAudit] = useState(false)

  // Datos visuales Dashboard
  const [historyData, setHistoryData] = useState([])
  const [yieldData, setYieldData] = useState([])
  const [allocData, setAllocData] = useState([])
  const [geoData, setGeoData] = useState([])

  // Cargar fondos al iniciar (SOLO tras autenticación)
  useEffect(() => {
    // Escuchar cambios de Auth
    const unsubscribe = onAuthStateChanged(auth, (user) => {
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
      console.log("Cargando fondos desde Firebase...")
      const querySnapshot = await getDocs(collection(db, "funds_v2"))
      const list = []
      querySnapshot.forEach((doc) => {
        list.push(normalizeFundData({ isin: doc.id, ...doc.data() }))
      })
      setAssets(list)
      console.log("Fondos cargados y normalizados:", list.length)
    } catch (error) {
      console.error("Error cargando fondos:", error)
      alert("Error de conexión: " + error.message)
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

      // Type: Category > Asset Class > Computed Type
      const extra = p.std_extra || {}
      // Fallback chain for better detail
      const cat = extra.category || extra.assetClass || p.std_type || 'Unclassified'
      typeMap[cat] = (typeMap[cat] || 0) + w

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

  const handleManualGenerate = () => {
    if (assets.length === 0) {
      alert("Cargando fondos... espera un momento.")
      return
    }
    const proposal = generateSmartPortfolio(riskLevel, assets, numFunds)
    setPortfolio(proposal)
    // setShowTactical(true) // Removed as per user request
    // alert(`Cartera generada (Nivel ${riskLevel} - ${numFunds} fondos)`)
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

        // Crear propuesta basada en la cartera actual pero con nuevos pesos
        const optimized = portfolio.map(p => ({
          ...p,
          weight: (weights[p.isin] || 0) * 100
        })).filter(p => p.weight > 0.01)

        setProposedPortfolio(optimized)
        setShowReviewModal(true) // Open Review Modal Step 1

        // Show warning if synthetic data was used
        if (result.warnings && result.warnings.length > 0) {
          const hasSynthetic = result.warnings.some(w => w.includes('Sintéticos'))
          if (hasSynthetic) {
            alert("⚠️ Aviso: Se han utilizado datos simluados para algunos fondos debido a falta de histórico.")
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

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-sans text-slate-800">
      <Header onLogout={() => auth.signOut()} onOpenNews={() => setShowNews(true)} onOpenAudit={() => setShowAudit(true)} />

      {/* MAIN CONTAINER: Strict L15% | C60% | R25% Layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* COL 1: SIDEBAR (15%) */}
        <div className="w-[15%] h-full flex flex-col border-r border-slate-200 bg-white">
          <div className="flex-1 overflow-hidden relative">
            <Sidebar assets={assets} onAddAsset={handleAddAsset} />
          </div>
        </div>

        {/* COL 2: CENTER (60%) - Market & Portfolio */}
        <div className="w-[60%] h-full flex flex-col border-r border-slate-200 bg-slate-50">

          {/* TOP SECTION: MARKET CHARTS (Restored) */}
          <div className="h-1/3 p-2 grid grid-cols-2 gap-2 border-b border-slate-200 shrink-0">
            {/* Graph 1: Indices */}
            <div className="bg-white rounded-lg flex flex-col border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center z-10">
                <h3 className="font-sans font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-1">📈 Indices</h3>
                <select
                  value={marketIndex}
                  onChange={(e) => setMarketIndex(e.target.value)}
                  className="text-[10px] bg-white border border-slate-200 text-slate-600 rounded px-1 outline-none"
                >
                  <option value="GSPC.INDX">S&P 500</option>
                  <option value="IXIC.INDX">Nasdaq</option>
                  <option value="GDAXI.INDX">DAX</option>
                  <option value="IBEX.INDX">IBEX 35</option>
                </select>
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() => setHistoryPeriod('1m')}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${historyPeriod === '1m' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >
                    1M
                  </button>
                  <button
                    onClick={() => setHistoryPeriod('1y')}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${historyPeriod === '1y' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
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
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center z-10">
                <h3 className="font-sans font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-1">🏦 Yield Curve</h3>
                <select
                  value={yieldRegion}
                  onChange={(e) => setYieldRegion(e.target.value)}
                  className="text-[10px] bg-white border border-slate-200 text-slate-600 rounded px-1 outline-none"
                >
                  <option value="US">USD</option>
                  <option value="EU">EUR</option>
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

          <div className="flex-1 p-2 overflow-hidden flex flex-col relative">
            <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden relative flex flex-col">
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                <h3 className="font-sans font-bold text-slate-700 text-sm uppercase tracking-wider">Cartera de Fondos</h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-bold uppercase">Capital:</span>
                  <input
                    type="number"
                    value={totalCapital}
                    onChange={(e) => setTotalCapital(parseFloat(e.target.value))}
                    className="bg-white border border-slate-200 text-slate-800 font-mono rounded px-2 py-0.5 w-24 text-right"
                  />
                  <span className="text-slate-500 font-bold">€</span>

                  <button
                    onClick={() => exportToCSV(portfolio, totalCapital)}
                    className="ml-2 text-xs bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 p-1 rounded border border-slate-200 transition-colors"
                    title="Exportar CSV"
                  >
                    📥
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <PortfolioTable
                  assets={portfolio}
                  totalCapital={totalCapital}
                  onRemove={handleRemoveAsset}
                  onUpdateWeight={handleUpdateWeight}
                />
              </div>
            </div>
          </div>
        </div>


        {/* COL 3: RIGHT (25%) - Analysis & Ops */}
        <div className="w-[25%] h-full flex flex-col bg-white border-l border-slate-200 p-2 gap-2 overflow-y-auto scrollbar-thin">

          {/* MODULE 1: ANALYSIS */}
          <div className="flex flex-col gap-2">

            {/* Drivers/Risks (RESIZED TO h-[19rem]) */}
            <div className="grid grid-cols-2 gap-1 h-[19rem] shrink-0">
              <div className="overflow-hidden relative rounded border border-slate-200">
                <MarketDrivers />
              </div>
              <div className="overflow-hidden relative rounded border border-slate-200">
                <RiskMonitor />
              </div>
            </div>

            {/* MERGED CONTAINER: Donuts (Top) + Metrics (Bottom) */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-2 flex flex-col gap-2 shrink-0">
              {/* 1. Donuts Row */}
              <div className="grid grid-cols-2 gap-1 h-[16rem]">
                <div className="bg-slate-50 rounded border border-slate-200 p-1 relative flex flex-col items-center justify-center">
                  <SmartDonut allocation={allocData} />
                </div>
                <div className="bg-slate-50 rounded border border-slate-200 p-1 relative flex flex-col items-center justify-center">
                  <GeoDonut allocation={geoData} />
                </div>
              </div>

              {/* 2. Metrics Table */}
              <div>
                <h4 className="font-sans font-bold text-slate-700 text-sm uppercase tracking-wider mb-2 pl-1">Key Metrics</h4>
                <KPICards portfolio={portfolio} />
              </div>
            </div>
          </div>

          {/* MODULE 2: OPERATIONS (Bottom) */}
          <div className="mt-auto">
            <Controls
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
            />
          </div>

        </div>
      </div>

      {/* MODALS */}
      {showNews && <NewsModal onClose={() => setShowNews(false)} />}
      {showCosts && <CostsModal portfolio={portfolio} totalCapital={totalCapital} onClose={() => setShowCosts(false)} />}
      {showAnalysis && <AnalysisModal portfolio={portfolio} fundDatabase={assets} onClose={() => setShowAnalysis(false)} />}
      {showAudit && <DataAuditModal assets={assets} onClose={() => setShowAudit(false)} />}

      {
        showTactical && (
          <TacticalModal
            currentPortfolio={portfolio}
            proposedPortfolio={proposedPortfolio}
            onAccept={handleAcceptPortfolio}
            onClose={() => setShowTactical(false)}
          />
        )
      }

      {
        showMacro && (
          <MacroTacticalModal
            portfolio={portfolio}
            onApply={handleMacroApply}
            onClose={() => setShowMacro(false)}
          />
        )
      }

      {
        showReviewModal && (
          <OptimizationReviewModal
            currentPortfolio={portfolio}
            proposedPortfolio={proposedPortfolio}
            onAccept={handleReviewAccept}
            onClose={() => setShowReviewModal(false)}
          />
        )
      }
    </div>
  )
}

export default App

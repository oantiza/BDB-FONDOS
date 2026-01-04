import { useState, useEffect, Suspense, lazy } from 'react'
import { auth } from './firebase'
import { signInAnonymously } from 'firebase/auth'
import { AnimatePresence, motion } from 'framer-motion'
import Login from './components/Login' // Keep Login eager for fast LCP

// Lazy Loaded Pages
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MiBoutiquePage = lazy(() => import('./pages/MiBoutiquePage'))
const XRayPage = lazy(() => import('./pages/XRayPage'))
const XRayAnalyticsPage = lazy(() => import('./pages/XRayAnalyticsPage'))
const PositionsAnalyzer = lazy(() => import('./components/positions/PositionsAnalyzer').then(module => ({ default: module.PositionsAnalyzer })))

// Loading Spinner Component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen w-full bg-slate-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003399]"></div>
  </div>
);

// Hooks
import { usePortfolio } from './hooks/usePortfolio'

function App() {
  const [isAuthenticatedLocal, setIsAuthenticatedLocal] = useState(false)
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'MIBOUTIQUE' | 'XRAY' | 'POSITIONS' | 'ANALYTICS'>('DASHBOARD')

  // Lifted State
  const portfolioState = usePortfolio()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticatedLocal(!!user)
    })
    return () => unsubscribe()
  }, [])

  const getPageContent = () => {
    if (!isAuthenticatedLocal) {
      return <Login key="login" onLogin={() => signInAnonymously(auth)} />
    }

    // Routing Logic
    let content;
    if (activeView === 'MIBOUTIQUE') {
      content = <MiBoutiquePage key="boutique" onBack={() => setActiveView('DASHBOARD')} />
    } else if (activeView === 'XRAY') {
      content = (
        <XRayPage
          key="xray"
          portfolio={portfolioState.portfolio}
          fundDatabase={portfolioState.assets}
          totalCapital={portfolioState.totalCapital}
          onBack={() => setActiveView('DASHBOARD')}
          onOpenAnalytics={() => setActiveView('ANALYTICS')}
        />
      )
    } else if (activeView === 'ANALYTICS') {
      content = (
        <XRayAnalyticsPage
          key="analytics"
          portfolio={portfolioState.portfolio}
          fundDatabase={portfolioState.assets}
          totalCapital={portfolioState.totalCapital}
          onBack={() => setActiveView('XRAY')}
        />
      )
    } else if (activeView === 'POSITIONS') {
      content = <PositionsAnalyzer key="positions" assets={portfolioState.assets} onBack={() => setActiveView('DASHBOARD')} />
    } else {
      // Dashboard / Default
      content = (
        <DashboardPage
          key="dashboard"
          onLogout={() => auth.signOut()}
          onOpenMiBoutique={() => setActiveView('MIBOUTIQUE')}
          onOpenXRay={() => setActiveView('XRAY')}
          onOpenPositions={() => setActiveView('POSITIONS')}
          {...portfolioState}
        />
      )
    }

    // Handle Legacy/Direct Link for Analytics
    if (window.location.pathname === '/x-ray/analytics' && activeView !== 'ANALYTICS') {
      // This renders immediately, though we might want to sync state in useEffect ideally. 
      // For now keeping consistent with previous logic but wrapped.
      content = (
        <XRayAnalyticsPage
          key="analytics-direct"
          portfolio={portfolioState.portfolio}
          fundDatabase={portfolioState.assets}
          totalCapital={portfolioState.totalCapital}
          onBack={() => setActiveView('XRAY')}
        />
      )
    }

    return (
      <Suspense fallback={<LoadingFallback />}>
        {content}
      </Suspense>
    )
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isAuthenticatedLocal ? activeView : 'login'}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="h-full w-full"
      >
        {getPageContent()}
      </motion.div>
    </AnimatePresence>
  )
}

export default App
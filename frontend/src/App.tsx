import { useState, useEffect } from 'react'
import { auth } from './firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { AnimatePresence, motion } from 'framer-motion'

// Pages
import Login from './components/Login'
import DashboardPage from './pages/DashboardPage'
import MiBoutiquePage from './pages/MiBoutiquePage'
import XRayPage from './pages/XRayPage'
import XRayAnalyticsPage from './pages/XRayAnalyticsPage'
import RetirementCalculatorPage from './pages/RetirementCalculatorPage'

import { PositionsAnalyzer } from './components/positions/PositionsAnalyzer'

// Hooks
import { usePortfolio } from './hooks/usePortfolio'

function App() {
  const [isAuthenticatedLocal, setIsAuthenticatedLocal] = useState(false)
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'MIBOUTIQUE' | 'XRAY' | 'POSITIONS' | 'RETIREMENT'>('DASHBOARD')

  // Lifted State
  const portfolioState = usePortfolio()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticatedLocal(!!user)
    })
    return () => unsubscribe()
  }, [])

  const handleLogin = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      console.error("Login Error:", error);
      alert("Error de inicio de sesión: " + error.message);
      throw error;
    }
  };

  const getPageContent = () => {
    if (!isAuthenticatedLocal) {
      return <Login key="login" onLogin={handleLogin} />
    }

    if (activeView === 'MIBOUTIQUE') {
      return <MiBoutiquePage key="boutique" onBack={() => setActiveView('DASHBOARD')} />
    }

    if (activeView === 'XRAY') {
      return (
        <XRayPage
          key="xray"
          portfolio={portfolioState.portfolio}
          fundDatabase={portfolioState.assets}
          totalCapital={portfolioState.totalCapital}
          onBack={() => setActiveView('DASHBOARD')}
        />
      )
    }

    if (activeView === 'POSITIONS') {
      return <PositionsAnalyzer key="positions" assets={portfolioState.assets} onBack={() => setActiveView('DASHBOARD')} />
    }

    if (activeView === 'RETIREMENT') {
      return <RetirementCalculatorPage key="retirement" onBack={() => setActiveView('DASHBOARD')} />
    }

    // Routing for Analytics (simple path check for new window support)
    if (window.location.pathname === '/x-ray/analytics') {
      return (
        <XRayAnalyticsPage
          key="analytics"
          portfolio={portfolioState.portfolio}
          fundDatabase={portfolioState.assets}
          totalCapital={portfolioState.totalCapital}
          onBack={() => { }}
        />
      )
    }



    return (
      <DashboardPage
        key="dashboard"
        onLogout={() => auth.signOut()}
        onOpenMiBoutique={() => setActiveView('MIBOUTIQUE')}
        onOpenXRay={() => setActiveView('XRAY')}
        onOpenPositions={() => setActiveView('POSITIONS')}
        onOpenRetirement={() => setActiveView('RETIREMENT')}

        {...portfolioState}
      />
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
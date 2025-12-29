import { useState, useEffect } from 'react'
import { auth } from './firebase'
import { signInAnonymously } from 'firebase/auth'

// Pages
import Login from './components/Login'
import DashboardPage from './pages/DashboardPage'
import MiBoutiquePage from './pages/MiBoutiquePage'
import XRayPage from './pages/XRayPage'
import XRayAnalyticsPage from './pages/XRayAnalyticsPage'

// Hooks
import { usePortfolio } from './hooks/usePortfolio'

function App() {
  const [isAuthenticatedLocal, setIsAuthenticatedLocal] = useState(false)
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'MIBOUTIQUE' | 'XRAY'>('DASHBOARD')

  // Lifted State
  const portfolioState = usePortfolio()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticatedLocal(!!user)
    })
    return () => unsubscribe()
  }, [])

  if (!isAuthenticatedLocal) {
    return <Login onLogin={() => signInAnonymously(auth)} />
  }

  if (activeView === 'MIBOUTIQUE') {
    return <MiBoutiquePage onBack={() => setActiveView('DASHBOARD')} />
  }

  if (activeView === 'XRAY') {
    return (
      <XRayPage
        portfolio={portfolioState.portfolio}
        fundDatabase={portfolioState.assets}
        totalCapital={portfolioState.totalCapital}
        onBack={() => setActiveView('DASHBOARD')}
      />
    )
  }

  // Routing for Analytics (simple path check for new window support)
  if (window.location.pathname === '/x-ray/analytics') {
    return (
      <XRayAnalyticsPage
        portfolio={portfolioState.portfolio}
        fundDatabase={portfolioState.assets}
        totalCapital={portfolioState.totalCapital}
        onBack={() => { }}
      />
    )
  }

  return (
    <DashboardPage
      onLogout={() => auth.signOut()}
      onOpenMiBoutique={() => setActiveView('MIBOUTIQUE')}
      onOpenXRay={() => setActiveView('XRAY')}
      {...portfolioState}
    />
  )
}

export default App
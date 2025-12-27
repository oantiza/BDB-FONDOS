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

  // Routing for Analytics (simulated via state for now, or true routing if URL based, but App uses state view)
  // Wait, the user asked for "another new window". In a SPA without Router, new window means new URL.
  // The current App.tsx does NOT use react-router-dom. It uses conditional rendering `activeView`.
  // To support "Opening in a new window", the new window will load `index.html` -> `main.tsx` -> `App.tsx`.
  // `App.tsx` initializes state to DASHBOARD. It doesn't know about URL paths.
  // I MUST check the URL pathname in `App.tsx` to set the initial state if I want to support new windows.
  // Or I can add `react-router-dom`.
  // Given the current simple state-based implementation, the easiest way to support "New Window" is to check `window.location.search` or `window.location.hash` or path.
  // Let's modify App.tsx to check generic URL params or path.
  // Since I can't easily install Router without risk, I'll use `window.location.pathname`.

  if (window.location.pathname === '/x-ray/analytics') {
    return (
      <XRayAnalyticsPage
        portfolio={portfolioState.portfolio}
        fundDatabase={portfolioState.assets}
        totalCapital={portfolioState.totalCapital}
        onBack={() => { }} // No back in new window usually, or just close
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
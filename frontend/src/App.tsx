import { useState, useEffect } from 'react'
import { auth } from './firebase'
import { signInAnonymously } from 'firebase/auth'

// Pages
import Login from './components/Login'
import DashboardPage from './pages/DashboardPage'
import MiBoutiquePage from './pages/MiBoutiquePage'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'MIBOUTIQUE'>('DASHBOARD')

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user)
    })
    return () => unsubscribe()
  }, [])

  if (!isAuthenticated) {
    return <Login onLogin={() => signInAnonymously(auth)} />
  }

  if (activeView === 'MIBOUTIQUE') {
    return <MiBoutiquePage onBack={() => setActiveView('DASHBOARD')} />
  }

  return (
    <DashboardPage
      onLogout={() => auth.signOut()}
      onOpenMiBoutique={() => setActiveView('MIBOUTIQUE')}
    />
  )
}

export default App
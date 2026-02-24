import { useState, useEffect } from 'react'
import { auth } from './firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { AnimatePresence, motion } from 'framer-motion'

// Pages
import Login from './components/Login'
import DashboardPage from './pages/DashboardPage'
import MiBoutiquePage from './pages/MiBoutiquePage'
import XRayPage from './pages/XRayPage'
import ComparatorPage from './pages/ComparatorPage'
import XRayAnalyticsPage from './pages/XRayAnalyticsPage'
import RetirementCalculatorPage from './pages/RetirementCalculatorPage'

import { PositionsAnalyzer } from './components/positions/PositionsAnalyzer'

// Hooks
import { usePortfolio } from './hooks/usePortfolio'
import { db } from './firebase'
import { doc, getDoc } from 'firebase/firestore'
import { syncRiskProfilesFromDB } from './utils/rulesEngine'

function App() {
  const [isAuthenticatedLocal, setIsAuthenticatedLocal] = useState(false)
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'MIBOUTIQUE' | 'XRAY' | 'POSITIONS' | 'RETIREMENT' | 'COMPARATOR' | 'ANALYTICS'>('DASHBOARD')
  const [configError, setConfigError] = useState<string | null>(null)

  // Lifted State
  const portfolioState = usePortfolio()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticatedLocal(!!user)
    })
    return () => unsubscribe()
  }, [])

  // Sync Dynamic Risk Profiles
  useEffect(() => {
    const fetchRiskProfiles = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'risk_profiles');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const profiles: Record<number, any> = {};
          // Map string keys from Firestore to number keys for the Engine
          Object.keys(data).forEach(key => {
            profiles[Number(key)] = data[key];
          });
          syncRiskProfilesFromDB(profiles);
        }
      } catch (error: any) {
        console.error("⚠️ [App] Error fetching risk profiles from DB:", error);
        setConfigError(error.message || "No se pudieron cargar los perfiles de riesgo del sistema.");
      }
    };
    fetchRiskProfiles();
  }, []);

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
    if (configError) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-slate-50">
          <div className="max-w-md p-8 bg-white border-l-4 border-red-500 shadow-lg rounded-xl flex flex-col items-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Error Crítico del Sistema</h2>
            <p className="text-sm text-slate-600 text-center mb-6">{configError}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-50 text-red-600 font-medium rounded-full hover:bg-red-100 transition-colors">
              Reintentar
            </button>
          </div>
        </div>
      )
    }

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

    if (activeView === 'COMPARATOR') {
      return (
        <ComparatorPage
          key="comparator"
          onBack={() => setActiveView('DASHBOARD')}
          onLogout={() => auth.signOut()}
          onOpenXRay={() => setActiveView('XRAY')}
          onOpenPositions={() => setActiveView('POSITIONS')}
          onOpenRetirement={() => setActiveView('RETIREMENT')}
          onOpenComparator={() => setActiveView('COMPARATOR')}
        />
      )
    }

    // Routing for Analytics (simple path check for new window support or internal activeView routing)
    if (activeView === 'ANALYTICS' || window.location.pathname === '/x-ray/analytics') {
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
        onOpenComparator={() => setActiveView('COMPARATOR')}
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
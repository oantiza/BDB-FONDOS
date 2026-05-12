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
import PrintMacroStrategyReport from './pages/PrintMacroStrategyReport'
import AdminPage from './pages/AdminPage'

import { PositionsAnalyzer } from './components/positions/PositionsAnalyzer'

// Hooks
import { usePortfolio } from './hooks/usePortfolio'
import { db } from './firebase'
import { doc, getDoc } from 'firebase/firestore'
import { syncRiskProfilesFromDB } from './utils/rulesEngine'
import { isAdminEmail } from './hooks/useAdminAuth'

function App() {
  const [isAuthenticatedLocal, setIsAuthenticatedLocal] = useState(false)
  const [activeView, setActiveView] = useState<'DASHBOARD' | 'MIBOUTIQUE' | 'XRAY' | 'POSITIONS' | 'RETIREMENT' | 'COMPARATOR' | 'ANALYTICS' | 'ADMIN'>('DASHBOARD')

  const [isSyncingRiskProfiles, setIsSyncingRiskProfiles] = useState(true)

  // Lifted State
  const portfolioState = usePortfolio()

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticatedLocal(!!user)
    })
    return () => unsubscribe()
  }, [])

  // Sync Dynamic Risk Profiles — only after auth confirms a user
  useEffect(() => {
    // Skip Firestore read if user is not authenticated yet (local seed is safe)
    if (!isAuthenticatedLocal) {
      setIsSyncingRiskProfiles(false);
      return;
    }

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
        // Log for dev visibility but don't block the app — local seed is a safe fallback
        console.warn("⚠️ [App] Risk profiles Firestore sync failed, using local seed:", error?.code || error?.message);
      } finally {
        setIsSyncingRiskProfiles(false);
      }
    };
    fetchRiskProfiles();
  }, [isAuthenticatedLocal]);

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

    if (isSyncingRiskProfiles) {
      return (
        <div key="syncing" className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 font-medium">Sincronizando parámetros de riesgo...</p>
        </div>
      )
    }

    if (activeView === 'ADMIN') {
      return <AdminPage key="admin" onBack={() => setActiveView('DASHBOARD')} />
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
    if (window.location.pathname === '/print/macro-report') {
      return <PrintMacroStrategyReport key="print-macro" />
    }

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
        onOpenAdmin={isAdminEmail(auth.currentUser?.email) ? () => setActiveView('ADMIN') : undefined}
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
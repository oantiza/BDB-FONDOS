import { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

export function useDashboardData(isAuthenticated: boolean) {
    const [marketIndex, setMarketIndex] = useState('GSPC.INDX')
    const [historyPeriod, setHistoryPeriod] = useState('1y')
    const [yieldRegion, setYieldRegion] = useState('US')

    const [historyData, setHistoryData] = useState<any[]>([])
    const [yieldData, setYieldData] = useState<any[]>([])

    // Derived visual data for donuts/metrics is calculated in App or another hook based on Portfolio
    // This hook focuses on External Market Data (Charts)

    const [dashboardError, setDashboardError] = useState<string | null>(null)
    const [loadingMarket, setLoadingMarket] = useState(false)

    useEffect(() => {
        if (!isAuthenticated) return

        async function loadDashboardData() {
            setDashboardError(null)
            setLoadingMarket(true)
            try {
                // Market Index
                const getIndex = httpsCallable(functions, 'getMarketIndex')
                const resIndexPromise = getIndex({ symbol: marketIndex, range: historyPeriod })

                // Yield Curve
                const getCurve = httpsCallable(functions, 'getYieldCurve')
                const resCurvePromise = getCurve({ region: yieldRegion })

                // Parallel fetch
                const [resIndex, resCurve] = await Promise.all([resIndexPromise, resCurvePromise])

                const indexData = (resIndex.data as any)?.series || []
                const curveData = (resCurve.data as any)?.curve || []

                if (indexData.length > 0) {
                    setHistoryData(indexData.map((d: any) => ({ x: d.x, y: d.y })))
                }

                if (curveData.length > 0) {
                    setYieldData(curveData)
                }

            } catch (e: any) {
                console.error("Error cargando dashboard:", e)
                setDashboardError("Error conectando con el servidor de mercado.")
            } finally {
                setLoadingMarket(false)
            }
        }

        loadDashboardData()
    }, [isAuthenticated, marketIndex, yieldRegion, historyPeriod])

    return {
        marketIndex, setMarketIndex,
        historyPeriod, setHistoryPeriod,
        yieldRegion, setYieldRegion,
        historyData,
        yieldData,
        dashboardError,
        loadingMarket
    }
}

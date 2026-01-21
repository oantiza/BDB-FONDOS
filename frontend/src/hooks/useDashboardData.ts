import { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { MarketIndexResponse, YieldCurveResponse } from '../types'
import { getDashboardAnalytics } from '../engine/portfolioAnalyticsEngine'

export function useDashboardData(isAuthenticated: boolean, portfolio: any[]) {
  const [historyData, setHistoryData] = useState<{ x: string; y: number }[]>([])
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [frontierData, setFrontierData] = useState<{ x: number; y: number }[]>([])
  const [assetPoints, setAssetPoints] = useState<{ x: number; y: number; label: string }[]>([])
  const [portfolioPoint, setPortfolioPoint] = useState<{ x: number; y: number } | null>(null)

  // Métricas para cards (backend = X-Ray)
  const [metrics1y, setMetrics1y] = useState<any>(null)
  const [xrayMetrics, setXrayMetrics] = useState<any>(null) // 3Y
  const [metrics5y, setMetrics5y] = useState<any>(null)

  const [isLoadingFrontier, setIsLoadingFrontier] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !portfolio || portfolio.length === 0) {
      setHistoryData([])
      setFrontierData([])
      setAssetPoints([])
      setPortfolioPoint(null)
      setMetrics1y(null)
      setXrayMetrics(null)
      setMetrics5y(null)
      return
    }

    async function loadDashboardData() {
      setDashboardError(null)

      const historyPromise = (async () => {
        setIsLoadingHistory(true)
        try {
          // Fetch unified metrics and history
          const { series5y, metrics1y, metrics3y, metrics5y } =
            await getDashboardAnalytics(portfolio, { include1y: true })

          setHistoryData(series5y || [])
          setMetrics1y(metrics1y || null)
          setXrayMetrics(metrics3y || null)
          setMetrics5y(metrics5y || null)
        } catch (e: any) {
          console.error('Backtest error:', e)
        } finally {
          setIsLoadingHistory(false)
        }
      })()

      const frontierPromise = (async () => {
        setIsLoadingFrontier(true)
        try {
          const getFrontier = httpsCallable(functions, 'getEfficientFrontier')
          const res = await getFrontier({ portfolio })
          const data = res.data as any

          if (data.frontier) {
            setFrontierData(data.frontier)
            setAssetPoints(data.assets || [])
            setPortfolioPoint(data.portfolio || null)
          }
        } catch (e: any) {
          console.error('Frontier error:', e)
          setDashboardError('Error cargando Frontera Eficiente.')
        } finally {
          setIsLoadingFrontier(false)
        }
      })()

      await Promise.all([historyPromise, frontierPromise])
    }

    loadDashboardData()
  }, [isAuthenticated, portfolio])

  return {
    historyData,
    frontierData,
    assetPoints,
    portfolioPoint,

    metrics1y,
    xrayMetrics,
    metrics5y,

    isLoading: isLoadingFrontier || isLoadingHistory,
    dashboardError
  }
}

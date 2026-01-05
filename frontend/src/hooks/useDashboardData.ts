import { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { MarketIndexResponse, YieldCurveResponse } from '../types'

export function useDashboardData(isAuthenticated: boolean, portfolio: any[]) {
    const [historyData, setHistoryData] = useState<{ x: string; y: number }[]>([])
    const [dashboardError, setDashboardError] = useState<string | null>(null)
    const [frontierData, setFrontierData] = useState<{ x: number; y: number }[]>([])
    const [assetPoints, setAssetPoints] = useState<{ x: number; y: number; label: string }[]>([])
    const [portfolioPoint, setPortfolioPoint] = useState<{ x: number; y: number } | null>(null)
    const [isLoadingFrontier, setIsLoadingFrontier] = useState(false)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)

    useEffect(() => {
        if (!isAuthenticated || !portfolio || portfolio.length === 0) {
            setHistoryData([]);
            setFrontierData([]);
            setAssetPoints([]);
            setPortfolioPoint(null);
            return;
        }

        async function loadDashboardData() {
            setDashboardError(null)

            // 1. Load History (Parallel)
            const historyPromise = (async () => {
                setIsLoadingHistory(true);
                try {
                    const getBacktest = httpsCallable(functions, 'backtest_portfolio')
                    const res = await getBacktest({ portfolio, period: '5y' })
                    const data = res.data as any;
                    if (data.portfolioSeries) setHistoryData(data.portfolioSeries);
                    else if (data.error) throw new Error(data.error);
                } catch (e: any) {
                    console.error("Backtest error:", e);
                    // Don't block whole dashboard
                } finally {
                    setIsLoadingHistory(false);
                }
            })();

            // 2. Load Frontier (Parallel)
            const frontierPromise = (async () => {
                setIsLoadingFrontier(true);
                try {
                    const getFrontier = httpsCallable(functions, 'getEfficientFrontier')
                    const res = await getFrontier({ portfolio })
                    const data = res.data as any;

                    if (data.frontier) {
                        setFrontierData(data.frontier);
                        setAssetPoints(data.assets || []);
                        setPortfolioPoint(data.portfolio || null);
                    }
                } catch (e: any) {
                    console.error("Frontier error:", e);
                    setDashboardError("Error cargando Frontera Eficiente.");
                } finally {
                    setIsLoadingFrontier(false);
                }
            })();

            await Promise.all([historyPromise, frontierPromise]);
        }
        loadDashboardData()
    }, [isAuthenticated, portfolio])

    return {
        historyData,
        frontierData,
        assetPoints,
        portfolioPoint,
        isLoading: isLoadingFrontier || isLoadingHistory,
        dashboardError
    }
}

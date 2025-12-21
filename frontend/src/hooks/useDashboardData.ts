import { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { MarketIndexResponse, YieldCurveResponse } from '../types'

export function useDashboardData(isAuthenticated: boolean, portfolio: any[]) {
    const [historyData, setHistoryData] = useState<{ x: string; y: number }[]>([])
    const [dashboardError, setDashboardError] = useState<string | null>(null)

    useEffect(() => {
        if (!isAuthenticated || !portfolio || portfolio.length === 0) {
            setHistoryData([]);
            return;
        }

        async function loadDashboardData() {
            setDashboardError(null)
            try {
                const getBacktest = httpsCallable(functions, 'backtest_portfolio')
                const res = await getBacktest({ portfolio, period: '5y' })
                const data = res.data as any;

                if (data.portfolioSeries) {
                    setHistoryData(data.portfolioSeries);
                } else if (data.error) {
                    setDashboardError(data.error);
                }
            } catch (e: any) {
                console.error("Error cargando dashboard:", e)
                setDashboardError("Error calculando el histórico de cartera.")
            }
        }
        loadDashboardData()
    }, [isAuthenticated, portfolio])

    return {
        historyData,
        dashboardError
    }
}

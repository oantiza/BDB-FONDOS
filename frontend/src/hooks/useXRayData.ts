import { useState, useEffect } from 'react';
import { useXRayAnalytics } from './useXRayAnalytics';
import { usePortfolioStats } from './usePortfolioStats';
import { PortfolioItem, Fund } from '../types';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export function useXRayData(portfolio: PortfolioItem[], fundDatabase: Fund[]) {
    // 1. Core Analytics Hooks
    const { metrics, loading, errorMsg, riskExplanation } = useXRayAnalytics({ portfolio, fundDatabase });
    const { categoryAllocation, regionAllocation, sortedHoldings, styleStats, globalAllocation } = usePortfolioStats({ portfolio, metrics });

    // 2. Macro Strategy Report State
    const [strategyReport, setStrategyReport] = useState<any | null>(null);

    useEffect(() => {
        const fetchStrategy = async () => {
            try {
                const { collection, query, where, getDocs } = await import('firebase/firestore');
                const { db } = await import('../firebase');

                const q = query(collection(db, 'reports'), where('type', '==', 'STRATEGY'));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const docs = snapshot.docs.map(d => d.data());
                    docs.sort((a: any, b: any) => {
                        const tA = a.createdAt?.seconds || 0;
                        const tB = b.createdAt?.seconds || 0;
                        return tB - tA;
                    });
                    setStrategyReport(docs[0]);
                }
            } catch (e) {
                console.error("Error fetching strategy report:", e);
            }
        };
        fetchStrategy();
    }, []);

    // 3. Frontier Data State
    const [frontierData, setFrontierData] = useState<{ x: number; y: number }[]>([])
    const [assetPoints, setAssetPoints] = useState<{ x: number; y: number; label: string }[]>([])
    const [portfolioPoint, setPortfolioPoint] = useState<{ x: number; y: number } | null>(null)

    useEffect(() => {
        const fetchFrontier = async () => {
            try {
                const getFrontier = httpsCallable(functions, 'getEfficientFrontier')
                const res = await getFrontier({ portfolio })
                const data = res.data as any
                if (data.frontier) {
                    setFrontierData(data.frontier)
                    setAssetPoints(data.assets || [])
                    setPortfolioPoint(data.portfolio || null)
                }
            } catch (e) {
                console.error("Frontier fetch error:", e)
            }
        }
        if (portfolio && portfolio.length > 0) fetchFrontier()
    }, [portfolio])

    // 4. Helper Functions
    const getVolatilitySafe = (fund: any) => {
        try {
            if (metrics?.assets && metrics.assets[fund.isin] && metrics.assets[fund.isin].volatility !== undefined) {
                return ((metrics.assets[fund.isin]?.volatility || 0) * 100).toFixed(2) + '%';
            }
            if (fund.std_perf && fund.std_perf.volatility !== undefined) {
                return (fund.std_perf.volatility * 100).toFixed(2) + '%';
            }
            return '-';
        } catch (e) {
            console.warn("Safety Catch Volatility:", e);
            return '-';
        }
    }

    // 5. Pagination Logic
    const getCompositionPages = () => {
        const rows: any[] = [];
        const grouped = Object.entries(
            [...portfolio].reduce((acc, fund) => {
                const category = fund.std_extra?.category || fund.std_type || 'SIN CLASIFICAR';
                if (!acc[category]) acc[category] = [];
                acc[category].push(fund);
                return acc;
            }, {} as Record<string, PortfolioItem[]>)
        ).sort((a, b) => a[0].localeCompare(b[0]));

        grouped.forEach(([category, funds]) => {
            // rows.push({ type: 'header', content: category }); // Removed per user request
            funds.sort((a, b) => b.weight - a.weight).forEach(fund => {
                rows.push({ type: 'fund', content: fund });
            });
        });
        rows.push({ type: 'total' }); // totalCapital passed in render

        const pages: any[][] = [];
        let currentPage: any[] = [];
        let limit = 35;

        rows.forEach((row) => {
            if (currentPage.length >= limit) {
                pages.push(currentPage);
                currentPage = [];
                limit = 35;
            }
            currentPage.push(row);
        });
        if (currentPage.length > 0) pages.push(currentPage);
        return pages;
    };

    const compositionPages = getCompositionPages();

    return {
        // Analytics
        metrics,
        loading,
        errorMsg,
        riskExplanation,
        // Portfolio Stats
        categoryAllocation,
        regionAllocation,
        sortedHoldings,
        styleStats,
        globalAllocation,
        // Strategy
        strategyReport,
        // Frontier
        frontierData,
        assetPoints,
        portfolioPoint,
        // Helpers
        getVolatilitySafe,
        // Pagination
        compositionPages
    };
}

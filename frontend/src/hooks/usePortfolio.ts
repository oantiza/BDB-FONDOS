import { useState, useCallback, useEffect } from 'react'

/**
 * Custom hook for portfolio management operations
 * Extracts common portfolio logic from App.jsx
 */
export function usePortfolio(initialPortfolio = []) {
    const [portfolio, setPortfolio] = useState(initialPortfolio)

    // Add asset to portfolio
    const addAsset = useCallback((asset) => {
        setPortfolio(prev => {
            if (prev.some(a => a.isin === asset.isin)) return prev
            return [...prev, { ...asset, weight: 100 / (prev.length + 1) }]
        })
    }, [])

    // Remove asset from portfolio
    const removeAsset = useCallback((isin) => {
        setPortfolio(prev => prev.filter(a => a.isin !== isin))
    }, [])

    // Update asset weight
    const updateWeight = useCallback((isin, value) => {
        const numVal = parseFloat(value) || 0
        setPortfolio(prev => prev.map(a =>
            a.isin === isin ? { ...a, weight: numVal } : a
        ))
    }, [])

    // Normalize weights to 100%
    const normalizeWeights = useCallback(() => {
        setPortfolio(prev => {
            const total = prev.reduce((sum, a) => sum + a.weight, 0)
            if (total === 0) return prev
            return prev.map(a => ({ ...a, weight: (a.weight / total) * 100 }))
        })
    }, [])

    // Replace entire portfolio
    const replacePortfolio = useCallback((newPortfolio) => {
        setPortfolio(newPortfolio)
    }, [])

    // Calculate total weight
    const totalWeight = portfolio.reduce((sum, a) => sum + (a.weight || 0), 0)

    // Check if weights are balanced (sum to ~100%)
    const isBalanced = Math.abs(totalWeight - 100) < 0.5

    return {
        portfolio,
        addAsset,
        removeAsset,
        updateWeight,
        normalizeWeights,
        replacePortfolio,
        totalWeight,
        isBalanced
    }
}

/**
 * Custom hook for asset caching with localStorage persistence
 */
export function useAssetCache(key = 'ft_assets_cache') {
    const [cache, setCache] = useState(() => {
        try {
            const stored = localStorage.getItem(key)
            if (stored) {
                const parsed = JSON.parse(stored)
                // Check if cache is less than 1 hour old
                if (Date.now() - parsed.timestamp < 3600000) {
                    return parsed.data
                }
            }
        } catch (e) {
            console.warn('Cache read error:', e)
        }
        return null
    })

    const updateCache = useCallback((data) => {
        try {
            localStorage.setItem(key, JSON.stringify({
                data,
                timestamp: Date.now()
            }))
            setCache(data)
        } catch (e) {
            console.warn('Cache write error:', e)
        }
    }, [key])

    const clearCache = useCallback(() => {
        localStorage.removeItem(key)
        setCache(null)
    }, [key])

    return { cache, updateCache, clearCache }
}

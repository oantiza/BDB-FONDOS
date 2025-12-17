import { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import { exportToCSV } from '../utils/exportList'

export function usePortfolio(assets: any[]) {
    const [portfolio, setPortfolio] = useState<any[]>([])
    const [proposedPortfolio, setProposedPortfolio] = useState<any[]>([])

    // Persistent Settings
    const [riskLevel, setRiskLevel] = useState(() => parseInt(localStorage.getItem('ft_riskLevel') || '5'))
    const [numFunds, setNumFunds] = useState(() => parseInt(localStorage.getItem('ft_numFunds') || '7'))
    const [totalCapital, setTotalCapital] = useState(() => parseFloat(localStorage.getItem('ft_totalCapital') || '100000'))
    const [vipFunds, setVipFunds] = useState(() => localStorage.getItem('ft_vipFunds') || '')

    const [isOptimizing, setIsOptimizing] = useState(false)

    // Visual Metrics State
    const [allocData, setAllocData] = useState<any[]>([])
    const [geoData, setGeoData] = useState<any[]>([])

    // Persistence Effect
    useEffect(() => {
        localStorage.setItem('ft_riskLevel', riskLevel.toString())
        localStorage.setItem('ft_numFunds', numFunds.toString())
        localStorage.setItem('ft_totalCapital', totalCapital.toString())
        localStorage.setItem('ft_vipFunds', vipFunds)
    }, [riskLevel, numFunds, totalCapital, vipFunds])

    // Metrics Calculation Effect
    useEffect(() => {
        const typeMap: any = {}
        const geoMap: any = {}

        portfolio.forEach(p => {
            const w = parseFloat(p.weight) || 0
            const extra = p.std_extra || {}

            const rawType = p.std_type || 'Mixto'
            let label = 'Otros'
            if (rawType === 'RV') label = 'Renta Variable'
            else if (rawType === 'RF') label = 'Renta Fija'
            else if (rawType === 'Monetario') label = 'Monetarios'

            typeMap[label] = (typeMap[label] || 0) + w

            const region = extra.regionDetail || p.std_region || 'Global'
            geoMap[region] = (geoMap[region] || 0) + w
        })

        const textToVal = (val: any) => typeof val === 'number' ? val : 0;

        const processMap = (map: any) => {
            const entries = Object.entries(map).map(([k, v]) => ({ label: k, value: textToVal(v) }))
            entries.sort((a: any, b: any) => b.value - a.value)

            if (entries.length > 5) {
                const top = entries.slice(0, 5)
                const otherValPromise = entries.slice(5).reduce((s: number, x: any) => s + x.value, 0)
                top.push({ label: 'Otros', value: otherValPromise })
                return top
            }
            return entries
        }

        setAllocData(processMap(typeMap))
        setGeoData(processMap(geoMap))

    }, [portfolio])


    // --- ACTIONS ---

    const handleAddAsset = (asset: any) => {
        if (portfolio.some(p => p.isin === asset.isin)) return
        setPortfolio([...portfolio, { ...asset, weight: 0 }])
    }

    const handleRemoveAsset = (isin: string) => {
        setPortfolio(portfolio.filter(p => p.isin !== isin))
    }

    const handleUpdateWeight = (isin: string, value: any) => {
        const newWeight = parseFloat(value) || 0
        setPortfolio(portfolio.map(p => p.isin === isin ? { ...p, weight: newWeight } : p))
    }

    const handleManualGenerate = async (selectedCategory: string) => {
        if (assets.length === 0) {
            alert("Cargando fondos... espera un momento.")
            return
        }
        setIsOptimizing(true)
        try {
            setPortfolio([])
            const generateFn = httpsCallable(functions, 'generateSmartPortfolio')

            const response = await generateFn({
                category: selectedCategory,
                risk_level: riskLevel,
                num_funds: numFunds,
                vip_funds: vipFunds,
                optimize: false
            })

            const result = response.data as any
            if (result.portfolio) {
                const enrichedPortfolio = result.portfolio.map((p: any) => {
                    const localAsset = assets.find(a => a.isin === p.isin) || {}
                    return { ...localAsset, ...p, weight: parseFloat(p.weight) }
                })
                setPortfolio(enrichedPortfolio)
                if (result.warnings?.length > 0) console.warn("Smart Portfolio Warnings:", result.warnings)
            } else if (result.error) {
                alert("Error: " + result.error)
            }
        } catch (e: any) {
            console.error("Smart Portfolio Error:", e)
            alert("Error generando cartera: " + e.message)
        } finally {
            setIsOptimizing(false)
        }
    }

    const handleOptimize = async (onSuccess?: () => void) => {
        if (portfolio.length === 0) {
            alert("Añade fondos a la cartera primero")
            return
        }

        setIsOptimizing(true)
        try {
            const optimizeFn = httpsCallable(functions, 'optimize_portfolio_quant')
            const response = await optimizeFn({
                assets: portfolio.map(p => p.isin),
                risk_level: riskLevel
            })

            const result = response.data as any
            if (result.status === 'optimal' || result.status === 'fallback') {
                const weights = result.weights || {}
                let hasChanges = false

                const optimized = portfolio.map(p => {
                    const newWeight = (weights[p.isin] || 0) * 100
                    if (Math.abs(newWeight - p.weight) > 0.5) hasChanges = true
                    return { ...p, weight: newWeight }
                }).filter(p => p.weight > 0.01)

                setProposedPortfolio(optimized)

                if (onSuccess) onSuccess()

                return { hasChanges, warnings: result.warnings }
            } else {
                alert("Error en la optimización: " + (result.warnings?.[0] || 'Desconocido'))
            }
        } catch (error: any) {
            console.error("Critical Error Optimization:", error)
            alert("Error crítico al contactar el servidor: " + error.message)
        } finally {
            setIsOptimizing(false)
        }
        return null
    }

    const cleanPortfolio = () => setPortfolio([])

    return {
        portfolio, setPortfolio,
        proposedPortfolio, setProposedPortfolio,
        riskLevel, setRiskLevel,
        numFunds, setNumFunds,
        totalCapital, setTotalCapital,
        vipFunds, setVipFunds,
        isOptimizing,
        allocData, geoData,
        handleAddAsset,
        handleRemoveAsset,
        handleUpdateWeight,
        handleManualGenerate,
        handleOptimize,
        cleanPortfolio
    }
}

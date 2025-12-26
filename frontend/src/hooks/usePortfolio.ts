import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { normalizeFundData } from '../utils/normalizer'
import { Fund, PortfolioItem, AllocationItem } from '../types'

export function usePortfolio() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [assets, setAssets] = useState<Fund[]>([])
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
    const [proposedPortfolio, setProposedPortfolio] = useState<PortfolioItem[]>([])

    // Persistence
    const [riskLevel, setRiskLevel] = useState(() => parseInt(localStorage.getItem('ft_riskLevel') || '5'))
    const [numFunds, setNumFunds] = useState(() => parseInt(localStorage.getItem('ft_numFunds') || '7'))
    const [totalCapital, setTotalCapital] = useState(() => parseFloat(localStorage.getItem('ft_totalCapital') || '100000'))
    const [vipFunds, setVipFunds] = useState(() => localStorage.getItem('ft_vipFunds') || '')

    // Stats
    const [allocData, setAllocData] = useState<AllocationItem[]>([])
    const [geoData, setGeoData] = useState<AllocationItem[]>([])

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setIsAuthenticated(!!user)
            if (user) fetchAssets()
            else setAssets([])
        })
        return () => unsubscribe()
    }, [])

    useEffect(() => {
        localStorage.setItem('ft_riskLevel', riskLevel.toString())
        localStorage.setItem('ft_numFunds', numFunds.toString())
        localStorage.setItem('ft_totalCapital', totalCapital.toString())
        if (vipFunds) localStorage.setItem('ft_vipFunds', vipFunds)
    }, [riskLevel, numFunds, totalCapital, vipFunds])

    async function fetchAssets() {
        try {
            const querySnapshot = await getDocs(collection(db, "funds_v2"))
            const list: Fund[] = []
            querySnapshot.forEach((doc) => {
                list.push(normalizeFundData({ isin: doc.id, ...doc.data() }))
            })
            setAssets(list)
        } catch (error) {
            console.error("usePortfolio: Error loading funds:", error)
        }
    }

    // Calculate Stats
    useEffect(() => {
        const typeMap: any = {}
        const geoMap: any = {}

        portfolio.forEach(p => {
            const w = Number(p.weight) || 0
            const extra = p.std_extra || {}
            const rawType = p.std_type || 'Mixto'
            const region = extra.regionDetail || p.std_region || 'Global'

            let label = rawType

            // Lógica Refinada para Subcategorías
            if (rawType === 'RV' || rawType === 'Equity') {
                if (region.includes('US') || region.includes('America')) label = 'RV Norteamérica'
                else if (region.includes('Europe') || region.includes('Euro')) label = 'RV Europa'
                else if (region.includes('Emerg') || region.includes('Asia')) label = 'RV Emergentes/Asia'
                else label = 'RV Global'
            }
            else if (rawType === 'RF' || rawType === 'Fixed Income') {
                if (extra.category && extra.category.toLowerCase().includes('gov')) label = 'Deuda Pública'
                else if (extra.category && extra.category.toLowerCase().includes('corp')) label = 'Crédito Corporativo'
                else label = 'Renta Fija Global'
            }
            else if (rawType === 'Monetario' || rawType === 'Cash') label = 'Monetarios'
            else if (rawType === 'Mixto' || rawType === 'Mixed') label = 'Retorno Absoluto'
            else if (rawType === 'Commodities') label = 'Materias Primas'
            else label = 'Alternativos/Otros'

            typeMap[label] = (typeMap[label] || 0) + w

            // Geo Map se mantiene igual
            geoMap[region] = (geoMap[region] || 0) + w
        })

        const processMap = (map: any): AllocationItem[] => {
            const textToVal = (val: unknown) => typeof val === 'number' ? val : 0;
            const entries = Object.entries(map).map(([k, v]) => ({ label: k, value: textToVal(v) }))
            entries.sort((a, b) => b.value - a.value)
            if (entries.length > 8) {
                const top = entries.slice(0, 8)
                const otherVal = entries.slice(8).reduce((s, x) => s + x.value, 0)
                top.push({ label: 'Otros', value: otherVal })
                return top
            }
            return entries
        }
        setAllocData(processMap(typeMap))
        setGeoData(processMap(geoMap))
    }, [portfolio])

    return {
        isAuthenticated,
        assets,
        portfolio, setPortfolio,
        proposedPortfolio, setProposedPortfolio,
        riskLevel, setRiskLevel,
        numFunds, setNumFunds,
        totalCapital, setTotalCapital,
        vipFunds, setVipFunds,
        allocData,
        geoData
    }
}

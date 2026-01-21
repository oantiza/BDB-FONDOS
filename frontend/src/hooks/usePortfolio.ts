import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { normalizeFundData, adaptFundV3ToLegacy } from '../utils/normalizer'
import { Fund, PortfolioItem, AllocationItem } from '../types'

export function usePortfolio() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [assets, setAssets] = useState<Fund[]>([])
    const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
        try {
            const saved = localStorage.getItem('ft_activePortfolio')
            return saved ? JSON.parse(saved) : []
        } catch (e) {
            return []
        }
    })
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
        // Auto-save portfolio
        localStorage.setItem('ft_activePortfolio', JSON.stringify(portfolio))
    }, [riskLevel, numFunds, totalCapital, vipFunds, portfolio])

    async function fetchAssets() {
        try {
            const querySnapshot = await getDocs(collection(db, "funds_v3"))
            const list: Fund[] = []
            querySnapshot.forEach((doc) => {
                list.push(normalizeFundData(adaptFundV3ToLegacy({ isin: doc.id, ...doc.data() })))
            })
            setAssets(list)

            // Auto-audit for missing categories & ratings & metrics
            const missingCat = list.filter(f => !f.category_morningstar && (!f.std_extra?.category || f.std_extra.category === 'Sin Clasificar'));
            const missingRating = list.filter(f => !f.rating_overall && !f.std_extra?.rating);
            const missingMetrics = list.filter(f => {
                const p = f.std_perf || {};
                return (!p.alpha && p.alpha !== 0) || (!p.beta && p.beta !== 0) || (!p.max_drawdown && p.max_drawdown !== 0);
            });

            if (missingCat.length > 0) {
                console.warn(`Found ${missingCat.length} funds with missing Morningstar Category:`, missingCat.map(f => f.isin));
            }
            if (missingRating.length > 0) {
                console.warn(`Found ${missingRating.length} funds with missing Morningstar Rating (0 stars):`, missingRating.map(f => f.isin));
            }
            if (missingMetrics.length > 0) {
                console.warn(`Found ${missingMetrics.length} funds with missing Metrics (Alpha/Beta/MDD):`, missingMetrics.map(f => f.isin));
            }
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

            // STRICT MODE: Handle nulls by grouping them as 'Sin Clasificar' / 'Sin datos'
            // effectively moving "inference" to the presentation layer only.
            const rawType = p.std_type || 'Sin Clasificar'
            const region = extra.regionDetail || p.std_region || 'Sin asignar'

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
            else if (rawType === 'Sin Clasificar') label = 'Sin Clasificar'
            else label = 'Alternativos/Otros'

            typeMap[label] = (typeMap[label] || 0) + w

            // Geo Map
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

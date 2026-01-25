import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { normalizeFundData, adaptFundV3ToLegacy, REGION_DISPLAY_LABELS } from '../utils/normalizer'
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

            // Silent Audit: Solo loguear resumen si hay problemas graves en desarrollo
            if (process.env.NODE_ENV === 'development') {
                const missingCat = list.filter(f => !f.category_morningstar);
                if (missingCat.length > 50) console.warn(`[Audit] ${missingCat.length} fondos sin categoría Morningstar.`);
            }
        } catch (error) {
            console.error("usePortfolio: Error loading funds:", error)
        }
    }

    // Calculate Stats (Aligned with Canonical DB structure)
    useEffect(() => {
        const typeMap: any = {}
        const geoMap: any = {}

        portfolio.forEach(p => {
            const w = Number(p.weight) || 0

            // 1. Usar Asset Class directo de Derived (ya normalizado por el robot)
            const assetClass = p.derived?.asset_class || p.asset_class || 'Sin Clasificar'
            const regionKey = p.derived?.primary_region || p.primary_region || 'other'
            const regionLabel = REGION_DISPLAY_LABELS[regionKey] || regionKey

            // 2. Mapear a etiquetas visuales del SmartDonut
            let label = assetClass
            if (assetClass === 'RV' || assetClass === 'Equity') {
                if (regionKey === 'united_states' || regionKey === 'USA') label = 'RV Norteamérica'
                else if (regionKey === 'eurozone' || regionKey === 'europe_ex_euro' || regionKey === 'Europa' || regionKey === 'united_kingdom') label = 'RV Europa'
                else if (regionKey === 'asia_emerging' || regionKey === 'china' || regionKey === 'Emergentes' || regionKey === 'Asia') label = 'RV Emergentes/Asia'
                else label = 'RV Global'
            }
            else if (assetClass === 'RF' || assetClass === 'Fixed Income') {
                const category = (p.ms?.category_morningstar || "").toLowerCase()
                if (category.includes('gov') || category.includes('publica')) label = 'Deuda Pública'
                else if (category.includes('corp')) label = 'Crédito Corporativo'
                else label = 'Renta Fija Global'
            }
            else if (assetClass === 'Monetario') label = 'Monetarios'
            else if (assetClass === 'Retorno Absoluto') label = 'Retorno Absoluto'
            else if (assetClass === 'Commodities') label = 'Materias Primas'
            else if (assetClass === 'Mixto') label = 'Retorno Absoluto' // Agrupamos Mixtos en RA o Alternativos en UI
            else label = 'Alternativos/Otros'

            typeMap[label] = (typeMap[label] || 0) + w
            geoMap[regionLabel] = (geoMap[regionLabel] || 0) + w
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

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
                const missingCat = list.filter(f => !f.classification_v2?.asset_type);
                if (missingCat.length > 50) console.warn(`[Audit] ${missingCat.length} fondos sin clasificación v2.`);
            }
        } catch (error) {
            console.error("usePortfolio: Error loading funds:", error)
        }
    }

    // [FIX] Hydrate Portfolio with fresh Asset data
    // When assets are loaded (fresh from DB), update the stale items in portfolio (from localStorage)
    useEffect(() => {
        if (assets.length > 0) {
            setPortfolio(prevPortfolio => {
                if (prevPortfolio.length === 0) return prevPortfolio;

                let hasChanges = false;
                const nextPortfolio = prevPortfolio.map(p => {
                    const fresh = assets.find(a => a.isin === p.isin);
                    if (fresh) {
                        // Check if metrics changed (simple stringify check on std_perf)
                        const stalePerf = JSON.stringify(p.std_perf);
                        const freshPerf = JSON.stringify(fresh.std_perf);

                        // Also check manual/std_extra updates
                        const staleExtra = JSON.stringify(p.std_extra);
                        const freshExtra = JSON.stringify(fresh.std_extra);

                        if (stalePerf !== freshPerf || staleExtra !== freshExtra) {
                            hasChanges = true;
                            // Preserve user-defined portfolio fields by spreading 'p' first, then overwriting with 'fresh' fund data
                            // Note: 'fresh' does not have 'weight', 'score' etc, so they are kept from 'p'.
                            return { ...p, ...fresh };
                        }
                    }
                    return p;
                });

                if (hasChanges) {
                    return nextPortfolio;
                }
                return prevPortfolio;
            });
        }
    }, [assets]);

    // Calculate Stats (Aligned with V2 Canonical structure, fallback to legacy)
    useEffect(() => {
        const typeMap: any = {}
        const geoMap: any = {}

        portfolio.forEach(p => {
            const w = Number(p.weight) || 0

            // --- V2 PRIORITY for Asset Class ---
            let label = 'Alternativos/Otros'
            const v2type = p.classification_v2?.asset_type
            const v2subtype = p.classification_v2?.asset_subtype
            const v2region = p.classification_v2?.region_primary
            const v2sectorFocus = p.classification_v2?.sector_focus

            // V2 canonical path
            if (v2type === 'EQUITY') {
                if (v2sectorFocus === 'TECHNOLOGY') label = 'RV - Tecnología'
                else if (v2sectorFocus === 'HEALTHCARE') label = 'RV - Salud'
                else if (v2region === 'US') label = 'RV Norteamérica'
                else if (v2region === 'EUROPE' || v2region === 'EUROZONE') label = 'RV Europa'
                else if (v2region === 'EMERGING' || v2region === 'ASIA_DEV') label = 'RV Emergentes/Asia'
                else label = 'RV Global'
            } else if (v2type === 'FIXED_INCOME') {
                if (v2subtype === 'HIGH_YIELD_BOND') label = 'RF - High Yield'
                else if (v2subtype === 'CORPORATE_BOND') label = 'RF - Corporativa'
                else if (v2subtype === 'GOVERNMENT_BOND') label = 'RF - Soberana'
                else label = 'Renta Fija Global'
            } else if (v2type === 'MONETARY') {
                label = 'Monetarios'
            } else if (v2type === 'MIXED') {
                label = 'Mixto'
            } else if (v2type === 'ALTERNATIVE') {
                label = 'Alternativos'
            } else if (v2type === 'COMMODITIES') {
                label = 'Materias Primas'
            } else {
                label = 'Alternativos/Otros'
            }

            // --- V2 PRIORITY for Region ---
            let regionLabel = 'Global'
            if (v2region) {
                regionLabel = REGION_DISPLAY_LABELS[v2region] || v2region
            }

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

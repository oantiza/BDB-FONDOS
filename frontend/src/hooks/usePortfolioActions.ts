import { useState, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { query, collection, where, getDocs, limit } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { useToast } from '../context/ToastContext';
import { findAlternatives, Alternative } from '../utils/fundSwapper';
import { findDirectAlternativesV3 } from '../utils/directSearch';
import { normalizeFundData, adaptFundV3ToLegacy } from '../utils/normalizer';
import { generateSmartPortfolio } from '../utils/rulesEngine';
import { parsePortfolioCSV } from '../utils/csvImport';
import { Fund, PortfolioItem, SmartPortfolioResponse } from '../types';
import { MacroReport } from '../types/MacroReport';

// Unwrap callable/onRequest payloads (supports {result:{...}} or direct objects)
const unwrapResult = <T,>(x: any): T => (x && typeof x === 'object' && 'result' in x ? (x as any).result : x) as T;

interface UsePortfolioActionsProps {
    portfolio: PortfolioItem[];
    setPortfolio: (p: PortfolioItem[]) => void;
    assets: Fund[];
    riskLevel: number;
    numFunds: number;
    setProposedPortfolio: (p: PortfolioItem[]) => void;
    setTotalCapital: (n: number) => void;
    proposedPortfolio: PortfolioItem[];
    vipFunds: string;
    totalCapital: number; // ADDED
}

export function usePortfolioActions({
    portfolio, setPortfolio,
    assets, riskLevel,
    numFunds,
    setProposedPortfolio,
    setTotalCapital,
    proposedPortfolio,
    vipFunds,
    totalCapital // ADDED
}: UsePortfolioActionsProps) {
    const toast = useToast();
    const [isOptimizing, setIsOptimizing] = useState(false);

    // ... (existing state) ...

    // --- NEW: Round Decimals Handler ---
    const handleRoundDecimals = useCallback(() => {
        if (!portfolio.length || totalCapital <= 0) return;

        let newTotalCapital = 0;
        const roundedFunds = portfolio.map(p => {
            const currentCap = (p.weight / 100) * totalCapital;
            const roundedCap = Math.round(currentCap);
            newTotalCapital += roundedCap;
            return { ...p, _tempCap: roundedCap }; // Store temporarily
        });

        if (newTotalCapital === 0) return;

        // Recalculate weights based on new integers
        const newPortfolio = roundedFunds.map(p => {
            const { _tempCap, ...rest } = p;
            return {
                ...rest,
                weight: (_tempCap / newTotalCapital) * 100
            };
        });

        setTotalCapital(newTotalCapital);
        setPortfolio(newPortfolio);
        toast.success("Cartera ajustada a decimales exactos");
    }, [portfolio, totalCapital, setPortfolio, setTotalCapital, toast]);

    // ... (rest of the hook) ...

    // Modal & UI States
    const [modals, setModals] = useState({
        costs: false,
        tactical: false,
        macro: false,
        vip: false,
        review: false,
        sharpeMaximizer: false, // NEW
        savedPortfolios: false // NEW
    });
    const toggleModal = (key: keyof typeof modals, value: boolean) => setModals(prev => ({ ...prev, [key]: value }));

    const [selectedFund, setSelectedFund] = useState<Fund | null>(null);

    // Swapper State
    const [swapper, setSwapper] = useState<{
        isOpen: boolean;
        fund: PortfolioItem | null;
        alternatives: Alternative[];
    }>({
        isOpen: false,
        fund: null,
        alternatives: []
    });

    // 1. Asset Management Handlers
    const handleAddAsset = useCallback((asset: Fund) => {
        if (portfolio.some(p => p.isin === asset.isin)) {
            toast.info("Este fondo ya está en la cartera");
            return;
        }
        const newItem: PortfolioItem = { ...asset, weight: 0 };
        setPortfolio([...portfolio, newItem]);
        toast.success("Fondo añadido");
    }, [portfolio, setPortfolio, toast]);

    const handleRemoveAsset = useCallback((isin: string) => {
        setPortfolio(portfolio.filter(p => p.isin !== isin));
        toast.info("Fondo eliminado");
    }, [portfolio, setPortfolio, toast]);

    const handleUpdateWeight = useCallback((isin: string, value: string) => {
        const newWeight = parseFloat(value) || 0;
        setPortfolio(portfolio.map(p => p.isin === isin ? { ...p, weight: newWeight } : p));
    }, [portfolio, setPortfolio]);

    // 2. Swapper Handlers
    const handleOpenSwap = useCallback(async (fund: PortfolioItem, filters: { assetClass?: string; region?: string } = {}) => {
        toast.info("🔎 Buscando alternativas (Directo V3)...");

        // --- NEW DIRECT LOGIC (Requested by User) ---
        try {
            const excludeIsins = portfolio.map(p => p.isin);
            const rawAlts = await findDirectAlternativesV3(fund, {
                excludeIsins,
                desired: 3,
                ...filters
            });

            // Map raw results to the UI's expected format (Alternative[])
            // We normalize HERE just for display (so the modal shows stats), 
            // but the SEARCH was pure V3 'derived.asset_class' as requested.
            const alts = rawAlts.map(raw => {
                const normalized = normalizeFundData(adaptFundV3ToLegacy(raw));
                return {
                    fund: normalized,
                    reason: "Alternativa Directa V3",
                    score: 100, // Dummy score
                    deltaFee: (fund.std_extra?.ter || 0) - (normalized.std_extra?.ter || 0),
                    badgeColor: 'bg-green-100 text-green-800'
                };
            });

            if (alts.length === 0 && !filters.assetClass) {
                toast.error("No se encontraron alternativas similares.");
            } else if (alts.length === 0) {
                toast.info("No se encontraron fondos con los filtros seleccionados.");
            }

            setSwapper({
                isOpen: true,
                fund: fund,
                alternatives: alts
            });

        } catch (error) {
            console.error(error);
            toast.error("Error buscando alternativas.");
        }
    }, [portfolio, toast]);

    const performSwap = useCallback((newFund: Fund) => {
        if (!swapper.fund) return;
        const updatedPortfolio = portfolio.map(item => {
            if (item.isin === swapper.fund?.isin) {
                return { ...newFund, weight: item.weight, manualSwap: false };
            }
            return item;
        });
        setPortfolio(updatedPortfolio);
        setSwapper(prev => ({ ...prev, isOpen: false, fund: null }));
        toast.success("Fondo intercambiado con éxito");
    }, [swapper.fund, portfolio, setPortfolio, toast]);

    // 3. Generation & Optimization Handlers
    const handleManualGenerate = async () => {
        setIsOptimizing(true); // Show spinner immediately
        let universe = [...assets];

        // --- TRUE FIX: Ensure Universe Diversity ---
        // Always try to fetch massive universe if we have less than 2000 funds
        if (universe.length < 2000) {
            // SILENT LOADING: No toast, just spinner via isOptimizing
            try {
                // Fetch up to 400 funds to ensure we have enough variance (RV, RF, etc)
                // We prefer funds with 'std_perf' to ensure quality, but we take what we can get.
                // Since we can't easily filter by field existence in simple mode without composite indexes,
                // we just grab a larger chunk.
                // WE WANT ALL THE MEAT! (2500 limit should cover almost everything active)
                const fundsRef = collection(db, 'funds_v3');
                const q = query(fundsRef, limit(2500));
                toast.info("🥩 Cargando TODO el universo (2.5k fondos) para máxima precisión...");
                const snapshot = await getDocs(q);

                // Helper to normalize (duplicated from useAssets to avoid circular deps if not exported)
                // We'll trust the component imports `normalizeFundData` if available, or do a rough map.
                // Actually, let's just map roughly as the Engine handles loose data.
                const fetchedFunds: Fund[] = [];
                snapshot.forEach(doc => {
                    const raw = { isin: doc.id, ...doc.data() };
                    // Use standard normalizer to ensure 'asset_class' and 'primary_region' 
                    // are correctly mapped from 'derived' or 'ms' for the Rules Engine.
                    fetchedFunds.push(normalizeFundData(adaptFundV3ToLegacy(raw)));
                });

                // Merge with existing assets (deduplicating by ISIN)
                const existingIsins = new Set(universe.map(u => u.isin));
                fetchedFunds.forEach(f => {
                    if (!existingIsins.has(f.isin)) {
                        universe.push(f);
                        existingIsins.add(f.isin);
                    }
                });


            } catch (err) {
                console.error("Error fetching extended universe:", err);
                // Silent fallback
            }
        }

        if (universe.length === 0) {
            setIsOptimizing(false);
            // toast.error("No se han cargado fondos. Revisa tu conexión.");
            return;
        }

        try {
            // setIsOptimizing(true); // Already true
            setPortfolio([]);
            // Basic support for VIP in manual mode (pre-seed)
            const vipList = vipFunds
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                // Extraer ISIN limpio aunque venga "ISIN - Nombre"
                .map(s => s.split(' ')[0]);

            let generated = generateSmartPortfolio(riskLevel, universe, numFunds);

            // Force VIPs if not present (simple hack for manual mode)
            if (vipList.length > 0) {
                // Remove lowest score funds to make space for VIPs
                const existingIsins = new Set(generated.map(g => g.isin));
                const missingVips = vipList.filter(v => !existingIsins.has(v));

                missingVips.forEach(vipIsin => {
                    const fund = universe.find(a => a.isin === vipIsin);
                    if (fund) {
                        if (generated.length >= numFunds) generated.pop(); // Remove last
                        generated.unshift({ ...fund, weight: 0 }); // Add VIP at top
                    }
                });
            }

            if (generated.length === 0) {
                // toast.error("No hay fondos elegibles con los filtros actuales (revisa clasificación/quality).");
                console.warn("No hay fondos elegibles");
            }
            else {
                // Redistribute weights roughly
                const count = generated.length;
                generated = generated.map(p => ({ ...p, weight: Number((100 / count).toFixed(2)) }));
                setPortfolio(generated);
                toast.success(`Cartera generada (Perfil ${riskLevel})`);
            }
        } catch (e: any) {
            // toast.error("Error local: " + (e.message || String(e)));
            console.error(e);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleOptimize = async () => {
        if (portfolio.length === 0) {
            toast.info("Añade fondos a la cartera primero");
            return;
        }

        // --- VALIDATION: Check Data Quality ---
        // DISABLED: User confirmed all funds have history.
        // const validFunds = portfolio.filter(p => { ... });
        // if (validFunds.length < 3) { ... }

        setIsOptimizing(true);
        try {
            const optimizeFn = httpsCallable(functions, 'optimize_portfolio_quant');

            // Parse VIP Funds
            const vipList = vipFunds.split(',').map(s => s.trim()).filter(Boolean);

            // Prepare Asset Universe (Portfolio + VIPs)
            const assetUniverse = new Set(portfolio.map(p => p.isin));
            vipList.forEach(v => assetUniverse.add(v));

            // Prepare Locked Assets (Manual Swaps + VIPs)
            const lockedSet = new Set(portfolio.filter(p => p.manualSwap).map(p => p.isin));
            vipList.forEach(v => lockedSet.add(v));

            const response = await optimizeFn({
                assets: Array.from(assetUniverse),
                risk_level: riskLevel,
                locked_assets: Array.from(lockedSet)
            });
            const result = unwrapResult<SmartPortfolioResponse>(response.data);
            processOptimizationResult(result, optimizeFn);

        } catch (error: any) {
            toast.error("Error crítico al contactar el servidor: " + error.message);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleRebalance = async () => {
        if (portfolio.length === 0) {
            toast.info("Añade fondos a la cartera primero");
            return;
        }
        setIsOptimizing(true);

        try {
            const optimizeFn = httpsCallable(functions, 'optimize_portfolio_quant');

            // STRICT MODE: Only use current assets
            const currentIsins = portfolio.map(p => p.isin);

            // NO VIP injection, NO Challengers.
            const response = await optimizeFn({
                assets: currentIsins,
                risk_level: riskLevel,
                locked_assets: [],
                // Enable Smart Challenges for Rebalance too
                // disable_challengers: true, 
                ignore_constraints: true // <--- PURE REBALANCE (Markowitz Only)
            });

            const result = unwrapResult<SmartPortfolioResponse>(response.data);
            processOptimizationResult(result, optimizeFn);

        } catch (error: any) {
            toast.error("Error en Rebalanceo: " + error.message);
        } finally {
            setIsOptimizing(false);
        }
    };

    // Helper to avoid duplication
    const processOptimizationResult = async (result: SmartPortfolioResponse, optimizeFn: any) => {
        if (result.status === 'optimal' || result.status === 'fallback') {
            const weights = result.weights || {};
            let hasChanges = false;
            const optimized = portfolio.map(p => {
                const rawWeight = (weights[p.isin] || 0) * 100;
                const newWeight = Math.round(rawWeight * 100) / 100;
                if (Math.abs(newWeight - p.weight) > 0.5) hasChanges = true;
                return { ...p, weight: newWeight };
            }).filter(p => p.weight > 0.01);

            // If auto-expanded, add new funds that weren't in portfolio
            if (result.used_assets) {
                const currentIsins = new Set(portfolio.map(p => p.isin));
                result.used_assets.forEach(isin => {
                    if (!currentIsins.has(isin) && (weights[isin] || 0) > 0.01) {
                        // Fetch basic info if possible or use minimal placeholder
                        const known = assets.find(a => a.isin === isin) || ({ isin, name: 'Fund (Auto-Added)', std_type: 'RV' } as Fund);
                        if (known) {
                            optimized.push({ ...known, weight: Math.round((weights[isin] || 0) * 10000) / 100 });
                            hasChanges = true;
                        }
                    }
                });
            }

            if (!hasChanges) {
                toast.success("✅ La cartera ya está optimizada.");
                setProposedPortfolio(optimized);
                toggleModal('tactical', true);
            } else {
                setProposedPortfolio(optimized);
                toggleModal('review', true);
            }
        } else if (result.status === 'infeasible_equity_floor') {
            const feasible = result.feasibility?.equity_max_achievable || 0;
            const requested = result.feasibility?.equity_floor_requested || 0;
            const msg = `⚠️ La cartera seleccionada no puede alcanzar el ${Math.round(requested * 100)}% de RV requerido (Máx posible: ${Math.round(feasible * 100)}%).\n\n¿Quieres que el sistema añada automáticamente fondos de Renta Variable para cumplir el objetivo?`;

            if (window.confirm(msg)) {
                toast.info("🔄 Auto-completando cartera con fondos de RV...");
                // Re-try with auto_expand
                const response2 = await optimizeFn({
                    assets: portfolio.map(p => p.isin),
                    risk_level: riskLevel,
                    locked_assets: portfolio.filter(p => p.manualSwap).map(p => p.isin),
                    auto_expand_universe: true
                });
                const result2 = unwrapResult<SmartPortfolioResponse>(response2.data);
                processOptimizationResult(result2, optimizeFn); // Recursive success check
            } else {
                toast.info("Optimización cancelada por falta de RV.");
            }

        } else if (result.status === 'fallback_no_history') {
            const suggestion = result.suggestion || "Prueba a cambiar los fondos.";
            const warnings = result.warnings?.join('\n') || "Insuficientes datos.";

            // Show modal or detailed error
            const msg = `❌ Error de Datos Históricos\n\n${warnings}\n\nSugerencia: ${suggestion}\n\n¿Quieres intentar activar el modo 'Auto-Expandir Universo' para completar la cartera con fondos seguros?`;

            if (window.confirm(msg)) {
                // Retry with auto-expand
                toast.info("🔄 Reintentando con Auto-Expansión...");
                const response3 = await optimizeFn({
                    assets: portfolio.map(p => p.isin),
                    risk_level: riskLevel,
                    locked_assets: portfolio.filter(p => p.manualSwap).map(p => p.isin),
                    auto_expand_universe: true
                });
                const result3 = unwrapResult<SmartPortfolioResponse>(response3.data);
                processOptimizationResult(result3, optimizeFn);
            }
        } else {
            toast.error("Error en la optimización: " + (result.warnings?.[0] || 'Desconocido'));
        }
    }

    // 4. Tactical/Review Modal Handlers
    const handleApplyDirectly = () => {
        setPortfolio(proposedPortfolio);
        toggleModal('review', false);
        toast.success("Optimización aplicada");
    };

    const handleReviewAccept = () => {
        toggleModal('review', false);
        toggleModal('tactical', true);
    };

    const handleAcceptPortfolio = (newPortfolio: PortfolioItem[]) => {
        setPortfolio(newPortfolio);
        toggleModal('tactical', false);
        toast.success("Cartera táctica aplicada");
    };

    const handleMacroApply = (newProposal: PortfolioItem[]) => {
        setProposedPortfolio(newProposal);
        toggleModal('macro', false);
        toggleModal('tactical', true);
    };

    // 5. CSV Import Handler
    // We'll keep the ref in the component, but the logic here
    const handleImportCSV = async (text: string) => {
        const result = parsePortfolioCSV(text);
        if (result.error) { toast.error(result.error); return; }
        if (result.portfolio && window.confirm(`Se han detectado ${result.portfolio.length} fondos. ¿Reemplazar cartera actual?`)) {
            const enriched: PortfolioItem[] = result.portfolio.map(p => {
                const known = assets.find(a => a.isin === p.isin);
                // Merge strategies:
                // 1. Base on CSV data (p) for value/weight
                // 2. Overwrite with DB data (known) for Name/Type/Risk
                // 3. Ensure critical CSV metrics (Value/Weight) are kept (in case 'known' has stale defaults)
                if (known) {
                    return { ...p, ...known, value: p.value, weight: p.weight };
                } else {
                    return { ...p, std_type: (p as any).std_type || 'Unknown' } as PortfolioItem;
                }
            });
            setPortfolio(enriched);
            setTotalCapital(result.totalValue);
            toast.success("Cartera importada correctamente");
        }
    };

    return {
        isOptimizing,
        modals,
        toggleModal,
        selectedFund, setSelectedFund,
        swapper, setSwapper,
        // Handlers
        handleAddAsset,
        handleRemoveAsset,
        handleUpdateWeight,
        handleOpenSwap,
        performSwap,
        handleManualGenerate,
        handleOptimize,
        handleRebalance,
        handleApplyDirectly,
        handleReviewAccept,
        handleAcceptPortfolio,
        handleMacroApply,
        handleImportCSV,
        handleRoundDecimals // FIX: Export the handler
    };
}

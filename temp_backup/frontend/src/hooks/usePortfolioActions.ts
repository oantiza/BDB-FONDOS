import { useState, useCallback, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { query, collection, where, getDocs, limit } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { useToast } from '../context/ToastContext';
import { findAlternatives, Alternative } from '../utils/fundSwapper';
import { findDirectAlternativesV3 } from '../utils/directSearch';
import { normalizeFundData, adaptFundV3ToLegacy } from '../utils/normalizer';
import { generateSmartPortfolioLocal } from '../utils/rulesEngine';
import { parsePortfolioCSV } from '../utils/csvImport';
import { Fund, PortfolioItem, SmartPortfolioResponse } from '../types';
import { calculatePortfolioPoint } from '../utils/portfolioAnalyticsEngine';
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
    totalCapital: number;
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
    const [explainabilityData, setExplainabilityData] = useState<any>(null);

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
        sharpeMaximizer: false,
        savedPortfolios: false,
        analysis: false,
        optimizationStrategy: false
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

    const [analysisResult, setAnalysisResult] = useState<any>(null); // Existing

    // --- NEW: Interactive Frontier State ---
    const [interactiveMathData, setInteractiveMathData] = useState<{
        ordered_isins: string[],
        expected_returns: Record<string, number>,
        covariance_matrix: number[][]
    } | null>(null);

    const [interactivePoint, setInteractivePoint] = useState<{ x: number, y: number } | null>(null);

    // Effect to recalculate point when weights or math data changes
    useEffect(() => {
        if (!interactiveMathData || portfolio.length === 0) {
            setInteractivePoint(null);
            return;
        }

        const weights = portfolio.reduce((acc, curr) => {
            // Treat UI weights (e.g., 25 for 25%) as decimals for the engine
            acc[curr.isin] = curr.weight / 100;
            return acc;
        }, {} as Record<string, number>);

        const point = calculatePortfolioPoint(
            weights,
            interactiveMathData.expected_returns,
            interactiveMathData.covariance_matrix,
            interactiveMathData.ordered_isins
        );

        setInteractivePoint(point);
    }, [portfolio, interactiveMathData]);

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

    const handleToggleLock = useCallback((isin: string) => {
        setPortfolio(portfolio.map(p => p.isin === isin ? { ...p, isLocked: !p.isLocked } : p));
    }, [portfolio, setPortfolio]);

    const handleAutoCompletePortfolio = useCallback(() => {
        if (portfolio.length >= numFunds || assets.length === 0) {
            toast.info(`La cartera ya tiene ${portfolio.length} fondos o no hay fondos disponibles.`);
            return;
        }

        const needed = numFunds - portfolio.length;
        const currentIsins = new Set(portfolio.map(p => p.isin));

        // --- SMART AUTOCOMPLETE BASED ON RISK BUCKETS ---
        // Profile 1-3: Prioritize RF & Monetario
        // Profile 8-10: Prioritize RV
        // Profile 4-7: General / Mixto
        const p_level = Number(riskLevel);
        let validTypes = new Set(['RV', 'EQUITY', 'RF', 'FIXED_INCOME', 'FIXED INCOME', 'Mixto', 'MIXED', 'Monetario', 'MONETARY']);

        if (p_level <= 3) {
            validTypes = new Set(['RF', 'FIXED_INCOME', 'FIXED INCOME', 'Monetario', 'MONETARY', 'Mixto', 'MIXED']);
        } else if (p_level >= 8) {
            validTypes = new Set(['RV', 'EQUITY']);
        }

        // Pick best Sharpe from universe that aren't in portfolio and match risk constraints loosely
        const available = assets.filter(a => {
            if (currentIsins.has(a.isin)) return false;
            if (!a.std_perf || !a.std_perf.sharpe) return false;

            const type = a.derived?.asset_class || a.std_type || 'Unknown';
            if (!validTypes.has(type)) return false;

            // Restrict Emerging Markets for low risk profiles (<= 3)
            if (p_level <= 3) {
                if (a.classification_v2?.region_primary === "EMERGING") {
                    return false;
                }
                const region = (a.derived?.primary_region || a.std_region || '').toLowerCase();
                const category = (a.derived?.asset_class || a.std_type || (a as any).category || '').toLowerCase();
                if (region.includes('emergentes') || region.includes('emerging') || category.includes('emergentes') || category.includes('emerging')) {
                    return false;
                }
            }

            return true;
        });

        // Fallback: If strict filtering returns fewer options than needed (e.g. database tag issues), loosen it
        const finalAvailable = available.length >= needed ? available : assets.filter(a => !currentIsins.has(a.isin) && a.std_perf && a.std_perf.sharpe);

        finalAvailable.sort((a, b) => (b.std_perf?.sharpe || 0) - (a.std_perf?.sharpe || 0));

        const toAdd = finalAvailable.slice(0, needed).map(a => ({ ...a, weight: 0 }));

        setPortfolio([...portfolio, ...toAdd]);
        toast.success(`Se auto-completaron ${toAdd.length} fondos (Perfil ${p_level}) para llegar a ${numFunds}`);
    }, [portfolio, numFunds, assets, riskLevel, setPortfolio, toast]);

    // 2. Swapper Handlers
    const handleOpenSwap = useCallback(async (fund: PortfolioItem, filters: { assetClass?: string; region?: string; maximizeRetro?: boolean; offset?: number } = {}) => {
        toast.info("🔎 Buscando alternativas (Directo V3)...");

        // --- SMART FUND REPLACEMENT LOGIC ---
        // If no filters provided (initial open), enforce strict matching to current fund's category/region
        const activeFilters = {
            assetClass: filters.assetClass || (fund.derived?.asset_class || fund.std_type || 'RV'),
            region: filters.region || (fund.derived?.primary_region || fund.std_region || 'all'),
            maximizeRetro: filters.maximizeRetro || false,
            offset: filters.offset || 0
        };

        try {
            const excludeIsins = portfolio.map(p => p.isin);
            const rawAlts = await findDirectAlternativesV3(fund, {
                excludeIsins,
                desired: 3,
                ...activeFilters // Apply the strict filters, max retro toggle, and pagination offset
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
                // Set manualSwap to TRUE to lock the selection
                return { ...newFund, weight: item.weight, manualSwap: true };
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

            let generated = generateSmartPortfolioLocal(riskLevel, universe, numFunds);

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

    // --- Eliminated fuzzy logic (mapCategoryToTag) to respect DB truth (Point 1 Architecture) ---

    const optimizationArgsRef = useRef<any>(null);

    const handleOptimize = async (uiViews?: Record<string, string> | any) => {
        if (portfolio.length === 0) {
            toast.info("Añade fondos a la cartera primero");
            return;
        }

        // If uiViews is actually an Event (e.g. from onClick), ignore it.
        if (uiViews && (uiViews.nativeEvent || uiViews.type === 'click')) {
            uiViews = undefined;
        }

        const lockedCount = portfolio.filter(p => p.isLocked).length;
        const newCount = portfolio.filter(p => !p.isLocked).length;

        if (lockedCount > 0 && newCount > 0) {
            optimizationArgsRef.current = uiViews;
            toggleModal('optimizationStrategy', true);
            return;
        }

        await proceedWithOptimization(uiViews, null);
    };

    const handleProceedStrategy = async (strategy: 'add_capital' | 'redistribute', extraCapital: number) => {
        toggleModal('optimizationStrategy', false);
        if (strategy === 'add_capital' && extraCapital > 0) {
            setTotalCapital(totalCapital + extraCapital);
        }
        await proceedWithOptimization(optimizationArgsRef.current, { mode: strategy, extraCapital });
    };

    const proceedWithOptimization = async (uiViews?: Record<string, string> | any, strategyPayload?: any | null) => {

        setIsOptimizing(true);
        try {
            const optimizeFn = httpsCallable(functions, 'optimize_portfolio_quant');

            const isRebalance = strategyPayload?.isRebalance === true;

            // Parse VIP Funds (Skip for rebalance to keep logic contained)
            const vipList = isRebalance ? [] : vipFunds.split(',').map(s => s.trim()).filter(Boolean);

            // Prepare Asset Universe (Portfolio + VIPs)
            const assetUniverse = new Set(portfolio.map(p => p.isin));
            vipList.forEach(v => assetUniverse.add(v));

            // Prepare Locked Assets (Manual Swaps + VIPs + isLocked)
            const lockedSet = new Set(portfolio.filter(p => p.manualSwap || p.isLocked).map(p => p.isin));
            vipList.forEach(v => lockedSet.add(v));

            // --- BUILD METADATA FOR BACKEND ---
            // Fixes issue where backend doesn't know the category of frontend-only funds (e.g. CSV).
            // We ONLY pass raw classes from the frontend and avoid fuzzy overwriting DB truth.
            const assetMetadata: Record<string, any> = {};
            // 1. From Portfolio
            portfolio.forEach(p => {
                const fullFund = assets.find(a => a.isin === p.isin);
                const typeRaw = fullFund?.classification_v2?.asset_type || fullFund?.derived?.asset_class || fullFund?.std_type || (p as any).std_type || (p as any).category || (p as any).asset_class;
                assetMetadata[p.isin] = {
                    // We only provide a generic label if it's strictly one of our known types, 
                    // otherwise let backend derive it from db.
                    asset_class: typeRaw,
                    name: p.name
                };
            });
            // 2. From Assets (for VIP/Universe not in portfolio)
            assets.forEach(a => {
                if (assetUniverse.has(a.isin) && !assetMetadata[a.isin]) {
                    assetMetadata[a.isin] = {
                        asset_class: a.derived?.asset_class || a.std_type || a.asset_class,
                        name: a.name
                    };
                }
            });

            // --- TRANSLATE TACTICAL VIEWS FOR BLACK-LITTERMAN ---
            const tacticalViews: Record<string, number> = {};
            if (uiViews && Object.keys(uiViews).length > 0) {
                Object.entries(uiViews).forEach(([viewKey, viewAction]) => {
                    if (typeof viewAction !== 'string') return;
                    const actionUpper = viewAction.toUpperCase();
                    let viewNum = 0.0;

                    if (actionUpper === 'SOBREPONDERAR' || actionUpper === 'POSITIVO') {
                        viewNum = 0.02;
                    } else if (actionUpper === 'INFRAPONDERAR' || actionUpper === 'NEGATIVO') {
                        viewNum = -0.02;
                    }

                    if (viewNum === 0.0) return; // Skip NEUTRAL or others

                    // Apply view to funds matching the region or asset class
                    assets.forEach(asset => {
                        if (!assetUniverse.has(asset.isin)) return;

                        const matchParams = [
                            asset.derived?.primary_region,
                            asset.derived?.asset_class,
                            asset.std_region,
                            asset.std_type,
                            assetMetadata[asset.isin]?.label
                        ].map(s => s?.toLowerCase() || '');

                        const searchKey = viewKey.toLowerCase();

                        // Check if any of the asset parameters include the viewKey
                        if (matchParams.some(param => param.includes(searchKey))) {
                            tacticalViews[asset.isin] = viewNum;
                        }
                    });
                });
            }
            // Calculate Fixed Weights for locked assets
            const fixedWeights: Record<string, number> = {};
            const isAddCapital = strategyPayload?.mode === 'add_capital';
            const extraCap = strategyPayload?.extraCapital || 0;
            const newTotalCapital = totalCapital + (isAddCapital ? extraCap : 0);

            portfolio.forEach((p, idx) => {
                if (p.isLocked) {
                    if (isAddCapital && newTotalCapital > 0) {
                        const money = (p.weight / 100.0) * totalCapital;
                        fixedWeights[p.isin] = money / newTotalCapital;
                    } else {
                        fixedWeights[p.isin] = p.weight / 100.0;
                    }
                }
            });

            const payload: any = {
                assets: Array.from(assetUniverse),
                risk_level: riskLevel,
                locked_assets: Array.from(lockedSet),
                asset_metadata: assetMetadata,
                constraints: {
                    apply_profile: true,
                    lock_mode: strategyPayload?.mode || 'redistribute',
                    fixed_weights: fixedWeights
                }
            };

            // Force objective to min_deviation target block
            if (isRebalance) {
                payload.objective = 'min_deviation';
                const targetWeights: Record<string, number> = {};
                portfolio.forEach(p => {
                    targetWeights[p.isin] = p.weight / 100.0;
                });
                payload.target_weights = targetWeights;
            }

            if (Object.keys(tacticalViews).length > 0) {
                payload.tactical_views = tacticalViews;
            }

            const response = await optimizeFn(payload);
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
        await proceedWithOptimization(null, { mode: 'rebalance', isRebalance: true });
    };

    // Helper to avoid duplication
    const processOptimizationResult = async (result: SmartPortfolioResponse, optimizeFn: any, options?: { strict?: boolean }) => {
        if (result.status === 'optimal' || result.status === 'fallback') {
            const weights = result.weights || {};
            let hasChanges = false;

            // MAP Weights
            let optimized = portfolio.map(p => {
                const rawWeight = (weights[p.isin] || 0) * 100;
                const newWeight = Math.round(rawWeight * 100) / 100;
                if (Math.abs(newWeight - p.weight) > 0.5) hasChanges = true;
                return { ...p, weight: newWeight };
            });

            // FILTER removal (Only if NOT strict)
            if (!options?.strict) {
                optimized = optimized.filter(p => p.weight > 0.01);
            }

            // ADD new funds (Only if NOT strict)
            if (!options?.strict && result.used_assets) {
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
                setExplainabilityData(result.explainability || null);
                setProposedPortfolio(optimized);
                toggleModal('tactical', true);
            } else {
                setExplainabilityData(result.explainability || null);
                setProposedPortfolio(optimized);
                // IF we want to show optimization difference -> Review Modal
                toggleModal('review', true);
            }
        } else if (result.status === 'infeasible') {
            const msg = result.message || "Faltan datos para equilibrar la cartera matemáticamente.\n\n¿Quieres que el sistema añada automáticamente fondos globales válidos para intentar cuadrar el modelo?";

            if (window.confirm(msg)) {
                toast.info("🔄 Añadiendo fondos sugeridos y reintentando...");
                // Re-try manually injecting the recovery_candidates
                const expandedAssets = [...portfolio.map(p => p.isin)];
                if (result.recovery_candidates) {
                    result.recovery_candidates.forEach((c: string) => {
                        if (!expandedAssets.includes(c)) expandedAssets.push(c);
                    });
                }

                const response2 = await optimizeFn({
                    assets: expandedAssets,
                    risk_level: riskLevel,
                    locked_assets: portfolio.filter(p => p.manualSwap).map(p => p.isin),
                    // No need for auto_expand_universe because we explicitly appended the ISINs
                });
                const result2 = unwrapResult<SmartPortfolioResponse>(response2.data);
                processOptimizationResult(result2, optimizeFn);
            } else {
                toast.info("Optimización cancelada.");
            }

        } else if (result.status === 'infeasible_equity_floor') {
            const feasible = result.feasibility?.equity_max_achievable || 0;
            const requested = result.feasibility?.equity_floor_requested || 0;
            const msg = `⚠️ La cartera seleccionada no puede alcanzar el ${Math.round(requested * 100)}% de RV requerido (Máx posible: ${Math.round(feasible * 100)}%).\n\n¿Quieres que el sistema añada automáticamente fondos de Renta Variable para cumplir el objetivo?`;

            if (window.confirm(msg)) {
                toast.info("🔄 Auto-completando cartera con fondos de RV...");
                // Note: The python backend might still expect `auto_expand_universe` for this specific fallback
                // but ideally this should also be migrated to explicit lists in the future.
                const response2 = await optimizeFn({
                    assets: portfolio.map(p => p.isin),
                    risk_level: riskLevel,
                    locked_assets: portfolio.filter(p => p.manualSwap).map(p => p.isin),
                    auto_expand_universe: true
                });
                const result2 = unwrapResult<SmartPortfolioResponse>(response2.data);
                processOptimizationResult(result2, optimizeFn);
            } else {
                toast.info("Optimización cancelada por falta de RV.");
            }

        } else if (result.status === 'fallback_no_history') {
            const suggestion = result.suggestion || "Prueba a cambiar los fondos.";
            const warnings = result.warnings?.join('\n') || "Insuficientes datos.";

            // Show modal or detailed error
            const msg = `❌ Error de Datos Históricos\n\n${warnings}\n\nSugerencia: ${suggestion}\n\n¿Quieres intentar completar la cartera con fondos seguros?`;

            if (window.confirm(msg)) {
                toast.info("🔄 Reintentando con fondos base...");
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

    const handleAnalyzePortfolio = useCallback(async () => {
        if (portfolio.length === 0) {
            toast.info("Añade fondos a la cartera primero");
            return;
        }
        setIsOptimizing(true);
        try {
            const analyzeFn = httpsCallable(functions, 'analyze_portfolio_endpoint');
            const response = await analyzeFn({
                portfolio: portfolio.map(p => ({ isin: p.isin, weight: p.weight }))
            });
            const result = unwrapResult<any>(response.data);
            if (result.error) {
                toast.error("Error en análisis: " + result.error);
            } else {
                setAnalysisResult(result);
                // Keep the math data update here too, just in case they clicked this first.
                if (result.math_data) {
                    setInteractiveMathData({
                        ordered_isins: result.math_data.ordered_isins || [],
                        expected_returns: result.math_data.expected_returns || {},
                        covariance_matrix: result.math_data.covariance_matrix || []
                    });
                }
                toggleModal('analysis', true);
            }
        } catch (error: any) {
            toast.error("Error al analizar cartera: " + error.message);
        } finally {
            setIsOptimizing(false);
        }
    }, [portfolio, setInteractiveMathData, setAnalysisResult, toggleModal, toast]);

    const handleFetchInteractiveFrontier = useCallback(async () => {
        if (portfolio.length === 0) {
            toast.info("Añade fondos a la cartera primero");
            return;
        }
        setIsOptimizing(true);
        try {
            const getFrontierFn = httpsCallable(functions, 'getEfficientFrontier');
            const response = await getFrontierFn({
                portfolio: portfolio.map(p => ({ isin: p.isin, weight: p.weight }))
            });
            const result = unwrapResult<any>(response.data);

            if (result.error) {
                toast.error("Error al sincronizar datos matemáticos: " + result.error);
            } else if (result.math_data) {
                setInteractiveMathData({
                    ordered_isins: result.math_data.ordered_isins || [],
                    expected_returns: result.math_data.expected_returns || {},
                    covariance_matrix: result.math_data.covariance_matrix || []
                });
                toast.success("✅ Modo Simulación Live Activado");
            } else {
                toast.error("No se pudieron obtener los datos matemáticos.");
            }
        } catch (error: any) {
            toast.error("Error al conectar con el servidor: " + error.message);
        } finally {
            setIsOptimizing(false);
        }
    }, [portfolio, setInteractiveMathData, toast]);

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
        handleRoundDecimals,
        handleAnalyzePortfolio, // NEW
        handleFetchInteractiveFrontier, // NEW
        handleToggleLock,
        handleAutoCompletePortfolio,
        handleProceedStrategy,
        analysisResult, // NEW
        // Interactive Frontier State
        interactiveMathData,
        interactivePoint
    };
}

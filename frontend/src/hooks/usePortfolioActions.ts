import { useState, useCallback, useRef, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { query, collection, where, getDocs, limit } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { useToast } from '../context/ToastContext';
import { findAlternatives, Alternative } from '../utils/fundSwapper';
import { findDirectAlternativesV3 } from '../utils/directSearch';
import { normalizeFundData, adaptFundV3ToLegacy } from '../utils/normalizer';
import { generateSmartPortfolioLocal, isFundSuitableForProfile } from '../utils/rulesEngine';
import { parsePortfolioCSV } from '../utils/csvImport';
import { Fund, PortfolioItem, SmartPortfolioResponse, OptimizationRequest, OptimizationAsset } from '../types';
import { calculatePortfolioPoint } from '../utils/portfolioAnalyticsEngine';
import { MacroReport } from '../types/MacroReport';

// Unwrap callable/onRequest payloads (supports {result:{...}} or direct objects)
const unwrapResult = <T,>(x: any): T => (x && typeof x === 'object' && 'result' in x ? (x as any).result : x) as T;

const APPLICABLE_OPTIMIZER_STATUSES = new Set([
    'optimal_compliant',
    'optimal_with_warnings',
    'fallback_compliant'
]);

export function isOptimizerResultApplicable(result: Pick<SmartPortfolioResponse, 'status' | 'applicable' | 'usable'>): boolean {
    if (result.status === 'fallback_non_compliant') return false;
    if (result.usable === false || result.applicable === false) return false;
    return APPLICABLE_OPTIMIZER_STATUSES.has(String(result.status || ''));
}

export type SnapshotOptions = {
    save_snapshot?: boolean;
    snapshot_label?: string;
};

// --- Optimization Pure Helpers ---

function buildAssetMetadata(
    portfolio: PortfolioItem[], 
    assets: Fund[], 
    assetUniverse: Set<string>
): Record<string, OptimizationAsset> {
    const assetMetadata: Record<string, OptimizationAsset> = {};
    // 1. From Portfolio
    portfolio.forEach(p => {
        const fullFund = assets.find(a => a.isin === p.isin);
        const typeRaw = fullFund?.classification_v2?.asset_type || (p as any).std_type || (p as any).category || (p as any).asset_class;
        assetMetadata[p.isin] = {
            asset_class: typeRaw,
            name: p.name
        };
    });
    // 2. From Assets (for VIP/Universe not in portfolio)
    assets.forEach(a => {
        if (assetUniverse.has(a.isin) && !assetMetadata[a.isin]) {
            assetMetadata[a.isin] = {
                asset_class: a.classification_v2?.asset_type || (a as any).asset_class,
                name: a.name
            };
        }
    });
    return assetMetadata;
}

function mapTacticalViews(
    uiViews: Record<string, string> | undefined, 
    assets: Fund[], 
    assetUniverse: Set<string>, 
    assetMetadata: Record<string, OptimizationAsset>
): Record<string, number> {
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

            if (viewNum === 0.0) return;

            assets.forEach(asset => {
                if (!assetUniverse.has(asset.isin)) return;

                const matchParams = [
                    asset.classification_v2?.region_primary,
                    asset.classification_v2?.asset_type,
                    (assetMetadata[asset.isin] as any)?.label
                ].map(s => s?.toLowerCase() || '');

                const searchKey = viewKey.toLowerCase();
                if (matchParams.some(param => param.includes(searchKey))) {
                    tacticalViews[asset.isin] = viewNum;
                }
            });
        });
    }
    return tacticalViews;
}

function buildOptimizationPayload(
    portfolio: PortfolioItem[],
    assets: Fund[],
    vipFunds: string,
    totalCapital: number,
    riskLevel: number,
    strategyPayload?: any,
    uiViews?: Record<string, string>,
    snapshotOpts?: SnapshotOptions
): { payload: OptimizationRequest, finalSnapshotOpts: SnapshotOptions } {
    const vipList = vipFunds.split(',').map(s => s.trim()).filter(Boolean);
    const assetUniverse = new Set(portfolio.map(p => p.isin));
    vipList.forEach(v => assetUniverse.add(v));

    const lockedSet = new Set(portfolio.filter(p => p.isLocked).map(p => p.isin));
    vipList.forEach(v => lockedSet.add(v));

    const assetMetadata = buildAssetMetadata(portfolio, assets, assetUniverse);
    const tacticalViews = mapTacticalViews(uiViews, assets, assetUniverse, assetMetadata);
    
    const isAddCapital = strategyPayload?.mode === 'add_capital';
    const extraCap = strategyPayload?.extraCapital || 0;
    const newTotalCapital = totalCapital + (isAddCapital ? extraCap : 0);

    const fixedWeights: Record<string, number> = {};
    portfolio.forEach(p => {
        if (p.isLocked) {
            if (isAddCapital && newTotalCapital > 0) {
                const money = (p.weight / 100.0) * totalCapital;
                fixedWeights[p.isin] = money / newTotalCapital;
            } else {
                fixedWeights[p.isin] = p.weight / 100.0;
            }
        }
    });

    const payload: OptimizationRequest = {
        assets: Array.from(assetUniverse),
        risk_level: riskLevel,
        profile_id: String(riskLevel),
        optimization_mode: 'rebalance_to_profile',
        locked_assets: Array.from(lockedSet),
        locked_positions: {
            mode: isAddCapital ? 'keep_money' : 'keep_weight',
            positions: fixedWeights
        },
        asset_metadata: assetMetadata,
        constraints: {
            apply_profile: true,
            optimization_mode: 'rebalance_to_profile',
            lock_mode: isAddCapital ? 'keep_money' : 'keep_weight',
            fixed_weights: fixedWeights
        }
    };

    if (Object.keys(tacticalViews).length > 0) {
        payload.tactical_views = tacticalViews;
    }

    const finalSnapshotOpts: SnapshotOptions = { ...snapshotOpts };
    const globalSnapshotLabel = (window as Window & { __BDB_SNAPSHOT_LABEL__?: string }).__BDB_SNAPSHOT_LABEL__;
    if (globalSnapshotLabel) {
        finalSnapshotOpts.save_snapshot = true;
        finalSnapshotOpts.snapshot_label = globalSnapshotLabel;
    }

    if (finalSnapshotOpts.save_snapshot) {
        payload.save_snapshot = finalSnapshotOpts.save_snapshot;
    }
    if (finalSnapshotOpts.snapshot_label) {
        payload.snapshot_label = finalSnapshotOpts.snapshot_label;
    }

    return { payload, finalSnapshotOpts };
}

// Reconcile rounding residual so that Σ weights === 100 exactly.
// The largest non-locked position absorbs the residue (in pp).
function reconcileWeightsToHundred(items: PortfolioItem[]): PortfolioItem[] {
    if (items.length === 0) return items;
    const sum = items.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);
    if (sum <= 0) return items;
    const residual = Number((100 - sum).toFixed(2));
    if (Math.abs(residual) < 0.005) return items;

    // Prefer the largest non-locked position to absorb the residue.
    let idx = -1;
    let max = -Infinity;
    items.forEach((p, i) => {
        if (p.isLocked) return;
        const w = Number(p.weight) || 0;
        if (w > max) { max = w; idx = i; }
    });
    // Fallback: largest of all (even if locked) to avoid leaving the sum off.
    if (idx === -1) {
        items.forEach((p, i) => {
            const w = Number(p.weight) || 0;
            if (w > max) { max = w; idx = i; }
        });
    }
    if (idx === -1) return items;

    const adjusted = [...items];
    const newW = Math.max(0, Number(((Number(adjusted[idx].weight) || 0) + residual).toFixed(2)));
    adjusted[idx] = { ...adjusted[idx], weight: newW };
    return adjusted;
}

function mapOptimizationResultWeights(
    portfolio: PortfolioItem[],
    weights: Record<string, number>,
    usedAssets: string[] | undefined,
    assets: Fund[],
    strict: boolean | undefined
): { optimized: PortfolioItem[], hasChanges: boolean } {
    let hasChanges = false;
    let optimized = portfolio.map(p => {
        const rawWeight = (weights[p.isin] || 0) * 100;
        const newWeight = Math.round(rawWeight * 100) / 100;
        if (Math.abs(newWeight - p.weight) > 0.5) hasChanges = true;
        return { ...p, weight: newWeight };
    });

    if (!strict) {
        optimized = optimized.filter(p => p.weight > 0.01);
        if (usedAssets) {
            const currentIsins = new Set(portfolio.map(p => p.isin));
            usedAssets.forEach(isin => {
                if (!currentIsins.has(isin) && (weights[isin] || 0) > 0.01) {
                    const known = assets.find(a => a.isin === isin) || ({ isin, name: 'Fund (Auto-Added)', std_type: 'RV' } as Fund);
                    if (known) {
                        optimized.push({ ...known as PortfolioItem, weight: Math.round((weights[isin] || 0) * 10000) / 100 });
                        hasChanges = true;
                    }
                }
            });
        }
    }
    // Reconcile rounding so the displayed Σ% is exactly 100.
    optimized = reconcileWeightsToHundred(optimized);
    return { optimized, hasChanges };
}

function getMinAssetsNeededFromResult(result: SmartPortfolioResponse, fallbackMaxWeight = 0.20): number {
    const block = (result.feasibility_precheck?.blocks || []).find((b: any) => b?.code === 'UNIVERSE_TOO_SMALL');
    const minNeeded = Number(block?.details?.min_needed);
    if (Number.isFinite(minNeeded) && minNeeded > 0) return Math.ceil(minNeeded);

    const message = String(result.message || '');
    const match = message.match(/al menos\s+(\d+)\s+fondos/i);
    if (match) return Number(match[1]);

    return Math.ceil(1 / fallbackMaxWeight);
}

function rankAutoExpandFund(fund: Fund, riskLevel: number): number {
    const perf = (fund as any).std_perf || {};
    const sharpe = Number(perf.sharpe ?? 0);
    const cagr = Number(perf.cagr3y ?? perf.return ?? perf.returns_3y ?? 0);
    const vol = Number(perf.volatility ?? 0.08);
    const type = String(fund.classification_v2?.asset_type || '').toUpperCase();
    const eqPct = getEquityExposurePct(fund);

    let score = (Number.isFinite(sharpe) ? sharpe : 0) * 100;
    score += (Number.isFinite(cagr) ? cagr : 0) * 80;

    if (riskLevel <= 3) {
        if (type === 'MONEY_MARKET' || type === 'MONETARY') score += 35;
        if (type === 'FIXED_INCOME' || type === 'RF') score += 25;
        score -= Math.max(0, vol - 0.05) * 250;
    } else if (riskLevel >= 8) {
        if (type === 'EQUITY' || type === 'RV') score += 35;
        score += eqPct;
    } else {
        if (type === 'ALLOCATION' || type === 'MIXED') score += 15;
    }

    return score;
}

function getEquityExposurePct(fund: Fund): number {
    const exposure = (fund as any).portfolio_exposure_v2 || {};
    const raw = Number(
        exposure?.economic_exposure?.equity
        ?? exposure?.asset_mix?.equity
        ?? exposure?.lookthrough?.equity
        ?? NaN
    );
    if (Number.isFinite(raw)) return raw <= 1.5 ? raw * 100 : raw;

    const type = String(fund.classification_v2?.asset_type || '').toUpperCase();
    if (type === 'EQUITY' || type === 'RV') return 100;
    return 0;
}

function selectAutoExpandCandidates(
    portfolio: PortfolioItem[],
    assets: Fund[],
    riskLevel: number,
    neededCount: number,
    recoveryCandidates?: string[],
    options: { preferEquity?: boolean; minEquityPct?: number } = {}
): Fund[] {
    const currentIsins = new Set(portfolio.map(p => p.isin));
    const preferred = new Set((recoveryCandidates || []).filter(Boolean));
    const minEquityPct = options.minEquityPct ?? 60;

    const candidates = assets.filter(a => {
        if (!a?.isin || currentIsins.has(a.isin)) return false;
        if (preferred.size > 0 && preferred.has(a.isin)) return true;
        if (options.preferEquity && getEquityExposurePct(a) < minEquityPct) return false;
        if (!isFundSuitableForProfile(a, riskLevel)) return false;
        const perf = (a as any).std_perf || {};
        return Number.isFinite(Number(perf.sharpe ?? perf.cagr3y ?? perf.return ?? perf.returns_3y));
    });

    candidates.sort((a, b) => {
        const preferredDelta = Number(preferred.has(b.isin)) - Number(preferred.has(a.isin));
        if (preferredDelta !== 0) return preferredDelta;
        return rankAutoExpandFund(b, riskLevel) - rankAutoExpandFund(a, riskLevel);
    });

    return candidates.slice(0, Math.max(0, neededCount));
}

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
    onEditPortfolio?: () => void;
}

export function usePortfolioActions({
    portfolio, setPortfolio,
    assets, riskLevel,
    numFunds,
    setProposedPortfolio,
    setTotalCapital,
    proposedPortfolio,
    vipFunds,
    totalCapital, // ADDED
    onEditPortfolio
}: UsePortfolioActionsProps) {
    const toast = useToast();
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [explainabilityData, setExplainabilityData] = useState<any>(null);

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        subtitle?: string;
        message: string;
        confirmLabel?: string;
        cancelLabel?: string;
        onConfirm: () => void;
        onCancel: () => void;
    } | null>(null);

    // ... (existing state) ...

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

    const handleUpdateWeight = useCallback((isin: string, value: string | number) => {
        // Accept both numeric and string inputs (FastNumberInput sends numbers,
        // legacy callers send strings). Clamp to [0, 100] so the table can't
        // hold negative weights or absurd values that break the invariants.
        const parsed = typeof value === 'number' ? value : parseFloat(String(value));
        const safe = Number.isFinite(parsed) ? parsed : 0;
        const newWeight = Math.min(100, Math.max(0, safe));
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
            validTypes = new Set(['RV', 'EQUITY', 'MIXED']);
        }

        // Pick best Sharpe from universe that aren't in portfolio and match risk constraints loosely
        const available = assets.filter(a => {
            if (currentIsins.has(a.isin)) return false;
            if (!a.std_perf || !a.std_perf.sharpe) return false;

            const type = a.classification_v2?.asset_type || 'Unknown';
            if (!validTypes.has(type)) return false;

            // For aggressive profiles (>=8): Only allow MIXED funds with high equity exposure
            if (p_level >= 8 && (type === 'MIXED' || type === 'ALLOCATION')) {
                const expV2 = (a as any).portfolio_exposure_v2;
                const eqRaw = Number(expV2?.economic_exposure?.equity ?? expV2?.asset_mix?.equity ?? 0);
                // Normalize: if stored as decimal (0.85), convert to pct
                const eqPct = eqRaw <= 1.5 ? eqRaw * 100 : eqRaw;
                const subtype = a.classification_v2?.asset_subtype || '';
                if (subtype !== 'AGGRESSIVE_ALLOCATION' && eqPct < 75) {
                    return false; // Exclude non-aggressive mixed from P8+
                }
            }

            // Restrict Emerging Markets for low risk profiles (<= 3)
            if (p_level <= 3) {
                if (a.classification_v2?.region_primary === "EMERGING") {
                    return false;
                }
                const region = (a.classification_v2?.region_primary || '').toLowerCase();
                const category = (a.classification_v2?.asset_subtype || '').toLowerCase();
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
            assetClass: filters.assetClass || (fund.classification_v2?.asset_type || 'EQUITY'),
            region: filters.region || (fund.classification_v2?.region_primary || 'GLOBAL'),
            maximizeRetro: filters.maximizeRetro || false,
            offset: filters.offset || 0
        };

        try {
            // findDirectAlternativesV3 uses excludeIsins as its only portfolio
            // filter, so we pass every ISIN currently in the cartera (the target
            // fund itself is also excluded internally by ISIN match).
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

    // Helper: extract currency / asset class / region from any fund-like object
    // (defensive — different sources expose them at different paths).
    const extractFundSignature = (f: any) => ({
        currency: String(
            f?.currency ||
            f?.std_extra?.currency ||
            f?.std_extra?.base_currency ||
            f?.fund_currency ||
            ''
        ).toUpperCase(),
        assetType: String(f?.classification_v2?.asset_type || '').toUpperCase(),
        region: String(f?.classification_v2?.region_primary || '').toUpperCase(),
    });

    const applySwapNow = useCallback((newFund: Fund, mode: 'weight' | 'money' = 'weight') => {
        if (!swapper.fund) return;
        const updatedPortfolio = portfolio.map(item => {
            if (item.isin === swapper.fund?.isin) {
                // Preserve user-defined flags from the slot being replaced
                // (weight, lock state). Force manualSwap=true so the optimizer
                // respects the manual selection on the next run.
                const next: any = {
                    ...newFund,
                    weight: item.weight,
                    isLocked: item.isLocked ?? false,
                    manualSwap: true,
                };
                if (mode === 'money' && totalCapital > 0) {
                    // Lock the absolute € value at swap time so that any
                    // future capital change recomputes weight to keep money
                    // constant. The recompute lives in DashboardPage's
                    // commitCapital handler.
                    next.targetEuros = totalCapital * (Number(item.weight) || 0) / 100;
                    next.keepEuros = true;
                } else {
                    // Explicit weight mode → clear any previous money lock so
                    // re-swapping a previously money-locked slot doesn't keep
                    // the stale target.
                    next.targetEuros = undefined;
                    next.keepEuros = false;
                }
                return next;
            }
            return item;
        });
        setPortfolio(updatedPortfolio);
        setSwapper(prev => ({ ...prev, isOpen: false, fund: null }));
        toast.success(
            mode === 'money'
                ? "Fondo intercambiado (manteniendo importe €)"
                : "Fondo intercambiado (manteniendo peso %)"
        );
    }, [swapper.fund, portfolio, setPortfolio, toast, totalCapital]);

    const performSwap = useCallback((newFund: Fund, mode: 'weight' | 'money' = 'weight') => {
        if (!swapper.fund) return;

        const original: any = swapper.fund;
        const orig = extractFundSignature(original);
        const next = extractFundSignature(newFund);

        // Detect structural divergences worth surfacing to the user.
        const divergences: string[] = [];
        if (orig.currency && next.currency && orig.currency !== next.currency) {
            divergences.push(`• Cambia de divisa: ${orig.currency} → ${next.currency}`);
        }
        if (orig.assetType && next.assetType && orig.assetType !== next.assetType) {
            divergences.push(`• Cambia de clase de activo: ${orig.assetType} → ${next.assetType}`);
        }
        if (orig.region && next.region && orig.region !== next.region) {
            divergences.push(`• Cambia de región: ${orig.region} → ${next.region}`);
        }

        const skipConfirm = typeof window !== 'undefined'
            && window.localStorage?.getItem('ft_skipSwapConfirm') === 'true';

        // Always ask when there are divergences (safety net). When clean and
        // user has opted out of confirmations, swap silently.
        if (divergences.length === 0 && skipConfirm) {
            applySwapNow(newFund, mode);
            return;
        }

        const weight = Number(original?.weight ?? 0);
        const moneyEur = totalCapital * (weight / 100);
        const fmtEur = (n: number) => n.toLocaleString('es-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const modeLine = mode === 'money'
            ? `Modo: mantener importe (${fmtEur(moneyEur)} €). El peso se recalculará si cambia el capital.`
            : `Modo: mantener peso (${weight.toFixed(2)} %).`;

        const lines = [
            `Vas a sustituir:`,
            `  ${original?.name || '(sin nombre)'} (${original?.isin || '—'})`,
            `por:`,
            `  ${(newFund as any)?.name || '(sin nombre)'} (${(newFund as any)?.isin || '—'})`,
            ``,
            modeLine,
        ];
        if (divergences.length > 0) {
            lines.push('', '⚠️ Atención:', ...divergences);
        }

        setConfirmDialog({
            isOpen: true,
            title: divergences.length > 0 ? 'Confirmar sustitución (con divergencias)' : 'Confirmar sustitución',
            message: lines.join('\n'),
            confirmLabel: 'Sustituir',
            cancelLabel: 'Cancelar',
            onConfirm: () => {
                setConfirmDialog(null);
                applySwapNow(newFund, mode);
            },
            onCancel: () => {
                setConfirmDialog(null);
            },
        });
    }, [swapper.fund, totalCapital, applySwapNow]);

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
                // Redistribute weights evenly. Last item absorbs the rounding
                // residue so that Σ weights === 100 exactly.
                const count = generated.length;
                const baseW = Number((100 / count).toFixed(2));
                generated = generated.map((p, i) => ({
                    ...p,
                    weight: i === count - 1
                        ? Number((100 - baseW * (count - 1)).toFixed(2))
                        : baseW,
                }));
                setPortfolio(generated);
                toast.success(`Borrador generado. Requiere Optimización.`);
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
    const lastPayloadRef = useRef<any>(null);

    const handleOptimize = async (uiViews?: Record<string, string> | any, snapshotOpts?: SnapshotOptions) => {
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
            optimizationArgsRef.current = { uiViews, snapshotOpts };
            toggleModal('optimizationStrategy', true);
            return;
        }

        await proceedWithOptimization(uiViews, null, snapshotOpts);
    };

    const handleProceedStrategy = async (
        strategy: 'add_capital' | 'redistribute' | 'proportional',
        extraCapital: number
    ) => {
        toggleModal('optimizationStrategy', false);

        // 'proportional' = simple capital increase, no optimizer call. Each
        // fund's weight stays the same so € grows proportionally. keepEuros
        // funds are recomputed in the caller (DashboardPage.commitCapital).
        // Here we don't have access to that helper, so we apply the same
        // logic inline.
        if (strategy === 'proportional') {
            if (extraCapital <= 0) {
                toast.info("Aportación 0 € — no se aplica nada.");
                return;
            }
            const newCapital = totalCapital + extraCapital;

            // Recompute keepEuros items inline (same algorithm as the
            // commitCapital path in DashboardPage).
            const keepEuros = portfolio.filter(p => (p as any).keepEuros && typeof (p as any).targetEuros === 'number' && (p as any).targetEuros > 0);
            if (keepEuros.length === 0) {
                setTotalCapital(newCapital);
                toast.success(`+${extraCapital.toLocaleString('es-ES')} € añadidos · pesos sin cambios, cada € crece proporcionalmente`);
            } else {
                const flexible = portfolio.filter(p => !p.isLocked && !((p as any).keepEuros));
                const newWeights: Record<string, number> = {};
                let used = 0;
                keepEuros.forEach(p => {
                    const t = (p as any).targetEuros as number;
                    const w = Math.max(0, (t / newCapital) * 100);
                    newWeights[p.isin] = w;
                    used += w;
                });
                portfolio.forEach(p => {
                    if (p.isLocked && !((p as any).keepEuros)) {
                        const w = Number(p.weight) || 0;
                        newWeights[p.isin] = w;
                        used += w;
                    }
                });
                if (used > 100.01) {
                    toast.error(`No se puede aplicar: bloqueados + mantener EUR suman ${used.toFixed(2)} %.`);
                    return;
                }
                if (flexible.length === 0 && Math.abs(used - 100) > 0.01) {
                    toast.error(`No se puede aplicar: no hay fondos flexibles para absorber ${Math.abs(100 - used).toFixed(2)} %.`);
                    return;
                }
                const available = Math.max(0, 100 - used);
                const flexSum = flexible.reduce((s, p) => s + (Number(p.weight) || 0), 0);
                flexible.forEach(p => {
                    const w = Number(p.weight) || 0;
                    const share = flexSum > 0 ? w / flexSum : 1 / Math.max(flexible.length, 1);
                    newWeights[p.isin] = available * share;
                });
                let adjusted = portfolio.map(p => ({
                    ...p,
                    weight: Math.round((newWeights[p.isin] ?? Number(p.weight) ?? 0) * 100) / 100,
                }));
                const sumNow = adjusted.reduce((s, p) => s + (Number(p.weight) || 0), 0);
                const residue = Number((100 - sumNow).toFixed(2));
                if (Math.abs(residue) >= 0.005 && flexible.length > 0) {
                    let idx = -1;
                    let max = -Infinity;
                    adjusted.forEach((p, i) => {
                        if (p.isLocked || (p as any).keepEuros) return;
                        const w = Number(p.weight) || 0;
                        if (w > max) { max = w; idx = i; }
                    });
                    if (idx >= 0) {
                        adjusted = [...adjusted];
                        adjusted[idx] = {
                            ...adjusted[idx],
                            weight: Math.max(0, Number(((Number(adjusted[idx].weight) || 0) + residue).toFixed(2))),
                        };
                    }
                }
                setPortfolio(adjusted);
                setTotalCapital(newCapital);
                toast.success(`+${extraCapital.toLocaleString('es-ES')} € añadidos · ${keepEuros.length} fondo(s) "mantener €" recalculado(s)`);
            }
            return;
        }

        if (strategy === 'add_capital' && extraCapital > 0) {
            setTotalCapital(totalCapital + extraCapital);
        }
        const savedArgs = optimizationArgsRef.current || {};
        await proceedWithOptimization(savedArgs.uiViews, { mode: strategy, extraCapital }, savedArgs.snapshotOpts);
    };

    const proceedWithOptimization = async (uiViews?: Record<string, string> | any, strategyPayload?: any | null, snapshotOpts?: SnapshotOptions) => {

        setIsOptimizing(true);
        try {
            const optimizeFn = httpsCallable(functions, 'optimize_portfolio_quant');
            const { payload, finalSnapshotOpts } = buildOptimizationPayload(
                portfolio, assets, vipFunds, totalCapital, riskLevel, strategyPayload, uiViews, snapshotOpts
            );
            lastPayloadRef.current = payload;

            const response = await optimizeFn(payload);
            const result = unwrapResult<SmartPortfolioResponse>(response.data);
            processOptimizationResult(result, optimizeFn, { snapshotOpts: finalSnapshotOpts });

        } catch (error: any) {
            toast.error("Error crítico al contactar el servidor: " + error.message);
        } finally {
            setIsOptimizing(false);
        }
    };



    // Helper to avoid duplication
    const processOptimizationResult = async (result: SmartPortfolioResponse, optimizeFn: any, options?: { strict?: boolean; snapshotOpts?: SnapshotOptions }) => {
        if (!isOptimizerResultApplicable(result) && (result.status === 'fallback_non_compliant' || result.usable === false || result.applicable === false)) {
            const enhancedExplainability = {
                ...(result.explainability || { primary_objective: '', solver_fallback_used: false, binding_constraints: [] }),
                status: result.status,
                fallback_reason: result.fallback_reason,
                solver_path: result.solver_path,
                constraint_violations: result.constraint_violations || result.violations || []
            };
            setExplainabilityData(enhancedExplainability);
            const reason = result.message || "La propuesta no cumple las restricciones finales y no puede aplicarse.";
            const msg = `${reason}\n\nPuedes modificar la cartera: cambiar fondos, ajustar pesos o añadir fondos compatibles con el perfil. Después vuelve a optimizar.`;

            setConfirmDialog({
                isOpen: true,
                title: "Propuesta no aplicable",
                subtitle: "Ajuste de cartera",
                message: msg,
                confirmLabel: "Modificar cartera",
                cancelLabel: "Seguir revisando",
                onConfirm: () => {
                    setConfirmDialog(null);
                    if (onEditPortfolio) {
                        onEditPortfolio();
                    } else {
                        toast.info("Modifica fondos o pesos y vuelve a optimizar.");
                    }
                },
                onCancel: () => {
                    setConfirmDialog(null);
                }
            });
            return;
        }

        if (isOptimizerResultApplicable(result)) {
            const { optimized, hasChanges } = mapOptimizationResultWeights(
                portfolio, result.weights || {}, result.used_assets, assets, options?.strict
            );

            const enhancedExplainability = {
                ...(result.explainability || { primary_objective: '', solver_fallback_used: false, binding_constraints: [] }),
                status: result.status,
                target_vol: result.metrics?.target_vol ?? result.target_vol,
                achieved_vol: result.metrics?.achieved_vol ?? result.achieved_vol,
                vol_deviation: result.metrics?.vol_deviation ?? result.vol_deviation,
                fallback_reason: result.fallback_reason,
                solver_path: result.solver_path,
                warnings: result.warnings || []
            };

            if (result.status === 'fallback_compliant') {
                toast.warning("⚠️ Propuesta alternativa generada: no se pudo alcanzar exactamente el objetivo con las restricciones actuales.", { duration: 6000 });
            } else if (!hasChanges) {
                toast.success("✅ La cartera ya está optimizada.");
            }

            setExplainabilityData(enhancedExplainability);
            setProposedPortfolio(optimized);
            toggleModal(hasChanges ? 'review' : 'tactical', true);
        } else if (result.status === 'infeasible') {
            const msg = result.message || "Faltan datos para equilibrar la cartera matemáticamente.\n\n¿Quieres que el sistema añada automáticamente fondos globales válidos para intentar cuadrar el modelo?";
            const minAssetsNeeded = getMinAssetsNeededFromResult(result);
            const fundsToAdd = Math.max(0, minAssetsNeeded - portfolio.length);

            setConfirmDialog({
                isOpen: true,
                title: "Universo insuficiente para optimizar",
                message: msg,
                confirmLabel: "Añadir fondos y reintentar",
                cancelLabel: "Cancelar",
                onConfirm: async () => {
                    setConfirmDialog(null);
                    toast.info("Añadiendo fondos compatibles y reintentando...");

                    const expandedAssets = [...portfolio.map(p => p.isin)];
                    const autoCandidates = selectAutoExpandCandidates(
                        portfolio,
                        assets,
                        riskLevel,
                        fundsToAdd || 2,
                        result.recovery_candidates
                    );

                    autoCandidates.forEach((candidate) => {
                        if (!expandedAssets.includes(candidate.isin)) expandedAssets.push(candidate.isin);
                    });
                    const newPortfolio = [
                        ...portfolio,
                        ...autoCandidates.map((candidate) => ({ ...candidate, weight: 0 }))
                    ];

                    if (expandedAssets.length <= portfolio.length) {
                        setConfirmDialog({
                            isOpen: true,
                            title: "Hay que modificar la cartera",
                            subtitle: "Acción necesaria",
                            message: `${result.message || 'Con los fondos actuales no se puede optimizar.'}\n\nNo he encontrado fondos compatibles suficientes para añadir automáticamente. Cambia algún fondo, añade fondos desde el buscador o aumenta el número de fondos, y vuelve a optimizar.`,
                            confirmLabel: "Modificar cartera",
                            cancelLabel: "Cerrar",
                            onConfirm: () => {
                                setConfirmDialog(null);
                                onEditPortfolio?.();
                            },
                            onCancel: () => setConfirmDialog(null)
                        });
                        return;
                    }

                    setPortfolio(newPortfolio);
                    onEditPortfolio?.();
                    toast.success(`He añadido ${autoCandidates.length} fondo(s) compatible(s) a la cartera.`);

                    // Contractual retry payload: preserve all contract fields from the
                    // primary optimization path, override only assets (expanded).
                    // Resolves known_contract_gap from BDB-OPT-PAYLOAD-CONTRACT-TESTS-0.
                    const retryPayload: any = {
                        ...(lastPayloadRef.current || {}),
                        assets: expandedAssets,
                        locked_assets: lastPayloadRef.current?.locked_assets || portfolio.filter(p => p.isLocked).map(p => p.isin),
                        auto_expand_universe: true
                    };
                    if (options?.snapshotOpts?.save_snapshot) retryPayload.save_snapshot = options.snapshotOpts.save_snapshot;
                    if (options?.snapshotOpts?.snapshot_label) retryPayload.snapshot_label = options.snapshotOpts.snapshot_label;

                    const response2 = await optimizeFn(retryPayload);
                    const result2 = unwrapResult<SmartPortfolioResponse>(response2.data);
                    if (result2.status === 'infeasible' && result2.message === result.message) {
                        setConfirmDialog({
                            isOpen: true,
                            title: "Hay que modificar la cartera",
                            subtitle: "Acción necesaria",
                            message: `${result2.message || result.message}\n\nHe añadido ${autoCandidates.length} fondo(s) a la cartera, pero el optimizador sigue sin encontrar una propuesta válida. Revisa los fondos/pesos añadidos o sustituye alguno, y vuelve a optimizar.`,
                            confirmLabel: "Modificar cartera",
                            cancelLabel: "Cerrar",
                            onConfirm: () => {
                                setConfirmDialog(null);
                                onEditPortfolio?.();
                            },
                            onCancel: () => setConfirmDialog(null)
                        });
                        return;
                    }
                    processOptimizationResult(result2, optimizeFn, options);
                },
                onCancel: () => {
                    setConfirmDialog(null);
                    toast.info("Optimización cancelada.");
                }
            });

        } else if (result.status === 'infeasible_equity_floor') {
            const feasible = result.feasibility?.achievable || 0;
            const requested = result.feasibility?.requested || 0;
            const msg = `⚠️ La cartera seleccionada no puede alcanzar el ${Math.round(requested * 100)}% de RV requerido (Máx posible: ${Math.round(feasible * 100)}%).\n\n¿Quieres que el sistema añada automáticamente fondos de Renta Variable para cumplir el objetivo?`;

            setConfirmDialog({
                isOpen: true,
                title: "Universo insuficiente para optimizar",
                message: msg,
                confirmLabel: "Auto-completar RV y reintentar",
                cancelLabel: "Cancelar",
                onConfirm: async () => {
                    setConfirmDialog(null);
                    toast.info("Auto-completando cartera con fondos de RV...");

                    const rvGap = Math.max(0, requested - feasible);
                    const fundsNeededForRv = Math.max(2, Math.ceil(rvGap / 0.20), numFunds - portfolio.length);
                    const rvCandidates = selectAutoExpandCandidates(
                        portfolio,
                        assets,
                        riskLevel,
                        fundsNeededForRv,
                        result.recovery_candidates,
                        { preferEquity: true, minEquityPct: 70 }
                    );

                    if (rvCandidates.length === 0) {
                        setConfirmDialog({
                            isOpen: true,
                            title: "Hay que modificar la cartera",
                            subtitle: "Acción necesaria",
                            message: `${msg}\n\nNo he encontrado fondos de Renta Variable compatibles suficientes para añadir automáticamente. Cambia algún fondo o añade fondos de RV desde el buscador, y vuelve a optimizar.`,
                            confirmLabel: "Modificar cartera",
                            cancelLabel: "Cerrar",
                            onConfirm: () => {
                                setConfirmDialog(null);
                                onEditPortfolio?.();
                            },
                            onCancel: () => setConfirmDialog(null)
                        });
                        return;
                    }

                    const expandedAssets = [
                        ...portfolio.map(p => p.isin),
                        ...rvCandidates.map(candidate => candidate.isin)
                    ];
                    const newPortfolio = [
                        ...portfolio,
                        ...rvCandidates.map((candidate) => ({ ...candidate, weight: 0 }))
                    ];

                    setPortfolio(newPortfolio);
                    onEditPortfolio?.();
                    toast.success(`He añadido ${rvCandidates.length} fondo(s) de RV a la cartera.`);

                    // Contractual retry payload: preserve contract fields, add auto_expand.
                    const retryPayload: any = {
                        ...(lastPayloadRef.current || {}),
                        assets: expandedAssets,
                        locked_assets: lastPayloadRef.current?.locked_assets || portfolio.filter(p => p.isLocked).map(p => p.isin),
                        auto_expand_universe: true
                    };
                    if (options?.snapshotOpts?.save_snapshot) retryPayload.save_snapshot = options.snapshotOpts.save_snapshot;
                    if (options?.snapshotOpts?.snapshot_label) retryPayload.snapshot_label = options.snapshotOpts.snapshot_label;

                    const response2 = await optimizeFn(retryPayload);
                    const result2 = unwrapResult<SmartPortfolioResponse>(response2.data);
                    if (result2.status === 'infeasible_constraints' || result2.status === 'auto_expand_failed' || result2.status === 'infeasible_equity_floor') {
                        setConfirmDialog({
                            isOpen: true,
                            title: "Hay que modificar la cartera",
                            subtitle: "Acción necesaria",
                            message: `${result2.message || 'No se ha podido encontrar una cartera óptima con las restricciones actuales.'}\n\nHe añadido ${rvCandidates.length} fondo(s) de RV a la cartera, pero el optimizador sigue sin encontrar una propuesta válida. Revisa los fondos/pesos añadidos o sustituye alguno, y vuelve a optimizar.`,
                            confirmLabel: "Modificar cartera",
                            cancelLabel: "Cerrar",
                            onConfirm: () => {
                                setConfirmDialog(null);
                                onEditPortfolio?.();
                            },
                            onCancel: () => setConfirmDialog(null)
                        });
                        return;
                    }
                    processOptimizationResult(result2, optimizeFn, options);
                },
                onCancel: () => {
                    setConfirmDialog(null);
                    toast.info("Optimización cancelada por falta de RV.");
                }
            });

        } else if (result.status === 'fallback_no_history') {
            const suggestion = result.suggestion || "Prueba a cambiar los fondos.";
            const warnings = result.warnings?.join('\n') || "Insuficientes datos.";

            const msg = `❌ Error de Datos Históricos\n\n${warnings}\n\nSugerencia: ${suggestion}\n\n¿Quieres intentar completar la cartera con fondos seguros?`;

            setConfirmDialog({
                isOpen: true,
                title: "Histórico insuficiente",
                message: msg,
                confirmLabel: "Reintentar con fondos base",
                cancelLabel: "Cancelar",
                onConfirm: async () => {
                    setConfirmDialog(null);
                    toast.info("🔄 Reintentando con fondos base...");
                    // Contractual retry payload: preserve contract fields, add auto_expand.
                    const retryPayload: any = {
                        ...(lastPayloadRef.current || {}),
                        assets: portfolio.map(p => p.isin),
                        locked_assets: lastPayloadRef.current?.locked_assets || portfolio.filter(p => p.isLocked).map(p => p.isin),
                        auto_expand_universe: true
                    };
                    if (options?.snapshotOpts?.save_snapshot) retryPayload.save_snapshot = options.snapshotOpts.save_snapshot;
                    if (options?.snapshotOpts?.snapshot_label) retryPayload.snapshot_label = options.snapshotOpts.snapshot_label;

                    const response3 = await optimizeFn(retryPayload);
                    const result3 = unwrapResult<SmartPortfolioResponse>(response3.data);
                    processOptimizationResult(result3, optimizeFn, options);
                },
                onCancel: () => {
                    setConfirmDialog(null);
                }
            });
        } else if (result.status === 'infeasible_constraints' || result.status === 'auto_expand_failed') {
            toast.error("No se ha podido encontrar una cartera óptima con las restricciones actuales. Pruebe a reducir el nivel de riesgo, aumentar el número de fondos o ampliar el universo disponible.");
        } else {
            const rawMsg = result.message || result.error || "Desconocido";
            const isSolverInfeasible = typeof rawMsg === 'string' && (
                rawMsg.includes('Solver status: infeasible')
                || rawMsg.includes('Please check your objectives/constraints')
            );
            const msg = isSolverInfeasible
                ? "No se ha podido encontrar una cartera óptima con las restricciones actuales. Pruebe a reducir el nivel de riesgo, aumentar el número de fondos o ampliar el universo disponible."
                : rawMsg;
            const obsStr = result.observations ? ` (${result.observations} días comunes)` : '';
            toast.error(`Error en la optimización: ${msg}${obsStr}`);
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
            if (result.error || result.status === 'error') {
                const msg = result.message || result.error || "Error desconocido";
                const obsStr = result.observations ? ` (${result.observations} días comunes)` : '';
                toast.error(`Error en análisis: ${msg}${obsStr}`);
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
            if (result.error || result.status === 'error') {
                const msg = result.message || result.error || "Error desconocido";
                const obsStr = result.observations ? ` (${result.observations} días comunes)` : '';
                toast.error(`Error al sincronizar datos matemáticos: ${msg}${obsStr}`);
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

    const handleImportCSV = async (text: string) => {
        const result = parsePortfolioCSV(text);
        if (result.error) { toast.error(result.error); return; }
        setConfirmDialog({
            isOpen: true,
            title: "Importar Cartera",
            message: `Se han detectado ${result.portfolio?.length || 0} fondos. ¿Reemplazar cartera actual?`,
            confirmLabel: "Reemplazar",
            cancelLabel: "Cancelar",
            onConfirm: () => {
                setConfirmDialog(null);
                const enriched: PortfolioItem[] = (result.portfolio || []).map(p => {
                    const known = assets.find(a => a.isin === p.isin);
                    if (known) {
                        return { ...p, ...known, value: p.value, weight: p.weight };
                    } else {
                        return { ...p, std_type: (p as any).std_type || 'Unknown' } as PortfolioItem;
                    }
                });
                setPortfolio(enriched);
                setTotalCapital(result.totalValue || 0);
                toast.success("Cartera importada correctamente");
            },
            onCancel: () => { setConfirmDialog(null); }
        });
    };

    return {
        isOptimizing, modals, toggleModal,
        selectedFund, setSelectedFund,
        swapper, setSwapper,
        handleAddAsset, handleRemoveAsset, handleUpdateWeight,
        handleOpenSwap, performSwap,
        handleManualGenerate, handleOptimize,
        handleApplyDirectly, handleReviewAccept, handleAcceptPortfolio,
        handleMacroApply, handleImportCSV,
        handleAnalyzePortfolio, handleFetchInteractiveFrontier,
        handleToggleLock, handleAutoCompletePortfolio, handleProceedStrategy,
        analysisResult, explainabilityData,
        interactiveMathData, interactivePoint,
        confirmDialog, setConfirmDialog
    };
}

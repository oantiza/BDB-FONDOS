import React, { useState, useRef, lazy, Suspense, useMemo } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db, functions } from '../firebase'
import { Download, Upload, Trash2, Lock, Unlock, AlertCircle, AlertTriangle, RefreshCw, Sparkles } from 'lucide-react'

// Components
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Controls from '../components/Controls'
import EfficientFrontierChart from '../components/charts/EfficientFrontierChart'
import PortfolioTable from '../components/PortfolioTable'
import { PortfolioMetricsCards } from '../components/PortfolioMetricsCards'
import ComparativeFundHistoryChart from '../components/charts/ComparativeFundHistoryChart'
import { DataQualityBadge, gradePortfolioQuality } from '../components/dashboard/DataQualityBadge'
import AssetDistributionWidget from '../components/dashboard/AssetDistributionWidget'

// Utilities & Services

import { exportToCSV } from '../utils/exportList'

// Hooks & Types
import { useDashboardData } from '../hooks/useDashboardData'
import { usePortfolioActions } from '../hooks/usePortfolioActions'
import { useToast } from '../context/ToastContext'
import { Fund, PortfolioItem, SmartPortfolioResponse, AllocationItem } from '../types'
import { MacroReport } from '../types/MacroReport'

import { lazyWithRetry } from '../utils/lazyWithRetry'

const CostsModal = lazyWithRetry(() => import('../components/modals/CostsModal'))
const TacticalModal = lazyWithRetry(() => import('../components/modals/TacticalModal'))
const MacroTacticalModal = lazyWithRetry(() => import('../components/modals/MacroTacticalModal'))
const OptimizationReviewModal = lazyWithRetry(() => import('../components/modals/OptimizationReviewModal'))
const VipFundsModal = lazyWithRetry(() => import('../components/VipFundsModal'))
const SharpeMaximizerModal = lazyWithRetry(() => import('../components/modals/SharpeMaximizerModal'))
const SavedPortfoliosModal = lazyWithRetry(() => import('../components/SavedPortfoliosModal'))
const FundDetailModal = lazyWithRetry(() => import('../components/FundDetailModal'))
const FundSwapModal = lazyWithRetry(() => import('../components/FundSwapModal').then(m => ({ default: m.FundSwapModal })))
const PortfolioAnalysisModal = lazyWithRetry(() => import('../components/modals/PortfolioAnalysisModal'))
const OptimizationStrategyModal = lazyWithRetry(() => import('../components/modals/OptimizationStrategyModal'))
const ConfirmModal = lazyWithRetry(() => import('../components/modals/ConfirmModal'))
interface DashboardPageProps {
    onLogout: () => void;
    onOpenMiBoutique: () => void;
    onOpenXRay: () => void;
    onOpenPositions: () => void;
    onOpenRetirement: () => void;
    onOpenComparator: () => void;
    onOpenAdmin?: () => void;

    // Portfolio State Props
    isAuthenticated: boolean;
    assets: Fund[];
    portfolio: PortfolioItem[];
    setPortfolio: (p: PortfolioItem[]) => void;
    proposedPortfolio: PortfolioItem[];
    setProposedPortfolio: (p: PortfolioItem[]) => void;
    riskLevel: number;
    setRiskLevel: (n: number) => void;
    numFunds: number;
    setNumFunds: (n: number) => void;
    totalCapital: number;
    setTotalCapital: (n: number) => void;
    vipFunds: string;
    setVipFunds: (s: string) => void;
    allocData: AllocationItem[];
    geoData: AllocationItem[];
}

export default function DashboardPage({
    onLogout,
    onOpenMiBoutique,
    onOpenXRay,
    onOpenPositions,
    onOpenRetirement,
    onOpenComparator,
    onOpenAdmin,

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
}: DashboardPageProps) {

    // 1. BUSINESS LOGIC HOOKS
    const toast = useToast();
    const [isEditingCapital, setIsEditingCapital] = useState(false);
    const [capitalInputValue, setCapitalInputValue] = useState(totalCapital.toString());
    const portfolioTableRef = useRef<HTMLDivElement>(null);
    const [portfolioEditFocus, setPortfolioEditFocus] = useState(false);

    const handleEditCurrentPortfolio = React.useCallback(() => {
        setPortfolioEditFocus(true);
        window.setTimeout(() => setPortfolioEditFocus(false), 2800);
        window.requestAnimationFrame(() => {
            portfolioTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            portfolioTableRef.current?.focus({ preventScroll: true });
        });
    }, []);
    // Edit mode for weight inputs. 'free' = current behaviour (others untouched).
    // 'proportional' = changing A by Δ shrinks/grows other unlocked positions
    // pro-rata so Σ pesos stays at 100.
    const [editMode, setEditMode] = useState<'free' | 'proportional'>(() => {
        if (typeof window === 'undefined') return 'free';
        return (window.localStorage.getItem('ft_editMode') as 'free' | 'proportional') || 'free';
    });
    const persistEditMode = (m: 'free' | 'proportional') => {
        setEditMode(m);
        try { window.localStorage.setItem('ft_editMode', m); } catch { /* ignore */ }
    };

    // Parse a number string that may use Spanish (1.234,56) or English (1,234.56)
    // grouping conventions. Returns NaN if it cannot be parsed.
    const parseLocaleNumber = (raw: string): number => {
        if (!raw) return NaN;
        const clean = raw.trim().replace(/\s|€|EUR/gi, '');
        if (!clean) return NaN;
        const lastDot = clean.lastIndexOf('.');
        const lastComma = clean.lastIndexOf(',');
        const lastSep = Math.max(lastDot, lastComma);
        if (lastSep === -1) return parseFloat(clean);
        const intPart = clean.slice(0, lastSep).replace(/[.,]/g, '');
        const decPart = clean.slice(lastSep + 1).replace(/[.,]/g, '');
        return parseFloat(intPart + '.' + decPart);
    };

    const getCapitalRebalanceBlockReason = (items: PortfolioItem[], newCapital: number): string | null => {
        if (items.length === 0 || newCapital <= 0) return null;
        const keepEuros = items.filter(p => (p as any).keepEuros && typeof (p as any).targetEuros === 'number' && (p as any).targetEuros > 0);
        if (keepEuros.length === 0) return null;

        const flexible = items.filter(p => !p.isLocked && !((p as any).keepEuros));
        let fixedWeight = 0;
        keepEuros.forEach(p => {
            fixedWeight += Math.max(0, (((p as any).targetEuros as number) / newCapital) * 100);
        });
        items.forEach(p => {
            if (p.isLocked && !((p as any).keepEuros)) {
                fixedWeight += Number(p.weight) || 0;
            }
        });

        if (fixedWeight > 100.01) {
            return `No se puede aplicar: bloqueados + mantener EUR suman ${fixedWeight.toFixed(2)} %.`;
        }
        if (flexible.length === 0 && Math.abs(fixedWeight - 100) > 0.01) {
            return `No se puede aplicar: no hay fondos flexibles para absorber ${Math.abs(100 - fixedWeight).toFixed(2)} %.`;
        }
        return null;
    };

    // When totalCapital changes and there are funds marked keepEuros, those
    // funds need their weight recomputed (so their € stays fixed) AND the rest
    // of the cartera must absorb the residue so Σpesos = 100 again.
    //
    // Categories:
    //  - keepEuros funds → weight = targetEuros / newCapital * 100
    //  - locked non-keepEuros → weight unchanged (their € grows/shrinks with capital)
    //  - unlocked non-keepEuros → absorb the residue proportionally to their old weights
    const recomputeWeightsForCapitalChange = (items: PortfolioItem[], newCapital: number): PortfolioItem[] => {
        if (items.length === 0 || newCapital <= 0) return items;
        const keepEuros = items.filter(p => (p as any).keepEuros && typeof (p as any).targetEuros === 'number' && (p as any).targetEuros > 0);
        if (keepEuros.length === 0) return items;

        const flexible = items.filter(p => !p.isLocked && !((p as any).keepEuros));
        const newWeights: Record<string, number> = {};
        let used = 0;
        keepEuros.forEach(p => {
            const t = (p as any).targetEuros as number;
            const w = Math.max(0, (t / newCapital) * 100);
            newWeights[p.isin] = w;
            used += w;
        });
        items.forEach(p => {
            if (p.isLocked && !((p as any).keepEuros)) {
                const w = Number(p.weight) || 0;
                newWeights[p.isin] = w;
                used += w;
            }
        });
        const available = Math.max(0, 100 - used);
        const flexSum = flexible.reduce((s, p) => s + (Number(p.weight) || 0), 0);
        flexible.forEach(p => {
            const w = Number(p.weight) || 0;
            const share = flexSum > 0 ? w / flexSum : 1 / Math.max(flexible.length, 1);
            newWeights[p.isin] = available * share;
        });

        let adjusted = items.map(p => ({
            ...p,
            weight: Math.round((newWeights[p.isin] ?? Number(p.weight) ?? 0) * 100) / 100,
        }));
        // Reconcile residue on the largest flexible position
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
        return adjusted;
    };

    const commitCapital = () => {
        const val = parseLocaleNumber(capitalInputValue);
        if (!isNaN(val) && val > 0 && val !== totalCapital) {
            const itemsKeepingEuros = portfolio.filter(p => (p as any).keepEuros && (p as any).targetEuros > 0);
            if (itemsKeepingEuros.length > 0) {
                const blockReason = getCapitalRebalanceBlockReason(portfolio, val);
                if (blockReason) {
                    toast.error(blockReason);
                    return;
                }
                const adjusted = recomputeWeightsForCapitalChange(portfolio, val);
                setPortfolio(adjusted);
                setTotalCapital(val);
                toast.info(`Capital actualizado — ${itemsKeepingEuros.length} fondo(s) con "mantener €" recalculado(s); el resto absorbe la diferencia.`);
            } else {
                setTotalCapital(val);
                toast.info("Importes actualizados — los pesos se mantienen");
            }
        }
        setIsEditingCapital(false);
    };
    const {
        isOptimizing,
        modals, toggleModal,
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
        handleApplyDirectly,
        handleReviewAccept,
        handleAcceptPortfolio,
        handleMacroApply,
        handleImportCSV,
        handleAnalyzePortfolio, // NEW
        handleFetchInteractiveFrontier, // NEW
        handleToggleLock,
        handleAutoCompletePortfolio,
        handleProceedStrategy,
        analysisResult, // NEW
        interactivePoint, // NEW
        explainabilityData,
        confirmDialog
    } = usePortfolioActions({
        portfolio, setPortfolio,
        assets, riskLevel,
        numFunds,
        setProposedPortfolio,
        setTotalCapital,
        proposedPortfolio,
        vipFunds,
        totalCapital, // NEW
        onEditPortfolio: handleEditCurrentPortfolio
    });

    // Removed global exposure hack

    const {
        historyData, frontierData, assetPoints, portfolioPoint,
        metrics1y, xrayMetrics, metrics5y, // New unified metrics
        regionAllocation, warnings, // [NEW] Backend Data
        isLoading, dashboardError
    } = useDashboardData(isAuthenticated, portfolio)

    // 2. UI STATE (View-specific)
    const [strategyReport, setStrategyReport] = useState<MacroReport | null>(null)

    const [riskFreeRate, setRiskFreeRate] = useState(0.0) // State for dynamic Rf

    // Fetch Risk Free Rate on mount
    React.useEffect(() => {
        const fetchRf = async () => {
            try {
                const fn = httpsCallable(functions, 'getRiskRate');
                const res = await fn() as any;
                if (res.data?.rate) setRiskFreeRate(res.data.rate);
            } catch (e) {
                console.warn("Failed to fetch RF rate:", e);
                setRiskFreeRate(0.0); // Fallback
            }
        }
        fetchRf();
    }, []);

    // Fetch Strategy Report
    React.useEffect(() => {
        const fetchStrategy = async () => {
            try {
                const q = query(
                    collection(db, 'reports'),
                    where('type', '==', 'STRATEGY')
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    // Cast to MacroReport and find the latest
                    const docs = snapshot.docs.map(d => d.data() as MacroReport);

                    // Helper for date sorting
                    const getMillis = (d: any) => {
                        if (!d) return 0;
                        if (d.seconds) return d.seconds * 1000;
                        if (d instanceof Date) return d.getTime();
                        return new Date(d).getTime();
                    };

                    docs.sort((a, b) => {
                        const tA = getMillis(a.createdAt || a.date);
                        const tB = getMillis(b.createdAt || b.date);
                        return tB - tA;
                    });

                    setStrategyReport(docs[0]);
                }
            } catch (e) {
                console.error("Failed to fetch strategy report:", e);
            }
        };
        fetchStrategy();
    }, []);

    // Wrapper for the weight input that honors the current editMode.
    // 'free' delegates to the original handler (others untouched).
    // 'proportional' redistributes Δ pro-rata across the other non-locked
    // positions so Σ pesos stays ≈ 100.
    const handleUpdateWeightSmart = (isin: string, val: string | number) => {
        if (editMode === 'free') {
            handleUpdateWeight(isin, val);
            return;
        }
        const parsed = typeof val === 'number' ? val : parseFloat(String(val));
        const safe = Number.isFinite(parsed) ? parsed : 0;
        let newWeight = Math.min(100, Math.max(0, safe));
        const target = portfolio.find(p => p.isin === isin);
        if (!target) return;
        const fixedOthersSum = portfolio
            .filter(p => p.isin !== isin && (p.isLocked || (p as any).keepEuros))
            .reduce((s, p) => s + (Number(p.weight) || 0), 0);
        const maxTargetWeight = Math.max(0, 100 - fixedOthersSum);
        if (newWeight > maxTargetWeight) {
            newWeight = Math.round(maxTargetWeight * 100) / 100;
            toast.info(`Peso limitado a ${newWeight.toFixed(2)} %: no hay suficiente tramo flexible.`);
        }
        const oldWeight = Number(target.weight) || 0;
        const delta = newWeight - oldWeight;
        if (Math.abs(delta) < 0.001) {
            handleUpdateWeight(isin, newWeight);
            return;
        }
        const others = portfolio.filter(p => p.isin !== isin && !p.isLocked && !((p as any).keepEuros));
        if (others.length === 0) {
            toast.info("No hay otros fondos no bloqueados para redistribuir; aplicando en modo libre.");
            handleUpdateWeight(isin, newWeight);
            return;
        }
        const othersSum = others.reduce((s, p) => s + (Number(p.weight) || 0), 0);
        const adjusted = portfolio.map(p => {
            if (p.isin === isin) return { ...p, weight: Math.round(newWeight * 100) / 100 };
            if (p.isLocked || (p as any).keepEuros) return p;
            const w = Number(p.weight) || 0;
            const share = othersSum > 0 ? w / othersSum : 1 / others.length;
            const candidate = w - delta * share;
            const clamped = Math.max(0, Math.min(100, candidate));
            return { ...p, weight: Math.round(clamped * 100) / 100 };
        });
        // Reconcile any rounding residual onto the largest non-locked / non-edited slot.
        const totalNow = adjusted.reduce((s, p) => s + (Number(p.weight) || 0), 0);
        const residue = Number((100 - totalNow).toFixed(2));
        if (Math.abs(residue) >= 0.005) {
            let idx = -1;
            let max = -Infinity;
            adjusted.forEach((p, i) => {
                if (p.isLocked || (p as any).keepEuros || p.isin === isin) return;
                const w = Number(p.weight) || 0;
                if (w > max) { max = w; idx = i; }
            });
            if (idx >= 0) {
                adjusted[idx] = {
                    ...adjusted[idx],
                    weight: Math.max(0, Number(((Number(adjusted[idx].weight) || 0) + residue).toFixed(2))),
                };
            }
        }
        setPortfolio(adjusted);
    };

    const validateOptimizationStrategy = (strategy: 'add_capital' | 'redistribute' | 'proportional', extraCapital: number): string | null => {
        if (strategy !== 'proportional') return null;
        return getCapitalRebalanceBlockReason(portfolio, totalCapital + extraCapital);
    };

    // --- Performance Optimizations (C) ---
    // Memoize Portfolio Quality Grade
    const portfolioGrade = useMemo(() => {
        return gradePortfolioQuality(portfolio);
    }, [portfolio]);

    // Memoize expensive sorting/filtering for sidebar if assets list is huge (optional but good practice)
    // The Sidebar component likely does some filtering, but passing a stable reference can help if Sidebar is memoized.
    // Here we'll just keep the structure simple as requested (light optimization).

    const fileInputRef = useRef<HTMLInputElement>(null)
    const handleImportClick = () => { fileInputRef.current?.click() }
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (evt) => {
            const text = evt.target?.result as string
            handleImportCSV(text);
        };
        reader.readAsText(file)
        e.target.value = ''
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-slate-100 font-sans text-slate-700">
            <Header
                onLogout={onLogout}
                onOpenMiBoutique={onOpenMiBoutique}
                onOpenXRay={onOpenXRay}
                onOpenPositions={onOpenPositions}
                onOpenRetirement={onOpenRetirement}
                onOpenComparator={onOpenComparator}
                onOpenAdmin={onOpenAdmin}
                isOptimizing={isOptimizing}
            />

            <div className="flex flex-1 overflow-hidden p-5 gap-5">
                <div className="w-[15%] h-full flex flex-col bg-white">
                    <div className="flex-1 overflow-hidden relative rounded-xl border border-slate-100 shadow-sm">
                        <Sidebar assets={assets} onAddAsset={handleAddAsset} onViewDetail={setSelectedFund} />
                    </div>
                </div>

                <div className="w-[58%] h-full flex flex-col gap-5">
                    <div className="h-1/3 grid grid-cols-2 gap-5 shrink-0">
                        {/* Efficient Frontier Chart */}
                        <div className="bg-white rounded-xl flex flex-col border border-slate-100 shadow-sm relative overflow-hidden group hover:border-slate-200 transition-colors">
                            <div className="h-[45px] px-4 bg-[#F8FAFC] border-b border-slate-200/60 flex justify-between items-center z-10">
                                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                                    Frontera Eficiente
                                </h3>
                            </div>
                            <div className="flex-1 w-full min-h-0 relative">
                                <span className="absolute top-2 left-0 right-0 text-center text-slate-500 font-bold text-[9px] uppercase tracking-widest z-10 pointer-events-none">
                                    Riesgo vs Retorno (3Y)
                                </span>
                                <div className="absolute inset-0 pt-6 pb-2 px-2">
                                    <EfficientFrontierChart
                                        frontierPoints={frontierData}
                                        assetPoints={assetPoints}
                                        portfolioPoint={interactivePoint || portfolioPoint}
                                        isLoading={isLoading}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="bg-white rounded-xl flex flex-col border border-slate-100 shadow-sm relative overflow-hidden group hover:border-slate-200 transition-colors">
                            <div className="h-[45px] px-4 bg-[#F8FAFC] border-b border-slate-200/60 flex justify-between items-center z-10">
                                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                                    Métricas Clave
                                </h3>
                            </div>
                            <div className="flex-1 min-h-0 relative">
                                <PortfolioMetricsCards
                                    metrics1y={metrics1y}
                                    metrics3y={xrayMetrics}
                                    metrics5y={metrics5y}
                                    rfLabel={`RF ${(riskFreeRate * 100).toFixed(2)}%`}
                                />
                            </div>
                        </div>
                    </div>

                    {dashboardError && (
                        <div className="bg-rose-50/50 border border-rose-100 px-4 py-3 mx-2 mb-2 rounded-xl flex justify-between items-center shadow-sm shrink-0 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-rose-100/50 flex items-center justify-center shrink-0 border border-rose-100">
                                    <AlertCircle className="w-4 h-4 text-rose-600" strokeWidth={2} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">Error en el análisis</span>
                                    <span className="text-xs text-rose-700/90 mt-0.5">{dashboardError.replace(/^⚠️\s*/, '')}</span>
                                </div>
                            </div>
                            <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 rounded-lg text-rose-600 font-bold uppercase tracking-wider text-[10px] transition-all shadow-sm shrink-0 ml-4 group">
                                <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" strokeWidth={2} />
                                Reintentar
                            </button>
                        </div>
                    )}

                    {false && warnings && warnings.length > 0 && (
                        <div className="bg-amber-50/50 border border-amber-100 px-4 py-3 mx-2 mb-2 rounded-xl flex flex-col gap-2 shadow-sm shrink-0 transition-all">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-8 h-8 rounded-full bg-amber-100/50 flex items-center justify-center shrink-0 border border-amber-100">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={2} />
                                </div>
                                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Avisos del análisis</span>
                            </div>
                            <div className="flex flex-col gap-1.5 pl-11">
                                {warnings.map((w, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-xs text-amber-800/80 leading-relaxed">
                                        <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                        <span>{w.replace(/^⚠️\s*/, '')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bottom Row: Portfolio Table */}
                    <div
                        ref={portfolioTableRef}
                        tabIndex={-1}
                        aria-label="Editor de cartera actual"
                        className={`flex-1 overflow-hidden flex flex-col relative rounded-xl border shadow-sm transition-all duration-300 bg-white outline-none ${portfolioEditFocus ? 'border-blue-300 ring-4 ring-blue-100' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                        <div className="py-3.5 px-4 bg-[#F8FAFC] border-b border-slate-200/60 flex justify-between items-center z-10">
                            <div className="flex items-center gap-3">
                                <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                                    Cartera de Fondos <span className="text-slate-400 font-medium">({portfolio.length})</span>
                                </h3>

                                {portfolio.length > 0 && (
                                    <button
                                        onClick={() => {
                                            const allLocked = portfolio.every(p => p.isLocked);
                                            setPortfolio(portfolio.map(p => ({ ...p, isLocked: !allLocked })));
                                        }}
                                        className={`ml-2 text-[10px] font-semibold px-2.5 py-1.5 rounded-md border uppercase tracking-wider flex items-center gap-1.5 transition-colors ${portfolio.every(p => p.isLocked)
                                                ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            }`}
                                    >
                                        {portfolio.every(p => p.isLocked) ? <Unlock className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
                                        {portfolio.every(p => p.isLocked) ? 'Desbloquear Todos' : 'Bloquear Todos'}
                                    </button>
                                )}

                                {portfolio.length > 0 && (
                                    <div
                                        className="ml-2 flex items-center gap-0.5 bg-slate-100 rounded-md p-0.5 border border-slate-200"
                                        title="Modo de edición: 'Libre' deja los demás pesos como están; 'Proporcional' redistribuye automáticamente entre los no bloqueados para mantener Σ = 100 %."
                                    >
                                        <button
                                            type="button"
                                            onClick={() => persistEditMode('free')}
                                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${editMode === 'free' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Libre
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => persistEditMode('proportional')}
                                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors ${editMode === 'proportional' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Proporcional
                                        </button>
                                    </div>
                                )}

                                {portfolio.length > 0 && portfolio.length < numFunds && (
                                    <button
                                        onClick={handleAutoCompletePortfolio}
                                        className="ml-2 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1.5 rounded-md border border-blue-100 hover:border-blue-200 focus:outline-none uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-blue-500" strokeWidth={2} /> Auto-completar (+{numFunds - portfolio.length})
                                    </button>
                                )}

                                {/* Normalizar a 100%: solo visible cuando hay desbalance. */}
                                {(() => {
                                    if (portfolio.length === 0) return null;
                                    const sumW = portfolio.reduce((s, p) => s + (Number(p.weight) || 0), 0);
                                    if (Math.abs(sumW - 100) <= 0.01) return null;
                                    return (
                                        <button
                                            onClick={() => {
                                                const lockedSum = portfolio
                                                    .filter(p => p.isLocked || (p as any).keepEuros)
                                                    .reduce((s, p) => s + (Number(p.weight) || 0), 0);
                                                const unlocked = portfolio.filter(p => !p.isLocked && !((p as any).keepEuros));
                                                const unlockedSum = unlocked.reduce((s, p) => s + (Number(p.weight) || 0), 0);
                                                const target = 100 - lockedSum;
                                                if (target < 0) {
                                                    toast.error("Bloqueados + mantener EUR ya superan el 100 %. Desbloquea o reduce alguno.");
                                                    return;
                                                }
                                                if (unlocked.length === 0) {
                                                    toast.error("No hay fondos flexibles para normalizar.");
                                                    return;
                                                }
                                                let scaled = portfolio.map(p => {
                                                    if (p.isLocked || (p as any).keepEuros) return p;
                                                    const w = Number(p.weight) || 0;
                                                    const newW = unlockedSum > 0
                                                        ? Math.max(0, (w / unlockedSum) * target)
                                                        : target / unlocked.length;
                                                    return { ...p, weight: Math.round(newW * 100) / 100 };
                                                });
                                                // Reconcile residue on largest non-locked.
                                                const totalNow = scaled.reduce((s, p) => s + (Number(p.weight) || 0), 0);
                                                const residue = Number((100 - totalNow).toFixed(2));
                                                if (Math.abs(residue) >= 0.005) {
                                                    let idx = -1;
                                                    let max = -Infinity;
                                                    scaled.forEach((p, i) => {
                                                        if (p.isLocked || (p as any).keepEuros) return;
                                                        const w = Number(p.weight) || 0;
                                                        if (w > max) { max = w; idx = i; }
                                                    });
                                                    if (idx >= 0) {
                                                        scaled = [...scaled];
                                                        scaled[idx] = { ...scaled[idx], weight: Math.max(0, Number(((Number(scaled[idx].weight) || 0) + residue).toFixed(2))) };
                                                    }
                                                }
                  
                                                setPortfolio(scaled);
                                                toast.success("Pesos normalizados al 100 %");
                                            }}
                                            className="ml-2 bg-amber-50/60 hover:bg-amber-100/60 text-amber-700 text-[10px] font-bold px-2.5 py-1.5 rounded-md border border-amber-200 hover:border-amber-300 focus:outline-none uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                                            title={`Suma actual = ${sumW.toFixed(2)} %. Reescala los pesos no bloqueados para que sumen 100 %.`}
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-amber-500" strokeWidth={2} /> Normalizar 100%
                                        </button>
                                    );
                                })()}
                            </div>

                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-2 border border-slate-200 px-3 py-1.5 rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Capital</span>
                                    <div className="flex items-baseline gap-1">
                                        {isEditingCapital ? (
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={capitalInputValue}
                                                onChange={(e) => setCapitalInputValue(e.target.value)}
                                                onBlur={commitCapital}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        commitCapital();
                                                    } else if (e.key === 'Escape') {
                                                        setIsEditingCapital(false);
                                                        setCapitalInputValue(totalCapital.toString());
                                                    }
                                                }}
                                                autoFocus
                                                placeholder="Ej. 100.000,00"
                                                className="w-28 text-slate-800 font-mono text-sm tracking-tight font-semibold bg-slate-50 border border-blue-300 rounded px-1 outline-none focus:ring-2 focus:ring-blue-100"
                                            />
                                        ) : (
                                            <span
                                                className="text-slate-800 font-mono text-sm tracking-tight font-semibold cursor-text hover:text-blue-600 transition-colors"
                                                onClick={() => {
                                                    setCapitalInputValue(
                                                        Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalCapital)
                                                    );
                                                    setIsEditingCapital(true);
                                                }}
                                                title="Hacer clic para editar (acepta 1.234,56 o 1234.56)"
                                            >
                                                {Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalCapital)}
                                            </span>
                                        )}
                                        <span className="text-slate-500 text-[10px] font-bold">EUR</span>
                                    </div>
                                </div>

                                <div className="flex items-center border border-slate-200 rounded-md bg-white divide-x divide-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                                    <button
                                        onClick={() => exportToCSV(portfolio, totalCapital)}
                                        className="p-2 hover:bg-slate-50 text-[#00bcda] transition-colors"
                                        title="Exportar CSV"
                                    >
                                        <Download className="w-4 h-4" strokeWidth={2.5} />
                                    </button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                                    <button
                                        onClick={handleImportClick}
                                        className="p-2 hover:bg-slate-50 text-[#00bcda] transition-colors"
                                        title="Importar CSV"
                                    >
                                        <Upload className="w-4 h-4" strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => { if (window.confirm('¿Estás seguro de que quieres vaciar toda la cartera?')) setPortfolio([]) }}
                                        className="p-2 hover:bg-red-50 text-red-400 transition-colors"
                                        title="Vaciar Cartera"
                                    >
                                        <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            <PortfolioTable assets={portfolio} totalCapital={totalCapital} onRemove={handleRemoveAsset} onUpdateWeight={handleUpdateWeightSmart} onFundClick={setSelectedFund} onSwap={handleOpenSwap} onToggleLock={handleToggleLock} highlightActions={portfolioEditFocus} />
                        </div>
                    </div>

                </div>

                <div className="flex-1 h-full flex flex-col overflow-y-auto scrollbar-thin gap-5 pb-0">
                    <div style={{ flex: 1.15 }} className="flex flex-col min-h-0">
                        <AssetDistributionWidget
                            portfolio={portfolio}
                            allocData={allocData}
                            regionAllocation={regionAllocation}
                        />
                    </div>

                    <div style={{ flex: 1 }} className="min-h-0">
                        <Controls className="h-full" riskLevel={riskLevel} setRiskLevel={setRiskLevel} numFunds={numFunds} setNumFunds={setNumFunds} onOptimize={handleOptimize} isOptimizing={isOptimizing} onManualGenerate={handleManualGenerate} onOpenCosts={() => toggleModal('costs', true)} onOpenXRay={onOpenXRay} onOpenTactical={() => { setProposedPortfolio(portfolio); toggleModal('tactical', true); }} onOpenMacro={() => toggleModal('macro', true)} vipFunds={vipFunds} setVipFunds={setVipFunds} onOpenVipModal={() => toggleModal('vip', true)} onOpenSharpeMaximizer={() => toggleModal('sharpeMaximizer', true)} onOpenSavedPortfolios={() => toggleModal('savedPortfolios', true)} />
                    </div>
                </div>
            </div>

            <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center text-white">Cargando...</div>}>
                {modals.costs && <CostsModal portfolio={portfolio} assets={assets} totalCapital={totalCapital} onClose={() => toggleModal('costs', false)} />}
                {modals.vip && <VipFundsModal vipFundsStr={vipFunds} allFunds={assets} onSave={(newVal) => { setVipFunds(newVal); localStorage.setItem('ft_vipFunds', newVal); }} onClose={() => toggleModal('vip', false)} />}
                {modals.tactical && <TacticalModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} riskFreeRate={riskFreeRate} onAccept={handleAcceptPortfolio} onClose={() => toggleModal('tactical', false)} onSwap={handleOpenSwap} />}
                {modals.macro && <MacroTacticalModal portfolio={portfolio} allFunds={assets} numFunds={numFunds} onApply={handleMacroApply} onClose={() => toggleModal('macro', false)} />}
                {modals.review && <OptimizationReviewModal currentPortfolio={portfolio} proposedPortfolio={proposedPortfolio} riskFreeRate={riskFreeRate} currentMetrics={xrayMetrics} explainabilityData={explainabilityData} onAccept={handleReviewAccept} onApplyDirect={handleApplyDirectly} onClose={() => toggleModal('review', false)} />}
                {modals.sharpeMaximizer && <SharpeMaximizerModal isOpen={modals.sharpeMaximizer} onClose={() => toggleModal('sharpeMaximizer', false)} portfolio={portfolio} onAddFund={(fund) => { handleAddAsset(fund); toggleModal('sharpeMaximizer', false); }} currentSharpe={xrayMetrics?.sharpe ?? xrayMetrics?.metrics3y?.sharpe ?? null} />}
                {modals.savedPortfolios && (
                    <SavedPortfoliosModal
                        isOpen={modals.savedPortfolios}
                        onClose={() => toggleModal('savedPortfolios', false)}
                        currentPortfolio={portfolio}
                        currentTotalCapital={totalCapital}
                        onLoadPortfolio={(items, cap) => {
                            setPortfolio(items);
                            setTotalCapital(cap);
                        }}
                    />
                )}
                {selectedFund && <FundDetailModal fund={selectedFund} onClose={() => setSelectedFund(null)} />}
                {modals.analysis && analysisResult && <PortfolioAnalysisModal result={analysisResult} onClose={() => toggleModal('analysis', false)} />}
                {modals.optimizationStrategy && (
                    <OptimizationStrategyModal
                        isOpen={modals.optimizationStrategy}
                        onClose={() => toggleModal('optimizationStrategy', false)}
                        onProceed={handleProceedStrategy}
                        lockedCount={portfolio.filter(p => p.isLocked).length}
                        newCount={portfolio.filter(p => !p.isLocked).length}
                        currentCapital={totalCapital}
                        validateProceed={validateOptimizationStrategy}
                        zeroWeightFundNames={portfolio.filter(p => (Number(p.weight) || 0) <= 0.001).map(p => p.name || p.isin)}
                    />
                )}
                <FundSwapModal isOpen={swapper.isOpen} originalFund={swapper.fund} alternatives={swapper.alternatives} onSelect={performSwap} onClose={() => setSwapper(prev => ({ ...prev, isOpen: false, fund: null }))} onRefresh={handleOpenSwap} />
                {confirmDialog && (
                    <ConfirmModal
                        isOpen={confirmDialog.isOpen}
                        title={confirmDialog.title}
                        subtitle={confirmDialog.subtitle}
                        message={confirmDialog.message}
                        confirmLabel={confirmDialog.confirmLabel}
                        cancelLabel={confirmDialog.cancelLabel}
                        onConfirm={confirmDialog.onConfirm}
                        onCancel={confirmDialog.onCancel}
                    />
                )}
            </Suspense>
        </div>
    )
}

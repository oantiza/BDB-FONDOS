import { useState, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { query, collection, where, getDocs } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { useToast } from '../context/ToastContext';
import { findAlternatives, Alternative } from '../utils/fundSwapper';
import { generateSmartPortfolio } from '../utils/rulesEngine';
import { parsePortfolioCSV } from '../utils/csvImport';
import { Fund, PortfolioItem, SmartPortfolioResponse } from '../types';
import { MacroReport } from '../types/MacroReport';

interface UsePortfolioActionsProps {
    portfolio: PortfolioItem[];
    setPortfolio: (p: PortfolioItem[]) => void;
    assets: Fund[];
    riskLevel: number;
    numFunds: number;
    setProposedPortfolio: (p: PortfolioItem[]) => void;
    setTotalCapital: (n: number) => void;
    proposedPortfolio: PortfolioItem[];
}

export function usePortfolioActions({
    portfolio, setPortfolio,
    assets, riskLevel,
    numFunds,
    setProposedPortfolio,
    setTotalCapital,
    proposedPortfolio
}: UsePortfolioActionsProps) {
    const toast = useToast();
    const [isOptimizing, setIsOptimizing] = useState(false);

    // Modal & UI States
    const [modals, setModals] = useState({
        costs: false,
        tactical: false,
        macro: false,
        vip: false,
        review: false
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
    const handleOpenSwap = useCallback((fund: PortfolioItem) => {
        const alts = findAlternatives(fund, assets, riskLevel);
        setSwapper({
            isOpen: true,
            fund: fund,
            alternatives: alts
        });
    }, [assets, riskLevel]);

    const performSwap = useCallback((newFund: Fund) => {
        if (!swapper.fund) return;
        const updatedPortfolio = portfolio.map(item => {
            if (item.isin === swapper.fund?.isin) {
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
        if (assets.length === 0) {
            toast.info("Cargando fondos... espera un momento.");
            return;
        }
        try {
            setIsOptimizing(true);
            setPortfolio([]);
            const generated = generateSmartPortfolio(riskLevel, assets, numFunds);
            if (generated.length === 0) toast.error("No se encontraron fondos seguros para este perfil estricto.");
            else {
                setPortfolio(generated.map(p => ({ ...p, weight: Math.round(p.weight * 100) / 100 })));
                toast.success("Cartera generada");
            }
        } catch (e: any) {
            toast.error("Error local: " + (e.message || String(e)));
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleOptimize = async () => {
        if (portfolio.length === 0) {
            toast.info("Añade fondos a la cartera primero");
            return;
        }
        setIsOptimizing(true);
        try {
            const optimizeFn = httpsCallable(functions, 'optimize_portfolio_quant');
            const response = await optimizeFn({
                assets: portfolio.map(p => p.isin),
                risk_level: riskLevel,
                locked_assets: portfolio.filter(p => p.manualSwap).map(p => p.isin)
            });
            const result = response.data as SmartPortfolioResponse;
            if (result.status === 'optimal' || result.status === 'fallback') {
                const weights = result.weights || {};
                let hasChanges = false;
                const optimized = portfolio.map(p => {
                    const rawWeight = (weights[p.isin] || 0) * 100;
                    const newWeight = Math.round(rawWeight * 100) / 100;
                    if (Math.abs(newWeight - p.weight) > 0.5) hasChanges = true;
                    return { ...p, weight: newWeight };
                }).filter(p => p.weight > 0.01);

                if (!hasChanges) {
                    toast.success("✅ La cartera ya está optimizada.");
                    setProposedPortfolio(optimized);
                    toggleModal('tactical', true);
                } else {
                    setProposedPortfolio(optimized);
                    toggleModal('review', true);
                }
            } else {
                toast.error("Error en la optimización: " + (result.warnings?.[0] || 'Desconocido'));
            }
        } catch (error: any) {
            toast.error("Error crítico al contactar el servidor: " + error.message);
        } finally {
            setIsOptimizing(false);
        }
    };

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
        if (window.confirm(`Se han detectado ${result.portfolio.length} fondos. ¿Reemplazar cartera actual?`)) {
            const enriched: PortfolioItem[] = result.portfolio.map(p => {
                const known = assets.find(a => a.isin === p.isin) || { isin: p.isin, name: p.name || 'Unknown', std_type: 'Unknown' } as Fund;
                return { ...known, ...p, weight: p.weight };
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
        handleApplyDirectly,
        handleReviewAccept,
        handleAcceptPortfolio,
        handleMacroApply,
        handleImportCSV
    };
}

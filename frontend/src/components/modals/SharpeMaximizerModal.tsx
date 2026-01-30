import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { query, collection, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Fund, PortfolioItem } from '../../types';
import { backtestPortfolio } from '../../engine/portfolioAnalyticsEngine';
import { useToast } from '../../context/ToastContext';
import { REGION_DISPLAY_LABELS } from '../../utils/normalizer';

interface SharpeMaximizerModalProps {
    isOpen: boolean;
    onClose: () => void;
    portfolio: PortfolioItem[];
    onAddFund: (fund: Fund) => void;
    currentSharpe: number; // To show improvement
}

interface CandidateResult {
    fund: any;
    individualSharpe: number;
    projectedSharpe: number;
    impact: number;
}

export default function SharpeMaximizerModal({
    isOpen,
    onClose,
    portfolio,
    onAddFund,
    currentSharpe
}: SharpeMaximizerModalProps) {
    const toast = useToast();
    const [step, setStep] = useState<'FILTER' | 'SEARCHING' | 'RESULTS'>('FILTER');

    // Filters
    const [assetClass, setAssetClass] = useState<string>('RV');
    const [region, setRegion] = useState<string>('all');

    // Results
    const [results, setResults] = useState<CandidateResult[]>([]);
    const [progress, setProgress] = useState(0);

    if (!isOpen) return null;

    // Helper to process candidates (simulate impact)
    const processCandidates = async (cands: any[]) => {
        const simulationResults: CandidateResult[] = [];
        let processed = 0;
        const currentPortfolioForEngine = portfolio.map(p => ({ isin: p.isin, weight: p.weight }));

        for (const cand of cands) {
            // Skip if already in portfolio
            if (portfolio.some(p => p.isin === cand.isin)) continue;

            const candidateWeight = 0.05; // 5% allocation test

            const simulatedPortfolio = [
                ...currentPortfolioForEngine.map(p => ({ isin: p.isin, weight: p.weight * (1 - candidateWeight) })),
                { isin: cand.isin, weight: candidateWeight }
            ];

            // Run Backtest
            try {
                const res = await backtestPortfolio({ portfolio: simulatedPortfolio, period: '3y' });

                if (res && res.metrics && res.metrics.sharpe) {
                    const projSharpe = res.metrics.sharpe;
                    const indivSharpe = cand.std_perf?.sharpe || 0;

                    simulationResults.push({
                        fund: cand,
                        individualSharpe: indivSharpe,
                        projectedSharpe: projSharpe,
                        impact: projSharpe - currentSharpe
                    });
                }
            } catch (e) {
                console.warn(`Error simulating ${cand.isin}`, e);
            }

            processed++;
            setProgress(Math.round((processed / cands.length) * 100));
        }

        // Sort by Impact DESC
        simulationResults.sort((a, b) => b.impact - a.impact);
        setResults(simulationResults);
        setStep('RESULTS');
    };

    const handleSearch = async () => {
        setStep('SEARCHING');
        setResults([]);
        setProgress(0);

        let candidates: any[] = [];

        // [CONFIG] Search Variants
        const ASSET_VARIANTS: Record<string, string[]> = {
            'RV': ['RV', 'Equity', 'Renta Variable', 'Stock', 'EQ', 'Renta Variable Global'],
            'RF': ['RF', 'Fixed Income', 'Renta Fija', 'Bond', 'FI', 'Deuda'],
            'Monetario': ['Monetario', 'Money Market', 'Cash', 'Liquidez', 'MM'],
            'Mixto': ['Mixto', 'Mixed', 'Balanced', 'Allocation', 'Multi-Asset'],
            'Retorno Absoluto': ['Retorno Absoluto', 'Alternative', 'Absolute Return', 'Hedge']
        };

        const REGION_CONFIGS: Record<string, any> = {
            'EMERGENTES_LEGACY': { field: 'ms.category_morningstar', op: '==', val: 'Morningstar Emerging Markets' }
        };

        const isAllRegions = region === 'all';
        const isEmerging = region.includes('emerging') || region === 'china' || region === 'latin_america' || region === 'asia_broad';
        const isStandardRegion = !isAllRegions && !REGION_CONFIGS[region];

        // [CONFIG] Assets
        let targetAssets = ASSET_VARIANTS[assetClass] || [assetClass];
        if (isEmerging && assetClass === 'RV') {
            targetAssets = [...targetAssets, 'Otros', 'Other'];
        }

        // [CONFIG] Region
        const getRegionVariants = (key: string): string[] => {
            const map: Record<string, string[]> = {
                'united_states': ['united_states', 'United States', 'USA', 'North America', 'US', 'EE.UU.'],
                'europe_broad': ['eurozone', 'europe_ex_euro', 'united_kingdom', 'europe_emerging', 'Europe', 'Europa', 'Eurozone', 'Zona Euro', 'UK', 'Germany', 'France'],
                'asia_broad': ['japan', 'china', 'asia_emerging', 'developed_asia', 'Asia', 'Japan', 'China', 'Japón', 'Pacific'],
                'emerging_broad': ['latin_america', 'emerging_markets', 'asia_emerging', 'europe_emerging', 'middle_east', 'africa', 'Emerging', 'Emergentes', 'Mercados Emergentes', 'BRIC']
            };
            const specific = map[key] || [];
            if (specific.length > 0) return specific;

            const generic = [key, key.replace(/_/g, ' '), key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')];
            return Array.from(new Set([...specific, ...generic]));
        };

        let activeConfig: any = null;
        if (!isStandardRegion) {
            activeConfig = REGION_CONFIGS[region] || null;
        }

        try {
            let queryPromises: Promise<any>[] = [];

            if (isStandardRegion) {
                const variants = getRegionVariants(region);
                for (const v of variants) {
                    const constraints: any[] = [
                        where('derived.asset_class', 'in', targetAssets),
                        where('derived.primary_region', '==', v),
                        orderBy('std_perf.sharpe', 'desc'),
                        limit(20)
                    ];
                    queryPromises.push(getDocs(query(collection(db, 'funds_v3'), ...constraints)));
                }
            } else {
                let constraints: any[] = [where('derived.asset_class', 'in', targetAssets)];
                if (activeConfig) {
                    constraints.push(where(activeConfig.field, activeConfig.op, activeConfig.val));
                    if (activeConfig.valEnd) constraints.push(where(activeConfig.field, '<=', activeConfig.valEnd));
                }
                constraints.push(orderBy('std_perf.sharpe', 'desc'));
                constraints.push(limit(50));

                queryPromises.push(getDocs(query(collection(db, 'funds_v3'), ...constraints)));
            }

            const snapshots = await Promise.all(queryPromises);
            const allDocs = snapshots.flatMap(s => s.docs);

            const seenIds = new Set();
            for (const d of allDocs) {
                if (!seenIds.has(d.id)) {
                    seenIds.add(d.id);
                    candidates.push({ isin: d.id, ...d.data() });
                }
            }

            if (candidates.length === 0) {
                throw new Error("ForceFallback");
            }

        } catch (e: any) {
            console.error(e);

            // Simplified Fallback strategy (ignore index errors, just try broad asset class search if standard region fails)
            const isIndexError = e.code === 'failed-precondition' || e.message?.includes('index');
            const isForceFallback = e.message === 'ForceFallback';

            if (isIndexError || isForceFallback) {
                // If standard region failed, we revert to All Regions (Asset only) or maybe skip this? 
                // Let's rely on simple asset search if standard region fails (better than nothing)
                try {
                    let fallbackConstraints = [where('derived.asset_class', 'in', targetAssets)];
                    if (activeConfig) {
                        fallbackConstraints.push(where(activeConfig.field, activeConfig.op, activeConfig.val));
                    }
                    fallbackConstraints.push(limit(100));
                    const qFallback = query(collection(db, 'funds_v3'), ...fallbackConstraints);
                    const snapFallback = await getDocs(qFallback);
                    candidates = snapFallback.docs.map(d => ({ isin: d.id, ...d.data() }));
                } catch (fbErr) { console.warn("Fallback failed", fbErr); }
            } else {
                toast.error(`Error buscando fondos: ${e.message}`);
                setStep('FILTER');
                return;
            }
        }

        // Secondary Logic (Emerging by Name)
        if (isEmerging) {
            try {
                const qBroad = query(collection(db, 'funds_v3'), where('derived.asset_class', 'in', targetAssets), orderBy('std_perf.sharpe', 'desc'), limit(100));
                const snapBroad = await getDocs(qBroad);
                const nameMatches = snapBroad.docs.map(d => ({ isin: d.id, ...d.data() })).filter(f => (f as any).name?.toLowerCase().includes('emerging'));
                const seen = new Set(candidates.map(c => c.isin));
                for (const f of nameMatches) {
                    if (!seen.has((f as any).isin)) { candidates.push(f); seen.add((f as any).isin); }
                }
            } catch (e) {
                console.warn("Secondary Emerging search failed (likely missing index for broad sort):", e);
            }
        }

        // Sorting & Slicing
        candidates.sort((a, b) => ((b as any).std_perf?.sharpe || 0) - ((a as any).std_perf?.sharpe || 0));
        candidates = candidates.slice(0, 10);

        if (candidates.length === 0) {
            const msg = `Sin resultados. Filtros: ${assetClass} + ${activeConfig ? activeConfig.val : region}.`;
            toast.error(msg);
            setStep('FILTER');
            return;
        }

        await processCandidates(candidates);

    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-white">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">⚡</span>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                Maximizador de Sharpe <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2">v0.0.9 (FIXED)</span>
                            </h2>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Busca ALPHA en la DB</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-2xl leading-none">&times;</button>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">

                    {step === 'FILTER' && (
                        <div className="space-y-6">
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Esta herramienta buscará en la base de datos completa los fondos que, al añadirse a tu cartera (con un peso del 5%),
                                maximicen tu <strong>Ratio de Sharpe</strong> (rentabilidad ajustada al riesgo).
                            </p>
                            <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 border border-yellow-200">
                                <strong>Nota Debug:</strong> Si la búsqueda por Sharpe falla, se mostrarán fondos aleatorios (orden nombre) para verificar datos.
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Clase de Activo</label>
                                    <select
                                        value={assetClass} onChange={e => setAssetClass(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                                    >
                                        <option value="RV">Renta Variable</option>
                                        <option value="RF">Renta Fija</option>
                                        <option value="Monetario">Monetario</option>
                                        <option value="Mixto">Mixto</option>
                                        <option value="Retorno Absoluto">Retorno Absoluto</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Región</label>
                                    <select
                                        value={region} onChange={e => setRegion(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                                    >
                                        <option value="all">Global</option>
                                        <option value="united_states">Estados Unidos</option>
                                        <option value="europe_broad">Europa</option>
                                        <option value="asia_broad">Asia, Japón y China</option>
                                        <option value="emerging_broad">Emergentes</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-emerald-50 p-4 rounded-lg flex items-center gap-3 border border-emerald-100">
                                <span className="text-xl">📊</span>
                                <div>
                                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Sharpe Actual</div>
                                    <div className="text-2xl font-bold text-emerald-600">{currentSharpe.toFixed(2)}</div>
                                </div>
                            </div>

                            <button
                                onClick={handleSearch}
                                className="w-full py-4 bg-[#003399] hover:bg-[#002277] text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                            >
                                Buscar Oportunidades 🚀
                            </button>
                        </div>
                    )}

                    {step === 'SEARCHING' && (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin"></div>
                            <h3 className="text-lg font-bold text-emerald-700 animate-pulse">Analizando Mercado...</h3>
                            <p className="text-slate-400 text-sm">Simulando impacto en tu cartera ({progress}%)</p>
                        </div>
                    )}

                    {step === 'RESULTS' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-bold text-slate-700">Mejores Candidatos Encontrados</h3>
                                <button onClick={() => setStep('FILTER')} className="text-xs font-bold text-[#003399] hover:underline">Cambiar Filtros</button>
                            </div>

                            {results.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    No se encontraron fondos que mejoren tu Sharpe actual.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {results.map((res, idx) => (
                                        <div key={res.fund.isin} className="bg-white border border-slate-100 rounded-xl p-4 hover:border-emerald-200 transition-colors shadow-sm flex items-center justify-between group">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">{idx + 1}</span>
                                                    <h4 className="font-bold text-slate-800 text-sm line-clamp-1" title={res.fund.name}>{res.fund.name}</h4>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span>ISIN: {res.fund.isin}</span>
                                                    <span>Sharpe: <strong className="text-slate-700">{res.individualSharpe.toFixed(2)}</strong></span>
                                                    <span>Retro: <strong className="text-slate-700">
                                                        {(res.fund.manual?.costs?.retrocession ?? res.fund.costs?.retrocession)
                                                            ? `${((val => val > 0.1 ? val : val * 100)(res.fund.manual?.costs?.retrocession ?? res.fund.costs?.retrocession)).toFixed(2)}%`
                                                            : 'N/A'}
                                                    </strong></span>
                                                </div>
                                                <div className="flex gap-1 mt-1">
                                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded border border-blue-100 uppercase">
                                                        {(res.fund.derived?.asset_class || 'N/A')}
                                                    </span>
                                                    <span className="text-[10px] bg-orange-50 text-orange-600 px-1 rounded border border-orange-100 uppercase">
                                                        {(res.fund.derived?.primary_region || 'N/A')}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nuevo Sharpe</div>
                                                    <div className={`text-lg font-bold ${res.impact > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                        {res.projectedSharpe.toFixed(2)}
                                                        {res.impact > 0 && <span className="text-xs ml-1 opacity-75">(+{res.impact.toFixed(2)})</span>}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onAddFund({
                                                        isin: res.fund.isin,
                                                        name: res.fund.name,
                                                        std_type: res.fund.derived?.asset_class || res.fund.asset_class || 'Unknown'
                                                    } as Fund)}
                                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg font-bold text-xs transition-colors"
                                                >
                                                    Añadir
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div >,
        document.body
    );
}

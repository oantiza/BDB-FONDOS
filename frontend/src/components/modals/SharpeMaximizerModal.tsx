import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { translateAssetClass, translateRegion } from '../../utils/fundTaxonomy';
import { Fund, PortfolioItem } from '../../types';
import { backtestPortfolio } from '../../engine/portfolioAnalyticsEngine';
import { useToast } from '../../context/ToastContext';
import { findDirectAlternativesV3 } from '../../utils/directSearch';

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
    const [assetClass, setAssetClass] = useState<string>('EQUITY');
    const [region, setRegion] = useState<string>('GLOBAL');
    const [prioritizeRetro, setPrioritizeRetro] = useState<boolean>(false);
    const [page, setPage] = useState<number>(0); // Pagination state

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

        // Sort by Impact DESC (or Retro if prioritized)
        const getRetro = (fund: any) => ((fund.manual?.costs?.retrocession ?? fund.costs?.retrocession) || 0);
        if (prioritizeRetro) {
            simulationResults.sort((a, b) => {
                const retroA = getRetro(a.fund);
                const retroB = getRetro(b.fund);
                if (retroA !== retroB) return retroB - retroA;
                return b.impact - a.impact;
            });
        } else {
            simulationResults.sort((a, b) => b.impact - a.impact);
        }
        setResults(simulationResults);
        setStep('RESULTS');
    };

    const handleSearch = async (overrideOffset?: number) => {
        setStep('SEARCHING');
        if (overrideOffset === undefined || overrideOffset === 0) {
            setResults([]);
        }
        setProgress(0);

        try {
            // Re-use the hyper-optimized unified search engine from Phase 1 & 2
            // Pass null as the targetFund because this is a "cold search"
            const candidates = await findDirectAlternativesV3(null, {
                assetClass,
                region,
                maximizeRetro: prioritizeRetro,
                desired: 10, // Fetch top 10 to simulate
                offset: overrideOffset ?? page * 10
            });

            if (!candidates || candidates.length === 0) {
                const msg = `Sin resultados nuevos. Filtros: ${assetClass} + ${region}. (Página: ${overrideOffset ?? page})`;
                toast.error(msg);
                setStep('FILTER');
                return;
            }

            await processCandidates(candidates);

        } catch (e: any) {
            console.error(e);
            toast.error(`Error buscando fondos: ${e.message}`);
            setStep('FILTER');
        }
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
                                        value={assetClass} onChange={e => { setAssetClass(e.target.value); setPage(0); }}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                                    >
                                        <optgroup label="Grandes Bloques">
                                            <option value="EQUITY">Renta Variable (General)</option>
                                            <option value="FIXED_INCOME">Renta Fija (General)</option>
                                            <option value="MONEY_MARKET">Monetario</option>
                                            <option value="MIXED_ALLOCATION">Mixto</option>
                                            <option value="ALTERNATIVE">Alternativos</option>
                                        </optgroup>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Región</label>
                                    <select
                                        value={region} onChange={e => setRegion(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                                    >
                                        <option value="GLOBAL">Global</option>
                                        <option value="USA">Estados Unidos</option>
                                        <option value="EUROPE">Europa</option>
                                        <option value="ASIA">Asia</option>
                                        <option value="EMERGING">Emergentes</option>
                                        <option value="JAPAN">Japón</option>
                                        <option value="LATAM">Latinoamérica</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 rounded-lg py-1 mt-2">
                                <input
                                    type="checkbox"
                                    id="prioritizeRetro"
                                    checked={prioritizeRetro}
                                    onChange={(e) => { setPrioritizeRetro(e.target.checked); setPage(0); }}
                                    className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                                />
                                <label htmlFor="prioritizeRetro" className="text-sm font-bold text-slate-700 cursor-pointer">
                                    Priorizar Fondos con Mayor Retrocesión
                                </label>
                            </div>

                            <div className="bg-emerald-50 p-4 rounded-lg flex items-center gap-3 border border-emerald-100 mt-4">
                                <span className="text-xl">📊</span>
                                <div>
                                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Sharpe Actual</div>
                                    <div className="text-2xl font-bold text-emerald-600">{currentSharpe.toFixed(2)}</div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleSearch(0)}
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
                                                <div className="flex flex-wrap gap-1.5 items-center mt-1.5">
                                                    <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">{translateAssetClass(res.fund.classification_v2?.asset_type || 'UNKNOWN')}</span>
                                                    {res.fund.classification_v2?.asset_subtype && res.fund.classification_v2.asset_subtype !== 'General' && res.fund.classification_v2.asset_subtype !== 'UNKNOWN' && (
                                                        <span className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded uppercase max-w-[120px] truncate">{res.fund.classification_v2.asset_subtype}</span>
                                                    )}
                                                    <span className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded uppercase">{translateRegion(res.fund.classification_v2?.region_primary || 'GLOBAL')}</span>
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
                                                        classification_v2: res.fund.classification_v2,
                                                        portfolio_exposure_v2: res.fund.portfolio_exposure_v2
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

                            {/* Pagination Button for the Results Page */}
                            <button
                                onClick={() => {
                                    const nextPage = page + 1;
                                    setPage(nextPage);
                                    handleSearch(nextPage * 10);
                                }}
                                className="w-full mt-4 py-3 bg-white hover:bg-slate-50 border-2 border-emerald-600 text-emerald-700 rounded-xl font-bold shadow-sm transition-colors uppercase tracking-wider text-xs"
                            >
                                Escanear Siguientes 10 Candidatos ⬇️
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div >,
        document.body
    );
}

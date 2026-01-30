// frontend/src/components/FundSwapModal.tsx
import React, { useState, useEffect } from 'react';
import { REGION_DISPLAY_LABELS } from '../utils/normalizer';

// Un componente simple para mostrar datos
const StatRow = ({ label, value, delta, isPercentage }: any) => {
    const deltaClass = delta < 0 ? 'text-green-600' : delta > 0 ? 'text-red-600' : 'text-gray-500';
    const deltaText = delta ? `(${delta > 0 ? '+' : ''}${delta.toFixed(2)}%)` : '';

    return (
        <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">{label}:</span>
            <span className="font-medium">
                {value} {isPercentage && '%'}
                {delta !== undefined && <span className={`ml-1 text-xs ${deltaClass}`}>{deltaText}</span>}
            </span>
        </div>
    );
};

const normalizeRetro = (val: number | undefined | null) => {
    if (val === undefined || val === null) return 0;
    return val > 0.1 ? val : val * 100;
};

export const FundSwapModal = ({ isOpen, originalFund, alternatives, onSelect, onClose, onRefresh }: any) => {
    const [assetClass, setAssetClass] = useState('RV');
    const [region, setRegion] = useState('all');
    const [isSearching, setIsSearching] = useState(false);

    // Sync filters with original fund when it changes or modal opens
    useEffect(() => {
        if (originalFund && isOpen) {
            setAssetClass(originalFund.derived?.asset_class || originalFund.std_type || 'RV');
            setRegion(originalFund.derived?.primary_region || originalFund.std_region || 'all');
        }
    }, [originalFund, isOpen]);

    if (!isOpen || !originalFund) return null;

    const handleSearch = async () => {
        setIsSearching(true);
        // We call the parent's handleOpenSwap which is exposed through context or props
        // In this architecture, it's safer to use the onSelect pattern or expose a reload function.
        // Assuming we can re-trigger the swap search via a parent-provided function.
        // But the current props don't provide a 'reload' function. 
        // Let's modify the props in DashboardPage/usePortfolioActions if needed, 
        // or trigger it through a custom event if we want to avoid prop drilling.
        // Looking at DashboardPage.tsx, it passes 'handleOpenSwap' to PortfolioTable.
        // We might need to pass it here too.
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full p-6 max-h-[90vh] overflow-y-auto">

                {/* Cabecera */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Intercambio de Activo</h2>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-black mt-1">Busca el mejor ALPHA para tu cartera</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-4xl leading-none">&times;</button>
                </div>

                {/* FILTROS DE BÚSQUEDA */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-wider">Clase de Activo</label>
                        <select
                            value={assetClass} onChange={e => setAssetClass(e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-blue-500"
                        >
                            <option value="RV">Renta Variable</option>
                            <option value="RF">Renta Fija</option>
                            <option value="Monetario">Monetario</option>
                            <option value="Mixto">Mixto</option>
                            <option value="Retorno Absoluto">Retorno Absoluto</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-wider">Región</label>
                        <select
                            value={region} onChange={e => setRegion(e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-blue-500"
                        >
                            <option value="all">Global</option>
                            <option value="united_states">Estados Unidos</option>
                            <option value="europe_broad">Europa</option>
                            <option value="asia_broad">Asia, Japón y China</option>
                            <option value="emerging_broad">Emergentes</option>
                        </select>
                    </div>
                    <button
                        onClick={() => onRefresh?.(originalFund, { assetClass, region })}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-sm transition-all text-sm h-[42px] px-6"
                    >
                        Refrescar Candidatos 🔎
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                    {/* COLUMNA 1: ACTUAL (Gris) */}
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                        <div className="bg-gray-200 text-gray-700 text-[10px] font-black px-2 py-0.5 rounded inline-block mb-3 uppercase tracking-tighter">
                            Selección Actual
                        </div>
                        <h3 className="font-bold text-base mb-1 h-12 overflow-hidden leading-snug">{originalFund.name}</h3>
                        <p className="text-[11px] text-gray-500 mb-4 line-clamp-1">{originalFund.std_extra?.company || 'Gestora desconocida'}</p>

                        <div className="bg-white p-3 rounded-lg border border-gray-100 mb-4 space-y-1">
                            <StatRow
                                label="Volatilidad"
                                value={originalFund.std_perf?.volatility !== undefined ? (originalFund.std_perf.volatility * 100).toFixed(2) : '-'}
                                isPercentage
                            />
                            <StatRow
                                label="Sharpe"
                                value={originalFund.std_perf?.sharpe != null ? originalFund.std_perf.sharpe.toFixed(2) : '-'}
                            />
                            <StatRow
                                label="Coste (TER)"
                                value={originalFund.std_extra?.ter || '-'}
                                isPercentage
                            />
                            <StatRow
                                label="Retrocesión"
                                value={(originalFund.manual?.costs?.retrocession ?? originalFund.costs?.retrocession)
                                    ? normalizeRetro(originalFund.manual?.costs?.retrocession ?? originalFund.costs?.retrocession)?.toFixed(2)
                                    : '-'}
                                isPercentage={(originalFund.manual?.costs?.retrocession ?? originalFund.costs?.retrocession) !== undefined}
                            />
                        </div>

                        <button disabled className="w-full py-2 bg-gray-200 text-gray-400 rounded-lg font-bold cursor-not-allowed text-xs uppercase">
                            Activo en cartera
                        </button>
                    </div>

                    {/* COLUMNAS 2, 3 y 4: ALTERNATIVAS */}
                    {alternatives.map((alt: any) => {
                        const isBetter = alt.deltaFee > 0 || (alt.fund.std_perf?.sharpe > originalFund.std_perf?.sharpe);
                        const badgeColor = isBetter ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-blue-50 text-blue-700 border-blue-100";
                        const btnColor = isBetter ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700";

                        return (
                            <div key={alt.fund.isin} className="border border-slate-200 hover:border-blue-400 rounded-xl p-4 bg-white transition-all shadow-sm hover:shadow-md flex flex-col">
                                <div className={`border text-[10px] font-black px-2 py-0.5 rounded inline-block mb-3 uppercase tracking-tighter self-start ${badgeColor}`}>
                                    {alt.reason === "Alternativa Directa V3" ? "Mejor Opción" : alt.reason}
                                </div>
                                <h3 className="font-bold text-base mb-1 text-slate-800 h-10 overflow-hidden leading-snug">{alt.fund.name}</h3>
                                <p className="text-[11px] text-slate-500 mb-4 line-clamp-1">{alt.fund.std_extra?.company || 'Gestora desconocida'}</p>

                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 space-y-1 flex-1">
                                    <StatRow
                                        label="Volatilidad"
                                        value={alt.fund.std_perf_norm?.volatility !== undefined
                                            ? (alt.fund.std_perf_norm.volatility * 100).toFixed(2)
                                            : (alt.fund.std_perf?.volatility !== undefined ? (alt.fund.std_perf.volatility * 100).toFixed(2) : '-')}
                                        isPercentage
                                    />
                                    <StatRow
                                        label="Sharpe"
                                        value={alt.fund.std_perf_norm?.sharpe != null
                                            ? alt.fund.std_perf_norm.sharpe.toFixed(2)
                                            : (alt.fund.std_perf?.sharpe != null ? alt.fund.std_perf.sharpe.toFixed(2) : '-')}
                                        delta={
                                            ((alt.fund.std_perf_norm?.sharpe || alt.fund.std_perf?.sharpe) !== undefined && originalFund.std_perf?.sharpe !== undefined)
                                                ? (alt.fund.std_perf_norm?.sharpe || alt.fund.std_perf?.sharpe) - originalFund.std_perf.sharpe
                                                : undefined
                                        }
                                    />
                                    <StatRow
                                        label="Ahorro Coste"
                                        value={alt.fund.std_extra?.ter || '-'}
                                        delta={alt.deltaFee}
                                        isPercentage
                                    />
                                    <StatRow
                                        label="Retrocesión"
                                        value={(alt.fund.manual?.costs?.retrocession ?? alt.fund.costs?.retrocession)
                                            ? normalizeRetro(alt.fund.manual?.costs?.retrocession ?? alt.fund.costs?.retrocession)?.toFixed(2)
                                            : '-'}
                                        isPercentage={(alt.fund.manual?.costs?.retrocession ?? alt.fund.costs?.retrocession) !== undefined}
                                        delta={(alt.fund.manual?.costs?.retrocession ?? alt.fund.costs?.retrocession) !== undefined && (originalFund.manual?.costs?.retrocession ?? originalFund.costs?.retrocession) !== undefined
                                            ? (normalizeRetro(alt.fund.manual?.costs?.retrocession ?? alt.fund.costs?.retrocession) ?? 0) - (normalizeRetro(originalFund.manual?.costs?.retrocession ?? originalFund.costs?.retrocession) ?? 0)
                                            : undefined
                                        }
                                    />
                                </div>

                                <button
                                    onClick={() => onSelect(alt.fund)}
                                    className={`w-full py-2.5 text-white rounded-lg font-bold shadow-sm transition-colors text-xs uppercase ${btnColor}`}
                                >
                                    Sustituir Activo
                                </button>
                            </div>
                        );
                    })}
                </div>

                {alternatives.length === 0 && (
                    <div className="text-center p-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-4">
                        <span className="text-3xl block mb-2">🔭</span>
                        No se encontraron alternativas con los filtros actuales.<br />Prueba a ampliar la región o cambiar la clase de activo.
                    </div>
                )}
            </div>
        </div>
    );
};

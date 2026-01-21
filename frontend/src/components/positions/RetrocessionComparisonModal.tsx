import React from 'react';
import { X, TrendingUp } from 'lucide-react';

interface ComparisonModalProps {
    isOpen: boolean;
    onClose: () => void;
    originalFund: {
        isin: string;
        nombre: string;
        retrocession?: number;
        category?: string;
        region?: string;
        rating?: number;
        sectors?: Record<string, number>;
        volatility?: number;
        sharpe?: number;
        ter?: number;
    };
    alternatives: any[];
}

const formatCurrency = (val: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);

// Helper to format percentage correctly based on DB format (e.g. 0.75 -> 0.75%)
const formatRetro = (val: number | undefined) => {
    if (val === undefined || val === null) return '--';
    return `${(val * 100).toFixed(2)}%`;
};

// Helper for Star Rating
const renderStars = (rating: number | undefined) => {
    if (!rating) return <span className="text-slate-400 text-xs">N/A</span>;
    return (
        <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
                <svg key={i} className={`w-3 h-3 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200 fill-slate-200'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
            ))}
        </div>
    );
};

export const RetrocessionComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose, originalFund, alternatives }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Análisis de Retrocesiones</h2>
                        <p className="text-sm text-slate-500">Alternativas homogéneas con mayor retribución</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

                        {/* 1. Fondo Actual (Left Column) */}
                        <div className="lg:col-span-1 space-y-4">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Fondo Actual</h3>
                            <div className="bg-white p-5 rounded-xl border-2 border-slate-200 shadow-sm relative overflow-hidden h-full flex flex-col">
                                <div className="absolute top-0 left-0 w-full h-1 bg-slate-400"></div>

                                <div className="mb-4">
                                    <h3 className="text-md font-bold text-slate-900 leading-snug" title={originalFund.nombre}>
                                        {originalFund.nombre}
                                    </h3>
                                    <div className="inline-block mt-2 px-1.5 py-0.5 bg-slate-100 text-slate-500 font-mono text-[10px] rounded">
                                        {originalFund.isin}
                                    </div>
                                </div>

                                <div className="mt-auto space-y-4 pt-4 border-t border-slate-100">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase">Retrocesión Actual</p>
                                        <p className="text-2xl font-bold text-slate-700">{formatRetro(originalFund.retrocession)}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Categoría</span>
                                            <span className="text-slate-700 font-semibold text-right max-w-[120px] leading-tight">{originalFund.category || '--'}</span>
                                        </div>
                                        <div className="flex justify-between text-xs border-t border-slate-200/50 pt-2">
                                            <span className="text-slate-500">Región</span>
                                            <span className="text-slate-700 font-semibold text-right">{originalFund.region || '--'}</span>
                                        </div>
                                        <div className="flex justify-between text-xs border-t border-slate-200/50 pt-2 items-center">
                                            <span className="text-slate-500">Rating</span>
                                            {renderStars(originalFund.rating)}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                                        <div className="bg-slate-50 rounded p-1.5">
                                            <p className="text-[10px] text-slate-400 uppercase">Vol (1Y)</p>
                                            <p className="text-xs font-bold text-slate-700">{originalFund.volatility ? `${originalFund.volatility.toFixed(2)}%` : '--'}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded p-1.5">
                                            <p className="text-[10px] text-slate-400 uppercase">Sharpe</p>
                                            <p className="text-xs font-bold text-slate-700">{originalFund.sharpe ? originalFund.sharpe.toFixed(2) : '--'}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded p-1.5">
                                            <p className="text-[10px] text-slate-400 uppercase">TER</p>
                                            <p className="text-xs font-bold text-slate-700">{originalFund.ter ? `${originalFund.ter.toFixed(2)}%` : '--'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Alternatives (Right Columns) */}
                        <div className="lg:col-span-3">
                            <h3 className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Top 3 Alternativas Homogéneas
                            </h3>

                            {alternatives.length === 0 ? (
                                <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 h-full flex flex-col items-center justify-center">
                                    <TrendingUp className="w-12 h-12 text-slate-300 mb-2" />
                                    No se encontraron alternativas homogéneas con mayor retrocesión en la base de datos.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                                    {alternatives.map((alt: any, idx) => {
                                        const altRetroRaw = alt.manual?.costs?.retrocession ?? alt.costs?.retrocession ?? 0;
                                        const diff = altRetroRaw - (originalFund.retrocession || 0);
                                        return (
                                            <div key={alt.isin} className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow relative ring-1 ring-emerald-900/5 flex flex-col h-full">
                                                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                                                <div className="absolute top-3 right-3 text-emerald-100 font-bold text-[40px] leading-none opacity-20 pointer-events-none">
                                                    #{idx + 1}
                                                </div>

                                                <div className="mb-4 relative z-10">
                                                    <h4 className="text-sm font-bold text-slate-800 leading-snug min-h-[40px] line-clamp-2" title={alt.name}>
                                                        {alt.name}
                                                    </h4>
                                                    <div className="inline-block mt-2 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-mono text-[10px] rounded border border-emerald-100">
                                                        {alt.isin}
                                                    </div>
                                                </div>

                                                <div className="mt-auto space-y-3 pt-4 border-t border-emerald-50 relative z-10">
                                                    <div className="flex justify-between items-end">
                                                        <div>
                                                            <p className="text-xs text-slate-500 uppercase">Retrocesión</p>
                                                            <p className="text-2xl font-bold text-emerald-600">
                                                                {formatRetro(altRetroRaw)}
                                                            </p>
                                                        </div>
                                                        {diff > 0 && (
                                                            <div className="text-right">
                                                                <p className="text-xs text-emerald-600 font-bold mb-1">
                                                                    +{(diff * 100).toFixed(2)}%
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-50 space-y-1.5">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">Categoría</span>
                                                            <span className="text-slate-700 font-medium truncate max-w-[100px]">{alt.category_morningstar || alt.std_type}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-slate-500">Región</span>
                                                            <span className="text-slate-700 font-medium truncate max-w-[100px]">{alt.primary_region || alt.std_region}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs pt-1 border-t border-emerald-100 items-center">
                                                            <span className="text-slate-500">Rating</span>
                                                            {renderStars(alt.rating_overall)}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-2 mt-auto">
                                                        <div className="bg-emerald-50/30 rounded p-1.5 text-center border border-emerald-50">
                                                            <p className="text-[10px] text-slate-400 uppercase">Vol</p>
                                                            <p className="text-xs font-bold text-slate-700">{alt.std_perf?.volatility ? `${alt.std_perf.volatility.toFixed(2)}%` : '--'}</p>
                                                        </div>
                                                        <div className="bg-emerald-50/30 rounded p-1.5 text-center border border-emerald-50">
                                                            <p className="text-[10px] text-slate-400 uppercase">Sharpe</p>
                                                            <p className="text-xs font-bold text-slate-700">{alt.std_perf?.sharpe ? alt.std_perf.sharpe.toFixed(2) : '--'}</p>
                                                        </div>
                                                        <div className="bg-emerald-50/30 rounded p-1.5 text-center border border-emerald-50">
                                                            <p className="text-[10px] text-slate-400 uppercase">TER</p>
                                                            <p className="text-xs font-bold text-slate-700">{alt.std_extra?.ter ? `${alt.std_extra.ter.toFixed(2)}%` : '--'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors shadow-lg shadow-slate-900/10"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

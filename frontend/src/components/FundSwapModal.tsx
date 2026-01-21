// frontend/src/components/FundSwapModal.tsx
import React from 'react';

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

export const FundSwapModal = ({ isOpen, originalFund, alternatives, onSelect, onClose }: any) => {
    if (!isOpen || !originalFund) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full p-6 max-h-[90vh] overflow-y-auto">

                {/* Cabecera */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Alternativas de Inversión</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <span className="text-2xl">×</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* COLUMNA 1: ACTUAL (Gris) */}
                    <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 opacity-75">
                        <div className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded inline-block mb-2">
                            SELECCIÓN ACTUAL
                        </div>
                        <h3 className="font-bold text-lg mb-1 h-12 overflow-hidden">{originalFund.name}</h3>
                        <p className="text-sm text-gray-500 mb-4">{originalFund.std_extra?.company || 'Gestora desconocida'}</p>

                        <div className="bg-white p-3 rounded border mb-4">
                            <StatRow
                                label="Volatilidad"
                                value={originalFund.std_perf?.volatility !== undefined ? (originalFund.std_perf.volatility * 100).toFixed(2) : '-'}
                                isPercentage
                            />
                            <StatRow
                                label="Sharpe"
                                value={originalFund.std_perf?.sharpe !== undefined ? originalFund.std_perf.sharpe.toFixed(2) : '-'}
                            />
                            <StatRow
                                label="Coste (TER)"
                                value={originalFund.std_extra?.ter || '-'}
                                isPercentage
                            />
                        </div>

                        <button disabled className="w-full py-2 bg-gray-300 text-gray-500 rounded font-bold cursor-not-allowed">
                            Mantener
                        </button>
                    </div>

                    {/* COLUMNAS 2 y 3: ALTERNATIVAS */}
                    {alternatives.map((alt: any) => {
                        const isBetter = alt.reason.includes("Eficiente");
                        const badgeColor = isBetter ? "bg-green-100 text-green-800 border-green-200" : "bg-purple-100 text-purple-800 border-purple-200";
                        const btnColor = isBetter ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700";

                        return (
                            <div key={alt.fund.isin} className="border-2 border-blue-100 hover:border-blue-500 rounded-lg p-4 bg-white transition-all shadow-sm hover:shadow-md transform hover:-translate-y-1">
                                <div className={`border text-xs font-bold px-2 py-1 rounded inline-block mb-2 ${badgeColor}`}>
                                    {alt.reason}
                                </div>
                                <h3 className="font-bold text-lg mb-1 text-blue-900 h-12 overflow-hidden">{alt.fund.name}</h3>
                                <p className="text-sm text-gray-500 mb-4">{alt.fund.std_extra?.company || 'Gestora desconocida'}</p>

                                <div className="bg-blue-50 p-3 rounded border border-blue-100 mb-4">
                                    <StatRow
                                        label="Volatilidad"
                                        value={alt.fund.std_perf?.volatility !== undefined ? (alt.fund.std_perf.volatility * 100).toFixed(2) : '-'}
                                        isPercentage
                                    />
                                    <StatRow
                                        label="Sharpe"
                                        value={alt.fund.std_perf?.sharpe !== undefined ? alt.fund.std_perf.sharpe.toFixed(2) : '-'}
                                        delta={
                                            (alt.fund.std_perf?.sharpe !== undefined && originalFund.std_perf?.sharpe !== undefined)
                                                ? alt.fund.std_perf.sharpe - originalFund.std_perf.sharpe
                                                : undefined
                                        }
                                    />
                                    <StatRow
                                        label="Ahorro Coste"
                                        value={alt.fund.std_extra?.ter || '-'}
                                        delta={alt.deltaFee}
                                        isPercentage
                                    />
                                </div>

                                <button
                                    onClick={() => onSelect(alt.fund)}
                                    className={`w-full py-2 text-white rounded font-bold shadow ${btnColor}`}
                                >
                                    Cambiar por este fondo
                                </button>
                            </div>
                        );
                    })}
                </div>

                {alternatives.length === 0 && (
                    <div className="text-center p-10 text-gray-500 bg-gray-50 rounded">
                        No se encontraron alternativas similares compatibles.
                    </div>
                )}
            </div>
        </div>
    );
};
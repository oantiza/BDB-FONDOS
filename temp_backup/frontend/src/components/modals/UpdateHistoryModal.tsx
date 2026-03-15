import React, { useState } from 'react';
import ModalHeader from '../common/ModalHeader';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface UpdateHistoryModalProps {
    fund: any;
    onClose: () => void;
}

export default function UpdateHistoryModal({ fund, onClose }: UpdateHistoryModalProps) {
    const [mode, setMode] = useState<'merge' | 'overwrite'>('merge');
    // Default from: 10 years ago? Or 2000-01-01?
    // Let's use a sensible default like 5 years ago if merging, or 2000 if overwriting?
    // User requested "rango de fechas".
    const [fromDate, setFromDate] = useState('2015-01-01');
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleUpdate = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const functions = getFunctions(undefined, 'europe-west1');
            const updateFn = httpsCallable(functions, 'updateFundHistory');

            const response = await updateFn({
                isin: fund.isin,
                mode,
                from_date: fromDate,
                to_date: toDate
            });

            const data = response.data as any;
            if (data.success) {
                setResult(data);
            } else {
                setError(data.error || 'Error desconocido');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <ModalHeader title="Actualizar Datos Históricos" icon="🔄" onClose={onClose} />

                <div className="p-6 space-y-6">
                    {/* Fund Info */}
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Fondo Seleccionado</p>
                        <p className="text-sm font-medium text-slate-800">{fund.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-1">{fund.isin}</p>
                    </div>

                    {/* Mode Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Modo de Actualización</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setMode('merge')}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all ${mode === 'merge'
                                    ? 'bg-blue-100 border-blue-500 text-blue-800 ring-1 ring-blue-500'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                <div className="font-bold mb-1">Rellenar Faltantes</div>
                                <div className="text-[10px] opacity-80 leading-tight">Mantiene datos existentes, solo añade nuevos</div>
                            </button>

                            <button
                                onClick={() => setMode('overwrite')}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all ${mode === 'overwrite'
                                    ? 'bg-red-50 border-red-500 text-red-800 ring-1 ring-red-500'
                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                            >
                                <div className="font-bold mb-1">Sobreescribir</div>
                                <div className="text-[10px] opacity-80 leading-tight">Borra datos previos e importa nuevos</div>
                            </button>
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Desde</label>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Hasta</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Feedback Area */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
                            <span>❌</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {result && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm space-y-1">
                            <div className="font-bold flex items-center gap-2">
                                <span>✅</span>
                                <span>Actualización Completada</span>
                            </div>
                            <div className="text-xs ml-6">
                                <p>Puntos procesados: <b>{result.count}</b></p>
                                <p>Ticker usado: <span className="font-mono">{result.ticker_used}</span></p>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-sm transition-colors"
                        disabled={loading}
                    >
                        {result ? 'Cerrar' : 'Cancelar'}
                    </button>
                    {!result && (
                        <button
                            onClick={handleUpdate}
                            disabled={loading}
                            className={`px-6 py-2 rounded shadow-sm text-white font-bold text-sm tracking-wide transition-all ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md'
                                }`}
                        >
                            {loading ? 'Actualizando...' : 'Ejecutar Actualización'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

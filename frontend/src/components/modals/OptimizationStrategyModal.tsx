import React, { useState } from 'react';
import ModalHeader from '../common/ModalHeader';

interface OptimizationStrategyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProceed: (strategy: 'add_capital' | 'redistribute', extraCapital: number) => void;
    lockedCount: number;
    newCount: number;
    currentCapital: number;
}

export default function OptimizationStrategyModal({
    isOpen,
    onClose,
    onProceed,
    lockedCount,
    newCount,
    currentCapital
}: OptimizationStrategyModalProps) {
    const [strategy, setStrategy] = useState<'add_capital' | 'redistribute'>('add_capital');
    const [extraCapital, setExtraCapital] = useState<number>(0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-100">
                <ModalHeader
                    title="Estrategia de Optimización"
                    subtitle={`${lockedCount} fondos bloqueados, ${newCount} nuevos fondos`}
                    onClose={onClose}
                />

                <div className="p-8 flex flex-col gap-6">
                    <p className="text-slate-600 text-sm">
                        El sistema ha detectado fondos bloqueados (🔒) y nuevos fondos añadidos a la cartera de <strong>{currentCapital.toLocaleString('es-ES')} €</strong>.
                        ¿Cómo deseas que el optimizador matemático asigne capital a los fondos nuevos?
                    </p>

                    <div className="flex flex-col gap-4">
                        {/* Option A: Add Capital */}
                        <label
                            className={`flex flex-col border-2 rounded-xl p-4 cursor-pointer transition-all ${strategy === 'add_capital' ? 'border-[#0B2545] bg-blue-50/30' : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <input
                                    type="radio"
                                    name="strategy"
                                    value="add_capital"
                                    checked={strategy === 'add_capital'}
                                    onChange={() => setStrategy('add_capital')}
                                    className="w-4 h-4 text-[#0B2545]"
                                />
                                <span className="font-bold text-[#0B2545] text-lg">Añadir Capital (Dinero Nuevo)</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-2 ml-7">
                                Los euros invertidos actualmente en los fondos bloqueados <strong>no se alteran</strong>.
                                Necesitas aportar dinero extra a la cartera, el cual se repartirá <strong>exclusivamente</strong> entre los nuevos fondos para alcanzar el riesgo objetivo.
                            </p>

                            {strategy === 'add_capital' && (
                                <div className="ml-7 mt-4 flex items-center gap-3">
                                    <span className="text-sm font-semibold text-slate-700">Aportación Extra:</span>
                                    <div className="flex items-center border border-slate-300 rounded px-3 py-2 bg-white flex-1 max-w-[200px]">
                                        <input
                                            type="number"
                                            className="w-full bg-transparent outline-none text-right font-mono"
                                            value={extraCapital}
                                            onChange={(e) => setExtraCapital(parseFloat(e.target.value) || 0)}
                                            step={100}
                                        />
                                        <span className="ml-2 text-slate-500 font-bold text-xs uppercase tracking-widest">EUR</span>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        (Capital Total Resultante: {(currentCapital + extraCapital).toLocaleString('es-ES')} €)
                                    </span>
                                </div>
                            )}
                        </label>

                        {/* Option B: Redistribute */}
                        <label
                            className={`flex flex-col border-2 rounded-xl p-4 cursor-pointer transition-all ${strategy === 'redistribute' ? 'border-[#0B2545] bg-blue-50/30' : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <input
                                    type="radio"
                                    name="strategy"
                                    value="redistribute"
                                    checked={strategy === 'redistribute'}
                                    onChange={() => setStrategy('redistribute')}
                                    className="w-4 h-4 text-[#0B2545]"
                                />
                                <span className="font-bold text-[#0B2545] text-lg">Redistribuir Capital (Mantener Total)</span>
                            </div>
                            <p className="text-sm text-slate-500 mt-2 ml-7">
                                El Capital Total de <strong>{currentCapital.toLocaleString('es-ES')} €</strong> se mantiene.
                                El sistema venderá participaciones de los fondos actuales (reduciendo su peso) para financiar la entrada de los fondos nuevos, garantizando que <strong>los fondos bloqueados nunca se eliminen por completo</strong> de la cartera.
                            </p>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-lg text-slate-500 font-bold text-sm tracking-wide hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => onProceed(strategy, strategy === 'add_capital' ? extraCapital : 0)}
                            className="px-6 py-2.5 bg-[#0B2545] hover:bg-[#1A365D] text-white rounded-lg font-bold text-sm tracking-wide flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
                            disabled={strategy === 'add_capital' && extraCapital <= 0}
                        >
                            Continuar Optimización ➜
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

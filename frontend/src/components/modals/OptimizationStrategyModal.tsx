import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
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
                            onClick={() => setStrategy('add_capital')}
                            className={`flex flex-col border rounded-xl p-5 cursor-pointer transition-all duration-300 ${strategy === 'add_capital' ? 'border-[#0B2545] bg-[#0B2545]/[0.02] shadow-[0_2px_8px_-2px_rgba(11,37,69,0.1)] ring-1 ring-[#0B2545]/10' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white'
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${strategy === 'add_capital' ? 'border-[#0B2545]' : 'border-slate-300'}`}>
                                    {strategy === 'add_capital' && <div className="w-2.5 h-2.5 bg-[#0B2545] rounded-full" />}
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className={`font-bold text-sm uppercase tracking-wide ${strategy === 'add_capital' ? 'text-[#0B2545]' : 'text-slate-700'}`}>Aportar Dinero Nuevo</span>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        Los euros invertidos en los fondos bloqueados no se alteran. La aportación se repartirá exclusivamente entre los nuevos fondos.
                                    </p>
                                    
                                    {strategy === 'add_capital' && (
                                        <div className="mt-5 flex items-center gap-3 bg-white px-4 py-3 rounded-lg border border-slate-200/60 shadow-sm transition-all animate-in fade-in slide-in-from-top-1">
                                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">Aportación Extra:</span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    className="w-32 bg-slate-50/50 border border-slate-200 rounded-md px-3 py-2 outline-none text-right font-mono text-sm font-semibold text-[#0B2545] focus:bg-white focus:border-[#0B2545]/50 focus:ring-2 focus:ring-[#0B2545]/10 transition-all placeholder:text-slate-300"
                                                    placeholder="0"
                                                    value={extraCapital || ''}
                                                    onChange={(e) => setExtraCapital(parseFloat(e.target.value) || 0)}
                                                    step={100}
                                                />
                                                <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">EUR</span>
                                            </div>
                                            <span className="ml-auto text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                                <span className="text-slate-300">|</span>
                                                Total: <span className="text-[#0B2545] font-mono">{(currentCapital + extraCapital).toLocaleString('es-ES')} €</span>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </label>

                        {/* Option B: Redistribute */}
                        <label
                            onClick={() => setStrategy('redistribute')}
                            className={`flex flex-col border rounded-xl p-5 cursor-pointer transition-all duration-300 ${strategy === 'redistribute' ? 'border-[#0B2545] bg-[#0B2545]/[0.02] shadow-[0_2px_8px_-2px_rgba(11,37,69,0.1)] ring-1 ring-[#0B2545]/10' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white'
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${strategy === 'redistribute' ? 'border-[#0B2545]' : 'border-slate-300'}`}>
                                    {strategy === 'redistribute' && <div className="w-2.5 h-2.5 bg-[#0B2545] rounded-full" />}
                                </div>
                                <div className="flex flex-col flex-1">
                                    <span className={`font-bold text-sm uppercase tracking-wide ${strategy === 'redistribute' ? 'text-[#0B2545]' : 'text-slate-700'}`}>Redistribuir Capital</span>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        Se mantiene el capital total de <strong className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-600">{currentCapital.toLocaleString('es-ES')} €</strong>. Se venderán participaciones de los fondos actuales (reduciendo su peso) para financiar la entrada de los nuevos.
                                    </p>
                                </div>
                            </div>
                        </label>
                    </div>

                    <div className="flex justify-end items-center w-full border-t border-slate-100 pt-6 mt-3 gap-3">
                        <button
                            onClick={onClose}
                            className="text-slate-500 hover:text-slate-800 font-bold text-[11px] py-2.5 px-5 transition-colors uppercase tracking-widest mr-auto bg-slate-50 hover:bg-slate-100 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => onProceed(strategy, strategy === 'add_capital' ? extraCapital : 0)}
                            className="flex items-center justify-center gap-2 px-7 py-3 bg-[#0B2545] hover:bg-[#1E3A8A] disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed text-white rounded-lg shadow-sm hover:shadow-md transition-all border border-transparent min-w-[210px]"
                            disabled={strategy === 'add_capital' && extraCapital <= 0}
                        >
                            <span className="text-[11px] font-bold uppercase tracking-widest">Continuar</span>
                            <ArrowRight className="w-4 h-4 ml-1 opacity-90" strokeWidth={2.5}/>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

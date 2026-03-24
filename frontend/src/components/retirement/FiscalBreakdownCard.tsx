import React from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../utils/retirementUtils';
import { RetirementResults } from './types';

export function FiscalBreakdownCard({ results }: { results: RetirementResults }) {
    const { rentTaxResult } = results;
    const { 
        ingresosBrutosPrivados, 
        totalExento, 
        totalSujetoGeneral,
        totalSujetoAhorro
    } = rentTaxResult;
    
    const targetIncome = ingresosBrutosPrivados;
    const exentoPct = targetIncome > 0 ? (totalExento / targetIncome) * 100 : 0;
    const generalPct = targetIncome > 0 ? (totalSujetoGeneral / targetIncome) * 100 : 0;
    const ahorroPct = targetIncome > 0 ? (totalSujetoAhorro / targetIncome) * 100 : 0;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
            <div className="h-[36px] px-3 bg-[#F8FAFC] border-b border-slate-200/60 flex items-center z-10 shrink-0">
                <h3 className="text-[9px] font-bold text-slate-800 uppercase tracking-[0.15em] flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-500" /> Tributación Incremental
                </h3>
            </div>
            
            <div className="p-5">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
                    <div>
                        <h3 className="text-lg font-black text-[#0B2545] flex items-center gap-1.5 tracking-tight">
                            Tributación Incremental de la Renta Privada
                        </h3>
                        <p className="text-xs text-slate-500 mt-1.5">Aislamos la pensión pública para analizar qué coste fiscal extra (IRPF) genera el rescate de la EPSV y sus ahorros.</p>
                    </div>
                <div className="text-right">
                    <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">Tipo Medio Incremental</span>
                    <span className="text-xl font-black text-amber-600">{formatPercent(rentTaxResult.tipoMedioIncremental)}</span>
                </div>
            </div>

            <div className="space-y-5">
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2.5">Composición Fiscal del Rescate Privado</h4>
                    <div className="h-7 flex rounded-xl border border-slate-200 overflow-hidden text-[10px] font-bold text-white shadow-sm">
                        {exentoPct > 0 && (
                            <div style={{ width: `${exentoPct}%` }} className="bg-emerald-500 flex items-center justify-center relative group transition-all duration-300">
                                <span className="truncate px-1.5 hidden sm:block">Exento 0%</span>
                            </div>
                        )}
                        {generalPct > 0 && (
                            <div style={{ width: `${generalPct}%` }} className="bg-[#0B2545] flex items-center justify-center relative group transition-all duration-300">
                                <span className="truncate px-1.5 hidden sm:block">A Tipo General (23-49%)</span>
                            </div>
                        )}
                        {ahorroPct > 0 && (
                            <div style={{ width: `${ahorroPct}%` }} className="bg-amber-500 flex items-center justify-center relative group transition-all duration-300">
                                <span className="truncate px-1.5 hidden sm:block">Ahorro 19-27%</span>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center text-center">
                            <div className="flex items-center justify-center gap-1.5 mb-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <h5 className="font-bold text-slate-800 text-sm">Parte Exenta</h5>
                            </div>
                            <p className="text-2xl font-black text-emerald-600 mb-2">{formatCurrency(totalExento)}</p>
                            <p className="text-xs text-slate-500 leading-relaxed">Porción de la renta que no tributa (rendimientos de EPSV anteriores a 2006 rescatados en forma de capital y aportaciones sin desgravar).</p>
                        </div>
                        
                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center text-center">
                            <div className="flex items-center justify-center gap-1.5 mb-2">
                                <div className="w-2 h-2 rounded-full bg-[#0B2545]"></div>
                                <h5 className="font-bold text-slate-800 text-sm">Base General</h5>
                            </div>
                            <p className="text-2xl font-black text-[#0B2545] mb-2">{formatCurrency(totalSujetoGeneral)}</p>
                            <p className="text-xs text-slate-500 leading-relaxed">Sujeto al tipo impositivo general. Mayor coste fiscal. Se suma a la pensión pública y se grava de manera progresiva.</p>
                        </div>
                        
                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center text-center">
                            <div className="flex items-center justify-center gap-1.5 mb-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                <h5 className="font-bold text-slate-800 text-sm">Base del Ahorro</h5>
                            </div>
                            <p className="text-2xl font-black text-amber-600 mb-2">{formatCurrency(totalSujetoAhorro)}</p>
                            <p className="text-xs text-slate-500 leading-relaxed">Rendimientos netos generados. Tributan a un tipo fijo y menor del ahorro (entre el 19% y el 27%).</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex gap-2.5 text-xs text-slate-600">
                    <AlertCircle className="w-4 h-4 shrink-0 text-slate-400" />
                    <div className="font-medium space-y-1.5">
                        <p className="text-slate-800 text-[10px] uppercase tracking-widest font-bold">Aproximaciones Heurísticas Aplicadas:</p>
                        <ul className="list-disc ml-3.5 text-[10px] space-y-1 text-slate-500">
                            <li>Revalorización futura de ahorros y EPSV acotada a ratios seguros [0, 1].</li>
                            <li>En Rentas Vitalicias se asume prudencialmente un tope del {formatPercent(0.5)} de ganancia patrimonial viva imponible (Base Ahorro) para evitar falsos castigos fiscales 100% sujetos.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        </div>
    );
}

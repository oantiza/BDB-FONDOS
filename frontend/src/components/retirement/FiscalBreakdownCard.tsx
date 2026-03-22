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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-5 mb-8">
                <div>
                    <h3 className="text-2xl font-black text-[#0B2545] flex items-center gap-2 tracking-tight">
                        <Shield className="w-7 h-7 text-amber-500" /> Tributación Incremental de la Renta Privada
                    </h3>
                    <p className="text-base text-slate-500 mt-2">Aislamos la pensión pública para analizar qué coste fiscal extra (IRPF) genera el rescate de la EPSV y sus ahorros.</p>
                </div>
                <div className="text-right">
                    <span className="block text-xs uppercase text-slate-400 font-bold tracking-wider mb-1">Tipo Medio Incremental</span>
                    <span className="text-3xl font-black text-amber-600">{formatPercent(rentTaxResult.tipoMedioIncremental)}</span>
                </div>
            </div>

            <div className="space-y-8">
                <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Composición Fiscal del Rescate Privado</h4>
                    <div className="h-10 flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold text-white shadow-sm">
                        {exentoPct > 0 && (
                            <div style={{ width: `${exentoPct}%` }} className="bg-emerald-500 flex items-center justify-center relative group transition-all duration-300">
                                <span className="truncate px-2 hidden sm:block">Exento 0%</span>
                            </div>
                        )}
                        {generalPct > 0 && (
                            <div style={{ width: `${generalPct}%` }} className="bg-[#0B2545] flex items-center justify-center relative group transition-all duration-300">
                                <span className="truncate px-2 hidden sm:block">A Tipo General (23-49%)</span>
                            </div>
                        )}
                        {ahorroPct > 0 && (
                            <div style={{ width: `${ahorroPct}%` }} className="bg-amber-500 flex items-center justify-center relative group transition-all duration-300">
                                <span className="truncate px-2 hidden sm:block">Ahorro 19-27%</span>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <h5 className="font-bold text-slate-800">Parte Exenta</h5>
                            </div>
                            <p className="text-2xl font-black text-emerald-600 mb-2">{formatCurrency(totalExento)}</p>
                            <p className="text-sm text-slate-500 leading-relaxed">Porción de la renta que no tributa (rendimientos de EPSV anteriores a 2006 rescatados en forma de capital y aportaciones sin desgravar).</p>
                        </div>
                        
                        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-3 h-3 rounded-full bg-[#0B2545]"></div>
                                <h5 className="font-bold text-slate-800">Base General</h5>
                            </div>
                            <p className="text-2xl font-black text-[#0B2545] mb-2">{formatCurrency(totalSujetoGeneral)}</p>
                            <p className="text-sm text-slate-500 leading-relaxed">Sujeto al tipo impositivo general. Mayor coste fiscal. Se suma a la pensión pública y se grava de manera progresiva.</p>
                        </div>
                        
                        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                <h5 className="font-bold text-slate-800">Base del Ahorro</h5>
                            </div>
                            <p className="text-2xl font-black text-amber-600 mb-2">{formatCurrency(totalSujetoAhorro)}</p>
                            <p className="text-sm text-slate-500 leading-relaxed">Rendimientos netos generados. Tributan a un tipo fijo y menor del ahorro (entre el 19% y el 27%).</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex gap-4 text-sm text-slate-600">
                    <AlertCircle className="w-5 h-5 shrink-0 text-slate-400" />
                    <div className="font-medium space-y-2">
                        <p className="text-slate-800 text-xs uppercase tracking-widest font-bold">Aproximaciones Heurísticas Aplicadas:</p>
                        <ul className="list-disc ml-4 text-xs space-y-1.5 text-slate-500">
                            <li>Revalorización futura de ahorros y EPSV acotada a ratios seguros [0, 1].</li>
                            <li>En Rentas Vitalicias se asume prudencialmente un tope del {formatPercent(0.5)} de ganancia patrimonial viva imponible (Base Ahorro) para evitar falsos castigos fiscales 100% sujetos.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

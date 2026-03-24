import React from 'react';
import { formatCurrency } from '../../utils/retirementUtils';
import { MetricTile } from './RetirementUI';
import { RetirementResults } from './types';

export function RetirementSummaryCard({ results }: { results: RetirementResults }) {
    const { rentTaxResult } = results;
    
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 relative overflow-hidden">
            <h2 className="text-lg font-black text-[#0B2545] mb-1 tracking-tight">Renta Mensual Neta Estimada</h2>
            <p className="text-[10px] text-slate-500 mb-4 font-medium">Neto real tras aplicar IRPF (Pensión Pública Neta + Renta Privada Neta)</p>

            <div className="flex flex-col md:flex-row md:items-end gap-2.5 mb-4">
                <div>
                    <span className="text-3xl font-black text-[#0B2545] tracking-tighter">
                        {formatCurrency(rentTaxResult.netoConsolidadoMensual)}
                    </span>
                    <span className="text-slate-500 font-medium ml-2 text-xs">/ mes netos reales</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
                <MetricTile 
                    label="Pensión Pública Neta" 
                    value={`${formatCurrency(rentTaxResult.netoConsolidadoMensual - rentTaxResult.netoPrivadoMensual)}`} 
                    colorClass="text-[#0B2545]"
                    bgColor="bg-slate-50"
                />
                <MetricTile 
                    label="Renta Privada Bruta" 
                    value={`${formatCurrency(rentTaxResult.ingresosBrutosPrivados / 12)}`} 
                    colorClass="text-[#0B2545]"
                    bgColor="bg-slate-50"
                />
                <MetricTile 
                    label="Coste Fiscal Privado" 
                    value={`-${formatCurrency(rentTaxResult.totalImpuestosPrivados / 12)}`} 
                    subtext="IRPF Incremental"
                    colorClass="text-amber-600"
                    bgColor="bg-amber-50/50"
                    borderColor="border-amber-100"
                />
                <MetricTile 
                    label="Renta Privada Neta" 
                    value={`${formatCurrency(rentTaxResult.netoPrivadoMensual)}`} 
                    colorClass="text-emerald-600"
                    bgColor="bg-emerald-50/50"
                    borderColor="border-emerald-200"
                />
            </div>
            
            <div className="bg-[#0B2545]/5 p-3.5 rounded-xl border border-[#0B2545]/10 mt-3 md:mt-0 text-xs md:text-sm text-slate-700 leading-relaxed">
                <p>
                    Para alcanzar su renta neta objetivo de <strong>{formatCurrency(rentTaxResult.netoConsolidadoMensual)} mensuales</strong>, sus fuentes de ingresos se organizan de la siguiente manera: a su pensión pública estimada de <strong>{formatCurrency(rentTaxResult.netoConsolidadoMensual - rentTaxResult.netoPrivadoMensual)}</strong> se le sumará una ganancia privada bruta de <strong>{formatCurrency(rentTaxResult.ingresosBrutosPrivados / 12)}</strong>. Tras reservar <strong>{formatCurrency(rentTaxResult.totalImpuestosPrivados / 12)}</strong> para el pago estimado de IRPF, el importe privado exacto que llegará a su cuenta será de <strong>{formatCurrency(rentTaxResult.netoPrivadoMensual)}</strong> al mes.
                </p>
                {results.years < 99 && (
                    <p className="mt-1.5 text-[10px] text-slate-500">
                        * Este escenario asume que la renta privada complementaria se mantiene estable durante <strong>{results.years}</strong> años de jubilación.
                    </p>
                )}
            </div>
        </div>
    );
}

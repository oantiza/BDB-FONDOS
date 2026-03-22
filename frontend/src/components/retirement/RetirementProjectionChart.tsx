import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts';
import { calculateRentTaxes, calculateBizkaiaTaxBaseGeneral } from '../../utils/retirementUtils';
import { RetirementResults } from './types';

// Hipótesis del modelo: La pensión pública se revaloriza un 2% anual a efectos de proyección.
const PENSION_ANNUAL_GROWTH_RATE = 1.02;

export function RetirementProjectionChart({ results, pensionPublicaAnual }: { results: RetirementResults, pensionPublicaAnual: number }) {
    const chartData = useMemo(() => {
        if (!results || !results.rentTaxResult) return [];
        
        const yearsToProject = Math.max(1, Math.min(results.years || 1, 30));
        
        return Array.from({ length: yearsToProject }, (_, i) => i + 1).map(year => {
            const growthFactor = Math.pow(1 + (results.growth || 0), year - 1);
            const pensionGrowth = Math.pow(PENSION_ANNUAL_GROWTH_RATE, year - 1);

            const r_actual = (
                (results.rentTaxResult.rentaAnualEPSV || 0) + 
                (results.rentTaxResult.rentaAnualAhorros || 0)
            ) * growthFactor;
            
            const p_actual = (pensionPublicaAnual || 0) * pensionGrowth;

            let ratioBenefAhorros = 0;
            if (results.rentTaxResult.rentaAnualAhorros > 0) {
                ratioBenefAhorros = results.rentTaxResult.plusvaliaSujetaAhorros / results.rentTaxResult.rentaAnualAhorros;
            }
            ratioBenefAhorros = Math.max(0, Math.min(1, ratioBenefAhorros || 0));

            const ratioEpsvEnRenta = Math.max(0, Math.min(1, results.ratioEpsvEnRenta || 0));
            const ratioExento = Math.max(0, Math.min(1, results.ratioExento || 0));

            const taxYear = calculateRentTaxes({
                rentaPrivadaAnual: r_actual,
                pensionPublicaAnual: p_actual,
                ratioEpsvEnRenta: ratioEpsvEnRenta,
                ratioExentoEPSV: ratioExento,
                ratioBeneficioAhorros: ratioBenefAhorros
            });
            
            const cuotaSoloPension = calculateBizkaiaTaxBaseGeneral(p_actual);
            const netoPension = p_actual - cuotaSoloPension;
            const netoPrivado = taxYear.netoPrivadoAnual || 0;

            return {
                year: `Año ${year}`,
                pension: Math.round(Math.max(0, netoPension) / 12),
                privado: Math.round(Math.max(0, netoPrivado) / 12),
                total: Math.round((Math.max(0, netoPension) + Math.max(0, netoPrivado)) / 12)
            };
        });
    }, [results, pensionPublicaAnual]);

    if (!chartData || chartData.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 h-[450px] flex flex-col justify-center items-center mt-8">
                <p className="text-slate-500 font-medium">No hay datos suficientes para proyectar la renta.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 h-[550px] flex flex-col mt-8">
            <div className="mb-8">
                <h3 className="text-2xl font-black text-[#0B2545] tracking-tight mb-2">Evolución de Renta Neta Mensual Estimada</h3>
                <p className="text-sm text-slate-500 font-medium tracking-wide">
                    * Hipótesis: Pensión revalorizada al {Math.round((PENSION_ANNUAL_GROWTH_RATE - 1) * 100)}% anual
                </p>
            </div>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }} dy={12} />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => `${val.toLocaleString()} €`}
                            tick={{ fontSize: 13, fill: '#64748b', fontWeight: 500 }}
                            dx={-10}
                        />
                        <Tooltip
                            formatter={(value: number) => [`${value.toLocaleString()} €`, '']}
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            labelStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '15px', marginBottom: '8px' }}
                            itemStyle={{ fontSize: '14px', paddingTop: '4px' }}
                            cursor={{ fill: '#f8fafc' }}
                        />
                        <Legend verticalAlign="top" height={44} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 600, color: '#475569' }} />
                        <Bar 
                            dataKey="pension" 
                            stackId="a" 
                            name="Pensión Estatal Neta" 
                            fill="#94a3b8" 
                            radius={[0, 0, 0, 0]} 
                        />
                        <Bar 
                            dataKey="privado" 
                            stackId="a" 
                            name="Renta Privada Neta" 
                            fill="#0B2545" 
                            radius={[4, 4, 0, 0]} 
                        />
                        <ReferenceLine y={chartData[0]?.total} stroke="#cbd5e1" strokeDasharray="3 3" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

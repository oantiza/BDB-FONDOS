import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { calculateRentTaxes, calculateBizkaiaTaxBaseGeneral } from '../../utils/retirementUtils';
import type { RetirementResults } from './types';

const PENSION_ANNUAL_GROWTH_RATE = 1.02;

export function RetirementProjectionChart({ results, pensionPublicaAnual }: { results: RetirementResults, pensionPublicaAnual: number }) {
    const chartData = useMemo(() => {
        if (!results || !results.rentTaxResult) return [];
        const yearsToProject = Math.max(1, Math.min(results.years || 1, 30));
        return Array.from({ length: yearsToProject }, (_, i) => i + 1).map(year => {
            const growthFactor = Math.pow(1 + (results.growth || 0), year - 1);
            const pensionGrowth = Math.pow(PENSION_ANNUAL_GROWTH_RATE, year - 1);
            const r_actual = ((results.rentTaxResult.rentaAnualEPSV || 0) + (results.rentTaxResult.rentaAnualAhorros || 0)) * growthFactor;
            const p_actual = (pensionPublicaAnual || 0) * pensionGrowth;
            let ratioBenefAhorros = 0;
            if (results.rentTaxResult.rentaAnualAhorros > 0) {
                ratioBenefAhorros = results.rentTaxResult.plusvaliaSujetaAhorros / results.rentTaxResult.rentaAnualAhorros;
            }
            ratioBenefAhorros = Math.max(0, Math.min(1, ratioBenefAhorros || 0));
            const taxYear = calculateRentTaxes({
                rentaPrivadaAnual: r_actual,
                pensionPublicaAnual: p_actual,
                ratioEpsvEnRenta: Math.max(0, Math.min(1, results.ratioEpsvEnRenta || 0)),
                ratioRentabilidadEpsvPre: results.ratioRentabilidadEpsvPre || 0,
                ratioRentabilidadEpsvPost: results.ratioRentabilidadEpsvPost || 0,
                isRentabilidadEPSVExenta: results.isRentabilidadEPSVExenta || false,
                ratioBeneficioAhorros: ratioBenefAhorros
            });
            const netoPension = p_actual - calculateBizkaiaTaxBaseGeneral(p_actual);
            const netoPrivado = taxYear.netoPrivadoAnual || 0;
            return {
                year: `Año ${year}`,
                pension: Math.round(Math.max(0, netoPension) / 12),
                privado: Math.round(Math.max(0, netoPrivado) / 12),
                total: Math.round((Math.max(0, netoPension) + Math.max(0, netoPrivado)) / 12)
            };
        });
    }, [results, pensionPublicaAnual]);

    if (!chartData || chartData.length === 0) return null;

    return (
        <div className="bg-white/40 backdrop-blur-[12px] rounded-[16px] shadow-xl border border-white/50 overflow-hidden flex flex-col mt-4 z-10">
            <div className="p-8 border-b border-white/30 flex items-center justify-between bg-white/20">
                <div>
                    <h3 className="text-[22px] font-black text-[#0D1B2A] drop-shadow-sm leading-tight mb-1">Así podría evolucionar tu capital</h3>
                    <p className="text-[14px] text-[#0D1B2A]/70 font-semibold leading-tight drop-shadow-sm">Proyección del comportamiento de tu renta frente al consumo a lo largo de los años.</p>
                </div>
                <div className="flex items-center gap-4 text-sm font-semibold text-[#0D1B2A] drop-shadow-sm">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#E67E5F] shadow-inner border border-white/40"></div> Privado</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#0F2A44] shadow-inner border border-white/40"></div> Público</div>
                </div>
            </div>
            <div className="p-8 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.4)" />
                        <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#0D1B2A', fontWeight: 600 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val.toLocaleString()} €`} tick={{ fontSize: 13, fill: '#0D1B2A', fontWeight: 600 }} dx={-10} />
                        <Tooltip
                            formatter={(value: any) => [`${Number(value).toLocaleString()} €`, '']}
                            contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', boxShadow: '0 20px 25px -5px rgb(15 42 68 / 0.1)' }}
                            labelStyle={{ color: '#0D1B2A', fontWeight: 'bold', fontSize: '15px', marginBottom: '8px' }}
                            itemStyle={{ fontSize: '14px', fontWeight: 'bold', color: '#E67E5F' }}
                            cursor={{ fill: 'rgba(255,255,255,0.3)' }}
                        />
                        <Bar dataKey="pension" stackId="a" fill="#0F2A44" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="privado" stackId="a" fill="#E67E5F" radius={[8, 8, 0, 0]} />
                        <ReferenceLine y={chartData[0]?.total} stroke="#E6EAF1" strokeDasharray="5 5" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

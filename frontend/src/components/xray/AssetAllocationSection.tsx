import React from 'react';
import DiversificationDonut from '../charts/DiversificationDonut';
import DiversificationBars from '../charts/DiversificationBars';

interface AssetAllocationSectionProps {
    globalAllocation: {
        equity: number;
        bond: number;
        cash: number;
        other: number;
        coverage: number;
    };
    categoryAllocation: { name: string; value: number; color?: string }[];
}

export default function AssetAllocationSection({ globalAllocation, categoryAllocation }: AssetAllocationSectionProps) {
    return (
        <div className="pt-20 border-t border-[#eeeeee] flex items-start justify-between">
            {/* LEFT: Global Composition */}
            <div className="w-[50%] flex flex-col items-center justify-start">
                <div className="flex items-center gap-4 mb-4 justify-center shrink-0">
                    <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Composición Global</h3>
                    <span className="text-[#A07147] text-[10px] uppercase tracking-[0.2em] font-bold">Por Activo Subyacente</span>
                </div>
                <div className="w-full flex flex-col items-center justify-center">
                    {/* FIXED SIZE CONTAINER */}
                    <div className="h-[420px] w-[420px] shrink-0 mb-8 relative">
                        <DiversificationDonut assets={[
                            { name: 'Renta Variable', value: globalAllocation.equity },
                            { name: 'Renta Fija', value: globalAllocation.bond },
                            { name: 'Efectivo', value: globalAllocation.cash },
                            { name: 'Otros', value: globalAllocation.other }
                        ].filter(x => x.value > 0.1)} />
                    </div>

                    {/* Coverage Stats */}
                    {globalAllocation.coverage < 80 && (
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg max-w-xs mb-8">
                            <div className="text-amber-800 text-xs font-bold uppercase mb-1">⚠️ Calidad del Dato</div>
                            <p className="text-amber-700 text-xs leading-relaxed">
                                Solo el <b>{globalAllocation.coverage.toFixed(0)}%</b> de la cartera tiene datos detallados de composición interna. El resto se ha estimado por categoría.
                            </p>
                        </div>
                    )}

                    <div className="hidden"></div>
                </div>
            </div>

            {/* RIGHT: Diversification Bars */}
            <div className="w-[50%] flex flex-col items-center justify-start">
                <div className="flex items-center gap-4 mb-4 justify-center shrink-0">
                    <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Diversificación</h3>
                    <span className="text-[#A07147] text-[10px] uppercase tracking-[0.2em] font-bold">Por Categoría / Tipo</span>
                </div>
                <div className="hidden"></div>
                <div className="mt-8 w-full max-w-[550px]">
                    <DiversificationBars assets={categoryAllocation} />
                </div>
            </div>
        </div>
    );
}

import React from 'react';
import GlobalAllocationChart from '../charts/GlobalAllocationChart';
import EquityRegionChart from '../charts/EquityRegionChart';

interface AssetAllocationSectionProps {
    globalAllocation: {
        equity: number;
        bond: number;
        cash: number;
        other: number;
        coverage: number;
    };
    categoryAllocation?: { name: string; value: number }[];
    equityRegionAllocation: { name: string; value: number; absoluteValue?: number }[];
}

export default function AssetAllocationSection({ globalAllocation, categoryAllocation = [], equityRegionAllocation }: AssetAllocationSectionProps) {

    // Preparar datos para el gráfico de barras global
    const globalData = categoryAllocation && categoryAllocation.length > 0
        ? categoryAllocation.slice(0, 5).concat(
            categoryAllocation.length > 5
                ? [{ name: 'Otros', value: categoryAllocation.slice(5).reduce((acc, curr) => acc + curr.value, 0) }]
                : []
        )
        : [
            { name: 'Renta Variable', value: globalAllocation.equity },
            { name: 'Renta Fija', value: globalAllocation.bond },
            { name: 'Efectivo', value: globalAllocation.cash },
            { name: 'Otros', value: globalAllocation.other }
        ].filter(x => x.value > 0.01);

    return (
        <div className="pt-20 border-t border-[#eeeeee] flex items-start justify-between">
            {/* LEFT: Global Composition (Now Bar Chart) */}
            <div className="w-[50%] flex flex-col items-center justify-start pr-8 border-r border-slate-100">
                <div className="flex items-center gap-4 mb-4 justify-center shrink-0">
                    <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Composición Global</h3>
                    <span className="text-[#A07147] text-[10px] uppercase tracking-[0.2em] font-bold">Por Activo Subyacente</span>
                </div>
                <div className="w-full flex flex-col items-center justify-center">
                    {/* BAR CHART DISPLAY */}
                    <div className="w-full max-w-[550px] mb-8 mt-6">
                        <GlobalAllocationChart data={globalData.map(d => d.name === 'Otros' ? { ...d, name: 'Otras Categorías' } : d)} />
                    </div>

                    {/* NEW: Asset Class Summary (3 Categories) */}
                    <div className="w-full max-w-[500px] mt-2 mb-8 border-t border-slate-100 pt-6">
                        <h4 className="text-center text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4">Resumen de Activos</h4>
                        <div className="grid grid-cols-3 gap-2">
                            {/* 1. Renta Variable */}
                            <div className="flex flex-col items-center p-2 rounded bg-blue-50/50 border border-blue-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Renta Var.</span>
                                <span className="text-lg font-medium text-[#003399]">
                                    {globalAllocation.equity.toFixed(1)}%
                                </span>
                            </div>

                            {/* 2. Renta Fija */}
                            <div className="flex flex-col items-center p-2 rounded bg-slate-50 border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Renta Fija</span>
                                <span className="text-lg font-medium text-[#003399]">
                                    {globalAllocation.bond.toFixed(1)}%
                                </span>
                            </div>

                            {/* 3. Otros y Liquidez */}
                            <div className="flex flex-col items-center p-2 rounded bg-amber-50/30 border border-amber-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Otros y Liquidez</span>
                                <span className="text-lg font-medium text-[#A07147]">
                                    {(globalAllocation.cash + globalAllocation.other).toFixed(1)}%
                                </span>
                            </div>
                        </div>
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

            {/* RIGHT: Diversification Bars (Equity Regions) */}
            <div className="w-[50%] flex flex-col items-center justify-start pl-8">
                <div className="flex items-center gap-4 mb-4 justify-center shrink-0">
                    <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Diversificación (RV)</h3>
                    <span className="text-[#A07147] text-[10px] uppercase tracking-[0.2em] font-bold">Por Geografía</span>
                </div>
                <div className="hidden"></div>
                <div className="mt-8 w-full max-w-[550px]">
                    <EquityRegionChart data={equityRegionAllocation} />
                </div>
            </div>
        </div>
    );
}

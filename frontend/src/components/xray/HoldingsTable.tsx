import React from 'react';
import { PortfolioItem } from '../../types';

interface HoldingsTableProps {
    portfolio: PortfolioItem[];
    totalCapital: number;
    getVolatilitySafe: (fund: any) => string;
}

export default function HoldingsTable({ portfolio, totalCapital, getVolatilitySafe }: HoldingsTableProps) {
    return (
        <div className="bg-white p-8">
            <div className="mb-6 flex justify-between items-end">
                <h1 className="text-[#2C3E50] text-3xl font-light tracking-tight">Composición de la Cartera</h1>
            </div>
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-black h-10">
                        <th className="py-2 pl-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold w-[40%]">Fondo / Estrategia</th>
                        <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Peso</th>
                        <th className="py-2 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">Capital</th>
                        <th className="py-2 pr-4 text-[#A07147] text-base uppercase tracking-[0.2em] font-bold text-right">RIESGO</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(
                        [...portfolio].reduce((acc, fund) => {
                            const category = fund.std_extra?.category || fund.std_type || 'SIN CLASIFICAR';
                            if (!acc[category]) acc[category] = [];
                            acc[category].push(fund);
                            return acc;
                        }, {} as Record<string, PortfolioItem[]>)
                    ).sort((a, b) => a[0].localeCompare(b[0])).map(([category, funds]) => (
                        <React.Fragment key={category}>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <td colSpan={4} className="py-2 pl-4 text-[#2C3E50] text-xs font-bold uppercase tracking-widest pt-4">
                                    {category}
                                </td>
                            </tr>
                            {funds.sort((a, b) => b.weight - a.weight).map(fund => (
                                <tr key={fund.isin} className="last:border-0 hover:bg-[#fcfcfc] transition-colors group">
                                    <td className="pr-8 pl-4 py-3 align-top">
                                        <div className="text-[#2C3E50] font-[450] text-base leading-tight mb-1">
                                            {fund.name}
                                        </div>
                                    </td>
                                    <td className="align-top text-right text-[#2C3E50] font-[450] text-base tabular-nums py-3">
                                        {fund.weight.toFixed(2)}%
                                    </td>
                                    <td className="align-top text-right text-[#2C3E50] font-[450] text-base tabular-nums py-3">
                                        {((fund.weight / 100) * totalCapital).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                    <td className="align-top text-right pr-4 text-[#2C3E50] font-[450] text-sm tabular-nums py-3">
                                        {getVolatilitySafe(fund)}
                                    </td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                    <tr className="border-t border-black">
                        <td className="py-6 pl-4 text-xl font-[550] text-[#2C3E50] tracking-tight">TOTAL CARTERA</td>
                        <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">100.00%</td>
                        <td className="py-6 text-right font-[550] text-[#2C3E50] text-xl tabular-nums">
                            {totalCapital.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td className="py-6 pr-4"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

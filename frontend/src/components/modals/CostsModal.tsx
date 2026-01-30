import React, { useState } from 'react'
import ModalHeader from '../common/ModalHeader'
import MetricCard from '../common/MetricCard'

interface CostsModalProps {
    portfolio: any[];
    totalCapital?: number;
    onClose: () => void;
}

export default function CostsModal({ portfolio, totalCapital = 100000, onClose }: CostsModalProps) {
    const [margin, setMargin] = useState(1.0) // Coeficiente de margen

    // Cálculo agregado
    let totalRetroEUR = 0
    let totalWeight = 0

    const costRows = portfolio.map(asset => {
        const weight = asset.weight || 0
        if (weight <= 0) return null

        // Sin TER, solo retrocesiones
        // Read retrocession from decimal (0.0122 -> 1.22%)
        // Priority: manual.costs.retrocession (DB canonical) -> costs.retrocession (legacy/flat) -> retrocession (flat)
        const rawRetro = asset.manual?.costs?.retrocession ?? asset.costs?.retrocession ?? asset.retrocession ?? asset.costs?.retrocesion;
        const baseRetroPercent = (rawRetro !== undefined && rawRetro !== null)
            ? (rawRetro > 0.1 ? rawRetro : rawRetro * 100)
            : 0.60; // Fallback 0.60%
        const finalRetroPercent = baseRetroPercent * margin

        // Impacto en Euros: (% Final / 100) * (Peso / 100 * CapitalTotal)
        const capitalAllocated = (weight / 100) * totalCapital
        const retroEUR = (finalRetroPercent / 100) * capitalAllocated

        totalRetroEUR += retroEUR
        totalWeight += weight

        return {
            name: asset.name,
            isin: asset.isin,
            weight,
            baseRetroPercent,
            finalRetroPercent,
            retroEUR
        }
    }).filter(r => r !== null)

    const avgFinalRetroPercent = totalCapital > 0 ? (totalRetroEUR / totalCapital) * 100 : 0

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                <ModalHeader
                    title="Análisis de Retrocesiones"
                    icon="⚖️"
                    onClose={onClose}
                />

                <div className="p-8 overflow-y-auto custom-scrollbar bg-white">

                    {/* Controls & Summary */}
                    <div className="grid grid-cols-12 gap-8 mb-8">
                        {/* Input Control */}
                        <div className="col-span-4 bg-white p-6 rounded border border-[#eeeeee] flex flex-col justify-center shadow-sm">
                            <label className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-2 block">Coeficiente de Margen</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    value={margin}
                                    onChange={(e) => setMargin(parseFloat(e.target.value) || 0)}
                                    className="w-full text-2xl font-light text-[#2C3E50] border-b border-[#A07147] outline-none pb-1"
                                />
                                <span className="text-xs font-bold text-[#2C3E50]">x Base</span>
                            </div>
                        </div>

                        {/* Summary Metrics */}
                        <div className="col-span-8 grid grid-cols-2 gap-4">
                            <MetricCard
                                label="Ingreso Anual Estimado"
                                value={totalRetroEUR.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            />
                            <MetricCard
                                label="Retrocesión Media"
                                value={avgFinalRetroPercent.toFixed(2) + '%'}
                            />
                        </div>
                    </div>

                    {/* Logic Explanation */}
                    <div className="mb-8 p-4 bg-[#fcfcfc] border-l-2 border-[#003399] text-xs text-[#2C3E50] flex gap-3 items-start italic">
                        <span className="text-lg not-italic">💡</span>
                        <span className="leading-relaxed">
                            <b>Cálculo de Impacto:</b> Se aplica el margen seleccionado sobre la retrocesión base de cada fondo.
                            El importe monetario (€) se deriva del capital total asignado.
                        </span>
                    </div>

                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#eeeeee]">
                                <th className="py-3 font-bold text-[#A07147] uppercase tracking-[0.1em] text-[10px]">Fondo / Activo</th>
                                <th className="py-3 text-right font-bold text-[#A07147] uppercase tracking-[0.1em] text-[10px]">Peso</th>
                                <th className="py-3 text-right font-bold text-[#A07147] uppercase tracking-[0.1em] text-[10px]">Capital</th>
                                <th className="py-3 text-right font-bold text-[#A07147] uppercase tracking-[0.1em] text-[10px]">Base</th>
                                <th className="py-3 text-right font-bold text-[#A07147] uppercase tracking-[0.1em] text-[10px] bg-slate-50/50">Margen</th>
                                <th className="py-3 text-right font-bold text-[#2C3E50] uppercase tracking-[0.1em] text-[10px]">Retro. Final</th>
                                <th className="py-3 text-right font-bold text-[#2C3E50] uppercase tracking-[0.1em] text-[10px]">Ingreso (€)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f5f5f5]">
                            {costRows.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center italic text-slate-400">No hay activos en cartera</td></tr>
                            ) : costRows.map(row => (
                                <tr key={row.isin} className="hover:bg-[#fcfcfc] group transition-colors">
                                    <td className="py-3">
                                        <div className="font-bold text-[#2C3E50] truncate max-w-[220px]" title={row.name}>{row.name}</div>
                                        <div className="text-[10px] text-slate-400 font-mono tracking-wider">{row.isin}</div>
                                    </td>
                                    <td className="py-3 text-right font-light text-[#2C3E50] tabular-nums">{row.weight.toFixed(2)}%</td>
                                    <td className="py-3 text-right font-light text-[#7f8c8d] tabular-nums">
                                        {((row.weight / 100) * totalCapital).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                                    </td>
                                    <td className="py-3 text-right font-light text-slate-500 tabular-nums">{row.baseRetroPercent.toFixed(2)}%</td>
                                    <td className="py-3 text-right font-bold text-[#2C3E50] bg-slate-50/50 tabular-nums">x{margin}</td>
                                    <td className="py-3 text-right font-bold text-[#2C3E50] tabular-nums">
                                        {row.finalRetroPercent.toFixed(2)}%
                                    </td>
                                    <td className="py-3 text-right font-bold text-[#003399] tabular-nums">
                                        {row.retroEUR.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-[#2C3E50]">
                            <tr>
                                <td className="py-4 font-bold text-[#2C3E50] text-lg tracking-tight">TOTAL</td>
                                <td className="py-4 text-right font-bold text-[#2C3E50]">{totalWeight.toFixed(2)}%</td>
                                <td className="py-4 text-right font-bold text-[#2C3E50]">{totalCapital.toLocaleString('es-ES')} €</td>
                                <td className="py-4 text-right" colSpan={2}></td>
                                <td className="py-4 text-right font-bold text-[#2C3E50] text-lg">{avgFinalRetroPercent.toFixed(2)}%</td>
                                <td className="py-4 text-right font-bold text-[#003399] text-lg">
                                    {totalRetroEUR.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-[#eeeeee] flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[#f5f5f5] hover:bg-[#e0e0e0] text-[#2C3E50] font-bold text-xs uppercase tracking-[0.1em] transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}

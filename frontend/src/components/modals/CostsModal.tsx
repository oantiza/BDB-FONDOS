import React, { useState } from 'react'

export default function CostsModal({ portfolio, totalCapital = 100000, onClose }) {
    const [margin, setMargin] = useState(1.0) // Coeficiente de margen

    // Cálculo agregado
    let totalRetroEUR = 0
    let totalWeight = 0

    const costRows = portfolio.map(asset => {
        const weight = asset.weight || 0
        if (weight <= 0) return null

        // Sin TER, solo retrocesiones
        const baseRetroPercent = asset.costs?.retrocession || 0.60 // Fallback realista 0.60%
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

    // Proyección a N años (Simple)
    const project5y = totalRetroEUR * 5

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="p-2 border-b flex justify-between items-center bg-slate-50 shrink-0">
                    <h2 className="text-xs font-bold text-brand flex items-center gap-2 uppercase tracking-wider">
                        ⚖️ Análisis de Retrocesiones
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto scrollbar-thin">

                    {/* Controls & Summary */}
                    <div className="grid grid-cols-12 gap-6 mb-8">
                        {/* Input Control */}
                        <div className="col-span-4 bg-slate-50 p-4 rounded border border-slate-200 flex flex-col justify-center">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Coeficiente de Margen</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    step="0.05"
                                    min="0"
                                    value={margin}
                                    onChange={(e) => setMargin(parseFloat(e.target.value) || 0)}
                                    className="w-24 text-xl font-mono font-bold text-brand bg-white border border-slate-300 rounded px-2 py-1 outline-none focus:border-accent"
                                />
                                <span className="text-xs text-slate-400">x Base Ret.</span>
                            </div>
                        </div>

                        {/* Summary Metrics */}
                        <div className="col-span-8 grid grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-brand to-slate-800 text-white p-4 rounded shadow-md relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="text-xs font-bold opacity-70 uppercase mb-1">Ingreso Anual Estimado</div>
                                    <div className="text-3xl font-mono font-bold text-accent">
                                        {totalRetroEUR.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </div>
                                    <div className="text-[10px] opacity-70 mt-1">Retrocesión Final Acumulada</div>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded border border-slate-200 shadow-sm flex flex-col justify-center">
                                <div className="text-xs font-bold text-slate-500 uppercase mb-1">Retrocesión Media (%)</div>
                                <div className="text-3xl font-mono font-bold text-emerald-600">
                                    {avgFinalRetroPercent.toFixed(2)}%
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1">Sobre Capital Total</div>
                            </div>
                        </div>
                    </div>

                    {/* Logic Explanation */}
                    <div className="mb-4 bg-blue-50 text-blue-800 px-4 py-2 rounded text-[10px] border border-blue-100 flex gap-2 items-center">
                        <span className="text-lg">💡</span>
                        <span>
                            <b>Cálculo:</b> (Retrocesión Base × Margen) = Retrocesión Final %.
                            El importe (€) se calcula sobre el capital asignado a cada fondo.
                        </span>
                    </div>

                    <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-50 font-serif font-bold text-slate-600 border-y border-slate-200">
                            <tr>
                                <th className="p-3">Fondo / Activo</th>
                                <th className="p-3 text-right">Peso</th>
                                <th className="p-3 text-right">Capital (€)</th>
                                <th className="p-3 text-right bg-slate-100/50">Retro. Base</th>
                                <th className="p-3 text-right bg-slate-100/50">Margen</th>
                                <th className="p-3 text-right font-bold text-slate-800">Retro. Final %</th>
                                <th className="p-3 text-right font-bold text-emerald-700">Ingreso Anual (€)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {costRows.length === 0 ? (
                                <tr><td colSpan="7" className="p-4 text-center italic text-slate-400">No hay activos en cartera</td></tr>
                            ) : costRows.map(row => (
                                <tr key={row.isin} className="hover:bg-slate-50 group transition-colors">
                                    <td className="p-3">
                                        <div className="font-bold text-brand truncate max-w-[220px]" title={row.name}>{row.name}</div>
                                        <div className="text-[9px] text-slate-400 font-mono">{row.isin}</div>
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-600">{row.weight.toFixed(2)}%</td>
                                    <td className="p-3 text-right font-mono text-slate-400">
                                        {((row.weight / 100) * totalCapital).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                                    </td>
                                    <td className="p-3 text-right font-mono text-slate-500 bg-slate-50/50">{row.baseRetroPercent.toFixed(2)}%</td>
                                    <td className="p-3 text-right font-mono text-slate-400 bg-slate-50/50">x{margin}</td>
                                    <td className="p-3 text-right font-mono font-bold text-brand bg-brand/5">
                                        {row.finalRetroPercent.toFixed(2)}%
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-emerald-600 bg-emerald-50/30">
                                        {row.retroEUR.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-700">
                            <tr>
                                <td className="p-3">TOTAL</td>
                                <td className="p-3 text-right">{totalWeight.toFixed(2)}%</td>
                                <td className="p-3 text-right">{totalCapital.toLocaleString('es-ES')} €</td>
                                <td className="p-3 text-right" colSpan="2"></td>
                                <td className="p-3 text-right">{avgFinalRetroPercent.toFixed(2)}%</td>
                                <td className="p-3 text-right text-emerald-700 font-black text-sm">
                                    {totalRetroEUR.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    )
}

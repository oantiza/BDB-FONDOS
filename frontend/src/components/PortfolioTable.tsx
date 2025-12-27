export default function PortfolioTable({
    assets = [],
    totalCapital = 0,
    onRemove,
    onUpdateWeight,
    onFundClick,
    onSwap // <--- NUEVA PROPIEDAD
}) {
    if (assets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm italic p-6">
                <span className="text-2xl mb-2 opacity-50">📉</span>
                Cartera vacía. Añade fondos desde el panel izquierdo.
            </div>
        )
    }

    return (
        <div className="overflow-x-auto overflow-y-auto max-h-full h-full custom-scrollbar">
            <table className="w-full text-left text-sm text-slate-600">
                <tbody className="divide-y divide-slate-100">
                    {assets.map((asset) => {
                        const val = (totalCapital * (asset.weight / 100))

                        // Detectar si el fondo fue elegido manualmente
                        const isManual = asset.manualSwap;

                        return (
                            <tr
                                key={asset.isin}
                                // Si es manual, le damos un fondo azul muy suave para destacarlo
                                className={`border-b border-slate-50 hover:bg-slate-50 group transition-colors cursor-pointer ${isManual ? 'bg-blue-50/40' : ''}`}
                                onClick={() => onFundClick && onFundClick(asset)}
                            >
                                <td className="p-3 truncate max-w-[180px] font-bold text-slate-700 text-sm" title={asset.name}>
                                    {/* Candado indicador de selección manual */}
                                    {isManual && <span className="mr-1 text-xs" title="Fondo seleccionado manualmente (Protegido)">🔒</span>}
                                    {asset.name}
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <input
                                            type="number"
                                            className="w-12 text-right bg-transparent outline-none font-bold text-blue-600 text-sm border-b border-blue-100 hover:border-blue-400 focus:border-[var(--color-accent)] transition-colors"
                                            value={Math.round(asset.weight * 100) / 100}
                                            step="0.01"
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => onUpdateWeight && onUpdateWeight(asset.isin, e.target.value)}
                                        />
                                        <span className="text-blue-400 font-bold text-sm">%</span>
                                    </div>
                                </td>
                                <td className="p-3 text-right font-mono text-slate-600 font-bold text-sm">
                                    {val.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 })}
                                </td>

                                {/* --- NUEVA COLUMNA SWAP --- */}
                                <td className="p-3 text-right">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onSwap && onSwap(asset); }}
                                        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold hover:underline bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200 transition-colors flex items-center gap-1 ml-auto"
                                        title="Buscar alternativas de inversión"
                                    >
                                        ⇄ Cambiar
                                    </button>
                                </td>
                                <td className="p-3 text-right">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRemove && onRemove(asset.isin); }}
                                        className="text-slate-300 hover:text-red-500 transition-colors px-2 py-0.5 text-xs border border-slate-200 hover:border-red-200 rounded"
                                        title="Eliminar"
                                    >
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
                <tfoot className="border-t border-slate-200 font-bold bg-slate-50">
                    <tr>
                        <td className="p-3 text-slate-500 uppercase text-xs font-bold text-right">TOTAL</td>
                        <td className="p-3 text-right text-slate-800 text-sm">
                            {assets.reduce((sum, a) => sum + (parseFloat(a.weight) || 0), 0).toFixed(2)}%
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-600 text-sm">
                            {assets.reduce((sum, a) => sum + (totalCapital * ((parseFloat(a.weight) || 0) / 100)), 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}
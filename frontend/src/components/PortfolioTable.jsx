export default function PortfolioTable({ assets = [], totalCapital = 0, onRemove, onUpdateWeight }) {
    if (assets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm italic p-6">
                <span className="text-2xl mb-2 opacity-50">📉</span>
                Cartera vacía. Añade fondos desde el panel izquierdo.
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
                <tbody className="divide-y divide-slate-100">
                    {assets.map((asset) => {
                        const val = (totalCapital * (asset.weight / 100))
                        return (
                            <tr key={asset.isin} className="border-b border-slate-50 hover:bg-slate-50 group transition-colors">
                                <td className="p-3 truncate max-w-[180px] font-bold text-slate-700 text-sm" title={asset.name}>
                                    {asset.name}
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <input
                                            type="number"
                                            className="w-12 text-right bg-transparent outline-none font-bold text-blue-600 text-sm border-b border-blue-100 hover:border-blue-400 focus:border-[var(--color-accent)] transition-colors"
                                            value={asset.weight}
                                            onChange={(e) => onUpdateWeight && onUpdateWeight(asset.isin, e.target.value)}
                                        />
                                        <span className="text-blue-400 font-bold text-sm">%</span>
                                    </div>
                                </td>
                                <td className="p-3 text-right font-mono text-slate-600 font-bold text-sm">
                                    {val.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-3 text-right">
                                    <button
                                        onClick={() => onRemove && onRemove(asset.isin)}
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
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}

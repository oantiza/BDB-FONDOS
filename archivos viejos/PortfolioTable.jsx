export default function PortfolioTable({ assets = [], totalCapital = 0, onRemove, onUpdateWeight }) {
    if (assets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs italic p-6">
                <span className="text-2xl mb-2 opacity-50">📉</span>
                Cartera vacía. Añade fondos desde el panel izquierdo.
            </div>
        )
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
                <tbody className="divide-y divide-slate-700">
                    {assets.map((asset) => {
                        const val = (totalCapital * (asset.weight / 100))
                        return (
                            <tr key={asset.isin} className="border-b border-slate-700 hover:bg-white/5 group transition-colors">
                                <td className="p-3 truncate max-w-[180px] font-medium text-[var(--color-accent)] text-xs" title={asset.name}>
                                    {asset.name}
                                </td>
                                <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <input
                                            type="number"
                                            className="w-12 text-right bg-transparent outline-none font-bold text-[var(--color-text-primary)] text-xs border-b border-transparent hover:border-slate-500 focus:border-[var(--color-accent)] transition-colors"
                                            value={asset.weight}
                                            onChange={(e) => onUpdateWeight && onUpdateWeight(asset.isin, e.target.value)}
                                        />
                                        <span className="text-slate-500">%</span>
                                    </div>
                                </td>
                                <td className="p-3 text-right font-mono text-slate-400 font-bold text-xs">
                                    {val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </td>
                                <td className="p-3 text-right">
                                    <button
                                        onClick={() => onRemove && onRemove(asset.isin)}
                                        className="text-slate-600 hover:text-red-400 transition-colors px-2"
                                    >
                                        &times;
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

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
                    {assets.map((asset, index) => {
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
                                <td className="py-3 pr-3 pl-6 align-middle" title={asset.name}>
                                    <div className="flex items-center gap-3">
                                        {/* Candado indicador de selección manual */}
                                        {isManual && <span className="text-xs shrink-0" title="Fondo seleccionado manualmente (Protegido)">🔒</span>}

                                        <span className="truncate max-w-[320px] text-[#2C3E50] font-[450] text-sm leading-tight">
                                            {asset.name}
                                        </span>

                                        <span className="text-[#A07147] text-[10px] uppercase tracking-widest font-bold shrink-0 bg-[#A07147]/10 px-1.5 py-0.5 rounded">
                                            {asset.std_type || 'General'}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-3 text-right align-middle">
                                    <div className="flex items-center justify-end gap-1">
                                        <input
                                            type="number"
                                            className="w-14 text-right bg-transparent outline-none font-[450] text-[#2C3E50] text-sm border-b border-blue-100 hover:border-blue-400 focus:border-[var(--color-accent)] transition-colors tabular-nums"
                                            value={Math.round(asset.weight * 100) / 100}
                                            step="0.01"
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => onUpdateWeight && onUpdateWeight(asset.isin, e.target.value)}
                                        />
                                        <span className="text-[#A07147] font-[450] text-sm">%</span>
                                    </div>
                                </td>
                                <td className="p-3 text-right align-middle text-[#2C3E50] font-[450] text-sm tabular-nums">
                                    {val.toLocaleString('es-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                <td className="py-3 pl-3 pr-6 text-right">
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
                <tfoot className="bg-white">
                    <tr>
                        <td colSpan={5} className="p-0">
                            <div className="mx-6 border-t border-black/80"></div>
                        </td>
                    </tr>
                    <tr>
                        <td className="py-4 pl-6 text-[#2C3E50] uppercase text-sm font-[550] text-right tracking-tight">TOTAL</td>
                        <td className="py-4 p-3 text-right text-[#2C3E50] font-[550] text-sm tabular-nums">
                            {assets.reduce((sum, a) => sum + (parseFloat(a.weight) || 0), 0).toFixed(2)}%
                        </td>
                        <td className="py-4 p-3 text-right text-[#2C3E50] font-[550] text-sm tabular-nums">
                            {assets.reduce((sum, a) => sum + (totalCapital * ((parseFloat(a.weight) || 0) / 100)), 0).toLocaleString('es-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td></td>
                        <td className="py-4 pl-3 pr-6"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}
import { PortfolioItem } from '../types';
import { getFormattedTaxonomy } from '../utils/taxonomyTranslators';

interface PortfolioTableProps {
    assets?: any[];
    totalCapital?: number;
    onRemove?: (isin: string) => void;
    onUpdateWeight?: (isin: string, val: string | number) => void;
    onFundClick?: (asset: any) => void;
    onSwap?: (asset: any) => void;
    onToggleLock?: (isin: string) => void;
}

export default function PortfolioTable({
    assets = [],
    totalCapital = 0,
    onRemove,
    onUpdateWeight,
    onFundClick,
    onSwap,
    onToggleLock
}: PortfolioTableProps) {
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
                                className={`border-b border-slate-50 hover:bg-slate-50 group transition-colors ${isManual ? 'bg-blue-50/40' : ''}`}
                            >
                                <td className="py-3 pr-3 pl-6 align-middle" title={asset.name}>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleLock && onToggleLock(asset.isin); }}
                                            className={`text-sm shrink-0 transition-opacity ${asset.isLocked ? 'opacity-100' : 'opacity-40 hover:opacity-100 grayscale hover:grayscale-0'}`}
                                            title={asset.isLocked ? "Desbloquear fondo" : "Bloquear fondo (Fijar para optimización)"}
                                        >
                                            {asset.isLocked ? '🔒' : '🔓'}
                                        </button>
                                        {/* Indicador manual secundario */}
                                        {isManual && <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded shrink-0" title="Seleccionado manualmente">M</span>}

                                        <span
                                            onClick={() => onFundClick && onFundClick(asset)}
                                            className="truncate max-w-[320px] text-[#2C3E50] font-[450] text-sm leading-tight cursor-pointer hover:text-[#003399] hover:underline"
                                        >
                                            {asset.name}
                                        </span>

                                        <span className="text-[#0B2545] text-[10px] uppercase tracking-widest font-bold shrink-0 bg-[#0B2545]/10 px-1.5 py-0.5 rounded" title={asset.classification_v2?.asset_subtype}>
                                            {getFormattedTaxonomy(asset)}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-3 text-right align-middle">
                                    <div className="flex items-center justify-end gap-1">
                                        <input
                                            type="number"
                                            className={`w-14 text-right bg-transparent outline-none font-[450] text-[#2C3E50] text-sm tabular-nums ${asset.isLocked ? 'opacity-50 cursor-not-allowed' : 'border-b border-blue-100 hover:border-blue-400 focus:border-[var(--color-accent)] transition-colors'}`}
                                            value={Math.round(asset.weight * 100) / 100}
                                            step="0.01"
                                            disabled={asset.isLocked}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                onUpdateWeight && onUpdateWeight(asset.isin, val);
                                            }}
                                        />
                                        <span className="text-[#0B2545] font-[450] text-sm">%</span>
                                    </div>
                                </td>
                                <td className="p-3 text-right align-middle">
                                    <div className="flex items-center justify-end gap-1">
                                        <input
                                            type="number"
                                            className={`w-20 text-right bg-transparent outline-none font-[450] text-[#2C3E50] text-sm tabular-nums ${asset.isLocked ? 'opacity-50 cursor-not-allowed' : 'border-b border-blue-100 hover:border-blue-400 focus:border-[var(--color-accent)] transition-colors'}`}
                                            value={(totalCapital * (asset.weight / 100)).toFixed(2)}
                                            step="100"
                                            disabled={asset.isLocked}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => {
                                                const newCapital = parseFloat(e.target.value) || 0;
                                                // Avoid division by zero
                                                if (totalCapital > 0) {
                                                    const newWeight = (newCapital / totalCapital) * 100;
                                                    onUpdateWeight && onUpdateWeight(asset.isin, newWeight);
                                                }
                                            }}
                                        />
                                        <span className="text-[#0B2545] font-[450] text-sm">€</span>
                                    </div>
                                </td>

                                {/* --- NUEVA COLUMNA SWAP --- */}
                                <td className="p-3 text-right">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onSwap && onSwap(asset); }}
                                        className="text-slate-600 hover:text-slate-800 text-xs font-semibold hover:underline bg-slate-50 hover:bg-slate-100 px-3 py-1 rounded-full border border-slate-200 transition-colors flex items-center gap-1 ml-auto shadow-sm"
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
            </table >
        </div >
    )
}
import { PortfolioItem } from '../types';
import { getFormattedTaxonomy } from '../utils/taxonomyTranslators';
import { Lock, Unlock, ArrowLeftRight, X, Layers } from 'lucide-react';

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
            <div className="h-full w-full p-8 flex flex-col items-center justify-center">
                <div className="flex flex-col items-center justify-center w-full max-w-md max-h-[300px] border border-dashed border-slate-300 bg-slate-50/30 rounded-2xl text-center p-10 transition-colors hover:bg-slate-50 hover:border-slate-400 group">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 mb-5 text-slate-400 group-hover:scale-105 transition-transform">
                        <Layers className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Cartera Vacía</h4>
                    <p className="text-xs text-slate-500 max-w-[220px] leading-relaxed">
                        Añade fondos desde el panel izquierdo para construir y analizar tu cartera.
                    </p>
                </div>
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
                                className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isManual ? 'bg-blue-50/20' : ''}`}
                            >
                                <td className="py-4 pr-4 pl-6 w-[45%] max-w-[400px] align-middle" title={asset.name}>
                                    <div className="flex items-center gap-5 pl-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onToggleLock && onToggleLock(asset.isin); }}
                                            className={`text-sm shrink-0 transition-all ${asset.isLocked ? 'text-slate-700 opacity-100 scale-110' : 'text-slate-400 opacity-50 hover:opacity-100 hover:text-slate-600 hover:scale-110'}`}
                                            title={asset.isLocked ? "Desbloquear fondo" : "Bloquear fondo"}
                                        >
                                            {asset.isLocked ? <Lock className="w-4 h-4 fill-slate-700/20" /> : <Unlock className="w-4 h-4" />}
                                        </button>

                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    onClick={() => onFundClick && onFundClick(asset)}
                                                    className="truncate max-w-[350px] text-slate-800 font-[600] text-[14px] leading-tight cursor-pointer hover:text-blue-600 hover:underline"
                                                >
                                                    {asset.name}
                                                </span>
                                                {isManual && <span className="text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-sm shrink-0" title="Seleccionado manualmente">M</span>}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-400 text-[11px] font-mono tracking-wider">{asset.isin}</span>
                                                <span className="text-slate-300 text-[11px]">·</span>
                                                <span className="text-slate-400 text-[11px] uppercase font-medium">{getFormattedTaxonomy(asset)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="p-3 w-[15%] min-w-[100px] text-right align-middle">
                                    <div className="flex items-center justify-end">
                                        <div className={`flex items-baseline justify-end gap-1 px-2 py-1 transition-colors ${asset.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <input
                                                type="number"
                                                className="w-[60px] text-right bg-transparent outline-none font-[600] text-slate-800 text-[14px] tabular-nums"
                                                value={Math.round(asset.weight * 100) / 100}
                                                step="0.01"
                                                disabled={asset.isLocked}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    onUpdateWeight && onUpdateWeight(asset.isin, val);
                                                }}
                                            />
                                            <span className="text-slate-500 font-semibold text-[14px]">%</span>
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="p-3 w-[20%] min-w-[140px] text-right align-middle">
                                    <div className="flex items-center justify-end">
                                        <div className={`flex items-baseline justify-end gap-1 px-2 py-1 transition-colors ${asset.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <input
                                                type="number"
                                                className="w-[90px] text-right bg-transparent outline-none font-[600] text-slate-800 text-[14px] tabular-nums"
                                                value={(totalCapital * (asset.weight / 100)).toFixed(2)}
                                                step="100"
                                                disabled={asset.isLocked}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    const newCapital = parseFloat(e.target.value) || 0;
                                                    if (totalCapital > 0) {
                                                        const newWeight = (newCapital / totalCapital) * 100;
                                                        onUpdateWeight && onUpdateWeight(asset.isin, newWeight);
                                                    }
                                                }}
                                            />
                                            <span className="text-slate-500 font-semibold text-[14px]">€</span>
                                        </div>
                                    </div>
                                </td>

                                <td className="py-3 pr-3 w-[15%] text-right align-middle">
                                    <div className="flex items-center justify-end">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onSwap && onSwap(asset); }}
                                            className="text-blue-500 hover:text-blue-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                                            title="Sustituir fondo"
                                        >
                                            <ArrowLeftRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                                            Sustituir
                                        </button>
                                    </div>
                                </td>
                                <td className="py-3 pl-2 pr-6 w-[5%] text-right align-middle">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRemove && onRemove(asset.isin); }}
                                        className="text-slate-300 hover:text-slate-400 transition-colors"
                                        title="Eliminar"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
                <tfoot className="bg-[#f8fafc]">
                    <tr>
                        <td colSpan={5} className="p-0">
                            <div className="mx-6 border-t border-slate-200"></div>
                        </td>
                    </tr>
                    <tr>
                        <td className="py-5 pl-6 text-[#2C3E50] uppercase text-sm font-[550] text-right tracking-tight">TOTAL</td>
                        <td className="py-5 p-3 text-right text-[#2C3E50] font-[550] text-sm tabular-nums">
                            {assets.reduce((sum, a) => sum + (parseFloat(a.weight) || 0), 0).toFixed(2)}%
                        </td>
                        <td className="py-5 p-3 text-right text-[#2C3E50] font-[550] text-sm tabular-nums">
                            {assets.reduce((sum, a) => sum + (totalCapital * ((parseFloat(a.weight) || 0) / 100)), 0).toLocaleString('es-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td></td>
                        <td className="py-5 pl-3 pr-6"></td>
                    </tr>
                </tfoot>
            </table >
        </div >
    )
}
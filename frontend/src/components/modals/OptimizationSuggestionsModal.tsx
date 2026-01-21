import { useState } from 'react'
import { Alternative } from '../../utils/fundSwapper'
import { PortfolioItem } from '../../types'

interface OptimizationGroup {
    original: PortfolioItem;
    alternatives: Alternative[];
}

interface Props {
    suggestions: OptimizationGroup[];
    onApply: (replacements: Map<string, any>) => void;
    onClose: () => void;
}

export default function OptimizationSuggestionsModal({ suggestions, onApply, onClose }: Props) {
    // Map of Original ISIN -> Selected Replacement Fund (or null/undefined if keeping original)
    const [selections, setSelections] = useState<Map<string, any>>(new Map())

    const handleSelect = (originalIsin: string, replacement: any | null) => {
        const newMap = new Map(selections)
        if (replacement === null) {
            newMap.delete(originalIsin)
        } else {
            newMap.set(originalIsin, replacement)
        }
        setSelections(newMap)
    }

    const handleApply = () => {
        onApply(selections)
        onClose()
    }

    const totalReplacements = selections.size

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            ✨ Reajuste de Cartera
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Hemos encontrado alternativas más eficientes para tu cartera importada.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 hover:bg-slate-100 rounded-full"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30 dark:bg-slate-900/10">
                    <div className="flex flex-col gap-6">
                        {suggestions.map((item) => {
                            const original = item.original
                            const selected = selections.get(original.isin)
                            const isOriginalSelected = !selected

                            return (
                                <div key={original.isin} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                                    {/* Row Header: Original Fund */}
                                    <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded uppercase">Original</span>
                                            <div>
                                                <div className="font-bold text-slate-700 dark:text-slate-200 text-sm">{original.name}</div>
                                                <div className="text-xs text-slate-400 flex gap-2">
                                                    <span>{original.isin}</span>
                                                    <span>•</span>
                                                    <span>{original.std_type || 'N/A'}</span>
                                                    <span>•</span>
                                                    <span>{original.std_region || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-slate-500">TER: <span className="font-bold text-slate-700">{original.std_extra?.ter || (original.costs as any)?.ongoing_charge || '?'}%</span></div>
                                        </div>
                                    </div>

                                    {/* Comparison Body */}
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">

                                        {/* Option 1: Keep Original */}
                                        <div
                                            onClick={() => handleSelect(original.isin, null)}
                                            className={`cursor-pointer rounded-lg border-2 p-3 transition-all relative ${isOriginalSelected ? 'border-slate-400 bg-slate-50' : 'border-transparent hover:border-slate-200'}`}
                                        >
                                            <div className="text-xs font-bold text-slate-500 uppercase mb-2 text-center">Mantener Actual</div>
                                            <div className="text-xs text-center text-slate-400">Sin cambios</div>
                                            {isOriginalSelected && <div className="absolute top-2 right-2 text-slate-500">✔</div>}
                                        </div>

                                        {/* Alternatives */}
                                        {item.alternatives.map((alt: Alternative, idx: number) => {
                                            const fund = alt.fund || {}; // Access fund object
                                            const isSelected = selections.get(original.isin)?.isin === fund.isin
                                            const feeDiff = (parseFloat(String(fund.std_extra?.ter || 0)) - parseFloat(String(original.std_extra?.ter || 0))).toFixed(2)
                                            const isCheaper = parseFloat(feeDiff) < 0

                                            return (
                                                <div
                                                    key={fund.isin || idx}
                                                    onClick={() => handleSelect(original.isin, fund)}
                                                    className={`cursor-pointer rounded-lg border-2 p-3 transition-all relative ${isSelected ? 'border-[var(--color-accent)] bg-[#A07147]/10' : 'border-slate-100 hover:border-[var(--color-accent)]/50'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded border border-green-200">
                                                            Opción {idx + 1}
                                                        </span>
                                                        {isSelected && <div className="text-[var(--color-accent)] font-bold">✔</div>}
                                                    </div>

                                                    <div className="font-bold text-sm text-slate-700 dark:text-slate-200 line-clamp-2 mb-1" title={fund.name}>
                                                        {fund.name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 mb-3">{fund.isin}</div>

                                                    <div className="flex justify-between items-end border-t border-slate-100 pt-2">
                                                        <div>
                                                            <div className="text-[10px] text-slate-400 uppercase">Gestora</div>
                                                            <div className="text-xs font-medium text-slate-600 truncate max-w-[100px]" title={fund.std_extra?.company}>{fund.std_extra?.company}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-[10px] text-slate-400 uppercase">TER</div>
                                                            <div className="text-xs font-bold text-slate-700 flex items-center justify-end gap-1">
                                                                {fund.std_extra?.ter}%
                                                                <span className={`text-[10px] ${isCheaper ? 'text-green-500' : 'text-slate-400'}`}>
                                                                    ({feeDiff}%)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 bg-white dark:bg-slate-800 rounded-b-xl z-10 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={totalReplacements === 0}
                        className="bg-[var(--color-accent)] text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-[var(--color-accent)]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <span>Aplicar {totalReplacements} Cambios</span>
                        {totalReplacements > 0 && <span className="bg-white/20 px-1.5 rounded text-xs">{totalReplacements}</span>}
                    </button>
                </div>

            </div>
        </div>
    )
}

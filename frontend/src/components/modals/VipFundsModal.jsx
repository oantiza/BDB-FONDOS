import { useState, useEffect } from 'react'

export default function VipFundsModal({ currentVipFunds, onSave, onClose }) {
    const [inputVal, setInputVal] = useState(currentVipFunds || '')

    const handleSave = () => {
        onSave(inputVal)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-96 overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                    <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                        <span className="text-base">⚓</span> Fondos VIP (Ancla)
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-2">&times;</button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    <p className="text-xs text-slate-500">
                        Introduce los ISINs de los fondos que quieres forzar en la cartera (separados por comas).
                        Estos fondos se incluirán siempre si cumplen criterios básicos.
                    </p>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">ISINs (Separados por coma)</label>
                        <textarea
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            placeholder="IE00B03HCZ61, LU0996182563..."
                            className="w-full h-32 p-2 text-xs border border-slate-300 rounded focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none font-mono resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-[var(--color-brand)] hover:bg-slate-700 rounded shadow-sm transition-colors"
                    >
                        Guardar Configuración
                    </button>
                </div>
            </div>
        </div>
    )
}

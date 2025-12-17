import { useState, useEffect } from 'react'

export default function VipFundsModal({ vipFundsStr, onSave, onClose }) {
    const [isins, setIsins] = useState([])
    const [inputValue, setInputValue] = useState('')
    const [error, setError] = useState(null)

    useEffect(() => {
        if (vipFundsStr) {
            setIsins(vipFundsStr.split(',').map(s => s.trim()).filter(s => s))
        }
    }, [vipFundsStr])

    const handleAdd = () => {
        const val = inputValue.trim().toUpperCase()
        if (!val) return

        if (isins.includes(val)) {
            setError('Este ISIN ya está en la lista')
            return
        }

        if (val.length < 10) { // Basic sanity check
            setError('Formato de ISIN inválido (muy corto)')
            return
        }

        setIsins([...isins, val])
        setInputValue('')
        setError(null)
    }

    const handleRemove = (isinToRemove) => {
        setIsins(isins.filter(i => i !== isinToRemove))
    }

    const handleSave = () => {
        onSave(isins.join(', '))
        onClose()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleAdd()
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-2 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                        💎 Configurar Fondos VIP
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 overflow-y-auto flex-1">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Añade los ISINs de los fondos que quieres que <b>siempre</b> se incluyan en la generación de cartera (fondos ancla).
                    </p>

                    {/* Input Area */}
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value)
                                setError(null)
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Ej: LU1234567890"
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] dark:text-white uppercase placeholder:normal-case"
                        />
                        <button
                            onClick={handleAdd}
                            className="bg-[var(--color-accent)] text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            Añadir
                        </button>
                    </div>

                    {error && (
                        <div className="text-red-500 text-xs mb-3">{error}</div>
                    )}

                    {/* Chips List */}
                    <div className="mt-4">
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">
                            Fondos Seleccionados ({isins.length})
                        </div>

                        {isins.length === 0 ? (
                            <div className="text-sm text-slate-400 italic py-2 text-center bg-slate-50 dark:bg-slate-900/50 rounded border border-dashed border-slate-200 dark:border-slate-700">
                                No has añadido ningún fondo ancla
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                                {isins.map(isin => (
                                    <div key={isin} className="group flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-full px-3 py-1 text-sm text-slate-700 dark:text-slate-200">
                                        <span className="font-mono">{isin}</span>
                                        <button
                                            onClick={() => handleRemove(isin)}
                                            className="ml-1 text-slate-400 hover:text-red-500 transition-colors w-4 h-4 flex items-center justify-center rounded-full"
                                            title="Eliminar"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/30 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2 rounded text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                        Guardar Cambios
                    </button>
                </div>

            </div>
        </div>
    )
}

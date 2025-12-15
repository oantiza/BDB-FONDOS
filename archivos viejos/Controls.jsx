import { useState } from 'react'

export default function Controls({
    riskLevel,
    setRiskLevel,
    onOptimize,
    isOptimizing,
    onManualGenerate,
    onOpenXRay,
    onOpenCosts,
    onOpenTactical, // Comparison Workspace
    onOpenMacro     // New Macro Allocator
}) {
    // numAssets se puede usar para la optimización o mantenemos el valor por defecto en backend
    const [numAssets, setNumAssets] = useState(5)

    return (
        <div className="glass-card rounded shadow-md p-6 border-l-4 border-[var(--color-brand)] shrink-0 space-y-4 text-[var(--color-text-primary)]">
            <h3 className="font-bold text-[var(--color-accent)] mb-2">Estrategia & Control</h3>

            {/* HERRAMIENTAS DE ANÁLISIS */}
            {/* HERRAMIENTAS DE ANÁLISIS */}
            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-dashed border-slate-700">
                <button onClick={onOpenXRay} className="flex flex-row items-center justify-center gap-2 py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded border border-slate-700 transition-colors" title="Radiografía de Cartera">
                    <span className="text-sm">🔬</span>
                    <span className="text-[10px] font-bold text-slate-400">X-Ray</span>
                </button>
                <button onClick={onOpenCosts} className="flex flex-row items-center justify-center gap-2 py-1.5 px-2 bg-white/5 hover:bg-white/10 rounded border border-slate-700 transition-colors" title="Análisis de Costes">
                    <span className="text-sm">⚖️</span>
                    <span className="text-[10px] font-bold text-slate-400">Costes</span>
                </button>
            </div>

            {/* TACTICAL TOOLS */}
            <div className="space-y-2 pb-4 border-b border-dashed border-slate-700">
                <button onClick={onOpenMacro} className="w-full flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 rounded border border-slate-700 transition-colors group">
                    <span className="text-xs font-bold text-slate-300">🌐 Macro Asignación</span>
                    <span className="text-[10px] text-slate-500 group-hover:text-[var(--color-accent)]">Definir &rarr;</span>
                </button>

                <button onClick={onOpenTactical} className="w-full flex items-center justify-between p-2 bg-brand/50 hover:bg-brand/70 rounded border border-brand/20 transition-colors group">
                    <span className="text-xs font-bold text-[var(--color-accent)]">⚔️ Espacio de Comparación</span>
                    <span className="text-[10px] text-slate-500 group-hover:text-[var(--color-accent)]">Workspace &rarr;</span>
                </button>
            </div>

            {/* CONTROL DE RIESGO */}
            <div>
                <div className="flex justify-between text-xs font-bold mb-1 text-slate-400">
                    <span>Perfil de Riesgo</span>
                    <span className="bg-[var(--color-brand)] text-white px-2 rounded border border-slate-700">{riskLevel}</span>
                </div>
                <input
                    type="range"
                    min="1"
                    max="10"
                    value={riskLevel}
                    onChange={(e) => setRiskLevel(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Conservador</span>
                    <span>Agresivo</span>
                </div>
            </div>

            <div>
                <label className="text-xs font-bold mb-1 block text-slate-600">Nº Activos Max</label>
                <input
                    type="number"
                    value={numAssets}
                    onChange={(e) => setNumAssets(parseInt(e.target.value))}
                    className="w-full border p-2 rounded text-xs outline-none focus:border-accent"
                />
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="space-y-2 pt-2 border-t border-slate-700">
                <button
                    onClick={onManualGenerate}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold py-2 rounded hover:bg-slate-700 hover:text-[var(--color-accent)] transition-colors"
                >
                    🎲 Generar Cartera Manual
                </button>

                <button
                    onClick={onOptimize}
                    disabled={isOptimizing}
                    className="w-full bg-gradient-to-r from-accent to-[#b8952b] text-brand text-xs font-bold uppercase py-3 rounded shadow hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isOptimizing ? 'Calculando...' : '⚡ Optimizar Cartera'}
                </button>
            </div>
        </div>
    )
}

import { useState } from 'react'

export default function Controls({
    riskLevel,
    setRiskLevel,
    numFunds,
    setNumFunds,
    onOptimize,
    isOptimizing,
    onManualGenerate,
    onOpenXRay,
    onOpenCosts,
    onOpenTactical,
    onOpenMacro,
    categories = [],
    selectedCategory = 'All',
    setSelectedCategory,
    vipFunds = '',
    setVipFunds,
    onOpenVipModal,
    className = ''
}) {


    return (
        <div className={`bg-white shadow-sm border border-slate-200 rounded-lg shrink-0 text-slate-800 overflow-hidden flex flex-col ${className}`}>

            {/* 1. HERRAMIENTAS OPERATIVAS */}
            <div>
                <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-sans font-bold text-[#0B2545] text-xs uppercase tracking-wider flex items-center gap-2">
                        <span className="text-base">🛠️</span> Herramientas Operativas
                    </h3>
                </div>
                <div className="p-3 space-y-3">
                    {/* Risk Selector */}
                    <div>
                        <div className="flex justify-between text-xs font-bold mb-1 text-slate-500">
                            <span>Perfil de Riesgo</span>
                            <span className="bg-[var(--color-brand)] text-white px-1.5 py-0.5 border border-slate-600 font-mono text-[10px]">{riskLevel}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={riskLevel}
                            onChange={(e) => setRiskLevel(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 appearance-none cursor-pointer accent-[var(--color-accent)]"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 uppercase font-bold">
                            <span>Conservador</span>
                            <span>Agresivo</span>
                        </div>
                    </div>

                    {/* Category & VIP Row */}
                    <div className="grid grid-cols-2 gap-2">
                        {/* Category Selector */}
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-1 text-slate-500">
                                <span>Categoría</span>
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full text-[10px] bg-white border border-slate-200 rounded px-2 py-2 outline-none text-slate-700 shadow-sm focus:border-[var(--color-accent)] transition-colors"
                            >
                                <option value="All">Todas</option>
                                {categories.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* VIP Button */}
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-1 text-slate-500">
                                <span>Fondos VIP</span>
                                <span className="text-[9px] font-normal text-slate-400">
                                    {vipFunds ? `${vipFunds.split(',').filter(x => x.trim()).length}` : '0'}
                                </span>
                            </div>
                            <button
                                onClick={onOpenVipModal}
                                className="w-full text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded px-2 py-2 transition-colors flex items-center justify-center gap-2 h-[34px]"
                            >
                                <span>💎 Configurar</span>
                            </button>
                        </div>
                    </div>

                    {/* Fund Count Selector */}
                    <div>
                        <div className="flex justify-between text-xs font-bold mb-1 text-slate-500">
                            <span>Num. Fondos</span>
                            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 border border-slate-300 font-mono text-[10px]">{numFunds}</span>
                        </div>
                        <input
                            type="range"
                            min="4"
                            max="20"
                            step="1"
                            value={numFunds}
                            onChange={(e) => setNumFunds(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 appearance-none cursor-pointer accent-slate-400"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 uppercase font-bold">
                            <span>Min (4)</span>
                            <span>Max (20)</span>
                        </div>
                    </div>



                    {/* Generator, Optimizer & Tactical */}
                    <div className="grid grid-cols-3 gap-1 pt-1">
                        <button
                            onClick={onManualGenerate}
                            className="bg-slate-700 border border-slate-700 text-white text-[10px] font-bold py-1.5 hover:bg-slate-600 hover:text-white hover:border-slate-600 transition-colors uppercase tracking-tight"
                        >
                            🎲 Generar
                        </button>
                        <button
                            onClick={onOptimize}
                            disabled={isOptimizing}
                            className="bg-gradient-to-r from-[var(--color-accent)] to-[#b8952b] text-white text-[10px] font-bold uppercase py-1.5 shadow hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-1"
                        >
                            {isOptimizing ? '...' : '⚡ Optimizar'}
                        </button>
                        <button
                            onClick={onOpenMacro}
                            className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold py-1.5 hover:bg-slate-100 hover:text-slate-800 transition-colors uppercase tracking-tight flex items-center justify-center gap-1"
                        >
                            🌐 Táctica
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. BOTONES MODALES (X-Ray, Costs, Rebal) */}
            <div>

                <div className="p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                        <ControlButton icon="🔬" label="X-Ray" onClick={onOpenXRay} />
                        <ControlButton icon="⚖️" label="Costes" onClick={onOpenCosts} />
                        <ControlButton icon="⚔️" label="Revisión" onClick={onOpenTactical} />
                    </div>
                </div>
            </div>
        </div>
    )
}

function ControlButton({ icon, label, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all group"
        >
            <span className="text-lg opacity-80 group-hover:scale-110 transition-transform">{icon}</span>
            <span className="text-xs font-bold text-slate-500 mt-1 group-hover:text-slate-700">{label}</span>
        </button>
    )
}

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

    vipFunds = '',
    setVipFunds,
    onOpenVipModal,
    className = ''
}) {


    return (
        <div className={`bg-white shadow-sm border border-slate-100 rounded-xl shrink-0 text-slate-700 overflow-hidden flex flex-col group hover:border-slate-200 transition-colors ${className}`}>

            {/* 1. HERRAMIENTAS OPERATIVAS */}
            <div>
                <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em] flex items-center gap-2">
                        Herramientas Operativas
                    </h3>
                </div>
                <div className="p-3 space-y-3">
                    {/* Risk Selector */}
                    <div>
                        <div className="flex justify-between text-sm font-bold mb-1 text-slate-500">
                            <span>Perfil de Riesgo</span>
                            <span className="bg-[var(--color-brand)] text-white px-1.5 py-0.5 border border-slate-600 font-mono text-xs">{riskLevel}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={riskLevel}
                            onChange={(e) => setRiskLevel(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 appearance-none cursor-pointer accent-[var(--color-accent)]"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-0.5 uppercase font-bold">
                            <span>Conservador</span>
                            <span>Agresivo</span>
                        </div>
                    </div>

                    {/* Funds Control Row (Slider 2/3 + VIP 1/3) */}
                    <div className="flex gap-2 items-end">
                        {/* Fund Count Selector (2/3) */}
                        <div className="w-2/3">
                            <div className="flex justify-between text-sm font-bold mb-1 text-slate-500">
                                <span>Num. Fondos</span>
                                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 border border-slate-300 font-mono text-xs">{numFunds}</span>
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
                            <div className="flex justify-between text-xs text-slate-500 mt-0.5 uppercase font-bold">
                                <span>Min (4)</span>
                                <span>Max (20)</span>
                            </div>
                        </div>

                        {/* VIP Button (1/3) */}
                        <div className="w-1/3">
                            <button
                                onClick={onOpenVipModal}
                                className="w-full h-[34px] text-xs bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded transition-colors flex flex-col items-center justify-center leading-tight font-bold"
                                title="Configurar Fondos VIP"
                            >
                                <span className="flex items-center gap-1">
                                    <span>💎 VIP</span>
                                    {vipFunds && <span className="bg-indigo-200 text-indigo-800 px-1 rounded-full text-[10px]">{vipFunds.split(',').filter(x => x.trim()).length}</span>}
                                </span>
                            </button>
                        </div>
                    </div>



                    {/* Secondary Tools: Costs, Tactical, Macro */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                        <button
                            onClick={onOpenCosts}
                            className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold py-2 rounded hover:bg-blue-100 hover:text-blue-900 transition-colors uppercase tracking-widest flex items-center justify-center gap-1"
                        >
                            Costes
                        </button>
                        <button
                            onClick={onOpenTactical}
                            className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold py-2 rounded hover:bg-blue-100 hover:text-blue-900 transition-colors uppercase tracking-widest flex items-center justify-center gap-1"
                        >
                            Revisión
                        </button>
                        <button
                            onClick={onOpenMacro}
                            className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold py-2 rounded hover:bg-blue-100 hover:text-blue-900 transition-colors uppercase tracking-widest flex items-center justify-center gap-1"
                        >
                            AJUSTE MANUAL
                        </button>
                    </div>

                </div>
            </div>

            {/* 2. PRIMARY ACTIONS (Generate, Optimize) */}
            <div>
                <div className="p-4 pt-0 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <ControlButton
                            icon="✨"
                            label="Generar"
                            onClick={onManualGenerate}
                            variant="dark"
                        />
                        <ControlButton
                            icon="🚀"
                            label={isOptimizing ? '...' : 'Optimizar'}
                            onClick={onOptimize}
                            variant="highlight"
                            active={isOptimizing}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function ControlButton({ icon, label, onClick, active = false, variant = 'standard' }) {
    const baseClasses = "flex flex-col items-center justify-center p-3 rounded-lg transition-all group border"

    // Gold/Blue style for Optimize/Highlight
    if (variant === 'highlight') {
        return (
            <button
                onClick={onClick}
                disabled={active}
                className={`${baseClasses} bg-[#D4AF37] border-[#b8952b] hover:bg-[#b8952b] shadow-md`}
            >
                <span className="text-xl text-[#0B2545] group-hover:scale-110 transition-transform">{icon}</span>
                <span className="text-xs font-bold text-[#0B2545] mt-1 uppercase tracking-wider">{label}</span>
            </button>
        )
    }

    // Dark/Black style (Restored)
    if (variant === 'dark') {
        return (
            <button
                onClick={onClick}
                disabled={active}
                className={`${baseClasses} bg-slate-800 border-slate-900 hover:bg-slate-700 shadow-md`}
            >
                <span className="text-xl text-white group-hover:scale-110 transition-transform">{icon}</span>
                <span className="text-xs font-bold text-white mt-1 uppercase tracking-wider">{label}</span>
            </button>
        )
    }

    // Standard White/Slate style
    return (
        <button
            onClick={onClick}
            className={`${baseClasses} bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200`}
        >
            <span className="text-xl opacity-60 group-hover:scale-110 transition-transform grayscale group-hover:grayscale-0">{icon}</span>
            <span className="text-xs font-bold text-slate-400 mt-1 group-hover:text-slate-700 uppercase tracking-wider">{label}</span>
        </button>
    )
}

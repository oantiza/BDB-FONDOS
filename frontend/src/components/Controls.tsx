import { useState } from 'react'
import { Sparkles, Rocket, Zap, Gem, FolderOpen, Calculator, Shield, Sliders } from 'lucide-react'
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
    onOpenSharpeMaximizer, // FIXED
    onOpenSavedPortfolios, // NEW
    className = ''
}: {
    riskLevel: number,
    setRiskLevel: (v: number) => void,
    numFunds: number,
    setNumFunds: (v: number) => void,
    onOptimize: () => void,

    isOptimizing: boolean,
    onManualGenerate: () => void,
    onOpenXRay?: () => void,
    onOpenCosts: () => void,
    onOpenTactical: () => void,
    onOpenMacro: () => void,
    vipFunds?: string,
    setVipFunds?: (v: string) => void,
    onOpenVipModal: () => void,
    onOpenSharpeMaximizer?: () => void,
    onOpenSavedPortfolios?: () => void,
    className?: string
}) {


    return (
        <div className={`bg-white shadow-sm border border-slate-100 rounded-xl shrink-0 text-slate-700 overflow-hidden flex flex-col group hover:border-slate-200 transition-colors ${className}`}>

            {/* 1. HERRAMIENTAS OPERATIVAS */}
            <div className="flex-1 flex flex-col">
                <div className="h-[45px] px-4 bg-[#F8FAFC] border-b border-slate-200/60 flex justify-between items-center z-10">
                    <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                        Control Operativo
                    </h3>
                </div>
                <div className="p-5 flex flex-col justify-between flex-1">
                    
                    {/* Parameters Header & VIP */}
                    <div className="flex justify-between items-center mb-5 border-b border-slate-50 pb-2">
                        <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Parámetros de Cartera</h4>
                        <button
                            onClick={onOpenVipModal}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors ${vipFunds ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 hover:text-slate-600'}`}
                            title="Modo VIP"
                        >
                            <Gem className={`w-3 h-3 ${vipFunds ? 'fill-current' : ''}`} />
                            <span className="text-[10px] font-bold tracking-widest uppercase">
                                VIP {vipFunds && <span className="ml-0.5 opacity-80">({vipFunds.split(',').filter(x => x.trim()).length})</span>}
                            </span>
                        </button>
                    </div>

                    <div className="space-y-8 mt-2">
                        {/* Risk Selector */}
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-2 text-slate-600 items-center">
                                <span className="uppercase tracking-wider">Perfil de Riesgo</span>
                                <span className="bg-[#0B2545] text-white px-2 py-0.5 rounded font-mono text-xs border border-[#0B2545]">{riskLevel}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={riskLevel}
                                onChange={(e) => setRiskLevel(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0B2545]"
                            />
                            <div className="flex justify-between text-[9px] text-slate-400 mt-1.5 uppercase font-bold tracking-wider">
                                <span>Conservador</span>
                                <span>Agresivo</span>
                            </div>
                        </div>

                        {/* Funds Control */}
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-2 text-slate-600 items-center">
                                <span className="uppercase tracking-wider">Número de Fondos</span>
                                <span className="bg-[#0B2545] text-white px-2 py-0.5 rounded font-mono text-xs border border-[#0B2545]">{numFunds}</span>
                            </div>
                            <input
                                type="range"
                                min="4"
                                max="25"
                                step="1"
                                value={numFunds}
                                onChange={(e) => setNumFunds(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0B2545]"
                            />
                            <div className="flex justify-between text-[9px] text-slate-400 mt-1.5 uppercase font-bold tracking-wider">
                                <span>Min (4)</span>
                                <span>Max (25)</span>
                            </div>
                        </div>
                    </div>

                    {/* Primary Actions (Moved here) */}
                    <div className="mt-8 flex items-center gap-2">
                        <button
                            onClick={onManualGenerate}
                            className="flex-1 bg-[#0B2545] hover:bg-[#1a365d] text-white py-3.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            <Sparkles className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Generar</span>
                        </button>
                        <button
                            onClick={onOptimize}
                            disabled={isOptimizing}
                            className="flex-[1.3] bg-[#D4AF37] hover:bg-[#c29e2f] text-[#0B2545] py-3.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md border border-[#c29e2f]"
                        >
                            <Rocket className="w-4 h-4" />
                            <span className="text-[11px] font-extrabold uppercase tracking-widest">{isOptimizing ? '...' : 'Optimizar'}</span>
                        </button>
                        <button
                            onClick={() => onOpenSharpeMaximizer && onOpenSharpeMaximizer()}
                            className="flex-[0.85] bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-300 hover:border-slate-400 py-3.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                            <Zap className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Sharpe</span>
                        </button>
                    </div>

                    {/* Secondary Tools: Costs, Tactical, Macro, Saved */}
                    <div className="grid grid-cols-2 gap-3 pt-6 mt-6 border-t border-slate-50">
                        <button
                            onClick={onOpenCosts}
                            className="bg-slate-50 hover:bg-[#F0F4F8] text-slate-500 hover:text-[#0B2545] text-[10px] font-bold py-2 px-2 rounded border border-slate-100 transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5"
                        >
                            <Calculator className="w-3.5 h-3.5" /> COSTES
                        </button>
                        <button
                            onClick={onOpenSavedPortfolios}
                            className="bg-slate-50 hover:bg-[#F0F4F8] text-slate-500 hover:text-[#0B2545] text-[10px] font-bold py-2 px-2 rounded border border-slate-100 transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5"
                        >
                            <FolderOpen className="w-3.5 h-3.5" /> Carteras
                        </button>
                        <button
                            onClick={onOpenTactical}
                            className="bg-slate-50 hover:bg-[#F0F4F8] text-slate-500 hover:text-[#0B2545] text-[10px] font-bold py-2 px-2 rounded border border-slate-100 transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5"
                        >
                            <Shield className="w-3.5 h-3.5" /> REVISIÓN
                        </button>
                        <button
                            onClick={onOpenMacro}
                            className="bg-slate-50 hover:bg-[#F0F4F8] text-slate-500 hover:text-[#0B2545] text-[10px] font-bold py-2 px-2 rounded border border-slate-100 transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5"
                        >
                            <Sliders className="w-3.5 h-3.5" /> Ajuste
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ControlButton({ icon, label, onClick, active = false, variant = 'standard', className = '', compact = false }: { icon: React.ReactNode | string, label: string, onClick: () => void, active?: boolean, variant?: 'standard' | 'highlight' | 'dark' | 'outline-gold', className?: string, compact?: boolean }) {
    const baseClasses = `flex items-center justify-center rounded-full transition-all group border ${compact ? 'flex-row gap-2 p-2' : 'flex-col p-3'}`

    // Gold/Blue style for Optimize/Highlight
    if (variant === 'highlight') {
        return (
            <button
                onClick={onClick}
                disabled={active}
                className={`${baseClasses} bg-[#D4AF37] border-[#b8952b] hover:bg-[#b8952b] shadow-md ${className}`}
            >
                <span className={`${compact ? 'text-sm' : ''} text-[#0B2545] group-hover:scale-110 transition-transform`}>{icon}</span>
                <span className={`${compact ? 'text-[10px] mt-0' : 'text-xs mt-1'} font-extrabold text-[#0B2545] uppercase tracking-wider`}>{label}</span>
            </button>
        )
    }

    // Outline Gold style for Sharpe
    if (variant === 'outline-gold') {
        return (
            <button
                onClick={onClick}
                disabled={active}
                className={`${baseClasses} bg-white hover:bg-yellow-50 border-[#D4AF37] shadow-sm ${className}`}
            >
                <span className={`${compact ? 'text-sm' : ''} text-[#D4AF37] group-hover:scale-110 transition-transform`}>{icon}</span>
                <span className={`${compact ? 'text-[10px] mt-0' : 'text-xs mt-1'} font-extrabold text-[#D4AF37] uppercase tracking-wider`}>{label}</span>
            </button>
        )
    }

    // Dark/Black style (Restored)
    if (variant === 'dark') {
        return (
            <button
                onClick={onClick}
                disabled={active}
                className={`${baseClasses} bg-slate-800 border-slate-900 hover:bg-slate-700 shadow-md ${className}`}
            >
                <span className={`${compact ? 'text-sm' : ''} text-white group-hover:scale-110 transition-transform`}>{icon}</span>
                <span className={`${compact ? 'text-[10px] mt-0' : 'text-xs mt-1'} font-bold text-white uppercase tracking-wider`}>{label}</span>
            </button>
        )
    }

    // Standard White/Slate style
    return (
        <button
            onClick={onClick}
            className={`${baseClasses} bg-[#F0F4F8] hover:bg-white border-[#D1D9E6] text-[#0B2545] shadow-sm ${className}`}
        >
            <span className={`${compact ? '' : ''} group-hover:scale-110 transition-transform`}>{icon}</span>
            <span className={`${compact ? 'text-[10px] mt-0 tabular-nums' : 'text-xs mt-1'} font-bold uppercase tracking-wider`}>{label}</span>
        </button>
    )
}


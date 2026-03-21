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
            <div>
                <div className="p-4 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-extrabold text-[#0B2545] uppercase tracking-[0.2em] flex items-center gap-2">
                        Herramientas Operativas
                    </h3>
                </div>
                <div className="p-3 space-y-3">
                    {/* Risk Selector */}
                    <div>
                        <div className="flex justify-between text-sm font-bold mb-1 text-slate-500 items-center">
                            <span>Perfil de Riesgo</span>
                            <span className="bg-[#0B2545] text-white px-2 rounded-full font-mono text-xs border border-[#0B2545]">{riskLevel}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={riskLevel}
                            onChange={(e) => setRiskLevel(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 appearance-none cursor-pointer accent-[#0B2545]"
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
                            <div className="flex justify-between text-sm font-bold mb-1 text-slate-500 items-center">
                                <span>Num. Fondos</span>
                                <span className="bg-[#0B2545] text-white px-2 rounded-full font-mono text-xs border border-[#0B2545]">{numFunds}</span>
                            </div>
                            <input
                                type="range"
                                min="4"
                                max="20"
                                step="1"
                                value={numFunds}
                                onChange={(e) => setNumFunds(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 appearance-none cursor-pointer accent-[#0B2545]"
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
                                className="w-full h-[34px] text-xs bg-white hover:bg-slate-50 border border-[#8c6b42] text-[#8c6b42] rounded-full transition-colors flex flex-col items-center justify-center leading-tight font-bold shadow-[0_0_8px_rgba(140,107,66,0.25)]"
                                title="Configurar Fondos VIP"
                            >
                                <span className="flex items-center gap-1">
                                    <Gem className="w-3.5 h-3.5" /> <span>VIP</span>
                                    {vipFunds && <span className="bg-[#8c6b42] text-white px-1.5 rounded-full text-[10px] ml-0.5">{vipFunds.split(',').filter(x => x.trim()).length}</span>}
                                </span>
                            </button>
                        </div>
                    </div>



                    {/* Secondary Tools: Costs, Tactical, Macro, Saved */}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                            onClick={onOpenCosts}
                            className="bg-[#F0F4F8] border border-[#D1D9E6] text-[#0B2545] text-[10px] font-bold py-2 rounded-full hover:bg-white transition-colors uppercase tracking-widest flex items-center justify-center gap-1 shadow-sm"
                        >
                            <Calculator className="w-3.5 h-3.5" /> COSTES
                        </button>
                        <button
                            onClick={onOpenSavedPortfolios}
                            className="bg-[#F0F4F8] border border-[#D1D9E6] text-[#0B2545] text-[10px] font-bold py-2 rounded-full hover:bg-white transition-colors uppercase tracking-widest flex items-center justify-center gap-1 shadow-sm"
                        >
                            <FolderOpen className="w-3.5 h-3.5" /> CARTERAS
                        </button>
                        <button
                            onClick={onOpenTactical}
                            className="bg-[#F0F4F8] border border-[#D1D9E6] text-[#0B2545] text-[10px] font-bold py-2 rounded-full hover:bg-white transition-colors uppercase tracking-widest flex items-center justify-center gap-1 shadow-sm"
                        >
                            <Shield className="w-3.5 h-3.5" /> REVISIÓN
                        </button>
                        <button
                            onClick={onOpenMacro}
                            className="bg-[#F0F4F8] border border-[#D1D9E6] text-[#0B2545] text-[10px] font-bold py-2 rounded-full hover:bg-white transition-colors uppercase tracking-widest flex items-center justify-center gap-1 shadow-sm"
                        >
                            <Sliders className="w-3.5 h-3.5" /> AJUSTE MANUAL
                        </button>
                    </div>

                </div>
            </div>

            {/* 2. PRIMARY ACTIONS (Generate, Optimize, Sharpe - Horizontal 3x) */}
            <div className="mt-auto">
                <div className="p-4 pt-0 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                        <ControlButton
                            icon={<Sparkles className="w-5 h-5" />}
                            label="Generar"
                            onClick={onManualGenerate}
                            variant="dark"
                        />
                        <ControlButton
                            icon={<Rocket className="w-5 h-5" />}
                            label={isOptimizing ? '...' : 'Optimizar'}
                            onClick={onOptimize}
                            variant="highlight"
                            active={isOptimizing}
                        />
                        <ControlButton
                            icon={<Zap className="w-5 h-5" />}
                            label="Sharpe"
                            onClick={() => onOpenSharpeMaximizer && onOpenSharpeMaximizer()}
                            variant="outline-gold"
                        />
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


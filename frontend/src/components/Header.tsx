
// import { useTheme } from '../hooks/useTheme' // Removed

import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
    onLogout: () => void
    onOpenMiBoutique?: () => void
    onOpenXRay?: () => void
    onOpenPositions?: () => void
    onOpenRetirement?: () => void
    onOpenComparator?: () => void
    onOpenCorrelationAnalysis?: () => void
    onBack?: () => void
    isOptimizing?: boolean
}

export default function Header({ 
    onLogout, 
    onOpenMiBoutique, 
    onOpenXRay, 
    onOpenPositions, 
    onOpenRetirement, 
    onOpenComparator, 
    onOpenCorrelationAnalysis,
    onBack,
    isOptimizing
}: HeaderProps) {
    return (
        <header className="h-16 bg-gradient-to-r from-slate-800 to-slate-700 text-white flex items-center justify-between px-6 z-20 shrink-0 border-b border-slate-600 shadow-sm print:hidden">
            <div className="flex flex-col">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="bg-white/10 border border-white/20 text-slate-200 hover:text-white p-1.5 rounded-full hover:bg-white/20 transition-colors shadow-sm" title="Volver">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className="font-light text-xl tracking-tight leading-none mb-0.5 text-white">Gestor de <span className="font-bold text-blue-200">Fondos</span></div>
                </div>
            </div>
            <div className="flex items-center gap-6">
                
                {/* GRUPO PRINCIPAL */}
                <div className="flex items-center gap-3">
                    {onOpenXRay && (
                        <button
                            onClick={onOpenXRay}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 text-xs font-bold uppercase tracking-widest border border-blue-400"
                        >
                            Análisis de Cartera
                        </button>
                    )}

                    {onOpenComparator && (
                        <button
                            onClick={onOpenComparator}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-700/50 text-slate-200 hover:text-white hover:bg-slate-600 transition-all border border-slate-500 shadow-sm text-xs font-bold uppercase tracking-widest"
                        >
                            <span className="text-[#D4AF37]">★</span> Comparador
                        </button>
                    )}

                    {onOpenPositions && (
                        <button
                            onClick={onOpenPositions}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-700/50 text-slate-200 hover:text-white hover:bg-slate-600 transition-all border border-slate-500 shadow-sm text-xs font-bold uppercase tracking-widest"
                        >
                            Posiciones
                        </button>
                    )}
                </div>

                <div className="h-6 w-px bg-slate-600/50"></div>

                {/* GRUPO SECUNDARIO */}
                <div className="flex items-center gap-4">
                    {onOpenCorrelationAnalysis && (
                        <button
                            onClick={onOpenCorrelationAnalysis}
                            disabled={isOptimizing}
                            className="text-[11px] uppercase tracking-widest font-bold text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                        >
                            Análisis de correlaciones
                        </button>
                    )}

                    {onOpenMiBoutique && (
                        <button
                            onClick={onOpenMiBoutique}
                            className="text-[11px] uppercase tracking-widest font-bold text-slate-300 hover:text-white transition-colors"
                        >
                            Macro y Estrategia
                        </button>
                    )}

                    {onOpenRetirement && (
                        <button
                            onClick={onOpenRetirement}
                            className="text-[11px] uppercase tracking-widest font-bold text-slate-300 hover:text-white transition-colors"
                        >
                            Jubilación
                        </button>
                    )}
                </div>

                <div className="h-6 w-px bg-slate-600/50"></div>

                {/* GRUPO AUXILIAR */}
                <button onClick={onLogout} className="text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-400 transition-colors">
                    Salir
                </button>
            </div>
        </header>
    )
}

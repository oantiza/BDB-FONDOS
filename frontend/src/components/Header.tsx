
// import { useTheme } from '../hooks/useTheme' // Removed

import { ArrowLeft } from 'lucide-react';

interface HeaderProps {
    onLogout: () => void
    onOpenMiBoutique?: () => void
    onOpenXRay?: () => void
    onOpenPositions?: () => void
    onOpenRetirement?: () => void
    onOpenComparator?: () => void
    onBack?: () => void
    children?: React.ReactNode
}

export default function Header({ onLogout, onOpenMiBoutique, onOpenXRay, onOpenPositions, onOpenRetirement, onOpenComparator, onBack, children }: HeaderProps) {
    // Theme toggle removed

    return (
        <header className="h-16 bg-gradient-to-r from-slate-800 to-slate-700 text-white flex items-center justify-between px-6 z-20 shrink-0 border-b border-slate-600 shadow-sm">
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
            <div className="flex items-center gap-4">
                {children}

                {onOpenXRay && (
                    <button
                        onClick={onOpenXRay}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-600 border border-slate-500 shadow-sm transition-all"
                    >
                        <span className="text-xs uppercase tracking-widest font-bold">Análisis de Cartera</span>
                        <span className="text-[10px] text-[#D4AF37] transform group-hover:translate-x-0.5 transition-transform">↗</span>
                    </button>
                )}

                {onOpenComparator && (
                    <button
                        onClick={onOpenComparator}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-600 transition-all border border-slate-500 shadow-sm text-xs font-bold uppercase tracking-widest"
                    >
                        <span className="text-[#D4AF37]">★</span> Comparador
                    </button>
                )}

                {onOpenPositions && (
                    <button
                        onClick={onOpenPositions}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-600 border border-slate-500 shadow-sm transition-all"
                        title="Analizador de Posiciones"
                    >
                        <span className="text-xs uppercase tracking-widest font-bold">Posiciones</span>
                        <span className="text-[10px] text-[#D4AF37] transform group-hover:translate-x-0.5 transition-transform">↗</span>
                    </button>
                )}

                {onOpenMiBoutique && (
                    <button
                        onClick={onOpenMiBoutique}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-600 border border-slate-500 shadow-sm transition-all"
                    >
                        <span className="text-xs uppercase tracking-widest font-bold">Macro y Estrategia</span>
                        <span className="text-[10px] text-[#D4AF37] transform group-hover:translate-x-0.5 transition-transform">↗</span>
                    </button>
                )}

                {(onOpenPositions || onOpenRetirement || onOpenComparator || onOpenXRay || onOpenMiBoutique) && <div className="h-4 w-px bg-slate-600 mx-1"></div>}

                {onOpenRetirement && (
                    <button
                        onClick={onOpenRetirement}
                        className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                    >
                        Jubilación
                    </button>
                )}

                <div className="h-4 w-px bg-slate-600 mx-1"></div>
                <button onClick={onLogout} className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-red-400 transition-colors">Salir</button>
            </div>
        </header>
    )
}

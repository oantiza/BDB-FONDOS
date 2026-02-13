
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
        <header className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center justify-between px-6 z-20 shrink-0 border-b border-white/10 shadow-md">
            <div className="flex flex-col">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="bg-white/10 p-1.5 rounded-full hover:bg-white/20 transition-colors" title="Volver">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className="font-light text-xl tracking-tight leading-none mb-0.5">Gestor de <span className="font-bold">Fondos</span></div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {children}

                {onOpenXRay && (
                    <button
                        onClick={onOpenXRay}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:border-white/30"
                    >
                        <span className="text-xs uppercase tracking-widest font-bold text-white/90 group-hover:text-white">Análisis de Cartera</span>
                        <span className="text-[10px] transform group-hover:translate-x-0.5 transition-transform">↗</span>
                    </button>
                )}

                {onOpenComparator && (
                    <button
                        onClick={onOpenComparator}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-all border border-white/10 text-xs font-bold uppercase tracking-widest text-white"
                    >
                        <span className="text-amber-300">★</span> Comparador
                    </button>
                )}

                {onOpenPositions && (
                    <button
                        onClick={onOpenPositions}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:border-white/30"
                        title="Analizador de Posiciones"
                    >
                        <span className="text-xs uppercase tracking-widest font-bold text-white/90 group-hover:text-white">Posiciones</span>
                        <span className="text-[10px] transform group-hover:translate-x-0.5 transition-transform">↗</span>
                    </button>
                )}

                {onOpenMiBoutique && (
                    <button
                        onClick={onOpenMiBoutique}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:border-white/30"
                    >
                        <span className="text-xs uppercase tracking-widest font-bold text-white/90 group-hover:text-white">Macro y Estrategia</span>
                        <span className="text-[10px] transform group-hover:translate-x-0.5 transition-transform">↗</span>
                    </button>
                )}

                {(onOpenPositions || onOpenRetirement || onOpenComparator || onOpenXRay || onOpenMiBoutique) && <div className="h-4 w-px bg-white/20 mx-2"></div>}

                {onOpenRetirement && (
                    <button
                        onClick={onOpenRetirement}
                        className="text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors"
                    >
                        Jubilación
                    </button>
                )}

                <div className="h-4 w-px bg-white/20 mx-2"></div>
                <button onClick={onLogout} className="text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors">Salir</button>
            </div>
        </header>
    )
}

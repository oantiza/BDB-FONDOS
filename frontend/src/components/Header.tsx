
// import { useTheme } from '../hooks/useTheme' // Removed

interface HeaderProps {
    onLogout: () => void
    onOpenMiBoutique: () => void
    onOpenXRay?: () => void
    onOpenPositions?: () => void
    children?: React.ReactNode
}

export default function Header({ onLogout, onOpenMiBoutique, onOpenXRay, onOpenPositions, children }: HeaderProps) {
    // Theme toggle removed

    return (
        <header className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center justify-between px-6 z-20 shrink-0 border-b border-white/10 shadow-md">
            <div className="flex flex-col">
                <div className="font-light text-xl tracking-tight leading-none mb-0.5">Gestor de <span className="font-bold">Fondos</span></div>
                <div className="text-[9px] uppercase tracking-[0.25em] text-white/70 font-bold">Portfolio Intelligence</div>
            </div>
            <div className="flex items-center gap-4">
                {children}

                <button
                    onClick={onOpenXRay}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:border-white/30"
                >
                    <span className="text-xs uppercase tracking-widest font-bold text-white/90 group-hover:text-white">Análisis de Cartera</span>
                    <span className="text-[10px] transform group-hover:translate-x-0.5 transition-transform">↗</span>
                </button>

                <button
                    onClick={onOpenMiBoutique}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:border-white/30"
                >
                    <span className="text-xs uppercase tracking-widest font-bold text-white/90 group-hover:text-white">Macro y Estrategia</span>
                    <span className="text-[10px] transform group-hover:translate-x-0.5 transition-transform">↗</span>
                </button>

                <div className="h-4 w-px bg-white/20 mx-2"></div>
                <button
                    onClick={onOpenPositions}
                    className="text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors"
                    title="Analizador de Posiciones"
                >
                    Posiciones
                </button>
                <div className="h-4 w-px bg-white/20 mx-2"></div>
                <button onClick={onLogout} className="text-xs font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors">Salir</button>
            </div>
        </header>
    )
}

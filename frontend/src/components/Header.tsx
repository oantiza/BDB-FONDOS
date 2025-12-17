
interface HeaderProps {
    onLogout: () => void
    onOpenNews: () => void
    onOpenMiBoutique: () => void
    onOpenAudit?: () => void
}

export default function Header({ onLogout, onOpenNews, onOpenMiBoutique }: HeaderProps) {
    // Theme toggle removed

    return (
        <header className="h-16 bg-[var(--color-brand)] text-white flex items-center justify-between px-6 z-20 shrink-0 border-b-4 border-[var(--color-accent)]">
            <div className="flex flex-col">
                <div className="font-serif text-xl font-bold tracking-tight">Gestor de <span className="text-[var(--color-accent)]">Fondos</span></div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Portfolio Intelligence</div>
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={onOpenMiBoutique}
                    className="font-bold hover:text-[var(--color-accent)] transition-colors flex items-center gap-2 text-xs uppercase tracking-wider"
                >
                    <span>🏦 Mi Boutique</span>
                </button>

                <button onClick={onOpenNews} className="font-bold hover:text-[var(--color-accent)] transition-colors flex items-center gap-2">
                    <span>NEWS</span>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]"></span>
                    </span>
                </button>
                <div className="h-4 w-px bg-slate-500 mx-2"></div>
                <button onClick={onLogout} className="border border-slate-500 px-3 py-1 rounded hover:bg-white hover:text-[var(--color-brand)] transition-colors text-xs font-bold uppercase">Salir</button>
            </div>
        </header>
    )
}

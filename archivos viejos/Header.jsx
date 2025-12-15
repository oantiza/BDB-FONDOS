export default function Header({ onLogout, onOpenNews }) {
    return (
        <header className="h-16 bg-[var(--color-brand)] text-white flex items-center justify-between px-6 shadow-lg border-b border-[var(--color-accent)] z-20 shrink-0">
            <div className="flex flex-col">
                <div className="font-serif text-xl font-bold">Global <span className="text-[var(--color-accent)]">CIO</span> Office</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Portfolio Intelligence</div>
            </div>
            <div className="flex items-center gap-6">
                <button
                    onClick={() => window.open('https://mi-boutique-financiera.vercel.app/', '_blank')}
                    className="font-bold hover:text-[var(--color-accent)] transition-colors uppercase flex items-center gap-1"
                >
                    <span>ANÁLISIS</span>
                    <span className="text-[10px] opacity-70">↗</span>
                </button>
                <button onClick={onOpenNews} className="font-bold hover:text-[var(--color-accent)] transition-colors flex items-center gap-2">
                    <span>NEWS</span>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-accent)]"></span>
                    </span>
                </button>
                <button onClick={onLogout} className="border border-slate-600 px-3 py-1 rounded hover:bg-white/10 hover:text-white transition-colors text-xs font-bold uppercase">Salir</button>
            </div>
        </header>
    )
}

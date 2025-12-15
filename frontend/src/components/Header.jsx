export default function Header({ onLogout, onOpenNews, onOpenAudit }) {
    return (
        <header className="h-16 bg-gradient-to-r from-[#1a2b4b] to-[#2a4575] text-white flex items-center justify-between px-6 shadow-lg border-b border-accent z-20 shrink-0">
            <div className="flex flex-col">
                <div className="font-serif text-xl font-bold">Global <span className="text-accent">CIO</span> Office</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Portfolio Intelligence</div>
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={onOpenAudit}
                    title="Auditoría de Datos"
                    className="p-1 px-2 text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors flex items-center gap-1"
                >
                    <span className="text-lg">🩺</span>
                    <span className="text-[10px] uppercase font-bold tracking-wide">Audit</span>
                </button>

                <a
                    href="https://mi-boutique-financiera.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold hover:text-accent transition-colors flex items-center gap-2 text-xs uppercase tracking-wider"
                >
                    <span>🏦 Mi Boutique</span>
                </a>
                <button onClick={onOpenNews} className="font-bold hover:text-accent transition-colors flex items-center gap-2">
                    <span>NEWS</span>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                    </span>
                </button>
                <div className="h-4 w-px bg-slate-500 mx-2"></div>
                <button onClick={onLogout} className="border px-3 py-1 rounded hover:bg-white hover:text-brand transition-colors text-xs font-bold uppercase">Salir</button>
            </div>
        </header>
    )
}

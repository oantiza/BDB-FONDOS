export default function Header({ onLogout, onOpenNews, onOpenMiBoutique, onOpenAudit }) {
    return (
        <header className="h-16 bg-[#0B2545] text-white flex items-center justify-between px-6 z-20 shrink-0 border-b-4 border-[#D4AF37]">
            <div className="flex flex-col">
                <div className="font-serif text-xl font-bold tracking-tight">Gestor de <span className="text-[#D4AF37]">Fondos</span></div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-gray-400">Portfolio Intelligence</div>
            </div>
            <div className="flex items-center gap-4">

                <button
                    onClick={onOpenMiBoutique}
                    className="font-bold hover:text-[#D4AF37] transition-colors flex items-center gap-2 text-xs uppercase tracking-wider"
                >
                    <span>🏦 Mi Boutique</span>
                </button>
                <button
                    onClick={onOpenAudit}
                    className="font-bold hover:text-red-400 transition-colors flex items-center gap-2 text-xs uppercase tracking-wider"
                    title="Audit Database Health"
                >
                    <span>🛡️ Audit</span>
                </button>
                <button onClick={onOpenNews} className="font-bold hover:text-[#D4AF37] transition-colors flex items-center gap-2">
                    <span>NEWS</span>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
                    </span>
                </button>
                <div className="h-4 w-px bg-slate-500 mx-2"></div>
                <button onClick={onLogout} className="border border-slate-500 px-3 py-1 rounded hover:bg-white hover:text-[#0B2545] transition-colors text-xs font-bold uppercase">Salir</button>
            </div>
        </header>
    )
}

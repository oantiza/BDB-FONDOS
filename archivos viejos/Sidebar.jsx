import { useState } from 'react'

export default function Sidebar({ assets = [], onAddAsset }) {
    const [term, setTerm] = useState('')

    const filtered = assets.filter(a => {
        const termMatch = a.name.toLowerCase().includes(term.toLowerCase()) || a.isin.toLowerCase().includes(term.toLowerCase())
        // Blacklist Base Indices
        const isBlacklisted = (a.isin === 'IE00B18GC888' || a.isin === 'IE00B03HCZ61')
        return termMatch && !isBlacklisted
    }).slice(0, 50)

    return (
        <div className="w-80 bg-[var(--color-bg-card)] border-r border-slate-700 shadow-md z-10 p-0 flex flex-col shrink-0 text-[var(--color-text-primary)]">
            <div className="p-3 bg-white/5 font-serif font-bold text-[var(--color-accent)] border-b border-slate-700 text-sm">Universo de Fondos</div>
            <div className="p-3 border-b border-slate-700">
                <input
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Buscar nombre o ISIN..."
                    className="w-full text-xs p-2 bg-[var(--color-bg-main)] border border-slate-600 rounded shadow-inner outline-none focus:border-[var(--color-accent)] text-slate-200 transition-colors"
                />
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {assets.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs italic">Cargando fondos...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs italic">Sin resultados</div>
                ) : (
                    filtered.map(f => (
                        <div
                            key={f.isin}
                            onClick={() => onAddAsset(f)}
                            className="p-3 border-b border-slate-700 hover:bg-white/5 cursor-pointer flex justify-between items-center group transition-colors"
                        >
                            <div className="min-w-0 pr-2">
                                <div className="text-xs font-bold text-slate-200 truncate" title={f.name}>{f.name}</div>
                                <div className="text-[9px] text-slate-500 font-mono">{f.isin}</div>
                            </div>
                            <span className="text-[var(--color-accent)] font-bold opacity-0 group-hover:opacity-100 text-lg shrink-0">+</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

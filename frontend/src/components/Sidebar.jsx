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
    <div className="w-full h-full bg-white border-r border-slate-200 shadow-md z-10 p-0 flex flex-col shrink-0 text-slate-800">
      <div className="p-3 border-b border-slate-200 bg-slate-50 font-sans font-bold text-slate-700 text-sm uppercase tracking-wider">Universo de Fondos</div>
      <div className="p-3 border-b border-slate-200">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar nombre o ISIN..."
          className="w-full text-sm p-2 bg-white border border-slate-200 rounded shadow-sm outline-none focus:border-[var(--color-accent)] text-slate-700 transition-colors"
        />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {assets.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm italic">Cargando fondos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm italic">Sin resultados</div>
        ) : (
          filtered.map(f => (
            <div
              key={f.isin}
              onClick={() => onAddAsset(f)}
              className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center group transition-colors"
            >
              <div className="min-w-0 pr-2">
                <div className="text-sm font-bold text-slate-700 truncate" title={f.name}>{f.name}</div>
                <div className="text-xs text-slate-400 font-mono">{f.isin}</div>
              </div>
              <span className="text-[var(--color-accent)] font-bold opacity-0 group-hover:opacity-100 text-lg shrink-0">+</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

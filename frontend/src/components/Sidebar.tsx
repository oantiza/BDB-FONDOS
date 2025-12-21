import { useState } from 'react'

export default function Sidebar({ assets = [], onAddAsset, onViewDetail }) {
  const [term, setTerm] = useState('')

  const filtered = assets.filter(a => {
    const termMatch = a.name.toLowerCase().includes(term.toLowerCase()) || a.isin.toLowerCase().includes(term.toLowerCase())
    // Blacklist Base Indices
    const isBlacklisted = (a.isin === 'IE00B18GC888' || a.isin === 'IE00B03HCZ61')
    return termMatch && !isBlacklisted
  }).slice(0, 50)

  return (
    <div className="w-full h-full bg-white border-r border-gray-200 shadow-md z-10 p-0 flex flex-col shrink-0 text-gray-800">
      <div className="p-2 border-b border-gray-200 bg-gray-50 font-sans font-bold text-gray-700 text-xs uppercase tracking-wider">Universo de Inversión</div>
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar nombre o ISIN..."
          className="w-full text-sm p-2 bg-white border border-gray-200 shadow-sm outline-none focus:border-[var(--color-accent)] text-gray-700 transition-colors"
        />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {assets.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm italic">Cargando fondos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm italic">Sin resultados</div>
        ) : (
          filtered.map(f => (
            <div
              key={f.isin}
              className="p-3 border-b border-gray-100 hover:bg-gray-50 flex justify-between items-center group transition-colors first:border-t-0"
            >
              <div className="min-w-0 pr-2 flex-1">
                <div
                  onClick={() => onViewDetail && onViewDetail(f)}
                  className="text-sm font-bold text-gray-700 truncate cursor-pointer hover:text-brand hover:underline"
                  title="Ver detalle del fondo"
                >
                  {f.name}
                </div>
                <div className="text-xs text-gray-400 font-mono">{f.isin}</div>
              </div>
              <button
                onClick={() => onAddAsset(f)}
                className="text-[var(--color-accent)] font-bold opacity-0 group-hover:opacity-100 text-lg shrink-0 px-2 hover:bg-slate-200 rounded"
                title="Añadir a cartera"
              >
                +
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

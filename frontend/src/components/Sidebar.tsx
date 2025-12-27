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
    <div className="w-full h-full bg-white border-r border-slate-100 shadow-sm z-10 p-0 flex flex-col shrink-0 text-slate-700">
      <div className="p-4 border-b border-slate-50 flex justify-between items-center shrink-0">
        <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em] flex items-center gap-2">
          Universo de Inversión
        </h3>
      </div>
      <div className="p-3 border-b border-slate-50">
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar nombre o ISIN..."
          className="w-full text-sm p-2 bg-slate-50 border border-slate-100 rounded outline-none focus:border-slate-300 text-slate-700 transition-colors placeholder:text-slate-400"
        />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {assets.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm italic">Cargando fondos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm italic">Sin resultados</div>
        ) : (
          filtered.map(f => (
            <div
              key={f.isin}
              className="p-3 border-b border-slate-50 hover:bg-slate-50 flex justify-between items-center group transition-colors"
            >
              <div className="min-w-0 pr-2 flex-1">
                <div
                  onClick={() => onViewDetail && onViewDetail(f)}
                  className="text-sm font-bold text-slate-700 truncate cursor-pointer hover:text-[#003399] transition-colors"
                  title="Ver detalle del fondo"
                >
                  {f.name}
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">{f.isin}</div>
              </div>
              <button
                onClick={() => onAddAsset(f)}
                className="text-[#003399] font-bold opacity-0 group-hover:opacity-100 text-xs shrink-0 px-2 py-1 hover:bg-[#003399] hover:text-white rounded transition-all"
                title="Añadir a cartera"
              >
                AÑADIR
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

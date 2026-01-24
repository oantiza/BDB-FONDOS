import { useEffect, useMemo, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

type PresenceMap = Record<string, boolean>

const LS_KEY = 'historyPresence:v1'
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 días
const CONCURRENCY = 20

function loadCache(): { ts: number; data: PresenceMap } | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || !parsed?.data) return null
    return parsed
  } catch {
    return null
  }
}

function saveCache(data: PresenceMap) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // ignore
  }
}

async function runWithLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<void>
) {
  let i = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++
      await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
}

async function checkHasHistory(isin: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'historico_vl_v2', isin))
  if (!snap.exists()) return false
  const d: any = snap.data()

  // Compatibilidad: algunos docs usan "history", otros "series"
  const h = Array.isArray(d?.history) ? d.history : null
  const s = Array.isArray(d?.series) ? d.series : null

  return (h && h.length > 0) || (s && s.length > 0)
}

interface SidebarProps {
  assets?: any[];
  onAddAsset: (asset: any) => void;
  onViewDetail?: (asset: any) => void;
}

export default function Sidebar({ assets = [], onAddAsset, onViewDetail }: SidebarProps) {
  const [term, setTerm] = useState('')
  const [showNoHistory, setShowNoHistory] = useState(false)

  // Presencia real de histórico (historico_vl_v2)
  const [presenceMap, setPresenceMap] = useState<PresenceMap>({})
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const abortRef = useRef(false)

  const isins = useMemo(() => {
    const list = (assets || [])
      .map((a: any) => a?.isin)
      .filter((x: any) => typeof x === 'string' && x.length > 0)
    return Array.from(new Set(list))
  }, [assets])

  const isinsKey = useMemo(() => isins.slice().sort().join('|'), [isins])

  // Comprobación real de histórico (solo lectura) + caché
  useEffect(() => {
    abortRef.current = false

    async function run() {
      if (!isins.length) {
        setPresenceMap({})
        setChecking(false)
        setProgress({ done: 0, total: 0 })
        return
      }

      setChecking(true)
      setProgress({ done: 0, total: isins.length })

      const cache = loadCache()
      const cacheValid = cache && Date.now() - cache.ts < TTL_MS
      const base: PresenceMap = cacheValid ? { ...cache!.data } : {}

      // ISINs que faltan por comprobar
      const missing = isins.filter((isin) => base[isin] === undefined)

      // Publica cache ya conocido
      setPresenceMap((prev: PresenceMap) => ({ ...prev, ...base }))

      let completed = 0
      await runWithLimit(missing, CONCURRENCY, async (isin) => {
        if (abortRef.current) return
        try {
          const has = await checkHasHistory(isin)
          base[isin] = has
          if (!abortRef.current) {
            setPresenceMap((prev: PresenceMap) => ({ ...prev, [isin]: has }))
          }
        } catch {
          // Si falla, marcamos false (si prefieres puedes dejarlo undefined)
          base[isin] = false
          if (!abortRef.current) {
            setPresenceMap((prev: PresenceMap) => ({ ...prev, [isin]: false }))
          }
        } finally {
          completed++
          if (!abortRef.current) setProgress({ done: completed, total: isins.length })
        }
      })

      if (!abortRef.current) {
        saveCache(base)
        setChecking(false)
      }
    }

    run()
    return () => {
      abortRef.current = true
    }
  }, [isinsKey])

  const filteredAssets = useMemo(() => {
    const t = term.toLowerCase()

    return (assets || [])
      .filter((a: any) => {
        const name = (a?.name || '').toLowerCase()
        const isin = (a?.isin || '').toLowerCase()

        const termMatch = name.includes(t) || isin.includes(t)

        // Blacklist Base Indices
        const isBlacklisted = a?.isin === 'IE00B18GC888' || a?.isin === 'IE00B03HCZ61'

        // Histórico REAL
        const realHasHistory = a?.isin ? presenceMap[a.isin] === true : false

        // Mientras comprobamos y ese ISIN aún no está resuelto (undefined), no bloqueamos,
        // para evitar “lista vacía” temporal.
        const unknownYet = a?.isin ? presenceMap[a.isin] === undefined : true
        const effectiveHasHistory = checking && unknownYet ? true : realHasHistory

        // Toggle:
        // - showNoHistory=true  => mostrar todos
        // - showNoHistory=false => solo con histórico real
        const historyCheck = showNoHistory ? true : effectiveHasHistory

        // UX: si el usuario busca, muestra aunque no cumpla filtro
        const shouldShow = historyCheck || term.length > 0

        return termMatch && !isBlacklisted && shouldShow
      })
      .slice(0, 50)
  }, [assets, term, showNoHistory, presenceMap, checking])

  return (
    <div className="w-full h-full bg-white border-r border-slate-100 shadow-sm z-10 p-0 flex flex-col shrink-0 text-slate-700">
      <div className="p-4 border-b border-slate-50 flex justify-between items-center shrink-0">
        <h3 className="text-base font-bold text-[#A07147] uppercase tracking-[0.2em] flex items-center gap-2">
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

        <div className="flex items-center justify-between mt-2">
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showNoHistory}
              onChange={(e) => setShowNoHistory(e.target.checked)}
              className="rounded border-slate-300 text-[#A07147] focus:ring-[#A07147]"
            />
            Mostrar sin histórico
          </label>
          <div className="text-[10px] text-slate-400 italic">Clic para detalles</div>
        </div>

        {!showNoHistory && (
          <div className="mt-2 text-[11px] text-slate-400">
            {checking ? (
              <>Comprobando histórico real… {progress.done}/{progress.total}</>
            ) : (
              <>Histórico real verificado (historico_vl_v2) — caché 7 días</>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {assets.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm italic">Cargando fondos...</div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm italic">
            {term
              ? 'Sin resultados'
              : checking && !showNoHistory
                ? 'Comprobando histórico…'
                : 'No hay fondos con histórico disponible.'}
            <br />
            {!showNoHistory && (
              <span
                onClick={() => setShowNoHistory(true)}
                className="text-[#003399] underline cursor-pointer"
              >
                Mostrar todos
              </span>
            )}
          </div>
        ) : (
          filteredAssets.map((f: any) => {
            const realHasHistory = f?.isin ? presenceMap[f.isin] === true : false
            const unknownYet = f?.isin ? presenceMap[f.isin] === undefined : true
            const showWarn = !showNoHistory && !checking && !unknownYet && !realHasHistory

            return (
              <div
                key={f.isin}
                className={`p-3 border-b border-slate-50 hover:bg-slate-50 flex justify-between items-center group transition-colors ${showWarn ? 'opacity-80 bg-yellow-50/10' : ''
                  }`}
              >
                <div className="min-w-0 pr-2 flex-1">
                  <div
                    className="text-sm font-normal text-[#2C3E50] truncate leading-tight flex items-center gap-2"
                    title="Ver detalle del fondo"
                  >
                    <span
                      onClick={() => onViewDetail && onViewDetail(f)}
                      className="cursor-pointer hover:text-[#003399] hover:underline"
                    >
                      {f.name}
                    </span>
                    {showWarn && (
                      <span
                        className="text-[9px] px-1 bg-gray-100 text-gray-500 rounded border border-gray-200 cursor-help"
                        title="Sin histórico real en historico_vl_v2"
                      >
                        ⚠️
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[#A07147] font-bold uppercase tracking-wider mt-1">
                    {f.isin}
                  </div>
                </div>

                <button
                  onClick={() => onAddAsset(f)}
                  className="text-[#003399] font-bold opacity-0 group-hover:opacity-100 text-xs shrink-0 px-2 py-1 hover:bg-[#003399] hover:text-white rounded transition-all"
                  title="Añadir a cartera"
                >
                  AÑADIR
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

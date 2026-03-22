import { useEffect, useMemo, useRef, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCanonicalSubtype, getCanonicalType } from '../utils/normalizer'
import { getFormattedTaxonomy } from '../utils/taxonomyTranslators'

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

const ASSET_VARIANTS: Record<string, string[]> = {
  'RV': ['RV', 'Equity', 'Renta Variable', 'Stock', 'EQ', 'Renta Variable Global'],
  'RV - Tecnología': ['Tecnología', 'Technology', 'Tech', 'Renta Variable Sectorial - Tecnología'],
  'RV - Salud': ['Salud', 'Health', 'Healthcare', 'Renta Variable Sectorial - Salud', 'Sanidad'],
  'RF': ['RF', 'Fixed Income', 'Renta Fija', 'Bond', 'FI', 'Deuda'],
  'RF - Soberana': ['Soberana', 'Government', 'Renta Fija Gubernamental', 'Sovereign'],
  'RF - Corporativa': ['Corporativa', 'Corporate', 'Renta Fija Corporativa'],
  'RF - High Yield': ['High Yield', 'Alto Rendimiento', 'Renta Fija Alto Rendimiento'],
  'Monetario': ['Monetario', 'Money Market', 'Cash', 'Liquidez', 'MM'],
  'Mixto': ['Mixto', 'Mixed', 'Balanced', 'Allocation', 'Multi-Asset'],
  'Alternativos': ['Alternativos', 'Alternative', 'RETORNO ABSOLUTO', 'ABSOLUTE RETURN', 'Hedge']
};

export default function Sidebar({ assets = [], onAddAsset, onViewDetail }: SidebarProps) {
  const [term, setTerm] = useState('')
  const [category, setCategory] = useState('ALL')
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

        // Subcategory Check
        let categoryMatch = true;
        if (category !== 'ALL') {
          const v2 = a?.classification_v2;
          
          if (v2) {
             // Strict V2 matching
             if (category === 'RV') categoryMatch = v2.asset_type === 'EQUITY';
             else if (category === 'RV - Tecnología') categoryMatch = v2.asset_type === 'EQUITY' && v2.is_sector_fund && (v2.asset_subtype === 'TECHNOLOGY' || a?.name?.toLowerCase().includes('technolog') || a?.name?.toLowerCase().includes('tecnolog'));
             else if (category === 'RV - Salud') categoryMatch = v2.asset_type === 'EQUITY' && (v2.asset_subtype === 'HEALTHCARE' || v2.asset_subtype === 'HEALTH' || a?.name?.toLowerCase().includes('health') || a?.name?.toLowerCase().includes('salud'));
             else if (category === 'RF') categoryMatch = v2.asset_type === 'FIXED_INCOME';
             else if (category === 'RF - Soberana') categoryMatch = v2.asset_type === 'FIXED_INCOME' && v2.asset_subtype === 'GOVERNMENT_BOND';
             else if (category === 'RF - Corporativa') categoryMatch = v2.asset_type === 'FIXED_INCOME' && v2.asset_subtype === 'CORPORATE_BOND';
             else if (category === 'RF - High Yield') categoryMatch = v2.asset_type === 'FIXED_INCOME' && v2.asset_subtype === 'HIGH_YIELD_BOND';
             else if (category === 'Monetario') categoryMatch = v2.asset_type === 'MONEY_MARKET';
             else if (category === 'Mixto') categoryMatch = v2.asset_type === 'ALLOCATION';
             else if (category === 'Alternativos') categoryMatch = v2.asset_type === 'ALTERNATIVE';
          } else {
             // Legacy fallback
             const fundCat = a?.derived?.asset_class || a?.asset_class || '';
             const allowedCats = ASSET_VARIANTS[category] || [category];
             categoryMatch = allowedCats.includes(fundCat);
          }
        }

        return termMatch && categoryMatch && !isBlacklisted && shouldShow
      })
      .slice(0, 50)
  }, [assets, term, category, showNoHistory, presenceMap, checking])

  return (
    <div className="w-full h-full bg-white border-r border-slate-100 shadow-sm z-10 p-0 flex flex-col shrink-0 text-slate-700">
      <div className="px-4 py-3.5 bg-[#F8FAFC] border-b border-slate-200/60 flex justify-between items-center shrink-0">
        <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
          Universo de Inversión
        </h3>
      </div>

      <div className="px-4 py-3 border-b border-slate-50 flex flex-col gap-2.5">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full text-[11px] py-1.5 px-2 bg-slate-50/50 border border-slate-100 rounded outline-none focus:border-slate-300 text-slate-700 transition-colors font-semibold"
        >
          <option value="ALL">Clase de Activo (Todas)</option>
          <optgroup label="Grandes Bloques">
            <option value="RV">Renta Variable (General)</option>
            <option value="RF">Renta Fija (General)</option>
            <option value="Monetario">Monetario</option>
            <option value="Mixto">Mixto</option>
            <option value="Alternativos">Alternativos</option>
          </optgroup>
          <optgroup label="Sectores RV">
            <option value="RV - Tecnología">Tecnología</option>
            <option value="RV - Salud">Salud</option>
          </optgroup>
          <optgroup label="Especialización RF">
            <option value="RF - Soberana">Deuda Gubernamental</option>
            <option value="RF - Corporativa">Deuda Corporativa</option>
            <option value="RF - High Yield">Alto Rendimiento (HY)</option>
          </optgroup>
        </select>

        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar nombre o ISIN..."
          className="w-full text-[11px] py-1.5 px-2 bg-slate-50/50 border border-slate-100 rounded outline-none focus:border-slate-300 text-slate-700 transition-all placeholder:text-slate-400"
        />

        <div className="flex items-center justify-between mt-1 pt-1">
          <label className="flex items-center gap-1.5 text-[9px] text-slate-400 font-medium tracking-wide uppercase cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showNoHistory}
              onChange={(e) => setShowNoHistory(e.target.checked)}
              className="w-2.5 h-2.5 rounded border-slate-200 text-slate-500 focus:ring-transparent focus:ring-offset-0"
            />
            Mostrar sin histórico
          </label>
        </div>

        {!showNoHistory && (
          <div className="mt-2 text-[11px] text-slate-400">
            {checking ? (
              <>Comprobando histórico real… {progress.done}/{progress.total}</>
            ) : null}
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
                className={`py-3.5 px-4 border-b border-slate-50/50 hover:bg-slate-50/60 flex justify-between items-center group transition-colors ${showWarn ? 'opacity-80 bg-yellow-50/10' : ''
                  }`}
              >
                <div className="min-w-0 pr-3 flex-1 flex flex-col gap-1">
                  <div
                    className="text-[13px] font-semibold text-slate-800 truncate leading-snug flex items-center gap-2"
                    title="Ver detalle del fondo (Click)"
                  >
                    <span
                      onClick={() => onViewDetail && onViewDetail(f)}
                      className="cursor-pointer transition-colors hover:text-[#0B2545]"
                    >
                      {f.name}
                    </span>
                    {showWarn && (
                      <span
                        className="text-[9px] px-1 bg-gray-100/50 text-gray-400 rounded-sm cursor-help"
                        title="Sin histórico real en historico_vl_v2"
                      >
                        ⚠️
                      </span>
                    )}
                  </div>
                  <div className="text-[9.5px] text-slate-400 font-normal tracking-wide flex items-center">
                    <span className="text-slate-400 uppercase font-mono" title="ISIN">{f.isin}</span>
                    <span className="mx-2 text-slate-200 font-light">|</span>
                    <span className="truncate text-slate-400 uppercase" title="Clasificación V2">
                      {getFormattedTaxonomy(f)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onAddAsset(f)}
                  className="text-slate-500 font-bold opacity-0 group-hover:opacity-100 text-[10px] uppercase tracking-widest shrink-0 px-2.5 py-1.5 hover:bg-slate-100 hover:text-[#0B2545] rounded transition-all border border-transparent hover:border-slate-200"
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

/**
 * FundAuditor.tsx
 *
 * Read-only fund search panel for the Admin Console.
 * Calls admin_fund_search callable endpoint via adminConsoleService.
 *
 * Security contract:
 * - Solo lectura. No ejecuta escrituras en Firestore.
 * - No expone documentos completos. Backend devuelve campos sanitizados.
 * - No botones de escritura, edición, exportación ni rollback.
 */

import React, { useState, useCallback } from 'react';
import {
  searchAdminFunds,
  type AdminFundResult,
  type AdminFundSearchResponse,
} from '../../services/adminConsoleService';

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export default function FundAuditor() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [results, setResults] = useState<AdminFundResult[]>([]);
  const [resultMeta, setResultMeta] = useState<{ count: number; query: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setErrorMsg('Introduce al menos 2 caracteres para buscar.');
      setState('error');
      return;
    }

    setState('loading');
    setErrorMsg('');
    setResults([]);
    setResultMeta(null);

    try {
      const response: AdminFundSearchResponse = await searchAdminFunds(trimmed);
      if (response.results.length === 0) {
        setState('empty');
      } else {
        setResults(response.results);
        setResultMeta({ count: response.count, query: response.query });
        setState('results');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setErrorMsg(message);
      setState('error');
    }
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch]
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Info banner */}
      <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 shadow-sm">
        <div className="text-blue-500 text-xl mt-0.5">🔍</div>
        <div>
          <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-1">
            Consulta Read-Only
          </h3>
          <p className="text-xs text-blue-800/80 leading-relaxed max-w-2xl">
            Búsqueda mediante backend admin callable. Los resultados están sanitizados
            y no incluyen campos internos. No se escribe en Firestore.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
          Buscar por ISIN o nombre
        </label>
        <div className="flex gap-3">
          <input
            id="admin-fund-search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: BE0946564383 o DPAM"
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
            disabled={state === 'loading'}
          />
          <button
            id="admin-fund-search-btn"
            onClick={handleSearch}
            disabled={state === 'loading' || query.trim().length < 2}
            className="px-6 py-2.5 bg-[#1B2A47] text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-[#243454] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {state === 'loading' ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* States */}
      {state === 'loading' && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Consultando backend admin…</span>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <div>
            <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide mb-1">Error</h4>
            <p className="text-xs text-red-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {state === 'empty' && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
          <span className="text-4xl block mb-4 opacity-60">📭</span>
          <h4 className="text-sm font-bold text-slate-600 mb-1">Sin resultados</h4>
          <p className="text-xs text-slate-500">
            No se encontraron fondos para la consulta «{query.trim()}».
          </p>
        </div>
      )}

      {/* Results table */}
      {state === 'results' && results.length > 0 && (
        <div>
          {resultMeta && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Resultados ({resultMeta.count})
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                query: «{resultMeta.query}» · modo: read-only
              </span>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    ISIN
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Retrocesión
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    TER
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Asset Mix
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Riesgo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((fund) => (
                  <tr
                    key={fund.isin}
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-slate-700 font-medium">
                      {fund.isin}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-800 max-w-xs truncate" title={fund.name}>
                      {fund.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {fund.classification_v2?.asset_subtype || fund.classification_v2?.asset_type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-right font-mono">
                      {fund.manual?.costs?.retrocession != null ? (
                        <span className="text-emerald-700 font-medium">
                          {fund.manual.costs.retrocession.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-right font-mono">
                      {fund.manual?.costs?.ter != null ? (
                        <span className="text-slate-700">
                          {fund.manual.costs.ter.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {fund.portfolio_exposure_v2?.asset_mix ? (
                        <AssetMixBadge mix={fund.portfolio_exposure_v2.asset_mix} />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Sin datos</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <RiskBadge bucket={fund.classification_v2?.risk_bucket} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (inline, no exports)
// ---------------------------------------------------------------------------

function AssetMixBadge({ mix }: { mix: { equity?: number; bond?: number; cash?: number; other?: number } }) {
  const equity = Math.round((mix.equity || 0) * 100);
  const bond = Math.round((mix.bond || 0) * 100);

  return (
    <div className="flex items-center justify-center gap-1">
      {equity > 0 && (
        <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
          RV {equity}%
        </span>
      )}
      {bond > 0 && (
        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
          RF {bond}%
        </span>
      )}
      {equity === 0 && bond === 0 && (
        <span className="text-[10px] text-slate-400">—</span>
      )}
    </div>
  );
}

function RiskBadge({ bucket }: { bucket?: string }) {
  if (!bucket) return <span className="text-[10px] text-slate-400">—</span>;

  const colors: Record<string, string> = {
    LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    HIGH: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <span
      className={`inline-block text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${
        colors[bucket] || 'bg-slate-100 text-slate-600 border-slate-200'
      }`}
    >
      {bucket}
    </span>
  );
}

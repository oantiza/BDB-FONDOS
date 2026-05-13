/**
 * RetroPreviewTable.tsx
 *
 * Diff preview table for dry-run results.
 * Columns: #, ISIN, Nombre, Retro Actual, Retro Nueva, Δ, Estado, Motivo, Acción.
 * Filterable by status (OK / WARNING / BLOCKED / UNCHANGED / ALL).
 *
 * SECURITY: Pure presentation component. No Firestore access. No writes.
 */
import React, { useState, useMemo } from 'react';
import type { RetroDryRunResult } from '../../utils/retroParser';

type StatusFilter = 'ALL' | 'OK' | 'WARNING' | 'BLOCKED' | 'UNCHANGED';

interface Props {
  results: RetroDryRunResult[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  OK: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  WARNING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  BLOCKED: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  UNCHANGED: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
};

const FILTER_OPTIONS: { value: StatusFilter; label: string; color: string }[] = [
  { value: 'ALL', label: 'Todos', color: 'bg-slate-100 text-slate-700' },
  { value: 'OK', label: 'OK', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'WARNING', label: 'Warning', color: 'bg-amber-100 text-amber-700' },
  { value: 'BLOCKED', label: 'Blocked', color: 'bg-red-100 text-red-700' },
  { value: 'UNCHANGED', label: 'Sin cambios', color: 'bg-slate-100 text-slate-500' },
];

function formatRetro(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(4)}%`;
}

function formatDelta(delta: number | null): string {
  if (delta === null || delta === undefined) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(4)} pp`;
}

export default function RetroPreviewTable({ results }: Props) {
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const filtered = useMemo(() => {
    if (filter === 'ALL') return results;
    return results.filter((r) => r.status === filter);
  }, [results, filter]);

  const counts = useMemo(() => {
    const c = { ALL: results.length, OK: 0, WARNING: 0, BLOCKED: 0, UNCHANGED: 0 };
    results.forEach((r) => {
      if (r.status in c) c[r.status as keyof typeof c]++;
    });
    return c;
  }, [results]);

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-sm">No hay resultados de dry-run para mostrar</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              filter === opt.value
                ? `${opt.color} ring-2 ring-offset-1 ring-blue-400 shadow-sm`
                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
            }`}
          >
            {opt.label} ({counts[opt.value]})
          </button>
        ))}
      </div>

      {/* Results table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">ISIN</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="text-right px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Retro Actual</th>
                <th className="text-right px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Retro Nueva</th>
                <th className="text-right px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Δ</th>
                <th className="text-center px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="text-left px-3 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row, idx) => {
                const style = STATUS_STYLES[row.status] || STATUS_STYLES.UNCHANGED;
                return (
                  <tr key={`${row.isin}-${row.row_number}-${idx}`} className={`${style.bg} hover:brightness-95 transition-all`}>
                    <td className="px-3 py-2.5 text-xs text-slate-400 font-mono">{row.row_number}</td>
                    <td className="px-3 py-2.5 text-xs font-mono font-medium text-slate-700">{row.isin}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 max-w-[200px] truncate" title={row.firestore_name}>
                      {row.firestore_name || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-mono text-slate-500">
                      {formatRetro(row.current_retro)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-mono font-medium">
                      <span className={style.text}>{formatRetro(row.new_retro)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-right font-mono">
                      <span className={row.delta && row.delta !== 0 ? 'text-blue-600 font-medium' : 'text-slate-400'}>
                        {formatDelta(row.delta)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${style.text} ${style.bg} border ${style.border}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500 max-w-[250px] truncate" title={row.reason}>
                      {row.reason || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-slate-400 text-right">
        Mostrando {filtered.length} de {results.length} filas
      </div>
    </div>
  );
}

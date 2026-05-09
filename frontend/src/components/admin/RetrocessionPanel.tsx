/**
 * RetrocessionPanel.tsx
 *
 * Read-only retrocession status panel for the Admin Console.
 *
 * Displays audited data from the last retrocession write gate:
 * - Summary cards (44 updated, 3 excluded, 0 failures, 0 new docs)
 * - Excluded funds table
 * - Versioned artifacts references
 * - Security rules
 *
 * SECURITY:
 * - No Firestore writes.
 * - No callable endpoints.
 * - No CSV upload.
 * - No rollback functionality.
 * - No parser or Gemini.
 * - Pure static/audited data presentation.
 */
import React from 'react';

// ---------------------------------------------------------------------------
// Exported constants (for tests)
// ---------------------------------------------------------------------------

export const RETROCESSION_SUMMARY = {
  write_gate: 'COMPLETADO',
  updated_count: 44,
  excluded_count: 3,
  failures: 0,
  created_docs: 0,
  post_write_verification: '44/44 PASS',
  gate_version: 'write_gate_2',
  date: '2026-04-28',
} as const;

export const RETROCESSION_EXCLUDED_FUNDS: ReadonlyArray<{
  isin: string;
  retrocession: number;
  reason: string;
}> = [
  { isin: 'IE00BYR8H148', retrocession: 0.50, reason: 'Retrocesión ya correcta en funds_v3' },
  { isin: 'LU0235308482', retrocession: 0.50, reason: 'Retrocesión ya correcta en funds_v3' },
  { isin: 'LU1762221155', retrocession: 1.38, reason: 'Retrocesión ya correcta en funds_v3' },
];

export const RETROCESSION_ARTIFACTS: ReadonlyArray<{
  filename: string;
  description: string;
}> = [
  { filename: 'pre_write_snapshot.json', description: 'Snapshot pre-escritura de los 47 fondos' },
  { filename: 'write_plan.json',         description: 'Plan de escritura con campos a actualizar' },
  { filename: 'rollback_manifest.json',  description: 'Manifiesto de rollback con valores originales' },
  { filename: 'post_write_verification.json', description: 'Verificación post-escritura 44/44 PASS' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RetrocessionPanel() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Read-only banner */}
      <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="text-amber-500 text-2xl mt-0.5">💰</div>
        <div>
          <h2 className="text-sm font-bold text-amber-900 tracking-wide uppercase mb-1">
            Modo solo lectura
          </h2>
          <p className="text-sm text-amber-800/80 leading-relaxed max-w-3xl">
            No hay carga de CSV, escritura ni rollback desde esta pantalla. Los datos mostrados
            provienen del último write gate auditado y versionado.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Resumen Write Gate
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <SummaryCard label="Write Gate" value={RETROCESSION_SUMMARY.write_gate} color="emerald" />
          <SummaryCard label="Actualizadas" value={String(RETROCESSION_SUMMARY.updated_count)} color="emerald" />
          <SummaryCard label="Excluidas" value={String(RETROCESSION_SUMMARY.excluded_count)} color="amber" />
          <SummaryCard label="Fallos" value={String(RETROCESSION_SUMMARY.failures)} color="emerald" />
          <SummaryCard label="Docs Nuevos" value={String(RETROCESSION_SUMMARY.created_docs)} color="slate" />
          <SummaryCard label="Verificación" value={RETROCESSION_SUMMARY.post_write_verification} color="emerald" />
        </div>
      </div>

      {/* Excluded funds */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          3 fondos excluidos — mantenidos sin cambios
        </h3>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  ISIN
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Retrocesión (%)
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Motivo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RETROCESSION_EXCLUDED_FUNDS.map((fund) => (
                <tr key={fund.isin} className="hover:bg-amber-50/30 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-slate-700 font-medium">
                    {fund.isin}
                  </td>
                  <td className="px-4 py-3 text-xs text-right font-mono">
                    <span className="text-amber-700 font-medium">
                      {fund.retrocession.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {fund.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Artifacts */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Artifacts versionados
        </h3>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Archivo
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Descripción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RETROCESSION_ARTIFACTS.map((art) => (
                <tr key={art.filename} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-blue-700 font-medium">
                    📄 {art.filename}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {art.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 font-medium">
          Ruta: artifacts/bdb_data_audit/retrocession_write_gate_2/
        </p>
      </div>

      {/* Security rules */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Reglas de seguridad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SecurityRule icon="🚫" label="No escrituras Firestore desde esta UI" />
          <SecurityRule icon="🚫" label="No carga de CSV" />
          <SecurityRule icon="🚫" label="No rollback funcional" />
          <SecurityRule icon="🚫" label="No parser ni Gemini" />
          <SecurityRule icon="🔒" label="Datos auditados y versionados" />
          <SecurityRule icon="🔒" label="Solo lectura — sin acciones mutativas" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (inline, no exports)
// ---------------------------------------------------------------------------

function SummaryCard({ label, value, color }: { label: string; value: string; color: 'emerald' | 'amber' | 'slate' }) {
  const styles = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber:   'bg-amber-50 border-amber-200 text-amber-800',
    slate:   'bg-slate-50 border-slate-200 text-slate-700',
  };

  return (
    <div className={`border rounded-xl p-4 text-center ${styles[color]}`}>
      <div className="text-lg font-bold mb-1">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

function SecurityRule({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
      <span className="text-base">{icon}</span>
      <span className="text-xs text-slate-600 font-medium">{label}</span>
    </div>
  );
}

/**
 * SettingsPanel.tsx
 *
 * Read-only view of Admin Console configuration and global state.
 *
 * SECURITY:
 * - No Firestore reads or writes.
 * - No callable endpoints.
 * - No settings mutations.
 * - No forms, toggles, or interactive controls.
 * - No localStorage writes.
 * - No parser or Gemini execution.
 * - Pure static/audited presentation.
 */
import React from 'react';

// ---------------------------------------------------------------------------
// Exported constants (for tests)
// ---------------------------------------------------------------------------

export const ADMIN_SETTINGS_STATUS = {
  mode: 'READ_ONLY' as const,
  modules_implemented: 8,
  modules_total: 8,
  backend_admin: 'deployed/read-only',
  firestore_writes: 'disabled from UI',
  parser_gemini: 'disabled from Admin',
  write_gates: 'disabled from UI',
} as const;

export const ADMIN_SETTINGS_MODULES: ReadonlyArray<{ id: string; label: string; status: string }> = [
  { id: 'dashboard',     label: 'Dashboard',               status: 'implemented' },
  { id: 'retrocessions', label: 'Retrocesiones',           status: 'implemented/read-only' },
  { id: 'funds',         label: 'Funds v3 Audit',          status: 'implemented/read-only' },
  { id: 'logs',          label: 'Logs / Artifacts',        status: 'implemented/read-only' },
  { id: 'review',        label: 'Review Queue',            status: 'implemented/read-only' },
  { id: 'optimizer',     label: 'Optimizer / Constraints', status: 'implemented/read-only' },
  { id: 'parser',        label: 'Parser',                  status: 'implemented/read-only' },
  { id: 'settings',      label: 'Settings',                status: 'implemented/read-only' },
];

export const ADMIN_SETTINGS_BACKEND_FUNCTIONS: ReadonlyArray<{ name: string; status: string; type: string }> = [
  { name: 'admin_health',      status: 'deployed', type: 'read-only' },
  { name: 'admin_fund_search', status: 'deployed', type: 'read-only' },
];

export const ADMIN_SETTINGS_SECURITY_INVARIANTS: ReadonlyArray<{ icon: string; label: string }> = [
  { icon: '🚫', label: 'No Firestore writes desde Admin UI' },
  { icon: '🚫', label: 'No functions deploy from UI' },
  { icon: '🚫', label: 'No firestore.rules deploy from UI' },
  { icon: '🚫', label: 'No storage deploy from UI' },
  { icon: '🚫', label: 'No parser execution desde Admin' },
  { icon: '🚫', label: 'No Gemini calls desde Admin' },
  { icon: '🚫', label: 'No PDF upload desde Admin' },
  { icon: '🚫', label: 'No write gates from UI' },
  { icon: '🔒', label: 'Solo lectura — sin acciones mutativas' },
  { icon: '🔒', label: 'Settings no guardan cambios' },
];

export const ADMIN_SETTINGS_FUTURE_DISABLED: ReadonlyArray<{ feature: string; status: string }> = [
  { feature: 'Dynamic module registry',  status: 'future / disabled' },
  { feature: 'Artifact backend index',   status: 'future / disabled' },
  { feature: 'Audit logs UI',            status: 'future / disabled' },
  { feature: 'Role management',          status: 'future / disabled' },
  { feature: 'Write gate approvals',     status: 'future / disabled' },
];

// ---------------------------------------------------------------------------
// Status card color
// ---------------------------------------------------------------------------

const STATUS_CARD_COLORS: Record<string, string> = {
  'READ_ONLY': 'bg-blue-100 text-blue-800',
  '8/8': 'bg-emerald-100 text-emerald-800',
  'deployed/read-only': 'bg-emerald-100 text-emerald-800',
  'disabled from UI': 'bg-slate-100 text-slate-600',
  'disabled from Admin': 'bg-slate-100 text-slate-600',
};

const STATUS_CARDS = [
  { label: 'Admin mode',        value: ADMIN_SETTINGS_STATUS.mode },
  { label: 'Modules',           value: `${ADMIN_SETTINGS_STATUS.modules_implemented}/${ADMIN_SETTINGS_STATUS.modules_total}` },
  { label: 'Backend admin',     value: ADMIN_SETTINGS_STATUS.backend_admin },
  { label: 'Firestore writes',  value: ADMIN_SETTINGS_STATUS.firestore_writes },
  { label: 'Parser/Gemini',     value: ADMIN_SETTINGS_STATUS.parser_gemini },
  { label: 'Write gates',       value: ADMIN_SETTINGS_STATUS.write_gates },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPanel() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Read-only banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="text-slate-500 text-2xl mt-0.5">🛠️</div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase mb-1">
            Panel solo lectura
          </h2>
          <p className="text-sm text-slate-700/80 leading-relaxed max-w-3xl">
            Esta pantalla no guarda cambios ni activa funciones.
            Muestra la configuración auditada de la Consola Admin.
          </p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_CARDS.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 text-center ${STATUS_CARD_COLORS[card.value] || 'bg-slate-100 text-slate-600'}`}>
            <div className="text-base font-black">{card.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Admin modules */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Módulos Admin
        </h3>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Módulo</th>
                <th className="text-center px-5 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ADMIN_SETTINGS_MODULES.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 text-slate-700 font-medium">{m.label}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-block text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border bg-emerald-100 text-emerald-800 border-emerald-200 leading-none">
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backend admin functions */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Backend Admin
        </h3>
        <div className="space-y-3">
          {ADMIN_SETTINGS_BACKEND_FUNCTIONS.map((fn) => (
            <div key={fn.name} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-xl shrink-0">
                ✅
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-800 font-mono">{fn.name}</h4>
                <p className="text-xs text-slate-500">{fn.status} — {fn.type}</p>
              </div>
            </div>
          ))}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-xl shrink-0">
              🚫
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No write endpoints</h4>
              <p className="text-xs text-slate-500">No hay endpoints de escritura expuestos en la Consola Admin.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security invariants */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Invariantes de seguridad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ADMIN_SETTINGS_SECURITY_INVARIANTS.map((inv) => (
            <div key={inv.label} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
              <span className="text-base">{inv.icon}</span>
              <span className="text-xs text-slate-600 font-medium">{inv.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Future features */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Funcionalidades futuras (no activas)
        </h3>
        <div className="space-y-2">
          {ADMIN_SETTINGS_FUTURE_DISABLED.map((f) => (
            <div key={f.feature} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                {f.status}
              </span>
              <span className="text-xs text-slate-500">{f.feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

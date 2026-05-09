/**
 * OptimizerConstraintsPanel.tsx
 *
 * Read-only view of optimizer contracts, constraints and canonical decisions
 * for the Admin Console.
 *
 * SECURITY:
 * - No Firestore reads or writes.
 * - No callable endpoints.
 * - No optimizer runtime calls.
 * - No cleanup/apply/fix actions.
 * - No parser or Gemini execution.
 * - Pure static/audited presentation.
 */
import React from 'react';

// ---------------------------------------------------------------------------
// Exported constants (for tests)
// ---------------------------------------------------------------------------

export const OPTIMIZER_DECISIONS: ReadonlyArray<{ key: string; summary: string; detail: string }> = [
  {
    key: 'mixto-not-hard-constraint',
    summary: 'Mixto no es hard constraint',
    detail: 'La clasificación "MIXTO" es metadata comercial y de reporting. No debe inyectarse como restricción dura del solver.',
  },
  {
    key: 'asset-mix-source',
    summary: 'portfolio_exposure_v2.asset_mix es fuente económica',
    detail: 'El desglose look-through de RV/RF debe obtenerse de portfolio_exposure_v2.asset_mix, no de la clasificación comercial.',
  },
  {
    key: 'classification-v2-identity',
    summary: 'classification_v2 es identidad/metadata/suitability',
    detail: 'classification_v2 define la identidad del fondo para filtrado, suitability y reporting. No sustituye la exposición real.',
  },
  {
    key: 'fallback-50-50',
    summary: 'Fallback 50/50 con warnings auditables',
    detail: 'Cuando un fondo MIXTO carece de asset_mix, se aplica fallback 50% RV / 50% RF con warning visible en la UX.',
  },
];

export const OPTIMIZER_PENDING_CLEANUPS: ReadonlyArray<{ id: string; description: string; severity: string }> = [
  {
    id: 'risk_level-vs-profile_id',
    description: 'risk_level vs profile_id: dos campos mapean el perfil de riesgo con fuentes distintas.',
    severity: 'media',
  },
  {
    id: 'optimization_mode-multi',
    description: 'optimization_mode: presente en múltiples puntos del payload con posible divergencia.',
    severity: 'media',
  },
  {
    id: 'locked_positions-vs-fixed_weights',
    description: 'locked_positions vs fixed_weights / lock_mode: solapamiento en la semántica de posiciones bloqueadas.',
    severity: 'alta',
  },
  {
    id: 'bucket_bounds_v1-vs-current',
    description: 'bucket_bounds_v1 vs current_risk_buckets: herencia de estructura legacy en bounds.',
    severity: 'baja',
  },
];

export const OPTIMIZER_CONTRACT_TESTS: ReadonlyArray<{ name: string; status: string; suite: string }> = [
  {
    name: 'Canonical constraints contract',
    status: 'PASS',
    suite: 'optimizerP0Contract.test.ts',
  },
  {
    name: 'Mixed look-through contract',
    status: 'PASS',
    suite: 'mixedFunds.test.ts',
  },
  {
    name: 'Fallback volatility status',
    status: 'PASS',
    suite: 'optimizerP0Contract.test.ts',
  },
  {
    name: 'Frontend optimizer P0 contract',
    status: 'PASS',
    suite: 'optimizerP0Contract.test.ts',
  },
  {
    name: 'RulesEngine frontend suite',
    status: 'PASS',
    suite: 'rulesEngine.test.ts',
  },
  {
    name: 'Suitability classification suite',
    status: 'PASS',
    suite: 'suitability.test.ts',
  },
];

export const OPTIMIZER_STATUS_CARDS: ReadonlyArray<{ label: string; value: string; color: string }> = [
  { label: 'Mixto', value: 'Reporting', color: 'bg-blue-100 text-blue-800' },
  { label: 'Solver', value: 'Look-through', color: 'bg-emerald-100 text-emerald-800' },
  { label: 'Tests canónicos', value: 'Cubiertos', color: 'bg-emerald-100 text-emerald-800' },
  { label: 'Fallback UX', value: 'Auditado', color: 'bg-emerald-100 text-emerald-800' },
  { label: 'Cleanup', value: 'Pendiente', color: 'bg-amber-100 text-amber-800' },
  { label: 'Runtime changes', value: 'Ninguno', color: 'bg-slate-100 text-slate-600' },
];

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const SEVERITY_DOT: Record<string, string> = {
  alta: 'bg-red-500',
  media: 'bg-amber-500',
  baja: 'bg-slate-400',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OptimizerConstraintsPanel() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Read-only banner */}
      <div className="bg-violet-50/50 border border-violet-200 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="text-violet-500 text-2xl mt-0.5">⚙️</div>
        <div>
          <h2 className="text-sm font-bold text-violet-900 tracking-wide uppercase mb-1">
            Panel solo lectura
          </h2>
          <p className="text-sm text-violet-800/80 leading-relaxed max-w-3xl">
            Esta pantalla no modifica constraints ni ejecuta optimizaciones.
            Muestra el estado auditado de decisiones y contratos del optimizador.
          </p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {OPTIMIZER_STATUS_CARDS.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 text-center ${card.color}`}>
            <div className="text-base font-black">{card.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Canonical decisions */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Decisiones canónicas
        </h3>
        <div className="space-y-3">
          {OPTIMIZER_DECISIONS.map((d) => (
            <div key={d.key} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-xl shrink-0">
                  ✅
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">{d.summary}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{d.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending cleanups */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Duplicidades pendientes
        </h3>
        <div className="space-y-3">
          {OPTIMIZER_PENDING_CLEANUPS.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-xl shrink-0">
                  ⚠️
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-800">{c.id}</h4>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border bg-white/60 leading-none`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[c.severity] || 'bg-slate-400'}`} />
                      {c.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{c.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract tests */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Contratos y tests
        </h3>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Contrato</th>
                <th className="text-left px-5 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Suite</th>
                <th className="text-center px-5 py-3 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {OPTIMIZER_CONTRACT_TESTS.map((t) => (
                <tr key={t.name} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 text-slate-700 font-medium">{t.name}</td>
                  <td className="px-5 py-3 text-slate-500 font-mono text-[10px]">{t.suite}</td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-block text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border bg-emerald-100 text-emerald-800 border-emerald-200 leading-none">
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Next steps */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Próximos pasos recomendados
        </h3>
        <div className="space-y-2">
          <NextStep code="BDB-OPT-PAYLOAD-CONTRACT-CLEANUP-0" label="Cleanup del contrato payload frontend ↔ backend." />
          <NextStep code="BDB-OPT-CONSTRAINTS-CANONICAL-FIX-1" label="Resolver duplicidades de constraints canónicos." />
          <NextStep code="BDB-ADMIN-OPTIMIZER-DYNAMIC-READONLY-0" label="Lectura dinámica de constraints desde backend (futuro)." />
        </div>
      </div>

      {/* Security rules */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Reglas de seguridad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SecurityRule icon="🚫" label="No llamadas al optimizador" />
          <SecurityRule icon="🚫" label="No modificación de constraints" />
          <SecurityRule icon="🚫" label="No escrituras Firestore" />
          <SecurityRule icon="🚫" label="No acciones de cleanup/fix" />
          <SecurityRule icon="🔒" label="Datos estáticos auditados" />
          <SecurityRule icon="🔒" label="Solo lectura — sin acciones mutativas" />
        </div>
      </div>
    </div>
  );
}

function NextStep({ code, label }: { code: string; label: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
      <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shrink-0">
        {code}
      </span>
      <span className="text-xs text-slate-600">{label}</span>
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

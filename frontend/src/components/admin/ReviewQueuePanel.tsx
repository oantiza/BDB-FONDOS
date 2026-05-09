/**
 * ReviewQueuePanel.tsx
 *
 * Read-only review queue for the Admin Console.
 *
 * SECURITY:
 * - No Firestore reads or writes.
 * - No callable endpoints.
 * - No resolve/approve/write actions.
 * - No parser or Gemini execution.
 * - Pure static/audited queue presentation.
 */
import React, { useState, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Exported types & constants (for tests)
// ---------------------------------------------------------------------------

export type ReviewSeverity = 'alta' | 'media' | 'baja';
export type ReviewCategory = 'Retrocesiones' | 'Datos' | 'Mixtos' | 'Parser' | 'Optimizer' | 'Admin';

export const REVIEW_QUEUE_CATEGORIES: ReadonlyArray<ReviewCategory> = [
  'Retrocesiones', 'Datos', 'Mixtos', 'Parser', 'Optimizer', 'Admin',
];

export const REVIEW_QUEUE_SEVERITIES: ReadonlyArray<ReviewSeverity> = ['alta', 'media', 'baja'];

export interface ReviewItem {
  id: string;
  category: ReviewCategory;
  severity: ReviewSeverity;
  status: string;
  title: string;
  description: string;
  origin: string;
  nextAction: string;
}

export const REVIEW_QUEUE_ITEMS: ReadonlyArray<ReviewItem> = [
  {
    id: 'retro-excluded-ie00byr8h148',
    category: 'Retrocesiones',
    severity: 'alta',
    status: 'Mantener BD',
    title: 'IE00BYR8H148 excluido del write gate',
    description: 'CSV con retrocesión vacía; se mantuvo valor BD 0.50%. Requiere verificación manual del motivo de ausencia en CSV.',
    origin: 'BDB_RETROCESSION_WRITE_GATE_2.md',
    nextAction: 'Confirmar con proveedor si el fondo fue descatalogado o si la retrocesión cambió.',
  },
  {
    id: 'retro-excluded-lu0235308482',
    category: 'Retrocesiones',
    severity: 'media',
    status: 'Mantener BD',
    title: 'LU0235308482 excluido del write gate',
    description: 'CSV reportó 0%; se mantuvo BD 0.50%. Sin impacto operativo inmediato.',
    origin: 'BDB_RETROCESSION_WRITE_GATE_2.md',
    nextAction: 'Revisar en próximo ciclo de actualización CSV.',
  },
  {
    id: 'retro-excluded-lu1762221155',
    category: 'Retrocesiones',
    severity: 'alta',
    status: 'Mantener BD',
    title: 'LU1762221155 excluido del write gate',
    description: 'CSV reportó 0%; se mantuvo BD 1.38%. Cambio significativo que podría afectar cálculos de costes.',
    origin: 'BDB_RETROCESSION_WRITE_GATE_2.md',
    nextAction: 'Verificar con gestora el valor actual de retrocesión.',
  },
  {
    id: 'retro-not-found-44',
    category: 'Datos',
    severity: 'media',
    status: 'Excluido',
    title: '44 ISINs del CSV no encontrados en funds_v3',
    description: 'Durante el dry-run, 44 ISINs del CSV de retrocesiones no coincidieron con ningún documento en funds_v3. Fueron excluidos del write gate.',
    origin: 'BDB_RETROCESSION_RELOAD_DRY_RUN_REAL_1_REVIEW.md',
    nextAction: 'Clasificar ISINs: ¿fondos retirados, renombrados o no registrados?',
  },
  {
    id: 'mixed-lookthrough-missing',
    category: 'Mixtos',
    severity: 'media',
    status: 'Pendiente',
    title: 'Mixtos sin portfolio_exposure_v2.asset_mix',
    description: 'Fondos clasificados como MIXTO pueden carecer de desglose look-through en portfolio_exposure_v2. Afecta precisión del análisis X-Ray.',
    origin: 'BDB_OPTIMIZER_MIXED_UX_CLOSEOUT.md',
    nextAction: 'Auditar fondos MIXTO y completar asset_mix donde sea posible.',
  },
  {
    id: 'fallback-volatility-warnings',
    category: 'Optimizer',
    severity: 'media',
    status: 'Monitorizar',
    title: 'Warnings de fallback volatility activos',
    description: 'El optimizador usa volatilidad estimada cuando no hay datos históricos suficientes. Los warnings ya se muestran en la UX.',
    origin: 'BDB_OPTIMIZER_UX_FALLBACK_VOLATILITY_0.md',
    nextAction: 'Mantener monitorización; escalar si la proporción de fallbacks supera el 10%.',
  },
  {
    id: 'constraints-canonical-cleanup',
    category: 'Optimizer',
    severity: 'baja',
    status: 'Planificado',
    title: 'Cleanup canónico de constraints y payload',
    description: 'Payload y constraints del optimizador tienen campos legacy pendientes de limpieza. No afecta funcionalidad actual.',
    origin: 'BDB_OPTIMIZER_CONSTRAINTS_CANONICAL_CLEANUP_PLAN.md',
    nextAction: 'Ejecutar plan de cleanup documentado cuando haya ventana de mantenimiento.',
  },
  {
    id: 'parser-review-queue',
    category: 'Parser',
    severity: 'media',
    status: 'Pendiente',
    title: 'Exponer cola REVIEW/BLOCKED del parser',
    description: 'El parser Morningstar tiene estados REVIEW y BLOCKED que aún no se visualizan en la consola admin. Requiere integración futura.',
    origin: 'BDB_ADMIN_CONSOLE_DESIGN_0.md',
    nextAction: 'Implementar lectura read-only de estados parser sin ejecutar Gemini.',
  },
  {
    id: 'artifacts-dynamic-index',
    category: 'Admin',
    severity: 'baja',
    status: 'Futuro',
    title: 'Logs / Artifacts: catálogo aún estático',
    description: 'El panel Logs / Artifacts muestra un catálogo estático hardcoded. Versión futura podría leer índice dinámico desde backend.',
    origin: 'BDB_ADMIN_ARTIFACTS_READONLY_UI_0.md',
    nextAction: 'Evaluar endpoint read-only para indexación dinámica de artifacts.',
  },
];

export const REVIEW_QUEUE_SUMMARY = {
  total: REVIEW_QUEUE_ITEMS.length,
  alta: REVIEW_QUEUE_ITEMS.filter((i) => i.severity === 'alta').length,
  media: REVIEW_QUEUE_ITEMS.filter((i) => i.severity === 'media').length,
  baja: REVIEW_QUEUE_ITEMS.filter((i) => i.severity === 'baja').length,
  categories: [...new Set(REVIEW_QUEUE_ITEMS.map((i) => i.category))].length,
};

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<ReviewSeverity, { bg: string; text: string; dot: string }> = {
  alta:  { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',    dot: 'bg-red-500' },
  media: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700',  dot: 'bg-amber-500' },
  baja:  { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600',  dot: 'bg-slate-400' },
};

const CATEGORY_ICONS: Record<ReviewCategory, string> = {
  Retrocesiones: '💰',
  Datos: '📊',
  Mixtos: '🔀',
  Parser: '📄',
  Optimizer: '⚙️',
  Admin: '🛠️',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReviewQueuePanel() {
  const [activeFilter, setActiveFilter] = useState<string>('Todos');

  const filtered = useMemo(() => {
    if (activeFilter === 'Todos') return [...REVIEW_QUEUE_ITEMS];
    if (REVIEW_QUEUE_SEVERITIES.includes(activeFilter as ReviewSeverity)) {
      return REVIEW_QUEUE_ITEMS.filter((i) => i.severity === activeFilter);
    }
    return REVIEW_QUEUE_ITEMS.filter((i) => i.category === activeFilter);
  }, [activeFilter]);

  const filters = ['Todos', 'alta', 'media', 'baja', ...REVIEW_QUEUE_CATEGORIES];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Read-only banner */}
      <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="text-amber-500 text-2xl mt-0.5">📋</div>
        <div>
          <h2 className="text-sm font-bold text-amber-900 tracking-wide uppercase mb-1">
            Cola solo lectura
          </h2>
          <p className="text-sm text-amber-800/80 leading-relaxed max-w-3xl">
            Esta pantalla no resuelve, aprueba ni escribe cambios.
            Los elementos se muestran con fines de supervisión y auditoría.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Total Items" value={REVIEW_QUEUE_SUMMARY.total} color="bg-slate-100 text-slate-800" />
        <SummaryCard label="Alta" value={REVIEW_QUEUE_SUMMARY.alta} color="bg-red-100 text-red-800" />
        <SummaryCard label="Media" value={REVIEW_QUEUE_SUMMARY.media} color="bg-amber-100 text-amber-800" />
        <SummaryCard label="Baja" value={REVIEW_QUEUE_SUMMARY.baja} color="bg-slate-100 text-slate-600" />
        <SummaryCard label="Categorías" value={REVIEW_QUEUE_SUMMARY.categories} color="bg-blue-100 text-blue-800" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md border transition-all ${
              activeFilter === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
            }`}
          >
            {f === 'alta' ? '🔴 Alta' : f === 'media' ? '🟡 Media' : f === 'baja' ? '⚪ Baja' : f}
          </button>
        ))}
      </div>

      {/* Results count */}
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-2">
        Items ({filtered.length})
      </h3>

      {/* Review items */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const sev = SEVERITY_STYLES[item.severity];
          return (
            <div
              key={item.id}
              className={`border rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${sev.bg}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center text-xl shrink-0 border border-slate-100">
                  {CATEGORY_ICONS[item.category]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border leading-none ${sev.text} bg-white/60`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                      {item.severity}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border bg-white/60 text-slate-500 border-slate-200 leading-none">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2 leading-relaxed">{item.description}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-slate-400">
                    <span>
                      <span className="font-semibold text-slate-500">Origen:</span> {item.origin}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-500">Categoría:</span> {item.category}
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-500 bg-white/40 rounded-md px-3 py-2 border border-slate-100">
                    <span className="font-semibold">Siguiente acción:</span> {item.nextAction}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-12">
            No se encontraron items con ese filtro.
          </div>
        )}
      </div>

      {/* Security rules */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Reglas de seguridad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SecurityRule icon="🚫" label="No acciones de resolución" />
          <SecurityRule icon="🚫" label="No aprobación de cambios" />
          <SecurityRule icon="🚫" label="No escrituras Firestore" />
          <SecurityRule icon="🚫" label="No ejecución de parser ni Gemini" />
          <SecurityRule icon="🔒" label="Cola estática auditada" />
          <SecurityRule icon="🔒" label="Solo lectura — sin acciones mutativas" />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${color}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{label}</div>
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

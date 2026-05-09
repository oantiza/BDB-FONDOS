/**
 * ParserPanel.tsx
 *
 * Read-only view of the Morningstar PDF parser pipeline status
 * for the Admin Console.
 *
 * SECURITY:
 * - No parser execution.
 * - No Gemini API calls.
 * - No PDF upload or reading.
 * - No Firestore reads or writes.
 * - No file access or scripts.
 * - Pure static/audited presentation.
 */
import React from 'react';

// ---------------------------------------------------------------------------
// Exported constants (for tests)
// ---------------------------------------------------------------------------

export interface PipelineStep {
  order: number;
  label: string;
  description: string;
  executable: boolean;
}

export const PARSER_PIPELINE_STEPS: ReadonlyArray<PipelineStep> = [
  { order: 1, label: 'PDF source',              description: 'Documento Morningstar original en formato PDF.',                              executable: false },
  { order: 2, label: 'Parser execution',         description: 'Ejecución del parser con Gemini para extraer datos estructurados.',           executable: false },
  { order: 3, label: 'Artifact JSON',            description: 'Artifact generado con datos extraídos y validados.',                          executable: false },
  { order: 4, label: 'Review',                   description: 'Revisión manual/automática del artifact antes de escribir.',                  executable: false },
  { order: 5, label: 'Write gate',               description: 'Gate de escritura controlada con pre-snapshot, plan y verificación.',          executable: false },
  { order: 6, label: 'Post-write verification',  description: 'Verificación post-escritura del estado de la base de datos.',                 executable: false },
];

export interface ParserStatus {
  code: string;
  label: string;
  description: string;
  color: string;
}

export const PARSER_STATUSES: ReadonlyArray<ParserStatus> = [
  { code: 'PASS',    label: 'PASS',    description: 'Parsing completado sin errores. Artifact listo para review.',          color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { code: 'REVIEW',  label: 'REVIEW',  description: 'Artifact requiere revisión manual antes de proceder.',                 color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { code: 'BLOCKED', label: 'BLOCKED', description: 'Parsing bloqueado por error crítico o datos inconsistentes.',           color: 'bg-red-100 text-red-800 border-red-200' },
  { code: 'ERROR',   label: 'ERROR',   description: 'Error técnico durante la ejecución del parser.',                       color: 'bg-red-100 text-red-800 border-red-200' },
  { code: 'NOT_RUN', label: 'NOT_RUN', description: 'Parser no ejecutado para este fondo/documento.',                       color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

export const PARSER_SECURITY_INVARIANTS: ReadonlyArray<{ icon: string; label: string }> = [
  { icon: '🚫', label: 'No Gemini API calls desde admin' },
  { icon: '🚫', label: 'No parser execution desde admin' },
  { icon: '🚫', label: 'No PDF upload ni lectura' },
  { icon: '🚫', label: 'No Firestore writes' },
  { icon: '🚫', label: 'No file access funcional' },
  { icon: '🚫', label: 'No scripts de ejecución' },
  { icon: '🔒', label: 'Solo lectura — estado informativo' },
  { icon: '🔒', label: 'Artifacts locales fuera de scope' },
];

export const PARSER_NEXT_STEPS: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'BDB-PARSER-DYNAMIC-READONLY-STATUS-0',  label: 'Parser dynamic readonly status: lectura segura de estados desde backend.' },
  { code: 'BDB-PARSER-REVIEW-QUEUE-INTEGRATION-0', label: 'Integración de cola de review del parser en la consola admin.' },
  { code: 'BDB-PARSER-ARTIFACT-SAFE-INDEX-0',      label: 'Artifact safe index: índice seguro sin acceso a filesystem.' },
  { code: 'BDB-PARSER-BATCH-EXECUTION',             label: 'Batch execution permanece fuera de la UI admin.' },
];

export const PARSER_STATUS_CARDS: ReadonlyArray<{ label: string; value: string; color: string }> = [
  { label: 'Parser mode',      value: 'Read-only',    color: 'bg-blue-100 text-blue-800' },
  { label: 'Gemini',           value: 'Disabled',     color: 'bg-slate-100 text-slate-600' },
  { label: 'PDF processing',   value: 'Disabled',     color: 'bg-slate-100 text-slate-600' },
  { label: 'Artifacts',        value: 'Local only',   color: 'bg-amber-100 text-amber-800' },
  { label: 'Write gate',       value: 'Not in UI',    color: 'bg-slate-100 text-slate-600' },
  { label: 'Runtime actions',  value: 'Ninguno',      color: 'bg-emerald-100 text-emerald-800' },
];

const OFFLINE_ARTIFACT_DIRS = [
  'MORNINGSTAR_PDF_PARSER/artifacts/canonical/',
  'MORNINGSTAR_PDF_PARSER/artifacts/review/',
  'MORNINGSTAR_PDF_PARSER/artifacts/work/',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParserPanel() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Read-only banner */}
      <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="text-indigo-500 text-2xl mt-0.5">📄</div>
        <div>
          <h2 className="text-sm font-bold text-indigo-900 tracking-wide uppercase mb-1">
            Panel solo lectura
          </h2>
          <p className="text-sm text-indigo-800/80 leading-relaxed max-w-3xl">
            Esta pantalla no ejecuta parser, no invoca Gemini y no procesa PDFs.
            Muestra el estado informativo del pipeline de parsing Morningstar.
          </p>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {PARSER_STATUS_CARDS.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 text-center ${card.color}`}>
            <div className="text-base font-black">{card.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-70">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Pipeline steps */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Pipeline controlado
        </h3>
        <div className="space-y-2">
          {PARSER_PIPELINE_STEPS.map((step) => (
            <div key={step.order} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-black text-slate-500 shrink-0">
                {step.order}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-bold text-slate-800">{step.label}</h4>
                  <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border bg-slate-50 text-slate-400 border-slate-200 leading-none">
                    Informativo
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Parser statuses */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Estados del parser
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PARSER_STATUSES.map((s) => (
            <div key={s.code} className={`rounded-xl border p-4 ${s.color}`}>
              <div className="text-sm font-black font-mono mb-1">{s.label}</div>
              <p className="text-[11px] leading-relaxed opacity-80">{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Offline artifacts */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Artifacts locales fuera de scope
        </h3>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-3">
            Los siguientes directorios contienen artifacts del parser.
            No son accesibles desde la UI y se muestran solo como referencia informativa.
          </p>
          <div className="space-y-1.5">
            {OFFLINE_ARTIFACT_DIRS.map((dir) => (
              <div key={dir} className="flex items-center gap-2 text-xs text-slate-600 font-mono bg-white rounded-md px-3 py-2 border border-slate-100">
                <span className="text-slate-400">📁</span>
                {dir}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Next steps */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Próximos pasos recomendados
        </h3>
        <div className="space-y-2">
          {PARSER_NEXT_STEPS.map((ns) => (
            <div key={ns.code} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0">
                {ns.code}
              </span>
              <span className="text-xs text-slate-600">{ns.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security invariants */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Invariantes de seguridad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PARSER_SECURITY_INVARIANTS.map((inv) => (
            <div key={inv.label} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3">
              <span className="text-base">{inv.icon}</span>
              <span className="text-xs text-slate-600 font-medium">{inv.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

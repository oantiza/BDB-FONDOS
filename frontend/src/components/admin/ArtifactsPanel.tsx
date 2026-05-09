/**
 * ArtifactsPanel.tsx
 *
 * Read-only catalog of versioned reports and artifacts for the Admin Console.
 *
 * SECURITY:
 * - No Firestore reads or writes.
 * - No filesystem access.
 * - No callable endpoints.
 * - No links to local paths.
 * - No downloads.
 * - Pure static/audited catalog presentation.
 */
import React, { useState, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Exported constants (for tests)
// ---------------------------------------------------------------------------

export const ADMIN_ARTIFACT_CATEGORIES = [
  'Retrocesiones',
  'Admin',
  'Optimizer',
  'Parser',
  'Global',
] as const;

export type ArtifactCategory = (typeof ADMIN_ARTIFACT_CATEGORIES)[number];

export interface AdminArtifact {
  title: string;
  category: ArtifactCategory;
  type: 'doc' | 'artifact' | 'plan' | 'deploy-check' | 'post-write' | 'tests';
  status: 'cerrado' | 'verificado' | 'deploy' | 'plan' | 'post-deploy';
  path: string;
  description: string;
}

export const ARTIFACT_STATUS_LABELS: Record<AdminArtifact['status'], { label: string; color: string }> = {
  cerrado:     { label: 'Cerrado',     color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  verificado:  { label: 'Verificado',  color: 'bg-blue-100 text-blue-800 border-blue-200' },
  deploy:      { label: 'Deploy',      color: 'bg-violet-100 text-violet-800 border-violet-200' },
  plan:        { label: 'Plan',        color: 'bg-amber-100 text-amber-800 border-amber-200' },
  'post-deploy': { label: 'Post-Deploy', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
};

export const ADMIN_ARTIFACTS: ReadonlyArray<AdminArtifact> = [
  // --- Retrocesiones ---
  {
    title: 'Retrocession Write Gate 2',
    category: 'Retrocesiones',
    type: 'doc',
    status: 'cerrado',
    path: 'docs/BDB_RETROCESSION_WRITE_GATE_2.md',
    description: 'Write gate principal: 44 actualizadas, 3 excluidas, 0 fallos.',
  },
  {
    title: 'Post-Write State Check',
    category: 'Retrocesiones',
    type: 'post-write',
    status: 'verificado',
    path: 'docs/BDB_RETROCESSION_POST_WRITE_STATE_CHECK_0.md',
    description: 'Verificación post-escritura: 44/44 PASS.',
  },
  {
    title: 'Retrocessions Panel Post-Deploy',
    category: 'Retrocesiones',
    type: 'deploy-check',
    status: 'post-deploy',
    path: 'docs/BDB_ADMIN_RETROCESSIONS_READONLY_UI_POST_DEPLOY_CHECK_0.md',
    description: 'Verificación del panel retrocesiones en producción.',
  },
  {
    title: 'Pre-Write Snapshot',
    category: 'Retrocesiones',
    type: 'artifact',
    status: 'cerrado',
    path: 'artifacts/bdb_data_audit/retrocession_write_gate_2/pre_write_snapshot.json',
    description: 'Snapshot pre-escritura de los 47 fondos.',
  },
  {
    title: 'Write Plan',
    category: 'Retrocesiones',
    type: 'artifact',
    status: 'cerrado',
    path: 'artifacts/bdb_data_audit/retrocession_write_gate_2/write_plan.json',
    description: 'Plan de escritura con campos a actualizar.',
  },
  {
    title: 'Rollback Manifest',
    category: 'Retrocesiones',
    type: 'artifact',
    status: 'cerrado',
    path: 'artifacts/bdb_data_audit/retrocession_write_gate_2/rollback_manifest.json',
    description: 'Manifiesto de rollback con valores originales.',
  },
  {
    title: 'Post-Write Verification',
    category: 'Retrocesiones',
    type: 'artifact',
    status: 'verificado',
    path: 'artifacts/bdb_data_audit/retrocession_write_gate_2/post_write_verification.json',
    description: 'Verificación post-escritura 44/44 PASS.',
  },
  // --- Admin ---
  {
    title: 'Admin Console Design',
    category: 'Admin',
    type: 'plan',
    status: 'cerrado',
    path: 'docs/BDB_ADMIN_CONSOLE_DESIGN_0.md',
    description: 'Diseño de la consola admin read-only.',
  },
  {
    title: 'Admin Auth Guard',
    category: 'Admin',
    type: 'doc',
    status: 'cerrado',
    path: 'docs/BDB_ADMIN_AUTH_GUARD_0.md',
    description: 'Implementación del guard de autenticación admin.',
  },
  {
    title: 'Frontend Shell Post-Deploy',
    category: 'Admin',
    type: 'deploy-check',
    status: 'post-deploy',
    path: 'docs/BDB_ADMIN_CONSOLE_FRONTEND_SHELL_POST_DEPLOY_CHECK_0.md',
    description: 'Verificación del shell admin en producción.',
  },
  {
    title: 'Backend Deploy Check',
    category: 'Admin',
    type: 'deploy-check',
    status: 'verificado',
    path: 'docs/BDB_ADMIN_BACKEND_REQUIRE_ADMIN_DEPLOY_CHECK_0.md',
    description: 'Verificación de functions admin en producción.',
  },
  // --- Optimizer ---
  {
    title: 'Mixed UX Closeout',
    category: 'Optimizer',
    type: 'doc',
    status: 'cerrado',
    path: 'docs/BDB_OPTIMIZER_MIXED_UX_CLOSEOUT.md',
    description: 'Cierre de la corrección UX para fondos mixtos.',
  },
  {
    title: 'Constraints Canonical Cleanup',
    category: 'Optimizer',
    type: 'plan',
    status: 'plan',
    path: 'docs/BDB_OPTIMIZER_CONSTRAINTS_CANONICAL_CLEANUP_PLAN.md',
    description: 'Plan de limpieza canónica de constraints.',
  },
  {
    title: 'Constraints Canonical Tests',
    category: 'Optimizer',
    type: 'tests',
    status: 'verificado',
    path: 'docs/BDB_OPTIMIZER_CONSTRAINTS_CANONICAL_TESTS.md',
    description: 'Tests canónicos para constraints del optimizador.',
  },
  // --- Global ---
  {
    title: 'Global State After Retrocessions',
    category: 'Global',
    type: 'doc',
    status: 'cerrado',
    path: 'docs/BDB_GLOBAL_STATE_AFTER_RETROCESSIONS_0.md',
    description: 'Estado global del sistema tras la escritura de retrocesiones.',
  },
  {
    title: 'RulesEngine Tests Unblock',
    category: 'Global',
    type: 'tests',
    status: 'verificado',
    path: 'docs/BDB_FRONTEND_RULESENGINE_TESTS_UNBLOCK_0.md',
    description: 'Desbloqueo de tests del RulesEngine frontend.',
  },
  // --- Parser ---
  {
    title: 'Parser Status',
    category: 'Parser',
    type: 'doc',
    status: 'plan',
    path: 'pendiente de indexar',
    description: 'Documentación del parser pendiente de integración en catálogo admin.',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<AdminArtifact['type'], string> = {
  doc: '📄',
  artifact: '📦',
  plan: '📋',
  'deploy-check': '🚀',
  'post-write': '✅',
  tests: '🧪',
};

export default function ArtifactsPanel() {
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    let items = [...ADMIN_ARTIFACTS];
    if (activeCategory !== 'Todos') {
      items = items.filter((a) => a.category === activeCategory);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.path.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeCategory, searchTerm]);

  const categories = ['Todos', ...ADMIN_ARTIFACT_CATEGORIES];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Read-only banner */}
      <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="text-blue-500 text-2xl mt-0.5">📁</div>
        <div>
          <h2 className="text-sm font-bold text-blue-900 tracking-wide uppercase mb-1">
            Catálogo solo lectura
          </h2>
          <p className="text-sm text-blue-800/80 leading-relaxed max-w-3xl">
            Este panel no abre archivos locales ni ejecuta acciones. Los paths se muestran
            como referencia informativa del repositorio versionado.
          </p>
        </div>
      </div>

      {/* Search + Category filters */}
      <div className="space-y-4">
        <div>
          <input
            type="text"
            placeholder="Filtrar por título, descripción o path..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md border transition-all ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-2 flex-1">
          Artifacts ({filtered.length})
        </h3>
      </div>

      {/* Artifact cards */}
      <div className="space-y-3">
        {filtered.map((artifact, idx) => {
          const statusStyle = ARTIFACT_STATUS_LABELS[artifact.status];
          return (
            <div
              key={`${artifact.path}-${idx}`}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-xl shrink-0">
                  {TYPE_ICONS[artifact.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h4 className="text-sm font-bold text-slate-800">
                      {artifact.title}
                    </h4>
                    <span className={`inline-block text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border leading-none ${statusStyle.color}`}>
                      {statusStyle.label}
                    </span>
                    <span className="inline-block text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border bg-slate-100 text-slate-600 border-slate-200 leading-none">
                      {artifact.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{artifact.description}</p>
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    {artifact.path}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-12">
            No se encontraron artifacts con ese filtro.
          </div>
        )}
      </div>

      {/* Security rules */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Reglas de seguridad
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SecurityRule icon="🚫" label="No acceso al filesystem" />
          <SecurityRule icon="🚫" label="No apertura de archivos locales" />
          <SecurityRule icon="🚫" label="No descargas" />
          <SecurityRule icon="🚫" label="No escrituras Firestore" />
          <SecurityRule icon="🔒" label="Catálogo estático auditado" />
          <SecurityRule icon="🔒" label="Solo lectura — sin acciones mutativas" />
        </div>
      </div>
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

import React from 'react';

export interface AdminDashboardCard {
  id: string;
  icon: string;
  title: string;
  status: string;
  detail: string;
  color: 'emerald' | 'blue' | 'amber' | 'slate';
}

export const ADMIN_DASHBOARD_CARDS: ReadonlyArray<AdminDashboardCard> = [
  {
    id: 'retrocessions',
    icon: '💰',
    title: 'Retrocesiones',
    status: 'Write gate cerrado',
    detail: '44 actualizadas, 3 excluidas, 0 docs nuevos',
    color: 'emerald',
  },
  {
    id: 'frontend-tests',
    icon: '✅',
    title: 'Frontend Tests',
    status: '130/130 tests PASS',
    detail: '10 suites, build verde',
    color: 'emerald',
  },
  {
    id: 'parser',
    icon: '📄',
    title: 'Parser Morningstar',
    status: 'Refactor cerrado por ahora',
    detail: 'Pendiente de integración admin UI',
    color: 'blue',
  },
  {
    id: 'security',
    icon: '🔒',
    title: 'Seguridad',
    status: 'Frontend guard UX-only; backend/rules obligatorios',
    detail: '3 capas activas',
    color: 'amber',
  },
  {
    id: 'production',
    icon: '🌐',
    title: 'Producción',
    status: 'Hosting operativo',
    detail: 'Hosting desplegado, Firestore rules activas',
    color: 'emerald',
  },
  {
    id: 'next-steps',
    icon: '⏭️',
    title: 'Próximo Paso',
    status: 'Backend requireAdmin',
    detail: 'Implementar validación en Cloud Functions',
    color: 'slate',
  },
];

const COLOR_STYLES = {
  emerald: {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconBg: 'bg-emerald-50 text-emerald-600',
    cardBorder: 'hover:border-emerald-300'
  },
  blue: {
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    iconBg: 'bg-blue-50 text-blue-600',
    cardBorder: 'hover:border-blue-300'
  },
  amber: {
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-50 text-amber-600',
    cardBorder: 'hover:border-amber-300'
  },
  slate: {
    badge: 'bg-slate-200 text-slate-800 border-slate-300',
    iconBg: 'bg-slate-100 text-slate-600',
    cardBorder: 'hover:border-slate-400'
  },
};

export default function AdminDashboard() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Banner de Aviso: Private Banking / Control Style */}
      <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-5 flex items-start gap-4 shadow-sm">
        <div className="text-blue-500 text-2xl mt-0.5">ℹ️</div>
        <div>
          <h2 className="text-sm font-bold text-blue-900 tracking-wide uppercase mb-1">
            Modo read-only inicial
          </h2>
          <p className="text-sm text-blue-800/80 leading-relaxed max-w-3xl">
            Las escrituras requieren backend, snapshot, write gate y verificación. Este dashboard visualiza el estado estático y read-only del sistema.
          </p>
        </div>
      </div>

      {/* Grid de Estado del Sistema */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 border-b border-slate-200 pb-2">
          Estado del Sistema
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ADMIN_DASHBOARD_CARDS.map((card) => {
            const styles = COLOR_STYLES[card.color];
            return (
              <div
                key={card.id}
                className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm transition-all ${styles.cardBorder}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0 ${styles.iconBg}`}>
                    {card.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                      {card.title}
                    </h4>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md border ${styles.badge} mb-2 leading-none`}>
                      {card.status}
                    </span>
                    <p className="text-xs text-slate-600 leading-snug">
                      {card.detail}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

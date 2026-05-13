import React, { useState } from 'react';
import AdminDashboard from './AdminDashboard';
import FundAuditor from './FundAuditor';
import RetrocessionManager from './RetrocessionManager';
import ArtifactsPanel from './ArtifactsPanel';
import ReviewQueuePanel from './ReviewQueuePanel';
import OptimizerConstraintsPanel from './OptimizerConstraintsPanel';
import ParserPanel from './ParserPanel';
import SettingsPanel from './SettingsPanel';

export interface AdminModule {
  id: string;
  label: string;
  icon: string;
  implemented: boolean;
}

export const ADMIN_MODULES: ReadonlyArray<AdminModule> = [
  { id: 'dashboard',    label: 'Dashboard',               icon: '📊', implemented: true  },
  { id: 'retrocessions',label: 'Retrocesiones',           icon: '💰', implemented: true  },
  { id: 'parser',       label: 'Parser',                  icon: '📄', implemented: true  },
  { id: 'review',       label: 'Review Queue',            icon: '📋', implemented: true  },
  { id: 'funds',        label: 'Funds v3 Audit',          icon: '🔍', implemented: true  },
  { id: 'optimizer',    label: 'Optimizer / Constraints', icon: '⚙️', implemented: true  },
  { id: 'logs',         label: 'Logs / Artifacts',        icon: '📁', implemented: true  },
  { id: 'settings',     label: 'Settings',                icon: '🛠️', implemented: true  },
];

function ModulePlaceholder({ module }: { module: AdminModule }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center max-w-md w-full text-center">
        <span className="text-5xl mb-6 opacity-80">{module.icon}</span>
        <h3 className="text-lg font-bold text-slate-700 mb-3 uppercase tracking-wide">{module.label}</h3>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Módulo pendiente de implementar. El acceso está restringido a consultas sin acciones de escritura.
        </p>
        <span className="inline-block px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
          Read-only shell
        </span>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [activeModule, setActiveModule] = useState('dashboard');
  const currentModule = ADMIN_MODULES.find((m) => m.id === activeModule) || ADMIN_MODULES[0];

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden">
      {/* Sidebar navigation */}
      <nav className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
        <div className="flex-1 overflow-y-auto py-6">
          <ul className="space-y-1 px-3">
            {ADMIN_MODULES.map((mod) => (
              <li key={mod.id}>
                <button
                  onClick={() => setActiveModule(mod.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${
                    activeModule === mod.id
                      ? 'bg-blue-600 text-white font-medium shadow-md'
                      : 'hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <span className="text-lg opacity-90">{mod.icon}</span>
                  <span className="text-sm tracking-wide">{mod.label}</span>
                  {!mod.implemented && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-widest bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                      soon
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        
        {/* Footer info in sidebar */}
        <div className="px-6 py-5 bg-slate-950/50 border-t border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Sistema Activo
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Frontend guard · UX-only
          </p>
        </div>
      </nav>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-10">
        <div className="mb-8">
          <h1 className="text-2xl font-light text-slate-800 tracking-tight">
            {currentModule.label}
          </h1>
        </div>
        
        {currentModule.id === 'dashboard' ? (
          <AdminDashboard />
        ) : currentModule.id === 'funds' ? (
          <FundAuditor />
        ) : currentModule.id === 'retrocessions' ? (
          <RetrocessionManager />
        ) : currentModule.id === 'logs' ? (
          <ArtifactsPanel />
        ) : currentModule.id === 'review' ? (
          <ReviewQueuePanel />
        ) : currentModule.id === 'optimizer' ? (
          <OptimizerConstraintsPanel />
        ) : currentModule.id === 'parser' ? (
          <ParserPanel />
        ) : currentModule.id === 'settings' ? (
          <SettingsPanel />
        ) : (
          <ModulePlaceholder module={currentModule} />
        )}
      </main>
    </div>
  );
}

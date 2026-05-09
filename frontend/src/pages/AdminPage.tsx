import React from 'react';
import AdminGuard from '../components/admin/AdminGuard';
import AdminLayout from '../components/admin/AdminLayout';
import { ArrowLeft } from 'lucide-react';

interface AdminPageProps {
  onBack: () => void;
}

export default function AdminPage({ onBack }: AdminPageProps) {
  return (
    <AdminGuard
      fallback={
        <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 max-w-md w-full text-center">
            <span className="text-6xl mb-6 block opacity-90">🔒</span>
            <h1 className="text-xl font-bold text-slate-800 mb-3 tracking-wide">Acceso Restringido</h1>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              Se requieren privilegios de administrador autorizados para acceder a la consola de supervisión.
            </p>
            <button
              onClick={onBack}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest rounded-lg transition-colors border border-slate-200"
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      }
    >
      <div className="h-screen flex flex-col overflow-hidden bg-slate-50 font-sans">
        {/* Admin Header (Private Banking Style) */}
        <header className="h-16 bg-[#1B2A47] text-white flex items-center justify-between px-6 shrink-0 shadow-md relative z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="bg-white/10 border border-white/20 text-slate-200 hover:text-white p-2 rounded-full hover:bg-white/20 transition-all shadow-sm"
              title="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="h-8 w-px bg-slate-600/50 mx-2"></div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-light tracking-widest text-slate-300 uppercase">BDB-FONDOS</span>
                <span className="text-[#D4AF37] text-xs">★</span>
                <span className="text-sm font-bold tracking-wide">Consola Admin</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Supervisión y operaciones controladas</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-md">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  Read-only
                </span>
             </div>
          </div>
        </header>

        {/* Admin Layout (sidebar + content) */}
        <div className="flex-1 overflow-hidden">
          <AdminLayout />
        </div>
      </div>
    </AdminGuard>
  );
}

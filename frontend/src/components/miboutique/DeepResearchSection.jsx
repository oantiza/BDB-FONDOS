import React from 'react';
import { BarChart2, Activity, PieChart, Layers, Zap, BookOpen } from 'lucide-react';

const DeepResearchSection = ({ data }) => {
  if (!data) return <div className="p-8 text-center text-gray-500 animate-pulse">Generando Deep Research con Gemini...</div>;

  const sections = [
    { id: 'rates', title: 'Tasas & Curvas', icon: Activity, color: 'text-blue-700', border: 'border-blue-700', bg: 'bg-blue-50' },
    { id: 'equity_valuation', title: 'Valoración Equity', icon: BarChart2, color: 'text-emerald-700', border: 'border-emerald-600', bg: 'bg-emerald-50' },
    { id: 'credit_risk', title: 'Riesgo Crédito', icon: Layers, color: 'text-purple-700', border: 'border-purple-600', bg: 'bg-purple-50' },
    { id: 'flows_positioning', title: 'Flujos & Posicionamiento', icon: PieChart, color: 'text-amber-700', border: 'border-amber-500', bg: 'bg-amber-50' },
  ];

  return (
    <section className="mt-12 mb-20">
      {/* Encabezado de Sección */}
      <div className="flex items-center gap-3 mb-8 border-b-2 border-slate-200 pb-4">
        <div className="p-2 bg-slate-900 rounded-lg text-white">
          <BookOpen size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 font-serif">Deep Research: Macro & Estrategia</h2>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">
            Powered by Gemini • Ventana Táctica 6-12 Meses
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tarjetas de Análisis (Grid 2x2) */}
        {sections.map((sec) => {
          const content = data[sec.id];
          const Icon = sec.icon;
          
          return (
            <div key={sec.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300 overflow-hidden group">
              <div className={`px-5 py-3 border-l-4 ${sec.border} ${sec.bg} flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${sec.color}`} />
                  <h3 className="font-bold text-slate-800 text-base">{content.title}</h3>
                </div>
                {/* Dato Clave (Key Metric) */}
                <span className="text-[10px] font-mono font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-600 shadow-sm">
                  {content.key_metric}
                </span>
              </div>
              <div className="p-5">
                <p className="text-slate-600 leading-relaxed text-sm whitespace-pre-line">
                  {content.content}
                </p>
              </div>
            </div>
          );
        })}

        {/* Tarjeta de Tesis Central (Full Width) */}
        <div className="md:col-span-2 mt-2">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-8 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500 opacity-5 rounded-full blur-3xl -mr-16 -mt-16"></div>
            
            <div className="relative z-10">
              <h3 className="text-lg font-bold text-yellow-400 mb-4 font-serif flex items-center gap-2">
                <Zap size={20} className="fill-yellow-400 text-yellow-400" /> 
                TESIS DE INVERSIÓN CENTRAL
              </h3>
              <p className="text-xl text-slate-200 leading-relaxed font-light italic border-l-2 border-yellow-500/30 pl-6">
                "{data.thesis.content}"
              </p>
              <div className="mt-6 pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-400 font-mono">
                <span>Análisis generado vía Vertex AI + Google Search</span>
                <span>Datos actualizados: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DeepResearchSection;
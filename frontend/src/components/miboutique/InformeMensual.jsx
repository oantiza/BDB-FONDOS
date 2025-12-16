"use client";
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Shield, Globe } from 'lucide-react';
import DeepResearchSection from './DeepResearchSection';

// --- CONFIGURACIÓN ---
const COLORES_RV = ['#0f172a', '#334155', '#475569', '#94a3b8']; 
const COLORES_RF = ['#064e3b', '#065f46', '#059669', '#34d399']; 

// --- SUB-COMPONENTES UI ---
const BadgeVision = ({ vision }) => {
  const estilos = {
    'Sobreponderar': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Neutral': 'bg-slate-50 text-slate-600 border-slate-200',
    'Infraponderar': 'bg-rose-50 text-rose-700 border-rose-200',
  };
  const Icono = {
    'Sobreponderar': TrendingUp, 'Neutral': Minus, 'Infraponderar': TrendingDown
  }[vision] || Minus;

  return (
    <span className={`flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${estilos[vision] || estilos['Neutral']}`}>
      <Icono size={12} strokeWidth={2.5} />
      {vision?.toUpperCase()}
    </span>
  );
};

const TarjetaAssetClass = ({ titulo, icono: Icon, datos, colores, visionGlobal }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm text-slate-700 border border-slate-100">
          <Icon size={20} />
        </div>
        <h3 className="font-bold text-slate-800 text-lg tracking-tight">{titulo}</h3>
      </div>
      <div className="text-right">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">Visión Global</span>
        <span className="text-sm font-bold text-slate-900">{visionGlobal}</span>
      </div>
    </div>

    <div className="p-6 flex flex-col md:flex-row gap-10 items-start">
      {/* Gráfico Donut - VERSIÓN INFALIBLE (Tamaño Fijo) */}
      <div className="flex justify-center items-center mx-auto mb-6 md:mb-0 relative w-[200px] h-[200px] flex-shrink-0">
        <PieChart width={200} height={200}>
          <Pie 
            data={datos} 
            innerRadius={60} 
            outerRadius={80} 
            paddingAngle={5} 
            dataKey="peso" 
            stroke="none"
          >
            {datos.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colores[index % colores.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
        
        {/* Texto central */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-slate-800">100<span className="text-sm">%</span></span>
          <span className="text-[10px] text-slate-400 uppercase">Cartera</span>
        </div>
      </div>

      <div className="flex-grow w-full overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-100 uppercase tracking-wider">
              <th className="pb-3 pl-2 font-semibold">Activo / Región</th>
              <th className="pb-3 font-semibold text-center">Peso</th>
              <th className="pb-3 font-semibold">Visión Táctica</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {datos.map((item, index) => (
              <tr key={index} className="group hover:bg-slate-50 transition-colors">
                <td className="py-4 pr-4 pl-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: colores[index % colores.length] }}></div>
                    <div>
                      <span className="font-bold text-slate-700 block text-sm">{item.region || item.tipo}</span>
                      <span className="text-xs text-slate-400 font-normal line-clamp-1">{item.razon}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 text-center font-mono font-bold text-slate-600">{item.peso}%</td>
                <td className="py-4">
                  <BadgeVision vision={item.vision} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// --- COMPONENTE PRINCIPAL ---
export default function InformeMensual({ datos }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!datos) return null;

  const { meta, asignacion_tactica, macro_analysis } = datos;

  if (!isClient) return null; 

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12 bg-slate-50 min-h-screen font-sans">
      <header className="mb-12 border-b border-slate-200 pb-8">
        <div className="flex flex-col md:flex-row justify-between md:items-end mb-6 gap-4">
          <div>
            <h2 className="text-xs font-bold tracking-[0.2em] text-blue-600 uppercase mb-2">Informe Estratégico</h2>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">{meta?.titulo || datos.title}</h1>
            <p className="text-slate-500 mt-1">{meta?.fecha || new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-600">Sistema Online</span>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-l-4 border-slate-200 border-l-blue-600">
          <h3 className="text-sm font-bold text-blue-900 mb-2 uppercase tracking-wide">Resumen Ejecutivo</h3>
          <p className="text-slate-600 leading-relaxed text-lg font-light">{meta?.resumen_ia || datos.executive_summary}</p>
        </div>
      </header>

      {asignacion_tactica && (
        <>
          <TarjetaAssetClass 
            titulo="Renta Variable (Equity)" 
            icono={Globe}
            visionGlobal={asignacion_tactica.renta_variable?.peso_global || "Neutral"}
            datos={asignacion_tactica.renta_variable?.desglose || []}
            colores={COLORES_RV}
          />

          <TarjetaAssetClass 
            titulo="Renta Fija (Fixed Income)" 
            icono={Shield}
            visionGlobal={asignacion_tactica.renta_fija?.peso_global || "Neutral"}
            datos={asignacion_tactica.renta_fija?.desglose || []}
            colores={COLORES_RF}
          />
        </>
      )}

      {/* Si no hay asignacion_tactica, usamos el fallback de portfolio */}
      {!asignacion_tactica && datos.model_portfolio && (
         <div className="mb-12">
            <h3 className="font-bold text-slate-800 text-xl mb-4">Cartera Modelo</h3>
            {/* Aquí podrías renderizar una tabla simplificada si no llega la estructura compleja */}
            <p>Datos de cartera cargados correctamente.</p>
         </div>
      )}

      {macro_analysis && <DeepResearchSection data={macro_analysis} />}
    </div>
  );
}
// Forzando actualizacion de grafico
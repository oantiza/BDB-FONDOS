import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase'; 
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { Download, FileText, PieChart, RefreshCw } from 'lucide-react';

import DeepResearchSection from './DeepResearchSection'; 
import InformeMensual from './InformeMensual'; // <--- IMPORTACIÓN CORREGIDA

const Dashboard = () => {
  const [viewMode, setViewMode] = useState('weekly'); 
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      setData(null);

      try {
        const dbTag = viewMode === 'weekly' ? 'WEEKLY_MACRO' : 'MONTHLY_PORTFOLIO';
        const reportsRef = collection(db, "analysis_results");
        const q = query(
          reportsRef,
          where("type", "==", dbTag),
          orderBy("createdAt", "desc"), 
          limit(1)                      
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          setData(querySnapshot.docs[0].data());
        } else {
          setError("No hay informes disponibles todavía. Espera al próximo cierre programado.");
        }
      } catch (err) {
        console.error("Error fetching report:", err);
        setError("Error de conexión al cargar el informe.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [viewMode]); 

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 print:p-0 print:bg-white">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4 print:hidden">
        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex">
          <button 
            onClick={() => setViewMode('weekly')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              viewMode === 'weekly' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <FileText size={18} /> Market Brief (Semanal)
          </button>
          <button 
            onClick={() => setViewMode('monthly')}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              viewMode === 'monthly' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <PieChart size={18} /> Asset Allocation (Mensual)
          </button>
        </div>

        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-sm hover:shadow active:scale-95"
        >
          <Download size={18} /> Descargar PDF
        </button>
      </div>

      <main className="max-w-5xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-100 print:shadow-none print:border-none print:p-0">
        
        <header className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 tracking-tight">
              {viewMode === 'weekly' ? 'Weekly Market Brief' : 'Monthly Strategy'}
            </h1>
            <p className="text-slate-500 mt-2 text-lg font-light flex items-center gap-2">
              {data?.title || "Informe de Estrategia Global"}
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm text-slate-400 font-mono mb-1">FECHA DE EMISIÓN</div>
            <div className="text-xl font-bold text-slate-800">
              {data ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : "-/-/-"}
            </div>
          </div>
        </header>

        {loading && (
          <div className="py-20 text-center text-slate-400 animate-pulse flex flex-col items-center">
            <RefreshCw className="animate-spin mb-4" size={32} />
            Cargando análisis de Gemini...
          </div>
        )}

        {error && (
          <div className="py-12 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <div className="animate-in fade-in duration-500">
             
            {/* RENDERIZADO CONDICIONAL DEL INFORME COMPLETO */}
            {viewMode === 'weekly' ? (
              <DeepResearchSection data={data} />
            ) : (
              <InformeMensual datos={data} /> 
            )}

            <footer className="mt-16 pt-8 border-t border-slate-100 text-center text-xs text-slate-400 font-mono">
              Generado automáticamente por Gemini 1.5 Pro + Vertex AI • Uso interno exclusivo.
            </footer>
          </div>
        )}
      </main>

      <style jsx global>{`
        @media print {
          @page { margin: 15mm; size: auto; }
          body { background: white; -webkit-print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
// Forzando actualizacion Vercel v2
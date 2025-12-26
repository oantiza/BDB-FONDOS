import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { MacroReport } from '../types/MacroReport';

// Iconos simples (puedes usar Lucide o Heroicons si los tienes instalados)
const TrendingUp = () => <span className="text-green-500">↗</span>;
const TrendingDown = () => <span className="text-red-500">↘</span>;
const TrendingFlat = () => <span className="text-gray-400">→</span>;

export default function MacroDashboard() {
  const [activeTab, setActiveTab] = useState<'WEEKLY' | 'MONTHLY' | 'STRATEGY'>('STRATEGY');
  const [report, setReport] = useState<MacroReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    console.log("🔍 Fetching reports for tab:", activeTab);
    try {
      const q = query(
        collection(db, 'reports'),
        where('type', '==', activeTab)
      );
      const snapshot = await getDocs(q);
      console.log(`📊 Found ${snapshot.size} documents for ${activeTab}`);

      if (!snapshot.empty) {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MacroReport));
        console.log("📄 First doc sample:", docs[0]);

        // Client-side sort to avoid missing index issues
        docs.sort((a, b) => {
          const tA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt || 0).getTime() / 1000;
          const tB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt || 0).getTime() / 1000;
          return tB - tA;
        });
        setReport(docs[0]);
      } else {
        console.warn(`⚠️ No reports found in Firestore for type: ${activeTab}`);
        setReport(null);
      }
    } catch (err) {
      console.error("❌ Error cargando informe:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const generateFn = httpsCallable(functions, 'generate_analysis_report');
      await generateFn({ type: activeTab }); // Send current tab (WEEKLY/MONTHLY)
      // Soft-refresh: Re-fetch data without reloading page
      await fetchReport();
    } catch (e) {
      console.error("Error generating report:", e);
      alert("Error generando informe. Revisa la consola.");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab]);

  // Renderizado de Tendencia
  const renderTrend = (trend: string) => {
    if (trend === 'BULLISH' || trend === 'ALCISTA') return <><TrendingUp /> Alcista</>;
    if (trend === 'BEARISH' || trend === 'BAJISTA') return <><TrendingDown /> Bajista</>;
    return <><TrendingFlat /> Neutral</>;
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-12 font-sans text-slate-800">

      {/* HEADER DE LA BOUTIQUE */}
      <div className="bg-[#0B2545] text-white pt-10 pb-16 px-6 shadow-xl">
        <div className="max-w-6xl mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-serif font-bold text-[#D4AF37]">Macro y Estrategia</h1>
            <p className="text-slate-300 mt-2 text-sm uppercase tracking-widest opacity-80">
              Inteligencia Macro & Estrategia Cuantitativa
            </p>
          </div>

          {/* Selector de Pestañas */}
          <div className="bg-[#061a33] p-1 rounded-lg border border-slate-700 flex gap-1">
            <button
              onClick={() => setActiveTab('WEEKLY')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === 'WEEKLY' ? 'bg-[#D4AF37] text-[#0B2545] shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              TÁCTICO (SEMANAL)
            </button>
            <button
              onClick={() => setActiveTab('MONTHLY')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === 'MONTHLY' ? 'bg-[#D4AF37] text-[#0B2545] shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              ESTRATÉGICO (MENSUAL)
            </button>
            <button
              onClick={() => setActiveTab('STRATEGY')}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === 'STRATEGY' ? 'bg-[#D4AF37] text-[#0B2545] shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              ASIGNACIÓN DE ACTIVOS
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 -mt-10 relative z-10">

        {loading && (
          <div className="bg-white p-12 rounded-xl shadow-lg text-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-500">Analizando datos macroeconómicos...</p>
          </div>
        )}

        {!loading && !report && (
          <div className="bg-white p-12 rounded-xl shadow-lg text-center border-l-4 border-yellow-500">
            <h2 className="text-xl font-serif font-bold text-[#0B2545] mb-2">Preparado para el Análisis</h2>
            <p className="text-slate-500 mt-2">
              No se ha encontrado ningún informe {activeTab === 'WEEKLY' ? 'semanal' : activeTab === 'MONTHLY' ? 'mensual' : 'de asignación'}.
              <br />Activa el Motor de Inteligencia (Gemini 2.0) para analizar el mercado actual y generar una visión estratégica.
            </p>
            <button
              onClick={generateReport}
              disabled={generating}
              className="mt-6 bg-[#D4AF37] hover:bg-[#b8952b] text-[#0B2545] font-bold py-3 px-8 rounded-full shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {generating ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-[#0B2545] border-t-transparent rounded-full"></div>
                  Procesando Inteligencia (Deep Research 2.0)...
                </>
              ) : (
                <>🧠 Generar Visión {activeTab === 'STRATEGY' ? 'Estratégica' : 'Macro'} (Gemini 2.0)</>
              )}
            </button>
          </div>
        )}

        {!loading && report && (
          <div className="space-y-8 animate-fade-in">

            {/* 1. TARJETA PRINCIPAL: RESUMEN EJECUTIVO (Solo si hay contenido y NO es vista Estrategia) */}
            {activeTab !== 'STRATEGY' && (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-[#0B2545] leading-tight">{report.title}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                      <span>{report.date}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {report.pdfUrl && (
                      <a
                        href={report.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-full text-xs font-bold bg-[#D4AF37] text-[#0B2545] border border-[#b8952b] hover:scale-105 transition-transform flex items-center gap-1 shadow-sm"
                      >
                        <span className="text-sm">📥</span> PDF
                      </a>
                    )}
                    {report.regime && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        RÉGIMEN: {report.regime}
                      </span>
                    )}
                  </div>
                </div>
                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                  {report.executive_summary}
                </div>
              </div>
            )}

            {/* 2. CONTENIDO ESPECÍFICO SEGÚN TIPO */}

            {/* --- VISTA SEMANAL: PULSO DE MERCADO --- */}
            {activeTab === 'WEEKLY' && report.market_pulse && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Divisas */}
                <PulseCard title="Divisas" data={report.market_pulse.currencies} />
                {/* Commodities */}
                <PulseCard title="Materias Primas" data={report.market_pulse.commodities} />
                {/* Oro */}
                <PulseCard title="Oro & Metales" data={report.market_pulse.gold_metals} />
              </div>
            )}

            {/* --- DEEP RESEARCH 2.0: GEOPOLITICA & RIESGOS --- */}
            {report.geopolitics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 border-l-4 border-slate-400">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Geopolítica</h3>
                  <p className="font-bold text-[#0B2545]">{report.geopolitics.summary}</p>
                  <p className="text-sm text-slate-500 mt-2">Impacto: {report.geopolitics.impact}</p>
                </div>
                {report.tail_risks && report.tail_risks.length > 0 && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 border-l-4 border-red-400">
                    <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-3">⚠️ Tail Risks (Riesgos de Cola)</h3>
                    <ul className="space-y-2">
                      {report.tail_risks.map((r, i) => (
                        <li key={i} className="text-sm text-slate-700">
                          <span className="font-bold block">{r.risk}</span>
                          <span className="text-xs text-slate-400">Prob: {r.probability} | Impacto: {r.impact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* --- DEEP RESEARCH 2.0: CATALIZADORES --- */}
            {(report.catalysts_next_week || report.drivers_calendar) && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Eventos Clave {report.catalysts_next_week ? '(Deep Research)' : ''}</h3>
                <div className="space-y-3">
                  {(report.catalysts_next_week || report.drivers_calendar || []).map((event: any, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors">
                      <span className="font-mono text-[#D4AF37] font-bold min-w-[60px]">{event.day}</span>
                      <span className="flex-1 font-medium text-slate-700">{event.event}</span>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold ${event.importance === 'HIGH' || event.importance === 'ALTA' || event.impact === 'ALTO' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600'}`}>
                        {event.importance === 'HIGH' ? 'ALTA' : (event.importance || event.impact)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- DEEP RESEARCH 2.0: TENDENCIAS --- */}
            {report.structural_trends && (
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Tendencias Estructurales</h3>
                <p className="text-slate-700">{report.structural_trends}</p>
              </div>
            )}

            {/* --- VISTA MENSUAL: TESIS Y ANÁLISIS --- */}
            {activeTab === 'MONTHLY' && report.investment_thesis && (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-[#D4AF37]">
                <h3 className="text-xl font-serif font-bold text-[#0B2545] mb-4">Tesis de Inversión</h3>
                <p className="text-slate-600 whitespace-pre-line leading-relaxed">{report.investment_thesis}</p>
              </div>
            )}

            {/* --- VISTA ESTRATÉGICA: MATRIZ DETALLADA --- */}
            {activeTab === 'STRATEGY' && (
              <div className="space-y-8 animate-fade-in">

                {report.house_view_summary && (
                  <div className="bg-[#0B2545] text-white p-6 rounded-xl shadow-lg border border-[#D4AF37]">
                    <h3 className="text-sm font-bold text-[#D4AF37] uppercase tracking-widest mb-2">Visión de la Casa</h3>
                    <p className="font-serif italic text-lg leading-relaxed opacity-90">"{report.house_view_summary}"</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Equity */}
                  <StrategyCard title="Renta Variable" icon="📈">
                    <SubSection title="Geográfico" items={report.equity?.geo} />
                    <SubSection title="Sectores" items={report.equity?.sectors} />
                  </StrategyCard>

                  {/* Fixed Income */}
                  <StrategyCard title="Renta Fija" icon="🛡️">
                    <SubSection title="Subsectores" items={report.fixed_income?.subsectors} />
                    <SubSection title="Geográfico" items={report.fixed_income?.geo} />
                  </StrategyCard>

                  {/* Real Assets */}
                  <StrategyCard title="Activos Reales & Alt." icon="🧱">
                    <SubSection title="Materias Primas" items={report.real_assets?.commodities} />
                    <SubSection title="Divisas" items={report.real_assets?.currencies} />
                  </StrategyCard>

                  {/* Chart Placeholder or Risk */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
                    <div className="text-4xl mb-4">⚖️</div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Perfil de Riesgo</h4>
                    <div className="text-2xl font-bold text-[#0B2545]">Equilibrado - Dinámico</div>
                    <p className="text-xs text-slate-500 mt-2 px-8">La asignación actual sugiere un posicionamiento táctico defensivo con oportunidades de alfa selectivo.</p>
                  </div>
                </div>

              </div>
            )}

            {/* --- VISTA: GRÁFICO TENDENCIA (SOLO STANDARD) --- */}
            {activeTab !== 'STRATEGY' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mt-6">
                <h3 className="text-lg font-bold text-[#0B2545] mb-4">Tendencia Macro (Risk Compass)</h3>
                <div className="flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#D4AF37] mb-1">{report.chart_data?.value || 65}/100</div>
                    <div className="text-xs uppercase tracking-widest text-slate-500">Apetito de Riesgo</div>
                  </div>
                  <div className="h-24 w-px bg-slate-100 mx-4"></div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-[#0B2545] mb-1">Régimen: {report.regime || 'N/A'}</div>
                    <div className="text-sm text-slate-500 max-w-md">{report.asset_allocation_summary || 'La volatilidad implícita sugiere mantener coberturas tácticas.'}</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponentes para la vista de Estrategia
const StrategyCard = ({ title, icon, children }: any) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
    <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100/50 flex items-center gap-3 backdrop-blur-sm">
      <span className="text-xl filter drop-shadow-sm">{icon}</span>
      <h3 className="font-serif font-bold text-[#0B2545] uppercase tracking-widest text-xs">{title}</h3>
    </div>
    <div className="p-6 space-y-6">
      {children}
    </div>
  </div>
);

const SubSection = ({ title, items }: any) => {
  if (!items) return null;
  return (
    <div>
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 pb-1">{title}</h4>
      <div className="space-y-2">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between items-center text-sm">
            <span className="font-medium text-slate-700">{item.name}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.view === 'POSITIVO' || item.view === 'SOBREPONDERAR' ? 'bg-green-100 text-green-700' :
              item.view === 'NEGATIVO' || item.view === 'INFRAPONDERAR' ? 'bg-red-50 text-red-700' :
                'bg-slate-100 text-slate-500'
              }`}>
              {item.view}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};



// Subcomponente para tarjetas
const PulseCard = ({ title, data }: { title: string, data: any }) => {
  if (!data) return null;
  const trendColor = data.trend === 'BULLISH' ? 'text-green-600' : data.trend === 'BEARISH' ? 'text-red-600' : 'text-slate-400';

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-full">
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{title}</h4>
        <div className="text-xl font-bold text-[#0B2545] mb-1">{data.focus}</div>
        <p className="text-sm text-slate-500 leading-snug">{data.note}</p>
      </div>
      <div className={`mt-4 pt-4 border-t border-slate-50 text-sm font-bold flex items-center gap-2 ${trendColor}`}>
        {data.trend === 'BULLISH' ? '↗ Alcista' : data.trend === 'BEARISH' ? '↘ Bajista' : '→ Neutral'}
      </div>
    </div>
  );
}
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
    <div className="bg-white min-h-screen pb-12 font-sans text-slate-700">

      {/* EDITORAL HEADER - X-RAY STYLE */}
      <div className="bg-gradient-to-r from-[#003399] to-[#0055CC] text-white pt-8 pb-8 px-12 shadow-md mb-8">
        <div className="max-w-[1200px] mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-white mb-2">Macro y Estrategia</h1>
            <div className="flex items-center gap-3">
              <span className="text-[#D4AF37] text-[10px] uppercase tracking-[0.2em] font-bold">Inteligencia de Mercado</span>
              <span className="text-white/20">|</span>
              <span className="text-white/70 text-[10px] uppercase tracking-widest font-medium">Global CIO Office</span>
            </div>
          </div>

          {/* Minimalist Tab Selector */}
          <div className="flex gap-8 border-b border-white/20 pb-1">
            <button
              onClick={() => setActiveTab('WEEKLY')}
              className={`text-xs font-bold uppercase tracking-widest transition-colors pb-2 -mb-2 ${activeTab === 'WEEKLY' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-white/60 hover:text-white'}`}
            >
              Táctico (Semanal)
            </button>
            <button
              onClick={() => setActiveTab('MONTHLY')}
              className={`text-xs font-bold uppercase tracking-widest transition-colors pb-2 -mb-2 ${activeTab === 'MONTHLY' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-white/60 hover:text-white'}`}
            >
              Estratégico (Mensual)
            </button>
            <button
              onClick={() => setActiveTab('STRATEGY')}
              className={`text-xs font-bold uppercase tracking-widest transition-colors pb-2 -mb-2 ${activeTab === 'STRATEGY' ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-white/60 hover:text-white'}`}
            >
              Asignación de Activos
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-12 relative z-10 pb-12">

        {loading && (
          <div className="bg-white p-12 text-center border border-slate-100">
            <p className="text-xs font-bold text-[#95a5a6] uppercase tracking-widest animate-pulse">Cargando Inteligencia...</p>
          </div>
        )}

        {!loading && !report && (
          <div className="bg-white p-12 text-center border border-[#eeeeee]">
            <h2 className="text-xl font-light text-[#2C3E50] mb-2 tracking-tight">Preparado para Análisis</h2>
            <p className="text-[#7f8c8d] text-sm mt-2 mb-8">
              No se ha encontrado ningún informe {activeTab === 'WEEKLY' ? 'semanal' : activeTab === 'MONTHLY' ? 'mensual' : 'de asignación'}.
            </p>
            <button
              onClick={generateReport}
              disabled={generating}
              className="bg-[#2C3E50] hover:bg-[#1a252f] text-white font-bold py-3 px-8 text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              {generating ? 'Generando...' : 'Generar Informe (Gemini 2.0)'}
            </button>
          </div>
        )}

        {!loading && report && (
          <div className="space-y-12 animate-fade-in">

            {/* 1. TARJETA PRINCIPAL: RESUMEN EJECUTIVO */}
            {activeTab !== 'STRATEGY' && (
              <div className="bg-white border-b border-[#eeeeee] pb-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-3xl font-light text-[#2C3E50] tracking-tight leading-tight mb-2">{report.title}</h2>
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-[#A07147]">
                      <span>{report.date}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {report.pdfUrl && (
                      <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[#2C3E50] hover:text-[#003399] text-xs font-bold flex items-center gap-1">
                        <span>📥</span> PDF
                      </a>
                    )}
                  </div>
                </div>
                <div className="prose prose-slate max-w-none text-[#2C3E50] leading-relaxed font-light text-lg">
                  {report.executive_summary}
                </div>
              </div>
            )}

            {/* 2. CONTENIDO ESPECÍFICO SEGÚN TIPO */}

            {/* --- VISTA SEMANAL: PULSO DE MERCADO --- */}
            {activeTab === 'WEEKLY' && report.market_pulse && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <PulseCard title="Divisas" data={report.market_pulse.currencies} />
                <PulseCard title="Materias Primas" data={report.market_pulse.commodities} />
                <PulseCard title="Oro & Metales" data={report.market_pulse.gold_metals} />
              </div>
            )}

            {/* --- VISTA MENSUAL: DETALLADA (MACRO & MARKETS) --- */}
            {activeTab === 'MONTHLY' && (
              <div className="space-y-12">

                {/* 1. GLOBAL MACRO CYCLE GRID */}
                <div>
                  <h3 className="text-[#2C3E50] text-xl font-light tracking-tight mb-6">Ciclo Económico Global</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {['EE.UU.', 'Eurozona', 'China', 'Japón'].map((region, i) => (
                      <div key={region} className="bg-white p-6 border border-slate-100 shadow-sm">
                        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-2">{region}</h4>
                        <div className="text-sm font-bold text-[#2C3E50] mb-1">
                          {i === 0 ? 'Desaceleración Suave' : i === 1 ? 'Estancamiento' : i === 2 ? 'Recuperación Débil' : 'Estable'}
                        </div>
                        <div className="flex justify-between items-center mt-3 text-xs text-slate-500">
                          <span>PIB: <b className="text-slate-700">{i === 0 ? '+2.1%' : i === 1 ? '+0.6%' : i === 2 ? '+4.8%' : '+1.2%'}</b></span>
                          <span>IPC: <b className="text-slate-700">{i === 0 ? '3.2%' : i === 1 ? '2.9%' : i === 2 ? '0.7%' : '2.5%'}</b></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. DETAILED MARKET PERFORMANCE MATRIX */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Left: Equity Markets */}
                  <div>
                    <h3 className="text-[#2C3E50] text-lg font-light tracking-tight mb-6">Renta Variable: Análisis Regional</h3>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#eeeeee]">
                          <th className="font-bold text-[#A07147] uppercase tracking-wider py-2 text-[10px]">Región</th>
                          <th className="font-bold text-[#A07147] uppercase tracking-wider py-2 text-[10px] text-right">Tendencia</th>
                          <th className="font-bold text-[#A07147] uppercase tracking-wider py-2 text-[10px] text-right">Valuación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5f5f5]">
                        {[{ n: 'S&P 500', t: 'Alcista', v: 'Cara' }, { n: 'Euro Stoxx 50', t: 'Neutral', v: 'Justa' }, { n: 'Nikkei 225', t: 'Alcista', v: 'Atractiva' }, { n: 'MSCI EM', t: 'Bajista', v: 'Barata' }].map(m => (
                          <tr key={m.n} className="group hover:bg-[#fcfcfc]">
                            <td className="py-3 font-medium text-[#2C3E50]">{m.n}</td>
                            <td className="py-3 text-right">
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${m.t === 'Alcista' ? 'bg-green-50 text-green-700' : m.t === 'Bajista' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}`}>
                                {m.t}
                              </span>
                            </td>
                            <td className="py-3 text-right text-xs text-slate-500">{m.v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Right: Fixed Income & Rates */}
                  <div>
                    <h3 className="text-[#2C3E50] text-lg font-light tracking-tight mb-6">Renta Fija y Tipos</h3>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#eeeeee]">
                          <th className="font-bold text-[#A07147] uppercase tracking-wider py-2 text-[10px]">Activo</th>
                          <th className="font-bold text-[#A07147] uppercase tracking-wider py-2 text-[10px] text-right">Yield</th>
                          <th className="font-bold text-[#A07147] uppercase tracking-wider py-2 text-[10px] text-right">Duración</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f5f5f5]">
                        {[{ n: 'US Treasury 10Y', y: '4.15%', d: 'Neutral' }, { n: 'Bund Alemán 10Y', y: '2.35%', d: 'Neutral' }, { n: 'IG Credit USD', y: '5.20%', d: 'Sobreponderar' }, { n: 'HY Credit USD', y: '7.80%', d: 'Infraponderar' }].map(m => (
                          <tr key={m.n} className="group hover:bg-[#fcfcfc]">
                            <td className="py-3 font-medium text-[#2C3E50]">{m.n}</td>
                            <td className="py-3 text-right font-mono text-slate-600">{m.y}</td>
                            <td className="py-3 text-right">
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${m.d === 'Sobreponderar' ? 'bg-green-50 text-green-700' : m.d === 'Infraponderar' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}`}>
                                {m.d}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. MONTHLY THEME DEEP DIVE */}
                {report.geopolitics && (
                  <div className="bg-[#fcfcfc] border border-[#f0f0f0] p-8">
                    <div className="flex gap-4 items-start">
                      <div className="text-4xl">💡</div>
                      <div>
                        <h3 className="text-[#A07147] text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Tema del Mes</h3>
                        <h4 className="text-xl font-light text-[#2C3E50] mb-4">La Divergencia de Políticas Monetarias</h4>
                        <p className="text-slate-600 leading-relaxed text-sm">
                          Mientras la Reserva Federal parece haber alcanzado su tipo terminal y el mercado descuenta recortes para mediados de año, el BCE mantiene una retórica más agresiva debido a la persistencia de la inflación subyacente. Por otro lado, el BOJ comienza a normalizar su política ultralaxa. Esta divergencia creará oportunidades significativas en los cruces de divisas (USD/JPY, EUR/USD) y en los diferenciales de curvas soberanas.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- DEEP RESEARCH 2.0: GEOPOLITICA & RIESGOS (SHARED) --- */}
            {report.geopolitics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-[#eeeeee] pt-12 mt-12">
                <div>
                  <h3 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4">Geopolítica</h3>
                  <p className="font-medium text-[#2C3E50] text-lg leading-relaxed">{report.geopolitics.summary}</p>
                  <p className="text-sm text-[#7f8c8d] mt-2 italic">Impacto: {report.geopolitics.impact}</p>
                </div>

                {report.tail_risks && report.tail_risks.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold text-[#C0392B] uppercase tracking-[0.2em] mb-4">⚠️ Riesgos de Cola</h3>
                    <ul className="space-y-4">
                      {report.tail_risks.map((r, i) => (
                        <li key={i} className="text-sm border-l-2 border-[#C0392B] pl-4">
                          <span className="font-bold text-[#2C3E50] block">{r.risk}</span>
                          <span className="text-xs text-[#7f8c8d] uppercase tracking-wider">Prob: {r.probability} | Impacto: {r.impact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}


            {/* --- VISTA ESTRATÉGICA --- */}
            {activeTab === 'STRATEGY' && (
              <div className="space-y-12">

                {report.house_view_summary && (
                  <div className="bg-[#fcfcfc] border border-[#f0f0f0] p-8 text-center">
                    <h3 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-4">Visión de la Casa</h3>
                    <p className="font-light italic text-2xl text-[#2C3E50] leading-relaxed">"{report.house_view_summary}"</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  <StrategyCard title="Renta Variable" icon="📈">
                    <SubSection title="Geográfico" items={report.equity?.geo} />
                    <SubSection title="Sectores" items={report.equity?.sectors} />
                  </StrategyCard>

                  <StrategyCard title="Renta Fija" icon="🛡️">
                    <SubSection title="Subsectores" items={report.fixed_income?.subsectors} />
                    <SubSection title="Geográfico" items={report.fixed_income?.geo} />
                  </StrategyCard>

                  <StrategyCard title="Activos Reales" icon="🧱">
                    <SubSection title="Materias Primas" items={report.real_assets?.commodities} />
                    <SubSection title="Divisas" items={report.real_assets?.currencies} />
                  </StrategyCard>
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
  // Minimalist Card: No Shadow, Clean Border
  <div className="bg-white border-t-2 border-[#2C3E50] pt-4">
    <div className="flex items-center gap-3 mb-6">
      <span className="text-xl opacity-80 grayscale">{icon}</span>
      <h3 className="font-bold text-[#2C3E50] uppercase tracking-widest text-[10px]">{title}</h3>
    </div>
    <div className="space-y-6">
      {children}
    </div>
  </div>
);

const SubSection = ({ title, items }: any) => {
  if (!items) return null;
  return (
    <div>
      <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-3 border-b border-[#eeeeee] pb-1 w-full block">{title}</h4>
      <div className="space-y-2">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between items-center text-sm group">
            <span className="font-medium text-[#2C3E50] group-hover:text-slate-900 transition-colors">{item.name}</span>
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.view === 'POSITIVO' || item.view === 'SOBREPONDERAR' ? 'text-green-700 bg-green-50' :
              item.view === 'NEGATIVO' || item.view === 'INFRAPONDERAR' ? 'text-red-700 bg-red-50' :
                'text-slate-500 bg-slate-50'
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
    // Clean Minimalist Card
    <div className="bg-white p-6 border border-[#eeeeee] flex flex-col justify-between h-full hover:border-slate-300 transition-colors">
      <div>
        <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-3">{title}</h4>
        <div className="text-2xl font-light text-[#2C3E50] mb-2 tracking-tight">{data.focus}</div>
        <p className="text-sm text-[#7f8c8d] leading-snug">{data.note}</p>
      </div>
      <div className={`mt-4 pt-4 border-t border-[#f5f5f5] text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${trendColor}`}>
        {data.trend === 'BULLISH' ? '↗ Alcista' : data.trend === 'BEARISH' ? '↘ Bajista' : '→ Neutral'}
      </div>
    </div>
  );
}
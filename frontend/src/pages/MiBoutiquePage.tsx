import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; // Shared Firestore instance

// --- HELPER: NORMALIZAR DATOS ---
const normalizeData = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return Object.keys(data).map(key => data[key]);
};

export default function MiBoutiquePage() {
    const [activeTab, setActiveTab] = useState('monthly');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setReportData(null);
            try {
                const dbTag = activeTab === 'monthly' ? 'MONTHLY_PORTFOLIO' : 'WEEKLY_MACRO';
                // Note: Ensure Firestore rules allow read access to 'analysis_results'
                const q = query(collection(db, 'analysis_results'), where('type', '==', dbTag), orderBy('createdAt', 'desc'), limit(1));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    setReportData(snapshot.docs[0].data());
                } else {
                    // FALLBACK DEMO DATA (Premium Feel)
                    console.warn("No active reports found. Loading Demo Report.");
                    setReportData({
                        date: "Q4 2025 Strategy (Demo)",
                        executive_summary: "El entorno macroeconómico actual sugiere una transición hacia un régimen de 'Ricitos de Oro' (Goldilocks), caracterizado por una desinflación persistente y un crecimiento resiliente, especialmente en EE.UU. Sin embargo, la divergencia de políticas monetarias entre el BCE y la Fed podría generar volatilidad en el mercado de divisas.\n\nNuestra estrategia favorece una sobreponderación en Renta Variable de Calidad (Quality) y Tecnología, manteniendo una duración defensiva en Renta Fija para mitigar riesgos de repunte en tipos largos.",
                        marketSentiment: "Bullish (Moderado)",
                        thesis: { title: "Divergencia Transatlántica" },
                        keyDrivers: {
                            0: { title: "Desinflación Estructural", impact: "Favorable para activos de riesgo." },
                            1: { title: "Geopolítica en Oriente Medio", impact: "Riesgo de cola (Petróleo)." },
                            2: { title: "AI Capex Cycle", impact: "Soporte fuerte para Tech Mega-Caps." }
                        },
                        model_portfolio: [
                            { asset_class: "RV Global (Quality)", region: "Global", view: "Sobreponderar", weight: 35, conviction: 5, rationale: "Empresas con altos márgenes y bajo apalancamiento." },
                            { asset_class: "Tecnología (AI)", region: "EE.UU.", view: "Sobreponderar", weight: 25, conviction: 5, rationale: "El ciclo de inversión en IA sigue intacto." },
                            { asset_class: "Renta Fija (IG)", region: "Eurozona", view: "Neutral", weight: 30, conviction: 3, rationale: "Protección ante desaceleración europea." },
                            { asset_class: "Bonos Soberanos Corto Plazo", region: "EE.UU.", view: "Infraponderar", weight: 10, conviction: 2, rationale: "Menor atractivo relativo vs Crédito." }
                        ]
                    });
                }
            } catch (err) {
                console.error("Firestore Error:", err);
                // Fallback on error too for better UX
                setReportData({
                    date: "Q4 2025 Outlook (Offline)",
                    executive_summary: "Modo Offline: No se pudo conectar con el servidor de análisis. Se muestran datos de ejemplo.\n\nLa estrategia actual favorece la calidad y la tecnología.",
                    marketSentiment: "Neutral",
                    keyDrivers: {
                        0: { title: "Conectividad", impact: "Verifique su conexión." },
                    },
                    model_portfolio: []
                });
            } finally { setLoading(false); }
        };
        fetchData();
    }, [activeTab]);

    // Preparamos datos seguros
    const portfolioList = reportData ? normalizeData(reportData.model_portfolio) : [];
    const driversList = reportData ? normalizeData(reportData.keyDrivers) : [];

    // Lógica KPIs
    const topRisk = driversList.length > 0 ? driversList[0].title : "Inflación Persistente";
    const topOpportunity = portfolioList.length > 0
        ? portfolioList.reduce((prev, current) => (prev.conviction > current.conviction) ? prev : current).asset_class
        : "Calidad & Renta Fija";

    return (
        <div className="min-h-screen bg-[#F3F4F6] text-[#1F2937] font-sans">

            {/* HEADER COMPACTO UNIFICADO */}
            <header className="h-16 bg-[#0B2545] text-white px-6 shadow-md border-b-4 border-[#D4AF37] flex items-center justify-between shrink-0 sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <h1 className="font-serif text-xl font-bold tracking-tight">
                        Global Investment <span className="text-[#D4AF37]">Outlook</span>
                    </h1>
                    <div className="hidden md:flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400 border-l border-slate-600 pl-4 h-8">
                        <span className={activeTab === 'monthly' ? 'text-white' : ''}>
                            {activeTab === 'monthly' ? 'Estrategia' : 'Táctico'}
                        </span>
                        {reportData && (
                            <span className="bg-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded text-[10px]">
                                {reportData.date}
                            </span>
                        )}
                    </div>
                </div>

                {/* CONTROLES COMPACTOS */}
                <div className="flex items-center gap-3">
                    <div className="flex bg-[#061a33] p-0.5 rounded border border-slate-700">
                        <button
                            onClick={() => setActiveTab('weekly')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${activeTab === 'weekly' ? 'bg-[#D4AF37] text-[#0B2545]' : 'text-slate-400 hover:text-white'}`}
                        >
                            Semanal
                        </button>
                        <button
                            onClick={() => setActiveTab('monthly')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${activeTab === 'monthly' ? 'bg-[#D4AF37] text-[#0B2545]' : 'text-slate-400 hover:text-white'}`}
                        >
                            Mensual
                        </button>
                    </div>

                    <button
                        onClick={() => alert("Función PDF no disponible en esta versión integrada.")}
                        className="text-white/50 hover:text-white p-2 transition-colors"
                        title="Descargar PDF"
                    >
                        <span className="text-sm">📄</span>
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-10">

                {loading && (
                    <div className="py-24 text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#D4AF37] border-t-transparent"></div>
                        <p className="mt-4 text-[#0B2545] font-bold text-lg">Procesando Análisis IA...</p>
                    </div>
                )}

                {!loading && reportData?.error && (
                    <div className="bg-red-50 p-6 rounded-lg shadow-lg text-center border-l-8 border-red-500">
                        <h3 className="font-serif text-2xl text-red-800">Error de Carga</h3>
                        <p className="text-red-600 mt-2 font-mono text-sm">{reportData.error}</p>
                        <p className="text-gray-600 mt-4 text-xs">
                            Si el error menciona "requires an index", abre la consola (F12) y haz clic en el enlace proporcionado por Firebase.
                        </p>
                    </div>
                )}

                {!loading && !reportData && !reportData?.error && (
                    <div className="bg-white p-12 rounded-lg shadow-lg text-center border-l-8 border-yellow-500">
                        <h3 className="font-serif text-3xl text-[#0B2545]">Informe Pendiente</h3>
                        <p className="text-gray-600 mt-2">
                            No se han encontrado informes recientes en la colección 'analysis_results'.
                        </p>
                        <p className="text-xs text-gray-400 mt-4">Verifica que existan documentos con type="MONTHLY_PORTFOLIO" o "WEEKLY_MACRO"</p>
                    </div>
                )}

                {!loading && reportData && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                        {/* 1. RESUMEN EJECUTIVO */}
                        <section className="bg-white rounded-xl shadow-md p-8 border border-gray-100">
                            <h2 className="font-serif text-2xl font-bold text-[#0B2545] mb-4 border-l-4 border-[#D4AF37] pl-4">
                                1. Resumen Ejecutivo (The Bottom Line)
                            </h2>
                            <div className="text-lg leading-relaxed text-gray-700 text-justify font-light whitespace-pre-line">
                                {reportData.executive_summary}
                            </div>
                        </section>

                        {/* 2. LOS 3 CONTENEDORES (KPIs) */}
                        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* TARJETA 1 */}
                            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-[#1E40AF] text-center hover:-translate-y-1 transition-transform">
                                <h3 className="text-gray-400 uppercase text-xs font-bold tracking-widest mb-3">POSTURA GLOBAL</h3>
                                <p className="text-xl font-bold text-[#0B2545] leading-tight">{reportData.marketSentiment}</p>
                                <p className="text-xs text-gray-500 mt-2">Sentimiento ponderado IA</p>
                            </div>

                            {/* TARJETA 2 (Variable) */}
                            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-[#D4AF37] text-center hover:-translate-y-1 transition-transform">
                                <h3 className="text-gray-400 uppercase text-xs font-bold tracking-widest mb-3">
                                    {activeTab === 'monthly' ? 'RIESGO PRINCIPAL' : 'FOCO DE LA SEMANA'}
                                </h3>
                                <p className="text-xl font-bold text-[#0B2545] leading-tight">
                                    {activeTab === 'monthly'
                                        ? topRisk
                                        : (reportData.thesis?.title || "Volatilidad Táctica")
                                    }
                                </p>
                                <p className="text-xs text-gray-500 mt-2">
                                    {activeTab === 'monthly' ? 'Factor de mayor impacto' : 'Tema central de inversión'}
                                </p>
                            </div>

                            {/* TARJETA 3 */}
                            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-[#10B981] text-center hover:-translate-y-1 transition-transform">
                                <h3 className="text-gray-400 uppercase text-xs font-bold tracking-widest mb-3">OPORTUNIDAD TÁCTICA</h3>
                                <p className="text-xl font-bold text-[#0B2545] leading-tight">
                                    {topOpportunity}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">Mayor convicción del modelo</p>
                            </div>

                        </section>

                        {/* 3. GRÁFICOS VISUALES (MACRO) */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">

                            {/* GRÁFICO 1: Dinámica Monetaria (CON FECHAS) */}
                            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                <h3 className="font-serif text-xl font-bold text-[#0B2545] mb-2">Dinámica Monetaria</h3>
                                <p className="text-xs text-gray-400 mb-6 uppercase tracking-wide">Proyección Tasas (Azul) vs IPC (Dorado)</p>

                                <div className="relative h-56 w-full flex items-end justify-between px-2 pb-2 border-b border-gray-200">
                                    {/* Barras */}
                                    {['5.3%', '5.0%', '4.7%', '4.5%', '4.2%'].map((val, i) => (
                                        <div key={i} className="w-1/6 bg-[#0B2545] rounded-t-sm relative group" style={{ height: `${85 - (i * 8)}%` }}>
                                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-[#0B2545] group-hover:scale-110 transition-transform">{val}</span>
                                        </div>
                                    ))}
                                    {/* Línea Inflación */}
                                    <div className="absolute top-[40%] left-0 w-full h-1 bg-[#D4AF37] opacity-50 border-t-2 border-dashed border-[#D4AF37]"></div>
                                </div>
                                {/* FECHAS AÑADIDAS AQUÍ */}
                                <div className="flex justify-between px-2 mt-2 text-[10px] md:text-xs font-bold text-gray-500 uppercase">
                                    <span className="w-1/6 text-center">Q4 '24</span>
                                    <span className="w-1/6 text-center">Q1 '25</span>
                                    <span className="w-1/6 text-center">Q2 '25</span>
                                    <span className="w-1/6 text-center">Q3 '25</span>
                                    <span className="w-1/6 text-center">Q4 '25</span>
                                </div>
                            </div>

                            {/* GRÁFICO 2: PIB (CORREGIDO - BARRAS VISIBLES) */}
                            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                                <h3 className="font-serif text-xl font-bold text-[#0B2545] mb-2">Divergencia Crecimiento 2025</h3>
                                <p className="text-xs text-gray-400 mb-6 uppercase tracking-wide">Estimación PIB Real (%)</p>

                                <div className="h-56 flex items-end justify-between gap-2 pb-2 border-b border-gray-200">
                                    {[
                                        { l: 'USA', v: '2.1%', h: '32%', c: '#1E40AF' },
                                        { l: 'EUR', v: '0.8%', h: '12%', c: '#9CA3AF' },
                                        { l: 'CHN', v: '4.5%', h: '60%', c: '#EF4444' },
                                        { l: 'JPN', v: '1.0%', h: '16%', c: '#D4AF37' },
                                        { l: 'EM', v: '3.8%', h: '52%', c: '#10B981' }
                                    ].map((d, i) => (
                                        <div key={i} className="w-full h-full flex flex-col justify-end items-center gap-1 group">
                                            <span className="text-xs font-bold" style={{ color: d.c }}>{d.v}</span>
                                            <div className="w-full rounded-t hover:opacity-80 transition-opacity shadow-sm" style={{ backgroundColor: d.c, height: d.h }}></div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between gap-2 mt-2">
                                    <span className="w-full text-center text-[10px] md:text-xs font-bold text-gray-400">USA</span>
                                    <span className="w-full text-center text-[10px] md:text-xs font-bold text-gray-400">EURO</span>
                                    <span className="w-full text-center text-[10px] md:text-xs font-bold text-gray-400">CHINA</span>
                                    <span className="w-full text-center text-[10px] md:text-xs font-bold text-gray-400">JAPÓN</span>
                                    <span className="w-full text-center text-[10px] md:text-xs font-bold text-gray-400">EMERG.</span>
                                </div>
                            </div>
                        </section>

                        {/* 4. MATRIZ DE CARTERA */}
                        {activeTab === 'monthly' && portfolioList.length > 0 && (
                            <section>
                                <h2 className="font-serif text-2xl font-bold text-[#0B2545] mb-6 border-l-4 border-[#D4AF37] pl-4">
                                    3. Matriz de Asignación Táctica
                                </h2>
                                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-[#0B2545] text-white uppercase text-xs">
                                            <tr>
                                                <th className="px-6 py-4 font-bold tracking-wider text-left">Clase</th>
                                                <th className="px-6 py-4 font-bold tracking-wider text-left">Región</th>
                                                <th className="px-6 py-4 font-bold tracking-wider text-left">Visión</th>
                                                <th className="px-6 py-4 font-bold tracking-wider text-center">Peso</th>
                                                <th className="px-6 py-4 font-bold tracking-wider text-center">Convicción</th>
                                                <th className="px-6 py-4 font-bold tracking-wider text-left">Racional</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {portfolioList.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-[#0B2545]">{item.asset_class}</td>
                                                    <td className="px-6 py-4 text-gray-600">{item.region}</td>
                                                    <td className="px-6 py-4 font-bold">
                                                        <span className={`${item.view?.includes('Sobre') ? 'text-[#10B981]' :
                                                            item.view?.includes('Infra') ? 'text-red-600' : 'text-[#D4AF37]'
                                                            }`}>
                                                            {item.view}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-mono font-bold text-gray-700">{item.weight}%</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`py-1 px-3 rounded-full text-xs font-bold text-white ${item.conviction >= 4 ? 'bg-[#10B981]' : item.conviction <= 2 ? 'bg-red-500' : 'bg-[#D4AF37]'
                                                            }`}>
                                                            {item.conviction}/5
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-gray-500 max-w-sm leading-snug">
                                                        {item.rationale}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {/* 5. DRIVERS (Lista) & RIESGOS (Mapa) */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">

                            {/* LISTA DRIVERS */}
                            <div>
                                <h2 className="font-serif text-2xl font-bold text-[#0B2545] mb-6 border-l-4 border-[#D4AF37] pl-4">
                                    4. Drivers de Mercado
                                </h2>
                                <div className="space-y-4">
                                    {driversList.map((driver, i) => (
                                        <div key={i} className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-[#1E40AF] flex gap-4 hover:shadow-md transition-shadow">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#E0E7FF] text-[#1E40AF] flex items-center justify-center font-bold text-sm">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-[#0B2545] text-sm">{driver.title}</h4>
                                                <p className="text-gray-500 text-xs mt-1 leading-relaxed">{driver.impact}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* MAPA DE RIESGO */}
                            <div>
                                <h2 className="font-serif text-2xl font-bold text-[#0B2545] mb-6 border-l-4 border-[#EF4444] pl-4">
                                    5. Monitor de Riesgos
                                </h2>
                                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 h-full relative overflow-hidden flex items-center justify-center">
                                    {/* Cuadrícula */}
                                    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                                        <div className="border-r border-b border-gray-200 bg-gray-50/50"></div>
                                        <div className="border-b border-gray-200 bg-gray-50/50"></div>
                                        <div className="border-r border-gray-200 bg-gray-50/50"></div>
                                        <div className="bg-red-50/30"></div>
                                    </div>

                                    {/* Etiquetas Ejes */}
                                    <span className="absolute top-2 left-2 text-[10px] text-gray-400 font-bold">BAJO IMPACTO</span>
                                    <span className="absolute top-2 right-2 text-[10px] text-gray-400 font-bold">ALTO IMPACTO</span>
                                    <span className="absolute bottom-2 left-2 text-[10px] text-gray-400 font-bold">BAJA PROB.</span>
                                    <span className="absolute bottom-2 right-2 text-[10px] text-red-400 font-bold">ALTA PROB.</span>

                                    {/* Burbujas */}
                                    <div className="relative w-full h-full">
                                        <div className="absolute top-[30%] right-[25%] w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center text-center p-1 border border-red-500 animate-pulse cursor-pointer hover:bg-red-500/20">
                                            <span className="text-xs font-bold text-red-800 leading-tight">Geopolítica</span>
                                        </div>
                                        <div className="absolute bottom-[25%] right-[40%] w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center text-center p-1 border border-yellow-500 cursor-pointer hover:bg-yellow-500/20">
                                            <span className="text-xs font-bold text-yellow-800 leading-tight">Inflación</span>
                                        </div>
                                        <div className="absolute top-[45%] left-[20%] w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-center p-1 border border-blue-500 cursor-pointer hover:bg-blue-500/20">
                                            <span className="text-xs font-bold text-blue-800 leading-tight">Tech</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </section>
                    </div>
                )}
            </main>

            {/* FOOTER */}
            <footer className="bg-[#1F2937] text-gray-400 py-10 px-4 text-center text-xs border-t border-gray-600 mt-12">
                <p>© 2025 Global Asset Management Strategy.</p>
                <p className="mt-2 text-gray-600">Documento generado por IA para fines demostrativos.</p>
            </footer>
        </div>
    );
}

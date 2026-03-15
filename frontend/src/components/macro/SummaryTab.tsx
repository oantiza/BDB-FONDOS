import React, { useMemo } from 'react';

import { WeeklyReport } from '../../types/WeeklyReport';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell
} from 'recharts';

interface SummaryTabProps {
    report: WeeklyReport;
}

const SummaryTab: React.FC<SummaryTabProps> = ({ report }) => {


    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-2xl font-serif font-bold text-brand-dark mb-6 border-b pb-4">
                    {report.summary.headline}
                </h2>

                <article className="prose prose-lg max-w-none text-gray-700 mb-8">
                    <p className="text-lg leading-relaxed">{report.summary.narrative}</p>
                </article>

                {/* VISUAL DASHBOARD: KPIs y Temperatura */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {/* Market Temperature */}
                    {report.summary.marketTemperature && (
                        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center
                            ${report.summary.marketTemperature === 'Bullish' ? 'bg-green-50 border-green-200 text-green-800' :
                                report.summary.marketTemperature === 'Bearish' ? 'bg-red-50 border-red-200 text-red-800' :
                                    'bg-gray-50 border-gray-200 text-gray-800'}`}
                        >
                            <span className="text-sm font-bold uppercase tracking-wider mb-1 opacity-80">Temperatura</span>
                            <span className="text-2xl font-bold">{report.summary.marketTemperature}</span>
                        </div>
                    )}

                    {/* KPIs Rápidos */}
                    {report.summary.kpis?.map((kpi, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{kpi.label}</span>
                            <div className="flex items-center mt-1">
                                <span className="text-2xl font-bold text-brand-dark">{kpi.value}</span>
                                {kpi.trend === 'up' && <span className="ml-2 text-green-500 text-lg">↑</span>}
                                {kpi.trend === 'down' && <span className="ml-2 text-red-500 text-lg">↓</span>}
                                {kpi.trend === 'neutral' && <span className="ml-2 text-gray-400 text-lg">→</span>}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
                    {/* Eventos Clave */}
                    <div>
                        <h3 className="text-lg font-bold text-brand-dark mb-4 uppercase tracking-wide text-sm border-b pb-2">
                            Eventos Clave de la Semana
                        </h3>
                        <ul className="space-y-3 text-gray-700">
                            {report.summary.keyEvents.map((event, idx) => (
                                <li key={idx} className="flex items-start bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <span className="text-brand-dark mr-3 mt-0.5 text-lg">📌</span>
                                    <span className="flex-1 text-sm">{event}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Tail Risks (Cisnes Negros) */}
                    {report.summary.tailRisks && (
                        <div>
                            <h3 className="text-lg font-bold text-brand-dark mb-4 uppercase tracking-wide text-sm border-b pb-2">
                                Tail Risks (Cisnes Negros)
                            </h3>
                            <div className="space-y-3">
                                {report.summary.tailRisks.map((tr, idx) => (
                                    <div key={idx} className="flex flex-col bg-red-50/50 p-3 rounded-lg border border-red-100">
                                        <span className="text-sm font-bold text-red-900 mb-1">{tr.risk}</span>
                                        <div className="flex space-x-4 text-xs">
                                            <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Prob: {tr.probability}</span>
                                            <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Impacto: {tr.impact}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Dashboard Visual de Convicción Ejecutiva */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Visualización 1: Huella de Riesgo (Radar Chart) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col justify-between">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-brand-dark">Huella de Riesgo Global</h3>
                        <p className="text-sm text-gray-500 mt-1">Desviación del mandato Táctico frente al Estratégico base.</p>
                    </div>
                    <div className="h-[320px] w-full flex-grow min-w-0 min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={report.assetAllocation.classes}>
                                <PolarGrid stroke="#E5E7EB" />
                                <PolarAngleAxis dataKey="assetClass" tick={{ fill: '#374151', fontSize: 12, fontWeight: 500 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 'dataMax + 10']} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                                <Radar
                                    name="Peso Táctico (Actual)"
                                    dataKey="tacticalWeight"
                                    stroke="#0B2545"
                                    fill="#0B2545"
                                    fillOpacity={0.6}
                                />
                                <Radar
                                    name="Peso Estratégico (Base)"
                                    dataKey="strategicWeight"
                                    stroke="#D4AF37"
                                    fill="#D4AF37"
                                    fillOpacity={0.3}
                                />
                                <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '15px' }} />
                                <Tooltip contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Visualización 2: Convicción Regional (Horizontal Bar Chart) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 flex flex-col justify-between">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-brand-dark">Convicción Regional (Renta Variable)</h3>
                        <p className="text-sm text-gray-500 mt-1">Exposición táctica coloreada por recomendación del comité.</p>
                    </div>
                    <div className="h-[320px] w-full flex-grow min-w-0 min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <BarChart
                                data={report.assetAllocation.regionsEquity}
                                layout="vertical"
                                margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="region"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#4B5563', fontSize: 13, fontWeight: 500 }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    formatter={(value: number, name: string, props: any) => [
                                        `${value}% (Visión: ${props.payload.view})`,
                                        'Exposición'
                                    ]}
                                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Bar
                                    dataKey="weight"
                                    radius={[0, 4, 4, 0]}
                                    barSize={24}
                                >
                                    {
                                        report.assetAllocation.regionsEquity.map((entry: any, index: number) => {
                                            // Asignamos colores según convicción: Positiva (Verde), Negativa (Rojo), Neutral (Gris/Azul)
                                            let color = '#9CA3AF'; // Neutral
                                            if (entry.view === 'Positiva') color = '#10B981';
                                            if (entry.view === 'Negativa') color = '#EF4444';
                                            return <Cell key={`cell-${index}`} fill={color} />;
                                        })
                                    }
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SummaryTab;

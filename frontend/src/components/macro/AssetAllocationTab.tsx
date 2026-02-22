import React from 'react';
import { WeeklyReport } from '../../types/WeeklyReport';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

interface AssetAllocationTabProps {
    report: WeeklyReport;
}

const COLORS_EQUITY = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const COLORS_FIXED_INCOME = ['#6366F1', '#14B8A6', '#F43F5E', '#8B5CF6', '#F59E0B'];

const AssetAllocationTab: React.FC<AssetAllocationTabProps> = ({ report }) => {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Posicionamiento Global</h2>
                <p className="text-gray-600 mb-8">{report.assetAllocation.overview}</p>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                    {/* Visual Chart: Strategic vs Tactical */}
                    <div className="h-[350px] w-full min-w-0 min-h-0 relative">
                        <h3 className="text-sm font-medium text-gray-600 mb-4 text-center">Desviación Táctica vs Estratégica</h3>
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <BarChart data={report.assetAllocation.classes} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="assetClass" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    formatter={(value: number) => [`${value}%`]}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} />
                                <Bar dataKey="strategicWeight" name="Peso Estratégico" fill="#D1D5DB" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="tacticalWeight" name="Peso Táctico" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto flex items-center">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 rounded-t-lg">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activo</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estr.</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Táct.</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Visión</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Racional</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {report.assetAllocation.classes.map((cls, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 text-sm">{cls.assetClass}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center text-gray-500 text-sm">{cls.strategicWeight}%</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center text-gray-900 font-semibold text-sm">{cls.tacticalWeight}%</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            <span className={`inline-flex px-2.5 py-1 text-xs font-bold rounded-full ${cls.view === 'Positiva' ? 'bg-green-100 text-green-800' :
                                                cls.view === 'Negativa' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                {cls.view}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 italic leading-snug break-words">
                                            {cls.rationale || "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Equity Region Breakdown */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-6">Desglose Renta Variable</h3>
                    <div className="h-[250px] w-full mb-6 min-w-0 min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <PieChart>
                                <Pie
                                    data={report.assetAllocation.regionsEquity}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="weight"
                                    nameKey="region"
                                >
                                    {report.assetAllocation.regionsEquity.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS_EQUITY[index % COLORS_EQUITY.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => [`${value}%`]}
                                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <ul className="space-y-4 px-4">
                        {report.assetAllocation.regionsEquity.map((reg: any, idx: number) => (
                            <li key={idx} className="flex flex-col border-b border-gray-50 pb-3 last:border-0">
                                <div className="flex justify-between items-center text-sm mb-1">
                                    <span className="text-gray-700 flex items-center font-medium">
                                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS_EQUITY[idx % COLORS_EQUITY.length] }}></span>
                                        {reg.region}
                                    </span>
                                    <div className="flex items-center space-x-3">
                                        <span className="font-semibold text-gray-900">{reg.weight}%</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${reg.view === 'Positiva' ? 'text-green-700 bg-green-50' :
                                            reg.view === 'Negativa' ? 'text-red-700 bg-red-50' :
                                                'text-gray-700 bg-gray-100'
                                            }`}>{reg.view}</span>
                                    </div>
                                </div>
                                {reg.rationale && (
                                    <p className="text-xs text-gray-500 italic pl-5">{reg.rationale}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Fixed Income Region Breakdown */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-6">Desglose Renta Fija</h3>
                    <div className="h-[250px] w-full mb-6 min-w-0 min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                            <PieChart>
                                <Pie
                                    data={report.assetAllocation.regionsFixedIncome || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={5}
                                    dataKey="weight"
                                    nameKey="region"
                                >
                                    {(report.assetAllocation.regionsFixedIncome || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS_FIXED_INCOME[index % COLORS_FIXED_INCOME.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => [`${value}%`]}
                                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <ul className="space-y-4 px-4">
                        {(report.assetAllocation.regionsFixedIncome || []).map((reg: any, idx: number) => (
                            <li key={idx} className="flex flex-col border-b border-gray-50 pb-3 last:border-0">
                                <div className="flex justify-between items-center text-sm mb-1">
                                    <span className="text-gray-700 flex items-center font-medium">
                                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS_FIXED_INCOME[idx % COLORS_FIXED_INCOME.length] }}></span>
                                        {reg.region}
                                    </span>
                                    <div className="flex items-center space-x-3">
                                        <span className="font-semibold text-gray-900">{reg.weight}%</span>
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${reg.view === 'Positiva' ? 'text-green-700 bg-green-50' :
                                            reg.view === 'Negativa' ? 'text-red-700 bg-red-50' :
                                                'text-gray-700 bg-gray-100'
                                            }`}>{reg.view}</span>
                                    </div>
                                </div>
                                {reg.rationale && (
                                    <p className="text-xs text-gray-500 italic pl-5">{reg.rationale}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default AssetAllocationTab;

import React from 'react'
import { Check, AlertTriangle } from 'lucide-react'
import ModalHeader from '../common/ModalHeader'
import MetricCard from '../common/MetricCard'

interface PortfolioAnalysisModalProps {
    result: {
        portfolio_metrics: {
            expected_return: number;
            volatility: number;
            sharpe_ratio: number;
        };
        correlation_matrix: Record<string, Record<string, number>>;
        high_correlation_pairs: Array<{
            asset1: string;
            asset2: string;
            correlation: number;
        }>;
        opinion_text: string;
        alternatives: Array<{
            target_replacement: string;
            category: string;
            suggestions: Array<{
                isin: string;
                name: string;
                sharpe: number;
                reason: string;
            }>;
        }>;
    };
    onClose: () => void;
}

export default function PortfolioAnalysisModal({ result, onClose }: PortfolioAnalysisModalProps) {
    const { portfolio_metrics, correlation_matrix, high_correlation_pairs, opinion_text, alternatives } = result;

    const assets = Object.keys(correlation_matrix);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                <ModalHeader
                    title="Análisis de Cartera y Correlaciones"
                    icon="📊"
                    onClose={onClose}
                />

                <div className="p-8 overflow-y-auto custom-scrollbar bg-white space-y-8">

                    {/* Metrics Section */}
                    <div className="grid grid-cols-3 gap-6">
                        <MetricCard
                            label="Rentabilidad Esperada"
                            value={(portfolio_metrics.expected_return * 100).toFixed(2) + '%'}
                        />
                        <MetricCard
                            label="Volatilidad"
                            value={(portfolio_metrics.volatility * 100).toFixed(2) + '%'}
                        />
                        <MetricCard
                            label="Ratio de Sharpe"
                            value={portfolio_metrics.sharpe_ratio.toFixed(2)}
                        />
                    </div>

                    {/* Opinion Section */}
                    <div className="p-6 bg-[#fcfcfc] border-l-4 border-[#003399] rounded-r shadow-sm">
                        <label className="text-[10px] font-bold text-[#0B2545] uppercase tracking-[0.2em] mb-3 block">Dictamen del Analista IA</label>
                        <p className="text-sm text-[#2C3E50] leading-relaxed italic">
                            "{opinion_text}"
                        </p>
                    </div>

                    <div className="grid grid-cols-12 gap-8">
                        {/* Correlation Matrix */}
                        <div className="col-span-7">
                            <label className="text-[10px] font-bold text-[#0B2545] uppercase tracking-[0.2em] mb-4 block">Matriz de Correlación</label>
                            <div className="overflow-x-auto border border-[#eeeeee] rounded-lg">
                                <table className="w-full text-[10px] text-center border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-2 border-b border-[#eeeeee] bg-slate-50"></th>
                                            {assets.map(asset => (
                                                <th key={asset} className="p-2 border-b border-[#eeeeee] bg-slate-50 font-mono text-[9px] vertical-text h-32">
                                                    <div className="truncate w-24 origin-bottom-left -rotate-45 translate-x-4">
                                                        {asset}
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assets.map(row => (
                                            <tr key={row}>
                                                <td className="p-2 border-r border-b border-[#eeeeee] bg-slate-50 font-mono text-left font-bold">{row}</td>
                                                {assets.map(col => {
                                                    const val = correlation_matrix[row][col];
                                                    const colorClass = val > 0.8 ? 'bg-red-100 text-red-800' : (val > 0.5 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700');
                                                    return (
                                                        <td key={col} className={`p-2 border-b border-r border-[#eeeeee] font-mono ${colorClass}`}>
                                                            {val.toFixed(2)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* High Correlation Alert & Alternatives */}
                        <div className="col-span-5 space-y-6">
                            <div>
                                <label className="text-[10px] font-bold text-[#0B2545] uppercase tracking-[0.2em] mb-3 block border-b border-slate-100 pb-2">Alertas de Concentración</label>
                                {high_correlation_pairs.length > 0 ? (
                                    <div className="space-y-2 mb-4">
                                        {high_correlation_pairs.map((pair, idx) => (
                                            <div key={idx} className="px-3 py-2.5 bg-white border border-rose-100 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-xs flex justify-between items-center group hover:border-rose-200 transition-colors">
                                                <span className="text-slate-700 font-mono text-[10px]"><span className="text-slate-900 font-semibold">{pair.asset1}</span> <span className="text-slate-300 px-1">⟷</span> <span className="text-slate-900 font-semibold">{pair.asset2}</span></span>
                                                <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[10px]">{(pair.correlation * 100).toFixed(0)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="px-3 py-2.5 bg-white border border-emerald-100 rounded shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-xs text-emerald-800 flex items-center gap-2 mb-4">
                                        <AlertTriangle className="w-4 h-4 text-emerald-500" strokeWidth={2.5}/>
                                        <span className="font-medium tracking-wide">Diversificación óptima. No se detectan correlaciones críticas.</span>
                                    </div>
                                )}
                            </div>

                            {/* Suggestions */}
                            <div>
                                <label className="text-[10px] font-bold text-[#0B2545] uppercase tracking-[0.2em] mb-3 block border-b border-slate-100 pb-2">Sugerencias de Mejora</label>
                                {alternatives.length > 0 ? (
                                    <div className="space-y-4">
                                        {alternatives.map((alt, idx) => (
                                            <div key={idx} className="border border-slate-200 rounded-lg p-0 bg-white overflow-hidden shadow-sm">
                                                <div className="flex justify-between items-center px-4 py-3 bg-slate-50/80 border-b border-slate-100">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest border border-slate-200 bg-white px-1.5 py-0.5 rounded">Sustituir</span>
                                                        <span className="text-[11px] font-bold text-slate-700 font-mono">{alt.target_replacement}</span>
                                                    </div>
                                                    <div className="px-2 py-0.5 bg-blue-50/50 text-blue-700 border border-blue-100 text-[9px] font-bold rounded uppercase tracking-wider">
                                                        {alt.category}
                                                    </div>
                                                </div>
                                                <div className="p-3 space-y-2">
                                                    {alt.suggestions.map((s, sIdx) => (
                                                        <div key={sIdx} className="bg-white p-3 rounded-md border border-slate-200 hover:border-blue-200 hover:bg-blue-50/10 transition-colors">
                                                            <div className="flex justify-between items-center font-bold text-xs text-slate-800 mb-1.5">
                                                                <span className="truncate w-44">{s.name}</span>
                                                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-mono border border-emerald-100 shadow-sm">Sharpe: {s.sharpe.toFixed(2)}</span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 leading-relaxed mb-1.5">
                                                                {s.reason}
                                                            </div>
                                                            <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{s.isin}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 px-8 py-2.5 bg-[#0B2545] hover:bg-[#1E3A8A] text-white rounded-lg shadow-sm hover:shadow-md transition-all border border-transparent font-bold text-[11px] tracking-widest uppercase"
                    >
                        <span>Entendido</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

import React from 'react'
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
                                <label className="text-[10px] font-bold text-[#0B2545] uppercase tracking-[0.2em] mb-3 block">Alertas de Concentración</label>
                                {high_correlation_pairs.length > 0 ? (
                                    <div className="space-y-2">
                                        {high_correlation_pairs.map((pair, idx) => (
                                            <div key={idx} className="p-3 bg-red-50 border border-red-100 rounded text-xs flex justify-between items-center">
                                                <span className="text-red-900 font-mono">{pair.asset1} ⟷ {pair.asset2}</span>
                                                <span className="font-bold text-red-600">{(pair.correlation * 100).toFixed(0)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded text-xs text-emerald-800 flex items-center gap-2">
                                        <span>✅</span> Diversificación óptima. No se detectan correlaciones críticas.
                                    </div>
                                )}
                            </div>

                            {alternatives.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-bold text-[#0B2545] uppercase tracking-[0.2em] mb-3 block">Sugerencias de Mejora</label>
                                    <div className="space-y-4">
                                        {alternatives.map((alt, idx) => (
                                            <div key={idx} className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Sustituir</div>
                                                        <div className="text-xs font-bold text-slate-700 font-mono">{alt.target_replacement}</div>
                                                    </div>
                                                    <div className="px-2 py-0.5 bg-[#003399] text-white text-[8px] font-bold rounded uppercase">
                                                        {alt.category}
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    {alt.suggestions.map((s, sIdx) => (
                                                        <div key={sIdx} className="bg-white p-3 rounded border border-slate-100 shadow-sm hover:border-[#003399]/30 transition-colors">
                                                            <div className="flex justify-between font-bold text-xs text-[#0B2545] mb-1">
                                                                <span className="truncate w-40">{s.name}</span>
                                                                <span className="text-emerald-600 font-mono">Sharpe: {s.sharpe.toFixed(2)}</span>
                                                            </div>
                                                            <div className="text-[9px] text-[#2C3E50] leading-relaxed opacity-70">
                                                                {s.reason}
                                                            </div>
                                                            <div className="mt-1 text-[9px] font-mono text-slate-400">{s.isin}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-[#eeeeee] flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[#003399] hover:bg-[#0B2545] text-white font-bold text-xs uppercase tracking-[0.1em] transition-colors rounded shadow-sm"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    )
}

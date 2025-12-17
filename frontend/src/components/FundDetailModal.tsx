import React from 'react'

interface FundDetailModalProps {
    fund: any
    onClose: () => void
}

export default function FundDetailModal({ fund, onClose }: FundDetailModalProps) {
    if (!fund) return null;

    const perf = fund.std_perf || fund.perf || {};
    const extra = fund.std_extra || {};
    const costs = fund.costs || {};
    const holdings = fund.holdings || [];
    const sectors = fund.sectors || [];
    const regions = fund.regions || {};

    // Format helpers
    const pct = (v: number) => v ? `${(v * 100).toFixed(2)}%` : 'N/A';
    const num = (v: number, decimals = 2) => v ? v.toFixed(decimals) : 'N/A';

    // Rating Helper
    const rating = fund.stars || fund.morningstar_rating || fund.rating || 0;
    const renderStars = (n: number) => {
        return Array(5).fill(0).map((_, i) => (
            <span key={i} className={i < n ? "text-amber-400" : "text-slate-200"}>★</span>
        ))
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Standardized */}
                <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
                    <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2 truncate pr-4">
                        <span className="text-base">📝</span>
                        <span className="truncate" title={fund.name}>{fund.name}</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-lg leading-none"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Key Metrics */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                            Métricas Clave
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MetricCard label="Sharpe Ratio" value={num(perf.sharpe)} color="blue" />
                            <MetricCard label="Volatilidad" value={pct(perf.volatility)} color="amber" />
                            <MetricCard label="CAGR 3Y" value={pct(perf.cagr3y)} color="emerald" />
                            <MetricCard label="Alpha" value={num(perf.alpha)} color="purple" />
                            <MetricCard label="Beta" value={num(perf.beta)} color="slate" />
                            <MetricCard label="Max Drawdown" value={pct(perf.max_drawdown)} color="red" />
                            <MetricCard label="TER" value={pct(extra.ter || costs.ter)} color="orange" />
                        </div>
                    </section>

                    {/* Fund Info */}
                    <section className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                        <InfoRow label="Gestora" value={extra.company || 'N/A'} />
                        <InfoRow label="Categoría" value={extra.category || fund.category_morningstar || 'N/A'} />
                        <InfoRow label="Región Principal" value={extra.regionDetail || fund.primary_region || 'Global'} />
                        <InfoRow label="Moneda" value={extra.currency || 'EUR'} />
                        <InfoRow label="Patrimonio" value={fund.patrimonio || 'N/A'} />

                        {/* Morningstar Rating */}
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Morningstar Rating</div>
                            <div className="text-lg flex items-center gap-1">
                                {renderStars(rating)}
                                <span className="text-xs text-slate-400 ml-1">({rating})</span>
                            </div>
                        </div>
                    </section>

                    {/* Costs (Simplified as requested: Removed Retrocession) */}
                    <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                            Costes
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <InfoRow label="TER" value={pct(extra.ter || costs.ter)} />
                            <InfoRow label="Gestión" value={pct(costs.management_fee)} />
                        </div>
                    </section>

                    {/* Geographic Distribution */}
                    {Object.keys(regions).length > 0 && (
                        <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                                Distribución Geográfica
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(regions)
                                    .filter(([_, weight]) => (weight as number) > 0)
                                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                                    .map(([region, weight]) => (
                                        <div key={region} className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700">
                                            <div className="text-[10px] text-blue-600 dark:text-blue-400 capitalize font-bold">{region}</div>
                                            <div className="text-xs font-bold text-blue-800 dark:text-blue-300">{(weight as number).toFixed(1)}%</div>
                                        </div>
                                    ))}
                            </div>
                        </section>
                    )}

                    {/* Sectors Distribution (Requested explicitly) */}
                    {sectors.length > 0 && (
                        <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                                Distribución Sectorial
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {sectors.slice(0, 10).map((sector: any, i: number) => (
                                    <span
                                        key={i}
                                        className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded border border-purple-200 dark:border-purple-700 font-medium"
                                    >
                                        {sector.name || sector.sector}: <span className="font-bold">{sector.weight?.toFixed(1)}%</span>
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Top Holdings */}
                    {holdings.length > 0 && (
                        <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                                Top Holdings
                            </h3>
                            <div className="space-y-1">
                                {holdings.slice(0, 10).map((h: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-700/50 px-3 py-1.5 rounded border border-slate-100 dark:border-slate-700">
                                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-[80%]">{h.name}</span>
                                        <span className="font-mono font-bold text-slate-600 dark:text-slate-400 ml-2">{h.weight?.toFixed(2)}%</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Description */}
                    {fund.description && (
                        <section className="border-t border-slate-100 dark:border-slate-700 pt-4">
                            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-wider">
                                Descripción
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                {fund.description}
                            </p>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 font-bold rounded text-xs transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}

const MetricCard = ({ label, value, color }: { label: string, value: string, color: string }) => {
    const colorClasses = {
        blue: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300',
        amber: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300',
        purple: 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300',
        slate: 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300',
        red: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300',
        orange: 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700 text-orange-700 dark:text-orange-300',
    }[color] || colorClasses.slate

    return (
        <div className={`p-3 rounded-lg border ${colorClasses}`}>
            <div className="text-xs opacity-70 uppercase font-semibold mb-1">{label}</div>
            <div className="text-lg font-bold font-mono">{value}</div>
        </div>
    )
}

const InfoRow = ({ label, value }: { label: string, value: string }) => (
    <div>
        <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">{label}</div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={value}>{value}</div>
    </div>
)

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

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-gradient-to-r from-brand to-brand-light dark:from-slate-700 dark:to-slate-600 text-white p-4 rounded-t-xl flex justify-between items-start">
                        <div className="min-w-0 pr-4">
                            <h2 className="font-bold text-lg truncate" title={fund.name}>
                                {fund.name}
                            </h2>
                            <p className="text-xs opacity-80 font-mono mt-1">{fund.isin}</p>
                            <p className="text-xs opacity-70 mt-1">{extra.category || fund.category_morningstar || 'N/A'}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white text-2xl leading-none shrink-0 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition"
                        >
                            ×
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Key Metrics */}
                        <section>
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                                <span>📊</span> Métricas Clave
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <MetricCard label="Sharpe Ratio" value={num(perf.sharpe)} color="blue" />
                                <MetricCard label="Volatilidad" value={pct(perf.volatility)} color="amber" />
                                <MetricCard label="CAGR 3Y" value={pct(perf.cagr3y)} color="emerald" />
                                <MetricCard label="Alpha" value={num(perf.alpha)} color="purple" />
                                <MetricCard label="Beta" value={num(perf.beta)} color="slate" />
                                <MetricCard label="R²" value={num(perf.r2 / 100, 2)} color="slate" />
                                <MetricCard label="Max Drawdown" value={pct(perf.max_drawdown)} color="red" />
                                <MetricCard label="TER" value={pct(extra.ter || costs.ter)} color="orange" />
                            </div>
                        </section>

                        {/* Fund Info */}
                        <section className="grid grid-cols-2 gap-4">
                            <InfoRow label="Gestora" value={extra.company || 'N/A'} />
                            <InfoRow label="Gestor" value={fund.manager || 'N/A'} />
                            <InfoRow label="Región Principal" value={extra.regionDetail || fund.primary_region || 'Global'} />
                            <InfoRow label="Moneda" value={extra.currency || 'EUR'} />
                            <InfoRow label="Antigüedad" value={`${extra.yearsHistory || 0} años`} />
                            <InfoRow label="Patrimonio" value={fund.patrimonio || 'N/A'} />
                        </section>

                        {/* Costs */}
                        <section>
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                                <span>💰</span> Costes
                            </h3>
                            <div className="grid grid-cols-3 gap-3">
                                <InfoRow label="TER" value={pct(extra.ter || costs.ter)} />
                                <InfoRow label="Gestión" value={pct(costs.management_fee)} />
                                <InfoRow label="Retrocesión" value={pct(costs.retrocession)} />
                            </div>
                        </section>

                        {/* Geographic Distribution */}
                        {Object.keys(regions).length > 0 && (
                            <section>
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                                    <span>🌍</span> Distribución Geográfica
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(regions)
                                        .filter(([_, weight]) => (weight as number) > 0)
                                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                                        .map(([region, weight]) => (
                                            <div key={region} className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700">
                                                <div className="text-xs text-blue-600 dark:text-blue-400 capitalize">{region}</div>
                                                <div className="text-sm font-bold text-blue-800 dark:text-blue-300">{(weight as number).toFixed(1)}%</div>
                                            </div>
                                        ))}
                                </div>
                            </section>
                        )}

                        {/* Sectors */}
                        {sectors.length > 0 && (
                            <section>
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                                    <span>🏭</span> Sectores
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {sectors.slice(0, 10).map((sector: any, i: number) => (
                                        <span
                                            key={i}
                                            className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded border border-purple-200 dark:border-purple-700"
                                        >
                                            {sector.name || sector.sector}: {sector.weight?.toFixed(1)}%
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Top Holdings */}
                        {holdings.length > 0 && (
                            <section>
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                                    <span>📈</span> Top Holdings
                                </h3>
                                <div className="space-y-2">
                                    {holdings.slice(0, 10).map((h: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center text-sm bg-slate-50 dark:bg-slate-700 px-3 py-2 rounded">
                                            <span className="text-slate-700 dark:text-slate-300 truncate">{h.name}</span>
                                            <span className="font-mono font-bold text-slate-600 dark:text-slate-400 ml-2">{h.weight?.toFixed(2)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Description */}
                        {fund.description && (
                            <section>
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase mb-3 flex items-center gap-2">
                                    <span>📝</span> Descripción
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-l-4 border-accent pl-4 italic">
                                    {fund.description}
                                </p>
                            </section>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 p-4 rounded-b-xl border-t border-slate-200 dark:border-slate-700 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-bold rounded-lg transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </>
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

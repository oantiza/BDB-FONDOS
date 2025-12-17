import React from 'react'

export default function FundDetailPanel({ fund, onClose }) {
    if (!fund) return null;

    const perf = fund.std_perf || fund.perf || {};
    const extra = fund.std_extra || {};
    const costs = fund.costs || {};
    const holdings = fund.holdings || [];

    // Format percentage
    const pct = (v) => v ? `${(v * 100).toFixed(2)}%` : 'N/A';

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-md p-4 max-w-md animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-2">
                <div className="min-w-0 pr-2">
                    <h3 className="font-bold text-slate-800 text-sm truncate" title={fund.name}>
                        {fund.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">{fund.isin}</p>
                </div>
                <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 text-lg leading-none shrink-0"
                >
                    ×
                </button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <InfoItem label="Categoría" value={extra.category || fund.category_morningstar || 'N/A'} />
                <InfoItem label="Gestora" value={extra.company || 'N/A'} />
                <InfoItem label="Región" value={extra.regionDetail || fund.primary_region || 'Global'} />
                <InfoItem label="Moneda" value={extra.currency || 'EUR'} />
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-2 mb-3">
                <MetricBox label="Vol." value={pct(perf.volatility)} color="text-slate-700" />
                <MetricBox label="Sharpe" value={perf.sharpe?.toFixed(2) || 'N/A'} color="text-blue-600" />
                <MetricBox label="CAGR 3Y" value={pct(perf.cagr3y)} color="text-emerald-600" />
                <MetricBox label="TER" value={pct(extra.ter)} color="text-amber-600" />
            </div>

            {/* Description (truncated) */}
            {fund.description && (
                <div className="text-[10px] text-slate-500 mb-3 line-clamp-2 italic border-l-2 border-slate-200 pl-2">
                    {fund.description}
                </div>
            )}

            {/* Top Holdings (if available) */}
            {holdings.length > 0 && (
                <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Top Holdings</div>
                    <div className="flex flex-wrap gap-1">
                        {holdings.slice(0, 5).map((h, i) => (
                            <span
                                key={i}
                                className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
                                title={`${h.name}: ${h.weight}%`}
                            >
                                {h.name?.split(' ')[0]} ({h.weight?.toFixed(1)}%)
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Costs Row */}
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                <span>Retrocesión: {(costs.retrocession || 0).toFixed(2)}%</span>
                <span>Gestión: {(costs.management_fee || 0).toFixed(2)}%</span>
            </div>
        </div>
    )
}

const InfoItem = ({ label, value }) => (
    <div className="flex flex-col">
        <span className="text-slate-400 uppercase text-[9px] font-bold">{label}</span>
        <span className="text-slate-700 font-bold truncate" title={value}>{value}</span>
    </div>
)

const MetricBox = ({ label, value, color }) => (
    <div className="bg-slate-50 rounded p-1.5 text-center border border-slate-100">
        <div className="text-[9px] text-slate-400 uppercase font-bold">{label}</div>
        <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
    </div>
)

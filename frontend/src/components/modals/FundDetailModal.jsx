import React from 'react'

export default function FundDetailModal({ fund, onClose, onAddToPortfolio }) {
    if (!fund) return null

    // DEBUG: Log the full fund object to see actual structure
    console.log("FundDetailModal - Full fund data:", fund)

    // Extract data with fallbacks - using ACTUAL Firestore field names
    const name = fund.name || 'Sin nombre'
    const isin = fund.isin || 'N/A'
    // Category uses category_morningstar in Firestore
    const category = fund.category_morningstar || fund.std_extra?.category || fund.morningstar_category || fund.std_type || 'Mixto'
    const region = fund.primary_region || fund.std_extra?.regionDetail || fund.std_region || 'Global'
    const currency = fund.currency || fund.std_extra?.currency || 'EUR'
    const company = fund.fund_company || fund.std_extra?.company || 'N/A'

    // Costs - management_fee is more reliable than ter (which is often 0)
    const mgmtFee = fund.costs?.management_fee ?? null
    const terVal = fund.costs?.ter ?? fund.std_extra?.ter ?? null
    const ter = (terVal && terVal > 0) ? terVal : mgmtFee

    // Morningstar Rating - use rating_overall from Firestore
    const rating = fund.rating_overall || fund.stars || fund.morningstar_rating || 0

    // Performance from perf object - volatility is ALREADY in percentage (e.g., 10.23 for 10.23%)
    const perf = fund.perf || {}
    const volatility = perf.volatility ?? fund.std_perf?.volatility ?? null
    const sharpe = perf.sharpe ?? fund.std_perf?.sharpe ?? null

    // Returns from yearly_returns array
    const yearlyReturns = fund.yearly_returns || []
    const currentYear = new Date().getFullYear()
    const ytdEntry = yearlyReturns.find(r => r.year === currentYear)
    const lastYearEntry = yearlyReturns.find(r => r.year === currentYear - 1)
    const ytd = ytdEntry?.return ?? fund.returns?.ytd ?? null
    const r1y = lastYearEntry?.return ?? fund.returns?.['1y'] ?? null

    // Calculate 3Y return from yearly_returns
    let cagr3yCalc = fund.std_perf?.cagr3y ?? fund.perf?.cagr3y ?? null
    if (!cagr3yCalc && yearlyReturns.length >= 3) {
        const recentReturns = yearlyReturns.slice(0, 3).map(r => r.return)
        cagr3yCalc = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length
    }
    const cagr3y = cagr3yCalc

    const formatPercent = (val) => {
        if (val === null || val === undefined) return 'N/A'
        const num = parseFloat(val)
        if (isNaN(num)) return 'N/A'
        // If value is already a ratio (e.g., 0.05 for 5%), multiply by 100
        // If value is already a percentage (e.g., 5 for 5%), just show it
        const displayVal = Math.abs(num) < 1 ? num * 100 : num
        return displayVal.toFixed(2) + '%'
    }

    const MetricRow = ({ label, value, isPercent = false }) => (
        <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
            <span className="text-xs text-gray-500 font-bold uppercase">{label}</span>
            <span className="text-sm font-mono font-bold text-gray-700">
                {isPercent ? formatPercent(value) : (value ?? 'N/A')}
            </span>
        </div>
    )

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">

                {/* Header - Unified Style */}
                <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                    <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                        <span className="text-base">📊</span> Detalle del Fondo
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-2">&times;</button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">

                    {/* Fund Name & ISIN */}
                    <div className="text-center border-b border-gray-200 pb-4">
                        <h4 className="text-lg font-bold text-[#0B2545] leading-tight">{name}</h4>
                        <span className="text-xs font-mono text-gray-400">{isin}</span>
                    </div>

                    {/* Classification */}
                    <div className="grid grid-cols-4 gap-3 text-center">
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Categoría</div>
                            <div className="text-sm font-bold text-[#0B2545]">{category}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Región</div>
                            <div className="text-sm font-bold text-[#0B2545]">{region}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Divisa</div>
                            <div className="text-sm font-bold text-[#0B2545]">{currency}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-100">
                            <div className="text-[9px] text-gray-400 uppercase font-bold">Rating ★</div>
                            <div className="text-sm font-bold text-[#D4AF37]">
                                {rating > 0 ? '★'.repeat(Math.min(rating, 5)) + '☆'.repeat(Math.max(0, 5 - rating)) : 'N/A'}
                            </div>
                        </div>
                    </div>

                    {/* Performance */}
                    <div className="bg-white rounded border border-gray-200 p-4">
                        <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">Rentabilidad</h5>
                        <MetricRow label="YTD" value={ytd} isPercent />
                        <MetricRow label="1 Año" value={r1y} isPercent />
                        <MetricRow label="3 Años (Ann.)" value={cagr3y} isPercent />
                        <MetricRow label="Sharpe" value={sharpe} isPercent={false} />
                    </div>

                    {/* Risk & Costs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded border border-gray-200 p-4">
                            <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">Riesgo</h5>
                            <MetricRow label="Volatilidad" value={volatility} isPercent />
                        </div>
                        <div className="bg-white rounded border border-gray-200 p-4">
                            <h5 className="text-xs font-bold text-gray-500 uppercase mb-3">Costes</h5>
                            <MetricRow label="TER" value={ter} isPercent />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={() => { onAddToPortfolio(fund); onClose(); }}
                        className="px-4 py-2 text-xs font-bold text-white bg-[#0B2545] hover:bg-[#1a3b66] rounded shadow-sm transition-colors flex items-center gap-1"
                    >
                        <span>+</span> Añadir a Cartera
                    </button>
                </div>
            </div>
        </div>
    )
}

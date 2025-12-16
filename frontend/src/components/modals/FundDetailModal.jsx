import { X } from 'lucide-react'

// Helper para formatear porcentajes
const fmtPct = (val) => {
    if (val === undefined || val === null) return 'N/A'
    return (val * 100).toFixed(2) + '%'
}

const fmtNum = (val) => {
    if (val === undefined || val === null) return 'N/A'
    return val.toFixed(2)
}

export default function FundDetailModal({ fund, onClose }) {
    if (!fund) return null

    // Extraer datos normalizados
    const perf = fund.std_perf || {}
    const extra = fund.std_extra || {}
    const regions = fund.regions || {}
    const sectors = fund.sectors || {}

    // Convertir mapas a arrays para visualización
    const regionList = Object.entries(regions)
        .sort(([, a], [, b]) => b - a)
        .filter(([, v]) => v > 0)
        .slice(0, 5)

    const sectorList = Object.entries(sectors)
        .sort(([, a], [, b]) => b - a)
        .filter(([, v]) => v > 0)
        .slice(0, 5)

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* HEADER */}
                <div className="bg-slate-900 text-white p-6 relative shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>

                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold bg-blue-600 text-white px-2 py-0.5 rounded w-fit uppercase tracking-wider">
                            {fund.std_type || 'Fondo'}
                        </span>
                        <h2 className="text-2xl font-bold leading-tight pr-8">{fund.name}</h2>
                        <div className="flex gap-4 text-sm text-slate-400 mt-2 font-mono">
                            <span>ISIN: {fund.isin}</span>
                            {fund.ticker && <span>Tk: {fund.ticker}</span>}
                            <span>{extra.company}</span>
                        </div>
                    </div>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div className="overflow-y-auto p-6 flex flex-col gap-8">

                    {/* KPI ROW */}
                    <div className="grid grid-cols-4 gap-4">
                        <MetricCard label="Retorno 3A (Ann)" value={fmtPct(perf.cagr3y)} mood={perf.cagr3y > 0 ? 'good' : 'bad'} />
                        <MetricCard label="Volatilidad" value={fmtPct(perf.volatility)} mood="neutral" />
                        <MetricCard label="Sharpe" value={fmtNum(perf.sharpe)} mood={perf.sharpe > 1 ? 'good' : (perf.sharpe < 0 ? 'bad' : 'neutral')} />
                        <MetricCard label="Alpha" value={fmtNum(perf.alpha)} mood={perf.alpha > 0 ? 'good' : 'bad'} />
                    </div>

                    {/* SECTIONS GRID */}
                    <div className="grid grid-cols-2 gap-8">

                        {/* LEFT COL: Allocation */}
                        <div className="flex flex-col gap-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 border-b border-slate-100 pb-1">Top Regiones</h3>
                                <div className="flex flex-col gap-2">
                                    {regionList.length > 0 ? regionList.map(([k, v]) => (
                                        <ProgressBar key={k} label={k} value={v} color="bg-blue-500" />
                                    )) : <span className="text-xs text-slate-400 italic">No disponible</span>}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 border-b border-slate-100 pb-1">Top Sectores</h3>
                                <div className="flex flex-col gap-2">
                                    {sectorList.length > 0 ? sectorList.map(([k, v]) => (
                                        <ProgressBar key={k} label={k} value={v} color="bg-teal-500" />
                                    )) : <span className="text-xs text-slate-400 italic">No disponible</span>}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COL: Info & Costs */}
                        <div className="flex flex-col gap-6">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase mb-3 border-b border-slate-100 pb-1">Perfil & Costes</h3>
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-slate-50">
                                        <Row label="Categoría" value={extra.category || 'N/A'} />
                                        <Row label="Clase Activo" value={extra.assetClass || 'N/A'} />
                                        <Row label="Divisa" value={extra.currency} />
                                        <Row label="Antigüedad" value={`${Math.round(extra.yearsHistory || 0)} años`} />
                                        <Row label="Gastos Corrientes (OGC)" value={fmtPct((extra.ter || 0) / 100)} bold />
                                        <Row label="Comisión Gestión" value={fmtPct((extra.mgmtFee || 0) / 100)} />
                                    </tbody>
                                </table>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Policy / Estrategia</h4>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    {fund.investment_strategy || "Sin descripción detallada disponible para este fondo."}
                                </p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* FOOTER */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 text-center">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-slate-300 shadow-sm text-slate-700 font-bold rounded hover:bg-slate-100 transition-colors text-sm"
                    >
                        Cerrar Ficha
                    </button>
                </div>

            </div>
        </div>
    )
}

function MetricCard({ label, value, mood = 'neutral' }) {
    const colors = {
        good: 'text-emerald-600',
        bad: 'text-rose-600',
        neutral: 'text-slate-700'
    }
    return (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">{label}</span>
            <span className={`text-xl font-bold ${colors[mood]} font-mono`}>{value}</span>
        </div>
    )
}

function ProgressBar({ label, value, color }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700 capitalize">{label.replace(/_/g, ' ')}</span>
                <span className="font-mono text-slate-500">{value.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color}`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                />
            </div>
        </div>
    )
}

function Row({ label, value, bold = false }) {
    return (
        <tr>
            <td className="py-2 text-slate-500">{label}</td>
            <td className={`py-2 text-right ${bold ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{value}</td>
        </tr>
    )
}

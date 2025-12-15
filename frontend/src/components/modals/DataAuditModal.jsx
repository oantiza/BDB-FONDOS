import React, { useMemo, useState } from 'react'

export default function DataAuditModal({ assets, onClose }) {
    const [filter, setFilter] = useState('all') // all, clean, incomplete

    const audit = useMemo(() => {
        const total = assets.length
        const incomplete = []

        // Counters
        let missingCat = 0
        let missingClass = 0
        let missingRegion = 0
        let missingCompany = 0
        let lowHistory = 0

        assets.forEach(f => {
            const extra = f.std_extra || {}
            const issues = []

            if (!extra.category) {
                issues.push('Falta Categoría')
                missingCat++
            }
            if (!extra.assetClass) {
                issues.push('Falta Asset Class')
                missingClass++
            }
            if (!extra.regionDetail) {
                issues.push('Falta Región Detail')
                missingRegion++
            }
            if (!extra.company || extra.company === 'Unknown') {
                issues.push('Falta Gestora')
                missingCompany++
            }

            const years = extra.yearsHistory || 0
            if (years < 1) {
                issues.push('Sin histórico (<1 año)')
                lowHistory++
            }

            if (issues.length > 0) {
                incomplete.push({
                    isin: f.isin,
                    name: f.name,
                    issues: issues
                })
            }
        })

        return {
            total,
            cleanCount: total - incomplete.length,
            incompleteCount: incomplete.length,
            incompleteList: incomplete,
            stats: { missingCat, missingClass, missingRegion, missingCompany, lowHistory }
        }
    }, [assets])

    const showList = filter === 'clean' ? [] : audit.incompleteList

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-200">

                {/* Header */}
                <div className="bg-[#0B2545] p-6 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <span>🩺</span> Auditoría de Datos
                        </h2>
                        <p className="text-slate-300 text-sm mt-1">
                            Validando {audit.total} fondos cargados
                        </p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white text-2xl font-bold">&times;</button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-slate-50 flex flex-col gap-6">

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Total Fondos" value={audit.total} color="bg-slate-100 border-slate-200" />
                        <StatCard label="Datos Completos" value={audit.cleanCount} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
                        <StatCard label="Incompletos" value={audit.incompleteCount} color="bg-amber-50 border-amber-200 text-amber-700" />
                        <StatCard label="% Calidad" value={((audit.cleanCount / audit.total) * 100).toFixed(1) + '%'} color="bg-blue-50 border-blue-200 text-blue-700" />
                    </div>

                    {/* Error Breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <ErrorBadge label="Sin Categoría" count={audit.stats.missingCat} total={audit.total} />
                        <ErrorBadge label="Sin Asset Class" count={audit.stats.missingClass} total={audit.total} />
                        <ErrorBadge label="Sin Región Detalle" count={audit.stats.missingRegion} total={audit.total} />
                        <ErrorBadge label="Sin Gestora" count={audit.stats.missingCompany} total={audit.total} />
                        <ErrorBadge label="Falta Histórico" count={audit.stats.lowHistory} total={audit.total} warn />
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow border border-slate-200 flex-1 flex flex-col min-h-0">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-700">Fondos Incompletos ({audit.incompleteList.length})</h3>
                            <div className="text-xs text-slate-400">
                                Estos fondos usarán valores 'default' en los gráficos.
                            </div>
                        </div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3">ISIN</th>
                                        <th className="p-3">Nombre</th>
                                        <th className="p-3">Problemas Detectados</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {showList.map(item => (
                                        <tr key={item.isin} className="hover:bg-slate-50 group">
                                            <td className="p-3 font-mono text-xs text-slate-500">{item.isin}</td>
                                            <td className="p-3 font-bold text-slate-700">{item.name}</td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {item.issues.map((issue, i) => (
                                                        <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 font-bold border border-rose-200">
                                                            {issue}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {showList.length === 0 && (
                                        <tr>
                                            <td colSpan="3" className="p-8 text-center text-emerald-500 font-bold">
                                                ¡Todos los fondos tienen datos completos! 🎉
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-white flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-800 text-white font-bold rounded hover:bg-slate-700 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, color }) {
    return (
        <div className={`p-4 rounded-lg border ${color} flex flex-col items-center justify-center`}>
            <div className="text-3xl font-black mb-1">{value}</div>
            <div className="text-xs uppercase font-bold tracking-wider opacity-70">{label}</div>
        </div>
    )
}

function ErrorBadge({ label, count, total, warn }) {
    const pct = ((count / total) * 100).toFixed(0)
    const severity = count > 0 ? (warn ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-rose-600 bg-rose-50 border-rose-200') : 'text-slate-400 bg-slate-50 border-slate-200'

    return (
        <div className={`p-2 rounded border flex justify-between items-center ${severity}`}>
            <span className="text-[10px] font-bold uppercase">{label}</span>
            <span className="font-mono font-black text-xs">{count} <span className="opacity-50 text-[9px]">({pct}%)</span></span>
        </div>
    )
}

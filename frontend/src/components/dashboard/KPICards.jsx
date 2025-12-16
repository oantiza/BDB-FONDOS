import { useMemo } from 'react'
import { calcSimpleStats } from '../../utils/analytics'

export default function KPICards({ portfolio }) {
    const stats = useMemo(() => calcSimpleStats(portfolio), [portfolio])

    // Mock data for Trend/Benchmark comparison (would come from X-Ray ideally)
    const metrics = [
        { label: 'Rentabilidad YTD', value: `${(stats.ret * 100).toFixed(2)}%`, trend: '+0.42%', trendLabel: '(Supera)', trendColor: 'text-emerald-600' },
        { label: 'Volatilidad (1Y)', value: `${(stats.vol * 100).toFixed(2)}%`, trend: '-1.50%', trendLabel: '(Mejora)', trendColor: 'text-emerald-600' },
        { label: 'Ratio de Sharpe', value: (stats.vol > 0 ? (stats.ret / stats.vol).toFixed(2) : '0.00'), trend: '+0.05', trendLabel: '', trendColor: 'text-emerald-600' },
        { label: 'Máximo Drawdown', value: '-4.50%', trend: 'N/A', trendLabel: '', trendColor: 'text-slate-400' }
    ]

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs uppercase text-gray-500 bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-3 py-2">Métrica Clave</th>
                        <th className="px-3 py-2">Valor Total</th>
                        <th className="px-3 py-2">Tendencia (vs Bmk)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {metrics.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2 font-bold text-gray-700">{m.label}</td>
                            <td className="px-3 py-2 font-mono font-bold text-gray-800">{m.value}</td>
                            <td className={`px-3 py-2 font-mono ${m.trendColor}`}>
                                {m.trend} <span className="text-xs text-gray-500 font-sans ml-1">{m.trendLabel}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

import { useMemo } from 'react'
import { calcSimpleStats } from '../../utils/analytics'

interface KPICardsProps {
    portfolio: any[];
    maxDrawdown?: number | null;
}

export default function KPICards({ portfolio, maxDrawdown = null }: KPICardsProps) {
    const stats = useMemo(() => calcSimpleStats(portfolio), [portfolio])

    const displayMaxDD = maxDrawdown !== null
        ? `${(maxDrawdown * 100).toFixed(2)}%`
        : `${(-stats.vol * 30).toFixed(2)}%`;

    const metrics = [
        { label: 'Rentabilidad YTD', value: `${(stats.ret * 100).toFixed(2)}%`, trend: getTrend(stats.ret), trendLabel: '', trendColor: getTrendColor(stats.ret) },
        { label: 'Volatilidad (1Y)', value: `${(stats.vol * 100).toFixed(2)}%`, trend: '-', trendLabel: '', trendColor: 'text-slate-400' },
        { label: 'Ratio de Sharpe', value: (stats.vol > 0 ? (stats.ret / stats.vol).toFixed(2) : '0.00'), trend: '-', trendLabel: '', trendColor: 'text-slate-400' },
        { label: 'Máximo Drawdown', value: displayMaxDD, trend: '-', trendLabel: '', trendColor: 'text-slate-400' }
    ]

    function getTrend(val: number) {
        if (val > 0) return 'Positivo'
        if (val < 0) return 'Negativo'
        return 'Neutro'
    }

    function getTrendColor(val: number) {
        if (val > 0) return 'text-emerald-600'
        if (val < 0) return 'text-rose-600'
        return 'text-slate-600'
    }

    return (
        <div className="h-full flex flex-col pt-1">
            <h3 className="font-sans text-[11px] uppercase tracking-widest font-black text-slate-500 mb-2 px-1">
                Métricas Clave
            </h3>
            <div className="h-[1px] w-full bg-slate-200 mb-4" />

            <div className="flex-1 overflow-y-auto">
                <table className="w-full">
                    <tbody className="divide-y divide-slate-100">
                        {metrics.map((m, i) => (
                            <tr key={i} className="group hover:bg-slate-50/30 transition-colors">
                                <td className="py-2 text-slate-600 font-bold text-[10px] uppercase tracking-tight">{m.label}</td>
                                <td className="py-2 text-right font-mono font-black text-slate-900 text-sm pr-4">{m.value}</td>
                                <td className={`py-2 text-right text-[10px] font-black w-12 ${m.trendColor}`}>
                                    {m.trend === 'Positivo' ? 'POSITIVO' : m.trend === 'Negativo' ? 'NEGATIVO' : '–'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
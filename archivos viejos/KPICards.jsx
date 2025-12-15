import { useMemo } from 'react'
import { calcSimpleStats } from '../../utils/analytics'

export default function KPICards({ portfolio }) {
    const stats = useMemo(() => calcSimpleStats(portfolio), [portfolio])

    // Sharpe simulado simple (Retorno / Volatilidad)
    const sharpe = stats.vol > 0 ? (stats.ret / stats.vol).toFixed(2) : '0.00'

    return (
        <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="glass-card p-2 rounded shadow-sm border-t-2 border-[var(--color-brand)] flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Volatilidad</span>
                <span className="text-sm font-mono font-bold text-slate-200">{(stats.vol * 100).toFixed(1)}%</span>
            </div>
            <div className="glass-card p-2 rounded shadow-sm border-t-2 border-emerald-500 flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ret. Esp</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{(stats.ret * 100).toFixed(1)}%</span>
            </div>
            <div className="glass-card p-2 rounded shadow-sm border-t-2 border-[var(--color-accent)] flex flex-col items-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Sharpe</span>
                <span className="text-sm font-mono font-bold text-[var(--color-accent)]">{sharpe}</span>
            </div>
        </div>
    )
}

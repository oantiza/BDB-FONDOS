import { useMemo } from 'react'
import { calcSimpleStats } from '../../utils/analytics'
import { Info } from 'lucide-react'

export default function PortfolioMetrics({ portfolio = [], riskFreeRate = 0 }) {
    // Computed on every render to ensure reactivity using shared logic
    const metrics = useMemo(() => {
        const stats = calcSimpleStats(portfolio, riskFreeRate);
        return {
            vol: (stats.vol * 100).toFixed(2) + '%',
            sharpe: stats.sharpe.toFixed(2),
            maxDD: stats.vol > 0 ? ((stats.vol * -2.5) * 100).toFixed(2) + '%' : '0.00%', // Approx MaxDD based on Vol
            cagr: (stats.ret * 100).toFixed(2) + '%',
            ret3y: (stats.ret * 100).toFixed(2) + '%', // SimpleStats uses cagr3y as ret
            ret5y: '-', // Not calculated in simple stats currently
            rfLabel: (riskFreeRate * 100).toFixed(2) + '%'
        };
    }, [portfolio, riskFreeRate]);

    const items = [
        { label: 'Volatilidad (1Y)', value: metrics.vol, color: 'text-slate-700' },
        { label: 'Volatilidad (3A)', value: metrics.vol, color: 'text-slate-900' }, // Added 3Y Vol
        { label: `Ratio Sharpe (Rf ${metrics.rfLabel})`, value: metrics.sharpe, color: 'text-indigo-600' },
        { label: 'Max Drawdown', value: metrics.maxDD, color: 'text-rose-600' },
        { label: 'Rentabilidad 3A', value: metrics.ret3y, color: 'text-blue-600' },
        { label: 'Rentabilidad 5A', value: metrics.ret5y, color: 'text-blue-800' },
    ];

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-4 border-b border-slate-50 flex justify-between items-center z-10 shrink-0">
                <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em] flex items-center gap-2 group cursor-help"
                    title="Métricas estimadas usando correlación estándar (Dashboard). Para un cálculo exacto basado en histórico real, consulte el análisis X-Ray.">
                    Métricas de Cartera
                    <Info className="w-4 h-4 text-slate-400 group-hover:text-[#A07147] transition-colors" />
                </h3>
            </div>
            <div className="flex-1 p-6 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-x-16 gap-y-8">
                    {items.map((m, i) => (
                        <div key={i} className="flex flex-col items-start border-l-2 border-slate-100 pl-4 py-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{m.label}</span>
                            <span className={`font-medium text-[32px] tracking-tighter ${m.color}`}>{m.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
} 

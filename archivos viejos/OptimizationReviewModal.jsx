import React, { useMemo } from 'react'
import { calcSimpleStats } from '../../utils/analytics'

export default function OptimizationReviewModal({ currentPortfolio, proposedPortfolio, onAccept, onClose }) {
    const currentStats = useMemo(() => calcSimpleStats(currentPortfolio), [currentPortfolio])
    const proposedStats = useMemo(() => calcSimpleStats(proposedPortfolio), [proposedPortfolio])

    const StatCard = ({ label, current, proposed, format = 'pct', inverse = false }) => {
        const isBetter = inverse ? proposed < current : proposed > current
        const diff = proposed - current

        return (
            <div className="bg-slate-50 rounded p-4 border border-slate-100 flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-2">{label}</span>
                <div className="flex items-center gap-4 text-sm font-mono">
                    <span className="text-slate-500 font-bold">
                        {format === 'pct' ? (current * 100).toFixed(2) + '%' : current.toFixed(2)}
                    </span>
                    <span className="text-slate-300">➜</span>
                    <span className={`text-lg font-black ${isBetter ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {format === 'pct' ? (proposed * 100).toFixed(2) + '%' : proposed.toFixed(2)}
                    </span>
                </div>
                <div className={`text-[10px] font-bold mt-1 ${isBetter ? 'text-emerald-500' : 'text-rose-400'}`}>
                    {diff > 0 ? '+' : ''}{format === 'pct' ? (diff * 100).toFixed(2) + '%' : diff.toFixed(2)}
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all">
                <div className="bg-brand p-6 text-center">
                    <h2 className="text-2xl font-serif font-bold text-white mb-1">Resultado de Optimización</h2>
                    <p className="text-brand-light text-xs opacity-80 uppercase tracking-widest">Análisis de Impacto</p>
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-3 gap-6 mb-8">
                        <StatCard
                            label="Volatilidad (Riesgo)"
                            current={currentStats.vol}
                            proposed={proposedStats.vol}
                            inverse={true}
                        />
                        <StatCard
                            label="Retorno Esperado"
                            current={currentStats.ret}
                            proposed={proposedStats.ret}
                        />
                        <StatCard
                            label="Ratio Sharpe"
                            current={currentStats.ret / currentStats.vol}
                            proposed={proposedStats.ret / proposedStats.vol}
                            format="num"
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={onAccept}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded shadow-lg transform active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <span>🚀</span>
                            <span>Aceptar y Analizar Detalle</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full bg-white hover:bg-slate-50 text-slate-500 font-bold py-3 rounded border border-slate-200"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

import { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'
import CorrelationHeatmap from '../charts/CorrelationHeatmap'
import RiskMap from '../charts/RiskMap'
import XRayChart from '../charts/XRayChart'

export default function AnalysisModal({ portfolio, onClose }) {
    const [metrics, setMetrics] = useState(null)
    const [loading, setLoading] = useState(true)
    const [benchmarkId, setBenchmarkId] = useState('moderate')
    const [period, setPeriod] = useState('3y')

    useEffect(() => {
        runAnalysis()
    }, [period]) // Re-run when period changes

    const runAnalysis = async () => {
        if (!portfolio || portfolio.length === 0) {
            setLoading(false)
            return
        }
        setLoading(true)
        try {
            const analyzeFn = httpsCallable(functions, 'backtest_portfolio')
            const res = await analyzeFn({
                portfolio: portfolio.map(p => ({ isin: p.isin, weight: p.weight })),
                period: period
            })
            setMetrics(res.data)
        } catch (error) {
            console.error("Error X-Ray:", error)
        } finally {
            setLoading(false)
        }
    }

    // Top 10 Funds (Holdings proxy)
    const sortedHoldings = [...portfolio].sort((a, b) => b.weight - a.weight).slice(0, 10)

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 font-sans text-slate-700">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-brand text-white shrink-0">
                    <h2 className="text-xl font-serif font-bold flex items-center gap-2">
                        🔬 Análisis X-Ray Profundo
                    </h2>
                    <button onClick={onClose} className="text-white hover:text-accent text-3xl leading-none">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 p-6 scrollbar-thin">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-50">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand mb-4"></div>
                            <p className="text-sm font-bold text-slate-500 animate-pulse">Ejecutando Backtesting Cuántico...</p>
                        </div>
                    ) : !metrics ? (
                        <div className="text-center py-20 text-slate-400">
                            <span className="text-4xl block mb-2">⚠️</span>
                            No se pudieron calcular las métricas.
                        </div>
                    ) : (
                        <div className="space-y-8">

                            {/* SECCIÓN 1: HISTÓRICO Y BENCHMARK */}
                            <div className="bg-white p-6 rounded shadow-sm border border-slate-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-serif font-bold text-brand">Comportamiento Histórico</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Benchmark:</span>
                                        <select
                                            value={period}
                                            onChange={(e) => setPeriod(e.target.value)}
                                            className="bg-slate-100 border border-slate-300 text-xs rounded px-2 py-1 outline-none mr-2 focus:border-brand"
                                        >
                                            <option value="1y">1 Año</option>
                                            <option value="3y">3 Años</option>
                                            <option value="5y">5 Años</option>
                                        </select>
                                        <span className="text-xs font-bold text-slate-500 uppercase">Benchmark:</span>
                                        <select
                                            value={benchmarkId}
                                            onChange={(e) => setBenchmarkId(e.target.value)}
                                            className="bg-slate-100 border border-slate-300 text-xs rounded px-2 py-1 outline-none focus:border-brand"
                                        >
                                            <option value="">Ninguno</option>
                                            <option value="conservative">Conservador (100% RF)</option>
                                            <option value="moderate">Moderado (25/75)</option>
                                            <option value="dynamic">Dinámico (75/25)</option>
                                            <option value="aggressive">Agresivo (100% RV)</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="h-72 relative w-full">
                                    <XRayChart
                                        portfolioData={metrics.portfolioSeries}
                                        benchmarkData={metrics.benchmarkSeries?.[benchmarkId]}
                                        benchmarkLabel={benchmarkId.charAt(0).toUpperCase() + benchmarkId.slice(1)}
                                    />
                                </div>
                                {/* Metric Strip */}
                                <div className="grid grid-cols-4 gap-4 mt-6 border-t pt-4">
                                    <MetricCard label="Rentabilidad Anual (CAGR)" value={metrics.metrics?.cagr} fmt="%" color="text-brand" />
                                    <MetricCard label="Volatilidad (Riesgo)" value={metrics.metrics?.volatility} fmt="%" color="text-orange-600" />
                                    <MetricCard label="Ratio Sharpe" value={metrics.metrics?.sharpe} fmt="num" color="text-emerald-600" />
                                    <MetricCard label="Max Drawdown" value={metrics.metrics?.maxDrawdown} fmt="%" color="text-rose-600" />
                                </div>
                            </div>

                            {/* SECCIÓN 2: MAYORES POSICIONES (FONDOS) */}
                            <div className="bg-white p-4 rounded shadow-sm border border-slate-200">
                                <h3 className="text-sm font-serif font-bold text-brand mb-2">Top 10 Posiciones (Activos)</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left text-slate-600">
                                        <thead className="text-[10px] text-slate-500 uppercase bg-slate-50">
                                            <tr>
                                                <th className="px-3 py-2">Subyacente / Activo</th>
                                                <th className="px-3 py-2">ID</th>
                                                <th className="px-3 py-2">Tipo</th>
                                                <th className="px-3 py-2 text-right">Peso</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(metrics.topHoldings || sortedHoldings).map((h, i) => (
                                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                                                    <td className="px-3 py-1 font-bold text-brand truncate max-w-xs">{h.name}</td>
                                                    <td className="px-3 py-1 font-mono text-[10px] text-slate-400">{h.isin}</td>
                                                    <td className="px-3 py-1 text-[10px]">Underlying</td>
                                                    <td className="px-3 py-1 text-right font-mono font-bold">{(h.weight).toFixed(2)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* SECCIÓN 3: MAPA DE RIESGO + EXPLICACIÓN */}
                            <div className="grid grid-cols-12 gap-6 h-80">
                                <div className="col-span-8 bg-white p-4 rounded shadow-sm border border-slate-200 flex flex-col">
                                    <h3 className="text-sm font-bold text-slate-600 uppercase mb-2">Mapa Eficiencia (Riesgo/Retorno)</h3>
                                    <div className="flex-1 relative min-h-0">
                                        <RiskMap
                                            portfolioMetrics={{
                                                volatility: metrics.metrics?.volatility,
                                                annual_return: metrics.metrics?.cagr
                                            }}
                                            benchmarks={metrics.synthetics}
                                        />
                                    </div>
                                </div>
                                <div className="col-span-4 bg-navy-50 p-6 rounded shadow-sm border border-brand/10 bg-gradient-to-br from-white to-slate-100 flex flex-col justify-center">
                                    <h4 className="font-serif font-bold text-brand text-lg mb-2">Análisis de Eficiencia</h4>
                                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                                        El gráfico muestra la posición de tu cartera (punto azul) frente a la Frontera Eficiente teórica.
                                    </p>
                                    <ul className="text-xs space-y-2 text-slate-500">
                                        <li className="flex gap-2">
                                            <span className="text-emerald-500 font-bold">Encima de la curva:</span>
                                            Exceso de retorno (Alpha positivo).
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-rose-500 font-bold">Debajo de la curva:</span>
                                            Ineficiente (demasiado riesgo para el retorno).
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* SECCIÓN 4: CORRELACIONES */}
                            <div className="bg-white p-4 rounded shadow-sm border border-slate-200 flex flex-col items-center">
                                <h3 className="text-sm font-serif font-bold text-brand mb-2 w-full text-left">Matriz de Correlación</h3>
                                <div className="h-48 w-full max-w-2xl border border-slate-100 rounded-lg overflow-hidden shadow-inner bg-slate-50">
                                    <CorrelationHeatmap matrix={metrics.correlationMatrix} assets={portfolio.map(p => p.name.substring(0, 10) + '..')} />
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function MetricCard({ label, value, fmt, color }) {
    let display = 'N/A'
    if (value !== undefined && value !== null) {
        if (fmt === '%') display = (value * 100).toFixed(2) + '%'
        else display = value.toFixed(2)
    }
    return (
        <div className="bg-slate-50 p-4 rounded border-t-2 border-slate-200 hover:border-brand transition-colors">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-2xl font-mono font-bold ${color}`}>{display}</div>
        </div>
    )
}

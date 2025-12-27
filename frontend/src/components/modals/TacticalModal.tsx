import { useState, useEffect, useMemo } from 'react'
import ModalHeader from '../common/ModalHeader'
import ComparisonChart from '../charts/ComparisonChart'
import { calcSimpleStats } from '../../utils/analytics'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'

export default function TacticalModal({ currentPortfolio, proposedPortfolio, riskFreeRate = 0, onAccept, onClose }) {
    const [editedProposal, setEditedProposal] = useState([])
    const [isEditing, setIsEditing] = useState(false) // Manual Rebalance Mode
    const [backtestData, setBacktestData] = useState({
        current: null,
        proposed: null,
        metricsCurrent: null,
        metricsProposed: null
    })
    const [isLoadingBacktest, setIsLoadingBacktest] = useState(false)

    useEffect(() => {
        setEditedProposal(JSON.parse(JSON.stringify(proposedPortfolio)))
    }, [proposedPortfolio])

    // --- Backtest Fetcher ---
    useEffect(() => {
        const fetchBacktest = async () => {
            setIsLoadingBacktest(true)
            try {
                const backtestFn = httpsCallable(functions, 'backtest_portfolio')

                // Define expected response structure matching Backend
                interface BacktestResponse {
                    portfolioSeries: { x: string; y: number }[];
                    metrics: any;
                    // ... ignore other fields for now
                }

                // 1. Backtest Original
                const resCurrent = await backtestFn({ portfolio: currentPortfolio, period: '5y' })
                const dataCurrent = resCurrent.data as BacktestResponse

                // 2. Backtest Proposed (Initial)
                const resProposed = await backtestFn({ portfolio: proposedPortfolio, period: '5y' })
                const dataProposed = resProposed.data as BacktestResponse

                if (dataCurrent && dataProposed) {
                    setBacktestData({
                        current: dataCurrent.portfolioSeries,
                        proposed: dataProposed.portfolioSeries,
                        metricsCurrent: dataCurrent.metrics,
                        metricsProposed: dataProposed.metrics
                    })
                }
            } catch (error) {
                console.error("Backtest failed", error)
            } finally {
                setIsLoadingBacktest(false)
            }
        }

        if (currentPortfolio.length > 0 && proposedPortfolio.length > 0) {
            fetchBacktest()
        }
    }, []) // Run once on mount to compare original vs initial proposal

    // --- Actions ---
    const handleWeightChange = (isin, val) => {
        const newVal = parseFloat(val) || 0
        setEditedProposal(prev => prev.map(p => p.isin === isin ? { ...p, weight: newVal } : p))
    }

    const handleRemove = (isin) => {
        setEditedProposal(prev => prev.filter(p => p.isin !== isin))
    }

    const handleAutoRebalance = () => {
        const total = editedProposal.reduce((acc, p) => acc + (p.weight || 0), 0)
        if (total === 0) return
        setEditedProposal(prev => prev.map(p => ({ ...p, weight: (p.weight / total) * 100 })))
    }

    // --- Analytics ---
    const currentStats = useMemo(() => calcSimpleStats(currentPortfolio, riskFreeRate), [currentPortfolio, riskFreeRate])
    const proposedStats = useMemo(() => calcSimpleStats(editedProposal, riskFreeRate), [editedProposal, riskFreeRate])

    const totalProposedWeight = editedProposal.reduce((acc, p) => acc + (p.weight || 0), 0)
    const totalCurrentWeight = currentPortfolio.reduce((acc, p) => acc + (p.weight || 0), 0)

    // --- Helpers ---
    const MetricRow = ({ label, val, isPercent = true, comparisonVal = null, inverse = false }) => {
        const formatted = isPercent ? (val * 100).toFixed(2) + '%' : val.toFixed(2)
        let color = 'text-slate-600'
        if (comparisonVal !== null) {
            const isBetter = inverse ? val < comparisonVal : val > comparisonVal
            color = isBetter ? 'text-emerald-600' : 'text-rose-600'
        }
        return (
            <div className="flex justify-between items-center text-[10px] py-0.5">
                <span className="text-slate-500 font-bold uppercase">{label}</span>
                <span className={`font-mono font-bold ${color}`}>{formatted}</span>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm font-sans">
            <div className="bg-white rounded-xl shadow-2xl w-full h-[95vh] max-w-7xl flex flex-col overflow-hidden border border-slate-200">

                <ModalHeader
                    title="Revisión de Optimización Táctica"
                    icon="⚖️"
                    onClose={onClose}
                />

                {/* 2. DUAL VIEW (Main Content ~7/8) with Spacing */}
                <div className="flex-1 flex overflow-hidden bg-white p-6 gap-6">

                    {/* LEFT: ORIGINAL */}
                    <div className="w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors">
                        <div className="p-4 border-b border-slate-50 flex justify-center items-center bg-[#fcfcfc]">
                            <h3 className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em]">
                                Cartera Original
                            </h3>
                        </div>

                        {/* Metrics Panel */}
                        <div className="p-4 bg-white border-b border-slate-50 grid grid-cols-2 gap-x-8 gap-y-2">
                            {isLoadingBacktest ? (
                                <div className="col-span-2 text-center text-xs text-slate-400 py-4 animate-pulse">Obteniendo datos históricos...</div>
                            ) : (
                                <>
                                    <MetricRow label="Rentabilidad (CAGR)" val={backtestData.metricsCurrent?.cagr || 0} />
                                    <MetricRow label="Volatilidad (1A)" val={backtestData.metricsCurrent?.volatility || 0} />
                                    <MetricRow label="Ratio Sharpe" val={backtestData.metricsCurrent?.sharpe || 0} isPercent={false} />
                                    <MetricRow label="Máximo Drawdown" val={backtestData.metricsCurrent?.maxDrawdown || 0} />
                                </>
                            )}
                        </div>

                        {/* Composition Table */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <TableViewer
                                portfolio={currentPortfolio}
                                readOnly={true}
                                onWeightChange={() => { }}
                                onRemove={() => { }}
                                comparisonPortfolio={null}
                            />
                        </div>
                        {/* Total Weight Indicator (NEW) */}
                        <div className={`p-3 text-center text-xs font-bold border-t bg-[#fcfcfc] text-slate-600 border-slate-50 flex justify-between px-6`}>
                            <span className="text-slate-400 font-normal uppercase tracking-wider">Rf: {(backtestData.metricsCurrent?.rf_rate * 100).toFixed(2) || '-'}%</span>
                            <span className="uppercase tracking-wider">Total: {totalCurrentWeight.toFixed(2)}%</span>
                        </div>
                    </div>

                    {/* RIGHT: OPTIMIZED */}
                    <div className="w-1/2 flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden relative hover:border-slate-200 transition-colors">
                        {/* Decorative Overlay for Focus */}
                        <div className="absolute top-0 right-0 p-2 z-10 pointer-events-none">
                            <div className="bg-[#D4AF37] text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-widest">
                                Recomendado
                            </div>
                        </div>

                        <div className="p-4 border-b border-slate-50 flex justify-center items-center bg-[#fcfcfc]">
                            <h3 className="text-sm font-bold text-[#0B2545] uppercase tracking-[0.2em]">
                                Cartera Optimizada
                            </h3>
                        </div>

                        {/* Metrics Panel (Highlighted) */}
                        <div className="p-4 bg-white border-b border-slate-50 grid grid-cols-2 gap-x-8 gap-y-2">
                            {isLoadingBacktest && !isEditing ? (
                                <div className="col-span-2 text-center text-xs text-slate-400 py-4 animate-pulse">Calculando métricas reales...</div>
                            ) : (
                                <>
                                    <MetricRow label="Rentabilidad (CAGR)"
                                        val={isEditing ? proposedStats.ret : (backtestData.metricsProposed?.cagr || 0)}
                                        comparisonVal={backtestData.metricsCurrent?.cagr || 0} />
                                    <MetricRow label="Volatilidad (1A)"
                                        val={isEditing ? proposedStats.vol : (backtestData.metricsProposed?.volatility || 0)}
                                        comparisonVal={backtestData.metricsCurrent?.volatility || 0} inverse={true} />
                                    <MetricRow label="Ratio Sharpe"
                                        val={isEditing ? proposedStats.sharpe : (backtestData.metricsProposed?.sharpe || 0)}
                                        isPercent={false}
                                        comparisonVal={backtestData.metricsCurrent?.sharpe || 0} />
                                    <MetricRow label="Máximo Drawdown"
                                        val={isEditing ? 0 : (backtestData.metricsProposed?.maxDrawdown || 0)} // No calculated DD for manual mode easily
                                        comparisonVal={backtestData.metricsCurrent?.maxDrawdown || 0} inverse={true} />
                                </>
                            )}
                        </div>

                        {/* Composition Table */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <TableViewer
                                portfolio={editedProposal}
                                readOnly={!isEditing}
                                onWeightChange={handleWeightChange}
                                onRemove={handleRemove}
                                comparisonPortfolio={currentPortfolio}
                            />
                        </div>

                        {/* Total Weight Indicator */}
                        <div className={`p-3 text-center text-xs font-bold border-t flex justify-between px-6 ${Math.abs(totalProposedWeight - 100) > 0.1 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-[#fcfcfc] text-[#0B2545] border-slate-50'}`}>
                            <span className="opacity-70 font-normal uppercase tracking-wider">Rf: {(backtestData.metricsProposed?.rf_rate * 100).toFixed(2) || '-'}%</span>
                            <span className="uppercase tracking-wider">Total: {totalProposedWeight.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>

                {/* 3. CHART AREA */}
                <div className="shrink-0 h-[24vh] bg-white border-t border-slate-100 flex items-center justify-center p-4 relative">
                    <span className="absolute top-3 left-4 text-xs font-bold text-[#A07147] uppercase tracking-[0.2em]">
                        Backtest Histórico (5 Años)
                    </span>
                    {isLoadingBacktest && <span className="absolute top-3 right-4 text-[10px] font-bold text-blue-500 animate-pulse uppercase tracking-wider">Cargando datos...</span>}

                    {/* Centered Container using live backtest data */}
                    <div className="h-full w-full max-w-4xl flex items-center justify-center pt-4">
                        <ComparisonChart currentData={backtestData.current} proposedData={backtestData.proposed} />
                    </div>
                </div>

                {/* 4. ACTION MODULE (Footer) */}
                <div className="h-20 bg-white border-t border-slate-100 shrink-0 flex items-center justify-between px-8 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] z-20">

                    {/* Left: Rebalance Controls */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleAutoRebalance}
                            className="text-slate-500 hover:text-[#003399] border border-slate-200 hover:border-[#003399]/30 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                        >
                            <span>🤖</span> Auto-Equilibrar
                        </button>

                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 border ${isEditing ? 'bg-amber-50 border-amber-500 text-amber-600' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'}`}
                        >
                            <span>🔧</span> {isEditing ? 'Finalizar Edición' : 'Ajuste Manual'}
                        </button>
                    </div>

                    {/* Right: Confirmation */}
                    <div className="flex items-center gap-6">
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest">Cancelar</button>
                        <button
                            onClick={() => onAccept(editedProposal)}
                            className="bg-[#003399] hover:bg-[#002266] text-white px-8 py-3 rounded-xl shadow-lg shadow-blue-900/10 text-xs font-bold uppercase tracking-[0.15em] flex items-center gap-2 transform active:scale-95 transition-all"
                        >
                            <span>Aplicar Estrategia</span>
                            <span>➜</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )
}

function TableViewer({ portfolio, readOnly, onWeightChange, onRemove, comparisonPortfolio }) {
    return (
        <table className="w-full text-xs text-left">
            <thead className="text-slate-500 border-b border-slate-200 sticky top-0 z-10 bg-slate-50">
                <tr>
                    <th className="p-2 font-bold pl-4">Activo</th>
                    <th className="p-2 text-right font-bold w-20 pr-4">Peso</th>
                    {!readOnly && <th className="p-2 w-8"></th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {portfolio.map(p => {
                    const orig = comparisonPortfolio ? comparisonPortfolio.find(c => c.isin === p.isin) : null
                    const diff = orig ? p.weight - orig.weight : 0
                    const isNew = comparisonPortfolio && !orig

                    return (
                        <tr key={p.isin} className="hover:bg-slate-50 group transition-colors">
                            <td className="p-2 pl-4">
                                <div className="font-bold text-slate-700 truncate max-w-[180px]" title={p.name}>{p.name}</div>
                                <div className="flex gap-2 items-center mt-0.5">
                                    <span className="font-mono text-[9px] text-slate-400">{p.isin}</span>
                                    {isNew && <span className="text-[8px] bg-[#D4AF37]/20 text-[#8A711F] px-1 rounded font-bold uppercase tracking-wider">NUEVO</span>}
                                </div>
                            </td>
                            <td className="p-2 text-right pr-4">
                                {readOnly ? (
                                    <span className="font-mono font-bold text-slate-400">{p.weight.toFixed(2)}%</span>
                                ) : (
                                    <div className="flex flex-col items-end gap-1">
                                        <input
                                            type="number"
                                            className="w-14 text-right font-bold text-slate-700 bg-white border border-slate-300 rounded px-1 py-0.5 focus:border-[var(--color-accent)] outline-none text-xs transition-colors"
                                            value={p.weight}
                                            onChange={(e) => onWeightChange(p.isin, e.target.value)}
                                        />
                                        {diff !== 0 && !isNew && (
                                            <span className={`text-[9px] font-bold ${diff > 0 ? 'text-[#0B2545]' : 'text-rose-500'}`}>
                                                {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
                                            </span>
                                        )}
                                    </div>
                                )}
                            </td>
                            {!readOnly && (
                                <td className="p-2 text-center">
                                    <button onClick={() => onRemove(p.isin)} className="text-slate-600 hover:text-rose-400 transition-colors">&times;</button>
                                </td>
                            )}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

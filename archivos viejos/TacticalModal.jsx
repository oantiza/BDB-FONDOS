import { useState, useEffect, useMemo } from 'react'
import ComparisonChart from '../charts/ComparisonChart'
import { calcSimpleStats, generateProjectionPoints } from '../../utils/analytics'

export default function TacticalModal({ currentPortfolio, proposedPortfolio, onAccept, onClose }) {
    const [editedProposal, setEditedProposal] = useState([])
    const [rebalanceMode, setRebalanceMode] = useState('manual') // 'manual' | 'auto'

    useEffect(() => {
        // Deep copy para no mutar props
        setEditedProposal(JSON.parse(JSON.stringify(proposedPortfolio)))
    }, [proposedPortfolio])

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
    const currentStats = useMemo(() => calcSimpleStats(currentPortfolio), [currentPortfolio])
    const proposedStats = useMemo(() => calcSimpleStats(editedProposal), [editedProposal])

    const projectionData = useMemo(() => {
        const currentProj = generateProjectionPoints(currentStats.ret, currentStats.vol)
        const proposedProj = generateProjectionPoints(proposedStats.ret, proposedStats.vol)
        return { current: currentProj, proposed: proposedProj }
    }, [currentStats, proposedStats])

    const totalWeight = editedProposal.reduce((acc, p) => acc + (p.weight || 0), 0)

    // --- Render Helpers ---
    const MetricRow = ({ label, val, isPercent = true, comparisonVal = null, inverse = false }) => {
        const formatted = isPercent ? (val * 100).toFixed(2) + '%' : val.toFixed(2)
        let color = 'text-slate-600'

        if (comparisonVal !== null) {
            const isBetter = inverse ? val < comparisonVal : val > comparisonVal
            color = isBetter ? 'text-emerald-600' : 'text-rose-600'
        }

        return (
            <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">{label}</span>
                <span className={`font-mono font-bold ${color}`}>{formatted}</span>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-2">
            <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-[98vw] max-h-[96vh] flex flex-col overflow-hidden">

                {/* 1. Header */}
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-serif font-bold text-brand flex items-center gap-2">
                        <span>⚔️</span> Espacio de Comparación
                    </h2>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-1.5 text-slate-500 hover:text-slate-700 text-xs font-bold uppercase transition-colors">Cancelar</button>
                        <button
                            onClick={() => onAccept(editedProposal)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-1.5 rounded shadow text-xs font-bold uppercase tracking-wider flex items-center gap-2 transform active:scale-95 transition-all"
                        >
                            <span>Confirmar Nueva Cartera</span>
                            <span>➜</span>
                        </button>
                    </div>
                </div>

                {/* 2. Main Workspace (Split View) - 50% HEIGHT */}
                <div className="flex-1 flex overflow-hidden shrink-0 border-b border-slate-200 min-h-0">

                    {/* LEFT: Current Portfolio */}
                    <div className="w-1/2 flex flex-col border-r border-slate-200 bg-slate-50/50">
                        <div className="p-3 bg-slate-100 border-b border-slate-200 font-bold text-slate-500 text-xs uppercase flex justify-between">
                            <span>Cartera Actual (Origen)</span>
                            <span>100% Invested</span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <TableViewer portfolio={currentPortfolio} readOnly={true} />
                        </div>
                        {/* Current Metrics Footer */}
                        <div className="p-4 bg-white border-t border-slate-200 grid grid-cols-3 gap-6 shrink-0 h-24">
                            <div className="flex flex-col justify-center border-r border-slate-100 pr-4">
                                <MetricRow label="Volatilidad" val={currentStats.vol} />
                                <MetricRow label="Retorno Esp." val={currentStats.ret} />
                            </div>
                            <div className="flex flex-col justify-center border-r border-slate-100 pr-4">
                                <MetricRow label="Sharpe Ratio" val={currentStats.ret / currentStats.vol} isPercent={false} />
                                <MetricRow label="Costes (Est.)" val={0.015} /> {/* Placeholder */}
                            </div>
                            <div className="flex items-center justify-center opacity-50">
                                <span className="text-4xl">🔒</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Proposed Portfolio */}
                    <div className="w-1/2 flex flex-col bg-white">
                        <div className="p-3 bg-brand/5 border-b border-brand/10 font-bold text-brand text-xs uppercase flex justify-between items-center">
                            <span>Cartera Objetiva (Destino)</span>
                            <span className={`${Math.abs(totalWeight - 100) > 0.1 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                Total: {totalWeight.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <TableViewer
                                portfolio={editedProposal}
                                readOnly={false}
                                onWeightChange={handleWeightChange}
                                onRemove={handleRemove}
                                comparisonPortfolio={currentPortfolio}
                            />
                        </div>
                        {/* Proposed Metrics Footer */}
                        <div className="p-4 bg-brand/5 border-t border-brand/10 grid grid-cols-3 gap-6 shrink-0 h-24">
                            <div className="flex flex-col justify-center border-r border-brand/10 pr-4">
                                <MetricRow label="Volatilidad" val={proposedStats.vol} comparisonVal={currentStats.vol} inverse={true} />
                                <MetricRow label="Retorno Esp." val={proposedStats.ret} comparisonVal={currentStats.ret} />
                            </div>
                            <div className="flex flex-col justify-center border-r border-brand/10 pr-4">
                                <MetricRow label="Sharpe Ratio" val={proposedStats.ret / proposedStats.vol} isPercent={false} comparisonVal={currentStats.ret / currentStats.vol} />
                                <MetricRow label="Diversificación" val={0.85} isPercent={false} />
                            </div>
                            <div className="flex items-center justify-center">
                                <button
                                    onClick={handleAutoRebalance}
                                    className="text-[10px] bg-white border border-brand/20 text-brand px-3 py-2 rounded hover:bg-brand hover:text-white transition-colors uppercase font-bold shadow-sm"
                                >
                                    Auto-Rebalancear (100%)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Bottom Panel (Charts & Controls) - 50% HEIGHT */}
                <div className="flex-1 bg-white grid grid-cols-12 shrink-0 min-h-0 border-t border-slate-200 overflow-hidden">
                    {/* 5-Year Backtest Chart */}
                    <div className="col-span-8 p-8 border-r border-slate-100 flex flex-col items-center justify-center relative bg-slate-50/30">
                        <h4 className="absolute top-2 left-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-2 shadow-sm border border-slate-100 rounded">Backtesting (5A)</h4>
                        <div className="h-48 w-[85%] bg-white rounded-lg border border-slate-200 shadow-sm p-2">
                            <ComparisonChart currentData={projectionData.current} proposedData={projectionData.proposed} />
                        </div>
                    </div>

                    {/* Rebalancing & Export Options */}
                    <div className="col-span-4 p-6 bg-slate-50 flex flex-col gap-4 justify-center">
                        <h4 className="text-xs font-bold text-slate-800 uppercase mb-2 border-b border-slate-200 pb-2">Opciones de Rebalanceo</h4>

                        <div className="space-y-2">
                            <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded cursor-pointer hover:border-brand transition-colors">
                                <input
                                    type="radio"
                                    name="rebalance"
                                    checked={rebalanceMode === 'manual'}
                                    onChange={() => setRebalanceMode('manual')}
                                    className="accent-brand"
                                />
                                <div>
                                    <div className="text-xs font-bold text-slate-700">Rebalanceo Manual / Asistido</div>
                                    <div className="text-[10px] text-slate-400">Ajustar pesos individualmente en la tabla.</div>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded cursor-pointer hover:border-brand transition-colors">
                                <input
                                    type="radio"
                                    name="rebalance"
                                    checked={rebalanceMode === 'auto'}
                                    onChange={() => { setRebalanceMode('auto'); handleAutoRebalance(); }}
                                    className="accent-brand"
                                />
                                <div>
                                    <div className="text-xs font-bold text-slate-700">Rebalanceo Automático (Proporcional)</div>
                                    <div className="text-[10px] text-slate-400">Distribuir capital restante proporcionalmente.</div>
                                </div>
                            </label>
                        </div>

                        <div className="mt-2 text-center">
                            <button className="text-[10px] text-slate-400 font-bold hover:text-brand underline">Descargar Informe PDF de Rebalanceo</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}

// Sub-componente simple para la tabla
function TableViewer({ portfolio, readOnly, onWeightChange, onRemove, comparisonPortfolio }) {
    return (
        <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 shadow-sm">
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
                        <tr key={p.isin} className="hover:bg-slate-50 group">
                            <td className="p-2 pl-4">
                                <div className="font-bold text-slate-700 truncate max-w-[200px]" title={p.name}>{p.name}</div>
                                <div className="flex gap-2">
                                    <span className="font-mono text-[9px] text-slate-400">{p.isin}</span>
                                    {isNew && <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1 rounded font-bold">NEW</span>}
                                </div>
                            </td>
                            <td className="p-2 text-right pr-4">
                                {readOnly ? (
                                    <span className="font-mono font-bold text-slate-600">{p.weight.toFixed(2)}%</span>
                                ) : (
                                    <div className="flex flex-col items-end">
                                        <input
                                            type="number"
                                            className="w-14 text-right font-bold text-brand bg-white border border-slate-300 rounded px-1 py-0 focus:border-accent outline-none text-xs"
                                            value={p.weight}
                                            onChange={(e) => onWeightChange(p.isin, e.target.value)}
                                        />
                                        {diff !== 0 && !isNew && (
                                            <span className={`text-[9px] font-bold ${diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                )}
                            </td>
                            {!readOnly && (
                                <td className="p-2 text-center">
                                    <button onClick={() => onRemove(p.isin)} className="text-slate-300 hover:text-rose-500">&times;</button>
                                </td>
                            )}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

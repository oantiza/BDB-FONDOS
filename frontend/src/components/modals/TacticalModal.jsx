import { useState, useEffect, useMemo } from 'react'
import ComparisonChart from '../charts/ComparisonChart'
import { calcSimpleStats, generateProjectionPoints } from '../../utils/analytics'

export default function TacticalModal({ currentPortfolio, proposedPortfolio, onAccept, onClose }) {
    const [editedProposal, setEditedProposal] = useState([])
    const [isEditing, setIsEditing] = useState(false) // Manual Rebalance Mode

    useEffect(() => {
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

                {/* 1. Header (Title Only) */}
                <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                    <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                        <span className="text-base">⚖️</span> Tactical Optimization Review
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg px-2">&times;</button>
                </div>

                {/* 2. DUAL VIEW (Main Content ~7/8) */}
                <div className="flex-1 flex overflow-hidden">

                    {/* LEFT: ORIGINAL */}
                    <div className="w-1/2 flex flex-col border-r border-slate-200 bg-slate-50">
                        <div className="p-3 bg-slate-100 border-b border-slate-200 font-bold text-slate-500 text-xs uppercase text-center tracking-wider">
                            Cartera Original (Antes)
                        </div>

                        {/* Metrics Panel */}
                        <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 gap-x-8 gap-y-1">
                            <MetricRow label="Rentabilidad Esp." val={currentStats.ret} />
                            <MetricRow label="Volatilidad (1Y)" val={currentStats.vol} />
                            <MetricRow label="Sharpe Ratio" val={currentStats.ret / currentStats.vol} isPercent={false} />
                            <MetricRow label="Max Drawdown" val={currentStats.vol * -2} /> {/* Est. */}
                        </div>

                        {/* Composition Table */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <TableViewer portfolio={currentPortfolio} readOnly={true} />
                        </div>
                    </div>

                    {/* RIGHT: OPTIMIZED */}
                    <div className="w-1/2 flex flex-col bg-white relative">
                        {/* Decorative Overlay for Focus */}
                        <div className="absolute top-0 right-0 p-1">
                            <div className="bg-[#D4AF37]/20 text-[#8A711F] text-[9px] font-bold px-2 py-0.5 rounded border border-[#D4AF37]/30 uppercase tracking-widest animate-pulse">
                                Recommended
                            </div>
                        </div>

                        <div className="p-3 bg-[#D4AF37]/10 border-b border-[#D4AF37]/20 font-bold text-[#0B2545] text-xs uppercase text-center tracking-wider">
                            Cartera Optimizada (Después)
                        </div>

                        {/* Metrics Panel (Highlighted) */}
                        <div className="p-4 bg-[#0B2545]/5 border-b border-[#D4AF37]/20 grid grid-cols-2 gap-x-8 gap-y-1">
                            <MetricRow label="Rentabilidad Esp." val={proposedStats.ret} comparisonVal={currentStats.ret} />
                            <MetricRow label="Volatilidad (1Y)" val={proposedStats.vol} comparisonVal={currentStats.vol} inverse={true} />
                            <MetricRow label="Sharpe Ratio" val={proposedStats.ret / proposedStats.vol} isPercent={false} comparisonVal={currentStats.ret / currentStats.vol} />
                            <MetricRow label="Max Drawdown" val={proposedStats.vol * -2} comparisonVal={currentStats.vol * -2} inverse={true} />
                        </div>

                        {/* Composition Table */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <TableViewer
                                portfolio={editedProposal}
                                readOnly={!isEditing}
                                onWeightChange={handleWeightChange}
                                onRemove={handleRemove}
                                comparisonPortfolio={currentPortfolio}
                            />
                        </div>

                        {/* Total Weight Indicator */}
                        <div className={`p-2 text-center text-xs font-bold border-t ${Math.abs(totalWeight - 100) > 0.1 ? 'bg-rose-900/20 text-rose-400 border-rose-500/30' : 'bg-[#D4AF37]/20 text-[#0B2545] border-[#D4AF37]/30'}`}>
                            Total Asignado: {totalWeight.toFixed(2)}%
                        </div>
                    </div>
                </div>

                {/* 3. CHART AREA (Bottom Fixed - 1/8 Height - Centered 2:1 Aspect) */}
                <div className="shrink-0 h-[24vh] bg-white border-t border-slate-200 flex items-center justify-center p-2 relative">
                    <div className="absolute top-1 left-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        Proyección 5 Años
                    </div>
                    {/* Centered Container with max-width for 2:1 appearance */}
                    <div className="h-full w-full max-w-3xl flex items-center justify-center">
                        <ComparisonChart currentData={projectionData.current} proposedData={projectionData.proposed} />
                    </div>
                </div>

                {/* 4. ACTION MODULE (Footer) */}
                <div className="h-16 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between px-8 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-20">

                    {/* Left: Rebalance Controls */}
                    <div className="flex items-center gap-4">
                        <div className="text-[10px] uppercase text-slate-500 font-bold mr-2">Modo de Rebalanceo:</div>

                        <button
                            onClick={handleAutoRebalance}
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded text-xs font-bold uppercase transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <span>🤖</span> Auto-Equilibrar
                        </button>

                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`px-4 py-2 rounded text-xs font-bold uppercase transition-colors flex items-center gap-2 border ${isEditing ? 'bg-amber-50 border-amber-500 text-amber-600' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 shadow-sm'}`}
                        >
                            <span>🔧</span> {isEditing ? 'Finalizar Edición' : 'Ajuste Manual'}
                        </button>
                    </div>

                    {/* Right: Confirmation */}
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase">Cancelar</button>
                        <button
                            onClick={() => onAccept(editedProposal)}
                            className="bg-brand hover:bg-brand-light text-white px-8 py-2 rounded shadow-lg shadow-brand/20 text-sm font-bold uppercase tracking-wider flex items-center gap-2 transform active:scale-95 transition-all"
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

// Sub-componente simple para la tabla
// Sub-componente simple para la tabla
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
                                    {isNew && <span className="text-[8px] bg-[#D4AF37]/20 text-[#8A711F] px-1 rounded font-bold uppercase tracking-wider">NEW</span>}
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

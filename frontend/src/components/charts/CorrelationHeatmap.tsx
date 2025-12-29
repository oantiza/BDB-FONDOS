import React from 'react'

export default function CorrelationHeatmap({ matrix, assets }) {
    if (!matrix || !assets || matrix.length !== assets.length) {
        return (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs italic bg-slate-900/50 rounded-lg border border-slate-700">
                Sin datos de correlación disponibles
            </div>
        )
    }

    // Palette: Blue-Gray (Negative) -> Beige-Ochre (Positive)
    // Dark Mode Compatible
    const getColor = (val) => {
        if (val === 1) return 'bg-[#0B2545] text-slate-300 ring-1 ring-[#1e3a8a]' // Diagonal (Self)

        // Positive (Beige -> Ochre)
        if (val >= 0.8) return 'bg-[#d97706] text-white' // Amber-600
        if (val >= 0.6) return 'bg-[#f59e0b] text-white' // Amber-500
        if (val >= 0.4) return 'bg-[#fbbf24] text-slate-900' // Amber-400
        if (val >= 0.2) return 'bg-[#fcd34d] text-slate-800' // Amber-300

        // Neutral / Low Positive
        if (val >= 0) return 'bg-[#fffbeb] text-slate-500' // Amber-50

        // Low Negative / Negative (Grey -> Blue)
        if (val >= -0.2) return 'bg-[#f8fafc] text-slate-400' // Slate-50
        if (val >= -0.4) return 'bg-[#e2e8f0] text-slate-600' // Slate-200
        if (val >= -0.6) return 'bg-[#bfdbfe] text-blue-800' // Blue-200
        return 'bg-[#60a5fa] text-white' // Blue-400
    }

    return (
        <div className="w-full h-full flex flex-col gap-2">

            {/* Responsive Container */}
            <div className="flex-1 w-full h-full min-h-0 flex flex-col">
                <div className="flex-1 w-full h-full flex flex-col min-h-0">
                    {/* Header Row */}
                    <div className="flex w-full shrink-0 mb-1">
                        <div className="w-[15%] max-w-[100px] shrink-0"></div> {/* Spacer */}
                        {assets.map((asset, i) => (
                            <div key={i} className="flex-1 px-0.5 flex items-end justify-center pb-1 min-w-0">
                                <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center" title={asset}>
                                    {asset.substring(0, 4)}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Matrix Rows */}
                    <div className="flex-1 w-full flex flex-col min-h-0">
                        {matrix.map((row, i) => (
                            <div key={i} className="flex-1 w-full flex items-center min-h-0">
                                {/* Row Label */}
                                <div className="w-[15%] max-w-[100px] shrink-0 pr-2 flex justify-end items-center h-full">
                                    <span className="text-[9px] font-bold text-slate-400 truncate max-w-full leading-tight" title={assets[i]}>
                                        {assets[i]}
                                    </span>
                                </div>

                                {/* Cells */}
                                {row.map((val, j) => (
                                    <div key={j} className="flex-1 h-[90%] flex items-center justify-center px-0.5 min-w-0">
                                        <div
                                            className={`w-full h-full flex items-center justify-center text-[9px] font-mono font-bold rounded transition-all hover:scale-105 hover:z-10 cursor-default ${getColor(val)}`}
                                            title={`${assets[i]} vs ${assets[j]}: ${val.toFixed(2)}`}
                                        >
                                            {val.toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 py-2 border-t border-slate-700/50">
                <div className="text-[10px] text-slate-500 font-bold uppercase mr-2 tracking-wider">Correlación:</div>

                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-[#60a5fa]"></div>
                    <span className="text-[10px] text-slate-400">Negativo Fuerte</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-[#e2e8f0]"></div>
                    <span className="text-[10px] text-slate-400">Neutral</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-[#fcd34d]"></div>
                    <span className="text-[10px] text-slate-400">Positivo</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-[#d97706]"></div>
                    <span className="text-[10px] text-slate-400">Positivo Fuerte</span>
                </div>
            </div>
        </div>
    )
}

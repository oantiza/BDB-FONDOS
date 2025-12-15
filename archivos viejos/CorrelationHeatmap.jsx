import React from 'react'

export default function CorrelationHeatmap({ matrix, assets }) {
    if (!matrix || !assets || matrix.length !== assets.length) {
        return (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs italic">
                Sin datos de correlación disponibles
            </div>
        )
    }

    // Colores basados en correlación (-1 a 1)
    const getColor = (val) => {
        if (val === 1) return 'bg-slate-800 text-white' // Diagonales
        if (val > 0.8) return 'bg-rose-500 text-white'
        if (val > 0.5) return 'bg-rose-300 text-slate-800'
        if (val > 0.2) return 'bg-rose-100 text-slate-600'
        if (val > -0.2) return 'bg-slate-50 text-slate-400'
        if (val > -0.5) return 'bg-emerald-100 text-slate-600'
        return 'bg-emerald-500 text-white'
    }

    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            {/* Header Row */}
            <div className="flex w-full mb-1">
                <div className="w-[20%] shrink-0"></div> {/* Spacer */}
                {assets.map((asset, i) => (
                    <div key={i} className="flex-1 min-w-0 p-1 text-[8px] font-bold text-slate-500 truncate text-center" title={asset}>
                        {asset.substring(0, 8)}..
                    </div>
                ))}
            </div>

            {/* Matrix Content */}
            <div className="flex-1 w-full overflow-y-auto scrollbar-thin">
                {matrix.map((row, i) => (
                    <div key={i} className="flex w-full items-center mb-1">
                        <div className="w-[20%] shrink-0 pr-2 text-[8px] font-bold text-slate-600 truncate text-right" title={assets[i]}>
                            {assets[i]}
                        </div>
                        {row.map((val, j) => (
                            <div
                                key={j}
                                className={`flex-1 aspect-square flex items-center justify-center text-[9px] font-mono font-bold m-px rounded ${getColor(val)}`}
                                title={`Corr(${assets[i]}, ${assets[j]}) = ${val.toFixed(2)}`}
                            >
                                {val.toFixed(2)}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

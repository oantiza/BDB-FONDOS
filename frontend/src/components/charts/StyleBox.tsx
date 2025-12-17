import React from 'react'

export default function StyleBox({ portfolio }) {
    // 1. Calcular el centro de gravedad del estilo
    // X: Value (0) -> Blend (1) -> Growth (2)
    // Y: Small (2) -> Mid (1) -> Large (0)  <-- Ojo con el orden visual (Large arriba)

    let scoreX = 0
    let scoreY = 0
    let totalW = 0

    portfolio.forEach(f => {
        // Asumimos que f.style sea algo como { size: 'Large', investment: 'Growth' } 
        // O usamos heurística basada en nombre si no hay datos
        if (f.std_type !== 'RV' && !f.std_type?.includes('EQUITY')) return

        const w = f.weight || 0

        let x = 1 // Blend
        let y = 1 // Mid

        // Heurística simple si no hay datos estructurados
        const name = (f.name || '').toLowerCase()
        const styleName = (f.std_style || '').toString().toLowerCase() // A veces string, a veces obj

        // Eje X: Estilo
        if (name.includes('value') || styleName.includes('value')) x = 0
        else if (name.includes('growth') || styleName.includes('growth')) x = 2

        // Eje Y: Tamaño
        if (name.includes('small') || styleName.includes('small')) y = 2
        else if (name.includes('large') || styleName.includes('large')) y = 0

        scoreX += x * w
        scoreY += y * w
        totalW += w
    })

    let finalX = 1
    let finalY = 1

    if (totalW > 0) {
        finalX = Math.round(scoreX / totalW)
        finalY = Math.round(scoreY / totalW)
    }

    // Clamp
    finalX = Math.max(0, Math.min(2, finalX))
    finalY = Math.max(0, Math.min(2, finalY))

    const activeIndex = (finalY * 3) + finalX

    const cells = Array(9).fill(null)

    return (
        <div className="flex flex-col items-center">
            <div className="grid grid-cols-3 gap-0.5 bg-slate-300 border border-slate-300 p-0.5 w-24 h-24">
                {cells.map((_, i) => (
                    <div
                        key={i}
                        className={`flex items-center justify-center text-[8px] font-mono transition-colors duration-300
                            ${i === activeIndex ? 'bg-[#0B2545] text-white font-bold shadow-inner z-10' : 'bg-slate-50 text-slate-300'}
                        `}
                    >
                        {i === activeIndex ? '●' : ''}
                    </div>
                ))}
            </div>
            <div className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-wide">
                Estilo Equity
            </div>
        </div>
    )
}

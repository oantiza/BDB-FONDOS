import React from 'react'
import Plot from 'react-plotly.js'

export default function RiskMap({ portfolioMetrics, benchmarks = [] }) {
    if (!portfolioMetrics) return <div className="text-xs text-slate-400">Sin datos de métricas</div>

    const pVol = (portfolioMetrics.volatility || 0) * 100
    const pRet = (portfolioMetrics.annual_return || portfolioMetrics.cagr || 0) * 100

    const tracePort = {
        x: [pVol],
        y: [pRet],
        text: ['<b>TU CARTERA</b>'],
        mode: 'markers+text',
        textposition: 'top center',
        name: 'Cartera',
        marker: { size: 18, color: '#0B2545', line: { color: '#D4AF37', width: 2 } },
        type: 'scatter'
    }

    const points = benchmarks.length > 0 ? benchmarks : []
    // Safe parse: if backend sends 0.05, we show 5.0. If backend sends 5.0, assume it's already %.
    // Standardize to decimal in utils, so here * 100 safe.

    const traceBench = {
        x: points.map(b => (b.vol < 1 ? b.vol * 100 : b.vol)),
        y: points.map(b => (b.ret < 1 ? b.ret * 100 : b.ret)),
        text: points.map(b => `<b>${b.name}</b>`),
        mode: 'markers+text',
        textposition: 'bottom center',
        name: 'Benchmarks',
        marker: {
            size: 12,
            color: points.map(b => b.color || '#94a3b8'),
            symbol: 'diamond',
            line: { color: 'white', width: 1 }
        },
        type: 'scatter'
    }

    // Calculate dynamic ranges to force X start at 0
    const allX = [...traceBench.x, ...tracePort.x];
    const allY = [...traceBench.y, ...tracePort.y];
    const maxX = Math.max(...allX, 5) * 1.15; // Buffer space
    const minY = Math.min(...allY, 0); // Include 0 if all positive, or lowest neg
    const maxY = Math.max(...allY, 5);

    // Ensure symmetric Y if needed or just padding
    const rangeY = [Math.min(minY, 0) - 2, maxY + 2];
    const rangeX = [0, maxX];

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Plot
                data={[traceBench, tracePort]}
                layout={{
                    font: { family: 'sans-serif', size: 10 },
                    margin: { t: 20, b: 40, l: 40, r: 20 },
                    xaxis: {
                        title: 'Riesgo (Volatilidad) %',
                        showgrid: true,
                        gridcolor: '#f1f5f9',
                        zeroline: true,
                        zerolinecolor: '#cbd5e1',
                        range: rangeX,  // Explicit constraint
                        fixedrange: true // Prevent zoom out to negative
                    },
                    yaxis: {
                        title: 'Retorno Anual %',
                        showgrid: true,
                        gridcolor: '#f1f5f9',
                        zeroline: true,
                        zerolinecolor: '#cbd5e1',
                        range: rangeY  // Apply calculated range instead of scaleanchor
                    },
                    showlegend: false,
                    autosize: true,
                    paper_bgcolor: 'rgba(0,0,0,0)',
                    plot_bgcolor: 'rgba(0,0,0,0)',
                    hovermode: 'closest'
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, responsive: true }}
            />
        </div>
    )
}

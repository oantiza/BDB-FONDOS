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

    // Benchmarks fijos si no vienen del exterior
    const defaultBenchmarks = [
        { name: 'Conservador', vol: 4.5, ret: 3.2, color: '#10B981' },
        { name: 'Equilibrado', vol: 8.5, ret: 5.8, color: '#3B82F6' },
        { name: 'S&P 500', vol: 15.2, ret: 10.5, color: '#F59E0B' },
        { name: 'Tech', vol: 22.0, ret: 14.2, color: '#EF4444' }
    ]

    const points = benchmarks.length > 0 ? benchmarks : defaultBenchmarks

    const traceBench = {
        x: points.map(b => b.vol * 100), // Backend returns decimals (0.05), Plotly wants raw or verify scale. Previous default was 4.5 e.g. 4.5%.
        // Assuming backend retuns 0.05 for 5%. We multiply by 100.
        y: points.map(b => b.ret * 100),
        text: points.map(b => `<b>${b.name}</b>`),
        mode: 'markers+text',
        textposition: 'bottom center',
        name: 'Benchmarks',
        marker: {
            size: 12,
            color: points.map(b => {
                if (b.name.includes('Conservador')) return '#10B981'
                if (b.name.includes('Moderado')) return '#3B82F6'
                if (b.name.includes('Dinámico')) return '#8B5CF6'
                if (b.name.includes('Agresivo')) return '#EF4444'
                return '#94a3b8'
            }),
            symbol: 'diamond',
            line: { color: 'white', width: 1 }
        },
        type: 'scatter'
    }

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
                        zeroline: false
                    },
                    yaxis: {
                        title: 'Retorno Anual %',
                        showgrid: true,
                        gridcolor: '#f1f5f9',
                        zeroline: false
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

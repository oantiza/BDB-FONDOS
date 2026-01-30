import React from 'react'
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend
} from 'chart.js'
import { Scatter } from 'react-chartjs-2'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)

interface RiskMapProps {
    portfolioMetrics: { volatility?: number; annual_return?: number; cagr?: number };
    benchmarks?: { vol: number; ret: number; name: string; color?: string }[];
    staticPlot?: boolean;
}

export default function RiskMap({ portfolioMetrics, benchmarks = [], staticPlot = false }: RiskMapProps) {
    if (!portfolioMetrics) return <div className="text-xs text-slate-400">Sin datos de métricas</div>

    const pVol = (portfolioMetrics.volatility || 0) * 100
    const pRet = (portfolioMetrics.annual_return || portfolioMetrics.cagr || 0) * 100

    const data = {
        datasets: [
            {
                label: 'Tu Cartera',
                data: [{ x: pVol, y: pRet }],
                backgroundColor: '#0B2545',
                borderColor: '#D4AF37',
                borderWidth: 2,
                pointRadius: 8, // Highlighted
                pointHoverRadius: 10
            },
            {
                label: 'Benchmarks',
                data: benchmarks.map(b => ({
                    x: b.vol < 1 ? b.vol * 100 : b.vol,
                    y: b.ret < 1 ? b.ret * 100 : b.ret,
                    name: b.name // Custom property for tooltip
                })),
                backgroundColor: (ctx: any) => {
                    // Map colors from data if possible, or use default
                    const idx = ctx.dataIndex;
                    return benchmarks[idx]?.color || '#94a3b8';
                },
                pointStyle: 'rectRot', // Diamond-ish
                pointRadius: 5,
                pointHoverRadius: 7
            }
        ]
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                title: { display: true, text: 'Riesgo (Volatilidad) %', font: { size: 10 } },
                grid: { color: '#f1f5f9' },
                ticks: { font: { size: 10 } },
                beginAtZero: true
            },
            y: {
                title: { display: true, text: 'Retorno Anual %', font: { size: 10 } },
                grid: { color: '#f1f5f9' },
                ticks: { font: { size: 10 } }
                // beginAtZero: false // Allow negative returns
            }
        },
        plugins: {
            legend: {
                display: !staticPlot,
                position: 'bottom' as const,
                labels: { boxWidth: 10, font: { size: 10 } }
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        const d = context.raw;
                        const name = context.datasetIndex === 0 ? 'Tu Cartera' : (d.name || context.dataset.label);
                        return `${name}: Vol ${d.x.toFixed(2)}% / Ret ${d.y.toFixed(2)}%`;
                    }
                }
            }
        }
    }

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Scatter data={data} options={options} />
        </div>
    )
}

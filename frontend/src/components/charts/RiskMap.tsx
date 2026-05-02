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
    printMode?: boolean;
}

export default function RiskMap({ portfolioMetrics, benchmarks = [], staticPlot = false, printMode = false }: RiskMapProps) {
    if (!portfolioMetrics) return <div className="text-xs text-slate-400">Sin datos de métricas</div>

    const pVol = (portfolioMetrics.volatility || 0) * 100
    const pRet = (portfolioMetrics.annual_return || portfolioMetrics.cagr || 0) * 100

    const colors = {
        portfolio: '#0B2545',
        portfolioBorder: '#D4AF37',
        benchmarkDefault: printMode ? '#4b5563' : '#94a3b8',
        text: printMode ? '#000000' : '#64748b', // Pure black for print clarity
        grid: printMode ? '#e2e8f0' : '#f1f5f9',
        tooltipText: printMode ? '#000000' : '#64748b'
    }

    const data = {
        datasets: [
            {
                label: 'Tu Cartera',
                data: [{ x: pVol, y: pRet }],
                backgroundColor: colors.portfolio,
                borderColor: colors.portfolioBorder,
                borderWidth: 2,
                pointRadius: printMode ? 8 : 8, // Highlighted
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
                    return benchmarks[idx]?.color || colors.benchmarkDefault;
                },
                pointStyle: 'rectRot', // Diamond-ish
                pointRadius: printMode ? 6 : 5,
                pointHoverRadius: 7
            }
        ]
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                title: { display: true, text: 'Riesgo (Volatilidad) %', font: { size: printMode ? 13 : 10, weight: (printMode ? 'bold' : 'normal') as any }, color: colors.text },
                grid: { color: colors.grid },
                ticks: { font: { size: printMode ? 13 : 10 }, color: colors.text },
                beginAtZero: true
            },
            y: {
                title: { display: true, text: 'Retorno Anual %', font: { size: printMode ? 13 : 10, weight: (printMode ? 'bold' : 'normal') as any }, color: colors.text },
                grid: { color: colors.grid },
                ticks: { font: { size: printMode ? 13 : 10 }, color: colors.text }
                // beginAtZero: false // Allow negative returns
            }
        },
        plugins: {
            legend: {
                display: true, // Always show legend for now, or control via new prop
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    font: { size: printMode ? 13 : 10 },
                    color: colors.text
                }
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

    const benchmarkLabelsPlugin = {
        id: 'benchmarkLabels',
        afterDatasetsDraw(chart: any) {
            const { ctx } = chart;
            chart.data.datasets.forEach((dataset: any, i: number) => {
                const meta = chart.getDatasetMeta(i);
                if (dataset.label === 'Benchmarks' && !meta.hidden) {
                    meta.data.forEach((element: any, index: number) => {
                        const dataPoint = dataset.data[index];
                        const { x, y } = element.tooltipPosition();
                        const text = dataPoint.name;

                        if (text) {
                            ctx.save();
                            const fontSize = printMode ? 12 : 10;
                            ctx.font = `${fontSize}px Inter, system-ui, sans-serif`; // Small and aesthetic
                            ctx.fillStyle = colors.text; // Use dynamic text color
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(text, x + 10, y); // Offset to the right
                            ctx.restore();
                        }
                    });
                }
            });
        }
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Scatter data={data} options={options} plugins={[benchmarkLabelsPlugin]} />
        </div>
    )
}

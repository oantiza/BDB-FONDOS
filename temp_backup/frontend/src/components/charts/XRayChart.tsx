import { Line } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
} from 'chart.js'
import 'chartjs-adapter-date-fns'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
)

const THEME = { navy: '#0B2545', gold: '#D4AF37', slate: '#64748b', grid: '#f1f5f9' }

interface XRayChartProps {
    portfolioData?: { x: string | number | Date; y: number }[];
    benchmarkData?: { x: string | number | Date; y: number }[];
    benchmarkLabel?: string;
    portfolioLabel?: string;
    staticPlot?: boolean;
    printMode?: boolean;
}

export default function XRayChart({
    portfolioData = [],
    benchmarkData = [],
    benchmarkLabel = 'Benchmark',
    portfolioLabel = 'Mi Cartera',
    staticPlot = false,
    printMode = false
}: XRayChartProps) {
    const colors = {
        portfolio: '#0B2545', // Navy
        // Differentiate benchmark but keep it subtle. Grey-600 is distinct from Navy but not dominant.
        benchmark: printMode ? '#525252' : '#94a3b8',
        grid: printMode ? '#e2e8f0' : '#f1f5f9',
        borderWidth: printMode ? 2.5 : 2,
        tension: 0.1
    }

    const datasets = [
        {
            label: portfolioLabel,
            data: portfolioData,
            borderColor: colors.portfolio,
            borderWidth: colors.borderWidth,
            pointRadius: 0,
            tension: colors.tension
        } as any
    ]

    if (benchmarkData && benchmarkData.length > 0 && benchmarkLabel !== 'Seleccione Benchmark') {
        datasets.push({
            label: benchmarkLabel,
            data: benchmarkData,
            borderColor: colors.benchmark,
            borderDash: [5, 5],
            borderWidth: colors.borderWidth,
            pointRadius: 0,
            tension: colors.tension
        })
    }

    const data = { datasets }

    const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        animation: staticPlot ? false : undefined,
        parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        scales: {
            x: {
                type: 'time',
                grid: { display: false },
                time: {
                    unit: 'month',
                    stepSize: printMode ? 2 : 1 // Bimonthly for printMode as requested
                },
                ticks: {
                    color: printMode ? '#000000' : '#64748b',
                    // Increased font size by 1pt (9 -> 10) for printMode
                    font: { size: printMode ? 11 : 10 },
                    autoSkip: true,
                    maxRotation: 0,
                    minRotation: 0
                }
            },
            y: {
                grid: { color: colors.grid },
                ticks: {
                    color: printMode ? '#000000' : '#64748b',
                    // Increased font size by 1pt (9 -> 10) for printMode
                    font: { size: printMode ? 11 : 10 }
                }
            }
        },
        plugins: {
            legend: {
                position: 'top' as const,
                align: 'end' as const,
                labels: {
                    color: printMode ? '#000000' : '#64748b',
                    // Increased font size by 1pt (10 -> 11) for printMode (or keep 12 if previously larger default)
                    font: { size: printMode ? 12 : 12 },
                }
            }
        }
    }

    return <Line data={data} options={options} />
}

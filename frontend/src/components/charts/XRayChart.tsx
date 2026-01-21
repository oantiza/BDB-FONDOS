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
}

export default function XRayChart({ portfolioData = [], benchmarkData = [], benchmarkLabel = 'Benchmark', portfolioLabel = 'Mi Cartera', staticPlot = false }: XRayChartProps) {
    const datasets = [
        {
            label: portfolioLabel,
            data: portfolioData,
            borderColor: THEME.navy,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1
        } as any
    ]

    if (benchmarkData && benchmarkData.length > 0 && benchmarkLabel !== 'Seleccione Benchmark') {
        datasets.push({
            label: benchmarkLabel,
            data: benchmarkData,
            borderColor: '#94a3b8',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1
        })
    }

    const data = { datasets }

    const options: any = {
        responsive: true,
        maintainAspectRatio: false,
        animation: staticPlot ? false : undefined,
        parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        scales: {
            x: { type: 'time', grid: { display: false }, time: { unit: 'month' } },
            y: { grid: { color: THEME.grid } }
        },
        plugins: {
            legend: { position: 'top' as const, align: 'end' as const }
        }
    }

    return <Line data={data} options={options} />
}

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

export default function XRayChart({ portfolioData = [], benchmarkData = [], benchmarkLabel = 'Benchmark' }) {
    const datasets = [
        {
            label: 'Mi Cartera',
            data: portfolioData,
            borderColor: THEME.navy,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1
        }
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

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        scales: {
            x: { type: 'time', grid: { display: false }, time: { unit: 'month' } },
            y: { grid: { color: THEME.grid } }
        },
        plugins: {
            legend: { position: 'top', align: 'end' }
        }
    }

    return <Line data={data} options={options} />
}

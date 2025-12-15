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
    Filler
} from 'chart.js'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
)

export default function ComparisonChart({ currentData, proposedData }) {
    if (!currentData || !proposedData) return <div className="text-xs text-slate-400">Calculando proyección...</div>

    const labels = currentData.map((d, i) => i) // Indices 0...N

    const data = {
        labels,
        datasets: [
            {
                label: 'Cartera Actual',
                data: currentData.map(d => d.y),
                borderColor: '#94a3b8',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1,
                fill: false
            },
            {
                label: 'Propuesta Táctica',
                data: proposedData.map(d => d.y),
                borderColor: '#0B2545',
                backgroundColor: 'rgba(11, 37, 69, 0.05)',
                borderWidth: 3,
                pointRadius: 0,
                tension: 0.1,
                fill: true
            }
        ]
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: { mode: 'index', intersect: false }
        },
        scales: {
            x: { display: false },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    }

    return <Line data={data} options={options} />
}

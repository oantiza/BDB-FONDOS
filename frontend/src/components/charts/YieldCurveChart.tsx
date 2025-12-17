import { Line } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
)

const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        },
        tooltip: {
            itemSort: (a, b) => a.dataIndex - b.dataIndex,
            callbacks: {
                label: (context) => `Yield: ${context.parsed.y}%`
            }
        }
    },
    scales: {
        x: {
            grid: {
                display: false
            },
            ticks: {
                font: { size: 10 }
            }
        },
        y: {
            grid: {
                color: '#f1f5f9'
            },
            title: {
                display: true,
                text: 'Yield %',
                font: { size: 10 }
            },
            ticks: {
                font: { size: 10 }
            }
        }
    }
}

export default function YieldCurveChart({ data }) {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-full text-xs text-slate-400">Cargando curva...</div>
    }

    const chartData = {
        labels: data.map(d => d.maturity),
        datasets: [
            {
                label: 'US Treasury Yield Curve',
                data: data.map(d => d.yield),
                borderColor: '#D4AF37',
                backgroundColor: 'rgba(212, 175, 55, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#0B2545',
                pointRadius: 4,
                pointHoverRadius: 6
            }
        ]
    }

    return (
        <div className="w-full h-full pb-2 pr-2">
            <Line data={chartData} options={options} />
        </div>
    )
}

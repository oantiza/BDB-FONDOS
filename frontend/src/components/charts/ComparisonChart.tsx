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

interface DataPoint { x: string | number; y: number }
interface ComparisonChartProps {
    currentData: DataPoint[];
    proposedData: DataPoint[];
}

export default function ComparisonChart({ currentData, proposedData }: ComparisonChartProps) {
    if (!currentData || !proposedData) return <div className="text-xs text-slate-400">Calculando proyección...</div>

    // Use 'x' property for labels if available (Backtest mode), otherwise use index (Projection mode)
    const labels = currentData[0]?.x ? currentData.map((d: any) => d.x) : currentData.map((d: any, i: number) => i)

    const data = {
        labels,
        datasets: [
            {
                label: 'Cartera Actual',
                data: currentData.map((d: any) => d.y),
                borderColor: '#94a3b8',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1,
                fill: false
            },
            {
                label: 'Propuesta Táctica',
                data: proposedData.map((d: any) => d.y),
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
            legend: { position: 'top' as const, align: 'end' as const, labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: { mode: 'index' as const, intersect: false }
        },
        scales: {
            x: { display: false },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } }
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false
        }
    }

    return <Line data={data} options={options} />
}

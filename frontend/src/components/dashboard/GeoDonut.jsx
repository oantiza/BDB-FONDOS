import { Doughnut } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const PALETTE = ['#0B2545', '#3b82f6', '#f59e0b', '#cbd5e1', '#10B981'] // Navy, Blue, Amber, Slate, Emerald

export default function GeoDonut({ allocation = [] }) {
    // allocation: Array of { label, value }
    const safeData = Array.isArray(allocation) ? allocation : []
    const total = safeData.reduce((s, x) => s + x.value, 0)

    // Normalizer factor not needed if inputs are raw sums? 
    // Usually 'value' is sum of weights (0-100).
    // If we want to ensure it sums to 100 for display, chartjs handles percentages relative to total.

    const isEmpty = total < 0.1

    const labels = isEmpty ? ['Sin Datos'] : safeData.map(d => d.label)
    const values = isEmpty ? [1] : safeData.map(d => d.value)
    const colors = isEmpty ? ['#f1f5f9'] : safeData.map((_, i) => PALETTE[i % PALETTE.length])

    const data = {
        labels: labels,
        datasets: [
            {
                data: values,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4
            }
        ]
    }

    const options = {
        cutout: '80%',
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: !isEmpty,
                callbacks: {
                    label: (context) => ` ${context.label}: ${context.raw.toFixed(1)}%`
                }
            }
        },
        maintainAspectRatio: false,
        layout: { padding: 10 }
    }

    if (isEmpty) return <div className="text-xs text-slate-400 text-center flex items-center justify-center h-full">Sin datos</div>

    return (
        <div className="flex flex-col h-full w-full items-center justify-between py-1">
            <div className="flex-1 w-full relative min-h-0">
                <Doughnut data={data} options={options} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Region</span>
                </div>
            </div>
            {/* Dynamic Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1 px-2 h-auto max-h-[4rem] overflow-y-auto scrollbar-none">
                {safeData.map((d, i) => (
                    <LegendItem key={i} color={PALETTE[i % PALETTE.length]} label={d.label} />
                ))}
            </div>
        </div>
    )
}

const LegendItem = ({ color, label }) => (
    <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
        <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[80px]" title={label}>{label}</span>
    </div>
)

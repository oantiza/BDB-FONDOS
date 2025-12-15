import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

const PALETTE = ['#10B981', '#3b82f6', '#D4AF37', '#f43f5e', '#8b5cf6', '#cbd5e1'] // Emerald, Blue, Gold, Rose, Violet, Slate

export default function SmartDonut({ allocation = [] }) {
    // Allocation is now an array: [{ label, value }]

    // Safety check for legacy or empty
    const safeData = Array.isArray(allocation) ? allocation : []
    const totalAlloc = safeData.reduce((s, x) => s + x.value, 0)

    const isEmpty = totalAlloc < 0.1

    // Prepare Chart Data
    const labels = isEmpty ? ['Sin Datos'] : safeData.map(d => d.label)
    const values = isEmpty ? [1] : safeData.map(d => d.value)
    const colors = isEmpty ? ['#1e293b'] : safeData.map((_, i) => PALETTE[i % PALETTE.length])

    const dataAlloc = {
        labels: labels,
        datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 4
        }]
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: !isEmpty,
                callbacks: {
                    label: (ctx) => ` ${ctx.label}: ${ctx.raw.toFixed(1)}%`
                }
            }
        },
        cutout: '80%',
        layout: { padding: 10 }
    }

    return (
        <div className="flex flex-col h-full w-full items-center justify-between py-1">
            <div className="flex-1 w-full relative min-h-0">
                <Doughnut data={dataAlloc} options={options} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Activos</span>
                </div>
            </div>
            {/* Dynamic Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1 px-2 h-auto max-h-[4rem] overflow-y-auto scrollbar-none">
                {!isEmpty && safeData.map((d, i) => (
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

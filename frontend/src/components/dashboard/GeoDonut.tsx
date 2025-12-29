import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const PALETTE = ['#0B2545', '#A07147', '#1E3A8A', '#D4AF37', '#64748B'] // Navy, Gold, Dark Blue, Light Gold, Slate

interface GeoData {
    label: string;
    value: number;
}

export default function GeoDonut({ allocation = [] }: { allocation: GeoData[] }) {
    const safeData = Array.isArray(allocation) ? allocation : []
    const total = safeData.reduce((s, x) => s + x.value, 0)
    const isEmpty = total < 0.1

    const labels = isEmpty ? ['Sin Datos'] : safeData.map(d => d.label)
    const values = isEmpty ? [1] : safeData.map(d => d.value)
    const colors = isEmpty ? ['#e5e7eb'] : safeData.map((_, i) => PALETTE[i % PALETTE.length])

    const data = {
        labels: labels,
        datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 4
        }]
    }

    const options = {
        cutout: '85%', // Thinner ring (Elegance)
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: !isEmpty,
                callbacks: {
                    label: (context: any) => ` ${context.label}: ${context.raw.toFixed(1)}%`
                }
            }
        },
        maintainAspectRatio: false,
        layout: { padding: 5 } // Minimized padding
    }

    if (isEmpty) return <div className="text-xs text-gray-400 text-center flex items-center justify-center h-full">Sin datos</div>

    return (
        <div className="flex flex-col h-full w-full items-center justify-between py-1">
            <div className="flex-1 w-full relative min-h-0">
                <Doughnut data={data} options={options} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em]">Región</span>
                </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2 px-2 h-16 overflow-y-auto scrollbar-none shrink-0">
                {safeData.map((d, i) => (
                    <LegendItem key={i} color={PALETTE[i % PALETTE.length]} label={d.label} />
                ))}
            </div>
        </div>
    )
}

const LegendItem = ({ color, label }: { color: string; label: string }) => (
    <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></div>
        <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[80px]" title={label}>{label}</span>
    </div>
)
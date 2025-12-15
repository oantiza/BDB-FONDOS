import { Doughnut } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = {
    USA: '#3b82f6', // Bright Blue
    Europe: '#D4AF37', // Gold
    Emerging: '#64748b', // Slate 500
    Other: '#94a3b8'   // Slate 400
}

export default function GeoDonut({ allocation }) {
    // allocation: { USA: 60, Europe: 30, Emerging: 10 }

    // Fallback normalizer
    const total = (allocation.USA || 0) + (allocation.Europe || 0) + (allocation.Emerging || 0) + (allocation.Other || 0)
    const factor = total > 0 ? 100 / total : 0

    const data = {
        labels: ['USA', 'Europa', 'Emergente', 'Otros'],
        datasets: [
            {
                data: [
                    (allocation.USA || 0) * factor,
                    (allocation.Europe || 0) * factor,
                    (allocation.Emerging || 0) * factor,
                    (allocation.Other || 0) * factor,
                ],
                backgroundColor: [COLORS.USA, COLORS.Europe, COLORS.Emerging, COLORS.Other],
                borderWidth: 0,
                hoverOffset: 4
            }
        ]
    }

    const options = {
        cutout: '70%',
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => ` ${context.label}: ${context.raw.toFixed(1)}%`
                }
            }
        },
        maintainAspectRatio: false
    }

    if (total === 0) return <div className="text-[10px] text-slate-400 text-center">Sin Datos</div>

    return (
        <div className="relative w-24 h-24">
            <Doughnut data={data} options={options} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[9px] font-bold text-slate-400">GEO</span>
            </div>
        </div>
    )
}

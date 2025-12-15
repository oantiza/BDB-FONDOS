import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function SmartDonut({ allocation, geography }) {
    // Allocation Donut (Inner or Left)
    const totalAlloc = allocation.rv + allocation.rf + allocation.other
    const allocDataValues = totalAlloc < 0.1 ? [1, 0, 0] : [allocation.rv, allocation.rf, allocation.other]
    const allocColors = totalAlloc < 0.1 ? ['#1e293b', '#1e293b', '#1e293b'] : ['#10B981', '#3b82f6', '#D4AF37'] // Emerald, Blue, Gold

    const dataAlloc = {
        labels: ['RV', 'RF', 'Liq'],
        datasets: [{
            data: allocDataValues,
            backgroundColor: allocColors,
            borderWidth: 0,
            hoverOffset: 4
        }]
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: { boxWidth: 8, font: { size: 9 }, usePointStyle: true }
            },
            tooltip: { enabled: totalAlloc > 0.1 }
        },
        cutout: '75%'
    }

    return (
        <div className="flex flex-col h-full w-full">
            <div className="flex-1 relative min-h-0">
                <Doughnut data={dataAlloc} options={options} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Activos</span>
                </div>
            </div>
        </div>
    )
}

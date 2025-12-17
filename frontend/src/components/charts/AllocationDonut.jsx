import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function AllocationDonut({ allocation }) {
    const { rv = 0, rf = 0, other = 0 } = allocation || {}
    const total = rv + rf + other

    const dataValues = total < 0.1 ? [1, 0, 0] : [rv, rf, other]
    const bgColors = total < 0.1 ? ['#e2e8f0', '#e2e8f0', '#e2e8f0'] : ['#10B981', '#0B2545', '#D4AF37']

    const data = {
        labels: ['Renta Var.', 'Renta Fija', 'Liquidez'],
        datasets: [
            {
                data: dataValues,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 4
            },
        ],
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: { font: { size: 10 }, usePointStyle: true, padding: 10 }
            },
            tooltip: { enabled: total > 0.1 }
        },
        cutout: '70%'
    }

    return <Doughnut data={data} options={options} />
}

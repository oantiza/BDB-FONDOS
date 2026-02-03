import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const PALETTE = ['#0B2545', '#A07147', '#1E3A8A', '#D4AF37', '#64748B'] // Navy, Gold, Dark Blue, Light Gold, Slate

interface GeoData {
    label: string;
    value: number;
}

export default function GeoBars({ allocation = [] }: { allocation: GeoData[] }) {
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
            borderRadius: 4,
            barThickness: 15,
        }]
    }

    const options = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: !isEmpty,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10,
                callbacks: {
                    label: (context: any) => ` ${context.label}: ${context.raw.toFixed(1)}%`
                }
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                max: 100,
                grid: {
                    display: true,
                    color: '#f1f5f9',
                    lineWidth: 1
                },
                ticks: {
                    callback: (value: any) => `${value}%`,
                    font: { size: 9 },
                    color: '#94a3b8'
                }
            },
            y: {
                grid: {
                    display: false
                },
                ticks: {
                    font: { size: 10, weight: 'bold' as const },
                    color: '#475569'
                }
            }
        },
        layout: { padding: { top: 10, bottom: 10, left: 10, right: 10 } }
    }

    if (isEmpty) return <div className="text-xs text-gray-400 text-center flex items-center justify-center h-full">Sin datos</div>

    return (
        <div className="flex flex-col h-full w-full py-2">
            <div className="text-center mb-2">
                <span className="text-sm font-medium text-black uppercase tracking-[0.2em]" style={{ fontFamily: "'Roboto Flex', sans-serif" }}>Región</span>
            </div>
            <div className="flex-1 w-full relative min-h-0">
                <Bar data={data} options={options} />
            </div>
        </div>
    )
}

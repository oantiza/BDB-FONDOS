import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

// Paleta Semántica Profesional (Same as SmartDonut)
const ASSET_COLORS: Record<string, string> = {
    // RV (Navy/Blue Spectrum)
    'RV Norteamérica': '#0B2545',
    'RV Europa': '#1E3A8A',
    'RV Emergentes/Asia': '#3B82F6',
    'RV Global': '#60A5FA',

    // RF (Gold/Earth Spectrum)
    'Deuda Pública': '#A07147',
    'Crédito Corporativo': '#D4AF37',
    'Renta Fija Global': '#C5A059',

    // Otros (Slate/Neutral)
    'Monetarios': '#94A3B8',
    'Retorno Absoluto': '#64748B',
    'Materias Primas': '#475569',
    'Alternativos/Otros': '#CBD5E1'
}
const DEFAULT_PALETTE = ['#0B2545', '#A07147', '#64748B', '#D4AF37', '#1E3A8A']

interface AssetAllocation { label: string; value: number }

export default function SmartBars({ allocation = [] }: { allocation?: AssetAllocation[] }) {
    const safeData = Array.isArray(allocation) ? allocation : []
    const totalAlloc = safeData.reduce((s, x) => s + (x.value || 0), 0)
    const isEmpty = totalAlloc < 0.1

    const labels = isEmpty ? ['Sin Datos'] : safeData.map(d => d.label)
    const values = isEmpty ? [1] : safeData.map(d => d.value)

    const colors = isEmpty
        ? ['#f3f4f6']
        : safeData.map((d, i) => ASSET_COLORS[d.label] || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length])

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
                    label: (ctx: any) => {
                        const val = ctx.raw as number;
                        return ` ${ctx.label}: ${val.toFixed(1)}%`;
                    }
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

    return (
        <div className="flex flex-col h-full w-full py-2 relative">
            <div className="text-center mb-2">
                <span className="text-sm font-medium text-black uppercase tracking-[0.2em]" style={{ fontFamily: "'Roboto Flex', sans-serif" }}>
                    ACTIVOS
                </span>
            </div>
            <div className="flex-1 w-full relative min-h-0">
                <Bar data={data} options={options} />
            </div>
        </div>
    )
}

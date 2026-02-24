import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const REGION_COLORS: Record<string, string> = {
    'EE.UU.': '#0F172A',      // Navy muy oscuro
    'Estados Unidos': '#0F172A',
    'USA': '#0F172A',
    'Eurozona': '#2563EB',   // Azul intenso
    'Europa': '#2563EB',
    'Emergentes': '#D97706', // Ámbar/Naranja
    'Asia': '#DC2626',       // Rojo
    'Japón': '#059669',      // Verde Esmeralda
    'Pacífico': '#7C3AED',   // Púrpura
    'Otros': '#64748B'       // Slate
}
const DEFAULT_PALETTE = ['#0F172A', '#2563EB', '#D97706', '#DC2626', '#059669', '#7C3AED']

const chartDataLabels = {
    id: 'chartDataLabels',
    afterDatasetsDraw(chart: any) {
        if (chart.options.plugins.datalabels === false) return;
        const { ctx, data } = chart;
        ctx.save();
        data.datasets.forEach((dataset: any, i: number) => {
            const meta = chart.getDatasetMeta(i);
            meta.data.forEach((bar: any, index: number) => {
                const value = dataset.data[index];
                if (value > 0.1) {
                    ctx.font = 'bold 9px Inter, sans-serif';
                    ctx.fillStyle = '#475569';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    const x = bar.x + 6;
                    const y = bar.y;
                    ctx.fillText(`${value.toFixed(1)}%`, x, y);
                }
            });
        });
        ctx.restore();
    }
}

interface GeoData {
    label: string;
    value: number;
}

export default function GeoBars({ allocation = [] }: { allocation: GeoData[] }) {
    const safeData = (Array.isArray(allocation) ? allocation : []).slice(0, 5)
    const total = safeData.reduce((s, x) => s + x.value, 0)
    const isEmpty = total < 0.1

    const labels = isEmpty ? ['Sin Datos'] : safeData.map(d => d.label)
    const values = isEmpty ? [1] : safeData.map(d => d.value)
    const colors = isEmpty
        ? ['#e5e7eb']
        : safeData.map((d, i) => REGION_COLORS[d.label] || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length])

    const data = {
        labels: labels,
        datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
            borderRadius: 20, // Fully rounded
            barThickness: 12,
        }]
    }

    const options = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            datalabels: !isEmpty,
            tooltip: {
                enabled: !isEmpty,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 8,
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
                    display: false,
                }
            },
            y: {
                grid: { display: false },
                ticks: {
                    font: { size: 9, weight: 'bold' as const },
                    color: '#334155'
                }
            }
        },
        layout: { padding: { top: 4, bottom: 4, left: 2, right: 35 } }
    }

    if (isEmpty) return <div className="text-xs text-slate-400 text-center flex items-center justify-center h-full">Sin datos</div>

    return (
        <div className="flex flex-col h-full w-full py-1">
            <div className="text-center mb-1">
                <span className="text-[11px] font-extrabold text-[#0B2545] uppercase tracking-[0.15em]">Región</span>
            </div>
            <div className="flex-1 w-full relative min-h-0">
                <Bar data={data} options={options} plugins={[chartDataLabels]} />
            </div>
        </div>
    )
}

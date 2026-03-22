import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const ASSET_COLORS: Record<string, string> = {
    // RV - Azules
    'RV Norteamérica': '#1E3A8A',
    'RV Europa': '#2563EB',
    'RV Emergentes/Asia': '#3B82F6',
    'RV Global': '#60A5FA',
    'RV - Tecnología': '#4F46E5', // Indigo
    'RV - Salud': '#E11D48', // Rose/Healthcare
    // RF - Verdes
    'Deuda Pública': '#059669',
    'RF - Soberana': '#059669',
    'Crédito Corporativo': '#10B981',
    'RF - Corporativa': '#10B981',
    'RF - High Yield': '#F59E0B', // Amber
    'Renta Fija Global': '#34D399',
    // Monetarios - Slate
    'Monetarios': '#94A3B8',
    // Alternativos - Turquesas
    'Alternativos': '#0D9488',
    'Retorno Absoluto': '#0D9488',
    'Materias Primas': '#14B8A6',
    'Alternativos/Otros': '#2DD4BF',
    'Otros': '#64748B' // Gris
}
const DEFAULT_PALETTE = ['#1E3A8A', '#059669', '#0D9488', '#94A3B8']

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
                    ctx.font = '900 11px Inter, sans-serif';
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

interface AssetAllocation { label: string; value: number }

export default function SmartBars({ allocation = [] }: { allocation?: AssetAllocation[] }) {
    const safeData = (Array.isArray(allocation) ? allocation : []).slice(0, 6)
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
            borderRadius: 20, // Fully rounded
            barThickness: 16,
        }]
    }

    const options = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            datalabels: !isEmpty, // Prop for our custom plugin
            tooltip: {
                enabled: !isEmpty,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 8,
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
                    display: false, // Hide ticks as we have integrated values
                }
            },
            y: {
                grid: { display: false },
                ticks: {
                    font: { size: 11, weight: 'bold' as const },
                    color: '#334155',
                    padding: 4,
                    callback: function(value: any) {
                        const rawLabel = this.getLabelForValue(value as number);
                        const label = String(rawLabel);
                        if (label.length > 13) {
                            if (label.includes('/')) {
                                const parts = label.split('/');
                                return [parts[0] + '/', parts.slice(1).join('/')];
                            }
                            if (label.includes(' - ')) {
                                const parts = label.split(' - ');
                                return [parts[0] + ' -', parts.slice(1).join(' - ')];
                            }
                            if (label.includes(' ')) {
                                const parts = label.split(' ');
                                return [parts[0], parts.slice(1).join(' ')];
                            }
                        }
                        return label;
                    }
                }
            }
        },
        layout: { padding: { top: 0, bottom: 0, left: 2, right: 42 } }
    }

    return (
        <div className="flex flex-col h-full w-full pt-0 pb-1 relative">
            <div className="text-center mb-0">
                <span className="text-[12px] font-extrabold text-[#0B2545] uppercase tracking-[0.2em]">
                    Activos
                </span>
            </div>
            <div className="flex-1 w-full relative min-h-0">
                <Bar data={data} options={options} plugins={[chartDataLabels]} />
            </div>
        </div>
    )
}

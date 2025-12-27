import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

// Paleta Semántica Profesional
const ASSET_COLORS: Record<string, string> = {
    // RV
    'RV Norteamérica': '#ef4444', // Red 500
    'RV Europa': '#3b82f6',       // Blue 500
    'RV Emergentes/Asia': '#f59e0b', // Amber 500
    'RV Global': '#ec4899',       // Pink 500

    // RF
    'Deuda Pública': '#10b981',   // Emerald 500
    'Crédito Corporativo': '#06b6d4', // Cyan 500
    'Renta Fija Global': '#6366f1',   // Indigo 500

    // Otros
    'Monetarios': '#84cc16',      // Lime 500
    'Retorno Absoluto': '#a855f7', // Purple 500
    'Materias Primas': '#f97316', // Orange 500
    'Alternativos/Otros': '#64748b' // Slate 500
}
const DEFAULT_PALETTE = ['#64748b', '#94a3b8', '#cbd5e1']

export default function SmartDonut({ allocation = [] }) {
    // Verificación de datos
    const safeData = Array.isArray(allocation) ? allocation : []
    const totalAlloc = safeData.reduce((s, x) => s + (x.value || 0), 0)
    const isEmpty = totalAlloc < 0.1

    // Preparar Datos del Gráfico
    const labels = isEmpty ? ['Sin Datos'] : safeData.map(d => d.label)
    const values = isEmpty ? [1] : safeData.map(d => d.value)

    const colors = isEmpty
        ? ['#f3f4f6'] // Gris muy claro si está vacío
        : safeData.map((d, i) => ASSET_COLORS[d.label] || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length])

    const dataAlloc = {
        labels: labels,
        datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 2,         // Separador blanco
            borderColor: '#ffffff', // Color del separador
            borderRadius: 4,        // Bordes redondeados (Efecto moderno)
            hoverOffset: 4
        }]
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }, // Usamos nuestra leyenda personalizada
            tooltip: {
                enabled: !isEmpty,
                backgroundColor: 'rgba(255, 255, 255, 0.95)', // Fondo blanco
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10,
                boxPadding: 4,
                usePointStyle: true,
                callbacks: {
                    label: (ctx: any) => {
                        const val = ctx.raw as number;
                        return ` ${ctx.label}: ${val.toFixed(1)}%`;
                    }
                }
            }
        },
        cutout: '65%', // Thicker ring (was 70%)
        layout: { padding: 5 } // Minimized padding (was 10)
    }

    return (
        <div className="flex flex-col h-full w-full items-center justify-between py-1 relative">
            <div className="flex-1 w-full relative min-h-0">
                <Doughnut data={dataAlloc} options={options} />
                {/* Texto Central */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-extrabold text-slate-400 uppercase tracking-widest">
                        ACTIVOS
                    </span>
                </div>
            </div>

            {/* Leyenda Dinámica con Valores */}
            <div className="flex flex-wrap gap-2 justify-center mt-2 px-1 w-full max-h-[4.5rem] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                {!isEmpty && safeData.map((d, i) => (
                    <LegendItem
                        key={i}
                        color={ASSET_COLORS[d.label] || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]}
                        label={d.label}
                        value={d.value}
                    />
                ))}
            </div>
        </div>
    )
}

// Componente de Leyenda Mejorado
const LegendItem = ({ color, label, value }: { color: string, label: string, value: number }) => (
    <div className="flex items-center gap-1.5 bg-white border border-slate-100 rounded px-1.5 py-0.5 shadow-sm">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
        <div className="flex items-baseline gap-1">
            <span className="text-[9px] font-bold text-slate-600 uppercase truncate max-w-[70px]" title={label}>
                {label}
            </span>
            <span className="text-[9px] font-mono text-slate-400">
                {value.toFixed(1)}%
            </span>
        </div>
    </div>
)
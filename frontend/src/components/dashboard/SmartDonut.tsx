import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

// Paleta Semántica Profesional
// Paleta Semántica Profesional (Editorial Premium: Navy & Gold)
const ASSET_COLORS: Record<string, string> = {
    // RV (Navy/Blue Spectrum)
    'RV Norteamérica': '#0B2545', // Deep Navy
    'RV Europa': '#1E3A8A',       // Dark Blue
    'RV Emergentes/Asia': '#3B82F6', // Blue 500
    'RV Global': '#60A5FA',       // Blue 400

    // RF (Gold/Earth Spectrum)
    'Deuda Pública': '#A07147',   // Gold/Bronze
    'Crédito Corporativo': '#D4AF37', // Lighter Gold
    'Renta Fija Global': '#C5A059',   // Pale Gold

    // Otros (Slate/Neutral)
    'Monetarios': '#94A3B8',      // Slate 400
    'Retorno Absoluto': '#64748B', // Slate 500
    'Materias Primas': '#475569', // Slate 600
    'Alternativos/Otros': '#CBD5E1' // Slate 300
}
const DEFAULT_PALETTE = ['#0B2545', '#A07147', '#64748B', '#D4AF37', '#1E3A8A']

interface AssetAllocation { label: string; value: number }
export default function SmartDonut({ allocation = [] }: { allocation?: AssetAllocation[] }) {
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
        cutout: '85%', // Thinner ring (Elegance)
        layout: { padding: 5 } // Minimized padding (was 10)
    }

    return (
        <div className="flex flex-col h-full w-full items-center justify-between py-1 relative">
            <div className="flex-1 w-full relative min-h-0">
                <Doughnut data={dataAlloc} options={options} />
                {/* Texto Central */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-bold text-[#A07147] uppercase tracking-[0.2em]">
                        ACTIVOS
                    </span>
                </div>
            </div>

            {/* Leyenda Dinámica con Valores */}
            <div className="flex flex-wrap gap-2 justify-center mt-2 px-1 w-full h-16 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 snap-end shrink-0">
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
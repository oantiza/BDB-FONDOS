import { Line } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale
} from 'chart.js'
import 'chartjs-adapter-date-fns'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    TimeScale
)

const THEME = { navy: '#38bdf8', gold: '#D4AF37', slate: '#94a3b8', grid: '#334155' } // Navy -> Sky Blue for visibility

export default function HistoryChart({ data }) {
    if (!data || data.length === 0) return <div className="flex items-center justify-center h-full text-slate-400 text-xs">Sin datos</div>;

    // Detect basic single line or multi-path (cone)
    const isMultiPath = Array.isArray(data) && Array.isArray(data[0]);

    let datasets = [];

    if (isMultiPath) {
        datasets = data.map((simulationPoints) => ({
            data: simulationPoints,
            borderColor: 'rgba(11, 37, 69, 0.15)',
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0.4
        }));
    } else {
        // Single line
        datasets = [{
            data: data,
            borderColor: THEME.navy,
            backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, 'rgba(56, 189, 248, 0.5)'); // Sky Blue 0.5
                gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)'); // Sky Blue 0.0
                return gradient;
            },
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            tension: 0.4
        }];
    }

    // Calculate scales (simple approximation)
    let allY = [];
    if (isMultiPath) {
        data.forEach(arr => arr.forEach(p => allY.push(p.y)));
    } else {
        if (datasets[0].data) datasets[0].data.forEach(p => allY.push(p.y));
    }

    const minY = allY.length ? Math.min(...allY) * 0.98 : 0;
    const maxY = allY.length ? Math.max(...allY) * 1.02 : 100;

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        parsing: { xAxisKey: 'x', yAxisKey: 'y' },
        plugins: {
            legend: { display: false },
            tooltip: { enabled: !isMultiPath }
        },
        scales: {
            x: { type: 'time', display: false, time: { unit: 'month' } },
            y: { display: false, min: minY, max: maxY }
        },
        elements: { point: { radius: 0 } },
        animation: { duration: 0 }
    };

    return <Line data={{ datasets }} options={options} />;
}

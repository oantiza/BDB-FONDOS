import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { es } from 'date-fns/locale';
import ModalHeader from '../common/ModalHeader';
import { useFundHistory } from '../../hooks/useFundHistory';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
);

interface HistoricalChartModalProps {
    fund: any;
    onClose: () => void;
}

export default function HistoricalChartModal({ fund, onClose }: HistoricalChartModalProps) {
    // 1. Fetch History
    const { historyData, loading } = useFundHistory([fund.isin]);

    // 2. Prepare Data (5 Years, Weekly)
    const chartData = useMemo(() => {
        const series = historyData[fund.isin];
        if (!series || series.length === 0) return null;

        // FILTER: Last 5 Years
        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setFullYear(now.getFullYear() - 5);

        const filteredSeries = series.filter(item => item.date >= cutoffDate);
        if (filteredSeries.length === 0) return null;

        // RESAMPLE: Weekly (1 point per week)
        // Simple strategy: Group by "Year-Week" string, take the last entry (Friday/close)
        const weeklyMap: Record<string, typeof series[0]> = {};

        filteredSeries.forEach(item => {
            // ISO Week approximation or simple string key
            const d = item.date;
            // Key: "2023-W12". Using concise week calc:
            const onejan = new Date(d.getFullYear(), 0, 1);
            const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
            const key = `${d.getFullYear()}-W${week}`;

            // Overwrite, so we keep the LATEST date of that week (e.g. Friday)
            weeklyMap[key] = item;
        });

        const weeklySeries = Object.values(weeklyMap).sort((a, b) => a.date.getTime() - b.date.getTime());

        const dataPoints = weeklySeries.map(item => ({
            x: item.date.getTime(),
            y: item.price
        }));

        return {
            datasets: [
                {
                    label: fund.name,
                    data: dataPoints,
                    borderColor: '#003399',
                    backgroundColor: '#003399',
                    borderWidth: 2, // Thicker line for fewer points
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: false,
                    tension: 0.2, // Slight curve for weekly data looks better
                    spanGaps: true
                }
            ]
        };
    }, [fund, historyData]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 }, // Disable initial animation
        normalized: true, // Data is already sorted
        parsing: false as const, // Use direct x/y properties, skip internal parsing
        scales: {
            x: {
                type: 'time' as const,
                time: {
                    unit: 'year' as const,
                    displayFormats: { year: 'yyyy' },
                    tooltipFormat: 'dd MMM yyyy'
                },
                grid: { display: false },
                ticks: {
                    maxRotation: 0,
                    autoSkip: true,
                    font: { size: 10 }
                }
            },
            y: {
                position: 'right' as const,
                grid: { color: '#f0f0f0' },
                ticks: {
                    callback: (val: any) => val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
                    font: { size: 10 }
                }
            }
        },
        plugins: {
            legend: { display: false },
            decimation: { enabled: true }, // Enable built-in decimation if available
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                callbacks: {
                    label: (context: any) => {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <ModalHeader title={`Histórico 5 Años (Semanal): ${fund.name}`} icon="📈" onClose={onClose} />

                <div className="p-6 h-[500px] w-full relative bg-white">
                    {loading && (
                        <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center">
                            <span className="text-[#003399] font-bold animate-pulse">Cargando datos históricos...</span>
                        </div>
                    )}

                    {!loading && chartData ? (
                        <Line data={chartData} options={options} />
                    ) : !loading ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            <span className="text-3xl mb-2">📉</span>
                            <p>No hay datos históricos disponibles para este fondo.</p>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

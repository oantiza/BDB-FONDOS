import React, { useState, useMemo } from 'react';
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
import { enUS, es } from 'date-fns/locale';
import { Fund } from '../../types';
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

interface ComparativeFundHistoryChartProps {
    funds: Fund[];
}

// Expanded High-Contrast Palette
const COLORS = [
    '#2980B9', // Bright Blue
    '#E74C3C', // Red
    '#27AE60', // Emerald Green
    '#F39C12', // Orange
    '#8E44AD', // Purple
    '#16A085', // Teal
    '#2C3E50', // Navy
    '#D35400', // Pumpkin
    '#7F8C8D', // Grey
    '#C0392B', // Dark Red
    '#8E44AD', // Deep Purple
    '#2ECC71', // Light Green
];

export default function ComparativeFundHistoryChart({ funds }: ComparativeFundHistoryChartProps) {
    const [selectedIsins, setSelectedIsins] = useState<string[]>(() =>
        funds.slice(0, 5).map(f => f.isin)
    );
    // Period Fixed to 10Y
    const period = '10y';

    const { historyData, loading } = useFundHistory(selectedIsins);

    const chartData = useMemo(() => {
        const now = new Date();
        const startDate = new Date();
        startDate.setFullYear(now.getFullYear() - 10);

        const datasets = selectedIsins.map((isin, idx) => {
            const fund = funds.find(f => f.isin === isin);
            const series = historyData[isin];

            if (!fund || !series || series.length === 0) return null;

            const filtered = series.filter(item => item.date >= startDate && item.price > 0);

            if (filtered.length === 0) return null;

            const startPrice = filtered[0].price;

            const dataPoints = filtered.map(item => ({
                x: item.date,
                y: (item.price / startPrice) * 10000
            }));

            return {
                label: fund.name,
                data: dataPoints,
                borderColor: COLORS[idx % COLORS.length],
                backgroundColor: COLORS[idx % COLORS.length],
                pointBackgroundColor: 'white',
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBorderWidth: 2,
                tension: 0.1
            };
        }).filter(Boolean) as any[];

        return { datasets };
    }, [funds, selectedIsins, period, historyData]);

    const handleToggleFund = (isin: string) => {
        if (selectedIsins.includes(isin)) {
            setSelectedIsins(prev => prev.filter(id => id !== isin));
        } else {
            setSelectedIsins(prev => [...prev, isin]);
        }
    };

    const toggleAll = (select: boolean) => {
        if (select) setSelectedIsins(funds.map(f => f.isin));
        else setSelectedIsins([]);
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        scales: {
            x: {
                type: 'time' as const,
                time: {
                    unit: 'year' as const,
                    displayFormats: { month: 'MMM yyyy', year: 'yyyy' }
                },
                grid: {
                    display: true,
                    drawOnChartArea: true,
                    color: '#e2e8f0', // Slate-200 (Subtle)
                    drawTicks: false,
                },
                ticks: {
                    color: '#64748b', // Slate-500
                    font: { family: 'Inter, sans-serif', size: 10 },
                    maxRotation: 0,
                    autoSkip: true
                },
                border: { display: false }
            },
            y: {
                position: 'right' as const,
                grid: {
                    color: '#f1f5f9', // Slate-100
                    borderDash: [4, 4],
                },
                ticks: {
                    callback: (val: any) => val.toLocaleString('es-ES'),
                    color: '#64748b',
                    font: { family: 'Inter, sans-serif', size: 10 }
                },
                border: { display: false }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#0f172a',
                bodyColor: '#334155',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10,
                bodyFont: { family: 'Inter, sans-serif', size: 12 },
                titleFont: { family: 'Inter, sans-serif', size: 13, weight: 'bold' as const },
                callbacks: {
                    label: (context: any) => {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(context.parsed.y) + ' €';
                        }
                        return label;
                    }
                }
            }
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false
        }
    };

    return (
        <div className="w-full flex flex-col font-sans mb-12">
            {/* Editorial Header */}
            <div className="mb-6 flex justify-between items-end border-b border-black pb-2">
                <div>
                    <span className="text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold block mb-1">Análisis Histórico</span>
                    <h3 className="text-[#2C3E50] text-xl font-light tracking-tight">Evolución Comparativa <span className="text-gray-400 text-sm">(Base 10k)</span></h3>
                </div>
                {/* Period Stamp */}
                <span className="text-[#2C3E50] bg-gray-100 px-3 py-1 text-xs font-bold tracking-widest uppercase rounded-sm">10 AÑOS</span>
            </div>

            {/* Content Area */}
            <div className="space-y-6">

                {/* Chart */}
                <div className="h-[400px] w-full relative group">
                    {loading && (
                        <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                            <span className="text-[#A07147] font-bold text-xs uppercase tracking-widest animate-pulse">Cargando Historia...</span>
                        </div>
                    )}
                    {chartData.datasets.length > 0 ? (
                        <Line data={chartData} options={options} />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
                            <div className="text-3xl mb-2">chart_show</div>
                            <span className="text-sm font-light">Seleccione fondos para visualizar su comparativa</span>
                        </div>
                    )}
                </div>

                {/* Legend / Selection */}
                <div className="bg-gray-50 p-4 border border-gray-100 rounded-sm">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fondos Seleccionados</span>
                        <div className="flex gap-4 text-[10px] uppercase font-bold tracking-wider">
                            <button onClick={() => toggleAll(true)} className="text-[#0B2545] hover:text-[#A07147] transition-colors">Ver Todos</button>
                            <button onClick={() => toggleAll(false)} className="text-gray-400 hover:text-red-500 transition-colors">Ocultar</button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                        {funds.map((fund, idx) => {
                            const isSelected = selectedIsins.includes(fund.isin);
                            // Use editorial colors
                            const color = COLORS[idx % COLORS.length];

                            return (
                                <label key={fund.isin} className="flex items-center gap-2 cursor-pointer select-none group transition-opacity hover:opacity-80">
                                    <div
                                        className={`w-3 h-3 rounded-full transition-all duration-300 ${isSelected ? 'scale-100' : 'scale-50 grayscale opacity-50'}`}
                                        style={{ backgroundColor: color }}
                                    ></div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={isSelected}
                                        onChange={() => handleToggleFund(fund.isin)}
                                    />
                                    <span
                                        className={`text-xs transition-colors duration-200 ${isSelected ? 'text-[#2C3E50] font-medium' : 'text-gray-400 line-through'}`}
                                    >
                                        {fund.name}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

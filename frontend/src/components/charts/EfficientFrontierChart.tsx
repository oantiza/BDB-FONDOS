import React from 'react';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    ScatterController,
    LineController
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { ChartData, ChartOptions } from 'chart.js';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, ScatterController, LineController);

interface Point {
    x: number; // Volatility
    y: number; // Return
    label?: string; // Ticker or "Portfolio"
}

interface EfficientFrontierProps {
    frontierPoints: Point[];
    assetPoints: Point[];
    portfolioPoint: Point | null;
    isLoading?: boolean;
}

const EfficientFrontierChart: React.FC<EfficientFrontierProps> = ({
    frontierPoints,
    assetPoints,
    portfolioPoint,
    isLoading = false
}) => {
    // Note: Loading state handled by parent or overlay, keeping this simple.

    // Prepare Datasets
    const data: ChartData = {
        datasets: [
            // 1. Frontier Curve (Explicit Line Type)
            {
                type: 'line' as const,
                label: 'Frontera Eficiente',
                data: frontierPoints,
                borderColor: '#0f172a', // Slate 900
                backgroundColor: 'rgba(0,0,0,0)', // Transparent fill
                borderWidth: 2, // Thinner, more elegant
                pointRadius: 0,
                tension: 0.4, // Smooth curve
                order: 3
            },
            // 2. Individual Assets (Scatter)
            {
                type: 'scatter' as const,
                label: 'Activos Individuales',
                data: assetPoints,
                backgroundColor: '#cbd5e1', // Lighter Slate (Slate 300) for less visual noise
                pointRadius: 5,
                pointHoverRadius: 7,
                order: 2
            },
            // 3. Current Portfolio (Premium Token Style)
            ...(portfolioPoint ? [{
                type: 'scatter' as const,
                label: 'Cartera Actual',
                data: [portfolioPoint],
                backgroundColor: '#D4AF37', // Gold Fill
                borderColor: '#1e293b', // Slate 800 (Softer than 900)
                borderWidth: 2, // Thinner border
                pointRadius: 8, // Smaller radius (was 10)
                pointHoverRadius: 10,
                pointStyle: 'circle', // Clean circle instead of "horrorosa" star
                order: 1
            }] : [])
        ]
    };

    const options: ChartOptions<'scatter'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    font: { family: 'Fira Code, monospace', size: 10 },
                    color: '#64748b'
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleFont: { family: 'Inter, sans-serif', size: 11, weight: 'bold' },
                bodyFont: { family: 'Fira Code, monospace', size: 10 },
                callbacks: {
                    label: (context) => {
                        const raw = context.raw as Point;
                        const label = raw.label || context.dataset.label;
                        return `${label}: Vol ${(raw.x * 100).toFixed(1)}% | Ret ${(raw.y * 100).toFixed(1)}%`;
                    }
                }
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Volatilidad (Riesgo)',
                    font: { family: 'Inter, sans-serif', size: 10, weight: 'bold' },
                    color: '#94a3b8'
                },
                grid: { color: '#f1f5f9' },
                ticks: {
                    font: { family: 'Fira Code, monospace', size: 9 },
                    callback: (value) => `${(Number(value) * 100).toFixed(0)}%`
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Retorno Esperado',
                    font: { family: 'Inter, sans-serif', size: 10, weight: 'bold' },
                    color: '#94a3b8'
                },
                grid: { color: '#f1f5f9' },
                ticks: {
                    font: { family: 'Fira Code, monospace', size: 9 },
                    callback: (value) => `${(Number(value) * 100).toFixed(0)}%`
                }
            }
        }
    };

    return (
        <div className="h-full w-full relative">
            <Chart type='scatter' data={data} options={options} />
        </div>
    );
};

export default EfficientFrontierChart;

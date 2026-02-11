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
    animate?: boolean;
    printMode?: boolean;
}

const EfficientFrontierChart: React.FC<EfficientFrontierProps> = ({
    frontierPoints,
    assetPoints,
    portfolioPoint,
    isLoading = false,
    animate = true,
    printMode = false
}) => {
    // Defines colors based on mode
    const colors = {
        frontierBorder: printMode ? '#000000' : '#0f172a', // Black vs Slate 900
        assetBg: printMode ? '#64748b' : '#cbd5e1', // Darker Slate vs Slate 300
        portfolioBg: '#D4AF37', // Gold stays gold
        portfolioBorder: printMode ? '#000000' : '#1e293b',
        grid: printMode ? '#cbd5e1' : '#f1f5f9', // Darker grid
        text: printMode ? '#000000' : '#94a3b8', // Pure black for print clarity
        textTitle: printMode ? '#000000' : '#94a3b8',
        borderWidth: printMode ? 2.5 : 2
    };

    // Prepare Datasets
    const data: ChartData = {
        datasets: [
            // 1. Frontier Curve (Explicit Line Type)
            {
                type: 'line' as const,
                label: 'Frontera Eficiente',
                data: frontierPoints,
                borderColor: colors.frontierBorder,
                backgroundColor: 'rgba(0,0,0,0)', // Transparent fill
                borderWidth: colors.borderWidth,
                pointRadius: 0,
                tension: 0.4, // Smooth curve
                order: 3
            },
            // 2. Individual Assets (Scatter)
            {
                type: 'scatter' as const,
                label: 'Activos Individuales',
                data: assetPoints,
                backgroundColor: colors.assetBg,
                pointRadius: printMode ? 6 : 5,
                pointHoverRadius: 7,
                order: 2
            },
            // 3. Current Portfolio (Premium Token Style)
            ...(portfolioPoint ? [{
                type: 'scatter' as const,
                label: 'Cartera Actual',
                data: [portfolioPoint],
                backgroundColor: colors.portfolioBg,
                borderColor: colors.portfolioBorder,
                borderWidth: colors.borderWidth,
                pointRadius: printMode ? 8 : 8,
                pointHoverRadius: 10,
                pointStyle: 'circle',
                order: 1
            }] : [])
        ]
    };

    const options: ChartOptions<'scatter'> = {
        responsive: true,
        animation: animate ? {} : false,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    // Increased from 9 to 10 for printMode
                    font: { family: 'Fira Code, monospace', size: printMode ? 11 : 10 },
                    color: colors.text
                }
            },
            tooltip: {
                backgroundColor: '#1e293b',
                // Increased title from 11 to 12
                titleFont: { family: 'Inter, sans-serif', size: 12, weight: 'bold' },
                // Increased body from 10 to 11
                bodyFont: { family: 'Fira Code, monospace', size: 11 },
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
                    // Increased from 10 to 11
                    font: { family: 'Inter, sans-serif', size: 12, weight: 'bold' },
                    color: colors.textTitle
                },
                grid: { color: colors.grid },
                ticks: {
                    // Increased from 9 to 10
                    font: { family: 'Fira Code, monospace', size: 11 },
                    color: colors.text,
                    callback: (value) => `${(Number(value) * 100).toFixed(0)}%`
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Retorno Esperado',
                    // Increased from 10 to 11
                    font: { family: 'Inter, sans-serif', size: 12, weight: 'bold' },
                    color: colors.textTitle
                },
                grid: { color: colors.grid },
                ticks: {
                    // Increased from 9 to 10
                    font: { family: 'Fira Code, monospace', size: 11 },
                    color: colors.text,
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

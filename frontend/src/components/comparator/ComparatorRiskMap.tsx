import React from 'react';
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

interface ComparatorRiskMapProps {
    metricsA: { volatility?: number; cagr?: number };
    metricsB: { volatility?: number; cagr?: number };
    nameA: string;
    nameB: string;
}

export default function ComparatorRiskMap({ metricsA, metricsB, nameA, nameB }: ComparatorRiskMapProps) {
    if (!metricsA || !metricsB) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Esperando datos...</div>;

    const volA = (metricsA.volatility || 0) * 100;
    const retA = (metricsA.cagr || 0) * 100;

    const volB = (metricsB.volatility || 0) * 100;
    const retB = (metricsB.cagr || 0) * 100;

    // Calculate dynamic axis limits with padding
    const maxVol = Math.max(volA, volB) * 1.2 || 15;
    const maxRet = Math.max(retA, retB) * 1.2 || 10;
    const minRet = Math.min(retA, retB, 0) * 1.2;

    const data = {
        datasets: [
            {
                label: nameA,
                data: [{ x: volA, y: retA }],
                backgroundColor: '#1e40af', // Deep Blue (Institutional)
                borderColor: '#ffffff', // White border for "chip" effect
                borderWidth: 3,
                pointRadius: 12, // Larger presence
                pointHoverRadius: 14,
                // Shadow/Glow effect (Chart.js specific)
                shadowBlur: 10,
                shadowColor: 'rgba(30, 64, 175, 0.5)'
            },
            {
                label: nameB,
                data: [{ x: volB, y: retB }],
                backgroundColor: '#d97706', // Metallic Gold
                borderColor: '#ffffff', // White border
                borderWidth: 3,
                pointRadius: 12,
                pointHoverRadius: 14,
                shadowBlur: 10,
                shadowColor: 'rgba(217, 119, 6, 0.5)'
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                title: { display: true, text: 'Riesgo (Volatilidad) %', font: { size: 10, weight: 'bold' as const } },
                grid: { color: '#f1f5f9' },
                ticks: { font: { size: 10 } },
                min: 0,
                max: maxVol
            },
            y: {
                title: { display: true, text: 'Retorno Anual (CAGR) %', font: { size: 10, weight: 'bold' as const } },
                grid: { color: '#f1f5f9' },
                ticks: { font: { size: 10 } },
                min: minRet, // Allow negative
                max: maxRet
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                    font: { size: 11, family: 'Inter' }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#0f172a',
                bodyColor: '#334155',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10,
                callbacks: {
                    label: function (context: any) {
                        const d = context.raw;
                        return `${context.dataset.label}: Vol ${d.x.toFixed(2)}% / Ret ${d.y.toFixed(2)}%`;
                    }
                }
            }
        }
    };

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <Scatter data={data} options={options} />
        </div>
    );
}

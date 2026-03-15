import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DiversificationDonutProps {
    assets: { name: string; value: number }[];
    staticPlot?: boolean;
}

const CUSTOM_PALETTE = [
    '#0B2545', // Navy
    '#C5A059', // Gold
    '#4F46E5', // Indigo
    '#64748B', // Slate
    '#1E3A8A', // Dark Blue
    '#D4AF37', // Gold 2
    '#3B82F6', // Blue 500
    '#94A3B8', // Slate 400
];

export default function DiversificationDonut({ assets, staticPlot = false }: DiversificationDonutProps) {

    // Group small allocations into "Otros" to avoid glitter
    const { labels, values, colors } = useMemo(() => {
        const map: Record<string, number> = {};
        assets.forEach(a => {
            const k = a.name || 'Sin Clasificar';
            map[k] = (map[k] || 0) + a.value;
        });

        // Convert to array and sort
        const sorted = Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // Separate main vs small (Top 8)
        const main = sorted.slice(0, 8);
        const others = sorted.slice(8);
        const otherSum = others.reduce((acc, curr) => acc + curr.value, 0);

        if (otherSum > 1) { // Only show Others if significant (>1%)
            main.push({ name: 'Otros', value: otherSum });
        }

        return {
            labels: main.map(m => m.name.toUpperCase()),
            values: main.map(m => m.value),
            colors: main.map((_, i) => CUSTOM_PALETTE[i % CUSTOM_PALETTE.length])
        };
    }, [assets]);

    const data = {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: colors,
                borderWidth: 0, // Cleaner look
                hoverOffset: 4
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%', // Thinner donut
        plugins: {
            legend: {
                display: !staticPlot, // Hide legend if static (small view)
                position: 'right' as const,
                labels: {
                    boxWidth: 12,
                    font: {
                        size: 10,
                        family: 'Roboto'
                    },
                    color: '#64748b'
                }
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        return ` ${context.label}: ${context.raw.toFixed(2)}%`;
                    }
                }
            }
        },
        animation: {
            animateScale: true,
            animateRotate: true
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center p-2">
            <div className="w-full h-full relative">
                <Doughnut data={data} options={options} />
            </div>
        </div>
    );
}

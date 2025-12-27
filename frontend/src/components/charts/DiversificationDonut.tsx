import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

interface DiversificationDonutProps {
    assets: { name: string; value: number }[];
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

export default function DiversificationDonut({ assets }: DiversificationDonutProps) {

    // Group small allocations into "Otros" to avoid glitter
    const { labels, values, colors } = useMemo(() => {
        // Aggregate by name first (just in case)
        const map: Record<string, number> = {};
        assets.forEach(a => {
            const k = a.name || 'Sin Clasificar';
            map[k] = (map[k] || 0) + a.value;
        });

        // Convert to array and sort
        const sorted = Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // Separate main vs small
        const main = sorted.slice(0, 8); // Top 8
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

    return (
        <div className="w-full h-[400px] flex items-center justify-center">
            {/* Chart Area */}
            <div className="w-full h-full relative">
                <Plot
                    data={[
                        {
                            type: 'pie',
                            values: values,
                            labels: labels,
                            textinfo: 'label+percent', // Show Label + %
                            textposition: 'outside', // Labels outside
                            automargin: true,
                            hole: 0.65, // Thinner Donut for elegance
                            marker: {
                                colors: colors,
                                line: { width: 0 } // No borders for cleaner look
                            },
                            hoverinfo: 'label+percent+value',
                            hoverlabel: {
                                bgcolor: '#2C3E50',
                                font: { color: 'white', family: 'Roboto' }
                            },
                            // Connect lines styling
                            insidetextorientation: 'horizontal'
                        } as any
                    ]}
                    layout={{
                        showlegend: false, // Hide legend (labels are outside)
                        margin: { t: 20, b: 20, l: 40, r: 40 }, // Reduced margins
                        font: { family: 'Roboto, sans-serif', size: 10, color: '#2C3E50' },
                        autosize: true,
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                    }}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false, responsive: true }}
                    useResizeHandler={true}
                />
            </div>
        </div>
    );
}

import React, { useMemo } from 'react';

interface DiversificationBarsProps {
    assets: { name: string; value: number }[];
    animate?: boolean;
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
    '#475569', // Slate 600
    '#0F172A', // Slate 900
];

export default function DiversificationBars({ assets, animate = true }: DiversificationBarsProps) {

    // Logic: Top 10 + Others
    const bars = useMemo(() => {
        // 1. Aggregate by name
        const map: Record<string, number> = {};
        assets.forEach(a => {
            const k = a.name || 'Sin Clasificar';
            map[k] = (map[k] || 0) + a.value;
        });

        // 2. Sort Descending
        const sorted = Object.entries(map)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        // 3. Slice Top 10
        const topCount = 10;
        const main = sorted.slice(0, topCount);
        const others = sorted.slice(topCount);
        const otherSum = others.reduce((acc, curr) => acc + curr.value, 0);

        // 4. Add Others if valid
        if (otherSum > 0.01) { // > 0.01%
            main.push({ name: 'Otros', value: otherSum });
        }

        return main.map((item, index) => {
            // Determine color
            let color = CUSTOM_PALETTE[index % CUSTOM_PALETTE.length];
            if (item.name === 'Otros') color = '#9CA3AF'; // Gray 400 for Others

            return {
                ...item,
                color,
                percent: item.value
            };
        });
    }, [assets]);

    // Check if empty
    if (bars.length === 0) {
        return (
            <div className="w-full text-center text-slate-400 text-sm py-4">
                No hay datos disponibles
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col justify-center px-4 py-2 overflow-hidden">
            <div className="flex flex-col gap-3 w-full">
                {bars.map((bar, idx) => (
                    <div key={idx} className="flex items-center w-full group">
                        {/* 1. Label (Left) */}
                        {/* More space, wrapping allowed */}
                        <div className="w-[220px] text-[15px] font-medium text-slate-700 pr-3 shrink-0 leading-tight" title={bar.name}>
                            {bar.name}
                        </div>

                        {/* 2. Bar Track & Fill */}
                        <div className="flex-grow h-3 bg-slate-100 rounded-full overflow-hidden relative mr-3">
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${Math.min(bar.value, 100)}%`,
                                    backgroundColor: bar.color,
                                    transition: animate ? 'width 0.5s ease-out' : 'none'
                                }}
                            />
                        </div>

                        {/* 3. Percentage (Right) */}
                        <div className="w-[50px] text-right font-bold text-slate-800 text-[15px] tabular-nums shrink-0">
                            {bar.value.toFixed(2)}%
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

import React, { useMemo } from 'react';

interface ComparatorGroupedBarChartProps {
    dataA: { name: string, value: number, label?: string }[];
    dataB: { name: string, value: number, label?: string }[];
    colorA?: string;
    colorB?: string;
    title: string;
    portfolioNameA?: string;
    portfolioNameB?: string;
}

export default function ComparatorGroupedBarChart({
    dataA,
    dataB,
    colorA = "#3b82f6", // blue-500
    colorB = "#f59e0b", // amber-500
    title,
    portfolioNameA = "Cartera A",
    portfolioNameB = "Cartera B"
}: ComparatorGroupedBarChartProps) {

    const { rows, maxValue } = useMemo(() => {
        // 1. Get all unique keys (using 'name' which is the ID)
        const keys = new Set([...dataA.map(d => d.name), ...dataB.map(d => d.name)]);

        // 2. Map data
        let computedRows = Array.from(keys).map(key => {
            const itemA = dataA.find(d => d.name === key);
            const itemB = dataB.find(d => d.name === key);

            const valA = itemA?.value || 0;
            const valB = itemB?.value || 0;

            // Prefer label if available, otherwise use key
            const displayLabel = itemA?.label || itemB?.label || key;

            return {
                name: key,
                label: displayLabel,
                valA,
                valB,
                total: valA + valB
            };
        });

        // 3. Sort by Total Weight (Descending)
        computedRows.sort((a, b) => b.total - a.total);

        // 4. Limit to top 5 items for cleaner vertical fit
        const topRows = computedRows.slice(0, 5);

        // 5. Find Max Value for scaling
        // Increased multiplier to 1.25 to add more "Air" as requested
        const max = Math.max(
            ...topRows.map(r => r.valA),
            ...topRows.map(r => r.valB),
            1
        ) * 1.25;

        return { rows: topRows, maxValue: max };
    }, [dataA, dataB]);

    if (rows.length === 0) return null;

    return (
        <div className="w-full h-full flex flex-col p-2">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</h4>
            </div>

            <div className="flex-1 flex flex-col justify-start space-y-4 overflow-y-auto pr-1">
                {rows.map((row) => (
                    <div key={row.name} className="flex flex-col gap-1.5">
                        {/* Header: Label + Values */}
                        <div className="flex justify-between items-baseline text-xs">
                            <span className="font-semibold text-slate-700 truncate pr-2 max-w-[60%]" title={row.label}>
                                {row.label}
                            </span>
                            <div className="flex gap-2 text-[10px]">
                                <span className="font-mono font-bold text-blue-600 w-10 text-right">{row.valA.toFixed(1)}%</span>
                                <span className="text-slate-300">|</span>
                                <span className="font-mono font-bold text-amber-600 w-10 text-right">{row.valB.toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Visual Bars Container */}
                        <div className="flex flex-col gap-1 w-full pl-2 border-l-2 border-slate-100 py-1">
                            {/* Bar A */}
                            <div className="flex items-center gap-2 h-2">
                                <div className="flex-1 bg-slate-50 rounded-r-full overflow-hidden h-full">
                                    <div
                                        className="h-full rounded-r-full transition-all duration-500 bg-blue-500"
                                        style={{ width: `${(row.valA / maxValue) * 100}%` }}
                                        title={`${portfolioNameA}: ${row.valA.toFixed(1)}%`}
                                    ></div>
                                </div>
                            </div>

                            {/* Bar B */}
                            <div className="flex items-center gap-2 h-2">
                                <div className="flex-1 bg-slate-50 rounded-r-full overflow-hidden h-full">
                                    <div
                                        className="h-full rounded-r-full transition-all duration-500 bg-amber-500"
                                        style={{ width: `${(row.valB / maxValue) * 100}%` }}
                                        title={`${portfolioNameB}: ${row.valB.toFixed(1)}%`}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

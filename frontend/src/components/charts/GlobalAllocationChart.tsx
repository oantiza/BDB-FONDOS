import React from 'react';

interface GlobalAllocationChartProps {
    data: { name: string; value: number }[];
}

const ASSET_COLORS: Record<string, string> = {
    // Equity - Blues
    'Renta Variable': '#0B2545', // Navy
    'Equity': '#0B2545',

    // Fixed Income - Golds
    'Renta Fija': '#C5A059', // Gold
    'Fixed Income': '#C5A059',
    'Bond': '#C5A059',

    // Cash - Grays
    'Efectivo': '#94A3B8', // Slate 400
    'Cash': '#94A3B8',
    'Liquidez': '#94A3B8',

    // Other - Indigo
    'Otros': '#4F46E5', // Indigo
    'Other': '#4F46E5',
    'Alternative': '#4F46E5',
};

const DEFAULT_COLOR = '#64748B'; // Slate 500

export default function GlobalAllocationChart({ data }: GlobalAllocationChartProps) {

    if (!data || data.length === 0) {
        return (
            <div className="w-full text-center text-slate-400 text-sm py-4">
                No hay datos de distribución global.
            </div>
        );
    }

    // Sort by value descending
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    return (
        <div className="w-full flex flex-col justify-center px-4 py-2">
            <div className="flex flex-col gap-3 w-full">
                {sortedData.map((item, idx) => {
                    // Helper to determine color based on keywords
                    const getColor = (name: string): string => {
                        const n = name.toLowerCase();
                        // Equity (RV) - Varied Blues
                        if (n.includes('rv') || n.includes('renta variable') || n.includes('equity') || n.includes('bolsa')) return '#0B2545';

                        // Fixed Income (RF) - Golds/Earth
                        if (n.includes('rf') || n.includes('renta fija') || n.includes('deuda') || n.includes('bond') || n.includes('credit')) return '#C5A059';

                        // Mixed / Multi-asset - Purples/Violets
                        if (n.includes('mixt') || n.includes('mixed') || n.includes('alloc') || n.includes('glob')) return '#7C3AED';

                        // Cash / Money Market - Grays
                        if (n.includes('monetario') || n.includes('liquidez') || n.includes('cash') || n.includes('efectivo')) return '#94A3B8';

                        // Alternative - Rose/Pink
                        if (n.includes('alt') || n.includes('retorno') || n.includes('hedge')) return '#E11D48';

                        // Specific Matches fallbacks
                        const key = Object.keys(ASSET_COLORS).find(k => k.toLowerCase() === n);
                        if (key) return ASSET_COLORS[key];

                        // Fallback to Others color or Default
                        if (n.includes('otros') || n.includes('other')) return ASSET_COLORS['Otros'];

                        return DEFAULT_COLOR;
                    };

                    const color = getColor(item.name);

                    return (
                        <div key={idx} className="flex items-center w-full group">
                            {/* 1. Label */}
                            <div className="w-[180px] text-[15px] font-medium text-slate-700 pr-3 shrink-0 leading-tight flex items-center gap-2" title={item.name}>
                                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }}></div>
                                {item.name}
                            </div>

                            {/* 2. Bar */}
                            <div className="flex-grow h-3 bg-slate-100 rounded-full overflow-hidden relative mr-3">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${Math.min(item.value, 100)}%`,
                                        backgroundColor: color,
                                        transition: 'width 0.5s ease-out'
                                    }}
                                />
                            </div>

                            {/* 3. Percentage */}
                            <div className="w-[60px] text-right shrink-0 flex flex-col items-end justify-center">
                                <span className="font-bold text-slate-800 text-[15px] tabular-nums">
                                    {item.value.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

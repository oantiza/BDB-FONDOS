import React from 'react';

interface EquityRegionChartProps {
    data: { name: string; value: number; absoluteValue?: number }[];
}

const REGION_COLORS: Record<string, string> = {
    // Americas (Blues)
    'united_states': '#3B82F6', // Blue 500
    'canada': '#60A5FA', // Blue 400
    'latin_america': '#1E40AF', // Blue 800
    'americas': '#2563EB', // Blue 600

    // Europe (Greens/Teals)
    'eurozone': '#10B981', // Emerald 500
    'europe_ex_euro': '#059669', // Emerald 600
    'united_kingdom': '#34D399', // Emerald 400
    'europe_emerging': '#065F46', // Emerald 800
    'europe': '#10B981',

    // Asia/Emerging (Oranges/Yellows)
    'asia_developed': '#F59E0B', // Amber 500
    'asia_emerging': '#D97706', // Amber 600
    'japan': '#FBBF24', // Amber 400
    'australasia': '#FCD34D', // Amber 300
    'pacific': '#F59E0B',
    'middle_east': '#B45309', // Amber 700
    'africa': '#92400E', // Amber 800
    'emerging_markets': '#EA580C', // Orange 600
};

const DEFAULT_COLOR = '#9CA3AF'; // Gray 400

const LABELS_MAP: Record<string, string> = {
    'united_states': 'Estados Unidos',
    'canada': 'Canadá',
    'latin_america': 'Latinoamérica',
    'united_kingdom': 'Reino Unido',
    'eurozone': 'Eurozona',
    'europe_ex_euro': 'Europa (No Euro)',
    'europe_emerging': 'Europa Emergente',
    'africa': 'África',
    'middle_east': 'Oriente Medio',
    'japan': 'Japón',
    'australasia': 'Australasia',
    'asia_developed': 'Asia Desarrollada',
    'asia_emerging': 'Asia Emergente'
};

export default function EquityRegionChart({ data }: EquityRegionChartProps) {

    if (!data || data.length === 0) {
        return (
            <div className="w-full text-center text-slate-400 text-sm py-4">
                No hay desglose regional disponible para los fondos de RV.
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col justify-center px-4 py-2">
            <div className="flex flex-col gap-3 w-full">
                {data.map((item, idx) => {
                    const color = REGION_COLORS[item.name] || DEFAULT_COLOR;
                    const label = LABELS_MAP[item.name] || item.name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

                    return (
                        <div key={idx} className="flex items-center w-full group">
                            {/* 1. Label */}
                            <div className="w-[180px] text-[15px] font-medium text-slate-700 pr-3 shrink-0 leading-tight" title={item.name}>
                                {label}
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
                                {item.absoluteValue !== undefined && (
                                    <span className="text-[10px] text-slate-400 leading-none">
                                        ({item.absoluteValue.toFixed(1)}% abs)
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 flex gap-4 justify-center text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> América</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Europa</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Asia/Emerg</div>
            </div>
        </div>
    );
}

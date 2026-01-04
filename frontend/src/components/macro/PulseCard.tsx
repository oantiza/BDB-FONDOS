import React from 'react';

// Iconos simples locales
const TrendingUp = () => <span className="text-green-500">↗</span>;
const TrendingDown = () => <span className="text-red-500">↘</span>;
const TrendingFlat = () => <span className="text-gray-400">→</span>;

import { Sentiment } from '../../types/MacroReport';

interface PulseCardProps {
    title: string;
    data: {
        focus: string;
        note?: string;
        trend: Sentiment;
    };
}

export const PulseCard: React.FC<PulseCardProps> = ({ title, data }) => {
    if (!data) return null;

    const isBullish = data.trend === 'BULLISH' || data.trend === 'ALCISTA';
    const isBearish = data.trend === 'BEARISH' || data.trend === 'BAJISTA';

    const trendColor = isBullish ? 'text-green-600' : isBearish ? 'text-red-600' : 'text-slate-400';

    return (
        // Clean Minimalist Card
        <div className="bg-white p-6 border border-[#eeeeee] flex flex-col justify-between h-full hover:border-slate-300 transition-colors">
            <div>
                <h4 className="text-[10px] font-bold text-[#A07147] uppercase tracking-[0.2em] mb-3">{title}</h4>
                <div className="text-2xl font-light text-[#2C3E50] mb-2 tracking-tight">{data.focus}</div>
                <p className="text-sm text-[#7f8c8d] leading-snug">{data.note}</p>
            </div>
            <div className={`mt-4 pt-4 border-t border-[#f5f5f5] text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${trendColor}`}>
                {isBullish ? <><TrendingUp /> Alcista</> : isBearish ? <><TrendingDown /> Bajista</> : <><TrendingFlat /> Neutral</>}
            </div>
        </div>
    );
}

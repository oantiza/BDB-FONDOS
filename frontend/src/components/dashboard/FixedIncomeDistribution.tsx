import { Clock, Calendar } from 'lucide-react'

export default function FixedIncomeDistribution({ portfolio = [] }: { portfolio?: any[] }) {
    const analytics = (() => {
        if (!portfolio.length) return {
            rf_sectors: [] as any[],
            duration: '-', maturity: '-'
        };

        const rfMap: Record<string, number> = {};
        let totalRfWeight = 0;
        let wDuration = 0;
        let wMaturity = 0;
        let totalDurWeight = 0;

        portfolio.forEach((p: any) => {
            const w = p.weight;
            const hasMetrics = p.std_extra?.duration > 0 || p.std_extra?.effective_maturity > 0;
            const type = (p.classification_v2?.asset_type || '').toUpperCase();
            const isRfLike = type === 'FIXED_INCOME' || type === 'MONEY_MARKET' || type === 'MIXED';

            const rawD = p.std_extra?.duration;
            const d = (typeof rawD === 'number' ? rawD : parseFloat(String(rawD || 0)));
            const rawM = p.std_extra?.effective_maturity;
            const m = (typeof rawM === 'number' ? rawM : parseFloat(String(rawM || (d > 0 ? d * 1.2 : 0))));

            if (d >= 0) {
                wDuration += d * w;
                wMaturity += m * w;
                totalDurWeight += w;
            }

            if (isRfLike || hasMetrics) {
                totalRfWeight += w;
                const cat = (p.classification_v2?.asset_subtype || '').toLowerCase();
                const name = (p.name || '').toLowerCase();
                const text = cat + ' ' + name;

                let label = 'Global / Otros';

                if (text.includes('monetario') || text.includes('money') || text.includes('cash') || text.includes('liqui') || text.includes('corto plazo') || text.includes('short term')) label = 'Liquidez';
                else if (text.includes('emerg') || text.includes('asia') || text.includes('latam')) label = 'Emergentes';
                else if (text.includes('high yield') || text.includes('hy ') || text.includes('alto rend')) label = 'High Yield';
                else if (text.includes('gov') || text.includes('gob') || text.includes('public') || text.includes('públi') || text.includes('tesoro') || text.includes('soberano') || text.includes('govies')) label = 'Gobierno';
                else if (text.includes('corp') || text.includes('credit') || text.includes('crédito') || text.includes('ig ') || text.includes('investment grade') || text.includes('financial')) label = 'Corporativo';
                else if (text.includes('flex') || text.includes('absolut') || text.includes('estrat') || text.includes('strat') || text.includes('mixt') || text.includes('total return')) label = 'Flexible';
                else if (text.includes('bonos') || text.includes('renta fija')) label = 'Global / Otros';

                rfMap[label] = (rfMap[label] || 0) + w;
            }
        });

        const sortedRf = Object.entries(rfMap)
            .map(([l, v]) => ({ l, v: Math.round((v / (totalRfWeight || 1)) * 100) }))
            .sort((a, b) => b.v - a.v);

        const dur = totalDurWeight > 0 ? (wDuration / totalDurWeight).toFixed(2) : '-';
        const mat = totalDurWeight > 0 ? (wMaturity / totalDurWeight).toFixed(2) : '-';

        return { rf_sectors: sortedRf, duration: dur, maturity: mat };
    })();

    return (
        <div className="flex flex-col h-full overflow-hidden w-full px-2">
            {/* Premium Header */}
            <div className="pb-3 border-b border-slate-100/80 flex items-center gap-2.5 shrink-0 mb-4">
                <div className="relative w-6 h-6 rounded-md bg-gradient-to-br from-blue-50 to-teal-50 flex items-center justify-center shadow-[inset_0_1px_rgba(255,255,255,1),0_2px_4px_rgba(0,0,0,0.02)] border border-slate-200/50">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-3.5 h-3.5 text-blue-600">
                        <defs>
                            <linearGradient id="barGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#2563EB" />
                                <stop offset="100%" stopColor="#0D9488" />
                            </linearGradient>
                        </defs>
                        <path stroke="url(#barGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    {/* Tiny light particle effect */}
                    <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-teal-300 blur-[1px]" />
                </div>
                <h3 className="text-[12px] font-extrabold text-[#0B2545] uppercase tracking-[0.18em]">
                    Renta Fija
                </h3>
            </div>

            <div className="flex-1 flex items-center justify-center w-full relative">
                <div className="flex items-center justify-between w-full max-w-[280px]">
                    
                    {/* Left Pod: Duración */}
                    <div className="relative flex flex-col items-center justify-between bg-slate-50/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.03),0_1px_2px_rgba(255,255,255,0.8)] border border-slate-200/60 rounded-[1.25rem] p-3 w-[115px] h-[130px] backdrop-blur-sm group hover:bg-slate-50 transition-colors">
                        {/* Soft highlight edge */}
                        <div className="absolute inset-0 rounded-[1.25rem] shadow-[inset_0_1px_1px_rgba(255,255,255,1)] pointer-events-none" />
                        
                        <div className="flex flex-col items-center gap-1 z-10 mt-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Duración Y</span>
                            {/* Glowing Hourglass Icon */}
                            <div className="relative">
                                <Clock className="w-4 h-4 text-blue-500 drop-shadow-[0_0_4px_rgba(59,130,246,0.6)]" strokeWidth={2} />
                            </div>
                        </div>

                        {/* Circular Progress Ring with Value */}
                        <div className="relative w-[52px] h-[52px] flex items-center justify-center z-10 mb-1">
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                <circle cx="26" cy="26" r="22" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-200" />
                                <circle cx="26" cy="26" r="22" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray="138" strokeDashoffset={138 - (138 * 0.60)} className="text-blue-500 transition-all duration-1000 ease-out drop-shadow-[0_0_2px_rgba(59,130,246,0.4)]" />
                            </svg>
                            <div className="flex flex-col items-center justify-center">
                                <span className="text-[14px] font-bold text-[#0B2545] font-sans tabular-nums leading-none tracking-tight">{analytics.duration}</span>
                            </div>
                        </div>
                    </div>

                    {/* Glowing vertical line */}
                    <div className="relative h-20 w-px shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-200 to-transparent shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                    </div>

                    {/* Right Pod: Vencimiento */}
                    <div className="relative flex flex-col items-center justify-between bg-slate-50/80 shadow-[inset_0_2px_8px_rgba(0,0,0,0.03),0_1px_2px_rgba(255,255,255,0.8)] border border-slate-200/60 rounded-[1.25rem] p-3 w-[115px] h-[130px] backdrop-blur-sm group hover:bg-slate-50 transition-colors">
                        {/* Soft highlight edge */}
                        <div className="absolute inset-0 rounded-[1.25rem] shadow-[inset_0_1px_1px_rgba(255,255,255,1)] pointer-events-none" />
                        
                        <div className="flex flex-col items-center gap-1 z-10 mt-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Vto (Y)</span>
                            {/* Glowing Calendar Icon */}
                            <div className="relative">
                                <Calendar className="w-4 h-4 text-teal-500 drop-shadow-[0_0_4px_rgba(20,184,166,0.6)]" strokeWidth={2} />
                                {/* Small push-pin dot inside calendar */}
                                <div className="absolute top-[4px] right-[4px] w-1 h-1 bg-teal-400 rounded-full shadow-[0_0_2px_rgba(20,184,166,0.8)]" />
                            </div>
                        </div>

                        {/* Circular Progress Ring with Value */}
                        <div className="relative w-[52px] h-[52px] flex items-center justify-center z-10 mb-1">
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                <circle cx="26" cy="26" r="22" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-200" />
                                <circle cx="26" cy="26" r="22" stroke="currentColor" strokeWidth="3" fill="transparent" strokeDasharray="138" strokeDashoffset={138 - (138 * 0.75)} className="text-teal-500 transition-all duration-1000 ease-out drop-shadow-[0_0_2px_rgba(20,184,166,0.4)]" />
                            </svg>
                            <div className="flex flex-col items-center justify-center">
                                <span className="text-[14px] font-bold text-[#0B2545] font-sans tabular-nums leading-none tracking-tight">{analytics.maturity}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

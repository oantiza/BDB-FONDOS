
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
            const type = (p.std_type || '').toUpperCase();
            const isRfLike = type.includes('RF') || type.includes('FIXED') || type.includes('LIQUI') || type.includes('MONETARIO') || type.includes('MIXTO');

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
                const cat = (p.std_extra?.category || '').toLowerCase();
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

    const DONUT_COLORS: Record<string, string> = {
        'Flexible': '#0F172A',      // Navy muy oscuro
        'Corporativo': '#2563EB',   // Azul intenso
        'Gobierno': '#059669',      // Verde Esmeralda
        'High Yield': '#DC2626',    // Rojo Intenso
        'Emergentes': '#D97706',    // Naranja/Ámbar
        'Liquidez': '#64748B',      // Slate
        'Global / Otros': '#7C3AED', // Púrpura
        'Diversos': '#94A3B8'
    };

    const donutSegments = (() => {
        if (analytics.rf_sectors.length === 0) return 'conic-gradient(#e2e8f0 0% 100%)';
        let acc = 0;
        const parts: string[] = [];
        analytics.rf_sectors.forEach((s) => {
            const color = DONUT_COLORS[s.l] || '#64748B';
            parts.push(`${color} ${acc}% ${acc + s.v}%`);
            acc += s.v;
        });
        return `conic-gradient(${parts.join(', ')})`;
    })();

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white">
            {/* Header */}
            <div className="pb-8 flex items-center gap-1.5 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-amber-700 opacity-60">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                <h3 className="text-sm font-bold text-[#0B2545] uppercase tracking-[0.15em]">
                    Renta Fija
                </h3>
            </div>

            <div className="flex-1 flex flex-col gap-8 overflow-y-auto scrollbar-thin">
                {/* KPIs Row - Height matched with EquityDistribution middle row */}
                <div className="grid grid-cols-2 gap-2 h-[65px] shrink-0">
                    <div className="bg-slate-50/80 border border-slate-100 px-2 py-0.5 rounded-lg text-center flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center justify-center gap-1 mb-0.5">
                            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Duración (Y)
                        </span>
                        <div className="text-base font-bold text-[#0B2545] leading-none">{analytics.duration}</div>
                    </div>
                    <div className="bg-slate-50/80 border border-slate-100 px-2 py-0.5 rounded-lg text-center flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center justify-center gap-1 mb-0.5">
                            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            Vencimiento (Y)
                        </span>
                        <div className="text-base font-bold text-[#0B2545] leading-none">{analytics.maturity}</div>
                    </div>
                </div>

                {/* Donut + Legend */}
                <div className="flex flex-col gap-4">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Distribución</span>
                    {analytics.rf_sectors.length > 0 ? (
                        <div className="flex items-center gap-4">
                            <div className="relative w-[110px] h-[110px] rounded-full flex items-center justify-center shrink-0 border border-slate-50 shadow-sm" style={{ background: donutSegments }}>
                                <div className="absolute w-[86px] h-[86px] bg-white rounded-full flex items-center justify-center">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">RF</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                                {analytics.rf_sectors.map((sec, i) => {
                                    const color = DONUT_COLORS[sec.l] || '#64748B';
                                    return (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                                            <span className="uppercase tracking-wider text-[10px] font-bold text-slate-600 truncate flex-1">{sec.l}</span>
                                            <span className="font-bold text-xs text-[#0B2545] tabular-nums">{sec.v}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <span className="text-[11px] text-slate-400 italic text-center py-2">Sin datos RF</span>
                    )}
                </div>
            </div>
        </div>
    );
}

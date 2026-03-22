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
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header (Twin of EquityDistribution) */}
            <div className="pb-4 border-b border-slate-100 flex items-center gap-2 shrink-0 mb-6">
                <div className="w-5 h-5 rounded bg-blue-50/50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-blue-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                </div>
                <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
                    Renta Fija
                </h3>
            </div>

            <div className="flex-1 flex flex-col justify-center pl-1">
                <div className="flex items-center gap-8">
                    {/* Duración */}
                    <div className="flex flex-col bg-slate-50 border border-slate-100/60 rounded-lg p-2.5 min-w-[90px] hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                            <Clock className="w-3.5 h-3.5" strokeWidth={2.5} />
                            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5">Duración</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-[#0B2545] tabular-nums leading-none">{analytics.duration}</span>
                            <span className="text-[10px] font-medium text-slate-400 uppercase">Y</span>
                        </div>
                    </div>

                    <div className="w-px h-8 bg-slate-200/60 rounded-full mx-1" />

                    {/* Vencimiento */}
                    <div className="flex flex-col bg-slate-50 border border-slate-100/60 rounded-lg p-2.5 min-w-[90px] hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                            <Calendar className="w-3.5 h-3.5" strokeWidth={2.5} />
                            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5">Vto</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold text-[#0B2545] tabular-nums leading-none">{analytics.maturity}</span>
                            <span className="text-[10px] font-medium text-slate-400 uppercase">Y</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


const MetricSimple = ({ label, value, color }: any) => (
    <div className="flex flex-col p-1.5 bg-slate-50 border border-slate-100 rounded">
        <span className="text-[10px] font-black text-slate-400 uppercase">{label}</span>
        <span className={`text-[12px] font-mono font-black ${color}`}>{value}</span>
    </div>
);

export default function FixedIncomeDistribution({ portfolio = [] }: any) {
    const analytics = (() => {
        if (!portfolio.length) return {
            rf_sectors: [],
            duration: '-', maturity: '-', credit: '-'
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

            // Always aggregate Duration/Maturity if present
            const d = parseFloat(p.std_extra?.duration || 0);
            const m = parseFloat(p.std_extra?.effective_maturity || (d > 0 ? d * 1.2 : 0));

            if (d > 0) {
                wDuration += d * w;
                wMaturity += m * w;
                totalDurWeight += w;
            }

            // For Distribution
            if (isRfLike || hasMetrics) {
                totalRfWeight += w;
                const cat = (p.std_extra?.category || '').toLowerCase();
                const name = (p.name || '').toLowerCase();
                const text = cat + ' ' + name; // Search in both for better hits

                let label = 'Diversos';

                // Priority Order Matters
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

        return {
            rf_sectors: sortedRf,
            duration: dur,
            maturity: mat
        };
    })();

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white">
            <div className="p-2 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h3 className="font-sans font-bold text-[#0B2545] text-[10px] uppercase tracking-wider flex items-center gap-2">
                    <span className="text-sm">🏛️</span> Renta Fija
                </h3>
            </div>

            <div className="flex-1 p-3 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2">
                    <MetricSimple label="Duración (Y)" value={analytics.duration} color="text-indigo-600" />
                    <MetricSimple label="Vencimiento (Y)" value={analytics.maturity} color="text-blue-600" />
                </div>

                {/* Breakdown */}
                <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase px-1">Distribución</span>
                    <div className="flex flex-col gap-1.5">
                        {analytics.rf_sectors.map((sec: any, i: number) => (
                            <div key={i} className="flex flex-col gap-0.5">
                                <div className="flex justify-between text-[11px] font-black text-slate-600 uppercase tracking-tighter">
                                    <span>{sec.l}</span><span>{sec.v}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${sec.v}%` }} />
                                </div>
                            </div>
                        ))}
                        {analytics.rf_sectors.length === 0 && (
                            <span className="text-[10px] text-slate-400 italic text-center py-2">Sin datos RF</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

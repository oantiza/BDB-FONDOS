import { useMemo } from 'react';

export default function StyleAnalytics({ portfolio = [] }) {
    const analytics = useMemo(() => {
        if (!portfolio.length) return {
            style: 'Blend', cap: 'Large', currency: 'EUR', esg: 'A', duration: '0.0',
            sectors: [], rf_sectors: [],
            equity_groups: { Cyclical: 0, Sensitive: 0, Defensive: 0 },
            credit_quality: 'N/A', maturity: 'N/A'
        };

        // 1. Estilo y Cap
        const dominantCategory = portfolio[0]?.std_extra?.category || '';
        let style = 'Blend';
        let cap = 'Large';
        if (dominantCategory.includes('Value')) style = 'Value';
        if (dominantCategory.includes('Growth')) style = 'Growth';
        if (dominantCategory.includes('Small')) cap = 'Small';
        if (dominantCategory.includes('Mid')) cap = 'Mid';

        // 2. Divisa
        const isins = portfolio.map((p: any) => p.isin);
        const hasUs = isins.some((i: string) => i.startsWith('US'));
        const hasLu = isins.some((i: string) => i.startsWith('LU'));
        const currency = hasUs ? 'USD' : (hasLu ? 'EUR' : 'EUR');

        // 3. ESG Rating
        const avgScore = portfolio.reduce((acc: number, p: any) => acc + (p.score || 70) * (p.weight / 100), 0);
        const esg = avgScore > 85 ? 'AAA' : avgScore > 75 ? 'AA' : avgScore > 65 ? 'A' : 'BBB';

        // 4. Fixed Income Metrics (Duration, Credit, Maturity)
        let totalDurWeight = 0;
        let wDuration = 0;
        let wMaturity = 0;
        let totalMatWeight = 0;
        // Credit Quality Map: High (AAA-A), Med (BBB), Low (BB-C)
        let creditScore = 0; // Simple internal score: High=3, Med=2, Low=1
        let totalCreditWeight = 0;

        portfolio.forEach((p: any) => {
            const w = p.weight / 100;
            // Duration
            const d = p.std_extra?.duration || 0;
            if (d > 0) {
                wDuration += d * w;
                totalDurWeight += w;
            }

            // Maturity (Assuming field effective_maturity or similar exists, fallback to duration + 1)
            const m = p.std_extra?.effective_maturity || (d > 0 ? d * 1.2 : 0);
            if (m > 0) {
                wMaturity += m * w;
                totalMatWeight += w;
            }

            // Credit Quality (Mock/Heuristic based on Category/Name if missing)
            // Ideally check p.std_extra?.credit_quality (e.g. "AA", "BB")
            // This is a placeholder logic as exact field is unverified
            const cq = p.std_extra?.credit_quality || 'BBB';
            let score = 2;
            if (['AAA', 'AA', 'A'].some(x => cq.includes(x))) score = 3;
            else if (['BB', 'B', 'CCC'].some(x => cq.includes(x)) || cq.includes('High Yield')) score = 1;

            if (p.std_type === 'RF' || p.std_type === 'Fixed Income') {
                creditScore += score * w;
                totalCreditWeight += w;
            }
        });

        const finalDuration = totalDurWeight > 0 ? (wDuration / totalDurWeight).toFixed(1) : '-';
        const finalMaturity = totalMatWeight > 0 ? (wMaturity / totalMatWeight).toFixed(1) : '-';

        const finalCreditScore = totalCreditWeight > 0 ? (creditScore / totalCreditWeight) : 0;
        let finalCredit = 'N/A';
        if (finalCreditScore > 2.5) finalCredit = 'High (IG)';
        else if (finalCreditScore > 1.5) finalCredit = 'Med (BBB)';
        else if (finalCreditScore > 0) finalCredit = 'Low (HY)';


        // 5. Sectores REALES (RV) + Super Sectors
        const sectorMap: Record<string, number> = {};
        const groupMap = { Cyclical: 0, Sensitive: 0, Defensive: 0 };
        let totalRvWeight = 0;

        // Morningstar Super Sector Mappings
        const cyclical = ['Basic Materials', 'Consumer Cyclical', 'Financial Services', 'Real Estate'];
        const sensitive = ['Communication Services', 'Energy', 'Industrials', 'Technology'];
        const defensive = ['Consumer Defensive', 'Healthcare', 'Utilities'];

        portfolio.forEach((p: any) => {
            if (p.std_type === 'RV' || p.std_type === 'Equity' || p.std_type === 'Mixto') {
                const w = p.weight;
                totalRvWeight += w;
                if (p.sectors && Array.isArray(p.sectors) && p.sectors.length > 0) {
                    p.sectors.forEach((s: any) => {
                        const sName = s.name || s.sector;
                        const sWeight = (s.weight / 100) * w;
                        sectorMap[sName] = (sectorMap[sName] || 0) + sWeight;

                        // Map to Super Sector
                        if (cyclical.some(x => sName.includes(x))) groupMap.Cyclical += sWeight;
                        else if (defensive.some(x => sName.includes(x))) groupMap.Defensive += sWeight;
                        else groupMap.Sensitive += sWeight; // Default to sensitive or check explicitly
                    });
                } else {
                    sectorMap['General'] = (sectorMap['General'] || 0) + w;
                    groupMap.Sensitive += w; // Fallback
                }
            }
        });

        // Normalize Groups
        const totalGroups = groupMap.Cyclical + groupMap.Sensitive + groupMap.Defensive;
        if (totalGroups > 0) {
            groupMap.Cyclical = Math.round((groupMap.Cyclical / totalGroups) * 100);
            groupMap.Sensitive = Math.round((groupMap.Sensitive / totalGroups) * 100);
            groupMap.Defensive = Math.round((groupMap.Defensive / totalGroups) * 100);
        }

        const sortedSectors = Object.entries(sectorMap)
            .map(([l, v]) => ({ l: l.substring(0, 10), v: Math.round((v / (totalRvWeight || 1)) * 100) }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 4);


        // 6. Tipo RF REAL (Based on Category)
        const rfMap: Record<string, number> = {};
        let totalRfWeight = 0;

        portfolio.forEach((p: any) => {
            if (p.std_type === 'RF' || p.std_type === 'Fixed Income' || p.std_type === 'Monetario') {
                const w = p.weight;
                totalRfWeight += w;
                const cat = (p.std_extra?.category || '').toLowerCase();
                let label = 'Diversos';

                if (cat.includes('gov') || cat.includes('public')) label = 'Gobierno';
                else if (cat.includes('corp') || cat.includes('credit')) label = 'Corporativo';
                else if (cat.includes('high yield')) label = 'High Yield';
                else if (cat.includes('emerg')) label = 'Emergentes';
                else if (cat.includes('money') || cat.includes('monetario') || cat.includes('cash')) label = 'Liquidez';

                rfMap[label] = (rfMap[label] || 0) + w;
            }
        });

        const sortedRf = Object.entries(rfMap)
            .map(([l, v]) => ({ l, v: Math.round((v / (totalRfWeight || 1)) * 100) }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 4);

        return {
            style, cap, currency, esg,
            duration: finalDuration,
            maturity: finalMaturity,
            credit_quality: finalCredit,
            sectors: sortedSectors,
            rf_sectors: sortedRf,
            equity_groups: groupMap
        };
    }, [portfolio]);

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center z-10 shrink-0">
                <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">🧩</span> Estructura y Estilo
                </h3>
            </div>

            <div className="flex-1 grid grid-cols-[130px_1fr_120px] gap-4 p-4 items-center overflow-hidden">
                {/* 1. EQUITY STYLE BOX */}
                <div className="flex flex-col justify-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase mb-3 text-center pr-3">Equity Style</span>
                    <div className="relative">
                        <div className="flex justify-between pl-6 pr-0.5 mb-1 text-[9px] font-black text-slate-500">
                            <span>VAL</span><span>BLN</span><span>GRW</span>
                        </div>
                        <div className="flex">
                            <div className="flex flex-col justify-between py-2 mr-1.5 text-[9px] font-black text-slate-500 h-24">
                                <span>LRG</span><span>MID</span><span>SML</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1 w-24 h-24">
                                {['Value', 'Blend', 'Growth'].map(s => (
                                    <div key={s} className="flex flex-col gap-1">
                                        {['Large', 'Mid', 'Small'].map(c => {
                                            const isActive = analytics.style === s && analytics.cap === c;
                                            return (
                                                <div key={`${s}-${c}`} className={`aspect-square rounded-sm border transition-all duration-700 ${isActive ? 'bg-indigo-700 border-indigo-900 shadow-sm scale-110 z-10' : 'bg-slate-100/50 border-slate-200'}`} title={`${c} ${s}`} />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. CENTER: DISTRIBUTIONS (Equity Sectors + Fixed Income Type) */}
                <div className="flex flex-col gap-4 border-x border-slate-100 px-4 h-full overflow-y-auto scrollbar-thin py-1">

                    {/* Equity Super Sectors */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-indigo-800/70 uppercase text-center border-b border-indigo-100 pb-1">Sectores RV (Estilo)</span>
                        <div className="flex flex-col gap-1.5">
                            <SuperSectorBar label="Cíclico" value={analytics.equity_groups.Cyclical} color="text-amber-600" bg="bg-amber-500" />
                            <SuperSectorBar label="Sensible" value={analytics.equity_groups.Sensitive} color="text-blue-600" bg="bg-blue-500" />
                            <SuperSectorBar label="Defensivo" value={analytics.equity_groups.Defensive} color="text-emerald-600" bg="bg-emerald-500" />
                        </div>
                    </div>

                    {/* Specific Sectors Breakdown (Added by request) */}
                    {analytics.sectors.length > 0 && (
                        <div className="flex flex-col gap-2 mt-1">
                            <span className="text-[10px] font-black text-indigo-800/50 uppercase text-center border-b border-indigo-50 pb-1">Desglose Top Sectores</span>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                {analytics.sectors.slice(0, 6).map((sec: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-[9px] bg-slate-50 px-1.5 py-1 rounded">
                                        <span className="truncate max-w-[50px] text-slate-600 font-bold" title={sec.l}>{sec.l}</span>
                                        <span className="font-mono text-indigo-600 font-bold">{sec.v}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* RF Type */}
                    <div className="flex flex-col gap-2 mt-2">
                        <span className="text-[10px] font-black text-emerald-800/70 uppercase text-center border-b border-emerald-100 pb-1">Tipo Renta Fija</span>
                        <div className="flex flex-col gap-1.5">
                            {((analytics as any).rf_sectors || []).map((sec: any, i: number) => (
                                <div key={i} className="flex flex-col gap-0.5">
                                    <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-tight">
                                        <span>{sec.l}</span><span>{sec.v}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${sec.v}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 3. RIGHT COL: METRICS (Fixed Income Focus) */}
                <div className="flex flex-col gap-3 py-1 justify-center">
                    <MetricBox label="Divisa" value={analytics.currency} color="slate" />
                    <MetricBox label="ESG Rating" value={analytics.esg} color="emerald" />

                    <div className="h-px bg-slate-100 my-1"></div>

                    <span className="text-[10px] font-black text-emerald-800/50 uppercase text-center">Renta Fija</span>
                    <MetricBox label="Duración" value={analytics.duration + 'y'} color="indigo" />
                    <MetricBox label="Vencimiento" value={analytics.maturity + 'y'} color="blue" />
                    <MetricBox label="Calidad" value={analytics.credit_quality} color="slate" />
                </div>
            </div>
        </div>
    );
}

const MetricBox = ({ label, value, color }: any) => (
    <div className={`flex flex-col border-l-2 pl-3 ${color === 'emerald' ? 'border-emerald-500' : color === 'indigo' ? 'border-indigo-500' : 'border-slate-400'}`}>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{label}</span>
        <span className={`font-mono font-black text-[12px] ${color === 'emerald' ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</span>
    </div>
);

const SuperSectorBar = ({ label, value, color, bg }: any) => (
    <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-tight">
            <span className={color}>{label}</span>
            <span>{value}%</span>
        </div>
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${bg} rounded-full`} style={{ width: `${value}%` }} />
        </div>
    </div>
);

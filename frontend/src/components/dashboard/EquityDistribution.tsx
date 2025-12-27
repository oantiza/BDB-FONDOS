
const SuperSectorBar = ({ label, value, color, bg }: any) => (
    <div className="flex flex-col gap-0.5">
        <div className="flex justify-between text-[11px] font-black text-slate-600 uppercase tracking-tighter">
            <span className={color}>{label}</span>
            <span>{value}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${bg} rounded-full transition-all duration-1000`} style={{ width: `${value}%` }} />
        </div>
    </div>
);

export default function EquityDistribution({ portfolio = [] }: any) {
    const analytics = (() => {
        if (!portfolio.length) return { sectors: [], groups: { Cyclical: 0, Sensitive: 0, Defensive: 0 } };

        const sectorMap: Record<string, number> = {};
        const groupMap: any = { Cyclical: 0, Sensitive: 0, Defensive: 0 };
        let totalRvWeight = 0;

        // DEFINITIONS (Lowercase for matching)
        // Cyclical: Basic Materials, Consumer Cyclical, Financial Services, Real Estate
        const cyclical = ['basic material', 'consumer cyclical', 'financial', 'real estate', 'materials', 'bancos', 'inmobiliario'];

        // Defensive: Consumer Defensive, Healthcare, Utilities
        const defensive = ['consumer defensive', 'healthcare', 'utilities', 'salud', 'consumo defensivo', 'utili'];

        // Sensitive (Everything else, effectively): Communication Services, Energy, Industrials, Technology
        // We explicitly check for them to be sure, otherwise they fall to Sensitive anyway.
        // const sensitive = ['communication', 'energy', 'industrial', 'technology', 'techno'];

        portfolio.forEach((p: any) => {
            if (p.sectors && Array.isArray(p.sectors) && p.sectors.length > 0) {
                p.sectors.forEach((s: any) => {
                    const sName = (s.name || s.sector || '').toLowerCase(); // Force lowercase
                    const w = (s.weight / 100) * p.weight;

                    // Display Name (capitalize first letter)
                    const dispName = sName.charAt(0).toUpperCase() + sName.slice(1);
                    sectorMap[dispName] = (sectorMap[dispName] || 0) + w;
                    totalRvWeight += w;

                    // CLASSIFICATION LOGIC
                    if (cyclical.some(x => sName.includes(x))) {
                        groupMap.Cyclical += w;
                    } else if (defensive.some(x => sName.includes(x))) {
                        groupMap.Defensive += w;
                    } else {
                        // Default to Sensitive (Tech, Comm, Energy, Industrials)
                        groupMap.Sensitive += w;
                    }
                });
            }
        });

        // Normalize Groups
        const totalGroups = groupMap.Cyclical + groupMap.Sensitive + groupMap.Defensive;
        if (totalGroups > 0) {
            groupMap.Cyclical = Math.round((groupMap.Cyclical / totalGroups) * 100);
            groupMap.Sensitive = Math.round((groupMap.Sensitive / totalGroups) * 100);
            groupMap.Defensive = Math.round((groupMap.Defensive / totalGroups) * 100);
        }

        // Specific Sectors (Top 6)
        const sortedSectors = Object.entries(sectorMap)
            .map(([l, v]) => ({ l: l.substring(0, 18), v: Math.round((v / (totalRvWeight || 1)) * 100) }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 6);

        return { sectors: sortedSectors, groups: groupMap };
    })();

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2 border-b border-gray-100 flex justify-between items-center shrink-0">
                <h3 className="font-sans font-bold text-[#A07147] text-sm uppercase tracking-wider flex items-center gap-2">
                    <span className="text-sm">🏢</span> Renta Variable
                </h3>
            </div>

            <div className="flex-1 p-3 flex flex-col gap-4 overflow-y-auto scrollbar-thin">
                {/* Super Sectors */}
                <div className="flex flex-col gap-2 p-2 bg-slate-50/50 rounded border border-slate-100">
                    <div className="grid grid-cols-3 gap-1 mb-1">
                        <span className="text-[10px] font-black text-amber-600 text-center uppercase">Cíclico</span>
                        <span className="text-[10px] font-black text-blue-600 text-center uppercase">Sensible</span>
                        <span className="text-[10px] font-black text-emerald-600 text-center uppercase">Defensivo</span>
                    </div>
                    {/* Visual Bar representation instead of simple list */}
                    <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">
                        <div className="h-full bg-amber-500" style={{ width: `${analytics.groups.Cyclical}%` }} title={`Cíclico: ${analytics.groups.Cyclical}%`} />
                        <div className="h-full bg-blue-500" style={{ width: `${analytics.groups.Sensitive}%` }} title={`Sensible: ${analytics.groups.Sensitive}%`} />
                        <div className="h-full bg-emerald-500" style={{ width: `${analytics.groups.Defensive}%` }} title={`Defensivo: ${analytics.groups.Defensive}%`} />
                    </div>
                    <div className="flex justify-between px-1">
                        <span className="text-[10px] font-bold text-slate-500">{analytics.groups.Cyclical}%</span>
                        <span className="text-[10px] font-bold text-slate-500">{analytics.groups.Sensitive}%</span>
                        <span className="text-[10px] font-bold text-slate-500">{analytics.groups.Defensive}%</span>
                    </div>
                </div>

                {/* Specific Sectors */}
                {analytics.sectors.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black text-slate-400 uppercase px-1">Top Sectores</span>
                        <div className="grid grid-cols-2 gap-2">
                            {analytics.sectors.map((s: any, i: number) => (
                                <div key={i} className="flex justify-between items-center p-1.5 bg-white border border-slate-100 rounded shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-600 truncate" title={s.l}>{s.l}</span>
                                    <span className="text-[11px] font-mono font-bold text-indigo-600">{s.v}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {analytics.sectors.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-[10px] text-slate-400 italic">
                        Sin sectores ({portfolio.length} fondos)
                    </div>
                )}
            </div>
        </div>
    );
}

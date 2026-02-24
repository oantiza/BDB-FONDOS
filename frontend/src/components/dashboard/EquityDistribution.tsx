import {
    Zap, // Energy/Utilities
    HeartPulse, // Healthcare
    ShoppingBag, // Consumer
    Building2, // Real Estate/Financial
    Cpu, // Technology
    Hammer, // Industrials/Materials
    Globe, // Communications
    Coins, // Financials
    Truck, // Industrials
    PackageOpen // Materials
} from 'lucide-react';

const SECTOR_ICONS: Record<string, any> = {
    'technology': Cpu,
    'healthcare': HeartPulse,
    'financial': Coins,
    'consumer cyclical': ShoppingBag,
    'consumer defensive': PackageOpen,
    'utilities': Zap,
    'real estate': Building2,
    'communication': Globe,
    'industrials': Truck,
    'basic materials': Hammer,
    'energy': Zap,
    'tecnología': Cpu,
    'salud': HeartPulse,
    'finanzas': Coins,
    'consumo': ShoppingBag,
    'inmobiliario': Building2,
    'energía': Zap,
    'materiales': Hammer,
    'industrial': Truck
};

export default function EquityDistribution({ portfolio = [] }: any) {
    const analytics = (() => {
        if (!portfolio.length) return { sectors: [], groups: { Cyclical: 0, Sensitive: 0, Defensive: 0 } };

        const sectorMap: Record<string, number> = {};
        const groupMap: any = { Cyclical: 0, Sensitive: 0, Defensive: 0 };
        let totalRvWeight = 0;

        const cyclical = ['basic material', 'consumer cyclical', 'financial', 'real estate', 'materials', 'bancos', 'inmobiliario'];
        const defensive = ['consumer defensive', 'healthcare', 'utilities', 'salud', 'consumo defensivo', 'utili'];

        portfolio.forEach((p: any) => {
            if (p.sectors && Array.isArray(p.sectors) && p.sectors.length > 0) {
                p.sectors.forEach((s: any) => {
                    const sName = (s.name || s.sector || '').toLowerCase();
                    const w = (s.weight / 100) * p.weight;
                    const dispName = sName.charAt(0).toUpperCase() + sName.slice(1);
                    sectorMap[dispName] = (sectorMap[dispName] || 0) + w;
                    totalRvWeight += w;

                    if (cyclical.some(x => sName.includes(x))) {
                        groupMap.Cyclical += w;
                    } else if (defensive.some(x => sName.includes(x))) {
                        groupMap.Defensive += w;
                    } else {
                        groupMap.Sensitive += w;
                    }
                });
            }
        });

        const totalGroups = groupMap.Cyclical + groupMap.Sensitive + groupMap.Defensive;
        if (totalGroups > 0) {
            groupMap.Cyclical = Math.round((groupMap.Cyclical / totalGroups) * 100);
            groupMap.Sensitive = Math.round((groupMap.Sensitive / totalGroups) * 100);
            groupMap.Defensive = Math.round((groupMap.Defensive / totalGroups) * 100);
        }

        const sortedSectors = Object.entries(sectorMap)
            .map(([l, v]) => ({
                l: l.substring(0, 22),
                v: Math.round((v / (totalRvWeight || 1)) * 100),
                rawLabel: l.toLowerCase()
            }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 6);

        return { sectors: sortedSectors, groups: groupMap };
    })();

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="pb-8 flex items-center gap-1.5 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-[#0B2545]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <h3 className="text-sm font-extrabold text-[#0B2545] uppercase tracking-[0.15em]">
                    Renta Variable
                </h3>
            </div>

            <div className="flex-1 flex flex-col gap-8 overflow-y-auto scrollbar-none">
                {/* Stacked Segmented Bar with Premium Gradients */}
                <div className="flex flex-col gap-1.5 h-[65px] shrink-0">
                    <div className="flex justify-between px-0.5">
                        <span className="text-[9px] font-extrabold text-[#0B2545] uppercase tracking-wider">Cíclico</span>
                        <span className="text-[9px] font-extrabold text-[#1E3A8A] uppercase tracking-wider">Sensible</span>
                        <span className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider">Defensivo</span>
                    </div>
                    <div className="flex h-3.5 w-full rounded-md overflow-hidden bg-slate-100 shadow-inner">
                        <div className="h-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" style={{ width: `${analytics.groups.Cyclical}%` }} />
                        <div className="h-full bg-gradient-to-r from-[#0B2545] to-[#1E3A8A] transition-all duration-700 border-x border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" style={{ width: `${analytics.groups.Sensitive}%` }} />
                        <div className="h-full bg-gradient-to-r from-[#94A3B8] to-[#CBD5E1] transition-all duration-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" style={{ width: `${analytics.groups.Defensive}%` }} />
                    </div>
                    <div className="flex justify-between px-0.5">
                        <span className="text-xs font-black text-sky-600 tabular-nums">{analytics.groups.Cyclical}%</span>
                        <span className="text-xs font-black text-[#0B2545] tabular-nums">{analytics.groups.Sensitive}%</span>
                        <span className="text-xs font-black text-slate-500 tabular-nums">{analytics.groups.Defensive}%</span>
                    </div>
                </div>

                {/* Top Sectors with Icons and Cleaner Layout */}
                {analytics.sectors.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-2">Top Sectores</span>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            {analytics.sectors.map((s: any, i: number) => {
                                const Icon = SECTOR_ICONS[s.rawLabel] || SECTOR_ICONS[Object.keys(SECTOR_ICONS).find(k => s.rawLabel.includes(k)) || ''] || Globe;
                                return (
                                    <div key={i} className="flex justify-between items-center py-1 group transition-all">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-5 h-5 rounded bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-slate-100 transition-colors">
                                                <Icon className="w-3 h-3 text-[#0B2545] opacity-70" />
                                            </div>
                                            <span className="text-xs text-slate-600 font-medium truncate" title={s.l}>{s.l}</span>
                                        </div>
                                        <span className="text-xs font-extrabold text-[#0B2545] tabular-nums bg-slate-50 px-1.5 py-0.5 rounded-sm">{s.v}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {analytics.sectors.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-[11px] text-slate-400 italic">
                        Sin sectores ({portfolio.length} fondos)
                    </div>
                )}
            </div>
        </div>
    );
}

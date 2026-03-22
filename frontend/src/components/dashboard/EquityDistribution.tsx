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
            .slice(0, 4);

        return { sectors: sortedSectors, groups: groupMap };
    })();

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="pb-4 border-b border-slate-100 flex items-center gap-2 shrink-0 mb-6">
                <div className="w-5 h-5 rounded bg-blue-50/50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-blue-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                </div>
                <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">
                    Renta Variable
                </h3>
            </div>

            <div className="flex-1 flex flex-col justify-center">
                {/* Stacked Segmented Bar clean and elegant */}
                <div className="flex flex-col gap-3 w-full max-w-[280px]">
                    <div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">
                        <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${analytics.groups.Cyclical}%` }} />
                        <div className="h-full bg-blue-800 transition-all duration-700 border-x border-white/20" style={{ width: `${analytics.groups.Sensitive}%` }} />
                        <div className="h-full bg-slate-300 transition-all duration-700" style={{ width: `${analytics.groups.Defensive}%` }} />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">Cíclico</span>
                            <span className="text-sm font-semibold text-slate-700 tabular-nums">{analytics.groups.Cyclical}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-0.5">Sensible</span>
                            <span className="text-sm font-semibold text-slate-700 tabular-nums">{analytics.groups.Sensitive}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Defensivo</span>
                            <span className="text-sm font-semibold text-slate-700 tabular-nums">{analytics.groups.Defensive}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


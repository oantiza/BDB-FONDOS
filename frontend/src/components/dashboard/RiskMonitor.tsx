import { useMemo } from 'react'

const MatrixCell = ({ active, color }: { active: boolean, color: string }) => (
    <div className={`w-full h-full rounded-[2px] border border-gray-200 ${active ? color : 'bg-transparent'}`} />
)

export default function RiskMonitor({ portfolio = [] }: { portfolio?: any[] }) {
    // Calculate dynamic risk scores based on portfolio composition
    const risks = useMemo(() => {
        if (!portfolio || portfolio.length === 0) {
            return [
                { label: 'Concentration', score: 1, zone: 'green' },
                { label: 'Volatility', score: 1, zone: 'green' },
                { label: 'Liquidity', score: 2, zone: 'green' },
                { label: 'Geographic', score: 2, zone: 'green' },
            ];
        }

        // 1. Concentration Risk: Based on max weight
        const maxWeight = Math.max(...portfolio.map(p => p.weight || 0));
        const concentrationScore = maxWeight > 30 ? 5 : maxWeight > 20 ? 4 : maxWeight > 15 ? 3 : maxWeight > 10 ? 2 : 1;

        // 2. Volatility Risk: Based on average volatility
        const avgVol = portfolio.reduce((sum, p) => sum + (p.std_perf?.volatility || 0.12), 0) / portfolio.length;
        const volScore = avgVol > 0.25 ? 5 : avgVol > 0.18 ? 4 : avgVol > 0.12 ? 3 : avgVol > 0.08 ? 2 : 1;

        // 3. Liquidity Risk: Based on number of funds (diversification proxy)
        const liquidityScore = portfolio.length < 3 ? 4 : portfolio.length < 5 ? 3 : portfolio.length < 7 ? 2 : 1;

        // 4. Geographic Risk: Based on region concentration
        const regionMap: { [key: string]: number } = {};
        portfolio.forEach(p => {
            const region = p.std_region || 'Global';
            regionMap[region] = (regionMap[region] || 0) + (p.weight || 0);
        });
        const maxRegionWeight = Math.max(...Object.values(regionMap));
        const geoScore = maxRegionWeight > 70 ? 5 : maxRegionWeight > 50 ? 4 : maxRegionWeight > 40 ? 3 : 2;

        const getZone = (score: number) => score >= 4 ? 'orange' : score >= 3 ? 'yellow' : 'green';

        return [
            { label: 'Concentración (Max)', score: concentrationScore, zone: getZone(concentrationScore) },
            { label: 'Volatilidad', score: volScore, zone: getZone(volScore) },
            { label: 'Diversificación', score: liquidityScore, zone: getZone(liquidityScore) },
            { label: 'Riesgo Geográfico', score: geoScore, zone: getZone(geoScore) },
        ];
    }, [portfolio]);

    return (
        <div className="flex flex-col h-full bg-slate-50/30 pt-1">
            <h3 className="font-sans text-[11px] uppercase tracking-widest font-black text-slate-500 mb-2 px-1">
                Monitor de Riesgo
            </h3>
            <div className="h-[1px] w-full bg-slate-200 mb-4" />

            <div className="flex-1 flex flex-col gap-2 p-1 justify-center">
                {risks.map((risk, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-black text-slate-600 w-24 shrink-0 px-1">{risk.label}</span>
                        <div className="flex-1 h-2 flex gap-1 mx-2">
                            {[1, 2, 3, 4, 5].map(lvl => {
                                let activeColor = ''
                                if (risk.zone === 'green') activeColor = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                if (risk.zone === 'yellow') activeColor = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                                if (risk.zone === 'orange') activeColor = 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]'
                                if (risk.zone === 'red') activeColor = 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'

                                return (
                                    <MatrixCell
                                        key={lvl}
                                        active={lvl <= risk.score}
                                        color={activeColor}
                                    />
                                )
                            })}
                        </div>
                        <span className="text-[10px] font-black text-slate-900 w-10 text-right shrink-0 pr-1">{risk.score}/5</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

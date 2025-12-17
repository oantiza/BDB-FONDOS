import { useMemo } from 'react'

const MatrixCell = ({ active, color }) => (
    <div className={`w-full h-full rounded-[2px] border border-gray-200 ${active ? color : 'bg-transparent'}`} />
)

export default function RiskMonitor({ portfolio = [] }) {
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
        const regionMap = {};
        portfolio.forEach(p => {
            const region = p.std_region || 'Global';
            regionMap[region] = (regionMap[region] || 0) + (p.weight || 0);
        });
        const maxRegionWeight = Math.max(...Object.values(regionMap));
        const geoScore = maxRegionWeight > 70 ? 5 : maxRegionWeight > 50 ? 4 : maxRegionWeight > 40 ? 3 : 2;

        const getZone = (score) => score >= 4 ? 'orange' : score >= 3 ? 'yellow' : 'green';

        return [
            { label: 'Concentration', score: concentrationScore, zone: getZone(concentrationScore) },
            { label: 'Volatility', score: volScore, zone: getZone(volScore) },
            { label: 'Liquidity', score: liquidityScore, zone: getZone(liquidityScore) },
            { label: 'Geographic', score: geoScore, zone: getZone(geoScore) },
        ];
    }, [portfolio]);

    return (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg flex flex-col h-full overflow-hidden">
            <div className="p-2 border-b border-gray-200 bg-gray-50">
                <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">🛡️</span> Risk Monitor
                </h3>
            </div>

            <div className="flex-1 flex flex-col gap-4 p-4">
                {risks.map((risk, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 w-24">{risk.label}</span>
                        <div className="flex-1 h-3 flex gap-1 mx-2">
                            {[1, 2, 3, 4, 5].map(lvl => {
                                let activeColor = ''
                                if (risk.zone === 'green') activeColor = 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'
                                if (risk.zone === 'yellow') activeColor = 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]'
                                if (risk.zone === 'orange') activeColor = 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]'
                                if (risk.zone === 'red') activeColor = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'

                                return (
                                    <MatrixCell
                                        key={lvl}
                                        active={lvl <= risk.score}
                                        color={activeColor}
                                    />
                                )
                            })}
                        </div>
                        <span className="text-[10px] font-bold text-gray-800 w-6 text-right">{risk.score}/5</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

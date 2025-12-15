
const risks = [
    { label: 'Inflation', score: 3, zone: 'yellow' },
    { label: 'Geopolitics', score: 4, zone: 'orange' },
    { label: 'Liquidity', score: 2, zone: 'green' },
    { label: 'Valuation', score: 4, zone: 'orange' },
]

const MatrixCell = ({ active, color }) => (
    <div className={`w-full h-full rounded border border-white/5 ${active ? color : 'bg-transparent'}`} />
)

export default function RiskMonitor() {
    return (
        <div className="glass-card rounded-xl p-4 h-full flex flex-col">
            <h3 className="text-[var(--color-accent)] font-bold text-lg mb-4 flex items-center gap-2">
                <span className="text-xl">🛡️</span> Risk Monitor
            </h3>

            <div className="flex-1 flex flex-col gap-4">
                {risks.map((risk, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm text-[var(--color-text-secondary)] w-24">{risk.label}</span>
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
                        <span className="text-xs font-bold text-[var(--color-text-primary)] w-6 text-right">{risk.score}/5</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

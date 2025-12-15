
const drivers = [
    { name: 'VIX Index', value: '13.45', change: '-2.1%', status: 'positive' },
    { name: 'US 10Y Yield', value: '4.21%', change: '+0.05%', status: 'negative' },
    { name: 'S&P 500 PE', value: '21.4x', change: 'Neutral', status: 'neutral' },
    { name: 'High Yield Spread', value: '320bps', change: '-5bps', status: 'positive' },
]

export default function MarketDrivers() {
    return (
        <div className="glass-card rounded-xl p-4 h-full flex flex-col">
            <h3 className="text-[var(--color-accent)] font-bold text-lg mb-4 flex items-center gap-2">
                <span className="text-xl">⚡</span> Market Drivers
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3">
                {drivers.map((driver, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded hover:bg-white/5 transition-colors">
                        <div>
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">{driver.name}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">{driver.change}</div>
                        </div>
                        <div className={`text-right font-bold ${driver.status === 'positive' ? 'text-green-400' :
                                driver.status === 'negative' ? 'text-red-400' : 'text-yellow-400'
                            }`}>
                            {driver.value}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

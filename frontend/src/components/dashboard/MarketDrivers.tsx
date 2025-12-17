import { useMarketSimulation } from '../../hooks/useMarketSimulation'

export default function MarketDrivers() {
    const drivers = useMarketSimulation()

    return (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg flex flex-col h-full overflow-hidden">
            <div className="p-2 border-b border-gray-200 bg-gray-50">
                <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">⚡</span> Market Drivers
                    <span className="ml-auto flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
                {drivers.map((driver, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 h-8">
                        <div className="flex items-center gap-2">
                            <div className="text-xs font-medium text-gray-800">{driver.name}</div>
                            <div className="text-[10px] text-gray-400 font-mono">
                                {driver.isNeutral ? 'Neutral' : (driver.change > 0 ? '+' : '') + driver.change + (driver.id === 'hy' ? 'bps' : '%')}
                            </div>
                        </div>
                        <div className={`text-right font-bold text-xs ${driver.isNeutral ? 'text-yellow-600' : (driver.id === 'vix' ? (driver.change > 0 ? 'text-red-600' : 'text-green-600') : (driver.change > 0 ? 'text-green-600' : 'text-red-600'))}`}>
                            {driver.value}{driver.suffix}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

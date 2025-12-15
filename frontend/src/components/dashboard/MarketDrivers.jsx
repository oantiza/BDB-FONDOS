import { useMarketSimulation } from '../../hooks/useMarketSimulation'

export default function MarketDrivers() {
    const drivers = useMarketSimulation()

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
            <div className="p-2 border-b border-slate-200 bg-slate-50">
                <h3 className="font-sans font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">⚡</span> Market Drivers
                    <span className="ml-auto flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
                {drivers.map((driver, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 rounded hover:bg-slate-50 transition-colors">
                        <div>
                            <div className="text-xs font-medium text-slate-800">{driver.name}</div>
                            <div className="text-[10px] text-slate-400">
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

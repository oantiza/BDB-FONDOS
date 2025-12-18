import { useState, useEffect } from 'react'

const BASE_DATA = [
    { id: 'vix', name: 'VIX Index', value: 13.45, change: -2.1, isPct: false, suffix: '' },
    { id: 'us10y', name: 'US 10Y Yield', value: 4.21, change: 0.05, isPct: true, suffix: '%' },
    { id: 'sppe', name: 'S&P 500 PE', value: 21.4, change: 0, isNeutral: true, suffix: 'x' }, // Change handled as string "Neutral" usually, but here numeric for ease
    { id: 'hy', name: 'High Yield Spread', value: 320, change: -5, isPct: false, suffix: 'bps' },
]

export function useMarketSimulation() {
    const [drivers, setDrivers] = useState(BASE_DATA)

    useEffect(() => {
        const interval = setInterval(() => {
            setDrivers(prev => prev.map(d => {
                // Random walk
                const move = (Math.random() - 0.5) * (d.value * 0.005) // 0.5% max move
                const newValue = d.value + move

                // Change tracking (accumulated or instant) - simplified: just show daily change fluctuating
                const newChange = d.change + (Math.random() - 0.5) * 0.1

                return {
                    ...d,
                    value: parseFloat(newValue.toFixed(2)),
                    change: parseFloat(newChange.toFixed(2))
                }
            }))
        }, 3000) // Update every 3 seconds for visibility without chaos

        return () => clearInterval(interval)
    }, [])

    return drivers
}

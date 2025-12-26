import { useState, useEffect } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function MacroTacticalModal({ portfolio, onApply, onClose }) {
    // Estado para los targets (Pesos objetivo)
    const [targets, setTargets] = useState({
        // RV
        rv_usa: 0, rv_eu: 0, rv_em: 0,
        // RF
        rf_gov: 0, rf_corp: 0, rf_hy: 0,
        // Other
        commodities: 0, cash: 0
    })

    const [total, setTotal] = useState(0)

    // Helper para clasificar activos (Heurística simple basada en nombre/tipo)
    const classifyAsset = (asset) => {
        const name = (asset.name || '').toLowerCase()
        const type = (asset.std_type || 'Mixto')
        const region = (asset.std_region || '').toLowerCase()

        // COMMODITIES
        if (name.includes('gold') || name.includes('oro') || name.includes('commodity') || name.includes('materias')) return 'commodities'

        // RENTA VARIABLE
        if (type === 'RV' || type === 'Equity') {
            if (region === 'usa' || name.includes('usa') || name.includes('s&p') || name.includes('nasdaq')) return 'rv_usa'
            if (region === 'europe' || region === 'euro' || name.includes('euro')) return 'rv_eu'
            if (region === 'emerging' || name.includes('emerg')) return 'rv_em'
            return 'rv_usa' // Default RV -> USA (simplificación)
        }

        // RENTA FIJA
        if (type === 'RF' || type === 'Fixed Income') {
            if (name.includes('gov') || name.includes('tesoro') || name.includes('govies')) return 'rf_gov'
            if (name.includes('high yield') || name.includes('hy')) return 'rf_hy'
            return 'rf_corp' // Default RF -> Corp
        }

        // CASH / OTHER
        return 'cash'
    }

    // Cargar estado inicial
    useEffect(() => {
        const initial = {
            rv_usa: 0, rv_eu: 0, rv_em: 0,
            rf_gov: 0, rf_corp: 0, rf_hy: 0,
            commodities: 0, cash: 0
        }

        portfolio.forEach(p => {
            const bucket = classifyAsset(p)
            initial[bucket] += (parseFloat(p.weight) || 0)
        })

        // Redondear
        Object.keys(initial).forEach(k => initial[k] = Math.round(initial[k]))
        setTargets(initial)
    }, [portfolio])

    useEffect(() => {
        const sum = Object.values(targets).reduce((a, b) => a + b, 0)
        setTotal(sum)
    }, [targets])

    const handleSliderChange = (key, val) => {
        setTargets(prev => ({ ...prev, [key]: parseInt(val) || 0 }))
    }

    const handleGenerate = () => {
        if (Math.abs(total - 100) > 1) {
            alert(`El total debe ser 100% (Actual: ${total}%)`)
            return
        }

        // 1. Calcular pesos actuales por bucket
        const currentCheck = {
            rv_usa: 0, rv_eu: 0, rv_em: 0,
            rf_gov: 0, rf_corp: 0, rf_hy: 0,
            commodities: 0, cash: 0
        }
        portfolio.forEach(p => {
            currentCheck[classifyAsset(p)] += (parseFloat(p.weight) || 0)
        })

        // Check for Impossible Allocations (Target > 0 but Current == 0)
        const impossible = []
        Object.keys(targets).forEach(key => {
            if (targets[key] > 0 && currentCheck[key] <= 0.01) {
                impossible.push(key)
            }
        })

        if (impossible.length > 0) {
            const mapNames = {
                rv_usa: 'RV USA', rv_eu: 'RV Europa', rv_em: 'RV Emergentes',
                rf_gov: 'RF Gobierno', rf_corp: 'RF Corporativa', rf_hy: 'High Yield',
                commodities: 'Commodities', cash: 'Liquidez'
            }
            const names = impossible.map(k => mapNames[k] || k).join(', ')
            alert(`⚠️ No puedes asignar peso a: ${names}.\n\nNo tienes ningun fondo de esta categoría en tu cartera actual. Añade primero un fondo de este tipo.`)
            return
        }

        // 2. Rescalar
        const newPortfolio = portfolio.map(p => {
            const bucket = classifyAsset(p)
            const currentWeight = currentCheck[bucket]
            const targetWeight = targets[bucket]

            if (currentWeight <= 0) return p // Should be caught by check above, but safety first

            const factor = targetWeight / currentWeight
            return { ...p, weight: p.weight * factor }
        })

        onApply(newPortfolio)
    }

    const chartData = {
        labels: ['USA', 'Europa', 'Emergentes', 'Gobierno', 'Corporativo', 'HY', 'Comm', 'Cash'],
        datasets: [{
            data: Object.values(targets),
            backgroundColor: [
                '#0f172a', '#1e293b', '#334155', // RV (Azules)
                '#b8952b', '#d4af37', '#fcd34d', // RF (Dorados)
                '#be123c', '#94a3b8' // Comm (Rose), Cash (Slate)
            ],
            borderWidth: 0
        }]
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-gradient-to-r from-gray-900 to-blue-800 border-b border-blue-800 p-2 flex justify-between items-center shrink-0 shadow-sm relative overflow-hidden">
                    <div className="relative z-10 flex items-center gap-2">
                        <div className="h-6 w-6 bg-white/10 rounded-full flex items-center justify-center border border-white/20 backdrop-blur-sm">
                            <span className="text-xs">🌐</span>
                        </div>
                        <h3 className="font-sans font-bold text-white uppercase text-xs tracking-wider">Macro Asignación Táctica</h3>
                    </div>
                    {/* Decorative noise */}
                    <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none"></div>

                    <button onClick={onClose} className="relative z-10 text-blue-300 hover:text-white transition-colors text-2xl leading-none">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto scrollbar-thin grid grid-cols-12 gap-8">

                    {/* Visualizer Panel */}
                    <div className="col-span-4 flex flex-col items-center">
                        <div className="w-full h-40 mb-4 relative flex items-center justify-center min-h-[160px]">
                            <Doughnut
                                data={chartData}
                                options={{
                                    cutout: '60%',
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: false } }
                                }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                <span className={`text-2xl font-bold ${Math.abs(total - 100) < 1 ? 'text-brand' : 'text-rose-500'}`}>{total}%</span>
                                <span className="text-[10px] text-slate-400 uppercase">Total</span>
                            </div>
                        </div>
                        <div className="text-xs text-center text-slate-500 italic">
                            Ajusta los sliders para definir tu estrategia macro.
                        </div>
                        <button
                            onClick={handleGenerate}
                            disabled={Math.abs(total - 100) > 1}
                            className="mt-6 w-full bg-brand text-white font-bold py-3 rounded shadow hover:bg-slate-800 disabled:opacity-50 transition-colors uppercase text-xs"
                        >
                            Generar Nueva Cartera
                        </button>
                    </div>

                    {/* Sliders Panel */}
                    <div className="col-span-8 space-y-6">
                        {/* Renta Variable Section */}
                        <div>
                            <h4 className="text-xs font-bold text-brand border-b border-brand/20 pb-1 mb-3 uppercase tracking-wider">Renta Variable</h4>
                            <div className="space-y-3">
                                <SliderRow label="USA" val={targets.rv_usa} onChange={v => handleSliderChange('rv_usa', v)} />
                                <SliderRow label="Europa" val={targets.rv_eu} onChange={v => handleSliderChange('rv_eu', v)} />
                                <SliderRow label="Emergentes" val={targets.rv_em} onChange={v => handleSliderChange('rv_em', v)} />
                            </div>
                        </div>

                        {/* Renta Fija Section */}
                        <div>
                            <h4 className="text-xs font-bold text-accent border-b border-accent/20 pb-1 mb-3 uppercase tracking-wider">Renta Fija / Crédito</h4>
                            <div className="space-y-3">
                                <SliderRow label="Gobierno" val={targets.rf_gov} onChange={v => handleSliderChange('rf_gov', v)} color="accent" />
                                <SliderRow label="Corporativo" val={targets.rf_corp} onChange={v => handleSliderChange('rf_corp', v)} color="accent" />
                                <SliderRow label="High Yield" val={targets.rf_hy} onChange={v => handleSliderChange('rf_hy', v)} color="accent" />
                            </div>
                        </div>

                        {/* Alternativos Section */}
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 border-b border-slate-200 pb-1 mb-3 uppercase tracking-wider">Alternativos</h4>
                            <div className="space-y-3">
                                <SliderRow label="Commodities" val={targets.commodities} onChange={v => handleSliderChange('commodities', v)} color="rose-500" />
                                <SliderRow label="Liquidez / Otros" val={targets.cash} onChange={v => handleSliderChange('cash', v)} color="slate-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SliderRow({ label, val, onChange, color = 'brand' }) {
    return (
        <div className="flex items-center gap-4">
            <span className="w-24 text-[11px] font-bold text-slate-600 truncate text-right">{label}</span>
            <input
                type="range" min="0" max="100"
                value={val}
                onChange={(e) => onChange(e.target.value)}
                className={`flex-1 accent-${color}`}
            />
            <span className="w-8 text-right text-xs font-mono font-bold text-slate-700">{val}%</span>
        </div>
    )
}

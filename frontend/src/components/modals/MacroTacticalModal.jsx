import { useState, useEffect } from 'react'
import { Doughnut } from 'react-chartjs-2'

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

    const total = Object.values(targets).reduce((a, b) => a + b, 0)



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
            currentCheck[classifyAsset(p)] += p.weight
        })

        // 2. Rescalar
        const newPortfolio = portfolio.map(p => {
            const bucket = classifyAsset(p)
            const currentWeight = currentCheck[bucket]
            const targetWeight = targets[bucket]

            if (currentWeight <= 0) return p // No se puede escalar algo que no existe

            const factor = targetWeight / currentWeight
            return { ...p, weight: p.weight * factor }
        })

        onApply(newPortfolio)
    }

    const chartData = {
        labels: ['USA', 'Europe', 'EM', 'Gov', 'Corp', 'HY', 'Comm', 'Cash'],
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
                <div className="p-4 border-b bg-slate-50 flex justify-between items-center shrink-0">
                    <h3 className="font-serif font-bold text-brand uppercase text-sm">🌐 Macro Asignación Táctica</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto scrollbar-thin grid grid-cols-12 gap-8">

                    {/* Visualizer Panel */}
                    <div className="col-span-4 flex flex-col items-center">
                        <div className="w-40 h-40 mb-4 relative">
                            <Doughnut data={chartData} options={{ cutout: '60%', plugins: { legend: { display: false } } }} />
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


import { useState, useEffect } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function MacroTacticalModal({ portfolio, allFunds = [], numFunds = 6, onApply, onClose }: { portfolio: any[], allFunds?: any[], numFunds?: number, onApply: (p: any[]) => void, onClose: () => void }) {
    // Estado para los targets (Pesos objetivo)
    const [targets, setTargets] = useState<{ [key: string]: number }>({
        // RV
        rv_usa: 0, rv_eu: 0, rv_em: 0, rv_global: 0, rv_sector: 0,
        // RF
        rf_gov: 0, rf_corp: 0, rf_hy: 0,
        // Other
        commodities: 0, cash: 0
    })

    const [total, setTotal] = useState(0)

    // Helper para clasificar activos (Robustecida con campos normalizados)
    const classifyAsset = (asset: any) => {
        const type = (asset.std_type || 'Mixto');
        const region = (asset.std_region || 'Global').toLowerCase();
        const category = (asset.std_extra?.category || '').toLowerCase();
        const name = (asset.name || '').toLowerCase();

        // 1. COMMODITIES / ALTERNATIVES
        if (type === 'Commodities' || type === 'Retorno Absoluto' || category.includes('common') || category.includes('materias')) {
            return 'commodities';
        }

        // 2. RENTA VARIABLE
        if (type === 'RV' || type === 'Equity' || category.includes('rv ') || category.includes('equity')) {
            // Sectorial check (High priority)
            if (create_regex('tech|tecnolog|health|salud|energy|energi|real estate|inmobiliari|gold|oro|robot|ai|cyber|ciber|fintech|bio|farm').test(category) ||
                create_regex('tech|tecnolog|health|salud|energy|energi|real estate|inmobiliari|gold|oro|robot|ai|cyber|ciber|fintech|bio|farm').test(name)) {
                return 'rv_sector';
            }

            // Global check (before specific regions if explicitly marked global)
            // But usually we want specific regions first? 
            // User request: "add global and sectorial".
            // Implementation: If it hits specific regions like USA/EU/EM, we stick to those. 
            // If it's explicit Global/World and NOT specific region, it goes to Global.

            if (region === 'usa' || create_regex('usa|eeuu').test(category)) return 'rv_usa';
            if (region === 'europe' || create_regex('europe|euro').test(category)) return 'rv_eu';
            if (region === 'emerging' || create_regex('emerg|asia|latam').test(category)) return 'rv_em';

            if (region === 'global' || create_regex('global|world|mundial|internacional').test(category) || create_regex('global|world|mundial').test(name)) {
                return 'rv_global';
            }

            // Fallback for Equity -> Default to Global now
            return 'rv_global';
        }

        // 3. RENTA FIJA
        if (type === 'RF' || type === 'Fixed Income' || category.includes('rf ') || category.includes('fixed income') || category.includes('deuda')) {
            // High Yield
            if (category.includes('high yield') || name.includes('high yield') || name.includes('hy')) return 'rf_hy';
            // Government
            if (category.includes('government') || category.includes('publica') || name.includes('gov') || name.includes('tesoro')) return 'rf_gov';
            // Corporate (Default RF)
            return 'rf_corp';
        }

        // 4. CASH / LIQUIDEZ
        if (type === 'Monetario' || type === 'Cash' || category.includes('monetario') || category.includes('money market') || category.includes('liquidez')) {
            return 'cash';
        }

        // Fallback for Mixtures/Others
        return 'cash';
    }

    // Helper
    function create_regex(str: string) { return new RegExp(str, 'i'); }

    // Cargar estado inicial
    useEffect(() => {
        const initial: { [key: string]: number } = {
            rv_usa: 0, rv_eu: 0, rv_em: 0, rv_global: 0, rv_sector: 0,
            rf_gov: 0, rf_corp: 0, rf_hy: 0,
            commodities: 0, cash: 0
        }

        portfolio.forEach((p: any) => {
            const bucket = classifyAsset(p)
            if (initial[bucket] !== undefined) {
                initial[bucket] += (parseFloat(p.weight) || 0)
            } else {
                // Safety: if new buckets added but classify logic misses, dump to cash or global?
                // classifyAsset guarantees a return string. If it returns something not in initial keys, we have a problem.
                // Current classifyAsset returns: commodities, rv_sector, rv_usa, rv_eu, rv_em, rv_global, rf_hy, rf_gov, rf_corp, cash.
                // All covered.
                initial['cash'] += (parseFloat(p.weight) || 0)
            }
        })

        // Redondear
        Object.keys(initial).forEach(k => initial[k] = Math.round(initial[k]))
        setTargets(initial)
    }, [portfolio])

    useEffect(() => {
        const sum = Object.values(targets).reduce((a, b) => a + b, 0)
        setTotal(sum)
    }, [targets])

    const handleSliderChange = (key: string, val: string | number) => {
        setTargets(prev => ({ ...prev, [key]: parseInt(String(val)) || 0 }))
    }

    const handleGenerate = () => {
        if (Math.abs(total - 100) > 1) {
            alert(`El total debe ser 100% (Actual: ${total}%)`)
            return
        }

        // 1. Identify funds by bucket currently in portfolio
        const currentFundsByBucket: { [key: string]: any[] } = {
            rv_usa: [], rv_eu: [], rv_em: [], rv_global: [], rv_sector: [],
            rf_gov: [], rf_corp: [], rf_hy: [],
            commodities: [], cash: []
        };

        portfolio.forEach((p: any) => {
            const b = classifyAsset(p);
            if (currentFundsByBucket[b]) {
                currentFundsByBucket[b].push(p);
            }
        });

        // 2. Determine Target Count per Bucket based on NumFunds
        const newFundsToAdd: any[] = [];
        const finalBuckets = { ...currentFundsByBucket };

        Object.keys(targets).forEach(bucket => {
            const weight = targets[bucket];
            if (weight > 0) {
                // Determine how many funds this bucket should have proportional to weight
                let targetCount = Math.round((weight / 100) * numFunds!); // Assert numFunds is there
                if (targetCount < 1) targetCount = 1; // Minimum 1 fund if allocated

                const existingCount = currentFundsByBucket[bucket].length;
                const needed = targetCount - existingCount;

                if (needed > 0 && allFunds!.length > 0) { // Assert allFunds
                    // Find candidates
                    const candidates = allFunds!.filter((f: any) => classifyAsset(f) === bucket);
                    // Filter out funds already in portfolio
                    const availableCandidates = candidates.filter(c => !portfolio.find((p: any) => p.isin === c.isin));

                    if (availableCandidates.length > 0) {
                        // Sort by Rating (Stars) DESC, then Sharpe DESC
                        availableCandidates.sort((a: any, b: any) => {
                            const rateA = a.rating_overall || 0;
                            const rateB = b.rating_overall || 0;
                            if (rateB !== rateA) return rateB - rateA;
                            return (b.std_perf?.sharpe || 0) - (a.std_perf?.sharpe || 0);
                        });

                        // Take top 'needed'
                        const toAdd = availableCandidates.slice(0, needed);
                        toAdd.forEach(f => {
                            newFundsToAdd.push({
                                ...f,
                                weight: 0, // Assigned later
                                locked: false
                            });
                            finalBuckets[bucket].push(f);
                        });
                    }
                }
            }
        });

        // 3. Construct Final Portfolio & Distribute Weights
        let finalPortfolioList = [...portfolio];
        newFundsToAdd.forEach(nf => {
            if (!finalPortfolioList.find((p: any) => p.isin === nf.isin)) {
                finalPortfolioList.push(nf);
            }
        });

        const rescaledPortfolio: any[] = [];

        Object.keys(targets).forEach(bucket => {
            const targetTotalWeight = targets[bucket];

            // Re-filter from final list to ensure we capture all intended funds
            const fundsInBucket = finalPortfolioList.filter((p: any) => classifyAsset(p) === bucket);

            if (fundsInBucket.length > 0) {
                if (targetTotalWeight === 0) {
                    // Weight 0
                    fundsInBucket.forEach((f: any) => {
                        rescaledPortfolio.push({ ...f, weight: 0 });
                    });
                } else {
                    // Equal Weighting: Target / Count
                    const weightPerFund = targetTotalWeight / fundsInBucket.length;
                    fundsInBucket.forEach((f: any) => {
                        rescaledPortfolio.push({ ...f, weight: weightPerFund });
                    });
                }
            }
        });

        onApply(rescaledPortfolio)
    }

    const chartData = {
        labels: ['USA', 'Europa', 'Emergentes', 'Global', 'Sectorial', 'Gobierno', 'Corporativo', 'HY', 'Comm', 'Cash'],
        datasets: [{
            data: Object.values(targets),
            backgroundColor: [
                '#0f172a', '#1e293b', '#334155', '#475569', '#64748b', // RV (Azules/Grises)
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
                                <SliderRow label="Global" val={targets.rv_global} onChange={v => handleSliderChange('rv_global', v)} color="slate-600" />
                                <SliderRow label="Sectorial" val={targets.rv_sector} onChange={v => handleSliderChange('rv_sector', v)} color="slate-600" />
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

function SliderRow({ label, val, onChange, color = 'brand' }: { label: string, val: number, onChange: (v: string) => void, color?: string }) {
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

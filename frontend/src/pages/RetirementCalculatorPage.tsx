import React, { useState, useEffect } from 'react';
import { ArrowRight, Calculator, Info } from 'lucide-react';
import Header from '../components/Header';

// Tipos
type RentType = 'temporal' | 'vitaliciaSostenible' | 'vitaliciaEV';
type Sex = 'male' | 'female';

const LIFE_EXPECTANCY_DATA: Record<number, { male: number; female: number }> = {
    50: { male: 32.2, female: 36.6 }, 55: { male: 27.7, female: 32.0 },
    60: { male: 23.3, female: 27.4 }, 65: { male: 19.2, female: 23.0 },
    70: { male: 15.5, female: 18.9 }, 75: { male: 12.1, female: 15.1 },
    80: { male: 9.1, female: 11.7 }, 85: { male: 6.6, female: 8.6 },
    90: { male: 4.6, female: 6.0 }, 95: { male: 3.1, female: 4.0 },
};

const BIZKAIA_TAX_BRACKETS = [
    { limit: 127680, rate: 0.49 }, { limit: 95760, rate: 0.47 },
    { limit: 71820, rate: 0.46 }, { limit: 53870, rate: 0.40 },
    { limit: 35910, rate: 0.35 }, { limit: 17960, rate: 0.28 },
    { limit: 0, rate: 0.23 }
];

interface RetirementCalculatorPageProps {
    onBack?: () => void;
}

export default function RetirementCalculatorPage({ onBack }: RetirementCalculatorPageProps) {
    // --- STATE ---
    const [rentType, setRentType] = useState<RentType>('temporal');
    const [savings, setSavings] = useState<number>(150000);
    const [annualRevaluation, setAnnualRevaluation] = useState<number>(3.0);

    // Temporal
    const [yearsDuration, setYearsDuration] = useState<number>(25);
    const [annualUpdate, setAnnualUpdate] = useState<number>(1.0);

    // EV
    const [age, setAge] = useState<number>(65);
    const [sex, setSex] = useState<Sex>('male');
    const [annualUpdateEV, setAnnualUpdateEV] = useState<number>(1.0);

    // Pension Publica
    const [includePension, setIncludePension] = useState(false);
    const [publicPension, setPublicPension] = useState<number>(0);
    const [viewMode, setViewMode] = useState<'gross' | 'net'>('gross');

    // Resultados Cacluados
    const [calculatedResults, setCalculatedResults] = useState({
        initialRent: 0,
        finalRent: 0,
        yearsCalculated: 0,
        schedule: [] as any[]
    });

    const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

    // --- LOGIC ---
    const getLifeExpectancy = (currentAge: number, gender: Sex) => {
        const ageKeys = Object.keys(LIFE_EXPECTANCY_DATA).map(Number).sort((a, b) => b - a);
        const applicableAge = ageKeys.find(key => currentAge >= key) || Math.min(...ageKeys);
        return LIFE_EXPECTANCY_DATA[applicableAge]?.[gender] ?? 0;
    };

    const calculateTax = (income: number) => {
        let tax = 0;
        let remaining = income;
        for (const bracket of BIZKAIA_TAX_BRACKETS) {
            if (remaining > bracket.limit) {
                tax += (remaining - bracket.limit) * bracket.rate;
                remaining = bracket.limit;
            }
        }
        return tax;
    };

    useEffect(() => {
        let anios = 0;
        let actualizacionRate = 0;
        let rentInitial = 0;
        const revalRate = annualRevaluation / 100;

        if (rentType === 'temporal') {
            anios = yearsDuration;
            actualizacionRate = annualUpdate / 100;
        } else if (rentType === 'vitaliciaEV') {
            anios = getLifeExpectancy(age, sex);
            actualizacionRate = annualUpdateEV / 100;
        } else {
            // Vitalicia Sostenible (Perpetuidad con crecimiento)
            // Rent = Interest Only (conserving capital real value usually, simplified here as just yield)
            rentInitial = (savings * revalRate) / 12;
            anios = 0; // No schedule needed really
        }

        if (rentType !== 'vitaliciaSostenible') {
            if (Math.abs(revalRate - actualizacionRate) > 1e-9) {
                const r_eff = (1 + revalRate) / (1 + actualizacionRate) - 1;
                rentInitial = (savings * r_eff) / (1 - Math.pow(1 + r_eff, -anios)) / 12;
            } else {
                rentInitial = (savings / anios) / 12;
            }
        }

        if (!isFinite(rentInitial) || rentInitial < 0) rentInitial = 0;

        // Schedule Generation
        const schedule = [];
        if (rentType !== 'vitaliciaSostenible' && rentInitial > 0) {
            let balance = savings;
            let currentMonthlyRent = rentInitial;
            const fullYears = Math.floor(anios);

            for (let i = 1; i <= fullYears; i++) {
                const startBalance = balance;
                balance = (balance - (currentMonthlyRent * 12)) * (1 + revalRate);
                schedule.push({
                    year: i,
                    monthlyRent: currentMonthlyRent,
                    startBalance,
                    endBalance: balance < 0 ? 0 : balance
                });
                currentMonthlyRent *= (1 + actualizacionRate);
            }
        }

        const rentFinal = rentType === 'vitaliciaSostenible'
            ? rentInitial
            : rentInitial * Math.pow(1 + actualizacionRate, anios - 1);

        setCalculatedResults({
            initialRent: rentInitial,
            finalRent: rentFinal,
            yearsCalculated: anios,
            schedule
        });

    }, [rentType, savings, annualRevaluation, yearsDuration, annualUpdate, age, sex, annualUpdateEV]);

    // --- RENDER HELPERS ---
    const getTotalStats = (isFinal: boolean) => {
        const privateRent = isFinal ? calculatedResults.finalRent : calculatedResults.initialRent;
        const totalGrossMonthly = privateRent + publicPension;
        const totalGrossAnnual = (privateRent * 12) + (publicPension * 14); // 14 pagas publica
        const tax = calculateTax(totalGrossAnnual);
        const netAnnual = totalGrossAnnual - tax;
        const netMonthly = netAnnual / 12;

        return {
            grossMonthly: totalGrossMonthly,
            grossAnnual: totalGrossAnnual,
            tax,
            netMonthly
        };
    };

    const initialStats = getTotalStats(false);
    const finalStats = getTotalStats(true);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            <Header
                onLogout={() => { }}
                onOpenMiBoutique={() => { }}
                onBack={onBack}
            />

            <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
                <div className="text-center mb-10">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 tracking-tight mb-4 flex items-center justify-center gap-3">
                        <Calculator className="w-10 h-10 text-[#003399]" />
                        Calculadora de Jubilación
                    </h1>
                    <p className="text-xl text-slate-500 max-w-2xl mx-auto">
                        Planifica tu futuro financiero estimando tu renta mensual complementaria.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT COLUMN: INPUTS */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                            <h2 className="text-lg font-bold text-slate-700 mb-6 uppercase tracking-wider border-b pb-2">Configuración</h2>

                            {/* Type Selector */}
                            <div className="mb-8">
                                <label className="block text-sm font-bold text-slate-500 mb-3 uppercase">Tipo de Renta</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {[
                                        { id: 'temporal', label: '⏳ Renta Temporal', desc: 'Agota el capital en N años' },
                                        { id: 'vitaliciaSostenible', label: '♾️ Vitalicia (Sostenible)', desc: 'Solo vive de los intereses' },
                                        { id: 'vitaliciaEV', label: '👤 Vitalicia (Esperanza Vida)', desc: 'Calculado según tu edad' }
                                    ].map((opt) => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setRentType(opt.id as RentType)}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${rentType === opt.id
                                                ? 'border-[#003399] bg-blue-50 text-[#003399]'
                                                : 'border-slate-100 hover:border-slate-300 text-slate-600'
                                                }`}
                                        >
                                            <div className="font-bold text-base">{opt.label}</div>
                                            <div className="text-xs opacity-75 mt-1">{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Common Inputs */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Ahorros Acumulados</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={savings}
                                            onChange={e => setSavings(Number(e.target.value))}
                                            className="w-full text-lg p-3 pl-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#003399] focus:border-transparent font-bold text-slate-800"
                                        />
                                        <span className="absolute right-4 top-3.5 text-slate-400 font-bold">€</span>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-sm font-bold text-slate-700">Rentabilidad Esperada</label>
                                        <span className="text-sm font-bold text-[#003399]">{annualRevaluation}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="15" step="0.1"
                                        value={annualRevaluation}
                                        onChange={e => setAnnualRevaluation(Number(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003399]"
                                    />
                                </div>

                                {/* Dynamic Inputs */}
                                {rentType === 'temporal' && (
                                    <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-bold text-slate-600">Duración de la Renta</label>
                                                <span className="text-sm font-bold text-[#003399]">{yearsDuration} años</span>
                                            </div>
                                            <input
                                                type="range" min="1" max="50" step="1"
                                                value={yearsDuration}
                                                onChange={e => setYearsDuration(Number(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003399]"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-bold text-slate-600">Actualización Anual Renta</label>
                                                <span className="text-sm font-bold text-[#003399]">{annualUpdate}%</span>
                                            </div>
                                            <input
                                                type="range" min="0" max="10" step="0.1"
                                                value={annualUpdate}
                                                onChange={e => setAnnualUpdate(Number(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003399]"
                                            />
                                        </div>
                                    </div>
                                )}

                                {rentType === 'vitaliciaEV' && (
                                    <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-600 mb-1">Edad Actual</label>
                                                <input
                                                    type="number" value={age} onChange={e => setAge(Number(e.target.value))}
                                                    className="w-full p-2 border border-slate-300 rounded font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-600 mb-1">Sexo</label>
                                                <select
                                                    value={sex} onChange={e => setSex(e.target.value as Sex)}
                                                    className="w-full p-2 border border-slate-300 rounded font-bold"
                                                >
                                                    <option value="male">Hombre</option>
                                                    <option value="female">Mujer</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-bold text-slate-600">Actualización Anual Renta</label>
                                                <span className="text-sm font-bold text-[#003399]">{annualUpdateEV}%</span>
                                            </div>
                                            <input
                                                type="range" min="0" max="10" step="0.1"
                                                value={annualUpdateEV}
                                                onChange={e => setAnnualUpdateEV(Number(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003399]"
                                            />
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <Info className="w-3 h-3" />
                                            Esperanza de vida estimada: {getLifeExpectancy(age, sex).toFixed(1)} años más.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Public Pension Toggle */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-700">¿Añadir Pensión Pública?</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={includePension} onChange={e => setIncludePension(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#003399]"></div>
                                </label>
                            </div>

                            {includePension && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-sm font-medium text-slate-500 mb-1">Pensión Mensual Estimada</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={publicPension}
                                            onChange={e => setPublicPension(Number(e.target.value))}
                                            className="w-full p-2 pl-4 border border-slate-300 rounded-lg text-lg font-bold"
                                            placeholder="Ej: 1500"
                                        />
                                        <span className="absolute right-4 top-2.5 text-slate-400 font-bold">€</span>
                                    </div>
                                    <a href="https://prestaciones.seg-social.es/simulador-servicio/simulador-pension-jubilacion.html" target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline mt-2 inline-flex items-center gap-1">
                                        Ir al simulador de la Seguridad Social <ArrowRight className="w-3 h-3" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: RESULTS */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Main Badge Result */}
                        <div className="bg-gradient-to-br from-[#003399] to-[#0044CC] rounded-3xl shadow-xl overflow-hidden text-white p-8 md:p-12 text-center relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Calculator className="w-40 h-40" />
                            </div>

                            <h2 className="text-lg uppercase tracking-widest font-semibold opacity-80 mb-8">
                                {viewMode === 'gross' ? 'Renta Total Estimada (Bruta)' : 'Renta Total Estimada (Neta)'}
                            </h2>

                            {viewMode === 'net' && (
                                <div className="absolute top-6 right-6 bg-white/10 px-3 py-1 rounded-full text-xs font-bold border border-white/20">
                                    IRPF Estimado
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                <div className="bg-black/20 rounded-2xl p-6 backdrop-blur-sm">
                                    <div className="text-sm font-medium opacity-75 mb-1">Inicio de Jubilación</div>
                                    <div className="text-4xl md:text-5xl font-bold">
                                        {currencyFormatter.format(viewMode === 'gross' ? initialStats.grossMonthly : initialStats.netMonthly)}
                                    </div>
                                    <div className="text-xs opacity-50 mt-2">mensuales</div>
                                </div>

                                {rentType !== 'vitaliciaSostenible' && (
                                    <div className="bg-black/20 rounded-2xl p-6 backdrop-blur-sm">
                                        <div className="text-sm font-medium opacity-75 mb-1">Final del Periodo</div>
                                        <div className="text-4xl md:text-5xl font-bold">
                                            {currencyFormatter.format(viewMode === 'gross' ? finalStats.grossMonthly : finalStats.netMonthly)}
                                        </div>
                                        <div className="text-xs opacity-50 mt-2">mensuales</div>
                                    </div>
                                )}
                            </div>

                            {/* View Mode Toggle */}
                            <div className="mt-8 flex justify-center gap-2">
                                <button
                                    onClick={() => setViewMode('gross')}
                                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${viewMode === 'gross' ? 'bg-white text-[#003399]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                                >
                                    Bruto
                                </button>
                                <button
                                    onClick={() => setViewMode('net')}
                                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${viewMode === 'net' ? 'bg-white text-[#003399]' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                                >
                                    Neto (Impuestos)
                                </button>
                            </div>
                        </div>

                        {/* Breakdown */}
                        {viewMode === 'net' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                <h3 className="font-bold text-slate-700 mb-4">Detalle Fiscal Estimado (Anual)</h3>
                                <div className="grid grid-cols-2 gap-8 text-sm">
                                    <div>
                                        <div className="text-slate-500 mb-1">Ingresos Brutos Anuales</div>
                                        <div className="font-bold text-lg">{currencyFormatter.format(initialStats.grossAnnual)}</div>
                                    </div>
                                    <div>
                                        <div className="text-slate-500 mb-1">Impuestos estimados</div>
                                        <div className="font-bold text-lg text-red-500">-{currencyFormatter.format(initialStats.tax)}</div>
                                    </div>
                                </div>
                                <div className="mt-4 text-[10px] text-slate-400 bg-slate-50 p-2 rounded">
                                    * Cálculo fiscal simplificado basado en tramos IRPF Bizkaia (base general). Consulte con un asesor para detalle exacto.
                                </div>
                            </div>
                        )}

                        {/* Schedule Table */}
                        {rentType !== 'vitaliciaSostenible' && calculatedResults.schedule.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 flex justify-between">
                                    <span>Proyección de Capital</span>
                                    <span className="text-xs font-normal text-slate-500 self-center">Mostrando {calculatedResults.schedule.length} años</span>
                                </div>
                                <div className="overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                                    <table className="w-full text-sm text-right">
                                        <thead className="text-xs text-slate-500 bg-slate-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Año</th>
                                                <th className="px-4 py-3">Renta Mensual</th>
                                                <th className="px-4 py-3">Balance Inicial</th>
                                                <th className="px-4 py-3">Balance Final</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {calculatedResults.schedule.map((row) => (
                                                <tr key={row.year} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 text-left font-bold text-slate-700">{row.year}</td>
                                                    <td className="px-4 py-3 text-[#003399] font-medium">{currencyFormatter.format(row.monthlyRent)}</td>
                                                    <td className="px-4 py-3 text-slate-500">{currencyFormatter.format(row.startBalance)}</td>
                                                    <td className="px-4 py-3 text-slate-700 font-medium">{currencyFormatter.format(row.endBalance)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

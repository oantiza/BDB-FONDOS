import { useState, useEffect } from 'react';

const lifeExpectancyData: Record<number, { male: number; female: number }> = {
    50: { male: 32.2, female: 36.6 }, 55: { male: 27.7, female: 32.0 },
    60: { male: 23.3, female: 27.4 }, 65: { male: 19.2, female: 23.0 },
    70: { male: 15.5, female: 18.9 }, 75: { male: 12.1, female: 15.1 },
    80: { male: 9.1, female: 11.7 }, 85: { male: 6.6, female: 8.6 },
    90: { male: 4.6, female: 6.0 }, 95: { male: 3.1, female: 4.0 },
};

const getLifeExpectancy = (age: number, gender: 'male' | 'female') => {
    const ageKeys = Object.keys(lifeExpectancyData).map(Number).sort((a, b) => b - a);
    const applicableAge = ageKeys.find(key => age >= key) || Math.min(...ageKeys);
    return lifeExpectancyData[applicableAge]?.[gender] ?? 0;
};

const calculateBizkaiaTax = (income: number) => {
    const brackets = [
        { limit: 127680, rate: 0.49 }, { limit: 95760, rate: 0.47 },
        { limit: 71820, rate: 0.46 }, { limit: 53870, rate: 0.40 },
        { limit: 35910, rate: 0.35 }, { limit: 17960, rate: 0.28 },
        { limit: 0, rate: 0.23 }
    ];
    let tax = 0;
    let remainingIncome = income;
    for (const bracket of brackets) {
        if (remainingIncome > bracket.limit) {
            tax += (remainingIncome - bracket.limit) * bracket.rate;
            remainingIncome = bracket.limit;
        }
    }
    return tax;
};

const currencyFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

type RentaType = 'temporal' | 'vitaliciaSostenible' | 'vitaliciaEV';
type ViewMode = 'bruto' | 'neto';

interface RetirementCalculatorPageProps {
    onBack: () => void;
}

export default function RetirementCalculatorPage({ onBack }: RetirementCalculatorPageProps) {
    // State
    const [rentaType, setRentaType] = useState<RentaType>('temporal');
    const [ahorros, setAhorros] = useState<number>(150000);
    const [revalorizacion, setRevalorizacion] = useState<number>(3.0);
    const [aniosCobro, setAniosCobro] = useState<number>(25);
    const [actualizacion, setActualizacion] = useState<number>(1.0);
    const [actualizacionEV, setActualizacionEV] = useState<number>(1.0);
    const [edad, setEdad] = useState<number>(65);
    const [sexo, setSexo] = useState<'male' | 'female'>('male');

    // Pension Publica State
    const [pensionPublica, setPensionPublica] = useState<number>(0);
    const [isPensionPublicaEnabled, setIsPensionPublicaEnabled] = useState<boolean>(false);
    const [viewMode, setViewMode] = useState<ViewMode>('bruto');

    // Results State
    const [rentaInicial, setRentaInicial] = useState<number>(0);
    const [rentaFinal, setRentaFinal] = useState<number>(0);
    const [rentaVitalicia, setRentaVitalicia] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [tableData, setTableData] = useState<Array<{ year: number, rental: number, balanceStart: number, balanceEnd: number }>>([]);

    // Derived States for UI
    const [rentaTotalInicial, setRentaTotalInicial] = useState<number>(0);
    const [rentaTotalFinal, setRentaTotalFinal] = useState<number>(0);

    // Net Calculations
    const [netoMenu, setNetoMenu] = useState<{
        initial: { gross: number, tax: number, netMonthly: number },
        final: { gross: number, tax: number, netMonthly: number }
    }>({
        initial: { gross: 0, tax: 0, netMonthly: 0 },
        final: { gross: 0, tax: 0, netMonthly: 0 }
    });

    useEffect(() => {
        calculate();
    }, [rentaType, ahorros, revalorizacion, aniosCobro, actualizacion, actualizacionEV, edad, sexo, pensionPublica, isPensionPublicaEnabled]);

    const calculate = () => {
        setErrorMessage('');

        if (isNaN(ahorros) || ahorros <= 0) {
            setErrorMessage('Introduce un ahorro inicial positivo.');
            setRentaInicial(0); setRentaFinal(0); setRentaVitalicia(0);
            setTableData([]);
            return;
        }

        const revalRate = revalorizacion / 100;
        let calculatedRentaInicial = 0;
        let calculatedRentaFinal = 0;
        let yearsToCalc = 0;
        let updateRate = 0;

        if (rentaType === 'temporal' || rentaType === 'vitaliciaEV') {
            if (rentaType === 'temporal') {
                yearsToCalc = aniosCobro;
                updateRate = actualizacion / 100;
            } else {
                if (isNaN(edad) || edad < 50) {
                    setErrorMessage('Edad debe ser 50 o mayor.');
                    return;
                }
                yearsToCalc = getLifeExpectancy(edad, sexo);
                updateRate = actualizacionEV / 100;
            }

            if (revalRate !== updateRate) {
                let r_eff = (1 + revalRate) / (1 + updateRate) - 1;
                if (Math.abs(r_eff) > 1e-9) {
                    calculatedRentaInicial = (ahorros * r_eff) / (1 - Math.pow(1 + r_eff, -yearsToCalc)) / 12;
                } else {
                    calculatedRentaInicial = (ahorros / yearsToCalc) / 12;
                }
            } else {
                calculatedRentaInicial = (ahorros / yearsToCalc) / 12;
            }

            if (isFinite(calculatedRentaInicial) && calculatedRentaInicial > 0) {
                setRentaInicial(calculatedRentaInicial);
                calculatedRentaFinal = calculatedRentaInicial * Math.pow(1 + updateRate, yearsToCalc - 1);
                setRentaFinal(calculatedRentaFinal);
                generateTable(calculatedRentaInicial, yearsToCalc, updateRate, revalRate);
            } else {
                setErrorMessage('Parámetros no sostenibles.');
                setRentaInicial(0); setRentaFinal(0);
                setTableData([]);
            }
        } else {
            // Vitalicia Sostenible
            if (revalRate <= 0) {
                setErrorMessage('Se necesita revalorización positiva.');
                setRentaVitalicia(0);
                return;
            }
            const val = (ahorros * revalRate) / 12;
            setRentaVitalicia(val);
            calculatedRentaInicial = val;
            calculatedRentaFinal = val;
            setTableData([]); // No table for sustainable infinite
        }

        // Total Calculations
        if (!isPensionPublicaEnabled) {
            setPensionPublica(0); // internally treat as 0 for calc if disabled, but keep state for toggle
        }

        const effectivePension = isPensionPublicaEnabled ? (pensionPublica || 0) : 0;

        setRentaTotalInicial(effectivePension + calculatedRentaInicial);
        setRentaTotalFinal(effectivePension + calculatedRentaFinal);

        // Net Calculations
        // Initial
        const grossAnnualIncomeInitial = (calculatedRentaInicial * 12) + (effectivePension * 14); // Assuming 14 payments for public pension? standard in Spain
        const taxAmountInitial = calculateBizkaiaTax(grossAnnualIncomeInitial);
        const netAnnualIncomeInitial = grossAnnualIncomeInitial - taxAmountInitial;
        const netMonthlyIncomeInitial = netAnnualIncomeInitial / 12;

        // Final
        const grossAnnualIncomeFinal = (calculatedRentaFinal * 12) + (effectivePension * 14);
        const taxAmountFinal = calculateBizkaiaTax(grossAnnualIncomeFinal);
        const netAnnualIncomeFinal = grossAnnualIncomeFinal - taxAmountFinal;
        const netMonthlyIncomeFinal = netAnnualIncomeFinal / 12;

        setNetoMenu({
            initial: { gross: grossAnnualIncomeInitial, tax: taxAmountInitial, netMonthly: netMonthlyIncomeInitial },
            final: { gross: grossAnnualIncomeFinal, tax: taxAmountFinal, netMonthly: netMonthlyIncomeFinal }
        });
    };

    const generateTable = (startRental: number, years: number, updateRate: number, revalRate: number) => {
        const data = [];
        let balance = ahorros;
        let currentRental = startRental;
        const numYears = Math.floor(years);

        for (let year = 1; year <= numYears; year++) {
            const balanceStart = balance;
            balance = (balance - (currentRental * 12)) * (1 + revalRate);
            data.push({
                year,
                rental: currentRental,
                balanceStart,
                balanceEnd: balance < 0 ? 0 : balance
            });
            currentRental *= (1 + updateRate);
        }
        setTableData(data);
    };

    return (
        <div className="h-screen flex flex-col bg-white font-sans text-slate-700 overflow-hidden">
            {/* HEADER (Matches XRayPage) */}
            <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center justify-between px-6 z-20 shrink-0 border-b border-white/10 shadow-md">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="text-white/70 hover:text-white transition-colors flex items-center gap-1 text-xs uppercase tracking-widest font-bold"
                    >
                        ← Volver
                    </button>
                    <div className="h-4 w-px bg-white/20 mx-2"></div>
                    <span className="font-light text-xl tracking-tight leading-none">Calculadora de <span className="font-bold">Jubilación</span></span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-white p-8 md:p-12 scrollbar-thin">
                <div className="max-w-[1200px] mx-auto space-y-12 pb-20">

                    {/* INTRO SECTION */}
                    <div className="text-center mb-8">
                        <h1 className="text-[#2C3E50] text-4xl font-light tracking-tight mb-2">Estima tu renta futura</h1>
                        <p className="text-slate-400 font-light text-lg">Planifica tu jubilación con precisión y conoce el impacto fiscal.</p>
                    </div>

                    {/* MAIN CALCULATOR CARD */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                        {/* LEFT COLUMN: INPUTS */}
                        <div className="lg:col-span-7 bg-white border border-slate-100 rounded-xl shadow-sm p-8">
                            <h3 className="text-[#A07147] font-bold uppercase tracking-widest text-xs mb-6 border-b border-slate-100 pb-2">Configuración</h3>

                            <div className="space-y-8">
                                {/* TIPO DE RENTA */}
                                <div>
                                    <label className="block text-[#2C3E50] font-medium mb-3 text-sm uppercase tracking-wide">1. Tipo de Renta</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {(['temporal', 'vitaliciaSostenible', 'vitaliciaEV'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setRentaType(type)}
                                                className={`py-3 px-2 border rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-200 ${rentaType === type
                                                    ? 'bg-[#003399] text-white border-[#003399] shadow-md'
                                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                                                    }`}
                                            >
                                                {type === 'temporal' && 'Temporal'}
                                                {type === 'vitaliciaSostenible' && 'Vitalicia (Sost.)'}
                                                {type === 'vitaliciaEV' && 'Vitalicia (Esp. Vida)'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* AHORROS */}
                                <div>
                                    <label className="block text-[#2C3E50] font-medium mb-2 text-sm uppercase tracking-wide">2. Ahorros Acumulados</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={ahorros}
                                            onChange={(e) => setAhorros(parseFloat(e.target.value))}
                                            className="w-full p-3 pl-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003399] focus:border-[#003399] transition text-xl font-light text-[#2C3E50] bg-slate-50"
                                        />
                                        <span className="absolute right-4 top-3.5 text-slate-400 font-light">EUR</span>
                                    </div>
                                </div>

                                {/* REVALORIZACION */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-[#2C3E50] font-medium text-sm uppercase tracking-wide">3. Revalorización Anual (Cartera)</label>
                                        <span className="text-[#003399] font-bold text-lg">{revalorizacion.toFixed(1)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="15"
                                        step="0.1"
                                        value={revalorizacion}
                                        onChange={(e) => setRevalorizacion(parseFloat(e.target.value))}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003399]"
                                    />
                                </div>

                                {/* CONDITIONAL INPUTS */}
                                {rentaType === 'temporal' && (
                                    <div className="space-y-8 pt-4 border-t border-slate-50">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-[#2C3E50] font-medium text-sm uppercase tracking-wide">4. Años de Cobro</label>
                                                <span className="text-[#003399] font-bold text-lg">{aniosCobro} años</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="50"
                                                value={aniosCobro}
                                                onChange={(e) => setAniosCobro(parseInt(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003399]"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-[#2C3E50] font-medium text-sm uppercase tracking-wide">5. Actualización Renta (IPC)</label>
                                                <span className="text-[#003399] font-bold text-lg">{actualizacion.toFixed(1)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="10"
                                                step="0.1"
                                                value={actualizacion}
                                                onChange={(e) => setActualizacion(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003399]"
                                            />
                                        </div>
                                    </div>
                                )}

                                {rentaType === 'vitaliciaEV' && (
                                    <div className="space-y-6 pt-4 border-t border-slate-50">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[#2C3E50] font-medium mb-2 text-sm uppercase tracking-wide">4. Edad</label>
                                                <input
                                                    type="number"
                                                    value={edad}
                                                    onChange={(e) => setEdad(parseInt(e.target.value))}
                                                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003399] focus:border-[#003399] transition text-lg bg-slate-50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[#2C3E50] font-medium mb-2 text-sm uppercase tracking-wide">5. Sexo</label>
                                                <select
                                                    value={sexo}
                                                    onChange={(e) => setSexo(e.target.value as 'male' | 'female')}
                                                    className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003399] focus:border-[#003399] transition text-lg bg-slate-50"
                                                >
                                                    <option value="male">Hombre</option>
                                                    <option value="female">Mujer</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-[#2C3E50] font-medium text-sm uppercase tracking-wide">6. Actualización Renta (IPC)</label>
                                                <span className="text-[#003399] font-bold text-lg">{actualizacionEV.toFixed(1)}%</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="10"
                                                step="0.1"
                                                value={actualizacionEV}
                                                onChange={(e) => setActualizacionEV(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#003399]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                            {errorMessage && <p className="text-red-500 text-center mt-6 font-bold text-sm bg-red-50 py-2 rounded border border-red-100">{errorMessage}</p>}

                            {/* PENSION PUBLICA TOGGLE */}
                            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                                <div>
                                    <label className="font-bold text-[#2C3E50] text-lg block">Añadir Pensión Pública</label>
                                    <p className="text-slate-400 text-xs mt-1">Suma tu pensión pública a la renta privada</p>
                                </div>
                                <div
                                    className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors duration-300 ${isPensionPublicaEnabled ? 'bg-[#003399]' : 'bg-slate-300'}`}
                                    onClick={() => setIsPensionPublicaEnabled(!isPensionPublicaEnabled)}
                                >
                                    <div className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 ${isPensionPublicaEnabled ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: RESULTS */}
                        <div className="lg:col-span-5 space-y-6">

                            {/* RESULTS CARD */}
                            <div className="bg-[#003399] text-white rounded-xl shadow-lg p-8 relative overflow-hidden">
                                {/* Decorator */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>

                                <h3 className="text-white/80 font-bold uppercase tracking-widest text-xs mb-8 relative z-10">Proyección de Renta</h3>

                                <div className="text-center relative z-10">
                                    <h2 className="text-white text-lg font-light mb-8 opacity-90">
                                        {rentaType === 'temporal' && 'Renta Temporal'}
                                        {rentaType === 'vitaliciaSostenible' && 'Renta Vitalicia Sostenible'}
                                        {rentaType === 'vitaliciaEV' && 'Renta Según Esperanza de Vida'}
                                    </h2>

                                    {(rentaType === 'temporal' || rentaType === 'vitaliciaEV') ? (
                                        <div className="space-y-6">
                                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                                                <p className="text-xs uppercase tracking-widest text-white/70 mb-1">Renta Inicial Mensual</p>
                                                <p className="text-4xl font-bold tracking-tight">{currencyFormatter.format(rentaInicial)}</p>
                                            </div>
                                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                                                <p className="text-xs uppercase tracking-widest text-white/70 mb-1">Renta Final Estimada</p>
                                                <p className="text-3xl font-light tracking-tight text-white/90">{currencyFormatter.format(rentaFinal)}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/10 my-8">
                                            <p className="text-xs uppercase tracking-widest text-white/70 mb-2">Renta Mensual Sostenible</p>
                                            <p className="text-5xl font-bold tracking-tight">{currencyFormatter.format(rentaVitalicia)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* INFO BOX */}
                            <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-6">
                                <h4 className="text-[#2C3E50] font-bold text-sm mb-2 flex items-center gap-2">
                                    <span>ℹ️</span> Nota Importante
                                </h4>
                                <p className="text-slate-500 text-xs leading-relaxed">
                                    Los cálculos son estimaciones basadas en los parámetros introducidos. La fiscalidad aplicada corresponde a una aproximación de IRPF Bizkaia 2024. Se recomienda consultar con un asesor.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* PLANIFICACION COMPLETA / PUBLIC PENSION */}
                    {isPensionPublicaEnabled && (
                        <div className="bg-white border border-slate-100 rounded-xl shadow-sm p-8 md:p-10 animate-fade-in-up">
                            <div className="mb-8 text-center">
                                <h2 className="text-[#2C3E50] text-3xl font-light tracking-tight mb-2">Planificación Global</h2>
                                <p className="text-slate-400">Renta Privada + Pensión Pública</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-12 items-start">
                                <div className="space-y-4">
                                    <h3 className="text-[#A07147] font-bold uppercase tracking-widest text-xs">Pens. Pública Estimada</h3>
                                    <p className="text-slate-500 text-sm mb-4">
                                        Introduce tu pensión pública para calcular el neto real disponible.
                                    </p>
                                    <a href="https://prestaciones.seg-social.es/simulador-servicio/simulador-pension-jubilacion.html"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 bg-[#003399]/10 text-[#003399] px-4 py-3 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-[#003399] hover:text-white transition-all duration-300 border border-[#003399]/20 w-full justify-center group mb-2">
                                        <span>Utiliza el simulador oficial de la Seguridad Social para conocer los datos de tu pensión</span>
                                        <span className="group-hover:translate-x-1 transition-transform">↗</span>
                                    </a>
                                    <div className="relative max-w-xs">
                                        <input
                                            type="number"
                                            value={pensionPublica || ''}
                                            onChange={(e) => setPensionPublica(parseFloat(e.target.value))}
                                            className="w-full p-3 pl-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#003399] focus:border-[#003399] bg-slate-50 text-xl font-medium"
                                            placeholder="Ej: 1500"
                                        />
                                        <span className="absolute right-4 top-3.5 text-slate-400 font-light">EUR</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                                    <div className="flex justify-center mb-6">
                                        <div className="bg-white rounded-lg p-1 flex shadow-sm border border-slate-200">
                                            <button
                                                onClick={() => setViewMode('bruto')}
                                                className={`px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-md transition-all ${viewMode === 'bruto' ? 'bg-[#2C3E50] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Bruto
                                            </button>
                                            <button
                                                onClick={() => setViewMode('neto')}
                                                className={`px-4 py-1.5 text-sm font-bold uppercase tracking-wider rounded-md transition-all ${viewMode === 'neto' ? 'bg-[#2C3E50] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Neto
                                            </button>
                                        </div>
                                    </div>

                                    <div className="text-center">
                                        {viewMode === 'bruto' ? (
                                            <div className="space-y-6">
                                                <div>
                                                    <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Renta Total Mensual (Inicial)</p>
                                                    <p className="text-4xl font-bold text-[#2C3E50] tracking-tight">{currencyFormatter.format(rentaTotalInicial)}</p>
                                                </div>
                                                {rentaType !== 'vitaliciaSostenible' && (
                                                    <div>
                                                        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Renta Total Mensual (Final)</p>
                                                        <p className="text-3xl font-light text-[#2C3E50] tracking-tight">{currencyFormatter.format(rentaTotalFinal)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div>
                                                    <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Neto Mensual (Inicial)</p>
                                                    <p className="text-4xl font-bold text-[#27ae60] tracking-tight">{currencyFormatter.format(netoMenu.initial.netMonthly)}</p>
                                                    <p className="text-xs text-red-400 mt-1 font-medium">Impuestos est: -{currencyFormatter.format(netoMenu.initial.tax)}</p>
                                                </div>
                                                {rentaType !== 'vitaliciaSostenible' && (
                                                    <div className="pt-4 border-t border-slate-200">
                                                        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Neto Mensual (Final)</p>
                                                        <p className="text-3xl font-light text-[#27ae60] tracking-tight">{currencyFormatter.format(netoMenu.final.netMonthly)}</p>
                                                        <p className="text-xs text-red-400 mt-1 font-medium">Impuestos est: -{currencyFormatter.format(netoMenu.final.tax)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TABLE SECTION */}
                    {(rentaType === 'temporal' || rentaType === 'vitaliciaEV') && tableData.length > 0 && (
                        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-[#2C3E50] text-3xl font-light tracking-tight">Desglose Anual</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#F8FAFC]">
                                        <tr>
                                            <th className="py-3 px-6 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold text-center">Año</th>
                                            <th className="py-3 px-6 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold text-right">Renta Mensual</th>
                                            <th className="py-3 px-6 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold text-right">Balance Inicial</th>
                                            <th className="py-3 px-6 text-[#A07147] text-xs uppercase tracking-[0.2em] font-bold text-right">Balance Final</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {tableData.map((row) => (
                                            <tr key={row.year} className="hover:bg-slate-50 transition-colors">
                                                <td className="py-3 px-6 text-center text-[#2C3E50] font-medium">{row.year}</td>
                                                <td className="py-3 px-6 text-right text-slate-600 tabular-nums">{currencyFormatter.format(row.rental)}</td>
                                                <td className="py-3 px-6 text-right text-slate-600 tabular-nums">{currencyFormatter.format(row.balanceStart)}</td>
                                                <td className="py-3 px-6 text-right text-slate-600 tabular-nums">{currencyFormatter.format(row.balanceEnd)}</td>
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
    );
}

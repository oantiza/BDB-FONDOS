import React, { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import {
    getLifeExpectancy,
    calculateBizkaiaTax,
    calculateExemptionRatio,
    calculateEPSVNetoOneOff,
    formatCurrency,
    formatPercent,
    LIFE_EXPECTANCY_DATA
} from '../utils/retirementUtils';
import { ArrowRight, Calculator, Info, FileText, ArrowLeft, PieChart, TrendingUp, DollarSign, Settings, Download } from 'lucide-react';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';

type RentType = 'temporal' | 'vitaliciaSostenible' | 'vitaliciaEV';
type RescueMode = 'renta' | 'capital' | 'mixto';

export default function RetirementCalculatorPage({ onBack }: { onBack: () => void }) {
    // --- STATE ---
    const [view, setView] = useState<'MAIN' | 'PLANNING'>('MAIN');

    // Inputs
    const [ahorros, setAhorros] = useState<number>(0);
    const [revalorizacion, setRevalorizacion] = useState<number>(3.0);

    // EPSV
    const [epsvTotal, setEpsvTotal] = useState<number>(0);
    const [epsvBeneficio, setEpsvBeneficio] = useState<number>(0);
    const [rescueMode, setRescueMode] = useState<RescueMode>('renta');
    const [pctCapital, setPctCapital] = useState<number>(50); // % for mixed mode

    // Rent Config
    const [rentType, setRentType] = useState<RentType>('temporal');
    const [years, setYears] = useState<number>(25);
    const [updateRate, setUpdateRate] = useState<number>(1.0); // Actualización anual renta

    // Life Expectancy
    const [age, setAge] = useState<number>(65);
    const [sex, setSex] = useState<'male' | 'female'>('male');
    const [updateRateEV, setUpdateRateEV] = useState<number>(1.0);

    // Planning
    const [pensionPublica, setPensionPublica] = useState<number>(1500); // Default to a reasonable amount

    // --- CALCULATIONS ---
    const results = useMemo(() => {
        // 1. EPSV Rescue Logic
        let epsvRenta = 0;
        let epsvCash = 0; // Net immediate cash

        // Simulación básica de rescate capital (reducción 40% Bizkaia si > 2 años)
        // La calculadora HTML original simplificaba esto mostrando el BRUTO rescatado en capital 
        // y calculando el neto aparte para visualización. Seguiremos esa lógica.

        let epsvRescatadoBruto = 0;

        if (rescueMode === 'renta') {
            epsvRenta = epsvTotal;
        } else if (rescueMode === 'capital') {
            epsvRescatadoBruto = epsvTotal;
        } else if (rescueMode === 'mixto') {
            epsvRescatadoBruto = epsvTotal * (pctCapital / 100);
            epsvRenta = epsvTotal * (1 - pctCapital / 100);
        }

        // Neto inmediato estimada (solo visual)
        const epsvCashNeto = calculateEPSVNetoOneOff(epsvRescatadoBruto, 0); // Asumiendo 0 de pensión base para el cálculo marginal inicial

        // 2. Capital Total for Rent
        const totalCapitalForRent = ahorros + epsvRenta;

        // 3. Rent Calculation
        let n_val = 0;
        let g_val = 0;
        let i_val = revalorizacion / 100;

        if (rentType === 'temporal') {
            n_val = years;
            g_val = updateRate / 100;
        } else if (rentType === 'vitaliciaEV') {
            n_val = getLifeExpectancy(age, sex);
            g_val = updateRateEV / 100;
        } else { // Sostenible
            n_val = 100; // Perpetuidad práctica
            g_val = 0;
        }

        let rentaInicialAnnual = 0;

        if (rentType === 'vitaliciaSostenible') {
            // Renta Perpetua Simple: R = C * i
            rentaInicialAnnual = totalCapitalForRent * i_val;
        } else {
            // Geométrica Temporal
            if (Math.abs(i_val - g_val) < 0.0001) {
                rentaInicialAnnual = totalCapitalForRent * (1 + i_val) / n_val; // Aprox para i=g
            } else {
                const factor = (1 + g_val) / (1 + i_val);
                const denominador = 1 - Math.pow(factor, n_val);
                rentaInicialAnnual = (totalCapitalForRent * (i_val - g_val)) / denominador;
            }
        }

        const rentaInicialMensual = Math.max(0, rentaInicialAnnual / 12);
        const rentaFinalMensual = rentaInicialMensual * Math.pow(1 + g_val, n_val - 1);

        // 4. Fiscal Ratios
        const ratioExento = calculateExemptionRatio(epsvTotal, epsvBeneficio);
        const ratioEpsvEnRenta = totalCapitalForRent > 0 ? (epsvRenta / totalCapitalForRent) : 0;

        return {
            rentaInicialMensual,
            rentaFinalMensual,
            epsvCashNeto,
            epsvRescatadoBruto,
            totalCapitalForRent,
            ratioExento,
            ratioEpsvEnRenta,
            years: n_val,
            growth: g_val
        };

    }, [ahorros, revalorizacion, epsvTotal, epsvBeneficio, rescueMode, pctCapital, rentType, years, updateRate, age, sex, updateRateEV]);


    // --- PDF GENERATION ---
    const generatePDF = async () => {
        const element = document.getElementById('view-planning-content');
        if (!element) return;

        // Add specific PDF class for styling overrides
        element.classList.add('pdf-mode');

        // Ensure background is white for capture
        const oldBg = element.style.backgroundColor;
        element.style.backgroundColor = '#ffffff';

        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 0.98);

            const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Handle multi-page if needed (simple single page scaling for now)
            if (pdfHeight > 297) {
                // If excessively long, just fit to page or split (advanced logic omitted for brevity, fit width usually works for reports)
            }

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('Planificacion_Jubilacion.pdf');
        } catch (error) {
            console.error("PDF generation failed:", error);
            alert("Error al generar el PDF. Por favor, inténtalo de nuevo.");
        } finally {
            element.classList.remove('pdf-mode');
            element.style.backgroundColor = oldBg;
        }
    };


    // --- RENDER ---
    // Layout: Full Height Flex Container with Scrollable Content Area for robust scrolling inside App shell.
    return (
        <div className="flex flex-col h-screen bg-gray-50 font-sans text-slate-800 overflow-hidden">
            {/* Header - Static Flex Item */}
            <div className="z-50 shrink-0 bg-gray-900 shadow-md">
                <Header onBack={onBack} onLogout={() => { }} />
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth">
                {/* Main Container Wrapper */}
                <div className="flex flex-col items-center justify-start min-h-full pb-16">

                    {view === 'MAIN' ? (
                        <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
                            {/* Header Section */}
                            <div className="text-center mt-4 md:mt-8">
                                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-2">Simulador de Jubilación</h1>
                                <p className="text-gray-600 text-xl">Estima tu renta mensual durante la jubilación.</p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-xl overflow-hidden md:grid md:grid-cols-2">

                                {/* INPUTS COLUMN */}
                                <div className="p-6 md:p-8 space-y-8 flex flex-col bg-white">

                                    {/* 1. Tipo Renta */}
                                    <div>
                                        <label className="font-semibold text-gray-700 block mb-3 text-lg">1. Elige el tipo de renta</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {[
                                                { id: 'temporal', label: 'Temporal' },
                                                { id: 'vitaliciaSostenible', label: 'Vitalicia (Sostenible)' },
                                                { id: 'vitaliciaEV', label: 'Vitalicia (Esp. Vida)' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setRentType(opt.id as RentType)}
                                                    className={`w-full py-3 px-2 border rounded-lg font-semibold text-sm transition-all ${rentType === opt.id
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300 ring-opacity-50'
                                                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. Ahorros */}
                                    <div className="space-y-6">
                                        <div>
                                            <label className="font-semibold text-gray-700 text-base block mb-2">2. Ahorros para la Jubilación (€)</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-400">€</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={ahorros || ''}
                                                    onChange={e => setAhorros(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-8 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-xl"
                                                    placeholder="Ej: 300000"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="flex justify-between font-semibold text-gray-700 text-base mb-2">
                                                <span>3. Revalorización Anual de Ahorros (%)</span>
                                                <span className="font-bold text-blue-600 text-lg">{revalorizacion}%</span>
                                            </label>
                                            <input
                                                type="range" min="0" max="15" step="0.1"
                                                value={revalorizacion}
                                                onChange={e => setRevalorizacion(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                        </div>
                                    </div>

                                    {/* EPSV Config */}
                                    <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="font-bold text-gray-800 text-lg">Configuración EPSV</label>
                                            <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Opcional</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="text-sm font-semibold text-gray-600 block mb-1">Total EPSV (€)</label>
                                                <input
                                                    type="number" value={epsvTotal || ''}
                                                    onChange={e => setEpsvTotal(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 text-lg"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-semibold text-gray-600 block mb-1">Beneficio (€)</label>
                                                <input
                                                    type="number" value={epsvBeneficio || ''}
                                                    onChange={e => setEpsvBeneficio(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-green-500 text-lg"
                                                    placeholder="0"
                                                />
                                                <p className="text-[10px] text-gray-400 mt-1">Beneficio incluido en el total.</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-sm font-semibold text-gray-600 block">Modalidad de Rescate EPSV preferida</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['renta', 'capital', 'mixto'].map((mode) => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => setRescueMode(mode as RescueMode)}
                                                        className={`py-2 border rounded-lg text-sm font-medium transition-all ${rescueMode === mode
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                                    </button>
                                                ))}
                                            </div>

                                            {rescueMode === 'mixto' && (
                                                <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 animate-fade-in-down">
                                                    <label className="flex justify-between text-xs font-bold text-gray-700 mb-2">
                                                        <span>% Rescatado en Capital</span>
                                                        <span className="text-blue-600">{pctCapital}%</span>
                                                    </label>
                                                    <input
                                                        type="range" min="0" max="100"
                                                        value={pctCapital}
                                                        onChange={e => setPctCapital(parseInt(e.target.value))}
                                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Dynamic Fields based on RentType */}
                                    {rentType === 'temporal' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <div>
                                                <label className="flex justify-between font-semibold text-gray-700 text-base mb-2">
                                                    <span>4. Años de Cobro</span>
                                                    <span className="font-bold text-blue-600 text-lg">{years} años</span>
                                                </label>
                                                <input type="range" min="1" max="50" value={years} onChange={e => setYears(parseInt(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                            <div>
                                                <label className="flex justify-between font-semibold text-gray-700 text-base mb-2">
                                                    <span>5. Actualización Anual de Renta (%)</span>
                                                    <span className="font-bold text-blue-600 text-lg">{updateRate}%</span>
                                                </label>
                                                <input type="range" min="0" max="10" step="0.1" value={updateRate} onChange={e => setUpdateRate(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                        </div>
                                    )}

                                    {rentType === 'vitaliciaEV' && (
                                        <div className="space-y-6 animate-fade-in">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="font-semibold text-gray-700 text-base block mb-2">4. Edad Actual</label>
                                                    <input type="number" value={age} onChange={e => setAge(parseInt(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg text-lg" placeholder="Ej: 65" />
                                                </div>
                                                <div>
                                                    <label className="font-semibold text-gray-700 text-base block mb-2">5. Sexo</label>
                                                    <select value={sex} onChange={e => setSex(e.target.value as 'male' | 'female')} className="w-full p-2 border border-gray-300 rounded-lg text-lg bg-white">
                                                        <option value="male">Hombre</option>
                                                        <option value="female">Mujer</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="flex justify-between font-semibold text-gray-700 text-base mb-2">
                                                    <span>6. Actualización Anual de Renta (%)</span>
                                                    <span className="font-bold text-blue-600 text-lg">{updateRateEV}%</span>
                                                </label>
                                                <input type="range" min="0" max="10" step="0.1" value={updateRateEV} onChange={e => setUpdateRateEV(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {/* RESULTS COLUMN */}
                                <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white p-8 flex flex-col items-center justify-center relative">
                                    <div className="w-full max-w-md text-center space-y-8">
                                        <h2 className="text-3xl font-bold mb-4">
                                            {rentType === 'temporal' && `Renta Temporal (${results.years} años)`}
                                            {rentType === 'vitaliciaSostenible' && `Renta Vitalicia Sostenible`}
                                            {rentType === 'vitaliciaEV' && `Vitalicia (Esperanza ${results.years.toFixed(1)} años)`}
                                        </h2>

                                        {/* EPSV Cash Result */}
                                        {(rescueMode === 'capital' || rescueMode === 'mixto') && (
                                            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 w-full shadow-lg mb-6 hover:scale-105 transition-transform">
                                                <h3 className="text-sm font-bold uppercase tracking-wider opacity-90 text-yellow-300 mb-1">Capital Neto Inmediato (EPSV)</h3>
                                                <p className="text-4xl font-extrabold tracking-tight text-white mb-2">{formatCurrency(results.epsvCashNeto)}</p>
                                                <p className="text-xs text-blue-100 opacity-80">Cobro único inicial (Neto Estimado)</p>
                                            </div>
                                        )}

                                        {/* Rent Result */}
                                        <div className="space-y-4">
                                            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 w-full md:w-3/4 mx-auto">
                                                <h3 className="text-lg font-medium opacity-80">Renta Privada Mensual {rentType !== 'vitaliciaSostenible' && 'Inicial'}</h3>
                                                <p className="text-4xl font-bold tracking-tight mt-1">{formatCurrency(results.rentaInicialMensual)}</p>
                                            </div>

                                            {rentType !== 'vitaliciaSostenible' && (
                                                <div className="bg-black/20 backdrop-blur-sm rounded-xl p-4 w-full md:w-3/4 mx-auto">
                                                    <h3 className="text-lg font-medium opacity-80">Renta Privada Final</h3>
                                                    <p className="text-4xl font-bold tracking-tight mt-1">{formatCurrency(results.rentaFinalMensual)}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Button */}
                                        <button
                                            onClick={() => {
                                                if (results.totalCapitalForRent <= 0) {
                                                    alert("Introduce un ahorro válido para continuar.");
                                                    return;
                                                }
                                                setView('PLANNING');
                                                // Scroll to top handled by React re-render, but ensuring it within container helps
                                                // Since we have a scroll container, we rely on layout change.
                                            }}
                                            className="mt-8 w-full bg-white text-blue-600 font-bold py-4 px-6 rounded-xl shadow-lg hover:bg-gray-100 transition transform hover:scale-105 flex items-center justify-center gap-2 text-lg"
                                        >
                                            <Settings className="w-5 h-5" />
                                            PLANIFICACIÓN COMPLETA
                                        </button>
                                        <p className="text-xs text-blue-100 mt-3 opacity-90 italic">* Incluye pensión pública y fiscalidad detallada.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // VIEW: PLANNING
                        <div id="view-planning" className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-20"> {/* pb-20 for extra scroll space */}

                            {/* Planning Header */}
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <button onClick={() => setView('MAIN')} className="flex items-center text-blue-600 hover:text-blue-800 font-semibold transition group">
                                    <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" /> Volver al Simulador
                                </button>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={generatePDF}
                                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow transition flex items-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" /> Descargar Informe PDF
                                    </button>
                                </div>
                            </div>

                            {/* Wrap Content for PDF Capture */}
                            <div id="view-planning-content" className="space-y-8 p-4 bg-transparent">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Panel Left */}
                                    <div className="bg-white/95 backdrop-blur rounded-2xl p-6 md:p-8 space-y-6 shadow-lg border border-white/50">
                                        <h2 className="text-xl font-bold text-gray-800 border-b pb-3 border-gray-200 flex items-center gap-2">
                                            <Settings className="w-5 h-5 text-blue-500" /> Integración Pensión Pública
                                        </h2>

                                        <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                                            <label className="block text-sm font-semibold text-blue-700 mb-2">Tu Renta Privada (Calculada)</label>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-bold text-blue-900">{formatCurrency(results.rentaInicialMensual)}</span>
                                                <span className="text-sm text-blue-600">/mes</span>
                                            </div>
                                            <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
                                                <Info className="w-3 h-3" /> Parte exenta de impuestos: <span className="font-bold">{formatPercent(results.ratioExento)}</span> (Considerando exención de ahorros)
                                            </p>
                                        </div>

                                        <div>
                                            <label className="flex items-center text-lg font-bold text-gray-800 mb-3">
                                                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-2 text-green-600"><TrendingUp className="w-4 h-4" /></div>
                                                Añadir Pensión Pública (Mensual)
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">€</div>
                                                <input
                                                    type="number" value={pensionPublica || ''}
                                                    onChange={e => setPensionPublica(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-8 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                                                    placeholder="1500"
                                                />
                                            </div>
                                            <a href="https://sede-tu.seg-social.gob.es/" target="_blank" rel="noreferrer" className="flex items-center text-xs text-blue-500 hover:text-blue-700 mt-2 font-medium">
                                                Consultar simulador oficial Seguridad Social ↗
                                            </a>
                                        </div>
                                    </div>

                                    {/* Panel Right - Results */}
                                    {(() => {
                                        const rentaPrivadaAnual = results.rentaInicialMensual * 12;
                                        const pensionPublicaAnual = pensionPublica * 14;

                                        // Fiscal Calc (UPDATED: Treating savings as exempt)
                                        const rentaAnualEPSV = rentaPrivadaAnual * results.ratioEpsvEnRenta;
                                        const rentaAnualLibre = rentaPrivadaAnual - rentaAnualEPSV;

                                        // New Logic: 
                                        // parteExenta includes the exempt part of EPSV AND all non-EPSV rent (Savings)
                                        const parteExentaEPSV = rentaAnualEPSV * results.ratioExento;
                                        const parteExenta = parteExentaEPSV + rentaAnualLibre;

                                        // parteSujeta is ONLY the taxable part of EPSV
                                        const parteSujeta = rentaAnualEPSV * (1 - results.ratioExento);

                                        const ingresosBrutos = pensionPublicaAnual + parteSujeta;
                                        const totalImpuestos = calculateBizkaiaTax(ingresosBrutos);
                                        const tipoMedio = ingresosBrutos > 0 ? totalImpuestos / ingresosBrutos : 0;

                                        const netoAnual = (rentaPrivadaAnual + pensionPublicaAnual) - totalImpuestos;
                                        const netoMensual = netoAnual / 12;

                                        return (
                                            <div className="bg-gradient-to-br from-indigo-700 to-blue-600 rounded-2xl p-6 md:p-8 text-white flex flex-col justify-center shadow-lg relative overflow-hidden">
                                                <h2 className="text-2xl font-bold mb-1">Total Neto Mensual</h2>
                                                <p className="text-sm text-blue-100 mb-6 opacity-80 uppercase tracking-widest">Disponible para gastar</p>

                                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-6 relative">
                                                    <span className="text-5xl md:text-6xl font-extrabold tracking-tight block text-center shadow-sm text-white drop-shadow-lg">
                                                        {formatCurrency(netoMensual)}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                                                    <div className="bg-black/20 rounded-lg p-3">
                                                        <span className="block text-blue-200 text-xs uppercase">Bruto Mensual</span>
                                                        <span className="block font-bold text-lg">{formatCurrency((rentaPrivadaAnual + pensionPublicaAnual) / 12)}</span>
                                                    </div>
                                                    <div className="bg-black/20 rounded-lg p-3">
                                                        <span className="block text-blue-200 text-xs uppercase">Neto Anual</span>
                                                        <span className="block font-bold text-lg">{formatCurrency(netoAnual)}</span>
                                                    </div>
                                                    <div className="bg-black/20 rounded-lg p-3">
                                                        <span className="block text-blue-200 text-xs uppercase">Bruto Anual</span>
                                                        <span className="block font-bold text-lg">{formatCurrency(rentaPrivadaAnual + pensionPublicaAnual)}</span>
                                                    </div>
                                                    <div className="bg-black/20 rounded-lg p-3">
                                                        <span className="block text-red-200 text-xs uppercase">IRPF Anual</span>
                                                        <span className="block font-bold text-lg text-red-100">-{formatCurrency(totalImpuestos)}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-white/10 rounded-lg p-3 flex justify-between items-center">
                                                    <span className="text-xs uppercase tracking-wide font-bold">Tipo Medio Efectivo</span>
                                                    <span className="text-2xl font-bold text-yellow-300">{formatPercent(tipoMedio)}</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* FINAL REPORT SECTION */}
                                <div className="bg-white rounded-2xl shadow-xl overflow-hidden mt-8">
                                    <div className="bg-gradient-to-r from-gray-800 to-gray-700 p-6 text-white border-l-4 border-yellow-500">
                                        <h2 className="text-2xl font-bold flex items-center gap-2">
                                            <PieChart className="w-6 h-6 text-yellow-500" /> Informe Fiscal Detallado
                                        </h2>
                                        <p className="text-sm text-gray-300 mt-1 opacity-80">Norma Foral 2/2025 · Ejercicio 2026 · Bizkaia</p>
                                    </div>

                                    {/* Report Body */}
                                    <div className="p-6 md:p-8">
                                        {(() => {
                                            // Re-calc for report body (same updated logic)
                                            const rentaPrivadaAnual = results.rentaInicialMensual * 12;
                                            const pensionPublicaAnual = pensionPublica * 14;

                                            const rentaAnualEPSV = rentaPrivadaAnual * results.ratioEpsvEnRenta;
                                            const rentaAnualLibre = rentaPrivadaAnual - rentaAnualEPSV;

                                            // Exempt: EPSV Excluded + Private Savings
                                            const parteExentaEPSV = rentaAnualEPSV * results.ratioExento;
                                            const parteExenta = parteExentaEPSV + rentaAnualLibre;

                                            // Taxable: Only taxable EPSV
                                            const parteSujeta = rentaAnualEPSV * (1 - results.ratioExento);

                                            const ingresosBrutos = pensionPublicaAnual + parteSujeta;
                                            const totalImpuestos = calculateBizkaiaTax(ingresosBrutos);

                                            const totalIngresosReales = rentaPrivadaAnual + pensionPublicaAnual;

                                            const parteExentaPct = totalIngresosReales > 0 ? (parteExenta / totalIngresosReales) * 100 : 0;
                                            const pensionPct = totalIngresosReales > 0 ? (pensionPublicaAnual / totalIngresosReales) * 100 : 0;
                                            const privadoSujetoPct = totalIngresosReales > 0 ? (parteSujeta / totalIngresosReales) * 100 : 0;

                                            // Correct pct calculation base (Use TRUE Total Income)
                                            // Actually, total income = Pension + Private Rent.
                                            // Private Rent = Exenta + Sujeta.
                                            // So percentages should sum to 100%.

                                            return (
                                                <div className="space-y-8">
                                                    {/* Summary Cards */}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ingresos Totales (Brutos)</h3>
                                                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(rentaPrivadaAnual + pensionPublicaAnual)}</p>
                                                            <p className="text-xs text-gray-400 mt-1">Pensión: {formatCurrency(pensionPublicaAnual)} | Privado: {formatCurrency(rentaPrivadaAnual)}</p>
                                                        </div>
                                                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cuota Líquida IRPF</h3>
                                                            <p className="text-2xl font-bold text-red-600">-{formatCurrency(totalImpuestos)}</p>
                                                            <p className="text-xs text-red-400 mt-1">Tras bonificaciones Bizkaia</p>
                                                        </div>
                                                        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                                                            <h3 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">Rentabilidad Exenta Total</h3>
                                                            <p className="text-2xl font-bold text-green-700">{formatCurrency(parteExenta)}</p>
                                                            <p className="text-xs text-green-600 mt-1">Incluye Ahorros y parte EPSV exenta</p>
                                                        </div>
                                                    </div>

                                                    {/* Visual Fiscal Bar */}
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Composición Fiscal de tus Ingresos</h3>
                                                        <div className="h-12 flex rounded-lg overflow-hidden text-xs font-bold text-white shadow-sm">
                                                            {parteExentaPct > 0 && (
                                                                <div style={{ width: `${parteExentaPct}%` }} className="bg-green-500 flex items-center justify-center relative group">
                                                                    <span className="truncate px-1">Exento</span>
                                                                    <div className="absolute bottom-full mb-1 bg-gray-800 text-white p-2 rounded text-xs hidden group-hover:block whitespace-nowrap z-10">
                                                                        Exento: {formatCurrency(parteExenta)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {privadoSujetoPct > 0 && (
                                                                <div style={{ width: `${privadoSujetoPct}%` }} className="bg-orange-400 flex items-center justify-center relative group">
                                                                    <span className="truncate px-1">Privado Sujeto</span>
                                                                    <div className="absolute bottom-full mb-1 bg-gray-800 text-white p-2 rounded text-xs hidden group-hover:block whitespace-nowrap z-10">
                                                                        Sujeto: {formatCurrency(parteSujeta)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {pensionPct > 0 && (
                                                                <div style={{ width: `${pensionPct}%` }} className="bg-blue-500 flex items-center justify-center relative group">
                                                                    <span className="truncate px-1">Pensión Pública</span>
                                                                    <div className="absolute bottom-full mb-1 bg-gray-800 text-white p-2 rounded text-xs hidden group-hover:block whitespace-nowrap z-10">
                                                                        Pensión: {formatCurrency(pensionPublicaAnual)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                                                            <span>0%</span>
                                                            <span>100% (Ingresos Totales)</span>
                                                        </div>
                                                    </div>

                                                    {/* Projection Table */}
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Proyección Anual Estimada</h3>
                                                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                                                            <table className="min-w-full text-sm">
                                                                <thead className="bg-gray-50 text-gray-500">
                                                                    <tr>
                                                                        <th className="px-3 py-2 text-left font-semibold">Año</th>
                                                                        <th className="px-3 py-2 text-right font-semibold">Renta Priv.</th>
                                                                        <th className="px-3 py-2 text-right font-semibold text-blue-600">Pensión Púb.</th>
                                                                        <th className="px-3 py-2 text-right font-semibold text-green-600">Exento</th>
                                                                        <th className="px-3 py-2 text-right font-semibold text-orange-600">Base IRPF</th>
                                                                        <th className="px-3 py-2 text-right font-semibold text-red-500">Cuota IRPF</th>
                                                                        <th className="px-3 py-2 text-right font-bold text-gray-800">Neto Mensual</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {Array.from({ length: Math.min(results.years, 30) }, (_, i) => i + 1).map(year => {
                                                                        // Growth logic
                                                                        const growthFactor = Math.pow(1 + results.growth, year - 1);
                                                                        const pensionGrowth = Math.pow(1.02, year - 1); // 2% IPC calc

                                                                        const r_actual = rentaPrivadaAnual * growthFactor;
                                                                        const p_actual = pensionPublicaAnual * pensionGrowth;

                                                                        // UPDATED LOOP LOGIC
                                                                        const exento = (r_actual * results.ratioEpsvEnRenta * results.ratioExento) + (r_actual * (1 - results.ratioEpsvEnRenta));
                                                                        const sujeto = (r_actual * results.ratioEpsvEnRenta * (1 - results.ratioExento));

                                                                        const base = p_actual + sujeto;
                                                                        const tax = calculateBizkaiaTax(base);
                                                                        const net = (r_actual + p_actual) - tax;

                                                                        // Show Year 1, then every 5 years
                                                                        if (year !== 1 && year % 5 !== 0) return null;

                                                                        return (
                                                                            <tr key={year} className="hover:bg-gray-50">
                                                                                <td className="px-3 py-2 font-medium text-gray-900">{year}</td>
                                                                                <td className="px-3 py-2 text-right">{formatCurrency(r_actual)}</td>
                                                                                <td className="px-3 py-2 text-right text-blue-600">{formatCurrency(p_actual)}</td>
                                                                                <td className="px-3 py-2 text-right text-green-600">{formatCurrency(exento)}</td>
                                                                                <td className="px-3 py-2 text-right text-orange-600">{formatCurrency(base)}</td>
                                                                                <td className="px-3 py-2 text-right text-red-500">-{formatCurrency(tax)}</td>
                                                                                <td className="px-3 py-2 text-right font-bold text-gray-900">{formatCurrency(net / 12)}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {/* Legal Disclaimer */}
                                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs text-yellow-800">
                                                        <p className="font-bold mb-1">Consideraciones Legales (Bizkaia 2026):</p>
                                                        <ul className="list-disc ml-4 space-y-1 opacity-90">
                                                            <li>Cálculos basados en <strong>Norma Foral 2/2025</strong> y NF 13/2013 (IRPF Bizkaia).</li>
                                                            <li>Bonificación de Rendimientos del Trabajo y Minoración de Cuota (1.615€) aplicadas según normativa.</li>
                                                            <li>La rentabilidad acumulada en EPSV está exenta si se cobra en forma de renta (&gt; 15 años).</li>
                                                            <li>Simulación meramente informativa, no vinculante.</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>

                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

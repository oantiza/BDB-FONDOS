import React, { useState, useMemo } from 'react';
import Header from '../components/Header';
import {
    getLifeExpectancy,
    calculateBizkaiaTax,
    calculateEPSVNetoAdvanced, 
    formatCurrency,
    formatPercent,
    LIFE_EXPECTANCY_DATA
} from '../utils/retirementUtils';
import { ArrowLeft, PieChart, TrendingUp, Settings, FileText, Info, Calculator, ExternalLink } from 'lucide-react';
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { ROBOTO_FLEX_REGULAR } from '../utils/fonts';

type RentType = 'temporal' | 'vitaliciaSostenible' | 'vitaliciaEV';
type RescueMode = 'renta' | 'capital' | 'mixto';

export default function RetirementCalculatorPage({ onBack }: { onBack: () => void }) {
    // --- STATE ---
    const [view, setView] = useState<'MAIN' | 'PLANNING'>('MAIN');

    // Inputs Generales
    const [ahorros, setAhorros] = useState<number>(0);
    const [revalorizacion, setRevalorizacion] = useState<number>(3.0);

    // EPSV (Adaptado a Reforma 2026 - Con desglose total de rentabilidad)
    const [esPrimerRescate, setEsPrimerRescate] = useState<boolean>(true);
    const [conoceRentabilidad, setConoceRentabilidad] = useState<boolean>(false);
    
    // Masa A (Pre-2026)
    const [epsvPre2026, setEpsvPre2026] = useState<number>(0);
    const [rentabilidadPre2026, setRentabilidadPre2026] = useState<number>(0);
    const [aniosAntiguedadPre2026, setAniosAntiguedadPre2026] = useState<number>(0);

    // Masa B (Post-2026)
    const [epsvPost2026, setEpsvPost2026] = useState<number>(0);
    const [rentabilidadPost2026, setRentabilidadPost2026] = useState<number>(0);
    const [aniosAntiguedadPost2026, setAniosAntiguedadPost2026] = useState<number>(0);

    const [rescueMode, setRescueMode] = useState<RescueMode>('renta');
    const [pctCapital, setPctCapital] = useState<number>(50);

    // Rent Config
    const [rentType, setRentType] = useState<RentType>('temporal');
    const [years, setYears] = useState<number>(25);
    const [updateRate, setUpdateRate] = useState<number>(1.0); 

    // Life Expectancy
    const [age, setAge] = useState<number>(65);
    const [sex, setSex] = useState<'male' | 'female'>('male');
    const [updateRateEV, setUpdateRateEV] = useState<number>(1.0);

    // Planning
    const [pensionPublica, setPensionPublica] = useState<number>(1500); 

    // --- CALCULATIONS ---
    const results = useMemo(() => {
        const totalEpsv = epsvPre2026 + epsvPost2026;
        let epsvRenta = 0;
        let epsvRescatadoBruto = 0;
        let pctCap = 0;

        if (rescueMode === 'renta') {
            epsvRenta = totalEpsv;
            pctCap = 0;
        } else if (rescueMode === 'capital') {
            epsvRescatadoBruto = totalEpsv;
            pctCap = 1;
        } else if (rescueMode === 'mixto') {
            pctCap = pctCapital / 100;
            epsvRescatadoBruto = totalEpsv * pctCap;
            epsvRenta = totalEpsv * (1 - pctCap);
        }

        const paramsRescateCapital = {
            amountPre2026: epsvPre2026 * pctCap,
            amountPost2026: epsvPost2026 * pctCap,
            rentabilidadPost2026: conoceRentabilidad ? (rentabilidadPost2026 * pctCap) : undefined,
            aniosAntiguedadPost2026: aniosAntiguedadPost2026,
            pensionPublicaAnual: 0, 
            esPrimerRescate: esPrimerRescate
        };
        const epsvCashNeto = epsvRescatadoBruto > 0 ? calculateEPSVNetoAdvanced(paramsRescateCapital).rescateNeto : 0;

        const totalCapitalForRent = ahorros + epsvRenta;

        let n_val = 0;
        let g_val = 0;
        let i_val = revalorizacion / 100;

        if (rentType === 'temporal') {
            n_val = years;
            g_val = updateRate / 100;
        } else if (rentType === 'vitaliciaEV') {
            n_val = getLifeExpectancy(age, sex);
            g_val = updateRateEV / 100;
        } else {
            n_val = 100; 
            g_val = 0;
        }

        let rentaInicialAnnual = 0;
        if (rentType === 'vitaliciaSostenible') {
            rentaInicialAnnual = totalCapitalForRent * i_val;
        } else {
            if (Math.abs(i_val - g_val) < 0.0001) {
                rentaInicialAnnual = totalCapitalForRent * (1 + i_val) / n_val; 
            } else {
                const factor = (1 + g_val) / (1 + i_val);
                const denominador = 1 - Math.pow(factor, n_val);
                rentaInicialAnnual = (totalCapitalForRent * (i_val - g_val)) / denominador;
            }
        }

        const rentaInicialMensual = Math.max(0, rentaInicialAnnual / 12);
        const rentaFinalMensual = rentaInicialMensual * Math.pow(1 + g_val, n_val - 1);

        let rentabilidadRentaTotal = 0;
        if (epsvPre2026 > 0) {
            const estimacionPre = aniosAntiguedadPre2026 > 0 ? Math.min(0.01 * aniosAntiguedadPre2026, 0.35) : 0.25;
            const rentPre = conoceRentabilidad ? rentabilidadPre2026 : (epsvPre2026 * estimacionPre);
            rentabilidadRentaTotal += (rentPre * (1 - pctCap));
        }
        if (epsvPost2026 > 0) {
            const estimacionPost = aniosAntiguedadPost2026 > 0 ? Math.min(0.01 * aniosAntiguedadPost2026, 0.35) : 0.25;
            const rentPost = conoceRentabilidad ? rentabilidadPost2026 : (epsvPost2026 * estimacionPost);
            rentabilidadRentaTotal += (rentPost * (1 - pctCap));
        }

        const isExempt = rentType !== 'temporal' || years >= 15;
        const ratioExento = (isExempt && epsvRenta > 0) ? (rentabilidadRentaTotal / epsvRenta) : 0;
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
            growth: g_val,
            totalEpsv
        };
    }, [ahorros, revalorizacion, epsvPre2026, rentabilidadPre2026, aniosAntiguedadPre2026, epsvPost2026, rentabilidadPost2026, aniosAntiguedadPost2026, esPrimerRescate, conoceRentabilidad, rescueMode, pctCapital, rentType, years, updateRate, age, sex, updateRateEV]);


    // --- PDF GENERATION (MOTOR BANCA PRIVADA NATIVO) ---
    const generatePDF = async () => {
        try {
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            let pageNum = 1;

            const addFooter = (p: jsPDF, n: number) => {
                const pageHeight = p.internal.pageSize.getHeight();
                p.setFontSize(10);
                p.setTextColor(148, 163, 184); // slate-400
                p.setFont("RobotoFlex", "normal");
                const numStr = n < 10 ? `0${n}` : `${n}`;
                p.text(numStr, 195, pageHeight - 10);
            };

            // Regitrar fuente Roboto Flex
            pdf.addFileToVFS("RobotoFlex-Regular.ttf", ROBOTO_FLEX_REGULAR);
            pdf.addFont("RobotoFlex-Regular.ttf", "RobotoFlex", "normal");
            
            // --- PALETA DE COLORES X-RAY ---
            const colorTitulo: [number, number, number] = [0, 51, 153];    // #003399
            const colorCuerpo: [number, number, number] = [11, 37, 69];    // #0B2545
            const colorAcento: [number, number, number] = [212, 175, 55];  // Dorado #D4AF37
            const colorBorde: [number, number, number] = [219, 234, 254];  // Blue-100 #dbeafe
            const colorFondo: [number, number, number] = [239, 246, 255];  // Blue-50 #eff6ff
            const colorGris: [number, number, number] = [100, 116, 139];   // Slate-500

            // --- CABECERA (Estilo X-Ray) ---
            // Simulamos el degradado suave Blue-50 -> White
            for (let i = 0; i < 40; i++) {
                const ratio = i / 40;
                const r = Math.floor(colorFondo[0] + (255 - colorFondo[0]) * ratio);
                const g = Math.floor(colorFondo[1] + (255 - colorFondo[1]) * ratio);
                const b = Math.floor(colorFondo[2] + (255 - colorFondo[2]) * ratio);
                pdf.setFillColor(r, g, b);
                pdf.rect(0, i, 210, 1, 'F');
            }
            
            // Línea de borde inferior de cabecera
            pdf.setDrawColor(...colorBorde);
            pdf.line(0, 40, 210, 40);

            // Branding "O.A.A. / Independent Private Bankers"
            pdf.setTextColor(30, 41, 59); // Slate-800
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(18);
            pdf.text("O.A.A.", 15, 12);
            
            const oaaWidth = pdf.getTextWidth("O.A.A.");
            pdf.setTextColor(...colorTitulo);
            pdf.text("/", 15 + oaaWidth + 2, 12);
            
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "bold");
            pdf.text("INDEPENDENT PRIVATE BANKERS", 15 + oaaWidth + 6, 11);

            // Título Principal (Línea Vertical + Texto)
            pdf.setFillColor(...colorTitulo);
            pdf.rect(15, 18, 1, 15, 'F');

            pdf.setTextColor(20, 20, 20);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(24);
            pdf.text("Planificación Previsional", 20, 25);
            
            pdf.setFontSize(12);
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(...colorGris);
            pdf.text("ESTUDIO DE JUBILACIÓN Y FISCALIDAD", 20, 31);

            // Fecha en la cabecera (derecha)
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(...colorGris);
            pdf.text("FECHA DE EMISIÓN", 160, 25);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            pdf.setTextColor(20, 20, 20);
            pdf.text(new Date().toLocaleDateString('es-ES'), 160, 31);

            // Variables para Cálculos en PDF
            const rentaPrivadaAnual = results.rentaInicialMensual * 12;
            const pensionPublicaAnual = pensionPublica * 14;
            const rentaAnualEPSV = rentaPrivadaAnual * results.ratioEpsvEnRenta;
            const rentaAnualLibre = rentaPrivadaAnual - rentaAnualEPSV;
            const parteExentaEPSV = rentaAnualEPSV * results.ratioExento;
            const parteExenta = parteExentaEPSV + rentaAnualLibre;
            const parteSujeta = rentaAnualEPSV * (1 - results.ratioExento);
            const ingresosBrutos = pensionPublicaAnual + parteSujeta;
            const totalImpuestos = calculateBizkaiaTax(ingresosBrutos);
            const netoAnual = (rentaPrivadaAnual + pensionPublicaAnual) - totalImpuestos;
            const netoMensual = netoAnual / 12;

            // --- 1. RESUMEN EJECUTIVO ---
            let y = 55;
            pdf.setTextColor(...colorTitulo);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(14);
            pdf.text("1. RESUMEN EJECUTIVO DE RENTAS ESTIMADAS", 15, y);
            pdf.setDrawColor(...colorAcento);
            pdf.setLineWidth(0.5);
            pdf.line(15, y + 3, 195, y + 3);
            
            y += 14;
            pdf.setTextColor(50, 50, 50);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            
            pdf.text("Pensión Pública Estimada (Bruta):", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(`${formatCurrency(pensionPublicaAnual)} / año`, 130, y);
            y += 8;
            pdf.setFont("helvetica", "normal");
            pdf.text("Renta Privada Estimada (Bruta):", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(`${formatCurrency(rentaPrivadaAnual)} / año`, 130, y);
            y += 8;
            pdf.setFont("helvetica", "bold");
            pdf.text("Ingresos Totales Brutos:", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(`${formatCurrency(rentaPrivadaAnual + pensionPublicaAnual)} / año`, 130, y);

            y += 14;
            // Bloque Destacado de Renta Neta
            pdf.setFillColor(...colorFondo);
            pdf.setDrawColor(220, 220, 220);
            pdf.roundedRect(15, y, 180, 24, 3, 3, 'FD');
            pdf.setFontSize(10);
            pdf.setTextColor(...colorTitulo);
            pdf.setFont("helvetica", "bold");
            pdf.text("RENTA TOTAL DISPONIBLE NETA (Tras impuestos IRPF):", 20, y + 15);
            pdf.setFontSize(15);
            pdf.setFont("RobotoFlex", "normal");
            pdf.setTextColor(...colorTitulo); // Cambiado a primario para mayor sobriedad
            pdf.text(`${formatCurrency(netoMensual)} / mes`, 140, y + 15.5);

            // --- 2. IMPACTO FISCAL ---
            y += 40;
            pdf.setTextColor(...colorTitulo);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(14);
            pdf.text("2. DESGLOSE FISCAL ANUAL Y EXENCIONES", 15, y);
            pdf.setDrawColor(...colorAcento);
            pdf.line(15, y + 3, 195, y + 3);

            y += 14;
            pdf.setTextColor(50, 50, 50);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);

            pdf.text("Capital Exento de Tributación:", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(formatCurrency(parteExenta), 130, y);
            y += 8;
            pdf.setFont("helvetica", "normal");
            pdf.text("Base Imponible Sujeta a IRPF:", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(formatCurrency(ingresosBrutos), 130, y);
            y += 8;
            pdf.setFont("helvetica", "normal");
            pdf.text("Cuota Líquida IRPF a pagar:", 20, y);
            pdf.setTextColor(200, 0, 0); // Rojo suave para el impuesto
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(`- ${formatCurrency(totalImpuestos)}`, 130, y);
            pdf.setTextColor(50, 50, 50);
            
            y += 8;
            const tipoMedio = ingresosBrutos > 0 ? (totalImpuestos / ingresosBrutos) : 0;
            pdf.setFont("helvetica", "normal");
            pdf.text("Tipo Medio Efectivo:", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(formatPercent(tipoMedio), 130, y);

            // --- 3. ESTRUCTURA PATRIMONIAL ---
            y += 25;
            pdf.setTextColor(...colorTitulo);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(14);
            pdf.text("3. POSICIÓN PATRIMONIAL INICIAL", 15, y);
            pdf.setDrawColor(...colorAcento);
            pdf.line(15, y + 3, 195, y + 3);

            y += 14;
            pdf.setTextColor(50, 50, 50);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            
            pdf.text("Ahorro e Inversión Privada:", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(formatCurrency(ahorros), 130, y);
            y += 8;
            pdf.setFont("helvetica", "normal");
            pdf.text("Capital EPSV (Aportaciones Pre-2026):", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(formatCurrency(epsvPre2026), 130, y);
            y += 8;
            pdf.setFont("helvetica", "normal");
            pdf.text("Capital EPSV (Aportaciones Post-2026):", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(formatCurrency(epsvPost2026), 130, y);
            y += 8;
            pdf.setFont("helvetica", "bold");
            pdf.text("Patrimonio Total Consolidado:", 20, y);
            pdf.setFont("RobotoFlex", "normal");
            pdf.text(formatCurrency(ahorros + epsvPre2026 + epsvPost2026), 130, y);

            // --- 4. COMPOSICIÓN FISCAL (CAPTURA UI) ---
            const fiscalElement = document.getElementById('fiscal-summary-pdf');
            if (fiscalElement) {
                const originalBg = fiscalElement.style.backgroundColor;
                fiscalElement.style.backgroundColor = '#ffffff'; 
                const canvas = await html2canvas(fiscalElement, { scale: 3, useCORS: true } as any);
                fiscalElement.style.backgroundColor = originalBg;
                
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                
                y += 25;
                // Si no cabe en la página, creamos una nueva
                if (y > 230) {
                    addFooter(pdf, pageNum++);
                    pdf.addPage();
                    y = 25;
                }
                
                pdf.setTextColor(...colorTitulo);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(14);
                pdf.text("4. COMPOSICIÓN FISCAL DE INGRESOS", 15, y);
                pdf.setDrawColor(...colorAcento);
                pdf.line(15, y + 3, 195, y + 3);
                
                pdf.addImage(imgData, 'JPEG', 15, y + 8, 180, 45); 
                y += 60;
            }

            // --- 5. GRÁFICO DE PROYECCIÓN (PROYECCIÓN RENTA NETA) ---
            const chartElement = document.getElementById('chart-container-pdf');
            if (chartElement) {
                const originalBg = chartElement.style.backgroundColor;
                chartElement.style.backgroundColor = '#ffffff'; 
                const canvas = await html2canvas(chartElement, { scale: 3, useCORS: true } as any);
                chartElement.style.backgroundColor = originalBg;
                
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                
                // Si no cabe en la página, creamos una nueva
                if (y > 180) {
                    addFooter(pdf, pageNum++);
                    pdf.addPage();
                    y = 25;
                } else {
                    y += 15;
                }
                
                pdf.setTextColor(...colorTitulo);
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(14);
                pdf.text("5. PROYECCIÓN GRÁFICA (Renta Neta Mensual)", 15, y);
                pdf.setDrawColor(...colorAcento);
                pdf.line(15, y + 3, 195, y + 3);
                
                pdf.addImage(imgData, 'JPEG', 15, y + 10, 180, 85);
                y += 105;
            }

            // --- CONSIDERACIONES LEGALES (BIZKAIA 2026) ---
            if (y > 250) {
                addFooter(pdf, pageNum++);
                pdf.addPage();
                y = 25;
            }

            pdf.setFontSize(8);
            pdf.setTextColor(...colorTitulo);
            pdf.setFont("helvetica", "bold");
            pdf.text("CONSIDERACIONES LEGALES (BIZKAIA 2026):", 15, y);
            
            pdf.setFontSize(7);
            pdf.setTextColor(80, 80, 80);
            pdf.setFont("helvetica", "normal");
            const legalPoints = [
                "• Cálculos basados en Norma Foral 2/2025 y NF 13/2013 (IRPF Bizkaia).",
                "• Bonificación de Rendimientos del Trabajo y Minoración de Cuota (1.615€) aplicadas según normativa.",
                "• La rentabilidad acumulada en EPSV está exenta si se cobra en forma de renta (> 15 años).",
                "• Simulación meramente informativa de carácter estrictamente previsional, no vinculante."
            ];
            
            legalPoints.forEach((point, index) => {
                pdf.setFont("RobotoFlex", "normal");
                pdf.text(point, 20, y + 5 + (index * 4));
            });

            // Footer de la primera página
            addFooter(pdf, pageNum++);

            // Descarga
            pdf.save(`Informe_Banca_Privada_${new Date().toLocaleDateString('es-ES').replace(/\//g, '')}.pdf`);
        } catch (error) {
            console.error("Fallo al generar el PDF nativo:", error);
            alert("Error al generar el PDF. Por favor, inténtalo de nuevo.");
        }
    };

    // --- RENDER ---
    return (
        <div className="flex flex-col h-screen bg-gray-50 font-sans text-slate-800 overflow-hidden">
            <div className="z-50 shrink-0 bg-gray-900 shadow-md">
                <Header onBack={onBack} onLogout={() => { }} />
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 relative scroll-smooth">
                <div className="flex flex-col items-center justify-start min-h-full pb-16">

                    {view === 'MAIN' ? (
                        <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in">
                            <div className="text-center mt-4 md:mt-8">
                                <h1 className="text-4xl md:text-5xl font-extrabold text-[#0B2545] tracking-tight mb-2">Simulador de Jubilación</h1>
                                <p className="text-slate-500 text-xl font-light">Estima tu renta mensual durante la jubilación.</p>
                            </div>

                            <div className="bg-white rounded-2xl shadow-xl overflow-hidden md:grid md:grid-cols-2">

                                {/* INPUTS COLUMN */}
                                <div className="p-6 md:p-8 space-y-8 flex flex-col bg-[#faf9f6]">

                                    {/* 1. Tipo Renta */}
                                    <div>
                                        <label className="font-semibold text-gray-700 block mb-3 text-lg">1. Elige el tipo de renta</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            {[
                                                { id: 'temporal', label: 'Temporal' },
                                                { id: 'vitaliciaSostenible', label: 'Vitalicia (Sost.)' },
                                                { id: 'vitaliciaEV', label: 'Vitalicia (Esp. Vida)' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setRentType(opt.id as RentType)}
                                                    className={`w-full py-3 px-2 border rounded-xl font-semibold text-sm transition-all shadow-sm ${rentType === opt.id
                                                        ? 'bg-[#0B2545] text-white border-[#0B2545]'
                                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
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
                                            <label className="font-semibold text-gray-700 text-base block mb-2">2. Ahorros Privados (€)</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-400">€</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={ahorros || ''}
                                                    onChange={e => setAhorros(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-8 p-3 border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-[#8c6b42] focus:border-[#8c6b42] transition text-xl shadow-sm outline-none"
                                                    placeholder="Ej: 300000"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="flex justify-between font-semibold text-gray-700 text-base mb-2">
                                                <span>3. Revalorización Anual de Ahorros (%)</span>
                                                <span className="font-bold text-[#8c6b42] text-lg">{revalorizacion}%</span>
                                            </label>
                                            <input
                                                type="range" min="0" max="15" step="0.1"
                                                value={revalorizacion}
                                                onChange={e => setRevalorizacion(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8c6b42]"
                                            />
                                        </div>
                                    </div>

                                    {/* EPSV Config - ACTUALIZADO 2026 CON RENTABILIDAD GLOBAL */}
                                    <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                                            <label className="font-bold text-[#0B2545] text-lg">Configuración EPSV (Ref. 2026)</label>
                                            <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-[#8c6b42] rounded-full uppercase tracking-wider">Opcional</span>
                                        </div>

                                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
                                            <div>
                                                <p className="font-semibold text-sm text-[#0B2545]">¿Primer rescate de esta contingencia?</p>
                                                <p className="text-[10px] text-slate-500">Aplica reducciones en rescate de capital</p>
                                            </div>
                                            <input type="checkbox" checked={esPrimerRescate} onChange={(e) => setEsPrimerRescate(e.target.checked)} className="w-5 h-5 accent-[#8c6b42] cursor-pointer" />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="text-sm font-semibold text-gray-600 block mb-1">Masa A: PRE-2026 (€)</label>
                                                <input
                                                    type="number" value={epsvPre2026 || ''}
                                                    onChange={e => setEpsvPre2026(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-[#8c6b42] focus:border-[#8c6b42] outline-none shadow-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm font-semibold text-gray-600 block mb-1">Masa B: POST-2026 (€)</label>
                                                <input
                                                    type="number" value={epsvPost2026 || ''}
                                                    onChange={e => setEpsvPost2026(parseFloat(e.target.value) || 0)}
                                                    className="w-full p-2 border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-[#8c6b42] focus:border-[#8c6b42] outline-none shadow-sm"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>

                                        {/* CAJA DE RENTABILIDAD PARA AMBAS MASAS */}
                                        {(epsvPre2026 > 0 || epsvPost2026 > 0) && (
                                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 animate-fade-in-down">
                                                <label className="flex items-center text-sm font-semibold text-gray-700 mb-3 cursor-pointer">
                                                    <input type="checkbox" checked={conoceRentabilidad} onChange={(e) => setConoceRentabilidad(e.target.checked)} className="mr-2 accent-[#8c6b42] w-4 h-4" />
                                                    Conozco el desglose de plusvalías (Rentabilidad)
                                                </label>
                                                
                                                {conoceRentabilidad ? (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {epsvPre2026 > 0 && (
                                                            <div>
                                                                <label className="text-xs text-gray-600 font-medium mb-1 block">Plusvalía Masa A (€)</label>
                                                                <input type="number" value={rentabilidadPre2026 || ''} onChange={e => setRentabilidadPre2026(parseFloat(e.target.value) || 0)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="Beneficio Masa A" />
                                                            </div>
                                                        )}
                                                        {epsvPost2026 > 0 && (
                                                            <div>
                                                                <label className="text-xs text-gray-600 font-medium mb-1 block">Plusvalía Masa B (€)</label>
                                                                <input type="number" value={rentabilidadPost2026 || ''} onChange={e => setRentabilidadPost2026(parseFloat(e.target.value) || 0)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="Beneficio Masa B" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {epsvPre2026 > 0 && (
                                                            <div>
                                                                <label className="text-xs text-gray-600 font-medium mb-1 block">Antigüedad Masa A (años)</label>
                                                                <input type="number" value={aniosAntiguedadPre2026 || ''} onChange={e => setAniosAntiguedadPre2026(parseFloat(e.target.value) || 0)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="Años Masa A" />
                                                            </div>
                                                        )}
                                                        {epsvPost2026 > 0 && (
                                                            <div>
                                                                <label className="text-xs text-gray-600 font-medium mb-1 block">Antigüedad Masa B (años)</label>
                                                                <input type="number" value={aniosAntiguedadPost2026 || ''} onChange={e => setAniosAntiguedadPost2026(parseFloat(e.target.value) || 0)} className="w-full p-2 border border-slate-300 rounded-lg text-sm" placeholder="Años Masa B" />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <p className="text-[10px] text-slate-500 mt-2 italic">Separar la rentabilidad es clave: está exenta de IRPF si la rescatas como renta (&gt;15 años).</p>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            <label className="text-sm font-semibold text-gray-600 block">Modalidad de Rescate EPSV preferida</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['renta', 'capital', 'mixto'].map((mode) => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => setRescueMode(mode as RescueMode)}
                                                        className={`py-2 border rounded-xl text-sm font-semibold transition-all shadow-sm ${rescueMode === mode
                                                            ? 'bg-[#0B2545] text-white border-[#0B2545]'
                                                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                                    </button>
                                                ))}
                                            </div>

                                            {rescueMode === 'mixto' && (
                                                <div className="mt-3 p-4 bg-[#faf9f6] rounded-xl border border-slate-200 animate-fade-in-down">
                                                    <label className="flex justify-between text-xs font-bold text-gray-700 mb-2">
                                                        <span>% Rescatado en Capital</span>
                                                        <span className="text-[#8c6b42]">{pctCapital}%</span>
                                                    </label>
                                                    <input
                                                        type="range" min="0" max="100"
                                                        value={pctCapital}
                                                        onChange={e => setPctCapital(parseInt(e.target.value))}
                                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8c6b42]"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Dynamic Fields based on RentType */}
                                    {rentType === 'temporal' && (
                                        <div className="space-y-6 animate-fade-in p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                                            <div>
                                                <label className="flex justify-between font-semibold text-gray-700 text-base mb-2">
                                                    <span>4. Años de Cobro</span>
                                                    <span className="font-bold text-[#8c6b42] text-lg">{years} años</span>
                                                </label>
                                                <input type="range" min="1" max="50" value={years} onChange={e => setYears(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8c6b42]" />
                                            </div>
                                            <div>
                                                <label className="flex justify-between font-semibold text-gray-700 text-base mb-2">
                                                    <span>5. Actualización Anual de Renta (%)</span>
                                                    <span className="font-bold text-[#8c6b42] text-lg">{updateRate}%</span>
                                                </label>
                                                <input type="range" min="0" max="10" step="0.1" value={updateRate} onChange={e => setUpdateRate(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8c6b42]" />
                                            </div>
                                        </div>
                                    )}

                                    {rentType === 'vitaliciaEV' && (
                                        <div className="space-y-6 animate-fade-in p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="font-semibold text-gray-700 text-base block mb-2">4. Edad Actual</label>
                                                    <input type="number" value={age} onChange={e => setAge(parseInt(e.target.value))} className="w-full p-2 border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-[#8c6b42] focus:border-[#8c6b42] outline-none text-lg shadow-sm" placeholder="Ej: 65" />
                                                </div>
                                                <div>
                                                    <label className="font-semibold text-gray-700 text-base block mb-2">5. Sexo</label>
                                                    <select value={sex} onChange={e => setSex(e.target.value as 'male' | 'female')} className="w-full p-2.5 border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-[#8c6b42] focus:border-[#8c6b42] outline-none text-lg shadow-sm">
                                                        <option value="male">Hombre</option>
                                                        <option value="female">Mujer</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="flex justify-between font-semibold text-gray-700 text-base mb-2">
                                                    <span>6. Actualización Anual de Renta (%)</span>
                                                    <span className="font-bold text-[#8c6b42] text-lg">{updateRateEV}%</span>
                                                </label>
                                                <input type="range" min="0" max="10" step="0.1" value={updateRateEV} onChange={e => setUpdateRateEV(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8c6b42]" />
                                            </div>
                                        </div>
                                    )}

                                </div>

                                {/* RESULTS COLUMN */}
                                <div className="bg-[#0B2545] text-white p-8 flex flex-col items-center justify-center relative">
                                    <div className="w-full max-w-md text-center space-y-8">
                                        <h2 className="text-3xl font-bold mb-4 text-[#D4AF37]">
                                            {rentType === 'temporal' && `Renta Temporal (${results.years} años)`}
                                            {rentType === 'vitaliciaSostenible' && `Renta Vitalicia Sostenible`}
                                            {rentType === 'vitaliciaEV' && `Vitalicia (Esperanza ${results.years.toFixed(1)} años)`}
                                        </h2>

                                        {/* EPSV Cash Result */}
                                        {(rescueMode === 'capital' || rescueMode === 'mixto') && (
                                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 w-full shadow-lg mb-6 hover:scale-105 transition-transform">
                                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#D4AF37] mb-1">Capital Neto Inmediato (EPSV)</h3>
                                                <p className="text-4xl font-extrabold tracking-tight text-white mb-2">{formatCurrency(results.epsvCashNeto)}</p>
                                                <p className="text-xs text-slate-300 opacity-80">Cobro único inicial (Neto Estimado)</p>
                                            </div>
                                        )}

                                        {/* Capital Summary */}
                                        <div className="space-y-4">
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-3 w-full md:w-3/4 mx-auto flex justify-between items-center">
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Ahorro Privado</span>
                                                <span className="text-xl font-bold text-white">{formatCurrency(ahorros)}</span>
                                            </div>

                                            <div className="bg-white/5 border border-white/10 rounded-xl p-3 w-full md:w-3/4 mx-auto flex justify-between items-center">
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Capital EPSV (En Renta)</span>
                                                <span className="text-xl font-bold text-white">{formatCurrency(results.totalEpsv - results.epsvRescatadoBruto)}</span>
                                            </div>

                                            <div className="bg-white/10 backdrop-blur-sm border border-[#D4AF37]/30 rounded-xl p-4 w-full md:w-3/4 mx-auto shadow-lg">
                                                <h3 className="text-sm font-bold uppercase tracking-wider text-[#D4AF37] mb-1">Capital Total Acumulado</h3>
                                                <p className="text-4xl font-extrabold tracking-tight mt-1 text-white">{formatCurrency(ahorros + results.totalEpsv)}</p>
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <button
                                            onClick={() => {
                                                if (results.totalCapitalForRent <= 0) {
                                                    alert("Introduce un ahorro válido para continuar.");
                                                    return;
                                                }
                                                setView('PLANNING');
                                            }}
                                            className="mt-8 w-full bg-[#D4AF37] text-[#0B2545] font-extrabold py-4 px-6 rounded-full shadow-lg hover:brightness-110 transition transform hover:scale-105 flex items-center justify-center gap-2 text-lg uppercase tracking-wide"
                                        >
                                            <Settings className="w-5 h-5" />
                                            Calcular Escenario
                                        </button>
                                        <p className="text-sm text-slate-200 mt-4 opacity-100 font-medium italic">* Incluye pensión pública y fiscalidad detallada.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // VIEW: PLANNING
                        <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-20"> 

                            {/* Planning Header */}
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <button onClick={() => setView('MAIN')} className="border border-[#0B2545] text-[#0B2545] hover:bg-slate-50 font-bold uppercase text-xs tracking-wider py-2 px-4 rounded-full transition flex items-center group">
                                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Volver al Simulador
                                </button>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={generatePDF}
                                        className="bg-[#0B2545] text-white hover:bg-[#0B2545]/90 font-bold uppercase text-xs tracking-wider py-2.5 px-5 rounded-lg shadow-md transition flex items-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" /> Generar Informe (Banca Privada)
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-8 p-4 bg-transparent">

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Panel Left */}
                                    <div className="bg-white/95 backdrop-blur rounded-2xl p-6 md:p-8 space-y-6 shadow-lg border border-slate-200">
                                        <h2 className="text-xl font-bold text-[#0B2545] border-b border-[#8c6b42] pb-3 flex items-center gap-2">
                                            <Settings className="w-5 h-5 text-[#8c6b42]" /> Integración Pensión Pública
                                        </h2>

                                        <div className="bg-[#faf9f6] p-5 rounded-xl border border-slate-200">
                                            <label className="block text-sm font-semibold text-[#0B2545] mb-2 uppercase tracking-wider">Tu Renta Privada (Calculada)</label>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-3xl font-bold text-[#8c6b42]">{formatCurrency(results.rentaInicialMensual)}</span>
                                                <span className="text-sm text-slate-500">/mes</span>
                                            </div>
                                            <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
                                                <Info className="w-3 h-3" /> Parte exenta de impuestos: <span className="font-bold">{formatPercent(results.ratioExento)}</span>
                                            </p>
                                        </div>

                                        <div>
                                            <label className="flex items-center text-lg font-bold text-[#0B2545] mb-3">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center mr-2 text-[#8c6b42]"><TrendingUp className="w-4 h-4" /></div>
                                                Añadir Pensión Pública (Mensual)
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">€</div>
                                                <input
                                                    type="number" value={pensionPublica || ''}
                                                    onChange={e => setPensionPublica(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-8 p-3 border border-slate-300 rounded-xl focus:ring-1 focus:ring-[#8c6b42] focus:border-[#8c6b42] text-lg outline-none"
                                                    placeholder="1500"
                                                />
                                            </div>
                                            <a href="https://sede-tu.seg-social.gob.es/" target="_blank" rel="noreferrer" className="mt-5 flex flex-col border border-slate-200 rounded-xl bg-white hover:border-[#0B2545] hover:shadow-md transition-all group overflow-hidden cursor-pointer">
                                                <div className="p-3 sm:p-4 flex items-center justify-between border-b border-slate-100 bg-[#faf9f6]">
                                                    <div>
                                                        <span className="text-sm font-bold text-[#0B2545] flex items-center gap-2 group-hover:text-[#8c6b42] transition-colors">
                                                            Simulador Oficial Seguridad Social <ExternalLink className="w-4 h-4" />
                                                        </span>
                                                        <span className="text-xs text-slate-500 mt-0.5 block">Sede Electrónica (Tu Seguridad Social)</span>
                                                    </div>
                                                </div>
                                                <div className="bg-white p-3 flex justify-center items-center">
                                                    <div className="flex items-center scale-90 sm:scale-100 origin-left">
                                                        <div className="bg-[#facc15] px-2 sm:px-3 py-1.5 flex items-center">
                                                            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Escudo_de_Espa%C3%B1a_%28fines_representativos%29.svg/100px-Escudo_de_Espa%C3%B1a_%28fines_representativos%29.svg.png" alt="España" className="h-6 mr-2" />
                                                            <div className="text-[8px] sm:text-[9px] font-bold text-[#0B2545] leading-none uppercase tracking-tighter">
                                                                Gobierno<br />de España
                                                            </div>
                                                            <div className="w-px h-6 bg-[#0B2545]/20 mx-2"></div>
                                                            <div className="text-[8px] sm:text-[9px] font-bold text-[#0B2545] leading-none uppercase tracking-tighter">
                                                                Ministerio<br />de Inclusión, Seguridad Social<br />y Migraciones
                                                            </div>
                                                        </div>
                                                        <div className="px-2 sm:px-3">
                                                            <span className="text-[#0fa4b5] text-lg sm:text-xl font-light tracking-tight">Seguridad<span className="font-bold text-[#006080]">Social</span></span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </a>
                                        </div>
                                    </div>

                                    {/* Panel Right - Results */}
                                    {(() => {
                                        const rentaPrivadaAnual = results.rentaInicialMensual * 12;
                                        const pensionPublicaAnual = pensionPublica * 14;

                                        const rentaAnualEPSV = rentaPrivadaAnual * results.ratioEpsvEnRenta;
                                        const rentaAnualLibre = rentaPrivadaAnual - rentaAnualEPSV;

                                        const parteExentaEPSV = rentaAnualEPSV * results.ratioExento;
                                        const parteExenta = parteExentaEPSV + rentaAnualLibre;

                                        const parteSujeta = rentaAnualEPSV * (1 - results.ratioExento);

                                        const ingresosBrutos = pensionPublicaAnual + parteSujeta;
                                        const totalImpuestos = calculateBizkaiaTax(ingresosBrutos);
                                        const tipoMedio = ingresosBrutos > 0 ? totalImpuestos / ingresosBrutos : 0;

                                        const netoAnual = (rentaPrivadaAnual + pensionPublicaAnual) - totalImpuestos;
                                        const netoMensual = netoAnual / 12;

                                        return (
                                            <div className="bg-[#0B2545] rounded-2xl p-6 md:p-8 text-white flex flex-col justify-center shadow-lg relative overflow-hidden">
                                                <h2 className="text-2xl font-bold mb-1 text-white">Total Neto Mensual</h2>
                                                <p className="text-sm text-[#D4AF37] mb-6 opacity-90 uppercase tracking-widest font-semibold">Disponible para gastar</p>

                                                <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 mb-6 relative">
                                                    <span className="text-5xl md:text-6xl font-extrabold tracking-tight block text-center shadow-sm text-[#D4AF37] drop-shadow-lg">
                                                        {formatCurrency(netoMensual)}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                                        <span className="block text-slate-300 text-xs uppercase tracking-wider">Bruto Mensual</span>
                                                        <span className="block font-bold text-lg">{formatCurrency((rentaPrivadaAnual + pensionPublicaAnual) / 12)}</span>
                                                    </div>
                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                                        <span className="block text-slate-300 text-xs uppercase tracking-wider">Neto Anual</span>
                                                        <span className="block font-bold text-lg">{formatCurrency(netoAnual)}</span>
                                                    </div>
                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                                        <span className="block text-slate-300 text-xs uppercase tracking-wider">Bruto Anual</span>
                                                        <span className="block font-bold text-lg">{formatCurrency(rentaPrivadaAnual + pensionPublicaAnual)}</span>
                                                    </div>
                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                                        <span className="block text-slate-300 text-xs uppercase tracking-wider">IRPF Anual</span>
                                                        <span className="block font-bold text-lg text-slate-100">-{formatCurrency(totalImpuestos)}</span>
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
                                <div className="bg-[#faf9f6] rounded-2xl shadow-xl border border-slate-200 overflow-hidden mt-8">
                                    <div className="bg-[#0B2545] p-6 text-white border-l-4 border-[#8c6b42]">
                                        <h2 className="text-2xl font-bold flex items-center gap-2 text-[#D4AF37]">
                                            <PieChart className="w-6 h-6 text-[#D4AF37]" /> Informe Fiscal Detallado
                                        </h2>
                                        <p className="text-sm text-slate-300 mt-1 opacity-90 tracking-wide">Norma Foral 2/2025 · Ejercicio 2026 · Bizkaia</p>
                                    </div>

                                    <div className="p-6 md:p-8">
                                        {(() => {
                                            const rentaPrivadaAnual = results.rentaInicialMensual * 12;
                                            const pensionPublicaAnual = pensionPublica * 14;

                                            const rentaAnualEPSV = rentaPrivadaAnual * results.ratioEpsvEnRenta;
                                            const rentaAnualLibre = rentaPrivadaAnual - rentaAnualEPSV;

                                            const parteExentaEPSV = rentaAnualEPSV * results.ratioExento;
                                            const parteExenta = parteExentaEPSV + rentaAnualLibre;
                                            const parteSujeta = rentaAnualEPSV * (1 - results.ratioExento);

                                            const ingresosBrutos = pensionPublicaAnual + parteSujeta;
                                            const totalImpuestos = calculateBizkaiaTax(ingresosBrutos);

                                            const totalIngresosReales = rentaPrivadaAnual + pensionPublicaAnual;

                                            const parteExentaPct = totalIngresosReales > 0 ? (parteExenta / totalIngresosReales) * 100 : 0;
                                            const pensionPct = totalIngresosReales > 0 ? (pensionPublicaAnual / totalIngresosReales) * 100 : 0;
                                            const privadoSujetoPct = totalIngresosReales > 0 ? (parteSujeta / totalIngresosReales) * 100 : 0;

                                            return (
                                                <div className="space-y-8">
                                                    <div id="fiscal-summary-pdf" className="space-y-6 pt-2">
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

                                                        <div>
                                                            <h3 className="text-lg font-bold text-[#0B2545] border-b border-[#8c6b42] pb-2 mb-4">Composición Fiscal de tus Ingresos</h3>
                                                            <div className="h-12 flex rounded-lg overflow-hidden text-xs font-bold text-white shadow-sm">
                                                                {parteExentaPct > 0 && (
                                                                    <div style={{ width: `${parteExentaPct}%` }} className="bg-[#64748B] flex items-center justify-center relative group">
                                                                        <span className="truncate px-1">Exento</span>
                                                                        <div className="absolute bottom-full mb-1 bg-gray-800 text-white p-2 rounded text-xs hidden group-hover:block whitespace-nowrap z-10">
                                                                            Exento: {formatCurrency(parteExenta)}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {privadoSujetoPct > 0 && (
                                                                    <div style={{ width: `${privadoSujetoPct}%` }} className="bg-[#D4AF37] flex items-center justify-center relative group">
                                                                        <span className="truncate px-1">Sujeto a IRPF</span>
                                                                        <div className="absolute bottom-full mb-1 bg-gray-800 text-white p-2 rounded text-xs hidden group-hover:block whitespace-nowrap z-10">
                                                                            Sujeto: {formatCurrency(parteSujeta)}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {pensionPct > 0 && (
                                                                    <div style={{ width: `${pensionPct}%` }} className="bg-[#0B2545] flex items-center justify-center relative group">
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
                                                    </div>

                                                    {/* ESTE ES EL CONTENEDOR QUE CAPTURA EL PDF NATIVO */}
                                                    <div id="chart-container-pdf">
                                                        <h3 className="text-lg font-bold text-[#0B2545] border-b border-[#8c6b42] pb-2 mb-4">Proyección Renta Neta (Mensual)</h3>
                                                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-[350px]">
                                                            {(() => {
                                                                 const chartData = Array.from({ length: Math.min(results.years, 30) }, (_, i) => i + 1).map(year => {
                                                                    const growthFactor = Math.pow(1 + results.growth, year - 1);
                                                                    const pensionGrowth = Math.pow(1.02, year - 1);

                                                                    const r_actual = rentaPrivadaAnual * growthFactor;
                                                                    const p_actual = pensionPublicaAnual * pensionGrowth;

                                                                    // Estimación simple de impuestos proporcionales para el desglose gráfico
                                                                    const exento = (r_actual * results.ratioEpsvEnRenta * results.ratioExento) + (r_actual * (1 - results.ratioEpsvEnRenta));
                                                                    const sujeto = (r_actual * results.ratioEpsvEnRenta * (1 - results.ratioExento));

                                                                    const baseTotal = p_actual + sujeto;
                                                                    const taxTotal = calculateBizkaiaTax(baseTotal);
                                                                    
                                                                    // Ratio para repartir impuestos entre pensión y parte sujeta de ahorro
                                                                    const ratioTaxPension = baseTotal > 0 ? (p_actual / baseTotal) : 0;
                                                                    
                                                                    const taxPension = taxTotal * ratioTaxPension;
                                                                    const taxPrivado = taxTotal * (1 - ratioTaxPension);

                                                                    const netoPension = p_actual - taxPension;
                                                                    const netoPrivado = r_actual - taxPrivado;

                                                                    return {
                                                                        year: `Año ${year}`,
                                                                        pension: Math.round(netoPension / 12),
                                                                        privado: Math.round(netoPrivado / 12),
                                                                        total: Math.round((netoPension + netoPrivado) / 12)
                                                                    };
                                                                });

                                                                return (
                                                                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                                            <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                                                                            <YAxis
                                                                                axisLine={false}
                                                                                tickLine={false}
                                                                                tickFormatter={(val) => `€${val.toLocaleString()}`}
                                                                                tick={{ fontSize: 10, fill: '#64748b' }}
                                                                                dx={-10}
                                                                            />
                                                                            <Tooltip
                                                                                formatter={(value: number) => [`€${value.toLocaleString()}`, '']}
                                                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                                                labelStyle={{ color: '#0B2545', fontWeight: 'bold' }}
                                                                            />
                                                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                                                            <Bar 
                                                                                dataKey="pension" 
                                                                                stackId="a" 
                                                                                name="Pensión Pública (Neto)" 
                                                                                fill="#5DADE2" 
                                                                                radius={[0, 0, 0, 0]} 
                                                                            />
                                                                            <Bar 
                                                                                dataKey="privado" 
                                                                                stackId="a" 
                                                                                name="Renta Privada (Neto)" 
                                                                                fill="#F4D03F" 
                                                                                radius={[4, 4, 0, 0]} 
                                                                            />
                                                                            <ReferenceLine y={chartData[0].total} stroke="#5DADE2" strokeDasharray="3 3" />
                                                                        </BarChart>
                                                                    </ResponsiveContainer>
                                                                )
                                                            })()}
                                                        </div>
                                                    </div>

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
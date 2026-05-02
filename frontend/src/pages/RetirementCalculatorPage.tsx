import { useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
    getLifeExpectancy,
    calculateEPSVNetoAdvanced,
    calculateRentTaxes
} from '../utils/retirementUtils';
import { Download, ArrowLeft } from 'lucide-react';

import { RetirementInputPanel } from '../components/retirement/RetirementInputPanel';
import { RetirementSummaryCard } from '../components/retirement/RetirementSummaryCard';
import { RetirementScenarioCards } from '../components/retirement/RetirementScenarioCards';
import { RetirementEventCard } from '../components/retirement/RetirementEventCard';
import { FiscalBreakdownCard } from '../components/retirement/FiscalBreakdownCard';
import { RetirementProjectionChart } from '../components/retirement/RetirementProjectionChart';
import type { RetirementFormState } from '../components/retirement/types';

import fondoImg from '../assets/fondo_v1.png';

interface RetirementCalculatorPageProps {
    onBack?: () => void;
}

export default function RetirementCalculatorPage({ onBack }: RetirementCalculatorPageProps) {
    const [step, setStep] = useState<'setup' | 'results'>('setup');
    const [form, setForm] = useState<RetirementFormState>({
        ahorros: 0,
        revalorizacion: 0,
        pensionPublica: 0,
        epsvPre2026: 0,
        rentabilidadPre2026: 0,
        aniosAntiguedadPre2026: 0,
        epsvPost2026: 0,
        rentabilidadPost2026: 0,
        aniosAntiguedadPost2026: 0,
        conoceRentabilidad: true,
        esPrimerRescate: true,
        rescueMode: 'renta' as 'renta' | 'capital' | 'mixto',
        pctCapital: 0,
        rentType: 'temporal' as 'temporal' | 'vitaliciaEV' | 'vitaliciaSostenible',
        years: 20, // Se mantiene en 20 años para evitar errores matemáticos de división por cero
        updateRate: 0,
        age: 65, // Edad típica de jubilación base
        sex: 'male' as 'male' | 'female',
        updateRateEV: 0
    });

    const handleFormChange = (key: keyof RetirementFormState, value: any) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    // --- EXACT COPY OF RESULTS LOGIC (EXTRACTED TO FUNCTION) ---
    const calculateScenarioResults = (formData: RetirementFormState) => {
        let pctCap = 0;
        let epsvRescatadoBruto = 0;
        let epsvRenta = 0;
        const totalEpsv = Math.max(0, formData.epsvPre2026 || 0) + Math.max(0, formData.epsvPost2026 || 0);

        if (formData.rescueMode === 'renta') {
            epsvRenta = totalEpsv;
            pctCap = 0;
        } else if (formData.rescueMode === 'capital') {
            epsvRescatadoBruto = totalEpsv;
            pctCap = 1;
        } else if (formData.rescueMode === 'mixto') {
            pctCap = Math.min(100, Math.max(0, formData.pctCapital || 0)) / 100;
            epsvRescatadoBruto = totalEpsv * pctCap;
            epsvRenta = totalEpsv * (1 - pctCap);
        }

        const paramsRescateCapital = {
            amountPre2026: Math.max(0, formData.epsvPre2026 || 0) * pctCap,
            amountPost2026: Math.max(0, formData.epsvPost2026 || 0) * pctCap,
            rentabilidadPost2026: formData.conoceRentabilidad ? (Math.max(0, formData.rentabilidadPost2026 || 0) * pctCap) : undefined,
            aniosAntiguedadPost2026: Math.max(0, formData.aniosAntiguedadPost2026 || 0),
            pensionPublicaAnual: Math.max(0, formData.pensionPublica || 0) * 14,
            esPrimerRescate: formData.esPrimerRescate
        };
        const epsvCashNeto = epsvRescatadoBruto > 0 ? calculateEPSVNetoAdvanced(paramsRescateCapital).rescateNeto : 0;

        const totalCapitalForRent = Math.max(0, formData.ahorros || 0) + epsvRenta;

        let n_val = 0;
        let g_val = 0;
        let i_val = (Math.max(0, formData.revalorizacion || 0)) / 100;

        if (formData.rentType === 'temporal') {
            n_val = Math.max(1, formData.years || 1);
            g_val = (Math.max(0, formData.updateRate || 0)) / 100;
        } else if (formData.rentType === 'vitaliciaEV') {
            n_val = getLifeExpectancy(Math.max(0, formData.age || 0), formData.sex);
            g_val = (Math.max(0, formData.updateRateEV || 0)) / 100;
        } else {
            n_val = 100;
            g_val = 0;
        }

        n_val = Math.max(1, n_val);

        let rentaInicialAnnual = 0;
        if (formData.rentType === 'vitaliciaSostenible') {
            rentaInicialAnnual = totalCapitalForRent * i_val;
        } else {
            if (Math.abs(i_val - g_val) < 0.0001) {
                rentaInicialAnnual = totalCapitalForRent * (1 + i_val) / n_val;
            } else {
                const factor = (1 + g_val) / (1 + i_val);
                const denominador = 1 - Math.pow(factor, n_val);
                rentaInicialAnnual = denominador !== 0 ? (totalCapitalForRent * (i_val - g_val)) / denominador : totalCapitalForRent / n_val;
            }
        }
        rentaInicialAnnual = Math.max(0, rentaInicialAnnual);

        const rentPre = Math.min(Math.max(0, formData.epsvPre2026 || 0), Math.max(0, formData.rentabilidadPre2026 || 0));
        const rentPost = Math.min(Math.max(0, formData.epsvPost2026 || 0), Math.max(0, formData.rentabilidadPost2026 || 0));
        let rentabilidadRentaPre = 0;
        let rentabilidadRentaPost = 0;
        if (formData.epsvPre2026 > 0) rentabilidadRentaPre += (rentPre * (1 - pctCap));
        if (formData.epsvPost2026 > 0) rentabilidadRentaPost += (rentPost * (1 - pctCap));

        const isRentabilidadEPSVExenta = formData.rentType !== 'temporal' || formData.years >= 15;
        const ratioRentabilidadEpsvPre = epsvRenta > 0 ? (rentabilidadRentaPre / epsvRenta) : 0;
        const ratioRentabilidadEpsvPost = epsvRenta > 0 ? (rentabilidadRentaPost / epsvRenta) : 0;
        const ratioEpsvEnRenta = totalCapitalForRent > 0 ? (epsvRenta / totalCapitalForRent) : 0;

        let totalExpectedPayouts = 0;
        if (formData.rentType === 'vitaliciaSostenible') {
            totalExpectedPayouts = Infinity;
        } else {
            if (g_val === 0) {
                totalExpectedPayouts = rentaInicialAnnual * n_val;
            } else {
                totalExpectedPayouts = rentaInicialAnnual * (Math.pow(1 + g_val, n_val) - 1) / g_val;
            }
        }

        let ratioBeneficioAhorros = 0;
        if (totalExpectedPayouts > 0 && totalCapitalForRent > 0) {
            if (formData.rentType === 'vitaliciaSostenible') {
                ratioBeneficioAhorros = 0.5;
            } else {
                ratioBeneficioAhorros = Math.max(0, Math.min(0.99, 1 - (totalCapitalForRent / totalExpectedPayouts)));
            }
        }

        const rentTaxResult = calculateRentTaxes({
            rentaPrivadaAnual: rentaInicialAnnual,
            pensionPublicaAnual: Math.max(0, formData.pensionPublica || 0) * 14,
            ratioEpsvEnRenta,
            ratioRentabilidadEpsvPre: Math.min(1, Math.max(0, ratioRentabilidadEpsvPre)),
            ratioRentabilidadEpsvPost: Math.min(1, Math.max(0, ratioRentabilidadEpsvPost)),
            isRentabilidadEPSVExenta,
            ratioBeneficioAhorros
        });

        return {
            rentaInicialMensual: rentaInicialAnnual / 12,
            epsvCashNeto,
            epsvRescatadoBruto,
            totalCapitalForRent,
            years: n_val,
            growth: g_val,
            totalEpsv,
            rentTaxResult,
            ratioEpsvEnRenta,
            ratioRentabilidadEpsvPre,
            ratioRentabilidadEpsvPost,
            isRentabilidadEPSVExenta
        };
    };

    const scenarios = useMemo(() => {
        const base = calculateScenarioResults(form);
        const conservador = calculateScenarioResults({ ...form, revalorizacion: Math.max(0, form.revalorizacion - 1.5) });
        const optimista = calculateScenarioResults({ ...form, revalorizacion: form.revalorizacion + 1.5 });
        return { base, conservador, optimista };
    }, [form]);

    const results = scenarios.base;

    const generatePDF = async () => {
        const nodes = [
            document.getElementById('report-summary'),
            document.getElementById('report-event'),
            document.getElementById('report-fiscal'),
            document.getElementById('report-chart')
        ].filter(Boolean);

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const marginX = 16;
        
        // ==========================================
        // PÁGINA 1: PORTADA INSTITUCIONAL
        // ==========================================
        // Fondo limpio y blanco
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');
        
        // Branding superior ultra-ligero
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(148, 163, 184); // Slate-400
        pdf.text('BANCA PRIVADA', marginX, 35);

        // Centro: Título Principal elegante y agrupado
        pdf.setTextColor(11, 37, 69); // #0B2545
        pdf.setFontSize(30);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Simulación de Jubilación', marginX, 120);

        // Línea divisoria muy sutil (elimina el dorado)
        pdf.setDrawColor(226, 232, 240); // Slate-200
        pdf.setLineWidth(0.5);
        pdf.line(marginX, 134, marginX + 40, 134);

        // Subtítulo y Fecha (suavizado)
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105); // Slate-600
        pdf.text('Escenario patrimonial personalizado', marginX, 150);
        
        pdf.setFontSize(11);
        pdf.setTextColor(148, 163, 184); // Slate-400
        pdf.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-ES')}`, marginX, 160);

        // ==========================================
        // PÁGINA 2: CUERPO DEL INFORME
        // ==========================================
        pdf.addPage();
        
        let yPos = 45;

        // Block: Cabecera Interna
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pageWidth, 45, 'F');
        
        pdf.setTextColor(11, 37, 69); // #0B2545
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text('Resumen del Escenario', marginX, 24);

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(148, 163, 184); // Slate-400 en vez de dorado en interior
        pdf.text(`ANÁLISIS DE IMPACTO  /  HOJA DE RESULTADOS`, marginX, 32);

        pdf.setDrawColor(226, 232, 240); // slate-200
        pdf.setLineWidth(0.5);
        pdf.line(marginX, 38, pageWidth - marginX, 38);

        // Pre-calculamos los tamaños para forzar que todo quepa en una sola hoja adicional (página 2)
        let totalContentHeight = 0;
        const spacing = 8;
        const imagesData = [];

        for (const node of nodes) {
            if (!node || (node.children.length === 0 && node.innerHTML.trim() === "")) continue;

            const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: null } as any);
            const imgData = canvas.toDataURL('image/png');
            const imgProps = pdf.getImageProperties(imgData);
            
            const baseWidth = pageWidth - (marginX * 2);
            const baseHeight = (imgProps.height * baseWidth) / imgProps.width;
            
            imagesData.push({ imgData, baseWidth, baseHeight });
            totalContentHeight += baseHeight;
        }

        totalContentHeight += Math.max(0, imagesData.length - 1) * spacing;

        const maxAvailableHeight = pageHeight - yPos - 15; // Dejamos margen inferior de 15mm
        let scaleFactor = 1;
        
        // Si el contenido suma más altura que la disponible, lo reducimos todo proporcionalmente
        if (totalContentHeight > maxAvailableHeight) {
            scaleFactor = maxAvailableHeight / totalContentHeight;
        }

        for (const img of imagesData) {
            const finalWidth = img.baseWidth * scaleFactor;
            const finalHeight = img.baseHeight * scaleFactor;
            
            // Centramos horizontalmente para mantener estética si se redujo el tamaño
            const xOffset = marginX + (img.baseWidth - finalWidth) / 2;
            
            pdf.addImage(img.imgData, 'PNG', xOffset, yPos, finalWidth, finalHeight);
            yPos += finalHeight + (spacing * scaleFactor);
        }

        // Flujo web habitual usando mecanismo HTML5 de descarga
        pdf.save('simulacion_jubilacion_banca_privada.pdf');
    };

    return (
        <div className="block h-[calc(100vh-64px)] w-full overflow-y-auto bg-[#F4F7FB] bg-cover bg-center bg-fixed bg-no-repeat font-sans text-[#0D1B2A] antialiased selection:bg-[#E67E5F] selection:text-white" style={{ backgroundImage: `url(${fondoImg})` }}>
            <div className="relative flex min-h-full w-full flex-col pb-20 bg-white/20">
                {step === 'setup' ? (
                    <div className="mx-auto w-full max-w-[1080px] px-4 pb-6 pt-12 sm:px-6 lg:px-8 lg:py-16">
                        {onBack && (
                            <div className="mb-8 flex justify-start">
                                <button
                                    onClick={onBack}
                                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[15px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Volver al Dashboard
                                </button>
                            </div>
                        )}



                        <div className="w-full">
                            <RetirementInputPanel form={form} onChange={handleFormChange} onGenerate={() => setStep('results')} />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="px-8 pb-6 pt-10 lg:px-12">
                            {onBack && (
                                <div className="mb-5 flex justify-start">
                                    <button
                                        onClick={onBack}
                                        className="flex items-center gap-2 rounded-full border border-white/50 bg-white/40 backdrop-blur-sm px-4 py-2 text-[15px] font-semibold text-[#0D1B2A] shadow-lg transition-colors hover:border-white/70 hover:bg-white/50"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Volver al Dashboard
                                    </button>
                                </div>
                            )}

                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <h2 className="text-[32px] font-black tracking-tight text-[#0D1B2A] drop-shadow-sm">Tu Plan de Jubilación</h2>
                                    <p className="mt-2 text-[17px] text-[#0D1B2A]/70 font-semibold tracking-wide drop-shadow-sm">Análisis integrado de la renta de la que podrás disfrutar.</p>
                                </div>
                                <button
                                    onClick={() => setStep('setup')}
                                    className="flex items-center gap-2 self-start rounded-lg border border-white/50 bg-white/40 backdrop-blur-sm px-4 py-2 text-[15px] font-semibold text-[#0D1B2A] shadow-lg transition-colors hover:border-white/70 hover:bg-white/50"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                    </svg>
                                    Ajustar mis datos
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 px-8 pb-12 lg:px-12">
                            <div className="mx-auto w-full max-w-[1100px] space-y-6 pb-4">
                                <div className="flex flex-col space-y-6">
                                    <div id="report-summary"><RetirementSummaryCard results={results} age={form.age} /></div>
                                    <div id="report-scenarios"><RetirementScenarioCards scenarios={scenarios} baseRevalorizacion={form.revalorizacion} /></div>
                                    <div id="report-event"><RetirementEventCard epsvRescatadoBruto={results.epsvRescatadoBruto} epsvCashNeto={results.epsvCashNeto} /></div>
                                    <div id="report-fiscal"><FiscalBreakdownCard results={results} /></div>
                                </div>

                                <div id="report-chart" className="pt-4">
                                    <RetirementProjectionChart results={results} pensionPublicaAnual={Math.max(0, form.pensionPublica) * 14} />
                                </div>

                                <div className="mt-2 flex justify-end border-t border-white/40 pt-8 print:hidden relative z-10">
                                    <button
                                        onClick={generatePDF}
                                        className="flex min-h-[56px] items-center gap-2.5 rounded-2xl border border-white/30 bg-[#0F2A44]/90 backdrop-blur-sm px-6 py-3.5 text-[17px] font-semibold tracking-[0.01em] text-white shadow-xl transition-colors hover:bg-[#2D5B87]/90 active:bg-[#081b2e]"
                                    >
                                        <Download className="h-5 w-5" />
                                        Exportar Informe
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

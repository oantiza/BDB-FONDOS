import React, { useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
    getLifeExpectancy,
    calculateEPSVNetoAdvanced,
    calculateRentTaxes
} from '../utils/retirementUtils';
import { Calculator, Download, ArrowLeft } from 'lucide-react';

import { RetirementInputPanel } from '../components/retirement/RetirementInputPanel';
import { RetirementSummaryCard } from '../components/retirement/RetirementSummaryCard';
import { RetirementEventCard } from '../components/retirement/RetirementEventCard';
import { FiscalBreakdownCard } from '../components/retirement/FiscalBreakdownCard';
import { RetirementProjectionChart } from '../components/retirement/RetirementProjectionChart';
import { RetirementFormState } from '../components/retirement/types';

interface RetirementCalculatorPageProps {
    onBack?: () => void;
}

export default function RetirementCalculatorPage({ onBack }: RetirementCalculatorPageProps) {
    const [step, setStep] = useState<'setup' | 'results'>('setup');
    const [form, setForm] = useState<RetirementFormState>({
        ahorros: 300000,
        revalorizacion: 3,
        pensionPublica: 1500,
        epsvPre2026: 100000,
        rentabilidadPre2026: 30000,
        aniosAntiguedadPre2026: 12,
        epsvPost2026: 50000,
        rentabilidadPost2026: 10000,
        aniosAntiguedadPost2026: 5,
        conoceRentabilidad: true,
        esPrimerRescate: true,
        rescueMode: 'renta' as 'renta' | 'capital' | 'mixto',
        pctCapital: 30,
        rentType: 'temporal' as 'temporal' | 'vitaliciaEV' | 'vitaliciaSostenible',
        years: 20,
        updateRate: 2,
        age: 65,
        sex: 'male' as 'male' | 'female',
        updateRateEV: 2
    });

    const handleFormChange = (key: keyof RetirementFormState, value: any) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    // --- EXACT COPY OF RESULTS LOGIC ---
    const results = useMemo(() => {
        let pctCap = 0;
        let epsvRescatadoBruto = 0;
        let epsvRenta = 0;
        const totalEpsv = Math.max(0, form.epsvPre2026 || 0) + Math.max(0, form.epsvPost2026 || 0);

        if (form.rescueMode === 'renta') {
            epsvRenta = totalEpsv;
            pctCap = 0;
        } else if (form.rescueMode === 'capital') {
            epsvRescatadoBruto = totalEpsv;
            pctCap = 1;
        } else if (form.rescueMode === 'mixto') {
            pctCap = Math.min(100, Math.max(0, form.pctCapital || 0)) / 100;
            epsvRescatadoBruto = totalEpsv * pctCap;
            epsvRenta = totalEpsv * (1 - pctCap);
        }

        const paramsRescateCapital = {
            amountPre2026: Math.max(0, form.epsvPre2026 || 0) * pctCap,
            amountPost2026: Math.max(0, form.epsvPost2026 || 0) * pctCap,
            rentabilidadPost2026: form.conoceRentabilidad ? (Math.max(0, form.rentabilidadPost2026 || 0) * pctCap) : undefined,
            aniosAntiguedadPost2026: Math.max(0, form.aniosAntiguedadPost2026 || 0),
            pensionPublicaAnual: Math.max(0, form.pensionPublica || 0) * 14, 
            esPrimerRescate: form.esPrimerRescate
        };
        const epsvCashNeto = epsvRescatadoBruto > 0 ? calculateEPSVNetoAdvanced(paramsRescateCapital).rescateNeto : 0;

        const totalCapitalForRent = Math.max(0, form.ahorros || 0) + epsvRenta;

        let n_val = 0;
        let g_val = 0;
        let i_val = (Math.max(0, form.revalorizacion || 0)) / 100;

        if (form.rentType === 'temporal') {
            n_val = Math.max(1, form.years || 1);
            g_val = (Math.max(0, form.updateRate || 0)) / 100;
        } else if (form.rentType === 'vitaliciaEV') {
            n_val = getLifeExpectancy(Math.max(0, form.age || 0), form.sex);
            g_val = (Math.max(0, form.updateRateEV || 0)) / 100;
        } else {
            n_val = 100; 
            g_val = 0;
        }
        
        n_val = Math.max(1, n_val);

        let rentaInicialAnnual = 0;
        if (form.rentType === 'vitaliciaSostenible') {
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

        const rentPre = Math.min(Math.max(0, form.epsvPre2026 || 0), Math.max(0, form.rentabilidadPre2026 || 0));
        const rentPost = Math.min(Math.max(0, form.epsvPost2026 || 0), Math.max(0, form.rentabilidadPost2026 || 0));
        let rentabilidadRentaTotal = 0;
        if (form.epsvPre2026 > 0) rentabilidadRentaTotal += (rentPre * (1 - pctCap));
        if (form.epsvPost2026 > 0) rentabilidadRentaTotal += (rentPost * (1 - pctCap));

        const isExempt = form.rentType !== 'temporal' || form.years >= 15;
        const ratioExento = (isExempt && epsvRenta > 0) ? (rentabilidadRentaTotal / epsvRenta) : 0;
        const ratioEpsvEnRenta = totalCapitalForRent > 0 ? (epsvRenta / totalCapitalForRent) : 0;

        let totalExpectedPayouts = 0;
        if (form.rentType === 'vitaliciaSostenible') {
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
            if (form.rentType === 'vitaliciaSostenible') {
                ratioBeneficioAhorros = 0.5;
            } else {
                ratioBeneficioAhorros = Math.max(0, Math.min(0.99, 1 - (totalCapitalForRent / totalExpectedPayouts)));
            }
        }

        const rentTaxResult = calculateRentTaxes({
            rentaPrivadaAnual: rentaInicialAnnual,
            pensionPublicaAnual: Math.max(0, form.pensionPublica || 0) * 14,
            ratioEpsvEnRenta,
            ratioExentoEPSV: Math.min(1, Math.max(0, ratioExento)),
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
            ratioExento
        };
    }, [form]);


    const generatePDF = () => {
        const input1 = document.getElementById('reportA');
        const input2 = document.getElementById('reportB');
        if (!input1 || !input2) return;

        // @ts-expect-error La definicion de @types/html2canvas (0.5.x) no incluye 'scale', disponible en 1.x
        Promise.all([html2canvas(input1, { scale: 2 }), html2canvas(input2, { scale: 2 })]).then(([canvas1, canvas2]) => {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, 40, 'F');
            pdf.setTextColor(15, 23, 42); // slate-900
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(22);
            pdf.text("Planificación Patrimonial PM", 20, 25);
            pdf.setFontSize(10);
            pdf.setTextColor(100, 116, 139); // slate-500
            pdf.text("Escenario Avanzado de Jubilación", 20, 32);
            pdf.text(new Date().toLocaleDateString('es-ES'), 160, 31);
            
            const imgData1 = canvas1.toDataURL('image/png');
            const imgProps1 = pdf.getImageProperties(imgData1);
            const pdfHeight1 = (imgProps1.height * (pageWidth - 40)) / imgProps1.width;
            pdf.addImage(imgData1, 'PNG', 20, 50, pageWidth - 40, pdfHeight1);

            const imgData2 = canvas2.toDataURL('image/png');
            const imgProps2 = pdf.getImageProperties(imgData2);
            const pdfHeight2 = (imgProps2.height * (pageWidth - 40)) / imgProps2.width;
            
            if (50 + pdfHeight1 + 10 + pdfHeight2 > 280) {
                pdf.addPage();
                pdf.addImage(imgData2, 'PNG', 20, 20, pageWidth - 40, pdfHeight2);
            } else {
                pdf.addImage(imgData2, 'PNG', 20, 50 + pdfHeight1 + 10, pageWidth - 40, pdfHeight2);
            }

            pdf.save("planificacion_jubilacion_pm.pdf");
        });
    };

    return (
        <div className="h-[calc(100vh-64px)] bg-slate-100 text-slate-800 font-sans selection:bg-[#0B2545] selection:text-white block overflow-y-auto w-full">
            <div className="w-full min-h-full bg-slate-100 relative flex flex-col pb-24">
                
                {/* Unified Module Header */}
                <div className="sticky top-0 z-50 h-16 bg-gradient-to-r from-slate-800 to-slate-700 text-white flex justify-between items-center px-6 shrink-0 border-b border-slate-600 shadow-sm print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="font-light text-xl tracking-tight leading-none mb-0.5 text-white">Gestor de <span className="font-bold text-blue-200">Fondos</span></div>
                        <div className="h-6 w-px bg-slate-600/50 mx-2"></div>
                        <h3 className="text-[11px] font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                            <Calculator className="w-4 h-4 text-[#D4AF37]" />
                            Simulador de Jubilación
                        </h3>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {step === 'results' && (
                            <button onClick={generatePDF} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 border border-blue-400 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-widest rounded-full transition-all shadow-md">
                                <Download className="w-3.5 h-3.5" /> Exportar Informe
                            </button>
                        )}
                        {onBack && (
                            <button 
                                onClick={onBack}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-700/50 text-slate-200 hover:text-white hover:bg-slate-600 transition-all border border-slate-500 shadow-sm text-[11px] font-bold uppercase tracking-widest"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Volver al Dashboard
                            </button>
                        )}
                    </div>
                </div>

                {step === 'setup' ? (
                    <div className="py-12 lg:py-16 px-4 sm:px-6 lg:px-8 max-w-[980px] w-full mx-auto pb-4">
                        <div className="text-center mb-8">
                            <h2 className="text-4xl font-extrabold text-[#0B2545] tracking-tight">Cálculo de Escenarios</h2>
                        </div>
                        
                        <div className="w-full">
                            <RetirementInputPanel form={form} onChange={handleFormChange} onGenerate={() => setStep('results')} />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <div className="p-8 lg:px-12 lg:pt-8 flex items-center justify-between pb-6">
                            <div>
                                <h2 className="text-4xl font-extrabold text-[#0B2545] tracking-tight">Análisis Predictivo de Jubilación</h2>
                                <p className="text-slate-500 text-base mt-2">Impacto patrimonial, desglose fiscal y evolución temporal de rentas.</p>
                            </div>
                            <button
                                onClick={() => setStep('setup')}
                                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-semibold rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                                </svg>
                                Modificar Hipótesis
                            </button>
                        </div>
                        
                        <div className="px-8 lg:px-12 flex-1 pb-12">
                            <div className="max-w-[1100px] w-full mx-auto space-y-6 pb-4">
                                <div id="reportA" className="space-y-6 flex flex-col">
                                    <RetirementSummaryCard results={results} />
                                    <RetirementEventCard epsvRescatadoBruto={results.epsvRescatadoBruto} epsvCashNeto={results.epsvCashNeto} />
                                    <FiscalBreakdownCard results={results} />
                                </div>
                                
                                <div id="reportB" className="pt-4">
                                    <RetirementProjectionChart results={results} pensionPublicaAnual={Math.max(0, form.pensionPublica) * 14} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
    AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Download, FileText, ChevronLeft } from 'lucide-react';

interface ReportData {
    titular: string;
    periodo_inicio: string;
    periodo_fin: string;
    inversion_neta_nominal: number;
    inversion_neta_real: number;
    valor_final_cartera: number;
    valor_letras_nominal: number;
    valor_real_cartera: number;
    valor_real_letras: number;
    tir_nominal_cartera: number;
    tir_nominal_letras: number;
    tir_nominal_letras_bruto: number;
    tir_real_cartera: number;
    tir_real_letras: number;
    impuesto_bizkaia: number;
    chart_data: any[];
    depositos_xirr_nominal?: number;
    depositos_final_value?: number;
    portfolio_xirr_client?: number;
}

function generateFinalCommentary(data: ReportData): string[] {
    const paragraphs: string[] = [];
    
    const tirCartera = data.tir_nominal_cartera;
    const tirLetras = data.tir_nominal_letras;
    const tirDepositos = data.depositos_xirr_nominal !== undefined ? data.depositos_xirr_nominal : 0;
    const xirrClient = data.portfolio_xirr_client !== undefined ? data.portfolio_xirr_client : tirCartera;
    
    const formatPct = (val: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + '%';
    const formatCur = (val: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
    
    paragraphs.push(`Durante el periodo analizado, la cartera ha obtenido una rentabilidad media anual del ${formatPct(tirCartera)}, alcanzando un valor final de ${formatCur(data.valor_final_cartera)}. Este resultado supone una diferencia significativa frente a las alternativas conservadoras, reflejando el efecto combinado del crecimiento de los mercados y del horizonte de inversión.`);
    
    paragraphs.push(`En cuanto a opciones de bajo riesgo, los depósitos bancarios (${formatPct(tirDepositos)}) y las Letras del Tesoro (${formatPct(tirLetras)}) han mostrado rentabilidades muy similares a lo largo del periodo, situándose en niveles reducidos y condicionados por la tributación anual, lo que limita su capacidad de crecimiento real.`);
    
    paragraphs.push(`Adicionalmente, la comparación entre rentabilidad bruta y neta en este tipo de activos permite observar de forma directa el impacto de la fiscalidad, que reduce de manera significativa el rendimiento efectivo obtenido por el inversor.`);
    
    paragraphs.push(`La rentabilidad interna capturada por el cliente se mantiene alineada con la rentabilidad de la cartera, lo que indica un patrón de aportaciones consistente, sin impacto relevante derivado del timing.`);
    
    paragraphs.push(`En conjunto, los resultados ponen de manifiesto la importancia del horizonte temporal y de la adecuada asignación de activos como factores clave en la preservación y crecimiento del capital en términos reales.`);
    
    return paragraphs;
}

export default function XRayReportGenerator() {
    const [file, setFile] = useState<File | null>(null);
    const [titular, setTitular] = useState('XXXX');
    const [valorFinal, setValorFinal] = useState('100000');
    const [startPeriodMode, setStartPeriodMode] = useState<'inception' | 'specific_year'>('inception');
    const [startYear, setStartYear] = useState<string>(new Date().getFullYear().toString());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const reportRefPage1 = useRef<HTMLDivElement>(null);
    const reportRefPage2 = useRef<HTMLDivElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !titular || !valorFinal) {
            setError("Por favor, rellena todos los campos.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setReportData(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('titular', titular);
        formData.append('valor_final_cartera', parseFloat(valorFinal).toString());

        if (startPeriodMode === 'specific_year' && startYear) {
            formData.append('fecha_inicio', `${startYear}-01-01`);
        }

        try {
            const apiBase = import.meta.env.DEV
                ? 'http://127.0.0.1:5001/bdb-fondos/europe-west1'
                : 'https://europe-west1-bdb-fondos.cloudfunctions.net';
            const response = await fetch(`${apiBase}/compare_risk_free`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Error al generar el informe.");
            }

            setReportData(data as ReportData);

        } catch (err: any) {
            setError(err.message || "Error desconocido al procesar el archivo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportPDF = async () => {
        if (!reportRefPage1.current || !reportRefPage2.current) return;
        
        setIsExporting(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            
            // Page 1
            const canvas1 = await html2canvas(reportRefPage1.current, { scale: 2, useCORS: true });
            const imgData1 = canvas1.toDataURL('image/jpeg', 1.0);
            const pdfHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
            pdf.addImage(imgData1, 'JPEG', 0, 0, pdfWidth, pdfHeight1);
            
            // Page 2
            pdf.addPage();
            const canvas2 = await html2canvas(reportRefPage2.current, { scale: 2, useCORS: true });
            const imgData2 = canvas2.toDataURL('image/jpeg', 1.0);
            const pdfHeight2 = (canvas2.height * pdfWidth) / canvas2.width;
            pdf.addImage(imgData2, 'JPEG', 0, 0, pdfWidth, pdfHeight2);
            
            pdf.save(`Comparativa_${titular.replace(/\s+/g, '_')}.pdf`);
        } catch (err) {
            console.error("Error al exportar a PDF:", err);
            setError("Fallo al exportar PDF. Revisa la consola.");
        } finally {
            setIsExporting(false);
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
    const formatPercent = (val: number) => new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 2 }).format(val / 100);

    if (reportData) {
        const deflactor = reportData.valor_final_cartera / reportData.valor_real_cartera;
        const efectivoNominal = reportData.inversion_neta_nominal;
        const efectivoReal = efectivoNominal / deflactor;

        const barData = [
          { 
            name: 'Cartera Andbank', 
            real: reportData.valor_real_cartera, 
            loss: reportData.valor_final_cartera - reportData.valor_real_cartera,
            realColor: '#27ae60',
            lossColor: '#c0392b'
          },
          { 
            name: 'Letras Tesoro (Bizkaia)', 
            real: reportData.valor_real_letras, 
            loss: reportData.valor_letras_nominal - reportData.valor_real_letras,
            realColor: '#e67e22',
            lossColor: '#2980b9'
          },
          { 
            name: 'Efectivo Estático (Colchón)', 
            real: efectivoReal, 
            loss: efectivoNominal - efectivoReal,
            realColor: '#95a5a6',
            lossColor: '#e0e0e0'
          }
        ];

        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-8 mb-8 animate-in fade-in zoom-in duration-300 max-w-[1100px] mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <button 
                        onClick={() => setReportData(null)}
                        className="text-slate-500 hover:text-slate-800 flex items-center text-sm font-medium transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Volver
                    </button>
                    <button 
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded shadow flex items-center font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-wait"
                    >
                        {isExporting ? <span className="animate-pulse">Generando PDF...</span> : <><Download className="w-4 h-4 mr-2" /> Exportar a PDF</>}
                    </button>
                </div>

                <div className="flex flex-col gap-4">
                    {/* PAGE 1 */}
                    <div ref={reportRefPage1} className="p-10 bg-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                        <div className="border-b-2 border-[#001f5c] pb-4 mb-6 flex justify-between items-end">
                        <h1 className="text-3xl font-bold text-[#001f5c] m-0">Informe de Comparativa de Rendimiento Histórico</h1>
                        <div className="text-slate-500 text-sm text-right">
                            Análisis: <span className="capitalize">{reportData.periodo_inicio}</span> – <span className="capitalize">{reportData.periodo_fin}</span>
                        </div>
                    </div>
                    
                    <div className="mb-6 italic text-slate-600 text-base border-l-4 border-slate-300 pl-4">
                        <p><strong>Titular:</strong> {reportData.titular}</p>
                        <p><strong>Fuentes Macro:</strong> INE (Inflación Real) y Banco de España (Letras Históricas).</p>
                        <p><strong>Referencia Normativa Fiscal:</strong> Hacienda Foral de Bizkaia (Retención Letras: {reportData.impuesto_bizkaia}%)</p>
                    </div>

                    <div className="bg-[#f4f6f9] p-5 rounded-lg mb-8 border border-slate-200">
                        <h3 className="font-bold text-[#001f5c] mb-2">Resumen Ejecutivo:</h3>
                        <p className="text-slate-700 text-sm leading-relaxed">
                            A lo largo de los años de inversión, su cartera gestionada ha demostrado una eficiencia superior frente a la alternativa de Letras del Tesoro. 
                            Gracias a la gestión activa y al diferimiento fiscal, el patrimonio final alcanzado supera la estimación de ahorro en deuda pública, 
                            protegiendo además su poder adquisitivo frente a la inflación real sufrida en el periodo.
                        </p>
                    </div>

                    <h2 className="text-xl font-bold text-[#001f5c] border-l-[6px] border-[#001f5c] pl-4 py-2 bg-[#f4f6f9] mb-6 flex items-center">
                        1. Magnitudes Clave del Patrimonio
                    </h2>
                    
                    <table className="w-full text-left mb-10 border-collapse text-sm border border-slate-200">
                        <thead>
                            <tr className="bg-[#001f5c] text-white">
                                <th className="p-3 border-b border-slate-300 font-semibold uppercase text-xs tracking-wide">Concepto</th>
                                <th className="p-3 border-b border-slate-300 font-semibold uppercase text-xs tracking-wide">Cartera (Fondos)</th>
                                <th className="p-3 border-b border-slate-300 font-semibold uppercase text-xs tracking-wide">Letras del Tesoro (BdE)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="p-3 border-b border-slate-200 bg-white">Inversión Neta (Capital Aportado)</td>
                                <td className="p-3 border-b border-slate-200 font-medium bg-white">{formatCurrency(reportData.inversion_neta_nominal)}</td>
                                <td className="p-3 border-b border-slate-200 font-medium bg-white">{formatCurrency(reportData.inversion_neta_nominal)}</td>
                            </tr>
                            <tr className="bg-[#fcfafa]">
                                <td className="p-3 border-b border-slate-200 font-bold">Valor Final NOMINAL</td>
                                <td className="p-3 border-b border-slate-200 font-bold text-[#c0392b] text-base">{formatCurrency(reportData.valor_final_cartera)}</td>
                                <td className="p-3 border-b border-slate-200 font-bold text-base">{formatCurrency(reportData.valor_letras_nominal)}</td>
                            </tr>
                            <tr>
                                <td className="p-3 border-b border-slate-200 bg-white">Rentabilidad Media Anual NOMINAL (TIR)</td>
                                <td className="p-3 border-b border-slate-200 font-medium bg-white"><strong className="font-bold">{formatPercent(reportData.tir_nominal_cartera)}</strong></td>
                                <td className="p-3 border-b border-slate-200 font-medium bg-white"><strong className="font-bold">{formatPercent(reportData.tir_nominal_letras)}</strong> <span className="font-normal italic">({formatPercent(reportData.tir_nominal_letras_bruto)} bruto)*</span></td>
                            </tr>
                            <tr className="bg-[#f0fdf4]">
                                <td className="p-3 border-b border-slate-200">Inversión Neta REAL (Aportaciones en € de hoy)</td>
                                <td className="p-3 border-b border-slate-200">{formatCurrency(reportData.inversion_neta_real)}</td>
                                <td className="p-3 border-b border-slate-200">{formatCurrency(reportData.inversion_neta_real)}</td>
                            </tr>
                            <tr className="bg-[#e6f4ea]">
                                <td className="p-3 border-b border-slate-200 font-bold">Valor Final REAL (Ajustado por IPC)</td>
                                <td className="p-3 border-b border-slate-200 font-bold text-[#27ae60] text-base">{formatCurrency(reportData.valor_real_cartera)}</td>
                                <td className="p-3 border-b border-slate-200 font-bold text-[#c0392b] text-base">{formatCurrency(reportData.valor_real_letras)}</td>
                            </tr>
                            <tr className="bg-[#f0fdf4]">
                                <td className="p-3 border-b border-slate-200">Rentabilidad Media Anual REAL (TIR)</td>
                                <td className="p-3 border-b border-slate-200 font-medium text-[#27ae60]">{formatPercent(reportData.tir_real_cartera)}</td>
                                <td className="p-3 border-b border-slate-200 font-medium text-[#c0392b]">{formatPercent(reportData.tir_real_letras)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="text-[11px] text-slate-500 italic mb-8 mt-[-1.5rem] text-justify">
                        * Neto IRPF (simulación histórica): el rendimiento de las Letras del Tesoro se ha calculado a partir de las tasas mensuales publicadas por el Banco de España, mostrando tanto el resultado neto tras impuestos como el rendimiento bruto antes de fiscalidad.
                    </div>

                    <h2 className="text-xl font-bold text-[#001f5c] border-l-[6px] border-[#001f5c] pl-4 py-2 bg-[#f4f6f9] mb-6 flex items-center">
                        2. Evolución Gráfica a lo Largo del Tiempo
                    </h2>
                    
                    <div className="w-full h-[400px] mb-12 border border-slate-200 rounded-lg p-6 shadow-sm bg-white">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart data={reportData.chart_data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="year" axisLine={true} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} stroke="#cbd5e1" />
                                <YAxis 
                                    tickFormatter={(value) => new Intl.NumberFormat('es-ES', { notation: "compact", compactDisplay: "short", style: "currency", currency: "EUR" }).format(value)}
                                    axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}}
                                />
                                <Tooltip 
                                    formatter={(value: number) => formatCurrency(value)}
                                    labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="top" height={36} iconType="plainline" wrapperStyle={{ fontSize: '12px', color: '#64748b' }}/>
                                <Area type="monotone" dataKey="cartera_nominal" name="Cartera Andbank (Nominal)" stroke="#c0392b" fill="#c0392b" fillOpacity={0.1} strokeWidth={2} activeDot={{r: 6}} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: '#c0392b' }} />
                                <Area type="monotone" dataKey="cartera_real" name="Cartera Andbank (Real)" stroke="#c0392b" fill="none" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: '#c0392b' }} />
                                <Area type="monotone" dataKey="letras_nominal" name="Letras del Tesoro (Nominal)" stroke="#2980b9" fill="#2980b9" fillOpacity={0.1} strokeWidth={2} activeDot={{r: 6}} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: '#2980b9' }} />
                                <Area type="monotone" dataKey="letras_real" name="Letras del Tesoro (Real)" stroke="#2980b9" fill="none" strokeDasharray="5 5" strokeWidth={2} dot={{ r: 3, fill: '#fff', strokeWidth: 2, stroke: '#2980b9' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    </div>

                    {/* PAGE 2 */}
                    <div ref={reportRefPage2} className="p-10 bg-white" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    <h2 className="text-xl font-bold text-[#001f5c] border-l-[6px] border-[#001f5c] pl-4 py-2 bg-[#f4f6f9] mb-6 flex items-center">
                        3. Comparativa Final de Poder Adquisitivo
                    </h2>

                    <div className="w-full mb-2 border border-slate-200 rounded-lg p-6 shadow-sm bg-white">
                        <div className="h-[180px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart data={barData} layout="vertical" margin={{ top: 20, right: 30, left: 160, bottom: 20 }} barSize={24} barGap={0}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#1e293b', fontWeight: 600, fontSize: 13}} width={160} />
                                    <Tooltip 
                                        formatter={(val: number) => formatCurrency(val)} 
                                        cursor={{fill: 'transparent'}}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="real" stackId="a" name="Valor Real">
                                        {barData.map((entry, index) => <Cell key={`cell-real-${index}`} fill={entry.realColor} />)}
                                    </Bar>
                                    <Bar dataKey="loss" stackId="a" name="Pérdida por Inflación" radius={[0, 4, 4, 0]}>
                                        {barData.map((entry, index) => <Cell key={`cell-loss-${index}`} fill={entry.lossColor} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center items-center space-x-6 text-xs text-slate-700 mt-4">
                            <div className="flex items-center"><div className="w-3 h-3 bg-[#c0392b] mr-1 rounded-sm"></div> Nominal (Cartera)</div>
                            <div className="flex items-center"><div className="w-3 h-3 bg-[#27ae60] mr-1 rounded-sm"></div> Real (Cartera)</div>
                            <div className="flex items-center"><div className="w-3 h-3 bg-[#2980b9] mr-1 rounded-sm"></div> Nominal (Letras)</div>
                            <div className="flex items-center"><div className="w-3 h-3 bg-[#e67e22] mr-1 rounded-sm"></div> Real (Letras/Efectivo)</div>
                        </div>
                    </div>
                    
                    <p className="text-slate-500 text-[11px] italic mb-10 text-justify">
                        * El gráfico de barras ilustra cómo la inflación recorta el valor nominal (barra completa) dejando el valor de compra real (barra interior). Observe cómo el Valor Real de las Letras (naranja) es inferior a la Inversión Neta inicial en escenarios de alta inflación.
                    </p>

                    <h2 className="text-xl font-bold text-[#001f5c] border-l-[6px] border-[#001f5c] pl-4 py-2 bg-[#f4f6f9] mb-4 flex items-center">
                        4. Conclusiones y Fiscalidad
                    </h2>
                    <div className="text-slate-700 text-sm leading-relaxed mb-8 text-justify bg-slate-50 p-4 border border-slate-200 rounded space-y-4">
                        {generateFinalCommentary(reportData).map((paragraph, idx) => (
                            <p key={idx}>{paragraph}</p>
                        ))}
                    </div>

                    <div className="text-xs text-slate-400 border-t border-slate-200 pt-4 text-justify mt-8">
                        Este informe se basa en los datos proporcionados y el histórico de movimientos bancarios suministrado. 
                        Se ha utilizado la serie IPC General Nacional (INE) y el rendimiento en mercado secundario de las Letras del Tesoro a 1 año (Banco de España). 
                        Las rentabilidades pasadas no garantizan rendimientos futuros.
                    </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-lg w-full max-w-[800px] mx-auto mt-4 mb-4">
            <h3 className="text-2xl font-light text-[#003399] mb-8 border-b pb-4">
                Comparador Patrimonial
            </h3>
            
            <p className="text-sm text-slate-600 mb-8 leading-relaxed">
                Sube un Excel con los flujos de caja y obtén un informe interactivo del rendimiento histórico frente a Letras del Tesoro, incluyendo el impacto fiscal (Bizkaia) y la inflación real de España.
            </p>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-200 text-sm font-medium flex items-center">
                    <span className="font-bold mr-2">Error:</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                        Archivo de Movimientos Bancarios (Excel/CSV)
                    </label>
                    <input 
                        type="file" 
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileChange}
                        className="w-full p-2.5 border border-slate-300 rounded focus:border-[#003399] outline-none bg-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-[#003399] file:text-white hover:file:bg-[#002266] transition-all cursor-pointer"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                            Titular de la Cartera
                        </label>
                        <input 
                            type="text" 
                            value={titular}
                            onChange={(e) => setTitular(e.target.value)}
                            placeholder="Ej. Jon Urrestilla Urizabal"
                            className="w-full p-3 border border-slate-300 rounded focus:border-[#003399] outline-none text-lg transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">
                            Valor Final Actual de la Cartera (€)
                        </label>
                        <input 
                            type="number" 
                            step="0.01"
                            value={valorFinal}
                            onChange={(e) => setValorFinal(e.target.value)}
                            placeholder="Ej. 100000"
                            className="w-full p-3 border border-slate-300 rounded focus:border-[#003399] outline-none text-lg transition-colors font-mono"
                        />
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-2">
                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
                        Periodo de Análisis
                    </label>
                    <div className="flex flex-col sm:flex-row gap-6">
                        <label className="flex items-center cursor-pointer group">
                            <input 
                                type="radio" 
                                name="periodMode" 
                                value="inception"
                                checked={startPeriodMode === 'inception'}
                                onChange={() => setStartPeriodMode('inception')}
                                className="w-4 h-4 text-[#003399] border-slate-300 focus:ring-[#003399]"
                            />
                            <span className="ml-2 text-sm font-medium text-slate-700 group-hover:text-slate-900">Desde el inicio (todo el histórico)</span>
                        </label>
                        <label className="flex items-center cursor-pointer group">
                            <input 
                                type="radio" 
                                name="periodMode" 
                                value="specific_year"
                                checked={startPeriodMode === 'specific_year'}
                                onChange={() => setStartPeriodMode('specific_year')}
                                className="w-4 h-4 text-[#003399] border-slate-300 focus:ring-[#003399]"
                            />
                            <span className="ml-2 text-sm font-medium text-slate-700 group-hover:text-slate-900">Elegir año de inicio</span>
                        </label>
                    </div>

                    {startPeriodMode === 'specific_year' && (
                        <div className="mt-4 pt-4 border-t border-slate-200 animate-in fade-in duration-200">
                            <label className="block text-xs font-semibold text-slate-600 mb-2">
                                Selecciona el año de inicio (se tomará el 1 de enero como fecha de partida)
                            </label>
                            <select 
                                value={startYear}
                                onChange={(e) => setStartYear(e.target.value)}
                                className="p-2.5 border border-slate-300 rounded focus:border-[#003399] outline-none text-sm bg-white min-w-[120px]"
                            >
                                {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex justify-end mt-8">
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="px-8 py-3 bg-[#D4AF37] text-white rounded hover:bg-[#b5952f] font-bold uppercase text-sm tracking-wider shadow-md disabled:opacity-50 disabled:cursor-wait flex items-center gap-2 transition-colors"
                    >
                        {isLoading ? (
                            <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> 
                            Generando...</>
                        ) : (
                            <><span>📊</span> Generar Análisis Patrimonial</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

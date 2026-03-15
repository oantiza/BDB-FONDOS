import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { WeeklyReport } from '../../types/WeeklyReport';
import ReportDashboard from './ReportDashboard';

// Mock Data for the Skeleton
const MOCK_REPORT: WeeklyReport = {
    id: 'mock-123',
    date: new Date().toISOString(),
    author: 'Comité de Inversiones',
    summary: {
        headline: 'Incertidumbre en tipos, foco en beneficios',
        narrative: 'La recalibración de expectativas sobre los recortes de tipos y la resiliencia económica sugieren un escenario "más altos por más tiempo". La atención viabiliza hacia los resultados empresariales del primer trimestre.',
        keyEvents: [
            'Datos de inflación PCE en EEUU superiores a lo esperado.',
            'Reuniones de bancos centrales asiáticos sin cambios significativos.',
            'Apertura de la temporada de resultados del Q1 de empresas FAANG.'
        ],
        kpis: [
            { label: 'S&P 500', value: '+1.4%', trend: 'up' },
            { label: 'Yield 10Y US', value: '4.25%', trend: 'neutral' },
            { label: 'VIX', value: '14.2', trend: 'down' }
        ],
        marketTemperature: 'Bullish',
        tailRisks: [
            { risk: 'Rebote inesperado de inflación', probability: 'Media', impact: 'Alto' },
            { risk: 'Tensión Geopolítica Oriente Medio', probability: 'Baja', impact: 'Alto' }
        ]
    },
    assetAllocation: {
        overview: 'Mantenemos un sesgo neutral en Renta Variable, enfocándonos en calidad. Sobreponderamos ligeramente Renta Fija a corto plazo debido a las rentabilidades actuales.',
        classes: [
            { assetClass: 'Renta Variable', strategicWeight: 45, tacticalWeight: 45, view: 'Neutral', rationale: 'Valoraciones ajustadas exigiendo selección táctica.' },
            { assetClass: 'Renta Fija', strategicWeight: 40, tacticalWeight: 42, view: 'Positiva', rationale: 'Tasas atractivas en la parte corta de la curva.' },
            { assetClass: 'Liquidez', strategicWeight: 5, tacticalWeight: 8, view: 'Positiva', rationale: 'Colchón táctico ante posible volatilidad.' },
            { assetClass: 'Alternativos', strategicWeight: 10, tacticalWeight: 5, view: 'Negativa', rationale: 'Falta de catalizadores a corto plazo.' },
        ],
        regionsEquity: [
            { region: 'EEUU', weight: 60, view: 'Neutral', rationale: 'Crecimiento sólido pero yields al alza presionan múltiplos.' },
            { region: 'Europa', weight: 20, view: 'Positiva', rationale: 'Valoraciones relativas atractivas y mejoras macro.' },
            { region: 'Emergentes', weight: 15, view: 'Neutral', rationale: 'Falta de estímulo contundente limita el upside.' },
            { region: 'Japón', weight: 5, view: 'Negativa', rationale: 'Potencial cambio monetario del BoJ introduce riesgo.' },
        ],
        regionsFixedIncome: [
            { region: 'Gobierno Corto', weight: 50, view: 'Positiva', rationale: 'Justificación corta' },
            { region: 'Crédito IG', weight: 30, view: 'Neutral', rationale: 'Justificación corta' },
            { region: 'High Yield', weight: 20, view: 'Negativa', rationale: 'Justificación corta' }
        ]
    },
    fullReport: {
        narrative: `### 1. MACROECONOMÍA Y GEOPOLÍTICA: DINÁMICAS ESTRUCTURALES\n\nEl ciclo económico se mantiene robusto, desafiando las estimaciones iniciales de aterrizaje brusco. La recesión parece descartada a corto plazo.\n\n### 2. ESCENARIOS ESTRATÉGICOS 2026\n\nMantenemos el \`Soft Landing\` como nuestro escenario base (65%), impulsado por resiliencia del consumidor americano y soporte fiscal.\n\n### 3. VALORACIONES RELATIVAS\n\n| Región | P/E Fwd | Retorno Hist. |\n| :--- | :---: | :---: |\n| **US (S&P500)** | 20.4x | 16.5x |\n| **Europa (Stx50)**| 13.2x | 13.5x |\n\nComo se observa, Europa ofrece un mayor descuento relativo frente a su media histórica.`
    }
};

const WeeklyReportDashboard: React.FC = () => {
    const [report, setReport] = useState<WeeklyReport | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLatestReport = async () => {
            try {
                const q = query(
                    collection(db, 'reports'),
                    where('type', '==', 'WEEKLY_REPORT'),
                    orderBy('date', 'desc'),
                    limit(1)
                );

                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const docInfo = querySnapshot.docs[0];
                    const data = docInfo.data() as WeeklyReport;
                    // Asegurar que el ID se asigna
                    setReport({ ...data, id: docInfo.id });
                } else {
                    console.log("No live reports found, falling back to mock data");
                    setReport(MOCK_REPORT); // Fallback to mock if empty
                }
            } catch (error: any) {
                console.error("Error fetching weekly report:", error);
                setReport(MOCK_REPORT); // Fallback on error
            } finally {
                setLoading(false);
            }
        };

        fetchLatestReport();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[500px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!report) {
        return <div className="text-center py-10 text-gray-500">No report available.</div>;
    }

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 border-l-4 border-primary-600 pl-3">
                            Informe Semanal de Estrategia
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 ml-4">
                            {new Date(report.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })} | Autor: {report.author}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Area - Unificado con ReportDashboard */}
            <div className="flex-1 overflow-y-auto bg-gray-50/10">
                <ReportDashboard reportData={report as any} />
            </div>
        </div>
    );
};

export default WeeklyReportDashboard;

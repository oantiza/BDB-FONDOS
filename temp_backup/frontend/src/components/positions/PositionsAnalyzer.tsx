import React, { useState } from 'react';
import Papa from 'papaparse';
import { FileUpload } from './FileUpload';
import { PositionsTable } from './PositionsTable';
import { PieChart, RotateCcw, ArrowLeft } from 'lucide-react';
import { findHomogeneousAlternatives } from '../../utils/fundSwapper';
import { RetrocessionComparisonModal } from './RetrocessionComparisonModal';

import { Fund } from '../../types';

interface PositionData {
    isin: string;
    nombre: string;
    total: number;
    retrocession?: number;
    fundFound: boolean;
}

interface PositionsAnalyzerProps {
    onBack?: () => void;
    assets: Fund[];
}

export const PositionsAnalyzer: React.FC<PositionsAnalyzerProps> = ({ onBack, assets }) => {
    const [data, setData] = useState<PositionData[]>([]);
    const [totalGeneral, setTotalGeneral] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasData, setHasData] = useState(false);

    // Analysis State
    const [selectedPos, setSelectedPos] = useState<PositionData | null>(null);
    const [analyzedFund, setAnalyzedFund] = useState<Fund | null>(null);
    const [alternatives, setAlternatives] = useState<any[]>([]);

    const handleAnalyzePosition = (pos: PositionData) => {
        // 1. Find the full Fund object in 'assets'
        const originalFund = assets.find(a => a.isin === pos.isin);
        if (!originalFund) {
            alert("No se encontraron datos detallados para este fondo en la base de datos.");
            return;
        }

        // 2. Find homogeneous alternatives (Same category, highest retrocession)
        const results = findHomogeneousAlternatives(originalFund, assets);

        setAlternatives(results);
        setAnalyzedFund(originalFund);
        setSelectedPos(pos);
    };

    const parseEuropeanNumber = (str: any): number => {
        if (!str) return 0;
        if (typeof str === 'number') return str;

        let cleanStr = str.toString().trim();
        // Remove thousand separators (.) and replace decimal separator (,) with (.)
        cleanStr = cleanStr.replace(/\./g, '');
        cleanStr = cleanStr.replace(',', '.');

        const val = parseFloat(cleanStr);
        return isNaN(val) ? 0 : val;
    };

    const processFile = (file: File) => {
        setIsLoading(true);
        setError(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            encoding: "ISO-8859-1",
            delimiter: ";",
            complete: function (results: any) {
                try {
                    aggregateData(results.data);
                    setIsLoading(false);
                    setHasData(true);
                } catch (err: any) {
                    setIsLoading(false);
                    setError("Error al procesar los datos: " + err.message);
                    console.error(err);
                }
            },
            error: function (err: any) {
                setIsLoading(false);
                setError("Error de lectura: " + err.message);
            }
        });
    };

    const aggregateData = (rawData: any[]) => {
        const fundsMap = new Map();
        let total = 0;

        if (rawData.length > 0) {
            const firstRow = rawData[0];
            const keyIsin = Object.keys(firstRow).find(k => k.toUpperCase().includes('ISIN'));
            const keyInstrumento = Object.keys(firstRow).find(k => k.toUpperCase().includes('INSTRUMENTO'));
            const keyValor = Object.keys(firstRow).find(k => k.toUpperCase().includes('VALOR DE MERCADO'));

            if (!keyIsin || !keyInstrumento || !keyValor) {
                throw new Error("No se encontraron las columnas necesarias (ISIN, INSTRUMENTO, VALOR DE MERCADO).");
            }

            rawData.forEach(row => {
                const isin = row[keyIsin] ? row[keyIsin].trim() : "";
                const nombre = row[keyInstrumento] ? row[keyInstrumento].trim() : "";
                const valorRaw = row[keyValor];

                if (isin && isin.length > 5) {
                    const valor = parseEuropeanNumber(valorRaw);

                    // Lookup in local database
                    const foundFund = assets.find(a => a.isin === isin);
                    let retrocession = undefined;
                    let fundFound = false;

                    if (foundFund) {
                        fundFound = true;
                        retrocession = (foundFund.manual?.costs as any)?.retrocession ?? (foundFund.costs as any)?.retrocession ?? (foundFund as any).retrocession ?? 0;
                    }

                    if (fundsMap.has(isin)) {
                        const current = fundsMap.get(isin);
                        current.total += valor;
                        fundsMap.set(isin, current);
                    } else {
                        fundsMap.set(isin, {
                            isin: isin,
                            nombre: nombre,
                            total: valor,
                            retrocession: retrocession,
                            fundFound: fundFound
                        });
                    }
                    total += valor;
                }
            });
        }

        const processedData = Array.from(fundsMap.values()).sort((a, b) => b.total - a.total);
        setData(processedData);
        setTotalGeneral(total);
    };

    const handleReset = () => {
        setData([]);
        setTotalGeneral(0);
        setHasData(false);
        setError(null);
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
            {/* Header matches main app */}
            <header className="bg-gradient-to-r from-slate-800 to-slate-700 text-white shadow-sm border-b border-slate-600 mb-8 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            {onBack && (
                                <button onClick={onBack} className="bg-white/10 border border-white/20 text-slate-200 hover:text-white p-1.5 rounded-full hover:bg-white/20 transition-colors shadow-sm" title="Volver">
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            )}
                            <div className="font-light text-xl tracking-tight leading-none mb-0.5 text-white whitespace-nowrap">Gestor de <span className="font-bold text-blue-200">Fondos</span></div>
                        </div>
                        <div className="h-6 w-px bg-slate-600 mx-2"></div>
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-slate-700/50 rounded-lg">
                                <PieChart className="text-[#D4AF37] w-5 h-5" />
                            </div>
                            <h1 className="text-lg font-light tracking-tight text-white whitespace-nowrap">Analizador de <span className="font-bold text-blue-200">posiciones globales</span></h1>
                        </div>
                    </div>
                    {hasData && (
                        <button
                            onClick={handleReset}
                            className="bg-slate-700/50 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-full transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2 border border-slate-500 shadow-sm"
                        >
                            <RotateCcw className="w-3.5 h-3.5" /> Nueva Carga
                        </button>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {error && (
                    <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                    </div>
                )}

                {!hasData && !isLoading && (
                    <FileUpload onFileSelect={processFile} />
                )}

                {isLoading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Procesando datos...</p>
                    </div>
                )}

                {hasData && (
                    <PositionsTable
                        data={data}
                        totalGeneral={totalGeneral}
                        onAnalyze={handleAnalyzePosition}
                    />
                )}
            </main>

            {/* Analysis Modal */}
            {selectedPos && analyzedFund && (
                <RetrocessionComparisonModal
                    isOpen={!!selectedPos}
                    onClose={() => { setSelectedPos(null); setAnalyzedFund(null); }}
                    originalFund={{
                        isin: selectedPos.isin,
                        nombre: selectedPos.nombre,
                        retrocession: selectedPos.retrocession,
                        category: analyzedFund.category_morningstar || analyzedFund.std_type,
                        region: analyzedFund.primary_region || analyzedFund.std_region,
                        rating: analyzedFund.rating_overall,
                        sectors: analyzedFund.sectors,
                        volatility: analyzedFund.std_perf?.volatility,
                        sharpe: analyzedFund.std_perf?.sharpe,
                        ter: analyzedFund.std_extra?.ter
                    }}
                    alternatives={alternatives}
                />
            )}
        </div>
    );
};

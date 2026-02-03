import React, { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Download } from 'lucide-react';

interface PositionData {
    isin: string;
    nombre: string;
    total: number;
    retrocession?: number;
    fundFound: boolean;
}

// Add to PositionsTableProps interface
interface PositionsTableProps {
    data: PositionData[];
    totalGeneral: number;
    onAnalyze: (position: PositionData) => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({ data, totalGeneral, onAnalyze }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'found' | 'missing'>('all');
    const [sortConfig, setSortConfig] = useState<{ key: keyof PositionData; direction: 'asc' | 'desc' }>({ key: 'total', direction: 'desc' });
    const [coefficient, setCoefficient] = useState<number>(1.0);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    const handleSort = (key: keyof PositionData) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesSearch = item.isin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.nombre.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (filterStatus === 'found') return item.fundFound;
            if (filterStatus === 'missing') return !item.fundFound;

            return true;
        });
    }, [data, searchTerm, filterStatus]);

    const sortedData = useMemo(() => {
        return [...filteredData].sort((a, b) => {
            // Special handling for Retrocession sorting
            if (sortConfig.key === 'retrocession') {
                const retroA = a.retrocession ?? -1;
                const retroB = b.retrocession ?? -1;
                return sortConfig.direction === 'asc' ? retroA - retroB : retroB - retroA;
            }

            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [filteredData, sortConfig]);

    const filteredTotal = useMemo(() => {
        return filteredData.reduce((acc, curr) => acc + curr.total, 0);
    }, [filteredData]);

    const totalIngresoEstimado = useMemo(() => {
        return filteredData.reduce((acc, curr) => {
            const retro = curr.retrocession || 0;
            const cesion = retro * coefficient;
            const ingreso = curr.total * (cesion / 100);
            return acc + ingreso;
        }, 0);
    }, [filteredData, coefficient]);

    const exportToCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += `ISIN;NOMBRE DEL FONDO;RETROCESION;COEFICIENTE;CESION;CANTIDAD TOTAL;INGRESO ESTIMADO\n`;

        sortedData.forEach(function (row) {
            let totalStr = row.total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            let retroStr = row.retrocession !== undefined ? `${Number(row.retrocession).toFixed(2)}%` : 'N/A';

            const retroVal = row.retrocession || 0;
            const cesionVal = retroVal * coefficient;
            const ingresoVal = row.total * (cesionVal / 100);

            const cesionStr = `${cesionVal.toFixed(2)}%`;
            const ingresoStr = ingresoVal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            let rowStr = `${row.isin};"${row.nombre}";"${retroStr}";"${coefficient}";"${cesionStr}";"${totalStr}";"${ingresoStr}"`;
            csvContent += rowStr + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "resumen_fondos_cesion.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100 ring-1 ring-slate-900/5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Coeficiente Cesión</p>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={coefficient}
                            onChange={(e) => setCoefficient(parseFloat(e.target.value) || 0)}
                            className="text-2xl font-bold text-slate-900 w-full outline-none border-b border-slate-200 focus:border-blue-500 transition-colors py-1"
                        />
                        <span className="text-slate-400 font-bold text-lg">x</span>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100 ring-1 ring-slate-900/5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Patrimonio</p>
                    <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(totalGeneral)}</h3>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100 ring-1 ring-slate-900/5">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ingreso Estimado Total</p>
                    <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIngresoEstimado)}</h3>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100 ring-1 ring-slate-900/5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Acciones</p>
                        <h3 className="text-sm font-medium text-slate-700">Exportar Informe</h3>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-all shadow-sm flex items-center gap-2 text-sm font-medium"
                        title="Descargar CSV"
                    >
                        <Download className="w-4 h-4" /> CSV
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden flex flex-col max-h-[70vh] ring-1 ring-slate-900/5">
                <div className="px-6 py-4 border-b border-slate-100 bg-white flex flex-wrap gap-4 justify-between items-center shrink-0">
                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        Desglose de Cartera
                    </h3>

                    <div className="flex items-center gap-4">
                        {/* Status Filter */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Estado:</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'found' | 'missing')}
                                className="px-3 py-1.5 border border-slate-200 rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-slate-50 hover:bg-white transition-colors cursor-pointer"
                            >
                                <option value="all">Ver Todos</option>
                                <option value="found">Con Retrocesión</option>
                                <option value="missing">Sin Datos</option>
                            </select>
                        </div>

                        {/* Search */}
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Buscar ISIN o nombre..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none w-64 bg-slate-50 group-hover:bg-white transition-all"
                            />
                            <Search className="absolute left-3 top-2 text-slate-400 w-4 h-4" />
                        </div>
                    </div>
                </div>
                <div className="overflow-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    <table className="min-w-full divide-y divide-slate-100 relative">
                        <thead className="bg-slate-50/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors"
                                    onClick={() => handleSort('isin')}
                                >
                                    <div className="flex items-center gap-1">
                                        ISIN <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors"
                                    onClick={() => handleSort('nombre')}
                                >
                                    <div className="flex items-center gap-1">
                                        Fondo <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors"
                                    onClick={() => handleSort('retrocession')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Retrocesión <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-right text-xs font-semibold text-blue-600 uppercase tracking-wider"
                                >
                                    Cesión Total
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100/50 transition-colors"
                                    onClick={() => handleSort('total')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Valor <ArrowUpDown className="w-3 h-3 text-slate-400" />
                                    </div>
                                </th>
                                <th
                                    scope="col"
                                    className="px-6 py-3 text-right text-xs font-semibold text-emerald-600 uppercase tracking-wider"
                                >
                                    Ingreso Est.
                                </th>
                                <th scope="col" className="px-6 py-3 relative">
                                    <span className="sr-only">Analizar</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50 text-sm">
                            {sortedData.map((fund, idx) => {
                                const retroVal = fund.retrocession || 0;
                                const cesionTotal = retroVal * coefficient;
                                const ingresoEst = fund.total * (cesionTotal / 100);

                                return (
                                    <tr key={fund.isin} className={`hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-xs font-medium text-slate-500 font-mono">{fund.isin}</td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-900 font-medium">{fund.nombre}</td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-right">
                                            {fund.fundFound ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                    {fund.retrocession !== undefined ? `${Number(fund.retrocession).toFixed(2)}%` : '0.00%'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wide border border-slate-200">
                                                    --
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm font-bold text-blue-600">
                                            {fund.fundFound ? `${cesionTotal.toFixed(2)}%` : '--'}
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-900 text-right font-medium tracking-tight">
                                            {formatCurrency(fund.total)}
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm font-bold text-emerald-600">
                                            {fund.fundFound ? formatCurrency(ingresoEst) : '--'}
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm font-medium">
                                            {fund.fundFound && (
                                                <button
                                                    onClick={() => onAnalyze(fund)}
                                                    className="text-blue-600 hover:text-blue-900 font-semibold text-xs uppercase tracking-wide hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                >
                                                    Analizar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold text-slate-900 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-slate-200">
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-right text-xs uppercase tracking-wider text-slate-500">Total Cartera:</td>
                                <td className="px-6 py-4 text-right text-lg text-slate-800 font-bold tracking-tight">{formatCurrency(filteredTotal)}</td>
                                <td className="px-6 py-4 text-right text-lg text-emerald-600 font-bold tracking-tight">{formatCurrency(totalIngresoEstimado)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
};

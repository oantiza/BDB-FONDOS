import React, { useState, useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import Plot from 'react-plotly.js';
import { Loader2, Globe, TrendingUp, Table as TableIcon, RefreshCw, Download, ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

// Lista ampliada de países (G20 + Europa)
const ALL_COUNTRIES = [
    "USA", "Euro Area", "China", "Germany", "Japan", "UK", "France", "Italy", "Spain",
    "Brazil", "India", "Canada", "South Korea", "Australia", "Mexico", "Indonesia",
    "Turkey", "Saudi Arabia", "South Africa", "Russia", "Argentina"
].sort();

// Lista ampliada de indicadores
const ALL_INDICATORS = [
    { id: "GDP", label: "PIB (Real)" },
    { id: "CPI", label: "IPC (Inflación)" },
    { id: "UNEMPLOYMENT", label: "Desempleo" },
    { id: "INTEREST_RATE", label: "Tipos de Interés" },
    { id: "GDP_PER_CAPITA", label: "PIB per Cápita" },
    { id: "GDP_PPP", label: "PIB (PPP)" },
    { id: "TRADE_BALANCE", label: "Balanza Comercial" },
    { id: "GOVT_DEBT", label: "Deuda Pública" }
];

interface MultiSelectDropdownProps {
    label: string;
    options: { id: string; label: string }[];
    selected: string[];
    onChange: (selected: string[]) => void;
    darkMode?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ label, options, selected, onChange, darkMode = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (id: string) => {
        if (selected.includes(id)) {
            onChange(selected.filter(item => item !== id));
        } else {
            onChange([...selected, id]);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold outline-none flex items-center gap-2 transition-all shadow-sm group border
                    ${darkMode
                        ? 'bg-slate-800 border-slate-700 text-slate-200 hover:border-blue-500/50'
                        : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
            >
                <span className={`font-medium transition-colors ${darkMode ? 'text-slate-400 group-hover:text-slate-300' : 'text-blue-100 group-hover:text-white'}`}>{label}:</span>
                <span className={`px-2 py-0.5 rounded text-xs border ${darkMode ? 'bg-blue-600/20 text-blue-300 border-blue-500/20' : 'bg-white text-[#003399] border-white/20'}`}>
                    {selected.length}
                </span>
                <ChevronDown size={16} className={`transition-transform ${isOpen && "rotate-180"} ${darkMode ? 'text-slate-500' : 'text-blue-200'}`} />
            </button>

            {isOpen && (
                <div className={`absolute top-full left-0 mt-2 w-64 rounded-xl shadow-xl border z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200
                    ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                    <div className="max-h-64 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {options.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => toggleOption(option.id)}
                                className={clsx(
                                    "w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors",
                                    selected.includes(option.id)
                                        ? "bg-blue-600 text-white"
                                        : darkMode
                                            ? "hover:bg-slate-700 text-slate-300"
                                            : "hover:bg-slate-50 text-slate-600"
                                )}
                            >
                                {option.label}
                                {selected.includes(option.id) && <Check size={14} className="text-white" />}
                            </button>
                        ))}
                    </div>
                    <div className={`px-3 py-2 border-t flex justify-between ${darkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <button
                            onClick={() => onChange(options.map(o => o.id))}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            Seleccionar Todo
                        </button>
                        <button
                            onClick={() => onChange([])}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 hover:underline"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default function GlobalMacroIntelligence() {
    const [selectedCountries, setSelectedCountries] = useState<string[]>(["Euro Area"]);
    const [selectedIndicators, setSelectedIndicators] = useState<string[]>(["GDP"]);
    const [startYear, setStartYear] = useState<number>(new Date().getFullYear() - 10);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        if (selectedCountries.length === 0 || selectedIndicators.length === 0) {
            setData(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const fetchMacro = httpsCallable(functions, 'fetch_macro_data');
            const result = await fetchMacro({
                countries: selectedCountries,
                indicators: selectedIndicators,
                start_date: `${startYear}-01-01`
            });

            const data = result.data as any;
            if (data.error) {
                throw new Error(data.error);
            }
            setData(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error al obtener datos macroeconómicos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startYear]);

    const handleUpdate = () => {
        fetchData();
    };

    const handleExportCSV = () => {
        if (!data || !data.table_data) return;

        const dataKeys = Object.keys(data.table_data[0] || {}).filter(k => k !== 'country').sort();
        const headers = ["Country", ...dataKeys];

        const csvContent = [
            headers.join(","),
            ...data.table_data.map((row: any) =>
                headers.map(header => {
                    const val = header === "Country" ? row.country : row[header];
                    return val !== undefined && val !== null ? val : "";
                }).join(",")
            )
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `macro_data_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // Preparar datos para Plotly
    const chartData = data?.chart_series ? Object.entries(data.chart_series).map(([name, series]: [any, any]) => ({
        x: series.map((p: any) => p.x),
        y: series.map((p: any) => p.y),
        type: 'scatter',
        mode: 'lines',
        name: name,
        line: { shape: 'spline', width: 2.5 },
        hovertemplate: '<b>%{x}</b><br>%{y:.2f}<extra></extra>'
    })) : [];

    const countryOptions = ALL_COUNTRIES.map(c => ({ id: c, label: c }));

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-slate-700">

            {/* Header Area - Matches XRayPage Style */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-gradient-to-r from-[#003399] to-[#0055CC] p-6 rounded-3xl shadow-lg relative overflow-hidden text-white">

                <div className="relative z-10">
                    <h1 className="text-2xl font-extrabold flex items-center gap-3 text-white">
                        <div className="p-2 bg-white/10 rounded-xl border border-white/20">
                            <Globe className="text-white" size={24} />
                        </div>
                        Global Macro Intelligence
                    </h1>
                    <p className="text-blue-100 mt-1 font-medium text-sm ml-12">Monitor Económico G20 + Europa (FRED API)</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto relative z-10">

                    <MultiSelectDropdown
                        label="Países"
                        options={countryOptions}
                        selected={selectedCountries}
                        onChange={setSelectedCountries}
                        darkMode={false}
                    />

                    <MultiSelectDropdown
                        label="Indicadores"
                        options={ALL_INDICATORS}
                        selected={selectedIndicators}
                        onChange={setSelectedIndicators}
                        darkMode={false}
                    />

                    <div className="h-8 w-[1px] bg-white/20 mx-2 hidden md:block"></div>

                    <select
                        value={startYear}
                        onChange={(e) => setStartYear(Number(e.target.value))}
                        className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm font-bold text-white focus:ring-2 focus:ring-white/30 outline-none hover:bg-white/20 transition-colors [&>option]:text-slate-700"
                    >
                        {Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - i).map(year => (
                            <option key={year} value={year}>Desde {year}</option>
                        ))}
                    </select>

                    <button
                        onClick={handleUpdate}
                        disabled={loading}
                        className="px-6 py-2.5 bg-white text-[#003399] rounded-xl font-bold hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg text-sm ml-auto md:ml-0"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                        Refrescar
                    </button>

                    <button
                        onClick={handleExportCSV}
                        disabled={!data}
                        className="px-4 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl font-bold hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        title="Exportar a CSV"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* Visualization Area */}
            {error && (
                <div className="bg-red-50 border border-red-100 p-6 rounded-3xl text-red-700 font-medium flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">!</div>
                    {error}
                </div>
            )}

            <div className="bg-white border border-slate-200 p-8 rounded-[2.5rem] shadow-sm min-h-[500px] flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-black text-[#2C3E50] flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-xl border border-blue-100">
                            <TrendingUp size={20} className="text-[#003399]" />
                        </div>
                        Visualización Histórica
                    </h2>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        FRED DATA
                    </div>
                </div>

                <div className="flex-1 relative">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-20 rounded-2xl">
                            <Loader2 className="animate-spin text-[#003399] mb-4" size={48} />
                            <p className="text-[#2C3E50] font-black text-lg animate-pulse">PROCESANDO DATOS...</p>
                        </div>
                    )}

                    {chartData.length > 0 ? (
                        <div className="h-[500px] w-full">
                            <Plot
                                data={chartData}
                                layout={{
                                    autosize: true,
                                    margin: { t: 20, b: 60, l: 50, r: 20 },
                                    hovermode: 'x unified',
                                    showlegend: true,
                                    legend: {
                                        orientation: 'h',
                                        y: -0.15,
                                        x: 0.5,
                                        xanchor: 'center',
                                        font: { family: 'Inter, sans-serif', size: 11, color: '#64748b' }
                                    },
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    xaxis: {
                                        gridcolor: '#f1f5f9',
                                        zeroline: false,
                                        tickfont: { color: '#64748b', size: 10 }
                                    },
                                    yaxis: {
                                        gridcolor: '#f1f5f9',
                                        zeroline: false,
                                        tickfont: { color: '#64748b', size: 10 }
                                    },
                                    font: { family: 'Inter, sans-serif', color: '#2C3E50' }
                                }}
                                config={{ responsive: true, displayModeBar: false }}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler
                            />
                        </div>
                    ) : !loading && (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                            <Globe size={64} strokeWidth={1} />
                            <p className="text-base font-bold">Selecciona parámetros para visualizar</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-lg font-black text-[#2C3E50] flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                            <TableIcon size={20} className="text-indigo-600" />
                        </div>
                        Tabla Comparativa (Últimos 4 años + YTD)
                    </h2>
                </div>
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Región / País</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Métrica</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">2021</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">2022</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">2023</th>
                                <th className="px-4 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">2024</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-[#003399] uppercase tracking-widest bg-blue-50">YTD</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data?.table_data?.map((row: any) => (
                                selectedIndicators.map((id, idx) => (
                                    <tr key={`${row.country}-${id}`} className="group hover:bg-slate-50/50 transition-colors">
                                        {idx === 0 && (
                                            <td rowSpan={selectedIndicators.length} className="px-6 py-4 font-black text-[#2C3E50] border-r border-slate-100 align-top">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1 h-6 bg-[#003399] rounded-full"></div>
                                                    {row.country}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-4 py-4 text-center">
                                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-bold text-slate-500 uppercase">
                                                {ALL_INDICATORS.find(i => i.id === id)?.label || id}
                                            </span>
                                        </td>
                                        {[2021, 2022, 2023, 2024].map(year => (
                                            <td key={year} className="px-4 py-4 text-center font-mono text-xs font-semibold text-slate-600 group-hover:text-slate-800 transition-colors">
                                                {row[`${id}_${year}`] !== undefined && row[`${id}_${year}`] !== null ? row[`${id}_${year}`] : '—'}
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 text-center font-mono text-xs font-black text-[#003399] bg-blue-50">
                                            {row[`${id}_YTD`] !== undefined && row[`${id}_YTD`] !== null ? row[`${id}_YTD`] : '—'}
                                        </td>
                                    </tr>
                                ))
                            ))}
                        </tbody>
                    </table>
                </div>
                {(!data?.table_data || data.table_data.length === 0) && !loading && (
                    <div className="p-12 text-center text-slate-400 font-medium italic text-xs border-t border-slate-100">
                        <div className="mb-2 opacity-20">
                            <TableIcon size={32} className="mx-auto" />
                        </div>
                        Sin datos para mostrar.
                    </div>
                )}
            </div>
        </div>
    );
}

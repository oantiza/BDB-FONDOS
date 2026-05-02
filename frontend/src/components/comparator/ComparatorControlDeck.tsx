import React, { useState, useRef, useEffect } from 'react';
import { useSavedPortfolios, SavedPortfolio } from '../../hooks/useSavedPortfolios';
import { ChevronDown, X, Download, BarChart2, Check, Search, TrendingUp } from 'lucide-react';
import { PortfolioItem } from '../../types';
import { useSyntheticBenchmarks } from '../../hooks/useSyntheticBenchmarks';

interface ComparatorControlDeckProps {
    nameA: string;
    nameB: string;
    portfolioA: PortfolioItem[] | null;
    portfolioB: PortfolioItem[] | null;
    loadingA: boolean;
    loadingB: boolean;
    onSelectA: (p: any) => void;
    onSelectB: (p: any) => void;
    onRemoveA: () => void;
    onRemoveB: () => void;
    onDownloadPDF: () => void;
    generatingPdf: boolean;
}

export default function ComparatorControlDeck({
    nameA, nameB, portfolioA, portfolioB,
    loadingA, loadingB,
    onSelectA, onSelectB,
    onRemoveA, onRemoveB,
    onDownloadPDF, generatingPdf
}: ComparatorControlDeckProps) {
    const { savedPortfolios } = useSavedPortfolios();
    const [isSticky, setIsSticky] = useState(false);

    // Dropdown states
    const [openSelectorA, setOpenSelectorA] = useState(false);
    const [openSelectorB, setOpenSelectorB] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const { benchmarks, loading: loadingBenchmarks } = useSyntheticBenchmarks();

    const ref = useRef<HTMLDivElement>(null);

    // Filter portfolios tailored for dropdown
    const filteredPortfolios = savedPortfolios.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const filteredBenchmarks = benchmarks.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handleScroll = () => {
            if (ref.current) {
                setIsSticky(window.scrollY > 100);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Helper to render the portfolio list dropdown
    const renderDropdown = (onSelect: (p: SavedPortfolio) => void, close: () => void, currentName: string) => (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-slate-100 bg-slate-50">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar cartera..."
                        className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        autoFocus
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
                {/* 1. SECTION: Carteras Guardadas */}
                {filteredPortfolios.length > 0 && (
                    <>
                        <div className="px-3 py-1 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                            Carteras Guardadas
                        </div>
                        {filteredPortfolios.map(p => {
                            const isSelected = p.name === currentName;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => { onSelect(p); close(); setSearchTerm(''); }}
                                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between group transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="min-w-0">
                                        <div className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{p.name}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                            {p.items?.length || 0} fondos
                                        </div>
                                    </div>
                                    {isSelected && <Check size={14} className="text-blue-600" />}
                                </button>
                            );
                        })}
                    </>
                )}

                {/* 2. SECTION: Benchmarks Sintéticos */}
                {(filteredBenchmarks.length > 0 || loadingBenchmarks) && (
                    <>
                        <div className="px-3 py-1 bg-indigo-50 text-[10px] font-bold text-indigo-600 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1 border-t border-indigo-100">
                            <TrendingUp size={12} /> Benchmarks Sintéticos
                        </div>
                        {loadingBenchmarks ? (
                            <div className="p-3 text-center text-xs text-indigo-400">Cargando...</div>
                        ) : (
                            filteredBenchmarks.map(b => {
                                const isSelected = b.name === currentName;
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => { onSelect(b); close(); setSearchTerm(''); }}
                                        className={`w-full text-left px-4 py-3 hover:bg-indigo-50/30 flex items-center justify-between group transition-colors ${isSelected ? 'bg-indigo-100/50' : ''}`}
                                    >
                                        <div className="min-w-0">
                                            <div className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-800' : 'text-indigo-600'}`}>
                                                {b.name.replace('Benchmark: ', '')}
                                            </div>
                                            <div className="text-[10px] text-indigo-400 mt-0.5">
                                                Serie Evolutiva Estandarizada
                                            </div>
                                        </div>
                                        {isSelected && <Check size={14} className="text-indigo-600" />}
                                    </button>
                                );
                            })
                        )}
                    </>
                )}

                {filteredPortfolios.length === 0 && filteredBenchmarks.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">
                        No se encontraron coincidencias para "{searchTerm}"
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div
            ref={ref}
            className={`sticky top-0 z-40 transition-all duration-300 ${isSticky ? 'py-2 ' : 'pt-1 pb-4'}`}
        >
            <div className={`absolute inset-0 bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200 transition-opacity duration-300 ${isSticky ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}></div>

            <div className="relative max-w-[1600px] mx-auto px-4 md:px-8">
                {/* Main Deck Container */}
                <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row relative transition-all duration-300 ${isSticky ? 'shadow-none border-0' : ''}`}>

                    {/* VS Badge - Absolute Center */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex">
                        <div className="bg-white p-1 rounded-full shadow-sm border border-slate-100">
                            <div className="w-8 h-8 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-black tracking-tighter shrink-0 border-2 border-white ring-1 ring-slate-100">
                                VS
                            </div>
                        </div>
                    </div>

                    {/* LEFT SIDE - PORTFOLIO A (BLUE) */}
                    <div className="flex-1 p-1 md:p-3 bg-gradient-to-br from-blue-50/50 to-white relative group/side-a rounded-t-2xl md:rounded-tr-none md:rounded-l-2xl">
                        <div className="flex items-center justify-between gap-3 h-full">
                            <div className="flex-1 min-w-0 relative">
                                <label className="block text-[10px] uppercase font-bold text-blue-400 tracking-wider mb-0.5 ml-1">Cartera A</label>
                                <div className="relative">
                                    <button
                                        onClick={() => { setOpenSelectorA(!openSelectorA); setOpenSelectorB(false); setSearchTerm(''); }}
                                        className="flex items-center gap-2 hover:bg-white hover:shadow-sm px-2 py-1.5 rounded-lg transition-all w-full md:w-auto text-left group"
                                    >
                                        <div className={`w-2 h-8 rounded-full bg-blue-500 shrink-0 transition-all group-hover:h-6 duration-300 ${!portfolioA ? 'opacity-20' : ''}`}></div>
                                        <div className="min-w-0">
                                            <div className={`font-bold text-slate-800 truncate leading-tight ${!portfolioA ? 'text-slate-400 italic' : ''}`}>
                                                {nameA || 'Seleccionar Cartera'}
                                            </div>
                                            {loadingA ? (
                                                <div className="text-[10px] text-blue-500 animate-pulse font-medium">Actualizando métricas...</div>
                                            ) : portfolioA ? (
                                                <div className="text-[10px] text-slate-500 font-medium">{portfolioA.length} activos</div>
                                            ) : null}
                                        </div>
                                        <ChevronDown size={14} className={`text-slate-400 transition-transform ml-auto md:ml-2 ${openSelectorA ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Dropdown A */}
                                    {openSelectorA && renderDropdown(
                                        (p) => onSelectA({ items: p.items, name: p.name, isBenchmark: (p as any).isBenchmark, benchmarkData: (p as any).benchmarkData }),
                                        () => setOpenSelectorA(false),
                                        nameA
                                    )}
                                </div>
                            </div>

                            {portfolioA && (
                                <button
                                    onClick={onRemoveA}
                                    className="text-slate-300 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                                    title="Quitar cartera"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Divider for Mobile */}
                    <div className="h-[1px] w-full bg-slate-100 md:hidden"></div>

                    {/* RIGHT SIDE - PORTFOLIO B (AMBER) */}
                    <div className="flex-1 p-1 md:p-3 bg-gradient-to-br from-amber-50/50 to-white relative group/side-b rounded-b-2xl md:rounded-bl-none md:rounded-r-2xl">
                        <div className="flex items-center justify-between gap-3 h-full flex-row-reverse md:flex-row">
                            {/* On desktop, content is aligned differently, but for simplicity we keep symmetry structure */}

                            {portfolioB && (
                                <button
                                    onClick={onRemoveB}
                                    className="text-slate-300 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors hidden md:block" // Hidden on mobile to keep remove on right? verify
                                    title="Quitar cartera"
                                >
                                    <X size={16} />
                                </button>
                            )}

                            <div className="flex-1 min-w-0 relative">
                                <label className="block text-[10px] uppercase font-bold text-amber-500 tracking-wider mb-0.5 mr-1 md:text-right">Cartera B</label>
                                <div className="relative flex flex-col md:items-end">
                                    <button
                                        onClick={() => { setOpenSelectorB(!openSelectorB); setOpenSelectorA(false); setSearchTerm(''); }}
                                        className="flex items-center gap-2 hover:bg-white hover:shadow-sm px-2 py-1.5 rounded-lg transition-all w-full md:w-auto text-left md:text-right group flex-row-reverse md:flex-row"
                                    >
                                        <ChevronDown size={14} className={`text-slate-400 transition-transform mr-auto md:mr-2 md:order-first ${openSelectorB ? 'rotate-180' : ''}`} />

                                        <div className="min-w-0">
                                            <div className={`font-bold text-slate-800 truncate leading-tight ${!portfolioB ? 'text-slate-400 italic' : ''}`}>
                                                {nameB || 'Seleccionar Cartera'}
                                            </div>
                                            {loadingB ? (
                                                <div className="text-[10px] text-amber-500 animate-pulse font-medium">Actualizando métricas...</div>
                                            ) : portfolioB ? (
                                                <div className="text-[10px] text-slate-500 font-medium">{portfolioB.length} activos</div>
                                            ) : null}
                                        </div>
                                        <div className={`w-2 h-8 rounded-full bg-amber-500 shrink-0 transition-all group-hover:h-6 duration-300 md:order-last ${!portfolioB ? 'opacity-20' : ''}`}></div>
                                    </button>

                                    {/* Dropdown B - Aligned Right on Desktop */}
                                    {openSelectorB && renderDropdown(
                                        (p) => onSelectB({ items: p.items, name: p.name, isBenchmark: (p as any).isBenchmark, benchmarkData: (p as any).benchmarkData }),
                                        () => setOpenSelectorB(false),
                                        nameB
                                    )}
                                </div>
                            </div>

                            {/* Mobile Remove Button for B */}
                            {portfolioB && (
                                <button
                                    onClick={onRemoveB}
                                    className="text-slate-300 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition-colors md:hidden"
                                    title="Quitar cartera"
                                >
                                    <X size={16} />
                                </button>
                            )}

                            {/* Download PDF Button (Flex Item) */}
                            {portfolioA && portfolioB && (
                                <div className="flex md:ml-2">
                                    <button
                                        onClick={onDownloadPDF}
                                        disabled={generatingPdf}
                                        className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-50 border border-slate-200 hover:border-blue-100"
                                        title="Descargar Informe PDF"
                                    >
                                        {generatingPdf ? (
                                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></div>
                                        ) : (
                                            <Download size={14} />
                                        )}
                                        <span>Informe PDF</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Backdrop for dropdowns */}
            {(openSelectorA || openSelectorB) && (
                <div className="fixed inset-0 z-30 bg-black/5" onClick={() => { setOpenSelectorA(false); setOpenSelectorB(false); }}></div>
            )}
        </div>
    );
}

import React, { useState } from 'react';
import { useSavedPortfolios, SavedPortfolio } from '../../hooks/useSavedPortfolios';
import { ChevronDown, FolderOpen } from 'lucide-react';

interface ComparisonSelectorProps {
    onSelect: (portfolio: SavedPortfolio) => void;
    label: string;
    selectedId?: string;
}

export default function ComparisonSelector({ onSelect, label, selectedId }: ComparisonSelectorProps) {
    const { savedPortfolios, loading } = useSavedPortfolios();
    const [isOpen, setIsOpen] = useState(false);

    const toggleDropdown = () => setIsOpen(!isOpen);

    const handleSelect = (p: SavedPortfolio) => {
        onSelect(p);
        setIsOpen(false);
    };

    const selectedPortfolio = savedPortfolios.find(p => p.id === selectedId);

    return (
        <div className="relative">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
            <button
                onClick={toggleDropdown}
                className={`w-full text-left bg-white border rounded-lg px-4 py-3 flex justify-between items-center transition-all ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
                    }`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedPortfolio ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                        <FolderOpen size={16} />
                    </div>
                    <span className={`block truncate ${selectedPortfolio ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                        {selectedPortfolio ? selectedPortfolio.name : 'Seleccionar Cartera...'}
                    </span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto w-full">
                    {loading ? (
                        <div className="p-4 text-center text-slate-400 text-sm">Cargando carteras...</div>
                    ) : savedPortfolios.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">
                            No hay carteras guardadas.
                            <br />
                            <span className="text-xs text-slate-300">Guarda una cartera desde el Dashboard.</span>
                        </div>
                    ) : (
                        <div className="py-1">
                            {savedPortfolios.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleSelect(p)}
                                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between group ${p.id === selectedId ? 'bg-blue-50/50' : ''}`}
                                >
                                    <div className="min-w-0">
                                        <div className={`font-medium truncate ${p.id === selectedId ? 'text-blue-700' : 'text-slate-700'}`}>{p.name}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            {p.items?.length || 0} fondos • {p.totalCapital?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                    {p.id === selectedId && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Backdrop to close */}
            {isOpen && (
                <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
            )}
        </div>
    );
}

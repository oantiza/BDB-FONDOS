import React, { useState } from 'react';
import { useSavedPortfolios, SavedPortfolio } from '../hooks/useSavedPortfolios';
import { PortfolioItem } from '../types';

interface SavedPortfoliosModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPortfolio: PortfolioItem[];
    currentTotalCapital: number;
    onLoadPortfolio: (items: PortfolioItem[], totalCapital: number) => void;
}

export default function SavedPortfoliosModal({
    isOpen,
    onClose,
    currentPortfolio,
    currentTotalCapital,
    onLoadPortfolio
}: SavedPortfoliosModalProps) {
    const { savedPortfolios, savePortfolio, deletePortfolio, loading, isAuthenticated } = useSavedPortfolios();
    const [newPortfolioName, setNewPortfolioName] = useState('');
    const [activeTab, setActiveTab] = useState<'list' | 'save'>('list');

    if (!isOpen) return null;

    const handleSave = async () => {
        const success = await savePortfolio(newPortfolioName, currentPortfolio, currentTotalCapital);
        if (success) {
            setNewPortfolioName('');
            setActiveTab('list');
        }
    };

    const handleLoad = (p: SavedPortfolio) => {
        if (window.confirm(`¿Cargar la cartera "${p.name}"? Esto reemplazará tu cartera actual.`)) {
            onLoadPortfolio(p.items, p.totalCapital);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="bg-[#0B2545] p-6 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl text-white font-light tracking-wide">Mis Carteras <span className="font-bold">Guardadas</span></h2>
                        <p className="text-blue-200 text-xs mt-1">{savedPortfolios.length} / 15 carteras utilizadas</p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 shrink-0">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'list' ? 'text-[#0B2545] border-b-2 border-[#D4AF37]' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        📂 Abrir Cartera
                    </button>
                    <button
                        onClick={() => setActiveTab('save')}
                        className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'save' ? 'text-[#0B2545] border-b-2 border-[#D4AF37]' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        💾 Guardar Actual
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
                    {!isAuthenticated ? (
                        <div className="text-center py-12 text-slate-400">
                            <p>Debes iniciar sesión para usar esta función.</p>
                        </div>
                    ) : activeTab === 'list' ? (
                        <div className="space-y-4">
                            {savedPortfolios.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                    <p>No tienes carteras guardadas.</p>
                                    <button onClick={() => setActiveTab('save')} className="text-[#0B2545] text-sm font-bold mt-2 hover:underline">Guardar cartera actual</button>
                                </div>
                            ) : (
                                savedPortfolios.map((p) => (
                                    <div key={p.id} className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                                        <div>
                                            <h3 className="text-[#0B2545] font-bold text-lg">{p.name}</h3>
                                            <div className="flex gap-4 text-xs text-slate-500 mt-1">
                                                <span>📅 {p.createdAt?.toDate().toLocaleDateString() || 'N/A'}</span>
                                                <span>💰 {p.totalCapital?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                                <span>📊 {p.items?.length || 0} fondos</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleLoad(p)}
                                                className="bg-[#0B2545] text-white px-3 py-1.5 rounded text-xs hover:bg-[#1a3b66] transition-colors shadow-sm"
                                            >
                                                Cargar
                                            </button>
                                            <button
                                                onClick={() => deletePortfolio(p.id)}
                                                className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs hover:bg-red-100 transition-colors border border-red-100"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre de la Cartera</label>
                                <input
                                    type="text"
                                    value={newPortfolioName}
                                    onChange={(e) => setNewPortfolioName(e.target.value)}
                                    placeholder="Ej: Cartera Conservadora 2024"
                                    className="w-full text-lg border-b-2 border-slate-200 pb-2 outline-none focus:border-[#D4AF37] transition-colors placeholder:text-slate-300 text-[#0B2545]"
                                    autoFocus
                                />
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h4 className="text-[#0B2545] font-bold text-sm mb-2">Resumen de lo que se guardará:</h4>
                                <ul className="space-y-1 text-sm text-slate-600">
                                    <li className="flex justify-between"><span>Fondos:</span> <span>{currentPortfolio.length}</span></li>
                                    <li className="flex justify-between"><span>Capital Total:</span> <span>{currentTotalCapital?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span></li>
                                </ul>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={loading || !newPortfolioName.trim() || currentPortfolio.length === 0}
                                className="w-full bg-[#D4AF37] disabled:bg-slate-300 disabled:cursor-not-allowed text-[#0B2545] font-bold py-4 rounded-lg shadow-lg hover:bg-[#b5952f] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {loading ? 'Guardando...' : 'Guardar Cartera'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

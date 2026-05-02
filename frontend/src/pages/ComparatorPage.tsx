import React, { useState } from 'react';
import Header from '../components/Header';
import PortfolioComparator from '../components/comparator/PortfolioComparator';
import FundComparator from '../components/comparator/FundComparator';

interface ComparatorPageProps {
    onBack: () => void;
    onLogout: () => void;
    onOpenMiBoutique?: () => void;
    onOpenXRay: () => void;
    onOpenPositions: () => void;
    onOpenRetirement: () => void;
    onOpenComparator: () => void;
}

export default function ComparatorPage({
    onBack, onLogout, onOpenMiBoutique, onOpenXRay, onOpenPositions, onOpenRetirement, onOpenComparator
}: ComparatorPageProps) {
    const [activeTab, setActiveTab] = useState<'portfolios' | 'funds'>('portfolios');

    return (
        <div className="flex flex-col bg-[#f8fafc] min-h-screen h-screen">
            <Header
                onBack={onBack}
                onLogout={onLogout}
                onOpenMiBoutique={() => { }}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tabs */}
                <div className="bg-white border-b border-slate-200 px-8">
                    <div className="flex gap-8">
                        <button
                            onClick={() => setActiveTab('portfolios')}
                            className={`py-4 text-sm font-bold uppercase tracking-wide transition-colors relative ${activeTab === 'portfolios' ? 'text-[#0B2545]' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Comparar Carteras
                            {activeTab === 'portfolios' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]"></div>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('funds')}
                            className={`py-4 text-sm font-bold uppercase tracking-wide transition-colors relative ${activeTab === 'funds' ? 'text-[#0B2545]' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Comparar Fondos
                            {activeTab === 'funds' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37]"></div>
                            )}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-8">
                    {activeTab === 'portfolios' ? <PortfolioComparator /> : <FundComparator />}
                </div>
            </div>
        </div>
    );
}

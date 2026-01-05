import React from 'react';
import MacroDashboard from '../components/MacroDashboardV3';

interface MiBoutiquePageProps {
    onBack: () => void;
}

export default function MiBoutiquePage({ onBack }: MiBoutiquePageProps) {
    return (
        <div className="h-screen flex flex-col overflow-y-auto bg-slate-50 font-sans text-slate-800 relative animate-fade-in">
            <button
                onClick={onBack}
                className="fixed top-6 left-6 z-50 bg-white/90 p-3 rounded-full shadow-xl border border-slate-200 hover:bg-slate-100 transition-all hover:scale-105 text-xl"
                title="Volver al Dashboard"
            >
                🔙
            </button>
            <MacroDashboard />
        </div>
    );
}

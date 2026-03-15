import React from 'react';
import WeeklyReportDashboard from '../components/macro/WeeklyReportDashboard';
import Header from '../components/Header';

interface MiBoutiquePageProps {
    onBack: () => void;
}

export default function MiBoutiquePage({ onBack }: MiBoutiquePageProps) {
    return (
        <div className="h-screen flex flex-col overflow-y-auto bg-[#f8fafc] font-sans text-slate-800 relative animate-fade-in">
            <div className="fixed top-0 left-0 right-0 z-50">
                <Header onBack={onBack} onLogout={() => { }} />
            </div>
            <div className="pt-16"> {/* Add padding for fixed header */}
                <WeeklyReportDashboard />
            </div>
        </div>
    );
}

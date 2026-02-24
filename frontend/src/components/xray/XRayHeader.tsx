import React from 'react';

interface XRayHeaderProps {
    onBack: () => void;
    loading: boolean;
    hasMetrics: boolean;
    onDownloadFull: () => void;
    onDownloadSummary: () => void;
    onShowAnalytics: () => void;
}

export default function XRayHeader({
    onBack,
    loading,
    hasMetrics,
    onDownloadFull,
    onDownloadSummary,
    onShowAnalytics
}: XRayHeaderProps) {
    return (
        <div className="h-16 bg-gradient-to-r from-slate-800 to-slate-700 text-white flex items-center justify-between px-6 z-20 shrink-0 border-b border-slate-600 shadow-sm">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="bg-white/10 border border-white/20 text-slate-200 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors shadow-sm text-xs uppercase tracking-widest font-bold flex items-center gap-1"
                >
                    ← Volver
                </button>
                <div className="h-4 w-px bg-slate-600 mx-2"></div>
                <span className="font-light text-xl tracking-tight leading-none text-white">Análisis de <span className="font-bold text-blue-200">Cartera</span></span>

                {/* PDF REPORT BUTTONS */}
                <div className="flex gap-2 ml-4">
                    <button
                        onClick={onDownloadFull}
                        disabled={loading || !hasMetrics}
                        className="bg-slate-700/50 text-slate-300 border border-slate-500 hover:text-white hover:bg-slate-600 transition-colors text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>📄</span> Informe Completo
                    </button>
                    <button
                        onClick={onDownloadSummary}
                        disabled={loading || !hasMetrics}
                        className="bg-[#D4AF37] hover:bg-[#b5952f] text-white transition-colors text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border-transparent flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <span>📊</span> Informe Resumen
                    </button>
                </div>

                {/* ANALYTICS TAB */}
                <button
                    onClick={onShowAnalytics}
                    className="ml-4 bg-slate-700/50 text-slate-300 border border-slate-500 hover:text-white hover:bg-slate-600 transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-1 group px-4 py-1.5 rounded-full shadow-sm"
                >
                    Gráficos Avanzados <span className="text-[#D4AF37] group-hover:translate-x-0.5 transition-transform">↗</span>
                </button>
            </div>
        </div>
    );
}

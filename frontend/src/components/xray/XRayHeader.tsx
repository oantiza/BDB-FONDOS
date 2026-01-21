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
        <div className="h-16 bg-gradient-to-r from-[#003399] to-[#0055CC] text-white flex items-center justify-between px-6 z-20 shrink-0 border-b border-white/10 shadow-md">
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="text-white/70 hover:text-white transition-colors flex items-center gap-1 text-xs uppercase tracking-widest font-bold"
                >
                    ← Volver
                </button>
                <div className="h-4 w-px bg-white/20 mx-2"></div>
                <span className="font-light text-xl tracking-tight leading-none">Análisis de <span className="font-bold">Cartera</span></span>

                {/* PDF REPORT BUTTONS */}
                <div className="flex gap-2 ml-4">
                    <button
                        onClick={onDownloadFull}
                        disabled={loading || !hasMetrics}
                        className="bg-white/10 hover:bg-white/20 text-white transition-colors text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-sm border border-white/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>📄</span> Informe Completo
                    </button>
                    <button
                        onClick={onDownloadSummary}
                        disabled={loading || !hasMetrics}
                        className="bg-[#D4AF37] hover:bg-[#b5952f] text-white transition-colors text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-sm border border-white/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <span>📊</span> Informe Resumen
                    </button>
                </div>

                {/* ANALYTICS TAB */}
                <button
                    onClick={onShowAnalytics}
                    className="ml-4 text-white/70 hover:text-[#D4AF37] transition-colors text-xs font-bold uppercase tracking-widest flex items-center gap-1 group bg-white/5 px-3 py-1 rounded-full border border-white/10 hover:border-white/30"
                >
                    Gráficos Avanzados <span className="group-hover:translate-x-0.5 transition-transform">↗</span>
                </button>
            </div>
        </div>
    );
}

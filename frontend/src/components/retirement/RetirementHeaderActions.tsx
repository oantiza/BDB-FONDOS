import React from 'react';
import { Calculator, Download } from 'lucide-react';

export function RetirementHeaderActions({ onExport }: { onExport: () => void }) {
    return (
        <header className="bg-[#0B2545] border-b border-[#153a66] p-8 flex items-center justify-between sticky top-0 z-10 shadow-md">
            <div className="flex items-center gap-5">
                <div className="bg-[#153a66] rounded-2xl p-3 shadow-inner">
                    <Calculator className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-black flex items-center text-white tracking-tight">
                        Simulador de Jubilación
                    </h1>
                    <p className="text-base text-slate-300 font-medium tracking-wide mt-1">Planificación Patrimonial Orientada al Cliente • Fiscalidad Incremental</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={onExport} className="bg-white border border-transparent text-[#0B2545] hover:bg-slate-100 transition-colors px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg text-lg">
                    <Download className="w-5 h-5" /> Exportar Informe (PDF)
                </button>
            </div>
        </header>
    );
}

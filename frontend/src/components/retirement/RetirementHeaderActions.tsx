import { FileText } from 'lucide-react';

export function RetirementHeaderActions({ onExport }: { onExport: () => void }) {
    return (
        <header className="bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#E6EAF1] px-8 py-5 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-[#0F2A44] shadow-sm">
                    <div className="w-6 h-6 border-2 border-[#E67E5F] rounded-[4px] transform rotate-12 flex items-center justify-center">
                        <div className="w-2 h-2 bg-[#E67E5F] rounded-full"></div>
                    </div>
                </div>
                <div className="flex flex-col justify-center">
                    <h1 className="text-[22px] font-black text-[#0D1B2A] tracking-tight leading-none mb-1 drop-shadow-sm">
                        Mi Jubilación
                    </h1>
                    <p className="text-[12px] font-bold tracking-[0.1em] text-[#64748B] uppercase leading-none">Tu simulador personal</p>
                </div>
            </div>
            <button 
                onClick={onExport} 
                className="bg-[#0F2A44] text-white hover:bg-[#2D5B87] transition-colors px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 text-[14px] shadow-sm"
            >
                <FileText className="w-4 h-4" /> Descargar en PDF
            </button>
        </header>
    );
}

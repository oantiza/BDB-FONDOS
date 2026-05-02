import { formatCurrency } from '../../utils/retirementUtils';
import type { RetirementResults } from './types';
import { Calendar, Hourglass, Power } from 'lucide-react';

export function RetirementSummaryCard({ results, age }: { results: RetirementResults, age: number }) {
    const { rentTaxResult } = results;

    return (
        <div className="relative overflow-hidden rounded-[16px] border border-white/50 bg-white/40 backdrop-blur-[12px] shadow-xl z-10">
            <div className="relative p-8 lg:p-10 space-y-10 bg-white/20">
                {/* Hero Section */}
                <div className="flex flex-col lg:flex-row items-center justify-between gap-10 bg-[#0F2A44]/90 backdrop-blur-md border border-white/20 rounded-3xl p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none scale-150 transform translate-x-1/4 -translate-y-1/4">
                       <svg className="w-96 h-96 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
                    </div>
                    
                    <div className="relative z-10 flex-1 space-y-5 text-center lg:text-left w-full">
                        <div className="inline-block bg-[#E67E5F]/10 px-4 py-1.5 rounded-full border border-[#E67E5F]/20">
                            <h2 className="text-[13px] font-black uppercase tracking-[0.2em] text-[#E67E5F]">Plan Razonable</h2>
                        </div>
                        <p className="text-[22px] lg:text-[26px] font-semibold text-[#E6EAF1] leading-snug max-w-xl">
                            Tu renta mensual neta estimada
                        </p>
                        <div className="text-[72px] lg:text-[84px] font-black tracking-tighter text-white leading-none drop-shadow-lg">
                            {formatCurrency(rentTaxResult.netoConsolidadoMensual)}
                        </div>
                        <p className="text-[15px] font-semibold text-[#E6EAF1] max-w-lg mt-2">
                            Integrando pensión pública y disposición de patrimonio privado optimizado fiscalmente.
                        </p>
                    </div>
                    
                    <div className="relative z-10 lg:w-[400px] shrink-0 bg-[#FFFFFF]/5 backdrop-blur-sm border border-[#E6EAF1]/10 rounded-2xl p-6 flex flex-col gap-5">
                        <div className="flex items-center gap-4">
                            <div className="bg-[#FFFFFF]/10 p-3 rounded-xl flex-shrink-0">
                                <Calendar className="w-6 h-6 text-[#E67E5F]" />
                            </div>
                            <div>
                                <p className="text-[12px] font-bold uppercase tracking-wider text-[#E6EAF1]/60 mb-0.5">Inicio Jubilación</p>
                                <p className="text-[20px] font-black text-white leading-none">{age} años</p>
                            </div>
                        </div>
                        
                        <div className="h-px w-full bg-[#E6EAF1]/10"></div>
                        
                        <div className="flex items-center gap-4">
                            <div className="bg-[#FFFFFF]/10 p-3 rounded-xl flex-shrink-0">
                                <Hourglass className="w-6 h-6 text-[#C8A86B]" />
                            </div>
                            <div>
                                <p className="text-[12px] font-bold uppercase tracking-wider text-[#E6EAF1]/60 mb-0.5">Duración Estimada</p>
                                <p className="text-[20px] font-black text-white leading-none">{results.years < 99 ? `${results.years} años` : 'Toda tu vida'}</p>
                            </div>
                        </div>

                        <div className="h-px w-full bg-[#E6EAF1]/10"></div>
                        
                        <div className="flex items-center gap-4">
                            <div className="bg-[#FFFFFF]/10 p-3 rounded-xl flex-shrink-0">
                                <Power className="w-6 h-6 text-[#DC2626]" />
                            </div>
                            <div>
                                <p className="text-[12px] font-bold uppercase tracking-wider text-[#E6EAF1]/60 mb-0.5">Fin de Capital (Aprox)</p>
                                <p className="text-[20px] font-black text-[#E6EAF1] leading-none">{results.years < 99 ? `${age + results.years} años` : 'Ilimitado'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

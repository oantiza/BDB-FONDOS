import { ArrowRightCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/retirementUtils';

export function RetirementEventCard({ epsvRescatadoBruto, epsvCashNeto }: { epsvRescatadoBruto: number, epsvCashNeto: number }) {
    if (epsvRescatadoBruto <= 0) return null;

    return (
        <div className="bg-white/40 backdrop-blur-[12px] rounded-[16px] border border-white/50 p-8 shadow-xl mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-6 relative">
            <div className="flex items-center gap-4">
                <div className="bg-[#0F2A44]/90 p-3 rounded-full flex-shrink-0 backdrop-blur-sm shadow-inner overflow-hidden border border-white/20">
                    <ArrowRightCircle className="w-8 h-8 text-[#E67E5F]" strokeWidth={2} />
                </div>
                <div className="flex flex-col justify-center">
                    <h3 className="text-[20px] font-black text-[#0D1B2A] drop-shadow-sm leading-tight mb-1">Disposición de Capital Inmediato</h3>
                    <p className="text-[14px] text-[#0D1B2A]/70 font-semibold leading-tight drop-shadow-sm">Provisión de fondos disponible al inicio del retiro.</p>
                </div>
            </div>
            
            <div className="flex items-center gap-8 bg-white/20 backdrop-blur-sm border border-white/40 rounded-[20px] p-5 shadow-inner sm:static mt-4 sm:mt-0 w-full sm:w-auto overflow-hidden">
                <div className="flex flex-col">
                     <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D1B2A]/60 mb-1">Bruto Total</span>
                     <span className="text-[20px] font-black text-[#0D1B2A] leading-none drop-shadow-sm">{formatCurrency(epsvRescatadoBruto)}</span>
                </div>
                <div className="h-10 w-px bg-white/40"></div>
                <div className="flex flex-col">
                     <span className="text-[11px] font-bold uppercase tracking-wider text-[#DC2626] mb-1 drop-shadow-sm">Impacto IRPF</span>
                     <span className="text-[20px] font-black text-[#DC2626] leading-none drop-shadow-sm">-{formatCurrency(epsvRescatadoBruto - epsvCashNeto)}</span>
                </div>
                <div className="h-10 w-px bg-white/40"></div>
                <div className="flex flex-col">
                     <span className="text-[11px] font-bold uppercase tracking-wider text-[#16A34A] mb-1 drop-shadow-sm">Líquido en Cuenta</span>
                     <span className="text-[22px] font-black text-[#16A34A] leading-none drop-shadow-sm">{formatCurrency(epsvCashNeto)}</span>
                </div>
            </div>
             <div className="w-[300px] xl:w-[450px]"></div> {/* Spacer */}
        </div>
    );
}

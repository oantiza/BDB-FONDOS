import { formatCurrency, formatPercent } from '../../utils/retirementUtils';
import type { RetirementResults } from './types';
import { ShieldCheck, Info } from 'lucide-react';

export function FiscalBreakdownCard({ results }: { results: RetirementResults }) {
    const { rentTaxResult } = results;

    if(rentTaxResult.ingresosBrutosPrivados <= 0) return null;

    return (
        <div className="bg-white/40 backdrop-blur-[12px] rounded-[16px] shadow-xl border border-white/50 mt-4 overflow-hidden flex flex-col h-full">
            <div className="p-8 border-b border-white/30 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white/20 gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-[#0F2A44]/90 p-3 rounded-full flex-shrink-0 border border-white/20 backdrop-blur-sm shadow-inner">
                        <ShieldCheck className="w-8 h-8 text-[#E67E5F]" strokeWidth={2} />
                    </div>
                    <div className="flex flex-col justify-center">
                        <h3 className="text-[22px] font-black text-[#0D1B2A] drop-shadow-sm leading-tight mb-1">
                            Impacto Fiscal Estimado
                        </h3>
                        <p className="text-[14px] text-[#0D1B2A]/70 font-semibold leading-tight drop-shadow-sm">Así tributa la renta mensual de tu patrimonio privado.</p>
                    </div>
                </div>
            </div>

            <div className="p-8">
                {/* BLOQUE PRINCIPAL RESUMIDO */}
                <div className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-[20px] p-6 sm:p-10 mb-8 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center text-center">
                        
                        <div className="flex flex-col items-center">
                            <span className="text-[13px] font-bold text-[#0D1B2A]/60 uppercase tracking-wider mb-2">Renta Bruta Privada</span>
                            <span className="text-[36px] font-black text-[#0D1B2A] leading-none mb-1 drop-shadow-sm">
                                {formatCurrency(rentTaxResult.ingresosBrutosPrivados / 12)}
                            </span>
                            <span className="text-[13px] font-semibold text-[#0D1B2A]/70">antes de impuestos</span>
                        </div>

                        <div className="relative flex justify-center items-center h-full">
                            <div className="absolute w-full h-[2px] bg-white/40 top-1/2 -z-10 hidden md:block"></div>
                            <div className="bg-white/40 backdrop-blur-md border border-[#DC2626]/30 px-6 py-4 rounded-2xl shadow-inner text-center transform -translate-y-2">
                                <span className="block text-[11px] font-bold text-[#DC2626] uppercase tracking-wider mb-1 drop-shadow-sm">Retención Est.</span>
                                <span className="block text-[24px] font-black text-[#DC2626] leading-none drop-shadow-sm">-{formatCurrency(rentTaxResult.totalImpuestosPrivados / 12)}</span>
                                <span className="block text-[12px] font-semibold text-[#DC2626]/80 mt-1">({formatPercent(rentTaxResult.tipoMedioIncremental)})</span>
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <span className="text-[13px] font-bold text-[#16A34A] uppercase tracking-wider mb-2 drop-shadow-sm">Renta Neta Final</span>
                            <span className="text-[36px] font-black text-[#16A34A] leading-none mb-1 drop-shadow-sm">
                                {formatCurrency(rentTaxResult.netoPrivadoMensual)}
                            </span>
                            <span className="text-[13px] font-semibold text-[#0D1B2A]/70">directo a tu cuenta</span>
                        </div>

                    </div>
                </div>

                {/* DETALLE ADICIONAL */}
                <div className="border-t border-white/40 pt-6">
                    <h4 className="text-[15px] font-black text-[#0D1B2A] mb-4 flex items-center gap-2 drop-shadow-sm">
                        <Info className="w-4 h-4 text-[#0F2A44]" /> Detalle de la liquidación anual
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/30 backdrop-blur-sm border border-white/40 p-4 rounded-xl shadow-inner">
                            <div className="text-[11px] font-bold text-[#0D1B2A]/60 uppercase tracking-wider mb-1">Parte Exenta</div>
                            <div className="text-[18px] font-black text-[#0D1B2A] drop-shadow-sm">{formatCurrency(rentTaxResult.totalExento)}</div>
                            <div className="text-[12px] text-[#0D1B2A]/70 font-semibold mt-1">Capital libre de cargas.</div>
                        </div>
                        <div className="bg-white/30 backdrop-blur-sm border border-white/40 p-4 rounded-xl shadow-inner">
                            <div className="text-[11px] font-bold text-[#0D1B2A]/60 uppercase tracking-wider mb-1">Base Ahorro (Plana)</div>
                            <div className="text-[18px] font-black text-[#0D1B2A] drop-shadow-sm">{formatCurrency(rentTaxResult.totalSujetoAhorro)}</div>
                            <div className="text-[12px] text-[#0D1B2A]/70 font-semibold mt-1">Beneficios optimizados.</div>
                        </div>
                        <div className="bg-white/30 backdrop-blur-sm border border-white/40 p-4 rounded-xl shadow-inner">
                            <div className="text-[11px] font-bold text-[#0D1B2A]/60 uppercase tracking-wider mb-1">Base General</div>
                            <div className="text-[18px] font-black text-[#0D1B2A] drop-shadow-sm">{formatCurrency(rentTaxResult.totalSujetoGeneral)}</div>
                            <div className="text-[12px] text-[#0D1B2A]/70 font-semibold mt-1">Se suma a tu pensión.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

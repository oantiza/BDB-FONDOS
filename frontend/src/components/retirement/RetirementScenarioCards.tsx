import { formatCurrency } from '../../utils/retirementUtils';
import type { RetirementResults } from './types';
import { ShieldAlert, Target, Rocket } from 'lucide-react';

interface ScenarioCardsProps {
    scenarios: {
        base: RetirementResults;
        conservador: RetirementResults;
        optimista: RetirementResults;
    };
    baseRevalorizacion: number;
}

export function RetirementScenarioCards({ scenarios, baseRevalorizacion }: ScenarioCardsProps) {
    const { base, conservador, optimista } = scenarios;

    const cards = [
        {
            key: 'conservador',
            title: 'Conservador',
            icon: ShieldAlert,
            color: '#64748B',
            bg: '#F4F7FB',
            data: conservador,
            reval: Math.max(0, baseRevalorizacion - 1.5),
            desc: 'Posicionamiento defensivo y protector.'
        },
        {
            key: 'base',
            title: 'Moderado (Base)',
            icon: Target,
            color: '#0F2A44',
            bg: '#FFFFFF',
            data: base,
            reval: baseRevalorizacion,
            desc: 'Estrategia equilibrada y realista.',
            highlight: true
        },
        {
            key: 'optimista',
            title: 'Optimista',
            icon: Rocket,
            color: '#E67E5F',
            bg: '#F4F7FB',
            data: optimista,
            reval: baseRevalorizacion + 1.5,
            desc: 'Mercado favorable y dinámico.'
        }
    ];

    return (
        <div className="bg-white/40 backdrop-blur-[12px] rounded-[16px] shadow-xl border border-white/50 overflow-hidden mt-4">
            <div className="bg-white/20 p-8 pb-10 border-b border-white/30">
                <div className="mb-0">
                    <h3 className="text-[22px] font-black text-[#0D1B2A] drop-shadow-sm leading-tight mb-1">
                        Análisis de Escenarios
                    </h3>
                    <p className="text-[14px] text-[#0D1B2A]/70 font-semibold leading-tight max-w-2xl drop-shadow-sm">
                        Cómo cambia tu plan según la evolución del mercado y la rentabilidad de las carteras.
                    </p>
                </div>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                {cards.map((card) => {
                    const diff = card.data.rentTaxResult.netoConsolidadoMensual - base.rentTaxResult.netoConsolidadoMensual;
                    
                    return (
                        <div 
                            key={card.key} 
                            className={`relative p-6 rounded-[10px] transition-all overflow-hidden flex flex-col border backdrop-blur-sm ${card.highlight ? 'border-white/60 shadow-lg bg-white/50 pb-8' : 'border-white/30 bg-white/30 opacity-90'}`}
                        >
                            {card.highlight && (
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <Target className="w-24 h-24 -mt-4 -mr-4" />
                                </div>
                            )}

                            <div className="flex items-center gap-3 mb-6 relative z-10">
                                <div className="p-2.5 rounded-xl border border-white/40 bg-white/40 shadow-inner flex-shrink-0" style={{ color: card.color }}>
                                    <card.icon className="w-5 h-5" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h4 className="text-[16px] font-black text-[#0D1B2A] drop-shadow-sm">{card.title}</h4>
                                    <span className="text-[11.5px] font-black uppercase tracking-wider text-[#0D1B2A]/60">{card.reval.toFixed(1)}% anual</span>
                                </div>
                            </div>

                            <div className="mb-2 relative z-10 flex-1">
                                <p className="text-[12px] font-bold text-[#0D1B2A]/60 uppercase tracking-widest mb-1">Renta Est. (Total)</p>
                                <div className="flex items-end gap-2">
                                    <span className="text-[32px] font-black text-[#0D1B2A] leading-none drop-shadow-sm" style={{ color: card.highlight ? '#0F2A44' : '#0D1B2A' }}>
                                        {formatCurrency(card.data.rentTaxResult.netoConsolidadoMensual)}
                                    </span>
                                </div>
                            </div>
                            
                            {card.key !== 'base' && (
                                <div className={`text-[13px] font-bold mt-1 mb-6 drop-shadow-sm ${diff > 0 ? 'text-[#16A34A]' : 'text-[#E67E5F]'}`}>
                                    {diff > 0 ? '+' : ''}{formatCurrency(diff)} / mes vs base
                                </div>
                            )}
                            {card.key === 'base' && (
                                <div className="text-[13px] font-bold mt-1 mb-6 text-[#0D1B2A]/60">
                                    Escenario de referencia
                                </div>
                            )}

                            <div className="mt-auto pt-5 border-t border-white/40 relative z-10">
                                <p className="text-[13px] text-[#0D1B2A]/70 font-semibold leading-snug">
                                    {card.desc}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

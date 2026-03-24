import React from 'react';
import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/retirementUtils';

export function RetirementEventCard({ epsvRescatadoBruto, epsvCashNeto }: { epsvRescatadoBruto: number, epsvCashNeto: number }) {
    if (epsvRescatadoBruto <= 0) return null;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400"></div>
            <div className="bg-amber-50/50 px-8 py-5 border-b border-amber-100">
                <h3 className="font-extrabold text-[#0B2545] flex items-center gap-2 text-sm uppercase tracking-widest pl-1">
                    <ArrowRight className="w-5 h-5 text-amber-500"/> Evento de Rescate Inicial EPSV (Capital)
                </h3>
            </div>
            <div className="p-8 pl-10 grid grid-cols-2 md:grid-cols-4 gap-6 items-end">
                <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1.5">Bruto a Rescatar</p>
                    <p className="text-xl font-bold text-[#0B2545]">{formatCurrency(epsvRescatadoBruto)}</p>
                </div>
                <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1.5">Impuestos (Irpf)</p>
                    <p className="text-xl font-bold text-amber-600">-{formatCurrency(epsvRescatadoBruto - epsvCashNeto)}</p>
                </div>
                <div className="md:col-span-2">
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mb-1.5">Líquido Ingresado en Cuenta</p>
                    <p className="text-3xl font-black text-emerald-600">{formatCurrency(epsvCashNeto)}</p>
                </div>
            </div>
        </div>
    );
}

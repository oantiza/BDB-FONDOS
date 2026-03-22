import React from 'react';
import { TrendingUp, Shield, ExternalLink } from 'lucide-react';
import { SectionTitle, InputField, SoftBadge } from './RetirementUI';
import { RetirementFormState } from './types';

export function RetirementInputPanel({ form, onChange }: { form: RetirementFormState, onChange: (key: keyof RetirementFormState, value: string | number | boolean) => void }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            {/* Basics */}
            <section className="bg-white p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col">

                <SectionTitle title="Ahorros e Inversiones Disponibles" icon={TrendingUp} />
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <InputField
                            label="Capital de partida estimado"
                            value={form.ahorros}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('ahorros', Number(e.target.value))}
                            prefix="€"
                            type="number"
                        />
                        <InputField
                            label="Pensión pública neta o estimada"
                            value={form.pensionPublica}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('pensionPublica', Number(e.target.value))}
                            prefix="€"
                            type="number"
                        />
                    </div>
                    
                    <div className="flex flex-col justify-center bg-slate-50 p-5 rounded-xl border border-slate-100">
                        <label className="flex text-base font-bold text-slate-600 mb-4 justify-between items-center">
                            <span className="flex items-center gap-1.5">Revalorización media estimada</span>
                            <span className="text-[#0B2545] font-mono font-bold bg-white px-3 py-1 rounded w-16 text-center border border-slate-200 shadow-sm text-lg">{form.revalorizacion}%</span>
                        </label>
                        <input type="range" min="0" max="15" step="0.5" value={form.revalorizacion} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('revalorizacion', Number(e.target.value))} className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0B2545]" />
                        <div className="flex justify-between text-sm text-slate-400 font-medium mt-3 px-1">
                            <span>0%</span>
                            <span>15%</span>
                        </div>
                    </div>
                    
                    <a 
                        href="https://sede.seg-social.gob.es/wps/portal/sede/sede/Ciudadanos/CiudadanoDetalle/!ut/p/z1/jY9BD4IwDIV_Sw-cbetAnHcbCgZRI8YtSxcwI6Ix8e-36MGLRtu-N-97y0uCXiR6_NQbHnqbHv05U37NItMv6wRTRbYkSwo3z9dM5lDkS4DeD0CM38l_8RMBBvGqP5G4dY2sANyI_NMH_B-A0e1n141tGz1uMDjXWp9n1BvHjXQoEEV2d0jK1VpW5eBwR9u2A123pT4H3FqTzY4X1Z0K-w!!/dz/d5/L2dBISEvZ0FBIS9nQSEh/" 
                        target="_blank" 
                        rel="noreferrer" 
                        className="mt-4 mb-2 flex items-center justify-between p-5 bg-[#0B2545]/5 hover:bg-[#0B2545]/10 border border-[#0B2545]/20 rounded-2xl transition-all group"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-[#0B2545]" />
                                <span className="text-base font-bold text-[#0B2545]">Tu Seguridad Social</span>
                            </div>
                            <span className="text-sm text-slate-500 font-medium leading-tight">Consultar datos reales de cotización y estimación oficial de su pensión pública.</span>
                        </div>
                        <div className="bg-white p-2 rounded-full shadow-sm group-hover:shadow transition-all group-hover:-translate-y-0.5">
                            <ExternalLink className="w-4 h-4 text-[#0B2545]" />
                        </div>
                    </a>

                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Tipo de renta privada que desea simular</h4>
                        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-base">
                            {['temporal', 'vitaliciaEV', 'vitaliciaSostenible'].map(type => (
                                <SoftBadge 
                                    key={type} 
                                    active={form.rentType === type} 
                                    onClick={() => onChange('rentType', type)}
                                >
                                    {type === 'temporal' ? 'Temporal' : type === 'vitaliciaEV' ? 'EV' : 'Sostenible'}
                                </SoftBadge>
                            ))}
                        </div>
                    </div>

                    {form.rentType === 'temporal' && (
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 transition-all space-y-6">
                            <div className="w-full md:w-1/2 md:pr-4">
                                <InputField label="Años cobrando renta" value={form.years} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('years', Number(e.target.value))} suffix="años" type="number" />
                            </div>
                            <div className="flex flex-col justify-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <label className="flex text-base font-bold text-slate-600 mb-4 justify-between items-center">
                                    <span className="flex items-center gap-1.5">
                                        Actualización anual
                                        <span className="group relative inline-flex items-center cursor-help">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400 hover:text-slate-600"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                                            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100 z-10 block">Para combatir inflación</span>
                                        </span>
                                    </span>
                                    <span className="text-[#0B2545] font-mono font-bold bg-slate-50 px-3 py-1 rounded w-16 text-center border border-slate-100 text-lg">{form.updateRate}%</span>
                                </label>
                                <input type="range" min="0" max="6" step="0.5" value={form.updateRate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('updateRate', Number(e.target.value))} className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0B2545]" />
                                <div className="flex justify-between text-sm text-slate-400 font-medium mt-3 px-1">
                                    <span>0%</span>
                                    <span>6%</span>
                                </div>
                            </div>
                        </div>
                    )}
                    {form.rentType === 'vitaliciaEV' && (
                        <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100 transition-all">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField label="Edad actual" value={form.age} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('age', Number(e.target.value))} suffix="años" type="number" />
                                <div className="mt-6 flex gap-1 bg-slate-100 p-1 rounded-lg">
                                    {['male', 'female'].map(g => (
                                        <button 
                                            key={g} 
                                            onClick={() => onChange('sex', g)} 
                                            className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all ${form.sex === g ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 border border-transparent'}`}
                                        >
                                            {g === 'male' ? 'Hombre' : 'Mujer'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col justify-center bg-white p-5 rounded-xl border border-slate-200 shadow-sm mt-6">
                                <label className="flex text-base font-bold text-slate-600 mb-4 justify-between items-center">
                                    <span className="flex items-center gap-1.5">
                                        Actualización anual
                                        <span className="group relative inline-flex items-center cursor-help">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400 hover:text-slate-600"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                                            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100 z-10 block">Para combatir inflación</span>
                                        </span>
                                    </span>
                                    <span className="text-[#0B2545] font-mono font-bold bg-slate-50 px-3 py-1 rounded w-16 text-center border border-slate-100 text-lg">{form.updateRateEV}%</span>
                                </label>
                                <input type="range" min="0" max="6" step="0.5" value={form.updateRateEV} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('updateRateEV', Number(e.target.value))} className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0B2545]" />
                                <div className="flex justify-between text-sm text-slate-400 font-medium mt-3 px-1">
                                    <span>0%</span>
                                    <span>6%</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* EPSV Panel */}
            <section className="bg-white p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                <SectionTitle title="Datos de su EPSV" icon={Shield} />
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg text-base mb-2">
                        <SoftBadge active={form.esPrimerRescate} onClick={() => onChange('esPrimerRescate', true)}>1er Rescate</SoftBadge>
                        <SoftBadge active={!form.esPrimerRescate} onClick={() => onChange('esPrimerRescate', false)}>Rescates Previos</SoftBadge>
                    </div>

                    <label className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-slate-300 transition-colors mt-2">
                        <span className="text-base font-semibold text-slate-700 w-3/4 leading-snug">¿Conoce la rentabilidad acumulada real de su EPSV?</span>
                        <div className="relative inline-flex items-center">
                            <input type="checkbox" className="sr-only peer" checked={form.conoceRentabilidad} onChange={(e) => onChange('conoceRentabilidad', e.target.checked)} />
                            <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#0B2545]"></div>
                        </div>
                    </label>
                    
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
                        <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-4 pl-2">Aportaciones antes de 2027 (Régimen Transitorio)</h4>
                        <div className={`pl-2 ${form.conoceRentabilidad ? 'grid grid-cols-2 gap-6' : 'space-y-4'}`}>
                            <InputField label="Capital Acumulado Total" value={form.epsvPre2026} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('epsvPre2026', Number(e.target.value))} type="number" prefix="€" />
                            {form.conoceRentabilidad && (
                                <div className="border-l border-slate-100 pl-6">
                                    <InputField label="Rendimientos generados" value={form.rentabilidadPre2026} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('rentabilidadPre2026', Number(e.target.value))} type="number" prefix="€" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-400"></div>
                        <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wider mb-4 pl-2">Aportaciones desde 2027</h4>
                        <div className={`pl-2 ${form.conoceRentabilidad ? 'grid grid-cols-2 gap-6' : 'space-y-4'}`}>
                            <InputField label="Capital Acumulado Total" value={form.epsvPost2026} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('epsvPost2026', Number(e.target.value))} type="number" prefix="€" />
                            {form.conoceRentabilidad && (
                                <div className="border-l border-slate-100 pl-6">
                                    <InputField label="Rendimientos generados" value={form.rentabilidadPost2026} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange('rentabilidadPost2026', Number(e.target.value))} type="number" prefix="€" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Cómo desea cobrar la EPSV</h4>
                        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-base">
                            {(['renta', 'capital', 'mixto'] as const).map(mode => (
                                <SoftBadge key={mode} active={form.rescueMode === mode} onClick={() => onChange('rescueMode', mode)} className="capitalize">
                                    {mode}
                                </SoftBadge>
                            ))}
                        </div>
                    </div>

                    {form.rescueMode === 'mixto' && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <label className="block text-sm font-bold text-slate-600 mb-4 flex justify-between">
                                Porcentaje en Capital: <span className="text-[#0B2545]">{form.pctCapital}%</span>
                            </label>
                            <input type="range" min="0" max="100" value={form.pctCapital} onChange={(e) => onChange('pctCapital', Number(e.target.value))} className="w-full accent-slate-600" />
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

import { useState } from 'react';
import { TrendingUp, PiggyBank, Briefcase, Calculator, ChevronRight, Info, Link2, ShieldCheck, Settings2, Coins, CheckCircle2 } from 'lucide-react';
import type { RetirementFormState } from './types';

interface RetirementInputPanelProps {
    form: RetirementFormState;
    onChange: (field: keyof RetirementFormState, value: any) => void;
    onGenerate?: () => void;
}

export function RetirementInputPanel({ form, onChange, onGenerate }: RetirementInputPanelProps) {
    const [usaIPC, setUsaIPC] = useState(form.updateRate > 0 || form.updateRateEV > 0);

    const handleIPCToggle = (active: boolean) => {
        setUsaIPC(active);
        if (!active) {
            onChange('updateRate', 0);
            onChange('updateRateEV', 0);
        } else {
            onChange('updateRate', 2);
            onChange('updateRateEV', 2);
        }
    };

    return (
        <div className="mx-auto flex flex-col pb-20 w-full max-w-5xl">
            {/* Cabecera Principal */}
            <div className="mb-14 text-center space-y-4 max-w-3xl mx-auto bg-white/30 backdrop-blur-md border border-white/40 rounded-3xl p-8 shadow-xl">
                <h2 className="text-[42px] font-black tracking-tight text-[#0D1B2A] leading-tight drop-shadow-sm">
                    Configura tu Futuro
                </h2>
                <p className="text-[17.5px] text-[#0D1B2A]/80 font-semibold tracking-wide drop-shadow-sm px-4">
                    Diseña el escenario de tu jubilación. Ajusta tus recursos y define una estrategia de rentas estable, clara y adaptada a tu nivel de vida.
                </p>
            </div>

            <div className="space-y-12">
                {/* BLOQUE 1: PATRIMONIO ACTUAL */}
                <section className="bg-white/40 backdrop-blur-[12px] rounded-[16px] shadow-xl border border-white/50 overflow-hidden">
                    <div className="bg-white/20 px-8 py-7 border-b border-white/30 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="bg-[#0F2A44]/90 p-3.5 rounded-2xl shadow-sm border border-white/20 flex-shrink-0 backdrop-blur-sm">
                                <PiggyBank className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <h3 className="text-[26px] font-black text-[#0D1B2A] tracking-tight leading-none mb-1.5 drop-shadow-sm">Tus Recursos Principales</h3>
                                <p className="text-[15px] text-[#0D1B2A]/70 font-semibold leading-none drop-shadow-sm">Define tu punto de partida financiero</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 items-start relative z-10">
                        {/* Ahorro Privado */}
                        <div className="flex flex-col">
                            <div className="mb-4">
                                <label className="block text-[16px] font-black text-[#0D1B2A] drop-shadow-sm">Capital Privado Disponible</label>
                                <p className="text-[14px] text-[#0D1B2A]/70 font-semibold mt-1.5 leading-snug sm:min-h-[44px]">Liquidez e inversiones que quieres destinar a complementar tu pensión.</p>
                            </div>
                            <div className="relative flex items-center text-[28px] bg-white/30 backdrop-blur-md border border-white/50 shadow-inner rounded-[10px] px-6 py-5 focus-within:border-[#0F2A44]/50 focus-within:shadow-[0_0_0_2px_rgba(15,42,68,0.2)] focus-within:ring-0 transition-all duration-200">
                                <input
                                    type="text"
                                    value={form.ahorros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                                    onChange={(e) => onChange('ahorros', Number(e.target.value.replace(/\D/g, '')))}
                                    className="bg-transparent w-full outline-none font-black text-[#0D1B2A] placeholder-[#0D1B2A]/20"
                                />
                                <span className="text-[#0D1B2A] opacity-60 ml-3 font-bold">€</span>
                            </div>
                        </div>

                        {/* Pensión */}
                        <div className="flex flex-col">
                            <div className="mb-4">
                                <label className="block text-[16px] font-black text-[#0D1B2A] drop-shadow-sm">Tu Pensión Pública</label>
                                <p className="text-[14px] text-[#0D1B2A]/70 font-semibold mt-1.5 leading-snug sm:min-h-[44px]">Estimación de tu pensión bruta mensual (14 pagas).</p>
                            </div>
                            <div className="relative flex items-center text-[28px] bg-white/30 backdrop-blur-md border border-white/50 shadow-inner rounded-[10px] px-6 py-5 focus-within:border-[#0F2A44]/50 focus-within:shadow-[0_0_0_2px_rgba(15,42,68,0.2)] focus-within:ring-0 transition-all duration-200">
                                <input
                                    type="text"
                                    value={form.pensionPublica.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                                    onChange={(e) => onChange('pensionPublica', Number(e.target.value.replace(/\D/g, '')))}
                                    className="bg-transparent w-full outline-none font-black text-[#0D1B2A]"
                                />
                                <span className="text-[#0D1B2A] opacity-60 ml-3 font-bold">€</span>
                            </div>
                            <div className="mt-3 text-left pl-2">
                                <a href="https://sede.seg-social.gob.es/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[14px] text-[#2D5B87] font-[500] hover:text-[#E67E5F] transition-colors">
                                    <Link2 className="w-4 h-4" strokeWidth={3} /> Verificar en portal oficial
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* BLOQUE 2: ESTRATEGIA DE RENTA */}
                <section className="bg-white/40 backdrop-blur-[12px] rounded-[16px] shadow-xl border border-white/50 overflow-hidden relative z-10">
                    <div className="bg-white/20 px-8 py-7 border-b border-white/30 flex items-center gap-5">
                        <div className="bg-[#0F2A44]/90 p-3.5 rounded-2xl shadow-sm border border-white/20 flex-shrink-0 backdrop-blur-sm">
                            <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <h3 className="text-[26px] font-black text-[#0D1B2A] tracking-tight leading-none mb-1.5 drop-shadow-sm">Estructura de Renta e Inversión</h3>
                            <p className="text-[15px] text-[#0D1B2A]/70 font-semibold leading-none drop-shadow-sm">Diseña la trayectoria y longevidad de tu cartera</p>
                        </div>
                    </div>
                    
                    <div className="p-8 space-y-12">
                        {/* Selector Tipo Renta */}
                        <div>
                            <label className="block text-[17px] font-black text-[#0D1B2A] mb-6 drop-shadow-sm">Tus Preferencias de Cobro</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {[
                                    { id: 'temporal', label: 'Escenario Acotado', desc: 'Recibir la renta durante un número exacto de años.' },
                                    { id: 'vitaliciaEV', label: 'Modelo Vitalicio', desc: 'Cálculo protegido hasta el final según longevidad.' },
                                    { id: 'vitaliciaSostenible', label: 'Preservación Total', desc: 'No tocar el capital inicial, vivir solo de rentabilidades.' }
                                ].map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => onChange('rentType', type.id)}
                                        className={`relative flex flex-col text-left p-6 rounded-[10px] transition-all duration-300 border h-[120px] shadow-sm ${
                                            form.rentType === type.id
                                                ? 'border-[#0F2A44] border-2 bg-white/50 backdrop-blur-md shadow-md scale-[1.02]'
                                                : 'border-white/40 bg-white/20 hover:bg-white/30 backdrop-blur-sm'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className={`font-black text-[18px] ${form.rentType === type.id ? 'text-[#0D1B2A]' : 'text-[#0D1B2A]/60'}`}>{type.label}</div>
                                            {form.rentType === type.id && <CheckCircle2 className="w-5 h-5 text-[#0F2A44]" strokeWidth={2.5} />}
                                        </div>
                                        <div className={`text-[14px] font-[500] leading-snug ${form.rentType === type.id ? 'text-[#0F2A44]/90' : 'text-[#0D1B2A]/50'}`}>{type.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 pt-10 border-t border-[#E6EAF1] items-start">
                            {/* Horizonte (Temporal o Vitalicia) */}
                            {form.rentType === 'temporal' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="flex flex-col w-full">
                                            <label className="text-[16px] font-black text-[#0D1B2A] leading-snug drop-shadow-sm">Horizonte Temporal</label>
                                            <span className="text-[14px] text-[#0D1B2A]/70 font-semibold mt-1.5 leading-snug sm:min-h-[44px]">¿Cuántos años quieres disponer del dinero?</span>
                                        </div>
                                        <span className="text-[34px] font-[700] text-[#0F2A44] leading-none mb-1 ml-4 drop-shadow-sm">{form.years}</span>
                                    </div>
                                    <input
                                        type="range" min="5" max="40" step="1"
                                        value={form.years}
                                        onChange={(e) => onChange('years', Number(e.target.value))}
                                        className="w-full accent-[#0F2A44] h-4 bg-white/50 backdrop-blur-sm border border-white/40 shadow-inner rounded-full appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[13px] font-bold text-[#0D1B2A]/60 mt-2"><span>5 años</span><span>40 años</span></div>
                                </div>
                            )}

                            {form.rentType === 'vitaliciaEV' && (
                                <div className="space-y-4">
                                    <div className="flex flex-col mb-4">
                                        <label className="text-[16px] font-black text-[#0D1B2A] leading-snug drop-shadow-sm">Perfil Personal</label>
                                        <span className="text-[14px] text-[#0D1B2A]/70 font-semibold mt-1.5 leading-snug sm:min-h-[44px]">Necesario para calcular esperanza de vida</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-[0.6]">
                                            <div className="relative flex items-center bg-white/30 backdrop-blur-sm border border-white/50 shadow-inner rounded-[10px] px-4 py-4 focus-within:border-[#0F2A44]/50 focus-within:ring-0 transition-all duration-200">
                                                <input
                                                    type="number" value={form.age} onChange={e => onChange('age', Number(e.target.value))}
                                                    className="bg-transparent w-full outline-none font-[700] text-[22px] text-[#0D1B2A] text-center"
                                                    placeholder="Edad"
                                                />
                                            </div>
                                            <div className="text-center mt-3 text-[12px] font-black text-[#0D1B2A]/60 uppercase tracking-widest">Edad</div>
                                        </div>
                                        <div className="flex-1">
                                            <select 
                                                value={form.sex} onChange={e => onChange('sex', e.target.value)}
                                                className="w-full h-full min-h-[64px] bg-white/30 backdrop-blur-sm border border-white/50 shadow-inner rounded-[10px] px-4 font-black text-[18px] text-[#0D1B2A] focus:outline-none focus:border-[#0F2A44]/50 transition-all duration-200 appearance-none text-center cursor-pointer"
                                            >
                                                <option value="male">Hombre</option>
                                                <option value="female">Mujer</option>
                                            </select>
                                            <div className="text-center mt-3 text-[12px] font-black text-[#0D1B2A]/60 uppercase tracking-widest">Identidad</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Revalorización */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end mb-4">
                                    <div className="flex flex-col w-full">
                                        <label className="text-[16px] font-black text-[#0D1B2A] leading-snug drop-shadow-sm">Rendimiento Anual Esperado</label>
                                        <span className="text-[14px] text-[#0D1B2A]/70 font-semibold mt-1.5 leading-snug sm:min-h-[44px]">Revalorización media estimada</span>
                                    </div>
                                    <span className="text-[34px] font-[700] text-[#0F2A44] leading-none mb-1 ml-4 drop-shadow-sm">{form.revalorizacion}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="15" step="0.1"
                                    value={form.revalorizacion}
                                    onChange={(e) => onChange('revalorizacion', Number(e.target.value))}
                                    className="w-full accent-[#0F2A44] h-4 bg-white/50 backdrop-blur-sm border border-white/40 shadow-inner rounded-full appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[13px] font-bold text-[#0D1B2A]/60 mt-2"><span>Conservador</span><span>Agresivo</span></div>
                            </div>
                        </div>

                        {/* Bloque IPC Destacado */}
                        {(form.rentType === 'temporal' || form.rentType === 'vitaliciaEV') && (
                            <div className="mt-12 bg-white/20 backdrop-blur-md border border-white/40 rounded-[24px] p-8 shadow-sm">
                                <div className="flex items-start gap-5">
                                    <div className="mt-1 flex-shrink-0">
                                        <input 
                                            type="checkbox" 
                                            checked={usaIPC} 
                                            onChange={e => handleIPCToggle(e.target.checked)}
                                            className="w-6 h-6 rounded border-white/50 bg-white/30 text-[#0F2A44] focus:ring-[#0F2A44] cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex flex-col w-full">
                                        <label className="text-[18px] font-black text-[#0D1B2A] cursor-pointer select-none block drop-shadow-sm" onClick={() => handleIPCToggle(!usaIPC)}>
                                            ¿Quieres proteger tu renta contra la inflación anual?
                                        </label>
                                        <p className="text-[15px] text-[#0D1B2A]/70 font-medium mt-2 max-w-2xl leading-relaxed">
                                            Si activas esto, simularemos que tu renta mensual crecerá cada año para que no pierdas poder adquisitivo frente a la inflación real.
                                        </p>

                                        {usaIPC && (
                                            <div className="mt-8 pt-6 border-t border-white/30 max-w-xl">
                                                <div className="space-y-6">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[16px] font-black text-[#0D1B2A] drop-shadow-sm">Métrica IPC Anual Constante</span>
                                                        <span className="text-[32px] font-black text-[#E67E5F] drop-shadow-sm">
                                                            {form.rentType === 'temporal' ? form.updateRate : form.updateRateEV}%
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="6" step="0.1"
                                                        value={form.rentType === 'temporal' ? form.updateRate : form.updateRateEV}
                                                        onChange={(e) => {
                                                            if (form.rentType === 'temporal') onChange('updateRate', Number(e.target.value));
                                                            else onChange('updateRateEV', Number(e.target.value));
                                                        }}
                                                        className="w-full accent-[#E67E5F] h-4 bg-white/50 backdrop-blur-sm border border-white/40 shadow-inner rounded-full appearance-none cursor-pointer"
                                                    />
                                                    <div className="flex justify-between text-[13px] font-bold text-[#0D1B2A]/60"><span>0%</span><span>6%</span></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* BLOQUE 3: FISCALIDAD EPSV (Configuración Avanzada) */}
                <section className="bg-white/40 backdrop-blur-[12px] rounded-[16px] shadow-xl border border-white/50 overflow-hidden relative z-10">
                    <div className="bg-white/20 px-8 py-7 border-b border-white/30 flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="bg-[#0F2A44]/90 p-3.5 rounded-2xl shadow-sm border border-white/20 flex-shrink-0 backdrop-blur-sm transition-all">
                                <ShieldCheck className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <h3 className="text-[26px] font-black text-[#0D1B2A] tracking-tight leading-none mb-1.5 drop-shadow-sm">Optimización de tu EPSV</h3>
                                <p className="text-[15px] text-[#0D1B2A]/70 font-semibold leading-none drop-shadow-sm">Analiza el impacto fiscal de tus fondos de pensión</p>
                            </div>
                        </div>
                        {/* Selector Simple/Avanzado EPSV */}
                        <div className="hidden sm:flex items-center bg-[#FFFFFF] border-2 border-[#E6EAF1] rounded-[14px] p-1.5 shadow-sm">
                            <button
                                onClick={() => onChange('conoceRentabilidad', false)}
                                className={`px-5 py-2 text-[14px] font-black rounded-lg transition-all ${!form.conoceRentabilidad ? 'bg-[#0F2A44] text-white shadow-md' : 'text-[#64748B] hover:text-[#0D1B2A]'}`}
                            >
                                Rápido
                            </button>
                            <button
                                onClick={() => onChange('conoceRentabilidad', true)}
                                className={`flex items-center gap-2 px-5 py-2 text-[14px] font-black rounded-lg transition-all ${form.conoceRentabilidad ? 'bg-[#0F2A44] text-white shadow-md' : 'text-[#64748B] hover:text-[#0D1B2A]'}`}
                            >
                                <Settings2 className="w-4 h-4" /> Detallado
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-8 space-y-12">
                        {/* Versión móvil del toggle Simple/Detallado */}
                        <div className="sm:hidden flex items-center bg-[#FFFFFF] border-2 border-[#E6EAF1] rounded-[14px] p-1.5 w-max mb-4 shadow-sm">
                            <button
                                onClick={() => onChange('conoceRentabilidad', false)}
                                className={`px-5 py-2 text-[14px] font-black rounded-lg ${!form.conoceRentabilidad ? 'bg-[#0F2A44] text-white shadow-md' : 'text-[#64748B]'}`}
                            >
                                Rápido
                            </button>
                            <button
                                onClick={() => onChange('conoceRentabilidad', true)}
                                className={`flex items-center gap-2 px-5 py-2 text-[14px] font-black rounded-lg ${form.conoceRentabilidad ? 'bg-[#0F2A44] text-white shadow-md' : 'text-[#64748B]'}`}
                            >
                                <Settings2 className="w-4 h-4" /> Detallado
                            </button>
                        </div>

                        {/* Modalidad Rescate */}
                        <div>
                            <label className="block text-[17px] font-black text-[#0D1B2A] mb-5">
                                ¿Cómo planeas disponer de tu EPSV?
                            </label>
                            <div className="flex bg-white/20 backdrop-blur-sm border border-white/40 rounded-2xl p-2 w-max shadow-inner">
                                {([
                                    { id: 'renta', label: 'Todo como Renta' },
                                    { id: 'capital', label: 'Todo de Golpe (Capital)' },
                                    { id: 'mixto', label: 'Mixto (Parte de golpe)' }
                                ] as const).map(mode => (
                                    <button
                                        key={mode.id}
                                        onClick={() => onChange('rescueMode', mode.id)}
                                        className={`px-7 py-3 rounded-[10px] font-[500] transition-all duration-200 text-[15px] border ${form.rescueMode === mode.id ? 'bg-white/50 border-[#0F2A44]/50 shadow-md text-[#0D1B2A] font-bold' : 'bg-transparent text-[#0D1B2A]/70 border-transparent hover:bg-white/30'}`}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                            
                            {form.rescueMode === 'mixto' && (
                                <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5 bg-white/20 backdrop-blur-md border border-white/40 p-6 rounded-[20px] max-w-lg shadow-sm">
                                    <span className="font-black text-[#0D1B2A] text-[16px] whitespace-nowrap drop-shadow-sm">Fracción de golpe:</span>
                                    <div className="flex-1 flex items-center gap-5">
                                        <input type="range" min="0" max="100" value={form.pctCapital} onChange={e => onChange('pctCapital', Number(e.target.value))} className="w-full accent-[#0F2A44] h-4 bg-white/50 backdrop-blur-sm border border-white/40 shadow-inner rounded-full appearance-none cursor-pointer" />
                                        <span className="text-[34px] font-[700] text-[#0F2A44] w-20 text-right leading-none drop-shadow-sm">{form.pctCapital}%</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modulos EPSV */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            {/* Pre-2027 */}
                            <div className="flex flex-col h-full bg-white/20 backdrop-blur-md border border-white/40 rounded-[24px] p-7 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-5 opacity-10 pointer-events-none">
                                    <Briefcase className="w-28 h-28 text-[#0F2A44]" />
                                </div>
                                <h4 className="font-extrabold text-[#0D1B2A] text-[18px] mb-7 flex items-center gap-3 drop-shadow-sm">
                                    Aportaciones Previas a 2027
                                    {!form.conoceRentabilidad && <span className="text-[12px] bg-white/50 border border-white/40 text-[#0D1B2A]/80 px-3 py-1 rounded-full font-black uppercase tracking-wider backdrop-blur-sm shadow-inner">Modo Rápido</span>}
                                </h4>
                                
                                <div className="space-y-6 relative z-10 flex-1 flex flex-col">
                                    <div className="bg-white/30 backdrop-blur-sm p-6 rounded-2xl border border-white/40 shadow-inner">
                                        <label className="block text-[14px] font-black text-[#0D1B2A] uppercase tracking-wider mb-3">Saldo Total Actual</label>
                                        <div className="relative flex items-center border border-white/40 rounded-[10px] px-4 py-3 bg-white/40 focus-within:border-[#0F2A44]/50 focus-within:shadow-[0_0_0_2px_rgba(15,42,68,0.2)] focus-within:ring-0 transition-all duration-200">
                                            <span className="text-[#0D1B2A] opacity-60 font-[700] mr-3">€</span>
                                            <input type="text" value={form.epsvPre2026.toLocaleString('es-ES')} onChange={e => onChange('epsvPre2026', Number(e.target.value.replace(/\D/g, '')))} className="w-full bg-transparent font-[700] text-[22px] text-[#0D1B2A] outline-none" />
                                        </div>
                                    </div>

                                    {form.conoceRentabilidad && (
                                        <div className="pt-6 border-t border-white/30 mt-auto">
                                            <label className="block text-[14px] font-black text-[#16A34A] uppercase tracking-wider mb-3 drop-shadow-sm">Plusvalía Generada</label>
                                            <div className="flex items-center bg-white/30 backdrop-blur-[2px] border border-[#16A34A]/50 shadow-inner rounded-[10px] px-4 py-3 focus-within:shadow-[0_0_0_2px_rgba(22,163,74,0.2)] focus-within:ring-0 transition-all duration-200">
                                                <span className="text-[#16A34A] font-[700] mr-3">€</span>
                                                <input type="text" value={form.rentabilidadPre2026.toLocaleString('es-ES')} onChange={e => onChange('rentabilidadPre2026', Number(e.target.value.replace(/\D/g, '')))} className="w-full bg-transparent font-[700] text-[20px] text-[#0D1B2A] outline-none placeholder-[#0D1B2A]/30" placeholder="0" />
                                            </div>
                                            <p className="text-[13px] text-[#0D1B2A]/60 mt-3 font-semibold">Costo histórico aportado: <span className="text-[#0D1B2A]">{Math.max(0, form.epsvPre2026 - form.rentabilidadPre2026).toLocaleString('es-ES')} €</span></p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Post-2027 */}
                            <div className="flex flex-col h-full bg-white/20 backdrop-blur-md border border-white/40 rounded-[24px] p-7 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-5 opacity-10 pointer-events-none">
                                    <Coins className="w-28 h-28 text-[#0F2A44]" />
                                </div>
                                <h4 className="font-extrabold text-[#0D1B2A] text-[18px] mb-7 flex items-center gap-3 drop-shadow-sm">
                                    Aportaciones Posteriores a 2027
                                </h4>
                                
                                <div className="space-y-6 relative z-10 flex-1 flex flex-col">
                                    <div className="bg-white/30 backdrop-blur-sm p-6 rounded-2xl border border-white/40 shadow-inner">
                                        <label className="block text-[14px] font-black text-[#0D1B2A] uppercase tracking-wider mb-3">Saldo Total Actual</label>
                                        <div className="relative flex items-center border border-white/40 rounded-[10px] px-4 py-3 bg-white/40 focus-within:border-[#0F2A44]/50 focus-within:shadow-[0_0_0_2px_rgba(15,42,68,0.2)] focus-within:ring-0 transition-all duration-200">
                                            <span className="text-[#0D1B2A] opacity-60 font-[700] mr-3">€</span>
                                            <input type="text" value={form.epsvPost2026.toLocaleString('es-ES')} onChange={e => onChange('epsvPost2026', Number(e.target.value.replace(/\D/g, '')))} className="w-full bg-transparent font-[700] text-[22px] text-[#0D1B2A] outline-none" />
                                        </div>
                                    </div>

                                    {form.conoceRentabilidad && (
                                        <div className="pt-6 border-t border-white/30 mt-auto">
                                            <label className="block text-[14px] font-black text-[#16A34A] uppercase tracking-wider mb-3 drop-shadow-sm">Plusvalía Generada</label>
                                            <div className="flex items-center bg-white/30 backdrop-blur-[2px] border border-[#16A34A]/50 shadow-inner rounded-[10px] px-4 py-3 focus-within:shadow-[0_0_0_2px_rgba(22,163,74,0.2)] focus-within:ring-0 transition-all duration-200">
                                                <span className="text-[#16A34A] font-[700] mr-3">€</span>
                                                <input type="text" value={form.rentabilidadPost2026.toLocaleString('es-ES')} onChange={e => onChange('rentabilidadPost2026', Number(e.target.value.replace(/\D/g, '')))} className="w-full bg-transparent font-[700] text-[20px] text-[#0D1B2A] outline-none placeholder-[#0D1B2A]/30" placeholder="0" />
                                            </div>
                                            <p className="text-[13px] text-[#0D1B2A]/60 mt-3 font-semibold">Costo histórico aportado: <span className="text-[#0D1B2A]">{Math.max(0, form.epsvPost2026 - form.rentabilidadPost2026).toLocaleString('es-ES')} €</span></p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Toggle Primer Rescate */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-white/20 backdrop-blur-md border border-white/40 p-6 rounded-[20px] shadow-sm">
                            <div className="flex items-center gap-5">
                                <div className="p-3 bg-white/40 backdrop-blur-sm rounded-xl border border-white/50 shadow-inner"><Info className="w-6 h-6 text-[#0F2A44]" /></div>
                                <div className="flex flex-col justify-center">
                                    <label className="text-[16px] font-black text-[#0D1B2A] leading-snug drop-shadow-sm">¿Va a ser la primera vez que rescates tu EPSV?</label>
                                    <p className="text-[14px] text-[#0D1B2A]/70 font-semibold mt-1 leading-snug">Ayuda a calcular bien la exención del 40%.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer ml-auto sm:ml-0 group flex-shrink-0">
                                <input type="checkbox" checked={form.esPrimerRescate} onChange={e => onChange('esPrimerRescate', e.target.checked)} className="sr-only peer" />
                                <div className="w-16 h-9 bg-white/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-[1.75rem] peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-white after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-[#0F2A44] shadow-inner border border-white/40"></div>
                            </label>
                        </div>
                    </div>
                </section>

                {/* BOTÓN PRINCIPAL */}
                {onGenerate && (
                    <div className="flex justify-center pt-8">
                        <button
                            onClick={onGenerate}
                            className="bg-[#E67E5F] text-white px-12 py-5 rounded-[20px] font-bold text-[18px] shadow-[0_20px_40px_-5px_rgba(230,126,95,0.4)] flex items-center gap-4 transition-all hover:-translate-y-1 hover:shadow-[0_25px_50px_-5px_rgba(230,126,95,0.5)] hover:bg-[#D46B4B] relative overflow-hidden group"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                            <Calculator className="w-6 h-6 text-white" />
                            <span className="tracking-wide">Ver mi resultado proyectado</span>
                            <ChevronRight className="w-5 h-5 ml-2 text-white" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

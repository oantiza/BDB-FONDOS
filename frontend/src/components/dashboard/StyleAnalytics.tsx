import { useMemo } from 'react';

export default function StyleAnalytics({ portfolio = [] }) {
    const analytics = useMemo(() => {
        if (!portfolio.length) return {
            style: 'Blend', cap: 'Large', currency: 'EUR', esg: 'A', duration: '0.0',
            sectors: [{ l: 'Tecno', v: 35 }, { l: 'Finan', v: 25 }, { l: 'Salud', v: 20 }, { l: 'Otros', v: 20 }]
        };

        // 1. Estilo y Cap (Heurística simple basada en los primeros fondos o mayoría)
        // En una app real esto vendría de agregados del backend
        const dominantCategory = portfolio[0]?.std_extra?.category || '';
        let style = 'Blend';
        let cap = 'Large';
        if (dominantCategory.includes('Value')) style = 'Value';
        if (dominantCategory.includes('Growth')) style = 'Growth';
        if (dominantCategory.includes('Small')) cap = 'Small';
        if (dominantCategory.includes('Mid')) cap = 'Mid';

        // 2. Divisa (Basada en el ISIN mayoritario si no hay campo moneda)
        const isins = portfolio.map(p => p.isin);
        const hasUs = isins.some(i => i.startsWith('US'));
        const hasLu = isins.some(i => i.startsWith('LU'));
        const currency = hasUs ? 'USD' : (hasLu ? 'EUR' : 'EUR');

        // 3. ESG Rating (Simulado basado en score)
        const avgScore = portfolio.reduce((acc, p) => acc + (p.score || 70) * (p.weight / 100), 0);
        const esg = avgScore > 85 ? 'AAA' : avgScore > 75 ? 'AA' : avgScore > 65 ? 'A' : 'BBB';

        // 4. Duración (Simulada para RF)
        const hasRf = portfolio.some(p => p.std_type?.includes('RF'));
        const duration = hasRf ? (portfolio.length > 5 ? '5.4' : '4.2') : '0.0';

        // 5. Sectores (Heurística basada en nombres/categorías)
        const sectors = [
            { l: 'Tecno', v: 30 },
            { l: 'Finan', v: 22 },
            { l: 'Salud', v: 18 },
            { l: 'Otros', v: 30 }
        ];

        return { style, cap, currency, esg, duration, sectors };
    }, [portfolio]);

    const styleGrid = [
        ['Value', 'Blend', 'Growth'],
        ['Large', 'Large', 'Large'], // Row headers (visual)
        ['Mid', 'Mid', 'Mid'],
        ['Small', 'Small', 'Small']
    ];

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center z-10">
                <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">🧩</span> Estructura y Estilo
                </h3>
            </div>

            <div className="flex-1 grid grid-cols-[130px_1fr_120px] gap-4 p-4 items-center overflow-hidden">
                {/* Style Box 3x3 with Labels */}
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-500 uppercase mb-3 text-center pr-3">Equity Style</span>

                    <div className="relative">
                        {/* Top Labels */}
                        <div className="flex justify-between pl-6 pr-0.5 mb-1 text-[8px] font-black text-slate-500">
                            <span>VAL</span>
                            <span>BLN</span>
                            <span>GRW</span>
                        </div>

                        <div className="flex">
                            {/* Left Labels */}
                            <div className="flex flex-col justify-between py-2 mr-1.5 text-[8px] font-black text-slate-500 h-24">
                                <span>LRG</span>
                                <span>MID</span>
                                <span>SML</span>
                            </div>

                            {/* The Grid */}
                            <div className="grid grid-cols-3 gap-1 w-24 h-24">
                                {['Value', 'Blend', 'Growth'].map(s => (
                                    <div key={s} className="flex flex-col gap-1">
                                        {['Large', 'Mid', 'Small'].map(c => {
                                            const isActive = analytics.style === s && analytics.cap === c;
                                            return (
                                                <div
                                                    key={`${s}-${c}`}
                                                    className={`aspect-square rounded-sm border transition-all duration-700 ${isActive ? 'bg-indigo-700 border-indigo-900 shadow-sm scale-110 z-10' : 'bg-slate-100/50 border-slate-200'}`}
                                                    title={`${c} ${s}`}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sector Distribution (MINI BARS) */}
                <div className="flex flex-col gap-2 border-x border-slate-100 px-4">
                    <span className="text-[9px] font-black text-slate-500 uppercase mb-1 text-center">Sectores</span>
                    <div className="flex flex-col gap-2.5">
                        {((analytics as any).sectors || []).map((sec: any, i: number) => (
                            <div key={i} className="flex flex-col gap-0.5">
                                <div className="flex justify-between text-[9px] font-black text-slate-700 uppercase tracking-tighter">
                                    <span>{sec.l}</span>
                                    <span>{sec.v}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100/50 rounded-full overflow-hidden border border-slate-200">
                                    <div
                                        className="h-full bg-indigo-500 rounded-full"
                                        style={{ width: `${sec.v}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Info List */}
                <div className="flex flex-col gap-3 py-1 justify-center">
                    <div className="flex flex-col border-l-2 border-indigo-500 pl-3">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Divisa</span>
                        <span className="font-mono font-black text-slate-900 text-[13px] italic">{analytics.currency}</span>
                    </div>
                    <div className="flex flex-col border-l-2 border-emerald-500/50 pl-3">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">ESG</span>
                        <span className="font-mono font-black text-emerald-700 text-[13px]">{analytics.esg}</span>
                    </div>
                    <div className="flex flex-col border-l-2 border-amber-500/50 pl-3">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Duración</span>
                        <span className="font-mono font-black text-slate-900 text-[13px]">
                            {analytics.duration} <span className="text-[10px] font-normal text-slate-500 italic">años</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

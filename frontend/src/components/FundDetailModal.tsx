import React from 'react'
import ModalHeader from './common/ModalHeader'
import MetricCard from './common/MetricCard'

interface FundDetailModalProps {
    fund: any
    onClose: () => void
}

export default function FundDetailModal({ fund, onClose }: FundDetailModalProps) {
    if (!fund) return null;

    const perf = fund.std_perf || fund.perf || {};
    const extra = fund.std_extra || {};
    const costs = fund.costs || {};
    const holdings = fund.holdings || [];
    const sectors = fund.sectors || [];
    const regions = fund.regions || {};

    // Format helpers
    const pct = (v: number) => v ? `${(v * 100).toFixed(2)}%` : 'N/A';
    const num = (v: number, decimals = 2) => v ? v.toFixed(decimals) : 'N/A';

    // Rating Helper
    const rating = fund.rating_overall || fund.stars || fund.morningstar_rating || fund.rating || 0;
    const renderStars = (n: number) => {
        return Array(5).fill(0).map((_, i) => (
            <span key={i} className={i < n ? "text-[#D4AF37]" : "text-slate-200"}>★</span>
        ))
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <ModalHeader
                    title={fund.name}
                    icon="📝"
                    onClose={onClose}
                />

                <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar bg-white">
                    {/* Key Metrics */}
                    <section>
                        <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                            Métricas Clave
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <MetricCard label="Ratio Sharpe" value={num(perf.sharpe)} />
                            <MetricCard label="Volatilidad" value={pct(perf.volatility)} />
                            <MetricCard label="CAGR 3Y" value={pct(perf.cagr3y)} />
                            <MetricCard label="Alpha" value={num(perf.alpha)} />
                            <MetricCard label="Beta" value={num(perf.beta)} />
                            <MetricCard label="Max Drawdown" value={pct(perf.max_drawdown)} color="text-[#C0392B]" />
                            <MetricCard label="TER" value={pct(extra.ter || costs.ter)} />
                        </div>
                    </section>


                    {/* Fund Info */}
                    <section className="grid grid-cols-2 gap-8 border-t border-[#eeeeee] pt-8">
                        <InfoRow label="Gestora" value={extra.company || 'N/A'} />
                        <InfoRow label="Categoría" value={extra.category || fund.category_morningstar || 'N/A'} />
                        <InfoRow label="Región Principal" value={extra.regionDetail || fund.primary_region || 'Global'} />
                        <InfoRow label="Moneda" value={extra.currency || 'EUR'} />
                        <InfoRow label="Patrimonio" value={fund.patrimonio ? fund.patrimonio.toLocaleString('es-ES') + ' EUR' : 'N/A'} />

                        {/* Morningstar Rating */}
                        <div>
                            <div className="text-[10px] text-[#A07147] uppercase font-bold tracking-[0.2em] mb-1">Morningstar Rating</div>
                            <div className="text-lg flex items-center gap-1">
                                {renderStars(rating)}
                            </div>
                        </div>
                    </section>

                    {/* Costs */}
                    <section className="border-t border-[#eeeeee] pt-8">
                        <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                            Estructura de Costes
                        </h3>
                        <div className="grid grid-cols-3 gap-8">
                            <InfoRow label="TER" value={pct(extra.ter || (costs.ter ? costs.ter / 100 : 0))} />
                            <InfoRow label="Gestión" value={pct(extra.mgmtFee || (costs.management_fee ? costs.management_fee / 100 : 0))} />
                        </div>
                    </section>

                    {/* Geographic Distribution */}
                    {Object.keys(regions).length > 0 && (
                        <section className="border-t border-[#eeeeee] pt-8">
                            <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                                Distribución Geográfica
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(regions)
                                    .filter(([_, weight]) => (weight as number) > 0)
                                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                                    .map(([region, weight]) => (
                                        <div key={region} className="px-3 py-1 bg-white border border-[#eeeeee] flex items-center gap-2">
                                            <span className="text-xs font-bold text-[#2C3E50] uppercase tracking-wider">{region}</span>
                                            <span className="text-xs font-light text-[#7f8c8d]">|</span>
                                            <span className="text-xs font-bold text-[#A07147]">{(weight as number).toFixed(1)}%</span>
                                        </div>
                                    ))}
                            </div>
                        </section>
                    )}

                    {/* Sectors Distribution */}
                    {sectors.length > 0 && (
                        <section className="border-t border-[#eeeeee] pt-8">
                            <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                                Distribución Sectorial
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {sectors.slice(0, 10).map((sector: any, i: number) => (
                                    <div key={i} className="px-3 py-1 bg-white border border-[#eeeeee] flex items-center gap-2">
                                        <span className="text-xs font-bold text-[#2C3E50] uppercase tracking-wider">{sector.name || sector.sector}</span>
                                        <span className="text-xs font-light text-[#7f8c8d]">|</span>
                                        <span className="text-xs font-bold text-[#A07147]">{(sector.weight).toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Top Holdings */}
                    {holdings.length > 0 && (
                        <section className="border-t border-[#eeeeee] pt-8">
                            <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                                Principales Posiciones
                            </h3>
                            <div className="space-y-0 divide-y divide-[#f5f5f5]">
                                {holdings.slice(0, 10).map((h: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center py-2 hover:bg-[#fcfcfc] transition-colors">
                                        <span className="text-sm font-medium text-[#2C3E50] truncate max-w-[80%]">{h.name}</span>
                                        <span className="font-light text-sm text-[#2C3E50] tabular-nums">{h.weight?.toFixed(2)}%</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Description */}
                    {fund.description && (
                        <section className="border-t border-[#eeeeee] pt-8">
                            <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                                Objetivo de Inversión
                            </h3>
                            <p className="text-sm text-[#2C3E50] leading-relaxed font-light italic border-l-2 border-[#A07147] pl-4">
                                "{fund.description}"
                            </p>
                        </section>
                    )}

                    {/* Historical Returns */}
                    {(fund.returns_history || fund.yearly_returns) && (
                        <section className="border-t border-[#eeeeee] pt-8">
                            <h3 className="text-xl font-light text-[#2C3E50] tracking-tight mb-4 flex items-center gap-2">
                                Rendimiento Histórico
                            </h3>
                            <div className="grid grid-cols-5 gap-2">
                                {(() => {
                                    let history: { year: number, value: number }[] = [];
                                    if (fund.returns_history) {
                                        history = Object.entries(fund.returns_history)
                                            .map(([y, v]) => ({ year: parseInt(y), value: v as number }))
                                            .filter(x => !isNaN(x.year))
                                            .sort((a, b) => b.year - a.year);
                                    } else if (fund.yearly_returns) {
                                        history = fund.yearly_returns.map((x: any) => ({ year: x.year, value: x.return }));
                                    }

                                    return history.slice(0, 5).map((h) => (
                                        <div key={h.year} className="text-center p-2 border border-[#eeeeee] bg-[#fcfcfc]">
                                            <div className="text-[10px] font-bold text-[#A07147] mb-1">{h.year}</div>
                                            <div className={`text-sm font-bold ${h.value >= 0 ? 'text-[#2C3E50]' : 'text-[#C0392B]'}`}>
                                                {h.value > 0 ? '+' : ''}{h.value.toFixed(2)}%
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </section>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-[#eeeeee] flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-[#f5f5f5] hover:bg-[#e0e0e0] text-[#2C3E50] font-bold text-xs uppercase tracking-[0.1em] transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}



const InfoRow = ({ label, value }: { label: string, value: string }) => (
    <div>
        <div className="text-[10px] text-[#A07147] uppercase font-bold tracking-[0.2em] mb-1">{label}</div>
        <div className="text-base font-medium text-[#2C3E50] truncate leading-tight" title={value}>{value}</div>
    </div>
)

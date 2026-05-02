import React from 'react';

interface XRayMetricsProps {
    metrics: any; // Ideally typed, but keeping loosely typed for now to match origin
}

export default function XRayMetrics({ metrics }: XRayMetricsProps) {
    if (!metrics || !metrics.metrics) return null;

    const cards = [
        { label: "RENTABILIDAD (CAGR)", value: metrics.metrics?.cagr ? (metrics.metrics.cagr * 100).toFixed(2) + "%" : "-", color: "text-[#2C3E50]" },
        { label: "VOLATILIDAD", value: metrics.metrics?.volatility ? (metrics.metrics.volatility * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" }, // RED
        { label: "RATIO SHARPE", value: metrics.metrics?.sharpe?.toFixed(2) || "-", color: "text-[#4d5bf9]" }, // BLUE/PURPLE
        { label: "MAX DRAWDOWN", value: metrics.metrics?.maxDrawdown ? (metrics.metrics.maxDrawdown * 100).toFixed(2) + "%" : "-", color: "text-[#C0392B]" }, // RED
        { label: "TASA LIBRE RIESGO", value: metrics.metrics?.rf_rate ? (metrics.metrics.rf_rate * 100).toFixed(2) + "%" : "-", color: "text-[#2C3E50]" }
    ];

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-[#2C3E50] text-3xl font-light tracking-tight">Métricas de Cartera</h2>
            </div>
            <div className="flex justify-between gap-4 pb-8 border-b border-[#eeeeee]">
                {cards.map((m, i) => (
                    <div key={i} className="flex-1 bg-[#F8FAFC] border border-[#f0f0f0] rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="text-[10px] uppercase font-bold text-[#95a5a6] tracking-wide mb-2">{m.label}</div>
                        <div className={`text-2xl font-normal ${m.color}`}>
                            {m.value}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

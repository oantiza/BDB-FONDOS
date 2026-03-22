import React from "react";

type Metrics = {
    volatility?: number;
    sharpe?: number;
    maxDrawdown?: number;
    cagr?: number;
};

function fmtPctDecimal(x?: number, decimals = 2) {
    if (x === null || x === undefined || Number.isNaN(x)) return "—";
    return `${(x * 100).toFixed(decimals)}%`;
}

function fmtNum(x?: number, decimals = 2) {
    if (x === null || x === undefined || Number.isNaN(x)) return "—";
    return x.toFixed(decimals);
}

// Normaliza maxDrawdown: -0.14 / 0.14 / 14.0 => siempre -0.14 (decimal)
function normalizeMaxDD(x?: number) {
    if (x === null || x === undefined || Number.isNaN(x)) return undefined;
    const abs = Math.abs(x);
    const asDecimal = abs > 1 ? abs / 100 : abs;
    return -asDecimal;
}

function MetricCard({
    label,
    value,
    color,
}: {
    label: string;
    value: string;
    color?: string; // Explicit HEX or Tailwind class
}) {
    return (
        <div className="bg-white border border-slate-100/80 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-1 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="h-[28px] w-full flex items-end justify-center px-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest leading-tight line-clamp-2">
                    {label}
                </span>
            </div>
            <div className={`text-[26px] font-semibold tabular-nums tracking-tight ${color || "text-slate-800"}`}>
                {value}
            </div>
        </div>
    );
}

export function PortfolioMetricsCards({
    metrics1y,
    metrics3y,
    metrics5y,
    rfLabel = "RF 1.93%",
}: {
    metrics1y: Metrics | null;
    metrics3y: Metrics | null;
    metrics5y: Metrics | null;
    rfLabel?: string;
}) {
    const maxDD = normalizeMaxDD(metrics5y?.maxDrawdown);

    return (
        <div className="h-full w-full flex items-center justify-center p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 w-full">
                <MetricCard
                    label="Volatilidad (1Y)"
                    value={fmtPctDecimal(metrics1y?.volatility)}
                    color="text-amber-700/90"
                />
                <MetricCard
                    label="Volatilidad (3A)"
                    value={fmtPctDecimal(metrics3y?.volatility)}
                    color="text-amber-700/90"
                />
                <MetricCard
                    label={`Ratio Sharpe (${rfLabel})`}
                    value={fmtNum(metrics3y?.sharpe, 2)}
                    color="text-indigo-700/90"
                />
                <MetricCard
                    label="Max Drawdown"
                    value={maxDD === undefined ? "—" : fmtPctDecimal(maxDD)}
                    color="text-rose-800/80"
                />
                <MetricCard
                    label="Rentabilidad 3A"
                    value={fmtPctDecimal(metrics3y?.cagr)}
                    color="text-emerald-700/90"
                />
                <MetricCard
                    label="Rentabilidad 5A"
                    value={fmtPctDecimal(metrics5y?.cagr)}
                    color="text-slate-700"
                />
            </div>
        </div>
    );
}

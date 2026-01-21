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
        <div className="flex-1 bg-[#F8FAFC] border border-[#f0f0f0] rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <div className="text-[10px] uppercase font-bold text-[#95a5a6] tracking-wide mb-2">
                {label}
            </div>
            <div className={`text-2xl font-normal ${color || "text-[#2C3E50]"}`}>
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
                    color="text-[#C0392B]" // Red matches X-Ray
                />
                <MetricCard
                    label="Volatilidad (3A)"
                    value={fmtPctDecimal(metrics3y?.volatility)}
                    color="text-[#C0392B]" // Red matches X-Ray
                />
                <MetricCard
                    label={`Ratio Sharpe (${rfLabel})`}
                    value={fmtNum(metrics3y?.sharpe, 2)}
                    color="text-[#4d5bf9]" // Blue/Purple matches X-Ray
                />
                <MetricCard
                    label="Max Drawdown"
                    value={maxDD === undefined ? "—" : fmtPctDecimal(maxDD)}
                    color="text-[#C0392B]" // Red matches X-Ray
                />
                <MetricCard
                    label="Rentabilidad 3A"
                    value={fmtPctDecimal(metrics3y?.cagr)}
                    color="text-[#4d5bf9]" // Blue matches X-Ray screenshot style for returns
                />
                <MetricCard
                    label="Rentabilidad 5A"
                    value={fmtPctDecimal(metrics5y?.cagr)}
                    color="text-[#2C3E50]" // Standard dark
                />
            </div>
        </div>
    );
}

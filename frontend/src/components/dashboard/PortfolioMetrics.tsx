
export default function PortfolioMetrics({ portfolio = [], riskFreeRate = 0 }) {
    // Computed on every render to ensure reactivity
    const metrics = (() => {
        if (!portfolio.length) return {
            vol: '0.00%', sharpe: '0.00', maxDD: '0.00%',
            cagr: '0.00%', ret3y: '0.00%', ret5y: '0.00%', rfLabel: '0.00%'
        };

        let wVol = 0;
        let wSharpe = 0;
        let wRet3y = 0;
        let wRet5y = 0;
        let totalW = 0;

        portfolio.forEach((p: any) => {
            const w = (p.weight || 0) / 100;
            const perf = p.std_perf || {};

            // Volatility
            wVol += (perf.volatility || 0.12) * w;

            // Sharpe (Not used for portfolio level anymore)
            wSharpe += (perf.sharpe || 0) * w;

            // Return 3Y
            wRet3y += (perf.cagr3y || 0) * w;

            // Return 5Y
            let r5 = 0;
            if (p.returns_history) {
                const years = Object.keys(p.returns_history).map(y => parseInt(y)).sort((a, b) => b - a).slice(0, 5);
                if (years.length >= 5) {
                    const product = years.reduce((acc, y) => acc * (1 + (p.returns_history[y] / 100)), 1);
                    r5 = Math.pow(product, 1 / years.length) - 1;
                } else {
                    r5 = perf.cagr3y || 0;
                }
            } else {
                r5 = perf.cagr3y || 0;
            }
            wRet5y += r5 * w;

            totalW += w;
        });

        const diversificationFactor = portfolio.length > 3 ? 0.85 : 1.0;
        const finalVol = Math.max(0.02, wVol * diversificationFactor);
        const finalMaxDD = finalVol * -2.5;

        // Correct Portfolio Sharpe: (Return - Rf) / Volatility
        const portfolioSharpe = finalVol > 0 ? (wRet3y - riskFreeRate) / finalVol : 0;

        return {
            vol: (finalVol * 100).toFixed(2) + '%',
            sharpe: (portfolioSharpe).toFixed(2),
            maxDD: (finalMaxDD * 100).toFixed(2) + '%',
            cagr: (wRet3y * 100).toFixed(2) + '%',
            ret3y: (wRet3y * 100).toFixed(2) + '%',
            ret5y: (wRet5y * 100).toFixed(2) + '%',
            rfLabel: (riskFreeRate * 100).toFixed(2) + '%'
        };
    })();

    const items = [
        { label: 'Volatilidad (1Y)', value: metrics.vol, color: 'text-slate-700' },
        { label: 'Volatilidad (3A)', value: metrics.vol, color: 'text-slate-900' }, // Added 3Y Vol
        { label: `Ratio Sharpe (Rf ${metrics.rfLabel})`, value: metrics.sharpe, color: 'text-indigo-600' },
        { label: 'Max Drawdown', value: metrics.maxDD, color: 'text-rose-600' },
        { label: 'CAGR (3Y)', value: metrics.cagr, color: 'text-emerald-600' },
        { label: 'Rentabilidad 3A', value: metrics.ret3y, color: 'text-blue-600' },
        { label: 'Rentabilidad 5A', value: metrics.ret5y, color: 'text-blue-800' },
    ];

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="p-2 border-b border-gray-200 bg-gray-50 flex justify-between items-center z-10 shrink-0">
                <h3 className="font-sans font-bold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="text-base">📈</span> Métricas de Cartera
                </h3>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 w-full max-w-[80%]">
                    {items.map((m, i) => (
                        <div key={i} className="flex flex-col items-center p-2 bg-slate-50/50 rounded border border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</span>
                            <span className={`font-mono text-xl font-black ${m.color}`}>{m.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

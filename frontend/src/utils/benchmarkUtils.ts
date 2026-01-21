export const EXCLUDED_BENCHMARK_ISINS = ['IE00B18GC888', 'IE00B03HCZ61'];

export const BENCHMARK_PROFILES = {
    'Conservador': { rf: 1.0, rv: 0.0, color: '#10B981', id: 'conservative' },
    'Moderado': { rf: 0.75, rv: 0.25, color: '#3B82F6', id: 'moderate' },
    'Equilibrado': { rf: 0.50, rv: 0.50, color: '#8B5CF6', id: 'balanced' },
    'Dinámico': { rf: 0.25, rv: 0.75, color: '#F59E0B', id: 'dynamic' },
    'Agresivo': { rf: 0.0, rv: 1.0, color: '#EF4444', id: 'aggressive' }
};

/**
 * Generates static metadata for the benchmark profiles (Risk/Return points).
 * Requires the full fund database to find the base indices.
 */
export function generateBenchmarkProfiles(fundDatabase: any[]) {
    // Try specific indices first, then fallback to generic types
    let rfIndex = fundDatabase.find((f: any) => f.isin === 'IE00B18GC888');
    let rvIndex = fundDatabase.find((f: any) => f.isin === 'IE00B03HCZ61');

    if (!rfIndex) rfIndex = fundDatabase.find((f: any) => f.std_type === 'RF' && (f.std_perf?.volatility || 0) < 0.05);
    if (!rvIndex) rvIndex = fundDatabase.find((f: any) => f.std_type === 'RV' && (f.std_perf?.volatility || 0) > 0.12);

    // Last resort fallback to ANY RF/RV with valid volatility
    if (!rfIndex) rfIndex = fundDatabase.find((f: any) => f.std_type === 'RF' && f.std_perf?.volatility !== undefined);
    if (!rvIndex) rvIndex = fundDatabase.find((f: any) => f.std_type === 'RV' && f.std_perf?.volatility !== undefined);

    if (!rfIndex || !rvIndex) {
        // Absolute fallback if database is empty or weird
        console.warn("Benchmark base indices unavailable. Using defaults.");
        rfIndex = { std_perf: { volatility: 0.02, cagr3y: 0.02 } }
        rvIndex = { std_perf: { volatility: 0.15, cagr3y: 0.08 } }
    }

    const synthetics: any[] = [];

    Object.entries(BENCHMARK_PROFILES).forEach(([name, p]) => {
        // Approximate Vol and Ret using weighted averages of the base funds' static metrics
        const rfVol = rfIndex.std_perf?.volatility || 0.02;
        const rvVol = rvIndex.std_perf?.volatility || 0.15;
        const rfRet = rfIndex.std_perf?.cagr3y || 0.02;
        const rvRet = rvIndex.std_perf?.cagr3y || 0.08;

        const combinedVol = (rfVol * p.rf) + (rvVol * p.rv);
        const combinedRet = (rfRet * p.rf) + (rvRet * p.rv);

        synthetics.push({
            name,
            id: p.id,
            vol: combinedVol,
            ret: combinedRet,
            color: p.color
        });
    });

    return synthetics;
}

/**
 * Generates time series for synthetic benchmarks based on base fund series.
 * @param {Object} rawSeriesMap - Map of ISIN -> Array of {x, y} points
 */
export function generateSyntheticSeries(rawSeriesMap: Record<string, any[]>) {
    const rfSeries = rawSeriesMap['IE00B18GC888'];
    const rvSeries = rawSeriesMap['IE00B03HCZ61'];

    if (!rfSeries || !rvSeries || rfSeries.length === 0) return {};

    const syntheticSeries: Record<string, any[]> = {};

    Object.entries(BENCHMARK_PROFILES).forEach(([name, p]) => {
        // Map over RF series and combine with RV series
        // Assuming series are aligned by date (x) which they usually are from the backend
        const series = rfSeries.map((pt: any, i: number) => {
            const rvVal = rvSeries[i] ? rvSeries[i].y : 0;
            // Weighted average of the normalized price or returns? 
            // The backend usually returns normalized prices (start=100).
            // Weighted avg of prices is valid for fixed rebalancing approx.
            return {
                x: pt.x,
                y: (pt.y * p.rf) + (rvVal * p.rv)
            };
        });
        syntheticSeries[p.id] = series;
    });

    return syntheticSeries;
}

export function getRiskProfileExplanation(portfolioVol: number, portfolioRet: number, synthetics: any[]) {
    if (!synthetics || !synthetics.length) return "Analysis unavailable.";

    let closest = synthetics[0];
    let minDiff = 999;

    synthetics.forEach((s: any) => {
        const diff = Math.sqrt(Math.pow(s.vol - portfolioVol, 2) + Math.pow(s.ret - portfolioRet, 2));
        if (diff < minDiff) { minDiff = diff; closest = s; }
    });

    let msg = `Su cartera (${(portfolioVol * 100).toFixed(1)}% Vol) se comporta similar al perfil **${closest.name}**.`;

    if (portfolioRet > closest.ret + 0.01) {
        msg += ` Sin embargo, genera un **Alpha** (Retorno Extra) de +${((portfolioRet - closest.ret) * 100).toFixed(2)}% respecto al mismo. ¡Buena eficiencia!`;
    } else if (portfolioRet < closest.ret - 0.01) {
        msg += ` Pero se queda atrás por un ${((closest.ret - portfolioRet) * 100).toFixed(2)}%. Considere optimizar.`;
    } else {
        msg += ` Está alineada con la eficiencia esperada.`;
    }

    return { message: msg, closestProfile: closest };
}

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

export function getRiskProfileExplanation(portfolioVol: number, portfolioRet: number, synthetics: any[], targetBenchmarkId?: string) {
    if (!synthetics || !synthetics.length) return "Analysis unavailable.";

    let targetProfile;

    if (targetBenchmarkId) {
        targetProfile = synthetics.find((s: any) => s.id === targetBenchmarkId);
    }

    // Fallback to finding closest if no target specified or target not found
    if (!targetProfile) {
        let closest = synthetics[0];
        let minDiff = 999;

        synthetics.forEach((s: any) => {
            const diff = Math.sqrt(Math.pow(s.vol - portfolioVol, 2) + Math.pow(s.ret - portfolioRet, 2));
            if (diff < minDiff) { minDiff = diff; closest = s; }
        });
        targetProfile = closest;
    }

    const volDiff = portfolioVol - targetProfile.vol;
    const retDiff = portfolioRet - targetProfile.ret;
    const isEfficient = retDiff >= -0.01; // tolerance

    let msg = `Su cartera (${(portfolioVol * 100).toFixed(1)}% Vol) `;

    // Compare Volatility
    if (Math.abs(volDiff) < 0.01) {
        msg += `tiene un riesgo similar al perfil seleccionado (**${targetProfile.name}**)`;
    } else if (volDiff > 0) {
        msg += `asume mayor riesgo (+${(volDiff * 100).toFixed(1)}%) que el perfil seleccionado (**${targetProfile.name}**)`;
    } else {
        msg += `reduce el riesgo (-${(Math.abs(volDiff) * 100).toFixed(1)}%) frente al perfil seleccionado (**${targetProfile.name}**)`;
    }

    // Compare Efficiency / Alpha
    if (retDiff > 0.01) {
        msg += `. Genera un **Alpha** (Retorno Extra) de +${(retDiff * 100).toFixed(2)}% respecto al mismo. ¡Excelente eficiencia!`;
    } else if (retDiff < -0.01) {
        msg += `. Sin embargo, se queda atrás en retorno por un ${(Math.abs(retDiff) * 100).toFixed(2)}%. Considere optimizar su eficiencia.`;
    } else {
        msg += `. Está alineada con la eficiencia esperada para este nivel de referencia.`;
    }

    return { message: msg, closestProfile: targetProfile };
}

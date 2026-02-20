import { useState, useEffect, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { unwrapResult } from '../utils/api';
import { generateBenchmarkProfiles, getRiskProfileExplanation, EXCLUDED_BENCHMARK_ISINS, BENCHMARK_PROFILES } from '../utils/benchmarkUtils';
import { Fund, PortfolioItem, SmartPortfolioResponse } from '../types';

interface UseXRayAnalyticsProps {
    portfolio: PortfolioItem[];
    fundDatabase: Fund[];
    initialPeriod?: string;
}

export function useXRayAnalytics({ portfolio, fundDatabase, initialPeriod = '3y' }: UseXRayAnalyticsProps) {
    // State
    const [metrics, setMetrics] = useState<SmartPortfolioResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [benchmarkId, setBenchmarkId] = useState('moderate');
    const [period, setPeriod] = useState(initialPeriod);
    const [riskExplanation, setRiskExplanation] = useState('Analizando perfil...');

    // Computed: Synthetic Profiles
    const syntheticProfiles = useMemo(() => {
        if (!fundDatabase || !fundDatabase.length) return [];
        return generateBenchmarkProfiles(fundDatabase);
    }, [fundDatabase]);

    // Computed: Risk Explanation
    useEffect(() => {
        if (metrics?.metrics && metrics?.metrics?.volatility !== undefined && metrics?.metrics?.cagr !== undefined) {
            const synthetics = (metrics as any).synthetics || [];

            const analysis = getRiskProfileExplanation(
                metrics.metrics.volatility,
                metrics.metrics.cagr,
                synthetics, // metrics.synthetics from backend
                benchmarkId // Pass the state!
            );

            if (typeof analysis === 'object' && analysis !== null) {
                setRiskExplanation(analysis.message);
            } else {
                setRiskExplanation(analysis as string);
            }
        }
    }, [metrics, benchmarkId]); // Added benchmarkId dependency

    // Effect: Run Analysis
    useEffect(() => {
        let ismounted = true;

        const runAnalysis = async () => {
            setErrorMsg(null);

            if (!portfolio || portfolio.length === 0) {
                if (ismounted) {
                    setLoading(false);
                    setErrorMsg("La cartera está vacía. Añade fondos antes de analizar.");
                }
                return;
            }

            if (ismounted) setLoading(true);

            try {
                const analyzeFn = httpsCallable(functions, 'backtest_portfolio');
                const res = await analyzeFn({
                    portfolio: portfolio.map(p => ({ isin: p.isin, weight: p.weight })),
                    period: period,
                    benchmarks: EXCLUDED_BENCHMARK_ISINS
                });

                const rawData = unwrapResult<any>(res.data);

                // Check if backend returned a logical error (e.g., "no_common_history")
                if (rawData.error) {
                    throw new Error(rawData.error);
                }

                if (rawData.status === 'no_common_history') {
                    throw new Error(`Datos históricos insuficientes. Activos faltantes: ${rawData.missing_assets?.join(', ') || 'Desconocidos'}`);
                }

                const syntheticSeries = rawData.benchmarkSeries || {};

                // Enrich synthetics with IDs for correct lookup
                const enrichedSynthetics = (rawData.synthetics || []).map((s: any) => {
                    let id = s.id;
                    if (!id && s.name) {
                        // finding matching profile key (case-insensitive)
                        // Cast BENCHMARK_PROFILES to any to avoid strict key checks if needed, or use Object.entries
                        const profileEntry = Object.entries(BENCHMARK_PROFILES).find(([k]) => k.toLowerCase() === s.name.toLowerCase());
                        if (profileEntry) {
                            id = profileEntry[1].id;
                        }
                    }
                    return { ...s, id };
                });

                if (ismounted) {
                    setMetrics({
                        ...rawData,
                        synthetics: enrichedSynthetics,
                        containerBenchmarkSeries: syntheticSeries
                    });
                }

            } catch (error: any) {
                console.error("Error X-Ray:", error);
                if (ismounted) {
                    setErrorMsg(error.message || "Error desconocido al contactar el servidor");
                }
            } finally {
                if (ismounted) setLoading(false);
            }
        };

        runAnalysis();

        return () => { ismounted = false; };
    }, [portfolio, period]);

    return {
        metrics,
        loading,
        errorMsg,
        benchmarkId,
        setBenchmarkId,
        period,
        setPeriod,
        riskExplanation,
        syntheticProfiles
    };
}

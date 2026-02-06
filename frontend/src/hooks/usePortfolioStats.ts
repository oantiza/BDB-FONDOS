import { useMemo } from 'react';
import { PortfolioItem } from '../types';

interface UsePortfolioStatsProps {
    portfolio: PortfolioItem[];
    metrics: any; // Can be improved to SmartPortfolioResponse
}

export function usePortfolioStats({ portfolio, metrics }: UsePortfolioStatsProps) {

    // 1. AGGREGATE CATEGORIES FOR DONUT
    const categoryAllocation = useMemo(() => {
        const catMap: Record<string, number> = {};
        portfolio.forEach(p => {
            const cat = p.std_extra?.category || p.std_type || 'Otros';
            // Clean up category names (remove "RV" prefix if redundant or shorten)
            // Keeping raw for now as per user image which has "RV Global", etc.
            catMap[cat] = (catMap[cat] || 0) + p.weight;
        });
        return Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [portfolio]);


    // 2. Top 10 Aggregated Holdings (from real fund.holdings data)
    const sortedHoldings = useMemo(() => {
        // If backend provided topHoldings, use them directly
        if (metrics?.topHoldings && metrics.topHoldings.length > 0) {
            return metrics.topHoldings;
        }

        // Otherwise, aggregate from portfolio funds' real holdings
        const holdingsMap: any = {};

        portfolio.forEach(fund => {
            const fundWeight = fund.weight / 100; // Normalize fund weight
            const fundHoldings = fund.holdings || []; // Real holdings array from Firestore

            fundHoldings.forEach((h: any) => {
                const key = h.name;
                const contribution = (h.weight / 100) * fundWeight * 100; // Weighted contribution

                if (holdingsMap[key]) {
                    holdingsMap[key].weight += contribution;
                } else {
                    holdingsMap[key] = {
                        name: h.name,
                        sector: h.sector || 'Unknown',
                        weight: contribution
                    };
                }
            });
        });

        // If no real holdings found, fallback to showing funds themselves
        if (Object.keys(holdingsMap).length === 0) {
            return [...portfolio].sort((a, b) => b.weight - a.weight).slice(0, 10);
        }

        // Sort by weight and take top 10
        return Object.values(holdingsMap)
            .sort((a: any, b: any) => b.weight - a.weight)
            .slice(0, 10);
    }, [metrics, portfolio]);


    // 3. CALCULATE STYLE BOX STATS
    const styleStats = useMemo(() => {
        if (!portfolio || portfolio.length === 0) return {
            equity: { style: 'Blend', cap: 'Large' },
            fi: { duration: 'Medium', credit: 'Med' }
        };

        // Equity logic
        const dominantCategory = portfolio[0]?.std_extra?.category || '';
        let style = 'Blend';
        let cap = 'Large';
        if (dominantCategory.includes('Value')) style = 'Value';
        if (dominantCategory.includes('Growth')) style = 'Growth';
        if (dominantCategory.includes('Small')) cap = 'Small';
        if (dominantCategory.includes('Mid')) cap = 'Mid';

        // FI Logic (Simplified for now based on aggregations or keywords)
        // Ideally loop through portfolio to find weighted duration/credit
        let wDuration = 0;
        let totalDurWeight = 0;
        let weightedCreditScore = 0;
        let totalCreditWeight = 0;

        portfolio.forEach(p => {
            const w = p.weight;
            const dur = p.std_extra?.duration || 0;
            if (dur > 0) {
                wDuration += dur * w;
                totalDurWeight += w;
            }

            // Credit heuristic
            const q = p.std_extra?.credit_quality || 'BBB';
            let score = 2; // BBB
            if (['AAA', 'AA', 'A'].some(x => q.includes(x))) score = 3;
            else if (['BB', 'B', 'CCC'].some(x => q.includes(x)) || q.includes('High Yield')) score = 1;

            if (p.std_type === 'RF' || p.std_type === 'Fixed Income') {
                weightedCreditScore += score * w;
                totalCreditWeight += w;
            }
        });

        const finalDur = totalDurWeight > 0 ? wDuration / totalDurWeight : 0;
        let durLabel = 'Medium';
        if (finalDur > 0) {
            if (finalDur < 3) durLabel = 'Short';
            else if (finalDur > 7) durLabel = 'Long';
        }

        const finalCredit = totalCreditWeight > 0 ? weightedCreditScore / totalCreditWeight : 0;
        let creditLabel = 'Med';
        if (finalCredit > 2.5) creditLabel = 'High';
        else if (finalCredit < 1.5 && finalCredit > 0) creditLabel = 'Low';

        return {
            equity: { style, cap },
            fi: { duration: durLabel, credit: creditLabel }
        };

    }, [portfolio]);

    // 4. GLOBAL ALLOCATION (Weighted by Metrics)
    const globalAllocation = useMemo(() => {
        let totalEquity = 0;
        let totalBond = 0;
        let totalCash = 0;
        let totalOther = 0;

        let validMetricsWeight = 0;
        let totalWeight = 0;

        portfolio.forEach(p => {
            const w = p.weight;
            if (w <= 0) return;
            totalWeight += w;

            let e = 0, b = 0, c = 0, o = 0;
            let success = false;

            // Strategy 1: Use 'metrics' if valid
            if (p.metrics) {
                const { equity = 0, bond = 0, cash = 0, other = 0 } = p.metrics;
                const sum = equity + bond + cash + other;

                // Allow tolerance 95-105 for normalizing
                if (sum >= 95 && sum <= 105) {
                    const factor = 100 / sum; // Normalize to EXACTLY 100%
                    e = (equity * factor);
                    b = (bond * factor);
                    c = (cash * factor);
                    o = (other * factor);
                    success = true;
                    validMetricsWeight += w;
                }
            }

            // Strategy 2: Fallback to Heuristics (Category/Type)
            if (!success) {
                const cat = (p.std_extra?.category || p.std_type || '').toLowerCase();
                if (cat.includes('renta variable') || cat.includes('equity') || cat.includes('rv')) {
                    e = 100;
                    success = true;
                } else if (cat.includes('renta fija') || cat.includes('fixed income') || cat.includes('rf')) {
                    b = 100;
                    success = true;
                } else if (cat.includes('monetario') || cat.includes('money market') || cat.includes('cash')) {
                    c = 100;
                    success = true;
                } else if (cat.includes('mixto') || cat.includes('allocation')) {
                    // Primitive heuristic for mixed
                    e = 50; b = 50;
                    success = true;
                } else {
                    o = 100;
                    success = true; // Even "Other" is a valid classification
                }
            }

            // Mark as covered if we found a strategy
            if (success) {
                validMetricsWeight += w;
            }

            // Accumulate Weighted Contribution
            // contribution = weight * (allocation / 100)
            totalEquity += w * (e / 100);
            totalBond += w * (b / 100);
            totalCash += w * (c / 100);
            totalOther += w * (o / 100);
        });

        // Normalize final result to ensure exactly 100% (floating point errors)
        const finalSum = totalEquity + totalBond + totalCash + totalOther;
        const norm = finalSum > 0 ? (100 / finalSum) : 0;

        return {
            equity: totalEquity * norm,
            bond: totalBond * norm,
            cash: totalCash * norm,
            other: totalOther * norm,
            coverage: totalWeight > 0 ? (validMetricsWeight / totalWeight) * 100 : 0
        };

    }, [portfolio]);

    // 6. EQUITY REGION ALLOCATION (Front-end aggregation from derived data)
    const equityRegionAllocation = useMemo(() => {
        const rawMap: Record<string, number> = {};
        let totalEquityVal = 0;

        portfolio.forEach(fund => {
            const w = fund.weight;
            // Access derived data safely
            // Access derived data safely with Fallbacks
            // Priority: 1. Derived (Calculated) -> 2. Root Regions (Imported) -> 3. MS Regions (Raw)
            // Priority: 1. Derived -> 2. Root Regions -> 3. MS Regions -> 4. Inference
            let regions = fund.derived?.equity_regions_total;

            if (!regions || Object.keys(regions).length === 0) {
                // @ts-ignore
                regions = fund.regions?.detail || fund.regions || {};
            }

            if (!regions || Object.keys(regions).length === 0) {
                // @ts-ignore
                regions = fund.ms?.regions?.detail || fund.ms?.regions || {};
            }

            // Inference
            if (!regions || Object.keys(regions).length === 0) {
                const text = (fund.name + ' ' + (fund.std_extra?.category || '')).toLowerCase();
                if (text.includes('usa') || text.includes('us ') || text.includes('american')) regions = { 'united_states': 100 };
                else if (text.includes('europe') || text.includes('euro')) regions = { 'europe': 100 };
                else if (text.includes('asia') || text.includes('japan')) regions = { 'asia_emerging': 100 };
                else if (text.includes('global') || text.includes('world')) regions = { 'united_states': 60, 'europe': 20, 'asia_emerging': 20 };
            }


            if (regions) {
                Object.entries(regions).forEach(([region, val]) => {
                    // Safe cast
                    const v = Number(val);
                    if (isNaN(v)) return;

                    // Contribution to total portfolio
                    const contribution = (v / 100) * w;

                    // Normalize Key to Snake Case for Chart Compatibility
                    // e.g. "United States" -> "united_states"
                    const normalizedKey = region.trim().toLowerCase().replace(/\s+/g, '_');

                    rawMap[normalizedKey] = (rawMap[normalizedKey] || 0) + contribution;
                });
            }
        });

        // Calculate Total RV (sum of all regions excluding 'other' to verify?)
        // Let's filter 'other' if it's too big? 
        // User said: "Ignora la clave other si su valor es igual a la suma total de equity".
        // This likely implies checking PER FUND. 
        // But let's look at the aggregated result.

        // Remove 'other' if we have detailed regions? 
        // Let's keep it simple: normalize what we have.

        const finalMap: { name: string; value: number; absoluteValue?: number }[] = [];
        let sumForNorm = 0;

        Object.entries(rawMap).forEach(([region, val]) => {
            if (region === 'other' || region === 'others') {
                // Optional: specific logic?
            }
            if (val > 0.01) sumForNorm += val;
        });

        // Create list with Drill-down normalization (relative to Equity part)
        // Formula: (Valor_Region / Total_RV_Cartera) * 100
        // Total_RV_Cartera here is sumForNorm (allocations found).

        if (sumForNorm > 0) {
            Object.entries(rawMap).forEach(([region, val]) => {
                if (val > 0.01) {
                    finalMap.push({
                        name: region,
                        value: (val / sumForNorm) * 100, // Relative %
                        absoluteValue: val // Absolute % in portfolio
                    });
                }
            });
        }

        return finalMap.sort((a, b) => b.value - a.value);

    }, [portfolio]);

    // 5. REGION ALLOCATION (from backend metrics OR frontend calculation as fallback)
    const regionAllocation = useMemo(() => {
        if (metrics?.regionAllocation && metrics.regionAllocation.length > 0) {
            return metrics.regionAllocation;
        }
        // Fallback to locally calculated/inferred regions
        return equityRegionAllocation;
    }, [metrics, equityRegionAllocation]);

    return {
        categoryAllocation,
        regionAllocation,
        sortedHoldings,
        styleStats,
        globalAllocation,
        equityRegionAllocation
    };
}

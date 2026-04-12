import { useMemo } from 'react';
import { PortfolioItem } from '../types';
import { getCanonicalSubtype } from '../utils/normalizer';

const VALID_REGIONS = ['us', 'europe', 'asia_dev', 'emerging', 'japan'] as const;
type ValidRegion = typeof VALID_REGIONS[number];

function isInvalidRegionBucket(key: string): boolean {
    if (!key) return true;
    const lower = key.trim().toLowerCase();
    return ['unknown', 'other', 'others', 'n/a', 'na', 'null', 'undefined', ''].includes(lower);
}

function canonizeRegion(raw: string): ValidRegion | null {
    if (!raw) return null;
    const lower = raw.trim().toLowerCase();
    
    if (['us', 'usa', 'united states', 'united_states', 'north america', 'north_america', 'american'].includes(lower)) return 'us';
    if (['europe', 'eu', 'eurozone', 'euro'].includes(lower)) return 'europe';
    if (['japan', 'jp'].includes(lower)) return 'japan';
    if (['asia', 'developed asia', 'developed_asia', 'asia dev', 'asia_dev', 'asia pacific', 'asia_pacific'].includes(lower)) return 'asia_dev';
    if (['emerging', 'em', 'emerging markets', 'emerging_markets', 'latam', 'asia emerging', 'asia_emerging'].includes(lower)) return 'emerging';
    
    return null;
}

interface UsePortfolioStatsProps {
    portfolio: PortfolioItem[];
    metrics: any; // Can be improved to SmartPortfolioResponse
}

export function usePortfolioStats({ portfolio, metrics }: UsePortfolioStatsProps) {

    // 1. AGGREGATE CATEGORIES FOR DONUT
    const categoryAllocation = useMemo(() => {
        const catMap: Record<string, number> = {};
        portfolio.forEach(p => {
            const cat = getCanonicalSubtype(p);
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
            equity: { style: 'Blend', cap: 'Large', grid: {} as Record<string, number> },
            fi: { duration: 'Medium', credit: 'Med', grid: {} as Record<string, number> }
        };

        const eqGrid: Record<string, number> = {
            'LRG-VAL': 0, 'LRG-BLN': 0, 'LRG-GRW': 0,
            'MID-VAL': 0, 'MID-BLN': 0, 'MID-GRW': 0,
            'SML-VAL': 0, 'SML-BLN': 0, 'SML-GRW': 0,
        };

        const fiGrid: Record<string, number> = {
            'HGH-SHT': 0, 'HGH-MED': 0, 'HGH-LNG': 0,
            'MED-SHT': 0, 'MED-MED': 0, 'MED-LNG': 0,
            'LOW-SHT': 0, 'LOW-MED': 0, 'LOW-LNG': 0,
        };

        let totalEqWeight = 0;
        let totalFiWeight = 0;
        
        let wDuration = 0;
        let weightedCreditScore = 0;

        let wEqScoreStyle = 0; // Value = -1, Blend = 0, Growth = 1
        let wEqScoreCap = 0;   // Small = -1, Mid = 0, Large = 1

        portfolio.forEach(p => {
            const w = p.weight;
            const cat = String(p.classification_v2?.asset_subtype || '').toLowerCase();
            const type = String(p.classification_v2?.asset_type || '').toLowerCase();
            const name = String(p.name || '').toLowerCase();
            const combined = `${cat} ${name} ${type}`;

            const isEq = combined.includes('equity') || combined.includes('renta variable') || combined.includes('rv') || combined.includes('stock');
            const isFi = combined.includes('fixed_income') || combined.includes('renta fija') || combined.includes('fixed income') || combined.includes('rf') || combined.includes('bond') || combined.includes('deuda');
            
            if (isEq) {
                totalEqWeight += w;
                
                // 1. Grid allocation
                if (p.ms?.equity_style) {
                    const es = p.ms.equity_style;
                    eqGrid['LRG-VAL'] += ((es.large_value || 0) / 100) * w;
                    eqGrid['LRG-BLN'] += ((es.large_core || 0) / 100) * w;
                    eqGrid['LRG-GRW'] += ((es.large_growth || 0) / 100) * w;
                    eqGrid['MID-VAL'] += ((es.mid_value || 0) / 100) * w;
                    eqGrid['MID-BLN'] += ((es.mid_core || 0) / 100) * w;
                    eqGrid['MID-GRW'] += ((es.mid_growth || 0) / 100) * w;
                    eqGrid['SML-VAL'] += ((es.small_value || 0) / 100) * w;
                    eqGrid['SML-BLN'] += ((es.small_core || 0) / 100) * w;
                    eqGrid['SML-GRW'] += ((es.small_growth || 0) / 100) * w;
                } else {
                    let sCol = 'BLN'; let sRow = 'LRG';
                    let val = 0; let cap = +1;
                    
                    const cat = String(p.classification_v2?.asset_subtype || '').toUpperCase();
                    if (cat.includes('VALUE') || String(p.classification_v2?.equity_style_box).includes('VALUE')) { sCol = 'VAL'; val = -1; }
                    if (cat.includes('GROWTH') || String(p.classification_v2?.equity_style_box).includes('GROWTH')) { sCol = 'GRW'; val = 1; }
                    
                    if (cat.includes('SMALL') || String(p.classification_v2?.equity_style_box).includes('SMALL')) { sRow = 'SML'; cap = -1; }
                    if (cat.includes('MID') || String(p.classification_v2?.equity_style_box).includes('MID')) { sRow = 'MID'; cap = 0; }
                    
                    eqGrid[`${sRow}-${sCol}`] += w;
                    wEqScoreStyle += val * w;
                    wEqScoreCap += cap * w;
                }
            }

            if (isFi) {
                totalFiWeight += w;

                let durScore = 5; // Med (months/years proxy)
                let cScore = 2; // Med
                
                let durCat = 'MED';
                let cCat = 'MED';

                if (p.classification_v2?.fi_duration_bucket) {
                    const durBucket = p.classification_v2.fi_duration_bucket as string;
                    if (durBucket === 'SHORT') { durScore = 2; durCat = 'SHT'; }
                    else if (durBucket === 'LONG') { durScore = 10; durCat = 'LNG'; }
                } else if (p.std_extra?.duration) {
                    durScore = p.std_extra.duration;
                    if (durScore < 3.5) durCat = 'SHT';
                    else if (durScore > 7) durCat = 'LNG';
                }

                if (p.classification_v2?.fi_credit_bucket) {
                    const cb = p.classification_v2.fi_credit_bucket as string;
                    if (cb === 'HIGH_QUALITY') { cScore = 3; cCat = 'HGH'; }
                    else if (cb === 'LOW_QUALITY') { cScore = 1; cCat = 'LOW'; }
                } else {
                    const q = p.std_extra?.credit_quality || 'BBB';
                    if (['AAA', 'AA', 'A'].some(x => q.includes(x))) { cScore = 3; cCat = 'HGH'; }
                    else if (['BB', 'B', 'CCC'].some(x => q.includes(x)) || q.includes('High Yield')) { cScore = 1; cCat = 'LOW'; }
                }

                wDuration += durScore * w;
                weightedCreditScore += cScore * w;
                fiGrid[`${cCat}-${durCat}`] += w;
            }
        });

        // Normalize Equity Grid
        if (totalEqWeight > 0) {
            Object.keys(eqGrid).forEach(k => {
                eqGrid[k] = (eqGrid[k] / totalEqWeight) * 100;
            });
        }

        // Normalize FI Grid
        if (totalFiWeight > 0) {
            Object.keys(fiGrid).forEach(k => {
                fiGrid[k] = (fiGrid[k] / totalFiWeight) * 100;
            });
        }

        // Equity Overall Style/Cap
        let finalStyle = 'Blend';
        let finalCap = 'Large';
        if (totalEqWeight > 0) {
            const avgStyle = wEqScoreStyle / totalEqWeight;
            const avgCap = wEqScoreCap / totalEqWeight;

            if (avgStyle < -0.33) finalStyle = 'Value';
            else if (avgStyle > 0.33) finalStyle = 'Growth';

            if (avgCap < -0.33) finalCap = 'Small';
            else if (avgCap < 0.33) finalCap = 'Mid';
        }

        // FI Overall Duration/Credit
        const finalDur = totalFiWeight > 0 ? wDuration / totalFiWeight : 0;
        let durLabel = 'Med';
        if (finalDur > 0) {
            if (finalDur < 3.5) durLabel = 'Short';
            else if (finalDur > 7) durLabel = 'Long';
        }

        const finalCredit = totalFiWeight > 0 ? weightedCreditScore / totalFiWeight : 0;
        let creditLabel = 'Med';
        if (finalCredit > 2.5) creditLabel = 'High';
        else if (finalCredit < 1.5 && finalCredit > 0) creditLabel = 'Low';

        return {
            equity: { style: finalStyle, cap: finalCap, grid: eqGrid },
            fi: { duration: durLabel, credit: creditLabel, grid: fiGrid }
        };

    }, [portfolio]);

    // 4. GLOBAL ALLOCATION (Weighted by Metrics)
    const globalAllocation = useMemo(() => {
        let totalEquity = 0;
        let totalBond = 0;
        let totalCash = 0;
        let totalOther = 0;

        let validMetricsWeight = 0;
        let fallbackMetricsWeight = 0;
        let totalWeight = 0;

        portfolio.forEach(p => {
            const w = Number(p.weight);
            if (isNaN(w) || w <= 0) return;
            totalWeight += w;

            let e = 0, b = 0, c = 0, o = 0;
            let success = false;
            let isFallback = false;

            // Strategy 1: V2 Canonical Exposure
            if (p.portfolio_exposure_v2?.economic_exposure) {
                const ee = p.portfolio_exposure_v2.economic_exposure;
                const eeEq = Number(ee.equity) || 0;
                const eeBo = Number(ee.bond) || 0;
                const eeCa = Number(ee.cash) || 0;
                const eeOt = Number(ee.other) || 0;
                const sum = eeEq + eeBo + eeCa + eeOt;
                if (sum > 0) {
                    const factor = 100 / sum;
                    e = eeEq * factor;
                    b = eeBo * factor;
                    c = eeCa * factor;
                    o = eeOt * factor;
                    success = true;
                }
            }

            // Strategy 2: Use 'metrics' if valid
            if (!success && p.metrics) {
                const meEq = Number(p.metrics.equity) || 0;
                const meBo = Number(p.metrics.bond) || 0;
                const meCa = Number(p.metrics.cash) || 0;
                const meOt = Number(p.metrics.other) || 0;
                const sum = meEq + meBo + meCa + meOt;

                // Allow tolerance 95-105 for normalizing
                if (sum >= 95 && sum <= 105) {
                    const factor = 100 / sum; // Normalize to EXACTLY 100%
                    e = (meEq * factor);
                    b = (meBo * factor);
                    c = (meCa * factor);
                    o = (meOt * factor);
                    success = true;
                }
            }

            // Strategy 3: Fallback to Heuristics (Category/Type)
            if (!success) {
                const cat = (p.classification_v2?.asset_subtype || '').toLowerCase();
                const type = (p.classification_v2?.asset_type || '').toLowerCase();
                const name = (p.name || '').toLowerCase();
                const combined = `${cat} ${name} ${type}`;

                if (combined.includes('equity') || combined.includes('renta variable') || combined.includes('rv') || combined.includes('stock')) {
                    e = 100;
                    success = true;
                } else if (combined.includes('fixed_income') || combined.includes('renta fija') || combined.includes('fixed income') || combined.includes('rf') || combined.includes('bond') || combined.includes('deuda')) {
                    b = 100;
                    success = true;
                } else if (combined.includes('monetary') || combined.includes('monetario') || combined.includes('money market') || combined.includes('cash') || combined.includes('liquidez')) {
                    c = 100;
                    success = true;
                } else if (combined.includes('mixed') || combined.includes('mixto') || combined.includes('allocation') || combined.includes('multi-asset')) {
                    // Smart Heuristic for Mixed Funds
                    if (combined.includes('flexib') || combined.includes('moderado') || combined.includes('moderate')) {
                        e = 50; b = 50;
                    } else if (combined.includes('agresiv') || combined.includes('aggressive') || combined.includes('dynamic') || combined.includes('dinamico')) {
                        e = 75; b = 25;
                    } else if (combined.includes('defens') || combined.includes('conserv') || combined.includes('defensive')) {
                        e = 25; b = 75;
                    } else {
                        // Default Mixed
                        e = 50; b = 50;
                    }
                    success = true;
                } else if (combined.includes('absolute return') || combined.includes('retorno absoluto') || combined.includes('alternative') || combined.includes('real_estate') || combined.includes('commodities')) {
                    o = 100;
                    success = true;
                } else {
                    // Default to Other if completely unknown
                    o = 100;
                    success = true;
                }
                
                if (success) isFallback = true;
            }

            // Mark as covered if we found a strategy
            if (success) {
                if (isFallback) {
                    fallbackMetricsWeight += w;
                } else {
                    validMetricsWeight += w;
                }
            }

            // Accumulate Weighted Contribution
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
            coverage: totalWeight > 0 ? (validMetricsWeight / totalWeight) * 100 : 0,
            fallbackCoverage: totalWeight > 0 ? (fallbackMetricsWeight / totalWeight) * 100 : 0
        };

    }, [portfolio]);

    // 6. EQUITY REGION ALLOCATION (Front-end aggregation from derived data)
    const equityRegionAllocation = useMemo(() => {
        const rawMap: Record<string, number> = {};
        
        // Debug & Coverage tracking
        let recognizedEquityRegionAbsolute = 0;
        let discardedEquityRegionAbsolute = 0;

        portfolio.forEach(fund => {
            const w = Number(fund.weight);
            if (isNaN(w) || w <= 0) return;
            
            // Priority: 1. Derived -> 2. Root Regions -> 3. MS Regions -> 4. Inference
            let regions = fund.portfolio_exposure_v2?.equity_regions;
            
            // Removed V1 fallbacks (derived, regions, ms.regions)

            // Inference
            if (!regions || Object.keys(regions).length === 0) {
                const text = (fund.name + ' ' + (fund.classification_v2?.asset_subtype || '')).toLowerCase();
                if (text.includes('usa') || text.includes('us ') || text.includes('american')) regions = { 'us': 100 };
                else if (text.includes('europe') || text.includes('euro')) regions = { 'europe': 100 };
                else if (text.includes('japan')) regions = { 'japan': 100 };
                else if (text.includes('asia')) regions = { 'asia_dev': 100 };
                else if (text.includes('global') || text.includes('world')) regions = { 'us': 60, 'europe': 20, 'asia_dev': 10, 'emerging': 10 };
            }

            if (regions) {
                Object.entries(regions).forEach(([region, val]) => {
                    const v = Number(val);
                    if (isNaN(v) || v <= 0) {
                        // Discard invalid numeric items
                        discardedEquityRegionAbsolute += (isNaN(v) ? 0 : v) / 100 * w;
                        return;
                    }

                    const contribution = (v / 100) * w;

                    if (isInvalidRegionBucket(region)) {
                        // Discard known junk buckets
                        discardedEquityRegionAbsolute += contribution;
                        return;
                    }

                    const canonical = canonizeRegion(region);
                    if (!canonical) {
                        // Discard unmappable buckets
                        discardedEquityRegionAbsolute += contribution;
                        return;
                    }

                    recognizedEquityRegionAbsolute += contribution;
                    rawMap[canonical] = (rawMap[canonical] || 0) + contribution;
                });
            }
        });

        const finalMap: { name: string; value: number; absoluteValue?: number }[] = [];
        let sumForNorm = 0;

        Object.values(rawMap).forEach(val => {
            if (val > 0.01) sumForNorm += val;
        });

        const totalCoverage = recognizedEquityRegionAbsolute + discardedEquityRegionAbsolute;
        const regionCoveragePct = totalCoverage > 0 ? (recognizedEquityRegionAbsolute / totalCoverage) * 100 : 0;

        // Create list with Drill-down normalization (relative to recognized Equity part)
        if (sumForNorm > 0) {
            Object.entries(rawMap).forEach(([region, val]) => {
                if (val > 0.01) {
                    finalMap.push({
                        name: region,
                        value: (val / sumForNorm) * 100, // Relative % normalized
                        absoluteValue: val // Absolute % in portfolio
                    });
                }
            });
        }

        const sortedResult = finalMap.sort((a, b) => b.value - a.value);

        // Attach debug information to the array object itself safely
        // This keeps the items clean ({ name, value, absoluteValue })
        // but exposes the debug stats for whoever needs it via sortedResult._debug
        Object.defineProperty(sortedResult, '_debug', {
            value: { recognizedEquityRegionAbsolute, discardedEquityRegionAbsolute, regionCoveragePct },
            enumerable: false,
            writable: false
        });

        return sortedResult;

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

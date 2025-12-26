// normalizer.js - Fund Data Normalization Utility
// Extracted from App.jsx for better code organization

/**
 * Normalizes raw fund data from Firestore into a standardized format
 * with computed fields for std_type, std_region, std_perf, and std_extra.
 */
export function normalizeFundData(docData) {
    let tipoCalc = 'Mixto';
    const eq = parseFloat(docData.metrics?.equity || 0);
    const bd = parseFloat(docData.metrics?.bond || 0);
    const cash = parseFloat(docData.metrics?.cash || 0);

    // 1. Basic Type Inference
    if (eq >= 60) tipoCalc = 'RV';
    else if (bd >= 60) tipoCalc = 'RF';
    else if (cash >= 60) tipoCalc = 'Monetario';

    if (tipoCalc === 'Mixto' && docData.manual_type) {
        const mt = docData.manual_type.toUpperCase();
        if (mt.includes('RENTA VARIABLE') || mt.includes('EQUITY')) tipoCalc = 'RV';
        else if (mt.includes('RENTA FIJA') || mt.includes('DEUDA')) tipoCalc = 'RF';
        else if (mt.includes('MONETARIO')) tipoCalc = 'Monetario';
    }

    // 1b. Use new Asset Class if available to refine
    if (docData.asset_class) {
        const ac = docData.asset_class.toUpperCase();
        if (ac.includes('EQUITY')) tipoCalc = 'RV';
        else if (ac.includes('BOND') || ac.includes('FIXED')) tipoCalc = 'RF';
        else if (ac.includes('MONEY') || ac.includes('CASH')) tipoCalc = 'Monetario';
    }

    // 2. Region Inference
    let regionCalc = 'Global';
    if (docData.primary_region) {
        const pr = docData.primary_region.toUpperCase();
        if (pr === 'USA' || pr === 'ESTADOS UNIDOS' || pr === 'EEUU') regionCalc = 'USA';
        else if (pr === 'EUROPE' || pr === 'EUROZONA' || pr === 'EURO') regionCalc = 'Europe';
        else if (pr === 'ASIA' || pr === 'EMERGING' || pr === 'LATAM') regionCalc = 'Emerging';
    } else if (docData.regions) {
        if ((docData.regions.americas || 0) > 60) regionCalc = 'USA';
        else if ((docData.regions.europe || 0) > 60) regionCalc = 'Europe';
    }

    // 3. Stats & History
    const vol = (docData.perf?.volatility || 15) / 100;
    const sharpe = docData.perf?.sharpe || 0;
    const alpha = docData.perf?.alpha || 0;

    // FIX: Calculate 3Y CAGR from returns_history MAP (Schema V2)
    let ret3y = 0;
    if (docData.returns_history) {
        // Objeto { "2023": 12.5, "2022": -4.0, ... }
        // Extraemos años, ordenamos descendente numéricamente
        const years = Object.keys(docData.returns_history)
            .map(y => parseInt(y))
            .filter(y => !isNaN(y))
            .sort((a, b) => b - a);

        const last3 = years.slice(0, 3);

        if (last3.length === 3) {
            // Geometric Mean: ((1+r1)*(1+r2)*(1+r3))^(1/3) - 1
            const product = last3.reduce((acc, yr) => {
                const val = docData.returns_history[yr.toString()];
                return acc * (1 + (val / 100));
            }, 1);
            ret3y = Math.pow(product, 1 / 3) - 1;
        }
    } else if (docData.yearly_returns && Array.isArray(docData.yearly_returns)) {
        // Fallback for legacy schema (just in case mixed data)
        const sorted = [...docData.yearly_returns].sort((a, b) => b.year - a.year);
        const last3 = sorted.slice(0, 3);
        if (last3.length === 3) {
            const product = last3.reduce((acc, yr) => acc * (1 + (yr.return / 100)), 1);
            ret3y = Math.pow(product, 1 / 3) - 1;
        }
    } else if (docData.perf?.cagr3y) {
        ret3y = docData.perf.cagr3y > 1 ? docData.perf.cagr3y / 100 : docData.perf.cagr3y;
    }

    // New: Calculate History Years for consistency
    let yearsHistory = 0;
    if (docData.history_start) {
        try {
            const startDate = docData.history_start.toDate ? docData.history_start.toDate() : new Date(docData.history_start);
            const now = new Date();
            yearsHistory = (now - startDate) / (1000 * 60 * 60 * 24 * 365.25);
        } catch (e) { console.warn("Date parse error", e); }
    }

    // FIX: TER fallback to management_fee if TER is 0
    const rawTer = parseFloat(docData.costs?.ter || 0);
    const rawMgmtFee = parseFloat(docData.costs?.management_fee || 0);
    const effectiveTer = rawTer > 0 ? rawTer : rawMgmtFee;

    // normalizer.ts updates

    // FIX: Normalize Sectors (Handle Object vs Array)
    let finalSectors = docData.sectors || docData.holding_breakdown?.sectors || [];
    if (finalSectors && !Array.isArray(finalSectors) && typeof finalSectors === 'object') {
        finalSectors = Object.entries(finalSectors).map(([k, v]) => ({
            name: k.replace(/_/g, ' '),
            weight: v
        }));
    }

    // FIX: Calculate Duration/Maturity from Buckets if missing
    let duration = parseFloat(docData.metrics?.duration || docData.metrics?.effective_duration || docData.risk?.effective_duration || docData.fixed_income?.effective_duration || 0);
    let effectiveMaturity = parseFloat(docData.metrics?.effective_maturity || docData.metrics?.maturity || docData.fixed_income?.effective_maturity || 0);

    // Fallback Calculation from Maturity Allocation
    if ((duration === 0 || effectiveMaturity === 0) && docData.fixed_income?.maturity_allocation) {
        const alloc = docData.fixed_income.maturity_allocation;
        // Weighted average using midpoints
        let wSum = 0;
        let wMat = 0;

        const buckets = {
            '1_3_years': 2,
            '3_5_years': 4,
            '5_7_years': 6,
            '7_10_years': 8.5,
            'over_10_years': 15, // Conservative estimate
            '10_15_years': 12.5,
            '15_20_years': 17.5,
            'over_20_years': 25,
            '1_3_yr': 2, '3_5_yr': 4, '5_7_yr': 6, '7_10_yr': 8.5, 'over_10_yr': 15
        };

        Object.entries(alloc).forEach(([key, val]) => {
            const v = Number(val) || 0;
            if (v > 0) {
                // Try to find matching bucket
                const k = key.toLowerCase();
                let years = 0;
                if (buckets[k]) years = buckets[k];
                else if (k.includes('1_3')) years = 2;
                else if (k.includes('3_5')) years = 4;
                else if (k.includes('5_7')) years = 6;
                else if (k.includes('7_10')) years = 8.5;
                else if (k.includes('10')) years = 15;

                if (years > 0) {
                    wMat += years * v;
                    wSum += v;
                }
            }
        });

        if (wSum > 0) {
            const avgMat = wMat / wSum;
            if (effectiveMaturity === 0) effectiveMaturity = avgMat;
            if (duration === 0) duration = avgMat * 0.9; // Rule of thumb: Duration ~ 90% of Maturity
        }
    }

    // Capture Credit Quality
    let crQuality = docData.credit_quality || docData.risk?.credit_quality || docData.fixed_income?.avg_credit_quality;
    if (!crQuality && docData.fixed_income?.credit_quality) {
        // Find dominant quality
        const cq = docData.fixed_income.credit_quality;
        const best = Object.entries(cq).sort((a: any, b: any) => b[1] - a[1])[0];
        if (best) crQuality = best[0].toUpperCase();
    }

    return {
        ...docData,
        sectors: finalSectors,
        std_type: tipoCalc,
        std_region: regionCalc,
        std_perf: {
            volatility: vol,
            cagr3y: ret3y,
            sharpe: sharpe,
            alpha: alpha
        },
        std_extra: {
            currency: docData.currency || 'EUR',
            company: docData.fund_company || docData.company || 'Unknown',
            category: docData.category_morningstar || docData.morningstar_category || docData.category || 'Sin Clasificar',
            assetClass: docData.asset_class || '',
            regionDetail: docData.primary_region || docData.region || '',
            yearsHistory: yearsHistory,
            mgmtFee: rawMgmtFee / 100,
            ter: effectiveTer / 100,
            duration: duration,
            credit_quality: crQuality || 'BBB',
            effective_maturity: effectiveMaturity,
            yield_to_maturity: parseFloat(docData.metrics?.yield || docData.metrics?.ytm || 0)
        }
    };
}

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
    const ret3y = (docData.returns?.['3y_annualized'] || 0) / 100;
    const sharpe = docData.perf?.sharpe || 0;
    const alpha = docData.perf?.alpha || 0;

    // New: Calculate History Years for consistency
    let yearsHistory = 0;
    if (docData.history_start) {
        try {
            // Handle Firestore Timestamp or Date string
            const startDate = docData.history_start.toDate ? docData.history_start.toDate() : new Date(docData.history_start);
            const now = new Date();
            yearsHistory = (now - startDate) / (1000 * 60 * 60 * 24 * 365.25);
        } catch (e) { console.warn("Date parse error", e); }
    }

    return {
        ...docData,
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
            category: docData.morningstar_category || '',
            assetClass: docData.asset_class || '',
            regionDetail: docData.primary_region || docData.region || '', // Raw region for chart detail
            yearsHistory: yearsHistory,
            mgmtFee: parseFloat(docData.costs?.management_fee || 0),
            ter: parseFloat(docData.costs?.ter || 0)
        }
    };
}

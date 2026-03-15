const admin = require("firebase-admin");

// Try to load service account
try {
    const serviceAccount = require("./service-account.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (e) {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    }
}

const db = admin.firestore();

function calculateMetrics(prices) {
    if (prices.length < 50) return null;

    // Sort by date ascending
    prices.sort((a, b) => new Date(a.date) - new Date(b.date));

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        const r = (prices[i].nav - prices[i - 1].nav) / prices[i - 1].nav;
        returns.push(r);
    }

    if (returns.length === 0) return null;

    // 1. Annualized Volatility
    // Standard deviation of daily returns
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    const volAnnual = stdDev * Math.sqrt(252);

    // 2. CAGR (Compound Annual Growth Rate)
    const startPrice = prices[0].nav;
    const endPrice = prices[prices.length - 1].nav;
    const startDate = new Date(prices[0].date);
    const endDate = new Date(prices[prices.length - 1].date);

    // Time difference in years
    const days = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const years = days / 365.25;

    let cagr = 0;
    if (years > 0) {
        cagr = Math.pow(endPrice / startPrice, 1 / years) - 1;
    }

    // 3. Sharpe Ratio
    // Assuming Risk Free Rate = 3% (0.03) as a standard fallback if dynamic is not available
    const rf = 0.03;
    let sharpe = 0;
    if (volAnnual > 0) {
        sharpe = (cagr - rf) / volAnnual;
    }

    // 4. Max Drawdown
    let maxDrawdown = 0;
    let peak = prices[0].nav;

    for (const p of prices) {
        if (p.nav > peak) {
            peak = p.nav;
        }
        const drawdown = (p.nav - peak) / peak;
        if (drawdown < maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }

    return {
        cagr: parseFloat(cagr.toFixed(4)),
        volatility: parseFloat(volAnnual.toFixed(4)),
        sharpe: parseFloat(sharpe.toFixed(4)),
        max_drawdown: parseFloat(maxDrawdown.toFixed(4)),
        points: prices.length,
        years: parseFloat(years.toFixed(2))
    };
}

async function main() {
    const isin = "AAAAAAAAAAA";
    console.log(`Calculating metrics for ${isin}...`);

    // 1. Get History
    const hDoc = await db.collection("historico_vl_v2").doc(isin).get();
    if (!hDoc.exists) {
        console.error("No history found.");
        return;
    }

    const data = hDoc.data();
    const history = data.history || [];

    console.log(`Found ${history.length} data points.`);

    // 2. Calculate
    const metrics = calculateMetrics(history);

    if (!metrics) {
        console.error("Could not calculate metrics (insufficient data?)");
        return;
    }

    console.log("Calculated Metrics:");
    console.log(metrics);

    // 3. Update Fund
    const updatePayload = {
        "std_perf": {
            return: metrics.cagr, // Legacy field name often used in frontend
            cagr3y: metrics.cagr, // Mapping to cagr3y for compatibility
            volatility: metrics.volatility,
            sharpe: metrics.sharpe,
            max_drawdown: metrics.max_drawdown,
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        },
        "data_quality.std_perf_ok": true
    };

    await db.collection("funds_v3").doc(isin).update(updatePayload);
    console.log("Success! funds_v3 updated.");
}

main().catch(console.error);

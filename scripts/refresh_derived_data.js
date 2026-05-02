const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

/**
 * RECALCULATE DERIVED DATA
 * ------------------------
 * This script refreshes `derived.*` fields based on the CLEANED `ms.*` data.
 * It fixes inconsistencies where `derived.portfolio_exposure` or `derived.primary_region`
 * hold stale or incorrect values (e.g. "Emergentes" when it's clearly "Europa", or inflated "Other").
 *
 * Usage:
 *   node scripts/refresh_derived_data.js [--dry-run] [--limit 50]
 */

// Init Firebase
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "../serviceAccountKey.json");
let serviceAccount = null;
if (fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    serviceAccount = require(SERVICE_ACCOUNT_FILE);
}

if (!admin.apps.length) {
    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    } else {
        console.warn("⚠️ serviceAccountKey.json not found, trying Application Default Credentials...");
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: "bdb-fondos" // Hardcoded fallback for ADC
        });
    }
}
const db = admin.firestore();

// Helpers reused from cargador_lotes.js
function parseNum(x) {
    if (x === null || x === undefined || x === "") return null;
    if (typeof x === "number") return Number.isFinite(x) ? x : null;
    const s = String(x).replace("%", "").replace(",", ".").trim();
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

function clampPct(n) {
    const v = parseNum(n);
    if (v === null) return null;
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
}

function scalePctMap(mapObj, totalPct) {
    const t = clampPct(totalPct);
    if (t === null) return null;
    if (!mapObj || typeof mapObj !== "object") return null;

    const factor = t / 100.0;
    const out = {};
    for (const [k, v] of Object.entries(mapObj)) {
        const n = clampPct(v);
        if (n === null) continue;
        const scaled = n * factor;
        if (scaled > 0) out[k] = +scaled.toFixed(4);
    }
    return Object.keys(out).length ? out : null;
}

function derivePrimaryRegion(msRegions) {
    // Helper to extract flat list
    const computeFromObj = (obj) => {
        if (!obj) return null;
        const flat = [];
        for (const [k, v] of Object.entries(obj)) {
            const n = parseNum(v);
            if (n !== null) flat.push({ k, v: n });
        }
        if (!flat.length) return null;

        flat.sort((a, b) => b.v - a.v);
        const top = flat[0];
        const k = top.k.toLowerCase();

        if (k === "eurozone" || k === "europe_ex_euro" || k === "united_kingdom" || k === "europe" || k === "europa") return "Europa";
        if (k === "united_states" || k === "canada" || k === "americas" || k === "north_america") return "USA";
        if (k === "japan" || k === "japón") return "Japón";
        if (k === "asia_emerging" || k === "europe_emerging" || k === "latin_america" || k === "europe_me_africa") return "Emergentes";
        if (k === "developed_asia" || k === "china" || k === "asia" || k === "australasia") return "Asia";
        return null;
    };

    if (msRegions && typeof msRegions === "object") {
        // Prioritize Detail
        if (msRegions.detail) {
            const res = computeFromObj(msRegions.detail);
            if (res) return res;
        }
        // Fallback Macro
        if (msRegions.macro) {
            const res = computeFromObj(msRegions.macro);
            if (res) return res;
        }
    }
    return "Global"; // Default fallback
}

function hasAnyFiniteNumber(obj) {
    if (!obj || typeof obj !== "object") return false;
    return Object.values(obj).some(v => Number.isFinite(parseNum(v)));
}

// 🛡️ LOGIC: "Other" as Remainder
// Ensures consistent behavior with cargador_lotes.js
function sanitizeRegionsBehavior(mapObj) {
    if (!mapObj || typeof mapObj !== "object") return {};

    let currentSum = 0;
    const cleanMap = {};

    // 1. Sum known regions (ignoring "other" explicitly)
    for (const [k, v] of Object.entries(mapObj)) {
        const val = clampPct(v);
        if (val === null || val === 0) continue;
        const key = k.toLowerCase();

        if (key === 'other' || key === 'others' || key === 'otros') {
            continue; // Skip explicit other
        }

        cleanMap[k] = val; // Keep original key (it should be canonical already from migration)
        currentSum += val;
    }

    // 2. Calculate Remainder (Strict)
    if (currentSum > 0.0) {
        const remainder = 100.0 - currentSum;
        // Tolerancia 0.25%
        if (remainder > 0.25) {
            cleanMap["other"] = +remainder.toFixed(4);
        }

        // Warning overflow
        if (currentSum > 101.0) {
            console.warn(`[WARN] Region sum overflow: ${currentSum.toFixed(2)}`);
        }
    } else {
        // Sum == 0. No recognized regions. DO NOT INVENT OTHER=100.
        return {};
    }

    return cleanMap;
}

// ARGS
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT_IDX = args.indexOf("--limit");
const LIMIT = LIMIT_IDX !== -1 ? parseInt(args[LIMIT_IDX + 1]) : 0;

(async () => {
    console.log(`🚀 Starting DERIVED data refresh... (DRY_RUN=${DRY_RUN})`);

    const snapshot = await db.collection("funds_v3").get();
    let processed = 0;
    let updated = 0;

    const batchSize = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        if (LIMIT > 0 && processed >= LIMIT) break;

        const data = doc.data();
        const ms = data.ms || {};
        const derived = data.derived || {};

        // 1. Recalculate Portfolio Exposure
        // --------------------------------
        const equityTotal = clampPct(ms.portfolio?.asset_allocation?.equity);

        // Priority: Detail > Macro (cleaned version)
        const regionsDetail = ms.regions?.detail || null;
        const regionsMacro = ms.regions?.macro || null;

        // If we have detail and it looks valid (sums to something decent), use it
        // Otherwise use macro.
        // If we have detail and it looks valid (sums to something decent), use it
        // Otherwise use macro.
        let regionsSource = regionsDetail;
        if (!hasAnyFiniteNumber(regionsDetail)) {
            regionsSource = regionsMacro;
        }

        // 🛡️ SANITIZE: Enforce "Other = Remainder" behavior
        // This ensures the DB derived data matches the new loader logic
        const sanitizedRegions = sanitizeRegionsBehavior(regionsSource);

        const equity_regions_total = equityTotal !== null
            ? scalePctMap(sanitizedRegions, equityTotal)
            : null;

        // Sectors
        const sectors = ms.sectors || null;
        const equity_sectors_total = equityTotal !== null
            ? scalePctMap(sectors, equityTotal)
            : null;

        // 2. Recalculate Primary Region
        // -----------------------------
        const newPrimaryRegion = derivePrimaryRegion(ms.regions);

        // 3. Compare & Update
        // -------------------
        let needsUpdate = false;

        // Check Primary Region Change
        if (derived.primary_region !== newPrimaryRegion) {
            // console.log(`[${doc.id}] Primary Region: ${derived.primary_region} -> ${newPrimaryRegion}`);
            needsUpdate = true;
        }

        // Check Exposure Change (Deep comparison simplified)
        // We just overwrite if we calculated something valid
        const newExposure = {
            asset_allocation_total: ms.portfolio?.asset_allocation || null,
            equity_sectors_total,
            equity_regions_total
        };

        // Naive JSON stringify comparison to see if meaningful change
        if (JSON.stringify(derived.portfolio_exposure) !== JSON.stringify(newExposure)) {
            // console.log(`[${doc.id}] Exposure updated.`);
            needsUpdate = true;
        }

        if (needsUpdate) {
            updated++;

            if (DRY_RUN) {
                console.log(`[DRY] ${doc.id}: Would update derived.`);
                if (derived.primary_region !== newPrimaryRegion) {
                    console.log(`   -> Region: ${derived.primary_region} => ${newPrimaryRegion}`);
                }
                // Log simplified exposure change
                if (equity_regions_total && equity_regions_total.other !== (derived.portfolio_exposure?.equity_regions_total?.other)) {
                    console.log(`   -> Equity Regions Other: ${derived.portfolio_exposure?.equity_regions_total?.other} => ${equity_regions_total.other}`);
                }
            } else {
                batch.update(doc.ref, {
                    "derived.primary_region": newPrimaryRegion,
                    "derived.portfolio_exposure": newExposure,
                    "quality.derived_refreshed_at": admin.firestore.FieldValue.serverTimestamp()
                });
                batchCount++;
                if (batchCount >= batchSize) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                    process.stdout.write(".");
                }
            }
        }
        processed++;
    }

    if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
    }

    console.log(`\n\n✅ Done. Processed: ${processed}. Updated: ${updated}.`);
})();

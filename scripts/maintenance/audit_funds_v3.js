/**
 * BDB-FONDOS SCRIPT
 *
 * STATUS: ACTIVE
 * CATEGORY: maintenance
 * PURPOSE: Utility script: audit_funds_v3.js
 * SAFE_MODE: REVIEW
 * RUN: node scripts/maintenance/audit_funds_v3.js
 */

#!/usr/bin/env node

/**
 * scripts/audit_funds_v3.js
 *
 * Auditoría rápida de calidad para funds_v3
 *
 * Uso:
 *   node scripts/audit_funds_v3.js
 */

const admin = require("firebase-admin");
const path = require("path");

// ==============================
// Firebase init
// ==============================
try {
  admin.app();
} catch {
  const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, "..", "serviceAccountKey.json");

  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();

// ==============================
// Helpers
// ==============================
function num(x) {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function cleanStr(x) {
  return typeof x === "string" ? x.trim() : "";
}

function isUnknown(x) {
  const v = cleanStr(x).toUpperCase();
  return !v || v === "UNKNOWN" || v === "UNDEFINED" || v === "NULL";
}

function getExposure(doc) {
  const d = doc.derived || {};
  const p = d.portfolio_exposure || doc.portfolio_exposure || {};

  const equity = num(p.equity) ?? 0;
  const bond = num(p.bond) ?? 0;
  const cash = num(p.cash) ?? 0;
  const other = num(p.other) ?? 0;

  return { equity, bond, cash, other, total: equity + bond + cash + other };
}

function classifyExposureBucket(exposure) {
  const { equity, bond, cash, other } = exposure;

  if (equity >= 0.75) return "RV";
  if (bond >= 0.6) return "RF";
  if (cash >= 0.75) return "MONETARIO";
  if (other >= 0.5) return "OTROS";
  if (equity > 0.2 && bond > 0.2) return "MIXTO";
  return "UNKNOWN";
}

function normalizeAssetClass(v) {
  const x = cleanStr(v).toUpperCase();

  if (!x) return "UNKNOWN";

  if (["RV", "RENTA VARIABLE", "EQUITY"].includes(x)) return "RV";
  if (["RF", "RENTA FIJA", "FIXED INCOME", "BOND"].includes(x)) return "RF";
  if (["MIXTO", "ALLOCATION", "MIXED"].includes(x)) return "MIXTO";
  if (["MONETARIO", "MONEY MARKET", "CASH"].includes(x)) return "MONETARIO";
  if (
    ["OTROS", "OTHER", "ALTERNATIVOS", "ALTERNATIVE", "ALTERNATIVES"].includes(
      x
    )
  )
    return "OTROS";

  return x;
}

function subtypeLooksInconsistent(assetClass, subtype) {
  const ac = normalizeAssetClass(assetClass);
  const st = cleanStr(subtype).toUpperCase();

  if (!st || st === "UNKNOWN") return false;

  if (ac === "RV" && st.includes("BOND")) return true;
  if (ac === "RF" && (st.includes("EQUITY") || st.includes("STOCK"))) return true;
  if (ac === "MONETARIO" && !st.includes("MONEY") && !st.includes("CASH")) return false;
  return false;
}

// ==============================
// Main
// ==============================
async function main() {
  console.log("Leyendo funds_v3...\n");

  const snap = await db.collection("funds_v3").get();

  const stats = {
    total: 0,

    unknown_asset_class: 0,
    unknown_asset_subtype: 0,
    missing_region_primary: 0,

    low_confidence: 0,
    not_optimizable: 0,

    exposure_missing: 0,
    exposure_total_invalid: 0,
    exposure_total_gt_105: 0,
    exposure_total_lt_095: 0,

    class_vs_exposure_conflict: 0,
    subtype_conflict: 0,
  };

  const samples = {
    unknown_asset_class: [],
    unknown_asset_subtype: [],
    missing_region_primary: [],
    low_confidence: [],
    exposure_total_invalid: [],
    class_vs_exposure_conflict: [],
    subtype_conflict: [],
  };

  for (const docSnap of snap.docs) {
    stats.total += 1;
    const doc = docSnap.data() || {};

    const isin = cleanStr(doc.isin || doc.ms?.isin || docSnap.id);
    const name = cleanStr(doc.name || doc.ms?.name || "");
    const derived = doc.derived || {};

    const assetClass = derived.asset_class || doc.asset_class || "";
    const assetSubtype = derived.asset_subtype || doc.asset_subtype || "";
    const regionPrimary = derived.primary_region || doc.primary_region || "";

    const confidence =
      num(derived.confidence) ??
      num(doc.classification_v2?.classification_confidence) ??
      null;

    const historyOk =
      doc.data_quality?.history_ok ??
      doc.history_ok ??
      true;

    const exposure = getExposure(doc);
    const exposureBucket = classifyExposureBucket(exposure);
    const normalizedClass = normalizeAssetClass(assetClass);

    if (isUnknown(assetClass)) {
      stats.unknown_asset_class += 1;
      if (samples.unknown_asset_class.length < 15) {
        samples.unknown_asset_class.push({ isin, name, assetClass });
      }
    }

    if (isUnknown(assetSubtype)) {
      stats.unknown_asset_subtype += 1;
      if (samples.unknown_asset_subtype.length < 15) {
        samples.unknown_asset_subtype.push({ isin, name, assetSubtype });
      }
    }

    if (isUnknown(regionPrimary)) {
      stats.missing_region_primary += 1;
      if (samples.missing_region_primary.length < 15) {
        samples.missing_region_primary.push({ isin, name, regionPrimary });
      }
    }

    if (confidence !== null && confidence < 0.5) {
      stats.low_confidence += 1;
      if (samples.low_confidence.length < 15) {
        samples.low_confidence.push({ isin, name, confidence });
      }
    }

    if (historyOk === false) {
      stats.not_optimizable += 1;
    }

    if (exposure.total === 0) {
      stats.exposure_missing += 1;
    }

    if (!Number.isFinite(exposure.total)) {
      stats.exposure_total_invalid += 1;
      if (samples.exposure_total_invalid.length < 15) {
        samples.exposure_total_invalid.push({ isin, name, exposure });
      }
    } else {
      if (exposure.total > 1.05) stats.exposure_total_gt_105 += 1;
      if (exposure.total < 0.95 && exposure.total > 0) stats.exposure_total_lt_095 += 1;
    }

    if (
      normalizedClass !== "UNKNOWN" &&
      exposureBucket !== "UNKNOWN" &&
      normalizedClass !== exposureBucket
    ) {
      stats.class_vs_exposure_conflict += 1;
      if (samples.class_vs_exposure_conflict.length < 15) {
        samples.class_vs_exposure_conflict.push({
          isin,
          name,
          assetClass: normalizedClass,
          exposureBucket,
          exposure,
        });
      }
    }

    if (subtypeLooksInconsistent(assetClass, assetSubtype)) {
      stats.subtype_conflict += 1;
      if (samples.subtype_conflict.length < 15) {
        samples.subtype_conflict.push({
          isin,
          name,
          assetClass,
          assetSubtype,
        });
      }
    }
  }

  // ==============================
  // Report
  // ==============================
  console.log("====================================");
  console.log("AUDIT FUNDS_V3");
  console.log("====================================");
  console.log(`TOTAL FUNDS: ${stats.total}`);
  console.log("");

  console.log("---- CLASIFICACIÓN ----");
  console.log(`UNKNOWN asset_class:          ${stats.unknown_asset_class}`);
  console.log(`UNKNOWN asset_subtype:        ${stats.unknown_asset_subtype}`);
  console.log(`MISSING primary_region:       ${stats.missing_region_primary}`);
  console.log(`LOW confidence (<0.50):       ${stats.low_confidence}`);
  console.log(`NOT optimizable:              ${stats.not_optimizable}`);
  console.log("");

  console.log("---- EXPOSICIONES ----");
  console.log(`Exposure missing (=0):        ${stats.exposure_missing}`);
  console.log(`Exposure invalid:             ${stats.exposure_total_invalid}`);
  console.log(`Exposure total > 1.05:        ${stats.exposure_total_gt_105}`);
  console.log(`Exposure total < 0.95:        ${stats.exposure_total_lt_095}`);
  console.log("");

  console.log("---- CONFLICTOS ----");
  console.log(`Class vs exposure conflict:   ${stats.class_vs_exposure_conflict}`);
  console.log(`Subtype conflict:             ${stats.subtype_conflict}`);
  console.log("");

  function printSamples(title, arr) {
    if (!arr.length) return;
    console.log(`\n${title}`);
    console.log("-".repeat(title.length));
    for (const row of arr) {
      console.log(JSON.stringify(row));
    }
  }

  printSamples("Muestras UNKNOWN asset_class", samples.unknown_asset_class);
  printSamples("Muestras UNKNOWN asset_subtype", samples.unknown_asset_subtype);
  printSamples("Muestras missing region_primary", samples.missing_region_primary);
  printSamples("Muestras low confidence", samples.low_confidence);
  printSamples("Muestras exposure invalid", samples.exposure_total_invalid);
  printSamples(
    "Muestras class vs exposure conflict",
    samples.class_vs_exposure_conflict
  );
  printSamples("Muestras subtype conflict", samples.subtype_conflict);

  console.log("\nAudit completado.");
}

main().catch((err) => {
  console.error("Error en audit_funds_v3:", err);
  process.exit(1);
});
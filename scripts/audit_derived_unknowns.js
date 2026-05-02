/**
 * Audita funds_v3 para detectar:
 * 1) derived.asset_subtype = UNKNOWN
 * 2) incoherencias asset_class / asset_subtype
 *
 * Uso:
 *   node audit_derived_unknowns.js
 *   node audit_derived_unknowns.js --limit 200
 *   node audit_derived_unknowns.js --csv
 *
 * Requisitos:
 *   npm i firebase-admin dotenv
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// -----------------------------
// Args
// -----------------------------
function getArgValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}
function hasFlag(flag) {
  return process.argv.includes(flag);
}

const LIMIT = getArgValue("--limit") ? parseInt(getArgValue("--limit"), 10) : null;
const EXPORT_CSV = hasFlag("--csv");

// -----------------------------
// Firebase Admin init
// -----------------------------
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
  console.error(`❌ Falta ${SERVICE_ACCOUNT_FILE}`);
  process.exit(1);
}

if (!admin.apps.length) {
  const serviceAccount = require(SERVICE_ACCOUNT_FILE);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  console.log(`🔑 Firebase Admin OK: ${serviceAccount.project_id}`);
}

const db = admin.firestore();

// -----------------------------
// Rules
// -----------------------------
const VALID_SUBTYPES_BY_CLASS = {
  RV: new Set([
    "GLOBAL_EQUITY",
    "US_EQUITY",
    "EUROPE_EQUITY",
    "EUROZONE_EQUITY",
    "JAPAN_EQUITY",
    "ASIA_PACIFIC_EQUITY",
    "EMERGING_MARKETS_EQUITY",
    "GLOBAL_SMALL_CAP_EQUITY",
    "GLOBAL_INCOME_EQUITY",
    "SECTOR_EQUITY_TECH",
    "SECTOR_EQUITY_HEALTHCARE",
    "THEMATIC_EQUITY",
  ]),

  RF: new Set([
    "CORPORATE_BOND",
    "GOVERNMENT_BOND",
    "HIGH_YIELD_BOND",
    "EMERGING_MARKETS_BOND",
    "INFLATION_LINKED_BOND",
    "CONVERTIBLE_BOND",
  ]),

  Mixto: new Set([
    "FLEXIBLE_ALLOCATION",
  ]),

  Alternativos: new Set([
    // si luego quieres afinar, aquí puedes meter subtipos alternativos reales
    // por ahora dejamos vacío para detectar cualquier equity subtype como incoherente
  ]),

  Monetario: new Set([
    // idem: puedes añadir "MONEY_MARKET" si lo incorporas como subtype
  ]),

  Inmobiliario: new Set([
    // por ahora vacío a propósito
  ]),

  Commodities: new Set([
    // por ahora vacío a propósito
  ]),

  Otros: new Set([
    "UNKNOWN",
  ]),
};

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function isUnknownSubtype(subtype) {
  return !subtype || subtype === "UNKNOWN";
}

function isInconsistent(assetClass, assetSubtype) {
  if (!assetClass || !assetSubtype) return false;

  const valid = VALID_SUBTYPES_BY_CLASS[assetClass];
  if (!valid) return false;

  if (assetSubtype === "UNKNOWN") return false;

  return !valid.has(assetSubtype);
}

function explainInconsistency(assetClass, assetSubtype) {
  if (assetClass === "Alternativos" && assetSubtype.includes("EQUITY")) {
    return "Alternativos con subtipo de equity";
  }
  if (assetClass === "Mixto" && assetSubtype !== "FLEXIBLE_ALLOCATION") {
    return "Mixto con subtipo no-mixto";
  }
  if (assetClass === "RF" && assetSubtype.includes("EQUITY")) {
    return "Renta fija con subtipo de equity";
  }
  if (assetClass === "RV" && assetSubtype.includes("BOND")) {
    return "Renta variable con subtipo de renta fija";
  }
  if (assetClass === "Monetario" && assetSubtype !== "UNKNOWN") {
    return "Monetario con subtipo no monetario";
  }
  return "Incoherencia asset_class / asset_subtype";
}

// -----------------------------
// Main
// -----------------------------
(async () => {
  console.log("🔎 Auditando derived.* en funds_v3...");

  let query = db.collection("funds_v3").orderBy(admin.firestore.FieldPath.documentId());
  if (LIMIT && Number.isFinite(LIMIT)) query = query.limit(LIMIT);

  const snap = await query.get();
  if (snap.empty) {
    console.log("ℹ️ No hay documentos.");
    process.exit(0);
  }

  const unknowns = [];
  const inconsistents = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const isin = docSnap.id;

    const name = data.name || "";
    const msCategory = data.ms?.category_morningstar || "";
    const assetClass = data.derived?.asset_class || "";
    const assetSubtype = data.derived?.asset_subtype || "";
    const primaryRegion = data.derived?.primary_region || "";
    const confidence = data.derived?.confidence ?? null;

    const row = {
      isin,
      name,
      ms_category_morningstar: msCategory,
      asset_class: assetClass,
      asset_subtype: assetSubtype,
      primary_region: primaryRegion,
      confidence,
    };

    if (isUnknownSubtype(assetSubtype)) {
      unknowns.push(row);
    }

    if (isInconsistent(assetClass, assetSubtype)) {
      inconsistents.push({
        ...row,
        reason: explainInconsistency(assetClass, assetSubtype),
      });
    }
  }

  console.log("");
  console.log(`✅ Total revisados: ${snap.size}`);
  console.log(`⚠️ subtype UNKNOWN: ${unknowns.length}`);
  console.log(`⚠️ incoherencias class/subtype: ${inconsistents.length}`);
  console.log("");

  if (unknowns.length) {
    console.log("=== TOP UNKNOWN ===");
    unknowns.slice(0, 50).forEach((r) => {
      console.log(
        `${r.isin} | ${r.asset_class || "?"} / ${r.asset_subtype || "?"} / ${r.primary_region || "?"} | ${r.name}`
      );
    });
    console.log("");
  }

  if (inconsistents.length) {
    console.log("=== TOP INCOHERENCIAS ===");
    inconsistents.slice(0, 50).forEach((r) => {
      console.log(
        `${r.isin} | ${r.asset_class} / ${r.asset_subtype} | ${r.reason} | ${r.name}`
      );
    });
    console.log("");
  }

  if (EXPORT_CSV) {
    const outDir = __dirname;

    const unknownCsvPath = path.join(outDir, "audit_unknown_subtypes.csv");
    const inconsistentCsvPath = path.join(outDir, "audit_inconsistent_derived.csv");

    const unknownHeader = [
      "isin",
      "name",
      "ms_category_morningstar",
      "asset_class",
      "asset_subtype",
      "primary_region",
      "confidence",
    ];

    const inconsistentHeader = [
      "isin",
      "name",
      "ms_category_morningstar",
      "asset_class",
      "asset_subtype",
      "primary_region",
      "confidence",
      "reason",
    ];

    const unknownCsv = [
      unknownHeader.join(","),
      ...unknowns.map((r) =>
        unknownHeader.map((k) => csvEscape(r[k])).join(",")
      ),
    ].join("\n");

    const inconsistentCsv = [
      inconsistentHeader.join(","),
      ...inconsistents.map((r) =>
        inconsistentHeader.map((k) => csvEscape(r[k])).join(",")
      ),
    ].join("\n");

    fs.writeFileSync(unknownCsvPath, unknownCsv, "utf8");
    fs.writeFileSync(inconsistentCsvPath, inconsistentCsv, "utf8");

    console.log(`📄 CSV generado: ${unknownCsvPath}`);
    console.log(`📄 CSV generado: ${inconsistentCsvPath}`);
  }

  process.exit(0);
})().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});
/**
 * backfill_asset_class_fill_only_v1.js
 *
 * SOLO RELLENA derived.asset_class SI NO EXISTE (null/undefined/"").
 * No modifica fondos ya clasificados.
 *
 * Prioridad:
 * 0) Real assets override (inmobiliario/oro/commodities) -> Otros + detail
 * 1) Allocation (si existe)
 * 2) Category Morningstar fallback
 * 3) Fallback -> Otros
 *
 * Uso:
 *   node backfill_asset_class_fill_only_v1.js --dry-run
 *   node backfill_asset_class_fill_only_v1.js --apply
 *
 * Auth:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\bdb-fondos-sa.json"
 *   $env:FIREBASE_PROJECT_ID="bdb-fondos"
 */

const admin = require("firebase-admin");
const minimist = require("minimist");
const fs = require("fs");
const path = require("path");

const RULESET_VERSION = "assetclass_fill_only_v1";
const COLLECTION = "funds_v3";
const BATCH_SIZE = 400;

function nowIso() {
  return new Date().toISOString();
}

function toNum(x) {
  const n = typeof x === "number" ? x : parseFloat(String(x));
  return Number.isFinite(n) ? n : null;
}

function finiteOr0(x) {
  return Number.isFinite(x) ? x : 0;
}

function lc(s) {
  return (s ?? "").toString().toLowerCase();
}

function hasAny(text, needles) {
  const t = lc(text);
  return needles.some((k) => t.includes(k));
}

function mergeWarnings(existing, add) {
  const a = Array.isArray(existing) ? existing : [];
  const set = new Set(a.map(String));
  for (const w of add) set.add(String(w));
  return Array.from(set);
}

function getCategory(fund) {
  return (
    fund?.category_morningstar ??
    fund?.ms?.category_morningstar ??
    fund?.ms?.category ??
    ""
  );
}

function isMissingAssetClass(v) {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" || s.toLowerCase() === "undefined";
}

/**
 * OVERRIDE: Real assets => Otros + detail
 */
function detectRealAssetsOverride(fund) {
  const category = lc(getCategory(fund));
  const name = lc(fund?.name);

  const isRealEstate =
    hasAny(category, ["inmobili", "real estate", "property", "reit", "realty", "socimi"]) ||
    hasAny(name, ["inmobili", "real estate", "reit", "socimi"]);
  if (isRealEstate) {
    return {
      assetClass: "Otros",
      detail: "Inmobiliario",
      confidence: 0.90,
      method: "override_real_assets",
      rationale: "real estate detected (category/name)",
    };
  }

  const isGold =
    hasAny(category, ["oro", "gold", "xau"]) ||
    hasAny(name, ["oro", "gold", "xau"]);
  if (isGold) {
    return {
      assetClass: "Otros",
      detail: "Oro",
      confidence: 0.88,
      method: "override_real_assets",
      rationale: "gold detected (category/name)",
    };
  }

  const isCommodities =
    hasAny(category, ["commodit", "materias primas", "metals", "energy", "oil", "brent", "crude", "agriculture"]) ||
    hasAny(name, ["commodit", "materias primas", "metals", "energy", "oil", "brent", "crude", "agriculture"]);
  if (isCommodities) {
    return {
      assetClass: "Otros",
      detail: "Commodities",
      confidence: 0.85,
      method: "override_real_assets",
      rationale: "commodities detected (category/name)",
    };
  }

  return null;
}

/**
 * Allocation classifier (conservador)
 */
function classifyByAllocation(aa) {
  const eq = toNum(aa?.equity);
  const bd = toNum(aa?.bond);
  const cs = toNum(aa?.cash);
  const ot = toNum(aa?.other);

  const anyFinite =
    Number.isFinite(eq) || Number.isFinite(bd) || Number.isFinite(cs) || Number.isFinite(ot);
  if (!anyFinite) return null;

  const EQ = finiteOr0(eq);
  const BD = finiteOr0(bd);
  const CS = finiteOr0(cs);
  const OT = finiteOr0(ot);

  if (CS >= 60) {
    return { assetClass: "Monetario", confidence: 0.82, method: "allocation", rationale: `cash>=60 (cash=${CS})`, inputs: { bond: BD, equity: EQ, cash: CS, other: OT }, lowConfidence: false };
  }
  if (EQ >= 60 && EQ >= BD + 10) {
    return { assetClass: "RV", confidence: 0.88, method: "allocation", rationale: `equity>=60 & eq>=bond+10 (eq=${EQ}, bond=${BD})`, inputs: { bond: BD, equity: EQ, cash: CS, other: OT }, lowConfidence: false };
  }
  if (BD >= 60 && BD >= EQ + 10) {
    return { assetClass: "RF", confidence: 0.88, method: "allocation", rationale: `bond>=60 & bond>=eq+10 (bond=${BD}, eq=${EQ})`, inputs: { bond: BD, equity: EQ, cash: CS, other: OT }, lowConfidence: false };
  }
  if (EQ >= 20 && BD >= 20) {
    return { assetClass: "Mixto", confidence: 0.78, method: "allocation", rationale: `eq>=20 & bond>=20 (eq=${EQ}, bond=${BD})`, inputs: { bond: BD, equity: EQ, cash: CS, other: OT }, lowConfidence: false };
  }

  // Si no encaja, elegimos el dominante pero baja confianza
  const max = Math.max(EQ, BD, CS, OT);
  if (max === BD) return { assetClass: "RF", confidence: 0.60, method: "allocation", rationale: "majority bond (low conf)", inputs: { bond: BD, equity: EQ, cash: CS, other: OT }, lowConfidence: true };
  if (max === EQ) return { assetClass: "RV", confidence: 0.60, method: "allocation", rationale: "majority equity (low conf)", inputs: { bond: BD, equity: EQ, cash: CS, other: OT }, lowConfidence: true };
  if (max === CS) return { assetClass: "Monetario", confidence: 0.60, method: "allocation", rationale: "majority cash (low conf)", inputs: { bond: BD, equity: EQ, cash: CS, other: OT }, lowConfidence: true };
  return { assetClass: "Otros", confidence: 0.58, method: "allocation", rationale: "majority other (low conf)", inputs: { bond: BD, equity: EQ, cash: CS, other: OT }, lowConfidence: true };
}

/**
 * Category fallback (muy simple)
 */
function classifyByCategoryFallback(categoryMorningstar) {
  const catRaw = (categoryMorningstar ?? "").toString().trim();
  if (!catRaw) return null;

  const up = catRaw.toUpperCase();
  if (up.startsWith("RF") || up.includes("RENTA FIJA")) return { assetClass: "RF", confidence: 0.72, method: "category", rationale: `category=>RF (${catRaw})`, inputs: { category: catRaw }, lowConfidence: true };
  if (up.startsWith("RV") || up.includes("RENTA VARIABLE")) return { assetClass: "RV", confidence: 0.72, method: "category", rationale: `category=>RV (${catRaw})`, inputs: { category: catRaw }, lowConfidence: true };
  if (up.startsWith("MONETARIO") || up.includes("MONEY MARKET")) return { assetClass: "Monetario", confidence: 0.75, method: "category", rationale: `category=>Monetario (${catRaw})`, inputs: { category: catRaw }, lowConfidence: true };
  if (up.startsWith("MIXTO") || up.includes("ALLOCATION") || up.includes("BALANCED") || up.includes("MULTI-ASSET")) return { assetClass: "Mixto", confidence: 0.70, method: "category", rationale: `category=>Mixto (${catRaw})`, inputs: { category: catRaw }, lowConfidence: true };

  return { assetClass: "Otros", confidence: 0.60, method: "category", rationale: `category no match=>Otros (${catRaw})`, inputs: { category: catRaw }, lowConfidence: true };
}

function decideFillAssetClass(fund) {
  const category = getCategory(fund);
  const name = fund?.name ?? "";
  const alloc = fund?.portfolio?.asset_allocation ?? null;

  // 0) Real assets override
  const ovr = detectRealAssetsOverride(fund);
  if (ovr) {
    return {
      assetClass: ovr.assetClass,
      assetClassDetail: ovr.detail,
      confidence: ovr.confidence,
      method: ovr.method,
      rationale: ovr.rationale,
      inputs: { category, name, allocation: alloc },
      warnings: ["BACKFILL_ASSET_CLASS", "REAL_ASSET_OVERRIDE"],
    };
  }

  // 1) Allocation
  const byAlloc = classifyByAllocation(alloc);
  if (byAlloc) {
    const warnings = ["BACKFILL_ASSET_CLASS"];
    if (byAlloc.lowConfidence) warnings.push("LOW_CONFIDENCE_ASSET_CLASS");
    return {
      assetClass: byAlloc.assetClass,
      assetClassDetail: null,
      confidence: byAlloc.confidence,
      method: byAlloc.method,
      rationale: byAlloc.rationale,
      inputs: { ...byAlloc.inputs, category, name },
      warnings,
    };
  }

  // 2) Category fallback
  const byCat = classifyByCategoryFallback(category);
  if (byCat) {
    const warnings = ["BACKFILL_ASSET_CLASS", "CATEGORY_FALLBACK"];
    if (byCat.lowConfidence) warnings.push("LOW_CONFIDENCE_ASSET_CLASS");
    return {
      assetClass: byCat.assetClass,
      assetClassDetail: null,
      confidence: byCat.confidence,
      method: byCat.method,
      rationale: byCat.rationale,
      inputs: { category, name },
      warnings,
    };
  }

  // 3) Final
  return {
    assetClass: "Otros",
    assetClassDetail: null,
    confidence: 0.50,
    method: "fallback",
    rationale: "no signals => Otros",
    inputs: { category, name, allocation: alloc },
    warnings: ["BACKFILL_ASSET_CLASS", "LOW_CONFIDENCE_ASSET_CLASS"],
  };
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ["dry-run", "apply"],
    default: { limit: 0 },
  });

  const isDryRun = !!argv["dry-run"];
  const isApply = !!argv["apply"];
  const limit = Number(argv["limit"] || 0);

  if (!isDryRun && !isApply) {
    console.error("Usa --dry-run o --apply");
    process.exit(1);
  }
  if (isDryRun && isApply) {
    console.error("Elige solo uno: --dry-run o --apply");
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Falta FIREBASE_PROJECT_ID (ej: $env:FIREBASE_PROJECT_ID='bdb-fondos').");
  }

  if (!admin.apps.length) {
    const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (saPath) {
      if (!fs.existsSync(saPath)) throw new Error(`GOOGLE_APPLICATION_CREDENTIALS no existe: ${saPath}`);
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"));
      admin.initializeApp({ projectId, credential: admin.credential.cert(serviceAccount) });
    } else {
      admin.initializeApp({ projectId, credential: admin.credential.applicationDefault() });
    }
  }

  const db = admin.firestore();
  const runAt = nowIso();

  console.log(`[${runAt}] Starting. mode=${isDryRun ? "DRY_RUN" : "APPLY"} collection=${COLLECTION} limit=${limit || "ALL"}`);

  let q = db.collection(COLLECTION);
  if (limit && limit > 0) q = q.limit(limit);

  const snap = await q.get();
  console.log(`[${nowIso()}] Fetched docs: ${snap.size}`);

  const report = {
    ruleset_version: RULESET_VERSION,
    mode: isDryRun ? "DRY_RUN" : "APPLY",
    collection: COLLECTION,
    scanned: snap.size,
    filled: 0,
    skipped_existing: 0,
    errors: 0,
    started_at: runAt,
    finished_at: null,
    items: [],
  };

  let batch = db.batch();
  let batchCount = 0;
  let committedBatches = 0;

  for (const doc of snap.docs) {
    try {
      const fund = doc.data() || {};
      const isin = doc.id;

      const before = fund?.derived?.asset_class ?? null;
      const beforeDetail = fund?.derived?.asset_class_detail ?? null;

      // ✅ SOLO RELLENO SI FALTA
      if (!isMissingAssetClass(before)) {
        report.skipped_existing += 1;
        continue;
      }

      const result = decideFillAssetClass(fund);
      const after = result.assetClass;
      const afterDetail = result.assetClassDetail ?? null;
      const finalDetail = afterDetail ?? (fund?.derived?.asset_class_detail ?? null);

      report.filled += 1;

      const nextDerived = {
        ...(fund.derived || {}),
        asset_class: after,
        asset_class_detail: finalDetail,
        ruleset_version: RULESET_VERSION,
        confidence: result.confidence,
        source: {
          method: result.method,
          rationale: result.rationale,
          inputs: result.inputs,
          computed_at: runAt,
        },
      };

      const nextQuality = {
        ...(fund.quality || {}),
        warnings: mergeWarnings(fund?.quality?.warnings, result.warnings),
      };

      report.items.push({
        isin,
        name: fund?.name ?? null,
        category_morningstar: getCategory(fund) || null,
        before_asset_class: before,
        after_asset_class: after,
        before_asset_class_detail: beforeDetail,
        after_asset_class_detail: finalDetail,
        confidence: result.confidence,
        method: result.method,
        rationale: result.rationale,
        warnings_added: result.warnings,
      });

      if (isApply) {
        batch.update(doc.ref, {
          derived: nextDerived,
          quality: nextQuality,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        batchCount += 1;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          committedBatches += 1;
          console.log(`[${nowIso()}] Committed batch #${committedBatches} (${batchCount} writes)`);
          batch = db.batch();
          batchCount = 0;
        }
      }
    } catch (e) {
      report.errors += 1;
      report.items.push({ isin: doc.id, error: String(e?.message || e) });
    }
  }

  if (isApply && batchCount > 0) {
    await batch.commit();
    committedBatches += 1;
    console.log(`[${nowIso()}] Committed final batch #${committedBatches} (${batchCount} writes)`);
  }

  report.finished_at = nowIso();

  const outName = `assetclass_backfill_${RULESET_VERSION}_${isDryRun ? "DRY_RUN" : "APPLY"}.json`;
  const outPath = path.join(process.cwd(), outName);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(`[${nowIso()}] Done.`);
  console.log(`filled=${report.filled} skipped_existing=${report.skipped_existing} errors=${report.errors}`);
  console.log(`Report: ${outPath}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

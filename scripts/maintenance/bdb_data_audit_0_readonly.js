/**
 * BDB-DATA-AUDIT-0 — Comprehensive read-only audit of funds_v3
 *
 * STATUS: ACTIVE
 * CATEGORY: audit
 * PURPOSE: Full data-quality audit of the real funds_v3 collection.
 * SAFE_MODE: READONLY — zero writes, zero deletes, zero updates.
 * RUN: node scripts/maintenance/bdb_data_audit_0_readonly.js
 *
 * OUTPUTS:
 *   artifacts/bdb_data_audit/funds_v3_data_audit_readonly.json
 *   artifacts/bdb_data_audit/funds_v3_data_audit_summary.csv
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// =====================================================================
// Firebase init — uses gcloud ADC, never writes
// =====================================================================
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      "bdb-fondos",
  });
}

const db = admin.firestore();

// =====================================================================
// Helpers
// =====================================================================
function num(x) {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

function cleanStr(x) {
  return typeof x === "string" ? x.trim() : "";
}

function isBlank(x) {
  const v = cleanStr(x).toUpperCase();
  return !v || v === "UNKNOWN" || v === "UNDEFINED" || v === "NULL";
}

function normalizeAssetType(v) {
  const x = cleanStr(v).toUpperCase();
  if (!x) return "UNKNOWN";
  if (["RV", "RENTA VARIABLE", "EQUITY"].includes(x)) return "EQUITY";
  if (["RF", "RENTA FIJA", "FIXED INCOME", "FIXED_INCOME", "BOND"].includes(x)) return "FIXED_INCOME";
  if (["MIXTO", "ALLOCATION", "MIXED"].includes(x)) return "MIXED";
  if (["MONETARIO", "MONEY MARKET", "MONEY_MARKET", "CASH"].includes(x)) return "MONEY_MARKET";
  if (["OTROS", "OTHER", "ALTERNATIVOS", "ALTERNATIVE", "ALTERNATIVES"].includes(x)) return "ALTERNATIVE";
  if (["CONVERTIBLE", "CONVERTIBLES"].includes(x)) return "CONVERTIBLE";
  return x;
}

function detectScale(values) {
  const clean = values.filter(v => v !== null && v !== undefined);
  if (clean.length === 0) return "EMPTY";
  const maxVal = Math.max(...clean);
  const sum = clean.reduce((a, b) => a + b, 0);
  if (maxVal > 1.5 && maxVal <= 100) return "0-100";
  if (maxVal >= 0 && maxVal <= 1.0) return "0-1";
  if (maxVal > 100) return "INVALID";
  return "AMBIGUOUS";
}

// =====================================================================
// Main audit
// =====================================================================
async function main() {
  console.log("BDB-DATA-AUDIT-0 — READ-ONLY funds_v3 audit (v2)");
  console.log("==================================================\n");

  const snap = await db.collection("funds_v3").get();
  console.log(`Total documents: ${snap.size}\n`);

  const issues = [];
  const fundSummaries = [];

  const counters = {
    total: 0,
    has_classification_v2: 0,
    has_portfolio_exposure_v2: 0,
    has_asset_mix: 0,
    has_economic_exposure: 0,
    has_both_mix_and_eco: 0,
    has_only_eco_no_mix: 0,
    has_ms: 0,
    has_derived: 0,
    has_manual: 0,
    has_retrocession_field: 0,
    retrocession_zero: 0,
    retrocession_nonzero: 0,
    retrocession_null: 0,
    // asset_mix scale
    mix_scale_0_1: 0,
    mix_scale_0_100: 0,
    mix_scale_ambiguous: 0,
    mix_scale_empty: 0,
    // economic_exposure scale
    eco_scale_0_1: 0,
    eco_scale_0_100: 0,
    eco_scale_ambiguous: 0,
    eco_scale_empty: 0,
    // cross-scale
    mixed_scale_between_mix_and_eco: 0,
    // classification
    cv2_asset_type_blank: 0,
  };

  for (const docSnap of snap.docs) {
    counters.total++;
    const d = docSnap.data() || {};
    const isin = docSnap.id;
    const name = cleanStr(d.name || d.classification_v2?.raw_name || "");

    // ===================== 1. IDENTITY / STRUCTURE =====================
    const cv2 = d.classification_v2 || null;
    const pev2 = d.portfolio_exposure_v2 || null;
    const ms = d.ms || null;
    const derived = d.derived || null;
    const manual = d.manual || null;

    if (cv2) counters.has_classification_v2++;
    if (pev2) counters.has_portfolio_exposure_v2++;
    if (ms) counters.has_ms++;
    if (derived) counters.has_derived++;
    if (manual) counters.has_manual++;

    const assetType = cleanStr(cv2?.asset_type || "");
    const assetSubtype = cleanStr(cv2?.asset_subtype || "");
    const riskBucket = cleanStr(cv2?.risk_bucket || "");
    const confidence = num(cv2?.classification_confidence);
    const normType = normalizeAssetType(assetType);

    if (isBlank(assetType)) counters.cv2_asset_type_blank++;

    // ===================== 2. EXPOSURE ANALYSIS =====================
    // The real structure has TWO exposure maps:
    //   pev2.asset_mix      — typically 0-1 scale
    //   pev2.economic_exposure — typically 0-100 scale
    const assetMix = pev2?.asset_mix || null;
    const econExpo = pev2?.economic_exposure || null;

    let hasAssetMix = false;
    let hasEconExpo = false;
    let mixEquity = null, mixBond = null, mixCash = null, mixOther = null;
    let ecoEquity = null, ecoBond = null, ecoCash = null, ecoOther = null;
    let mixScale = "NONE", ecoScale = "NONE";
    let mixSum = null, ecoSum = null;

    if (assetMix && typeof assetMix === "object") {
      hasAssetMix = true;
      counters.has_asset_mix++;
      mixEquity = num(assetMix.equity);
      mixBond = num(assetMix.bond ?? assetMix.fixed_income);
      mixCash = num(assetMix.cash);
      mixOther = num(assetMix.other);
      const mixVals = [mixEquity, mixBond, mixCash, mixOther].filter(v => v !== null);
      mixScale = detectScale(mixVals);
      mixSum = mixVals.length > 0 ? mixVals.reduce((a, b) => a + b, 0) : null;

      if (mixScale === "EMPTY") { counters.mix_scale_empty++; }
      else if (mixScale === "0-1") { counters.mix_scale_0_1++; }
      else if (mixScale === "0-100") { counters.mix_scale_0_100++; }
      else { counters.mix_scale_ambiguous++; }
    }

    if (econExpo && typeof econExpo === "object") {
      hasEconExpo = true;
      counters.has_economic_exposure++;
      ecoEquity = num(econExpo.equity);
      ecoBond = num(econExpo.bond ?? econExpo.fixed_income);
      ecoCash = num(econExpo.cash);
      ecoOther = num(econExpo.other);
      const ecoVals = [ecoEquity, ecoBond, ecoCash, ecoOther].filter(v => v !== null);
      ecoScale = detectScale(ecoVals);
      ecoSum = ecoVals.length > 0 ? ecoVals.reduce((a, b) => a + b, 0) : null;

      if (ecoScale === "EMPTY") { counters.eco_scale_empty++; }
      else if (ecoScale === "0-1") { counters.eco_scale_0_1++; }
      else if (ecoScale === "0-100") { counters.eco_scale_0_100++; }
      else { counters.eco_scale_ambiguous++; }
    }

    if (hasAssetMix && hasEconExpo) {
      counters.has_both_mix_and_eco++;
      // Check for cross-scale inconsistency
      if (mixScale !== "NONE" && ecoScale !== "NONE" &&
          mixScale !== "EMPTY" && ecoScale !== "EMPTY" &&
          mixScale !== ecoScale) {
        counters.mixed_scale_between_mix_and_eco++;
        issues.push({
          isin, name, severity: "BLOCKER",
          category: "EXPOSURE_SCALE_AMBIGUOUS",
          detail: `asset_mix scale=${mixScale} (sum=${mixSum?.toFixed(4)}) vs economic_exposure scale=${ecoScale} (sum=${ecoSum?.toFixed(4)})`,
        });
      }
    }

    if (!hasAssetMix && hasEconExpo) {
      counters.has_only_eco_no_mix++;
    }

    // Missing exposure entirely
    if (!hasAssetMix && !hasEconExpo) {
      issues.push({
        isin, name, severity: "HIGH",
        category: "MISSING_PORTFOLIO_EXPOSURE_V2",
        detail: `No asset_mix and no economic_exposure in portfolio_exposure_v2`,
      });
    } else if (!hasAssetMix && hasEconExpo) {
      // Has eco but no mix — optimizer uses which one? Flag it.
      // This is still usable but worth noting
    }

    // Negative values in exposure
    const allExpoVals = [mixEquity, mixBond, mixCash, mixOther, ecoEquity, ecoBond, ecoCash, ecoOther].filter(v => v !== null);
    if (allExpoVals.some(v => v < 0)) {
      issues.push({
        isin, name, severity: "HIGH",
        category: "NEGATIVE_EXPOSURE",
        detail: `Negative: mix=[${mixEquity},${mixBond},${mixCash},${mixOther}] eco=[${ecoEquity},${ecoBond},${ecoCash},${ecoOther}]`,
      });
    }

    // Sum checks for asset_mix
    if (hasAssetMix && mixSum !== null && mixScale !== "EMPTY") {
      const expectedMix = mixScale === "0-100" ? 100 : 1.0;
      const tolMix = mixScale === "0-100" ? 5 : 0.05;
      if (mixSum > 0 && (mixSum < expectedMix - tolMix || mixSum > expectedMix + tolMix)) {
        issues.push({
          isin, name, severity: "MEDIUM",
          category: "EXPOSURE_SUM_OUT_OF_RANGE",
          detail: `asset_mix sum=${mixSum.toFixed(4)}, expected ~${expectedMix} (scale=${mixScale})`,
        });
      }
    }

    // Sum checks for economic_exposure
    if (hasEconExpo && ecoSum !== null && ecoScale !== "EMPTY") {
      const expectedEco = ecoScale === "0-100" ? 100 : 1.0;
      const tolEco = ecoScale === "0-100" ? 5 : 0.05;
      if (ecoSum > 0 && (ecoSum < expectedEco - tolEco || ecoSum > expectedEco + tolEco)) {
        issues.push({
          isin, name, severity: "MEDIUM",
          category: "EXPOSURE_SUM_OUT_OF_RANGE",
          detail: `economic_exposure sum=${ecoSum.toFixed(4)}, expected ~${expectedEco} (scale=${ecoScale})`,
        });
      }
    }

    // ===================== 3. CLASSIFICATION vs EXPOSURE =====================
    // Use economic_exposure (0-100) for comparison since it's the canonical one
    if (hasEconExpo && ecoScale === "0-100" && normType !== "UNKNOWN") {
      const eq = ecoEquity || 0;
      const bd = ecoBond || 0;
      const cs = ecoCash || 0;

      if (normType === "EQUITY" && eq < 40) {
        issues.push({
          isin, name, severity: "HIGH",
          category: "CLASSIFICATION_EXPOSURE_MISMATCH",
          detail: `EQUITY but economic equity=${eq}%`,
        });
      }
      if (normType === "FIXED_INCOME" && bd < 40) {
        issues.push({
          isin, name, severity: "HIGH",
          category: "CLASSIFICATION_EXPOSURE_MISMATCH",
          detail: `FIXED_INCOME but economic bond=${bd}%`,
        });
      }
      if (normType === "MONEY_MARKET" && cs < 40) {
        issues.push({
          isin, name, severity: "MEDIUM",
          category: "CLASSIFICATION_EXPOSURE_MISMATCH",
          detail: `MONEY_MARKET but economic cash=${cs}%`,
        });
      }
    }

    // Mixed fund without lookthrough
    if (normType === "MIXED" && !hasAssetMix && !hasEconExpo) {
      issues.push({
        isin, name, severity: "MEDIUM",
        category: "MIXED_FUND_WITHOUT_LOOKTHROUGH",
        detail: `Mixed fund with no exposure data at all`,
      });
    }

    // ===================== 4. MS DATA =====================
    if (!ms) {
      issues.push({
        isin, name, severity: "LOW",
        category: "MISSING_MS_DATA",
        detail: `No ms (Morningstar) sub-document`,
      });
    }

    // ===================== 5. DERIVED =====================
    if (derived && cv2) {
      const dAssetClass = cleanStr(derived.asset_class || "");
      if (!isBlank(dAssetClass) && !isBlank(assetType)) {
        const normDerived = normalizeAssetType(dAssetClass);
        if (normDerived !== normType && normDerived !== "UNKNOWN") {
          issues.push({
            isin, name, severity: "MEDIUM",
            category: "DERIVED_FIELD_STALE",
            detail: `derived.asset_class="${dAssetClass}" vs cv2.asset_type="${assetType}"`,
          });
        }
      }
    }

    // ===================== 6. RETROCESSION =====================
    const retro = manual?.costs?.retrocession;
    if (retro === undefined || retro === null) {
      counters.retrocession_null++;
    } else {
      counters.has_retrocession_field++;
      if (retro === 0) {
        counters.retrocession_zero++;
      } else {
        counters.retrocession_nonzero++;
        if (retro < 0 || retro > 1) {
          issues.push({
            isin, name, severity: "MEDIUM",
            category: "MANUAL_RETROCESSION_CONFLICT",
            detail: `Retrocession value ${retro} out of expected range [0, 1]`,
          });
        }
      }
    }

    // ===================== 7. OPTIMIZER RISK =====================
    if (!cv2) {
      issues.push({
        isin, name, severity: "HIGH",
        category: "OPTIMIZER_RISK_DATA_GAP",
        detail: `No classification_v2 — cannot classify for suitability`,
      });
    } else if (isBlank(assetType)) {
      issues.push({
        isin, name, severity: "HIGH",
        category: "OPTIMIZER_RISK_DATA_GAP",
        detail: `cv2.asset_type is blank/unknown`,
      });
    }

    // ISIN validity
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
      issues.push({
        isin, name, severity: "LOW",
        category: "DUPLICATE_OR_INVALID_ISIN",
        detail: `Document ID "${isin}" does not match standard ISIN format`,
      });
    }

    // ---- Build CSV row ----
    const fundIssues = issues.filter(i => i.isin === isin);
    fundSummaries.push({
      isin,
      name: name.substring(0, 60),
      asset_type: assetType,
      asset_subtype: assetSubtype,
      risk_bucket: riskBucket,
      confidence: confidence !== null ? confidence.toFixed(2) : "",
      has_cv2: cv2 ? "Y" : "N",
      has_pev2: pev2 ? "Y" : "N",
      has_asset_mix: hasAssetMix ? "Y" : "N",
      has_eco_expo: hasEconExpo ? "Y" : "N",
      has_ms: ms ? "Y" : "N",
      has_derived: derived ? "Y" : "N",
      mix_scale: mixScale,
      eco_scale: ecoScale,
      mix_equity: mixEquity !== null ? mixEquity : "",
      mix_bond: mixBond !== null ? mixBond : "",
      mix_cash: mixCash !== null ? mixCash : "",
      mix_other: mixOther !== null ? mixOther : "",
      mix_sum: mixSum !== null ? mixSum.toFixed(4) : "",
      eco_equity: ecoEquity !== null ? ecoEquity : "",
      eco_bond: ecoBond !== null ? ecoBond : "",
      eco_cash: ecoCash !== null ? ecoCash : "",
      eco_other: ecoOther !== null ? ecoOther : "",
      eco_sum: ecoSum !== null ? ecoSum.toFixed(4) : "",
      retrocession: retro !== undefined && retro !== null ? retro : "",
      issue_count: fundIssues.length,
      top_severity: (fundIssues.sort((a, b) => {
        const order = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
      })[0]?.severity) || "OK",
    });
  }

  // =====================================================================
  // Statistics
  // =====================================================================
  const severityCounts = { BLOCKER: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const i of issues) {
    severityCounts[i.severity] = (severityCounts[i.severity] || 0) + 1;
  }

  const categoryCounts = {};
  for (const i of issues) {
    categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
  }

  // =====================================================================
  // Output JSON
  // =====================================================================
  const outputDir = path.join(__dirname, "..", "..", "artifacts", "bdb_data_audit");
  fs.mkdirSync(outputDir, { recursive: true });

  const jsonOut = {
    audit_date: new Date().toISOString(),
    project: "BDB-FONDOS",
    collection: "funds_v3",
    mode: "READONLY",
    total_funds: counters.total,
    counters,
    severity_counts: severityCounts,
    category_counts: categoryCounts,
    issues,
  };

  const jsonPath = path.join(outputDir, "funds_v3_data_audit_readonly.json");
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2), "utf8");
  console.log(`JSON written: ${jsonPath}`);

  // =====================================================================
  // Output CSV
  // =====================================================================
  const csvHeaders = Object.keys(fundSummaries[0] || {});
  const csvRows = [csvHeaders.join(",")];
  for (const row of fundSummaries) {
    csvRows.push(csvHeaders.map(h => {
      let v = String(row[h] ?? "");
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }).join(","));
  }

  const csvPath = path.join(outputDir, "funds_v3_data_audit_summary.csv");
  fs.writeFileSync(csvPath, csvRows.join("\n"), "utf8");
  console.log(`CSV written: ${csvPath}`);

  // =====================================================================
  // Console Summary
  // =====================================================================
  console.log("\n====================================================");
  console.log("AUDIT SUMMARY");
  console.log("====================================================");
  console.log(`Total funds:               ${counters.total}`);
  console.log(`Has classification_v2:     ${counters.has_classification_v2}`);
  console.log(`Has portfolio_exposure_v2: ${counters.has_portfolio_exposure_v2}`);
  console.log(`  Has asset_mix:           ${counters.has_asset_mix}`);
  console.log(`  Has economic_exposure:   ${counters.has_economic_exposure}`);
  console.log(`  Has BOTH mix+eco:        ${counters.has_both_mix_and_eco}`);
  console.log(`  Has ONLY eco (no mix):   ${counters.has_only_eco_no_mix}`);
  console.log(`Has ms:                    ${counters.has_ms}`);
  console.log(`Has derived:               ${counters.has_derived}`);
  console.log(`Has manual:                ${counters.has_manual}`);
  console.log(`cv2.asset_type blank:      ${counters.cv2_asset_type_blank}`);
  console.log("");
  console.log("---- ASSET_MIX SCALE ----");
  console.log(`Scale 0-1:                 ${counters.mix_scale_0_1}`);
  console.log(`Scale 0-100:               ${counters.mix_scale_0_100}`);
  console.log(`Scale ambiguous:           ${counters.mix_scale_ambiguous}`);
  console.log(`Scale empty:               ${counters.mix_scale_empty}`);
  console.log("");
  console.log("---- ECONOMIC_EXPOSURE SCALE ----");
  console.log(`Scale 0-1:                 ${counters.eco_scale_0_1}`);
  console.log(`Scale 0-100:               ${counters.eco_scale_0_100}`);
  console.log(`Scale ambiguous:           ${counters.eco_scale_ambiguous}`);
  console.log(`Scale empty:               ${counters.eco_scale_empty}`);
  console.log("");
  console.log("---- CROSS-SCALE ----");
  console.log(`Mixed scale mix vs eco:    ${counters.mixed_scale_between_mix_and_eco}`);
  console.log("");
  console.log("---- RETROCESSION ----");
  console.log(`Has retrocession field:    ${counters.has_retrocession_field}`);
  console.log(`Retrocession = 0:          ${counters.retrocession_zero}`);
  console.log(`Retrocession > 0:          ${counters.retrocession_nonzero}`);
  console.log(`Retrocession null/undef:   ${counters.retrocession_null}`);
  console.log("");
  console.log("---- ISSUES BY SEVERITY ----");
  for (const [sev, c] of Object.entries(severityCounts)) {
    console.log(`${sev.padEnd(10)}: ${c}`);
  }
  console.log("");
  console.log("---- ISSUES BY CATEGORY ----");
  const sortedCats = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  for (const [cat, c] of sortedCats) {
    console.log(`${cat.padEnd(45)}: ${c}`);
  }

  // Top 20
  const criticalOrder = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const top20 = [...issues]
    .sort((a, b) => (criticalOrder[a.severity] ?? 4) - (criticalOrder[b.severity] ?? 4))
    .slice(0, 20);

  console.log("\n---- TOP 20 CRITICAL ISSUES ----");
  for (const iss of top20) {
    console.log(`[${iss.severity}] ${iss.category} | ${iss.isin} | ${iss.detail.substring(0, 90)}`);
  }

  console.log("\nAudit complete. READONLY — zero writes performed.");
}

main().catch((err) => {
  console.error("AUDIT ERROR:", err);
  process.exit(1);
});

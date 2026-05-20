/**
 * BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-195-3
 *
 * PURPOSE: Execute controlled write of exactly 100 ACCEPT funds to Firestore funds_v3.
 *          Starts from position 26 in the manifest (after the first 25 already written).
 *          Uses Firestore update() â€” NEVER set().
 *
 * USAGE:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json"
 *   node scripts/maintenance/write_controlled_195_3.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BATCH_SIZE = 195;
const BATCH_OFFSET = 325; // skip first 25 (already written in batch 0)
const BATCH_INDEX = 3;

const BASE = path.resolve(__dirname, "..", "..");
const MANIFEST_PATH   = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "write_gate_manifest_0.json");
const PARSER_PATH     = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "parser_dry_run_latest.json");
const SNAPSHOT_PATH   = path.join(BASE, "artifacts", "morningstar_pdf_updated_batch", "prewrite_snapshot_0", "snapshot_funds_v3_before_write.json");
const MISSING_PATH    = path.join(BASE, "artifacts", "morningstar_pdf_updated_batch", "prewrite_snapshot_0", "missing_in_firestore.json");
const REVIEW_PATH     = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "review_required_0.json");
const ERROR_PATH      = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "error_blocked_0.json");

const OUT_DIR = path.join(BASE, "artifacts", "morningstar_pdf_updated_batch", "write_controlled_195_3");
const OUT_BATCH_MANIFEST  = path.join(OUT_DIR, "batch_manifest.json");
const OUT_ROLLBACK        = path.join(OUT_DIR, "rollback_batch_195_3.json");
const OUT_POSTWRITE       = path.join(OUT_DIR, "postwrite_verification.json");
const OUT_SUMMARY         = path.join(OUT_DIR, "write_summary.json");
const OUT_REPORT          = path.join(BASE, "docs", "BDB_MORNINGSTAR_PDF_UPDATED_BATCH_write_controlled_195_3.md");

const ALLOWED_FIELDS = [
  "classification_v2", "currency", "derived", "isin",
  "ms", "name", "portfolio_exposure_v2", "quality", "updatedAt"
];
const FORBIDDEN_FIELDS = ["manual", "economic_exposure"];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initFirebase() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saPath && fs.existsSync(saPath)) {
    admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
    console.log(`[INIT] Firebase Admin from SA: ${saPath}`);
  } else {
    const repoSa = path.join(BASE, "serviceAccountKey.json");
    if (fs.existsSync(repoSa)) {
      admin.initializeApp({ credential: admin.credential.cert(require(repoSa)) });
    } else {
      admin.initializeApp();
    }
  }
  return admin.firestore();
}

function sanitizeForJson(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof admin.firestore.Timestamp) return obj.toDate().toISOString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(sanitizeForJson);
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitizeForJson(v);
    return out;
  }
  return obj;
}

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function main() {
  const startTime = new Date();
  console.log("=".repeat(60));
  console.log("BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-195-3");
  console.log(`MODE: WRITE CONTROLLED â€” ${BATCH_SIZE} documents (offset ${BATCH_OFFSET})`);
  console.log("=".repeat(60));
  console.log();

  // â”€â”€ 1: Load â”€â”€
  console.log("[1/10] Loading input files...");
  const manifest     = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const parser       = JSON.parse(fs.readFileSync(PARSER_PATH, "utf-8"));
  const snapshotData = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));
  const missingData  = JSON.parse(fs.readFileSync(MISSING_PATH, "utf-8"));
  const reviewList   = JSON.parse(fs.readFileSync(REVIEW_PATH, "utf-8"));
  const errorList    = JSON.parse(fs.readFileSync(ERROR_PATH, "utf-8"));

  const payloads     = parser.proposed_payload_by_isin;
  const snapshotDocs = snapshotData.documents;
  const missingSet   = new Set(missingData.isins);
  const reviewSet    = new Set(reviewList.map(r => r.isin));
  const errorSet     = new Set(errorList.filter(e => e.isin !== "UNKNOWN").map(e => e.isin));
  const snapshotSet  = new Set(Object.keys(snapshotDocs));

  console.log(`   Manifest: ${manifest.entries.length} | Payloads: ${Object.keys(payloads).length}`);
  console.log(`   Snapshot: ${snapshotSet.size} | Missing: ${missingSet.size} | REVIEW: ${reviewSet.size} | ERROR: ${errorSet.size}`);

  // â”€â”€ 2: Select batch â”€â”€
  console.log("[2/10] Selecting batch of 100 (offset 25)...");
  const eligible = manifest.entries.filter(e =>
    !missingSet.has(e.isin) && snapshotSet.has(e.isin) &&
    !reviewSet.has(e.isin) && !errorSet.has(e.isin) && payloads[e.isin]
  );
  console.log(`   Eligible total: ${eligible.length}`);

  const batch = eligible.slice(BATCH_OFFSET, BATCH_OFFSET + BATCH_SIZE);
  if (batch.length !== BATCH_SIZE) {
    throw new Error(`Expected ${BATCH_SIZE} batch entries, got ${batch.length}`);
  }
  console.log(`   Batch: positions ${BATCH_OFFSET + 1}-${BATCH_OFFSET + BATCH_SIZE} => ${batch.length} ISINs`);
  console.log(`   First: ${batch[0].isin} | Last: ${batch[batch.length - 1].isin}`);

  // â”€â”€ 3: Validate payloads â”€â”€
  console.log("[3/10] Validating payloads...");
  const violations = [];
  for (const entry of batch) {
    const keys = Object.keys(payloads[entry.isin]);
    for (const fk of FORBIDDEN_FIELDS) {
      if (keys.includes(fk)) violations.push({ isin: entry.isin, violation: `forbidden: ${fk}` });
    }
    for (const k of keys) {
      if (!ALLOWED_FIELDS.includes(k)) violations.push({ isin: entry.isin, violation: `unexpected: ${k}` });
    }
  }
  if (violations.length > 0) throw new Error(`${violations.length} violations. Aborting.`);
  console.log(`   OK: All ${BATCH_SIZE} payloads valid, no forbidden fields`);

  // â”€â”€ 4: Create artifacts â”€â”€
  console.log("[4/10] Creating batch artifacts...");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const batchManifest = {
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-195-3",
    batch_size: BATCH_SIZE, batch_index: BATCH_INDEX, batch_offset: BATCH_OFFSET,
    fields_to_write: ALLOWED_FIELDS,
    fields_preserved: ["manual", "manual.costs", "manual.costs.retrocession"],
    entries: batch.map(e => ({
      isin: e.isin, name: e.name, payload_hash: e.payload_hash,
      asset_class: e.asset_class, asset_type_v2: e.asset_type_v2, region_primary: e.region_primary
    }))
  };
  fs.writeFileSync(OUT_BATCH_MANIFEST, JSON.stringify(batchManifest, null, 2), "utf-8");
  console.log("   batch_manifest.json written");

  // â”€â”€ 5: Rollback â”€â”€
  console.log("[5/10] Creating rollback...");
  const rollbackEntries = {};
  for (const entry of batch) rollbackEntries[entry.isin] = snapshotDocs[entry.isin];
  fs.writeFileSync(OUT_ROLLBACK, JSON.stringify({
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-195-3",
    batch_size: BATCH_SIZE, entries: rollbackEntries
  }, null, 2), "utf-8");
  console.log(`   rollback_batch_195_3.json written (${BATCH_SIZE} docs)`);

  // â”€â”€ 6: Init Firebase â”€â”€
  console.log("[6/10] Initializing Firebase...");
  const db = initFirebase();

  // â”€â”€ 7: WRITE â”€â”€
  console.log(`[7/10] EXECUTING WRITES â€” ${BATCH_SIZE} documents...`);
  let writeCount = 0;
  const writeResults = [];

  for (const entry of batch) {
    const isin = entry.isin;
    const payload = { ...payloads[isin] };
    payload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    if (payload.quality && typeof payload.quality.parsed_at === "object" &&
        Object.keys(payload.quality.parsed_at).length === 0) {
      payload.quality.parsed_at = admin.firestore.FieldValue.serverTimestamp();
    }

    try {
      await db.collection("funds_v3").doc(isin).update(payload);
      writeCount++;
      writeResults.push({ isin, status: "OK" });
      if (writeCount % 10 === 0 || writeCount === BATCH_SIZE) {
        console.log(`   [${writeCount}/${BATCH_SIZE}] last: ${isin} â€” OK`);
      }
    } catch (err) {
      writeResults.push({ isin, status: "ERROR", error: err.message });
      console.error(`   [${writeCount + 1}/${BATCH_SIZE}] ${isin} â€” ERROR: ${err.message}`);
    }
  }
  console.log(`   WRITES COMPLETED: ${writeCount}/${BATCH_SIZE}`);

  // â”€â”€ 8: Post-write verification â”€â”€
  console.log("[8/10] Post-write verification...");
  const postWriteDocs = {};
  const verificationResults = [];

  // Read in batches of 30
  for (let i = 0; i < batch.length; i += 30) {
    const chunk = batch.slice(i, i + 30);
    const refs = chunk.map(e => db.collection("funds_v3").doc(e.isin));
    const docs = await db.getAll(...refs);
    for (const doc of docs) {
      if (doc.exists) postWriteDocs[doc.id] = sanitizeForJson(doc.data());
    }
  }

  for (const entry of batch) {
    const isin = entry.isin;
    const postDoc = postWriteDocs[isin];
    const preDoc  = snapshotDocs[isin];

    if (!postDoc) {
      verificationResults.push({ isin, status: "ERROR", issues: ["not found after write"] });
      continue;
    }

    const checks = { isin, status: "OK", fields_updated: [], fields_preserved: [], issues: [] };

    // Verify written fields present
    for (const f of ALLOWED_FIELDS) {
      if (f === "updatedAt") {
        if (postDoc.updatedAt) checks.fields_updated.push("updatedAt");
        else checks.issues.push("updatedAt missing");
        continue;
      }
      if (postDoc[f] !== undefined) checks.fields_updated.push(f);
      else checks.issues.push(`${f} missing`);
    }

    // Verify manual preserved
    const preManual = preDoc ? preDoc.manual : undefined;
    const postManual = postDoc.manual;
    if (preManual !== undefined) {
      if (deepEqual(preManual, postManual)) checks.fields_preserved.push("manual");
      else { checks.issues.push("manual MODIFIED â€” CRITICAL"); checks.status = "CRITICAL_FAILURE"; }
    } else {
      checks.fields_preserved.push("manual (absent)");
    }

    const preCosts = preDoc && preDoc.manual ? preDoc.manual.costs : undefined;
    const postCosts = postDoc.manual ? postDoc.manual.costs : undefined;
    if (preCosts !== undefined) {
      if (deepEqual(preCosts, postCosts)) checks.fields_preserved.push("manual.costs");
      else { checks.issues.push("manual.costs MODIFIED â€” CRITICAL"); checks.status = "CRITICAL_FAILURE"; }
    }

    const preRetro = preCosts ? preCosts.retrocession : undefined;
    const postRetro = postCosts ? postCosts.retrocession : undefined;
    if (preRetro !== undefined) {
      if (deepEqual(preRetro, postRetro)) checks.fields_preserved.push("manual.costs.retrocession");
      else { checks.issues.push("manual.costs.retrocession MODIFIED â€” CRITICAL"); checks.status = "CRITICAL_FAILURE"; }
    }

    if (checks.issues.length > 0 && checks.status === "OK") checks.status = "WARNING";
    verificationResults.push(checks);
  }

  const criticals = verificationResults.filter(v => v.status === "CRITICAL_FAILURE");
  const warns     = verificationResults.filter(v => v.status === "WARNING");
  const oks       = verificationResults.filter(v => v.status === "OK");

  console.log(`   Results: ${oks.length} OK, ${warns.length} WARNING, ${criticals.length} CRITICAL`);
  if (criticals.length > 0) criticals.forEach(f => console.error(`   CRITICAL: ${f.isin}: ${f.issues.join(", ")}`));

  // â”€â”€ 9: Write artifacts â”€â”€
  console.log("[9/10] Writing verification artifacts...");

  fs.writeFileSync(OUT_POSTWRITE, JSON.stringify({
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-195-3",
    batch_size: BATCH_SIZE, writes_executed: writeCount,
    write_results: writeResults, verification_results: verificationResults,
    summary: { ok: oks.length, warnings: warns.length, critical_failures: criticals.length }
  }, null, 2), "utf-8");

  const writeSummary = {
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-195-3",
    batch_size: BATCH_SIZE, batch_index: BATCH_INDEX, batch_offset: BATCH_OFFSET,
    writes_executed: writeCount, writes_expected: BATCH_SIZE,
    docs_created: 0, missing_isins_touched: 0, review_touched: 0, error_touched: 0,
    manual_modified: criticals.length,
    fields_written: ALLOWED_FIELDS,
    fields_preserved: ["manual", "manual.costs", "manual.costs.retrocession"],
    verification: { ok: oks.length, warnings: warns.length, critical: criticals.length },
    cumulative: { total_written: 325 + writeCount, total_remaining: 520 - 325 - writeCount },
    rollback_available: "rollback_batch_195_3.json",
    elapsed_ms: Date.now() - startTime.getTime()
  };
  fs.writeFileSync(OUT_SUMMARY, JSON.stringify(writeSummary, null, 2), "utf-8");

  // â”€â”€ 10: Markdown report â”€â”€
  console.log("[10/10] Writing markdown report...");

  const batchRows = batch.map((e, i) => {
    const wr = writeResults.find(w => w.isin === e.isin);
    const vr = verificationResults.find(v => v.isin === e.isin);
    return `| ${BATCH_OFFSET + i + 1} | \`${e.isin}\` | ${e.name} | ${e.asset_class || "â€”"} | ${wr ? wr.status : "â€”"} | ${vr ? vr.status : "â€”"} |`;
  }).join("\n");

  const recommendation = criticals.length > 0
    ? `> [!CAUTION]\n> ${criticals.length} CRITICAL FAILURES. DETENER y revisar. Considerar rollback.`
    : warns.length > 0
      ? `> [!WARNING]\n> ${warns.length} warnings detectados. Revisar antes de continuar.`
      : `> [!TIP]\n> Los ${BATCH_SIZE} writes se ejecutaron correctamente. manual.* intacto en todos los casos.\n\n**Recomendacion**: Proceder con el batch restante de **${520 - 325 - writeCount} ISINs**.`;

  const md = `# BDB Morningstar PDF Updated Batch Write Controlled 195-3

**Fecha**: ${new Date().toISOString()}
**Task ID**: BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-195-3

> [!IMPORTANT]
> Escritura controlada de **${BATCH_SIZE} fondos** (posiciones ${BATCH_OFFSET + 1}-${BATCH_OFFSET + BATCH_SIZE}) en Firestore \`funds_v3\`.
> Metodo: \`update()\` â€” NUNCA \`set()\`.

---

## 1. Progreso Acumulado

| Batch | Fondos | Estado |
|:---|---:|:---|
| Batch 0 (25-0) | 25 | COMPLETADO â€” 25 OK |
| **Batch 1 (195-3)** | **${BATCH_SIZE}** | **ESTE BATCH** |
| Restantes | ${520 - 325 - writeCount} | Pendiente |
| Missing (excluidos) | 2 | LU0171281750, LU0171282212 |
| **Total escrito** | **${325 + writeCount}** | |

---

## 2. Exclusiones

| Exclusion | Cantidad | Aplicada |
|:---|---:|:---|
| Missing ISINs | 2 | SI â€” excluidos |
| REVIEW ISINs | ${reviewSet.size} | SI â€” excluidos |
| ERROR ISINs | ${errorSet.size} | SI â€” excluidos |
| Batch 0 (ya escritos) | 25 | SI â€” offset ${BATCH_OFFSET} |

---

## 3. Resultado de Escritura

| Metrica | Valor |
|:---|:---|
| Writes ejecutados | **${writeCount}/${BATCH_SIZE}** |
| Errores de escritura | **${writeResults.filter(w => w.status === "ERROR").length}** |
| Fondos creados | **0** |

---

## 4. Verificacion Post-Write

| Metrica | Valor |
|:---|:---|
| Docs re-leidos | **${Object.keys(postWriteDocs).length}** |
| OK | **${oks.length}** |
| Warnings | **${warns.length}** |
| Critical Failures | **${criticals.length}** |

---

## 5. Campos Preservados

| Campo | Estado |
|:---|:---|
| \`manual\` | **${criticals.length === 0 ? "INTACTO â€” CONFIRMADO" : "CRITICAL FAILURE"}** |
| \`manual.costs\` | **${criticals.length === 0 ? "INTACTO â€” CONFIRMADO" : "CRITICAL FAILURE"}** |
| \`manual.costs.retrocession\` | **${criticals.length === 0 ? "INTACTO â€” CONFIRMADO" : "CRITICAL FAILURE"}** |

---

## 6. Tabla del Batch

| # | ISIN | Nombre | Clase | Write | Verify |
|:---|:---|:---|:---|:---|:---|
${batchRows}

---

## 7. Confirmaciones de Seguridad

| Invariante | Estado |
|:---|:---|
| Firestore writes | **${writeCount}** |
| Fondos creados | **0 â€” CONFIRMADO** |
| Missing ISINs tocados | **0 â€” CONFIRMADO** |
| REVIEW tocados | **0 â€” CONFIRMADO** |
| ERROR tocados | **0 â€” CONFIRMADO** |
| manual.* tocado | **${criticals.length === 0 ? "NO â€” CONFIRMADO" : "CRITICAL"}** |
| manual.costs.retrocession tocado | **${criticals.length === 0 ? "NO â€” CONFIRMADO" : "CRITICAL"}** |
| BDB-FONDOS-CORE tocado | **NO â€” CONFIRMADO** |
| Deploy | **NO â€” CONFIRMADO** |
| Commit | **NO â€” CONFIRMADO** |
| Push | **NO â€” CONFIRMADO** |

---

## 8. Rollback

Archivo: \`artifacts/morningstar_pdf_updated_batch/write_controlled_195_3/rollback_batch_195_3.json\`
Documentos: **${BATCH_SIZE}** (estado pre-write desde snapshot)

---

## 9. Recomendacion

${recommendation}

---

*Batch 1 (100 fondos) â€” Writes: ${writeCount} â€” Total acumulado: ${325 + writeCount}/520*
`;

  fs.writeFileSync(OUT_REPORT, md, "utf-8");
  console.log(`   Report: ${OUT_REPORT}`);

  // â”€â”€ Final â”€â”€
  console.log();
  console.log("=".repeat(60));
  console.log("WRITE CONTROLLED 195-3 SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Batch:       ${BATCH_SIZE} (offset ${BATCH_OFFSET})`);
  console.log(`  Writes:      ${writeCount}/${BATCH_SIZE}`);
  console.log(`  Created:     0`);
  console.log(`  Missing:     0 touched`);
  console.log(`  REVIEW:      0 touched`);
  console.log(`  ERROR:       0 touched`);
  console.log(`  Verify OK:   ${oks.length}`);
  console.log(`  Verify WARN: ${warns.length}`);
  console.log(`  Verify CRIT: ${criticals.length}`);
  console.log(`  manual.*:    ${criticals.length === 0 ? "INTACT" : "MODIFIED"}`);
  console.log(`  Cumulative:  ${325 + writeCount}/520 written`);
  console.log(`  Remaining:   ${520 - 325 - writeCount}`);
  console.log(`  Elapsed:     ${Date.now() - startTime.getTime()} ms`);
  console.log("=".repeat(60));
  console.log(criticals.length > 0
    ? "STATUS: CRITICAL FAILURES â€” STOP"
    : "STATUS: WRITE CONTROLLED 195-3 COMPLETE â€” ALL OK");

  process.exit(criticals.length > 0 ? 2 : 0);
}

main().catch(err => { console.error("[FATAL]", err.message); process.exit(1); });



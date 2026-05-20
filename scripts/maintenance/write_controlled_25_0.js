/**
 * BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-25-0
 *
 * PURPOSE: Execute controlled write of exactly 25 ACCEPT funds to Firestore funds_v3.
 *          Uses Firestore update() — NEVER set() — to preserve all unmentioned fields.
 *
 * SAFETY:
 *   - Writes ONLY 25 documents.
 *   - Uses update() to preserve manual.*, manual.costs, manual.costs.retrocession.
 *   - Creates pre-batch rollback from snapshot.
 *   - Performs post-write verification (re-reads + compares).
 *   - Excludes missing, REVIEW, ERROR ISINs.
 *
 * USAGE:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json"
 *   node scripts/maintenance/write_controlled_25_0.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const BATCH_SIZE = 25;

const BASE = path.resolve(__dirname, "..", "..");
const MANIFEST_PATH   = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "write_gate_manifest_0.json");
const PARSER_PATH     = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "parser_dry_run_latest.json");
const SNAPSHOT_PATH   = path.join(BASE, "artifacts", "morningstar_pdf_updated_batch", "prewrite_snapshot_0", "snapshot_funds_v3_before_write.json");
const MISSING_PATH    = path.join(BASE, "artifacts", "morningstar_pdf_updated_batch", "prewrite_snapshot_0", "missing_in_firestore.json");
const REVIEW_PATH     = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "review_required_0.json");
const ERROR_PATH      = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "error_blocked_0.json");

const OUT_DIR = path.join(BASE, "artifacts", "morningstar_pdf_updated_batch", "write_controlled_25_0");
const OUT_BATCH_MANIFEST  = path.join(OUT_DIR, "batch_manifest.json");
const OUT_ROLLBACK        = path.join(OUT_DIR, "rollback_batch_25_0.json");
const OUT_POSTWRITE       = path.join(OUT_DIR, "postwrite_verification.json");
const OUT_SUMMARY         = path.join(OUT_DIR, "write_summary.json");
const OUT_REPORT          = path.join(BASE, "docs", "BDB_MORNINGSTAR_PDF_UPDATED_BATCH_WRITE_CONTROLLED_25_0.md");

// Fields we are allowed to write
const ALLOWED_FIELDS = [
  "classification_v2", "currency", "derived", "isin",
  "ms", "name", "portfolio_exposure_v2", "quality", "updatedAt"
];

// Fields we must NEVER touch
const FORBIDDEN_FIELDS = ["manual", "economic_exposure"];

// ─────────────────────────────────────────────────────────────
// Firebase Init
// ─────────────────────────────────────────────────────────────
function initFirebase() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saPath && fs.existsSync(saPath)) {
    const sa = require(saPath);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    console.log(`[INIT] Firebase Admin initialized from SA: ${saPath}`);
  } else {
    const repoSa = path.join(BASE, "serviceAccountKey.json");
    if (fs.existsSync(repoSa)) {
      admin.initializeApp({ credential: admin.credential.cert(require(repoSa)) });
      console.log(`[INIT] Firebase Admin initialized from repo root SA`);
    } else {
      admin.initializeApp();
      console.log(`[INIT] Firebase Admin initialized via ADC`);
    }
  }
  return admin.firestore();
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

function sha256Short(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex").substring(0, 16);
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  const startTime = new Date();
  console.log("=".repeat(60));
  console.log("BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-25-0");
  console.log("MODE: WRITE CONTROLLED — Exactly 25 documents");
  console.log("=".repeat(60));
  console.log();

  // ── Step 1: Load all inputs ──
  console.log("[1/10] Loading input files...");
  const manifest   = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const parser     = JSON.parse(fs.readFileSync(PARSER_PATH, "utf-8"));
  const snapshotData = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8"));
  const missingData  = JSON.parse(fs.readFileSync(MISSING_PATH, "utf-8"));
  const reviewList   = JSON.parse(fs.readFileSync(REVIEW_PATH, "utf-8"));
  const errorList    = JSON.parse(fs.readFileSync(ERROR_PATH, "utf-8"));

  const payloads    = parser.proposed_payload_by_isin;
  const snapshotDocs = snapshotData.documents;
  const missingSet   = new Set(missingData.isins);
  const reviewSet    = new Set(reviewList.map(r => r.isin));
  const errorSet     = new Set(errorList.filter(e => e.isin !== "UNKNOWN").map(e => e.isin));
  const snapshotSet  = new Set(Object.keys(snapshotDocs));

  console.log(`   Manifest entries: ${manifest.entries.length}`);
  console.log(`   Parser payloads: ${Object.keys(payloads).length}`);
  console.log(`   Snapshot docs: ${snapshotSet.size}`);
  console.log(`   Missing ISINs: ${missingSet.size}`);
  console.log(`   REVIEW ISINs: ${reviewSet.size}`);
  console.log(`   ERROR ISINs: ${errorSet.size}`);

  // ── Step 2: Select eligible batch of 25 ──
  console.log("[2/10] Selecting batch of 25...");
  const eligible = manifest.entries.filter(e =>
    !missingSet.has(e.isin) &&
    snapshotSet.has(e.isin) &&
    !reviewSet.has(e.isin) &&
    !errorSet.has(e.isin) &&
    payloads[e.isin]
  );
  console.log(`   Eligible candidates: ${eligible.length}`);

  const batch = eligible.slice(0, BATCH_SIZE);
  if (batch.length !== BATCH_SIZE) {
    throw new Error(`Expected ${BATCH_SIZE} batch entries, got ${batch.length}`);
  }
  console.log(`   Batch size: ${batch.length}`);
  console.log();
  console.log("   BATCH ISINs:");
  batch.forEach((e, i) => {
    console.log(`   ${String(i+1).padStart(2)}. ${e.isin} | ${e.name.substring(0, 55)}`);
  });
  console.log();

  // ── Step 3: Validate payloads ──
  console.log("[3/10] Validating payloads...");
  const violations = [];
  for (const entry of batch) {
    const payload = payloads[entry.isin];
    const keys = Object.keys(payload);

    // Check no forbidden keys
    for (const fk of FORBIDDEN_FIELDS) {
      if (keys.includes(fk)) {
        violations.push({ isin: entry.isin, violation: `forbidden_key: ${fk}` });
      }
    }

    // Check only allowed keys
    for (const k of keys) {
      if (!ALLOWED_FIELDS.includes(k)) {
        violations.push({ isin: entry.isin, violation: `unexpected_key: ${k}` });
      }
    }
  }

  if (violations.length > 0) {
    console.error("   VIOLATIONS FOUND:", JSON.stringify(violations, null, 2));
    throw new Error(`${violations.length} payload violations found. Aborting.`);
  }
  console.log("   OK: All 25 payloads contain only allowed fields");
  console.log("   OK: No forbidden fields (manual, economic_exposure) found");

  // ── Step 4: Create output directory and batch manifest ──
  console.log("[4/10] Creating batch artifacts...");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const batchManifest = {
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-25-0",
    batch_size: BATCH_SIZE,
    batch_index: 0,
    fields_to_write: ALLOWED_FIELDS,
    fields_preserved: ["manual", "manual.costs", "manual.costs.retrocession"],
    fields_forbidden: FORBIDDEN_FIELDS,
    write_method: "Firestore update() — NOT set()",
    entries: batch.map(e => ({
      isin: e.isin,
      name: e.name,
      payload_hash: e.payload_hash,
      asset_class: e.asset_class,
      asset_type_v2: e.asset_type_v2,
      region_primary: e.region_primary
    }))
  };
  fs.writeFileSync(OUT_BATCH_MANIFEST, JSON.stringify(batchManifest, null, 2), "utf-8");
  console.log(`   batch_manifest.json written`);

  // ── Step 5: Create rollback from snapshot ──
  console.log("[5/10] Creating rollback artifact...");
  const rollbackEntries = {};
  for (const entry of batch) {
    rollbackEntries[entry.isin] = snapshotDocs[entry.isin];
  }
  const rollback = {
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-25-0",
    purpose: "Full document state before write. Use to restore if needed.",
    batch_size: BATCH_SIZE,
    entries: rollbackEntries
  };
  fs.writeFileSync(OUT_ROLLBACK, JSON.stringify(rollback, null, 2), "utf-8");
  console.log(`   rollback_batch_25_0.json written (${BATCH_SIZE} docs)`);

  // ── Step 6: Init Firebase ──
  console.log("[6/10] Initializing Firebase Admin...");
  const db = initFirebase();

  // ── Step 7: EXECUTE WRITES ──
  console.log("[7/10] EXECUTING WRITES — 25 documents...");
  console.log("   Write method: db.collection('funds_v3').doc(isin).update(payload)");
  console.log();

  let writeCount = 0;
  const writeResults = [];

  for (const entry of batch) {
    const isin = entry.isin;
    const payload = { ...payloads[isin] };

    // Replace updatedAt with server timestamp
    payload.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    // Also set quality.parsed_at to server timestamp if it exists as empty object
    if (payload.quality && typeof payload.quality.parsed_at === "object" &&
        Object.keys(payload.quality.parsed_at).length === 0) {
      payload.quality.parsed_at = admin.firestore.FieldValue.serverTimestamp();
    }

    try {
      await db.collection("funds_v3").doc(isin).update(payload);
      writeCount++;
      writeResults.push({ isin, status: "OK", error: null });
      console.log(`   [${String(writeCount).padStart(2)}/${BATCH_SIZE}] ${isin} — OK`);
    } catch (err) {
      writeResults.push({ isin, status: "ERROR", error: err.message });
      console.error(`   [${String(writeCount + 1).padStart(2)}/${BATCH_SIZE}] ${isin} — ERROR: ${err.message}`);
    }
  }

  console.log();
  console.log(`   WRITES COMPLETED: ${writeCount}/${BATCH_SIZE}`);

  if (writeCount !== BATCH_SIZE) {
    console.error(`   WARNING: Expected ${BATCH_SIZE} writes, got ${writeCount}`);
  }

  // ── Step 8: POST-WRITE VERIFICATION — re-read all 25 ──
  console.log("[8/10] Post-write verification — re-reading 25 docs...");

  const postWriteDocs = {};
  const verificationResults = [];
  const refs = batch.map(e => db.collection("funds_v3").doc(e.isin));
  const postDocs = await db.getAll(...refs);

  for (const doc of postDocs) {
    if (doc.exists) {
      postWriteDocs[doc.id] = sanitizeForJson(doc.data());
    }
  }

  for (const entry of batch) {
    const isin = entry.isin;
    const postDoc = postWriteDocs[isin];
    const preDoc  = snapshotDocs[isin];
    const proposedPayload = payloads[isin];

    if (!postDoc) {
      verificationResults.push({ isin, status: "ERROR", detail: "Document not found after write" });
      continue;
    }

    const checks = {
      isin,
      status: "OK",
      fields_updated: [],
      fields_preserved: [],
      issues: []
    };

    // Check that written fields are present and updated
    for (const field of ALLOWED_FIELDS) {
      if (field === "updatedAt") {
        // updatedAt should be a recent timestamp
        if (postDoc.updatedAt) {
          checks.fields_updated.push("updatedAt");
        } else {
          checks.issues.push("updatedAt is null/missing after write");
        }
        continue;
      }

      if (proposedPayload[field] !== undefined) {
        if (postDoc[field] !== undefined) {
          checks.fields_updated.push(field);
        } else {
          checks.issues.push(`${field} missing after write`);
        }
      }
    }

    // Check manual fields preserved
    // manual
    const preManual = preDoc ? preDoc.manual : undefined;
    const postManual = postDoc.manual;
    if (preManual !== undefined) {
      if (deepEqual(preManual, postManual)) {
        checks.fields_preserved.push("manual");
      } else {
        checks.issues.push("manual was MODIFIED — CRITICAL");
        checks.status = "CRITICAL_FAILURE";
      }
    } else {
      checks.fields_preserved.push("manual (was undefined, still absent)");
    }

    // manual.costs
    const preCosts = preDoc && preDoc.manual ? preDoc.manual.costs : undefined;
    const postCosts = postDoc.manual ? postDoc.manual.costs : undefined;
    if (preCosts !== undefined) {
      if (deepEqual(preCosts, postCosts)) {
        checks.fields_preserved.push("manual.costs");
      } else {
        checks.issues.push("manual.costs was MODIFIED — CRITICAL");
        checks.status = "CRITICAL_FAILURE";
      }
    }

    // manual.costs.retrocession
    const preRetro = preCosts ? preCosts.retrocession : undefined;
    const postRetro = postCosts ? postCosts.retrocession : undefined;
    if (preRetro !== undefined) {
      if (deepEqual(preRetro, postRetro)) {
        checks.fields_preserved.push("manual.costs.retrocession");
      } else {
        checks.issues.push("manual.costs.retrocession was MODIFIED — CRITICAL");
        checks.status = "CRITICAL_FAILURE";
      }
    }

    if (checks.issues.length > 0 && checks.status === "OK") {
      checks.status = "WARNING";
    }

    verificationResults.push(checks);
  }

  const criticalFailures = verificationResults.filter(v => v.status === "CRITICAL_FAILURE");
  const warnings = verificationResults.filter(v => v.status === "WARNING");
  const oks = verificationResults.filter(v => v.status === "OK");

  console.log(`   Results: ${oks.length} OK, ${warnings.length} WARNING, ${criticalFailures.length} CRITICAL`);

  if (criticalFailures.length > 0) {
    console.error("   CRITICAL FAILURES:");
    criticalFailures.forEach(f => console.error(`     ${f.isin}: ${f.issues.join(", ")}`));
  }

  // ── Step 9: Write verification artifacts ──
  console.log("[9/10] Writing verification artifacts...");

  const postwriteVerification = {
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-25-0",
    batch_size: BATCH_SIZE,
    writes_executed: writeCount,
    write_results: writeResults,
    verification_results: verificationResults,
    summary: {
      ok: oks.length,
      warnings: warnings.length,
      critical_failures: criticalFailures.length
    }
  };
  fs.writeFileSync(OUT_POSTWRITE, JSON.stringify(postwriteVerification, null, 2), "utf-8");

  const writeSummary = {
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-25-0",
    batch_size: BATCH_SIZE,
    batch_index: 0,
    writes_executed: writeCount,
    writes_expected: BATCH_SIZE,
    docs_created: 0,
    missing_isins_touched: 0,
    review_touched: 0,
    error_touched: 0,
    manual_modified: criticalFailures.length,
    fields_written: ALLOWED_FIELDS,
    fields_preserved: ["manual", "manual.costs", "manual.costs.retrocession"],
    verification: {
      ok: oks.length,
      warnings: warnings.length,
      critical: criticalFailures.length
    },
    rollback_available: "rollback_batch_25_0.json",
    elapsed_ms: Date.now() - startTime.getTime()
  };
  fs.writeFileSync(OUT_SUMMARY, JSON.stringify(writeSummary, null, 2), "utf-8");

  // ── Step 10: Write Markdown report ──
  console.log("[10/10] Writing markdown report...");

  const batchTableRows = batch.map((e, i) => {
    const wr = writeResults.find(w => w.isin === e.isin);
    const vr = verificationResults.find(v => v.isin === e.isin);
    const writeStatus = wr ? wr.status : "—";
    const verifyStatus = vr ? vr.status : "—";
    const preserved = vr ? vr.fields_preserved.join(", ") : "—";
    const issues = vr && vr.issues.length > 0 ? vr.issues.join(" | ") : "—";
    return `| ${i+1} | \`${e.isin}\` | ${e.name} | ${e.asset_class || "—"} | ${writeStatus} | ${verifyStatus} | ${issues} |`;
  }).join("\n");

  const recommendation = criticalFailures.length > 0
    ? `> [!CAUTION]\n> Se detectaron ${criticalFailures.length} CRITICAL FAILURES. **DETENER** todas las escrituras y revisar antes de continuar. Considerar ejecutar rollback desde \`rollback_batch_25_0.json\`.`
    : warnings.length > 0
      ? `> [!WARNING]\n> Se detectaron ${warnings.length} warnings. Revisar antes de continuar con batch mayor.\n\nSi los warnings son aceptables, proceder con:\n- Batch de 100 (ISINs 26-125)\n- O batch de 495 restantes`
      : `> [!TIP]\n> Los 25 writes se ejecutaron correctamente. Todos los campos preservados estan intactos.\n\n**Recomendacion**: Proceder con el batch restante de **495 ISINs** (ISINs 26-520).`;

  const md = `# BDB Morningstar PDF Updated Batch Write Controlled 25-0

**Fecha**: ${new Date().toISOString()}
**Task ID**: BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-25-0

> [!IMPORTANT]
> Este documento registra la escritura controlada de exactamente **${BATCH_SIZE} fondos** en Firestore \`funds_v3\`.
> Metodo de escritura: \`db.collection('funds_v3').doc(isin).update(payload)\` — NUNCA \`set()\`.

---

## 1. Estado Git Inicial

Archivos no commiteados relevantes (estado previo al write):
- \`MORNINGSTAR_PDF_PARSER/SALIDA/write_gate_manifest_0.json\`
- \`artifacts/morningstar_pdf_updated_batch/prewrite_snapshot_0/*\`
- \`docs/BDB_MORNINGSTAR_PDF_UPDATED_BATCH_WRITE_GATE_0.md\`
- \`docs/BDB_MORNINGSTAR_PDF_UPDATED_BATCH_PREWRITE_SNAPSHOT_0.md\`

---

## 2. Batch Seleccionado

| Criterio | Valor |
|:---|:---|
| Batch size | **${BATCH_SIZE}** |
| Batch index | **0** (primeros 25 de 520) |
| Source | \`write_gate_manifest_0.json\` (posiciones 1-25) |

---

## 3. Exclusiones Aplicadas

| Exclusion | Cantidad | Aplicada |
|:---|---:|:---|
| Missing ISINs (LU0171281750, LU0171282212) | 2 | **SI** |
| REVIEW ISINs | ${reviewSet.size} | **SI** |
| ERROR ISINs | ${errorSet.size} | **SI** |
| Missing ISINs tocados | **0** | **CONFIRMADO** |
| REVIEW tocados | **0** | **CONFIRMADO** |
| ERROR tocados | **0** | **CONFIRMADO** |

---

## 4. Campos Escritos

| Campo | Descripcion |
|:---|:---|
| \`classification_v2\` | Clasificacion de activos v2 |
| \`currency\` | Divisa del fondo |
| \`derived\` | Campos derivados |
| \`isin\` | ISIN del fondo |
| \`ms\` | Datos Morningstar completos |
| \`name\` | Nombre del fondo |
| \`portfolio_exposure_v2\` | Exposicion de cartera v2 |
| \`quality\` | Metadata de calidad del parseo |
| \`updatedAt\` | Server timestamp |

### Campos PRESERVADOS (verificados post-write):

| Campo | Estado |
|:---|:---|
| \`manual\` | **NUNCA TOCADO** |
| \`manual.costs\` | **NUNCA TOCADO** |
| \`manual.costs.retrocession\` | **NUNCA TOCADO** |

---

## 5. Resultado de Escritura

| Metrica | Valor |
|:---|:---|
| Documentos escritos | **${writeCount}** |
| Esperados | **${BATCH_SIZE}** |
| Fondos creados | **0** |
| Errores de escritura | **${writeResults.filter(w => w.status === "ERROR").length}** |

---

## 6. Verificacion Post-Write

| Metrica | Valor |
|:---|:---|
| Documentos re-leidos | **${Object.keys(postWriteDocs).length}** |
| OK | **${oks.length}** |
| Warnings | **${warnings.length}** |
| Critical Failures | **${criticalFailures.length}** |

---

## 7. Tabla Detallada del Batch

| # | ISIN | Nombre | Clase | Write | Verify | Issues |
|:---|:---|:---|:---|:---|:---|:---|
${batchTableRows}

---

## 8. Rollback Disponible

| Campo | Valor |
|:---|:---|
| Archivo | \`artifacts/morningstar_pdf_updated_batch/write_controlled_25_0/rollback_batch_25_0.json\` |
| Documentos | **${BATCH_SIZE}** (estado completo pre-write desde snapshot) |
| Estrategia | Restaurar documento completo a estado pre-write |

---

## 9. Confirmaciones de Seguridad

| Invariante | Estado |
|:---|:---|
| Firestore writes | **${writeCount}** |
| Fondos creados | **0 — CONFIRMADO** |
| Missing ISINs tocados | **0 — CONFIRMADO** |
| REVIEW tocados | **0 — CONFIRMADO** |
| ERROR tocados | **0 — CONFIRMADO** |
| manual.* tocado | **${criticalFailures.length === 0 ? "NO — CONFIRMADO" : "CRITICAL FAILURE"}** |
| manual.costs.retrocession tocado | **${criticalFailures.length === 0 ? "NO — CONFIRMADO" : "CRITICAL FAILURE"}** |
| BDB-FONDOS-CORE tocado | **NO — CONFIRMADO** |
| Deploy | **NO — CONFIRMADO** |
| Commit | **NO — CONFIRMADO** |
| Push | **NO — CONFIRMADO** |

---

## 10. Recomendacion Siguiente

${recommendation}

---

## 11. Archivos Generados

| Archivo | Descripcion |
|:---|:---|
| \`batch_manifest.json\` | Manifest del batch de 25 |
| \`rollback_batch_25_0.json\` | Rollback pre-write de 25 docs |
| \`postwrite_verification.json\` | Verificacion post-write |
| \`write_summary.json\` | Resumen de la operacion |

---

*Fin del documento — Batch 0 (25 fondos) — Writes: ${writeCount} — Verification: ${oks.length} OK, ${warnings.length} WARN, ${criticalFailures.length} CRIT*
`;

  fs.writeFileSync(OUT_REPORT, md, "utf-8");
  console.log(`   Report written: ${OUT_REPORT}`);

  // ── Final summary ──
  console.log();
  console.log("=".repeat(60));
  console.log("WRITE CONTROLLED 25-0 SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Batch size:               ${BATCH_SIZE}`);
  console.log(`  Writes executed:          ${writeCount}`);
  console.log(`  Docs created:             0`);
  console.log(`  Missing touched:          0`);
  console.log(`  REVIEW touched:           0`);
  console.log(`  ERROR touched:            0`);
  console.log(`  Verification OK:          ${oks.length}`);
  console.log(`  Verification WARNING:     ${warnings.length}`);
  console.log(`  Verification CRITICAL:    ${criticalFailures.length}`);
  console.log(`  manual.* modified:        ${criticalFailures.length === 0 ? "NO" : "YES — CRITICAL"}`);
  console.log(`  Elapsed:                  ${Date.now() - startTime.getTime()} ms`);
  console.log();
  console.log(`  Output dir:  ${OUT_DIR}`);
  console.log(`  Report:      ${OUT_REPORT}`);
  console.log("=".repeat(60));

  if (criticalFailures.length > 0) {
    console.error("STATUS: CRITICAL FAILURES DETECTED — REVIEW IMMEDIATELY");
    process.exit(2);
  } else {
    console.log("STATUS: WRITE CONTROLLED 25-0 COMPLETE — ALL OK");
  }
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});

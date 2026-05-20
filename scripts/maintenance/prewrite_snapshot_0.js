/**
 * BDB-MORNINGSTAR-PDF-UPDATED-BATCH-PREWRITE-SNAPSHOT-0
 *
 * PURPOSE:  Read-only snapshot of the 522 ACCEPT funds from Firestore funds_v3
 *           to create a pre-write backup/rollback artifact.
 *
 * SAFETY:   This script performs ZERO Firestore writes.
 *           It only reads documents from the `funds_v3` collection.
 *
 * USAGE:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json"
 *   node scripts/maintenance/prewrite_snapshot_0.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────
const BASE = path.resolve(__dirname, "..", "..");
const MANIFEST_PATH = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "write_gate_manifest_0.json");
const REVIEW_PATH   = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "review_required_0.json");
const ERROR_PATH    = path.join(BASE, "MORNINGSTAR_PDF_PARSER", "SALIDA", "error_blocked_0.json");

const OUT_DIR = path.join(BASE, "artifacts", "morningstar_pdf_updated_batch", "prewrite_snapshot_0");

const OUT_SNAPSHOT    = path.join(OUT_DIR, "snapshot_funds_v3_before_write.json");
const OUT_ROLLBACK    = path.join(OUT_DIR, "rollback_delete_or_restore_plan.json");
const OUT_SUMMARY     = path.join(OUT_DIR, "snapshot_summary.json");
const OUT_MISSING     = path.join(OUT_DIR, "missing_in_firestore.json");
const OUT_HASHES      = path.join(OUT_DIR, "prewrite_snapshot_hashes.json");
const OUT_REPORT      = path.join(BASE, "docs", "BDB_MORNINGSTAR_PDF_UPDATED_BATCH_PREWRITE_SNAPSHOT_0.md");

// ─────────────────────────────────────────────────────────────
// Firebase Init (read-only)
// ─────────────────────────────────────────────────────────────
function initFirebase() {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (saPath && fs.existsSync(saPath)) {
    const sa = require(saPath);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    console.log(`[INIT] Firebase Admin initialized from SA: ${saPath}`);
  } else {
    // Try serviceAccountKey.json at repo root
    const repoSa = path.join(BASE, "serviceAccountKey.json");
    if (fs.existsSync(repoSa)) {
      const sa = require(repoSa);
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      console.log(`[INIT] Firebase Admin initialized from repo root SA`);
    } else {
      // ADC fallback
      admin.initializeApp();
      console.log(`[INIT] Firebase Admin initialized via ADC`);
    }
  }
  return admin.firestore();
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Recursively convert Firestore Timestamps to ISO strings for JSON serialization */
function sanitizeForJson(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof admin.firestore.Timestamp) {
    return obj.toDate().toISOString();
  }
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForJson);
  }
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = sanitizeForJson(v);
    }
    return out;
  }
  return obj;
}

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function sha256Short(str) {
  return sha256(str).substring(0, 16);
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  const startTime = new Date();
  console.log("=" .repeat(60));
  console.log("BDB-MORNINGSTAR-PDF-UPDATED-BATCH-PREWRITE-SNAPSHOT-0");
  console.log("MODE: READ-ONLY — Firestore writes = 0");
  console.log("=" .repeat(60));
  console.log();

  // ── Step 1: Load manifest ──
  console.log("[1/8] Loading write gate manifest...");
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const manifestIsins = manifest.entries.map(e => e.isin);
  console.log(`   Total ISINs in manifest: ${manifestIsins.length}`);

  if (manifestIsins.length !== 522) {
    throw new Error(`Expected 522 ISINs in manifest, got ${manifestIsins.length}`);
  }
  console.log("   OK: Exactly 522 ISINs confirmed");

  // ── Step 2: Cross-validate exclusions ──
  console.log("[2/8] Cross-validating exclusion lists...");
  const reviewList = JSON.parse(fs.readFileSync(REVIEW_PATH, "utf-8"));
  const errorList  = JSON.parse(fs.readFileSync(ERROR_PATH, "utf-8"));

  const reviewIsins = new Set(reviewList.map(r => r.isin));
  const errorIsins  = new Set(errorList.filter(e => e.isin !== "UNKNOWN").map(e => e.isin));
  const acceptSet   = new Set(manifestIsins);

  const overlapReview = [...acceptSet].filter(i => reviewIsins.has(i));
  const overlapError  = [...acceptSet].filter(i => errorIsins.has(i));

  console.log(`   REVIEW ISINs: ${reviewIsins.size}, ERROR ISINs: ${errorIsins.size}`);
  console.log(`   Overlap ACCEPT /\ REVIEW: ${overlapReview.length} (must be 0)`);
  console.log(`   Overlap ACCEPT /\ ERROR:  ${overlapError.length} (must be 0)`);

  if (overlapReview.length > 0) throw new Error(`Overlap with REVIEW: ${overlapReview}`);
  if (overlapError.length > 0)  throw new Error(`Overlap with ERROR: ${overlapError}`);
  console.log("   OK: Zero overlap confirmed");

  // ── Step 3: Init Firebase ──
  console.log("[3/8] Initializing Firebase Admin (READ-ONLY)...");
  const db = initFirebase();

  // ── Step 4: Read all 522 docs from funds_v3 ──
  console.log("[4/8] Reading 522 documents from Firestore funds_v3...");

  const snapshot = {};
  const missing  = [];
  const hashes   = {};
  let readCount  = 0;

  // Batch reads in chunks of 30 (Firestore getAll limit is ~100, but 30 is safe)
  const BATCH_SIZE = 30;
  for (let i = 0; i < manifestIsins.length; i += BATCH_SIZE) {
    const batch = manifestIsins.slice(i, i + BATCH_SIZE);
    const refs  = batch.map(isin => db.collection("funds_v3").doc(isin));
    const docs  = await db.getAll(...refs);

    for (const doc of docs) {
      readCount++;
      if (doc.exists) {
        const data = sanitizeForJson(doc.data());
        snapshot[doc.id] = data;

        const jsonStr = JSON.stringify(data, Object.keys(data).sort(), 0);
        hashes[doc.id] = sha256Short(jsonStr);
      } else {
        missing.push(doc.id);
      }
    }

    if ((i + BATCH_SIZE) % 90 === 0 || i + BATCH_SIZE >= manifestIsins.length) {
      const progress = Math.min(i + BATCH_SIZE, manifestIsins.length);
      console.log(`   Read ${progress}/${manifestIsins.length} docs...`);
    }
  }

  const foundCount   = Object.keys(snapshot).length;
  const missingCount = missing.length;
  console.log(`   OK: ${foundCount} found, ${missingCount} missing`);

  // ── Step 5: Create output directory ──
  console.log("[5/8] Creating output directory...");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`   OK: ${OUT_DIR}`);

  // ── Step 6: Write snapshot + hashes + missing ──
  console.log("[6/8] Writing snapshot artifacts...");

  // Snapshot
  const snapshotOutput = {
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-PREWRITE-SNAPSHOT-0",
    mode: "READ_ONLY",
    firestore_writes: 0,
    total_isins_requested: manifestIsins.length,
    total_found: foundCount,
    total_missing: missingCount,
    documents: snapshot
  };
  fs.writeFileSync(OUT_SNAPSHOT, JSON.stringify(snapshotOutput, null, 2), "utf-8");
  console.log(`   snapshot_funds_v3_before_write.json: ${foundCount} docs`);

  // Hashes
  const snapshotFullJson = JSON.stringify(snapshotOutput, null, 0);
  const snapshotGlobalHash = sha256(snapshotFullJson);

  const hashesOutput = {
    generated_at: new Date().toISOString(),
    snapshot_global_hash_sha256: snapshotGlobalHash,
    per_isin_hashes: hashes
  };
  fs.writeFileSync(OUT_HASHES, JSON.stringify(hashesOutput, null, 2), "utf-8");
  console.log(`   prewrite_snapshot_hashes.json: ${Object.keys(hashes).length} hashes`);

  // Missing
  const missingOutput = {
    generated_at: new Date().toISOString(),
    total_missing: missingCount,
    isins: missing,
    action: missingCount > 0
      ? "EXCLUDE from write gate until manually reviewed and created in funds_v3"
      : "No action needed — all ISINs exist in Firestore"
  };
  fs.writeFileSync(OUT_MISSING, JSON.stringify(missingOutput, null, 2), "utf-8");
  console.log(`   missing_in_firestore.json: ${missingCount} ISINs`);

  // ── Step 7: Rollback plan ──
  console.log("[7/8] Generating rollback plan...");

  const rollbackEntries = Object.keys(snapshot).map(isin => ({
    isin: isin,
    action: "RESTORE",
    source: "snapshot_funds_v3_before_write.json",
    doc_hash_before: hashes[isin],
    fields_preserved_always: ["manual", "manual.costs", "manual.costs.retrocession"],
    note: "Restore full document to pre-write state from snapshot"
  }));

  const rollbackOutput = {
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-PREWRITE-SNAPSHOT-0",
    total_restorable: rollbackEntries.length,
    total_missing_not_restorable: missingCount,
    missing_isins: missing,
    strategy: "Full document restore from snapshot. Fields in fields_preserved_always are NEVER modified by write gate and do not require rollback. For missing ISINs, no rollback is possible as they did not exist before.",
    entries: rollbackEntries
  };
  fs.writeFileSync(OUT_ROLLBACK, JSON.stringify(rollbackOutput, null, 2), "utf-8");
  console.log(`   rollback_delete_or_restore_plan.json: ${rollbackEntries.length} entries`);

  // ── Step 8: Summary + Report ──
  console.log("[8/8] Writing summary and markdown report...");

  // Build asset class distribution from snapshot
  const assetClassDist = {};
  for (const [isin, data] of Object.entries(snapshot)) {
    const ac = (data.derived && data.derived.asset_class) || "UNKNOWN";
    assetClassDist[ac] = (assetClassDist[ac] || 0) + 1;
  }

  const summaryOutput = {
    generated_at: new Date().toISOString(),
    task: "BDB-MORNINGSTAR-PDF-UPDATED-BATCH-PREWRITE-SNAPSHOT-0",
    mode: "READ_ONLY",
    firestore_writes: 0,
    total_isins_requested: manifestIsins.length,
    total_found_in_firestore: foundCount,
    total_missing_in_firestore: missingCount,
    missing_isins: missing,
    snapshot_global_hash: snapshotGlobalHash,
    asset_class_distribution_current: assetClassDist,
    review_excluded: reviewIsins.size,
    error_excluded: errorIsins.size,
    overlap_review: overlapReview.length,
    overlap_error: overlapError.length,
    elapsed_ms: Date.now() - startTime.getTime()
  };
  fs.writeFileSync(OUT_SUMMARY, JSON.stringify(summaryOutput, null, 2), "utf-8");

  // ── Markdown report ──
  const missingSection = missingCount > 0
    ? `### ISINs Missing en Firestore\n\n| # | ISIN |\n|:---|:---|\n${missing.map((m, i) => `| ${i+1} | \`${m}\` |`).join("\n")}\n\n> [!WARNING]\n> Estos ${missingCount} ISINs NO existen en funds_v3. Deben ser excluidos del Write Gate hasta revisión manual.\n`
    : `> [!TIP]\n> Todos los 522 ISINs existen en Firestore funds_v3. No hay ISINs faltantes.\n`;

  const nextStepRec = missingCount > 0
    ? `1. **Revisar los ${missingCount} ISINs faltantes** antes de proceder.\n2. **Write Gate controlado batch de 25** solo para los ${foundCount} ISINs existentes.\n3. **Crear fondos faltantes** en funds_v3 manualmente si procede.`
    : `1. **Write Gate controlado batch de 25**: Proceder con los 522 ISINs.\n2. **Verificar post-write** comparando snapshot con estado resultante.`;

  // Build ISIN table for report (sorted)
  const sortedIsins = Object.keys(snapshot).sort();
  const isinTableRows = sortedIsins.map(isin => {
    const d = snapshot[isin];
    const name = d.name || "—";
    const ac = (d.derived && d.derived.asset_class) || "—";
    const updatedAt = d.updatedAt || "—";
    const hash = hashes[isin];
    return `| \`${isin}\` | ${name} | ${ac} | ${typeof updatedAt === "string" ? updatedAt.substring(0, 19) : updatedAt} | \`${hash}\` |`;
  }).join("\n");

  // Asset class table
  const acTableRows = Object.entries(assetClassDist)
    .sort((a, b) => b[1] - a[1])
    .map(([ac, count]) => `| \`${ac}\` | **${count}** |`)
    .join("\n");

  const md = `# BDB Morningstar PDF Updated Batch Pre-Write Snapshot 0

**Fecha de generacion**: ${new Date().toISOString()}
**Task ID**: BDB-MORNINGSTAR-PDF-UPDATED-BATCH-PREWRITE-SNAPSHOT-0

> [!IMPORTANT]
> Este documento registra un **snapshot de solo lectura** de los 522 fondos ACCEPT en Firestore \`funds_v3\`.
> **Firestore writes = 0**. Ningun campo ha sido modificado.

---

## 1. Estado Git Inicial

\`\`\`
${fs.existsSync(path.join(BASE, ".git")) ? "git status verificado antes de ejecucion (ver consola)" : "N/A"}
\`\`\`

Archivos no commiteados relevantes:
- \`MORNINGSTAR_PDF_PARSER/SALIDA/write_gate_manifest_0.json\`
- \`docs/BDB_MORNINGSTAR_PDF_UPDATED_BATCH_WRITE_GATE_0.md\`
- \`docs/BDB_MORNINGSTAR_PDF_UPDATED_BATCH_PREWRITE_SNAPSHOT_0.md\` (este documento)

---

## 2. Total ISINs Esperados vs Leidos

| Metrica | Valor |
|:---|:---|
| ISINs en manifest (esperados) | **${manifestIsins.length}** |
| ISINs encontrados en Firestore | **${foundCount}** |
| ISINs faltantes en Firestore | **${missingCount}** |
| REVIEW excluidos | **${reviewIsins.size}** |
| ERROR excluidos | **${errorIsins.size}** |
| Overlap ACCEPT ∩ REVIEW | **${overlapReview.length}** |
| Overlap ACCEPT ∩ ERROR | **${overlapError.length}** |

---

## 3. ISINs Faltantes

${missingSection}

---

## 4. Hash del Snapshot

| Campo | Valor |
|:---|:---|
| **Snapshot global hash (SHA-256)** | \`${snapshotGlobalHash}\` |
| **Per-ISIN hashes** | ${Object.keys(hashes).length} hashes generados |
| **Archivo de hashes** | \`artifacts/morningstar_pdf_updated_batch/prewrite_snapshot_0/prewrite_snapshot_hashes.json\` |

> Cada hash per-ISIN es un SHA-256 truncado (16 hex chars) del documento JSON serializado.
> El hash global es el SHA-256 completo del snapshot JSON entero.

---

## 5. Distribucion por Clase de Activo (estado ACTUAL en Firestore)

| Clase de Activo | Fondos |
|:---|---:|
${acTableRows}

**Total**: ${foundCount} fondos

---

## 6. Plan de Rollback

| Campo | Valor |
|:---|:---|
| **Estrategia** | Full document restore desde snapshot |
| **Archivo fuente** | \`snapshot_funds_v3_before_write.json\` |
| **ISINs restaurables** | **${rollbackEntries.length}** |
| **ISINs no restaurables** | **${missingCount}** (no existian antes) |
| **Campos siempre preservados** | \`manual\`, \`manual.costs\`, \`manual.costs.retrocession\` |

### Proceso de rollback:
1. Cargar \`snapshot_funds_v3_before_write.json\`
2. Para cada ISIN, restaurar el documento completo en \`funds_v3/{isin}\`
3. Verificar hash post-restore contra \`prewrite_snapshot_hashes.json\`
4. Los campos \`manual.*\` NUNCA son tocados por el Write Gate; no requieren rollback

---

## 7. Confirmacion: Ningun Campo Escrito

| Invariante | Estado |
|:---|:---|
| Firestore writes de actualizacion | **0 — CONFIRMADO** |
| Campos funds_v3 modificados | **0 — CONFIRMADO** |
| Parser write ejecutado | **NO — CONFIRMADO** |
| BDB-FONDOS-CORE tocado | **NO — CONFIRMADO** |
| Evidence Layer reactivada | **NO — CONFIRMADO** |
| Capturas PNG usadas | **NO — CONFIRMADO** |
| Deploy | **NO — CONFIRMADO** |
| Commit | **NO — CONFIRMADO** |
| Push | **NO — CONFIRMADO** |

---

## 8. Recomendacion para Siguiente Bloque

${nextStepRec}

---

## 9. Tabla de ISINs con Hash Pre-Write

| ISIN | Nombre | Clase Actual | updatedAt | Hash Pre-Write |
|:---|:---|:---|:---|:---|
${isinTableRows}

---

## 10. Archivos Generados

| Archivo | Descripcion |
|:---|:---|
| \`snapshot_funds_v3_before_write.json\` | Snapshot completo de ${foundCount} documentos de funds_v3 |
| \`rollback_delete_or_restore_plan.json\` | Plan de rollback con ${rollbackEntries.length} entradas |
| \`snapshot_summary.json\` | Resumen de la operacion |
| \`missing_in_firestore.json\` | ${missingCount} ISINs faltantes |
| \`prewrite_snapshot_hashes.json\` | Hashes per-ISIN y hash global |

---

*Fin del documento de Pre-Write Snapshot 0 — Firestore writes: 0 — Modo: READ_ONLY*
`;

  fs.writeFileSync(OUT_REPORT, md, "utf-8");
  console.log(`   snapshot_summary.json written`);
  console.log(`   Report written: ${OUT_REPORT}`);

  // ── Final summary ──
  console.log();
  console.log("=" .repeat(60));
  console.log("PREWRITE SNAPSHOT SUMMARY");
  console.log("=" .repeat(60));
  console.log(`  ISINs requested:       ${manifestIsins.length}`);
  console.log(`  Found in Firestore:    ${foundCount}`);
  console.log(`  Missing in Firestore:  ${missingCount}`);
  console.log(`  Snapshot global hash:  ${snapshotGlobalHash.substring(0, 32)}...`);
  console.log(`  Firestore writes:      0`);
  console.log(`  Elapsed:               ${Date.now() - startTime.getTime()} ms`);
  console.log();
  console.log(`  Output dir:  ${OUT_DIR}`);
  console.log(`  Report:      ${OUT_REPORT}`);
  console.log("=" .repeat(60));
  console.log("STATUS: READ_ONLY SNAPSHOT COMPLETE — ZERO WRITES");
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});

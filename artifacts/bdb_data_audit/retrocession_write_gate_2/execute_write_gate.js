#!/usr/bin/env node
"use strict";

/**
 * BDB-RETRO-IMPORT-2-WRITE-GATE
 *
 * Controlled write of approved retrocession updates to funds_v3.
 * Updates ONLY manual.costs.retrocession using Firestore update (not set).
 *
 * Safety:
 * - Explicit approved ISIN list (44 items)
 * - Explicit excluded ISINs (3 items)
 * - Pre-write snapshot
 * - Rollback manifest
 * - Post-write verification
 * - No document creation
 * - No destructive set
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// ===== CONFIGURATION =====
const PROJECT_ID = "bdb-fondos";
const COLLECTION = "funds_v3";
const OUTPUT_DIR = path.resolve(__dirname);

// 3 excluded ISINs - DO NOT WRITE
const EXCLUDE_KEEP_DB = ["IE00BYR8H148", "LU0235308482", "LU1762221155"];

// ===== LOAD APPROVED LIST FROM DRY-RUN ARTIFACT =====
function loadApprovedList() {
  const artifactPath = path.resolve(
    __dirname,
    "..",
    "retrocession_reload_dry_run_real_1",
    "retrocession_reload_dry_run.json"
  );
  const data = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const detail = data.detail;

  const writable = detail.filter(
    (r) =>
      (r.status === "UPDATE_CONFIRMED" || r.status === "LARGE_CHANGE_REVIEW") &&
      !EXCLUDE_KEEP_DB.includes(r.isin)
  );

  return writable.map((r) => ({
    isin: r.isin,
    current_retrocession: r.current_retrocession,
    new_retrocession: r.new_retrocession,
    delta: r.delta,
    status: r.status,
    name: r.name || "",
  }));
}

async function main() {
  const approved = loadApprovedList();

  // === GATE CHECK ===
  if (approved.length !== 44) {
    console.error(`ABORT: Expected 44 approved ISINs, got ${approved.length}`);
    process.exit(1);
  }

  for (const ex of EXCLUDE_KEEP_DB) {
    if (approved.some((a) => a.isin === ex)) {
      console.error(`ABORT: Excluded ISIN ${ex} found in approved list!`);
      process.exit(1);
    }
  }

  console.log(`Write gate: ${approved.length} ISINs approved, ${EXCLUDE_KEEP_DB.length} excluded`);

  // === INIT FIREBASE ===
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const db = admin.firestore();

  // === STEP 3: PRE-WRITE SNAPSHOT ===
  console.log("\n--- STEP 3: Pre-write snapshot ---");
  const snapshot = { timestamp: new Date().toISOString(), approved: [], excluded_keep_db: [] };

  for (const item of approved) {
    const doc = await db.collection(COLLECTION).doc(item.isin).get();
    if (!doc.exists) {
      console.error(`ABORT: Document ${item.isin} does not exist in ${COLLECTION}!`);
      process.exit(1);
    }
    const data = doc.data();
    snapshot.approved.push({
      isin: item.isin,
      name: data?.name || data?.nombre || data?.metadata?.name || data?.ms?.name || "",
      manual_costs: data?.manual?.costs || null,
      current_retrocession: data?.manual?.costs?.retrocession ?? null,
      new_retrocession: item.new_retrocession,
      write_executed: false,
    });
  }

  // Read excluded ISINs for verification
  for (const isin of EXCLUDE_KEEP_DB) {
    const doc = await db.collection(COLLECTION).doc(isin).get();
    const data = doc.exists ? doc.data() : null;
    snapshot.excluded_keep_db.push({
      isin,
      exists: doc.exists,
      current_retrocession: data?.manual?.costs?.retrocession ?? null,
      action: "KEEP_DB_VALUE_NO_WRITE",
    });
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "pre_write_snapshot.json"),
    JSON.stringify(snapshot, null, 2),
    "utf-8"
  );
  console.log(`Snapshot saved: ${snapshot.approved.length} approved, ${snapshot.excluded_keep_db.length} excluded`);

  // === STEP 4: WRITE PLAN ===
  console.log("\n--- STEP 4: Write plan ---");
  const writePlan = {
    generated_at: new Date().toISOString(),
    approved_count: 44,
    exclude_keep_db_value_count: 3,
    excluded_not_found_count: 44,
    ignored_non_standard_count: 8,
    unchanged_no_write_count: 191,
    field_updated: "manual.costs.retrocession",
    update_method: "firestore.update (not set)",
    scale: "direct percentage points",
    excluded_keep_db_value: EXCLUDE_KEEP_DB.map((isin) => {
      const ex = snapshot.excluded_keep_db.find((e) => e.isin === isin);
      return { isin, current_retrocession: ex?.current_retrocession, action: "retained" };
    }),
    writes: approved.map((a) => ({
      isin: a.isin,
      current_retrocession: a.current_retrocession,
      new_retrocession: a.new_retrocession,
      delta: a.delta,
      action: "update manual.costs.retrocession",
    })),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "write_plan.json"),
    JSON.stringify(writePlan, null, 2),
    "utf-8"
  );
  console.log("Write plan saved");

  // === STEP 5: ROLLBACK MANIFEST ===
  console.log("\n--- STEP 5: Rollback manifest ---");
  const rollback = {
    generated_at: new Date().toISOString(),
    purpose: "Restore manual.costs.retrocession to pre-write values if needed",
    excluded_keep_db_value: EXCLUDE_KEEP_DB.map((isin) => {
      const ex = snapshot.excluded_keep_db.find((e) => e.isin === isin);
      return { isin, current_retrocession: ex?.current_retrocession, action: "NOT_WRITTEN_NO_ROLLBACK_NEEDED" };
    }),
    rollback_entries: snapshot.approved.map((s) => ({
      isin: s.isin,
      previous_retrocession: s.current_retrocession,
      written_retrocession: s.new_retrocession,
      rollback_action: "update manual.costs.retrocession to previous_retrocession",
      write_executed: false,
    })),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "rollback_manifest.json"),
    JSON.stringify(rollback, null, 2),
    "utf-8"
  );
  console.log("Rollback manifest saved");

  // === STEP 6: EXECUTE WRITE ===
  console.log("\n--- STEP 6: Execute write ---");
  let writeCount = 0;
  const writeResults = [];

  for (const item of approved) {
    try {
      await db.collection(COLLECTION).doc(item.isin).update({
        "manual.costs.retrocession": item.new_retrocession,
      });
      writeCount++;
      writeResults.push({ isin: item.isin, status: "WRITTEN", new_value: item.new_retrocession });
      // Update rollback manifest
      const re = rollback.rollback_entries.find((r) => r.isin === item.isin);
      if (re) re.write_executed = true;
    } catch (error) {
      writeResults.push({ isin: item.isin, status: "ERROR", error: error.message });
      console.error(`ERROR writing ${item.isin}: ${error.message}`);
    }
  }

  // Save updated rollback manifest
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "rollback_manifest.json"),
    JSON.stringify(rollback, null, 2),
    "utf-8"
  );

  console.log(`Writes completed: ${writeCount}/${approved.length}`);

  if (writeCount !== 44) {
    console.error(`WARNING: Expected 44 writes, got ${writeCount}`);
  }

  // === STEP 7: POST-WRITE VERIFICATION ===
  console.log("\n--- STEP 7: Post-write verification ---");
  const verification = {
    timestamp: new Date().toISOString(),
    approved_verified: [],
    excluded_verified: [],
    pass_count: 0,
    fail_count: 0,
  };

  for (const item of approved) {
    const doc = await db.collection(COLLECTION).doc(item.isin).get();
    const data = doc.data();
    const actual = data?.manual?.costs?.retrocession;
    const expected = item.new_retrocession;
    const tolerance = 1e-9;
    const pass = Math.abs((actual ?? -999) - expected) < tolerance;

    verification.approved_verified.push({
      isin: item.isin,
      expected: expected,
      actual: actual,
      pass: pass,
    });

    if (pass) {
      verification.pass_count++;
    } else {
      verification.fail_count++;
      console.error(`VERIFY FAIL: ${item.isin} expected=${expected} actual=${actual}`);
    }
  }

  // Verify excluded ISINs unchanged
  for (const isin of EXCLUDE_KEEP_DB) {
    const doc = await db.collection(COLLECTION).doc(isin).get();
    const data = doc.data();
    const actual = data?.manual?.costs?.retrocession;
    const prePre = snapshot.excluded_keep_db.find((e) => e.isin === isin);
    const expected = prePre?.current_retrocession;
    const pass = actual === expected;

    verification.excluded_verified.push({
      isin,
      expected_unchanged: expected,
      actual: actual,
      pass: pass,
    });

    if (!pass) {
      console.error(`EXCLUDED VERIFY FAIL: ${isin} was changed! expected=${expected} actual=${actual}`);
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "post_write_verification.json"),
    JSON.stringify(verification, null, 2),
    "utf-8"
  );

  console.log(`\nVerification: ${verification.pass_count}/44 PASS, ${verification.fail_count} FAIL`);
  console.log(`Excluded: ${verification.excluded_verified.filter((e) => e.pass).length}/3 unchanged`);
  console.log("\nDone. Write gate complete.");

  process.exit(verification.fail_count > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const {
  ensureDir,
  findForbiddenParserFields,
  getPath,
  normalizeIsin,
  readJson,
  writeJson,
} = require("../src/lib/write_gate");

const repoRoot = path.resolve(__dirname, "..", "..");
const DEFAULT_COLLECTION = "funds_v3";
const FORBIDDEN_PATHS = [
  "manual",
  "manual.costs",
  "manual.costs.retrocession",
  "portfolio_exposure_v2.economic_exposure",
];
const SERVER_TIMESTAMP_FIELDS = new Set(["quality.parsed_at", "updatedAt"]);

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    write: false,
    confirmWrite: false,
    approvedIsins: [],
    approvalManifest: null,
    rollbackManifest: null,
    diffManifest: null,
    snapshotManifest: null,
    postWriteVerificationPlan: null,
    outputDir: "artifacts/bdb_parser_audit/first_write_1",
    maxWriteCandidates: null,
    collection: DEFAULT_COLLECTION,
    project: "bdb-fondos",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "--write":
        args.write = true;
        break;
      case "--confirm-write":
        args.confirmWrite = true;
        break;
      case "--approve-isin":
        args.approvedIsins.push(...splitList(argv[++index]));
        break;
      case "--approval-manifest":
        args.approvalManifest = argv[++index];
        break;
      case "--rollback-manifest":
        args.rollbackManifest = argv[++index];
        break;
      case "--diff-manifest":
        args.diffManifest = argv[++index];
        break;
      case "--snapshot-manifest":
        args.snapshotManifest = argv[++index];
        break;
      case "--post-write-verification-plan":
        args.postWriteVerificationPlan = argv[++index];
        break;
      case "--output-dir":
        args.outputDir = argv[++index];
        break;
      case "--max-write-candidates":
        args.maxWriteCandidates = Number(argv[++index]);
        break;
      case "--collection":
        args.collection = argv[++index];
        break;
      case "--project":
        args.project = argv[++index];
        break;
      default:
        throw new Error(`UNKNOWN_ARG: ${token}`);
    }
  }

  args.approvedIsins = args.approvedIsins.map(normalizeIsin).filter(Boolean);
  if (!args.write || !args.confirmWrite) {
    throw new Error("WRITE_BLOCKED: controlled write requires --write and --confirm-write.");
  }
  if (!args.approvalManifest) throw new Error("MISSING_ARG: --approval-manifest");
  if (!args.rollbackManifest) throw new Error("MISSING_ARG: --rollback-manifest");
  if (!args.diffManifest) throw new Error("MISSING_ARG: --diff-manifest");
  if (!args.snapshotManifest) throw new Error("MISSING_ARG: --snapshot-manifest");
  if (!args.postWriteVerificationPlan) {
    throw new Error("MISSING_ARG: --post-write-verification-plan");
  }
  if (!Number.isFinite(args.maxWriteCandidates) || args.maxWriteCandidates <= 0) {
    throw new Error("INVALID_ARG: --max-write-candidates must be a positive number");
  }
  if (args.approvedIsins.length === 0) {
    throw new Error("MISSING_ARG: at least one --approve-isin is required");
  }
  if (new Set(args.approvedIsins).size !== args.approvedIsins.length) {
    throw new Error("DUPLICATE_APPROVED_ISIN");
  }
  if (args.approvedIsins.length > args.maxWriteCandidates) {
    throw new Error("APPROVED_ISINS_EXCEED_MAX_WRITE_CANDIDATES");
  }

  return args;
}

function resolveFromRepo(value) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!isPlainObject(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function valuesEqual(a, b) {
  return stableJson(a) === stableJson(b);
}

function isEmptyObject(value) {
  return isPlainObject(value) && Object.keys(value).length === 0;
}

function loadInputs(args) {
  return {
    approvalManifest: readJson(resolveFromRepo(args.approvalManifest)),
    rollbackManifest: readJson(resolveFromRepo(args.rollbackManifest)),
    diffManifest: readJson(resolveFromRepo(args.diffManifest)),
    snapshotManifest: readJson(resolveFromRepo(args.snapshotManifest)),
    postWriteVerificationPlan: readJson(resolveFromRepo(args.postWriteVerificationPlan)),
  };
}

function indexByIsin(entries) {
  const byIsin = new Map();
  for (const entry of entries || []) {
    const isin = normalizeIsin(entry.isin);
    if (isin) byIsin.set(isin, entry);
  }
  return byIsin;
}

function hasForbiddenPath(pathName) {
  return FORBIDDEN_PATHS.some(
    (forbidden) => pathName === forbidden || pathName.startsWith(`${forbidden}.`)
  );
}

function validateRestrictedPrecheck({ args, inputs, timestamp }) {
  const approvedSet = new Set(args.approvedIsins);
  const approvalByIsin = indexByIsin(inputs.approvalManifest.candidates);
  const rollbackByIsin = indexByIsin(inputs.rollbackManifest.entries);
  const diffByIsin = indexByIsin(inputs.diffManifest.entries);
  const snapshotByIsin = indexByIsin(inputs.snapshotManifest.entries);
  const postPlanSet = new Set((inputs.postWriteVerificationPlan.candidates || []).map(normalizeIsin));
  const errors = [];
  const warnings = [];
  const selected = [];

  if (args.approvedIsins.length !== args.maxWriteCandidates) {
    errors.push("approved_isins_must_equal_max_write_candidates_for_first_write");
  }

  for (const entry of inputs.approvalManifest.candidates || []) {
    const isin = normalizeIsin(entry.isin);
    if (!approvedSet.has(isin)) {
      warnings.push(`candidate_restricted_out:${isin}`);
    }
  }

  for (const blocked of inputs.approvalManifest.blocked || []) {
    if (approvedSet.has(normalizeIsin(blocked.isin))) {
      errors.push(`approved_isin_is_blocked:${blocked.isin}`);
    }
  }
  for (const review of inputs.approvalManifest.excluded_review || []) {
    if (approvedSet.has(normalizeIsin(review.isin))) {
      errors.push(`approved_isin_is_review_without_gate_approval:${review.isin}`);
    }
  }

  for (const isin of args.approvedIsins) {
    const approvalEntry = approvalByIsin.get(isin);
    const rollbackEntry = rollbackByIsin.get(isin);
    const diffEntry = diffByIsin.get(isin);
    const snapshotEntry = snapshotByIsin.get(isin);

    if (!approvalEntry) errors.push(`missing_approval_candidate:${isin}`);
    if (!rollbackEntry) errors.push(`missing_rollback_entry:${isin}`);
    if (!diffEntry) errors.push(`missing_diff_entry:${isin}`);
    if (!snapshotEntry) errors.push(`missing_snapshot_entry:${isin}`);
    if (!postPlanSet.has(isin)) errors.push(`missing_post_write_plan_candidate:${isin}`);

    if (!diffEntry) continue;
    if (diffEntry.decision !== "WRITE_CANDIDATE") {
      errors.push(`not_write_candidate:${isin}:${diffEntry.decision}`);
    }
    if (diffEntry.policy_status === "BLOCKED") {
      errors.push(`policy_blocked:${isin}`);
    }
    if (diffEntry.policy_status === "REVIEW") {
      errors.push(`review_not_allowed_in_first_write:${isin}`);
    }
    if (!snapshotEntry || snapshotEntry.document_exists !== true) {
      errors.push(`snapshot_document_missing:${isin}`);
    }
    if (!rollbackEntry || rollbackEntry.snapshot_available !== true) {
      errors.push(`rollback_snapshot_missing:${isin}`);
    }
    if (!rollbackEntry || !rollbackEntry.current_firestore_doc_snapshot) {
      errors.push(`rollback_full_snapshot_missing:${isin}`);
    }

    const proposedPayload = diffEntry.proposed_payload || {};
    const forbiddenInPayload = findForbiddenParserFields(proposedPayload);
    if (forbiddenInPayload.length) {
      errors.push(`forbidden_fields_in_payload:${isin}:${forbiddenInPayload.join(",")}`);
    }

    const diff = diffEntry.diff || {};
    const forbiddenInDiff = diff.forbidden_fields_detected || [];
    if (forbiddenInDiff.length) {
      errors.push(`forbidden_fields_in_diff:${isin}:${forbiddenInDiff.join(",")}`);
    }
    for (const field of diff.changed_fields || []) {
      if (hasForbiddenPath(field.path)) {
        errors.push(`forbidden_changed_field:${isin}:${field.path}`);
      }
      if (field.proposed_value === undefined) {
        errors.push(`undefined_proposed_value:${isin}:${field.path}`);
      }
    }

    selected.push({
      isin,
      policy_status: diffEntry.policy_status,
      changed_fields: (diff.changed_fields || []).map((field) => field.path),
      warning_count: (diffEntry.warnings || []).length,
    });
  }

  return {
    timestamp,
    ok: errors.length === 0,
    errors,
    warnings,
    approved_isins: args.approvedIsins,
    max_write_candidates: args.maxWriteCandidates,
    selected,
  };
}

function buildUpdatePatch(diffEntry, serverTimestampFactory) {
  const patch = {};
  const appliedFields = [];
  for (const field of diffEntry.diff.changed_fields || []) {
    if (hasForbiddenPath(field.path)) {
      throw new Error(`FORBIDDEN_CHANGED_FIELD:${diffEntry.isin}:${field.path}`);
    }
    let value = field.proposed_value;
    let appliedValueKind = "literal";
    if (SERVER_TIMESTAMP_FIELDS.has(field.path) && isEmptyObject(value)) {
      value = serverTimestampFactory();
      appliedValueKind = "server_timestamp";
    }
    if (value === undefined) {
      throw new Error(`UNDEFINED_PROPOSED_VALUE:${diffEntry.isin}:${field.path}`);
    }
    patch[field.path] = value;
    appliedFields.push({
      path: field.path,
      applied_value_kind: appliedValueKind,
      current_value: field.current_value,
      proposed_value: field.proposed_value,
    });
  }
  return { patch, appliedFields };
}

function serializeFirestoreData(data) {
  if (!data) return null;
  return JSON.parse(JSON.stringify(data));
}

function initFirestore(projectId) {
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectId || undefined,
    });
  }
  return { admin, db: admin.firestore() };
}

function assetMixSum(assetMix) {
  if (!isPlainObject(assetMix)) return null;
  let sum = 0;
  let count = 0;
  for (const key of ["equity", "fixed_income", "bond", "cash", "other"]) {
    const value = assetMix[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      sum += value;
      count += 1;
    }
  }
  return count ? sum : null;
}

function verifyPostWrite({ isin, beforeSnapshot, afterDoc, diffEntry }) {
  const failures = [];
  const changedFieldChecks = [];
  const afterData = serializeFirestoreData(afterDoc);
  const beforeData = beforeSnapshot.current_firestore_doc_snapshot;

  for (const field of diffEntry.diff.changed_fields || []) {
    const actual = getPath(afterData, field.path);
    const expected = field.proposed_value;
    let ok = false;
    let mode = "literal";
    if (SERVER_TIMESTAMP_FIELDS.has(field.path) && isEmptyObject(expected)) {
      ok = isPlainObject(actual) && typeof actual._seconds === "number";
      mode = "server_timestamp";
    } else {
      ok = valuesEqual(actual, expected);
    }
    if (!ok) failures.push(`changed_field_mismatch:${field.path}`);
    changedFieldChecks.push({ path: field.path, ok, mode });
  }

  const preservedChecks = [];
  for (const fieldPath of FORBIDDEN_PATHS) {
    const beforeValue = getPath(beforeData, fieldPath);
    const afterValue = getPath(afterData, fieldPath);
    const ok = valuesEqual(beforeValue, afterValue);
    if (!ok) failures.push(`preserved_field_changed:${fieldPath}`);
    preservedChecks.push({ path: fieldPath, ok });
  }

  const sum = assetMixSum(getPath(afterData, "portfolio_exposure_v2.asset_mix"));
  const assetMixOk = sum == null || (sum >= 0.95 && sum <= 1.05);
  if (!assetMixOk) failures.push(`asset_mix_sum_invalid:${sum}`);

  return {
    isin,
    ok: failures.length === 0,
    failures,
    changed_field_checks: changedFieldChecks,
    preserved_field_checks: preservedChecks,
    asset_mix_sum: sum,
    asset_mix_sum_valid: assetMixOk,
  };
}

async function executeControlledWrite({ args, inputs, precheck, outputDir }) {
  const timestamp = new Date().toISOString();
  const { admin, db } = initFirestore(args.project);
  const diffByIsin = indexByIsin(inputs.diffManifest.entries);
  const rollbackByIsin = indexByIsin(inputs.rollbackManifest.entries);
  const writtenIsins = [];
  const skippedIsins = [];
  const appliedDiff = [];
  const postVerifications = [];
  let writeExecuted = false;

  for (const isin of args.approvedIsins) {
    const diffEntry = diffByIsin.get(isin);
    const rollbackEntry = rollbackByIsin.get(isin);
    const { patch, appliedFields } = buildUpdatePatch(diffEntry, () =>
      admin.firestore.FieldValue.serverTimestamp()
    );

    const docRef = db.collection(args.collection).doc(isin);
    await docRef.update(patch);
    writeExecuted = true;
    writtenIsins.push(isin);
    appliedDiff.push({
      isin,
      policy_status: diffEntry.policy_status,
      changed_fields: appliedFields,
    });

    const afterSnapshot = await docRef.get();
    if (!afterSnapshot.exists) {
      postVerifications.push({
        isin,
        ok: false,
        failures: ["document_missing_after_write"],
      });
      break;
    }
    const verification = verifyPostWrite({
      isin,
      beforeSnapshot: rollbackEntry,
      afterDoc: afterSnapshot.data() || {},
      diffEntry,
    });
    postVerifications.push(verification);
    if (!verification.ok) break;
  }

  for (const isin of args.approvedIsins) {
    if (!writtenIsins.includes(isin)) skippedIsins.push(isin);
  }

  const postOk =
    writtenIsins.length === args.approvedIsins.length &&
    postVerifications.every((entry) => entry.ok);

  const executionManifest = {
    timestamp,
    operator_process: "BDB-PARSER-FIRST-WRITE-1 controlled CLI",
    collection: args.collection,
    dry_run: false,
    write_executed: writeExecuted,
    written_isins: writtenIsins,
    skipped_isins: skippedIsins,
    approved_isins: args.approvedIsins,
    max_write_candidates: args.maxWriteCandidates,
    precheck_result: precheck,
    post_write_verification_result: postOk ? "PASS" : "FAIL",
    rollback_available: true,
  };

  writeJson(path.join(outputDir, "first_write_execution_manifest.json"), executionManifest);
  writeJson(path.join(outputDir, "first_write_applied_diff.json"), {
    timestamp,
    write_executed: writeExecuted,
    written_isins: writtenIsins,
    applied_diff: appliedDiff,
  });
  writeJson(path.join(outputDir, "first_write_post_verification.json"), {
    timestamp,
    write_executed: writeExecuted,
    ok: postOk,
    results: postVerifications,
  });
  writeJson(path.join(outputDir, "first_write_rollback_manifest.json"), {
    timestamp,
    write_executed: writeExecuted,
    rollback_available: true,
    entries: args.approvedIsins.map((isin) => rollbackByIsin.get(isin)),
  });

  return { executionManifest, postVerifications, appliedDiff };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = resolveFromRepo(args.outputDir);
  ensureDir(outputDir);

  const inputs = loadInputs(args);
  const precheck = validateRestrictedPrecheck({
    args,
    inputs,
    timestamp: new Date().toISOString(),
  });

  writeJson(path.join(outputDir, "first_write_precheck.json"), {
    dry_run: false,
    write_executed: false,
    precheck_result: precheck,
  });

  if (!precheck.ok) {
    writeJson(path.join(outputDir, "first_write_execution_manifest.json"), {
      timestamp: new Date().toISOString(),
      dry_run: false,
      write_executed: false,
      written_isins: [],
      skipped_isins: args.approvedIsins,
      precheck_result: precheck,
      post_write_verification_result: "NOT_RUN",
      rollback_available: true,
    });
    throw new Error(`FIRST_WRITE_PRECHECK_FAILED: ${precheck.errors.join("; ")}`);
  }

  const result = await executeControlledWrite({ args, inputs, precheck, outputDir });
  console.log("FIRST_WRITE_CONTROLLED_EXECUTION_COMPLETE");
  console.log(`write_executed=${result.executionManifest.write_executed}`);
  console.log(`written_isins=${result.executionManifest.written_isins.join(",")}`);
  console.log(`skipped_isins=${result.executionManifest.skipped_isins.join(",")}`);
  console.log(`post_write_verification=${result.executionManifest.post_write_verification_result}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  SERVER_TIMESTAMP_FIELDS,
  buildUpdatePatch,
  parseArgs,
  validateRestrictedPrecheck,
  verifyPostWrite,
};

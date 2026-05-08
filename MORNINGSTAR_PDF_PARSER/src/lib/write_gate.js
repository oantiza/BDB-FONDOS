"use strict";

const fs = require("fs");
const path = require("path");

const DECISIONS = Object.freeze({
  WRITE_CANDIDATE: "WRITE_CANDIDATE",
  REVIEW_REQUIRES_EXPLICIT_APPROVAL: "REVIEW_REQUIRES_EXPLICIT_APPROVAL",
  BLOCKED_NEVER_WRITE: "BLOCKED_NEVER_WRITE",
  SKIP_NO_CHANGE: "SKIP_NO_CHANGE",
  SKIP_POLICY: "SKIP_POLICY",
  SKIP_FORBIDDEN_FIELD: "SKIP_FORBIDDEN_FIELD",
  SKIP_MISSING_SNAPSHOT: "SKIP_MISSING_SNAPSHOT",
  SKIP_DIFF_EMPTY: "SKIP_DIFF_EMPTY",
});

const FORBIDDEN_PATHS = Object.freeze([
  "manual",
  "manual.costs",
  "manual.costs.retrocession",
  "portfolio_exposure_v2.economic_exposure",
]);

const ALLOWED_POLICY_STATUSES = new Set(["ACCEPT", "ACCEPT_WITH_WARNINGS", "REVIEW", "BLOCKED"]);

function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

function readJson(filePath) {
  return JSON.parse(stripBom(fs.readFileSync(filePath, "utf8")));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeIsin(isin) {
  return String(isin || "").trim().toUpperCase();
}

function getPath(value, dottedPath) {
  if (!isPlainObject(value)) return undefined;
  if (Object.prototype.hasOwnProperty.call(value, dottedPath)) return value[dottedPath];

  let current = value;
  for (const part of dottedPath.split(".")) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function hasPath(value, dottedPath) {
  if (!isPlainObject(value)) return false;
  if (Object.prototype.hasOwnProperty.call(value, dottedPath)) return true;

  let current = value;
  for (const part of dottedPath.split(".")) {
    if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

function flattenObject(value, prefix = "") {
  const result = {};
  if (!isPlainObject(value)) return result;

  for (const [key, child] of Object.entries(value)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child)) {
      const nested = flattenObject(child, nextPath);
      if (Object.keys(nested).length === 0) {
        result[nextPath] = child;
      } else {
        Object.assign(result, nested);
      }
    } else {
      result[nextPath] = child;
    }
  }
  return result;
}

function sortForStableJson(value) {
  if (Array.isArray(value)) return value.map(sortForStableJson);
  if (!isPlainObject(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortForStableJson(value[key]);
      return acc;
    }, {});
}

function stableJson(value) {
  return JSON.stringify(sortForStableJson(value));
}

function valuesEqual(a, b) {
  return stableJson(a) === stableJson(b);
}

function findForbiddenParserFields(payload) {
  if (!isPlainObject(payload)) return [];

  const found = new Set();
  for (const forbiddenPath of FORBIDDEN_PATHS) {
    if (hasPath(payload, forbiddenPath)) {
      found.add(forbiddenPath);
    }
  }

  const flat = flattenObject(payload);
  for (const fieldPath of Object.keys(flat)) {
    if (fieldPath === "manual" || fieldPath.startsWith("manual.")) {
      found.add(fieldPath);
    }
    if (fieldPath === "portfolio_exposure_v2.economic_exposure") {
      found.add(fieldPath);
    }
    if (fieldPath.startsWith("portfolio_exposure_v2.economic_exposure.")) {
      found.add(fieldPath);
    }
  }

  for (const topLevelKey of Object.keys(payload)) {
    if (topLevelKey === "manual" || topLevelKey.startsWith("manual.")) {
      found.add(topLevelKey);
    }
    if (
      topLevelKey === "portfolio_exposure_v2.economic_exposure" ||
      topLevelKey.startsWith("portfolio_exposure_v2.economic_exposure.")
    ) {
      found.add(topLevelKey);
    }
  }

  return Array.from(found).sort();
}

function assertNoForbiddenParserFields(payload) {
  const forbiddenFields = findForbiddenParserFields(payload);
  if (forbiddenFields.length > 0) {
    throw new Error(`PARSER_WRITE_GATE_FORBIDDEN_FIELDS: ${forbiddenFields.join(", ")}`);
  }
  return true;
}

function extractProposedPayloads(parserArtifact) {
  const source = parserArtifact && parserArtifact.proposed_payload_by_isin;
  if (!isPlainObject(source)) return {};

  const byIsin = {};
  for (const [isin, payload] of Object.entries(source)) {
    const normalized = normalizeIsin(isin || (payload && payload.isin));
    if (normalized) byIsin[normalized] = payload;
  }
  return byIsin;
}

function normalizeWarnings(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return [];
  return String(value)
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function classificationRows(classificationArtifact) {
  if (Array.isArray(classificationArtifact)) return classificationArtifact;
  if (classificationArtifact && Array.isArray(classificationArtifact.rows)) {
    return classificationArtifact.rows;
  }
  if (classificationArtifact && isPlainObject(classificationArtifact.classification_by_isin)) {
    return Object.entries(classificationArtifact.classification_by_isin).map(([isin, row]) => ({
      isin,
      ...row,
    }));
  }
  return [];
}

function normalizeClassificationByIsin(classificationArtifact) {
  const byIsin = {};
  for (const row of classificationRows(classificationArtifact)) {
    const isin = normalizeIsin(row.isin || row.ISIN);
    if (!isin) continue;
    const status = String(row.policy_status || row.status || row.verdict || "").trim().toUpperCase();
    byIsin[isin] = {
      ...row,
      isin,
      policy_status: status,
      policy_reason: row.policy_reason || row.reason || "",
      warnings: normalizeWarnings(row.warnings),
    };
  }
  return byIsin;
}

function isSnapshotRecord(value) {
  return (
    isPlainObject(value) &&
    (Object.prototype.hasOwnProperty.call(value, "current_firestore_doc") ||
      Object.prototype.hasOwnProperty.call(value, "document_exists") ||
      Object.prototype.hasOwnProperty.call(value, "data"))
  );
}

function normalizeCurrentDocsByIsin(currentDocsByIsin) {
  const normalized = {};
  for (const [isin, record] of Object.entries(currentDocsByIsin || {})) {
    const key = normalizeIsin(isin || (record && record.isin));
    if (!key) continue;

    if (isSnapshotRecord(record)) {
      const currentDoc =
        record.document_exists === false
          ? null
          : record.current_firestore_doc || record.data || null;
      normalized[key] = {
        ...record,
        isin: key,
        document_exists: Boolean(currentDoc),
        document_id: record.document_id || record.id || key,
        source: record.source || "provided_snapshot",
        timestamp: record.timestamp || null,
        dry_run: record.dry_run !== false,
        write_executed: false,
        current_firestore_doc: currentDoc,
      };
      continue;
    }

    normalized[key] = {
      isin: key,
      document_exists: Boolean(record),
      document_id: key,
      source: "provided_current_doc",
      timestamp: null,
      dry_run: true,
      write_executed: false,
      current_firestore_doc: record,
    };
  }
  return normalized;
}

function buildDiff(currentDoc, proposedPayload) {
  const changedFields = [];
  const unchangedFields = [];
  const proposedFlat = flattenObject(proposedPayload || {});
  const forbiddenFieldsDetected = findForbiddenParserFields(proposedPayload || {});

  for (const fieldPath of Object.keys(proposedFlat).sort()) {
    const proposedValue = proposedFlat[fieldPath];
    const currentValue = getPath(currentDoc || {}, fieldPath);
    if (valuesEqual(currentValue, proposedValue)) {
      unchangedFields.push(fieldPath);
    } else {
      changedFields.push({
        path: fieldPath,
        current_value: currentValue === undefined ? null : currentValue,
        proposed_value: proposedValue,
      });
    }
  }

  return {
    changed_fields: changedFields,
    unchanged_fields: unchangedFields,
    forbidden_fields_detected: forbiddenFieldsDetected,
    manual_fields_current_preserved: hasPath(currentDoc || {}, "manual"),
    manual_costs_retrocession_current_preserved: hasPath(
      currentDoc || {},
      "manual.costs.retrocession"
    ),
    economic_exposure_current_preserved: hasPath(
      currentDoc || {},
      "portfolio_exposure_v2.economic_exposure"
    ),
    fields_preserved: [
      "manual",
      "manual.costs",
      "manual.costs.retrocession",
      "portfolio_exposure_v2.economic_exposure",
    ],
  };
}

function makeEntry({
  isin,
  policyRow,
  payload,
  currentDoc,
  currentSnapshotRecord = null,
  decision,
  reason,
  diff = null,
  approved = false,
}) {
  const policyStatus = policyRow ? policyRow.policy_status : "";
  const warnings = policyRow ? policyRow.warnings : [];
  return {
    isin,
    decision,
    reason,
    policy_status: policyStatus,
    policy_reason: policyRow ? policyRow.policy_reason : "",
    warnings,
    approved,
    snapshot_available: Boolean(currentDoc),
    current_doc_snapshot: currentDoc || null,
    current_snapshot_record:
      currentSnapshotRecord ||
      (currentDoc
        ? {
            isin,
            document_exists: true,
            current_firestore_doc: currentDoc,
            source: "provided_current_doc",
            dry_run: true,
            write_executed: false,
          }
        : null),
    payload_available: Boolean(payload),
    proposed_payload: payload || null,
    diff,
  };
}

function buildWriteGatePlan({
  parserArtifact,
  classificationArtifact,
  currentDocsByIsin = {},
  approvedIsins = [],
  maxWriteCandidates = 5,
  timestamp = new Date().toISOString(),
} = {}) {
  const proposedByIsin = extractProposedPayloads(parserArtifact || {});
  const classificationByIsin = normalizeClassificationByIsin(classificationArtifact || {});
  const currentByIsin = normalizeCurrentDocsByIsin(currentDocsByIsin);
  const approvedSet = new Set((approvedIsins || []).map(normalizeIsin).filter(Boolean));
  const maxCandidates = Math.max(0, Number(maxWriteCandidates || 0));
  const allIsins = Array.from(
    new Set([
      ...Object.keys(classificationByIsin),
      ...Object.keys(proposedByIsin),
      ...Array.from(approvedSet),
    ])
  ).sort();

  const entries = [];
  const approvalRejections = [];
  let candidateCount = 0;

  for (const isin of allIsins) {
    const policyRow = classificationByIsin[isin] || null;
    const payload = proposedByIsin[isin] || null;
    const currentSnapshot = currentByIsin[isin] || null;
    const currentDoc =
      currentSnapshot && currentSnapshot.document_exists
        ? currentSnapshot.current_firestore_doc
        : null;
    const approved = approvedSet.has(isin);

    if (!policyRow || !ALLOWED_POLICY_STATUSES.has(policyRow.policy_status)) {
      entries.push(
        makeEntry({
          isin,
          policyRow,
          payload,
          currentDoc,
          currentSnapshotRecord: currentSnapshot,
          decision: DECISIONS.SKIP_POLICY,
          reason: policyRow ? `unsupported_policy_status:${policyRow.policy_status}` : "missing_policy_classification",
          approved,
        })
      );
      continue;
    }

    if (policyRow.policy_status === "BLOCKED") {
      if (approved) {
        approvalRejections.push({
          isin,
          policy_status: "BLOCKED",
          reason: "blocked_never_write_even_if_approved",
        });
      }
      entries.push(
        makeEntry({
          isin,
          policyRow,
          payload,
          currentDoc,
          currentSnapshotRecord: currentSnapshot,
          decision: DECISIONS.BLOCKED_NEVER_WRITE,
          reason: "policy_blocked",
          approved,
        })
      );
      continue;
    }

    if (!payload) {
      entries.push(
        makeEntry({
          isin,
          policyRow,
          payload,
          currentDoc,
          currentSnapshotRecord: currentSnapshot,
          decision: DECISIONS.SKIP_DIFF_EMPTY,
          reason: "missing_proposed_payload",
          approved,
        })
      );
      continue;
    }

    const forbiddenFields = findForbiddenParserFields(payload);
    if (forbiddenFields.length > 0) {
      entries.push(
        makeEntry({
          isin,
          policyRow,
          payload,
          currentDoc,
          currentSnapshotRecord: currentSnapshot,
          decision: DECISIONS.SKIP_FORBIDDEN_FIELD,
          reason: `forbidden_fields:${forbiddenFields.join(",")}`,
          approved,
          diff: {
            changed_fields: [],
            unchanged_fields: [],
            forbidden_fields_detected: forbiddenFields,
            fields_preserved: FORBIDDEN_PATHS.slice(),
          },
        })
      );
      continue;
    }

    if (policyRow.policy_status === "REVIEW" && !approved) {
      entries.push(
        makeEntry({
          isin,
          policyRow,
          payload,
          currentDoc,
          currentSnapshotRecord: currentSnapshot,
          decision: DECISIONS.REVIEW_REQUIRES_EXPLICIT_APPROVAL,
          reason: "review_requires_approve_isin",
          approved,
        })
      );
      continue;
    }

    if (!currentDoc) {
      entries.push(
        makeEntry({
          isin,
          policyRow,
          payload,
          currentDoc,
          currentSnapshotRecord: currentSnapshot,
          decision: DECISIONS.SKIP_MISSING_SNAPSHOT,
          reason: "current_firestore_snapshot_required_before_write",
          approved,
        })
      );
      continue;
    }

    const diff = buildDiff(currentDoc, payload);
    if (diff.changed_fields.length === 0) {
      entries.push(
        makeEntry({
          isin,
          policyRow,
          payload,
          currentDoc,
          currentSnapshotRecord: currentSnapshot,
          decision: DECISIONS.SKIP_NO_CHANGE,
          reason: "empty_diff",
          approved,
          diff,
        })
      );
      continue;
    }

    if (candidateCount >= maxCandidates) {
      entries.push(
        makeEntry({
          isin,
          policyRow,
          payload,
          currentDoc,
          currentSnapshotRecord: currentSnapshot,
          decision: DECISIONS.SKIP_POLICY,
          reason: "max_write_candidates_exceeded",
          approved,
          diff,
        })
      );
      continue;
    }

    candidateCount += 1;
    entries.push(
      makeEntry({
        isin,
        policyRow,
        payload,
        currentDoc,
        currentSnapshotRecord: currentSnapshot,
        decision: DECISIONS.WRITE_CANDIDATE,
        reason:
          policyRow.policy_status === "REVIEW"
            ? "review_explicitly_approved_with_non_empty_diff"
            : "policy_allows_candidate_with_non_empty_diff",
        approved,
        diff,
      })
    );
  }

  return {
    generated_at: timestamp,
    dry_run: true,
    write_executed: false,
    max_write_candidates: maxCandidates,
    approved_isins: Array.from(approvedSet).sort(),
    entries,
    approval_rejections: approvalRejections,
    counts: entries.reduce((acc, entry) => {
      acc[entry.decision] = (acc[entry.decision] || 0) + 1;
      return acc;
    }, {}),
  };
}

function rollbackFieldsFromDiff(diff) {
  if (!diff || !Array.isArray(diff.changed_fields)) return [];
  return diff.changed_fields.map((field) => ({
    path: field.path,
    restore_value: field.current_value,
  }));
}

function buildManifests(plan) {
  const candidates = plan.entries.filter((entry) => entry.decision === DECISIONS.WRITE_CANDIDATE);
  const excludedReview = plan.entries.filter(
    (entry) => entry.decision === DECISIONS.REVIEW_REQUIRES_EXPLICIT_APPROVAL
  );
  const blocked = plan.entries.filter((entry) => entry.decision === DECISIONS.BLOCKED_NEVER_WRITE);
  const skipped = plan.entries.filter(
    (entry) =>
      ![
        DECISIONS.WRITE_CANDIDATE,
        DECISIONS.REVIEW_REQUIRES_EXPLICIT_APPROVAL,
        DECISIONS.BLOCKED_NEVER_WRITE,
      ].includes(entry.decision)
  );

  const approvalManifest = {
    generated_at: plan.generated_at,
    dry_run: true,
    write_executed: false,
    approval_required: true,
    approved_isins: plan.approved_isins,
    max_write_candidates: plan.max_write_candidates,
    candidates: candidates.map((entry) => ({
      isin: entry.isin,
      policy_status: entry.policy_status,
      policy_reason: entry.policy_reason,
      warnings: entry.warnings,
      changed_fields: entry.diff ? entry.diff.changed_fields.map((field) => field.path) : [],
      approval_status: entry.policy_status === "REVIEW" ? "EXPLICITLY_APPROVED" : "PENDING_MANUAL_APPROVAL",
    })),
    excluded_review: excludedReview.map((entry) => ({
      isin: entry.isin,
      policy_status: entry.policy_status,
      reason: entry.reason,
      warnings: entry.warnings,
    })),
    blocked: blocked.map((entry) => ({
      isin: entry.isin,
      policy_status: entry.policy_status,
      reason: entry.reason,
      warnings: entry.warnings,
    })),
    skipped: skipped.map((entry) => ({
      isin: entry.isin,
      decision: entry.decision,
      reason: entry.reason,
      policy_status: entry.policy_status,
    })),
    approval_rejections: plan.approval_rejections,
  };

  const rollbackManifest = {
    generated_at: plan.generated_at,
    dry_run: true,
    write_executed: false,
    entries: candidates.map((entry) => ({
      isin: entry.isin,
      snapshot_available: entry.snapshot_available,
      current_firestore_doc_snapshot: entry.current_doc_snapshot,
      fields_that_would_be_restored: rollbackFieldsFromDiff(entry.diff),
      decision: entry.decision,
    })),
  };

  const postWriteVerificationPlan = {
    generated_at: plan.generated_at,
    dry_run: true,
    write_executed: false,
    candidates: candidates.map((entry) => entry.isin),
    checks: [
      "document_exists",
      "proposed_fields_updated",
      "forbidden_fields_unchanged",
      "manual_fields_unchanged",
      "portfolio_exposure_v2.economic_exposure_unchanged",
      "portfolio_exposure_v2.asset_mix_sum_valid_0_95_to_1_05",
      "parser_metadata_or_warnings_present_when_applicable",
    ],
  };

  const snapshotManifest = {
    generated_at: plan.generated_at,
    dry_run: true,
    write_executed: false,
    snapshots_required_before_write: true,
    entries: plan.entries.map((entry) => ({
      isin: entry.isin,
      decision: entry.decision,
      policy_status: entry.policy_status,
      snapshot_available: entry.snapshot_available,
      document_exists: entry.current_snapshot_record
        ? entry.current_snapshot_record.document_exists
        : false,
      source: entry.current_snapshot_record ? entry.current_snapshot_record.source : null,
      snapshot_file:
        entry.current_snapshot_record ? `snapshots/${entry.isin}.json` : null,
      reason: entry.reason,
    })),
  };

  const diffManifest = {
    generated_at: plan.generated_at,
    dry_run: true,
    write_executed: false,
    entries: plan.entries.map((entry) => ({
      isin: entry.isin,
      decision: entry.decision,
      reason: entry.reason,
      policy_status: entry.policy_status,
      warnings: entry.warnings,
      snapshot_available: entry.snapshot_available,
      payload_available: entry.payload_available,
      proposed_payload: entry.proposed_payload,
      diff: entry.diff,
    })),
  };

  return {
    approvalManifest,
    rollbackManifest,
    postWriteVerificationPlan,
    snapshotManifest,
    diffManifest,
  };
}

function writeGateArtifacts({ plan, outputDir }) {
  const manifests = buildManifests(plan);
  const snapshotsDir = path.join(outputDir, "snapshots");
  ensureDir(snapshotsDir);

  writeJson(path.join(outputDir, "write_approval_manifest.json"), manifests.approvalManifest);
  writeJson(path.join(outputDir, "rollback_manifest.json"), manifests.rollbackManifest);
  writeJson(
    path.join(outputDir, "post_write_verification_plan.json"),
    manifests.postWriteVerificationPlan
  );
  writeJson(path.join(outputDir, "snapshot_manifest.json"), manifests.snapshotManifest);
  writeJson(path.join(outputDir, "diff_manifest.json"), manifests.diffManifest);

  for (const entry of plan.entries) {
    if (!entry.current_snapshot_record) continue;
    const snapshot = {
      generated_at: plan.generated_at,
      ...entry.current_snapshot_record,
      dry_run: true,
      write_executed: false,
      policy_status: entry.policy_status,
      decision: entry.decision,
      fields_that_would_change: entry.diff ? entry.diff.changed_fields.map((field) => field.path) : [],
      rollback_fields: rollbackFieldsFromDiff(entry.diff),
    };
    writeJson(path.join(snapshotsDir, `${entry.isin}.json`), snapshot);
  }

  return {
    output_dir: outputDir,
    files: [
      path.join(outputDir, "write_approval_manifest.json"),
      path.join(outputDir, "rollback_manifest.json"),
      path.join(outputDir, "post_write_verification_plan.json"),
      path.join(outputDir, "snapshot_manifest.json"),
      path.join(outputDir, "diff_manifest.json"),
    ],
    snapshot_dir: snapshotsDir,
  };
}

module.exports = {
  DECISIONS,
  FORBIDDEN_PATHS,
  assertNoForbiddenParserFields,
  buildDiff,
  buildManifests,
  buildWriteGatePlan,
  classificationRows,
  ensureDir,
  extractProposedPayloads,
  findForbiddenParserFields,
  flattenObject,
  getPath,
  normalizeClassificationByIsin,
  normalizeIsin,
  readJson,
  writeGateArtifacts,
  writeJson,
};

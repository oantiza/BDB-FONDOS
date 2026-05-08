"use strict";

const assert = require("assert");

const {
  SERVER_TIMESTAMP_FIELDS,
  buildUpdatePatch,
  parseArgs,
  validateRestrictedPrecheck,
  verifyPostWrite,
} = require("../bin/apply_write_gate_controlled");

function makeInputs() {
  const changedFields = [
    { path: "ms.rating_stars", current_value: null, proposed_value: 0 },
    { path: "quality.parsed_at", current_value: { _seconds: 1 }, proposed_value: {} },
  ];
  return {
    approvalManifest: {
      candidates: [
        { isin: "IE0003867441", policy_status: "ACCEPT" },
        { isin: "ES0165142003", policy_status: "ACCEPT_WITH_WARNINGS" },
        { isin: "LU0000000000", policy_status: "ACCEPT_WITH_WARNINGS" },
      ],
      blocked: [],
      excluded_review: [],
    },
    rollbackManifest: {
      entries: [
        {
          isin: "IE0003867441",
          snapshot_available: true,
          current_firestore_doc_snapshot: {
            manual: { costs: { retrocession: 1.41 } },
            portfolio_exposure_v2: {
              asset_mix: { equity: 1, fixed_income: 0, cash: 0, other: 0 },
              economic_exposure: { equity: 100 },
            },
          },
        },
        {
          isin: "ES0165142003",
          snapshot_available: true,
          current_firestore_doc_snapshot: {
            manual: { costs: { retrocession: 0.8 } },
            portfolio_exposure_v2: {
              asset_mix: { equity: 0, fixed_income: 0.9, cash: 0.1, other: 0 },
              economic_exposure: { fixed_income: 90, cash: 10 },
            },
          },
        },
      ],
    },
    diffManifest: {
      entries: [
        {
          isin: "IE0003867441",
          decision: "WRITE_CANDIDATE",
          policy_status: "ACCEPT",
          warnings: [],
          proposed_payload: { ms: { rating_stars: 0 }, quality: { parsed_at: {} } },
          diff: { changed_fields: changedFields, forbidden_fields_detected: [] },
        },
        {
          isin: "ES0165142003",
          decision: "WRITE_CANDIDATE",
          policy_status: "ACCEPT_WITH_WARNINGS",
          warnings: ["low_warning"],
          proposed_payload: { ms: { rating_stars: 0 }, quality: { parsed_at: {} } },
          diff: { changed_fields: changedFields, forbidden_fields_detected: [] },
        },
      ],
    },
    snapshotManifest: {
      entries: [
        { isin: "IE0003867441", document_exists: true },
        { isin: "ES0165142003", document_exists: true },
      ],
    },
    postWriteVerificationPlan: {
      candidates: ["IE0003867441", "ES0165142003"],
      checks: ["document_exists"],
    },
  };
}

{
  assert.throws(() => parseArgs(["--write"]), /WRITE_BLOCKED/);
  const args = parseArgs([
    "--write",
    "--confirm-write",
    "--approve-isin",
    "IE0003867441",
    "--approve-isin",
    "ES0165142003",
    "--approval-manifest",
    "approval.json",
    "--rollback-manifest",
    "rollback.json",
    "--diff-manifest",
    "diff.json",
    "--snapshot-manifest",
    "snapshot.json",
    "--post-write-verification-plan",
    "post.json",
    "--max-write-candidates",
    "2",
  ]);
  assert.deepStrictEqual(args.approvedIsins, ["IE0003867441", "ES0165142003"]);
}

{
  const args = {
    approvedIsins: ["IE0003867441", "ES0165142003"],
    maxWriteCandidates: 2,
  };
  const precheck = validateRestrictedPrecheck({
    args,
    inputs: makeInputs(),
    timestamp: "2026-05-08T00:00:00.000Z",
  });
  assert.strictEqual(precheck.ok, true);
  assert.ok(precheck.warnings.includes("candidate_restricted_out:LU0000000000"));
}

{
  const inputs = makeInputs();
  inputs.diffManifest.entries[0].proposed_payload.manual = { costs: {} };
  const precheck = validateRestrictedPrecheck({
    args: { approvedIsins: ["IE0003867441", "ES0165142003"], maxWriteCandidates: 2 },
    inputs,
    timestamp: "2026-05-08T00:00:00.000Z",
  });
  assert.strictEqual(precheck.ok, false);
  assert.ok(precheck.errors.some((error) => error.startsWith("forbidden_fields_in_payload")));
}

{
  const entry = makeInputs().diffManifest.entries[0];
  const { patch, appliedFields } = buildUpdatePatch(entry, () => "SERVER_TIMESTAMP_SENTINEL");
  assert.strictEqual(patch["ms.rating_stars"], 0);
  assert.strictEqual(patch["quality.parsed_at"], "SERVER_TIMESTAMP_SENTINEL");
  assert.ok(SERVER_TIMESTAMP_FIELDS.has("quality.parsed_at"));
  assert.strictEqual(
    appliedFields.find((field) => field.path === "quality.parsed_at").applied_value_kind,
    "server_timestamp"
  );
}

{
  const inputs = makeInputs();
  const result = verifyPostWrite({
    isin: "IE0003867441",
    beforeSnapshot: inputs.rollbackManifest.entries[0],
    afterDoc: {
      ms: { rating_stars: 0 },
      quality: { parsed_at: { _seconds: 2, _nanoseconds: 0 } },
      manual: { costs: { retrocession: 1.41 } },
      portfolio_exposure_v2: {
        asset_mix: { equity: 1, fixed_income: 0, cash: 0, other: 0 },
        economic_exposure: { equity: 100 },
      },
    },
    diffEntry: inputs.diffManifest.entries[0],
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.asset_mix_sum_valid, true);
}

console.log("first write controlled tests passed");

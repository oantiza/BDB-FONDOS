"use strict";

const assert = require("assert");

const {
  DECISIONS,
  assertNoForbiddenParserFields,
  buildManifests,
  buildWriteGatePlan,
} = require("../../MORNINGSTAR_PDF_PARSER/src/lib/write_gate");
const {
  filterArtifactsByIsin,
  parseArgs,
} = require("../../MORNINGSTAR_PDF_PARSER/bin/prepare_write_gate_dry_run");

function payload(isin, overrides = {}) {
  return {
    isin,
    name: `Fund ${isin}`,
    ms: { category_morningstar: "Global Equity" },
    classification_v2: { asset_type: "equity", asset_subtype: "global" },
    portfolio_exposure_v2: {
      asset_mix: { equity: 1, fixed_income: 0, cash: 0, other: 0 },
    },
    ...overrides,
  };
}

function currentDoc(isin, overrides = {}) {
  return {
    isin,
    name: `Old Fund ${isin}`,
    ms: { category_morningstar: "Old Category" },
    classification_v2: { asset_type: "allocation", asset_subtype: "old" },
    portfolio_exposure_v2: {
      asset_mix: { equity: 0.5, fixed_income: 0.4, cash: 0.1, other: 0 },
      economic_exposure: { equity: 50, fixed_income: 40, cash: 10, other: 0 },
    },
    manual: { costs: { retrocession: 1.41 } },
    ...overrides,
  };
}

function classification(statusByIsin) {
  return {
    rows: Object.entries(statusByIsin).map(([isin, status]) => ({
      isin,
      policy_status: status,
      policy_reason: `${status.toLowerCase()}_fixture`,
      warnings: status === "ACCEPT_WITH_WARNINGS" ? "low_warning" : "",
    })),
  };
}

function entry(plan, isin) {
  return plan.entries.find((item) => item.isin === isin);
}

const parserArtifact = {
  dry_run: true,
  would_write: false,
  proposed_payload_by_isin: {
    A_ACCEPT1: payload("A_ACCEPT1"),
    B_WARN1: payload("B_WARN1"),
    C_REVIEW1: payload("C_REVIEW1"),
    D_BLOCK1: payload("D_BLOCK1"),
    E_MANUAL1: payload("E_MANUAL1", { manual: { costs: { retrocession: 0.8 } } }),
    F_RETRO1: payload("F_RETRO1", { "manual.costs.retrocession": 0.8 }),
    G_ECON1: payload("G_ECON1", {
      portfolio_exposure_v2: {
        asset_mix: { equity: 0, fixed_income: 1, cash: 0, other: 0 },
        economic_exposure: { equity: 0, fixed_income: 100, cash: 0, other: 0 },
      },
    }),
    H_SAME1: payload("H_SAME1"),
  },
};

const classificationArtifact = classification({
  A_ACCEPT1: "ACCEPT",
  B_WARN1: "ACCEPT_WITH_WARNINGS",
  C_REVIEW1: "REVIEW",
  D_BLOCK1: "BLOCKED",
  E_MANUAL1: "ACCEPT",
  F_RETRO1: "ACCEPT",
  G_ECON1: "ACCEPT",
  H_SAME1: "ACCEPT",
});

const currentDocsByIsin = {
  A_ACCEPT1: currentDoc("A_ACCEPT1"),
  B_WARN1: currentDoc("B_WARN1"),
  C_REVIEW1: currentDoc("C_REVIEW1"),
  D_BLOCK1: currentDoc("D_BLOCK1"),
  E_MANUAL1: currentDoc("E_MANUAL1"),
  F_RETRO1: currentDoc("F_RETRO1"),
  G_ECON1: currentDoc("G_ECON1"),
  H_SAME1: payload("H_SAME1"),
};

{
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin: {},
    maxWriteCandidates: 10,
  });
  assert.strictEqual(entry(plan, "A_ACCEPT1").decision, DECISIONS.SKIP_MISSING_SNAPSHOT);
}

{
  const snapshotRecord = {
    isin: "A_ACCEPT1",
    document_exists: true,
    document_id: "A_ACCEPT1",
    source: "funds_v3 read-only",
    timestamp: "2026-05-08T00:00:00.000Z",
    dry_run: true,
    write_executed: false,
    current_firestore_doc: currentDoc("A_ACCEPT1"),
  };
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin: { A_ACCEPT1: snapshotRecord },
    maxWriteCandidates: 10,
  });
  assert.strictEqual(entry(plan, "A_ACCEPT1").decision, DECISIONS.WRITE_CANDIDATE);
  assert.strictEqual(entry(plan, "A_ACCEPT1").diff.manual_fields_current_preserved, true);
  assert.strictEqual(
    entry(plan, "A_ACCEPT1").diff.manual_costs_retrocession_current_preserved,
    true
  );
  assert.strictEqual(entry(plan, "A_ACCEPT1").diff.economic_exposure_current_preserved, true);
}

{
  assert.throws(() => parseArgs(["--write"]), /WRITE_FLAGS_FORBIDDEN/);
  assert.throws(() => parseArgs(["--fetch-snapshots"]), /FETCH_SNAPSHOTS_REQUIRES_ONLY_ISIN/);
  const args = parseArgs(["--fetch-snapshots", "--only-isin", "A_ACCEPT1,B_WARN1"]);
  assert.deepStrictEqual(args.onlyIsins, ["A_ACCEPT1", "B_WARN1"]);
}

{
  const filtered = filterArtifactsByIsin(parserArtifact, classificationArtifact, ["A_ACCEPT1"]);
  assert.deepStrictEqual(Object.keys(filtered.parserArtifact.proposed_payload_by_isin), [
    "A_ACCEPT1",
  ]);
  assert.strictEqual(filtered.classificationArtifact.rows.length, 1);
}

{
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin,
    approvedIsins: ["D_BLOCK1"],
    maxWriteCandidates: 10,
  });
  assert.strictEqual(entry(plan, "D_BLOCK1").decision, DECISIONS.BLOCKED_NEVER_WRITE);
  assert.strictEqual(plan.approval_rejections.length, 1);
  assert.strictEqual(plan.approval_rejections[0].isin, "D_BLOCK1");
}

{
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin,
    approvedIsins: [],
    maxWriteCandidates: 10,
  });
  assert.strictEqual(
    entry(plan, "C_REVIEW1").decision,
    DECISIONS.REVIEW_REQUIRES_EXPLICIT_APPROVAL
  );
}

{
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin,
    approvedIsins: ["C_REVIEW1"],
    maxWriteCandidates: 10,
  });
  assert.strictEqual(entry(plan, "C_REVIEW1").decision, DECISIONS.WRITE_CANDIDATE);
  assert.strictEqual(entry(plan, "C_REVIEW1").approved, true);
}

{
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin,
    maxWriteCandidates: 10,
  });
  assert.strictEqual(entry(plan, "A_ACCEPT1").decision, DECISIONS.WRITE_CANDIDATE);
  assert.strictEqual(entry(plan, "B_WARN1").decision, DECISIONS.WRITE_CANDIDATE);
}

{
  assert.throws(
    () => assertNoForbiddenParserFields(parserArtifact.proposed_payload_by_isin.E_MANUAL1),
    /PARSER_WRITE_GATE_FORBIDDEN_FIELDS/
  );
  assert.throws(
    () => assertNoForbiddenParserFields(parserArtifact.proposed_payload_by_isin.F_RETRO1),
    /PARSER_WRITE_GATE_FORBIDDEN_FIELDS/
  );
  assert.throws(
    () => assertNoForbiddenParserFields(parserArtifact.proposed_payload_by_isin.G_ECON1),
    /PARSER_WRITE_GATE_FORBIDDEN_FIELDS/
  );

  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin,
    maxWriteCandidates: 10,
  });
  assert.strictEqual(entry(plan, "E_MANUAL1").decision, DECISIONS.SKIP_FORBIDDEN_FIELD);
  assert.strictEqual(entry(plan, "F_RETRO1").decision, DECISIONS.SKIP_FORBIDDEN_FIELD);
  assert.strictEqual(entry(plan, "G_ECON1").decision, DECISIONS.SKIP_FORBIDDEN_FIELD);
}

{
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin,
    maxWriteCandidates: 10,
  });
  assert.strictEqual(entry(plan, "H_SAME1").decision, DECISIONS.SKIP_NO_CHANGE);
}

{
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin,
    approvedIsins: ["C_REVIEW1"],
    maxWriteCandidates: 2,
  });
  assert.strictEqual(plan.entries.filter((item) => item.decision === DECISIONS.WRITE_CANDIDATE).length, 2);
  assert.strictEqual(entry(plan, "C_REVIEW1").decision, DECISIONS.SKIP_POLICY);
  assert.strictEqual(entry(plan, "C_REVIEW1").reason, "max_write_candidates_exceeded");
}

{
  const plan = buildWriteGatePlan({
    parserArtifact,
    classificationArtifact,
    currentDocsByIsin,
    approvedIsins: ["C_REVIEW1"],
    maxWriteCandidates: 10,
  });
  const manifests = buildManifests(plan);
  assert.strictEqual(manifests.approvalManifest.write_executed, false);
  assert.strictEqual(manifests.rollbackManifest.write_executed, false);
  assert.strictEqual(manifests.postWriteVerificationPlan.write_executed, false);
  assert.strictEqual(manifests.snapshotManifest.write_executed, false);
  assert.strictEqual(manifests.diffManifest.write_executed, false);
  assert.strictEqual(manifests.approvalManifest.dry_run, true);
}

console.log("parser write gate tests passed");

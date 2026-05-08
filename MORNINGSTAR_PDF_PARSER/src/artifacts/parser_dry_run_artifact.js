"use strict";

const path = require("path");

function serializeForArtifact(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeForArtifact);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (value.constructor && value.constructor.name && value.constructor.name.includes("FieldValue")) {
      return "[FIRESTORE_FIELD_VALUE]";
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeForArtifact(v);
    }
    return out;
  }
  return value;
}

function hasManualField(payload, prefix = "") {
  if (!payload || typeof payload !== "object") return false;
  for (const [key, value] of Object.entries(payload)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (key === "manual" || fullKey === "manual" || fullKey.startsWith("manual.")) {
      return true;
    }
    if (hasManualField(value, fullKey)) return true;
  }
  return false;
}

function assertNoManualFields(payload) {
  if (hasManualField(payload)) {
    throw new Error("MANUAL_FIELD_GUARD: parser payload must not include manual.* fields");
  }
  return true;
}

function recordDryRunProposal({ isin, fileName, doc, routing }, parserDryRunProposals) {
  assertNoManualFields(doc);
  parserDryRunProposals.push({
    isin,
    fileName,
    routing_status: routing?.status || null,
    routing_reason: routing?.reason || null,
    fields_to_update: Object.keys(doc),
    fields_preserved: ["manual", "manual.costs", "manual.costs.retrocession"],
    payload: serializeForArtifact(doc),
  });
}

function recordFileMove(entry, fileMoveEntries) {
  fileMoveEntries.push(entry);
  return entry;
}

function findLatestManifestEntryForFile(fileName, manifestEntries) {
  for (let index = manifestEntries.length - 1; index >= 0; index -= 1) {
    if (manifestEntries[index].fileName === fileName) return manifestEntries[index];
  }
  return null;
}

function buildParserDryRunArtifact({
  files,
  ok,
  review,
  fail,
  parserDryRunProposals = [],
  fileMoveEntries = [],
  reviewEntries = [],
  errorEntries = [],
  configPathsResolved = {},
}) {
  const proposedPayloadByIsin = {};
  const fieldsToUpdate = new Set();
  const isins = [];

  for (const proposal of parserDryRunProposals) {
    if (proposal.isin) {
      proposedPayloadByIsin[proposal.isin] = proposal.payload;
      isins.push(proposal.isin);
    }
    for (const field of proposal.fields_to_update || []) {
      fieldsToUpdate.add(field);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    dry_run: true,
    would_write: false,
    input_files: files || [],
    input_file_results: fileMoveEntries,
    file_movements: fileMoveEntries,
    isins_processed: [...new Set(isins)],
    proposed_payload_by_isin: proposedPayloadByIsin,
    fields_to_update: [...fieldsToUpdate].sort(),
    fields_preserved: ["manual", "manual.costs", "manual.costs.retrocession"],
    warnings: [
      ...reviewEntries.map((entry) => ({
        isin: entry.isin,
        fileName: entry.fileName,
        reason: entry.reason,
      })),
      ...errorEntries.map((entry) => ({
        isin: entry.isin || null,
        fileName: entry.fileName,
        reason: entry.reason || entry.message,
      })),
      ...fileMoveEntries
        .filter((entry) => entry.file_move_status === "FAILED")
        .map((entry) => ({
          isin: entry.detected_isin || null,
          fileName: path.basename(entry.original_pdf_path || ""),
          reason: `file_move_failed:${entry.file_move_reason}`,
        })),
    ],
    config_paths_resolved: configPathsResolved,
    summary: {
      ok_count: ok || 0,
      review_count: review || 0,
      error_count: fail || 0,
      proposal_count: parserDryRunProposals.length,
    },
  };
}

function writeParserDryRunArtifact({
  files,
  ok,
  review,
  fail,
  outputDir,
  parserDryRunProposals = [],
  fileMoveEntries = [],
  reviewEntries = [],
  errorEntries = [],
  configPathsResolved = {},
  ensureDir,
  writeJsonPretty,
}) {
  ensureDir(outputDir);
  const artifact = buildParserDryRunArtifact({
    files,
    ok,
    review,
    fail,
    parserDryRunProposals,
    fileMoveEntries,
    reviewEntries,
    errorEntries,
    configPathsResolved,
  });
  const artifactPath = path.join(outputDir, "parser_dry_run_latest.json");
  writeJsonPretty(artifactPath, artifact);
  return { artifact, artifactPath };
}

module.exports = {
  serializeForArtifact,
  hasManualField,
  assertNoManualFields,
  recordDryRunProposal,
  recordFileMove,
  findLatestManifestEntryForFile,
  buildParserDryRunArtifact,
  writeParserDryRunArtifact,
};

"use strict";

const assert = require("assert");
const {
  retrocessionPercentPoints,
  normalizeSourceRows,
  classifyRows,
} = require("../../scripts/maintenance/bdb_retrocession_reload_dry_run");

function assertParsed(raw, expected) {
  const parsed = retrocessionPercentPoints(raw);
  assert.strictEqual(parsed.status, "OK", `${raw} should parse as OK`);
  assert.strictEqual(parsed.value, expected, `${raw} parsed value mismatch`);
}

function buildFunds(entries) {
  return new Map(
    entries.map(([isin, data]) => [
      isin,
      {
        id: isin,
        data,
      },
    ])
  );
}

function classify(rawRows, funds) {
  return classifyRows(normalizeSourceRows(rawRows), buildFunds(funds));
}

assertParsed("1,41%", 1.41);
assertParsed("1.41", 1.41);
assertParsed("0,0155%", 0.0155);
assertParsed("0.0155", 0.0155);
assertParsed("0,80", 0.8);
assertParsed("0.80%", 0.8);
assertParsed("0.0141", 0.0141);

{
  const parsed = retrocessionPercentPoints(-0.01);
  assert.strictEqual(parsed.status, "INVALID");
  assert.strictEqual(parsed.value, null);
}

{
  const parsed = retrocessionPercentPoints("");
  assert.strictEqual(parsed.status, "MISSING");
  assert.strictEqual(parsed.value, null);
}

{
  const rows = classify(
    [
      { ISIN: "LU1234567890", retrocession_percent: "1.00" },
      { ISIN: "LU1234567890", retrocession_percent: "1.20" },
    ],
    [["LU1234567890", { name: "Fund A", manual: { costs: { retrocession: 1 } } }]]
  );
  assert.strictEqual(rows.length, 2);
  assert.ok(rows.every((row) => row.status === "DUPLICATE_ISIN_IN_SOURCE"));
  assert.ok(rows.every((row) => row.review_required === true));
}

{
  const rows = classify(
    [{ ISIN: "LU0987654321", retrocession_percent: "0.80" }],
    [["LU1234567890", { name: "Fund A", manual: { costs: { retrocession: 0.8 } } }]]
  );
  assert.strictEqual(rows[0].status, "ISIN_NOT_FOUND");
  assert.strictEqual(rows[0].review_required, true);
}

{
  const rows = classify(
    [{ ISIN: "LU1234567890", retrocession_percent: "1.60" }],
    [["LU1234567890", { name: "Fund A", manual: { costs: { retrocession: 1.0 } } }]]
  );
  assert.strictEqual(rows[0].status, "LARGE_CHANGE_REVIEW");
  assert.strictEqual(rows[0].review_required, true);
}

{
  const rows = classify(
    [{ ISIN: "LU1234567890", retrocession_percent: "0.31" }],
    [["LU1234567890", { name: "Fund A", manual: { costs: { retrocession: 0.2 } } }]]
  );
  assert.strictEqual(rows[0].status, "LARGE_CHANGE_REVIEW");
  assert.strictEqual(rows[0].review_required, true);
}

{
  const rows = classify(
    [{ ISIN: "LU1234567890", retrocession_percent: "6.00" }],
    [["LU1234567890", { name: "Fund A", manual: { costs: { retrocession: 5.5 } } }]]
  );
  assert.strictEqual(rows[0].status, "HIGH_VALUE_REVIEW");
  assert.strictEqual(rows[0].review_required, true);
}

{
  const rows = classify(
    [{ ISIN: "LU1234567890", retrocession_percent: "" }],
    [["LU1234567890", { name: "Fund A", manual: { costs: { retrocession: 0.8 } } }]]
  );
  assert.strictEqual(rows[0].status, "SOURCE_VALUE_MISSING");
}

{
  const rows = classify(
    [{ ISIN: "LU1234567890", retrocession_percent: "-1" }],
    [["LU1234567890", { name: "Fund A", manual: { costs: { retrocession: 0.8 } } }]]
  );
  assert.strictEqual(rows[0].status, "SOURCE_VALUE_INVALID");
  assert.strictEqual(rows[0].review_required, true);
}

console.log("bdb_retrocession_reload_dry_run tests passed");


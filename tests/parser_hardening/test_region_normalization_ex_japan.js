"use strict";

const assert = require("assert");

const parser = require("../../MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js");

function normalizedRegion(category, name = "") {
  return parser.derivePrimaryRegion(
    null,
    parser.normalizeTextForTokens(category),
    parser.normalizeTextForTokens(name)
  );
}

function assertNotJapan(label, value) {
  assert.notStrictEqual(value, "Japan", label);
  assert.notStrictEqual(value, "Japon", label);
  assert.ok(!String(value).toUpperCase().includes("JAP"), `${label}: got ${value}`);
}

{
  const region = normalizedRegion("Asia ex-Japon");
  assert.strictEqual(region, "Asia");
  assertNotJapan("Asia ex-Japon must not map to Japan", region);
}

{
  const region = normalizedRegion("Asia ex Japan");
  assert.strictEqual(region, "Asia");
  assertNotJapan("Asia ex Japan must not map to Japan", region);
}

{
  const region = normalizedRegion("Asia Pacific ex Japan");
  assert.strictEqual(region, "Asia");
  assertNotJapan("Asia Pacific ex Japan must not map to Japan", region);
}

{
  const region = normalizedRegion("RV Asia (ex-Jap\u00f3n)");
  assert.strictEqual(region, "Asia");
  assertNotJapan("RV Asia (ex-Japon) must not map to Japan", region);
}

{
  const region = normalizedRegion("Japan Equity");
  assert.ok(String(region).toUpperCase().includes("JAP"), `Japan Equity got ${region}`);
}

{
  const region = normalizedRegion("Jap\u00f3n");
  assert.ok(String(region).toUpperCase().includes("JAP"), `Japon got ${region}`);
}

{
  const region = normalizedRegion("Asia");
  assert.strictEqual(region, "Asia");
}

{
  const region = normalizedRegion("Asia Pacific");
  assert.strictEqual(region, "Asia");
}

console.log("region normalization ex-Japan tests passed");

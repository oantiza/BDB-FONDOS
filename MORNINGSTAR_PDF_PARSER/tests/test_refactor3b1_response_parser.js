"use strict";

const assert = require("assert");

const parser = require("../src/cargador_lotes_v_2.js");
const responseParser = require("../src/gemini/response_parser");

function basePayload(overrides = {}) {
  return {
    isin: "IE0003867441",
    category_morningstar: "RV Global Cap. Flexible",
    asset_allocation: { equity: 60, bond: 30, cash: 5, other: 5 },
    regions_detail: { "United States": 50 },
    sectors: { technology: 20 },
    equity_style: { value: 30, blend: 40, growth: 30 },
    fixed_income: {},
    ...overrides,
  };
}

function parseBoth(rawText) {
  return {
    module: responseParser.parseGeminiJsonResponse(rawText),
    monolith: parser.parseGeminiJsonResponse(rawText),
  };
}

{
  const raw = JSON.stringify(basePayload());
  const parsed = parseBoth(raw);
  assert.strictEqual(parsed.module.isin, "IE0003867441");
  assert.deepStrictEqual(parsed.module, parsed.monolith);
}

{
  const raw = `\n\`\`\`json\n${JSON.stringify(basePayload({ isin: "ES0165142003" }))}\n\`\`\`\n`;
  const parsed = parseBoth(raw);
  assert.strictEqual(parsed.module.isin, "ES0165142003");
  assert.deepStrictEqual(parsed.module, parsed.monolith);
}

{
  const raw = `prefacio del modelo\n${JSON.stringify(basePayload({ isin: "LU0208853944" }))}\ntexto sobrante`;
  const parsed = parseBoth(raw);
  assert.strictEqual(parsed.module.isin, "LU0208853944");
  assert.deepStrictEqual(parsed.module, parsed.monolith);
}

{
  const raw = JSON.stringify({ data: basePayload({ isin: "LU1670724373" }) });
  const parsed = parseBoth(raw);
  assert.strictEqual(parsed.module.isin, "LU1670724373");
  assert.deepStrictEqual(parsed.module, parsed.monolith);
}

{
  const raw = JSON.stringify({ result: [basePayload({ isin: "LU0252500524" })] });
  const parsed = parseBoth(raw);
  assert.strictEqual(parsed.module.isin, "LU0252500524");
  assert.deepStrictEqual(parsed.module, parsed.monolith);
}

{
  const repaired = responseParser.parseGeminiJsonResponse(
    '{"isin":"IE0003867441","category_morningstar":"RV","asset_allocation":{"equity":NaN,},}'
  );
  assert.strictEqual(repaired.isin, "IE0003867441");
  assert.strictEqual(repaired.asset_allocation.equity, null);
}

{
  assert.throws(
    () => responseParser.parseGeminiJsonResponse(""),
    /Gemini no devolvi/
  );
  assert.throws(
    () => responseParser.parseGeminiJsonResponse(null),
    /Gemini no devolvi/
  );
  assert.throws(
    () => responseParser.parseGeminiJsonResponse("{bad json"),
    /Gemini no devolvi/
  );
}

{
  const schema = responseParser.validateRawLlMSchema(basePayload({ rating_stars: "5" }));
  assert.strictEqual(schema.ok, true);
  assert.deepStrictEqual(schema.errors, []);
  assert.deepStrictEqual(parser.validateRawLlMSchema(basePayload({ rating_stars: "5" })), schema);
}

{
  const schema = responseParser.validateRawLlMSchema(null);
  assert.strictEqual(schema.ok, false);
  assert.ok(schema.errors.includes("root_not_object"));
}

{
  const schema = responseParser.validateRawLlMSchema(
    basePayload({
      unexpected: true,
      rating_stars: "not-a-number",
      holdings_top10: {},
    })
  );
  assert.strictEqual(schema.ok, true);
  assert.ok(schema.warnings.includes("unexpected_top_level_key:unexpected"));
  assert.ok(schema.warnings.includes("invalid_type:rating_stars:expected_number_or_null"));
  assert.ok(schema.warnings.includes("invalid_type:holdings_top10:expected_array_or_null"));
}

// ============================
// Smart-quotes / Mojibake fix
// ============================

// Test: smart double quotes U+201C / U+201D inside a string value are escaped to \"
{
  const raw = '{"objective": "Fondo busca \u201Ccrecimiento\u201D sostenible", "isin": "LU0000000001"}';
  const parsed = responseParser.parseGeminiJsonResponse(raw);
  assert.strictEqual(parsed.isin, "LU0000000001");
  assert.ok(parsed.objective.includes("crecimiento"), "objective should contain crecimiento");
  assert.ok(parsed.objective.includes("sostenible"), "objective should contain sostenible");
}

// Test: smart single quotes U+2018 / U+2019 inside a string value don't break parsing
{
  const raw = '{"name": "Fund\u2019s \u2018best\u2019 allocation", "isin": "LU0000000002"}';
  const parsed = responseParser.parseGeminiJsonResponse(raw);
  assert.strictEqual(parsed.isin, "LU0000000002");
  assert.ok(parsed.name.includes("best"), "name should contain best");
}

// Test: ASCII structural double quotes (U+0022) are NOT replaced by the smart-quote fix
{
  const raw = JSON.stringify(basePayload({ isin: "LU0000000003", objective: "Normal quotes only" }));
  const parsed = responseParser.parseGeminiJsonResponse(raw);
  assert.strictEqual(parsed.isin, "LU0000000003");
  assert.strictEqual(parsed.objective, "Normal quotes only");
  assert.deepStrictEqual(parsed, parser.parseGeminiJsonResponse(raw));
}

// Test: smart double quote adjacent to structural quote parses correctly
{
  const raw = '{"name": "\u201CHello\u201D", "isin": "LU0000000004"}';
  const parsed = responseParser.parseGeminiJsonResponse(raw);
  assert.strictEqual(parsed.isin, "LU0000000004");
  assert.ok(parsed.name.includes("Hello"), "name should contain Hello");
}

console.log("refactor-3B1 response parser tests passed");

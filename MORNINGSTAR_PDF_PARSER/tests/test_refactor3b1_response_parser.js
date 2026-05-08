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

console.log("refactor-3B1 response parser tests passed");

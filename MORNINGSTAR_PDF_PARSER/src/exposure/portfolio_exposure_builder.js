/**
 * portfolio_exposure_v2 builder.
 * REFACTOR-2.
 *
 * Pure functions only: no filesystem, no Gemini, no Firestore.
 */

"use strict";

const { normalizeExposureMapToParent01 } = require("../normalize/asset_mix_normalizer");

function assetMixGuardrailWarningToString(warning) {
  const details = Object.entries(warning)
    .filter(([k]) => k !== "code")
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return details ? `asset_mix_guardrail:${warning.code}:${details}` : `asset_mix_guardrail:${warning.code}`;
}

function buildPortfolioExposureV2({
  sanitizedMix,
  equityRegionsTotal,
  equitySectorsTotal,
  styleWeightsTotal,
  sizeWeightsTotal,
  fixedIncomeType,
  creditBucket,
  durationBucket,
  classificationV2,
  confidence,
}) {
  if (!sanitizedMix) return null;

  const equityMix01 = sanitizedMix.asset_mix.equity;
  const bondMix01 = sanitizedMix.asset_mix.bond;
  const otherMix01 = sanitizedMix.asset_mix.other;

  const equityRegionsV2 = normalizeExposureMapToParent01(equityRegionsTotal, equityMix01);
  const sectorsV2 = normalizeExposureMapToParent01(equitySectorsTotal, equityMix01);
  const equityStylesV2 = normalizeExposureMapToParent01(styleWeightsTotal, equityMix01);
  const marketCapsV2 = normalizeExposureMapToParent01(sizeWeightsTotal, equityMix01);
  const bondTypesV2 = fixedIncomeType && bondMix01 > 0 ? { [fixedIncomeType]: +bondMix01.toFixed(6) } : null;
  const creditV2 = creditBucket && bondMix01 > 0 ? { [creditBucket]: +bondMix01.toFixed(6) } : null;
  const durationV2 = durationBucket && bondMix01 > 0 ? { [durationBucket]: +bondMix01.toFixed(6) } : null;

  const portfolioExposureV2 = {
    version: "v2",
    asset_mix: sanitizedMix.asset_mix,
    equity_regions: equityRegionsV2,
    sectors: sectorsV2,
    equity_styles: equityStylesV2,
    market_caps: marketCapsV2,
    bond_types: bondTypesV2,
    credit: creditV2,
    duration: durationV2,
    alternatives:
      classificationV2.asset_type === "alternative" && otherMix01 > 0
        ? { alternative: +otherMix01.toFixed(6) }
        : null,
    exposure_confidence: confidence,
    warnings: [],
  };

  for (const w of sanitizedMix.warnings || []) {
    portfolioExposureV2.warnings.push(assetMixGuardrailWarningToString(w));
  }

  return portfolioExposureV2;
}

module.exports = {
  assetMixGuardrailWarningToString,
  buildPortfolioExposureV2,
};

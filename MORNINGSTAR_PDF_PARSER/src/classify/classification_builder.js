/**
 * classification_v2 builder.
 * REFACTOR-2.
 *
 * Pure functions only: no filesystem, no Gemini, no Firestore.
 */

"use strict";

const { normalizeSubtypeByAssetType } = require("./subtype_classifier");

function assetTypeFromDerivedAssetClass(derivedAssetClass) {
  return derivedAssetClass === "RV"
    ? "equity"
    : derivedAssetClass === "RF"
      ? "fixed_income"
      : derivedAssetClass === "Mixto"
        ? "allocation"
        : derivedAssetClass === "Monetario"
          ? "money_market"
          : derivedAssetClass === "Alternativos"
            ? "alternative"
            : derivedAssetClass === "Inmobiliario"
              ? "real_asset"
              : derivedAssetClass === "Commodities"
                ? "alternative"
                : "other";
}

function buildClassificationV2({
  derivedAssetClass,
  assetSubtype,
  ms,
  derivedPrimaryRegion,
  styleBoxCell,
  sizeBucket,
  fixedIncomeType,
  creditBucket,
  durationBucket,
  subcats,
  flags,
  confidence,
}) {
  const classificationV2 = {
    version: "v2",
    asset_type: assetTypeFromDerivedAssetClass(derivedAssetClass),
    asset_subtype: assetSubtype || "UNKNOWN",
    commercial_type: ms.category_morningstar || null,
    region_primary: derivedPrimaryRegion || "Global",
    region_secondary: null,
    equity_style_box: styleBoxCell || null,
    market_cap_bias: sizeBucket || null,
    fixed_income_type: fixedIncomeType,
    credit_bucket: creditBucket,
    duration_bucket: durationBucket,
    strategy_tags: subcats || [],
    vehicle_complexity: flags.is_index_like
      ? "plain_vanilla"
      : flags.is_thematic
        ? "thematic"
        : flags.is_sector_fund
          ? "sector"
          : "active",
    classification_confidence: confidence,
    sources_used: [
      ms.category_morningstar ? "ms.category_morningstar" : null,
      ms.sectors ? "ms.sectors" : null,
      ms.regions?.detail || ms.regions?.macro ? "ms.regions" : null,
      ms.equity_style?.style_box_cell || ms.equity_style?.market_cap || ms.equity_style?.style ? "ms.equity_style" : null,
      ms.fixed_income ? "ms.fixed_income" : null,
    ].filter(Boolean),
    warnings: [],
  };

  const subtypeNormalization = normalizeSubtypeByAssetType(
    classificationV2.asset_type,
    classificationV2.asset_subtype,
    fixedIncomeType
  );
  if (subtypeNormalization.incompatible) {
    classificationV2.warnings.push(
      `subtype_incompatible_with_asset_type:${classificationV2.asset_type}:${classificationV2.asset_subtype}`
    );
    classificationV2.asset_subtype = subtypeNormalization.subtype;
    classificationV2.warnings.push(
      `subtype_downgraded_to_safe_family:${classificationV2.asset_subtype}`
    );
  } else if (subtypeNormalization.defaulted) {
    classificationV2.asset_subtype = subtypeNormalization.subtype;
    classificationV2.warnings.push("money_market_subtype_defaulted");
  }

  return classificationV2;
}

module.exports = {
  assetTypeFromDerivedAssetClass,
  buildClassificationV2,
};

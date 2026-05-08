/**
 * Asset mix normalization and validation.
 * REFACTOR-1 — Phase D
 *
 * Extracted from cargador_lotes_v_2.js.
 * Dependencies: parseNum, clampPct, clamp01, approxEqual, isPlainObject
 *   from ../utils/number_utils.js
 */

"use strict";

const { parseNum, clampPct, clamp01, approxEqual, isPlainObject } = require("../utils/number_utils");

function validateAssetMix(assetMix) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(assetMix)) {
    return { ok: false, errors: ["asset_mix_missing_or_invalid"], warnings };
  }

  const equity = clamp01(assetMix.equity ?? 0);
  const bond = clamp01(assetMix.bond ?? 0);
  const cash = clamp01(assetMix.cash ?? 0);
  const other = clamp01(assetMix.other ?? 0);

  const values = { equity, bond, cash, other };

  for (const [k, v] of Object.entries(values)) {
    if (v === null) errors.push(`asset_mix_invalid_value:${k}`);
  }

  if (errors.length) return { ok: false, errors, warnings };

  const sum = equity + bond + cash + other;

  if (sum <= 0.000001) errors.push("asset_mix_sum_zero");
  if (!approxEqual(sum, 1.0, 0.01)) errors.push(`asset_mix_sum_not_1:${sum.toFixed(6)}`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized: {
      equity: +equity.toFixed(6),
      bond: +bond.toFixed(6),
      cash: +cash.toFixed(6),
      other: +other.toFixed(6),
      sum: +sum.toFixed(6),
    },
  };
}

function validateChildMapAgainstParent(mapObj, parentWeight, label, tolerance = 0.03) {
  const errors = [];
  const warnings = [];

  if (mapObj == null) return { ok: true, errors, warnings, sum: null };
  if (!isPlainObject(mapObj)) {
    errors.push(`${label}_not_object`);
    return { ok: false, errors, warnings, sum: null };
  }

  let sum = 0;
  for (const [k, v] of Object.entries(mapObj)) {
    const n0 = parseNum(v);
    if (!Number.isFinite(n0)) {
      errors.push(`${label}_invalid_value:${k}`);
      continue;
    }
    if (n0 < 0) {
      errors.push(`${label}_negative_value:${k}`);
      continue;
    }
    const n = n0 > 1 ? n0 / 100 : n0;
    sum += n;
  }

  if (parentWeight != null && parentWeight > 0) {
    if (sum > parentWeight + tolerance) {
      errors.push(`${label}_sum_gt_parent:${sum.toFixed(6)}>${parentWeight.toFixed(6)}`);
    } else if (sum < parentWeight - tolerance) {
      warnings.push(`${label}_sum_lt_parent:${sum.toFixed(6)}<${parentWeight.toFixed(6)}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings, sum: +sum.toFixed(6) };
}

function validateCanonicalMath({ classification_v2, portfolio_exposure_v2 }) {
  const errors = [];
  const warnings = [];

  if (!portfolio_exposure_v2 || !isPlainObject(portfolio_exposure_v2)) {
    return { ok: false, errors: ["portfolio_exposure_v2_missing"], warnings };
  }

  const mixCheck = validateAssetMix(portfolio_exposure_v2.asset_mix);
  errors.push(...mixCheck.errors);
  warnings.push(...mixCheck.warnings);

  if (!mixCheck.ok) {
    return { ok: false, errors, warnings, diagnostics: { mixCheck } };
  }

  const eq = mixCheck.normalized.equity;
  const bond = mixCheck.normalized.bond;

  const eqRegions = validateChildMapAgainstParent(portfolio_exposure_v2.equity_regions, eq, "equity_regions");
  const sectors = validateChildMapAgainstParent(portfolio_exposure_v2.sectors, eq, "sectors");
  const eqStyles = validateChildMapAgainstParent(portfolio_exposure_v2.equity_styles, eq, "equity_styles");
  const marketCaps = validateChildMapAgainstParent(portfolio_exposure_v2.market_caps, eq, "market_caps");
  const bondTypes = validateChildMapAgainstParent(portfolio_exposure_v2.bond_types, bond, "bond_types");
  const credit = validateChildMapAgainstParent(portfolio_exposure_v2.credit, bond, "credit");
  const duration = validateChildMapAgainstParent(portfolio_exposure_v2.duration, bond, "duration");

  [eqRegions, sectors, eqStyles, marketCaps, bondTypes, credit, duration].forEach((r) => {
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  });

  if (classification_v2?.asset_type === "equity" && eq < 0.5) {
    warnings.push(`class_exposure_tension:equity_asset_type_with_equity_${eq.toFixed(4)}`);
  }

  if (classification_v2?.asset_type === "fixed_income" && bond < 0.2) {
    warnings.push(`class_exposure_tension:fixed_income_asset_type_with_bond_${bond.toFixed(4)}`);
  }

  if (classification_v2?.asset_type === "money_market" && mixCheck.normalized.cash + mixCheck.normalized.bond < 0.75) {
    warnings.push("class_exposure_tension:money_market_without_cash_bond_majority");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    diagnostics: {
      mixCheck,
      eqRegions,
      sectors,
      eqStyles,
      marketCaps,
      bondTypes,
      credit,
      duration,
    },
  };
}

function sanitizeAssetMixForExposureBuilder(allocationObj) {
  if (!allocationObj || typeof allocationObj !== "object") return null;

  const warnings = [];
  const keys = ["equity", "bond", "cash", "other"];
  const raw = {};

  for (const k of keys) {
    const parsed = parseNum(allocationObj[k]);
    if (!Number.isFinite(parsed)) {
      raw[k] = 0;
      warnings.push({ code: "missing_or_invalid_component", component: k });
      continue;
    }
    if (parsed < 0) {
      raw[k] = 0;
      warnings.push({ code: "negative_component_clamped_to_zero", component: k, value: +parsed.toFixed(6) });
      continue;
    }
    if (parsed > 100) {
      raw[k] = 100;
      warnings.push({ code: "component_gt_100_clamped", component: k, value: +parsed.toFixed(6) });
      continue;
    }
    raw[k] = +parsed.toFixed(6);
  }

  const values = Object.values(raw);
  const maxV = values.reduce((m, v) => Math.max(m, v), 0);
  const minPositive = values.filter((v) => v > 0).reduce((m, v) => Math.min(m, v), Infinity);

  const looksLikePercentScale = maxV > 1.000001;
  const mixedScaleSignal = looksLikePercentScale && Number.isFinite(minPositive) && minPositive > 0 && minPositive < 1;

  const decimals = {};
  for (const k of keys) {
    decimals[k] = looksLikePercentScale ? raw[k] / 100.0 : raw[k];
  }

  const sumBeforeRebase = keys.reduce((acc, k) => acc + decimals[k], 0);
  if (sumBeforeRebase <= 0.000001) return null;

  if (looksLikePercentScale) {
    warnings.push({ code: "detected_scale_0_100_divided_by_100", max_component: +maxV.toFixed(6) });
  }

  if (mixedScaleSignal) {
    warnings.push({
      code: "mixed_scale_signal_detected",
      min_positive_component: +minPositive.toFixed(6),
      max_component: +maxV.toFixed(6),
    });
  }

  const needRebase = !approxEqual(sumBeforeRebase, 1.0, 0.01);
  const denom = needRebase ? sumBeforeRebase : 1.0;

  const asset_mix = {
    equity: +(decimals.equity / denom).toFixed(6),
    bond: +(decimals.bond / denom).toFixed(6),
    cash: +(decimals.cash / denom).toFixed(6),
    other: +(decimals.other / denom).toFixed(6),
  };
  const sumAfterRebase = +(asset_mix.equity + asset_mix.bond + asset_mix.cash + asset_mix.other).toFixed(6);

  if (needRebase) {
    warnings.push({
      code: "asset_mix_rebased_to_sum_1",
      sum_before: +sumBeforeRebase.toFixed(6),
      sum_after: sumAfterRebase,
    });
  }

  return {
    asset_mix,
    warnings,
    diagnostics: {
      source_scale: looksLikePercentScale ? "0_100" : "0_1",
      sum_before: +sumBeforeRebase.toFixed(6),
      sum_after: sumAfterRebase,
    },
  };
}

function normalizeExposureMapToParent01(mapObj, parentWeight01) {
  const parent = clamp01(parentWeight01);
  if (parent === null || parent <= 0) return null;
  if (!mapObj || typeof mapObj !== "object") return null;

  const clean = {};
  let sum = 0;

  for (const [k, rawV] of Object.entries(mapObj)) {
    const n0 = parseNum(rawV);
    if (!Number.isFinite(n0) || n0 <= 0) continue;
    const n = n0 > 1 ? n0 / 100 : n0;
    if (n <= 0) continue;
    clean[k] = n;
    sum += n;
  }

  if (sum <= 0.000001) return null;

  const out = {};
  for (const [k, n] of Object.entries(clean)) {
    const w = (n / sum) * parent;
    if (w > 0) out[k] = +w.toFixed(6);
  }

  return Object.keys(out).length ? out : null;
}

module.exports = {
  validateAssetMix,
  validateChildMapAgainstParent,
  validateCanonicalMath,
  sanitizeAssetMixForExposureBuilder,
  normalizeExposureMapToParent01,
};

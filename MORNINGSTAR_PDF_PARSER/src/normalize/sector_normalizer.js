/**
 * Sector normalization.
 * REFACTOR-1 — Phase E
 *
 * Extracted from cargador_lotes_v_2.js.
 * Dependencies: clampPct from ../utils/number_utils.js
 *               cleanRegionKey from ./region_normalizer.js
 */

"use strict";

const { clampPct } = require("../utils/number_utils");
const { cleanRegionKey } = require("./region_normalizer");

function normalizeSectors(rawObj, warnings = []) {
  if (!rawObj || typeof rawObj !== "object") return null;

  const cleanObj = {};
  for (const [rawK, rawV] of Object.entries(rawObj)) {
    const val = clampPct(rawV);
    if (val !== null && val > 0) {
      const cleanK = cleanRegionKey(rawK);
      cleanObj[cleanK] = val;
    } else if (rawV !== null && rawV !== 0 && rawV !== "") {
      if (warnings && !warnings.includes(`invalid_sector_value:${rawK}`)) {
        warnings.push(`invalid_sector_value:${rawK}`);
      }
    }
  }

  return Object.keys(cleanObj).length > 0 ? cleanObj : null;
}

module.exports = {
  normalizeSectors,
};

/**
 * Region normalization and classification.
 * REFACTOR-1 — Phase C
 *
 * Extracted from cargador_lotes_v_2.js — all region logic lives here.
 * Dependencies: parseNum, clampPct from ../utils/number_utils.js
 */

"use strict";

const { parseNum, clampPct } = require("../utils/number_utils");

// ============================
// Regional normalization
// ============================
const REGION_MAPPINGS = {
  united_states: ["usa", "u.s.", "u.s.a", "eeuu", "estados_unidos", "united_states"],
  canada: ["canada", "canad\u00e1"],
  latin_america: ["latin_america", "latinoamerica", "latinoam\u00e9rica", "america_latina", "am\u00e9rica_latina", "iberoamerica", "iberoam\u00e9rica"],
  eurozone: ["eurozone", "euro_zone", "zona_euro", "zona_del_euro", "emu"],
  europe_ex_euro: [
    "europe_ex_euro",
    "europe_ex-euro",
    "europa_ex_euro",
    "europe_excluding_eurozone",
    "europe_ex_eurozone",
    "europa_sin_euro",
    "europa_ex_zona_euro",
    "europa - ex euro",
  ],
  europe: ["europe", "europa"],
  united_kingdom: ["uk", "u.k.", "united_kingdom", "reino_unido", "great_britain", "gran_breta\u00f1a", "gran_bretana"],
  europe_emerging: ["emerging_europe", "europa_emergente"],
  japan: ["japan", "jap\u00f3n", "japon"],
  developed_asia: ["developed_asia", "asia_desarrollada", "asia_developed"],
  china: ["china"],
  asia_emerging: ["asia_emerging", "emerging_asia", "asia_emergente", "asia - emergente"],
  middle_east: ["middle_east", "oriente_medio", "oriente_medio_africa", "oriente_medio_/_africa"],
  africa: ["africa", "\u00e1frica"],
  australasia: ["australasia", "australia", "new_zealand", "nueva_zelanda"],
  americas: ["americas", "am\u00e9ricas"],
  europe_me_africa: [
    "europe_me_africa",
    "emea",
    "europa_o_medio_africa",
    "europa_oriente_medio_africa",
    "europe_middle_east_africa",
    "europao._medioafrica",
    "europao_medioafrica",
    "europa/o_medio/africa",
    "europa/o.medio/africa",
  ],
  asia: ["asia"],
};

const IGNORE_KEYS = [
  "total",
  "equity_region_total",
  "fixed_income_region_total",
  "world_regions_total",
  "bond_region_total",
  "cash_region_total",
  "not_classified",
];

const BENIGN_UNKNOWN_REGION_KEYS = new Set([
  "region",
  "regions",
  "world",
  "global",
  "n_a",
  "na",
]);

function cleanRegionKey(k) {
  if (!k) return "";
  return String(k)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/]/g, "_")
    .replace(/[\s-]/g, "_")
    .replace(/[^a-z0-9_.]/g, "");
}

// Build lookup table
const REGION_LOOKUP = {};
for (const [canonical, aliases] of Object.entries(REGION_MAPPINGS)) {
  aliases.forEach((alias) => {
    REGION_LOOKUP[cleanRegionKey(alias)] = canonical;
  });
}

function normalizeRegions(rawObj, warnings = []) {
  if (Array.isArray(rawObj)) return null;
  if (!rawObj || typeof rawObj !== "object") return null;

  const canonicalObj = {};
  const rawKeys = Object.keys(rawObj);

  const hasSpecificEurope = rawKeys.some((k) => {
    const cleanK = cleanRegionKey(k);
    const can = REGION_LOOKUP[cleanK];
    return can === "eurozone" || can === "europe_ex_euro";
  });

  for (const [rawK, rawV] of Object.entries(rawObj)) {
    const val = clampPct(rawV);
    if (val === null || val === 0) continue;

    const cleanK = cleanRegionKey(rawK);

    if (IGNORE_KEYS.includes(cleanK) || cleanK.includes("_total")) continue;
    if (hasSpecificEurope && (cleanK === "europe" || cleanK === "europa")) continue;

    let canonical = REGION_LOOKUP[cleanK];

    if (canonical) {
      canonicalObj[canonical] = (canonicalObj[canonical] || 0) + val;
    } else {
      if (cleanK === "other" || cleanK === "others" || cleanK === "otros") {
        continue;
      } else {
        canonicalObj.other = (canonicalObj.other || 0) + val;
        if (
          warnings &&
          !BENIGN_UNKNOWN_REGION_KEYS.has(cleanK) &&
          !cleanK.endsWith("_region") &&
          !cleanK.includes("region_") &&
          !warnings.includes(`unknown_region_key:${rawK}`)
        ) {
          warnings.push(`unknown_region_key:${rawK}`);
        }
      }
    }
  }

  let currentSum = 0;
  for (const k in canonicalObj) currentSum += canonicalObj[k];

  if (currentSum > 0.0) {
    const remainder = 100.0 - currentSum;
    if (remainder > 0.25) {
      canonicalObj.other = (canonicalObj.other || 0) + remainder;
      canonicalObj.other = +canonicalObj.other.toFixed(4);
    }

    if (currentSum > 101.0 && warnings) {
      warnings.push(`regions_sum_overflow:${currentSum.toFixed(2)}`);
    }
  } else {
    if (warnings && Object.keys(rawObj).length > 0) {
      warnings.push("regions_all_unrecognized");
    }
  }

  for (const k in canonicalObj) {
    if (canonicalObj[k] > 100) canonicalObj[k] = 100;
  }

  return Object.keys(canonicalObj).length > 0 ? canonicalObj : null;
}

// ============================
// Region text detection
// ============================
function hasExcludedJapanRegionText(textUpper) {
  const c = textUpper || "";
  return (
    /\bEX\s*[-_/]?\s*JAP(?:AN|ON)\b/.test(c) ||
    /\bEXCLUDING\s+JAP(?:AN|ON)\b/.test(c) ||
    /\bSIN\s+JAPON\b/.test(c)
  );
}

function hasJapanRegionText(textUpper) {
  const c = textUpper || "";
  return /\bJAP(?:AN|ON)\b/.test(c);
}

function hasLatinAmericaIdentity(text = "") {
  const c = String(text || "");
  return (
    c.includes("BRAZIL") ||
    c.includes("BRASIL") ||
    c.includes("LATIN AMERICA") ||
    c.includes("LATAM") ||
    c.includes("LATINOAMERICA") ||
    c.includes("IBEROAMERICA")
  );
}

// ============================
// Region classification
// ============================
function derivePrimaryRegion(msRegions, catUpper, nameUpper = "") {
  const c = `${catUpper || ""} ${nameUpper || ""}`;
  const excludesJapan = hasExcludedJapanRegionText(c);

  if (excludesJapan && c.includes("ASIA")) return "Asia";

  if (
    c.includes("EUROPE") ||
    c.includes("EUROPA") ||
    c.includes("EUROZONE") ||
    c.includes("EMU") ||
    c.includes("EUROLAND")
  ) return "Europa";

  if (
    c.includes("USA") ||
    c.includes("UNITED STATES") ||
    c.includes("US ") ||
    c.includes(" U.S.") ||
    c.includes("NORTH AMERICA")
  ) return "USA";

  if (hasJapanRegionText(c) && !excludesJapan) return "Jap\u00f3n";
  if (hasLatinAmericaIdentity(c)) return "Emergentes";
  if (c.includes("EMERGING") || c.includes("EMERGENTE")) return "Emergentes";
  if (c.includes("ASIA")) return "Asia";
  if (c.includes("GLOBAL") || c.includes("WORLD") || c.includes("INTERNATIONAL")) return "Global";

  let us = 0;
  let europe = 0;
  let asia = 0;
  let emerging = 0;
  let japan = 0;

  if (msRegions && typeof msRegions === "object") {
    const detail = msRegions.detail || null;
    const macro = msRegions.macro || null;

    if (detail && typeof detail === "object") {
      us = (parseNum(detail.united_states) || 0) + (parseNum(detail.canada) || 0);
      europe =
        (parseNum(detail.eurozone) || 0) +
        (parseNum(detail.united_kingdom) || 0) +
        (parseNum(detail.europe_ex_euro) || 0) +
        (parseNum(detail.europe) || 0);

      emerging =
        (parseNum(detail.latin_america) || 0) +
        (parseNum(detail.asia_emerging) || 0) +
        (parseNum(detail.europe_emerging) || 0) +
        (parseNum(detail.africa) || 0) +
        (parseNum(detail.middle_east) || 0) +
        (parseNum(detail.emerging) || 0);

      japan = parseNum(detail.japan) || 0;

      asia =
        (parseNum(detail.developed_asia) || 0) +
        (parseNum(detail.australasia) || 0) +
        (parseNum(detail.china) || 0);
    }

    if (macro && typeof macro === "object") {
      if (us === 0) us = parseNum(macro.americas) || 0;
      if (asia === 0) asia = parseNum(macro.asia) || 0;
      if (europe === 0) europe = parseNum(macro.europe_me_africa) || 0;
    }
  }

  const buckets = [
    { name: "USA", value: us },
    { name: "Europa", value: europe },
    { name: "Asia", value: asia },
    { name: "Emergentes", value: emerging },
    { name: "Jap\u00f3n", value: japan },
  ].sort((a, b) => b.value - a.value);

  const first = buckets[0];
  const second = buckets[1];

  if (!first || first.value <= 0) return "Global";
  if (first.value >= 30 && second && second.value >= 25) return "Global";
  if (first.value >= 35) return first.name;
  return "Global";
}

module.exports = {
  REGION_MAPPINGS,
  REGION_LOOKUP,
  IGNORE_KEYS,
  BENIGN_UNKNOWN_REGION_KEYS,
  cleanRegionKey,
  normalizeRegions,
  hasExcludedJapanRegionText,
  hasJapanRegionText,
  hasLatinAmericaIdentity,
  derivePrimaryRegion,
};

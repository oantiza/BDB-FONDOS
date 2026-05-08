/**
 * Asset type classification helpers.
 * REFACTOR-2.
 *
 * Pure functions only: no filesystem, no Gemini, no Firestore.
 */

"use strict";

function deriveAssetClassFromCategory(catUpper, nameUpper = "", sectors = null) {
  const c = `${catUpper || ""} ${nameUpper || ""}`;

  if (
    c.includes("MONETARIO") ||
    c.includes("MONEY MARKET") ||
    c.includes("LIQUIDEZ") ||
    c.includes("LIQUIDITY") ||
    c.includes("TREASURY") ||
    c.includes("TRÃƒâ€°SORERIE") ||
    c.includes("TRESORERIE") ||
    c.includes("VNAV") ||
    c.includes("LVNAV")
  ) return "Monetario";

  if (
    c.includes("CONVERTIBLE") ||
    c.startsWith("RF") ||
    c.includes("RENTA FIJA") ||
    c.includes("BOND") ||
    c.includes("CREDIT") ||
    c.includes("FIXED INCOME") ||
    c.includes("DEUDA")
  ) return "RF";

  if (
    c.includes("RETORNO ABSOLUTO") ||
    c.includes("ABSOLUTE RETURN") ||
    c.includes("MARKET NEUTRAL") ||
    c.includes("LONG/SHORT") ||
    c.includes("LONG SHORT") ||
    c.includes("MULTISTRATEGY") ||
    c.includes("MULTI-STRATEGY") ||
    c.includes("SYSTEMATIC FUTURES") ||
    c.includes("MANAGED FUTURES") ||
    c.includes("GLOBAL MACRO")
  ) return "Alternativos";

  if (
    c.includes("INMOBILIAR") ||
    c.includes("REAL ESTATE") ||
    c.includes("REIT") ||
    c.includes("PROPERTY") ||
    c.includes("IMMOBILIER")
  ) return "Inmobiliario";

  const hardCommodities = [
    "COMMODIT",
    "MATERIAS PRIMAS",
    "PRECIOUS METALS",
    "WORLD GOLD",
    "GLOBAL GOLD",
    "GOLD FUND",
    "GOLD & SILVER",
    "GOLD AND PRECIOUS METALS",
    "METALS & MINING",
    "METALS AND MINING",
    "WORLD MINING",
    "MINING FUND",
    "PRECIOUS METALS FUND",
  ];

  if (hardCommodities.some((x) => c.includes(x))) return "Commodities";

  if (
    c.includes("ALLOCATION") ||
    c.includes("MIXTO") ||
    c.includes("BALANCED") ||
    c.includes("MULTI ASSET") ||
    c.includes("MULTIASSET")
  ) return "Mixto";

  if (
    c.startsWith("RV") ||
    c.includes("RENTA VARIABLE") ||
    c.includes("EQUITY") ||
    c.includes("ACCIONES")
  ) return "RV";

  if (sectors && typeof sectors === "object") {
    const hasRealEquitySector = Object.keys(sectors).some((k) =>
      [
        "technology",
        "financial_services",
        "financials",
        "industrials",
        "healthcare",
        "utilities",
        "energy",
        "communication_services",
        "consumer_cyclical",
        "consumer_defensive",
        "real_estate",
        "basic_materials",
      ].includes(k)
    );
    if (hasRealEquitySector) return "RV";
  }

  return "Otros";
}

module.exports = {
  deriveAssetClassFromCategory,
};

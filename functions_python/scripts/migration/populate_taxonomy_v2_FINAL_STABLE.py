"""
populate_taxonomy_v2.py — V2 Classification & Exposure Batch Runner
"""

import os
import sys
from datetime import datetime, timezone

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from models.canonical_types import (
    AssetClassV2,
    AssetSubtypeV2,
    StrategyTypeV2,
    RiskBucketV2,
    RegionV2,
    EquityStyleBoxV2,
    MarketCapBiasV2,
    SectorFocusV2,
    FIDurationBucketV2,
    FICreditBucketV2,
    AlternativeBucketV2,
    ConvertiblesProfileV2,
    ClassificationV2,
    PortfolioExposureV2,
    EconomicExposureV2,
)

db = None


# =============================================================================
# SAFETY HELPERS
# =============================================================================


def _safe_dict(x):
    return x if isinstance(x, dict) else {}


def _safe_list(x):
    return x if isinstance(x, list) else []


def _safe_str(x) -> str:
    return "" if x is None else str(x).strip()


def _safe_upper(x) -> str:
    return _safe_str(x).upper()


def _safe_float(x, default=0.0) -> float:
    try:
        if x is None or x == "":
            return float(default)
        return float(x)
    except Exception:
        return float(default)


def _clamp01(x: float) -> float:
    return round(max(0.0, min(1.0, float(x))), 4)


def _append_unique(lst, value):
    if value and value not in lst:
        lst.append(value)


def _contains_any(text: str, terms: list[str]) -> bool:
    return any(t in text for t in terms)


def _contains_all(text: str, terms: list[str]) -> bool:
    return all(t in text for t in terms)


def _year_hint_in_text(text: str) -> bool:
    return any(y in text for y in ["2025", "2026", "2027", "2028", "2029", "2030"])


# =============================================================================
# FIREBASE
# =============================================================================


def init_firebase():
    global db
    if db is not None:
        return

    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        key_paths = [
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "..",
                "..",
                "scripts",
                "serviceAccountKey.json",
            ),
            os.path.join(os.path.dirname(__file__), "..", "serviceAccountKey.json"),
            "./serviceAccountKey.json",
            "../serviceAccountKey.json",
        ]

        for kp in key_paths:
            kp_abs = os.path.abspath(kp)
            if os.path.exists(kp_abs):
                cred = credentials.Certificate(kp_abs)
                firebase_admin.initialize_app(cred)
                print(f"[INIT] Firebase initialized with key: {kp_abs}")
                break
        else:
            firebase_admin.initialize_app()
            print("[INIT] Firebase initialized with default credentials")

    db = firestore.client()


# =============================================================================
# TEXT NORMALIZATION
# =============================================================================


def _extract_text_context(data: dict) -> dict:
    data = _safe_dict(data)
    ms = _safe_dict(data.get("ms"))
    derived = _safe_dict(data.get("derived"))

    name = _safe_str(data.get("name", ""))

    legacy_asset_class = _safe_str(
        data.get("legacy_asset_class")
        or data.get("asset_class_legacy")
        or derived.get("asset_class")
        or ""
    )

    legacy_category = _safe_str(
        data.get("legacy_category")
        or data.get("category")
        or data.get("category_legacy")
        or derived.get("category")
        or ms.get("category")
        or ""
    )

    ms_cat = _safe_str(ms.get("category_morningstar", ""))

    combined = " | ".join(
        [x for x in [ms_cat, name, legacy_category, legacy_asset_class] if x]
    )

    return {
        "name": name,
        "name_up": _safe_upper(name),
        "ms_cat": ms_cat,
        "ms_cat_up": _safe_upper(ms_cat),
        "legacy_asset_class": legacy_asset_class,
        "legacy_asset_class_up": _safe_upper(legacy_asset_class),
        "legacy_category": legacy_category,
        "legacy_category_up": _safe_upper(legacy_category),
        "combined": combined,
        "combined_up": _safe_upper(combined),
    }


# =============================================================================
# ASSET CLASS
# =============================================================================


def _deduce_asset_class(
    data: dict, eq_metric: float, bd_metric: float
) -> tuple[AssetClassV2, float]:
    ctx = _extract_text_context(data)
    text = ctx["combined_up"]

    if _contains_any(
        text,
        [
            "MARKET NEUTRAL",
            "LONG/SHORT",
            "LONG SHORT",
            "LONG-SHORT",
            "SYSTEMATIC FUTURES",
            "DIVERSIFIED FUTURES",
            "ABSOLUTE RETURN",
            "MULTISTRATEGY",
            "MULTI-STRATEGY",
            "GLOBAL MACRO",
            "ALT -",
        ],
    ):
        return AssetClassV2.ALTERNATIVE, 0.95

    if _contains_any(
        text, ["REAL ESTATE", "PROPERTY", "IMMOBILIER", "INMOBILIARIO", "REIT"]
    ):
        return AssetClassV2.REAL_ESTATE, 0.95

    if _contains_any(
        text,
        [
            "PRECIOUS METALS",
            "METALES PRECIOSOS",
            "GOLD FUND",
            "WORLD GOLD",
            "GOLD AND PRECIOUS METALS",
            "MATERIAS PRIMAS",
            "COMMODITIES",
        ],
    ):
        return AssetClassV2.COMMODITIES, 0.95

    if _contains_any(
        text,
        [
            "MONEY MARKET",
            "MONETARY",
            "MERCADO MONETARIO",
            "MONETARIO",
            "LIQUIDITY",
            "TRESORERIE",
            "TRÉSORERIE",
            "TESORERIA",
            "CURRENT ACCOUNT",
            "CASH EUR",
            "EUR LIQUIDITY",
            "VNAV",
            "LVNAV",
        ],
    ):
        return AssetClassV2.MONETARY, 0.95

    if _contains_any(
        text,
        [
            "ALLOCATION",
            "MIXTO",
            "MULTI ASSET",
            "MULTIASSET",
            "DYNAMIC MULTI",
            "INCOME BUILDER",
            "FLEXIBLE ALLOCATION",
            "BALANCED",
            "PATRIMONIO",
            "TARGET™ 2030 FUND",
            "TARGET™ 2035 FUND",
            "TARGET 2030 FUND",
            "TARGET 2035 FUND",
            "FECHA OBJETIVO",
        ],
    ):
        return AssetClassV2.MIXED, 0.92

    if _contains_any(
        text,
        [
            "FIXED INCOME",
            "BOND",
            "BONO",
            "BONOS",
            "RENTA FIJA",
            "RF ",
            " RF",
            "CREDIT",
            "DEUDA",
            "TREASURY",
            "HIGH YIELD",
            "INFLATION",
            "FLOATING RATE",
            "SHORT DURATION",
            "SUBORDINATED BOND",
            "AGGREGATE BOND",
            "STRATEGIC BOND",
            "FIXED TERM BOND",
            "TARGET MATURITY",
            "HORIZONTE 202",
            "VENCIMIENTO",
            "MATURITY",
            "CONVERTIBLE",
            "EMERGING MARKET DEBT",
            "EM DEBT",
        ],
    ):
        if (
            "MIXTO" not in text
            and "ALLOCATION" not in text
            and "MULTI ASSET" not in text
        ):
            return AssetClassV2.FIXED_INCOME, 0.94

    if _contains_any(
        text,
        [
            "EQUITY",
            "RENTA VARIABLE",
            "RV ",
            " RV",
            "ACCIONES",
            "SMALL CAP",
            "MID CAP",
            "DIVIDEND",
            "GROWTH",
            "VALUE",
            "HEALTHCARE",
            "BIOTECH",
            "TECHNOLOGY",
            "FINTECH",
            "ROBOTICS",
            "CLIMATE",
            "INFRASTRUCTURE",
            "WATER",
            "CONSUMER",
            "INDUSTRIALS",
            "NATURAL RESOURCES",
            "ECOLOGY",
            "MEGATRENDS",
            "NEWGEMS",
            "BIG DATA",
            "SMART ENERGY",
            "ARTIFICIAL INTELLIGENCE",
            "CONNECTIVITY",
            "TIMBER",
            "ANIMAL WELLBEING",
            "PET AND ANIMAL",
        ],
    ):
        return AssetClassV2.EQUITY, 0.94

    if eq_metric >= 85:
        return AssetClassV2.EQUITY, 0.72
    if bd_metric >= 85:
        return AssetClassV2.FIXED_INCOME, 0.72
    if eq_metric >= 20 and bd_metric >= 20:
        return AssetClassV2.MIXED, 0.68

    return AssetClassV2.UNKNOWN, 0.42


# =============================================================================
# REGION
# =============================================================================


def _deduce_region_primary(
    data: dict, asset_type: AssetClassV2
) -> tuple[RegionV2, float]:
    data = _safe_dict(data)
    ctx = _extract_text_context(data)
    text = ctx["combined_up"]
    legacy = ctx["legacy_category_up"]

    if _contains_any(
        text, ["GLOBAL", "WORLD", "INTERNATIONAL", "ALL COUNTRY", "ACWI", "MONDIAL"]
    ):
        return RegionV2.GLOBAL, 0.96

    if _contains_any(
        text,
        [
            "EUROZONE",
            "EURO ZONE",
            "ZONE EURO",
            "ZONA EURO",
            "EMU",
            "EUROLAND",
            "EURO CORPORATE",
            "EURO CREDIT",
            "EURO GOVERNMENT",
            "EURO GOV",
            "EURO SHORT TERM",
            "EUR MONEY MARKET",
            "EURO MONEY MARKET",
            "EURO INFLATION",
            "EURO AGGREGATE",
            "EURO TREASURY",
            "EURO SOVEREIGN",
            "EURO SUSTAINABLE CREDIT",
            "EURO LONG DURATION",
            "EUROLAND BOND",
        ],
    ):
        return RegionV2.EUROZONE, 0.95

    if _contains_any(
        text,
        ["EUROPE", "PAN EUROPEAN", "PAN-EUROPEAN", "CONTINENTAL EUROPE", "EUROPEAN"],
    ):
        return RegionV2.EUROPE, 0.95

    if _contains_any(
        text,
        [
            "USA",
            " US ",
            "US EQUITY",
            "AMERICAN",
            "NORTH AMERICA",
            "S&P500",
            "NASDAQ",
            "S&P 500",
        ],
    ):
        return RegionV2.US, 0.95

    if "JAPAN" in text and "EX JAPAN" not in text and "EX-JAPAN" not in text:
        return RegionV2.JAPAN, 0.95

    if _contains_any(
        text, ["ASIA EX JAPAN", "ASIA EX-JAPAN", "ASIA PACIFIC EX", "ASIA-PACIFIC EX"]
    ):
        return RegionV2.ASIA_DEV, 0.95

    if _contains_any(
        text,
        [
            "LATIN AMERICA",
            "LATINOAMERICA",
            "LATINOAMÉRICA",
            "BRAZIL",
            "BRASIL",
            "INDIA",
            "CHINA",
            "EMERGING",
            "FRONTIER",
            "TAIWAN",
            "KOREA",
            "MEXICO",
            "BRIC",
            "RMB",
        ],
    ):
        return RegionV2.EMERGING, 0.95

    if (
        _contains_any(text, ["ASIA", "PACIFIC", "HONG KONG", "SINGAPORE"])
        and "EMERGING" not in text
    ):
        return RegionV2.ASIA_DEV, 0.90

    if _contains_any(
        legacy,
        [
            "RF DEUDA CORPORATIVA EUR",
            "RF DEUDA PÚBLICA EUR",
            "RF DEUDA PUBLICA EUR",
            "RF DIVERSIFICADA EUR",
            "RF DIVERSIFICADA CORTO PLAZO EUR",
            "RF LARGO PLAZO EUR",
            "RF ZONA EURO",
            "RV ZONA EURO",
        ],
    ):
        return RegionV2.EUROZONE, 0.78

    if _contains_any(
        legacy,
        [
            "RF EUROPA",
            "RF CONVERTIBLES EUROPA",
            "RV EUROPA",
            "RV ESPAÑA",
            "RV ALEMANIA",
            "RF EUROPE",
            "RV IBERIA",
        ],
    ):
        return RegionV2.EUROPE, 0.76

    if _contains_any(
        legacy,
        [
            "RF GLOBAL",
            "GLOBAL CORPORATE BOND",
            "GLOBAL FLEXIBLE BOND",
            "GLOBAL BOND",
            "GLOBAL SMALL-CAP EQUITY",
            "RF CONVERTIBLES GLOBAL",
        ],
    ):
        return RegionV2.GLOBAL, 0.76

    ms = _safe_dict(data.get("ms"))
    ms_regions = _safe_dict(ms.get("regions"))
    macro = _safe_dict(ms_regions.get("macro"))
    detail = _safe_dict(ms_regions.get("detail"))

    if macro or detail:
        us = _safe_float(detail.get("united_states", 0)) + _safe_float(
            detail.get("canada", 0)
        )
        eurozone = _safe_float(detail.get("eurozone", 0))
        europe_non_euro = (
            _safe_float(detail.get("united_kingdom", 0))
            + _safe_float(detail.get("switzerland", 0))
            + _safe_float(detail.get("europe_emerging", 0))
        )
        europe_macro = _safe_float(macro.get("europe_me_africa", 0))
        europe_total = max(europe_macro, eurozone + europe_non_euro)

        emerging = (
            _safe_float(detail.get("latin_america", 0))
            + _safe_float(detail.get("asia_emerging", 0))
            + _safe_float(detail.get("africa_middle_east", 0))
            + _safe_float(detail.get("emerging", 0))
        )
        japan = _safe_float(detail.get("japan", 0))
        asia_dev = max(
            0.0,
            _safe_float(macro.get("asia", 0))
            - _safe_float(detail.get("japan", 0))
            - _safe_float(detail.get("asia_emerging", 0)),
        )

        buckets = {
            RegionV2.US: us,
            RegionV2.EUROZONE: eurozone if eurozone >= 75 else 0.0,
            RegionV2.EUROPE: europe_total
            if europe_total >= 65 and eurozone < 75
            else 0.0,
            RegionV2.EMERGING: emerging,
            RegionV2.JAPAN: japan,
            RegionV2.ASIA_DEV: asia_dev,
        }

        best_region = max(buckets, key=buckets.get)
        best_weight = buckets.get(best_region, 0.0)

        if best_region == RegionV2.EUROZONE and best_weight >= 75:
            return RegionV2.EUROZONE, 0.80
        if best_region == RegionV2.EUROPE and best_weight >= 65:
            return RegionV2.EUROPE, 0.78
        if best_weight >= 70:
            return best_region, 0.78
        if best_weight >= 55:
            return best_region, 0.62

    return RegionV2.UNKNOWN, 0.0


# =============================================================================
# EQUITY STYLE
# =============================================================================


def _deduce_equity_style(ms_style: dict, data: dict) -> tuple[EquityStyleBoxV2, bool]:
    ms_style = _safe_dict(ms_style)
    style_data = _safe_dict(ms_style.get("style"))
    mcap_data = _safe_dict(ms_style.get("market_cap"))

    val = _safe_float(style_data.get("value", ms_style.get("value", 0)))
    blend = _safe_float(style_data.get("blend", ms_style.get("blend", 0)))
    growth = _safe_float(style_data.get("growth", ms_style.get("growth", 0)))

    giant = _safe_float(mcap_data.get("giant", ms_style.get("giant", 0)))
    large = _safe_float(mcap_data.get("large", ms_style.get("large", 0)))
    mid = _safe_float(mcap_data.get("mid", ms_style.get("mid", 0)))
    small = _safe_float(mcap_data.get("small", ms_style.get("small", 0)))
    micro = _safe_float(mcap_data.get("micro", ms_style.get("micro", 0)))

    style_comp = None
    if val + blend + growth > 0:
        mx = max(val, blend, growth)
        if mx == val:
            style_comp = "VALUE"
        elif mx == growth:
            style_comp = "GROWTH"
        else:
            style_comp = "CORE"

    cap_comp = None
    large_sum = giant + large
    small_sum = small + micro
    if large_sum + mid + small_sum > 0:
        mx = max(large_sum, mid, small_sum)
        if mx == large_sum:
            cap_comp = "LARGE"
        elif mx == mid:
            cap_comp = "MID"
        else:
            cap_comp = "SMALL"

    is_heuristic = False
    ctx = _extract_text_context(data)
    text = ctx["combined_up"]

    if not style_comp:
        if "GROWTH" in text or "CRECIMIENTO" in text:
            style_comp = "GROWTH"
            is_heuristic = True
        elif "VALUE" in text or "VALOR" in text:
            style_comp = "VALUE"
            is_heuristic = True
        elif _contains_any(text, ["CORE", "BLEND", "DIVIDEND", "INCOME"]):
            style_comp = "CORE"
            is_heuristic = True

    if not cap_comp:
        if _contains_any(text, ["LARGE", "LARGE-CAP", "CAP. GRANDE"]):
            cap_comp = "LARGE"
            is_heuristic = True
        elif _contains_any(text, ["MID", "MID-CAP", "MEDIANA"]):
            cap_comp = "MID"
            is_heuristic = True
        elif _contains_any(text, ["SMALL", "SMALL-CAP", "PEQUEÑA", "PEQ/"]):
            cap_comp = "SMALL"
            is_heuristic = True

    if style_comp and cap_comp:
        try:
            return EquityStyleBoxV2(f"{cap_comp}_{style_comp}"), is_heuristic
        except Exception:
            pass

    return EquityStyleBoxV2.UNKNOWN, False


def _deduce_market_cap_bias(ms_style: dict, data: dict) -> tuple[MarketCapBiasV2, bool]:
    ms_style = _safe_dict(ms_style)
    mcap_data = _safe_dict(ms_style.get("market_cap"))
    large = _safe_float(mcap_data.get("giant", ms_style.get("giant", 0))) + _safe_float(
        mcap_data.get("large", ms_style.get("large", 0))
    )
    mid = _safe_float(mcap_data.get("mid", ms_style.get("mid", 0)))
    small = _safe_float(mcap_data.get("small", ms_style.get("small", 0))) + _safe_float(
        mcap_data.get("micro", ms_style.get("micro", 0))
    )

    val = MarketCapBiasV2.UNKNOWN
    is_heuristic = False

    if large + mid + small > 0:
        if large > mid and large > small:
            val = MarketCapBiasV2.LARGE
        elif mid > large and mid > small:
            val = MarketCapBiasV2.MID
        elif small > large and small > mid:
            val = MarketCapBiasV2.SMALL
        else:
            val = MarketCapBiasV2.MULTI

    if val == MarketCapBiasV2.UNKNOWN:
        ctx = _extract_text_context(data)
        text = ctx["combined_up"]
        if _contains_any(text, ["LARGE", "LARGE-CAP", "CAP. GRANDE"]):
            val = MarketCapBiasV2.LARGE
            is_heuristic = True
        elif _contains_any(text, ["MID", "MID-CAP", "MEDIANA"]):
            val = MarketCapBiasV2.MID
            is_heuristic = True
        elif _contains_any(text, ["SMALL", "SMALL-CAP", "PEQUEÑA", "PEQ/"]):
            val = MarketCapBiasV2.SMALL
            is_heuristic = True

    return val, is_heuristic


# =============================================================================
# FIXED INCOME HELPERS
# =============================================================================


def _fi_legacy_hints(ctx: dict) -> dict:
    legacy = ctx["legacy_category_up"]
    text = ctx["combined_up"]

    return {
        "is_euro_corporate": _contains_any(
            legacy + " | " + text,
            [
                "RF DEUDA CORPORATIVA EUR",
                "RF DIVERSIFICADA EUR",
                "RF DIVERSIFICADA CORTO PLAZO EUR",
                "EURO CREDIT",
                "EURO SUSTAINABLE CREDIT",
                "EURO CORPORATE",
                "SELECTION CREDIT",
                "SELECTION CRÉDIT",
                "CLIMATE BONDS EURO",
                "EUROLAND BOND",
            ],
        ),
        "is_euro_government": _contains_any(
            legacy + " | " + text,
            [
                "RF DEUDA PÚBLICA EUR",
                "RF DEUDA PUBLICA EUR",
                "GOVERNMENT",
                "PUBLIC DEBT",
                "TREASURY",
                "GOVT",
                "EURO GOVERNMENT",
                "EUROLAND GOVERNMENT",
            ],
        ),
        "is_global_bond": _contains_any(
            legacy + " | " + text,
            [
                "RF GLOBAL - EUR CUBIERTO",
                "RF GLOBAL",
                "GLOBAL BOND",
                "GLOBAL CORPORATE BOND",
                "GLOBAL FLEXIBLE BOND",
                "AGGREGATE BOND",
                "BOND INDEX",
                "VANGUARD GLOBAL BOND",
            ],
        ),
        "is_emerging_bond": _contains_any(
            legacy + " | " + text,
            [
                "RF GLOBAL EMERGENTE",
                "RF DEUDA CORPORATIVA GLOBAL EMERGENTE",
                "EMERGING",
                "EM DEBT",
                "EMERGING MARKET DEBT",
                "FRONTIER MARKETS",
                "EMERGING CREDIT",
                "EMERGING CORPORATE DEBT",
                "LOCAL CURRENCY",
                "RMB",
            ],
        ),
        "is_convertible": _contains_any(
            legacy + " | " + text,
            [
                "RF CONVERTIBLES",
                "CONVERTIBLE",
                "CONVERT ",
                " CONVERT",
            ],
        ),
        "is_fixed_term": _contains_any(
            legacy + " | " + text,
            [
                "FIXED TERM BOND",
                "FECHA OBJETIVO",
                "TARGET",
                "HORIZONTE",
                "MATURITY",
            ],
        ),
    }


# =============================================================================
# FIXED INCOME / OTHER DEFINITIONS
# =============================================================================


def _deduce_fixed_income_subtype(data: dict) -> AssetSubtypeV2:
    ctx = _extract_text_context(data)
    text = ctx["combined_up"]
    legacy = ctx["legacy_category_up"]
    fih = _fi_legacy_hints(ctx)

    if _contains_any(
        text, ["SUBORDINATED", "SUBORDINADO", "COCO", "CONTINGENT CONVERTIBLE"]
    ):
        return AssetSubtypeV2.HIGH_YIELD_BOND

    if _contains_any(text, ["HIGH YIELD", "ALTO RENDIMIENTO"]):
        return AssetSubtypeV2.HIGH_YIELD_BOND

    if fih["is_convertible"] or _contains_any(text, ["CONVERTIBLE", "CONVERT "]):
        return AssetSubtypeV2.CONVERTIBLE_BOND

    if fih["is_emerging_bond"]:
        return AssetSubtypeV2.EMERGING_MARKETS_BOND

    if _contains_any(
        text, ["INFLATION", "INFLACION", "INFLACIÓN", "LINKED", "REAL RETURN"]
    ):
        return AssetSubtypeV2.INFLATION_LINKED_BOND

    if fih["is_euro_government"] or _contains_any(
        text,
        [
            "COVERED BOND",
            "STATE BOND",
            "SOVEREIGN",
        ],
    ):
        return AssetSubtypeV2.GOVERNMENT_BOND

    if _contains_any(
        text + " | " + legacy,
        [
            "CLIMATE BONDS",
            "EUROLAND BOND",
            "GLOBAL BOND",
            "AGGREGATE",
            "AGGREGATE BOND",
            "INCOME FUND",
            "EURO CREDIT",
            "SELECTION CREDIT",
            "SELECTION CRÉDIT",
            "CREDIT OPPORTUNITIES",
            "SHORT DURATION CREDIT",
            "SHORT-TERM OPPORTUNITIES",
            "LOW DURATION",
            "LONG DURATION BOND",
            "CORPORATE GREEN BONDS",
            "INVESTMENT GRADE",
            "EURO CORPORATE",
            "EURO SUSTAINABLE CREDIT",
            "BOND INDEX",
            "CORPORATE",
            "CREDIT",
            "GREEN BOND",
            "SUSTAINABLE CREDIT",
            "FLOATING RATE",
            "FRN",
            "MILLESIMA",
            "AHORRO",
            "CORTO PLAZO",
            "RENTA FIJA",
        ],
    ):
        return AssetSubtypeV2.CORPORATE_BOND

    if _contains_any(
        text + " | " + legacy,
        [
            "FLEXIBLE FIXED INCOME",
            "FLEXIBLE INCOME",
            "STRATEGIC BOND",
            "TOTAL RETURN",
            "OPPORTUNITIES",
            "UNCONSTRAINED",
            "FLEXIBLE",
        ],
    ):
        return AssetSubtypeV2.CORPORATE_BOND

    if fih["is_fixed_term"] or _year_hint_in_text(text):
        return AssetSubtypeV2.CORPORATE_BOND

    return AssetSubtypeV2.UNKNOWN


def _deduce_fixed_income_credit(
    data: dict, subtype: AssetSubtypeV2
) -> FICreditBucketV2:
    data = _safe_dict(data)
    ms = _safe_dict(data.get("ms"))
    ms_fi = _safe_dict(ms.get("fixed_income"))
    ctx = _extract_text_context(data)
    text = ctx["combined_up"]
    legacy = ctx["legacy_category_up"]

    if subtype == AssetSubtypeV2.HIGH_YIELD_BOND:
        return FICreditBucketV2.LOW_QUALITY

    if _contains_any(text, ["HIGH YIELD", "SUBORDINATED", "SUBORDINADO", "COCO"]):
        return FICreditBucketV2.LOW_QUALITY

    qual = _safe_dict(ms_fi.get("credit_quality"))
    if qual:
        high = (
            _safe_float(qual.get("aaa", 0))
            + _safe_float(qual.get("aa", 0))
            + _safe_float(qual.get("a", 0))
        )
        med = _safe_float(qual.get("bbb", 0))
        low = (
            _safe_float(qual.get("bb", 0))
            + _safe_float(qual.get("b", 0))
            + _safe_float(qual.get("below_b", 0))
        )

        if low >= 30:
            return FICreditBucketV2.LOW_QUALITY
        if high >= 55:
            return FICreditBucketV2.HIGH_QUALITY
        if med >= 30 or (high >= 30 and med >= 20):
            return FICreditBucketV2.MEDIUM_QUALITY

    if _contains_any(
        text + " | " + legacy,
        [
            "GOVERNMENT",
            "TREASURY",
            "EUROLAND",
            "EURO GOVERNMENT",
            "PUBLIC DEBT",
            "DEUDA PÚBLICA",
            "DEUDA PUBLICA",
            "GOVT",
            "COVERED BOND",
            "RF DEUDA PÚBLICA EUR",
            "RF DEUDA PUBLICA EUR",
        ],
    ):
        return FICreditBucketV2.HIGH_QUALITY

    if _contains_any(
        text + " | " + legacy, ["INDEX FUND", "BOND INDEX"]
    ) and _contains_any(
        text + " | " + legacy, ["GLOBAL BOND", "AGGREGATE", "EUROLAND BOND"]
    ):
        return FICreditBucketV2.HIGH_QUALITY

    if subtype in [
        AssetSubtypeV2.GOVERNMENT_BOND,
        AssetSubtypeV2.INFLATION_LINKED_BOND,
    ]:
        return FICreditBucketV2.HIGH_QUALITY

    if _contains_any(
        text + " | " + legacy,
        [
            "CORPORATE",
            "CREDIT",
            "CLIMATE BONDS",
            "SUSTAINABLE CREDIT",
            "GREEN BONDS",
            "GLOBAL BOND",
            "EURO CREDIT",
            "EUROLAND BOND",
            "SHORT DURATION CREDIT",
            "INVESTMENT GRADE",
            "LOW DURATION",
            "INCOME FUND",
            "RF DEUDA CORPORATIVA EUR",
            "RF DIVERSIFICADA EUR",
            "RF DIVERSIFICADA CORTO PLAZO EUR",
            "RF GLOBAL - EUR CUBIERTO",
            "GLOBAL CORPORATE BOND",
            "FIXED TERM BOND",
        ],
    ):
        return FICreditBucketV2.MEDIUM_QUALITY

    return FICreditBucketV2.UNKNOWN


def _deduce_fi_duration_bucket(data: dict) -> FIDurationBucketV2:
    data = _safe_dict(data)
    ms = _safe_dict(data.get("ms"))
    ms_fi = _safe_dict(ms.get("fixed_income"))
    ctx = _extract_text_context(data)
    text = ctx["combined_up"]
    legacy = ctx["legacy_category_up"]

    if _contains_any(
        text + " | " + legacy,
        [
            "ULTRA SHORT",
            "SHORT",
            "SHORT TERM",
            "SHORT-TERM",
            "LOW DURATION",
            "SHORT DURATION",
            "SHORT DURATION CREDIT",
            "CORTO PLAZO",
            "0-2",
            "0-5",
            "PAGARES",
            "PAGARÉS",
            "CASH",
            "LIQUIDITY",
            "AHORRO",
            "MONETARY",
            "MONEY MARKET",
            "HORIZONTE 2025",
            "HORIZONTE 2026",
            "HORIZONTE 2027",
            "RF DIVERSIFICADA CORTO PLAZO EUR",
        ],
    ):
        return FIDurationBucketV2.SHORT

    if _contains_any(
        text + " | " + legacy,
        [
            "HORIZONTE 2028",
            "HORIZONTE 2029",
            "TARGET 2028",
            "TARGET 2029",
            "EUROLAND BOND",
            "GLOBAL BOND",
            "FIXED TERM BOND",
            "FECHA OBJETIVO",
        ],
    ):
        return FIDurationBucketV2.MEDIUM

    if _contains_any(
        text + " | " + legacy,
        ["LONG DURATION", "LONG TERM", "LARGO PLAZO", "RF LARGO PLAZO EUR"],
    ):
        return FIDurationBucketV2.LONG

    if _contains_any(
        text + " | " + legacy,
        [
            "FLEXIBLE",
            "STRATEGIC",
            "OPPORTUNITIES",
            "TOTAL RETURN",
            "ABSOLUTE RETURN",
            "UNCONSTRAINED",
            "RF FLEXIBLE EUR",
            "GLOBAL FLEXIBLE BOND",
        ],
    ):
        return FIDurationBucketV2.FLEXIBLE

    duration = _safe_float(
        ms_fi.get("effective_duration")
        or ms_fi.get("duration")
        or ms_fi.get("modified_duration")
        or 0
    )

    if duration > 0:
        if duration <= 3.5:
            return FIDurationBucketV2.SHORT
        if duration <= 7.0:
            return FIDurationBucketV2.MEDIUM
        return FIDurationBucketV2.LONG

    if _year_hint_in_text(text):
        if _contains_any(text, ["2025", "2026", "2027"]):
            return FIDurationBucketV2.SHORT
        return FIDurationBucketV2.MEDIUM

    return FIDurationBucketV2.UNKNOWN


def _apply_fi_legacy_fallbacks(data: dict, klass: ClassificationV2):
    ctx = _extract_text_context(data)
    legacy = ctx["legacy_category_up"]
    text = ctx["combined_up"]

    if klass.asset_type != AssetClassV2.FIXED_INCOME:
        return

    if klass.asset_subtype == AssetSubtypeV2.UNKNOWN:
        if _contains_any(
            legacy + " | " + text,
            [
                "RF DEUDA CORPORATIVA EUR",
                "RF DIVERSIFICADA EUR",
                "RF DIVERSIFICADA CORTO PLAZO EUR",
                "RF GLOBAL - EUR CUBIERTO",
                "GLOBAL CORPORATE BOND",
                "FIXED TERM BOND",
                "GLOBAL BOND",
                "RF FLEXIBLE EUR",
                "RF FLEXIBLE USD",
            ],
        ):
            klass.asset_subtype = AssetSubtypeV2.CORPORATE_BOND

        elif _contains_any(
            legacy + " | " + text, ["RF DEUDA PÚBLICA EUR", "RF DEUDA PUBLICA EUR"]
        ):
            klass.asset_subtype = AssetSubtypeV2.GOVERNMENT_BOND

        elif _contains_any(legacy + " | " + text, ["RF CONVERTIBLES", "CONVERTIBLE"]):
            klass.asset_subtype = AssetSubtypeV2.CONVERTIBLE_BOND

        elif _contains_any(
            legacy + " | " + text,
            [
                "RF GLOBAL EMERGENTE",
                "RF DEUDA CORPORATIVA GLOBAL EMERGENTE",
                "EMERGING",
                "EM DEBT",
            ],
        ):
            klass.asset_subtype = AssetSubtypeV2.EMERGING_MARKETS_BOND

    if klass.fi_credit_bucket == FICreditBucketV2.UNKNOWN:
        if _contains_any(
            legacy + " | " + text,
            [
                "RF DEUDA CORPORATIVA EUR",
                "RF DIVERSIFICADA EUR",
                "RF DIVERSIFICADA CORTO PLAZO EUR",
                "GLOBAL CORPORATE BOND",
                "GLOBAL BOND",
                "INVESTMENT GRADE",
                "FIXED TERM BOND",
            ],
        ):
            klass.fi_credit_bucket = FICreditBucketV2.MEDIUM_QUALITY
        elif _contains_any(
            legacy + " | " + text,
            [
                "RF DEUDA PÚBLICA EUR",
                "RF DEUDA PUBLICA EUR",
                "GOVERNMENT",
                "TREASURY",
                "EUROLAND BOND",
            ],
        ):
            klass.fi_credit_bucket = FICreditBucketV2.HIGH_QUALITY

    if klass.fi_duration_bucket == FIDurationBucketV2.UNKNOWN:
        if _contains_any(
            legacy + " | " + text,
            [
                "RF DIVERSIFICADA CORTO PLAZO EUR",
                "SHORT DURATION",
                "LOW DURATION",
                "0-2",
                "0-5",
                "CORTO PLAZO",
                "AHORRO",
            ],
        ):
            klass.fi_duration_bucket = FIDurationBucketV2.SHORT
        elif _contains_any(
            legacy + " | " + text,
            [
                "FIXED TERM BOND",
                "FECHA OBJETIVO",
                "HORIZONTE",
                "TARGET",
                "GLOBAL BOND",
                "EUROLAND BOND",
            ],
        ):
            klass.fi_duration_bucket = FIDurationBucketV2.MEDIUM
        elif _contains_any(
            legacy + " | " + text,
            ["RF FLEXIBLE EUR", "RF FLEXIBLE USD", "FLEXIBLE", "OPPORTUNITIES"],
        ):
            klass.fi_duration_bucket = FIDurationBucketV2.FLEXIBLE


# =============================================================================
# RISK / SUITABILITY
# =============================================================================


def _deduce_risk_bucket(
    asset_type: AssetClassV2,
    subtype: AssetSubtypeV2,
    fi_credit: FICreditBucketV2,
) -> RiskBucketV2:
    if asset_type == AssetClassV2.MONETARY:
        return RiskBucketV2.LOW

    if asset_type == AssetClassV2.FIXED_INCOME:
        if subtype in [
            AssetSubtypeV2.HIGH_YIELD_BOND,
            AssetSubtypeV2.EMERGING_MARKETS_BOND,
            AssetSubtypeV2.CONVERTIBLE_BOND,
        ]:
            return RiskBucketV2.MEDIUM
        if fi_credit == FICreditBucketV2.LOW_QUALITY:
            return RiskBucketV2.MEDIUM
        return RiskBucketV2.LOW

    if asset_type == AssetClassV2.EQUITY:
        return RiskBucketV2.HIGH

    if asset_type == AssetClassV2.MIXED:
        if subtype == AssetSubtypeV2.CONSERVATIVE_ALLOCATION:
            return RiskBucketV2.LOW
        if subtype == AssetSubtypeV2.MODERATE_ALLOCATION:
            return RiskBucketV2.MEDIUM
        return RiskBucketV2.HIGH

    if asset_type in [
        AssetClassV2.ALTERNATIVE,
        AssetClassV2.COMMODITIES,
        AssetClassV2.REAL_ESTATE,
    ]:
        return RiskBucketV2.HIGH

    return RiskBucketV2.MEDIUM


def _evaluate_suitability(klass: ClassificationV2, ctx: dict) -> bool:
    ctx = _safe_dict(ctx)
    text = _safe_upper(ctx.get("combined_up"))
    legacy = _safe_upper(ctx.get("legacy_category_up"))

    if klass.asset_type in [
        AssetClassV2.EQUITY,
        AssetClassV2.REAL_ESTATE,
        AssetClassV2.COMMODITIES,
        AssetClassV2.ALTERNATIVE,
    ]:
        return False

    if klass.asset_type == AssetClassV2.MONETARY:
        return True

    if klass.asset_type == AssetClassV2.MIXED:
        return klass.asset_subtype == AssetSubtypeV2.CONSERVATIVE_ALLOCATION

    if klass.asset_type != AssetClassV2.FIXED_INCOME:
        return False

    if klass.asset_subtype in [
        AssetSubtypeV2.HIGH_YIELD_BOND,
        AssetSubtypeV2.EMERGING_MARKETS_BOND,
        AssetSubtypeV2.CONVERTIBLE_BOND,
    ]:
        return False

    if klass.fi_credit_bucket == FICreditBucketV2.LOW_QUALITY:
        return False

    if _contains_any(
        text,
        [
            "SUBORDINATED",
            "SUBORDINADO",
            "HIGH YIELD",
            "ALTO RENDIMIENTO",
            "EMERGING",
            "EMERGENTE",
            "LOCAL CURRENCY",
            "HARD CURRENCY",
            "CONVERTIBLE",
            "COCO",
        ],
    ):
        return False

    if klass.fi_credit_bucket in [
        FICreditBucketV2.HIGH_QUALITY,
        FICreditBucketV2.MEDIUM_QUALITY,
    ]:
        return True

    if klass.fi_duration_bucket in [
        FIDurationBucketV2.SHORT,
        FIDurationBucketV2.MEDIUM,
    ]:
        return True

    if _contains_any(
        legacy,
        [
            "RF DEUDA CORPORATIVA EUR",
            "RF DIVERSIFICADA EUR",
            "RF DIVERSIFICADA CORTO PLAZO EUR",
            "RF DEUDA PÚBLICA EUR",
            "RF DEUDA PUBLICA EUR",
            "FIXED TERM BOND",
            "RF GLOBAL - EUR CUBIERTO",
            "GLOBAL CORPORATE BOND",
            "RF LARGO PLAZO EUR",
        ],
    ):
        return True

    if (
        klass.fi_credit_bucket == FICreditBucketV2.UNKNOWN
        and klass.fi_duration_bucket == FIDurationBucketV2.UNKNOWN
    ):
        return False

    if klass.asset_subtype in [
        AssetSubtypeV2.GOVERNMENT_BOND,
        AssetSubtypeV2.INFLATION_LINKED_BOND,
    ]:
        return True

    return False


# =============================================================================
# MAIN CLASSIFICATION
# =============================================================================


def classifyFundV2(isin: str, data: dict) -> ClassificationV2:
    data = _safe_dict(data)
    ms = _safe_dict(data.get("ms"))
    metrics = _safe_dict(data.get("metrics"))
    ctx = _extract_text_context(data)
    text = ctx["combined_up"]

    eq_met = _safe_float(metrics.get("equity", 0))
    bd_met = _safe_float(metrics.get("bond", 0))

    klass = ClassificationV2(
        raw_name=ctx["name"],
        computed_at=datetime.now(timezone.utc).isoformat(),
    )

    at, at_conf = _deduce_asset_class(data, eq_met, bd_met)
    klass.asset_type = at
    klass.classification_confidence = (
        max(0.60, at_conf) if at != AssetClassV2.UNKNOWN else 0.45
    )

    if ctx["ms_cat"]:
        _append_unique(klass.source_priority_used, "ms.category_morningstar")
    elif ctx["name"]:
        _append_unique(klass.source_priority_used, "name")

    if ctx["legacy_category"]:
        _append_unique(klass.source_priority_used, "legacy_category")
    if metrics:
        _append_unique(klass.source_priority_used, "metrics")
    if not klass.source_priority_used:
        _append_unique(klass.source_priority_used, "derived_fallback")

    reg_val, reg_conf = _deduce_region_primary(data, klass.asset_type)
    klass.region_primary = reg_val
    if reg_val != RegionV2.UNKNOWN:
        if reg_conf >= 0.90:
            klass.classification_confidence = min(
                0.98, klass.classification_confidence + 0.03
            )
        elif reg_conf >= 0.75:
            klass.classification_confidence = min(
                0.96, klass.classification_confidence + 0.01
            )
        elif reg_conf < 0.65:
            klass.classification_confidence *= 0.96
            _append_unique(klass.warnings, "REGION_PRIMARY_BORDERLINE")

    if klass.asset_type == AssetClassV2.EQUITY:
        if _contains_any(
            text,
            [
                "TECHNOLOGY",
                "BIG DATA",
                "FINTECH",
                "ROBOTICS",
                "DIGITAL",
                "CONNECTIVITY",
                "ARTIFICIAL",
            ],
        ):
            klass.asset_subtype = AssetSubtypeV2.SECTOR_EQUITY_TECH
            klass.is_sector_fund = True
            klass.sector_focus = SectorFocusV2.TECHNOLOGY

        elif _contains_any(
            text, ["HEALTHCARE", "HEALTH", "BIOTECH", "MEDTECH", "LIFE SCIENCES"]
        ):
            klass.asset_subtype = AssetSubtypeV2.SECTOR_EQUITY_HEALTHCARE
            klass.is_sector_fund = True
            klass.sector_focus = SectorFocusV2.HEALTHCARE

        elif _contains_any(
            text,
            [
                "WATER",
                "CLEAN ENERGY",
                "ENERGY TRANSITION",
                "ECOLOGY",
                "CLIMATE",
                "ENVIRONMENT",
                "SUSTAINABLE ENERGY",
            ],
        ):
            klass.asset_subtype = AssetSubtypeV2.THEMATIC_EQUITY
            klass.is_thematic = True

        else:
            equity_guard_terms = [
                "EQUITY PORTFOLIO",
                "EQUITY INCOME",
                "SUSTAINABLE EQUITY",
                "CORE EQUITY",
                "GLOBAL EQUITY",
                "EUROPE EQUITY",
                "EUROZONE EQUITY",
                "INDIA EQUITY",
                "EMERGING MARKETS EQUITY",
                "ASIA EQUITY",
                "SECTOR EQUITY",
                "EQUITY FUND",
                "DIVIDEND",
                "GROWTH & INCOME",
                "VALUE FUND",
            ]

            hard_commodity_terms = [
                "WORLD MINING",
                "GLOBAL GOLD",
                "GOLD & PRECIOUS METALS",
                "GOLD AND PRECIOUS METALS",
                "METALS AND MINING",
                "NATURAL RESOURCES FUND",
                "GOLD FUND",
                "PRECIOUS METALS FUND",
                "GOLD & SILVER",
                "WORLD GOLD",
                "MINING FUND",
            ]

            soft_commodity_terms = [
                "NATURAL RESOURCES",
                "MINING",
                "GOLD",
                "PRECIOUS METALS",
                "METALS",
                "SILVER",
            ]

            should_force_commodities = False

            if _contains_any(text, hard_commodity_terms):
                should_force_commodities = True
            elif _contains_any(text, soft_commodity_terms) and not _contains_any(
                text, equity_guard_terms
            ):
                should_force_commodities = True

            if should_force_commodities:
                klass.asset_type = AssetClassV2.COMMODITIES
                klass.asset_subtype = AssetSubtypeV2.UNKNOWN
                _append_unique(klass.warnings, "COMMODITIES_RECLASSIFIED_FROM_EQUITY")
            else:
                if klass.region_primary == RegionV2.US:
                    klass.asset_subtype = AssetSubtypeV2.US_EQUITY
                elif klass.region_primary == RegionV2.EUROPE:
                    klass.asset_subtype = AssetSubtypeV2.EUROPE_EQUITY
                elif klass.region_primary == RegionV2.EUROZONE:
                    klass.asset_subtype = AssetSubtypeV2.EUROZONE_EQUITY
                elif klass.region_primary == RegionV2.JAPAN:
                    klass.asset_subtype = AssetSubtypeV2.JAPAN_EQUITY
                elif klass.region_primary == RegionV2.ASIA_DEV:
                    klass.asset_subtype = AssetSubtypeV2.ASIA_PACIFIC_EQUITY
                elif klass.region_primary == RegionV2.EMERGING:
                    klass.asset_subtype = AssetSubtypeV2.EMERGING_MARKETS_EQUITY
                elif klass.region_primary == RegionV2.GLOBAL:
                    if _contains_any(
                        text, ["SMALL CAP", "MID CAP", "SMID", "SMALLER COMPANIES"]
                    ):
                        klass.asset_subtype = AssetSubtypeV2.GLOBAL_SMALL_CAP_EQUITY
                    elif _contains_any(text, ["DIVIDEND", "INCOME"]):
                        klass.asset_subtype = AssetSubtypeV2.GLOBAL_INCOME_EQUITY
                    else:
                        klass.asset_subtype = AssetSubtypeV2.GLOBAL_EQUITY
                else:
                    klass.asset_subtype = AssetSubtypeV2.UNKNOWN

        if klass.asset_type == AssetClassV2.EQUITY:
            style_box, style_heur = _deduce_equity_style(ms.get("equity_style"), data)
            klass.equity_style_box = style_box
            mcap_bias, mcap_heur = _deduce_market_cap_bias(ms.get("equity_style"), data)
            klass.market_cap_bias = mcap_bias
            if style_heur or mcap_heur:
                _append_unique(klass.warnings, "HEURISTIC_STYLE_DEDUCTION")
                klass.classification_confidence *= 0.96

    elif klass.asset_type == AssetClassV2.FIXED_INCOME:
        klass.asset_subtype = _deduce_fixed_income_subtype(data)
        klass.fi_credit_bucket = _deduce_fixed_income_credit(data, klass.asset_subtype)
        klass.fi_duration_bucket = _deduce_fi_duration_bucket(data)

        _apply_fi_legacy_fallbacks(data, klass)

        if klass.asset_subtype == AssetSubtypeV2.CONVERTIBLE_BOND:
            klass.convertibles_profile = ConvertiblesProfileV2.UNKNOWN

        if klass.asset_subtype == AssetSubtypeV2.UNKNOWN:
            klass.classification_confidence *= 0.92
            _append_unique(klass.warnings, "FI_UNKNOWN_SUBTYPE")

        if klass.fi_credit_bucket == FICreditBucketV2.UNKNOWN:
            klass.classification_confidence *= 0.96
            _append_unique(klass.warnings, "FI_UNKNOWN_CREDIT_BUCKET")

        if klass.fi_duration_bucket == FIDurationBucketV2.UNKNOWN:
            klass.classification_confidence *= 0.96
            _append_unique(klass.warnings, "FI_UNKNOWN_DURATION_BUCKET")

        if klass.asset_subtype != AssetSubtypeV2.UNKNOWN:
            klass.classification_confidence = min(
                0.97, klass.classification_confidence + 0.03
            )

        if klass.fi_credit_bucket in [
            FICreditBucketV2.HIGH_QUALITY,
            FICreditBucketV2.MEDIUM_QUALITY,
        ]:
            klass.classification_confidence = min(
                0.97, klass.classification_confidence + 0.02
            )

        if klass.fi_duration_bucket in [
            FIDurationBucketV2.SHORT,
            FIDurationBucketV2.MEDIUM,
            FIDurationBucketV2.FLEXIBLE,
        ]:
            klass.classification_confidence = min(
                0.97, klass.classification_confidence + 0.02
            )

    elif klass.asset_type == AssetClassV2.MIXED:
        if _contains_any(
            text, ["CAUTIOUS", "CONSERVATIVE", "DEFENSIVO", "PRUDENTE"]
        ) or (metrics and eq_met < 35):
            klass.asset_subtype = AssetSubtypeV2.CONSERVATIVE_ALLOCATION
        elif _contains_any(text, ["MODERATE", "MODERADO", "EQUILIBRADO"]) or (
            metrics and 35 <= eq_met <= 65
        ):
            klass.asset_subtype = AssetSubtypeV2.MODERATE_ALLOCATION
        elif _contains_any(
            text, ["AGGRESSIVE", "AGRESIVO", "DECIDIDO", "CRECIMIENTO"]
        ) or (metrics and eq_met > 65):
            klass.asset_subtype = AssetSubtypeV2.AGGRESSIVE_ALLOCATION
        else:
            klass.asset_subtype = AssetSubtypeV2.FLEXIBLE_ALLOCATION

    elif klass.asset_type == AssetClassV2.ALTERNATIVE:
        if _contains_any(text, ["LONG/SHORT", "LONG-SHORT", "LONG SHORT"]):
            klass.alternative_bucket = AlternativeBucketV2.LONG_SHORT_EQUITY
        elif "MARKET NEUTRAL" in text:
            klass.alternative_bucket = AlternativeBucketV2.MARKET_NEUTRAL
        elif _contains_any(text, ["FUTURES", "SYSTEMATIC", "DIVERSIFIED FUTURES"]):
            klass.alternative_bucket = AlternativeBucketV2.MANAGED_FUTURES
        elif _contains_any(text, ["MULTI-STRATEGY", "MULTISTRATEGY"]):
            klass.alternative_bucket = AlternativeBucketV2.MULTI_STRATEGY
        elif "MACRO" in text:
            klass.alternative_bucket = AlternativeBucketV2.GLOBAL_MACRO
        else:
            klass.alternative_bucket = AlternativeBucketV2.UNKNOWN
            klass.classification_confidence *= 0.95

    if (
        _contains_any(
            text,
            ["INDEX", "IDX", "ISHARES", "VANGUARD", "MSCI", "ACTIAM", "AMUNDI INDEX"],
        )
        and "ENHANCED" not in text
    ):
        klass.is_index_like = True

    klass.strategy_type = (
        StrategyTypeV2.PASSIVE if klass.is_index_like else StrategyTypeV2.ACTIVE
    )
    klass.risk_bucket = _deduce_risk_bucket(
        klass.asset_type, klass.asset_subtype, klass.fi_credit_bucket
    )
    klass.is_suitable_low_risk = _evaluate_suitability(klass, ctx)

    if (
        klass.asset_type == AssetClassV2.FIXED_INCOME
        and klass.asset_subtype != AssetSubtypeV2.UNKNOWN
    ):
        klass.classification_confidence = max(klass.classification_confidence, 0.66)

    if klass.asset_type == AssetClassV2.FIXED_INCOME and (
        klass.fi_credit_bucket != FICreditBucketV2.UNKNOWN
        or klass.fi_duration_bucket != FIDurationBucketV2.UNKNOWN
    ):
        klass.classification_confidence = max(klass.classification_confidence, 0.68)

    klass.classification_confidence = _clamp01(klass.classification_confidence)

    return klass


# =============================================================================
# EXPOSURE
# =============================================================================


def buildPortfolioExposureV2(
    isin: str, data: dict, klass: ClassificationV2
) -> PortfolioExposureV2:
    data = _safe_dict(data)
    metrics = _safe_dict(data.get("metrics"))
    ms = _safe_dict(data.get("ms"))
    ms_regions = _safe_dict(ms.get("regions"))
    ms_sectors = _safe_dict(ms.get("sectors"))
    ms_style = _safe_dict(ms.get("equity_style"))

    exp = PortfolioExposureV2(computed_at=datetime.now(timezone.utc).isoformat())

    eq = _safe_float(metrics.get("equity", 0.0))
    bd = _safe_float(metrics.get("bond", 0.0))
    ca = _safe_float(metrics.get("cash", 0.0))
    oth = _safe_float(metrics.get("other", 0.0))
    total = eq + bd + ca + oth

    if total < 1.0:
        if klass.asset_type == AssetClassV2.EQUITY:
            eq = 100.0
        elif klass.asset_type == AssetClassV2.FIXED_INCOME:
            bd = 100.0
        elif klass.asset_type == AssetClassV2.MONETARY:
            ca = 100.0
        elif klass.asset_type == AssetClassV2.MIXED:
            if klass.asset_subtype == AssetSubtypeV2.CONSERVATIVE_ALLOCATION:
                eq, bd = 20.0, 80.0
            elif klass.asset_subtype == AssetSubtypeV2.AGGRESSIVE_ALLOCATION:
                eq, bd = 80.0, 20.0
            else:
                eq, bd = 50.0, 50.0
        elif klass.asset_type in [
            AssetClassV2.REAL_ESTATE,
            AssetClassV2.COMMODITIES,
            AssetClassV2.ALTERNATIVE,
        ]:
            oth = 100.0

    elif total <= 1.05:
        eq *= 100.0
        bd *= 100.0
        ca *= 100.0
        oth *= 100.0

    exp.economic_exposure = EconomicExposureV2(
        equity=round(eq, 1),
        bond=round(bd, 1),
        cash=round(ca, 1),
        other=round(oth, 1),
    )

    macro = _safe_dict(ms_regions.get("macro"))
    detail = _safe_dict(ms_regions.get("detail"))

    if macro or detail:
        europe_macro = _safe_float(macro.get("europe_me_africa", 0))
        eurozone = _safe_float(detail.get("eurozone", 0))
        uk = _safe_float(detail.get("united_kingdom", 0))
        switzerland = _safe_float(detail.get("switzerland", 0))

        exp.equity_regions = {
            "us": round(
                _safe_float(detail.get("united_states", 0))
                + _safe_float(detail.get("canada", 0)),
                2,
            ),
            "europe": round(max(europe_macro, eurozone + uk + switzerland), 2),
            "emerging": round(
                _safe_float(detail.get("latin_america", 0))
                + _safe_float(detail.get("asia_emerging", 0))
                + _safe_float(detail.get("africa_middle_east", 0))
                + _safe_float(detail.get("emerging", 0)),
                2,
            ),
            "japan": round(_safe_float(detail.get("japan", 0)), 2),
            "asia_dev": round(
                max(
                    0.0,
                    _safe_float(macro.get("asia", 0))
                    - _safe_float(detail.get("japan", 0))
                    - _safe_float(detail.get("asia_emerging", 0)),
                ),
                2,
            ),
        }
    elif ms_regions:
        exp.equity_regions = {
            "us": round(_safe_float(ms_regions.get("americas", 0)), 2),
            "europe": round(
                _safe_float(ms_regions.get("europe", 0))
                + _safe_float(ms_regions.get("uk", 0)),
                2,
            ),
            "emerging": round(
                _safe_float(ms_regions.get("asia_emerging", 0))
                + _safe_float(ms_regions.get("latin_america", 0))
                + _safe_float(ms_regions.get("emerging", 0)),
                2,
            ),
            "japan": round(_safe_float(ms_regions.get("japan", 0)), 2),
            "asia_dev": round(
                _safe_float(ms_regions.get("asia_developed", 0))
                + _safe_float(ms_regions.get("australasia", 0)),
                2,
            ),
        }

    if ms_sectors:
        exp.sectors = {
            "technology": round(_safe_float(ms_sectors.get("technology", 0)), 2),
            "healthcare": round(_safe_float(ms_sectors.get("healthcare", 0)), 2),
            "financials": round(
                _safe_float(ms_sectors.get("financial_services", 0)), 2
            ),
        }

    style_data = _safe_dict(ms_style.get("style"))
    cap_data = _safe_dict(ms_style.get("market_cap"))
    if style_data and cap_data:
        lg = _safe_float(cap_data.get("giant", 0)) + _safe_float(
            cap_data.get("large", 0)
        )
        md = _safe_float(cap_data.get("mid", 0))
        sm = _safe_float(cap_data.get("small", 0)) + _safe_float(
            cap_data.get("micro", 0)
        )

        v = _safe_float(style_data.get("value", 0)) / 100.0
        b = _safe_float(style_data.get("blend", 0)) / 100.0
        g = _safe_float(style_data.get("growth", 0)) / 100.0

        exp.equity_styles = {
            "large_growth": round(lg * g, 2),
            "large_value": round(lg * v, 2),
            "large_core": round(lg * b, 2),
            "mid_growth": round(md * g, 2),
            "mid_value": round(md * v, 2),
            "mid_core": round(md * b, 2),
            "small_growth": round(sm * g, 2),
            "small_value": round(sm * v, 2),
            "small_core": round(sm * b, 2),
        }

    if klass.asset_subtype == AssetSubtypeV2.CONVERTIBLE_BOND:
        if exp.economic_exposure.equity > 50:
            klass.convertibles_profile = ConvertiblesProfileV2.EQUITY_LIKE
        elif exp.economic_exposure.equity > 20:
            klass.convertibles_profile = ConvertiblesProfileV2.BALANCED
        else:
            klass.convertibles_profile = ConvertiblesProfileV2.BOND_LIKE

    if (
        klass.asset_subtype == AssetSubtypeV2.CONSERVATIVE_ALLOCATION
        and exp.economic_exposure.equity > 40
    ):
        _append_unique(
            klass.warnings,
            "Conflict: Categorized as Conservative Allocation but real equity exposure > 40%. Profiling constrained.",
        )
        klass.is_suitable_low_risk = False
        _append_unique(exp.warnings, "High equity exposure for conservative label.")
        _append_unique(exp.risk_flags, "HIDDEN_EQUITY_RISK")

    if (
        exp.economic_exposure.equity > 0
        and _safe_dict(exp.equity_regions).get("emerging", 0) > 20
    ):
        _append_unique(exp.risk_flags, "HIGH_EMERGING_RISK")

    exp.exposure_confidence = _clamp01(0.90 if total > 0 else 0.45)
    return exp


# =============================================================================
# BATCH
# =============================================================================


def run_batch(mode: str = "dry-run", limit: int = 0):
    init_firebase()
    print(f"\n{'=' * 60}")
    print(f"  TAXONOMY V2 BATCH — {mode.upper()}")
    print(f"  Started: {datetime.now(timezone.utc).isoformat()}")
    print(f"{'=' * 60}\n")

    query = db.collection("funds_v3")
    if limit > 0:
        query = query.limit(limit)

    funds_stream = query.stream()

    stats = {
        "processed": 0,
        "updated": 0,
        "errors": 0,
        "error_isins": [],
        "asset_type_dist": {},
    }

    batch_writer = None
    batch_count = 0
    if mode == "execute":
        batch_writer = db.batch()

    for doc in funds_stream:
        isin = doc.id
        try:
            data = _safe_dict(doc.to_dict())
            klass = classifyFundV2(isin, data)
            exp = buildPortfolioExposureV2(isin, data, klass)

            at = klass.asset_type.value
            stats["asset_type_dist"][at] = stats["asset_type_dist"].get(at, 0) + 1
            stats["processed"] += 1

            if mode == "execute":
                batch_writer.update(
                    doc.reference,
                    {
                        "classification_v2": klass.model_dump(),
                        "portfolio_exposure_v2": exp.model_dump(),
                    },
                )
                batch_count += 1
                stats["updated"] += 1

                if batch_count >= 400:
                    batch_writer.commit()
                    batch_writer = db.batch()
                    batch_count = 0

        except Exception as e:
            stats["errors"] += 1
            stats["error_isins"].append({"isin": isin, "error": str(e)})

    if mode == "execute" and batch_count > 0:
        batch_writer.commit()

    print(
        f"  Processed: {stats['processed']} | Updated: {stats['updated']} | Errors: {stats['errors']}"
    )
    return stats


# =============================================================================
# TEST
# =============================================================================


def test_math_logic():
    print("Running mock tests...")
    samples = [
        {
            "label": "Euro Sustainable Credit",
            "data": {
                "name": "EdR SICAV - Euro Sustainable Credit A EUR",
                "legacy_category": "RF Deuda Corporativa EUR",
                "metrics": {"bond": 100},
            },
        },
        {
            "label": "Emerging debt",
            "data": {
                "name": "Jupiter Emerging Market Debt Income",
                "legacy_category": "RF Deuda Corporativa Global Emergente",
                "metrics": {"bond": 100},
            },
        },
        {
            "label": "Convertible bond",
            "data": {
                "name": "UBS Convert Global EUR",
                "legacy_category": "RF Convertibles Global",
                "metrics": {"bond": 100},
            },
        },
        {
            "label": "Inflation linked",
            "data": {
                "name": "Amundi Index Govt Bond Euro Inflation",
                "legacy_category": "RF",
                "metrics": {"bond": 100},
            },
        },
        {
            "label": "Short duration credit",
            "data": {
                "name": "Pimco Short Duration Credit",
                "legacy_category": "RF Deuda Corporativa EUR",
                "metrics": {"bond": 100},
            },
        },
        {
            "label": "Fixed maturity 2028",
            "data": {
                "name": "Cartera Renta Fija Horizonte 2028 FI",
                "legacy_category": "Fixed Term Bond",
                "metrics": {"bond": 100},
            },
        },
        {
            "label": "Healthcare equity",
            "data": {
                "name": "Polar Capital Healthcare Opps",
                "legacy_category": "RV Sector Healthcare",
            },
        },
        {
            "label": "Gold / precious metals",
            "data": {
                "name": "Franklin Gold & Precious Metals Fund",
                "legacy_category": "RV Sector Oro y Metales Preciosos",
                "metrics": {"equity": 0, "other": 100},
            },
        },
        {
            "label": "Long-short equity",
            "data": {
                "name": "Carmignac Long-Short European Equities",
                "legacy_category": "Alt Long/Short Equity",
                "metrics": {"equity": 40},
            },
        },
        {
            "label": "Flexible fixed income",
            "data": {
                "name": "SIH FCP - Flexible Fixed Income USD",
                "legacy_category": "RF Flexible USD",
                "metrics": {"bond": 100},
            },
        },
        {
            "label": "Global subordinated bond",
            "data": {
                "name": "Amundi Funds - Global Subordinated Bond A EUR (C)",
                "legacy_category": "RF High Yield / Subordinated",
                "metrics": {"bond": 100},
            },
        },
        {
            "label": "Global EUR hedged should stay global",
            "data": {
                "name": "PIMCO GIS Global Bond Fund E Class EUR (Hedged) Accumulation",
                "legacy_category": "RF Global - EUR Cubierto",
                "metrics": {"bond": 100},
            },
        },
    ]

    for s in samples:
        klass = classifyFundV2("MOCK", s["data"])
        print(
            f"[{s['label']}] -> "
            f"type: {klass.asset_type.value}, "
            f"subtype: {klass.asset_subtype.value}, "
            f"region: {klass.region_primary.value}, "
            f"credit: {klass.fi_credit_bucket.value}, "
            f"duration: {klass.fi_duration_bucket.value}, "
            f"suitable: {klass.is_suitable_low_risk}, "
            f"conf: {klass.classification_confidence}"
        )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--test-math", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    if args.test_math:
        test_math_logic()
    elif args.execute:
        run_batch(mode="execute", limit=args.limit)
    else:
        run_batch(mode="dry-run", limit=args.limit if args.limit > 0 else 30)

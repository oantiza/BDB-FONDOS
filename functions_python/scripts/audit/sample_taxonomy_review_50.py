"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: audit
PURPOSE: Genera una muestra de 50 fondos para revisión manual de taxonomía.
SAFE_MODE: READ_ONLY
RUN: python -m scripts.audit.sample_taxonomy_review_50
"""

"""
populate_taxonomy_v2.py â V2 Classification & Exposure Batch Runner

Usage:
  python functions_python/scripts/migration/populate_taxonomy_v2.py --test-math
  python functions_python/scripts/migration/populate_taxonomy_v2.py --dry-run --limit 30
  python functions_python/scripts/migration/populate_taxonomy_v2.py --execute
"""

import os
import sys
import json
from datetime import datetime, timezone
from typing import Any, Dict, Tuple

sys.path.append(
    os.path.dirname(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    )
)

from models.canonical_types import (  # noqa: E402
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
    FITypeV2,
    ConvertiblesProfileV2,
    ClassificationV2,
    PortfolioExposureV2,
    EconomicExposureV2,
)

db = None


# =============================================================================
# Helpers
# =============================================================================


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any):
    return value if isinstance(value, list) else []


def _safe_upper(value: Any) -> str:
    if value is None:
        return ""
    return str(value).upper().strip()


def _safe_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _normalize_pct_block(
    eq: float, bd: float, ca: float, oth: float
) -> Tuple[float, float, float, float]:
    total = eq + bd + ca + oth
    if total <= 0:
        return 0.0, 0.0, 0.0, 0.0

    # If already in 0-1 scale
    if total <= 1.05:
        eq *= 100.0
        bd *= 100.0
        ca *= 100.0
        oth *= 100.0
        total = eq + bd + ca + oth

    if total <= 0:
        return 0.0, 0.0, 0.0, 0.0

    factor = 100.0 / total
    return (
        round(eq * factor, 1),
        round(bd * factor, 1),
        round(ca * factor, 1),
        round(oth * factor, 1),
    )


def _model_dump(obj):
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    return obj.dict()


def _append_warning(klass: ClassificationV2, warning: str):
    if warning not in klass.warnings:
        klass.warnings.append(warning)


def _append_source(klass: ClassificationV2, source: str):
    if source not in klass.source_priority_used:
        klass.source_priority_used.append(source)


def _apply_confidence_multiplier(klass: ClassificationV2, multiplier: float):
    current = _safe_float(getattr(klass, "classification_confidence", 0.0), 0.0)
    klass.classification_confidence = _clamp(current * multiplier, 0.0, 1.0)


# =============================================================================
# Firebase init
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
            kp = os.path.abspath(kp)
            if os.path.exists(kp):
                cred = credentials.Certificate(kp)
                firebase_admin.initialize_app(cred)
                print(f"[INIT] Firebase initialized with key: {kp}")
                break
        else:
            firebase_admin.initialize_app()
            print("[INIT] Firebase initialized with default credentials")

    db = firestore.client()


# =============================================================================
# Deduction logic
# =============================================================================


def _deduce_asset_class(
    ms_cat: str,
    eq_metric: float,
    bd_metric: float,
    name_upper: str,
    derived_class: str,
) -> AssetClassV2:
    ms_cat_up = _safe_upper(ms_cat)
    derived_up = _safe_upper(derived_class)
    combined = f"{ms_cat_up} {name_upper} {derived_up}"

    if any(
        x in combined
        for x in [
            "MONEY MARKET",
            "MONETARIO",
            "LIQUIDITY",
            "LIQUIDEZ",
            "TRESORERIE",
            "TESORERIA",
        ]
    ):
        return AssetClassV2.MONETARY

    if any(
        x in combined
        for x in [
            "ALTERNATIVE",
            "LONG/SHORT",
            "MARKET NEUTRAL",
            "ABSOLUTE RETURN",
            "MULTISTRATEGY",
            "MULTI-STRATEGY",
        ]
    ):
        return AssetClassV2.ALTERNATIVE

    if any(
        x in combined for x in ["PROPERTY", "REAL ESTATE", "IMMOBILIER", "INMOBILIARIO"]
    ):
        return AssetClassV2.REAL_ESTATE

    if any(
        x in combined
        for x in [
            "COMMODITIES",
            "PRECIOUS METALS",
            "GOLD",
            "SILVER",
            "MINING",
            "NATURAL RESOURCES",
        ]
    ):
        return (
            AssetClassV2.EQUITY
            if "EQUITY" in combined or "EQUITIES" in combined
            else AssetClassV2.COMMODITIES
        )

    if any(
        x in combined
        for x in ["ALLOCATION", "MIXTO", "MULTI ASSET", "DIVERSIFIED INCOME", "TARGET"]
    ):
        return AssetClassV2.MIXED

    if any(
        x in combined
        for x in [
            "FIXED INCOME",
            "BOND",
            "RENTA FIJA",
            "CREDIT",
            "DURATION",
            "DURACION",
            "CORPORATE",
            "GOVERNMENT",
            "SOVEREIGN",
            "TREASURY",
            "INFLATION LINKED",
            "PAGAR",
            "PAGARE",
        ]
    ):
        return AssetClassV2.FIXED_INCOME

    if any(
        x in combined
        for x in [
            "EQUITY",
            "EQUITIES",
            "RV",
            "RENTA VARIABLE",
            "SMALL CAP",
            "MID CAP",
            "LARGE CAP",
            "DIVIDEND",
            "VALUE",
            "GROWTH",
        ]
    ):
        return AssetClassV2.EQUITY

    # Pure exposure fallback
    if eq_metric >= 80:
        return AssetClassV2.EQUITY
    if bd_metric >= 80:
        return AssetClassV2.FIXED_INCOME
    if eq_metric >= 20 and bd_metric >= 20:
        return AssetClassV2.MIXED

    return AssetClassV2.UNKNOWN


def _deduce_equity_style(ms_style: dict, ms_cat: str) -> Tuple[EquityStyleBoxV2, bool]:
    ms_style = _safe_dict(ms_style)
    ms_cat_up = _safe_upper(ms_cat)

    # Support both flat 3x3 and nested Morningstar schemas
    direct_boxes = {
        "LARGE_GROWTH": _safe_float(ms_style.get("large_growth")),
        "LARGE_VALUE": _safe_float(ms_style.get("large_value")),
        "LARGE_CORE": _safe_float(ms_style.get("large_core"))
        + _safe_float(ms_style.get("large_blend")),
        "MID_GROWTH": _safe_float(ms_style.get("mid_growth")),
        "MID_VALUE": _safe_float(ms_style.get("mid_value")),
        "MID_CORE": _safe_float(ms_style.get("mid_core"))
        + _safe_float(ms_style.get("mid_blend")),
        "SMALL_GROWTH": _safe_float(ms_style.get("small_growth")),
        "SMALL_VALUE": _safe_float(ms_style.get("small_value")),
        "SMALL_CORE": _safe_float(ms_style.get("small_core"))
        + _safe_float(ms_style.get("small_blend")),
    }

    if max(direct_boxes.values() or [0]) > 0:
        max_key = max(direct_boxes, key=direct_boxes.get)
        try:
            return EquityStyleBoxV2(max_key), False
        except Exception:
            pass

    # Nested fallback
    style_data = _safe_dict(ms_style.get("style"))
    mcap_data = _safe_dict(ms_style.get("market_cap"))

    val = _safe_float(style_data.get("value"))
    blend = _safe_float(style_data.get("blend"))
    growth = _safe_float(style_data.get("growth"))

    giant = _safe_float(mcap_data.get("giant"))
    large = _safe_float(mcap_data.get("large"))
    mid = _safe_float(mcap_data.get("mid"))
    small = _safe_float(mcap_data.get("small"))
    micro = _safe_float(mcap_data.get("micro"))

    style_comp = None
    if (val + blend + growth) > 0:
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
    if (large_sum + mid + small_sum) > 0:
        mx = max(large_sum, mid, small_sum)
        if mx == large_sum:
            cap_comp = "LARGE"
        elif mx == mid:
            cap_comp = "MID"
        else:
            cap_comp = "SMALL"

    heuristic = False

    if not style_comp:
        if "GROWTH" in ms_cat_up:
            style_comp = "GROWTH"
            heuristic = True
        elif "VALUE" in ms_cat_up:
            style_comp = "VALUE"
            heuristic = True
        elif any(x in ms_cat_up for x in ["CORE", "BLEND"]):
            style_comp = "CORE"
            heuristic = True

    if not cap_comp:
        if "LARGE" in ms_cat_up:
            cap_comp = "LARGE"
            heuristic = True
        elif "MID" in ms_cat_up:
            cap_comp = "MID"
            heuristic = True
        elif "SMALL" in ms_cat_up:
            cap_comp = "SMALL"
            heuristic = True

    if style_comp and cap_comp:
        try:
            return EquityStyleBoxV2(f"{cap_comp}_{style_comp}"), heuristic
        except Exception:
            pass

    return EquityStyleBoxV2.UNKNOWN, False


def _deduce_market_cap_bias(
    ms_style: dict, ms_cat: str
) -> Tuple[MarketCapBiasV2, bool]:
    ms_style = _safe_dict(ms_style)
    ms_cat_up = _safe_upper(ms_cat)

    # Flat 3x3 first
    large = (
        _safe_float(ms_style.get("large_growth"))
        + _safe_float(ms_style.get("large_value"))
        + _safe_float(ms_style.get("large_core"))
        + _safe_float(ms_style.get("large_blend"))
    )
    mid = (
        _safe_float(ms_style.get("mid_growth"))
        + _safe_float(ms_style.get("mid_value"))
        + _safe_float(ms_style.get("mid_core"))
        + _safe_float(ms_style.get("mid_blend"))
    )
    small = (
        _safe_float(ms_style.get("small_growth"))
        + _safe_float(ms_style.get("small_value"))
        + _safe_float(ms_style.get("small_core"))
        + _safe_float(ms_style.get("small_blend"))
    )

    if (large + mid + small) <= 0:
        mcap_data = _safe_dict(ms_style.get("market_cap"))
        large = _safe_float(mcap_data.get("giant")) + _safe_float(
            mcap_data.get("large")
        )
        mid = _safe_float(mcap_data.get("mid"))
        small = _safe_float(mcap_data.get("small")) + _safe_float(
            mcap_data.get("micro")
        )

    if (large + mid + small) > 0:
        if large > mid and large > small:
            return MarketCapBiasV2.LARGE, False
        if mid > large and mid > small:
            return MarketCapBiasV2.MID, False
        if small > large and small > mid:
            return MarketCapBiasV2.SMALL, False
        return MarketCapBiasV2.MULTI, False

    if "LARGE" in ms_cat_up:
        return MarketCapBiasV2.LARGE, True
    if "MID" in ms_cat_up:
        return MarketCapBiasV2.MID, True
    if "SMALL" in ms_cat_up:
        return MarketCapBiasV2.SMALL, True

    return MarketCapBiasV2.UNKNOWN, False


def _deduce_region_primary(
    ms_cat_up: str, ms_regions: dict, name_up: str = ""
) -> Tuple[RegionV2, float]:
    text = f"{ms_cat_up} {name_up}"

    if any(x in text for x in ["EUROZONE", "EMU", "EUROLAND"]):
        return RegionV2.EUROZONE, 100.0
    if "EUROPE" in text:
        return RegionV2.EUROPE, 100.0
    if any(x in text for x in ["US ", "USA", "AMERICA", "AMERICAN", "NORTH AMERICA"]):
        return RegionV2.US, 100.0
    if "JAPAN" in text:
        return RegionV2.JAPAN, 100.0
    if any(
        x in text
        for x in [
            "EMERGING",
            "LATIN AMERICA",
            "INDIA",
            "CHINA",
            "BRAZIL",
            "ASIA EMERGING",
            "FRONTIER",
        ]
    ):
        return RegionV2.EMERGING, 100.0
    if (
        any(
            x in text
            for x in ["ASIA", "PACIFIC", "KOREA", "TAIWAN", "SINGAPORE", "HONG KONG"]
        )
        and "EMERGING" not in text
    ):
        return RegionV2.ASIA_DEV, 100.0
    if any(x in text for x in ["GLOBAL", "WORLD", "INTERNATIONAL"]):
        return RegionV2.GLOBAL, 100.0

    ms_regions = _safe_dict(ms_regions)
    macro = _safe_dict(ms_regions.get("macro"))
    detail = _safe_dict(ms_regions.get("detail"))

    # Support legacy flat schemas too
    if not macro and not detail:
        us = _safe_float(ms_regions.get("americas")) + _safe_float(
            ms_regions.get("united_states")
        )
        eu = _safe_float(ms_regions.get("europe")) + _safe_float(ms_regions.get("uk"))
        em = (
            _safe_float(ms_regions.get("emerging"))
            + _safe_float(ms_regions.get("asia_emerging"))
            + _safe_float(ms_regions.get("latin_america"))
        )
        jp = _safe_float(ms_regions.get("japan"))
        asia = _safe_float(ms_regions.get("asia_developed")) + _safe_float(
            ms_regions.get("australasia")
        )
    else:
        us = _safe_float(detail.get("united_states")) + _safe_float(
            detail.get("canada")
        )
        eu = (
            _safe_float(macro.get("europe_me_africa"))
            + _safe_float(detail.get("eurozone"))
            + _safe_float(detail.get("united_kingdom"))
            + _safe_float(detail.get("switzerland"))
        )
        em = (
            _safe_float(detail.get("latin_america"))
            + _safe_float(detail.get("asia_emerging"))
            + _safe_float(detail.get("africa_middle_east"))
            + _safe_float(detail.get("emerging"))
        )
        jp = _safe_float(detail.get("japan"))
        asia = max(
            0.0,
            _safe_float(macro.get("asia"))
            - jp
            - _safe_float(detail.get("asia_emerging")),
        )

    buckets = {
        RegionV2.US: us,
        RegionV2.EUROPE: eu,
        RegionV2.EMERGING: em,
        RegionV2.JAPAN: jp,
        RegionV2.ASIA_DEV: asia,
    }

    best_region = max(buckets, key=buckets.get)
    best_weight = buckets[best_region]

    if best_weight >= 50:
        return best_region, best_weight

    return RegionV2.UNKNOWN, 0.0


def _deduce_fixed_income_credit(
    ms_fi: dict, ms_cat_up: str, name_up: str = ""
) -> FICreditBucketV2:
    ms_fi = _safe_dict(ms_fi)
    text = f"{ms_cat_up} {name_up}"

    if "HIGH YIELD" in text:
        return FICreditBucketV2.LOW_QUALITY
    if any(
        x in text
        for x in ["EMERGING", "SUBORDINATED", "CREDIT OPPORTUNITIES", "OPPORTUNITIES"]
    ):
        return FICreditBucketV2.LOW_QUALITY

    qual = _safe_dict(ms_fi.get("credit_quality"))
    if qual:
        high = (
            _safe_float(qual.get("aaa"))
            + _safe_float(qual.get("aa"))
            + _safe_float(qual.get("a"))
        )
        med = _safe_float(qual.get("bbb"))
        low = (
            _safe_float(qual.get("bb"))
            + _safe_float(qual.get("b"))
            + _safe_float(qual.get("below_b"))
        )

        if low > 25:
            return FICreditBucketV2.LOW_QUALITY
        if high >= 60:
            return FICreditBucketV2.HIGH_QUALITY
        if med >= 35:
            return FICreditBucketV2.MEDIUM_QUALITY

    if any(
        x in text
        for x in [
            "GOVERNMENT",
            "TREASURY",
            "SOVEREIGN",
            "MONETARY",
            "CASH",
            "LIQUIDITY",
            "SECURITY",
            "SECURITE",
            "TREASORERIE",
            "TESORERIA",
        ]
    ):
        return FICreditBucketV2.HIGH_QUALITY

    if any(
        x in text
        for x in [
            "CORPORATE",
            "CREDIT",
            "SHORT TERM",
            "SHORT DURATION",
            "CORTO PLAZO",
            "CORTO",
            "0-2",
            "0-5",
        ]
    ):
        return FICreditBucketV2.MEDIUM_QUALITY

    return FICreditBucketV2.UNKNOWN


def _deduce_fi_duration_bucket(
    ms_cat_up: str, ms_fi: dict, name_up: str = ""
) -> FIDurationBucketV2:
    ms_fi = _safe_dict(ms_fi)
    text = f"{ms_cat_up} {name_up}"

    if any(
        x in text
        for x in [
            "ULTRA SHORT",
            "SHORT TERM",
            "SHORT DURATION",
            "CORTO PLAZO",
            "CORTO",
            "0-2",
            "0-5",
            "FLOATING RATE",
            "VNAV",
            "LIQUIDITY",
        ]
    ):
        return FIDurationBucketV2.SHORT
    if any(x in text for x in ["LONG DURATION", "LONG TERM", "LARGO PLAZO", "LONG"]):
        return FIDurationBucketV2.LONG
    if "FLEXIBLE" in text:
        return FIDurationBucketV2.FLEXIBLE

    duration = _safe_float(ms_fi.get("effective_duration"))
    if duration > 0:
        if duration <= 3.5:
            return FIDurationBucketV2.SHORT
        if duration <= 7:
            return FIDurationBucketV2.MEDIUM
        return FIDurationBucketV2.LONG

    # Fixed maturity / horizon funds: usually moderate duration
    if any(
        x in text
        for x in [
            "HORIZON",
            "HORIZONTE",
            "2025",
            "2026",
            "2027",
            "2028",
            "2029",
            "2030",
            "MATURITY",
        ]
    ):
        return FIDurationBucketV2.MEDIUM

    return FIDurationBucketV2.UNKNOWN


def _deduce_equity_subtype(
    ms_cat_up: str, name_up: str, klass: ClassificationV2
) -> AssetSubtypeV2:
    text = f"{ms_cat_up} {name_up}"

    # Theme / sector first
    if any(
        x in text
        for x in ["BIOTECH", "HEALTHCARE", "MEDTECH", "HEALTHSCIENCE", "PHARMA"]
    ):
        klass.is_sector_fund = True
        klass.is_thematic = True
        klass.sector_focus = SectorFocusV2.HEALTHCARE
        return AssetSubtypeV2.SECTOR_EQUITY_HEALTHCARE

    if any(
        x in text
        for x in [
            "TECH",
            "TECHNOLOGY",
            "FINTECH",
            "ROBOTICS",
            "AI",
            "ARTIFICIAL INTELLIGENCE",
            "BIG DATA",
            "CONNECTIVITY",
            "DIGITAL",
        ]
    ):
        klass.is_sector_fund = True
        klass.is_thematic = True
        klass.sector_focus = SectorFocusV2.TECHNOLOGY
        return AssetSubtypeV2.SECTOR_EQUITY_TECH

    if any(
        x in text
        for x in [
            "EMERGING",
            "LATIN AMERICA",
            "BRAZIL",
            "INDIA",
            "CHINA",
            "TAIWAN",
            "FRONTIER",
        ]
    ):
        return AssetSubtypeV2.EMERGING_MARKETS_EQUITY

    if "US EQUITY" in text or any(
        x in text for x in ["S&P 500", "USA", "US ", "AMERICAN"]
    ):
        return AssetSubtypeV2.US_EQUITY

    if "EUROZONE" in text:
        return AssetSubtypeV2.EUROZONE_EQUITY

    if "EUROPE" in text or any(
        x in text
        for x in [
            "IBERIA",
            "SPAIN",
            "ESPAÃA",
            "ITALY",
            "GERMANY",
            "FRANCE",
            "SWITZERLAND",
        ]
    ):
        return AssetSubtypeV2.EUROPE_EQUITY

    if "JAPAN" in text:
        return AssetSubtypeV2.JAPAN_EQUITY

    if any(x in text for x in ["ASIA PACIFIC", "ASIA EX JAPAN", "ASIA", "PACIFIC"]):
        return AssetSubtypeV2.ASIA_PACIFIC_EQUITY

    if any(
        x in text
        for x in ["SMALL CAP", "SMALLER COMPANIES", "MID CAP", "MID-CAP", "SMID", "PME"]
    ):
        return AssetSubtypeV2.GLOBAL_SMALL_CAP_EQUITY

    if any(x in text for x in ["INCOME", "DIVIDEND", "HIGH DIVIDEND", "EQUITY INCOME"]):
        return AssetSubtypeV2.GLOBAL_INCOME_EQUITY

    if any(
        x in text
        for x in [
            "THEMATIC",
            "MEGATREND",
            "MEGATRENDS",
            "CLIMATE",
            "ENERGY",
            "WATER",
            "INFRASTRUCTURE",
            "GOLD",
            "MINING",
            "RESOURCES",
            "CONSUMER TRENDS",
            "PREMIUM BRANDS",
        ]
    ):
        klass.is_thematic = True
        return AssetSubtypeV2.THEMATIC_EQUITY

    return AssetSubtypeV2.GLOBAL_EQUITY


def _deduce_fixed_income_subtype(ms_cat_up: str, name_up: str) -> AssetSubtypeV2:
    text = f"{ms_cat_up} {name_up}"

    if "HIGH YIELD" in text:
        return AssetSubtypeV2.HIGH_YIELD_BOND
    if "CONVERTIBLE" in text:
        return AssetSubtypeV2.CONVERTIBLE_BOND
    if any(
        x in text
        for x in [
            "EMERGING",
            "EMERGING MARKETS",
            "LOCAL CURRENCY",
            "HARD CURRENCY",
            "FRONTIER",
        ]
    ):
        return AssetSubtypeV2.EMERGING_MARKETS_BOND
    if any(
        x in text
        for x in ["INFLATION", "INFLATION-LINKED", "INFLATION LINKED", "LINKED"]
    ):
        return AssetSubtypeV2.INFLATION_LINKED_BOND
    if any(x in text for x in ["GOVERNMENT", "TREASURY", "SOVEREIGN", "COVERED BOND"]):
        return AssetSubtypeV2.GOVERNMENT_BOND
    if any(
        x in text
        for x in [
            "CORPORATE",
            "CREDIT",
            "FLOATING RATE",
            "SHORT DURATION",
            "SHORT TERM",
            "0-2",
            "0-5",
            "AHORRO",
            "PAGARES",
            "PAGARÃS",
            "HORIZON",
            "HORIZONTE",
            "SECURITY",
            "SECURITE",
            "TESORERIA",
            "TREASORERIE",
        ]
    ):
        return AssetSubtypeV2.CORPORATE_BOND

    return AssetSubtypeV2.UNKNOWN


def _deduce_mixed_subtype(
    ms_cat_up: str, eq_met: float, name_up: str = ""
) -> AssetSubtypeV2:
    text = f"{ms_cat_up} {name_up}"

    if any(
        x in text
        for x in [
            "CAUTIOUS",
            "CONSERVATIVE",
            "PRUDENT",
            "PRUDENTE",
            "DEFENSIVE",
            "DEFENSIVO",
        ]
    ):
        return AssetSubtypeV2.CONSERVATIVE_ALLOCATION
    if any(x in text for x in ["MODERATE", "BALANCED", "EQUILIBRADO"]):
        return AssetSubtypeV2.MODERATE_ALLOCATION
    if any(
        x in text
        for x in [
            "AGGRESSIVE",
            "DYNAMIC",
            "FLEXIBLE",
            "OPPORTUNITY",
            "MULTIPLE OPPORTUNITIES",
        ]
    ):
        return AssetSubtypeV2.FLEXIBLE_ALLOCATION

    if eq_met > 65:
        return AssetSubtypeV2.AGGRESSIVE_ALLOCATION
    if eq_met >= 35:
        return AssetSubtypeV2.MODERATE_ALLOCATION
    if 0 < eq_met < 35:
        return AssetSubtypeV2.CONSERVATIVE_ALLOCATION

    return AssetSubtypeV2.FLEXIBLE_ALLOCATION


def _deduce_risk_bucket(
    asset_type: AssetClassV2, subtype: AssetSubtypeV2, fi_credit: FICreditBucketV2
) -> RiskBucketV2:
    if asset_type == AssetClassV2.MONETARY:
        return RiskBucketV2.LOW

    if asset_type == AssetClassV2.FIXED_INCOME:
        if (
            subtype
            in [
                AssetSubtypeV2.HIGH_YIELD_BOND,
                AssetSubtypeV2.EMERGING_MARKETS_BOND,
                AssetSubtypeV2.CONVERTIBLE_BOND,
            ]
            or fi_credit == FICreditBucketV2.LOW_QUALITY
        ):
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

    return RiskBucketV2.MEDIUM


def _evaluate_suitability(klass: ClassificationV2) -> bool:
    if klass.asset_type in [
        AssetClassV2.EQUITY,
        AssetClassV2.REAL_ESTATE,
        AssetClassV2.COMMODITIES,
        AssetClassV2.ALTERNATIVE,
    ]:
        return False

    if klass.fi_credit_bucket == FICreditBucketV2.LOW_QUALITY:
        return False

    if "EMERGING" in klass.asset_subtype.value:
        return False

    if "CONVERTIBLE" in klass.asset_subtype.value:
        return False

    if klass.asset_subtype in [
        AssetSubtypeV2.AGGRESSIVE_ALLOCATION,
        AssetSubtypeV2.FLEXIBLE_ALLOCATION,
    ]:
        return False

    if klass.asset_type == AssetClassV2.MONETARY:
        return True

    if klass.asset_type == AssetClassV2.FIXED_INCOME and klass.fi_credit_bucket in [
        FICreditBucketV2.HIGH_QUALITY,
        FICreditBucketV2.MEDIUM_QUALITY,
    ]:
        return True

    if klass.asset_subtype == AssetSubtypeV2.CONSERVATIVE_ALLOCATION:
        return True

    return False


# =============================================================================
# Main classification
# =============================================================================


def classifyFundV2(isin: str, data: dict) -> ClassificationV2:
    data = _safe_dict(data)
    ms = _safe_dict(data.get("ms"))
    metrics = _safe_dict(data.get("metrics"))
    derived = _safe_dict(data.get("derived"))

    ms_cat = _safe_str(ms.get("category_morningstar"))
    ms_cat_up = _safe_upper(ms_cat)
    name = _safe_str(data.get("name"))
    name_up = _safe_upper(name)

    eq_met = _safe_float(metrics.get("equity"))
    bd_met = _safe_float(metrics.get("bond"))

    klass = ClassificationV2(
        raw_name=name,
        computed_at=_now_iso(),
    )

    # base confidence first
    klass.classification_confidence = 0.95 if ms_cat else (0.80 if metrics else 0.50)
    klass.classification_confidence = _clamp(klass.classification_confidence, 0.0, 1.0)

    if ms_cat:
        klass.source_priority_used = ["ms.category_morningstar"]
    elif metrics:
        klass.source_priority_used = ["metrics"]
    else:
        klass.source_priority_used = ["derived_fallback"]

    klass.asset_type = _deduce_asset_class(
        ms_cat,
        eq_met,
        bd_met,
        name_up,
        _safe_str(derived.get("asset_class")),
    )

    # region
    reg_val, reg_weight = _deduce_region_primary(
        ms_cat_up, _safe_dict(ms.get("regions")), name_up
    )
    klass.region_primary = reg_val
    if 50 <= reg_weight < 60:
        _append_warning(klass, "REGION_PRIMARY_BORDERLINE")
        _apply_confidence_multiplier(klass, 0.8)

    # type-specific classification
    if klass.asset_type == AssetClassV2.EQUITY:
        klass.asset_subtype = _deduce_equity_subtype(ms_cat_up, name_up, klass)

        style_box, style_heur = _deduce_equity_style(
            _safe_dict(ms.get("equity_style")), ms_cat
        )
        klass.equity_style_box = style_box

        mcap_bias, mcap_heur = _deduce_market_cap_bias(
            _safe_dict(ms.get("equity_style")), ms_cat
        )
        klass.market_cap_bias = mcap_bias

        if style_heur or mcap_heur:
            _append_warning(klass, "HEURISTIC_STYLE_DEDUCTION")
            _append_source(klass, "ms.category_heuristic")
            _apply_confidence_multiplier(klass, 0.7)

    elif klass.asset_type == AssetClassV2.FIXED_INCOME:
        text = f"{ms_cat_up} {name_up}"
        fi_block = _safe_dict(ms.get("fixed_income"))

        klass.asset_subtype = _deduce_fixed_income_subtype(ms_cat_up, name_up)
        klass.fi_credit_bucket = _deduce_fixed_income_credit(
            fi_block, ms_cat_up, name_up
        )
        klass.fi_duration_bucket = _deduce_fi_duration_bucket(
            ms_cat_up, fi_block, name_up
        )

        # Infer FI type
        if klass.asset_subtype == AssetSubtypeV2.GOVERNMENT_BOND:
            klass.fi_type = FITypeV2.GOVERNMENT
        elif klass.asset_subtype in [
            AssetSubtypeV2.CORPORATE_BOND,
            AssetSubtypeV2.HIGH_YIELD_BOND,
            AssetSubtypeV2.EMERGING_MARKETS_BOND,
            AssetSubtypeV2.INFLATION_LINKED_BOND,
            AssetSubtypeV2.CONVERTIBLE_BOND,
        ]:
            klass.fi_type = FITypeV2.CORPORATE

        # Defensive heuristic
        excluded = [
            "HIGH YIELD",
            "EMERGING",
            "CONVERTIBLE",
            "AGGRESSIVE",
            "DYNAMIC",
            "UNCONSTRAINED",
            "OPPORTUNITIES",
        ]
        is_risky = any(x in text for x in excluded)

        strong_defensive = [
            "GOVERNMENT",
            "TREASURY",
            "SOVEREIGN",
            "TESORERIA",
            "TREASORERIE",
            "MONETARY",
            "CASH",
            "SECURITY",
            "SECURITE",
            "SHORT",
            "CORTO",
            "CORTO PLAZO",
            "SHORT TERM",
            "SHORT DURATION",
            "0-2",
            "0-5",
            "AHORRO",
            "PAGARES",
            "PAGARÃS",
            "HORIZON",
            "HORIZONTE",
            "FIXED MATURITY",
            "VENCIMIENTO",
        ]

        if not is_risky and any(x in text for x in strong_defensive):
            used_heur = False

            if klass.asset_subtype == AssetSubtypeV2.UNKNOWN:
                if any(
                    x in text
                    for x in [
                        "GOVERNMENT",
                        "TREASURY",
                        "SOVEREIGN",
                        "TESORERIA",
                        "TREASORERIE",
                    ]
                ):
                    klass.asset_subtype = AssetSubtypeV2.GOVERNMENT_BOND
                elif "INFLATION" in text:
                    klass.asset_subtype = AssetSubtypeV2.INFLATION_LINKED_BOND
                else:
                    klass.asset_subtype = AssetSubtypeV2.CORPORATE_BOND
                used_heur = True

            if klass.fi_credit_bucket == FICreditBucketV2.UNKNOWN:
                if any(
                    x in text
                    for x in [
                        "GOVERNMENT",
                        "TREASURY",
                        "SOVEREIGN",
                        "TESORERIA",
                        "TREASORERIE",
                        "MONETARY",
                        "SECURITY",
                        "SECURITE",
                    ]
                ):
                    klass.fi_credit_bucket = FICreditBucketV2.HIGH_QUALITY
                else:
                    klass.fi_credit_bucket = FICreditBucketV2.MEDIUM_QUALITY
                used_heur = True

            if klass.fi_duration_bucket == FIDurationBucketV2.UNKNOWN:
                if any(
                    x in text
                    for x in [
                        "SHORT",
                        "CORTO",
                        "SHORT TERM",
                        "SHORT DURATION",
                        "0-2",
                        "0-5",
                        "AHORRO",
                        "PAGARES",
                        "PAGARÃS",
                    ]
                ):
                    klass.fi_duration_bucket = FIDurationBucketV2.SHORT
                else:
                    klass.fi_duration_bucket = FIDurationBucketV2.MEDIUM
                used_heur = True

            if klass.region_primary == RegionV2.UNKNOWN:
                if any(
                    x in text for x in ["EURO", "EUR", "EUROZONE", "EMU", "EUROLAND"]
                ):
                    klass.region_primary = RegionV2.EUROZONE
                    used_heur = True
                elif "EUROPE" in text:
                    klass.region_primary = RegionV2.EUROPE
                    used_heur = True
                elif "GLOBAL" in text:
                    klass.region_primary = RegionV2.GLOBAL
                    used_heur = True

            if klass.fi_type == FITypeV2.UNKNOWN:
                klass.fi_type = (
                    FITypeV2.GOVERNMENT
                    if klass.asset_subtype == AssetSubtypeV2.GOVERNMENT_BOND
                    else FITypeV2.CORPORATE
                )
                used_heur = True

            if used_heur:
                _append_warning(klass, "FI_DEFENSIVE_HEURISTIC")
                _append_source(klass, "ms.category_heuristic")
                _apply_confidence_multiplier(klass, 0.7)

        if klass.asset_subtype == AssetSubtypeV2.CONVERTIBLE_BOND:
            klass.convertibles_profile = ConvertiblesProfileV2.UNKNOWN

    elif klass.asset_type == AssetClassV2.MIXED:
        klass.asset_subtype = _deduce_mixed_subtype(ms_cat_up, eq_met, name_up)

    elif klass.asset_type == AssetClassV2.MONETARY:
        klass.asset_subtype = AssetSubtypeV2.UNKNOWN
        if klass.region_primary == RegionV2.UNKNOWN:
            if any(x in f"{ms_cat_up} {name_up}" for x in ["EURO", "EUR", "EUROZONE"]):
                klass.region_primary = RegionV2.EUROZONE

    elif klass.asset_type == AssetClassV2.ALTERNATIVE:
        if any(x in f"{ms_cat_up} {name_up}" for x in ["LONG/SHORT", "LONG SHORT"]):
            klass.alternative_bucket = AlternativeBucketV2.LONG_SHORT_EQUITY
        elif "MARKET NEUTRAL" in f"{ms_cat_up} {name_up}":
            klass.alternative_bucket = AlternativeBucketV2.MARKET_NEUTRAL
        elif any(x in f"{ms_cat_up} {name_up}" for x in ["FUTURES", "SYSTEMATIC"]):
            klass.alternative_bucket = AlternativeBucketV2.MANAGED_FUTURES
        else:
            klass.alternative_bucket = AlternativeBucketV2.MULTI_STRATEGY

    if any(
        x in name_up for x in ["INDEX", "IDX", "ISHARES", "VANGUARD", "MSCI", "ETF"]
    ):
        klass.is_index_like = True

    klass.strategy_type = (
        StrategyTypeV2.PASSIVE if klass.is_index_like else StrategyTypeV2.ACTIVE
    )
    klass.risk_bucket = _deduce_risk_bucket(
        klass.asset_type, klass.asset_subtype, klass.fi_credit_bucket
    )
    klass.is_suitable_low_risk = _evaluate_suitability(klass)
    klass.classification_confidence = _clamp(
        _safe_float(klass.classification_confidence), 0.0, 1.0
    )

    return klass


# =============================================================================
# Exposure builder
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

    exp = PortfolioExposureV2(computed_at=_now_iso())

    eq = _safe_float(metrics.get("equity"))
    bd = _safe_float(metrics.get("bond"))
    ca = _safe_float(metrics.get("cash"))
    oth = _safe_float(metrics.get("other"))

    if (eq + bd + ca + oth) < 1.0:
        if klass.asset_type == AssetClassV2.EQUITY:
            eq = 100.0
        elif klass.asset_type == AssetClassV2.FIXED_INCOME:
            bd = 100.0
        elif klass.asset_type == AssetClassV2.MONETARY:
            ca = 100.0
        elif klass.asset_type == AssetClassV2.MIXED:
            if klass.asset_subtype == AssetSubtypeV2.CONSERVATIVE_ALLOCATION:
                eq, bd = 20.0, 80.0
            elif klass.asset_subtype == AssetSubtypeV2.MODERATE_ALLOCATION:
                eq, bd = 50.0, 50.0
            else:
                eq, bd = 80.0, 20.0

    eq, bd, ca, oth = _normalize_pct_block(eq, bd, ca, oth)

    exp.economic_exposure = EconomicExposureV2(
        equity=eq,
        bond=bd,
        cash=ca,
        other=oth,
    )

    # Regions
    if ms_regions:
        macro = _safe_dict(ms_regions.get("macro"))
        detail = _safe_dict(ms_regions.get("detail"))

        if macro or detail:
            exp.equity_regions = {
                "us": _safe_float(detail.get("united_states"))
                + _safe_float(detail.get("canada")),
                "europe": _safe_float(macro.get("europe_me_africa"))
                + _safe_float(detail.get("eurozone"))
                + _safe_float(detail.get("united_kingdom")),
                "emerging": _safe_float(detail.get("latin_america"))
                + _safe_float(detail.get("asia_emerging"))
                + _safe_float(detail.get("africa_middle_east"))
                + _safe_float(detail.get("emerging")),
                "japan": _safe_float(detail.get("japan")),
                "asia_dev": max(
                    0.0,
                    _safe_float(macro.get("asia"))
                    - _safe_float(detail.get("japan"))
                    - _safe_float(detail.get("asia_emerging")),
                ),
            }
        else:
            exp.equity_regions = {
                "us": _safe_float(ms_regions.get("americas"))
                + _safe_float(ms_regions.get("united_states")),
                "europe": _safe_float(ms_regions.get("europe"))
                + _safe_float(ms_regions.get("uk")),
                "emerging": _safe_float(ms_regions.get("asia_emerging"))
                + _safe_float(ms_regions.get("latin_america"))
                + _safe_float(ms_regions.get("emerging")),
                "japan": _safe_float(ms_regions.get("japan")),
                "asia_dev": _safe_float(ms_regions.get("asia_developed"))
                + _safe_float(ms_regions.get("australasia")),
            }

    # Sectors
    if ms_sectors:
        exp.sectors = {
            "technology": _safe_float(ms_sectors.get("technology")),
            "healthcare": _safe_float(ms_sectors.get("healthcare")),
            "financials": _safe_float(ms_sectors.get("financial_services"))
            + _safe_float(ms_sectors.get("financials")),
        }

    # Equity styles
    if ms_style:
        flat_style_map = {
            "large_growth": _safe_float(ms_style.get("large_growth")),
            "large_value": _safe_float(ms_style.get("large_value")),
            "large_core": _safe_float(ms_style.get("large_core"))
            + _safe_float(ms_style.get("large_blend")),
            "mid_growth": _safe_float(ms_style.get("mid_growth")),
            "mid_value": _safe_float(ms_style.get("mid_value")),
            "mid_core": _safe_float(ms_style.get("mid_core"))
            + _safe_float(ms_style.get("mid_blend")),
            "small_growth": _safe_float(ms_style.get("small_growth")),
            "small_value": _safe_float(ms_style.get("small_value")),
            "small_core": _safe_float(ms_style.get("small_core"))
            + _safe_float(ms_style.get("small_blend")),
        }

        if max(flat_style_map.values() or [0]) > 0:
            exp.equity_styles = flat_style_map
        else:
            style_data = _safe_dict(ms_style.get("style"))
            mcap_data = _safe_dict(ms_style.get("market_cap"))

            value = _safe_float(style_data.get("value"))
            blend = _safe_float(style_data.get("blend"))
            growth = _safe_float(style_data.get("growth"))

            giant = _safe_float(mcap_data.get("giant"))
            large = _safe_float(mcap_data.get("large"))
            mid = _safe_float(mcap_data.get("mid"))
            small = _safe_float(mcap_data.get("small"))
            micro = _safe_float(mcap_data.get("micro"))

            large_bucket = giant + large
            small_bucket = small + micro

            exp.equity_styles = {
                "large_growth": round((large_bucket * growth) / 100.0, 2),
                "large_value": round((large_bucket * value) / 100.0, 2),
                "large_core": round((large_bucket * blend) / 100.0, 2),
                "mid_growth": round((mid * growth) / 100.0, 2),
                "mid_value": round((mid * value) / 100.0, 2),
                "mid_core": round((mid * blend) / 100.0, 2),
                "small_growth": round((small_bucket * growth) / 100.0, 2),
                "small_value": round((small_bucket * value) / 100.0, 2),
                "small_core": round((small_bucket * blend) / 100.0, 2),
            }

    # FI overlays
    if klass.fi_credit_bucket != FICreditBucketV2.UNKNOWN:
        exp.fi_credit = {klass.fi_credit_bucket.value.lower(): 100.0}

    if klass.fi_duration_bucket != FIDurationBucketV2.UNKNOWN:
        exp.fi_duration = {klass.fi_duration_bucket.value.lower(): 100.0}

    if klass.fi_type != FITypeV2.UNKNOWN:
        exp.fi_types = {klass.fi_type.value.lower(): 100.0}

    # Convertibles profile refinement
    if klass.asset_subtype == AssetSubtypeV2.CONVERTIBLE_BOND:
        if exp.economic_exposure.equity > 50:
            klass.convertibles_profile = ConvertiblesProfileV2.EQUITY_LIKE
        elif exp.economic_exposure.equity > 20:
            klass.convertibles_profile = ConvertiblesProfileV2.BALANCED
        else:
            klass.convertibles_profile = ConvertiblesProfileV2.BOND_LIKE

    # Conservative allocation conflict
    if (
        klass.asset_subtype == AssetSubtypeV2.CONSERVATIVE_ALLOCATION
        and exp.economic_exposure.equity > 40
    ):
        _append_warning(klass, "HIDDEN_EQUITY_RISK")
        klass.is_suitable_low_risk = False
        if "High equity exposure for conservative label." not in exp.warnings:
            exp.warnings.append("High equity exposure for conservative label.")
        if "HIDDEN_EQUITY_RISK" not in exp.risk_flags:
            exp.risk_flags.append("HIDDEN_EQUITY_RISK")

    if (
        exp.economic_exposure.equity > 0
        and _safe_float(exp.equity_regions.get("emerging")) > 20
    ):
        if "HIGH_EMERGING_RISK" not in exp.risk_flags:
            exp.risk_flags.append("HIGH_EMERGING_RISK")

    exp.exposure_confidence = 0.90 if (eq + bd + ca + oth) > 0 else 0.40
    exp.exposure_confidence = _clamp(exp.exposure_confidence, 0.0, 1.0)

    return exp


# =============================================================================
# Batch runner
# =============================================================================


def run_batch(mode: str = "dry-run", limit: int = 0):
    init_firebase()

    run_id = datetime.now(timezone.utc).strftime("run_%Y%m%d_%H%M%S")
    print(f"\n{'=' * 60}")
    print(f"  TAXONOMY V2 BATCH â {mode.upper()}")
    print(f"  Run ID: {run_id}")
    print(f"  Limit: {'ALL' if limit == 0 else limit}")
    print(f"  Started: {_now_iso()}")
    print(f"{'=' * 60}\n")

    query = db.collection("funds_v3")
    if limit > 0:
        query = query.limit(limit)

    funds_stream = query.stream()

    stats = {
        "run_id": run_id,
        "mode": mode,
        "started_at": _now_iso(),
        "total_read": 0,
        "processed": 0,
        "updated": 0,
        "skipped": 0,
        "errors": 0,
        "error_isins": [],
        "asset_type_dist": {},
    }

    batch_writer = db.batch() if mode == "execute" else None
    batch_count = 0
    batch_size = 400

    for doc in funds_stream:
        stats["total_read"] += 1
        isin = doc.id

        try:
            data = _safe_dict(doc.to_dict())
            klass = classifyFundV2(isin, data)
            exp = buildPortfolioExposureV2(isin, data, klass)

            at = klass.asset_type.value
            stats["asset_type_dist"][at] = stats["asset_type_dist"].get(at, 0) + 1

            if mode == "dry-run":
                stats["processed"] += 1
                if stats["total_read"] <= 10 or stats["total_read"] % 50 == 0:
                    print(
                        f"  [{stats['total_read']:4d}] {isin} | "
                        f"{at:15s} | {klass.asset_subtype.value:30s} | "
                        f"low_risk={klass.is_suitable_low_risk} | "
                        f"conf={klass.classification_confidence:.2f}"
                    )
                    if klass.warnings:
                        print(f"         [WARNING] {klass.warnings}")

            else:
                update_data = {
                    "classification_v2": _model_dump(klass),
                    "portfolio_exposure_v2": _model_dump(exp),
                }
                batch_writer.update(doc.reference, update_data)
                batch_count += 1
                stats["updated"] += 1
                stats["processed"] += 1

                if batch_count >= batch_size:
                    batch_writer.commit()
                    batch_writer = db.batch()
                    batch_count = 0
                    print(f"  [COMMIT] {stats['updated']} funds written...")

        except Exception as e:
            stats["errors"] += 1
            stats["error_isins"].append({"isin": isin, "error": str(e)})
            print(f"  [ERROR] [{isin}]: {e}")

            if mode == "execute" and batch_count > 0:
                try:
                    batch_writer.commit()
                except Exception:
                    pass
                batch_writer = db.batch()
                batch_count = 0

        if stats["total_read"] % 100 == 0:
            print(f"  ... processed {stats['total_read']} funds ...")

    if mode == "execute" and batch_count > 0:
        batch_writer.commit()
        print(f"  [FINAL COMMIT] {stats['updated']} total funds written")

    stats["finished_at"] = _now_iso()

    print(f"\n{'=' * 60}")
    print("  BATCH COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Total Read:    {stats['total_read']}")
    print(f"  Processed:     {stats['processed']}")
    print(f"  Updated:       {stats['updated']}")
    print(f"  Errors:        {stats['errors']}")
    print("\n  Asset Type Distribution:")
    for k, v in sorted(stats["asset_type_dist"].items()):
        print(f"    {k:20s} -> {v}")

    if stats["error_isins"]:
        print("\n  Error ISINs:")
        for err in stats["error_isins"][:20]:
            print(f"    {err['isin']}: {err['error']}")

    print(f"\n  Finished: {stats['finished_at']}")

    os.makedirs("reports", exist_ok=True)
    summary_path = f"reports/batch_{run_id}.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n  Summary saved to: {summary_path}")
    return stats


# =============================================================================
# Mock tests
# =============================================================================


def test_math_logic():
    print("Running deterministic mock tests...\n")

    def _test_case(name, mock_data):
        print(f"--- TESTING: {name} ---")
        klass = classifyFundV2("MOCK_ISIN", mock_data)
        exp = buildPortfolioExposureV2("MOCK_ISIN", mock_data, klass)
        print(
            f"  AssetType: {klass.asset_type.value} | Subtype: {klass.asset_subtype.value}"
        )
        print(
            f"  RiskBucket: {klass.risk_bucket.value} | LowRiskSuitable: {klass.is_suitable_low_risk}"
        )
        print(f"  Confidence: {klass.classification_confidence:.2f}")
        if klass.warnings:
            print(f"  Warnings: {klass.warnings}")
        print(
            f"  Exposure: EQ={exp.economic_exposure.equity} "
            f"BD={exp.economic_exposure.bond} "
            f"CA={exp.economic_exposure.cash} "
            f"OT={exp.economic_exposure.other}"
        )
        print()
        return klass, exp

    _test_case(
        "BIOTECH",
        {
            "name": "Franklin Biotechnology Discovery",
            "ms": {"category_morningstar": "Sector Equity Biotechnology"},
            "metrics": {"equity": 98},
        },
    )

    _test_case(
        "GLOBAL EQUITY CORE",
        {
            "name": "Vanguard Global Stock Index",
            "ms": {
                "category_morningstar": "Global Large-Cap Blend Equity",
                "equity_style": {
                    "large_core": 70,
                    "large_growth": 15,
                    "large_value": 15,
                },
            },
            "metrics": {"equity": 99},
        },
    )

    _test_case(
        "MONEY MARKET",
        {
            "name": "Amundi Cash EUR",
            "ms": {"category_morningstar": "EUR Money Market"},
            "metrics": {"cash": 100},
        },
    )

    _test_case(
        "HIGH YIELD",
        {
            "name": "PIMCO High Yield",
            "ms": {"category_morningstar": "Global High Yield Fixed Income"},
            "metrics": {"bond": 95},
        },
    )

    _test_case(
        "ALLOCATION 70/20",
        {
            "name": "Aggressive Strategy",
            "ms": {"category_morningstar": "EUR Aggressive Allocation"},
            "metrics": {"equity": 70, "bond": 20, "cash": 10},
        },
    )

    _test_case(
        "ALLOCATION 20/70",
        {
            "name": "Defensive Strategy",
            "ms": {"category_morningstar": "EUR Cautious Allocation"},
            "metrics": {"equity": 20, "bond": 70, "cash": 10},
        },
    )

    _test_case(
        "CONVERTIBLE EQUITY-SENSITIVE",
        {
            "name": "Schroder ISF Global Convertible Bond",
            "ms": {"category_morningstar": "Convertible Bond"},
            "metrics": {"bond": 40, "equity": 60},
        },
    )

    _test_case(
        "DEFENSIVE FI",
        {
            "name": "Cartera Renta Fija Horizonte 2028 FI",
            "ms": {"category_morningstar": "Fixed Term Bond"},
            "metrics": {"bond": 100},
        },
    )

    _test_case(
        "FONDO AMBIGUO",
        {"name": "Jupiter Dynamic Range"},
    )


# =============================================================================
# CLI
# =============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="V2 Taxonomy Batch Runner")
    parser.add_argument("--execute", action="store_true", help="Write to Firestore")
    parser.add_argument("--dry-run", action="store_true", help="Read-only preview")
    parser.add_argument(
        "--test-math", action="store_true", help="Run mock classification tests"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of funds to process (0 = all)",
    )
    args = parser.parse_args()

    if args.test_math:
        test_math_logic()
    elif args.execute:
        run_batch(mode="execute", limit=args.limit)
    else:
        dry_limit = args.limit if args.limit > 0 else 30
        run_batch(mode="dry-run", limit=dry_limit)

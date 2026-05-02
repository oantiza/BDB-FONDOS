from typing import Dict, Any, Tuple

from services.portfolio.utils import extract_v2_identity, get_v2_asset_mix


def is_fund_eligible_for_profile(asset_meta: Dict[str, Any], risk_profile: int) -> Tuple[bool, str]:
    """
    Evaluates if a fund is eligible for a given numerical risk profile (1-10)
    using Canonical V2 identity plus real portfolio exposure.

    Returns: (is_eligible: bool, reason: str)
    """
    class_v2 = asset_meta.get("classification_v2", {}) or {}

    # Keep strict V2 requirement so legacy-only assets do not enter the motor silently.
    if not class_v2:
        return False, "Strict V2 Requirement: Missing classification_v2."

    identity = extract_v2_identity(asset_meta)
    exposure = get_v2_asset_mix(asset_meta, as_percent=True)

    asset_type = identity.get("asset_type")
    asset_subtype = identity.get("asset_subtype")
    risk_bucket = identity.get("risk_bucket")
    is_sector_fund = bool(class_v2.get("is_sector_fund")) or str(asset_subtype or "").startswith("SECTOR_EQUITY_")
    sector_focus = str(class_v2.get("sector_focus") or "").upper()
    is_suitable_low_risk = class_v2.get("is_suitable_low_risk")
    real_eq = float(exposure.get("equity", 0.0) or 0.0)

    # 1. Very Conservative Profiles (1-2)
    if risk_profile <= 2:
        if is_suitable_low_risk is False:
            return False, f"Fund flagged as not suitable for low risk. Type: {asset_type}, Subtype: {asset_subtype}"

        if risk_bucket == "HIGH":
            return False, "Hard exclusion: Fund has HIGH risk bucket."

        if real_eq > 30:
            return False, f"Hard exclusion: Real economic equity exposure is {real_eq}% (>30%)."

    # 2. Conservative / Moderate-Low Profiles (3-4)
    if risk_profile <= 4:
        if risk_bucket == "HIGH" and asset_type != "equity":
            return False, "Hard exclusion for conservative profile: High risk asset."

        if risk_profile == 3 and real_eq > 45:
            return False, f"Real equity {real_eq}% exceeds limit for profile 3."
        if risk_profile == 4 and real_eq > 60:
            return False, f"Real equity {real_eq}% exceeds limit for profile 4."

        if is_sector_fund:
            return False, f"Sector funds ({class_v2.get('sector_focus')}) are excluded for profiles <= 4."

        if asset_subtype in {"EMERGING_MARKETS_EQUITY", "HIGH_YIELD_BOND"} or asset_type == "commodities":
            return False, f"Asset Subtype {asset_subtype} is excluded for profiles <= 4."

    # 3. Moderate Profiles (5-7)
    if risk_profile <= 7 and is_sector_fund:
        if sector_focus == "HEALTHCARE" and risk_profile < 6:
            return False, "Healthcare/Biotech too volatile for profile < 6."

    return True, "Eligible"


def get_economic_bucket(asset_meta: Dict[str, Any]) -> str:
    """
    Returns a normalized economic bucket string suitable for initial universe generation.
    E.g. "core_equity_dm", "core_bond_ig", "defensive_cash", "satellite_em_equity"
    """
    identity = extract_v2_identity(asset_meta)
    asset_type = identity.get("asset_type")
    subtype = identity.get("asset_subtype")

    if not asset_type:
        return "unknown"

    if asset_type == "money_market":
        return "defensive_cash"

    if asset_type == "fixed_income":
        if subtype in {"HIGH_YIELD_BOND", "EMERGING_MARKETS_BOND", "CONVERTIBLE_BOND"}:
            return "high_yield_or_em_bond"
        return "core_bond_ig"

    if asset_type == "equity":
        if subtype == "EMERGING_MARKETS_EQUITY":
            return "satellite_em_equity"
        if bool((asset_meta.get("classification_v2", {}) or {}).get("is_sector_fund")) or str(subtype or "").startswith("SECTOR_EQUITY_"):
            return "satellite_sector_equity"
        if subtype == "GLOBAL_SMALL_CAP_EQUITY":
            return "satellite_smallcap_equity"
        return "core_equity_dm"

    if asset_type == "allocation":
        if subtype == "CONSERVATIVE_ALLOCATION":
            return "prudent_allocation"
        if subtype == "AGGRESSIVE_ALLOCATION":
            return "aggressive_allocation"
        return "moderate_allocation"

    return "alternatives_limited"

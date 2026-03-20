from typing import Dict, Any, List, Tuple
from models.canonical_types import (
    AssetClassV2, AssetSubtypeV2, RiskBucketV2,
    FICreditBucketV2, SectorFocusV2, ConvertiblesProfileV2
)

def is_fund_eligible_for_profile(asset_meta: Dict[str, Any], risk_profile: int) -> Tuple[bool, str]:
    """
    Evaluates if a fund is eligible for a given numerical risk profile (1-10)
    using the Canonical V2 Classification and Portfolio Exposure data.
    
    Returns: (is_eligible: bool, reason: str)
    """
    class_v2 = asset_meta.get("classification_v2", {})
    exp_v2 = asset_meta.get("portfolio_exposure_v2", {})
    
    # If no V2 classification exists, hard reject since DB is 100% V2 compliant:
    if not class_v2:
        return False, "⛔ Strict V2 Requirement: Missing classification_v2."
    
    # V2 LOGIC
    is_suitable_low_risk = class_v2.get("is_suitable_low_risk", False)
    asset_type = class_v2.get("asset_type")
    asset_subtype = class_v2.get("asset_subtype")
    risk_bucket = class_v2.get("risk_bucket")
    
    # 1. Very Conservative Profiles (1-2)
    if risk_profile <= 2:
        if not is_suitable_low_risk:
            return False, f"Fund flagged as not suitable for low risk. Type: {asset_type}, Subtype: {asset_subtype}"
        
        # Double check hard exclusions just in case
        if risk_bucket == RiskBucketV2.HIGH.value:
            return False, "Hard exclusion: Fund has HIGH risk bucket."
            
        if exp_v2:
            eco = exp_v2.get("economic_exposure", {})
            real_eq = float(eco.get("equity", 0.0) or 0.0)
            if real_eq > 30:
                return False, f"Hard exclusion: Real economic equity exposure is {real_eq}% (>30%)."

    # 2. Conservative / Moderate-Low Profiles (3-4)
    if risk_profile <= 4:
        if risk_bucket == RiskBucketV2.HIGH.value and asset_type != AssetClassV2.EQUITY.value:
            # We might allow VERY well-diversified global equity in small doses, but block high-risk non-equity
            return False, "Hard exclusion for conservative profile: High risk asset."
            
        # Hard cap on equity depending on profile
        if exp_v2:
            real_eq = float(exp_v2.get("economic_exposure", {}).get("equity", 0.0) or 0.0)
            if risk_profile == 3 and real_eq > 45:
                # E.g. a fund could technically be allowed if it meets 3, but blocked if equity is super high secretly
                return False, f"Real equity {real_eq}% exceeds limit for profile 3."
            if risk_profile == 4 and real_eq > 60:
                return False, f"Real equity {real_eq}% exceeds limit for profile 4."

        # Exclude heavily aggressive sectors in profiles <= 4
        if class_v2.get("is_sector_fund"):
            return False, f"Sector funds ({class_v2.get('sector_focus')}) are excluded for profiles <= 4."
            
        if asset_subtype in [
            AssetSubtypeV2.EMERGING_MARKETS_EQUITY.value,
            AssetSubtypeV2.HIGH_YIELD_BOND.value,
        ] or asset_type == AssetClassV2.COMMODITIES.value:
            return False, f"Asset Subtype {asset_subtype} is excluded for profiles <= 4."

    # 3. Moderate Profiles (5-7)
    if risk_profile <= 7:
        if exp_v2 and class_v2.get("is_sector_fund"):
            if class_v2.get("sector_focus") == SectorFocusV2.HEALTHCARE.value and risk_profile < 6:
                return False, "Healthcare/Biotech too volatile for profile < 6."

    return True, "Eligible"

def get_economic_bucket(asset_meta: Dict[str, Any]) -> str:
    """
    Returns a normalized economic bucket string suitable for initial universe generation.
    E.g. "core_equity_dm", "core_bond_ig", "defensive_cash", "satellite_em_equity"
    """
    class_v2 = asset_meta.get("classification_v2", {})
    if not class_v2 or not class_v2.get("asset_type"):
        return "unknown"
        
    asset_type = class_v2.get("asset_type")
    subtype = class_v2.get("asset_subtype")
    
    if asset_type == AssetClassV2.MONETARY.value:
        return "defensive_cash"
        
    if asset_type == AssetClassV2.FIXED_INCOME.value:
        if subtype in [AssetSubtypeV2.HIGH_YIELD_BOND.value, AssetSubtypeV2.EMERGING_MARKETS_BOND.value, AssetSubtypeV2.CONVERTIBLE_BOND.value]:
            return "high_yield_or_em_bond"
        return "core_bond_ig"
        
    if asset_type == AssetClassV2.EQUITY.value:
        if subtype == AssetSubtypeV2.EMERGING_MARKETS_EQUITY.value:
            return "satellite_em_equity"
        if class_v2.get("is_sector_fund"):
            return "satellite_sector_equity"
        if subtype == AssetSubtypeV2.GLOBAL_SMALL_CAP_EQUITY.value:
            return "satellite_smallcap_equity"
        return "core_equity_dm"
        
    if asset_type == AssetClassV2.MIXED.value:
        if subtype == AssetSubtypeV2.CONSERVATIVE_ALLOCATION.value:
            return "prudent_allocation"
        if subtype == AssetSubtypeV2.AGGRESSIVE_ALLOCATION.value:
            return "aggressive_allocation"
        return "moderate_allocation"
        
    return "alternatives_limited"

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0
=======================================
Read-only dry-run script for compatible_profiles regeneration audit.

Purpose:
  Scans all documents in funds_v3, recomputes compatible_profiles using the
  canonical backend suitability logic (mirror of suitability_engine.py), and
  compares the computed result against any stored value.

  Generates a local JSON artifact with per-fund results. NEVER writes to
  Firestore under any circumstances.

Usage:
  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\Users\\oanti\\Documents\\_SECRETS\\bdb-fondos-service-account.json"
  python scripts/maintenance/bdb_compatible_profiles_regen_dry_run.py

SAFETY GUARANTEES:
  - This script contains NO calls to .set(), .update(), .delete(), .batch()
    or any Firestore write operation.
  - It rejects --write, --apply, --execute, --commit flags explicitly.
  - The artifact JSON always contains write_executed: false.
  - The only side-effect is writing a local file under artifacts/suitability/.

DO NOT RUN WITH WRITE FLAGS — this script is audit-only.

References:
  - functions_python/services/portfolio/suitability_engine.py
  - docs/BDB_SUITABILITY_CONTRACT_TESTS_0.md
  - docs/BDB_SUITABILITY_HARDCODED_CONTRACT_AUDIT_0.md
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ─── SAFETY GUARD: reject any write-capable flags ─────────────────────────────
_FORBIDDEN_FLAGS = {"--write", "--apply", "--execute", "--commit", "--force", "--run"}
for _flag in sys.argv[1:]:
    if _flag.lower() in _FORBIDDEN_FLAGS:
        print(f"[ABORT] Forbidden flag detected: {_flag}")
        print("        This is a DRY-RUN ONLY script. No write flags are accepted.")
        print("        To write compatible_profiles, create BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0.")
        sys.exit(1)

# ─── PATHS ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "suitability"
ARTIFACT_PATH = ARTIFACT_DIR / "compatible_profiles_regen_dry_run_0.json"

# Hamco — excluded (insufficient historical data, no portfolio_exposure_v2)
HAMCO_ISIN = "LU3038481936"

# Profiles to evaluate (1-10)
ALL_PROFILES = list(range(1, 11))


# ─── SUITABILITY LOGIC (inline mirror of suitability_engine.py) ───────────────
# This mirrors is_fund_eligible_for_profile() exactly as it exists in
# functions_python/services/portfolio/suitability_engine.py (commit d565abb).
# Any change to the engine must be reflected here — test_suitability_contract_parity.py
# will catch divergences.

def _safe_dict(v):
    return v if isinstance(v, dict) else {}


def _safe_float(v, default=0.0):
    try:
        if v is None or v == "":
            return default
        return float(v)
    except Exception:
        return default


def _normalize_token(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text.replace("-", "_").replace(" ", "_").upper()


def _normalize_v2_asset_type(value):
    token = _normalize_token(value)
    if not token:
        return None
    mapping = {
        "EQUITY": "equity",
        "FIXED_INCOME": "fixed_income",
        "MIXED": "allocation",
        "ALLOCATION": "allocation",
        "MONETARY": "money_market",
        "MONEY_MARKET": "money_market",
        "ALTERNATIVE": "alternative",
        "REAL_ESTATE": "real_asset",
        "REAL_ASSET": "real_asset",
        "COMMODITIES": "commodities",
        "OTHER": "other",
        "UNKNOWN": "unknown",
    }
    return mapping.get(token, token.lower())


def _extract_v2_identity(asset_meta: dict) -> dict:
    """Extract classification_v2 fields used by suitability engine."""
    class_v2 = _safe_dict(asset_meta.get("classification_v2"))
    raw_type = class_v2.get("asset_type")
    asset_type = _normalize_v2_asset_type(raw_type)
    asset_subtype = _normalize_token(class_v2.get("asset_subtype"))
    raw_bucket = class_v2.get("risk_bucket")
    risk_bucket = str(raw_bucket).upper() if raw_bucket else None
    return {
        "asset_type": asset_type,
        "asset_subtype": asset_subtype,
        "risk_bucket": risk_bucket,
    }


def _get_v2_economic_exposure(asset_meta: dict) -> dict:
    """
    Extract economic_exposure from portfolio_exposure_v2.
    Returns dict with equity, bond, cash, other (all floats, percent 0-100).
    Returns empty dict if no valid exposure found.
    """
    exp_v2 = _safe_dict(asset_meta.get("portfolio_exposure_v2"))
    econ = _safe_dict(exp_v2.get("economic_exposure"))
    if not econ:
        return {}
    eq = _safe_float(econ.get("equity"), None)
    bd = _safe_float(econ.get("bond"), None)
    if eq is None and bd is None:
        return {}
    return {
        "equity": _safe_float(econ.get("equity")),
        "bond": _safe_float(econ.get("bond")),
        "cash": _safe_float(econ.get("cash")),
        "other": _safe_float(econ.get("other")),
    }


def _is_fund_eligible_for_profile(asset_meta: dict, risk_profile: int):
    """
    Mirror of is_fund_eligible_for_profile() from suitability_engine.py.
    Returns (is_eligible: bool, reason: str).
    """
    class_v2 = _safe_dict(asset_meta.get("classification_v2"))

    if not class_v2:
        return False, "Strict V2 Requirement: Missing classification_v2."

    identity = _extract_v2_identity(asset_meta)
    exposure = _get_v2_economic_exposure(asset_meta)
    has_v2_exposure = bool(exposure)

    asset_type = identity.get("asset_type")
    asset_subtype = identity.get("asset_subtype")
    risk_bucket = identity.get("risk_bucket")
    is_sector_fund = bool(class_v2.get("is_sector_fund")) or str(asset_subtype or "").startswith("SECTOR_EQUITY_")
    sector_focus = str(class_v2.get("sector_focus") or "").upper()
    is_suitable_low_risk = class_v2.get("is_suitable_low_risk")
    real_eq = _safe_float(exposure.get("equity", 0.0))

    if not has_v2_exposure:
        message = "Missing portfolio_exposure_v2/economic exposure: requires review."
        if risk_profile <= 4:
            return False, message

    # Rule 1-2: Very Conservative
    if risk_profile <= 2:
        if is_suitable_low_risk is False:
            return False, f"Fund flagged as not suitable for low risk. Type: {asset_type}, Subtype: {asset_subtype}"
        if risk_bucket == "HIGH":
            return False, "Hard exclusion: Fund has HIGH risk bucket."
        if real_eq > 30:
            return False, f"Hard exclusion: Real economic equity exposure is {real_eq}% (>30%)."

    # Rule 3-4: Conservative / Moderate-Low
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

    # Rule 5-7: Moderate
    if risk_profile <= 7 and is_sector_fund:
        if sector_focus == "HEALTHCARE" and risk_profile < 6:
            return False, "Healthcare/Biotech too volatile for profile < 6."

    return True, "Eligible"


def _compute_compatible_profiles(asset_meta: dict) -> list:
    """Compute the full compatible profiles list [1..10] using backend logic."""
    return [
        p for p in ALL_PROFILES
        if _is_fund_eligible_for_profile(asset_meta, p)[0]
    ]


# ─── FIREBASE INIT ────────────────────────────────────────────────────────────

def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore as fs

    if not firebase_admin._apps:
        cred_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_env and os.path.exists(cred_env):
            cred = credentials.Certificate(cred_env)
            firebase_admin.initialize_app(cred)
            print(f"[INIT] Firebase initialized from GOOGLE_APPLICATION_CREDENTIALS: {cred_env}")
        else:
            # Fallback: legacy key locations
            key_paths = [
                ROOT / "scripts" / "serviceAccountKey.json",
                ROOT / "functions_python" / "serviceAccountKey.json",
            ]
            for kp in key_paths:
                if kp.exists():
                    cred = credentials.Certificate(str(kp))
                    firebase_admin.initialize_app(cred)
                    print(f"[INIT] Firebase initialized from: {kp}")
                    break
            else:
                firebase_admin.initialize_app()
                print("[INIT] Firebase initialized with default credentials (ADC)")

    return fs.client()


# ─── FUND ANALYSIS ────────────────────────────────────────────────────────────

KNOWN_MIXED_REMEDIATED_ISINS = {
    # Representative sample from gates 1-8 (59 remediated funds)
    # Full list in docs/BDB_MIXED_EXPOSURE_FINAL_CLOSEOUT_59_60.md
    "IE00B3DKXQ41", "LU0256624742", "LU0119750205", "IE00B4L5Y983",
    "LU0318939179", "LU0861722540", "LU0902704996", "LU1135991498",
    "LU0094028755", "LU0119751013", "LU0124380416", "LU0236725615",
    "LU0279077257", "LU0279097487", "LU0294219869", "LU0328592070",
    "LU0453930560", "LU0510440064", "LU0557085753", "LU0557171199",
    "LU0557172676", "LU0557173567", "LU0592909157", "LU0592910007",
    "LU0592910858", "LU0592911153", "LU0592911500", "LU0592912151",
    "LU0592912235", "LU0592912573", "LU0592912987", "LU0592913365",
    "LU0592913878", "LU0592914173", "LU0674140407", "LU0674140589",
    "LU0726757031", "LU0827882591", "LU0860443602", "LU0860444675",
    "LU0860445136", "LU0860445730", "LU0987487065", "LU1085585368",
    "LU1182309779", "LU1182309852", "LU1182310249", "LU1182310322",
    "LU1182310595", "LU1182310678", "LU1182310751", "LU1182310835",
    "LU1182311056", "LU1182311130", "LU1182311213", "LU1182311569",
    "LU1182311643", "LU1182311726", "LU1182311999",
}


def _classify_fund_result(
    isin: str,
    current_profiles,
    computed_profiles: list,
    class_v2: dict,
    exp_v2: dict,
) -> dict:
    """Classify the comparison result for a single fund."""
    is_hamco = isin == HAMCO_ISIN
    is_mixed = str((class_v2 or {}).get("asset_type", "")).upper() == "MIXED"
    is_likely_post_mixed = isin in KNOWN_MIXED_REMEDIATED_ISINS

    econ = _safe_dict((exp_v2 or {}).get("economic_exposure"))
    economic_exposure = {
        "equity": _safe_float(econ.get("equity")),
        "bond": _safe_float(econ.get("bond")),
        "cash": _safe_float(econ.get("cash")),
        "other": _safe_float(econ.get("other")),
    } if econ else None

    exposure_confidence = _safe_float((exp_v2 or {}).get("exposure_confidence"), None)

    # Determine status
    if is_hamco:
        status = "SKIPPED"
        write_recommended = False
        reason = "Hamco fund — insufficient historical data, no portfolio_exposure_v2. Excluded from regen."
    elif current_profiles is None:
        status = "MISSING"
        write_recommended = True
        reason = "compatible_profiles field is absent from Firestore document."
    elif not isinstance(current_profiles, list):
        status = "INVALID_SCHEMA"
        write_recommended = True
        reason = f"compatible_profiles has unexpected type: {type(current_profiles).__name__}"
    elif sorted(current_profiles) == sorted(computed_profiles):
        status = "MATCH"
        write_recommended = False
        reason = "Stored compatible_profiles matches computed value."
    else:
        status = "STALE"
        write_recommended = True
        added = sorted(set(computed_profiles) - set(current_profiles))
        removed = sorted(set(current_profiles) - set(computed_profiles))
        parts = []
        if added:
            parts.append(f"profiles {added} would be ADDED (fund now eligible)")
        if removed:
            parts.append(f"profiles {removed} would be REMOVED (fund now ineligible)")
        reason = "; ".join(parts) if parts else "Profiles differ."

    # Extra flag for post-MIXED impact
    likely_post_mixed_impact = (
        is_likely_post_mixed
        and status in {"STALE", "MISSING"}
        and not is_hamco
    )

    return {
        "isin": isin,
        "current_compatible_profiles": current_profiles,
        "computed_compatible_profiles": computed_profiles,
        "status": status,
        "asset_class": str((class_v2 or {}).get("asset_type", "UNKNOWN")).upper(),
        "subtype": str((class_v2 or {}).get("asset_subtype", "UNKNOWN")).upper(),
        "economic_exposure": economic_exposure,
        "exposure_confidence": exposure_confidence,
        "is_mixed": is_mixed,
        "likely_post_mixed_impact": likely_post_mixed_impact,
        "write_recommended": write_recommended,
        "reason": reason,
    }


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 70}")
    print("  BDB-COMPATIBLE-PROFILES-REGEN — DRY-RUN AUDIT")
    print(f"  Generated: {generated_at}")
    print(f"  Mode: READ-ONLY | write_executed=false | deploy=false")
    print(f"{'=' * 70}\n")

    db = init_firebase()

    print("[SCAN] Reading all documents from funds_v3...")
    docs = list(db.collection("funds_v3").stream())
    print(f"[SCAN] Found {len(docs)} documents in funds_v3\n")

    per_fund_results = []
    stats = {
        "total_funds_scanned": len(docs),
        "with_compatible_profiles": 0,
        "without_compatible_profiles": 0,
        "matching_count": 0,
        "stale_count": 0,
        "missing_count": 0,
        "schema_invalid_count": 0,
        "skipped_count": 0,
        "mixed_total": 0,
        "mixed_stale_count": 0,
        "mixed_missing_count": 0,
    }

    hamco_status = None
    top_stale_examples = []

    for doc in docs:
        isin = doc.id
        data = doc.to_dict() or {}
        name = data.get("name", "")
        class_v2 = _safe_dict(data.get("classification_v2"))
        exp_v2 = _safe_dict(data.get("portfolio_exposure_v2"))
        current_profiles = class_v2.get("compatible_profiles")  # None if absent

        is_mixed = str(class_v2.get("asset_type", "")).upper() == "MIXED"
        if is_mixed:
            stats["mixed_total"] += 1

        # Track presence
        if current_profiles is not None:
            stats["with_compatible_profiles"] += 1
        else:
            stats["without_compatible_profiles"] += 1

        # Compute profiles using suitability engine mirror
        computed_profiles = _compute_compatible_profiles(data)

        result = _classify_fund_result(
            isin=isin,
            current_profiles=current_profiles,
            computed_profiles=computed_profiles,
            class_v2=class_v2,
            exp_v2=exp_v2,
        )
        result["name"] = name
        per_fund_results.append(result)

        # Update stats
        st = result["status"]
        if st == "MATCH":
            stats["matching_count"] += 1
        elif st == "STALE":
            stats["stale_count"] += 1
            if is_mixed:
                stats["mixed_stale_count"] += 1
            if len(top_stale_examples) < 10:
                top_stale_examples.append({
                    "isin": isin,
                    "name": name,
                    "current": current_profiles,
                    "computed": computed_profiles,
                    "is_mixed": is_mixed,
                    "likely_post_mixed_impact": result["likely_post_mixed_impact"],
                    "reason": result["reason"],
                })
        elif st == "MISSING":
            stats["missing_count"] += 1
            if is_mixed:
                stats["mixed_missing_count"] += 1
        elif st == "INVALID_SCHEMA":
            stats["schema_invalid_count"] += 1
        elif st == "SKIPPED":
            stats["skipped_count"] += 1
            hamco_status = result["reason"]

        # Console output per fund
        flag = {
            "MATCH": "  OK   ",
            "MISSING": "MISSING",
            "STALE": " STALE ",
            "INVALID_SCHEMA": "INVALID",
            "SKIPPED": "SKIPPED",
        }.get(st, "  ???  ")
        print(f"  [{flag}] {isin} | {name[:40]:<40} | computed={computed_profiles}")

    # Sort: STALE first, then MISSING, then INVALID, then MATCH, SKIPPED last
    _order = {"STALE": 0, "MISSING": 1, "INVALID_SCHEMA": 2, "MATCH": 3, "SKIPPED": 4}
    per_fund_results.sort(key=lambda r: (_order.get(r["status"], 9), r["isin"]))

    # Determine overall recommendation
    stale_or_missing = stats["stale_count"] + stats["missing_count"]
    if stale_or_missing == 0:
        recommendation = "NO_ACTION_REQUIRED"
        recommendation_detail = (
            "All compatible_profiles values are current and correct, or the field is "
            "absent from all funds (meaning frontend falls through to rule-based check)."
        )
    elif stats["with_compatible_profiles"] == 0:
        recommendation = "COMPATIBLE_PROFILES_NOT_USED_IN_PROD"
        recommendation_detail = (
            "Field compatible_profiles is absent from all funds_v3 documents. "
            "The frontend falls through to rule-based isFundSuitableForProfile(). "
            "No stale risk. Regen write gate optional."
        )
    elif stats["stale_count"] > 0:
        recommendation = "REGEN_WRITE_GATE_NEEDED"
        recommendation_detail = (
            f"{stats['stale_count']} fund(s) have stale compatible_profiles (stored != computed). "
            f"Of these, {stats['mixed_stale_count']} are MIXED funds likely affected by the MIXED "
            f"exposure remediation (gates 1-8, May 2026). "
            "Next: BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0 with explicit diff manifest approval."
        )
    else:
        recommendation = "REGEN_WRITE_GATE_NEEDED"
        recommendation_detail = (
            f"{stats['missing_count']} fund(s) lack compatible_profiles. "
            "Frontend uses rule-based fallback for these. "
            "Regen write gate optional but recommended for UI consistency."
        )

    artifact = {
        "audit_id": "BDB-COMPATIBLE-PROFILES-REGEN-DRY-RUN-0",
        "generated_at": generated_at,
        "dry_run": True,
        "write_executed": False,
        "firestore_read_executed": True,
        "firestore_write_executed": False,
        "deploy_executed": False,
        "core_modified": False,
        "suitability_engine_modified": False,
        "frontend_modified": False,
        "suitability_engine_version": "d565abb",
        "suitability_profiles_evaluated": ALL_PROFILES,
        "stats": stats,
        "hamco_status": hamco_status or f"Fund {HAMCO_ISIN} not found in funds_v3",
        "top_stale_examples": top_stale_examples,
        "recommendation": recommendation,
        "recommendation_detail": recommendation_detail,
        "per_fund_results": per_fund_results,
        "forbidden_contexts": {
            "firestore_write_executed": False,
            "deploy_executed": False,
            "core_used": False,
            "optimizer_modified": False,
            "suitability_modified": False,
            "frontend_modified": False,
            "migrate_suitability_v2_executed": False,
        },
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_PATH.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    # ─── Summary ──────────────────────────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print("  DRY-RUN COMPLETE — NO FIRESTORE WRITES EXECUTED")
    print(f"{'=' * 70}")
    print(f"  Total funds scanned:       {stats['total_funds_scanned']}")
    print(f"  With compatible_profiles:  {stats['with_compatible_profiles']}")
    print(f"  Without:                   {stats['without_compatible_profiles']}")
    print(f"  MATCH:                     {stats['matching_count']}")
    print(f"  STALE:                     {stats['stale_count']}")
    print(f"  MISSING:                   {stats['missing_count']}")
    print(f"  INVALID schema:            {stats['schema_invalid_count']}")
    print(f"  SKIPPED (Hamco):           {stats['skipped_count']}")
    print(f"  ---")
    print(f"  MIXED total:               {stats['mixed_total']}")
    print(f"  MIXED stale:               {stats['mixed_stale_count']}")
    print(f"  MIXED missing:             {stats['mixed_missing_count']}")
    print(f"\n  Recommendation: {recommendation}")
    print(f"  {recommendation_detail}")
    print(f"\n  write_executed:            False")
    print(f"  Artifact saved to:         {ARTIFACT_PATH}")
    print(f"{'=' * 70}\n")

    return artifact


if __name__ == "__main__":
    main()

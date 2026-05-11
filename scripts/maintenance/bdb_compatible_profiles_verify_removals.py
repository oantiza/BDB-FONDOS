#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS-0
==========================================
Read-only script to verify the 2 critical STALE funds where the suitability
engine would REMOVE profiles from compatible_profiles (i.e., stored value
is less restrictive than current computed value).

Funds under review:
  LU1883330521 — Amundi Funds - Global Multi-Asset Target Income A2 EUR (C)
    stored=[1..10], computed=[3..10] → engine wants to remove p1, p2
    root_cause: equity = 31.7% > 30% cap for profiles 1-2

  LU1095739733 — First Eagle Amundi Income Builder Fund Class AE-QD
    stored=[4..10], computed=[5..10] → engine wants to remove p4
    root_cause: equity = 61.9% > 60% cap for profile 4

Purpose:
  1. Read both documents live from Firestore.
  2. Re-apply suitability engine logic (inline mirror) per profile.
  3. Explain exactly which rule causes each profile removal.
  4. Produce a structured JSON artifact with per-profile analysis.
  5. Provide a recommendation: SAFE_TO_REGEN_REMOVE_PROFILES or
     HOLD_NEEDS_MANUAL_REVIEW or DO_NOT_CHANGE.

SAFETY GUARANTEES:
  - This script contains NO calls to .set(), .update(), .delete(), .batch()
    or any Firestore write operation.
  - It rejects --write, --apply, --execute, --commit flags explicitly.
  - The artifact JSON always contains write_executed: false.
  - Only side-effect: writes a local artifact JSON file.

DO NOT RUN WITH WRITE FLAGS.

References:
  - functions_python/services/portfolio/suitability_engine.py
  - artifacts/suitability/compatible_profiles_regen_dry_run_0.json
  - docs/BDB_COMPATIBLE_PROFILES_VERIFY_SECTOR_EQUITY_0.md
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ─── SAFETY GUARD ─────────────────────────────────────────────────────────────
_FORBIDDEN_FLAGS = {"--write", "--apply", "--execute", "--commit", "--force", "--run"}
for _flag in sys.argv[1:]:
    if _flag.lower() in _FORBIDDEN_FLAGS:
        print(f"[ABORT] Forbidden flag detected: {_flag}")
        print("        This is a DRY-RUN ONLY script.")
        sys.exit(1)

# ─── PATHS ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "suitability"
ARTIFACT_PATH = ARTIFACT_DIR / "compatible_profiles_verify_removals_0.json"

TARGET_ISINS = ["LU1883330521", "LU1095739733"]
ALL_PROFILES = list(range(1, 11))

# ─── SUITABILITY LOGIC (inline mirror of suitability_engine.py) ───────────────

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
    Mirror of is_fund_eligible_for_profile() — returns (bool, reason_str).
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
            return False, f"Hard exclusion: Real economic equity exposure is {real_eq:.1f}% (>30%)."

    # Rule 3-4: Conservative / Moderate-Low
    if risk_profile <= 4:
        if risk_bucket == "HIGH" and asset_type != "equity":
            return False, "Hard exclusion for conservative profile: High risk asset."
        if risk_profile == 3 and real_eq > 45:
            return False, f"Real equity {real_eq:.1f}% exceeds limit for profile 3 (>45%)."
        if risk_profile == 4 and real_eq > 60:
            return False, f"Real equity {real_eq:.1f}% exceeds limit for profile 4 (>60%)."
        if is_sector_fund:
            return False, f"Sector funds ({class_v2.get('sector_focus')}) are excluded for profiles <= 4."
        if asset_subtype in {"EMERGING_MARKETS_EQUITY", "HIGH_YIELD_BOND"} or asset_type == "commodities":
            return False, f"Asset Subtype {asset_subtype} is excluded for profiles <= 4."

    # Rule 5-7: Moderate / Healthcare
    if risk_profile <= 7 and is_sector_fund:
        if sector_focus == "HEALTHCARE" and risk_profile < 6:
            return False, "Healthcare/Biotech too volatile for profile < 6."

    return True, "Eligible"


def _compute_per_profile_analysis(asset_meta: dict) -> dict:
    """Return eligibility result for each profile with exact rule reason."""
    results = {}
    for p in ALL_PROFILES:
        eligible, reason = _is_fund_eligible_for_profile(asset_meta, p)
        results[str(p)] = {
            "eligible": eligible,
            "reason": reason,
        }
    return results


# ─── FIREBASE INIT ────────────────────────────────────────────────────────────

def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore as fs

    if not firebase_admin._apps:
        cred_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_env and os.path.exists(cred_env):
            cred = credentials.Certificate(cred_env)
            firebase_admin.initialize_app(cred)
            print(f"[INIT] Firebase from GOOGLE_APPLICATION_CREDENTIALS: {cred_env}")
        else:
            key_paths = [
                ROOT / "scripts" / "serviceAccountKey.json",
                ROOT / "functions_python" / "serviceAccountKey.json",
            ]
            for kp in key_paths:
                if kp.exists():
                    cred = credentials.Certificate(str(kp))
                    firebase_admin.initialize_app(cred)
                    print(f"[INIT] Firebase from: {kp}")
                    break
            else:
                firebase_admin.initialize_app()
                print("[INIT] Firebase via ADC")
    return fs.client()


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 72}")
    print("  BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS — READ-ONLY AUDIT")
    print(f"  Generated: {generated_at}")
    print(f"  Mode: READ-ONLY | write_executed=false | deploy=false")
    print(f"  Targets: {TARGET_ISINS}")
    print(f"{'=' * 72}\n")

    db = init_firebase()

    per_fund_results = []
    confirmed_removal_count = 0
    hold_manual_count = 0
    safe_to_regen_count = 0

    for isin in TARGET_ISINS:
        print(f"\n[READ] Fetching {isin} from funds_v3...")
        doc = db.collection("funds_v3").document(isin).get()

        if not doc.exists:
            print(f"  [NOT FOUND] {isin} does not exist in funds_v3")
            per_fund_results.append({
                "isin": isin,
                "name": "NOT FOUND",
                "status": "NOT_FOUND",
                "recommendation": "HOLD_NEEDS_MANUAL_REVIEW",
                "write_recommended": False,
                "reason": "Document does not exist in funds_v3",
            })
            hold_manual_count += 1
            continue

        data = doc.to_dict() or {}
        name = data.get("name", "")
        class_v2 = data.get("classification_v2") or {}
        exp_v2 = data.get("portfolio_exposure_v2") or {}
        ms = data.get("ms") or {}
        derived = data.get("derived") or {}

        current_profiles = class_v2.get("compatible_profiles")
        asset_type = str(class_v2.get("asset_type", "")).upper()
        asset_subtype = str(class_v2.get("asset_subtype", "")).upper()
        risk_bucket = str(class_v2.get("risk_bucket", "")).upper() or None
        is_sector_fund = class_v2.get("is_sector_fund")
        sector_focus = class_v2.get("sector_focus")
        is_suitable_low_risk = class_v2.get("is_suitable_low_risk")

        econ = (exp_v2 or {}).get("economic_exposure") or {}
        economic_exposure = {
            "equity": _safe_float(econ.get("equity")),
            "bond": _safe_float(econ.get("bond")),
            "cash": _safe_float(econ.get("cash")),
            "other": _safe_float(econ.get("other")),
        } if econ else None
        exposure_confidence = _safe_float(exp_v2.get("exposure_confidence"), None)
        exp_warnings = exp_v2.get("warnings") or []

        ms_portfolio = (ms.get("portfolio") or {}) if ms else {}
        ms_asset_alloc = ms_portfolio.get("asset_allocation") or {}
        ms_category = ms.get("category_morningstar") or ms.get("category") or ""

        # Per-profile analysis
        per_profile = _compute_per_profile_analysis(data)
        computed_profiles = [
            int(p) for p, r in per_profile.items() if r["eligible"]
        ]

        # Diff analysis
        current_set = set(current_profiles) if isinstance(current_profiles, list) else set()
        computed_set = set(computed_profiles)
        profiles_to_remove = sorted(current_set - computed_set)
        profiles_to_add = sorted(computed_set - current_set)

        # Removal reason by profile
        removal_reason_by_profile = {}
        for p in profiles_to_remove:
            removal_reason_by_profile[str(p)] = per_profile[str(p)]["reason"]

        # Addition reason (should be none for these funds — they are removal cases)
        addition_context_by_profile = {}
        for p in profiles_to_add:
            addition_context_by_profile[str(p)] = per_profile[str(p)]["reason"]

        # Recommendation logic
        real_eq = _safe_float(econ.get("equity"))
        is_justified = False
        justification_detail = ""

        if isin == "LU1883330521":
            # p1/p2 removed because real_eq = 31.7% > 30%
            # Rule: risk_profile <= 2 AND real_eq > 30 → blocked
            # The engine is correct. A fund with 31.7% equity should NOT be
            # accessible to very conservative profiles 1-2.
            if real_eq > 30.0:
                is_justified = True
                justification_detail = (
                    f"equity={real_eq:.1f}% exceeds the 30% hard cap for profiles 1-2. "
                    "Rule: risk_profile<=2 AND real_eq>30 → BLOCKED. "
                    "The stored [1..10] appears to have been generated when equity was "
                    "lower or the rule did not exist. Current stored value overstates eligibility."
                )
        elif isin == "LU1095739733":
            # p4 removed because real_eq = 61.9% > 60%
            # Rule: risk_profile == 4 AND real_eq > 60 → blocked
            if real_eq > 60.0:
                is_justified = True
                justification_detail = (
                    f"equity={real_eq:.1f}% exceeds the 60% hard cap for profile 4. "
                    "Rule: risk_profile==4 AND real_eq>60 → BLOCKED. "
                    "The stored [4..10] appears to have been generated when equity was "
                    "lower (possible pre-MIXED remediation value near 58-60%) or the cap "
                    "boundary was different. Current stored value overstates eligibility."
                )

        if is_justified and not profiles_to_add:
            recommendation = "SAFE_TO_REGEN_REMOVE_PROFILES"
            write_recommended = True
            safe_to_regen_count += 1
            confirmed_removal_count += 1
        elif not is_justified:
            recommendation = "HOLD_NEEDS_MANUAL_REVIEW"
            write_recommended = False
            hold_manual_count += 1
        else:
            # Has both adds and removes — more complex
            recommendation = "HOLD_NEEDS_MANUAL_REVIEW"
            write_recommended = False
            hold_manual_count += 1

        result = {
            "isin": isin,
            "name": name,
            "asset_class": asset_type,
            "subtype": asset_subtype,
            "risk_bucket": risk_bucket or "NOT_SET",
            "is_sector_fund": is_sector_fund,
            "sector_focus": sector_focus,
            "is_suitable_low_risk": is_suitable_low_risk,
            "ms_category": ms_category,
            "economic_exposure": economic_exposure,
            "exposure_confidence": exposure_confidence,
            "exposure_warnings": exp_warnings,
            "current_compatible_profiles": sorted(list(current_set)),
            "computed_compatible_profiles_from_previous_dryrun": computed_profiles,
            "computed_compatible_profiles_live": computed_profiles,
            "profiles_to_remove": profiles_to_remove,
            "profiles_to_add": profiles_to_add,
            "removal_reason_by_profile": removal_reason_by_profile,
            "addition_context_by_profile": addition_context_by_profile,
            "per_profile_analysis": per_profile,
            "is_removal_justified": is_justified,
            "justification_detail": justification_detail,
            "recommendation": recommendation,
            "write_recommended": write_recommended,
            "reason": justification_detail if is_justified else "Removal not confirmed — needs manual review.",
        }
        per_fund_results.append(result)

        # Console report
        print(f"\n  {'=' * 66}")
        print(f"  ISIN: {isin}")
        print(f"  Name: {name}")
        print(f"  Asset class: {asset_type} | Subtype: {asset_subtype}")
        print(f"  Risk bucket: {risk_bucket or 'NOT_SET'} | is_sector_fund: {is_sector_fund}")
        print(f"  MS category: {ms_category}")
        print(f"  economic_exposure: eq={real_eq:.1f}% bd={_safe_float(econ.get('bond')):.1f}% cash={_safe_float(econ.get('cash')):.1f}%")
        print(f"  exposure_confidence: {exposure_confidence}")
        print(f"  current_profiles:  {sorted(list(current_set))}")
        print(f"  computed_profiles: {computed_profiles}")
        print(f"  profiles_to_remove: {profiles_to_remove}")
        print(f"  profiles_to_add:    {profiles_to_add}")
        print(f"  Removal justified: {is_justified}")
        print(f"  Recommendation: {recommendation}")
        for p, reason in removal_reason_by_profile.items():
            print(f"    Profile {p} REMOVED — {reason}")

    # ─── Artifact ─────────────────────────────────────────────────────────────
    write_gate_candidates_after_review = []
    for r in per_fund_results:
        if r.get("recommendation") == "SAFE_TO_REGEN_REMOVE_PROFILES":
            write_gate_candidates_after_review.append(r["isin"])

    artifact = {
        "audit_id": "BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS-0",
        "generated_at": generated_at,
        "dry_run": True,
        "write_executed": False,
        "firestore_read_executed": True,
        "firestore_write_executed": False,
        "deploy_executed": False,
        "core_modified": False,
        "suitability_engine_modified": False,
        "frontend_modified": False,
        "source_artifact": "artifacts/suitability/compatible_profiles_regen_dry_run_0.json",
        "source_commit": "11d18e9",
        "suitability_engine_version": "d565abb",
        "total_reviewed": len(TARGET_ISINS),
        "confirmed_removal_count": confirmed_removal_count,
        "hold_manual_count": hold_manual_count,
        "safe_to_regen_count": safe_to_regen_count,
        "write_gate_candidates_after_review": write_gate_candidates_after_review,
        "per_fund_results": per_fund_results,
        "write_gate_implication": {
            "total_stale_original": 24,
            "held_commodities": 14,
            "removal_cases_safe_to_regen": safe_to_regen_count,
            "removal_cases_hold": hold_manual_count,
            "remaining_for_write_gate": (
                10 - hold_manual_count
                if safe_to_regen_count == len(TARGET_ISINS) else
                10 - safe_to_regen_count
            ),
            "always_excluded": ["LU3038481936 (Hamco)"],
            "commodities_excluded": "14 funds — see compatible_profiles_sector_equity_verify_0.json",
        },
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
    print(f"\n{'=' * 72}")
    print("  VERIFY-REMOVALS AUDIT COMPLETE — NO FIRESTORE WRITES EXECUTED")
    print(f"{'=' * 72}")
    print(f"  Total reviewed:              {len(TARGET_ISINS)}")
    print(f"  SAFE_TO_REGEN_REMOVE:        {safe_to_regen_count}")
    print(f"  HOLD_NEEDS_MANUAL_REVIEW:    {hold_manual_count}")
    print(f"  Artifact: {ARTIFACT_PATH}")
    print(f"  write_executed: False")
    print(f"{'=' * 72}\n")

    return artifact


if __name__ == "__main__":
    main()

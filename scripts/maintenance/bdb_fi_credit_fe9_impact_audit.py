#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-FI-CREDIT-FE9-IMPACT-AUDIT-0
==================================
Read-only audit of the 7 funds flagged as FE9_POTENTIAL_NEW_GAP after populating
portfolio_exposure_v2.fi_credit in BDB-FI-CREDIT-TRANSLATOR-WRITE-CONTROLLED-0.

For each fund, computes impact metrics and classifies as:
  HARD_BLOCK_CANDIDATE     - clearly unsuitable for profile <=4, no other protection
  SOFT_WARNING_CANDIDATE   - marginal LQ, already has partial protection or context
  NO_ACTION_CANDIDATE      - already covered by existing rules or LQ within context
  NEEDS_MANUAL_FACTSHEET   - data insufficient, factsheet required before deciding

WRITE GUARD: NO writes, NO deploys, NO production code changes.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Write guard
FORBIDDEN_FLAGS = {"--write", "--apply", "--execute", "--commit"}
if FORBIDDEN_FLAGS & set(sys.argv[1:]):
    print("[ABORT] Forbidden flag detected. This script is READ-ONLY.")
    sys.exit(1)

ROOT         = Path(__file__).resolve().parents[2]
PRE_WRITE    = ROOT / "artifacts" / "suitability" / "fi_credit_translator_dryrun_0_PRE_WRITE.json"
ARTIFACT_OUT = ROOT / "artifacts" / "suitability" / "fi_credit_fe9_impact_audit_0.json"
COLLECTION   = "funds_v3"
AUDIT_ID     = "BDB-FI-CREDIT-FE9-IMPACT-AUDIT-0"

# Subtypes already fully covered by Rule 10 (qualitative block, no need for FE-9)
HY_EM_BLOCKED_SUBTYPES = {
    "HIGH_YIELD_BOND", "EMERGING_MARKETS_BOND", "EMERGING_MARKETS_EQUITY"
}

# Profile threshold for FE-9 (profiles <= this would be blocked)
FE9_PROFILE_THRESHOLD = 4
FE9_LQ_THRESHOLD      = 35.0

# Classification thresholds for recommendation
LQ_HARD_BLOCK_MIN       = 50.0   # lq >= 50% on bond bucket => likely HARD_BLOCK
LQ_SOFT_WARNING_MIN     = 35.0   # lq in [35,50) => evaluate context
NOT_RATED_HIGH_MIN      = 20.0   # high not_rated adds uncertainty

# Average quality ratings -> ordinal mapping (higher = worse credit)
AVG_QUALITY_ORDER = {
    "AAA": 1, "AA+": 2, "AA": 3, "AA-": 4,
    "A+": 5, "A": 6, "A-": 7,
    "BBB+": 8, "BBB": 9, "BBB-": 10,
    "BB+": 11, "BB": 12, "BB-": 13,
    "B+": 14, "B": 15, "B-": 16,
    "CCC": 17, "CC": 18, "C": 19, "D": 20,
    "NR": 21,
}


def _safe_float(v, default: float = 0.0) -> float:
    try:
        return default if v is None else float(v)
    except Exception:
        return default


def _safe_dict(v) -> dict:
    return v if isinstance(v, dict) else {}


def _safe_list(v) -> list:
    return v if isinstance(v, list) else []


def _get_nested(d, *keys):
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(k)
    return cur


def _profiles_affected(compatible_profiles: list) -> list:
    """Return profiles that would be blocked by FE-9 (<=4)."""
    return [p for p in _safe_list(compatible_profiles) if isinstance(p, int) and p <= FE9_PROFILE_THRESHOLD]


def _classify_recommendation(lq_bond: float, lq_tp: float, not_rated: float,
                               ig: float, avg_quality: str, subtype: str,
                               affected_profiles: list, has_factsheet_data: bool) -> tuple[str, str]:
    """
    Returns (recommendation, reason) based on fi_credit metrics and context.
    """
    if subtype in HY_EM_BLOCKED_SUBTYPES:
        return ("NO_ACTION_CANDIDATE",
                f"Subtype {subtype} already blocked by Rule 10 (HY/EM qualitative rule). FE-9 redundant.")

    if not has_factsheet_data and lq_bond >= 80.0:
        return ("NEEDS_MANUAL_FACTSHEET",
                f"lq_bond={lq_bond:.1f}% is very high but subtype={subtype}. "
                "Verify fund name/prospectus to confirm this is truly unsuitable for profile <=4.")

    aq_rank = AVG_QUALITY_ORDER.get(avg_quality or "", 0)
    is_sub_ig_avg = aq_rank >= AVG_QUALITY_ORDER.get("BB+", 11)  # avg quality is sub-IG
    is_borderline_ig = ig >= 30.0  # still has significant IG component

    # High LQ + sub-IG avg quality => hard block candidate
    if lq_bond >= LQ_HARD_BLOCK_MIN and is_sub_ig_avg:
        reason = (
            f"lq_bond={lq_bond:.1f}%, avg_quality={avg_quality} (sub-investment-grade average). "
            f"lq_total_portfolio={lq_tp:.1f}%. "
            f"Profiles affected if hard block <=4: {affected_profiles}. "
            "Fund carries predominantly sub-IG credit risk — hard block for conservative profiles is appropriate."
        )
        return ("HARD_BLOCK_CANDIDATE", reason)

    # High LQ but significant IG component and avg quality not confirmed sub-IG
    if lq_bond >= LQ_HARD_BLOCK_MIN and is_borderline_ig and not is_sub_ig_avg:
        reason = (
            f"lq_bond={lq_bond:.1f}% but ig={ig:.1f}% present; avg_quality={avg_quality}. "
            "Crossover/blended fund — context matters. "
            "Soft warning preferred; factsheet may clarify risk profile."
        )
        return ("SOFT_WARNING_CANDIDATE", reason)

    # LQ in [35,50) => borderline, evaluate context
    if LQ_SOFT_WARNING_MIN <= lq_bond < LQ_HARD_BLOCK_MIN:
        if ig >= 50.0:
            reason = (
                f"lq_bond={lq_bond:.1f}% but investment_grade={ig:.1f}% dominates. "
                "Crossover fund — sub-IG is secondary. Soft warning adequate, not hard block."
            )
            return ("SOFT_WARNING_CANDIDATE", reason)
        else:
            reason = (
                f"lq_bond={lq_bond:.1f}% without IG majority (ig={ig:.1f}%). "
                "Borderline case — soft warning for profile <=4, review factsheet for confirmation."
            )
            return ("SOFT_WARNING_CANDIDATE", reason)

    return ("NO_ACTION_CANDIDATE",
            f"lq_bond={lq_bond:.1f}% is below threshold or context excludes action.")


def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore as fs
    if not firebase_admin._apps:
        cred_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_env and os.path.exists(cred_env):
            cred = credentials.Certificate(cred_env)
            firebase_admin.initialize_app(cred)
            print("[INIT] Firebase from GOOGLE_APPLICATION_CREDENTIALS")
        else:
            firebase_admin.initialize_app()
            print("[INIT] Firebase from application default credentials")
    return fs.client()


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 72}")
    print(f"  {AUDIT_ID}")
    print(f"  READ-ONLY audit — NO Firestore writes — NO deploy")
    print(f"  Generated at: {generated_at}")
    print(f"{'=' * 72}\n")

    # Load pre-write artifact to get the 7 FE9_POTENTIAL_NEW_GAP funds
    if not PRE_WRITE.exists():
        print(f"[ERROR] Pre-write artifact not found: {PRE_WRITE}")
        sys.exit(1)

    pre_write_data = json.loads(PRE_WRITE.read_text(encoding="utf-8"))
    gap_records = [r for r in pre_write_data.get("per_fund_results", [])
                   if "FE9_POTENTIAL_NEW_GAP" in r.get("warnings", [])]
    gap_isins = [r["isin"] for r in gap_records]

    print(f"[LOAD] Found {len(gap_records)} FE9_POTENTIAL_NEW_GAP funds from pre-write artifact")
    for r in gap_records:
        p = r.get("proposed_fi_credit") or {}
        print(f"  {r['isin']} | lq={p.get('low_quality','?')}% | {r.get('name','')[:55]}")
    print()

    # Fetch live data for these funds
    db = init_firebase()
    print(f"[SNAPSHOT] Fetching live data for {len(gap_isins)} funds...")

    per_fund_results = []
    hard_block_count = 0
    soft_warning_count = 0
    no_action_count = 0
    needs_manual_count = 0

    for isin in gap_isins:
        doc = db.collection(COLLECTION).document(isin).get()
        if not doc.exists:
            print(f"  [WARN] {isin} not found in Firestore")
            continue

        data = doc.to_dict() or {}
        class_v2  = _safe_dict(data.get("classification_v2"))
        pev2      = _safe_dict(data.get("portfolio_exposure_v2"))
        ms        = _safe_dict(data.get("ms"))
        ms_fi     = _safe_dict(ms.get("fixed_income"))
        std_perf  = _safe_dict(data.get("std_perf"))

        # Classification fields
        asset_class = class_v2.get("asset_type") or class_v2.get("asset_class", "")
        subtype     = class_v2.get("asset_subtype") or ""
        cp          = _safe_list(class_v2.get("compatible_profiles"))
        risk_bucket = class_v2.get("risk_bucket")
        fi_bucket   = class_v2.get("fi_credit_bucket")

        # Portfolio exposure
        fi_credit   = _safe_dict(pev2.get("fi_credit"))
        eco         = _safe_dict(pev2.get("economic_exposure"))
        exp_conf    = pev2.get("exposure_confidence")

        lq_bond = _safe_float(fi_credit.get("low_quality"))
        ig      = _safe_float(fi_credit.get("investment_grade"))
        nr      = _safe_float(fi_credit.get("not_rated"))
        cov     = _safe_float(fi_credit.get("coverage"))

        # Bond weight from economic exposure
        bond_wt = None
        for bk in ("bond", "bonds", "fixed_income"):
            bv = eco.get(bk)
            if bv is not None:
                b = _safe_float(bv)
                bond_wt = round(b if b > 1.5 else b * 100.0, 2)
                break

        lq_tp = round(lq_bond * (bond_wt or 100.0) / 100.0, 2)

        # Morningstar fields
        avg_quality   = ms_fi.get("average_credit_quality")
        ms_category   = ms.get("category_morningstar")
        ms_cq         = _safe_dict(ms_fi.get("credit_quality"))

        # Affected profiles
        affected = _profiles_affected(cp)

        # Classify recommendation
        has_factsheet = False  # no factsheet data in Firestore
        rec, reason = _classify_recommendation(
            lq_bond=lq_bond, lq_tp=lq_tp, not_rated=nr,
            ig=ig, avg_quality=avg_quality or "",
            subtype=subtype, affected_profiles=affected,
            has_factsheet_data=has_factsheet
        )

        if rec == "HARD_BLOCK_CANDIDATE":
            hard_block_count += 1
        elif rec == "SOFT_WARNING_CANDIDATE":
            soft_warning_count += 1
        elif rec == "NO_ACTION_CANDIDATE":
            no_action_count += 1
        else:
            needs_manual_count += 1

        per_fund_results.append({
            "isin":                               isin,
            "name":                               data.get("name", ""),
            "asset_class":                        asset_class,
            "subtype":                            subtype,
            "compatible_profiles":                cp,
            "affected_profiles_if_hard_block_le4": affected,
            "bond_weight":                        bond_wt or 100.0,
            "low_quality_bond_bucket":            lq_bond,
            "low_quality_total_portfolio_estimate": lq_tp,
            "investment_grade":                   ig,
            "not_rated":                          nr,
            "average_quality":                    avg_quality,
            "fi_credit_bucket":                   fi_bucket,
            "risk_bucket":                        risk_bucket,
            "economic_exposure":                  eco,
            "ms_category":                        ms_category,
            "exposure_confidence":                exp_conf,
            "fi_credit":                          fi_credit,
            "recommendation":                     rec,
            "reason":                             reason,
            "write_recommended":                  False,
            "fe9_activation":                     False,
        })

        print(f"  {isin} | lq={lq_bond:.1f}%  ig={ig:.1f}%  nr={nr:.1f}%"
              f" | avg_q={avg_quality} | rec={rec}")

    # Compose artifact
    artifact = {
        "audit_id":                    AUDIT_ID,
        "generated_at":                generated_at,
        "dry_run":                     True,
        "write_executed":              False,
        "fe9_activation":              False,
        "deploy_executed":             False,
        "collection":                  COLLECTION,
        "source_artifact":             str(PRE_WRITE.relative_to(ROOT)),
        "total_scanned":               len(gap_isins),
        "potential_gap_count":         len(gap_records),
        "hard_block_candidate_count":  hard_block_count,
        "soft_warning_candidate_count": soft_warning_count,
        "no_action_candidate_count":   no_action_count,
        "needs_manual_factsheet_count": needs_manual_count,
        "per_fund_results":            per_fund_results,
    }

    ARTIFACT_OUT.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT_OUT.write_text(json.dumps(artifact, ensure_ascii=False, indent=2, default=str),
                            encoding="utf-8")

    # Summary
    print(f"\n{'=' * 72}")
    print(f"  FE9 IMPACT AUDIT RESULTS")
    print(f"{'=' * 72}")
    print(f"  Total FE9_POTENTIAL_NEW_GAP funds:  {len(gap_records)}")
    print(f"  HARD_BLOCK_CANDIDATE:               {hard_block_count}")
    print(f"  SOFT_WARNING_CANDIDATE:             {soft_warning_count}")
    print(f"  NO_ACTION_CANDIDATE:                {no_action_count}")
    print(f"  NEEDS_MANUAL_FACTSHEET:             {needs_manual_count}")
    print(f"")
    print(f"  write_executed:  false")
    print(f"  fe9_activation:  false")
    print(f"  deploy_executed: false")
    print(f"")
    print(f"  Artifact: {ARTIFACT_OUT}")
    print(f"{'=' * 72}\n")

    return artifact


if __name__ == "__main__":
    main()

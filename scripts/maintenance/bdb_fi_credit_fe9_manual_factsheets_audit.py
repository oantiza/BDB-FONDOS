#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-FI-CREDIT-FE9-MANUAL-FACTSHEETS-0
=======================================
Read-only audit for the 3 funds requiring manual review:

  LU1919971074 — abrdn Frontier Markets Bond      (NEEDS_MANUAL_FACTSHEET, lq=86.9%)
  LU2002383896 — Allianz Credit Opportunities Plus (NEEDS_MANUAL_FACTSHEET, lq=83.9%)
  LU0151324935 — Candriam Bonds Credit Opport.    (NO_ACTION / subtype review, lq=79.4%)

Reads live Firestore snapshot for each fund and computes:
  - fi_credit metrics (lq, ig, nr, coverage)
  - bond_weight from economic_exposure
  - lq_total_portfolio_estimate
  - ms fields (category, credit_quality, average_credit_quality)
  - classification data (subtype, compatible_profiles, risk_bucket)

WRITE GUARD: NO writes, NO deploys, NO production code changes.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Write guard ───────────────────────────────────────────────────────────────
FORBIDDEN_FLAGS = {"--write", "--apply", "--execute", "--commit"}
if FORBIDDEN_FLAGS & set(sys.argv[1:]):
    print("[ABORT] Forbidden flag detected. This script is READ-ONLY.")
    sys.exit(1)

ROOT         = Path(__file__).resolve().parents[2]
ARTIFACT_OUT = ROOT / "artifacts" / "suitability" / "fi_credit_fe9_manual_factsheets_audit_0.json"
COLLECTION   = "funds_v3"
AUDIT_ID     = "BDB-FI-CREDIT-FE9-MANUAL-FACTSHEETS-0"

# The 3 ISINs under review
TARGET_ISINS = {
    "LU1919971074": "NEEDS_MANUAL_FACTSHEET",
    "LU2002383896": "NEEDS_MANUAL_FACTSHEET",
    "LU0151324935": "NO_ACTION_SUBTYPE_REVIEW",
}

# Subtypes that would be covered by Rule 10 (HY/EM) if reclassified
RULE10_SUBTYPES = {"HIGH_YIELD_BOND", "EMERGING_MARKETS_BOND", "EMERGING_MARKETS_EQUITY"}


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


def _bond_weight_from_eco(eco: dict) -> float:
    """Estimate bond weight from economic_exposure dict."""
    for key in ("bond", "bonds", "fixed_income", "fi"):
        val = eco.get(key)
        if val is not None:
            f = _safe_float(val)
            return round(f if f > 1.5 else f * 100.0, 2)
    return 100.0  # fallback: assume pure bond fund


def _profiles_le4(cp: list) -> list:
    return [p for p in _safe_list(cp) if isinstance(p, int) and p <= 4]


def _manual_data_needed(isin: str, fi_credit: dict, ms_fi: dict, subtype: str) -> dict:
    avg_q = ms_fi.get("average_credit_quality")
    return {
        "official_factsheet":      True,
        "average_credit_quality":  avg_q is None,
        "duration":                True,   # not in our schema yet
        "volatility":              True,   # not in our schema yet
        "fund_category_confirmed": True,   # Morningstar category vs internal subtype
        "investment_objective":    True,
        "high_yield_or_subordinated_confirmed": subtype not in RULE10_SUBTYPES,
        "frontier_or_em_confirmed": "Frontier" in isin or "Frontier" in subtype,
    }


def _proposed_decision(isin: str, fi_credit: dict, subtype: str, avg_q) -> str:
    """
    Heuristic placeholder decision — NOT a write recommendation.
    This is a suggested starting point for the human reviewer.
    """
    lq = _safe_float(fi_credit.get("low_quality"))
    ig = _safe_float(fi_credit.get("investment_grade"))

    if isin == "LU0151324935":
        # lq=79%, ig=12% — structure similar to HY; probable subtype reclassification
        return "SUBTYPE_REVIEW"

    if avg_q is None:
        # Without average quality we cannot confirm credit profile definitively
        if lq >= 80.0:
            return "NEEDS_FACTSHEET"
        return "WARNING_REVIEW_ONLY"

    return "WARNING_REVIEW_ONLY"


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

    db = init_firebase()
    per_fund_results = []

    for isin, prior_status in TARGET_ISINS.items():
        print(f"[FETCH] {isin} (prior: {prior_status})")
        doc = db.collection(COLLECTION).document(isin).get()
        if not doc.exists:
            print(f"  [WARN] {isin} not found in Firestore")
            per_fund_results.append({"isin": isin, "error": "NOT_FOUND"})
            continue

        data = doc.to_dict() or {}

        # Classification
        class_v2   = _safe_dict(data.get("classification_v2"))
        subtype    = class_v2.get("asset_subtype") or class_v2.get("subtype") or ""
        asset_type = class_v2.get("asset_type") or class_v2.get("asset_class") or ""
        cp         = _safe_list(class_v2.get("compatible_profiles"))
        risk_bkt   = class_v2.get("risk_bucket")
        fi_bkt     = class_v2.get("fi_credit_bucket")

        # Portfolio exposure
        pev2       = _safe_dict(data.get("portfolio_exposure_v2"))
        fi_credit  = _safe_dict(pev2.get("fi_credit"))
        eco        = _safe_dict(pev2.get("economic_exposure"))
        exp_conf   = pev2.get("exposure_confidence")

        lq         = _safe_float(fi_credit.get("low_quality"))
        ig         = _safe_float(fi_credit.get("investment_grade"))
        nr         = _safe_float(fi_credit.get("not_rated"))
        coverage   = _safe_float(fi_credit.get("coverage"))
        scale      = fi_credit.get("scale", "unknown")
        source     = fi_credit.get("source")
        as_of      = fi_credit.get("as_of")

        bond_wt    = _bond_weight_from_eco(eco)
        lq_tp      = round(lq * bond_wt / 100.0, 2)

        # Morningstar
        ms         = _safe_dict(data.get("ms"))
        ms_fi      = _safe_dict(ms.get("fixed_income"))
        avg_q      = ms_fi.get("average_credit_quality")
        ms_cat     = ms.get("category_morningstar")
        ms_cq      = _safe_dict(ms_fi.get("credit_quality"))

        # std_perf (read-only, volatility proxy)
        std_perf   = _safe_dict(data.get("std_perf"))

        # Derived
        affected_le4 = _profiles_le4(cp)
        manual_data  = _manual_data_needed(isin, fi_credit, ms_fi, subtype)
        decision_ph  = _proposed_decision(isin, fi_credit, subtype, avg_q)

        # Print summary line
        print(f"  name:     {data.get('name','')[:65]}")
        print(f"  subtype:  {subtype} | asset: {asset_type}")
        print(f"  ms_cat:   {ms_cat}")
        print(f"  avg_q:    {avg_q}")
        print(f"  lq={lq:.1f}%  ig={ig:.1f}%  nr={nr:.1f}%  coverage={coverage:.2f}")
        print(f"  bond_wt={bond_wt:.0f}%  lq_tp={lq_tp:.1f}%")
        print(f"  profiles: {cp}  =>  affected_le4: {affected_le4}")
        print(f"  decision_placeholder: {decision_ph}")
        print()

        per_fund_results.append({
            "isin":                              isin,
            "name":                              data.get("name", ""),
            "prior_status":                      prior_status,
            "current_subtype":                   subtype,
            "asset_type":                        asset_type,
            "compatible_profiles":               cp,
            "affected_profiles_if_warning_le4":  affected_le4,
            "affected_profiles_if_hard_block_le4": affected_le4,
            "risk_bucket":                       risk_bkt,
            "fi_credit_bucket":                  fi_bkt,
            "fi_credit":                         fi_credit,
            "low_quality_bond_bucket":           lq,
            "investment_grade":                  ig,
            "not_rated":                         nr,
            "coverage":                          coverage,
            "scale":                             scale,
            "source":                            source,
            "as_of":                             as_of,
            "bond_weight":                       bond_wt,
            "low_quality_total_portfolio_estimate": lq_tp,
            "economic_exposure":                 eco,
            "exposure_confidence":               exp_conf,
            "ms_category":                       ms_cat,
            "average_credit_quality":            avg_q,
            "ms_credit_quality_breakdown":       ms_cq,
            "std_perf_keys":                     list(std_perf.keys()) if std_perf else [],
            "manual_data_needed":                manual_data,
            "proposed_decision_placeholder":     decision_ph,
            "write_recommended":                 False,
            "fe9_activation":                    False,
        })

    # Compose artifact
    artifact = {
        "audit_id":         AUDIT_ID,
        "generated_at":     generated_at,
        "dry_run":          True,
        "write_executed":   False,
        "fe9_activation":   False,
        "deploy_executed":  False,
        "collection":       COLLECTION,
        "total_reviewed":   len(per_fund_results),
        "per_fund_results": per_fund_results,
    }

    ARTIFACT_OUT.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT_OUT.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8"
    )

    print(f"{'=' * 72}")
    print(f"  RESULTS")
    print(f"{'=' * 72}")
    print(f"  Total reviewed:   {len(per_fund_results)}")
    print(f"  write_executed:   false")
    print(f"  fe9_activation:   false")
    print(f"  deploy_executed:  false")
    print(f"  Artifact: {ARTIFACT_OUT}")
    print(f"{'=' * 72}\n")


if __name__ == "__main__":
    main()

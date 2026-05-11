#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-FI-CREDIT-PARSER-DISCOVERY-0
=================================
READ-ONLY audit of ms.fixed_income.credit_quality coverage in funds_v3.

Determines:
  - How many funds have quantitative credit quality data from Morningstar
  - Quality / completeness of that data
  - Potential FE-9 impact if portfolio_exposure_v2.fi_credit were populated
  - Whether implementing _build_fi_credit_exposure() is worthwhile

WRITE GUARD: This script performs NO Firestore writes.
Any invocation with --write, --apply, --execute, or --commit is rejected.

Produces:
  artifacts/suitability/fi_credit_parser_discovery_0.json
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Write guard ────────────────────────────────────────────────────────────────
FORBIDDEN_FLAGS = {"--write", "--apply", "--execute", "--commit"}
if FORBIDDEN_FLAGS & set(sys.argv[1:]):
    print("[ABORT] Forbidden flag detected. This script is READ-ONLY.")
    sys.exit(1)

ROOT       = Path(__file__).resolve().parents[2]
ARTIFACT   = ROOT / "artifacts" / "suitability" / "fi_credit_parser_discovery_0.json"
COLLECTION = "funds_v3"

FE9_THRESHOLD   = 35.0   # lowQualityCredit >= 35 → block for profiles <= 4
FE9_MAX_PROFILE = 4

# Credit quality keys as stored in ms.fixed_income.credit_quality
CQ_KEYS = ["aaa", "aa", "a", "bbb", "bb", "b", "below_b", "not_rated"]
IG_KEYS  = ["aaa", "aa", "a", "bbb"]
LQ_KEYS  = ["bb", "b", "below_b"]

# Completeness thresholds
COMPLETE_SUM_MIN  = 80.0   # >= 80% sum → COMPLETE
PARTIAL_SUM_MIN   = 10.0   # 10-80% sum → PARTIAL
INVALID_SUM_MAX   = 200.0  # > 200% sum → probably wrong scale


# ── Firebase init ──────────────────────────────────────────────────────────────

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
            for kp in [
                ROOT / "scripts" / "serviceAccountKey.json",
                ROOT / "functions_python" / "serviceAccountKey.json",
            ]:
                if kp.exists():
                    cred = credentials.Certificate(str(kp))
                    firebase_admin.initialize_app(cred)
                    print(f"[INIT] Firebase from {kp.name}")
                    break
            else:
                firebase_admin.initialize_app()
                print("[INIT] Firebase from application default credentials")
    return fs.client()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe_float(v, default=0.0):
    try:
        if v is None or v == "":
            return default
        return float(v)
    except Exception:
        return default


def _safe_dict(v):
    return v if isinstance(v, dict) else {}


def _get_nested(d, *keys):
    """Traverse nested dicts safely."""
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(k)
    return cur


def _classify_credit_quality(cq: dict) -> tuple[str, float, float, float, float, float]:
    """
    Returns (status, sum_total, investment_grade, low_quality, not_rated, high_yield).
    status: COMPLETE | PARTIAL | INVALID_SUM | EMPTY
    """
    if not cq:
        return "EMPTY", 0.0, 0.0, 0.0, 0.0, 0.0

    vals = {k: _safe_float(cq.get(k, 0)) for k in CQ_KEYS}
    total = sum(vals.values())
    ig    = sum(vals[k] for k in IG_KEYS)
    lq    = sum(vals[k] for k in LQ_KEYS)
    nr    = vals["not_rated"]
    hy    = lq  # alias

    if total <= 0:
        return "EMPTY", 0.0, 0.0, 0.0, 0.0, 0.0
    if total > INVALID_SUM_MAX:
        return "INVALID_SUM", total, ig, lq, nr, hy
    if total >= COMPLETE_SUM_MIN:
        return "COMPLETE", total, ig, lq, nr, hy
    if total >= PARTIAL_SUM_MIN:
        return "PARTIAL", total, ig, lq, nr, hy
    return "PARTIAL", total, ig, lq, nr, hy


def _get_compatible_profiles(doc_data: dict) -> list[int]:
    class_v2 = _safe_dict(doc_data.get("classification_v2"))
    cp = class_v2.get("compatible_profiles", [])
    return sorted(int(x) for x in cp) if cp else []


def _has_profile_le4(compatible_profiles: list[int]) -> bool:
    return any(p <= FE9_MAX_PROFILE for p in compatible_profiles)


def _get_bond_weight(doc_data: dict) -> float | None:
    """
    Try to extract bond weight (0-100 scale) from economic_exposure.
    Falls back to asset_mix.bond (0-1 scale * 100).
    """
    eco = _get_nested(doc_data, "portfolio_exposure_v2", "economic_exposure")
    if isinstance(eco, dict):
        bond = eco.get("bond") or eco.get("bonds") or eco.get("fixed_income")
        if bond is not None:
            b = _safe_float(bond)
            # economic_exposure is 0-100 scale
            if b > 1.5:
                return b
            if b > 0:
                return b * 100.0

    # Fallback: asset_mix (0-1 scale)
    asset_mix = _get_nested(doc_data, "portfolio_exposure_v2", "asset_mix")
    if isinstance(asset_mix, dict):
        bond = asset_mix.get("bond") or asset_mix.get("bonds") or asset_mix.get("fixed_income")
        if bond is not None:
            b = _safe_float(bond)
            if b > 1.5:
                return b  # already percent
            return b * 100.0

    # Fallback: metrics
    metrics = _safe_dict(doc_data.get("metrics"))
    bond = metrics.get("bond")
    if bond is not None:
        return _safe_float(bond)

    return None


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 72}")
    print(f"  BDB-FI-CREDIT-PARSER-DISCOVERY-0")
    print(f"  READ-ONLY - NO writes - NO deploy")
    print(f"  Generated at: {generated_at}")
    print(f"{'=' * 72}\n")

    db = init_firebase()

    total_scanned        = 0
    per_fund_results     = []

    # Counters
    cnt_has_credit_quality   = 0
    cnt_missing_credit_quality = 0
    cnt_complete             = 0
    cnt_partial              = 0
    cnt_invalid_sum          = 0
    cnt_has_fi_credit_already = 0
    cnt_bucket_only          = 0
    cnt_fe9_bond_bucket_over35 = 0
    cnt_fe9_total_portfolio_over35 = 0

    top_low_quality_examples = []   # funds with highest low_quality

    print(f"[SCAN] Reading {COLLECTION}...")
    docs = db.collection(COLLECTION).stream()

    for doc in docs:
        total_scanned += 1
        data = doc.to_dict() or {}
        isin = doc.id
        name = data.get("name", "")

        # ── Classification V2 ────────────────────────────────────────────────
        class_v2   = _safe_dict(data.get("classification_v2"))
        asset_type = class_v2.get("asset_type", "UNKNOWN")
        asset_sub  = class_v2.get("asset_subtype", "UNKNOWN")
        fi_bucket  = class_v2.get("fi_credit_bucket", None)

        # ── Morningstar fixed income credit quality ───────────────────────────
        ms        = _safe_dict(data.get("ms"))
        ms_fi     = _safe_dict(ms.get("fixed_income"))
        cq_raw    = ms_fi.get("credit_quality")
        cq        = _safe_dict(cq_raw)

        # avg quality string
        avg_cq_str = ms_fi.get("avg_credit_quality") or ms_fi.get("average_credit_quality")

        # ── portfolio_exposure_v2 checks ──────────────────────────────────────
        pev2 = _safe_dict(data.get("portfolio_exposure_v2"))
        has_pev2_fi_credit = (
            isinstance(pev2.get("fi_credit"), dict)
            and pev2["fi_credit"].get("low_quality") is not None
        )
        has_pev2_credit = (
            isinstance(pev2.get("credit"), dict)
            and pev2["credit"].get("low_quality") is not None
        )
        has_fi_credit_field = has_pev2_fi_credit or has_pev2_credit

        # ── Classify credit quality data ─────────────────────────────────────
        status_cq, sum_total, ig, lq, nr, hy = _classify_credit_quality(cq)

        has_ms_credit_quality = (status_cq not in ("EMPTY",))

        # ── Bond weight ───────────────────────────────────────────────────────
        bond_weight = _get_bond_weight(data)

        # ── FE-9 potential impact ─────────────────────────────────────────────
        cp = _get_compatible_profiles(data)
        has_p_le4 = _has_profile_le4(cp)

        fe9_bond_bucket_over35 = False
        fe9_total_portfolio_over35 = False
        lq_total_portfolio_estimate = None

        if has_ms_credit_quality and status_cq not in ("INVALID_SUM",):
            if lq >= FE9_THRESHOLD:
                fe9_bond_bucket_over35 = True

            if bond_weight is not None and bond_weight > 0:
                lq_total_portfolio_estimate = round(lq * bond_weight / 100.0, 2)
                if lq_total_portfolio_estimate >= FE9_THRESHOLD:
                    fe9_total_portfolio_over35 = True

        # ── Status classification ─────────────────────────────────────────────
        if has_fi_credit_field:
            fund_status = "HAS_FI_CREDIT_ALREADY"
            cnt_has_fi_credit_already += 1
        elif has_ms_credit_quality:
            if status_cq == "COMPLETE":
                fund_status = "HAS_COMPLETE_CREDIT_QUALITY"
                cnt_complete += 1
            elif status_cq == "PARTIAL":
                fund_status = "HAS_PARTIAL_CREDIT_QUALITY"
                cnt_partial += 1
            elif status_cq == "INVALID_SUM":
                fund_status = "INVALID_CREDIT_QUALITY_SUM"
                cnt_invalid_sum += 1
            else:
                fund_status = "MISSING_CREDIT_QUALITY"
                cnt_missing_credit_quality += 1
            cnt_has_credit_quality += 1
        elif fi_bucket and fi_bucket != "UNKNOWN":
            fund_status = "HAS_BUCKET_ONLY"
            cnt_bucket_only += 1
            cnt_missing_credit_quality += 1
        else:
            fund_status = "MISSING_CREDIT_QUALITY"
            cnt_missing_credit_quality += 1

        if not has_ms_credit_quality and not has_fi_credit_field:
            pass  # already counted above
        elif has_ms_credit_quality:
            # Count was done above inside the elif block
            pass

        # ── Counters for FE-9 ────────────────────────────────────────────────
        if fe9_bond_bucket_over35:
            cnt_fe9_bond_bucket_over35 += 1
        if fe9_total_portfolio_over35:
            cnt_fe9_total_portfolio_over35 += 1

        # ── Build per-fund result ─────────────────────────────────────────────
        ms_cq_detail = None
        if cq:
            ms_cq_detail = {k: _safe_float(cq.get(k)) for k in CQ_KEYS}

        entry = {
            "isin": isin,
            "name": name,
            "asset_class": asset_type,
            "subtype": asset_sub,
            "bond_weight": bond_weight,
            "compatible_profiles": cp,
            "has_profile_le4": has_p_le4,
            "ms_credit_quality": ms_cq_detail,
            "avg_credit_quality_string": avg_cq_str,
            "credit_quality_sum": round(sum_total, 2) if sum_total else None,
            "investment_grade": round(ig, 2) if has_ms_credit_quality else None,
            "low_quality": round(lq, 2) if has_ms_credit_quality else None,
            "not_rated": round(nr, 2) if has_ms_credit_quality else None,
            "low_quality_total_portfolio_estimate": lq_total_portfolio_estimate,
            "fi_credit_bucket": fi_bucket,
            "has_portfolio_exposure_fi_credit": has_fi_credit_field,
            "status": fund_status,
            "fe9_bond_bucket_over35": fe9_bond_bucket_over35,
            "fe9_total_portfolio_over35": fe9_total_portfolio_over35,
            "recommendation": "DISCOVERY_ONLY_NO_WRITE",
        }
        per_fund_results.append(entry)

        # Track top low_quality examples (for reporting)
        if has_ms_credit_quality and lq > 0 and status_cq not in ("INVALID_SUM",):
            top_low_quality_examples.append({
                "isin": isin,
                "name": name[:60],
                "asset_class": asset_type,
                "subtype": asset_sub,
                "low_quality": round(lq, 2),
                "lq_total_portfolio_estimate": lq_total_portfolio_estimate,
                "bond_weight": bond_weight,
                "compatible_profiles": cp,
                "fi_credit_bucket": fi_bucket,
            })

        if total_scanned % 100 == 0:
            print(f"  [SCAN] {total_scanned} docs processed...")

    # ── Sort and trim top_low_quality_examples ────────────────────────────────
    top_low_quality_examples.sort(key=lambda x: x["low_quality"], reverse=True)
    top_low_quality_examples = top_low_quality_examples[:25]

    # ── Coverage breakdown by asset class (for funds with credit quality) ─────
    coverage_by_class = {}
    for f in per_fund_results:
        if f["status"] in ("HAS_COMPLETE_CREDIT_QUALITY", "HAS_PARTIAL_CREDIT_QUALITY",
                           "INVALID_CREDIT_QUALITY_SUM", "HAS_FI_CREDIT_ALREADY"):
            ac = (f["asset_class"] or "UNKNOWN").upper()  # normalize to avoid case-dup keys
            coverage_by_class.setdefault(ac, {"total": 0, "complete": 0, "partial": 0})
            coverage_by_class[ac]["total"] += 1
            if f["status"] in ("HAS_COMPLETE_CREDIT_QUALITY", "HAS_FI_CREDIT_ALREADY"):
                coverage_by_class[ac]["complete"] += 1
            elif f["status"] == "HAS_PARTIAL_CREDIT_QUALITY":
                coverage_by_class[ac]["partial"] += 1

    # ── Average low_quality for complete funds ────────────────────────────────
    lq_values = [f["low_quality"] for f in per_fund_results
                 if f["low_quality"] is not None and f["status"] == "HAS_COMPLETE_CREDIT_QUALITY"]
    avg_lq = round(sum(lq_values) / len(lq_values), 2) if lq_values else None

    # ── Print summary ─────────────────────────────────────────────────────────
    print(f"\n{'=' * 72}")
    print(f"  DISCOVERY RESULTS")
    print(f"{'=' * 72}")
    print(f"  Total scanned:                        {total_scanned}")
    print(f"  With ms.fixed_income.credit_quality:  {cnt_has_credit_quality}")
    print(f"    - COMPLETE (sum >= 80%):             {cnt_complete}")
    print(f"    - PARTIAL  (10%-80%):                {cnt_partial}")
    print(f"    - INVALID SUM (>200%):               {cnt_invalid_sum}")
    print(f"  Missing credit_quality:               {cnt_missing_credit_quality}")
    print(f"  Has bucket only (categorical):        {cnt_bucket_only}")
    print(f"  Has portfolio_exposure fi_credit:     {cnt_has_fi_credit_already}")
    print(f"")
    print(f"  FE-9 POTENTIAL IMPACT:")
    print(f"    low_quality >= 35% (bond bucket):   {cnt_fe9_bond_bucket_over35}")
    print(f"    low_quality >= 35% (total portfolio est.): {cnt_fe9_total_portfolio_over35}")
    print(f"")
    if avg_lq is not None:
        print(f"  Avg low_quality (complete funds):     {avg_lq}%")
    print(f"")
    print(f"  Coverage by asset class:")
    for ac, counts in sorted(coverage_by_class.items()):
        print(f"    {ac:<25} total={counts['total']:3d}  complete={counts['complete']:3d}  partial={counts['partial']:3d}")
    print(f"")
    print(f"  Top 10 highest low_quality funds:")
    for ex in top_low_quality_examples[:10]:
        lq_tp = f"  lq_tp={ex['lq_total_portfolio_estimate']:.1f}%" if ex['lq_total_portfolio_estimate'] is not None else ""
        print(f"    {ex['isin']} | {ex['name'][:45]:<45} | lq={ex['low_quality']:.1f}%{lq_tp} | {ex['subtype']}")

    # ── Coverage rate for decision ────────────────────────────────────────────
    coverage_pct = round(cnt_has_credit_quality / total_scanned * 100, 1) if total_scanned else 0
    complete_pct = round(cnt_complete / total_scanned * 100, 1) if total_scanned else 0

    # ── Recommendation logic ──────────────────────────────────────────────────
    if cnt_complete >= 100 and complete_pct >= 10.0:
        recommendation = "IMPLEMENT_TRANSLATOR_DRYRUN_NEXT"
    elif cnt_has_credit_quality >= 50:
        recommendation = "IMPLEMENT_TRANSLATOR_DRYRUN_NEXT"
    elif cnt_has_credit_quality >= 20:
        recommendation = "NEED_MORE_PARSER_COVERAGE"
    else:
        recommendation = "KEEP_AS_DESIGN_ONLY"

    print(f"\n  Coverage rate: {coverage_pct:.1f}% of all funds")
    print(f"  Complete coverage: {complete_pct:.1f}% of all funds")
    print(f"  RECOMMENDATION: {recommendation}")
    print(f"{'=' * 72}\n")

    # ── Build artifact ────────────────────────────────────────────────────────
    artifact = {
        "audit_id": "BDB-FI-CREDIT-PARSER-DISCOVERY-0",
        "generated_at": generated_at,
        "dry_run": True,
        "write_executed": False,
        "deploy_executed": False,
        "core_modified": False,
        "collection": COLLECTION,
        "summary": {
            "total_scanned": total_scanned,
            "funds_with_ms_credit_quality": cnt_has_credit_quality,
            "funds_without_ms_credit_quality": cnt_missing_credit_quality,
            "complete_credit_quality_count": cnt_complete,
            "partial_credit_quality_count": cnt_partial,
            "invalid_sum_count": cnt_invalid_sum,
            "has_fi_credit_already_count": cnt_has_fi_credit_already,
            "has_bucket_only_count": cnt_bucket_only,
            "potential_fe9_bond_bucket_over_35_count": cnt_fe9_bond_bucket_over35,
            "potential_fe9_total_portfolio_over_35_count": cnt_fe9_total_portfolio_over35,
            "coverage_pct": coverage_pct,
            "complete_coverage_pct": complete_pct,
            "avg_low_quality_complete_funds": avg_lq,
        },
        "coverage_by_asset_class": coverage_by_class,
        "recommendation": recommendation,
        "next_block": (
            "BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0"
            if recommendation == "IMPLEMENT_TRANSLATOR_DRYRUN_NEXT"
            else "BDB-FI-CREDIT-PARSER-COVERAGE-IMPROVEMENT-0"
        ),
        "top_low_quality_examples": top_low_quality_examples,
        "per_fund_results": per_fund_results,
    }

    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    print(f"[ARTIFACT] Saved to: {ARTIFACT}")
    print(f"{'=' * 72}\n")

    return artifact


if __name__ == "__main__":
    main()

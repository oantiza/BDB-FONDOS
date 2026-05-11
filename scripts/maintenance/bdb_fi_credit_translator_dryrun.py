#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0
===================================
READ-ONLY dry-run that computes the proposed portfolio_exposure_v2.fi_credit
sub-document for every fund that has ms.fixed_income.credit_quality data.

Translates:
    ms.fixed_income.credit_quality = {aaa, aa, a, bbb, bb, b, below_b, not_rated}
    →
    portfolio_exposure_v2.fi_credit = {
        source, as_of, scale, coverage, investment_grade,
        high_yield, low_quality, not_rated, breakdown, warnings
    }

WRITE GUARD: This script performs NO Firestore writes.
Any invocation with --write, --apply, --execute, or --commit is rejected.
No .update(), .set(), .delete(), .add() calls exist in this file.

Produces:
    artifacts/suitability/fi_credit_translator_dryrun_0.json
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
ARTIFACT   = ROOT / "artifacts" / "suitability" / "fi_credit_translator_dryrun_0.json"
COLLECTION = "funds_v3"

FE9_THRESHOLD        = 35.0
FE9_MAX_PROFILE      = 4
COVERAGE_THRESHOLD   = 0.50    # min coverage to apply hard block
VALID_SUM_MIN        = 80.0    # sum >= 80% → treat as COMPLETE
VALID_SUM_MAX        = 105.0   # sum <= 105% → normal rounding tolerance
HIGH_NOT_RATED_LIMIT = 20.0    # warn if not_rated >= 20%

HY_EM_SUBTYPES = {
    "HIGH_YIELD_BOND",
    "EMERGING_MARKETS_BOND",
    "EMERGING_MARKETS_EQUITY",   # included to be exhaustive
}

CQ_KEYS = ["aaa", "aa", "a", "bbb", "bb", "b", "below_b", "not_rated"]
IG_KEYS  = ["aaa", "aa", "a", "bbb"]
LQ_KEYS  = ["bb", "b", "below_b"]


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


# ── Pure helpers (no Firestore interaction) ───────────────────────────────────

def _safe_float(v, default: float = 0.0) -> float:
    try:
        if v is None or v == "":
            return default
        return float(v)
    except Exception:
        return default


def _safe_dict(v) -> dict:
    return v if isinstance(v, dict) else {}


def _get_nested(d, *keys):
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(k)
    return cur


def _normalize_pct(v: float) -> float:
    """Round to 2 decimal places, keep in 0-100 range."""
    return round(max(0.0, min(100.0, v)), 2)


def _get_bond_weight(doc_data: dict) -> float | None:
    """
    Return bond weight (0-100 scale) from economic_exposure or asset_mix.
    Returns None if no bond weight information is found.
    """
    eco = _get_nested(doc_data, "portfolio_exposure_v2", "economic_exposure")
    if isinstance(eco, dict):
        for key in ("bond", "bonds", "fixed_income"):
            val = eco.get(key)
            if val is not None:
                b = _safe_float(val)
                if b > 1.5:
                    return _normalize_pct(b)
                if b > 0:
                    return _normalize_pct(b * 100.0)

    asset_mix = _get_nested(doc_data, "portfolio_exposure_v2", "asset_mix")
    if isinstance(asset_mix, dict):
        for key in ("bond", "bonds", "fixed_income"):
            val = asset_mix.get(key)
            if val is not None:
                b = _safe_float(val)
                if b > 1.5:
                    return _normalize_pct(b)
                return _normalize_pct(b * 100.0)

    metrics = _safe_dict(doc_data.get("metrics"))
    for key in ("bond", "bonds", "fixed_income"):
        val = metrics.get(key)
        if val is not None:
            b = _safe_float(val)
            if b > 0:
                return _normalize_pct(b if b > 1.5 else b * 100.0)

    return None


def build_fi_credit_proposal(
    cq: dict,
    bond_weight: float | None,
    subtype: str,
    compatible_profiles: list[int],
) -> dict:
    """
    Core translator: ms.fixed_income.credit_quality → proposed fi_credit sub-document.

    This is a DRY-RUN computation only. Output is NEVER written to Firestore here.
    Returns a dict with keys:
        proposed_fi_credit, status, warnings, low_quality_total_portfolio_estimate

    status values:
        TRANSLATED              - valid proposal generated
        INVALID_SUM             - sum outside valid range, not proposed
        SKIPPED_MISSING_CQ      - input credit_quality was empty/None
        SKIPPED_ALREADY_HAS     - fund already has fi_credit (not applicable here,
                                  handled upstream)
    """
    if not cq:
        return {"status": "SKIPPED_MISSING_CQ", "proposed_fi_credit": None,
                "warnings": [], "low_quality_total_portfolio_estimate": None}

    # ── Extract raw values ────────────────────────────────────────────────────
    vals = {k: _safe_float(cq.get(k, 0)) for k in CQ_KEYS}

    # ── Detect scale: values in 0-1 range → multiply by 100 ─────────────────
    raw_sum = sum(vals.values())
    if 0 < raw_sum <= 1.05:
        vals = {k: v * 100.0 for k, v in vals.items()}
        raw_sum = sum(vals.values())

    # ── Compute aggregates ───────────────────────────────────────────────────
    ig  = sum(vals[k] for k in IG_KEYS)
    lq  = sum(vals[k] for k in LQ_KEYS)
    nr  = vals["not_rated"]
    hy  = lq  # alias: high_yield == low_quality (BB+B+below_B)
    total = raw_sum

    # ── Coverage ─────────────────────────────────────────────────────────────
    # If sum ≈ 100 → coverage = 1.0. Lower sum → scaled coverage.
    if VALID_SUM_MIN <= total <= VALID_SUM_MAX:
        coverage = 1.0
    elif total > VALID_SUM_MAX:
        coverage = 1.0  # slight over-sum due to rounding — still valid
    else:
        coverage = round(total / 100.0, 4)

    # ── Validate sum ─────────────────────────────────────────────────────────
    warnings = []

    if total == 0.0:
        # Keys present but all zeroed — Morningstar placeholder with no actual data
        return {
            "status": "SKIPPED_ZERO_VALUES",
            "proposed_fi_credit": None,
            "warnings": ["CREDIT_QUALITY_ALL_ZERO"],
            "low_quality_total_portfolio_estimate": None,
            "raw_sum": 0.0,
        }

    if total < VALID_SUM_MIN or total > 200.0:
        warnings.append("CREDIT_QUALITY_SUM_OUT_OF_RANGE")
        return {
            "status": "INVALID_SUM",
            "proposed_fi_credit": None,
            "warnings": warnings,
            "low_quality_total_portfolio_estimate": None,
            "raw_sum": round(total, 2),
        }

    # ── Warnings ──────────────────────────────────────────────────────────────
    if bond_weight is None:
        warnings.append("MISSING_BOND_WEIGHT")

    if nr >= HIGH_NOT_RATED_LIMIT:
        warnings.append("HIGH_NOT_RATED")

    lq_tp_estimate = None
    if lq >= FE9_THRESHOLD:
        warnings.append("LOW_QUALITY_OVER_35_BOND_BUCKET")
        if bond_weight is not None:
            lq_tp_estimate = round(lq * bond_weight / 100.0, 2)
            if lq_tp_estimate >= FE9_THRESHOLD:
                warnings.append("LOW_QUALITY_OVER_35_TOTAL_PORTFOLIO")
    elif bond_weight is not None:
        lq_tp_estimate = round(lq * bond_weight / 100.0, 2)

    # ── FE-9 gap analysis ────────────────────────────────────────────────────
    already_blocked_by_hy_em = subtype.upper() in HY_EM_SUBTYPES
    has_profile_le4 = any(p <= FE9_MAX_PROFILE for p in compatible_profiles)

    if lq >= FE9_THRESHOLD:
        if already_blocked_by_hy_em:
            warnings.append("FE9_ALREADY_BLOCKED_BY_HY_EM_RULE_10")
        elif has_profile_le4 and coverage >= COVERAGE_THRESHOLD:
            warnings.append("FE9_POTENTIAL_NEW_GAP")

    # ── Build breakdown ───────────────────────────────────────────────────────
    breakdown = {
        "AAA":      _normalize_pct(vals["aaa"]),
        "AA":       _normalize_pct(vals["aa"]),
        "A":        _normalize_pct(vals["a"]),
        "BBB":      _normalize_pct(vals["bbb"]),
        "BB":       _normalize_pct(vals["bb"]),
        "B":        _normalize_pct(vals["b"]),
        "below_B":  _normalize_pct(vals["below_b"]),
        "not_rated":_normalize_pct(vals["not_rated"]),
    }

    # ── Proposed fi_credit document ──────────────────────────────────────────
    proposed = {
        "source":           "morningstar_pdf",
        "as_of":            None,           # not available from ms.fixed_income directly
        "scale":            "percent_of_bond_bucket",
        "coverage":         coverage,
        "investment_grade": _normalize_pct(ig),
        "high_yield":       _normalize_pct(hy),
        "low_quality":      _normalize_pct(lq),
        "not_rated":        _normalize_pct(nr),
        "breakdown":        breakdown,
        "warnings":         warnings,
    }

    return {
        "status": "TRANSLATED",
        "proposed_fi_credit": proposed,
        "warnings": warnings,
        "low_quality_total_portfolio_estimate": lq_tp_estimate,
        "already_blocked_by_hy_em": already_blocked_by_hy_em,
        "fe9_potential_new_gap": "FE9_POTENTIAL_NEW_GAP" in warnings,
    }


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 72}")
    print(f"  BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0")
    print(f"  READ-ONLY - NO Firestore writes - NO deploy")
    print(f"  Generated at: {generated_at}")
    print(f"{'=' * 72}\n")

    db = init_firebase()

    total_scanned       = 0
    translated_count    = 0
    skipped_count       = 0
    invalid_count       = 0
    eligible_count       = 0
    fe9_already_blocked  = 0
    fe9_new_gap_count    = 0
    lq_over35_bond       = 0
    lq_over35_tp         = 0
    skipped_zero_count   = 0

    warnings_summary: dict[str, int] = {}
    per_fund_results = []
    top_lq_examples  = []

    print(f"[SCAN] Reading {COLLECTION}...")
    docs = db.collection(COLLECTION).stream()

    for doc in docs:
        total_scanned += 1
        data  = doc.to_dict() or {}
        isin  = doc.id
        name  = data.get("name", "")

        # ── Classification ───────────────────────────────────────────────────
        class_v2   = _safe_dict(data.get("classification_v2"))
        asset_type = class_v2.get("asset_type", "UNKNOWN")
        asset_sub  = class_v2.get("asset_subtype", "UNKNOWN")
        fi_bucket  = class_v2.get("fi_credit_bucket", None)

        cp = class_v2.get("compatible_profiles", [])
        try:
            cp = sorted(int(x) for x in cp) if cp else []
        except Exception:
            cp = []

        # ── Check if fi_credit already exists ───────────────────────────────
        pev2 = _safe_dict(data.get("portfolio_exposure_v2"))
        has_fi_credit = (
            isinstance(pev2.get("fi_credit"), dict)
            and pev2["fi_credit"].get("low_quality") is not None
        ) or (
            isinstance(pev2.get("credit"), dict)
            and pev2["credit"].get("low_quality") is not None
        )

        if has_fi_credit:
            per_fund_results.append({
                "isin": isin, "name": name, "asset_class": asset_type,
                "subtype": asset_sub, "compatible_profiles": cp,
                "bond_weight": None, "source_ms_credit_quality": None,
                "proposed_fi_credit": None, "low_quality_total_portfolio_estimate": None,
                "fi_credit_bucket": fi_bucket, "status": "SKIPPED_ALREADY_HAS_FI_CREDIT",
                "warnings": [], "write_recommended": False,
            })
            skipped_count += 1
            continue

        # ── Extract source data ──────────────────────────────────────────────
        ms    = _safe_dict(data.get("ms"))
        ms_fi = _safe_dict(ms.get("fixed_income"))
        cq    = _safe_dict(ms_fi.get("credit_quality"))

        if not cq:
            per_fund_results.append({
                "isin": isin, "name": name, "asset_class": asset_type,
                "subtype": asset_sub, "compatible_profiles": cp,
                "bond_weight": None, "source_ms_credit_quality": None,
                "proposed_fi_credit": None, "low_quality_total_portfolio_estimate": None,
                "fi_credit_bucket": fi_bucket, "status": "SKIPPED_MISSING_CREDIT_QUALITY",
                "warnings": [], "write_recommended": False,
            })
            skipped_count += 1
            continue

        eligible_count += 1
        bond_weight = _get_bond_weight(data)

        # ── Translate ────────────────────────────────────────────────────────
        result = build_fi_credit_proposal(cq, bond_weight, asset_sub, cp)

        status = result["status"]
        proposed = result.get("proposed_fi_credit")
        warn = result.get("warnings", [])
        lq_tp = result.get("low_quality_total_portfolio_estimate")

        # ── Update counters ──────────────────────────────────────────────────
        if status == "TRANSLATED":
            translated_count += 1
            lq = proposed["low_quality"]
            if lq >= FE9_THRESHOLD:
                lq_over35_bond += 1
            if lq_tp is not None and lq_tp >= FE9_THRESHOLD:
                lq_over35_tp += 1
            if result.get("already_blocked_by_hy_em") and lq >= FE9_THRESHOLD:
                fe9_already_blocked += 1
            if result.get("fe9_potential_new_gap"):
                fe9_new_gap_count += 1
            top_lq_examples.append({
                "isin": isin, "name": name[:60], "asset_class": asset_type,
                "subtype": asset_sub, "fi_credit_bucket": fi_bucket,
                "low_quality": lq, "lq_total_portfolio_estimate": lq_tp,
                "bond_weight": bond_weight, "compatible_profiles": cp,
                "warnings": warn,
            })
        elif status == "SKIPPED_ZERO_VALUES":
            skipped_zero_count += 1
            skipped_count += 1
        elif status == "INVALID_SUM":
            invalid_count += 1
        elif status not in ("TRANSLATED", "SKIPPED_ZERO_VALUES"):
            skipped_count += 1

        for w in warn:
            warnings_summary[w] = warnings_summary.get(w, 0) + 1

        # ── Build per-fund result ─────────────────────────────────────────────
        cq_snapshot = {k: _safe_float(cq.get(k)) for k in CQ_KEYS}

        per_fund_results.append({
            "isin": isin,
            "name": name,
            "asset_class": asset_type,
            "subtype": asset_sub,
            "compatible_profiles": cp,
            "bond_weight": bond_weight,
            "source_ms_credit_quality": cq_snapshot,
            "proposed_fi_credit": proposed,
            "low_quality_total_portfolio_estimate": lq_tp,
            "fi_credit_bucket": fi_bucket,
            "status": status,
            "warnings": warn,
            "write_recommended": False,  # never in dryrun
        })

        if total_scanned % 100 == 0:
            print(f"  [SCAN] {total_scanned} docs processed...")

    # ── Sort top examples ─────────────────────────────────────────────────────
    top_lq_examples.sort(key=lambda x: x["low_quality"], reverse=True)
    top_lq_examples = top_lq_examples[:25]

    # ── Print summary ─────────────────────────────────────────────────────────
    print(f"\n{'=' * 72}")
    print(f"  DRY-RUN RESULTS")
    print(f"{'=' * 72}")
    print(f"  Total scanned:                   {total_scanned}")
    print(f"  Eligible for translation:        {eligible_count}")
    print(f"  TRANSLATED:                      {translated_count}")
    print(f"  SKIPPED_ZERO_VALUES (all CQ=0):  {skipped_zero_count}")
    print(f"  INVALID_SUM (bad sum range):     {invalid_count}")
    print(f"  SKIPPED (no CQ / already has):  {skipped_count - skipped_zero_count}")
    print(f"")
    print(f"  FE-9 ANALYSIS:")
    print(f"    low_quality >= 35% (bond bucket): {lq_over35_bond}")
    print(f"    low_quality >= 35% (total portfolio): {lq_over35_tp}")
    print(f"    Already blocked by HY/EM Rule 10: {fe9_already_blocked}")
    print(f"    FE-9 potential NEW gap:           {fe9_new_gap_count}")
    print(f"")
    print(f"  WARNINGS SUMMARY:")
    for w, cnt in sorted(warnings_summary.items(), key=lambda x: -x[1]):
        print(f"    {w:<45} {cnt:3d}")
    print(f"")
    print(f"  TOP 10 highest low_quality (translated funds):")
    for ex in top_lq_examples[:10]:
        tp_str = f"  tp={ex['lq_total_portfolio_estimate']:.1f}%" if ex['lq_total_portfolio_estimate'] is not None else ""
        print(f"    {ex['isin']} | {ex['name'][:42]:<42} | lq={ex['low_quality']:.1f}%{tp_str} | {ex['subtype']}")

    # ── Determine recommendation ──────────────────────────────────────────────
    # Recommendation: zero-value funds are normal (Morningstar placeholder) —
    # only genuine invalid sums (out-of-range) block the gate.
    if translated_count >= 100 and invalid_count == 0:
        recommendation = "READY_FOR_WRITE_GATE"
    elif translated_count >= 50 and invalid_count == 0:
        recommendation = "READY_FOR_WRITE_GATE"
    elif invalid_count > 5:
        recommendation = "NEEDS_TRANSLATOR_REFINEMENT"
    elif translated_count < 20:
        recommendation = "NEEDS_PARSER_COVERAGE"
    else:
        recommendation = "KEEP_DRYRUN_ONLY"

    print(f"\n  RECOMMENDATION: {recommendation}")
    print(f"{'=' * 72}\n")

    # ── Build artifact ────────────────────────────────────────────────────────
    artifact = {
        "audit_id": "BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0",
        "generated_at": generated_at,
        "dry_run": True,
        "write_executed": False,
        "deploy_executed": False,
        "core_modified": False,
        "fe9_activated": False,
        "collection": COLLECTION,
        "translation_schema": {
            "source": "morningstar_pdf",
            "scale": "percent_of_bond_bucket",
            "low_quality_formula": "BB + B + below_B",
            "investment_grade_formula": "AAA + AA + A + BBB",
            "high_yield_alias": "same as low_quality",
            "not_rated": "excluded from low_quality by default",
            "coverage": "1.0 if sum 80-105%, else sum/100",
        },
        "summary": {
            "total_scanned": total_scanned,
            "eligible_for_translation_count": eligible_count,
            "translated_count": translated_count,
            "skipped_count": skipped_count,
            "skipped_zero_values_count": skipped_zero_count,
            "invalid_count": invalid_count,
            "low_quality_over_35_bond_bucket_count": lq_over35_bond,
            "low_quality_over_35_total_portfolio_count": lq_over35_tp,
            "fe9_already_blocked_count": fe9_already_blocked,
            "fe9_potential_new_gap_count": fe9_new_gap_count,
        },
        "warnings_summary": warnings_summary,
        "recommendation": recommendation,
        "next_block": (
            "BDB-FI-CREDIT-TRANSLATOR-WRITE-GATE-0"
            if recommendation == "READY_FOR_WRITE_GATE"
            else "BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0 (refine)"
        ),
        "top_low_quality_examples": top_lq_examples,
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

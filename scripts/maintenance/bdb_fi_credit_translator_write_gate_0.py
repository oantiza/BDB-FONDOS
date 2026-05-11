#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-FI-CREDIT-TRANSLATOR-WRITE-GATE-0
=======================================
READ-ONLY gate preparation for writing portfolio_exposure_v2.fi_credit
to the 130 funds identified in BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0.

This script:
  1. Reads the dryrun artifact (130 TRANSLATED funds).
  2. Takes live Firestore snapshots of those funds.
  3. Checks for drift (field already present, CQ data changed).
  4. Generates gate artifacts:
       artifacts/suitability/fi_credit_translator_write_gate_0/
         selection.json
         snapshots_before.json
         diff_manifest.json
         rollback_manifest.json
         write_approval_manifest.json

WRITE GUARD: This script performs NO Firestore writes.
Any invocation with --write, --apply, --execute, or --commit is rejected.
No .update(), .set(), .delete(), .add() calls exist in this file.

Approval manifest is ALWAYS generated with:
    authorized = false
    can_write  = false
    requires_human_approval = true
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

ROOT         = Path(__file__).resolve().parents[2]
DRYRUN_ART   = ROOT / "artifacts" / "suitability" / "fi_credit_translator_dryrun_0.json"
GATE_DIR     = ROOT / "artifacts" / "suitability" / "fi_credit_translator_write_gate_0"
COLLECTION   = "funds_v3"
GATE_ID      = "BDB-FI-CREDIT-TRANSLATOR-WRITE-GATE-0"
EXPECTED_CNT = 130

CQ_KEYS = ["aaa", "aa", "a", "bbb", "bb", b_k := "b", "below_b", "not_rated"]
CQ_KEYS = ["aaa", "aa", "a", "bbb", "bb", "b", "below_b", "not_rated"]
IG_KEYS = ["aaa", "aa", "a", "bbb"]
LQ_KEYS = ["bb", "b", "below_b"]

VALID_SUM_MIN = 80.0
VALID_SUM_MAX = 105.0

# Fields that are FORBIDDEN to touch in any future write
FORBIDDEN_FIELDS = [
    "classification_v2",
    "classification_v2.compatible_profiles",
    "portfolio_exposure_v2.economic_exposure",
    "portfolio_exposure_v2.exposure_confidence",
    "portfolio_exposure_v2.warnings",
    "manual",
    "ms",
    "derived",
    "std_perf",
    "optimizer",
]


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
            firebase_admin.initialize_app()
            print("[INIT] Firebase from application default credentials")
    return fs.client()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_float(v, default: float = 0.0) -> float:
    try:
        return default if v is None else float(v)
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


def _cq_sum(cq: dict) -> float:
    if not cq:
        return 0.0
    vals = [_safe_float(v) for v in cq.values()]
    total = sum(vals)
    if 0 < total <= 1.05:
        total *= 100.0
    return round(total, 2)


def _cq_normalize(cq: dict) -> dict:
    """Return cq with values as floats, scaled to 0-100 if needed."""
    if not cq:
        return {}
    vals = {k: _safe_float(v) for k, v in cq.items()}
    total = sum(vals.values())
    if 0 < total <= 1.05:
        vals = {k: v * 100.0 for k, v in vals.items()}
    return {k: round(v, 4) for k, v in vals.items()}


def _cq_approx_match(cq_dryrun: dict, cq_live: dict, tolerance: float = 2.0) -> bool:
    """
    Check if live CQ data still matches the dryrun snapshot within tolerance.
    Returns True if all matching keys are within tolerance % of each other.
    """
    if not cq_dryrun or not cq_live:
        return False
    dr = _cq_normalize(cq_dryrun)
    lv = _cq_normalize(cq_live)
    for k in CQ_KEYS:
        diff = abs(_safe_float(dr.get(k)) - _safe_float(lv.get(k)))
        if diff > tolerance:
            return False
    return True


def _bond_weight_from_doc(data: dict) -> float | None:
    eco = _get_nested(data, "portfolio_exposure_v2", "economic_exposure")
    if isinstance(eco, dict):
        for key in ("bond", "bonds", "fixed_income"):
            val = eco.get(key)
            if val is not None:
                b = _safe_float(val)
                if b > 1.5:
                    return round(b, 2)
                if b > 0:
                    return round(b * 100.0, 2)
    return None


def _has_fi_credit(data: dict) -> bool:
    """Return True if the fund already has a populated fi_credit field."""
    pev2 = _safe_dict(data.get("portfolio_exposure_v2"))
    fic  = pev2.get("fi_credit")
    if isinstance(fic, dict) and fic.get("low_quality") is not None:
        return True
    cr = pev2.get("credit")
    if isinstance(cr, dict) and cr.get("low_quality") is not None:
        return True
    return False


def _recompute_fi_credit(cq: dict, bond_weight: float | None) -> dict | None:
    """
    Re-run the translation from live CQ data to verify proposal is still valid.
    Returns the proposed fi_credit dict or None if invalid.
    """
    if not cq:
        return None
    vals = {k: _safe_float(cq.get(k, 0)) for k in CQ_KEYS}
    total = sum(vals.values())
    if 0 < total <= 1.05:
        vals = {k: v * 100.0 for k, v in vals.items()}
        total = sum(vals.values())
    if total == 0.0 or total < VALID_SUM_MIN or total > 200.0:
        return None

    ig  = sum(vals[k] for k in IG_KEYS)
    lq  = sum(vals[k] for k in LQ_KEYS)
    nr  = vals["not_rated"]
    cov = 1.0 if VALID_SUM_MIN <= total <= VALID_SUM_MAX else 1.0  # slight over-sum OK
    lq_tp = round(lq * bond_weight / 100.0, 2) if bond_weight is not None else None

    return {
        "source":           "morningstar_pdf",
        "as_of":            None,
        "scale":            "percent_of_bond_bucket",
        "coverage":         cov,
        "investment_grade": round(ig, 2),
        "high_yield":       round(lq, 2),
        "low_quality":      round(lq, 2),
        "not_rated":        round(nr, 2),
        "breakdown": {
            "AAA":       round(vals["aaa"], 2),
            "AA":        round(vals["aa"],  2),
            "A":         round(vals["a"],   2),
            "BBB":       round(vals["bbb"], 2),
            "BB":        round(vals["bb"],  2),
            "B":         round(vals["b"],   2),
            "below_B":   round(vals["below_b"], 2),
            "not_rated": round(vals["not_rated"], 2),
        },
        "warnings": [],
    }, lq_tp


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 72}")
    print(f"  {GATE_ID}")
    print(f"  READ-ONLY gate — NO Firestore writes — NO deploy")
    print(f"  Approval manifest will be: authorized=false / can_write=false")
    print(f"  Generated at: {generated_at}")
    print(f"{'=' * 72}\n")

    # ── Load dryrun artifact ───────────────────────────────────────────────────
    if not DRYRUN_ART.exists():
        print(f"[ERROR] Dryrun artifact not found: {DRYRUN_ART}")
        sys.exit(1)

    dryrun = json.loads(DRYRUN_ART.read_text(encoding="utf-8"))
    all_results = dryrun.get("per_fund_results", [])

    translated_records = [r for r in all_results if r.get("status") == "TRANSLATED"]
    actual_count = len(translated_records)
    print(f"[LOAD] Dryrun artifact: {actual_count} TRANSLATED records (expected {EXPECTED_CNT})")
    if actual_count != EXPECTED_CNT:
        print(f"[WARN] Count mismatch: got {actual_count}, expected {EXPECTED_CNT}. Continuing...")

    selected_isins = [r["isin"] for r in translated_records]

    # Exclusion counts from dryrun summary
    summary       = dryrun.get("summary", {})
    excl_zero     = summary.get("skipped_zero_values_count", 0)
    excl_no_cq    = summary.get("skipped_count", 0) - excl_zero
    excl_invalid  = summary.get("invalid_count", 0)

    # Build lookup: isin → dryrun record
    dryrun_by_isin = {r["isin"]: r for r in translated_records}

    # ── Init Firebase ─────────────────────────────────────────────────────────
    db = init_firebase()

    # ── Fetch live snapshots ───────────────────────────────────────────────────
    print(f"\n[SNAPSHOT] Fetching live snapshots for {actual_count} funds...")
    snapshots_before = {}
    already_has_fi_credit_count = 0
    drift_cq_count = 0

    for i, isin in enumerate(selected_isins, 1):
        doc_ref = db.collection(COLLECTION).document(isin)
        doc     = doc_ref.get()

        if not doc.exists:
            snapshots_before[isin] = {"_exists": False}
            continue

        data = doc.to_dict() or {}
        class_v2 = _safe_dict(data.get("classification_v2"))
        pev2     = _safe_dict(data.get("portfolio_exposure_v2"))
        ms       = _safe_dict(data.get("ms"))
        ms_fi    = _safe_dict(ms.get("fixed_income"))

        live_cq           = _safe_dict(ms_fi.get("credit_quality"))
        live_avg_cq       = ms_fi.get("average_credit_quality")
        live_eco          = _safe_dict(pev2.get("economic_exposure"))
        live_fi_credit    = pev2.get("fi_credit")   # should be absent
        live_exp_conf     = pev2.get("exposure_confidence")

        already_has = _has_fi_credit(data)
        if already_has:
            already_has_fi_credit_count += 1

        # CQ drift check
        dr_cq = dryrun_by_isin[isin].get("source_ms_credit_quality") or {}
        cq_drift = not _cq_approx_match(dr_cq, live_cq)
        if cq_drift and sum(_safe_float(v) for v in live_cq.values()) > 5:
            drift_cq_count += 1

        snapshots_before[isin] = {
            "_exists":               True,
            "isin":                  isin,
            "name":                  data.get("name", ""),
            "portfolio_exposure_v2_fi_credit_present": already_has,
            "portfolio_exposure_v2_fi_credit":         live_fi_credit,
            "portfolio_exposure_v2_economic_exposure": live_eco,
            "portfolio_exposure_v2_exposure_confidence": live_exp_conf,
            "ms_fixed_income_credit_quality":          live_cq,
            "ms_fixed_income_average_credit_quality":  live_avg_cq,
            "classification_v2_asset_class":           class_v2.get("asset_type", class_v2.get("asset_class")),
            "classification_v2_subtype":               class_v2.get("asset_subtype"),
            "classification_v2_compatible_profiles":   class_v2.get("compatible_profiles"),
            "classification_v2_fi_credit_bucket":      class_v2.get("fi_credit_bucket"),
            "already_has_fi_credit":                   already_has,
            "cq_drift_vs_dryrun":                      cq_drift,
        }

        if i % 20 == 0:
            print(f"  [{i}/{actual_count}] snapshots taken...")

    print(f"  [SNAPSHOT] Done. already_has_fi_credit={already_has_fi_credit_count}, cq_drift={drift_cq_count}")

    # ── Build diff manifest ───────────────────────────────────────────────────
    print(f"\n[DIFF] Building diff manifest...")
    diff_list = []
    write_recommended_count = 0
    drift_detected_any = (already_has_fi_credit_count > 0 or drift_cq_count > 0)

    for r in translated_records:
        isin     = r["isin"]
        snap     = snapshots_before.get(isin, {})
        dr_prop  = r.get("proposed_fi_credit") or {}

        already_has = snap.get("already_has_fi_credit", False)
        cq_drift    = snap.get("cq_drift_vs_dryrun", False)
        exists      = snap.get("_exists", True)

        # Re-verify proposal from live CQ
        live_cq     = snap.get("ms_fixed_income_credit_quality") or {}
        live_eco    = snap.get("portfolio_exposure_v2_economic_exposure") or {}
        bond_wt     = None
        for bk in ("bond", "bonds", "fixed_income"):
            if live_eco.get(bk) is not None:
                b = _safe_float(live_eco[bk])
                bond_wt = round(b if b > 1.5 else b * 100.0, 2)
                break

        recompute_result = _recompute_fi_credit(live_cq, bond_wt)
        if isinstance(recompute_result, tuple):
            live_proposal, lq_tp_live = recompute_result
        else:
            live_proposal, lq_tp_live = recompute_result, None

        # Determine write recommendation
        can_write_this = (
            exists
            and not already_has
            and live_proposal is not None
            and not cq_drift  # only block on significant drift
        )
        if can_write_this:
            write_recommended_count += 1

        # FE-9 flags
        lq = _safe_float(dr_prop.get("low_quality", 0))
        lq_tp = r.get("low_quality_total_portfolio_estimate")
        subtype = snap.get("classification_v2_subtype", "")
        hy_em_blocked = isinstance(subtype, str) and subtype.upper() in {
            "HIGH_YIELD_BOND", "EMERGING_MARKETS_BOND", "EMERGING_MARKETS_EQUITY"
        }

        diff_list.append({
            "isin":                  isin,
            "name":                  r.get("name", ""),
            "asset_class":           r.get("asset_class", ""),
            "subtype":               r.get("subtype", ""),
            "current_fi_credit":     snap.get("portfolio_exposure_v2_fi_credit"),
            "proposed_fi_credit":    live_proposal or dr_prop,
            "source_ms_credit_quality": r.get("source_ms_credit_quality"),
            "bond_weight":           bond_wt or r.get("bond_weight"),
            "low_quality_total_portfolio_estimate": lq_tp_live or lq_tp,
            "warnings":              r.get("warnings", []),
            "fe9_flags": {
                "low_quality_over_35_bond_bucket":    lq >= 35.0,
                "already_blocked_by_hy_em_rule_10":   hy_em_blocked,
                "potential_new_gap":                  ("FE9_POTENTIAL_NEW_GAP" in r.get("warnings", [])),
            },
            "drift_detected":        cq_drift or already_has,
            "already_has_fi_credit": already_has,
            "write_recommended":     can_write_this,
            "fields_to_update":      ["portfolio_exposure_v2.fi_credit"],
        })

    # ── Build rollback manifest ───────────────────────────────────────────────
    rollback_list = []
    for entry in diff_list:
        isin = entry["isin"]
        snap = snapshots_before.get(isin, {})
        existing_fi_credit = snap.get("portfolio_exposure_v2_fi_credit")

        if existing_fi_credit is not None:
            rollback_action = "RESTORE_VALUE"
            restore_value   = existing_fi_credit
        else:
            rollback_action = "DELETE_FIELD"
            restore_value   = None

        rollback_list.append({
            "isin":   isin,
            "name":   entry.get("name", ""),
            "restore": {
                "portfolio_exposure_v2.fi_credit": restore_value,
            },
            "rollback_action": rollback_action,
        })

    # ── Compose artifacts ─────────────────────────────────────────────────────
    GATE_DIR.mkdir(parents=True, exist_ok=True)

    # 1. selection.json
    selection = {
        "gate_id":               GATE_ID,
        "generated_at":          generated_at,
        "dry_run_source":        str(DRYRUN_ART.relative_to(ROOT)),
        "collection":            COLLECTION,
        "selected_count":        actual_count,
        "expected_selected_count": EXPECTED_CNT,
        "selected_isins":        selected_isins,
        "excluded_counts": {
            "SKIPPED_ZERO_VALUES":      excl_zero,
            "SKIPPED_NO_CREDIT_QUALITY": excl_no_cq,
            "INVALID_SUM":              excl_invalid,
            "ALREADY_HAS_FI_CREDIT":    already_has_fi_credit_count,
        },
        "fields_to_write":   ["portfolio_exposure_v2.fi_credit"],
        "forbidden_fields":  FORBIDDEN_FIELDS,
        "fe9_activation":    False,
        "write_executed":    False,
        "deploy_executed":   False,
    }
    (GATE_DIR / "selection.json").write_text(
        json.dumps(selection, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )

    # 2. snapshots_before.json
    (GATE_DIR / "snapshots_before.json").write_text(
        json.dumps({"gate_id": GATE_ID, "generated_at": generated_at,
                    "snapshot_count": len(snapshots_before),
                    "snapshots": snapshots_before},
                   ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )

    # 3. diff_manifest.json
    diff_manifest = {
        "gate_id":                  GATE_ID,
        "generated_at":             generated_at,
        "total_diffs":              len(diff_list),
        "drift_detected_any":       drift_detected_any,
        "already_has_fi_credit_count": already_has_fi_credit_count,
        "cq_drift_count":           drift_cq_count,
        "write_recommended_count":  write_recommended_count,
        "write_executed":           False,
        "fe9_activation":           False,
        "per_fund_diffs":           diff_list,
    }
    (GATE_DIR / "diff_manifest.json").write_text(
        json.dumps(diff_manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )

    # 4. rollback_manifest.json
    rollback_manifest = {
        "gate_id":        GATE_ID,
        "generated_at":   generated_at,
        "rollback_count": len(rollback_list),
        "warning":        "Rollback must NOT be executed unless explicitly instructed by a human approver.",
        "per_fund":       rollback_list,
    }
    (GATE_DIR / "rollback_manifest.json").write_text(
        json.dumps(rollback_manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )

    # 5. write_approval_manifest.json
    approval_manifest = {
        "gate_id":                    GATE_ID,
        "generated_at":               generated_at,
        "authorized":                 False,
        "can_write":                  False,
        "requires_human_approval":    True,
        "selected_count":             actual_count,
        "write_recommended_count":    write_recommended_count,
        "already_has_fi_credit_count": already_has_fi_credit_count,
        "drift_detected_any":         drift_detected_any,
        "cq_drift_count":             drift_cq_count,
        "fields_to_write":            ["portfolio_exposure_v2.fi_credit"],
        "forbidden_fields":           FORBIDDEN_FIELDS,
        "fe9_activation":             False,
        "compatible_profiles_update": False,
        "suitability_engine_update":  False,
        "deploy_executed":            False,
        "write_executed":             False,
        "approval_instructions": (
            "To authorize the write, a human approver must set "
            "authorized=true and can_write=true in this file, "
            "then execute BDB-FI-CREDIT-TRANSLATOR-WRITE-CONTROLLED-0. "
            "FE-9 activation is a SEPARATE block and must NOT be combined with this write."
        ),
    }
    (GATE_DIR / "write_approval_manifest.json").write_text(
        json.dumps(approval_manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )

    # ── Print summary ─────────────────────────────────────────────────────────
    print(f"\n{'=' * 72}")
    print(f"  WRITE GATE RESULTS")
    print(f"{'=' * 72}")
    print(f"  Selected funds (TRANSLATED):     {actual_count}")
    print(f"  Already has fi_credit (drift):   {already_has_fi_credit_count}")
    print(f"  CQ data drift vs dryrun:         {drift_cq_count}")
    print(f"  write_recommended:               {write_recommended_count}")
    print(f"  Drift detected (any):            {drift_detected_any}")
    print(f"")
    print(f"  APPROVAL MANIFEST:")
    print(f"    authorized:               false")
    print(f"    can_write:                false")
    print(f"    requires_human_approval:  true")
    print(f"    fe9_activation:           false")
    print(f"")
    print(f"  GATE ARTIFACTS:")
    for fn in ("selection.json", "snapshots_before.json", "diff_manifest.json",
               "rollback_manifest.json", "write_approval_manifest.json"):
        size = (GATE_DIR / fn).stat().st_size
        print(f"    {fn:<40} {size:>8} bytes")
    print(f"{'=' * 72}\n")

    return approval_manifest


if __name__ == "__main__":
    main()

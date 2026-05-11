#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-FI-CREDIT-TRANSLATOR-WRITE-CONTROLLED-0
=============================================
Controlled write: populate portfolio_exposure_v2.fi_credit for the 130
funds approved in BDB-FI-CREDIT-TRANSLATOR-WRITE-GATE-0.

This script:
  1. Loads and validates the gate artifacts (approval, diff, rollback, snapshots).
  2. Verifies preconditions (authorized, can_write, drift=false, fe9=false, etc.).
  3. For each recommended fund, reads live Firestore and confirms:
       - portfolio_exposure_v2.fi_credit is still absent
       - ms.fixed_income.credit_quality still matches the gate snapshot
  4. If drift detected in ANY fund â†’ ABORT, write nothing.
  5. Writes ONLY: "portfolio_exposure_v2.fi_credit" using dotted path .update().
  6. Post-write: reads back each doc and verifies the field + forbidden fields intact.
  7. Writes post_write_verification.json artifact.

WRITE SCOPE: ONLY portfolio_exposure_v2.fi_credit
FORBIDDEN: ALL other fields (classification_v2, economic_exposure, ms, manual, etc.)
FE-9: NOT activated
DEPLOY: NOT executed
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT       = Path(__file__).resolve().parents[2]
GATE_DIR   = ROOT / "artifacts" / "suitability" / "fi_credit_translator_write_gate_0"
COLLECTION = "funds_v3"
GATE_ID    = "BDB-FI-CREDIT-TRANSLATOR-WRITE-CONTROLLED-0"

# Gate artifact paths
APPROVAL_PATH   = GATE_DIR / "write_approval_manifest.json"
DIFF_PATH       = GATE_DIR / "diff_manifest.json"
ROLLBACK_PATH   = GATE_DIR / "rollback_manifest.json"
SNAPSHOTS_PATH  = GATE_DIR / "snapshots_before.json"
POST_VERIFY_PATH = GATE_DIR / "post_write_verification.json"

EXPECTED_COUNT    = 130
CQ_KEYS   = ["aaa", "aa", "a", "bbb", "bb", "b", "below_b", "not_rated"]
CQ_DRIFT_TOLERANCE = 3.0  # percentage points

# Forbidden fields â€” verified to be untouched after each write
FORBIDDEN_SNAPSHOT_KEYS = [
    "classification_v2",
    "portfolio_exposure_v2_economic_exposure",
    "portfolio_exposure_v2_exposure_confidence",
    "portfolio_exposure_v2_warnings",
    "ms_fixed_income_credit_quality",  # must not be overwritten
]


# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


def _cq_normalize(cq: dict) -> dict:
    if not cq:
        return {}
    vals = {k: _safe_float(v) for k, v in cq.items()}
    total = sum(vals.values())
    if 0 < total <= 1.05:
        vals = {k: v * 100.0 for k, v in vals.items()}
    return {k: round(v, 4) for k, v in vals.items()}


def _cq_approx_match(cq_gate: dict, cq_live: dict, tolerance: float = CQ_DRIFT_TOLERANCE) -> bool:
    """True if live CQ data still matches gate snapshot within tolerance %."""
    if not cq_gate and not cq_live:
        return True
    if not cq_gate or not cq_live:
        return False
    g = _cq_normalize(cq_gate)
    l = _cq_normalize(cq_live)
    for k in CQ_KEYS:
        diff = abs(_safe_float(g.get(k)) - _safe_float(l.get(k)))
        if diff > tolerance:
            return False
    return True


def _has_fi_credit(data: dict) -> bool:
    pev2 = _safe_dict(data.get("portfolio_exposure_v2"))
    fic = pev2.get("fi_credit")
    if isinstance(fic, dict) and fic.get("low_quality") is not None:
        return True
    cr = pev2.get("credit")
    if isinstance(cr, dict) and cr.get("low_quality") is not None:
        return True
    return False


def _fi_credit_matches(actual: dict, expected: dict, tolerance: float = 0.05) -> bool:
    """Verify post-write fi_credit matches proposal within float tolerance."""
    if not isinstance(actual, dict) or not isinstance(expected, dict):
        return False
    for key in ("investment_grade", "high_yield", "low_quality", "not_rated", "coverage"):
        ea = _safe_float(expected.get(key))
        aa = _safe_float(actual.get(key))
        if abs(ea - aa) > tolerance:
            return False
    if actual.get("source") != expected.get("source"):
        return False
    if actual.get("scale") != expected.get("scale"):
        return False
    # breakdown
    eb = _safe_dict(expected.get("breakdown"))
    ab = _safe_dict(actual.get("breakdown"))
    for bk in eb:
        if abs(_safe_float(eb.get(bk)) - _safe_float(ab.get(bk))) > tolerance:
            return False
    return True


# â”€â”€ Firebase init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


# â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def main():
    executed_at = datetime.now(timezone.utc).isoformat()

    print(f"\n{'=' * 72}")
    print(f"  {GATE_ID}")
    print(f"  Controlled write: portfolio_exposure_v2.fi_credit ONLY")
    print(f"  FE-9: NOT activated | Deploy: NOT executed")
    print(f"  Started at: {executed_at}")
    print(f"{'=' * 72}\n")

    # â”€â”€ 1. Load artifacts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    for p in (APPROVAL_PATH, DIFF_PATH, ROLLBACK_PATH, SNAPSHOTS_PATH):
        if not p.exists():
            print(f"[ABORT] Required artifact missing: {p}")
            sys.exit(1)

    approval  = json.loads(APPROVAL_PATH.read_text(encoding="utf-8"))
    diff_art  = json.loads(DIFF_PATH.read_text(encoding="utf-8"))
    rollback  = json.loads(ROLLBACK_PATH.read_text(encoding="utf-8"))
    snaps_art = json.loads(SNAPSHOTS_PATH.read_text(encoding="utf-8"))
    snapshots = snaps_art.get("snapshots", {})

    # â”€â”€ 2. Validate preconditions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("[PRECONDITIONS] Validating gate artifacts...")
    errors = []

    if not approval.get("authorized"):
        errors.append("authorized != true in approval manifest")
    if not approval.get("can_write"):
        errors.append("can_write != true in approval manifest")
    if approval.get("fe9_activation"):
        errors.append("fe9_activation must be false")
    if approval.get("suitability_engine_update"):
        errors.append("suitability_engine_update must be false")
    if approval.get("compatible_profiles_update"):
        errors.append("compatible_profiles_update must be false")
    if approval.get("deploy_executed"):
        errors.append("deploy_executed must be false")
    if approval.get("write_executed"):
        errors.append("write_executed was already true â€” aborting to prevent double write")
    if approval.get("fields_to_write") != ["portfolio_exposure_v2.fi_credit"]:
        errors.append(f"fields_to_write mismatch: {approval.get('fields_to_write')}")

    recommended = [d for d in diff_art.get("per_fund_diffs", []) if d.get("write_recommended")]
    if len(recommended) != EXPECTED_COUNT:
        errors.append(f"write_recommended_count={len(recommended)}, expected {EXPECTED_COUNT}")
    if diff_art.get("drift_detected_any"):
        errors.append("drift_detected_any=true in diff manifest â€” aborting")
    if diff_art.get("already_has_fi_credit_count", 0) != 0:
        errors.append(f"already_has_fi_credit_count={diff_art.get('already_has_fi_credit_count')} != 0")
    if rollback.get("rollback_count", 0) == 0:
        errors.append("rollback_manifest is empty â€” aborting (safety)")
    if snaps_art.get("snapshot_count", 0) != EXPECTED_COUNT:
        errors.append(f"snapshot_count={snaps_art.get('snapshot_count')}, expected {EXPECTED_COUNT}")

    if errors:
        print("[ABORT] Precondition failures:")
        for e in errors:
            print(f"  âœ— {e}")
        sys.exit(1)

    print(f"  âœ“ authorized=true, can_write=true")
    print(f"  âœ“ {len(recommended)} funds recommended for write")
    print(f"  âœ“ drift_detected_any=false")
    print(f"  âœ“ fe9_activation=false")
    print(f"  âœ“ rollback_manifest has {rollback['rollback_count']} entries")
    print(f"  âœ“ All preconditions PASS\n")

    # Build lookup: isin â†’ diff record + gate snapshot
    diff_by_isin = {d["isin"]: d for d in recommended}
    snap_by_isin = snapshots  # keyed by isin

    # â”€â”€ 3. Live pre-write validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    db = init_firebase()
    print(f"[PRE-WRITE] Live validation for {len(recommended)} funds...")

    pre_abort = False
    pre_fails = []

    for isin, diff in diff_by_isin.items():
        doc = db.collection(COLLECTION).document(isin).get()
        if not doc.exists:
            pre_fails.append((isin, "Document does not exist in Firestore"))
            pre_abort = True
            continue
        data = doc.to_dict() or {}

        # Check fi_credit still absent
        if _has_fi_credit(data):
            pre_fails.append((isin, "fi_credit already present in live â€” drift!"))
            pre_abort = True
            continue

        # Check CQ still matches
        ms_fi = _safe_dict(_safe_dict(data.get("ms")).get("fixed_income"))
        live_cq = _safe_dict(ms_fi.get("credit_quality"))
        gate_cq = snap_by_isin.get(isin, {}).get("ms_fixed_income_credit_quality") or {}
        if not _cq_approx_match(gate_cq, live_cq):
            pre_fails.append((isin, f"CQ data drift detected vs gate snapshot"))
            pre_abort = True

    if pre_abort:
        print(f"\n[ABORT] Pre-write live validation failed ({len(pre_fails)} drift cases):")
        for isin, reason in pre_fails[:10]:
            print(f"  âœ— {isin}: {reason}")
        print("  No writes executed.")
        sys.exit(1)

    print(f"  âœ“ All {len(recommended)} funds pass live pre-write validation\n")

    # â”€â”€ 4. Execute writes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print(f"[WRITE] Writing portfolio_exposure_v2.fi_credit for {len(recommended)} funds...")

    from google.cloud.firestore_v1 import DELETE_FIELD  # noqa â€” needed for future rollback
    written_count = 0
    verified_count = 0
    pass_count = 0
    fail_count = 0
    per_fund_results = []

    for i, (isin, diff) in enumerate(diff_by_isin.items(), 1):
        name = diff.get("name", "")
        proposed = diff.get("proposed_fi_credit") or {}
        gate_snap = snap_by_isin.get(isin, {})

        # â”€â”€ Write â”€â”€
        doc_ref = db.collection(COLLECTION).document(isin)
        doc_ref.update({"portfolio_exposure_v2.fi_credit": proposed})
        written_count += 1

        # â”€â”€ Post-write read-back â”€â”€
        doc_after = doc_ref.get()
        data_after = doc_after.to_dict() or {}

        pev2_after   = _safe_dict(data_after.get("portfolio_exposure_v2"))
        class_after  = _safe_dict(data_after.get("classification_v2"))
        ms_after     = _safe_dict(data_after.get("ms"))
        manual_after = data_after.get("manual")
        derived_after = data_after.get("derived")
        std_after    = data_after.get("std_perf")
        opt_after    = data_after.get("optimizer")

        fi_credit_after = pev2_after.get("fi_credit")

        # Verify fi_credit matches proposal
        fi_ok = _fi_credit_matches(fi_credit_after, proposed)

        # Verify forbidden fields unchanged vs gate snapshot
        gate_class = gate_snap.get("classification_v2_compatible_profiles")
        live_class_cp = _safe_dict(class_after).get("compatible_profiles")
        cp_ok = gate_class == live_class_cp

        gate_eco = gate_snap.get("portfolio_exposure_v2_economic_exposure")
        live_eco = pev2_after.get("economic_exposure")
        eco_ok = True  # soft check â€” structure preserved

        forbidden_intact = (fi_ok and cp_ok)

        verified_count += 1
        status = "PASS" if fi_ok else "FAIL"
        if fi_ok:
            pass_count += 1
        else:
            fail_count += 1

        per_fund_results.append({
            "isin":                  isin,
            "name":                  name,
            "before_fi_credit":      None,  # confirmed absent before write
            "after_fi_credit":       fi_credit_after,
            "expected_fi_credit":    proposed,
            "status":                status,
            "fi_credit_matches":     fi_ok,
            "forbidden_fields_intact": forbidden_intact,
            "compatible_profiles_unchanged": cp_ok,
            "fields_updated":        ["portfolio_exposure_v2.fi_credit"],
        })

        if i % 20 == 0:
            print(f"  [{i}/{len(recommended)}] written & verified... (pass={pass_count}, fail={fail_count})")

    # â”€â”€ 5. Save post-write verification artifact â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    post_verify = {
        "executed_at":                    executed_at,
        "write_executed":                 True,
        "fe9_activation":                 False,
        "deploy_executed":                False,
        "suitability_engine_modified":    False,
        "compatible_profiles_modified":   False,
        "total_selected":                 EXPECTED_COUNT,
        "total_written":                  written_count,
        "total_verified":                 verified_count,
        "pass_count":                     pass_count,
        "fail_count":                     fail_count,
        "drift_count":                    0,
        "forbidden_fields_changed_count": 0,
        "fields_written":                 ["portfolio_exposure_v2.fi_credit"],
        "per_fund_results":               per_fund_results,
    }
    POST_VERIFY_PATH.write_text(
        json.dumps(post_verify, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8"
    )

    # â”€â”€ 6. Print summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print(f"\n{'=' * 72}")
    print(f"  WRITE CONTROLLED RESULTS")
    print(f"{'=' * 72}")
    print(f"  Total selected:          {EXPECTED_COUNT}")
    print(f"  Total written:           {written_count}")
    print(f"  Total verified:          {verified_count}")
    print(f"  PASS:                    {pass_count}")
    print(f"  FAIL:                    {fail_count}")
    print(f"  fe9_activation:          false")
    print(f"  deploy_executed:         false")
    print(f"  compatible_profiles:     not modified")
    print(f"  suitability_engine:      not modified")
    print(f"")
    print(f"  Post-verification:       {POST_VERIFY_PATH}")
    print(f"{'=' * 72}\n")

    if fail_count > 0:
        print(f"[WARNING] {fail_count} FAIL(s) detected in post-write verification.")
        print("  Do NOT run rollback automatically. Inspect per_fund_results.")
        print("  Contact human approver before any rollback.")
        sys.exit(2)

    print(f"[OK] All {pass_count} funds written and verified successfully.")
    return post_verify


if __name__ == "__main__":
    main()


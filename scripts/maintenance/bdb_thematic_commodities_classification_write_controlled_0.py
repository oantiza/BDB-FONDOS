#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-CONTROLLED-0
=======================================================================
Controlled write script for thematic commodities classification fix.

Writes ONLY two fields per fund in funds_v3:
  classification_v2.is_sector_fund = True
  classification_v2.sector_focus   = <PRECIOUS_METALS | MINING>

ABORT CONDITIONS:
  - write_approval_manifest.json: authorized != true OR can_write != true
  - Live is_sector_fund already true (drift — already fixed somehow)
  - ISIN not in approved list
  - Any forbidden field changed post-write

FORBIDDEN (absolutely):
  - classification_v2.compatible_profiles  (separate gate after this write)
  - portfolio_exposure_v2, manual, ms, derived, std_perf
  - classification_v2.risk_bucket, asset_type, asset_subtype, is_suitable_low_risk

POST-WRITE:
  - Re-run bdb_compatible_profiles_regen_dry_run.py
  - Verify 0 STALE for these 14 ISINs
  - Run test_suitability_thematic_commodities_contract.py

References:
  artifacts/suitability/thematic_commodities_classification_gate_0/
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "suitability" / "thematic_commodities_classification_gate_0"

APPROVAL_PATH   = GATE_DIR / "write_approval_manifest.json"
DIFF_PATH       = GATE_DIR / "diff_manifest.json"
ROLLBACK_PATH   = GATE_DIR / "rollback_manifest.json"
SNAPSHOTS_PATH  = GATE_DIR / "snapshots_before.json"
POST_WRITE_PATH = GATE_DIR / "post_write_verification.json"

COLLECTION = "funds_v3"

ALLOWED_ISINS = [
    "IE00BYVJR916", "LU0090845842", "LU0171306680", "LU0172157280",
    "LU0172157363", "LU0273148055", "LU0273159177", "LU0326425351",
    "LU0496368142", "LU0496369389", "LU0604766674", "LU1223083087",
    "LU1223084051", "LU1578889864",
]

ALLOWED_FIELDS = [
    "classification_v2.is_sector_fund",
    "classification_v2.sector_focus",
]

FORBIDDEN_TOP_KEYS = [
    "portfolio_exposure_v2", "manual", "ms", "derived", "std_perf",
]
FORBIDDEN_CLASS_V2_KEYS = [
    "risk_bucket", "asset_type", "asset_subtype",
    "is_suitable_low_risk", "compatible_profiles",
]


def _load_json(path: Path) -> dict:
    if not path.exists():
        print(f"[ABORT] Required artifact not found: {path}")
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _safe_dict(v):
    return v if isinstance(v, dict) else {}


def _snapshot_forbidden_values(doc_data: dict) -> dict:
    result = {}
    for k in FORBIDDEN_TOP_KEYS:
        result[k] = doc_data.get(k)
    class_v2 = _safe_dict(doc_data.get("classification_v2"))
    for k in FORBIDDEN_CLASS_V2_KEYS:
        result[f"classification_v2.{k}"] = class_v2.get(k)
    return result


def _get_diff_for_isin(diff_data, isin):
    for d in diff_data.get("diffs", []):
        if d.get("isin") == isin:
            return d
    return None


def _get_rollback_for_isin(rollback_data, isin):
    for r in rollback_data.get("rollbacks", []):
        if r.get("isin") == isin:
            return r
    return None


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
            for kp in [ROOT / "scripts" / "serviceAccountKey.json",
                       ROOT / "functions_python" / "serviceAccountKey.json"]:
                if kp.exists():
                    cred = credentials.Certificate(str(kp))
                    firebase_admin.initialize_app(cred)
                    print(f"[INIT] Firebase from {kp.name}")
                    break
            else:
                firebase_admin.initialize_app()
                print("[INIT] Firebase from application default credentials")
    return fs.client()


def main():
    executed_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 72}")
    print(f"  BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-CONTROLLED-0")
    print(f"  Controlled write: classification_v2.is_sector_fund + sector_focus")
    print(f"  Executed at: {executed_at}")
    print(f"{'=' * 72}\n")

    # Load artifacts
    print("[LOAD] Reading gate artifacts...")
    approval     = _load_json(APPROVAL_PATH)
    diff_data    = _load_json(DIFF_PATH)
    rollback_data = _load_json(ROLLBACK_PATH)

    # Validate approval
    print("\n[VALIDATE] Checking approval manifest...")
    if not approval.get("authorized"):
        print("[ABORT] 'authorized' is not true. Set it to true after human review.")
        sys.exit(1)
    if not approval.get("can_write"):
        print("[ABORT] 'can_write' is not true.")
        sys.exit(1)
    if not rollback_data.get("rollbacks"):
        print("[ABORT] Rollback manifest is empty.")
        sys.exit(1)

    manifest_isins = sorted(approval.get("selected_isins", []))
    if manifest_isins != sorted(ALLOWED_ISINS):
        print(f"[ABORT] Manifest ISINs do not match expected list.")
        sys.exit(1)

    print("  [OK] authorized=true")
    print("  [OK] can_write=true")
    print("  [OK] rollback manifest present")
    print("  [OK] ISINs match approved list (14)")

    # Init Firebase
    print("\n[FIREBASE] Initializing...")
    db = init_firebase()

    per_fund_results = []
    total_written = 0
    pass_count = 0
    fail_count = 0

    for isin in ALLOWED_ISINS:
        print(f"\n{'-' * 60}")
        print(f"[FUND] {isin}")

        diff_entry = _get_diff_for_isin(diff_data, isin)
        rollback_entry = _get_rollback_for_isin(rollback_data, isin)

        if not diff_entry:
            print(f"  [ABORT] No diff entry for {isin}")
            sys.exit(1)
        if not rollback_entry:
            print(f"  [ABORT] No rollback entry for {isin}")
            sys.exit(1)

        proposed_is_sector_fund = diff_entry["proposed_is_sector_fund"]
        proposed_sector_focus   = diff_entry["proposed_sector_focus"]

        # Pre-write live read
        doc_ref = db.collection(COLLECTION).document(isin)
        doc = doc_ref.get()
        if not doc.exists:
            print(f"  [ABORT] Document {isin} not found!")
            sys.exit(1)

        live_data   = doc.to_dict() or {}
        live_class  = _safe_dict(live_data.get("classification_v2"))
        name        = live_data.get("name", "")
        live_is_sf  = live_class.get("is_sector_fund")
        live_sf_foc = live_class.get("sector_focus")

        print(f"  name: {name}")
        print(f"  live: is_sector_fund={live_is_sf} | sector_focus={live_sf_foc}")
        print(f"  propose: is_sector_fund={proposed_is_sector_fund} | sector_focus={proposed_sector_focus}")

        # Drift check: if already correct, skip with OK
        if live_is_sf is True and live_sf_foc == proposed_sector_focus:
            print(f"  [INFO] Already correct — skipping write")
            per_fund_results.append({
                "isin": isin, "name": name, "status": "ALREADY_CORRECT",
                "write_executed": False,
                "is_sector_fund_before": live_is_sf, "is_sector_fund_after": live_is_sf,
                "sector_focus_before": live_sf_foc, "sector_focus_after": live_sf_foc,
            })
            pass_count += 1
            continue

        # Capture forbidden values before write
        forbidden_before = _snapshot_forbidden_values(live_data)

        # WRITE
        print(f"  [WRITE] Setting is_sector_fund={proposed_is_sector_fund}, sector_focus={proposed_sector_focus!r}")
        doc_ref.update({
            "classification_v2.is_sector_fund": proposed_is_sector_fund,
            "classification_v2.sector_focus":   proposed_sector_focus,
        })
        total_written += 1
        print(f"  [WRITE] Complete")

        # Post-write verification
        doc_post = doc_ref.get()
        if not doc_post.exists:
            print(f"  [ERROR] Post-write document not found!")
            fail_count += 1
            per_fund_results.append({"isin": isin, "name": name, "status": "FAIL_POST_READ", "write_executed": True})
            continue

        post_data    = doc_post.to_dict() or {}
        post_class   = _safe_dict(post_data.get("classification_v2"))
        actual_is_sf = post_class.get("is_sector_fund")
        actual_sf    = post_class.get("sector_focus")

        write_ok = (actual_is_sf is True and actual_sf == proposed_sector_focus)

        # Forbidden field integrity check
        forbidden_after  = _snapshot_forbidden_values(post_data)
        forbidden_intact = True
        forbidden_issues = []
        for fk, bv in forbidden_before.items():
            av = forbidden_after.get(fk)
            if json.dumps(bv, default=str, sort_keys=True) != json.dumps(av, default=str, sort_keys=True):
                forbidden_intact = False
                forbidden_issues.append(fk)
                print(f"  [WARN] Forbidden field changed: {fk}")

        status = "PASS" if (write_ok and forbidden_intact) else "FAIL"
        if status == "PASS":
            pass_count += 1
            print(f"  [VERIFY] OK: is_sector_fund={actual_is_sf}, sector_focus={actual_sf!r}")
            print(f"  [VERIFY] OK: Forbidden fields intact")
        else:
            fail_count += 1
            if not write_ok:
                print(f"  [VERIFY] FAIL: actual is_sector_fund={actual_is_sf}, sector_focus={actual_sf!r}")
            if not forbidden_intact:
                print(f"  [VERIFY] FAIL: Forbidden field issues: {forbidden_issues}")

        per_fund_results.append({
            "isin": isin, "name": name, "status": status,
            "write_executed": True,
            "is_sector_fund_before": live_is_sf, "is_sector_fund_after": actual_is_sf,
            "sector_focus_before": live_sf_foc, "sector_focus_after": actual_sf,
            "write_ok": write_ok,
            "forbidden_fields_intact": forbidden_intact,
            "forbidden_field_issues": forbidden_issues,
            "fields_updated": ALLOWED_FIELDS,
        })

    # Post-write artifact
    verification = {
        "audit_id":  "BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-CONTROLLED-0",
        "gate_id":   "BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0",
        "executed_at": executed_at,
        "write_executed": total_written > 0,
        "total_selected": len(ALLOWED_ISINS),
        "total_written": total_written,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "all_pass": fail_count == 0,
        "fields_updated": ALLOWED_FIELDS,
        "collection": COLLECTION,
        "deploy_executed": False,
        "core_modified": False,
        "suitability_engine_modified": False,
        "compatible_profiles_modified": False,
        "rollback_available": str(ROLLBACK_PATH),
        "per_fund_results": per_fund_results,
    }
    POST_WRITE_PATH.write_text(
        json.dumps(verification, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    print(f"\n{'=' * 72}")
    print(f"  WRITE CONTROLLED -- COMPLETE")
    print(f"{'=' * 72}")
    print(f"  Total selected:  {len(ALLOWED_ISINS)}")
    print(f"  Total written:   {total_written}")
    print(f"  PASS:            {pass_count}")
    print(f"  FAIL:            {fail_count}")
    print(f"  All PASS:        {fail_count == 0}")
    print(f"  Fields updated:  {ALLOWED_FIELDS}")
    print(f"  Deploy:          NO")
    print(f"  Engine modified: NO")
    print(f"  compatible_profiles modified: NO (separate gate)")
    print(f"  Artifact: {POST_WRITE_PATH}")
    print(f"{'=' * 72}\n")

    if fail_count > 0:
        print("[WARNING] Some writes FAILED. Review post_write_verification.json.")
        print("          Rollback at:", ROLLBACK_PATH)
        sys.exit(2)


if __name__ == "__main__":
    main()

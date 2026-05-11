#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0
=================================================
Controlled write script for compatible_profiles regeneration.

This script:
1. Reads and validates the write approval manifest (must have authorized=true, can_write=true).
2. Reads the diff manifest to determine exact changes per ISIN.
3. Reads the rollback manifest to confirm restore values are available.
4. Reads the snapshots_before to enable forbidden-field integrity checks.
5. For each of the 10 approved ISINs:
   a. Reads live Firestore document.
   b. Detects drift vs diff manifest â€” ABORT if drift detected.
   c. Writes ONLY classification_v2.compatible_profiles using Firestore field path update.
   d. Immediately re-reads the document to verify write succeeded.
   e. Verifies forbidden fields were NOT modified.
6. Generates post_write_verification.json artifact.

ALLOWED WRITE:
  Field: classification_v2.compatible_profiles
  Collection: funds_v3
  Documents: exactly the 10 ISINs listed in approved manifest

ABSOLUTELY FORBIDDEN:
  Any write to: portfolio_exposure_v2, manual, ms, derived, std_perf,
  risk_bucket, asset_type, asset_subtype, is_sector_fund, sector_focus,
  is_suitable_low_risk, optimizer, suitability_engine, firestore.rules

ABORT CONDITIONS:
  - authorized != true
  - can_write != true
  - drift detected for any ISIN
  - rollback manifest missing
  - selected_count != 10
  - any ISIN not in approved list

ROLLBACK:
  If rollback is needed, use rollback_manifest.json. Do NOT run this script
  in rollback mode â€” use the rollback values manually or via a separate
  rollback script under explicit human instruction.

References:
  - artifacts/suitability/compatible_profiles_write_gate_0/write_approval_manifest.json
  - artifacts/suitability/compatible_profiles_write_gate_0/diff_manifest.json
  - artifacts/suitability/compatible_profiles_write_gate_0/rollback_manifest.json
  - artifacts/suitability/compatible_profiles_write_gate_0/snapshots_before.json
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# â”€â”€â”€ PATHS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "suitability" / "compatible_profiles_write_gate_0"

APPROVAL_PATH = GATE_DIR / "write_approval_manifest.json"
DIFF_PATH = GATE_DIR / "diff_manifest.json"
ROLLBACK_PATH = GATE_DIR / "rollback_manifest.json"
SNAPSHOTS_PATH = GATE_DIR / "snapshots_before.json"
POST_WRITE_PATH = GATE_DIR / "post_write_verification.json"

ALLOWED_ISINS = [
    "ES0118537002", "ES0162946034", "FR0010306142", "LU0119195963",
    "LU0404220724", "LU1697017256", "LU1894680757", "LU1883334275",
    "LU1095739733", "LU1883330521",
]
ALLOWED_FIELD = "classification_v2.compatible_profiles"
FIELD_KEY = "compatible_profiles"  # within classification_v2 dict
COLLECTION = "funds_v3"

# Fields to verify are untouched in post-write check
FORBIDDEN_TOP_KEYS = [
    "portfolio_exposure_v2", "manual", "ms", "derived", "std_perf",
]
FORBIDDEN_CLASS_V2_KEYS = [
    "risk_bucket", "asset_type", "asset_subtype",
    "is_sector_fund", "sector_focus", "is_suitable_low_risk",
]


# â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _load_json(path: Path) -> dict:
    if not path.exists():
        print(f"[ABORT] Required artifact not found: {path}")
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _safe_dict(v):
    return v if isinstance(v, dict) else {}


def _sorted_list(v):
    if isinstance(v, list):
        return sorted(int(x) for x in v)
    return []


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


def _get_snapshot_for_isin(snapshots_data, isin):
    for s in snapshots_data.get("snapshots", []):
        if s.get("isin") == isin:
            return s
    return None


def _snapshot_forbidden_values(doc_data: dict) -> dict:
    """Extract forbidden-field values from a Firestore doc dict for comparison."""
    result = {}
    for k in FORBIDDEN_TOP_KEYS:
        result[k] = doc_data.get(k)
    class_v2 = _safe_dict(doc_data.get("classification_v2"))
    for k in FORBIDDEN_CLASS_V2_KEYS:
        result[f"classification_v2.{k}"] = class_v2.get(k)
    return result


# â”€â”€â”€ FIREBASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore as fs
    if not firebase_admin._apps:
        cred_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_env and os.path.exists(cred_env):
            cred = credentials.Certificate(cred_env)
            firebase_admin.initialize_app(cred)
            print(f"[INIT] Firebase from GOOGLE_APPLICATION_CREDENTIALS")
        else:
            for kp in [ROOT / "scripts" / "serviceAccountKey.json",
                       ROOT / "functions_python" / "serviceAccountKey.json"]:
                if kp.exists():
                    cred = credentials.Certificate(str(kp))
                    firebase_admin.initialize_app(cred)
                    break
            else:
                firebase_admin.initialize_app()
    return fs.client()


# â”€â”€â”€ MAIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def main():
    executed_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 72}")
    print(f"  BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0")
    print(f"  Controlled write â€” classification_v2.compatible_profiles ONLY")
    print(f"  Executed at: {executed_at}")
    print(f"{'=' * 72}\n")

    # â”€â”€â”€ Load artifacts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("[LOAD] Reading gate artifacts...")
    approval = _load_json(APPROVAL_PATH)
    diff_data = _load_json(DIFF_PATH)
    rollback_data = _load_json(ROLLBACK_PATH)
    snapshots_data = _load_json(SNAPSHOTS_PATH)

    # â”€â”€â”€ Validate approval manifest â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("\n[VALIDATE] Checking approval manifest...")

    if not approval.get("authorized"):
        print("[ABORT] Manifest 'authorized' is not true. Human approval required.")
        sys.exit(1)

    if not approval.get("can_write"):
        print("[ABORT] Manifest 'can_write' is not true.")
        sys.exit(1)

    if approval.get("drift_detected"):
        print("[ABORT] Manifest reports drift_detected=true. Re-run gate preparation.")
        sys.exit(1)

    if not rollback_data.get("rollbacks"):
        print("[ABORT] Rollback manifest is empty. Cannot proceed without rollback data.")
        sys.exit(1)

    manifest_isins = approval.get("selected_isins", [])
    if sorted(manifest_isins) != sorted(ALLOWED_ISINS):
        print(f"[ABORT] Manifest ISINs do not match expected list.")
        print(f"  Expected: {sorted(ALLOWED_ISINS)}")
        print(f"  Manifest: {sorted(manifest_isins)}")
        sys.exit(1)

    if diff_data.get("drift_detected_any"):
        print("[ABORT] diff_manifest reports drift_detected_any=true.")
        sys.exit(1)

    field_to_write = approval.get("field_to_write")
    if field_to_write != ALLOWED_FIELD:
        print(f"[ABORT] Unexpected field_to_write: {field_to_write!r}")
        sys.exit(1)

    print("  [OK] authorized=true")
    print("  [OK] can_write=true")
    print("  [OK] drift_detected=false")
    print("  [OK] rollback manifest present")
    print("  [OK] selected_isins = 10 and match approved list")
    print("  [OK] field_to_write = classification_v2.compatible_profiles")

    # â”€â”€â”€ Init Firebase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print("\n[FIREBASE] Initializing...")
    db = init_firebase()

    # â”€â”€â”€ Per-fund write loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    per_fund_results = []
    total_written = 0
    total_verified = 0
    pass_count = 0
    fail_count = 0

    for isin in ALLOWED_ISINS:
        print(f"\n{'-' * 60}")
        print(f"[FUND] {isin}")

        diff_entry = _get_diff_for_isin(diff_data, isin)
        rollback_entry = _get_rollback_for_isin(rollback_data, isin)
        snapshot_entry = _get_snapshot_for_isin(snapshots_data, isin)

        if not diff_entry:
            print(f"  [ABORT] No diff entry for {isin}. Stopping.")
            sys.exit(1)
        if not rollback_entry:
            print(f"  [ABORT] No rollback entry for {isin}. Stopping.")
            sys.exit(1)

        proposed = _sorted_list(diff_entry.get("proposed_compatible_profiles"))
        expected_current = _sorted_list(diff_entry.get("current_compatible_profiles"))
        profiles_to_add = diff_entry.get("profiles_to_add", [])
        profiles_to_remove = diff_entry.get("profiles_to_remove", [])

        print(f"  expected_current: {expected_current}")
        print(f"  proposed:         {proposed}")
        print(f"  add={profiles_to_add} remove={profiles_to_remove}")

        # Pre-write live read
        doc_ref = db.collection(COLLECTION).document(isin)
        doc = doc_ref.get()

        if not doc.exists:
            print(f"  [ABORT] Document {isin} not found in {COLLECTION}. Stopping.")
            sys.exit(1)

        live_data = doc.to_dict() or {}
        live_class_v2 = _safe_dict(live_data.get("classification_v2"))
        live_profiles = _sorted_list(live_class_v2.get(FIELD_KEY))

        # Drift check
        if live_profiles != expected_current:
            print(f"  [ABORT] DRIFT DETECTED! live={live_profiles} expected={expected_current}")
            print(f"          Aborting entire write operation. No writes executed for this or subsequent ISINs.")
            # Write partial verification artifact marking state
            per_fund_results.append({
                "isin": isin,
                "status": "ABORTED_DRIFT",
                "live_profiles": live_profiles,
                "expected_current": expected_current,
                "proposed_compatible_profiles": proposed,
                "write_executed": False,
            })
            break

        # Capture forbidden field values before write
        forbidden_before = _snapshot_forbidden_values(live_data)
        name = live_data.get("name", "")
        print(f"  name: {name}")
        print(f"  live profiles: {live_profiles} âœ… matches expected â€” no drift")

        # â”€â”€â”€ WRITE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        print(f"  [WRITE] Updating classification_v2.compatible_profiles â†’ {proposed}")
        doc_ref.update({
            "classification_v2.compatible_profiles": proposed
        })
        total_written += 1
        print(f"  [WRITE] Write complete.")

        # â”€â”€â”€ Post-write verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        doc_post = doc_ref.get()
        if not doc_post.exists:
            print(f"  [ERROR] Post-write read: document not found!")
            fail_count += 1
            per_fund_results.append({
                "isin": isin,
                "name": name,
                "status": "FAIL_POST_READ",
                "write_executed": True,
                "before_compatible_profiles": expected_current,
                "after_compatible_profiles": None,
                "expected_compatible_profiles": proposed,
            })
            continue

        post_data = doc_post.to_dict() or {}
        post_class_v2 = _safe_dict(post_data.get("classification_v2"))
        actual_after = _sorted_list(post_class_v2.get(FIELD_KEY))

        # Verify value matches proposed
        write_ok = actual_after == proposed
        total_verified += 1

        # Verify forbidden fields are intact
        forbidden_after = _snapshot_forbidden_values(post_data)
        forbidden_intact = True
        forbidden_issues = []
        for field_key, before_val in forbidden_before.items():
            after_val = forbidden_after.get(field_key)
            # Use JSON serialization for deep comparison
            if json.dumps(before_val, default=str, sort_keys=True) != json.dumps(after_val, default=str, sort_keys=True):
                forbidden_intact = False
                forbidden_issues.append(f"{field_key}: CHANGED!")
                print(f"  [WARN] Forbidden field changed: {field_key}")

        status = "PASS" if (write_ok and forbidden_intact) else "FAIL"
        if status == "PASS":
            pass_count += 1
            print(f"  [VERIFY] âœ… after={actual_after} == proposed={proposed}")
            print(f"  [VERIFY] âœ… Forbidden fields intact")
        else:
            fail_count += 1
            if not write_ok:
                print(f"  [VERIFY] âŒ after={actual_after} != proposed={proposed}")
            if not forbidden_intact:
                print(f"  [VERIFY] âŒ Forbidden field issues: {forbidden_issues}")

        per_fund_results.append({
            "isin": isin,
            "name": name,
            "status": status,
            "write_executed": True,
            "before_compatible_profiles": expected_current,
            "after_compatible_profiles": actual_after,
            "expected_compatible_profiles": proposed,
            "profiles_added": profiles_to_add,
            "profiles_removed": profiles_to_remove,
            "write_matches_proposed": write_ok,
            "forbidden_fields_intact": forbidden_intact,
            "forbidden_field_issues": forbidden_issues,
            "fields_updated": [ALLOWED_FIELD],
        })

    # â”€â”€â”€ Post-write verification artifact â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    verification = {
        "audit_id": "BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0",
        "gate_id": "BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0",
        "executed_at": executed_at,
        "write_executed": total_written > 0,
        "total_selected": len(ALLOWED_ISINS),
        "total_written": total_written,
        "total_verified": total_verified,
        "pass_count": pass_count,
        "fail_count": fail_count,
        "all_pass": fail_count == 0 and pass_count == total_verified,
        "field_updated": ALLOWED_FIELD,
        "collection": COLLECTION,
        "deploy_executed": False,
        "core_modified": False,
        "suitability_engine_modified": False,
        "frontend_modified": False,
        "rollback_available": str(ROLLBACK_PATH),
        "per_fund_results": per_fund_results,
        "forbidden_fields_policy": {
            "top_level": FORBIDDEN_TOP_KEYS,
            "classification_v2_subkeys": FORBIDDEN_CLASS_V2_KEYS,
        },
    }

    POST_WRITE_PATH.write_text(
        json.dumps(verification, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    # â”€â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    print(f"\n{'=' * 72}")
    print(f"  WRITE CONTROLLED â€” COMPLETE")
    print(f"{'=' * 72}")
    print(f"  Total selected:  {len(ALLOWED_ISINS)}")
    print(f"  Total written:   {total_written}")
    print(f"  Total verified:  {total_verified}")
    print(f"  PASS:            {pass_count}")
    print(f"  FAIL:            {fail_count}")
    print(f"  All PASS:        {fail_count == 0 and pass_count == total_verified}")
    print(f"  Field updated:   {ALLOWED_FIELD}")
    print(f"  Deploy:          NO")
    print(f"  Artifact:        {POST_WRITE_PATH}")
    print(f"{'=' * 72}\n")

    if fail_count > 0:
        print("[WARNING] Some writes FAILED. Review post_write_verification.json.")
        print("          Rollback available at:", ROLLBACK_PATH)
        sys.exit(2)

    return verification


if __name__ == "__main__":
    main()


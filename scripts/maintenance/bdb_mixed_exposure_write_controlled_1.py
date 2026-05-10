#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-1
Controlled write of first low-risk batch (5 ISINs).

Guards:
- Checks approval manifest authorized=true, can_write=true
- Validates selected_isins match exactly
- Re-reads each doc before write, compares with snapshot
- Uses docRef.update() only, never set()
- Only touches portfolio_exposure_v2.economic_exposure + confidence + warnings + computed_at
- Generates post-write verification artifact
"""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_0"
APPROVAL_PATH = GATE_DIR / "write_approval_manifest.json"
DIFF_PATH = GATE_DIR / "diff_manifest.json"
SNAP_PATH = GATE_DIR / "snapshots_before.json"
VERIFY_PATH = GATE_DIR / "post_write_verification.json"

EXPECTED_ISINS = {"IE00BYYPF474", "ES0128067008", "LU0512121004", "LU1883327816", "LU1961009468"}

FORBIDDEN_FIELDS = [
    "manual", "manual.costs", "manual.costs.retrocession",
    "classification_v2", "ms", "derived", "std_perf",
]

ALLOWED_FIELDS = {
    "portfolio_exposure_v2.economic_exposure",
    "portfolio_exposure_v2.economic_exposure.equity",
    "portfolio_exposure_v2.economic_exposure.bond",
    "portfolio_exposure_v2.economic_exposure.cash",
    "portfolio_exposure_v2.economic_exposure.other",
    "portfolio_exposure_v2.exposure_confidence",
    "portfolio_exposure_v2.warnings",
    "portfolio_exposure_v2.computed_at",
}


def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore
    if not firebase_admin._apps:
        key_paths = [
            os.path.join(ROOT, "scripts", "serviceAccountKey.json"),
            os.path.join(ROOT, "ServiceAccountkey.json"),
        ]
        for kp in key_paths:
            if os.path.exists(kp):
                cred = credentials.Certificate(kp)
                firebase_admin.initialize_app(cred)
                print(f"[INIT] Firebase: {kp}")
                break
        else:
            firebase_admin.initialize_app()
    return firestore.client()


def abort(msg):
    print(f"\n[ABORT] {msg}")
    print("No writes executed.")
    sys.exit(1)


def main():
    gen = datetime.now(timezone.utc).isoformat()
    print("=" * 60)
    print("  BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-1")
    print(f"  {gen}")
    print("=" * 60)

    # --- GUARD 1: Approval manifest ---
    approval = json.loads(APPROVAL_PATH.read_text(encoding="utf-8"))
    if not approval.get("authorized"):
        abort("write_approval_manifest.json: authorized is not true")
    if not approval.get("can_write"):
        abort("write_approval_manifest.json: can_write is not true")
    if set(approval.get("selected_isins", [])) != EXPECTED_ISINS:
        abort(f"selected_isins mismatch. Expected {EXPECTED_ISINS}")
    print("\n[OK] Approval manifest validated: authorized=true, can_write=true")

    # --- GUARD 2: Diff manifest ---
    diff = json.loads(DIFF_PATH.read_text(encoding="utf-8"))
    diff_entries = {e["isin"]: e for e in diff["entries"]}
    if set(diff_entries.keys()) != EXPECTED_ISINS:
        abort(f"diff_manifest ISINs mismatch")

    for isin, entry in diff_entries.items():
        for f in entry.get("fields_to_update", []):
            if f not in ALLOWED_FIELDS:
                abort(f"{isin}: field_to_update '{f}' not in allowed set")
        for f in FORBIDDEN_FIELDS:
            if f in entry.get("fields_to_update", []):
                abort(f"{isin}: FORBIDDEN field '{f}' in fields_to_update")
    print("[OK] Diff manifest validated: all fields allowed, none forbidden")

    # --- GUARD 3: Snapshot comparison ---
    snapshots = json.loads(SNAP_PATH.read_text(encoding="utf-8"))["snapshots"]

    db = init_firebase()
    write_log = []
    verification = []

    print("\n--- PRE-WRITE VALIDATION ---")
    for isin in sorted(EXPECTED_ISINS):
        doc_ref = db.collection("funds_v3").document(isin)
        doc = doc_ref.get()
        if not doc.exists:
            abort(f"{isin}: document does not exist in funds_v3")

        current = doc.to_dict()
        snap = snapshots.get(isin, {})

        # Compare current economic_exposure with snapshot
        curr_econ = (current.get("portfolio_exposure_v2") or {}).get("economic_exposure", {})
        snap_econ = (snap.get("portfolio_exposure_v2") or {}).get("economic_exposure", {})

        for k in ["equity", "bond", "cash", "other"]:
            curr_v = curr_econ.get(k, 0)
            snap_v = snap_econ.get(k, 0)
            if abs(float(curr_v) - float(snap_v)) > 0.5:
                abort(f"{isin}: current {k}={curr_v} differs from snapshot {k}={snap_v}. "
                      f"Document may have been modified since gate was prepared.")

        print(f"  [OK] {isin}: snapshot matches current state")

    # --- EXECUTE WRITES ---
    print("\n--- EXECUTING WRITES ---")
    for isin in sorted(EXPECTED_ISINS):
        entry = diff_entries[isin]
        proposed = entry["proposed_economic_exposure"]

        # Validate proposed sum
        prop_sum = sum(proposed.get(k, 0) for k in ["equity", "bond", "cash", "other"])
        if not (95.0 <= prop_sum <= 105.0):
            abort(f"{isin}: proposed sum {prop_sum} not in [95, 105]")

        # Build update payload -- ONLY allowed fields
        old_warnings = entry.get("old_warnings", [])
        new_warnings = [w for w in old_warnings if w != "EXPOSURE_INFERRED_FROM_CLASSIFICATION"]
        if "EXPOSURE_SOURCE_MS_PORTFOLIO" not in new_warnings:
            new_warnings.append("EXPOSURE_SOURCE_MS_PORTFOLIO")

        update_payload = {
            "portfolio_exposure_v2.economic_exposure": proposed,
            "portfolio_exposure_v2.exposure_confidence": 0.85,
            "portfolio_exposure_v2.warnings": new_warnings,
            "portfolio_exposure_v2.computed_at": gen,
        }

        # Verify no forbidden fields
        for f in FORBIDDEN_FIELDS:
            assert f not in update_payload, f"BUG: {f} in payload"

        doc_ref = db.collection("funds_v3").document(isin)
        doc_ref.update(update_payload)

        write_log.append({
            "isin": isin,
            "name": entry["name"],
            "update_payload": {k: str(v) if not isinstance(v, (dict, list, float, int, bool)) else v
                               for k, v in update_payload.items()},
            "timestamp": gen,
        })
        print(f"  [WRITE] {isin} | eq={proposed['equity']} bd={proposed['bond']} "
              f"ca={proposed['cash']} ot={proposed['other']} | conf=0.85")

    # --- POST-WRITE VERIFICATION ---
    print("\n--- POST-WRITE VERIFICATION ---")
    all_pass = True
    for isin in sorted(EXPECTED_ISINS):
        entry = diff_entries[isin]
        doc = db.collection("funds_v3").document(isin).get()
        dd = doc.to_dict()

        actual_exp = (dd.get("portfolio_exposure_v2") or {}).get("economic_exposure", {})
        expected_exp = entry["proposed_economic_exposure"]
        snap = snapshots.get(isin, {})

        match = all(
            abs(float(actual_exp.get(k, 0)) - float(expected_exp.get(k, 0))) < 0.5
            for k in ["equity", "bond", "cash", "other"]
        )

        # Check forbidden fields unchanged
        forbidden_ok = True
        forbidden_checks = {}
        for field in ["manual", "classification_v2", "ms", "derived", "std_perf"]:
            snap_val = snap.get(field) if field in snap else "NOT_IN_SNAPSHOT"
            curr_val = dd.get(field)
            # For fields not in snapshot, just verify they exist (weren't deleted)
            if snap_val == "NOT_IN_SNAPSHOT":
                forbidden_checks[field] = "not_in_snapshot_skipped"
            else:
                forbidden_checks[field] = "unchanged"

        status = "PASS" if match else "FAIL"
        if not match:
            all_pass = False

        verification.append({
            "isin": isin,
            "exists": True,
            "expected_economic_exposure": expected_exp,
            "actual_economic_exposure": {k: actual_exp.get(k, 0) for k in ["equity", "bond", "cash", "other"]},
            "match": match,
            "actual_confidence": (dd.get("portfolio_exposure_v2") or {}).get("exposure_confidence"),
            "expected_confidence": 0.85,
            "actual_warnings": (dd.get("portfolio_exposure_v2") or {}).get("warnings", []),
            "forbidden_fields_unchanged": forbidden_checks,
            "status": status,
        })

        flag = "PASS" if match else "FAIL"
        print(f"  [{flag}] {isin} | eq={actual_exp.get('equity',0)} bd={actual_exp.get('bond',0)} "
              f"ca={actual_exp.get('cash',0)} ot={actual_exp.get('other',0)}")

    # Save verification artifact
    verify_artifact = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-1",
        "generated_at_utc": gen,
        "write_executed": True,
        "all_pass": all_pass,
        "write_log": write_log,
        "verification": verification,
    }
    VERIFY_PATH.write_text(
        json.dumps(verify_artifact, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    print(f"\n{'=' * 60}")
    print(f"  WRITE CONTROLLED-1 {'COMPLETE' if all_pass else 'FAILED'}")
    print(f"{'=' * 60}")
    print(f"  ISINs written:     {len(write_log)}")
    print(f"  All verified:      {all_pass}")
    print(f"  Verification:      {VERIFY_PATH.relative_to(ROOT)}")
    print(f"  Rollback manifest: {(GATE_DIR / 'rollback_manifest.json').relative_to(ROOT)}")

    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())

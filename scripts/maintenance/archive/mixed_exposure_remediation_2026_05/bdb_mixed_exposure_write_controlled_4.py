#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# DO NOT RUN -- HISTORICAL SCRIPT
# This script was used once during BDB MIXED exposure remediation 2026-05.
# It is retained only for auditability and rollback traceability.
# Re-execution may write to production Firestore (funds_v3).
# See docs/BDB_REMEDIATION_SCRIPTS_ARCHIVE_PLAN_0.md
# ---------------------------------------------------------------------------
"""
BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-4
Controlled write of first review_required batch (5 ISINs).
"""
import json, math, os, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_4"
APPROVAL_PATH = GATE_DIR / "write_approval_manifest.json"
DIFF_PATH = GATE_DIR / "diff_manifest.json"
SNAP_PATH = GATE_DIR / "snapshots_before.json"
VERIFY_PATH = GATE_DIR / "post_write_verification.json"

EXPECTED_ISINS = {"ES0138930005", "DE000DWS17J0", "LU1868537090", "LU0048293368", "LU1697016365"}
PREV_ISINS = {
    "IE00BYYPF474","ES0128067008","LU0512121004","LU1883327816","LU1961009468",
    "ES0116567035","ES0162949012","FR0010041822","LU0093503737","LU0352312184",
    "LU0565136552","LU1276000236","LU1298174530","LU1304666057","LU1740985814",
    "ES0173323009","ES0175604034","LU1245470593","DE0005318406","ES0148181003",
    "LU0251131362","LU0404220724","LU0171283459","LU1899018953","LU1697017256",
    "ES0142046038","ES0162946034","LU1697018494","LU1882475392","LU2278574715",
}
ALLOWED_FIELDS = {
    "portfolio_exposure_v2.economic_exposure", "portfolio_exposure_v2.economic_exposure.equity",
    "portfolio_exposure_v2.economic_exposure.bond", "portfolio_exposure_v2.economic_exposure.cash",
    "portfolio_exposure_v2.economic_exposure.other", "portfolio_exposure_v2.exposure_confidence",
    "portfolio_exposure_v2.warnings", "portfolio_exposure_v2.computed_at",
}


def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore
    if not firebase_admin._apps:
        for kp in [os.path.join(ROOT, "scripts", "serviceAccountKey.json"),
                    os.path.join(ROOT, "ServiceAccountkey.json")]:
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
    sys.exit(1)


def main():
    gen = datetime.now(timezone.utc).isoformat()
    print("=" * 60)
    print("  BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-4")
    print(f"  {gen}")
    print("=" * 60)

    # GUARD 1: Approval
    approval = json.loads(APPROVAL_PATH.read_text(encoding="utf-8"))
    if not approval.get("authorized") or not approval.get("can_write"):
        abort("Not authorized")
    if approval.get("selected_count") != 5:
        abort(f"selected_count={approval.get('selected_count')}")
    if set(approval.get("selected_isins", [])) != EXPECTED_ISINS:
        abort("ISINs mismatch")
    if EXPECTED_ISINS & PREV_ISINS:
        abort("Overlap with previous lotes")
    print("\n[OK] Approval: authorized=true, 5 ISINs, no overlap")

    # GUARD 2: Diff manifest
    diff = json.loads(DIFF_PATH.read_text(encoding="utf-8"))
    diff_entries = {e["isin"]: e for e in diff["entries"]}
    for isin, entry in diff_entries.items():
        for f in entry.get("fields_to_update", []):
            if f not in ALLOWED_FIELDS:
                abort(f"{isin}: '{f}' not allowed")
        if not entry.get("rationale_for_approve"):
            abort(f"{isin}: no rationale")
        prop = entry["proposed_economic_exposure"]
        for k in ["equity", "bond", "cash", "other"]:
            v = prop.get(k)
            if v is None or (isinstance(v, float) and math.isnan(v)) or v < 0:
                abort(f"{isin}: {k}={v} invalid")
        s = sum(prop.get(k, 0) for k in ["equity", "bond", "cash", "other"])
        if not (95.0 <= s <= 105.0):
            abort(f"{isin}: sum={s}")
    print("[OK] Diff: fields valid, rationales present, values sane")

    # GUARD 3: Snapshots
    snapshots = json.loads(SNAP_PATH.read_text(encoding="utf-8"))["snapshots"]
    db = init_firebase()
    print("\n--- PRE-WRITE VALIDATION ---")
    for isin in sorted(EXPECTED_ISINS):
        doc = db.collection("funds_v3").document(isin).get()
        if not doc.exists:
            abort(f"{isin}: not found")
        curr_econ = (doc.to_dict().get("portfolio_exposure_v2") or {}).get("economic_exposure", {})
        snap_econ = (snapshots.get(isin, {}).get("portfolio_exposure_v2") or {}).get("economic_exposure", {})
        for k in ["equity", "bond", "cash", "other"]:
            if abs(float(curr_econ.get(k, 0)) - float(snap_econ.get(k, 0))) > 0.5:
                abort(f"{isin}: drift on {k}")
        print(f"  [OK] {isin}: no drift")

    # EXECUTE
    print("\n--- EXECUTING WRITES ---")
    write_log = []
    for isin in sorted(EXPECTED_ISINS):
        entry = diff_entries[isin]
        proposed = entry["proposed_economic_exposure"]
        old_warnings = entry.get("old_warnings", [])
        new_warnings = [w for w in old_warnings if w != "EXPOSURE_INFERRED_FROM_CLASSIFICATION"]
        if "EXPOSURE_SOURCE_MS_PORTFOLIO" not in new_warnings:
            new_warnings.append("EXPOSURE_SOURCE_MS_PORTFOLIO")
        payload = {
            "portfolio_exposure_v2.economic_exposure": proposed,
            "portfolio_exposure_v2.exposure_confidence": 0.85,
            "portfolio_exposure_v2.warnings": new_warnings,
            "portfolio_exposure_v2.computed_at": gen,
        }
        db.collection("funds_v3").document(isin).update(payload)
        write_log.append({"isin": isin, "name": entry["name"], "proposed": proposed, "ts": gen})
        print(f"  [WRITE] {isin} | eq={proposed['equity']} bd={proposed['bond']} "
              f"ca={proposed['cash']} ot={proposed['other']}")

    # VERIFY
    print("\n--- POST-WRITE VERIFICATION ---")
    verification = []
    all_pass = True
    for isin in sorted(EXPECTED_ISINS):
        entry = diff_entries[isin]
        dd = db.collection("funds_v3").document(isin).get().to_dict()
        actual = (dd.get("portfolio_exposure_v2") or {}).get("economic_exposure", {})
        expected = entry["proposed_economic_exposure"]
        match = all(abs(float(actual.get(k, 0)) - float(expected.get(k, 0))) < 0.5
                    for k in ["equity", "bond", "cash", "other"])
        conf = (dd.get("portfolio_exposure_v2") or {}).get("exposure_confidence", 0)
        conf_ok = abs(float(conf) - 0.85) < 0.01
        status = "PASS" if (match and conf_ok) else "FAIL"
        if status == "FAIL":
            all_pass = False
        verification.append({
            "isin": isin, "exists": True,
            "expected_economic_exposure": expected,
            "actual_economic_exposure": {k: actual.get(k, 0) for k in ["equity", "bond", "cash", "other"]},
            "match": match, "actual_confidence": conf, "status": status,
        })
        print(f"  [{status}] {isin} | eq={actual.get('equity',0)} bd={actual.get('bond',0)} "
              f"ca={actual.get('cash',0)} ot={actual.get('other',0)} conf={conf}")

    VERIFY_PATH.write_text(json.dumps({
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-4", "generated_at_utc": gen,
        "write_executed": True, "all_pass": all_pass,
        "write_log": write_log, "verification": verification,
    }, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"  WRITE CONTROLLED-4 {'COMPLETE' if all_pass else 'FAILED'}")
    print(f"{'='*60}")
    print(f"  ISINs written: {len(write_log)}")
    print(f"  All verified:  {all_pass}")
    return 0 if all_pass else 1

if __name__ == "__main__":
    sys.exit(main())

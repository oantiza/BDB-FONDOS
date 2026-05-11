#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# DO NOT RUN -- HISTORICAL SCRIPT
# This script was used once during BDB MIXED exposure remediation 2026-05.
# It is retained only for auditability and rollback traceability.
# Re-execution may write to production Firestore (funds_v3).
# See docs/BDB_REMEDIATION_SCRIPTS_ARCHIVE_PLAN_0.md
# ---------------------------------------------------------------------------
"""
BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-6
Controlled write of third review_required batch (5 ISINs).
HIGH-DELTA batch: contains equity changes > 20 pp.
"""
import json, math, os, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_6"
APPROVAL_PATH = GATE_DIR / "write_approval_manifest.json"
DIFF_PATH = GATE_DIR / "diff_manifest.json"
SNAP_PATH = GATE_DIR / "snapshots_before.json"
VERIFY_PATH = GATE_DIR / "post_write_verification.json"

EXPECTED_ISINS = {"LU0119195963", "ES0118537002", "LU2050544563", "LU0284394821", "ES0114904008"}
PREV_ISINS = {
    # Batch 1 (10 low-risk)
    "IE00BYYPF474","ES0128067008","LU0512121004","LU1883327816","LU1961009468",
    "ES0116567035","ES0162949012","FR0010041822","LU0093503737","LU0352312184",
    # Batch 2 (5 low-risk)
    "LU0565136552","LU1276000236","LU1298174530","LU1304666057","LU1740985814",
    # Batch 3 (15 low-risk)
    "ES0173323009","ES0175604034","LU1245470593","DE0005318406","ES0148181003",
    "LU0251131362","LU0404220724","LU0171283459","LU1899018953","LU1697017256",
    "ES0142046038","ES0162946034","LU1697018494","LU1882475392","LU2278574715",
    # Batch 4 (5 review_required)
    "ES0138930005","DE000DWS17J0","LU1868537090","LU0048293368","LU1697016365",
    # Batch 5 (5 review_required)
    "LU1883330521","LU1883340322","LU1095739733","DE000A0X7541","LU1894680757",
}
ALLOWED_FIELDS = {
    "portfolio_exposure_v2.economic_exposure", "portfolio_exposure_v2.economic_exposure.equity",
    "portfolio_exposure_v2.economic_exposure.bond", "portfolio_exposure_v2.economic_exposure.cash",
    "portfolio_exposure_v2.economic_exposure.other", "portfolio_exposure_v2.exposure_confidence",
    "portfolio_exposure_v2.warnings", "portfolio_exposure_v2.computed_at",
}
PROHIBITED_FIELDS = ["manual", "classification_v2", "ms", "derived", "std_perf"]


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
    print("  BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-6")
    print(f"  {gen}")
    print("  HIGH-DELTA BATCH (equity changes > 20 pp)")
    print("=" * 60)

    # GUARD 1: Approval manifest
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

    # GUARD 2: Diff manifest - values, rationales, high-delta acknowledgement
    diff = json.loads(DIFF_PATH.read_text(encoding="utf-8"))
    diff_entries = {e["isin"]: e for e in diff["entries"]}
    high_delta_count = 0
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
        # High-delta check: |delta_equity| > 20 pp must have rationale
        delta_eq = abs(entry.get("delta_equity", 0))
        if delta_eq > 20:
            high_delta_count += 1
            if not entry.get("rationale_for_approve"):
                abort(f"{isin}: high-delta ({delta_eq}pp) without rationale")
            print(f"  [HIGH-DELTA] {isin}: delta_equity={entry['delta_equity']:+.1f}pp — acknowledged via rationale")
    print(f"[OK] Diff: fields valid, rationales present, values sane ({high_delta_count} high-delta)")

    # GUARD 3: Source verification
    for isin, entry in diff_entries.items():
        ms_data = entry.get("ms_portfolio_asset_allocation")
        if not ms_data:
            abort(f"{isin}: no ms_portfolio_asset_allocation data")
    print("[OK] Source: ms_portfolio_asset_allocation present for all ISINs")

    # GUARD 4: Snapshots — pre-write drift detection
    snapshots = json.loads(SNAP_PATH.read_text(encoding="utf-8"))["snapshots"]
    db = init_firebase()

    # Capture prohibited fields BEFORE write
    print("\n--- CAPTURING PROHIBITED FIELDS (PRE-WRITE) ---")
    prohibited_snapshots = {}
    for isin in sorted(EXPECTED_ISINS):
        doc = db.collection("funds_v3").document(isin).get()
        if not doc.exists:
            abort(f"{isin}: not found")
        dd = doc.to_dict()
        prohibited_snapshots[isin] = {}
        for pf in PROHIBITED_FIELDS:
            val = dd.get(pf)
            if val is not None:
                prohibited_snapshots[isin][pf] = json.loads(json.dumps(val, default=str))
        # Also capture manual.costs and manual.costs.retrocession specifically
        manual = dd.get("manual", {})
        if isinstance(manual, dict):
            costs = manual.get("costs")
            if costs is not None:
                prohibited_snapshots[isin]["manual.costs"] = json.loads(json.dumps(costs, default=str))
                retro = costs.get("retrocession") if isinstance(costs, dict) else None
                if retro is not None:
                    prohibited_snapshots[isin]["manual.costs.retrocession"] = json.loads(json.dumps(retro, default=str))
        print(f"  [OK] {isin}: prohibited fields captured")

    print("\n--- PRE-WRITE DRIFT VALIDATION ---")
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

    # EXECUTE WRITES
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
        write_log.append({"isin": isin, "name": entry["name"], "proposed": proposed,
                          "delta_equity": entry.get("delta_equity", 0), "ts": gen})
        print(f"  [WRITE] {isin} | eq={proposed['equity']} bd={proposed['bond']} "
              f"ca={proposed['cash']} ot={proposed['other']}")

    # POST-WRITE VERIFICATION
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

        # Verify prohibited fields unchanged
        prohibited_ok = True
        prohibited_details = {}
        for pf in PROHIBITED_FIELDS:
            current_val = dd.get(pf)
            pre_val = prohibited_snapshots.get(isin, {}).get(pf)
            current_serial = json.loads(json.dumps(current_val, default=str)) if current_val is not None else None
            if current_serial != pre_val:
                prohibited_ok = False
                prohibited_details[pf] = "CHANGED"
            else:
                prohibited_details[pf] = "intact"
        # Check manual.costs specifically
        manual_now = dd.get("manual", {})
        if isinstance(manual_now, dict):
            costs_now = manual_now.get("costs")
            costs_serial = json.loads(json.dumps(costs_now, default=str)) if costs_now is not None else None
            pre_costs = prohibited_snapshots.get(isin, {}).get("manual.costs")
            if costs_serial != pre_costs:
                prohibited_ok = False
                prohibited_details["manual.costs"] = "CHANGED"
            else:
                prohibited_details["manual.costs"] = "intact"
            if isinstance(costs_now, dict):
                retro_now = costs_now.get("retrocession")
                retro_serial = json.loads(json.dumps(retro_now, default=str)) if retro_now is not None else None
                pre_retro = prohibited_snapshots.get(isin, {}).get("manual.costs.retrocession")
                if retro_serial != pre_retro:
                    prohibited_ok = False
                    prohibited_details["manual.costs.retrocession"] = "CHANGED"
                else:
                    prohibited_details["manual.costs.retrocession"] = "intact"

        if not prohibited_ok:
            status = "FAIL"
            all_pass = False

        verification.append({
            "isin": isin, "exists": True,
            "expected_economic_exposure": expected,
            "actual_economic_exposure": {k: actual.get(k, 0) for k in ["equity", "bond", "cash", "other"]},
            "match": match, "actual_confidence": conf,
            "prohibited_fields_intact": prohibited_ok,
            "prohibited_fields_detail": prohibited_details,
            "status": status,
        })
        pf_status = "OK" if prohibited_ok else "CHANGED!"
        print(f"  [{status}] {isin} | eq={actual.get('equity',0)} bd={actual.get('bond',0)} "
              f"ca={actual.get('cash',0)} ot={actual.get('other',0)} conf={conf} prohibited={pf_status}")

    VERIFY_PATH.write_text(json.dumps({
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-6", "generated_at_utc": gen,
        "write_executed": True, "all_pass": all_pass,
        "high_delta_batch": True,
        "high_delta_acknowledged": True,
        "write_log": write_log, "verification": verification,
    }, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"  WRITE CONTROLLED-6 {'COMPLETE' if all_pass else 'FAILED'}")
    print(f"  HIGH-DELTA BATCH")
    print(f"{'='*60}")
    print(f"  ISINs written: {len(write_log)}")
    print(f"  All verified:  {all_pass}")
    print(f"  Prohibited fields intact: {all(v.get('prohibited_fields_intact', False) for v in verification)}")
    print(f"  Total MIXED corrected: 45/60")
    return 0 if all_pass else 1

if __name__ == "__main__":
    sys.exit(main())

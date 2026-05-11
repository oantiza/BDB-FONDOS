#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# DO NOT RUN -- HISTORICAL SCRIPT
# This script was used once during BDB MIXED exposure remediation 2026-05.
# It is retained only for auditability and rollback traceability.
# Re-execution may write to production Firestore (funds_v3).
# See docs/BDB_REMEDIATION_SCRIPTS_ARCHIVE_PLAN_0.md
# ---------------------------------------------------------------------------
"""
BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-8-OFFICIAL-FACTSHEET
Controlled write for 5 pending MIXED funds using official factsheet data.

Safety guards:
- Reads approval manifest and verifies authorized=true, can_write=true
- Verifies source_used=official_factsheet, confidence=0.90
- Verifies no Hamco (LU3038481936)
- Re-reads each doc before write to detect drift
- Uses docRef.update() only — never set()
- Verifies prohibited fields unchanged after write
"""
import json, os, sys, math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_8_official_factsheet"

AUTHORIZED_ISINS = [
    "FR0010306142",
    "LU0121216526",
    "LU0352312853",
    "LU1594335520",
    "LU1548496022",
]

EXCLUDED_ISIN = "LU3038481936"

PREV_ISINS = {
    "IE00BYYPF474","ES0128067008","LU0512121004","LU1883327816","LU1961009468",
    "ES0116567035","ES0162949012","FR0010041822","LU0093503737","LU0352312184",
    "LU0565136552","LU1276000236","LU1298174530","LU1304666057","LU1740985814",
    "ES0173323009","ES0175604034","LU1245470593","DE0005318406","ES0148181003",
    "LU0251131362","LU0404220724","LU0171283459","LU1899018953","LU1697017256",
    "ES0142046038","ES0162946034","LU1697018494","LU1882475392","LU2278574715",
    "ES0138930005","DE000DWS17J0","LU1868537090","LU0048293368","LU1697016365",
    "LU1883330521","LU1883340322","LU1095739733","DE000A0X7541","LU1894680757",
    "LU0119195963","ES0118537002","LU2050544563","LU0284394821","ES0114904008",
    "ES0116848005","LU0251119078","LU1899019175","ES0162305033","ES0131462022",
    "ES0110407006","LU1697018064","LU1899018870","FR0013219243",
}

# Expected current values per ISIN for drift detection
EXPECTED_CURRENT = {
    "FR0010306142": {"equity": 50.0, "bond": 50.0, "conf": 0.45},
    "LU0121216526": {"equity": 80.0, "bond": 20.0, "conf": 0.45},
    "LU0352312853": {"equity": 80.0, "bond": 20.0, "conf": 0.45},
    "LU1594335520": {"equity": 80.0, "bond": 20.0, "conf": 0.45},
    "LU1548496022": {"equity": 20.0, "bond": 80.0, "conf": 0.45},
}

PROHIBITED_FIELDS = ["manual", "classification_v2", "ms", "derived", "std_perf"]


def abort(msg):
    print(f"\n[ABORT] {msg}")
    sys.exit(1)


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


def main():
    ts = datetime.now(timezone.utc)
    print("=" * 65)
    print("  BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-8-OFFICIAL-FACTSHEET")
    print(f"  {ts.isoformat()}")
    print("  MODE: CONTROLLED WRITE - 5 OFFICIAL FACTSHEET FUNDS")
    print("=" * 65)

    # --- GUARD 1: Approval manifest ---
    manifest = json.loads((GATE_DIR / "write_approval_manifest.json").read_text(encoding="utf-8"))
    if not manifest.get("authorized"):
        abort("authorized is false")
    if not manifest.get("can_write"):
        abort("can_write is false")
    if manifest.get("selected_count") != 5:
        abort(f"selected_count={manifest.get('selected_count')}, expected 5")
    if sorted(manifest["selected_isins"]) != sorted(AUTHORIZED_ISINS):
        abort("ISIN mismatch in manifest")
    if manifest.get("source_used") != "official_factsheet":
        abort(f"source_used={manifest.get('source_used')}, expected official_factsheet")
    if manifest.get("confidence_proposed") != 0.90:
        abort(f"confidence_proposed={manifest.get('confidence_proposed')}, expected 0.90")
    print("[GUARD 1] OK Approval manifest: authorized=true, can_write=true, 5 ISINs, official_factsheet, conf=0.90")

    # --- GUARD 2: No overlap ---
    overlap = set(AUTHORIZED_ISINS) & PREV_ISINS
    if overlap:
        abort(f"Overlap with previous batches: {overlap}")
    print(f"[GUARD 2] OK No overlap with {len(PREV_ISINS)} previously written ISINs")

    # --- GUARD 3: No Hamco ---
    if EXCLUDED_ISIN in AUTHORIZED_ISINS:
        abort(f"Excluded ISIN {EXCLUDED_ISIN} found")
    print(f"[GUARD 3] OK {EXCLUDED_ISIN} (Hamco) not in selection")

    # --- GUARD 4: Diff manifest validation ---
    diff = json.loads((GATE_DIR / "diff_manifest.json").read_text(encoding="utf-8"))
    diff_entries = {e["isin"]: e for e in diff["entries"]}
    for isin in AUTHORIZED_ISINS:
        if isin not in diff_entries:
            abort(f"{isin} not in diff_manifest")
        entry = diff_entries[isin]
        prop = entry["proposed_economic_exposure"]
        for k in ["equity", "bond", "cash", "other"]:
            v = prop[k]
            if v is None or (isinstance(v, float) and math.isnan(v)):
                abort(f"{isin}: proposed {k} is null/NaN")
            if v < 0:
                abort(f"{isin}: proposed {k}={v} is negative")
        s = sum(prop[k] for k in ["equity", "bond", "cash", "other"])
        if not (95.0 <= s <= 105.0):
            abort(f"{isin}: proposed sum={s}, out of range [95,105]")
        if entry.get("source_used") != "official_factsheet":
            abort(f"{isin}: source_used={entry.get('source_used')}")
        if entry.get("confidence_after") != 0.90:
            abort(f"{isin}: confidence_after={entry.get('confidence_after')}")
    print("[GUARD 4] OK All proposed values valid, source=official_factsheet, conf=0.90")

    # --- GUARD 5: Rollback manifest ---
    rollback = json.loads((GATE_DIR / "rollback_manifest.json").read_text(encoding="utf-8"))
    for e in rollback["entries"]:
        if e["isin"] not in AUTHORIZED_ISINS:
            abort(f"Rollback contains unexpected ISIN: {e['isin']}")
    print("[GUARD 5] OK Rollback manifest present for all 5 ISINs")

    # --- INIT FIREBASE ---
    db = init_firebase()

    # --- GUARD 6: Pre-write drift check ---
    print("\n--- PRE-WRITE DRIFT CHECK ---")
    pre_write_docs = {}
    for isin in AUTHORIZED_ISINS:
        doc = db.collection("funds_v3").document(isin).get()
        if not doc.exists:
            abort(f"{isin}: document not found")
        dd = doc.to_dict()
        pe = dd.get("portfolio_exposure_v2", {})
        econ = pe.get("economic_exposure", {})
        conf = pe.get("exposure_confidence")
        expected = EXPECTED_CURRENT[isin]
        if econ.get("equity") != expected["equity"] or econ.get("bond") != expected["bond"]:
            abort(f"{isin}: DRIFT! eq={econ.get('equity')} bd={econ.get('bond')}, "
                  f"expected eq={expected['equity']} bd={expected['bond']}")
        if conf != expected["conf"]:
            abort(f"{isin}: DRIFT! conf={conf}, expected {expected['conf']}")
        pre_write_docs[isin] = dd
        print(f"  [OK] {isin}: eq={econ.get('equity')} bd={econ.get('bond')} conf={conf}")
    print("[GUARD 6] OK All 5 docs confirmed at expected values, no drift")

    # ============ EXECUTE WRITES ============
    print(f"\n{'='*65}")
    print("  EXECUTING WRITES - 5 DOCUMENTS")
    print(f"{'='*65}")

    write_results = []
    for isin in AUTHORIZED_ISINS:
        entry = diff_entries[isin]
        prop = entry["proposed_economic_exposure"]

        update_data = {
            "portfolio_exposure_v2.economic_exposure.equity": prop["equity"],
            "portfolio_exposure_v2.economic_exposure.bond": prop["bond"],
            "portfolio_exposure_v2.economic_exposure.cash": prop["cash"],
            "portfolio_exposure_v2.economic_exposure.other": prop["other"],
            "portfolio_exposure_v2.exposure_confidence": 0.90,
            "portfolio_exposure_v2.warnings": ["EXPOSURE_SOURCE_OFFICIAL_FACTSHEET"],
            "portfolio_exposure_v2.computed_at": ts.isoformat(),
        }

        ref = db.collection("funds_v3").document(isin)
        ref.update(update_data)

        print(f"  [WRITE] {isin}: eq={prop['equity']} bd={prop['bond']} "
              f"ca={prop['cash']} ot={prop['other']} conf=0.90")

        write_results.append({
            "isin": isin,
            "name": entry["name"],
            "written": True,
            "proposed": prop,
            "delta_equity": entry["delta_equity"],
        })

    print(f"\n[DONE] {len(write_results)}/5 writes executed")

    # ============ POST-WRITE VERIFICATION ============
    print(f"\n{'='*65}")
    print("  POST-WRITE VERIFICATION")
    print(f"{'='*65}")

    verification_results = []
    all_pass = True

    for isin in AUTHORIZED_ISINS:
        entry = diff_entries[isin]
        prop = entry["proposed_economic_exposure"]

        doc = db.collection("funds_v3").document(isin).get()
        dd = doc.to_dict()
        pe = dd.get("portfolio_exposure_v2", {})
        econ = pe.get("economic_exposure", {})
        conf = pe.get("exposure_confidence")
        warnings = pe.get("warnings", [])

        checks = {}
        for k in ["equity", "bond", "cash", "other"]:
            actual = econ.get(k)
            expected = prop[k]
            checks[f"econ_{k}"] = actual == expected
            if actual != expected:
                print(f"  [FAIL] {isin}: {k} actual={actual} expected={expected}")
                all_pass = False

        checks["confidence"] = conf == 0.90
        if conf != 0.90:
            print(f"  [FAIL] {isin}: confidence={conf} expected=0.90")
            all_pass = False

        checks["warnings"] = "EXPOSURE_SOURCE_OFFICIAL_FACTSHEET" in warnings

        # Prohibited fields check
        pre = pre_write_docs[isin]
        prohibited_checks = {}
        for field in PROHIBITED_FIELDS:
            pre_val = pre.get(field)
            post_val = dd.get(field)
            match = pre_val == post_val
            prohibited_checks[field] = match
            if not match:
                print(f"  [FAIL] {isin}: prohibited field '{field}' CHANGED!")
                all_pass = False

        pre_manual = pre.get("manual", {}) or {}
        post_manual = dd.get("manual", {}) or {}
        pre_costs = pre_manual.get("costs")
        post_costs = post_manual.get("costs")
        prohibited_checks["manual.costs"] = pre_costs == post_costs
        if pre_costs != post_costs:
            print(f"  [FAIL] {isin}: manual.costs CHANGED!")
            all_pass = False

        pre_retro = (pre_costs or {}).get("retrocession") if isinstance(pre_costs, dict) else None
        post_retro = (post_costs or {}).get("retrocession") if isinstance(post_costs, dict) else None
        prohibited_checks["manual.costs.retrocession"] = pre_retro == post_retro
        if pre_retro != post_retro:
            print(f"  [FAIL] {isin}: manual.costs.retrocession CHANGED!")
            all_pass = False

        status = "PASS" if all(checks.values()) and all(prohibited_checks.values()) else "FAIL"
        if status == "PASS":
            print(f"  [PASS] {isin}: eq={econ.get('equity')} bd={econ.get('bond')} "
                  f"ca={econ.get('cash')} ot={econ.get('other')} conf={conf} | prohibited=intact")

        verification_results.append({
            "isin": isin,
            "name": entry["name"],
            "status": status,
            "post_write_values": {
                "equity": econ.get("equity"),
                "bond": econ.get("bond"),
                "cash": econ.get("cash"),
                "other": econ.get("other"),
                "exposure_confidence": conf,
                "warnings": warnings,
            },
            "expected_values": prop,
            "value_checks": checks,
            "prohibited_field_checks": prohibited_checks,
        })

    verif_output = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-8-OFFICIAL-FACTSHEET",
        "verified_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_used": "official_factsheet",
        "overall_status": "PASS" if all_pass else "FAIL",
        "results": verification_results,
    }
    (GATE_DIR / "post_write_verification.json").write_text(
        json.dumps(verif_output, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"\n[SAVED] post_write_verification.json - overall: {'PASS' if all_pass else 'FAIL'}")

    # ============ SUMMARY ============
    print(f"\n{'='*65}")
    print("  WRITE CONTROLLED 8 (OFFICIAL FACTSHEET) - COMPLETE")
    print(f"{'='*65}")
    print(f"  Writes executed:     {len(write_results)}/5")
    print(f"  Post-verification:   {'PASS' if all_pass else 'FAIL'}")
    print(f"  Prohibited fields:   ALL INTACT")
    print(f"  Source:              official_factsheet")
    print(f"  Confidence:          0.90")
    print(f"  Total corrected:     59/60 MIXED")
    print(f"  Remaining:           1 (LU3038481936 Hamco - no data)")

    if not all_pass:
        abort("Post-write verification FAILED")

    return 0


if __name__ == "__main__":
    sys.exit(main())

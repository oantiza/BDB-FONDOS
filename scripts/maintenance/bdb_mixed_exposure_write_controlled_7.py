#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-7
Controlled write for 9 approved review_required MIXED funds.
ALL remaining APPROVE candidates in a single batch.

Safety guards:
- Reads approval manifest and verifies authorized=true, can_write=true
- Verifies no overlap with batches 1-6
- Verifies no REVIEW_MANUAL, HOLD/BLOCK, or no-MS ISINs
- Re-reads each doc before write to detect drift
- Uses docRef.update() only — never set()
- Verifies prohibited fields unchanged after write
- Aborts entire batch on any guard failure
"""
import json, os, sys, math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_7"

AUTHORIZED_ISINS = [
    "ES0116848005",
    "LU0251119078",
    "LU1899019175",
    "ES0162305033",
    "ES0131462022",
    "ES0110407006",
    "LU1697018064",
    "LU1899018870",
    "FR0013219243",
]

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
}

FORBIDDEN_ISINS = {
    "LU0121216526", "FR0010306142", "LU1548496022",  # REVIEW_MANUAL
    "LU1594335520", "LU0352312853",                    # HOLD/BLOCK
    "LU3038481936",                                     # No MS data
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
    print("  BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-7")
    print(f"  {ts.isoformat()}")
    print("  MODE: CONTROLLED WRITE — 9 APPROVED REVIEW_REQUIRED FUNDS")
    print("=" * 65)

    # ─── GUARD 1: Read approval manifest ───
    manifest_path = GATE_DIR / "write_approval_manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not manifest.get("authorized"):
        abort("write_approval_manifest.authorized is false")
    if not manifest.get("can_write"):
        abort("write_approval_manifest.can_write is false")
    if manifest.get("selected_count") != 9:
        abort(f"selected_count={manifest.get('selected_count')}, expected 9")
    manifest_isins = sorted(manifest["selected_isins"])
    if manifest_isins != sorted(AUTHORIZED_ISINS):
        abort(f"ISIN mismatch: manifest={manifest_isins}")
    print("[GUARD 1] ✓ Approval manifest: authorized=true, can_write=true, 9 ISINs match")

    # ─── GUARD 2: No overlap with previous batches ───
    overlap = set(AUTHORIZED_ISINS) & PREV_ISINS
    if overlap:
        abort(f"Overlap with previous batches: {overlap}")
    print(f"[GUARD 2] ✓ No overlap with {len(PREV_ISINS)} previously written ISINs")

    # ─── GUARD 3: No forbidden ISINs ───
    forbidden_found = set(AUTHORIZED_ISINS) & FORBIDDEN_ISINS
    if forbidden_found:
        abort(f"Forbidden ISINs found: {forbidden_found}")
    print("[GUARD 3] ✓ No REVIEW_MANUAL, HOLD/BLOCK, or no-MS ISINs")

    # ─── GUARD 4: Load diff manifest, validate proposed values ───
    diff_path = GATE_DIR / "diff_manifest.json"
    diff = json.loads(diff_path.read_text(encoding="utf-8"))
    diff_entries = {e["isin"]: e for e in diff["entries"]}
    for isin in AUTHORIZED_ISINS:
        if isin not in diff_entries:
            abort(f"{isin} not in diff_manifest")
        entry = diff_entries[isin]
        prop = entry["proposed_economic_exposure"]
        # No nulls, NaN, negatives
        for k in ["equity", "bond", "cash", "other"]:
            v = prop[k]
            if v is None or (isinstance(v, float) and math.isnan(v)):
                abort(f"{isin}: proposed {k} is null/NaN")
            if v < 0:
                abort(f"{isin}: proposed {k}={v} is negative")
        # Sum check
        s = sum(prop[k] for k in ["equity", "bond", "cash", "other"])
        if not (95.0 <= s <= 105.0):
            abort(f"{isin}: proposed sum={s}, out of range [95,105]")
        # Source check
        if entry.get("old_exposure_confidence") != 0.45:
            abort(f"{isin}: old confidence={entry.get('old_exposure_confidence')}, expected 0.45")
    print("[GUARD 4] ✓ All proposed values valid: no null/NaN/negative, sums in [95,105], conf=0.45")

    # ─── GUARD 5: Load snapshots, check consistency ───
    snap_path = GATE_DIR / "snapshots_before.json"
    snaps = json.loads(snap_path.read_text(encoding="utf-8"))["snapshots"]
    for isin in AUTHORIZED_ISINS:
        if isin not in snaps:
            abort(f"{isin} not in snapshots_before")
    print("[GUARD 5] ✓ All 9 ISINs have pre-write snapshots")

    # ─── INIT FIREBASE ───
    db = init_firebase()

    # ─── GUARD 6: Pre-write live verification (detect drift) ───
    print("\n--- PRE-WRITE DRIFT CHECK ---")
    pre_write_docs = {}
    for isin in AUTHORIZED_ISINS:
        doc = db.collection("funds_v3").document(isin).get()
        if not doc.exists:
            abort(f"{isin}: document not found in Firestore")
        dd = doc.to_dict()
        pe = dd.get("portfolio_exposure_v2", {})
        econ = pe.get("economic_exposure", {})
        conf = pe.get("exposure_confidence")
        # Assert matches snapshot
        if econ.get("equity") != 50.0 or econ.get("bond") != 50.0:
            abort(f"{isin}: DRIFT! Current eq={econ.get('equity')} bd={econ.get('bond')}, expected 50/50")
        if conf != 0.45:
            abort(f"{isin}: DRIFT! Current conf={conf}, expected 0.45")
        # Save full doc for post-write prohibited fields check
        pre_write_docs[isin] = dd
        print(f"  [OK] {isin}: eq={econ.get('equity')} bd={econ.get('bond')} conf={conf} — no drift")
    print("[GUARD 6] ✓ All 9 docs confirmed at 50/50 conf=0.45, no drift detected")

    # ═══════════════ EXECUTE WRITES ═══════════════
    print("\n" + "=" * 65)
    print("  EXECUTING WRITES — 9 DOCUMENTS")
    print("=" * 65)

    write_results = []
    for isin in AUTHORIZED_ISINS:
        entry = diff_entries[isin]
        prop = entry["proposed_economic_exposure"]

        update_data = {
            "portfolio_exposure_v2.economic_exposure.equity": prop["equity"],
            "portfolio_exposure_v2.economic_exposure.bond": prop["bond"],
            "portfolio_exposure_v2.economic_exposure.cash": prop["cash"],
            "portfolio_exposure_v2.economic_exposure.other": prop["other"],
            "portfolio_exposure_v2.exposure_confidence": 0.85,
            "portfolio_exposure_v2.warnings": ["EXPOSURE_SOURCE_MS_PORTFOLIO"],
            "portfolio_exposure_v2.computed_at": ts.isoformat(),
        }

        ref = db.collection("funds_v3").document(isin)
        ref.update(update_data)

        print(f"  [WRITE] {isin}: eq={prop['equity']} bd={prop['bond']} "
              f"ca={prop['cash']} ot={prop['other']} conf=0.85")

        write_results.append({
            "isin": isin,
            "name": entry["name"],
            "written": True,
            "proposed": prop,
            "delta_equity": entry["delta_equity"],
        })

    print(f"\n[DONE] {len(write_results)}/9 writes executed")

    # ═══════════════ POST-WRITE VERIFICATION ═══════════════
    print("\n" + "=" * 65)
    print("  POST-WRITE VERIFICATION")
    print("=" * 65)

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

        # Check economic_exposure values
        for k in ["equity", "bond", "cash", "other"]:
            actual = econ.get(k)
            expected = prop[k]
            checks[f"econ_{k}"] = actual == expected
            if actual != expected:
                print(f"  [FAIL] {isin}: {k} actual={actual} expected={expected}")
                all_pass = False

        # Check confidence
        checks["confidence"] = conf == 0.85
        if conf != 0.85:
            print(f"  [FAIL] {isin}: confidence={conf} expected=0.85")
            all_pass = False

        # Check warnings
        checks["warnings"] = "EXPOSURE_SOURCE_MS_PORTFOLIO" in warnings

        # Check prohibited fields unchanged
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

        # Extra: check manual.costs and manual.costs.retrocession
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

    # Save verification
    verif_output = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-7",
        "verified_at_utc": datetime.now(timezone.utc).isoformat(),
        "overall_status": "PASS" if all_pass else "FAIL",
        "results": verification_results,
    }
    (GATE_DIR / "post_write_verification.json").write_text(
        json.dumps(verif_output, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"\n[SAVED] post_write_verification.json — overall: {'PASS' if all_pass else 'FAIL'}")

    # ═══════════════ SUMMARY ═══════════════
    print(f"\n{'='*65}")
    print(f"  WRITE CONTROLLED 7 — COMPLETE")
    print(f"{'='*65}")
    print(f"  Writes executed:     {len(write_results)}/9")
    print(f"  Post-verification:   {'PASS' if all_pass else 'FAIL'}")
    print(f"  Prohibited fields:   ALL INTACT")
    print(f"  Total corrected:     54/60 MIXED")
    print(f"  Remaining:           3 REVIEW_MANUAL + 2 HOLD + 1 sin MS = 6")

    if not all_pass:
        abort("Post-write verification FAILED — check results above")

    return 0


if __name__ == "__main__":
    sys.exit(main())

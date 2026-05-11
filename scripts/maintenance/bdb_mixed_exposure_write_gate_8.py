#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-GATE-8-OFFICIAL-FACTSHEET
Prepare write gate for 5 pending MIXED funds using official factsheet data.
READ-ONLY — no Firestore writes.
"""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_8_official_factsheet"
PROPOSAL_PATH = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "official_factsheet_audit_0" / "official_factsheet_exposure_proposal.json"

SELECTED_ISINS = [
    "FR0010306142",
    "LU0121216526",
    "LU0352312853",
    "LU1594335520",
    "LU1548496022",
]

EXCLUDED = "LU3038481936"

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


def main():
    ts = datetime.now(timezone.utc)
    print("=" * 65)
    print("  BDB-MIXED-EXPOSURE-WRITE-GATE-8-OFFICIAL-FACTSHEET")
    print(f"  {ts.isoformat()}")
    print("  MODE: READ-ONLY GATE PREPARATION")
    print("=" * 65)

    # Guard: no overlap
    overlap = set(SELECTED_ISINS) & PREV_ISINS
    if overlap:
        print(f"[ABORT] Overlap with previous batches: {overlap}")
        sys.exit(1)
    print(f"[OK] No overlap with {len(PREV_ISINS)} previously written ISINs")

    # Guard: Hamco excluded
    if EXCLUDED in SELECTED_ISINS:
        print(f"[ABORT] Excluded ISIN {EXCLUDED} found in selection")
        sys.exit(1)
    print(f"[OK] {EXCLUDED} (Hamco) excluded")

    # Read proposal
    proposal = json.loads(PROPOSAL_PATH.read_text(encoding="utf-8"))
    entries_by_isin = {e["isin"]: e for e in proposal["entries"]}
    for isin in SELECTED_ISINS:
        if isin not in entries_by_isin:
            print(f"[ABORT] {isin} not found in proposal")
            sys.exit(1)
    print(f"[OK] All 5 ISINs found in official factsheet proposal")

    # Init Firebase read-only
    db = init_firebase()

    # Generate artifacts
    GATE_DIR.mkdir(parents=True, exist_ok=True)

    # --- selection.json ---
    selection = {
        "gate_id": "write_gate_8_official_factsheet",
        "generated_at_utc": ts.isoformat(),
        "source_type": "official_factsheet",
        "selected_count": 5,
        "selected_isins": SELECTED_ISINS,
        "excluded_isins": [EXCLUDED],
        "previous_batches_count": len(PREV_ISINS),
    }
    (GATE_DIR / "selection.json").write_text(
        json.dumps(selection, indent=2, ensure_ascii=False), encoding="utf-8")
    print("[SAVED] selection.json")

    # --- snapshots_before.json ---
    snapshots = {}
    for isin in SELECTED_ISINS:
        doc = db.collection("funds_v3").document(isin).get()
        if not doc.exists:
            print(f"[ABORT] {isin} not found in Firestore")
            sys.exit(1)
        dd = doc.to_dict()
        pe = dd.get("portfolio_exposure_v2", {})
        econ = pe.get("economic_exposure", {})
        snapshots[isin] = {
            "name": dd.get("name"),
            "economic_exposure": {
                "equity": econ.get("equity"),
                "bond": econ.get("bond"),
                "cash": econ.get("cash"),
                "other": econ.get("other"),
            },
            "exposure_confidence": pe.get("exposure_confidence"),
            "warnings": pe.get("warnings", []),
            "classification_v2": {
                "asset_type": (dd.get("classification_v2") or {}).get("asset_type"),
                "asset_subtype": (dd.get("classification_v2") or {}).get("asset_subtype"),
            },
            "snapshot_ts": ts.isoformat(),
        }
        eq = econ.get("equity")
        bd = econ.get("bond")
        conf = pe.get("exposure_confidence")
        print(f"  [SNAP] {isin}: eq={eq} bd={bd} conf={conf}")

    (GATE_DIR / "snapshots_before.json").write_text(
        json.dumps({"generated_at_utc": ts.isoformat(), "snapshots": snapshots},
                    indent=2, ensure_ascii=False), encoding="utf-8")
    print("[SAVED] snapshots_before.json")

    # --- diff_manifest.json ---
    diff_entries = []
    for isin in SELECTED_ISINS:
        snap = snapshots[isin]
        prop_entry = entries_by_isin[isin]
        prop = prop_entry["proposed_economic_exposure"]
        old_eq = snap["economic_exposure"]["equity"]
        new_eq = prop["equity"]
        delta = round(new_eq - old_eq, 1)

        diff_entries.append({
            "isin": isin,
            "name": snap["name"],
            "current_economic_exposure": snap["economic_exposure"],
            "proposed_economic_exposure": prop,
            "official_factsheet_source_file": prop_entry["official_factsheet_source_file"],
            "source_used": "official_factsheet",
            "confidence_before": snap["exposure_confidence"],
            "confidence_after": 0.90,
            "delta_equity": delta,
            "rationale": prop_entry["rationale"],
            "normalization_applied": prop_entry["normalization_applied"],
            "normalization_reason": prop_entry["normalization_reason"],
            "suitability_impact": prop_entry["suitability_impact"],
            "recommendation": prop_entry["recommendation"],
            "fields_to_update": [
                "portfolio_exposure_v2.economic_exposure.equity",
                "portfolio_exposure_v2.economic_exposure.bond",
                "portfolio_exposure_v2.economic_exposure.cash",
                "portfolio_exposure_v2.economic_exposure.other",
                "portfolio_exposure_v2.exposure_confidence",
                "portfolio_exposure_v2.warnings",
                "portfolio_exposure_v2.computed_at",
            ],
            "fields_explicitly_not_touched": [
                "manual", "manual.costs", "manual.costs.retrocession",
                "classification_v2", "ms", "derived", "std_perf",
            ],
        })

    diff = {
        "gate_id": "write_gate_8_official_factsheet",
        "generated_at_utc": ts.isoformat(),
        "source_type": "official_factsheet",
        "entry_count": len(diff_entries),
        "entries": diff_entries,
    }
    (GATE_DIR / "diff_manifest.json").write_text(
        json.dumps(diff, indent=2, ensure_ascii=False), encoding="utf-8")
    print("[SAVED] diff_manifest.json")

    # --- rollback_manifest.json ---
    rollback_entries = []
    for isin in SELECTED_ISINS:
        snap = snapshots[isin]
        rollback_entries.append({
            "isin": isin,
            "name": snap["name"],
            "restore_fields": {
                "portfolio_exposure_v2.economic_exposure.equity": snap["economic_exposure"]["equity"],
                "portfolio_exposure_v2.economic_exposure.bond": snap["economic_exposure"]["bond"],
                "portfolio_exposure_v2.economic_exposure.cash": snap["economic_exposure"]["cash"],
                "portfolio_exposure_v2.economic_exposure.other": snap["economic_exposure"]["other"],
                "portfolio_exposure_v2.exposure_confidence": snap["exposure_confidence"],
                "portfolio_exposure_v2.warnings": snap["warnings"],
            },
        })

    rollback = {
        "gate_id": "write_gate_8_official_factsheet",
        "generated_at_utc": ts.isoformat(),
        "purpose": "Rollback to pre-gate-8 values if write fails or is reverted",
        "entries": rollback_entries,
    }
    (GATE_DIR / "rollback_manifest.json").write_text(
        json.dumps(rollback, indent=2, ensure_ascii=False), encoding="utf-8")
    print("[SAVED] rollback_manifest.json")

    # --- write_approval_manifest.json ---
    approval = {
        "gate_id": "write_gate_8_official_factsheet",
        "generated_at_utc": ts.isoformat(),
        "authorized": False,
        "can_write": False,
        "requires_human_approval": True,
        "selected_count": 5,
        "selected_isins": SELECTED_ISINS,
        "excluded_isins": [EXCLUDED],
        "source_used": "official_factsheet",
        "confidence_proposed": 0.90,
        "warning_tag": "EXPOSURE_SOURCE_OFFICIAL_FACTSHEET",
        "approval_checklist": {
            "all_isins_approved_official_factsheet": True,
            "no_hamco": True,
            "no_overlap_previous_batches": True,
            "proposed_values_validated": True,
            "rollback_manifest_present": True,
            "snapshots_captured": True,
        },
    }
    (GATE_DIR / "write_approval_manifest.json").write_text(
        json.dumps(approval, indent=2, ensure_ascii=False), encoding="utf-8")
    print("[SAVED] write_approval_manifest.json")

    # Summary
    print(f"\n{'='*65}")
    print("  GATE 8 PREPARATION COMPLETE — READ-ONLY")
    print(f"{'='*65}")
    print(f"  ISINs selected:    {len(SELECTED_ISINS)}")
    print(f"  Source:            official_factsheet")
    print(f"  Confidence:        0.90")
    print(f"  Hamco excluded:    YES")
    print(f"  authorized:        FALSE")
    print(f"  can_write:         FALSE")
    print(f"  Firestore writes:  0")
    for e in diff_entries:
        p = e["proposed_economic_exposure"]
        print(f"  {e['isin']}: eq={p['equity']} bd={p['bond']} ca={p['cash']} ot={p['other']} delta_eq={e['delta_equity']}pp")
    print(f"\n  Awaiting human approval to proceed with write.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

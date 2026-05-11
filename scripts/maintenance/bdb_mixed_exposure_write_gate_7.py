#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-GATE-7
Generate write gate artifacts for ALL 9 remaining review_required APPROVE candidates.
NO Firestore writes. Read-only snapshot + diff generation.
"""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_7"
DRY_RUN_PATH = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "mixed_exposure_fix_dry_run.json"

SELECTED_ISINS = [
    "ES0116848005",   # Global Allocation R FI
    "LU0251119078",   # Fidelity Target 2035
    "LU1899019175",   # Sigma Smart Horizon
    "ES0162305033",   # Merch-Oportunidades FI
    "ES0131462022",   # GB V Robotics R FI
    "ES0110407006",   # GB VI Argos FI
    "LU1697018064",   # Sigma Best Morgan Stanley
    "LU1899018870",   # Sigma Best M&G
    "FR0013219243",   # EdR Equity Euro Solve A
]

PREV_ISINS = {
    # Batch 1
    "IE00BYYPF474","ES0128067008","LU0512121004","LU1883327816","LU1961009468",
    "ES0116567035","ES0162949012","FR0010041822","LU0093503737","LU0352312184",
    # Batch 2
    "LU0565136552","LU1276000236","LU1298174530","LU1304666057","LU1740985814",
    # Batch 3
    "ES0173323009","ES0175604034","LU1245470593","DE0005318406","ES0148181003",
    "LU0251131362","LU0404220724","LU0171283459","LU1899018953","LU1697017256",
    "ES0142046038","ES0162946034","LU1697018494","LU1882475392","LU2278574715",
    # Batch 4
    "ES0138930005","DE000DWS17J0","LU1868537090","LU0048293368","LU1697016365",
    # Batch 5
    "LU1883330521","LU1883340322","LU1095739733","DE000A0X7541","LU1894680757",
    # Batch 6
    "LU0119195963","ES0118537002","LU2050544563","LU0284394821","ES0114904008",
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
    print("  BDB-MIXED-EXPOSURE-WRITE-GATE-7")
    print(f"  {gen}")
    print("  MODE: DRY-RUN — NO WRITES")
    print("=" * 60)

    # Validate no overlap
    overlap = set(SELECTED_ISINS) & PREV_ISINS
    if overlap:
        abort(f"Overlap with previous batches: {overlap}")
    print(f"\n[OK] No overlap with {len(PREV_ISINS)} previously written ISINs")

    # Load dry-run for proposed values
    dry = json.loads(DRY_RUN_PATH.read_text(encoding="utf-8"))
    dry_entries = {p["isin"]: p for p in dry["patches"]}
    for isin in SELECTED_ISINS:
        if isin not in dry_entries:
            abort(f"{isin} not found in dry-run")
        if not dry_entries[isin].get("write_recommended"):
            abort(f"{isin} not write_recommended")
        if not dry_entries[isin].get("review_required"):
            abort(f"{isin} not review_required")
    print(f"[OK] All {len(SELECTED_ISINS)} ISINs found in dry-run, all review_required + write_recommended")

    # Init Firebase & snapshot
    db = init_firebase()
    GATE_DIR.mkdir(parents=True, exist_ok=True)

    print("\n--- SNAPSHOTTING LIVE DATA ---")
    snapshots = {}
    for isin in sorted(SELECTED_ISINS):
        doc = db.collection("funds_v3").document(isin).get()
        if not doc.exists:
            abort(f"{isin}: not found in Firestore")
        dd = doc.to_dict()
        pe = dd.get("portfolio_exposure_v2", {})
        snapshots[isin] = {
            "name": dd.get("name", dry_entries[isin]["name"]),
            "portfolio_exposure_v2": {
                "economic_exposure": pe.get("economic_exposure", {}),
                "alternatives": pe.get("alternatives", {}),
                "concentration_metrics": pe.get("concentration_metrics", {}),
                "warnings": pe.get("warnings", []),
                "equity_styles": pe.get("equity_styles", {}),
                "fi_credit": pe.get("fi_credit", {}),
                "exposure_confidence": pe.get("exposure_confidence"),
                "risk_flags": pe.get("risk_flags", []),
                "computed_at": pe.get("computed_at"),
                "fi_types": pe.get("fi_types", {}),
                "version": pe.get("version"),
                "sectors": pe.get("sectors", {}),
                "equity_regions": pe.get("equity_regions", {}),
                "fi_duration": pe.get("fi_duration", {}),
            },
            "classification_v2_asset_type": (dd.get("classification_v2") or {}).get("asset_type"),
            "classification_v2_asset_subtype": (dd.get("classification_v2") or {}).get("asset_subtype"),
        }
        econ = pe.get("economic_exposure", {})
        print(f"  [OK] {isin}: eq={econ.get('equity',0)} bd={econ.get('bond',0)} "
              f"ca={econ.get('cash',0)} ot={econ.get('other',0)} conf={pe.get('exposure_confidence')}")

    # Write snapshots
    (GATE_DIR / "snapshots_before.json").write_text(json.dumps({
        "generated_at_utc": gen, "snapshots": snapshots
    }, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"\n[SAVED] snapshots_before.json")

    # Build selection
    selection_entries = []
    for isin in SELECTED_ISINS:
        d = dry_entries[isin]
        selection_entries.append({
            "isin": isin,
            "name": d["name"],
            "subtype": d["subtype"],
            "delta_equity": d["delta_equity"],
            "risk_level": "HIGH" if abs(d["delta_equity"]) > 20 else "MEDIUM-HIGH",
            "rationale": f"{d['subtype'].replace('_',' ').title()} {d['old_economic_exposure']['equity']:.0f}->{d['proposed_economic_exposure']['equity']:.1f}%. "
                         f"MS sum={d['ms_portfolio_asset_allocation']['sum']}. {d['name']}. Coherent with strategy.",
        })
    selection = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-7",
        "generated_at_utc": gen,
        "batch_number": 7,
        "batch_type": "review_required_all_remaining_approve",
        "selected_isins": selection_entries,
        "counts": {
            "selected": len(SELECTED_ISINS),
            "remaining_approve": 0,
            "hold_block": 2,
            "review_manual": 3,
            "no_ms_data": 1,
        },
    }
    (GATE_DIR / "selection.json").write_text(
        json.dumps(selection, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[SAVED] selection.json")

    # Build diff manifest
    diff_entries = []
    for isin in SELECTED_ISINS:
        d = dry_entries[isin]
        diff_entries.append({
            "isin": isin,
            "name": d["name"],
            "subtype": d["subtype"],
            "old_economic_exposure": d["old_economic_exposure"],
            "ms_portfolio_asset_allocation": d["ms_portfolio_asset_allocation"],
            "proposed_economic_exposure": d["proposed_economic_exposure"],
            "delta_equity": d["delta_equity"],
            "delta_bond": d["delta_bond"],
            "delta_cash": d["delta_cash"],
            "delta_other": d["delta_other"],
            "rationale_for_approve": selection_entries[[e["isin"] for e in selection_entries].index(isin)]["rationale"],
            "potential_suitability_impact": f"eq delta={d['delta_equity']:+.1f}pp. {'Alto' if abs(d['delta_equity'])>30 else 'Moderado'}.",
            "old_exposure_confidence": d["confidence_before"],
            "proposed_exposure_confidence": 0.85,
            "old_warnings": snapshots[isin]["portfolio_exposure_v2"].get("warnings", []),
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

    diff_manifest = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-7",
        "generated_at_utc": gen,
        "mode": "dry-run",
        "write_executed": False,
        "entries": diff_entries,
    }
    (GATE_DIR / "diff_manifest.json").write_text(
        json.dumps(diff_manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print("[SAVED] diff_manifest.json")

    # Build rollback manifest
    rollback_entries = []
    for isin in SELECTED_ISINS:
        snap = snapshots[isin]
        rollback_entries.append({
            "isin": isin,
            "collection": "funds_v3",
            "restore_fields": {
                "portfolio_exposure_v2.economic_exposure": snap["portfolio_exposure_v2"]["economic_exposure"],
                "portfolio_exposure_v2.exposure_confidence": snap["portfolio_exposure_v2"]["exposure_confidence"],
                "portfolio_exposure_v2.warnings": snap["portfolio_exposure_v2"].get("warnings", []),
            }
        })
    rollback = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-7",
        "generated_at_utc": gen,
        "rollback_entries": rollback_entries,
    }
    (GATE_DIR / "rollback_manifest.json").write_text(
        json.dumps(rollback, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print("[SAVED] rollback_manifest.json")

    # Build approval manifest — LOCKED
    approval = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-7",
        "generated_at_utc": gen,
        "authorized": False,
        "can_write": False,
        "requires_human_approval": True,
        "selected_count": len(SELECTED_ISINS),
        "selected_isins": sorted(SELECTED_ISINS),
        "target_collection": "funds_v3",
        "target_field": "portfolio_exposure_v2.economic_exposure",
        "approval_checklist": {
            "dry_run_reviewed": True,
            "review_audit_reviewed": True,
            "diff_manifest_reviewed": False,
            "human_approved": False,
            "approved_by": None,
            "approved_at_utc": None,
        },
        "write_guards": [
            "Re-read doc immediately before write",
            "Assert current economic_exposure matches snapshot",
            "Assert proposed sum between 95-105",
            "Abort entire batch if any guard fails",
        ],
    }
    (GATE_DIR / "write_approval_manifest.json").write_text(
        json.dumps(approval, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print("[SAVED] write_approval_manifest.json")

    # Summary
    print(f"\n{'='*60}")
    print(f"  WRITE GATE 7 GENERATED — NO WRITES EXECUTED")
    print(f"{'='*60}")
    print(f"  ISINs selected:  {len(SELECTED_ISINS)}")
    print(f"  authorized:      false")
    print(f"  can_write:       false")
    print(f"  Artifacts in:    {GATE_DIR.relative_to(ROOT)}")
    print(f"  After this batch: 54/60 MIXED corrected")
    print(f"  Remaining:       3 REVIEW_MANUAL + 2 HOLD + 1 sin MS = 6")

    for e in diff_entries:
        print(f"\n  {e['isin']} | {e['name'][:40]}")
        print(f"    old: eq={e['old_economic_exposure']['equity']} bd={e['old_economic_exposure']['bond']}")
        print(f"    new: eq={e['proposed_economic_exposure']['equity']} bd={e['proposed_economic_exposure']['bond']} "
              f"ca={e['proposed_economic_exposure']['cash']} ot={e['proposed_economic_exposure']['other']}")
        print(f"    delta_eq={e['delta_equity']:+.1f} | ms_sum={e['ms_portfolio_asset_allocation']['sum']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

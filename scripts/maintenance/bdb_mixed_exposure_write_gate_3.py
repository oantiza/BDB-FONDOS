#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-GATE-3 -- Generate write gate for third batch (all remaining low-risk).
READ-ONLY: fetches Firestore snapshots but writes NOTHING.
"""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRYRUN_PATH = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "mixed_exposure_fix_dry_run.json"
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_3"

ALREADY_WRITTEN = {
    # Lote 1
    "IE00BYYPF474", "ES0128067008", "LU0512121004", "LU1883327816", "LU1961009468",
    # Lote 2
    "ES0116567035", "ES0162949012", "FR0010041822", "LU0093503737", "LU0352312184",
    "LU0565136552", "LU1276000236", "LU1298174530", "LU1304666057", "LU1740985814",
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


def main():
    gen = datetime.now(timezone.utc).isoformat()
    print(f"=== BDB-MIXED-EXPOSURE-WRITE-GATE-3 ===")
    print(f"Generated: {gen}")
    print(f"Mode: READ-ONLY\n")

    dryrun = json.loads(DRYRUN_PATH.read_text(encoding="utf-8"))
    patches = dryrun["patches"]

    selected = []
    rejected_high_delta = []
    skipped_no_ms = []

    for p in patches:
        isin = p["isin"]
        if isin in ALREADY_WRITTEN:
            continue
        if p["source_used"] == "fallback":
            skipped_no_ms.append(isin)
            continue
        if not p["write_recommended"]:
            continue
        if p["review_required"]:
            rejected_high_delta.append(isin)
            continue
        selected.append(p)

    selected.sort(key=lambda x: abs(x["delta_equity"]))
    selected_isins = [s["isin"] for s in selected]

    print(f"Selected {len(selected_isins)} ISINs for batch 3:")
    for s in selected:
        print(f"  {s['isin']} | {s['name'][:50]:50s} | d_eq={s['delta_equity']:+6.1f} d_bd={s['delta_bond']:+6.1f}")
    print(f"\nAlready written (lotes 1+2):  {len(ALREADY_WRITTEN)}")
    print(f"Rejected (high delta):        {len(rejected_high_delta)}")
    print(f"Skipped (no MS data):         {len(skipped_no_ms)}")

    # Fetch snapshots
    print("\nFetching Firestore snapshots (read-only)...")
    db = init_firebase()
    snapshots = {}
    for isin in selected_isins:
        doc = db.collection("funds_v3").document(isin).get()
        if doc.exists:
            dd = doc.to_dict()
            snapshots[isin] = {
                "name": dd.get("name", ""),
                "portfolio_exposure_v2": dd.get("portfolio_exposure_v2", {}),
                "classification_v2_asset_type": (dd.get("classification_v2") or {}).get("asset_type"),
                "classification_v2_asset_subtype": (dd.get("classification_v2") or {}).get("asset_subtype"),
            }
            print(f"  Snapshot OK: {isin}")

    # Build diff entries
    diff_entries = []
    for s in selected:
        isin = s["isin"]
        snap = snapshots.get(isin, {})
        old_exp_v2 = snap.get("portfolio_exposure_v2", {})
        old_econ = old_exp_v2.get("economic_exposure", {})
        diff_entries.append({
            "isin": isin, "name": s["name"],
            "old_economic_exposure": {k: old_econ.get(k, 0) for k in ["equity", "bond", "cash", "other"]},
            "proposed_economic_exposure": s["proposed_economic_exposure"],
            "old_exposure_confidence": old_exp_v2.get("exposure_confidence", 0.45),
            "proposed_exposure_confidence": 0.85,
            "old_warnings": old_exp_v2.get("warnings", []),
            "proposed_warnings_add": ["EXPOSURE_SOURCE_MS_PORTFOLIO"],
            "proposed_warnings_remove": ["EXPOSURE_INFERRED_FROM_CLASSIFICATION"],
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

    # Write artifacts
    GATE_DIR.mkdir(parents=True, exist_ok=True)
    def w(name, data):
        (GATE_DIR / name).write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    w("selection.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-3", "generated_at_utc": gen, "batch_number": 3,
        "selection_criteria": {"write_recommended": True, "review_required": False,
                               "source_used": "ms_portfolio_asset_allocation",
                               "excluded_already_written": list(ALREADY_WRITTEN)},
        "selected_isins": [{"isin": s["isin"], "name": s["name"], "subtype": s["subtype"],
                            "delta_equity": s["delta_equity"], "delta_bond": s["delta_bond"], "risk_level": "LOW"}
                           for s in selected],
        "rejected_high_delta_isins": rejected_high_delta,
        "skipped_no_ms_data_isins": skipped_no_ms,
        "counts": {"selected": len(selected), "already_written": len(ALREADY_WRITTEN),
                   "rejected_high_delta": len(rejected_high_delta), "skipped_no_ms": len(skipped_no_ms)},
    })
    w("snapshots_before.json", {"generated_at_utc": gen, "snapshots": snapshots})
    w("diff_manifest.json", {"audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-3", "generated_at_utc": gen,
                              "mode": "dry-run", "write_executed": False, "entries": diff_entries})
    w("rollback_manifest.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-3", "generated_at_utc": gen,
        "rollback_entries": [{"isin": e["isin"], "collection": "funds_v3",
                              "restore_fields": {"portfolio_exposure_v2.economic_exposure": e["old_economic_exposure"],
                                                 "portfolio_exposure_v2.exposure_confidence": e["old_exposure_confidence"],
                                                 "portfolio_exposure_v2.warnings": e["old_warnings"]}}
                             for e in diff_entries],
    })
    w("write_approval_manifest.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-3", "generated_at_utc": gen,
        "authorized": False, "can_write": False, "requires_human_approval": True,
        "selected_count": len(selected_isins), "selected_isins": selected_isins,
        "target_collection": "funds_v3", "target_field": "portfolio_exposure_v2.economic_exposure",
        "approval_checklist": {"dry_run_reviewed": True, "diff_manifest_reviewed": False,
                               "rollback_tested": False, "human_approved": False,
                               "approved_by": None, "approved_at_utc": None},
        "write_guards": ["Re-read doc immediately before write",
                         "Assert current economic_exposure matches snapshot",
                         "Assert proposed sum between 95-105",
                         "Abort entire batch if any guard fails"],
    })

    print(f"\n=== ARTIFACTS GENERATED ===")
    for f in ["selection.json", "snapshots_before.json", "diff_manifest.json", "rollback_manifest.json", "write_approval_manifest.json"]:
        print(f"  write_gate_3/{f}")
    print(f"\n  Firestore writes: 0")
    print(f"  authorized: false")


if __name__ == "__main__":
    main()

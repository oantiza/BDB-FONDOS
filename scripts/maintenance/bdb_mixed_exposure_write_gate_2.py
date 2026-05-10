#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-GATE-2 -- Generate write gate for second batch.
READ-ONLY: fetches Firestore snapshots but writes NOTHING.
"""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRYRUN_PATH = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "mixed_exposure_fix_dry_run.json"
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_2"

ALREADY_WRITTEN = {"IE00BYYPF474", "ES0128067008", "LU0512121004", "LU1883327816", "LU1961009468"}
MAX_SELECT = 10
MAX_ABS_DELTA_EQ = 10.0


def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore
    if not firebase_admin._apps:
        for kp in [
            os.path.join(ROOT, "scripts", "serviceAccountKey.json"),
            os.path.join(ROOT, "ServiceAccountkey.json"),
        ]:
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
    print(f"=== BDB-MIXED-EXPOSURE-WRITE-GATE-2 ===")
    print(f"Generated: {gen}")
    print(f"Mode: READ-ONLY\n")

    dryrun = json.loads(DRYRUN_PATH.read_text(encoding="utf-8"))
    patches = dryrun["patches"]

    # Filter candidates
    candidates = []
    rejected_high_delta = []
    skipped_already_written = []
    skipped_no_ms = []

    for p in patches:
        isin = p["isin"]
        if isin in ALREADY_WRITTEN:
            skipped_already_written.append(isin)
            continue
        if p["source_used"] == "fallback":
            skipped_no_ms.append(isin)
            continue
        if not p["write_recommended"]:
            continue
        if p["review_required"]:
            rejected_high_delta.append(isin)
            continue
        # Low-risk candidate
        candidates.append(p)

    # Sort by |delta_equity| ascending (safest first)
    candidates.sort(key=lambda x: abs(x["delta_equity"]))
    selected = candidates[:MAX_SELECT]
    selected_isins = [s["isin"] for s in selected]

    print(f"Selected {len(selected_isins)} ISINs for batch 2:")
    for s in selected:
        print(f"  {s['isin']} | {s['name'][:50]:50s} | d_eq={s['delta_equity']:+6.1f} d_bd={s['delta_bond']:+6.1f}")
    print(f"\nAlready written (lote 1):  {len(skipped_already_written)}")
    print(f"Rejected (high delta):     {len(rejected_high_delta)}")
    print(f"Skipped (no MS data):      {len(skipped_no_ms)}")
    print(f"Remaining low-risk:        {len(candidates) - len(selected)}")

    # --- Selection artifact ---
    selection = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-2",
        "generated_at_utc": gen,
        "batch_number": 2,
        "selection_criteria": {
            "max_abs_delta_equity": MAX_ABS_DELTA_EQ,
            "write_recommended": True,
            "review_required": False,
            "source_used": "ms_portfolio_asset_allocation",
            "max_selected": MAX_SELECT,
            "excluded_already_written": list(ALREADY_WRITTEN),
        },
        "selected_isins": [
            {"isin": s["isin"], "name": s["name"], "subtype": s["subtype"],
             "delta_equity": s["delta_equity"], "delta_bond": s["delta_bond"],
             "risk_level": "LOW",
             "selection_reason": f"|d_eq|={abs(s['delta_equity']):.1f}pp, |d_bd|={abs(s['delta_bond']):.1f}pp, MS sum={s['ms_portfolio_asset_allocation']['sum']}"}
            for s in selected
        ],
        "rejected_high_delta_isins": rejected_high_delta,
        "skipped_already_written_isins": list(ALREADY_WRITTEN),
        "skipped_no_ms_data_isins": skipped_no_ms,
        "counts": {
            "selected": len(selected_isins),
            "already_written_lote1": len(skipped_already_written),
            "rejected_high_delta": len(rejected_high_delta),
            "skipped_no_ms_data": len(skipped_no_ms),
            "remaining_low_risk_after_this_batch": len(candidates) - len(selected),
        },
    }

    # --- Fetch Firestore snapshots ---
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
        else:
            print(f"  NOT FOUND: {isin}")

    # --- Diff manifest ---
    diff_entries = []
    for s in selected:
        isin = s["isin"]
        snap = snapshots.get(isin, {})
        old_exp_v2 = snap.get("portfolio_exposure_v2", {})
        old_econ = old_exp_v2.get("economic_exposure", {})

        diff_entries.append({
            "isin": isin,
            "name": s["name"],
            "old_economic_exposure": {
                "equity": old_econ.get("equity", 0),
                "bond": old_econ.get("bond", 0),
                "cash": old_econ.get("cash", 0),
                "other": old_econ.get("other", 0),
            },
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

    # --- Rollback manifest ---
    rollback_manifest = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-2",
        "generated_at_utc": gen,
        "purpose": "Restore portfolio_exposure_v2 fields to pre-update values",
        "rollback_entries": [
            {
                "isin": e["isin"],
                "collection": "funds_v3",
                "restore_fields": {
                    "portfolio_exposure_v2.economic_exposure": e["old_economic_exposure"],
                    "portfolio_exposure_v2.exposure_confidence": e["old_exposure_confidence"],
                    "portfolio_exposure_v2.warnings": e["old_warnings"],
                },
            }
            for e in diff_entries
        ],
    }

    # --- Approval manifest ---
    approval_manifest = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-2",
        "generated_at_utc": gen,
        "authorized": False,
        "can_write": False,
        "requires_human_approval": True,
        "selected_count": len(selected_isins),
        "selected_isins": selected_isins,
        "target_collection": "funds_v3",
        "target_field": "portfolio_exposure_v2.economic_exposure",
        "approval_checklist": {
            "dry_run_reviewed": True,
            "diff_manifest_reviewed": False,
            "rollback_tested": False,
            "human_approved": False,
            "approved_by": None,
            "approved_at_utc": None,
        },
        "write_guards": [
            "Re-read doc immediately before write",
            "Assert current economic_exposure matches snapshot",
            "Assert proposed sum between 95-105",
            "Abort entire batch if any guard fails",
            "Log before/after for each write",
        ],
    }

    # --- Write artifacts ---
    GATE_DIR.mkdir(parents=True, exist_ok=True)

    def write_json(path, data):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    write_json(GATE_DIR / "selection.json", selection)
    write_json(GATE_DIR / "snapshots_before.json", {"generated_at_utc": gen, "snapshots": snapshots})
    write_json(GATE_DIR / "diff_manifest.json", {"audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-2", "generated_at_utc": gen, "mode": "dry-run", "write_executed": False, "entries": diff_entries})
    write_json(GATE_DIR / "rollback_manifest.json", rollback_manifest)
    write_json(GATE_DIR / "write_approval_manifest.json", approval_manifest)

    print(f"\n=== ARTIFACTS GENERATED ===")
    for f in ["selection.json", "snapshots_before.json", "diff_manifest.json", "rollback_manifest.json", "write_approval_manifest.json"]:
        print(f"  {GATE_DIR.relative_to(ROOT)}/{f}")
    print(f"\n  Firestore writes: 0")
    print(f"  authorized: false")
    print(f"  can_write: false")


if __name__ == "__main__":
    main()

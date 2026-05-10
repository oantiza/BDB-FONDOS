#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-GATE-0 -- Generate write gate artifacts.
READ-ONLY: fetches Firestore snapshots but writes NOTHING.
"""
import json, os, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRYRUN_PATH = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "mixed_exposure_fix_dry_run.json"
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_0"

# Selection criteria
MAX_SELECT = 5
MAX_ABS_DELTA_EQ = 10.0
MAX_ABS_DELTA_BD = 10.0


def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore
    if not firebase_admin._apps:
        key_paths = [
            os.path.join(ROOT, "scripts", "serviceAccountKey.json"),
            os.path.join(ROOT, "serviceAccountKey.json"),
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
            print("[INIT] Firebase: default credentials")
    return firestore.client()


def main():
    gen = datetime.now(timezone.utc).isoformat()
    print(f"=== BDB-MIXED-EXPOSURE-WRITE-GATE-0 ===")
    print(f"Generated: {gen}")
    print(f"Mode: READ-ONLY\n")

    dryrun = json.loads(DRYRUN_PATH.read_text(encoding="utf-8"))
    patches = dryrun["patches"]

    # Classify
    selected = []
    rejected_high_delta = []
    skipped_no_ms = []

    for p in patches:
        if p["source_used"] == "fallback":
            skipped_no_ms.append(p["isin"])
            continue
        if not p["write_recommended"]:
            continue
        if p["review_required"]:
            rejected_high_delta.append(p["isin"])
            continue
        if abs(p["delta_equity"]) <= MAX_ABS_DELTA_EQ and abs(p["delta_bond"]) <= MAX_ABS_DELTA_BD:
            selected.append(p)

    # Take top 5 by lowest |delta_equity| (safest first)
    selected.sort(key=lambda x: abs(x["delta_equity"]))
    selected = selected[:MAX_SELECT]
    selected_isins = [s["isin"] for s in selected]

    print(f"Selected {len(selected_isins)} ISINs for first batch:")
    for s in selected:
        print(f"  {s['isin']} | {s['name'][:45]} | d_eq={s['delta_equity']:+.1f} d_bd={s['delta_bond']:+.1f}")
    print(f"\nRejected (high delta): {len(rejected_high_delta)}")
    print(f"Skipped (no MS data):  {len(skipped_no_ms)}")

    # Generate selection artifact
    selection = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-0",
        "generated_at_utc": gen,
        "selection_criteria": {
            "max_abs_delta_equity": MAX_ABS_DELTA_EQ,
            "max_abs_delta_bond": MAX_ABS_DELTA_BD,
            "write_recommended": True,
            "review_required": False,
            "source_used": "ms_portfolio_asset_allocation",
            "max_selected": MAX_SELECT,
        },
        "selected_isins": [
            {"isin": s["isin"], "name": s["name"], "subtype": s["subtype"],
             "delta_equity": s["delta_equity"], "delta_bond": s["delta_bond"],
             "risk_level": "LOW",
             "selection_reason": f"|d_eq|={abs(s['delta_equity']):.1f}pp, |d_bd|={abs(s['delta_bond']):.1f}pp, MS sum={s['ms_portfolio_asset_allocation']['sum']}, review_required=false"}
            for s in selected
        ],
        "rejected_high_delta_isins": rejected_high_delta,
        "skipped_no_ms_data_isins": skipped_no_ms,
        "counts": {
            "selected": len(selected_isins),
            "rejected_high_delta": len(rejected_high_delta),
            "skipped_no_ms_data": len(skipped_no_ms),
            "remaining_low_risk": sum(
                1 for p in patches
                if p["write_recommended"] and not p["review_required"]
                and p["source_used"] != "fallback"
                and p["isin"] not in selected_isins
            ),
        },
    }

    # Fetch Firestore snapshots
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

    # Generate diff manifest
    diff_entries = []
    for s in selected:
        isin = s["isin"]
        snap = snapshots.get(isin, {})
        old_exp_v2 = snap.get("portfolio_exposure_v2", {})
        old_econ = old_exp_v2.get("economic_exposure", {})
        old_conf = old_exp_v2.get("exposure_confidence", 0.45)

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
            "old_exposure_confidence": old_conf,
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
                "portfolio_exposure_v2.asset_mix",
                "portfolio_exposure_v2.equity_regions",
                "portfolio_exposure_v2.equity_styles",
                "portfolio_exposure_v2.sectors",
                "portfolio_exposure_v2.risk_flags",
                "portfolio_exposure_v2.fi_credit",
                "portfolio_exposure_v2.fi_duration",
                "portfolio_exposure_v2.fi_types",
                "portfolio_exposure_v2.alternatives",
                "portfolio_exposure_v2.concentration_metrics",
            ],
        })

    diff_manifest = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-0",
        "generated_at_utc": gen,
        "mode": "dry-run",
        "write_executed": False,
        "entries": diff_entries,
    }

    # Generate rollback manifest
    rollback_manifest = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-0",
        "generated_at_utc": gen,
        "purpose": "Restore portfolio_exposure_v2 fields to pre-update values if write causes issues",
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

    # Generate approval manifest
    approval_manifest = {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-0",
        "generated_at_utc": gen,
        "authorized": False,
        "can_write": False,
        "requires_human_approval": True,
        "selected_count": len(selected_isins),
        "selected_isins": selected_isins,
        "target_collection": "funds_v3",
        "target_field": "portfolio_exposure_v2.economic_exposure",
        "approval_checklist": {
            "dry_run_reviewed": False,
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

    # Write artifacts
    GATE_DIR.mkdir(parents=True, exist_ok=True)

    sel_path = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "mixed_exposure_write_gate_selection_0.json"
    sel_path.write_text(json.dumps(selection, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    snap_path = GATE_DIR / "snapshots_before.json"
    snap_path.write_text(json.dumps({"generated_at_utc": gen, "snapshots": snapshots}, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    diff_path = GATE_DIR / "diff_manifest.json"
    diff_path.write_text(json.dumps(diff_manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    rb_path = GATE_DIR / "rollback_manifest.json"
    rb_path.write_text(json.dumps(rollback_manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    ap_path = GATE_DIR / "write_approval_manifest.json"
    ap_path.write_text(json.dumps(approval_manifest, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    print(f"\n=== ARTIFACTS GENERATED ===")
    print(f"  Selection:  {sel_path.relative_to(ROOT)}")
    print(f"  Snapshots:  {snap_path.relative_to(ROOT)}")
    print(f"  Diff:       {diff_path.relative_to(ROOT)}")
    print(f"  Rollback:   {rb_path.relative_to(ROOT)}")
    print(f"  Approval:   {ap_path.relative_to(ROOT)}")
    print(f"\n  Firestore writes: 0")
    print(f"  authorized: false")
    print(f"  can_write: false")

    return selection, diff_manifest, approval_manifest


if __name__ == "__main__":
    main()

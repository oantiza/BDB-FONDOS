#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-GATE-4 -- First review_required sublote (5 ISINs).
READ-ONLY: fetches Firestore snapshots but writes NOTHING.
"""
import json, os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRYRUN_PATH = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "mixed_exposure_fix_dry_run.json"
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_4"

SELECTED = {
    "ES0138930005", "DE000DWS17J0", "LU1868537090", "LU0048293368", "LU1697016365",
}

RATIONALE = {
    "ES0138930005": "AGGRESSIVE 80->91.8%. MS sum=100.0. Fondo agresivo real, MS confirma mas RV que el fallback 80/20. Coherente.",
    "DE000DWS17J0": "AGGRESSIVE 80->68.8%. MS sum=100.0. Multi-asset dinamico, ligeramente menos agresivo de lo tipico. other=9.2% explica la diferencia.",
    "LU1868537090": "AGGRESSIVE 80->69.0%. MS sum=100.0. Version invest del anterior. Mismo patron, other=9.0%.",
    "LU0048293368": "AGGRESSIVE 80->59.1%. MS sum=100.0. BL invierte ~22.6% en oro/commodities (other). Equity real=59.1%. Coherente con estrategia de oro.",
    "LU1697016365": "CONSERVATIVE 20->0.1%. MS sum=100.0. 'Defensive' con 92.5% bond. El nombre confirma la estrategia ultra-defensiva.",
}

SUITABILITY_IMPACT = {
    "ES0138930005": "Minimo. eq sube 11.8pp pero sigue en rango AGGRESSIVE. No cambia bucket suitability.",
    "DE000DWS17J0": "Moderado. eq baja 11.2pp (80->68.8). Podria cambiar de bucket 'Agresivo' a 'Dinamico'. Revisar si afecta perfiles P6-P8.",
    "LU1868537090": "Moderado. eq baja 11pp (80->69). Mismo impacto que DE000DWS17J0.",
    "LU0048293368": "Alto pero correcto. eq baja 20.9pp (80->59.1). other=22.6% (oro). Suitability deberia reflejar esta diversificacion real.",
    "LU1697016365": "Bajo. eq baja 19.9pp (20->0.1). Sigue siendo ultra-conservador. Bond sube de 80->92.5%.",
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
    print(f"=== BDB-MIXED-EXPOSURE-WRITE-GATE-4 ===")
    print(f"Generated: {gen}")
    print(f"Mode: READ-ONLY\n")

    dryrun = json.loads(DRYRUN_PATH.read_text(encoding="utf-8"))
    patches = {p["isin"]: p for p in dryrun["patches"]}

    selected = [patches[isin] for isin in sorted(SELECTED)]
    for s in selected:
        print(f"  {s['isin']} | {s['name'][:50]:50s} | d_eq={s['delta_equity']:+6.1f} d_bd={s['delta_bond']:+6.1f}")

    # Fetch snapshots
    print("\nFetching Firestore snapshots (read-only)...")
    db = init_firebase()
    snapshots = {}
    for isin in sorted(SELECTED):
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
        old_exp = snap.get("portfolio_exposure_v2", {})
        old_econ = old_exp.get("economic_exposure", {})
        diff_entries.append({
            "isin": isin, "name": s["name"], "subtype": s["subtype"],
            "old_economic_exposure": {k: old_econ.get(k, 0) for k in ["equity", "bond", "cash", "other"]},
            "ms_portfolio_asset_allocation": s["ms_portfolio_asset_allocation"],
            "proposed_economic_exposure": s["proposed_economic_exposure"],
            "delta_equity": s["delta_equity"], "delta_bond": s["delta_bond"],
            "delta_cash": s.get("delta_cash", 0), "delta_other": s.get("delta_other", 0),
            "rationale_for_approve": RATIONALE.get(isin, ""),
            "potential_suitability_impact": SUITABILITY_IMPACT.get(isin, ""),
            "old_exposure_confidence": old_exp.get("exposure_confidence", 0.45),
            "proposed_exposure_confidence": 0.85,
            "old_warnings": old_exp.get("warnings", []),
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
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-4", "generated_at_utc": gen, "batch_number": 4,
        "batch_type": "review_required_sublote_1",
        "selection_criteria": {"review_required": True, "audit_recommendation": "APPROVE",
                               "ms_sum_exactly_100": True, "strategy_coherent": True},
        "selected_isins": [{"isin": s["isin"], "name": s["name"], "subtype": s["subtype"],
                            "delta_equity": s["delta_equity"], "risk_level": "MEDIUM",
                            "rationale": RATIONALE.get(s["isin"], "")}
                           for s in selected],
        "counts": {"selected": len(SELECTED), "remaining_review_required": 24},
    })
    w("snapshots_before.json", {"generated_at_utc": gen, "snapshots": snapshots})
    w("diff_manifest.json", {"audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-4", "generated_at_utc": gen,
                              "mode": "dry-run", "write_executed": False, "entries": diff_entries})
    w("rollback_manifest.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-4", "generated_at_utc": gen,
        "rollback_entries": [{"isin": e["isin"], "collection": "funds_v3",
                              "restore_fields": {"portfolio_exposure_v2.economic_exposure": e["old_economic_exposure"],
                                                 "portfolio_exposure_v2.exposure_confidence": e["old_exposure_confidence"],
                                                 "portfolio_exposure_v2.warnings": e["old_warnings"]}}
                             for e in diff_entries],
    })
    w("write_approval_manifest.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-4", "generated_at_utc": gen,
        "authorized": False, "can_write": False, "requires_human_approval": True,
        "selected_count": len(SELECTED), "selected_isins": sorted(SELECTED),
        "target_collection": "funds_v3", "target_field": "portfolio_exposure_v2.economic_exposure",
        "approval_checklist": {"dry_run_reviewed": True, "review_audit_reviewed": True,
                               "diff_manifest_reviewed": False, "human_approved": False,
                               "approved_by": None, "approved_at_utc": None},
        "write_guards": ["Re-read doc immediately before write",
                         "Assert current economic_exposure matches snapshot",
                         "Assert proposed sum between 95-105",
                         "Abort entire batch if any guard fails"],
    })

    print(f"\n=== ARTIFACTS GENERATED ===")
    for f in ["selection.json", "snapshots_before.json", "diff_manifest.json", "rollback_manifest.json", "write_approval_manifest.json"]:
        print(f"  write_gate_4/{f}")
    print(f"\n  Firestore writes: 0")
    print(f"  authorized: false")


if __name__ == "__main__":
    main()

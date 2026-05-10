#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-GATE-5 -- Second review_required sublote (5 ISINs).
READ-ONLY: fetches Firestore snapshots but writes NOTHING.
"""
import json, os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRYRUN_PATH = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "mixed_exposure_fix_dry_run.json"
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_5"

ALL_WRITTEN = {
    # Lote 1
    "IE00BYYPF474","ES0128067008","LU0512121004","LU1883327816","LU1961009468",
    # Lote 2
    "ES0116567035","ES0162949012","FR0010041822","LU0093503737","LU0352312184",
    "LU0565136552","LU1276000236","LU1298174530","LU1304666057","LU1740985814",
    # Lote 3
    "ES0173323009","ES0175604034","LU1245470593","DE0005318406","ES0148181003",
    "LU0251131362","LU0404220724","LU0171283459","LU1899018953","LU1697017256",
    "ES0142046038","ES0162946034","LU1697018494","LU1882475392","LU2278574715",
    # Lote 4
    "ES0138930005","DE000DWS17J0","LU1868537090","LU0048293368","LU1697016365",
}

# HOLD/BLOCK from audit — do NOT select
HOLD_BLOCK = {
    "LU1594335520",  # AGGRESSIVE 80->0, anomalous
    "LU0352312853",  # MS sum=170.8, extreme leverage
}

# REVIEW_MANUAL from audit — skip for now
REVIEW_MANUAL = {
    "LU0121216526",  # GS Patrimonial Aggressive, 80->56.5, sum=107.2
    "FR0010306142",  # Carmignac Patrimoine, MS sum=141.3
    "LU1548496022",  # Allianz Dynamic MA SRI 15, MS sum=112.5
}

RATIONALE = {
    "LU1883330521": "CONSERVATIVE 20->31.7%. MS sum=101.0. Amundi Global Multi-Asset Target Income. Ligeramente mas RV que el conservador tipico. sum~100, coherente.",
    "LU1883340322": "FLEXIBLE 50->61.6%. MS sum=100.0. Amundi Pioneer Flexible Opportunities. Moderadamente mas RV que 50/50. Coherente con 'flexible'.",
    "LU1095739733": "MODERATE 50->61.9%. MS sum=100.0. First Eagle Amundi Income Builder. RV sube 11.9pp, bond baja 29.1pp (cash+other compensa). Coherente.",
    "DE000A0X7541": "FLEXIBLE 50->63.9%. MS sum=100.0. Acatis Value Event Fonds. Fondo value/event-driven, sesgo RV natural. Coherente.",
    "LU1894680757": "MODERATE 50->30.3%. MS sum=100.0. Amundi Income Opportunities. Fondo de income, logicamente mas defensivo que 50/50. Coherente.",
}

SUITABILITY_IMPACT = {
    "LU1883330521": "Bajo. Sigue CONSERVATIVE. eq sube 11.7pp pero bond+cash domina (68.3%). Perfil no cambia.",
    "LU1883340322": "Bajo-moderado. FLEXIBLE, eq sube 11.6pp. Podria afectar bucket en perfiles P4-P5.",
    "LU1095739733": "Moderado. MODERATE, eq sube 11.9pp. Podria afectar clasificacion de agresividad.",
    "DE000A0X7541": "Moderado. FLEXIBLE, eq sube 13.9pp. Fondo value/event, other=16.5% (commodities/alternatives).",
    "LU1894680757": "Moderado. MODERATE, eq baja 19.7pp. Fondo se vuelve mas defensivo. Mejora suitability para perfiles conservadores.",
}

SELECTED_ISINS = ["LU1883330521", "LU1883340322", "LU1095739733", "DE000A0X7541", "LU1894680757"]


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
    print(f"=== BDB-MIXED-EXPOSURE-WRITE-GATE-5 ===")
    print(f"Generated: {gen}")
    print(f"Mode: READ-ONLY\n")

    dryrun = json.loads(DRYRUN_PATH.read_text(encoding="utf-8"))
    patches = {p["isin"]: p for p in dryrun["patches"]}

    # Validate selection
    for isin in SELECTED_ISINS:
        assert isin not in ALL_WRITTEN, f"{isin} already written"
        assert isin not in HOLD_BLOCK, f"{isin} is HOLD/BLOCK"
        assert isin not in REVIEW_MANUAL, f"{isin} is REVIEW_MANUAL"
        assert isin in patches, f"{isin} not in dry-run"

    selected = [patches[isin] for isin in SELECTED_ISINS]
    for s in selected:
        print(f"  {s['isin']} | {s['name'][:50]:50s} | d_eq={s['delta_equity']:+6.1f} d_bd={s['delta_bond']:+6.1f}")

    remaining_after = [p for p in dryrun["patches"]
                       if p["review_required"] and p["isin"] not in ALL_WRITTEN
                       and p["isin"] not in set(SELECTED_ISINS)]
    print(f"\nRemaining review_required after this batch: {len(remaining_after)}")
    print(f"  of which HOLD/BLOCK: {len(HOLD_BLOCK)}")
    print(f"  of which REVIEW_MANUAL: {len(REVIEW_MANUAL)}")

    # Fetch snapshots
    print("\nFetching Firestore snapshots (read-only)...")
    db = init_firebase()
    snapshots = {}
    for isin in SELECTED_ISINS:
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

    # Build diff
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
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-5", "generated_at_utc": gen, "batch_number": 5,
        "batch_type": "review_required_sublote_2",
        "selection_criteria": {"review_required": True, "audit_recommendation": "APPROVE",
                               "ms_sum_approx_100": True, "strategy_coherent": True,
                               "excluded_hold_block": sorted(HOLD_BLOCK),
                               "excluded_review_manual": sorted(REVIEW_MANUAL)},
        "selected_isins": [{"isin": s["isin"], "name": s["name"], "subtype": s["subtype"],
                            "delta_equity": s["delta_equity"], "risk_level": "MEDIUM",
                            "rationale": RATIONALE.get(s["isin"], "")}
                           for s in selected],
        "counts": {"selected": len(SELECTED_ISINS), "remaining_review_required": len(remaining_after),
                   "hold_block": len(HOLD_BLOCK), "review_manual": len(REVIEW_MANUAL)},
    })
    w("snapshots_before.json", {"generated_at_utc": gen, "snapshots": snapshots})
    w("diff_manifest.json", {"audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-5", "generated_at_utc": gen,
                              "mode": "dry-run", "write_executed": False, "entries": diff_entries})
    w("rollback_manifest.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-5", "generated_at_utc": gen,
        "rollback_entries": [{"isin": e["isin"], "collection": "funds_v3",
                              "restore_fields": {"portfolio_exposure_v2.economic_exposure": e["old_economic_exposure"],
                                                 "portfolio_exposure_v2.exposure_confidence": e["old_exposure_confidence"],
                                                 "portfolio_exposure_v2.warnings": e["old_warnings"]}}
                             for e in diff_entries],
    })
    w("write_approval_manifest.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-5", "generated_at_utc": gen,
        "authorized": False, "can_write": False, "requires_human_approval": True,
        "selected_count": len(SELECTED_ISINS), "selected_isins": SELECTED_ISINS,
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
        print(f"  write_gate_5/{f}")
    print(f"\n  Firestore writes: 0")
    print(f"  authorized: false")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
BDB-MIXED-EXPOSURE-WRITE-GATE-6 -- Third review_required sublote (5 ISINs).
READ-ONLY: fetches Firestore snapshots but writes NOTHING.
"""
import json, os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DRYRUN_PATH = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "mixed_exposure_fix_dry_run.json"
GATE_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix" / "write_gate_6"

ALL_WRITTEN = {
    "IE00BYYPF474","ES0128067008","LU0512121004","LU1883327816","LU1961009468",
    "ES0116567035","ES0162949012","FR0010041822","LU0093503737","LU0352312184",
    "LU0565136552","LU1276000236","LU1298174530","LU1304666057","LU1740985814",
    "ES0173323009","ES0175604034","LU1245470593","DE0005318406","ES0148181003",
    "LU0251131362","LU0404220724","LU0171283459","LU1899018953","LU1697017256",
    "ES0142046038","ES0162946034","LU1697018494","LU1882475392","LU2278574715",
    "ES0138930005","DE000DWS17J0","LU1868537090","LU0048293368","LU1697016365",
    "LU1883330521","LU1883340322","LU1095739733","DE000A0X7541","LU1894680757",
}

HOLD_BLOCK = {"LU1594335520", "LU0352312853"}
REVIEW_MANUAL = {"LU0121216526", "FR0010306142", "LU1548496022"}
NO_MS = {"LU3038481936"}

RATIONALE = {
    "LU0119195963": "MODERATE 50->38.7%. MS sum=108.7 (slight leverage). GS Patrimonial Balanced, genuinely more defensive than 50/50. Bond=49.2, other=12.1 (alternatives). Coherent.",
    "ES0118537002": "MODERATE 50->15.5%. MS sum=100.0. Olea Neutral, market-neutral strategy. Very low net equity. Name confirms 'Neutral'. Coherent.",
    "LU2050544563": "FLEXIBLE 50->76.1%. MS sum=100.0. DWS ESG Multi Asset Dynamic. 'Dynamic' signals high-equity tilt. Coherent with name.",
    "LU0284394821": "FLEXIBLE 50->71.5%. MS sum=106.4 (minor leverage). DNCA Invest Evolutif, flexible with equity tilt. Coherent.",
    "ES0114904008": "FLEXIBLE 50->85.6%. MS sum=100.0. Brightgate Focus A FI. Concentrated equity strategy. Known as high-conviction equity fund. Coherent.",
}

SUITABILITY_IMPACT = {
    "LU0119195963": "Moderado. eq baja 11.3pp. Se vuelve mas defensivo, beneficia perfiles conservadores.",
    "ES0118537002": "Alto pero correcto. eq baja 34.5pp. Market-neutral genuino, exposicion neta muy baja. Suitability debe reflejar esto.",
    "LU2050544563": "Moderado. eq sube 26.1pp. De balanced a dinamico. Podria cambiar bucket suitability.",
    "LU0284394821": "Moderado. eq sube 21.5pp. De balanced a growth-tilted flexible. Coherente con 'Evolutif'.",
    "ES0114904008": "Alto pero correcto. eq sube 35.6pp. Fondo de acciones concentrado clasificado como flexible. Suitability debe reflejar RV real.",
}

SELECTED_ISINS = ["LU0119195963", "ES0118537002", "LU2050544563", "LU0284394821", "ES0114904008"]


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
    print(f"=== BDB-MIXED-EXPOSURE-WRITE-GATE-6 ===")
    print(f"Generated: {gen}")
    print(f"Mode: READ-ONLY\n")

    dryrun = json.loads(DRYRUN_PATH.read_text(encoding="utf-8"))
    patches = {p["isin"]: p for p in dryrun["patches"]}

    for isin in SELECTED_ISINS:
        assert isin not in ALL_WRITTEN, f"{isin} already written"
        assert isin not in HOLD_BLOCK, f"{isin} is HOLD/BLOCK"
        assert isin not in REVIEW_MANUAL, f"{isin} is REVIEW_MANUAL"
        assert isin not in NO_MS, f"{isin} has no MS data"

    selected = [patches[isin] for isin in SELECTED_ISINS]
    for s in selected:
        ms = s.get("ms_portfolio_asset_allocation") or {}
        print(f"  {s['isin']} | {s['name'][:50]:50s} | d_eq={s['delta_equity']:+6.1f} | ms_sum={ms.get('sum',0)}")

    remaining = [p for p in dryrun["patches"]
                 if p["review_required"] and p["isin"] not in ALL_WRITTEN
                 and p["isin"] not in set(SELECTED_ISINS)
                 and p["isin"] not in HOLD_BLOCK and p["isin"] not in REVIEW_MANUAL
                 and p["isin"] not in NO_MS]
    print(f"\nRemaining APPROVE after this batch: {len(remaining)}")

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

    GATE_DIR.mkdir(parents=True, exist_ok=True)
    def w(name, data):
        (GATE_DIR / name).write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    w("selection.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-6", "generated_at_utc": gen, "batch_number": 6,
        "batch_type": "review_required_sublote_3",
        "selected_isins": [{"isin": s["isin"], "name": s["name"], "subtype": s["subtype"],
                            "delta_equity": s["delta_equity"], "risk_level": "MEDIUM-HIGH",
                            "rationale": RATIONALE.get(s["isin"], "")} for s in selected],
        "counts": {"selected": len(SELECTED_ISINS), "remaining_approve": len(remaining),
                   "hold_block": len(HOLD_BLOCK), "review_manual": len(REVIEW_MANUAL)},
    })
    w("snapshots_before.json", {"generated_at_utc": gen, "snapshots": snapshots})
    w("diff_manifest.json", {"audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-6", "generated_at_utc": gen,
                              "mode": "dry-run", "write_executed": False, "entries": diff_entries})
    w("rollback_manifest.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-6", "generated_at_utc": gen,
        "rollback_entries": [{"isin": e["isin"], "collection": "funds_v3",
                              "restore_fields": {"portfolio_exposure_v2.economic_exposure": e["old_economic_exposure"],
                                                 "portfolio_exposure_v2.exposure_confidence": e["old_exposure_confidence"],
                                                 "portfolio_exposure_v2.warnings": e["old_warnings"]}}
                             for e in diff_entries],
    })
    w("write_approval_manifest.json", {
        "audit_id": "BDB-MIXED-EXPOSURE-WRITE-GATE-6", "generated_at_utc": gen,
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
        print(f"  write_gate_6/{f}")
    print(f"\n  Firestore writes: 0")
    print(f"  authorized: false")


if __name__ == "__main__":
    main()

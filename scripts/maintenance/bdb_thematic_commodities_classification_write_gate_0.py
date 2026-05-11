#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0
=================================================================
Gate preparation script for classifying the 14 gold/mining/precious-metals
thematic equity funds as sector funds in Firestore.

THIS SCRIPT IS READ-ONLY. It generates artifacts but does NOT write Firestore.

Changes planned (per fund in funds_v3):
  classification_v2.is_sector_fund = true
  classification_v2.sector_focus   = "COMMODITIES"  (or fund-specific theme)

These two fields unlock the existing engine rule (suitability_engine.py L61):
  if is_sector_fund:
      return False, "Sector funds excluded for profiles <= 4."

After the write, compatible_profiles will be correctly computed as [5..10]
for all 14 funds, and the next dry-run will show 0 STALE for them.

FORBIDDEN (in this script):
  - NO writes to any field
  - NO changes to compatible_profiles
  - NO deploy
  - NO changes to suitability_engine.py

PRODUCES:
  artifacts/suitability/thematic_commodities_classification_gate_0/
    selection.json
    snapshots_before.json
    diff_manifest.json
    rollback_manifest.json
    write_approval_manifest.json  (authorized=false, can_write=false)
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GATE_DIR = ROOT / "artifacts" / "suitability" / "thematic_commodities_classification_gate_0"
GATE_DIR.mkdir(parents=True, exist_ok=True)

COLLECTION = "funds_v3"

# 14 HOLD ISINs — all confirmed as commodities/gold/mining/precious-metals
THEMATIC_COMMODITIES_ISINS = {
    "IE00BYVJR916": {"name": "Jupiter Gold & Silver Fund L EUR Acc",              "sector_focus": "PRECIOUS_METALS"},
    "LU0090845842": {"name": "BlackRock GF World Mining Fund E2",                  "sector_focus": "MINING"},
    "LU0171306680": {"name": "BlackRock GF World Gold Fund E2 EUR",                "sector_focus": "PRECIOUS_METALS"},
    "LU0172157280": {"name": "BlackRock GF World Mining Fund A2 EUR",              "sector_focus": "MINING"},
    "LU0172157363": {"name": "BlackRock GF World Mining Fund E2 EUR",              "sector_focus": "MINING"},
    "LU0273148055": {"name": "DWS Invest Gold and Precious Metals Equities NC",    "sector_focus": "PRECIOUS_METALS"},
    "LU0273159177": {"name": "DWS Invest Gold and Precious Metals Equities LC",    "sector_focus": "PRECIOUS_METALS"},
    "LU0326425351": {"name": "BlackRock GF World Mining Fund E2 EUR Hdg",          "sector_focus": "MINING"},
    "LU0496368142": {"name": "Franklin Gold & Precious Metals Fund A(acc) EUR",    "sector_focus": "PRECIOUS_METALS"},
    "LU0496369389": {"name": "Franklin Gold & Precious Metals Fund N(acc) EUR",    "sector_focus": "PRECIOUS_METALS"},
    "LU0604766674": {"name": "Allianz GIF Allianz Global Metals and Mining",       "sector_focus": "MINING"},
    "LU1223083087": {"name": "Schroder ISF Global Gold A Acc EUR Hdg",             "sector_focus": "PRECIOUS_METALS"},
    "LU1223084051": {"name": "Schroder ISF Global Gold A Acc PLN Hdg",             "sector_focus": "PRECIOUS_METALS"},
    "LU1578889864": {"name": "Ninety One GSF Global Gold Fund A Acc EUR Hdg",      "sector_focus": "PRECIOUS_METALS"},
}

FIELDS_TO_WRITE = [
    "classification_v2.is_sector_fund",
    "classification_v2.sector_focus",
]

FORBIDDEN_FIELDS = [
    "classification_v2.compatible_profiles",
    "portfolio_exposure_v2",
    "manual",
    "manual.costs",
    "manual.costs.retrocession",
    "ms",
    "derived",
    "std_perf",
    "optimizer",
    "classification_v2.risk_bucket",
    "classification_v2.asset_type",
    "classification_v2.asset_subtype",
    "classification_v2.is_suitable_low_risk",
]


def _safe_dict(v):
    return v if isinstance(v, dict) else {}


def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore as fs
    if not firebase_admin._apps:
        cred_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_env and os.path.exists(cred_env):
            cred = credentials.Certificate(cred_env)
            firebase_admin.initialize_app(cred)
            print(f"[INIT] Firebase from GOOGLE_APPLICATION_CREDENTIALS")
        else:
            for kp in [ROOT / "scripts" / "serviceAccountKey.json",
                       ROOT / "functions_python" / "serviceAccountKey.json"]:
                if kp.exists():
                    cred = credentials.Certificate(str(kp))
                    firebase_admin.initialize_app(cred)
                    print(f"[INIT] Firebase from {kp.name}")
                    break
            else:
                firebase_admin.initialize_app()
                print("[INIT] Firebase from application default credentials")
    return fs.client()


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 72}")
    print(f"  BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0")
    print(f"  READ-ONLY gate preparation — no Firestore writes")
    print(f"  Generated at: {generated_at}")
    print(f"{'=' * 72}\n")

    print("[FIREBASE] Initializing (read-only)...")
    db = init_firebase()

    snapshots = []
    diffs = []
    rollbacks = []
    drift_any = False

    for isin, meta in THEMATIC_COMMODITIES_ISINS.items():
        name = meta["name"]
        sector_focus = meta["sector_focus"]
        print(f"\n[FUND] {isin} — {name}")

        doc = db.collection(COLLECTION).document(isin).get()
        if not doc.exists:
            print(f"  [WARN] Document not found in {COLLECTION}!")
            continue

        data = doc.to_dict() or {}
        class_v2 = _safe_dict(data.get("classification_v2"))

        current_is_sector_fund = class_v2.get("is_sector_fund")
        current_sector_focus   = class_v2.get("sector_focus")
        current_asset_subtype  = class_v2.get("asset_subtype")
        current_risk_bucket    = class_v2.get("risk_bucket")
        current_compat_profs   = class_v2.get("compatible_profiles", [])

        proposed_is_sector_fund = True
        proposed_sector_focus   = sector_focus

        already_correct = (current_is_sector_fund is True and current_sector_focus == sector_focus)
        drift = already_correct  # drift here means it's ALREADY correct — not a problem

        print(f"  current is_sector_fund: {current_is_sector_fund} | sector_focus: {current_sector_focus}")
        print(f"  proposed is_sector_fund: {proposed_is_sector_fund} | sector_focus: {proposed_sector_focus}")
        print(f"  current compatible_profiles: {current_compat_profs}")
        if already_correct:
            print(f"  [INFO] Already correctly classified — no change needed")

        # Snapshot
        snapshot = {
            "isin": isin,
            "name": name,
            "snapshotted_at": generated_at,
            "classification_v2": {
                "is_sector_fund": current_is_sector_fund,
                "sector_focus": current_sector_focus,
                "asset_subtype": current_asset_subtype,
                "risk_bucket": current_risk_bucket,
                "compatible_profiles": current_compat_profs,
            },
            "already_correct": already_correct,
        }
        snapshots.append(snapshot)

        # Diff
        diff = {
            "isin": isin,
            "name": name,
            "current_is_sector_fund": current_is_sector_fund,
            "current_sector_focus": current_sector_focus,
            "proposed_is_sector_fund": proposed_is_sector_fund,
            "proposed_sector_focus": proposed_sector_focus,
            "already_correct": already_correct,
            "change_needed": not already_correct,
            "rationale": (
                f"THEMATIC_EQUITY gold/mining/precious-metals fund. "
                f"Setting is_sector_fund=true + sector_focus={sector_focus} enables "
                f"existing engine rule L61 to correctly exclude profiles <= 4. "
                f"No engine code change required. Expected result: compatible_profiles=[5..10]."
            ),
        }
        diffs.append(diff)

        # Rollback
        rollback = {
            "isin": isin,
            "name": name,
            "restore": {
                "classification_v2.is_sector_fund": current_is_sector_fund,
                "classification_v2.sector_focus": current_sector_focus,
            },
        }
        rollbacks.append(rollback)

    # Summary counts
    needs_change = sum(1 for d in diffs if d["change_needed"])
    already_ok   = sum(1 for d in diffs if d["already_correct"])

    print(f"\n{'=' * 72}")
    print(f"  GATE SUMMARY")
    print(f"  Total ISINs: {len(THEMATIC_COMMODITIES_ISINS)}")
    print(f"  Needs change: {needs_change}")
    print(f"  Already correct: {already_ok}")
    print(f"  Fields to write: {FIELDS_TO_WRITE}")
    print(f"{'=' * 72}")

    # Write artifacts
    # 1. Selection
    selection = {
        "gate_id": "BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0",
        "generated_at": generated_at,
        "collection": COLLECTION,
        "total_selected": len(THEMATIC_COMMODITIES_ISINS),
        "selected_isins": list(THEMATIC_COMMODITIES_ISINS.keys()),
        "fields_to_write": FIELDS_TO_WRITE,
        "forbidden_fields": FORBIDDEN_FIELDS,
        "rationale": (
            "14 THEMATIC_EQUITY gold/mining/precious-metals funds with is_sector_fund=False. "
            "Setting is_sector_fund=True + sector_focus enables the existing engine rule (L61) "
            "to correctly exclude profiles 1-4. No engine code change required. "
            "Post-write, compatible_profiles must be regenerated to apply new classification."
        ),
        "write_executed": False,
        "deploy_executed": False,
    }
    (GATE_DIR / "selection.json").write_text(
        json.dumps(selection, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n[ARTIFACT] selection.json written")

    # 2. Snapshots
    snap_artifact = {
        "gate_id": "BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0",
        "generated_at": generated_at,
        "collection": COLLECTION,
        "total": len(snapshots),
        "snapshots": snapshots,
    }
    (GATE_DIR / "snapshots_before.json").write_text(
        json.dumps(snap_artifact, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    print(f"[ARTIFACT] snapshots_before.json written ({len(snapshots)} snapshots)")

    # 3. Diff manifest
    diff_artifact = {
        "gate_id": "BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0",
        "generated_at": generated_at,
        "total_diffs": len(diffs),
        "needs_change_count": needs_change,
        "already_correct_count": already_ok,
        "fields_to_write": FIELDS_TO_WRITE,
        "diffs": diffs,
    }
    (GATE_DIR / "diff_manifest.json").write_text(
        json.dumps(diff_artifact, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    print(f"[ARTIFACT] diff_manifest.json written")

    # 4. Rollback
    rollback_artifact = {
        "gate_id": "BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0",
        "generated_at": generated_at,
        "rollback_count": len(rollbacks),
        "rollbacks": rollbacks,
        "warning": (
            "DO NOT EXECUTE rollback unless explicitly instructed. "
            "Rollback restores is_sector_fund=False which is the gap state."
        ),
    }
    (GATE_DIR / "rollback_manifest.json").write_text(
        json.dumps(rollback_artifact, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
    )
    print(f"[ARTIFACT] rollback_manifest.json written")

    # 5. Approval manifest (authorized=false)
    approval = {
        "gate_id": "BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-GATE-0",
        "generated_at": generated_at,
        "authorized": False,
        "can_write": False,
        "requires_human_approval": True,
        "write_script_allowed": False,
        "approved_by_human": False,
        "approval_reason": None,
        "approved_at": None,
        "human_approval_required_reason": (
            "This manifest controls Firestore writes to classification_v2 fields. "
            "Set authorized=true and can_write=true ONLY after human review of "
            "diff_manifest.json and snapshots_before.json. "
            "Then create BDB-SUITABILITY-THEMATIC-COMMODITIES-CLASSIFICATION-WRITE-CONTROLLED-0."
        ),
        "selected_isins": list(THEMATIC_COMMODITIES_ISINS.keys()),
        "selected_count": len(THEMATIC_COMMODITIES_ISINS),
        "needs_change_count": needs_change,
        "already_correct_count": already_ok,
        "fields_to_write": FIELDS_TO_WRITE,
        "forbidden_fields": FORBIDDEN_FIELDS,
        "write_executed": False,
        "deploy_executed": False,
        "core_modified": False,
        "engine_modified": False,
        "post_write_required": True,
        "post_write_checklist": [
            "Re-run bdb_compatible_profiles_regen_dry_run.py — must show 0 STALE for these 14 ISINs",
            "Run test_suitability_thematic_commodities_contract.py — TestOptionBClassificationFix must PASS",
            "Run full suitability test suite",
            "Verify compatible_profiles regeneration needed (separate gate)",
        ],
    }
    (GATE_DIR / "write_approval_manifest.json").write_text(
        json.dumps(approval, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[ARTIFACT] write_approval_manifest.json written (authorized=false)")

    print(f"\n[DONE] Gate artifacts written to: {GATE_DIR}")
    print(f"  Needs change: {needs_change}/14")
    print(f"  Already correct: {already_ok}/14")
    print(f"  Write executed: NO")
    print(f"  Next: review diffs and authorize write gate\n")

    return {
        "needs_change": needs_change,
        "already_correct": already_ok,
        "total": len(THEMATIC_COMMODITIES_ISINS),
    }


if __name__ == "__main__":
    main()

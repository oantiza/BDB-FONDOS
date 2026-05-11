#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0
===========================================
Gate-preparation script for compatible_profiles regeneration.

This script reads live Firestore data for the 10 approved candidate funds,
compares current state against the proposed changes from previous dry-run
audits, detects any drift from the time of the dry-run, and produces five
structured artifacts for human review and approval.

NO Firestore writes are executed — ever.
The write_approval_manifest.json is always generated with:
  authorized: false
  can_write: false
  requires_human_approval: true

Selected ISINs (10 — human-approved):
  ES0118537002 — Olea Neutral FI
  ES0162946034 — Abante Selección FI
  FR0010306142 — Carmignac Patrimoine E EUR Acc
  LU0119195963 — Goldman Sachs Patrimonial Balanced P Cap EUR
  LU0404220724 — JPMorgan Global Income Fund D
  LU1697017256 — Sigma Selection Moderate A
  LU1894680757 — Amundi Income Opportunities A2 EUR
  LU1883334275 — Amundi Global Subordinated Bond A EUR
  LU1095739733 — First Eagle Amundi Income Builder AE-QD
  LU1883330521 — Amundi Global Multi-Asset Target Income A2 EUR

Excluded always:
  LU3038481936 — Hamco (insufficient historical data)
  14 commodities/precious-metals funds — HOLD_DO_NOT_ADD_P3_P4

Outputs:
  artifacts/suitability/compatible_profiles_write_gate_0/selection.json
  artifacts/suitability/compatible_profiles_write_gate_0/snapshots_before.json
  artifacts/suitability/compatible_profiles_write_gate_0/diff_manifest.json
  artifacts/suitability/compatible_profiles_write_gate_0/rollback_manifest.json
  artifacts/suitability/compatible_profiles_write_gate_0/write_approval_manifest.json

SAFETY GUARANTEES:
  - No calls to .set(), .update(), .delete(), .batch(), WriteBatch.
  - Rejects --write, --apply, --execute, --commit flags.
  - write_executed always false in all artifacts.

DO NOT RUN WITH WRITE FLAGS.

References:
  - artifacts/suitability/compatible_profiles_regen_dry_run_0.json
  - artifacts/suitability/compatible_profiles_sector_equity_verify_0.json
  - artifacts/suitability/compatible_profiles_verify_removals_0.json
  - docs/BDB_COMPATIBLE_PROFILES_REGEN_DRYRUN_0.md
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ─── SAFETY GUARD ─────────────────────────────────────────────────────────────
_FORBIDDEN_FLAGS = {"--write", "--apply", "--execute", "--commit", "--force", "--run"}
for _flag in sys.argv[1:]:
    if _flag.lower() in _FORBIDDEN_FLAGS:
        print(f"[ABORT] Forbidden flag detected: {_flag}")
        print("        This is a GATE-PREPARATION ONLY script. No write flags accepted.")
        print("        To execute writes: BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0")
        sys.exit(1)

# ─── PATHS ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "suitability" / "compatible_profiles_write_gate_0"
DRY_RUN_ARTIFACT = ROOT / "artifacts" / "suitability" / "compatible_profiles_regen_dry_run_0.json"

# ─── CONSTANTS ────────────────────────────────────────────────────────────────
GATE_ID = "BDB-COMPATIBLE-PROFILES-REGEN-WRITE-GATE-0"

# Human-approved selection — exactly 10 ISINs
SELECTED_ISINS = [
    "ES0118537002",  # Olea Neutral FI — +p3
    "ES0162946034",  # Abante Selección FI — +p3
    "FR0010306142",  # Carmignac Patrimoine E EUR Acc — +p3
    "LU0119195963",  # Goldman Sachs Patrimonial Balanced — +p3
    "LU0404220724",  # JPMorgan Global Income Fund D — +p3
    "LU1697017256",  # Sigma Selection Moderate A — +p3
    "LU1894680757",  # Amundi Income Opportunities A2 EUR — +p3
    "LU1883334275",  # Amundi Global Subordinated Bond A EUR — +p3,+p4
    "LU1095739733",  # First Eagle Amundi Income Builder AE-QD — REMOVE p4
    "LU1883330521",  # Amundi Global Multi-Asset Target Income — REMOVE p1,p2
]

# Exclusion lists — validated in previous blocks
HAMCO_ISIN = "LU3038481936"
COMMODITIES_HOLD_ISINS = [
    "IE00BYVJR916", "LU0090845842", "LU0171306680", "LU0172157280",
    "LU0172157363", "LU0273148055", "LU0273159177", "LU0326425351",
    "LU0496368142", "LU0496369389", "LU0604766674", "LU1223083087",
    "LU1223084051", "LU1578889864",
]

# Rationale per ISIN (from previous blocks)
RATIONALE = {
    "ES0118537002": "MIXED MODERATE_ALLOCATION. equity=15.5% <= 45% cap. Engine accepts p3. Stored=[4..10] predates rule; +p3 now eligible.",
    "ES0162946034": "MIXED MODERATE_ALLOCATION. equity=41.2% <= 45% cap. Engine accepts p3. Stored=[4..10] predates rule; +p3 now eligible.",
    "FR0010306142": "MIXED MODERATE_ALLOCATION. equity=35.4% <= 45% cap. Engine accepts p3. Post-MIXED remediation reduced equity from ~50% to 35.4%; +p3 now eligible. Carmignac Patrimoine.",
    "LU0119195963": "MIXED MODERATE_ALLOCATION. equity=38.7% <= 45% cap. Engine accepts p3. Stored=[4..10] predates rule; +p3 now eligible.",
    "LU0404220724": "MIXED MODERATE_ALLOCATION. equity=44.4% <= 45% cap. Engine accepts p3. Stored=[4..10] predates rule; +p3 now eligible. JPMorgan Global Income.",
    "LU1697017256": "MIXED MODERATE_ALLOCATION. equity=41.9% <= 45% cap. Engine accepts p3. Stored=[4..10] predates rule; +p3 now eligible.",
    "LU1894680757": "MIXED MODERATE_ALLOCATION. equity=30.3% <= 45% cap. Engine accepts p3. Stored=[4..10] predates rule; +p3 now eligible. Amundi Income Opportunities.",
    "LU1883334275": "FIXED_INCOME CORPORATE_BOND. equity=0.0%. No sector/subtype exclusions. Engine accepts p3,p4. Stored=[5..10] predates rule; +p3,+p4 now eligible. Amundi Global Subordinated Bond.",
    "LU1095739733": "MIXED MODERATE_ALLOCATION. equity=61.9% > 60% hard cap for p4. Engine removes p4 from eligibility. Stored=[4..10] overstates eligibility; REMOVE p4. SAFE confirmed by BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS-0.",
    "LU1883330521": "MIXED CONSERVATIVE_ALLOCATION. equity=31.7% > 30% hard cap for p1-p2. Engine removes p1,p2. Stored=[1..10] overstates eligibility; REMOVE p1,p2. HIGH UI RISK: p1/p2 users currently see this fund incorrectly. SAFE confirmed by BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS-0.",
}

# Source artifacts — audit trail
SOURCE_ARTIFACTS = [
    "artifacts/suitability/compatible_profiles_regen_dry_run_0.json",
    "artifacts/suitability/compatible_profiles_sector_equity_verify_0.json",
    "artifacts/suitability/compatible_profiles_verify_removals_0.json",
]
SOURCE_COMMITS = {
    "dry_run": "98e2143",
    "sector_equity_verify": "11d18e9",
    "removals_verify": "742e7b9",
}

# Fields that MUST NOT be modified — write gate guard
FORBIDDEN_FIELDS = [
    "portfolio_exposure_v2",
    "manual",
    "manual.costs",
    "manual.costs.retrocession",
    "ms",
    "derived",
    "std_perf",
    "firestore_rules",
    "optimizer",
    "suitability_engine_logic",
    "risk_bucket",
    "asset_type",
    "asset_subtype",
    "is_sector_fund",
    "sector_focus",
    "is_suitable_low_risk",
]
ALLOWED_FIELD = "classification_v2.compatible_profiles"


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _safe_float(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except Exception:
        return default


def _safe_dict(v):
    return v if isinstance(v, dict) else {}


def _safe_list(v):
    return v if isinstance(v, list) else []


def _load_dry_run_artifact():
    if not DRY_RUN_ARTIFACT.exists():
        print(f"[ERROR] Dry-run artifact not found: {DRY_RUN_ARTIFACT}")
        sys.exit(1)
    with open(DRY_RUN_ARTIFACT, encoding="utf-8") as f:
        return json.load(f)


def _get_dry_run_fund(dry_run_data, isin):
    for f in dry_run_data.get("per_fund_results", []):
        if f.get("isin") == isin:
            return f
    return None


# ─── FIREBASE INIT ────────────────────────────────────────────────────────────

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
                    break
            else:
                firebase_admin.initialize_app()
    return fs.client()


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 72}")
    print(f"  {GATE_ID}")
    print(f"  Gate preparation — READ-ONLY — NO WRITES")
    print(f"  Generated: {generated_at}")
    print(f"{'=' * 72}\n")

    # Validate selection
    assert HAMCO_ISIN not in SELECTED_ISINS, "SAFETY: Hamco must not be in selected list"
    for isin in COMMODITIES_HOLD_ISINS:
        assert isin not in SELECTED_ISINS, f"SAFETY: Commodity {isin} must not be in selected list"
    print(f"[VALIDATE] Selection safety checks PASSED")
    print(f"[VALIDATE] Selected: {len(SELECTED_ISINS)} ISINs — Hamco: excluded — Commodities: excluded\n")

    # Load dry-run artifact
    dry_run_data = _load_dry_run_artifact()
    print(f"[LOAD] Dry-run artifact loaded: {len(dry_run_data.get('per_fund_results', []))} fund records")

    # Init Firebase
    db = init_firebase()
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    # ─── Per-fund analysis ────────────────────────────────────────────────────
    selection_per_fund = []
    snapshot_records = []
    diff_records = []
    rollback_records = []
    any_drift = False

    for isin in SELECTED_ISINS:
        print(f"\n[READ] {isin}...")
        dr_fund = _get_dry_run_fund(dry_run_data, isin)
        if not dr_fund:
            print(f"  [WARN] Not found in dry-run artifact — skipping")
            continue

        dr_current = sorted(dr_fund.get("current_compatible_profiles") or [])
        dr_computed = sorted(dr_fund.get("computed_compatible_profiles") or [])

        # Live Firestore read
        doc = db.collection("funds_v3").document(isin).get()
        if not doc.exists:
            print(f"  [ERROR] Document does not exist in funds_v3!")
            continue

        data = doc.to_dict() or {}
        name = data.get("name", "")
        class_v2 = _safe_dict(data.get("classification_v2"))
        exp_v2 = _safe_dict(data.get("portfolio_exposure_v2"))
        ms = _safe_dict(data.get("ms"))
        derived = data.get("derived")

        live_profiles = sorted(_safe_list(class_v2.get("compatible_profiles")))
        asset_type = str(class_v2.get("asset_type", "")).upper()
        asset_subtype = str(class_v2.get("asset_subtype", "")).upper()
        risk_bucket = str(class_v2.get("risk_bucket", "") or "").upper()
        is_sector_fund = class_v2.get("is_sector_fund")
        sector_focus = class_v2.get("sector_focus")

        econ = _safe_dict(exp_v2.get("economic_exposure"))
        economic_exposure = {
            "equity": _safe_float(econ.get("equity")),
            "bond": _safe_float(econ.get("bond")),
            "cash": _safe_float(econ.get("cash")),
            "other": _safe_float(econ.get("other")),
        } if econ else None
        exposure_confidence = _safe_float(exp_v2.get("exposure_confidence"), None)

        ms_category = ms.get("category_morningstar") or ms.get("category") or ""
        ms_portfolio = _safe_dict(ms.get("portfolio"))
        ms_asset_alloc = _safe_dict(ms_portfolio.get("asset_allocation"))

        # Drift detection
        drift_detected = live_profiles != dr_current
        if drift_detected:
            any_drift = True
            print(f"  [DRIFT!] artifact_current={dr_current} live={live_profiles}")
        else:
            print(f"  [OK] live={live_profiles} == artifact_current — no drift")

        profiles_to_add = sorted(set(dr_computed) - set(live_profiles))
        profiles_to_remove = sorted(set(live_profiles) - set(dr_computed))
        proposed = sorted(dr_computed)

        # Change type
        if profiles_to_add and profiles_to_remove:
            change_type = "ADD_AND_REMOVE"
        elif profiles_to_add:
            change_type = "ADD_ONLY"
        elif profiles_to_remove:
            change_type = "REMOVE_ONLY"
        else:
            change_type = "NO_CHANGE"

        # Risk level
        if profiles_to_remove:
            risk_level = "HIGH_UI_RISK"
        elif profiles_to_add == [3] or (set(profiles_to_add) <= {3, 4}):
            risk_level = "LOW"
        else:
            risk_level = "MEDIUM"

        print(f"  name: {name}")
        print(f"  asset_class: {asset_type} | subtype: {asset_subtype}")
        print(f"  current (live): {live_profiles}")
        print(f"  proposed:       {proposed}")
        print(f"  +add: {profiles_to_add} | -remove: {profiles_to_remove}")
        print(f"  change_type: {change_type} | risk_level: {risk_level} | drift: {drift_detected}")

        # Selection record
        selection_per_fund.append({
            "isin": isin,
            "name": name,
            "current_compatible_profiles": live_profiles,
            "proposed_compatible_profiles": proposed,
            "profiles_to_add": profiles_to_add,
            "profiles_to_remove": profiles_to_remove,
            "change_type": change_type,
            "risk_level": risk_level,
            "drift_detected": drift_detected,
            "rationale": RATIONALE.get(isin, ""),
            "write_recommended": not drift_detected,
        })

        # Snapshot
        snapshot_records.append({
            "isin": isin,
            "name": name,
            "snapshot_at": generated_at,
            "classification_v2": {
                "asset_type": class_v2.get("asset_type"),
                "asset_subtype": class_v2.get("asset_subtype"),
                "risk_bucket": class_v2.get("risk_bucket"),
                "is_sector_fund": is_sector_fund,
                "sector_focus": sector_focus,
                "compatible_profiles": live_profiles,
            },
            "portfolio_exposure_v2": {
                "economic_exposure": economic_exposure,
                "exposure_confidence": exposure_confidence,
                "warnings": exp_v2.get("warnings") or [],
            },
            "ms_category": ms_category,
            "derived_present": derived is not None,
        })

        # Diff record
        diff_records.append({
            "isin": isin,
            "name": name,
            "field_to_update": ALLOWED_FIELD,
            "current_compatible_profiles": live_profiles,
            "proposed_compatible_profiles": proposed,
            "profiles_to_add": profiles_to_add,
            "profiles_to_remove": profiles_to_remove,
            "change_type": change_type,
            "risk_level": risk_level,
            "rationale": RATIONALE.get(isin, ""),
            "drift_detected": drift_detected,
            "write_recommended": not drift_detected,
            "forbidden_fields_not_touched": FORBIDDEN_FIELDS,
        })

        # Rollback record
        rollback_records.append({
            "isin": isin,
            "name": name,
            "document_path": f"funds_v3/{isin}",
            "restore_field": "classification_v2.compatible_profiles",
            "restore_value": live_profiles,
            "snapshot_at": generated_at,
            "note": "Set classification_v2.compatible_profiles back to this value to undo write gate changes.",
        })

    # ─── Write artifacts ──────────────────────────────────────────────────────

    # 1. selection.json
    selection = {
        "gate_id": GATE_ID,
        "generated_at": generated_at,
        "dry_run": True,
        "write_executed": False,
        "firestore_read_executed": True,
        "firestore_write_executed": False,
        "deploy_executed": False,
        "core_modified": False,
        "selected_count": len(selection_per_fund),
        "selected_isins": SELECTED_ISINS,
        "excluded_hamco": [HAMCO_ISIN],
        "excluded_commodities_hold": COMMODITIES_HOLD_ISINS,
        "drift_detected_any": any_drift,
        "source_artifacts": SOURCE_ARTIFACTS,
        "source_commits": SOURCE_COMMITS,
        "selection_criteria": [
            "STALE in BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0",
            "NOT Hamco (LU3038481936)",
            "NOT in 14 commodities/precious-metals HOLD group (BDB-COMPATIBLE-PROFILES-VERIFY-SECTOR-EQUITY-0)",
            "Removal cases verified SAFE by BDB-COMPATIBLE-PROFILES-VERIFY-REMOVALS-0",
            "Human-approved final ISIN list confirmed by product owner",
        ],
        "per_fund": selection_per_fund,
    }
    _write_artifact("selection.json", selection)

    # 2. snapshots_before.json
    snapshots = {
        "gate_id": GATE_ID,
        "generated_at": generated_at,
        "write_executed": False,
        "snapshot_count": len(snapshot_records),
        "purpose": "Pre-write snapshot for audit and rollback reference.",
        "snapshots": snapshot_records,
    }
    _write_artifact("snapshots_before.json", snapshots)

    # 3. diff_manifest.json
    diff_manifest = {
        "gate_id": GATE_ID,
        "generated_at": generated_at,
        "write_executed": False,
        "field_to_update": ALLOWED_FIELD,
        "forbidden_fields": FORBIDDEN_FIELDS,
        "drift_detected_any": any_drift,
        "diff_count": len(diff_records),
        "diffs": diff_records,
    }
    _write_artifact("diff_manifest.json", diff_manifest)

    # 4. rollback_manifest.json
    rollback = {
        "gate_id": GATE_ID,
        "generated_at": generated_at,
        "write_executed": False,
        "purpose": "Restore classification_v2.compatible_profiles to pre-write values if rollback is needed.",
        "rollback_field": "classification_v2.compatible_profiles",
        "no_deletes": True,
        "no_other_fields": True,
        "rollback_count": len(rollback_records),
        "rollbacks": rollback_records,
    }
    _write_artifact("rollback_manifest.json", rollback)

    # 5. write_approval_manifest.json
    approval = {
        "gate_id": GATE_ID,
        "generated_at": generated_at,
        "authorized": False,
        "can_write": False,
        "requires_human_approval": True,
        "write_script_allowed": False,
        "human_approval_required_reason": (
            "This manifest controls irreversible Firestore writes to production funds_v3. "
            "Set authorized=true and can_write=true ONLY after human review of "
            "diff_manifest.json and snapshots_before.json. Then create "
            "BDB-COMPATIBLE-PROFILES-REGEN-WRITE-CONTROLLED-0."
        ),
        "drift_detected": any_drift,
        "blocked_if_drift": True,
        "selected_count": len(SELECTED_ISINS),
        "selected_isins": SELECTED_ISINS,
        "excluded_isins": {
            "hamco": [HAMCO_ISIN],
            "commodities_precious_metals": COMMODITIES_HOLD_ISINS,
        },
        "field_to_write": ALLOWED_FIELD,
        "forbidden_fields": FORBIDDEN_FIELDS,
        "post_write_required": True,
        "post_write_checklist": [
            "Re-run BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN script to confirm 0 STALE for these 10 ISINs",
            "Run full test suite: test_suitability_contract_parity.py + test_suitability_v2.py",
            "Run frontend: npx vitest run src/utils/rulesEngine.suitability.test.ts",
            "Verify no unintended changes to portfolio_exposure_v2, ms, manual, derived fields",
            "Create BDB-COMPATIBLE-PROFILES-REGEN-WRITECONTROLLED-0 closeout doc with commit",
        ],
        "write_executed": False,
        "deploy_executed": False,
        "core_modified": False,
    }
    _write_artifact("write_approval_manifest.json", approval)

    # ─── Summary ──────────────────────────────────────────────────────────────
    add_only = sum(1 for d in diff_records if d["change_type"] == "ADD_ONLY")
    remove_only = sum(1 for d in diff_records if d["change_type"] == "REMOVE_ONLY")
    add_and_remove = sum(1 for d in diff_records if d["change_type"] == "ADD_AND_REMOVE")
    high_ui_risk = sum(1 for d in diff_records if d["risk_level"] == "HIGH_UI_RISK")

    print(f"\n{'=' * 72}")
    print(f"  GATE PREPARATION COMPLETE — NO FIRESTORE WRITES EXECUTED")
    print(f"{'=' * 72}")
    print(f"  Selected funds:       {len(selection_per_fund)}")
    print(f"  ADD_ONLY:             {add_only}")
    print(f"  REMOVE_ONLY:          {remove_only}")
    print(f"  ADD_AND_REMOVE:       {add_and_remove}")
    print(f"  HIGH_UI_RISK:         {high_ui_risk}")
    print(f"  Drift detected:       {any_drift}")
    print(f"  authorized:           False")
    print(f"  can_write:            False")
    print(f"  write_executed:       False")
    print(f"  Artifacts in:         {ARTIFACT_DIR}")
    print(f"{'=' * 72}\n")

    return approval


def _write_artifact(filename, data):
    path = ARTIFACT_DIR / filename
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    print(f"[ARTIFACT] Written: {path.name}")


if __name__ == "__main__":
    main()

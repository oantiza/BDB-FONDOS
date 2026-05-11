#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-AUDIT-0
================================================
READ-ONLY audit of FE-9 divergence: identifies funds in funds_v3 that carry
the fi_credit.low_quality / credit.low_quality field in portfolio_exposure_v2
and cross-references against compatible_profiles to quantify the FE-9 gap.

WRITE GUARD: This script performs NO Firestore writes.
Any invocation with --write, --apply, --execute, or --commit is rejected.

Produces:
  artifacts/suitability/fe9_low_quality_credit_audit_0.json
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Write guard ────────────────────────────────────────────────────────────────
FORBIDDEN_FLAGS = {"--write", "--apply", "--execute", "--commit"}
if FORBIDDEN_FLAGS & set(sys.argv[1:]):
    print("[ABORT] Forbidden flag detected. This script is READ-ONLY.")
    sys.exit(1)

ROOT        = Path(__file__).resolve().parents[2]
ARTIFACT    = ROOT / "artifacts" / "suitability" / "fe9_low_quality_credit_audit_0.json"
COLLECTION  = "funds_v3"

FE9_THRESHOLD = 35.0   # frontend rule: lowQualityCredit >= 35 → block for profiles <= 4
FE9_MAX_PROFILE = 4    # rule applies to profiles <= 4

# Paths the frontend checks (rulesEngine.ts L425):
#   expV2?.fi_credit?.low_quality || expV2?.credit?.low_quality
LOW_QUALITY_PATHS = [
    ("portfolio_exposure_v2", "fi_credit", "low_quality"),
    ("portfolio_exposure_v2", "credit",    "low_quality"),
]


def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore as fs
    if not firebase_admin._apps:
        cred_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_env and os.path.exists(cred_env):
            cred = credentials.Certificate(cred_env)
            firebase_admin.initialize_app(cred)
            print("[INIT] Firebase from GOOGLE_APPLICATION_CREDENTIALS")
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


def _get_low_quality(doc_data: dict) -> tuple[float | None, str | None]:
    """Return (value, path_found) for the first non-None low_quality value."""
    for path in LOW_QUALITY_PATHS:
        obj = doc_data
        for key in path:
            if not isinstance(obj, dict):
                obj = None
                break
            obj = obj.get(key)
        if obj is not None:
            try:
                return float(obj), ".".join(path)
            except (TypeError, ValueError):
                pass
    return None, None


def _get_compatible_profiles(doc_data: dict) -> list[int]:
    class_v2 = doc_data.get("classification_v2") or {}
    cp = class_v2.get("compatible_profiles", [])
    return sorted(int(x) for x in cp) if cp else []


def _has_profile_le4(compatible_profiles: list[int]) -> bool:
    return any(p <= FE9_MAX_PROFILE for p in compatible_profiles)


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 68}")
    print(f"  BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-AUDIT-0")
    print(f"  READ-ONLY — NO writes — NO deploy")
    print(f"  Generated at: {generated_at}")
    print(f"{'=' * 68}\n")

    db = init_firebase()

    total_scanned = 0
    funds_with_field: list[dict] = []
    funds_missing_field: list[str] = []
    funds_over_threshold: list[dict] = []
    data_paths_found: dict[str, int] = {}

    print(f"[SCAN] Reading {COLLECTION}...")
    docs = db.collection(COLLECTION).stream()

    for doc in docs:
        total_scanned += 1
        data = doc.to_dict() or {}
        isin = doc.id
        name = data.get("name", "")

        lq_value, lq_path = _get_low_quality(data)
        cp = _get_compatible_profiles(data)
        has_p_le4 = _has_profile_le4(cp)

        if lq_path:
            data_paths_found[lq_path] = data_paths_found.get(lq_path, 0) + 1

        asset_type = (data.get("classification_v2") or {}).get("asset_type", "UNKNOWN")
        asset_subtype = (data.get("classification_v2") or {}).get("asset_subtype", "UNKNOWN")

        entry = {
            "isin": isin,
            "name": name,
            "asset_type": asset_type,
            "asset_subtype": asset_subtype,
            "low_quality_credit_value": lq_value,
            "source_path": lq_path,
            "compatible_profiles": cp,
            "has_profile_le4": has_p_le4,
            "fe9_would_block": (lq_value is not None and lq_value >= FE9_THRESHOLD),
            "fe9_gap": False,  # backend ok, frontend blocks
        }

        if lq_value is not None:
            funds_with_field.append(entry)
            if lq_value >= FE9_THRESHOLD:
                entry["fe9_gap"] = has_p_le4  # gap only if compatible_profiles includes p<=4
                funds_over_threshold.append(entry)
        else:
            funds_missing_field.append(isin)

    over_35_profile_le4_count = sum(1 for f in funds_over_threshold if f["fe9_gap"])

    # Print summary
    print(f"\n{'=' * 68}")
    print(f"  AUDIT RESULTS")
    print(f"{'=' * 68}")
    print(f"  Total scanned:                  {total_scanned}")
    print(f"  With low_quality field:         {len(funds_with_field)}")
    print(f"  Missing field:                  {len(funds_missing_field)}")
    print(f"  Over FE-9 threshold (>= 35%):  {len(funds_over_threshold)}")
    print(f"  Over threshold + profile <= 4 (FE-9 gap): {over_35_profile_le4_count}")
    print(f"  Data paths found:")
    for path, count in data_paths_found.items():
        print(f"    {path}: {count}")

    if funds_over_threshold:
        print(f"\n  Funds over threshold ({len(funds_over_threshold)}):")
        for f in funds_over_threshold:
            gap = " [FE-9 GAP]" if f["fe9_gap"] else ""
            print(f"    {f['isin']} | {f['name'][:45]:<45} | "
                  f"lq={f['low_quality_credit_value']:.1f}% | "
                  f"cp={f['compatible_profiles']} | {f['asset_subtype']}{gap}")

    # Artifact
    artifact = {
        "audit_id": "BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-AUDIT-0",
        "generated_at": generated_at,
        "dry_run": True,
        "write_executed": False,
        "deploy_executed": False,
        "core_modified": False,
        "collection": COLLECTION,
        "fe9_rule": {
            "description": "Frontend blocks funds with low_quality >= 35% for profiles <= 4",
            "threshold_pct": FE9_THRESHOLD,
            "applies_to_profiles_le": FE9_MAX_PROFILE,
            "data_paths_checked": [".".join(p) for p in LOW_QUALITY_PATHS],
            "backend_has_rule": False,
            "divergence_id": "FE-9",
            "divergence_status": "KNOWN_DIVERGENCE_FRONTEND_ONLY",
        },
        "stats": {
            "total_scanned": total_scanned,
            "funds_with_low_quality_field": len(funds_with_field),
            "funds_missing_field": len(funds_missing_field),
            "funds_over_35": len(funds_over_threshold),
            "over_35_profile_le_4_count": over_35_profile_le4_count,
        },
        "data_paths_found": data_paths_found,
        "funds_over_threshold": funds_over_threshold,
        "examples_missing_field": funds_missing_field[:10],
    }

    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    print(f"\n[ARTIFACT] Saved to: {ARTIFACT}")
    print(f"{'=' * 68}\n")


if __name__ == "__main__":
    main()

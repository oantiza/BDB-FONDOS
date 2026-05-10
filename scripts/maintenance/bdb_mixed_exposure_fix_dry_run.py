#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BDB-MIXED-EXPOSURE-FIX-DRYRUN-0 — Read-only dry-run script.

Reads MIXED funds from Firestore funds_v3 and simulates the exposure fix
using ms.portfolio.asset_allocation. Generates a local JSON artifact with
before/after comparisons. NEVER writes to Firestore.

Usage:
  python scripts/maintenance/bdb_mixed_exposure_fix_dry_run.py
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add project roots to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "functions_python"))

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "bdb_mixed_exposure_fix"
ARTIFACT_PATH = ARTIFACT_DIR / "mixed_exposure_fix_dry_run.json"


def _safe_dict(value):
    return value if isinstance(value, dict) else {}


def _safe_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def init_firebase():
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        key_paths = [
            os.path.join(os.path.dirname(__file__), "..", "serviceAccountKey.json"),
            os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "serviceAccountKey.json"),
            "./serviceAccountKey.json",
        ]
        for kp in key_paths:
            kp_abs = os.path.abspath(kp)
            if os.path.exists(kp_abs):
                cred = credentials.Certificate(kp_abs)
                firebase_admin.initialize_app(cred)
                print(f"[INIT] Firebase initialized with key: {kp_abs}")
                break
        else:
            firebase_admin.initialize_app()
            print("[INIT] Firebase initialized with default credentials")

    return firestore.client()


def analyze_fund(isin: str, data: dict) -> dict:
    """Analyze a single MIXED fund and produce a before/after comparison."""
    data = _safe_dict(data)
    ms = _safe_dict(data.get("ms"))
    metrics = _safe_dict(data.get("metrics"))
    exp_v2 = _safe_dict(data.get("portfolio_exposure_v2"))
    class_v2 = _safe_dict(data.get("classification_v2"))
    old_econ = _safe_dict(exp_v2.get("economic_exposure"))

    # Current persisted values
    old_eq = _safe_float(old_econ.get("equity"))
    old_bd = _safe_float(old_econ.get("bond"))
    old_ca = _safe_float(old_econ.get("cash"))
    old_ot = _safe_float(old_econ.get("other"))
    old_confidence = _safe_float(exp_v2.get("exposure_confidence"))

    # Morningstar real data
    ms_portfolio = _safe_dict(ms.get("portfolio"))
    ms_alloc = _safe_dict(ms_portfolio.get("asset_allocation"))
    ms_eq = _safe_float(ms_alloc.get("equity"))
    ms_bd = _safe_float(ms_alloc.get("bond"))
    ms_ca = _safe_float(ms_alloc.get("cash"))
    ms_ot = _safe_float(ms_alloc.get("other"))
    ms_total = ms_eq + ms_bd + ms_ca + ms_ot

    # Metrics data
    met_eq = _safe_float(metrics.get("equity"))
    met_bd = _safe_float(metrics.get("bond"))
    met_ca = _safe_float(metrics.get("cash"))
    met_ot = _safe_float(metrics.get("other"))
    met_total = met_eq + met_bd + met_ca + met_ot

    # Determine source and proposed values
    has_metrics = met_total >= 1.0
    has_ms_portfolio = ms_total >= 10.0
    is_current_fallback = (
        abs(old_eq - 50.0) < 0.5 and abs(old_bd - 50.0) < 0.5
    ) or (
        abs(old_eq - 20.0) < 0.5 and abs(old_bd - 80.0) < 0.5
    ) or (
        abs(old_eq - 80.0) < 0.5 and abs(old_bd - 20.0) < 0.5
    )

    # Proposed values
    if has_metrics:
        source_used = "metrics"
        prop_eq, prop_bd, prop_ca, prop_ot = met_eq, met_bd, met_ca, met_ot
        prop_confidence = 0.90
        write_recommended = False
        reason = "metrics already valid; no change needed"
    elif has_ms_portfolio:
        source_used = "ms_portfolio_asset_allocation"
        # Normalize to sum 100
        factor = 100.0 / ms_total if ms_total > 0 else 1.0
        prop_eq = round(ms_eq * factor, 1)
        prop_bd = round(ms_bd * factor, 1)
        prop_ca = round(ms_ca * factor, 1)
        prop_ot = round(ms_ot * factor, 1)
        prop_confidence = 0.85
        write_recommended = is_current_fallback
        reason = (
            "Morningstar real data available; replaces classification fallback"
            if is_current_fallback
            else "Morningstar real data available; current values may already be adequate"
        )
    else:
        source_used = "fallback"
        prop_eq, prop_bd, prop_ca, prop_ot = old_eq, old_bd, old_ca, old_ot
        prop_confidence = 0.55
        write_recommended = False
        reason = "no Morningstar data; fallback is only option"

    review_required = (
        has_ms_portfolio
        and is_current_fallback
        and abs(prop_eq - old_eq) > 10.0
    )

    return {
        "isin": isin,
        "name": data.get("name", ""),
        "subtype": class_v2.get("asset_subtype", ""),
        "old_economic_exposure": {
            "equity": old_eq,
            "bond": old_bd,
            "cash": old_ca,
            "other": old_ot,
        },
        "ms_portfolio_asset_allocation": {
            "equity": ms_eq,
            "bond": ms_bd,
            "cash": ms_ca,
            "other": ms_ot,
            "sum": round(ms_total, 2),
        } if has_ms_portfolio else None,
        "proposed_economic_exposure": {
            "equity": prop_eq,
            "bond": prop_bd,
            "cash": prop_ca,
            "other": prop_ot,
        },
        "delta_equity": round(prop_eq - old_eq, 2),
        "delta_bond": round(prop_bd - old_bd, 2),
        "delta_cash": round(prop_ca - old_ca, 2),
        "delta_other": round(prop_ot - old_ot, 2),
        "source_used": source_used,
        "confidence_before": old_confidence,
        "confidence_after": prop_confidence,
        "write_recommended": write_recommended,
        "review_required": review_required,
        "reason": reason,
    }


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    print(f"\n{'=' * 60}")
    print("  BDB-MIXED-EXPOSURE-FIX — DRY-RUN")
    print(f"  Generated: {generated_at}")
    print(f"  Mode: READ-ONLY (no Firestore writes)")
    print(f"{'=' * 60}\n")

    db = init_firebase()
    query = db.collection("funds_v3").where("classification_v2.asset_type", "==", "MIXED")
    docs = list(query.stream())

    print(f"  Found {len(docs)} MIXED funds in funds_v3\n")

    patches = []
    stats = {
        "total_mixed": len(docs),
        "using_metrics": 0,
        "using_ms_portfolio": 0,
        "using_fallback": 0,
        "write_recommended": 0,
        "review_required": 0,
    }

    for doc in docs:
        data = doc.to_dict() or {}
        result = analyze_fund(doc.id, data)
        patches.append(result)

        if result["source_used"] == "metrics":
            stats["using_metrics"] += 1
        elif result["source_used"] == "ms_portfolio_asset_allocation":
            stats["using_ms_portfolio"] += 1
        else:
            stats["using_fallback"] += 1

        if result["write_recommended"]:
            stats["write_recommended"] += 1
        if result["review_required"]:
            stats["review_required"] += 1

        flag = "⚠️ WRITE" if result["write_recommended"] else "  ✅ OK  "
        print(
            f"  [{flag}] {doc.id} | "
            f"old_eq={result['old_economic_exposure']['equity']:5.1f} → "
            f"new_eq={result['proposed_economic_exposure']['equity']:5.1f} | "
            f"Δeq={result['delta_equity']:+6.1f} | "
            f"source={result['source_used']}"
        )

    # Sort patches: write_recommended first, then by delta magnitude
    patches.sort(key=lambda p: (-int(p["write_recommended"]), -abs(p["delta_equity"])))

    artifact = {
        "audit_id": "BDB-MIXED-EXPOSURE-FIX-DRY-RUN",
        "generated_at_utc": generated_at,
        "mode": "dry-run",
        "write_executed": False,
        "firestore_read_executed": True,
        "firestore_write_executed": False,
        "stats": stats,
        "patches": patches,
        "forbidden_contexts": {
            "firestore_write_executed": False,
            "deploy_executed": False,
            "core_used": False,
            "optimizer_modified": False,
            "suitability_modified": False,
            "frontend_modified": False,
        },
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    ARTIFACT_PATH.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    print(f"\n{'=' * 60}")
    print("  DRY-RUN COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Total MIXED:         {stats['total_mixed']}")
    print(f"  Using metrics:       {stats['using_metrics']}")
    print(f"  Using ms.portfolio:  {stats['using_ms_portfolio']}")
    print(f"  Using fallback:      {stats['using_fallback']}")
    print(f"  Write recommended:   {stats['write_recommended']}")
    print(f"  Review required:     {stats['review_required']}")
    print(f"\n  Artifact saved to:   {ARTIFACT_PATH}")
    print(f"  No Firestore writes executed.")

    return artifact


if __name__ == "__main__":
    main()

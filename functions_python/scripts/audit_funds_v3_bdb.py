#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from collections import Counter
from pathlib import Path


def normalize_check(value):
    """
    Devuelve True si parece estar en escala 0-100
    en vez de 0-1.
    """
    if isinstance(value, (int, float)):
        return value > 1
    return False


def audit(funds):
    issues = Counter()
    asset_types = Counter()
    regions = Counter()

    critical = 0
    warning = 0

    for f in funds:
        cls = f.get("classification_v2", {}) or {}
        exp = f.get("portfolio_exposure_v2", {}) or {}
        metrics = f.get("metrics", {}) or {}

        asset = cls.get("asset_type") or "UNKNOWN"
        region = cls.get("region_primary") or "UNKNOWN"

        asset_types[asset] += 1
        regions[region] += 1

        # --- NORMALIZACIÓN REAL ---
        for v in (exp.get("equity_regions") or {}).values():
            if normalize_check(v):
                issues["equity_regions_not_normalized"] += 1
                warning += 1

        for v in (exp.get("sectors") or {}).values():
            if normalize_check(v):
                issues["sectors_not_normalized"] += 1
                warning += 1

        for v in (exp.get("equity_styles") or {}).values():
            if normalize_check(v):
                issues["equity_styles_not_normalized"] += 1
                warning += 1

        for v in (exp.get("bond_types") or {}).values():
            if normalize_check(v):
                issues["bond_types_not_normalized"] += 1
                warning += 1

        for v in (exp.get("credit") or {}).values():
            if normalize_check(v):
                issues["credit_not_normalized"] += 1
                warning += 1

        for v in (exp.get("duration") or {}).values():
            if normalize_check(v):
                issues["duration_not_normalized"] += 1
                warning += 1

        # --- UNKNOWN (PROBLEMA REAL) ---
        if region == "UNKNOWN":
            issues["region_unknown"] += 1
            warning += 1

        # --- CALIDAD REAL ---
        if metrics.get("history_ok") is False:
            issues["history_not_ok"] += 1
            critical += 1

        # --- WARNINGS DE CLASIFICACIÓN / EXPOSICIÓN ---
        for w in (cls.get("warnings") or []):
            issues[f"classification_warning:{w}"] += 1
            warning += 1

        for w in (exp.get("warnings") or []):
            issues[f"exposure_warning:{w}"] += 1
            warning += 1

    return {
        "total": len(funds),
        "issues": dict(issues),
        "asset_types": dict(asset_types),
        "regions": dict(regions),
        "critical": critical,
        "warning": warning,
    }


def main():
    base_dir = Path(__file__).resolve().parents[2]
    input_path = base_dir / "funds_v3.json"

    if not input_path.exists():
        print(f"No encuentro el archivo: {input_path}")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    result = audit(data)

    print("\n=== AUDITORÍA REAL LIMPIA BDB ===")
    print(f"Total fondos: {result['total']}")
    print(f"Critical: {result['critical']}")
    print(f"Warnings: {result['warning']}")

    print("\nDistribución asset_type:")
    for k, v in sorted(result["asset_types"].items(), key=lambda x: (-x[1], x[0])):
        print(f"{k}: {v}")

    print("\nDistribución region_primary:")
    for k, v in sorted(result["regions"].items(), key=lambda x: (-x[1], x[0])):
        print(f"{k}: {v}")

    print("\nTop issues:")
    for k, v in sorted(result["issues"].items(), key=lambda x: -x[1])[:20]:
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
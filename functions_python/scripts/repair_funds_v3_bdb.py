#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from pathlib import Path
from collections import Counter


def normalize_value(v):
    """
    Convierte:
    - 0–100 → 0–1
    - strings tipo "45%" → 0.45
    """
    if v is None:
        return v

    if isinstance(v, str):
        s = v.strip().replace(",", ".")
        if s.endswith("%"):
            try:
                return float(s[:-1]) / 100.0
            except Exception:
                return v

    if isinstance(v, (int, float)):
        if v > 1:
            return v / 100.0

    return v


def normalize_map(m):
    if not isinstance(m, dict):
        return m, 0

    fixes = 0
    new_map = {}

    for k, v in m.items():
        new_v = normalize_value(v)
        if new_v != v:
            fixes += 1
        new_map[k] = new_v

    return new_map, fixes


def repair(funds):
    total_fixes = Counter()
    funds_fixed = 0

    for f in funds:
        exp = f.get("portfolio_exposure_v2", {})

        fund_fixes = 0

        # --- MAPAS A NORMALIZAR ---
        for key in [
            "equity_regions",
            "sectors",
            "equity_styles",
            "bond_types",
            "credit",
            "duration"
        ]:
            if key in exp:
                new_map, fixes = normalize_map(exp[key])
                if fixes > 0:
                    exp[key] = new_map
                    total_fixes[key] += fixes
                    fund_fixes += 1

        if fund_fixes > 0:
            funds_fixed += 1

    return funds, funds_fixed, total_fixes


def main():
    base_dir = Path(__file__).resolve().parents[2]

    input_path = base_dir / "funds_v3.json"
    output_path = base_dir / "funds_v3_repaired.json"

    if not input_path.exists():
        print(f"No encuentro el archivo: {input_path}")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    repaired, funds_fixed, fixes = repair(data)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(repaired, f, ensure_ascii=False, indent=2)

    print("\n=== REPAIR COMPLETADO ===")
    print(f"Fondos procesados: {len(data)}")
    print(f"Fondos modificados: {funds_fixed}")

    print("\nCambios por campo:")
    for k, v in fixes.items():
        print(f"{k}: {v}")

    print(f"\nArchivo generado: {output_path}")


if __name__ == "__main__":
    main()
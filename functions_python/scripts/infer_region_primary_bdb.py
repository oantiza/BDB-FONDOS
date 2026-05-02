#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from pathlib import Path
from collections import Counter


REGION_CANONICAL = {
    "GLOBAL": "GLOBAL",
    "WORLD": "GLOBAL",
    "US": "US",
    "USA": "US",
    "UNITED STATES": "US",
    "EUROPE": "EUROPE",
    "EUROZONE": "EUROZONE",
    "JAPAN": "JAPAN",
    "ASIA_DEV": "ASIA_DEV",
    "ASIA DEVELOPED": "ASIA_DEV",
    "ASIA PACIFIC": "ASIA_DEV",
    "EMERGING": "EMERGING",
    "EMERGING MARKETS": "EMERGING",
}


MS_REGION_MAP = {
    "us": "US",
    "usa": "US",
    "united states": "US",
    "north america": "US",
    "europe": "EUROPE",
    "eu": "EUROPE",
    "eurozone": "EUROZONE",
    "japan": "JAPAN",
    "asia_dev": "ASIA_DEV",
    "asia developed": "ASIA_DEV",
    "asia pacific": "ASIA_DEV",
    "emerging": "EMERGING",
    "emerging markets": "EMERGING",
    "global": "GLOBAL",
    "world": "GLOBAL",
}


def clean_str(v):
    if v is None:
        return None
    return str(v).strip()


def normalize_region(region):
    if not region:
        return None
    r = str(region).strip().upper()
    return REGION_CANONICAL.get(r, r)


def infer_from_equity_regions(exp):
    eq = exp.get("equity_regions") or {}

    if not isinstance(eq, dict) or not eq:
        return None, None

    best_region = None
    best_weight = -1.0

    for region, weight in eq.items():
        if not isinstance(weight, (int, float)):
            continue
        if str(region).upper() == "UNKNOWN":
            continue

        if weight > best_weight:
            best_weight = weight
            best_region = region

    if best_region and best_weight >= 0.20:
        return normalize_region(best_region), "equity_regions_dominant"

    total = sum(v for v in eq.values() if isinstance(v, (int, float)))
    if total > 0:
        return "GLOBAL", "equity_regions_diversified"

    return None, None


def infer_from_ms_regions(ms):
    regions = ms.get("regions") or {}

    if not isinstance(regions, dict) or not regions:
        return None, None

    normalized = {}

    for k, v in regions.items():
        key = clean_str(k)
        if not key:
            continue

        mapped = MS_REGION_MAP.get(key.lower())
        if not mapped:
            continue

        if isinstance(v, (int, float)):
            weight = v / 100.0 if v > 1 else v
            normalized[mapped] = normalized.get(mapped, 0.0) + weight

    if not normalized:
        return None, None

    best_region = max(normalized.items(), key=lambda x: x[1])[0]
    best_weight = normalized[best_region]

    if best_weight >= 0.20:
        return best_region, "ms_regions_dominant"

    return "GLOBAL", "ms_regions_diversified"


def infer_from_derived(fund):
    derived = fund.get("derived", {}) or {}

    primary = derived.get("primary_region")
    if primary and str(primary).upper() != "UNKNOWN":
        return normalize_region(primary), "derived_primary_region"

    return None, None


def infer_region(fund):
    cls = fund.get("classification_v2", {}) or {}
    exp = fund.get("portfolio_exposure_v2", {}) or {}
    ms = fund.get("ms", {}) or {}

    current = cls.get("region_primary")

    if current and str(current).upper() != "UNKNOWN":
        return None, None

    # 1) equity_regions
    region, source = infer_from_equity_regions(exp)
    if region:
        return region, source

    # 2) ms.regions
    region, source = infer_from_ms_regions(ms)
    if region:
        return region, source

    # 3) derived
    region, source = infer_from_derived(fund)
    if region:
        return region, source

    return None, None


def main():
    base_dir = Path(__file__).resolve().parents[2]
    input_path = base_dir / "funds_v3.json"
    output_path = base_dir / "funds_v3_region_inferred.json"

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    changed = 0
    source_counter = Counter()
    region_counter = Counter()

    for fund in data:
        cls = fund.get("classification_v2", {}) or {}
        current = cls.get("region_primary")

        if current and str(current).upper() != "UNKNOWN":
            continue

        inferred, source = infer_region(fund)

        if inferred:
            inferred = normalize_region(inferred)

            cls["region_primary"] = inferred

            warnings = cls.get("warnings") or []
            tag = f"REGION_PRIMARY_INFERRED:{source}"

            if tag not in warnings:
                warnings.append(tag)

            cls["warnings"] = warnings
            fund["classification_v2"] = cls

            changed += 1
            source_counter[source] += 1
            region_counter[inferred] += 1

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n=== INFER REGION PRIMARY COMPLETADO ===")
    print(f"Fondos procesados: {len(data)}")
    print(f"Fondos con region_primary inferida: {changed}")

    print("\nPor fuente:")
    for k, v in source_counter.items():
        print(f"{k}: {v}")

    print("\nPor región inferida:")
    for k, v in region_counter.items():
        print(f"{k}: {v}")

    print(f"\nArchivo generado: {output_path}")


if __name__ == "__main__":
    main()
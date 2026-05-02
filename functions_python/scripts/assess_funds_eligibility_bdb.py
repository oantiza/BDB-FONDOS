#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from pathlib import Path
from collections import Counter


# --- REGLAS ---
EXCLUDE_RULES = {
    "history_not_ok",
}

LIMIT_RULES = {
    "region_unknown",
    "HEURISTIC_STYLE_DEDUCTION",
    "FI_UNKNOWN_DURATION_BUCKET",
    "FI_UNKNOWN_CREDIT_BUCKET",
    "FI_UNKNOWN_SUBTYPE",
    "REGION_PRIMARY_BORDERLINE",
}


def classify_fund(f):
    cls = f.get("classification_v2", {}) or {}
    exp = f.get("portfolio_exposure_v2", {}) or {}
    metrics = f.get("metrics", {}) or {}

    reasons = set()

    # --- EXCLUDE ---
    if metrics.get("history_ok") is False:
        reasons.add("history_not_ok")

    # --- WARNINGS ---
    warnings = set(cls.get("warnings", [])) | set(exp.get("warnings", []))

    for w in warnings:
        if w in LIMIT_RULES:
            reasons.add(w)

    # --- REGION UNKNOWN ---
    if cls.get("region_primary") == "UNKNOWN":
        reasons.add("region_unknown")

    # --- CLASIFICACIÓN FINAL ---
    if any(r in EXCLUDE_RULES for r in reasons):
        return "EXCLUDED", reasons

    if len(reasons) > 0:
        return "LIMITED", reasons

    return "FULL", reasons


def assess(funds):
    counts = Counter()
    reason_counter = Counter()
    fixable_counter = Counter()

    results = []

    for f in funds:
        status, reasons = classify_fund(f)

        counts[status] += 1

        for r in reasons:
            reason_counter[r] += 1

            # --- ESTIMACIÓN DE ARREGLO ---
            if r == "region_unknown":
                fixable_counter["region_inferable"] += 1
            elif r.startswith("FI_UNKNOWN"):
                fixable_counter["rf_inferable"] += 1
            elif r == "HEURISTIC_STYLE_DEDUCTION":
                fixable_counter["style_improvable"] += 1
            elif r == "history_not_ok":
                fixable_counter["not_fixable"] += 1
            else:
                fixable_counter["other"] += 1

        results.append({
            "id": f.get("id"),
            "name": f.get("name"),
            "status": status,
            "reasons": list(reasons)
        })

    return counts, reason_counter, fixable_counter, results


def main():
    base_dir = Path(__file__).resolve().parents[2]
    input_path = base_dir / "funds_v3.json"

    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    counts, reasons, fixable, results = assess(data)

    print("\n=== ELEGIBILIDAD CUANTITATIVA ===")
    print(f"TOTAL: {len(data)}")

    print("\n--- CLASIFICACIÓN ---")
    print(f"FULL: {counts['FULL']}")
    print(f"LIMITED: {counts['LIMITED']}")
    print(f"EXCLUDED: {counts['EXCLUDED']}")

    print("\n--- MOTIVOS ---")
    for k, v in sorted(reasons.items(), key=lambda x: -x[1]):
        print(f"{k}: {v}")

    print("\n--- ARREGLABILIDAD ---")
    for k, v in fixable.items():
        print(f"{k}: {v}")

    # Guardar resultado
    out_path = base_dir / "funds_eligibility.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\nArchivo generado: {out_path}")


if __name__ == "__main__":
    main()
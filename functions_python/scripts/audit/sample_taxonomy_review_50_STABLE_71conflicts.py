#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
sample_taxonomy_review_50.py

Genera una muestra estratificada de fondos para revisión manual de la taxonomía V2.

Salida:
- reports/taxonomy_v2_review/sample_review_50.csv
- reports/taxonomy_v2_review/sample_review_50.json
- reports/taxonomy_v2_review/all_conflicts.csv

Uso:
  python functions_python/scripts/audit/sample_taxonomy_review_50.py
  python functions_python/scripts/audit/sample_taxonomy_review_50.py --limit-group 10
  python functions_python/scripts/audit/sample_taxonomy_review_50.py --collection funds_v3
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from collections import Counter
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import firebase_admin
from firebase_admin import firestore


# =========================
# Config
# =========================

DEFAULT_COLLECTION = "funds_v3"
DEFAULT_LIMIT_PER_GROUP = 10
OUTPUT_DIR = Path("reports/taxonomy_v2_review")


# =========================
# Helpers
# =========================


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def utc_now_compact() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def clamp01(value: float) -> float:
    return round(max(0.0, min(1.0, value)), 4)


def safe_join(values: Any) -> str:
    if values is None:
        return ""
    if isinstance(values, list):
        return " | ".join(str(v) for v in values)
    return str(values)


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().upper()


def get_nested(d: Dict[str, Any], *path: str, default=None):
    cur = d
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def boolish(value: Any) -> bool:
    return bool(value) is True


def contains_any(text: str, terms: List[str]) -> bool:
    return any(t in text for t in terms)


def is_unknown(value: Any) -> bool:
    s = normalize_text(value)
    return s == "" or s == "UNKNOWN"


# =========================
# Data model
# =========================


@dataclass
class ReviewRow:
    isin: str
    name: str
    review_group: str
    review_priority: int

    asset_type: str
    asset_subtype: str
    region_primary: str
    equity_style_box: str
    market_cap_bias: str
    fi_credit_bucket: str
    fi_duration_bucket: str
    risk_bucket: str
    is_suitable_low_risk: str

    classification_confidence: float
    exposure_confidence: float

    warnings: str
    audit_flags: str

    legacy_asset_class: str
    legacy_category: str

    equity_exposure: float
    bond_exposure: float
    cash_exposure: float
    other_exposure: float


# =========================
# Firestore init
# =========================


def init_firestore():
    if not firebase_admin._apps:
        from firebase_admin import credentials

        key_paths = [
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "..",
                "..",
                "scripts",
                "serviceAccountKey.json",
            ),
            os.path.join(os.path.dirname(__file__), "..", "serviceAccountKey.json"),
            "./serviceAccountKey.json",
            "../serviceAccountKey.json",
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


# =========================
# Audit heuristics
# =========================


def _is_reasonable_fi(doc: Dict[str, Any]) -> bool:
    class_v2 = doc.get("classification_v2") or {}
    asset_type = normalize_text(class_v2.get("asset_type"))
    subtype = normalize_text(class_v2.get("asset_subtype"))
    risk_bucket = normalize_text(class_v2.get("risk_bucket"))
    low_risk = boolish(class_v2.get("is_suitable_low_risk"))
    fi_credit = normalize_text(class_v2.get("fi_credit_bucket"))
    fi_duration = normalize_text(class_v2.get("fi_duration_bucket"))
    legacy = normalize_text(
        f"{get_nested(doc, 'derived', 'asset_class', default='')} | "
        f"{get_nested(doc, 'ms', 'category_morningstar', default='')} | "
        f"{doc.get('category_morningstar', '')}"
    )

    if asset_type != "FIXED_INCOME":
        return False

    if subtype in {
        "HIGH_YIELD_BOND",
        "EMERGING_MARKETS_BOND",
        "CONVERTIBLE_BOND",
    }:
        return False

    if risk_bucket == "LOW":
        return True

    if low_risk:
        return True

    if fi_credit in {"HIGH_QUALITY", "MEDIUM_QUALITY"}:
        return True

    if fi_duration in {"SHORT", "MEDIUM"}:
        return True

    if contains_any(
        legacy,
        [
            "RF DEUDA CORPORATIVA EUR",
            "RF DIVERSIFICADA EUR",
            "RF DIVERSIFICADA CORTO PLAZO EUR",
            "RF DEUDA PÚBLICA EUR",
            "RF DEUDA PUBLICA EUR",
            "FIXED TERM BOND",
            "RF GLOBAL - EUR CUBIERTO",
            "GLOBAL CORPORATE BOND",
            "RF LARGO PLAZO EUR",
        ],
    ):
        return True

    return False


def _is_style_missing_but_not_conflict(doc: Dict[str, Any]) -> bool:
    class_v2 = doc.get("classification_v2") or {}
    asset_type = normalize_text(class_v2.get("asset_type"))
    style_box = normalize_text(class_v2.get("equity_style_box"))
    mcap = normalize_text(class_v2.get("market_cap_bias"))
    subtype = normalize_text(class_v2.get("asset_subtype"))

    if asset_type != "EQUITY":
        return False

    if style_box and style_box != "UNKNOWN":
        return False

    # Si al menos tenemos sesgo de capitalización o subtipo equity sólido,
    # no lo tratamos como conflicto duro.
    if mcap and mcap != "UNKNOWN":
        return True

    if subtype in {
        "GLOBAL_EQUITY",
        "US_EQUITY",
        "EUROPE_EQUITY",
        "EUROZONE_EQUITY",
        "EMERGING_MARKETS_EQUITY",
        "ASIA_PACIFIC_EQUITY",
        "GLOBAL_SMALL_CAP_EQUITY",
        "GLOBAL_INCOME_EQUITY",
        "SECTOR_EQUITY_TECH",
        "SECTOR_EQUITY_HEALTHCARE",
        "THEMATIC_EQUITY",
    }:
        return True

    return False


def _has_real_conflict(doc: Dict[str, Any], flags: List[str]) -> bool:
    class_v2 = doc.get("classification_v2") or {}
    asset_type = normalize_text(class_v2.get("asset_type"))
    subtype = normalize_text(class_v2.get("asset_subtype"))
    low_risk = boolish(class_v2.get("is_suitable_low_risk"))
    risk_bucket = normalize_text(class_v2.get("risk_bucket"))
    confidence = clamp01(to_float(class_v2.get("classification_confidence"), 0.0))

    if "NO_V2_CLASSIFICATION" in flags or "NO_EXPOSURE_V2" in flags:
        return True

    if "UNKNOWN_ASSET_TYPE" in flags:
        return True

    if "V2_LEGACY_TYPE_CONFLICT" in flags:
        return True

    if "LOW_RISK_UNSAFE" in flags:
        return True

    if "EMERGING_LOW_RISK_CONFLICT" in flags:
        return True

    if "SECTOR_FUND_LOW_RISK_CONFLICT" in flags:
        return True

    if "HIGH_YIELD_LOW_RISK_CONFLICT" in flags:
        return True

    if "CONVERTIBLE_LOW_RISK_CONFLICT" in flags:
        return True

    if "LOW_CONFIDENCE" in flags and confidence < 0.5:
        return True

    # Unknown subtype es conflicto duro salvo en algunos equity/fi razonables
    if "UNKNOWN_SUBTYPE" in flags:
        if asset_type == "FIXED_INCOME" and _is_reasonable_fi(doc):
            return False
        if asset_type == "EQUITY" and _is_style_missing_but_not_conflict(doc):
            return False
        return True

    # FI buckets faltantes no cuentan como conflicto duro si el FI ya es razonable
    if asset_type == "FIXED_INCOME":
        fi_soft_only = set(flags).issubset(
            {
                "FI_WITHOUT_DURATION",
                "FI_WITHOUT_CREDIT",
                "MISSING_REGION_PRIMARY",
                "LOW_CONFIDENCE",
            }
        )
        if fi_soft_only and _is_reasonable_fi(doc):
            return False

    # Equity sin style box no es conflicto duro por sí solo
    if flags == ["EQUITY_WITHOUT_STYLE_BOX"]:
        return False

    # Falta región no es duro por sí solo
    if flags == ["MISSING_REGION_PRIMARY"]:
        return False

    # Warning suave de región tampoco
    if flags == ["REGION_PRIMARY_BORDERLINE"]:
        return False

    # Casos blandos
    if (
        asset_type == "FIXED_INCOME"
        and risk_bucket == "LOW"
        and not low_risk
        and _is_reasonable_fi(doc)
    ):
        return False

    return len(flags) > 0


# =========================
# Audit flag logic
# =========================


def compute_audit_flags(doc: Dict[str, Any]) -> List[str]:
    flags: List[str] = []

    class_v2 = doc.get("classification_v2") or {}
    exposure_v2 = doc.get("portfolio_exposure_v2") or {}
    metrics = doc.get("metrics") or {}

    asset_type = normalize_text(class_v2.get("asset_type", ""))
    asset_subtype = normalize_text(class_v2.get("asset_subtype", ""))
    region_primary = normalize_text(class_v2.get("region_primary", ""))
    risk_bucket = normalize_text(class_v2.get("risk_bucket", ""))
    confidence = clamp01(to_float(class_v2.get("classification_confidence"), 0.0))
    warnings = class_v2.get("warnings") or []

    econ = exposure_v2.get("economic_exposure") or {}
    eq = to_float(econ.get("equity"), 0.0)
    bd = to_float(econ.get("bond"), 0.0)
    ca = to_float(econ.get("cash"), 0.0)
    oth = to_float(econ.get("other"), 0.0)
    exp_sum = eq + bd + ca + oth

    legacy_asset_class = (
        get_nested(doc, "derived", "asset_class")
        or doc.get("asset_class")
        or doc.get("std_type")
        or ""
    )
    legacy_category = (
        get_nested(doc, "ms", "category_morningstar")
        or doc.get("category_morningstar")
        or ""
    )

    legacy_upper = normalize_text(legacy_asset_class + " " + legacy_category)

    if not class_v2:
        flags.append("NO_V2_CLASSIFICATION")
    if not exposure_v2:
        flags.append("NO_EXPOSURE_V2")

    if not metrics and exp_sum <= 0:
        flags.append("NO_METRICS_AND_NO_EXPOSURE")

    if confidence < 0.5:
        flags.append("LOW_CONFIDENCE")

    if not asset_type or asset_type == "UNKNOWN":
        flags.append("UNKNOWN_ASSET_TYPE")
    if not asset_subtype or asset_subtype == "UNKNOWN":
        flags.append("UNKNOWN_SUBTYPE")

    # Región: más suave en RF razonable
    if not region_primary or region_primary == "UNKNOWN":
        if not (asset_type == "FIXED_INCOME" and _is_reasonable_fi(doc)):
            flags.append("MISSING_REGION_PRIMARY")

    # Equity without style: ya no es duro por sí solo, pero lo seguimos informando
    if asset_type == "EQUITY" and is_unknown(class_v2.get("equity_style_box")):
        flags.append("EQUITY_WITHOUT_STYLE_BOX")

    # FI missing buckets: solo si realmente aportan ambigüedad
    if asset_type == "FIXED_INCOME":
        fi_duration_unknown = is_unknown(class_v2.get("fi_duration_bucket"))
        fi_credit_unknown = is_unknown(class_v2.get("fi_credit_bucket"))

        if fi_duration_unknown and not _is_reasonable_fi(doc):
            flags.append("FI_WITHOUT_DURATION")
        elif fi_duration_unknown and not boolish(class_v2.get("is_suitable_low_risk")):
            flags.append("FI_WITHOUT_DURATION")

        if fi_credit_unknown and not _is_reasonable_fi(doc):
            flags.append("FI_WITHOUT_CREDIT")
        elif (
            fi_credit_unknown
            and asset_subtype in {"UNKNOWN", "CORPORATE_BOND"}
            and not boolish(class_v2.get("is_suitable_low_risk"))
        ):
            flags.append("FI_WITHOUT_CREDIT")

    if asset_type == "MIXED" and exp_sum <= 0:
        flags.append("ALLOCATION_WITHOUT_EXPOSURE")

    if asset_type == "EQUITY" and (
        "RF" in legacy_upper or "BOND" in legacy_upper or "FIXED INCOME" in legacy_upper
    ):
        flags.append("V2_LEGACY_TYPE_CONFLICT")
    if asset_type == "FIXED_INCOME" and (
        "RV" in legacy_upper or "EQUITY" in legacy_upper
    ):
        flags.append("V2_LEGACY_TYPE_CONFLICT")
    if asset_type == "MIXED" and (
        "MONETARIO" in legacy_upper or "MONEY MARKET" in legacy_upper
    ):
        flags.append("V2_LEGACY_TYPE_CONFLICT")

    is_low_risk = boolish(class_v2.get("is_suitable_low_risk"))
    if is_low_risk and asset_type in {
        "EQUITY",
        "ALTERNATIVE",
        "COMMODITIES",
        "REAL_ESTATE",
    }:
        flags.append("LOW_RISK_UNSAFE")

    if is_low_risk and asset_subtype in {
        "EMERGING_MARKETS_EQUITY",
        "HIGH_YIELD_BOND",
        "EMERGING_MARKETS_BOND",
        "CONVERTIBLE_BOND",
        "GLOBAL_SMALL_CAP_EQUITY",
    }:
        flags.append("LOW_RISK_UNSAFE")

    if is_low_risk and region_primary == "EMERGING":
        flags.append("EMERGING_LOW_RISK_CONFLICT")

    if is_low_risk and boolish(class_v2.get("is_sector_fund")):
        flags.append("SECTOR_FUND_LOW_RISK_CONFLICT")

    if is_low_risk and asset_subtype == "HIGH_YIELD_BOND":
        flags.append("HIGH_YIELD_LOW_RISK_CONFLICT")

    if is_low_risk and asset_subtype == "CONVERTIBLE_BOND":
        flags.append("CONVERTIBLE_LOW_RISK_CONFLICT")

    if len(warnings) >= 3:
        flags.append("EXCESSIVE_WARNINGS")

    return sorted(set(flags))


# =========================
# Review priority
# =========================


def compute_review_priority(doc: Dict[str, Any], flags: List[str]) -> int:
    class_v2 = doc.get("classification_v2") or {}
    confidence = clamp01(to_float(class_v2.get("classification_confidence"), 0.0))
    warnings = class_v2.get("warnings") or []

    score = 0

    critical_flags = {
        "LOW_RISK_UNSAFE",
        "EMERGING_LOW_RISK_CONFLICT",
        "SECTOR_FUND_LOW_RISK_CONFLICT",
        "HIGH_YIELD_LOW_RISK_CONFLICT",
        "CONVERTIBLE_LOW_RISK_CONFLICT",
        "V2_LEGACY_TYPE_CONFLICT",
        "NO_V2_CLASSIFICATION",
        "NO_EXPOSURE_V2",
        "UNKNOWN_ASSET_TYPE",
    }

    medium_flags = {
        "LOW_CONFIDENCE",
        "UNKNOWN_SUBTYPE",
        "ALLOCATION_WITHOUT_EXPOSURE",
        "EXCESSIVE_WARNINGS",
    }

    soft_flags = {
        "EQUITY_WITHOUT_STYLE_BOX",
        "FI_WITHOUT_DURATION",
        "FI_WITHOUT_CREDIT",
        "MISSING_REGION_PRIMARY",
        "REGION_PRIMARY_BORDERLINE",
        "HEURISTIC_STYLE_DEDUCTION",
        "NO_METRICS_AND_NO_EXPOSURE",
    }

    for flag in flags:
        if flag in critical_flags:
            score += 50
        elif flag in medium_flags:
            score += 20
        elif flag in soft_flags:
            score += 5
        else:
            score += 10

    if confidence < 0.5:
        score += 20
    elif confidence < 0.75:
        score += 10

    score += min(len(warnings) * 3, 12)

    return min(score, 100)


# =========================
# Group selection
# =========================


def in_group_region_borderline(doc: Dict[str, Any], flags: List[str]) -> bool:
    warnings = get_nested(doc, "classification_v2", "warnings", default=[]) or []
    return (
        "REGION_PRIMARY_BORDERLINE" in flags or "REGION_PRIMARY_BORDERLINE" in warnings
    )


def in_group_style_heuristic(doc: Dict[str, Any], flags: List[str]) -> bool:
    warnings = get_nested(doc, "classification_v2", "warnings", default=[]) or []
    return (
        "HEURISTIC_STYLE_DEDUCTION" in flags or "HEURISTIC_STYLE_DEDUCTION" in warnings
    )


def in_group_low_risk_allowed(doc: Dict[str, Any], flags: List[str]) -> bool:
    class_v2 = doc.get("classification_v2") or {}
    return boolish(class_v2.get("is_suitable_low_risk")) and not any(
        f in flags
        for f in {
            "LOW_RISK_UNSAFE",
            "EMERGING_LOW_RISK_CONFLICT",
            "SECTOR_FUND_LOW_RISK_CONFLICT",
            "HIGH_YIELD_LOW_RISK_CONFLICT",
            "CONVERTIBLE_LOW_RISK_CONFLICT",
        }
    )


def in_group_low_risk_blocked(doc: Dict[str, Any], flags: List[str]) -> bool:
    class_v2 = doc.get("classification_v2") or {}
    asset_type = normalize_text(class_v2.get("asset_type"))
    low_risk = boolish(class_v2.get("is_suitable_low_risk"))

    if low_risk:
        return False

    # Solo bloqueados interesantes
    if asset_type == "FIXED_INCOME":
        return _is_reasonable_fi(doc)

    if asset_type == "MIXED":
        return True

    return False


def in_group_ambiguous_conflict(doc: Dict[str, Any], flags: List[str]) -> bool:
    return _has_real_conflict(doc, flags)


GROUPS = [
    ("REGION_PRIMARY_BORDERLINE", in_group_region_borderline),
    ("HEURISTIC_STYLE_DEDUCTION", in_group_style_heuristic),
    ("LOW_RISK_ALLOWED", in_group_low_risk_allowed),
    ("LOW_RISK_BLOCKED", in_group_low_risk_blocked),
    ("AMBIGUOUS_OR_CONFLICT", in_group_ambiguous_conflict),
]


# =========================
# Build rows
# =========================


def build_review_row(
    isin: str, doc: Dict[str, Any], review_group: str, flags: List[str]
) -> ReviewRow:
    class_v2 = doc.get("classification_v2") or {}
    exp_v2 = doc.get("portfolio_exposure_v2") or {}
    econ = exp_v2.get("economic_exposure") or {}

    return ReviewRow(
        isin=isin,
        name=str(doc.get("name") or ""),
        review_group=review_group,
        review_priority=compute_review_priority(doc, flags),
        asset_type=str(class_v2.get("asset_type") or ""),
        asset_subtype=str(class_v2.get("asset_subtype") or ""),
        region_primary=str(class_v2.get("region_primary") or ""),
        equity_style_box=str(class_v2.get("equity_style_box") or ""),
        market_cap_bias=str(class_v2.get("market_cap_bias") or ""),
        fi_credit_bucket=str(class_v2.get("fi_credit_bucket") or ""),
        fi_duration_bucket=str(class_v2.get("fi_duration_bucket") or ""),
        risk_bucket=str(class_v2.get("risk_bucket") or ""),
        is_suitable_low_risk=str(class_v2.get("is_suitable_low_risk")),
        classification_confidence=clamp01(
            to_float(class_v2.get("classification_confidence"), 0.0)
        ),
        exposure_confidence=clamp01(to_float(exp_v2.get("exposure_confidence"), 0.0)),
        warnings=safe_join(class_v2.get("warnings") or []),
        audit_flags=safe_join(flags),
        legacy_asset_class=str(
            get_nested(doc, "derived", "asset_class")
            or doc.get("asset_class")
            or doc.get("std_type")
            or ""
        ),
        legacy_category=str(
            get_nested(doc, "ms", "category_morningstar")
            or doc.get("category_morningstar")
            or ""
        ),
        equity_exposure=to_float(econ.get("equity"), 0.0),
        bond_exposure=to_float(econ.get("bond"), 0.0),
        cash_exposure=to_float(econ.get("cash"), 0.0),
        other_exposure=to_float(econ.get("other"), 0.0),
    )


# =========================
# Main logic
# =========================


def load_all_funds(db, collection_name: str) -> List[Tuple[str, Dict[str, Any]]]:
    docs = db.collection(collection_name).stream()
    rows: List[Tuple[str, Dict[str, Any]]] = []
    for doc in docs:
        data = doc.to_dict() or {}
        rows.append((doc.id, data))
    return rows


def select_stratified_sample(
    funds: List[Tuple[str, Dict[str, Any]]],
    limit_per_group: int,
) -> Tuple[List[ReviewRow], Dict[str, int], List[ReviewRow]]:
    selected_isins = set()
    selected_rows: List[ReviewRow] = []
    all_conflicts: List[ReviewRow] = []
    group_counts: Dict[str, int] = {}

    enriched: List[Tuple[str, Dict[str, Any], List[str]]] = []
    for isin, doc in funds:
        flags = compute_audit_flags(doc)
        enriched.append((isin, doc, flags))

    for isin, doc, flags in enriched:
        if _has_real_conflict(doc, flags):
            all_conflicts.append(build_review_row(isin, doc, "ALL_CONFLICTS", flags))

    for group_name, group_fn in GROUPS:
        candidates: List[Tuple[int, str, Dict[str, Any], List[str]]] = []

        for isin, doc, flags in enriched:
            if group_fn(doc, flags):
                priority = compute_review_priority(doc, flags)
                candidates.append((priority, isin, doc, flags))

        candidates.sort(key=lambda x: (-x[0], x[1]))

        taken = 0
        for _, isin, doc, flags in candidates:
            if isin in selected_isins:
                continue
            selected_isins.add(isin)
            selected_rows.append(build_review_row(isin, doc, group_name, flags))
            taken += 1
            if taken >= limit_per_group:
                break

        group_counts[group_name] = taken

    selected_rows.sort(key=lambda r: (-r.review_priority, r.review_group, r.isin))
    all_conflicts.sort(key=lambda r: (-r.review_priority, r.isin))

    return selected_rows, group_counts, all_conflicts


def write_csv_safely(path: Path, rows: List[ReviewRow]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    target_path = path

    def dump_to(p: Path):
        if not rows:
            with p.open("w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(list(ReviewRow.__annotations__.keys()))
            return

        with p.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(
                f, fieldnames=list(ReviewRow.__annotations__.keys())
            )
            writer.writeheader()
            for row in rows:
                writer.writerow(asdict(row))

    try:
        dump_to(target_path)
    except PermissionError:
        target_path = path.with_name(f"{path.stem}_{utc_now_compact()}{path.suffix}")
        dump_to(target_path)

    return target_path


def write_json_safely(path: Path, payload: Dict[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    target_path = path

    def dump_to(p: Path):
        with p.open("w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

    try:
        dump_to(target_path)
    except PermissionError:
        target_path = path.with_name(f"{path.stem}_{utc_now_compact()}{path.suffix}")
        dump_to(target_path)

    return target_path


def build_summary(
    funds: List[Tuple[str, Dict[str, Any]]],
    group_counts: Dict[str, int],
    sample_rows: List[ReviewRow],
    all_conflicts: List[ReviewRow],
) -> Dict[str, Any]:
    total = len(funds)

    counters = Counter()
    asset_types = Counter()
    with_class = 0
    with_exposure = 0

    for _, doc in funds:
        class_v2 = doc.get("classification_v2") or {}
        exp_v2 = doc.get("portfolio_exposure_v2") or {}
        flags = compute_audit_flags(doc)

        if class_v2:
            with_class += 1
            asset_types[str(class_v2.get("asset_type") or "UNKNOWN")] += 1
        if exp_v2:
            with_exposure += 1

        for flag in flags:
            counters[flag] += 1

    return {
        "run_at": utc_now_iso(),
        "total_funds": total,
        "with_classification_v2": with_class,
        "with_portfolio_exposure_v2": with_exposure,
        "with_both": sum(
            1
            for _, d in funds
            if d.get("classification_v2") and d.get("portfolio_exposure_v2")
        ),
        "group_counts": group_counts,
        "sample_size": len(sample_rows),
        "conflict_count": len(all_conflicts),
        "asset_type_distribution": dict(asset_types),
        "audit_flag_counts": dict(counters),
    }


def parse_args():
    parser = argparse.ArgumentParser(
        description="Muestra estratificada de 50 fondos para revisión V2"
    )
    parser.add_argument(
        "--collection", default=DEFAULT_COLLECTION, help="Colección Firestore"
    )
    parser.add_argument(
        "--limit-group",
        type=int,
        default=DEFAULT_LIMIT_PER_GROUP,
        help="Fondos por grupo",
    )
    parser.add_argument(
        "--execute", action="store_true", help="Ignored, just for compat"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    db = init_firestore()

    print(f"Leyendo colección: {args.collection}")
    funds = load_all_funds(db, args.collection)
    print(f"Fondos cargados: {len(funds)}")

    sample_rows, group_counts, all_conflicts = select_stratified_sample(
        funds=funds,
        limit_per_group=args.limit_group,
    )

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    sample_csv = write_csv_safely(OUTPUT_DIR / "sample_review_50.csv", sample_rows)
    summary_json = write_json_safely(
        OUTPUT_DIR / "sample_review_50.json",
        build_summary(funds, group_counts, sample_rows, all_conflicts),
    )
    conflicts_csv = write_csv_safely(OUTPUT_DIR / "all_conflicts.csv", all_conflicts)

    print("\n=== MUESTRA ESTRATIFICADA GENERADA ===")
    print(f"CSV muestra:     {sample_csv}")
    print(f"JSON resumen:    {summary_json}")
    print(f"CSV conflictos:  {conflicts_csv}")
    print("\nConteos por grupo:")
    for k, v in group_counts.items():
        print(f" - {k}: {v}")
    print(f"\nTamaño muestra final: {len(sample_rows)}")
    print(f"Total conflictivos:   {len(all_conflicts)}")


if __name__ == "__main__":
    main()

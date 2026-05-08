#!/usr/bin/env python
"""Read-only semantic audit for Firestore funds_v3.

This script reads funds_v3 with collection.stream() only and writes local
artifacts under artifacts/bdb_semantic_audit plus the requested Markdown doc.
It intentionally contains no Firestore write, rollback, deploy, parser, or
batch-update path.
"""

from __future__ import annotations

import csv
import json
import math
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import firestore


AUDIT_ID = "BDB-SEM-0"
TARGET_COLLECTION = "funds_v3"
EXPECTED_DOCS = 670

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "bdb_semantic_audit"
DOC_PATH = ROOT / "docs" / "BDB_SEMANTIC_AUDIT_FUNDS_V3.md"
SUMMARY_PATH = ARTIFACT_DIR / "bdb_semantic_audit_summary.json"
DETAIL_PATH = ARTIFACT_DIR / "bdb_semantic_audit_detail.csv"
HIGH_PATH = ARTIFACT_DIR / "bdb_semantic_audit_high_priority.csv"
FLAGS_PATH = ARTIFACT_DIR / "bdb_semantic_audit_flags_by_type.json"

SEVERITY_ORDER = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
TYPE_PRIORITY = {
    "ASSET_MIX_COMPONENT_INVALID": 0,
    "ASSET_MIX_COMPONENTS_NULL_OR_MISSING": 1,
    "ASSET_MIX_SUM_OUT_OF_RANGE": 2,
    "ASSET_MIX_SCALE_0_1_SUSPECTED": 3,
    "CLASSIFICATION_EXPOSURE_STRONG_CONFLICT": 4,
    "FIXED_INCOME_WITH_HIGH_EQUITY_EXPOSURE": 5,
    "EQUITY_WITH_LOW_EQUITY_EXPOSURE": 6,
    "TARGET_DATE_CLASSIFIED_AS_PURE_EQUITY": 7,
    "ALTERNATIVE_DOMINATED_BY_RF_CASH": 8,
}

MISSING_STRINGS = {"", "UNKNOWN", "UNDEFINED", "NULL", "N/A", "NA", "NONE"}
LEGACY_SOURCE_TOKENS = {"legacy", "legacy_category", "category", "name", "root", "fallback"}


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def is_missing(value: Any) -> bool:
    return clean_str(value).upper() in MISSING_STRINGS


def to_num(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(float(value)) else None
    if isinstance(value, str):
        raw = value.strip().replace("%", "").replace(",", ".")
        if not raw:
            return None
        try:
            parsed = float(raw)
        except ValueError:
            return None
        return parsed if math.isfinite(parsed) else None
    return None


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def short_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def numeric_map_sum(value: Any) -> float | None:
    nums = [to_num(v) for v in as_dict(value).values()]
    nums = [v for v in nums if v is not None]
    return sum(nums) if nums else None


def percent_components_from_map(value: Any) -> dict[str, float | None]:
    source = as_dict(value)
    return {
        "equity": to_num(source.get("equity")),
        "fixed_income": to_num(source.get("fixed_income"))
        if "fixed_income" in source
        else to_num(source.get("bond")),
        "cash": to_num(source.get("cash")),
        "other": to_num(source.get("other")),
    }


def normalize_components(
    raw_components: dict[str, float | None],
) -> tuple[dict[str, float | None], float | None, bool, float | None]:
    present = {k: v for k, v in raw_components.items() if v is not None}
    if not present:
        return {k: None for k in raw_components}, None, False, None

    raw_sum = sum(present.values())
    max_abs = max(abs(v) for v in present.values())
    scale_0_1 = raw_sum > 0 and raw_sum <= 1.10 and max_abs <= 1.05
    factor = 100.0 if scale_0_1 else 1.0
    normalized = {
        k: (v * factor if v is not None else None) for k, v in raw_components.items()
    }
    normalized_sum = sum(v for v in normalized.values() if v is not None)
    return normalized, raw_sum, scale_0_1, normalized_sum


def normalize_asset_type(value: Any) -> str:
    raw = clean_str(value).upper().replace("-", "_").replace(" ", "_")
    if not raw:
        return ""
    mapping = {
        "RV": "EQUITY",
        "RENTA_VARIABLE": "EQUITY",
        "EQUITY": "EQUITY",
        "RF": "FIXED_INCOME",
        "RENTA_FIJA": "FIXED_INCOME",
        "FIXED_INCOME": "FIXED_INCOME",
        "BOND": "FIXED_INCOME",
        "BONDS": "FIXED_INCOME",
        "MIXTO": "MIXED",
        "MIXED": "MIXED",
        "ALLOCATION": "MIXED",
        "FLEXIBLE": "MIXED",
        "MONETARIO": "MONEY_MARKET",
        "MONETARY": "MONEY_MARKET",
        "MONEY_MARKET": "MONEY_MARKET",
        "CASH": "MONEY_MARKET",
        "OTROS": "ALTERNATIVE",
        "OTHER": "ALTERNATIVE",
        "ALTERNATIVE": "ALTERNATIVE",
        "ALTERNATIVES": "ALTERNATIVE",
        "REAL_ASSET": "ALTERNATIVE",
        "REAL_ESTATE": "ALTERNATIVE",
        "COMMODITIES": "ALTERNATIVE",
    }
    return mapping.get(raw, raw)


def exposure_bucket(effective: dict[str, float]) -> str:
    equity = effective.get("equity") or 0.0
    fixed_income = effective.get("fixed_income") or 0.0
    cash = effective.get("cash") or 0.0
    other = effective.get("other") or 0.0

    if equity >= 75:
        return "EQUITY"
    if fixed_income >= 65:
        return "FIXED_INCOME"
    if cash >= 75 or (cash + fixed_income >= 85 and equity < 10):
        return "MONEY_MARKET"
    if other >= 50:
        return "ALTERNATIVE"
    if equity >= 20 and fixed_income >= 20:
        return "MIXED"
    return "UNKNOWN"


def is_target_date_like(doc: dict[str, Any]) -> bool:
    classification = as_dict(doc.get("classification_v2"))
    ms = as_dict(doc.get("ms"))
    fields = [
        classification.get("asset_type"),
        classification.get("asset_subtype"),
        classification.get("commercial_type"),
        classification.get("vehicle_complexity"),
        doc.get("name"),
        ms.get("category_morningstar"),
    ]
    text = " ".join(clean_str(x).upper().replace("-", "_") for x in fields)
    return "TARGET_DATE" in text or "TARGET DATE" in text or "LIFECYCLE" in text


def legacy_primary_source(classification: dict[str, Any]) -> str | None:
    sources = as_list(classification.get("source_priority_used")) or as_list(
        classification.get("sources_used")
    )
    sources_norm = [clean_str(source).lower() for source in sources if clean_str(source)]
    if not sources_norm:
        return None

    first = sources_norm[0]
    if first.startswith("ms."):
        return None
    if any(token in first for token in LEGACY_SOURCE_TOKENS):
        return first
    if not any(source.startswith("ms.") for source in sources_norm) and any(
        any(token in source for token in LEGACY_SOURCE_TOKENS) for source in sources_norm
    ):
        return first
    return None


def fmt_num(value: float | None) -> str:
    if value is None:
        return "null"
    return f"{value:.4f}".rstrip("0").rstrip(".")


def init_firestore() -> Any:
    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            options={
                "projectId": os.environ.get("GOOGLE_CLOUD_PROJECT")
                or os.environ.get("GCLOUD_PROJECT")
                or "bdb-fondos"
            }
        )
    return firestore.client()


def stats(values: list[float]) -> dict[str, float | int | None]:
    vals = sorted(v for v in values if v is not None and math.isfinite(v))
    if not vals:
        return {"count": 0, "min": None, "p50": None, "max": None}
    return {
        "count": len(vals),
        "min": round(vals[0], 6),
        "p50": round(vals[len(vals) // 2], 6),
        "max": round(vals[-1], 6),
    }


def main() -> None:
    generated_at = now_utc()
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    DOC_PATH.parent.mkdir(parents=True, exist_ok=True)

    db = init_firestore()
    docs = [
        (snap.id, snap.to_dict() or {})
        for snap in db.collection(TARGET_COLLECTION).stream()
    ]

    issues: list[dict[str, Any]] = []
    docs_with_flags: set[str] = set()
    asset_type_counts: Counter[str] = Counter()
    asset_subtype_counts: Counter[str] = Counter()
    exposure_source_counts: Counter[str] = Counter()
    asset_sums: list[float] = []
    region_sums: list[float] = []
    sector_sums: list[float] = []

    def add_issue(
        ctx: dict[str, Any],
        severity: str,
        flag_type: str,
        category: str,
        description: str,
        evidence: str,
        impact: str,
        recommendation: str,
    ) -> None:
        row = {
            "audit_id": AUDIT_ID,
            "generated_at_utc": generated_at,
            "doc_id": ctx["doc_id"],
            "isin": ctx["isin"],
            "name": ctx["name"],
            "severity": severity,
            "flag_type": flag_type,
            "category": category,
            "description": description,
            "evidence": evidence,
            "financial_impact": impact,
            "recommendation": recommendation,
            "classification_asset_type": ctx.get("classification_asset_type", ""),
            "classification_asset_subtype": ctx.get("classification_asset_subtype", ""),
            "derived_asset_class": ctx.get("derived_asset_class", ""),
            "exposure_source": ctx.get("exposure_source", ""),
            "effective_equity_pct": ctx.get("effective_equity_pct"),
            "effective_fixed_income_pct": ctx.get("effective_fixed_income_pct"),
            "effective_cash_pct": ctx.get("effective_cash_pct"),
            "effective_other_pct": ctx.get("effective_other_pct"),
            "effective_sum_pct": ctx.get("effective_sum_pct"),
        }
        issues.append(row)
        docs_with_flags.add(ctx["isin"] or ctx["doc_id"])

    for doc_id, doc in docs:
        ms = as_dict(doc.get("ms"))
        quality = as_dict(doc.get("quality"))
        classification = as_dict(doc.get("classification_v2"))
        exposure = as_dict(doc.get("portfolio_exposure_v2"))
        derived = as_dict(doc.get("derived"))
        derived_pe = as_dict(derived.get("portfolio_exposure"))

        isin = clean_str(doc.get("isin") or ms.get("isin") or doc_id)
        name = clean_str(doc.get("name") or ms.get("name") or classification.get("raw_name"))
        class_type_raw = classification.get("asset_type")
        class_subtype = clean_str(classification.get("asset_subtype"))
        class_type = normalize_asset_type(class_type_raw)
        derived_asset_class = clean_str(derived.get("asset_class"))
        derived_type = normalize_asset_type(derived_asset_class)

        if class_type:
            asset_type_counts[class_type] += 1
        if class_subtype:
            asset_subtype_counts[class_subtype or "UNKNOWN"] += 1

        raw_mix = exposure.get("asset_mix") if isinstance(exposure.get("asset_mix"), dict) else None
        raw_econ = (
            exposure.get("economic_exposure")
            if isinstance(exposure.get("economic_exposure"), dict)
            else None
        )
        exposure_source = (
            "asset_mix" if raw_mix is not None else "economic_exposure" if raw_econ is not None else "missing"
        )
        exposure_source_counts[exposure_source] += 1

        source_map = raw_mix if raw_mix is not None else raw_econ
        raw_components = percent_components_from_map(source_map)
        effective_components, raw_sum, scale_0_1, effective_sum = normalize_components(
            raw_components
        )
        effective = {k: (v if v is not None else 0.0) for k, v in effective_components.items()}
        if effective_sum is not None:
            asset_sums.append(effective_sum)

        ctx = {
            "doc_id": doc_id,
            "isin": isin,
            "name": name,
            "classification_asset_type": clean_str(class_type_raw),
            "classification_asset_subtype": class_subtype,
            "derived_asset_class": derived_asset_class,
            "exposure_source": exposure_source,
            "effective_equity_pct": round(effective.get("equity", 0.0), 6),
            "effective_fixed_income_pct": round(effective.get("fixed_income", 0.0), 6),
            "effective_cash_pct": round(effective.get("cash", 0.0), 6),
            "effective_other_pct": round(effective.get("other", 0.0), 6),
            "effective_sum_pct": round(effective_sum, 6) if effective_sum is not None else None,
        }

        equity = effective.get("equity", 0.0)
        fixed_income = effective.get("fixed_income", 0.0)
        cash = effective.get("cash", 0.0)
        other = effective.get("other", 0.0)
        bucket = exposure_bucket(effective)

        if raw_mix is None:
            if raw_econ is not None:
                add_issue(
                    ctx,
                    "MEDIUM",
                    "ASSET_MIX_MISSING_USING_ECONOMIC_EXPOSURE",
                    "portfolio_exposure_v2.asset_mix",
                    "portfolio_exposure_v2.asset_mix is absent; audit used economic_exposure as fallback.",
                    f"economic_exposure={short_json(raw_econ)}; effective_sum={fmt_num(effective_sum)}",
                    "Consumers that expect asset_mix may fall back inconsistently or skip allocation checks.",
                    "Review whether these documents should be migrated to asset_mix in an approved correction block.",
                )
            else:
                add_issue(
                    ctx,
                    "HIGH",
                    "ASSET_MIX_AND_ECONOMIC_EXPOSURE_MISSING",
                    "portfolio_exposure_v2.asset_mix",
                    "No usable portfolio_exposure_v2.asset_mix or economic_exposure was found.",
                    "portfolio_exposure_v2 exposure maps missing",
                    "Optimizer cannot safely model top-level asset allocation.",
                    "Do not infer automatically; triage source document and approved manual data path first.",
                )
        else:
            missing_components = [k for k, v in raw_components.items() if v is None]
            if missing_components:
                add_issue(
                    ctx,
                    "HIGH",
                    "ASSET_MIX_COMPONENTS_NULL_OR_MISSING",
                    "portfolio_exposure_v2.asset_mix",
                    "One or more top-level asset mix components are null, missing, or non-numeric.",
                    f"missing_or_invalid={missing_components}; raw_asset_mix={short_json(raw_mix)}",
                    "Optimizer may read incomplete allocation and misclassify risk contribution.",
                    "Validate the raw extraction/source and correct only in a separate write-approved block.",
                )

            invalid_components = [
                k for k, v in raw_components.items() if v is not None and (v < 0 or v > 105)
            ]
            if invalid_components:
                add_issue(
                    ctx,
                    "HIGH",
                    "ASSET_MIX_COMPONENT_INVALID",
                    "portfolio_exposure_v2.asset_mix",
                    "One or more asset mix components are outside a plausible percentage range.",
                    f"invalid_components={invalid_components}; raw_asset_mix={short_json(raw_mix)}",
                    "Invalid top-level allocation can directly contaminate optimizer constraints.",
                    "Quarantine affected ISINs from automated corrections until source is reviewed.",
                )

            if scale_0_1:
                add_issue(
                    ctx,
                    "HIGH",
                    "ASSET_MIX_SCALE_0_1_SUSPECTED",
                    "portfolio_exposure_v2.asset_mix",
                    "Asset mix appears stored in 0-1 scale while downstream/reporting may expect 0-100 percentages.",
                    f"raw_sum={fmt_num(raw_sum)}; raw_components={short_json(raw_components)}; normalized_sum={fmt_num(effective_sum)}",
                    "A 100x scale misunderstanding can materially distort optimizer exposure limits or reports.",
                    "Confirm canonical consumer scale before any normalization package.",
                )
            elif effective_sum is None or effective_sum < 95 or effective_sum > 105:
                add_issue(
                    ctx,
                    "HIGH",
                    "ASSET_MIX_SUM_OUT_OF_RANGE",
                    "portfolio_exposure_v2.asset_mix",
                    "Asset mix effective component sum is outside the 95-105 tolerance range.",
                    f"raw_sum={fmt_num(raw_sum)}; effective_sum={fmt_num(effective_sum)}; raw_asset_mix={short_json(raw_mix)}",
                    "Invalid total allocation can contaminate optimizer normalization and risk budgets.",
                    "Review source allocation and decide whether to rebase, fix, or exclude in a separate block.",
                )

        if raw_mix is None and effective_sum is not None and (
            effective_sum < 95 or effective_sum > 105
        ):
            add_issue(
                ctx,
                "HIGH",
                "ECONOMIC_EXPOSURE_SUM_OUT_OF_RANGE",
                "portfolio_exposure_v2.economic_exposure",
                "Fallback economic_exposure effective component sum is outside the 95-105 tolerance range.",
                f"effective_sum={fmt_num(effective_sum)}; economic_exposure={short_json(raw_econ)}",
                "Fallback exposure is not safe for optimizer or reporting without review.",
                "Review economic_exposure source before any write operation.",
            )

        if class_type == "ALTERNATIVE":
            if fixed_income + cash >= 75:
                add_issue(
                    ctx,
                    "HIGH",
                    "ALTERNATIVE_DOMINATED_BY_RF_CASH",
                    "classification_v2 vs portfolio_exposure_v2",
                    "Alternative fund is dominated by fixed income plus cash exposure.",
                    f"fixed_income+cash={fmt_num(fixed_income + cash)}; equity={fmt_num(equity)}; other={fmt_num(other)}",
                    "Strong taxonomy/exposure contradiction can route the fund into the wrong optimizer sleeve.",
                    "Triage whether classification_v2.asset_type or exposure source is wrong.",
                )
            elif fixed_income + cash >= 50:
                add_issue(
                    ctx,
                    "MEDIUM",
                    "ALTERNATIVE_WITH_HIGH_RF_CASH",
                    "classification_v2 vs portfolio_exposure_v2",
                    "Alternative fund has high fixed income plus cash exposure.",
                    f"fixed_income+cash={fmt_num(fixed_income + cash)}; equity={fmt_num(equity)}; other={fmt_num(other)}",
                    "Reporting and filters may overstate alternative allocation.",
                    "Review taxonomy and exposure look-through before any correction.",
                )

        if is_target_date_like(doc) and class_type == "EQUITY" and equity >= 85:
            add_issue(
                ctx,
                "HIGH",
                "TARGET_DATE_CLASSIFIED_AS_PURE_EQUITY",
                "classification_v2 vs portfolio_exposure_v2",
                "Target-date/lifecycle-like fund is classified as pure equity with high equity exposure.",
                f"asset_type={class_type_raw}; asset_subtype={class_subtype}; equity={fmt_num(equity)}",
                "Target-date funds need glidepath-aware routing; pure equity classification may distort suitability.",
                "Review target-date detection and classification rules separately.",
            )

        if class_type == "MIXED" and (
            effective_sum is None or effective_sum <= 0 or bucket == "UNKNOWN"
        ):
            add_issue(
                ctx,
                "MEDIUM",
                "MIXED_WITHOUT_USABLE_LOOKTHROUGH",
                "classification_v2 vs portfolio_exposure_v2",
                "Mixed/allocation fund lacks usable top-level look-through exposure.",
                f"effective_sum={fmt_num(effective_sum)}; exposure_source={exposure_source}; bucket={bucket}",
                "Mixed fund reporting and optimizer allocation cannot rely on equity/fixed income split.",
                "Recover look-through from canonical source before optimization use.",
            )

        if class_type == "FIXED_INCOME":
            if equity >= 30:
                add_issue(
                    ctx,
                    "HIGH",
                    "FIXED_INCOME_WITH_HIGH_EQUITY_EXPOSURE",
                    "classification_v2 vs portfolio_exposure_v2",
                    "Fixed income fund has high equity exposure.",
                    f"equity={fmt_num(equity)}; fixed_income={fmt_num(fixed_income)}; cash={fmt_num(cash)}",
                    "Strong classification/exposure contradiction can contaminate optimizer risk sleeves.",
                    "Triage classification and exposure source before any automated correction.",
                )
            elif equity >= 15:
                add_issue(
                    ctx,
                    "MEDIUM",
                    "FIXED_INCOME_WITH_MODERATE_EQUITY_EXPOSURE",
                    "classification_v2 vs portfolio_exposure_v2",
                    "Fixed income fund has moderate equity exposure.",
                    f"equity={fmt_num(equity)}; fixed_income={fmt_num(fixed_income)}; cash={fmt_num(cash)}",
                    "Filters and conservative profile reporting may be affected.",
                    "Review as part of taxonomy triage.",
                )

        if class_type == "EQUITY" and effective_sum and effective_sum > 0:
            if equity < 50:
                add_issue(
                    ctx,
                    "HIGH",
                    "EQUITY_WITH_LOW_EQUITY_EXPOSURE",
                    "classification_v2 vs portfolio_exposure_v2",
                    "Equity fund has low effective equity exposure.",
                    f"equity={fmt_num(equity)}; fixed_income={fmt_num(fixed_income)}; cash={fmt_num(cash)}; other={fmt_num(other)}",
                    "Strong classification/exposure contradiction can contaminate optimizer equity limits.",
                    "Triage classification and exposure source before any write operation.",
                )
            elif equity < 75:
                add_issue(
                    ctx,
                    "MEDIUM",
                    "EQUITY_WITH_MODERATE_LOW_EQUITY_EXPOSURE",
                    "classification_v2 vs portfolio_exposure_v2",
                    "Equity fund has only moderate effective equity exposure.",
                    f"equity={fmt_num(equity)}; fixed_income={fmt_num(fixed_income)}; cash={fmt_num(cash)}; other={fmt_num(other)}",
                    "Reporting and filters may overstate pure equity exposure.",
                    "Review whether the fund is mixed/flexible or exposure is stale.",
                )

        if class_type and bucket != "UNKNOWN" and class_type != bucket:
            compatible = {
                ("MIXED", "EQUITY"),
                ("MIXED", "FIXED_INCOME"),
                ("MONEY_MARKET", "FIXED_INCOME"),
            }
            if (class_type, bucket) not in compatible:
                add_issue(
                    ctx,
                    "HIGH" if class_type in {"EQUITY", "FIXED_INCOME", "ALTERNATIVE"} else "MEDIUM",
                    "CLASSIFICATION_EXPOSURE_STRONG_CONFLICT",
                    "classification_v2 vs portfolio_exposure_v2",
                    "Classification asset type and exposure-derived bucket disagree.",
                    f"classification={class_type}; exposure_bucket={bucket}; equity={fmt_num(equity)}; fixed_income={fmt_num(fixed_income)}; cash={fmt_num(cash)}; other={fmt_num(other)}",
                    "Cross-sleeve mismatch can affect optimizer constraints, profile compatibility, and reporting.",
                    "Review exact ISIN before mutating classification_v2 or portfolio_exposure_v2.",
                )

        pe_region_sum = numeric_map_sum(exposure.get("equity_regions"))
        pe_sector_sum = numeric_map_sum(exposure.get("sectors"))
        if pe_region_sum is not None:
            region_sums.append(pe_region_sum)
            if pe_region_sum > 105:
                add_issue(
                    ctx,
                    "MEDIUM",
                    "EQUITY_REGIONS_SUM_GT_105",
                    "regions/sectors",
                    "portfolio_exposure_v2.equity_regions sums above 105%.",
                    f"equity_regions_sum={fmt_num(pe_region_sum)}; equity={fmt_num(equity)}",
                    "Regional reporting may double-count regions or mix sleeve/fund-level percentages.",
                    "Review regional map normalization and duplicate aliases.",
                )
            elif equity < 95 and 95 <= pe_region_sum <= 105:
                add_issue(
                    ctx,
                    "MEDIUM",
                    "EQUITY_REGIONS_LOOK_LIKE_RV_SLEEVE_NOT_FUND_LEVEL",
                    "regions/sectors",
                    "Equity regions sum to approximately 100% while fund equity exposure is below 95%.",
                    f"equity_regions_sum={fmt_num(pe_region_sum)}; equity={fmt_num(equity)}",
                    "Regional percentages may be equity-sleeve percentages, not whole-fund percentages.",
                    "Label semantics clearly or convert only after approval.",
                )

        if pe_sector_sum is not None:
            sector_sums.append(pe_sector_sum)
            if pe_sector_sum > 105:
                add_issue(
                    ctx,
                    "MEDIUM",
                    "EQUITY_SECTORS_SUM_GT_105",
                    "regions/sectors",
                    "portfolio_exposure_v2.sectors sums above 105%.",
                    f"sectors_sum={fmt_num(pe_sector_sum)}; equity={fmt_num(equity)}",
                    "Sector reporting may double-count or mix scales.",
                    "Review sector map normalization and duplicate sector aliases.",
                )
            elif equity < 95 and 95 <= pe_sector_sum <= 105:
                add_issue(
                    ctx,
                    "MEDIUM",
                    "EQUITY_SECTORS_LOOK_LIKE_RV_SLEEVE_NOT_FUND_LEVEL",
                    "regions/sectors",
                    "Sectors sum to approximately 100% while fund equity exposure is below 95%.",
                    f"sectors_sum={fmt_num(pe_sector_sum)}; equity={fmt_num(equity)}",
                    "Sector percentages may be equity-sleeve percentages, not whole-fund percentages.",
                    "Label semantics clearly or convert only after approval.",
                )

        derived_region_sum = numeric_map_sum(derived_pe.get("equity_regions_total"))
        derived_sector_sum = numeric_map_sum(derived_pe.get("equity_sectors_total"))
        if derived_region_sum is not None and (
            derived_region_sum > 105 or (equity < 95 and 95 <= derived_region_sum <= 105)
        ):
            add_issue(
                ctx,
                "MEDIUM",
                "DERIVED_REGION_TOTAL_SUSPICIOUS",
                "regions/sectors",
                "derived.portfolio_exposure.equity_regions_total has suspicious fund/sleeve-level semantics.",
                f"derived_region_sum={fmt_num(derived_region_sum)}; equity={fmt_num(equity)}",
                "Derived regional reporting may treat equity-sleeve data as fund-level data.",
                "Use as triage signal; do not overwrite derived fields in this block.",
            )
        if derived_sector_sum is not None and (
            derived_sector_sum > 105 or (equity < 95 and 95 <= derived_sector_sum <= 105)
        ):
            add_issue(
                ctx,
                "MEDIUM",
                "DERIVED_SECTOR_TOTAL_SUSPICIOUS",
                "regions/sectors",
                "derived.portfolio_exposure.equity_sectors_total has suspicious fund/sleeve-level semantics.",
                f"derived_sector_sum={fmt_num(derived_sector_sum)}; equity={fmt_num(equity)}",
                "Derived sector reporting may treat equity-sleeve data as fund-level data.",
                "Use as triage signal; do not overwrite derived fields in this block.",
            )

        primary_legacy = legacy_primary_source(classification)
        if primary_legacy:
            add_issue(
                ctx,
                "MEDIUM",
                "CLASSIFICATION_PRIMARY_SOURCE_FALLBACK_OR_LEGACY",
                "legacy/fallback",
                "classification_v2 appears to use a fallback/legacy/name source as the primary source.",
                f"source_priority_used={short_json(classification.get('source_priority_used'))}; sources_used={short_json(classification.get('sources_used'))}; primary={primary_legacy}",
                "Taxonomy may be less reliable for filters and portfolio construction.",
                "Review these ISINs after HIGH exposure issues are triaged.",
            )

        if class_type and derived_type and class_type != derived_type:
            add_issue(
                ctx,
                "MEDIUM",
                "DERIVED_CONTRADICTS_CLASSIFICATION_V2",
                "legacy/fallback",
                "derived.asset_class contradicts classification_v2.asset_type.",
                f"derived.asset_class={derived_asset_class}; classification_v2.asset_type={class_type_raw}; normalized={derived_type}!={class_type}",
                "Reporting may disagree depending on whether consumers read derived or classification_v2.",
                "Prefer classification_v2 as canonical after manual triage, then plan a correction block.",
            )

        if derived_type == "EQUITY" and equity < 50 and effective_sum and effective_sum > 0:
            add_issue(
                ctx,
                "HIGH",
                "DERIVED_EQUITY_CONTRADICTS_EXPOSURE",
                "legacy/fallback",
                "derived.asset_class indicates equity while effective equity exposure is low.",
                f"derived.asset_class={derived_asset_class}; equity={fmt_num(equity)}; effective_sum={fmt_num(effective_sum)}",
                "Derived fields may contaminate optimizer or reporting if used as live taxonomy.",
                "Triage with classification_v2 and source exposure before any write.",
            )

        if (
            derived_type == "FIXED_INCOME"
            and fixed_income < 50
            and (fixed_income + cash) < 75
            and effective_sum
            and effective_sum > 0
        ):
            add_issue(
                ctx,
                "HIGH",
                "DERIVED_FIXED_INCOME_CONTRADICTS_EXPOSURE",
                "legacy/fallback",
                "derived.asset_class indicates fixed income while fixed income/cash exposure is low.",
                f"derived.asset_class={derived_asset_class}; fixed_income={fmt_num(fixed_income)}; cash={fmt_num(cash)}; equity={fmt_num(equity)}",
                "Derived fields may contaminate optimizer or reporting if used as live taxonomy.",
                "Triage with classification_v2 and source exposure before any write.",
            )

        parser_version = clean_str(
            quality.get("parser_version")
            or as_dict(doc.get("parser_audit")).get("parser_version")
            or as_dict(doc.get("metadata")).get("parser_version")
        )
        if is_missing(parser_version):
            add_issue(
                ctx,
                "MEDIUM",
                "PARSER_VERSION_MISSING",
                "parser_audit/ms",
                "Parser version is absent from parser/quality metadata.",
                f"quality.parser_version={quality.get('parser_version')}; parser_audit={short_json(doc.get('parser_audit'))}",
                "Auditability of extracted financial fields is reduced.",
                "Backfill provenance only in a separate metadata correction block if source is known.",
            )

        if is_missing(ms.get("category_morningstar")):
            add_issue(
                ctx,
                "MEDIUM",
                "MORNINGSTAR_CATEGORY_MISSING",
                "parser_audit/ms",
                "Morningstar category is absent.",
                f"ms.category_morningstar={ms.get('category_morningstar')}",
                "Classification and filters may rely on weaker fallback sources.",
                "Review category source before changing classification_v2.",
            )

        if is_missing(ms.get("report_date")):
            add_issue(
                ctx,
                "LOW",
                "MS_REPORT_DATE_MISSING",
                "parser_audit/ms",
                "Morningstar report date is absent.",
                f"ms.report_date={ms.get('report_date')}",
                "Freshness and provenance checks are less precise.",
                "Backfill only when source PDF/report provenance is confirmed.",
            )

        quality_warnings = [clean_str(x) for x in as_list(quality.get("warnings")) if clean_str(x)]
        class_warnings = [
            clean_str(x) for x in as_list(classification.get("warnings")) if clean_str(x)
        ]
        exposure_warnings = [
            clean_str(x) for x in as_list(exposure.get("warnings")) if clean_str(x)
        ]
        risk_flags = [clean_str(x) for x in as_list(exposure.get("risk_flags")) if clean_str(x)]

        if quality_warnings:
            add_issue(
                ctx,
                "LOW",
                "PREVIOUS_RELEVANT_QUALITY_WARNINGS",
                "parser_audit/ms",
                "Previous quality warnings are present.",
                f"quality.warnings={short_json(quality_warnings)}",
                "Prior extraction warnings should be considered during semantic triage.",
                "Use as evidence only; no mutation in this audit block.",
            )

        if class_warnings:
            add_issue(
                ctx,
                "LOW",
                "CLASSIFICATION_WARNINGS_PRESENT",
                "parser_audit/ms",
                "classification_v2 contains warnings.",
                f"classification_v2.warnings={short_json(class_warnings)}",
                "Classification confidence may vary by ISIN and affect filters.",
                "Review warnings alongside exposure contradictions.",
            )

        if exposure_warnings or risk_flags:
            add_issue(
                ctx,
                "LOW",
                "PORTFOLIO_EXPOSURE_WARNINGS_PRESENT",
                "parser_audit/ms",
                "portfolio_exposure_v2 contains warnings or risk flags.",
                f"warnings={short_json(exposure_warnings)}; risk_flags={short_json(risk_flags)}",
                "Exposure warnings may explain or confirm semantic anomalies.",
                "Use as evidence only; no mutation in this audit block.",
            )

    severity_counts = Counter(row["severity"] for row in issues)
    flag_counts = Counter(row["flag_type"] for row in issues)
    unique_by_severity = {
        severity: len({row["isin"] for row in issues if row["severity"] == severity})
        for severity in ("HIGH", "MEDIUM", "LOW")
    }

    issues_sorted = sorted(
        issues,
        key=lambda row: (
            SEVERITY_ORDER.get(row["severity"], 9),
            TYPE_PRIORITY.get(row["flag_type"], 50),
            row["isin"],
            row["flag_type"],
        ),
    )

    top_20 = [
        {
            "isin": row["isin"],
            "name": row["name"],
            "severity": row["severity"],
            "flag_type": row["flag_type"],
            "category": row["category"],
            "description": row["description"],
            "evidence": row["evidence"],
            "financial_impact": row["financial_impact"],
            "recommendation": row["recommendation"],
        }
        for row in issues_sorted[:20]
    ]

    flags_by_type: dict[str, Any] = {}
    for flag_type, count in sorted(flag_counts.items(), key=lambda kv: (-kv[1], kv[0])):
        rows = [row for row in issues if row["flag_type"] == flag_type]
        flags_by_type[flag_type] = {
            "count": count,
            "severity_counts": dict(Counter(row["severity"] for row in rows)),
            "category": rows[0]["category"] if rows else "",
            "example_isins": [row["isin"] for row in rows[:10]],
            "example_issue": rows[0] if rows else None,
        }

    summary = {
        "audit_id": AUDIT_ID,
        "generated_at_utc": generated_at,
        "operational_project_path": str(ROOT),
        "target_collection": TARGET_COLLECTION,
        "expected_docs": EXPECTED_DOCS,
        "expected_docs_match": len(docs) == EXPECTED_DOCS,
        "context": {
            "csv0_dry_run_closed": True,
            "csv1_conflicts_freeze_closed": True,
            "no_inserts_from_csv": True,
            "no_update_missing_only_from_csv": True,
            "funds_v3_structurally_complete_from_csv_audit": True,
        },
        "forbidden_contexts": {
            "bdb_fondos_core_excluded": True,
            "funds_core_v1_excluded": True,
            "core_artifacts_used": False,
            "pdf_parser_used": False,
            "batch_update_used": False,
        },
        "write_safety": {
            "firestore_write_executed": False,
            "rollback_executed": False,
            "deploy_executed": False,
            "firebase_cli_deploy_executed": False,
            "firestore_operation_used": "collection.stream only",
            "local_files_created": True,
        },
        "total_docs_audited": len(docs),
        "severity_counts": {severity: severity_counts.get(severity, 0) for severity in ("HIGH", "MEDIUM", "LOW")},
        "unique_isins_by_severity": unique_by_severity,
        "total_issue_flags": len(issues),
        "docs_with_any_flag": len(docs_with_flags),
        "docs_with_no_flags": len(docs) - len(docs_with_flags),
        "asset_type_counts": dict(sorted(asset_type_counts.items())),
        "asset_subtype_top_50": dict(asset_subtype_counts.most_common(50)),
        "exposure_source_counts": dict(sorted(exposure_source_counts.items())),
        "asset_sum_stats": stats(asset_sums),
        "region_sum_stats": stats(region_sums),
        "sector_sum_stats": stats(sector_sums),
        "flag_counts_by_type": dict(sorted(flag_counts.items(), key=lambda kv: (-kv[1], kv[0]))),
        "top_20_issues": top_20,
        "artifacts": {
            "summary_json": str(SUMMARY_PATH.relative_to(ROOT)),
            "detail_csv": str(DETAIL_PATH.relative_to(ROOT)),
            "high_priority_csv": str(HIGH_PATH.relative_to(ROOT)),
            "flags_by_type_json": str(FLAGS_PATH.relative_to(ROOT)),
            "markdown_doc": str(DOC_PATH.relative_to(ROOT)),
        },
        "recommendation": "Next block should be BDB-SEM-1: review-only triage of HIGH issues first, then MEDIUM reporting/taxonomy issues. No correction package should be prepared until exact ISIN/field actions are approved.",
    }

    csv_fields = [
        "audit_id",
        "generated_at_utc",
        "doc_id",
        "isin",
        "name",
        "severity",
        "flag_type",
        "category",
        "description",
        "evidence",
        "financial_impact",
        "recommendation",
        "classification_asset_type",
        "classification_asset_subtype",
        "derived_asset_class",
        "exposure_source",
        "effective_equity_pct",
        "effective_fixed_income_pct",
        "effective_cash_pct",
        "effective_other_pct",
        "effective_sum_pct",
    ]

    with DETAIL_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=csv_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(issues_sorted)

    with HIGH_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=csv_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows([row for row in issues_sorted if row["severity"] == "HIGH"])

    SUMMARY_PATH.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    FLAGS_PATH.write_text(
        json.dumps(flags_by_type, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    write_markdown_doc(summary, generated_at, len(docs), flags_by_type)

    print(
        json.dumps(
            {
                "total_docs_audited": len(docs),
                "severity_counts": summary["severity_counts"],
                "total_issue_flags": len(issues),
                "docs_with_any_flag": summary["docs_with_any_flag"],
                "artifacts": summary["artifacts"],
                "generated_at_utc": generated_at,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def write_markdown_doc(
    summary: dict[str, Any],
    generated_at: str,
    docs_count: int,
    flags_by_type: dict[str, Any],
) -> None:
    flags_md = "\n".join(
        f"- `{flag_type}`: {data['count']}" for flag_type, data in flags_by_type.items()
    )
    top_md = "\n".join(
        f"- `{row['severity']}` `{row['flag_type']}` `{row['isin']}` {row['name']}: {row['evidence']}"
        for row in summary["top_20_issues"]
    )
    artifacts_md = "\n".join(f"- `{path}`" for path in summary["artifacts"].values())
    exposure_sources_json = json.dumps(
        summary["exposure_source_counts"], ensure_ascii=False, indent=2
    )

    doc_text = f"""# BDB-SEM-0 Read-Only Semantic Audit Of funds_v3

Generated at UTC: `{generated_at}`

## Objective

Audit `funds_v3` semantically, in read-only mode, after the CSV recentering/freeze blocks. The goal is to detect financial or taxonomic issues that could affect optimizer behavior, reporting, filters, or auditability.

## Scope

- Operational project: `{ROOT}`
- Target collection: `funds_v3`
- Documents audited: {docs_count}
- Expected documents: {EXPECTED_DOCS}
- Expected count matched: `{str(docs_count == EXPECTED_DOCS).lower()}`
- Excluded project: `C:\\Users\\oanti\\Documents\\BDB-FONDOS-CORE`
- Excluded collection: `funds_core_v1`
- Excluded flows: parser PDF, batch updates, rollback, deploy

## Methodology

- Read Firestore with Admin SDK using `collection.stream()` only.
- Use `portfolio_exposure_v2.asset_mix` when populated; otherwise use `portfolio_exposure_v2.economic_exposure` as a read-only fallback signal.
- Check top-level asset allocation sums against the 95-105 range after scale interpretation.
- Detect possible 0-1 versus 0-100 scale confusion.
- Compare `classification_v2` against effective exposure buckets.
- Check region/sector totals for sleeve-level versus fund-level interpretation.
- Compare `derived` against `classification_v2` and effective exposure.
- Inspect parser/MS provenance and previous quality/classification/exposure warnings.

## Severity Model

- `HIGH`: can contaminate optimizer, has invalid asset mix, or shows strong classification/exposure contradiction.
- `MEDIUM`: affects reporting, filters, parser auditability, region/sector interpretation, or fallback taxonomy.
- `LOW`: incomplete metadata or informational previous-warning signals.

## Summary

- HIGH flag instances: {summary['severity_counts']['HIGH']}
- MEDIUM flag instances: {summary['severity_counts']['MEDIUM']}
- LOW flag instances: {summary['severity_counts']['LOW']}
- Docs with any flag: {summary['docs_with_any_flag']}
- Docs with no flags: {summary['docs_with_no_flags']}
- Unique HIGH ISINs: {summary['unique_isins_by_severity']['HIGH']}
- Unique MEDIUM ISINs: {summary['unique_isins_by_severity']['MEDIUM']}
- Unique LOW ISINs: {summary['unique_isins_by_severity']['LOW']}

Exposure source counts:

```json
{exposure_sources_json}
```

## Flags By Type

{flags_md}

## Top 20 Issues

{top_md}

## Artifacts

{artifacts_md}

## Read-Only Confirmation

- Firestore write executed: `false`
- Firestore operation used: `collection.stream only`
- Rollback executed: `false`
- Deploy executed: `false`
- Firebase CLI deploy executed: `false`
- CORE used: `false`
- `funds_core_v1` used: `false`
- Parser PDF used: `false`
- Batch update used: `false`
- Documents modified in Firestore: `0`

## Recommendation

Next block should be `BDB-SEM-1`, a review-only triage of HIGH issues first, then MEDIUM reporting/taxonomy issues. No correction package should be prepared until the triage explicitly approves exact ISIN/field actions.
"""
    DOC_PATH.write_text(doc_text, encoding="utf-8")


if __name__ == "__main__":
    main()

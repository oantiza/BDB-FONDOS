#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
audit_funds_v3.py

Auditoría estructural y semántica de la colección funds_v3 para BDB-FONDOS.

Objetivo:
- validar estructura mínima por fondo
- validar taxonomía canónica
- detectar problemas de normalización (0-1 vs 0-100, strings con %)
- detectar incoherencias entre classification_v2 y portfolio_exposure_v2
- calcular cobertura, warnings y confidence
- generar un informe JSON resumido y un detalle JSONL opcional

Uso típico:
    python audit_funds_v3.py --input funds_v3.json
    python audit_funds_v3.py --input funds_v3.json --output-summary audit_summary.json --output-details audit_details.jsonl

Formatos de entrada soportados:
1) Lista JSON:
    [ {doc1}, {doc2}, ... ]

2) Dict JSON:
    {
      "funds": [ {doc1}, {doc2}, ... ]
    }

3) Export simple tipo Firestore normalizado:
    {
      "DOC_ID_1": { ... },
      "DOC_ID_2": { ... }
    }

Notas:
- El script NO modifica datos.
- El script intenta ser tolerante con formatos legacy.
- La referencia ideal son classification_v2 y portfolio_exposure_v2.
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


# =========================
# Diccionarios canónicos
# =========================

CANONICAL_ASSET_TYPES = {
    "equity",
    "fixed_income",
    "allocation",
    "money_market",
    "alternative",
    "real_asset",
    "convertible",
    "other",
}

CANONICAL_REGIONS = {
    "global",
    "usa",
    "europe",
    "uk",
    "japan",
    "asia_pacific",
    "emerging",
    "latin_america",
    "frontier",
    "eurozone",
    "switzerland",
    "canada",
    "other",
}

CANONICAL_COMMERCIAL_TYPES = {
    "allocation_conservative",
    "allocation_moderate",
    "allocation_aggressive",
    "allocation_flexible",
    "multi_asset_income",
    "absolute_return",
    "ucits_equity",
    "ucits_bond",
    "money_market",
    "index_fund",
    "etf_like_fund",
    "target_maturity",
    "sector_fund",
    "thematic_equity",
    "real_estate",
    "commodity_fund",
    "other",
}

CANONICAL_DURATION_BUCKETS = {
    "ultrashort",
    "short",
    "intermediate",
    "long",
}

CANONICAL_CREDIT_BUCKETS = {
    "sovereign_hq",
    "investment_grade",
    "crossover",
    "high_yield",
    "mixed_credit",
    "other",
}

CANONICAL_FIXED_INCOME_TYPES = {
    "government",
    "corporate",
    "aggregate",
    "inflation_linked",
    "emd",
    "high_yield",
    "flexible",
    "convertibles",
    "other",
}

TOP_LEVEL_EXPOSURE_KEYS = ["equity", "bond", "cash", "other", "alternative", "real_asset"]

LEGACY_ASSET_TYPE_MAP = {
    "rv": "equity",
    "equity": "equity",
    "stocks": "equity",
    "fixed income": "fixed_income",
    "bond": "fixed_income",
    "bonds": "fixed_income",
    "rf": "fixed_income",
    "allocation": "allocation",
    "mixto": "allocation",
    "money market": "money_market",
    "monetario": "money_market",
    "cash": "money_market",
    "alternative": "alternative",
    "alternatives": "alternative",
    "alternativo": "alternative",
    "real estate": "real_asset",
    "real_asset": "real_asset",
    "convertible": "convertible",
    "otros": "other",
    "other": "other",
}

LEGACY_REGION_MAP = {
    "us": "usa",
    "usa": "usa",
    "united states": "usa",
    "north america": "usa",
    "america": "usa",
    "europe": "europe",
    "eu": "europe",
    "europa": "europe",
    "eurozone": "eurozone",
    "zona euro": "eurozone",
    "uk": "uk",
    "united kingdom": "uk",
    "japan": "japan",
    "asia pacific": "asia_pacific",
    "asia": "asia_pacific",
    "em": "emerging",
    "emerging": "emerging",
    "emerging markets": "emerging",
    "latin america": "latin_america",
    "latam": "latin_america",
    "global": "global",
    "world": "global",
    "switzerland": "switzerland",
    "canada": "canada",
    "frontier": "frontier",
    "other": "other",
}


# =========================
# Utilidades generales
# =========================

def is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def clean_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    return value or None


def lower_clean(value: Any) -> Optional[str]:
    s = clean_str(value)
    return s.lower() if s else None


def nested_get(obj: Dict[str, Any], path: str, default: Any = None) -> Any:
    cur = obj
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur


def first_non_null(*values: Any) -> Any:
    for v in values:
        if v is not None:
            return v
    return None


def safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if is_number(value):
        return float(value)
    if isinstance(value, str):
        s = value.strip().replace(",", ".")
        if s.endswith("%"):
            s = s[:-1].strip()
        try:
            return float(s)
        except ValueError:
            return None
    return None


def normalize_percent_like(value: Any) -> Tuple[Optional[float], Optional[str]]:
    """
    Normaliza pesos/exposiciones a 0-1.
    Retorna (valor_normalizado, warning_opcional)
    """
    if value is None:
        return None, None

    if isinstance(value, str) and "%" in value:
        f = safe_float(value)
        if f is None:
            return None, "invalid_percent_string"
        return f / 100.0, "normalized_from_percent_string"

    f = safe_float(value)
    if f is None:
        return None, "invalid_numeric_value"

    if 0.0 <= f <= 1.0:
        return f, None
    if 1.0 < f <= 100.0:
        return f / 100.0, "normalized_from_0_100"
    return f, "out_of_expected_range"


def approx_sum(values: Iterable[Optional[float]]) -> float:
    return sum(v for v in values if is_number(v))


def bucket(value: Optional[float], thresholds: List[Tuple[float, str]], default: str = "unknown") -> str:
    if value is None:
        return default
    for t, label in thresholds:
        if value <= t:
            return label
    return thresholds[-1][1] if thresholds else default


# =========================
# Carga de datos
# =========================

def load_input(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]

    if isinstance(data, dict):
        if isinstance(data.get("funds"), list):
            return [x for x in data["funds"] if isinstance(x, dict)]

        # export tipo {"doc_id": {...}}
        if all(isinstance(v, dict) for v in data.values()):
            docs = []
            for k, v in data.items():
                if "doc_id" not in v and "id" not in v:
                    v = dict(v)
                    v["doc_id"] = k
                docs.append(v)
            return docs

    raise ValueError("Formato de entrada no soportado")


# =========================
# Extracción semántica
# =========================

def canonicalize_asset_type(raw: Any) -> Optional[str]:
    s = lower_clean(raw)
    if not s:
        return None
    return LEGACY_ASSET_TYPE_MAP.get(s, s)


def canonicalize_region(raw: Any) -> Optional[str]:
    s = lower_clean(raw)
    if not s:
        return None
    return LEGACY_REGION_MAP.get(s, s)


def extract_identity(doc: Dict[str, Any]) -> Dict[str, Any]:
    isin = first_non_null(
        doc.get("isin"),
        nested_get(doc, "identifiers.isin"),
    )
    name = first_non_null(
        doc.get("name"),
        doc.get("fund_name"),
        nested_get(doc, "ms.name"),
    )
    manager = first_non_null(
        doc.get("manager"),
        nested_get(doc, "ms.manager"),
        nested_get(doc, "ms.fund_family"),
    )
    doc_id = first_non_null(doc.get("doc_id"), doc.get("id"), isin, name)
    return {
        "doc_id": doc_id,
        "isin": isin,
        "name": name,
        "manager": manager,
    }


def extract_classification(doc: Dict[str, Any]) -> Dict[str, Any]:
    cls = doc.get("classification_v2") or {}
    derived = doc.get("derived") or {}
    ms = doc.get("ms") or {}

    asset_type = first_non_null(
        cls.get("asset_type"),
        derived.get("asset_type"),
        derived.get("asset_class"),
        doc.get("asset_type"),
        doc.get("asset_class"),
    )

    region_primary = first_non_null(
        cls.get("region_primary"),
        derived.get("primary_region"),
        doc.get("primary_region"),
        nested_get(ms, "primary_region"),
    )

    out = {
        "exists": bool(cls),
        "asset_type": canonicalize_asset_type(asset_type),
        "asset_subtype": lower_clean(cls.get("asset_subtype")),
        "commercial_type": lower_clean(cls.get("commercial_type")),
        "region_primary": canonicalize_region(region_primary),
        "region_secondary": canonicalize_region(cls.get("region_secondary")),
        "fixed_income_type": lower_clean(cls.get("fixed_income_type")),
        "credit_bucket": lower_clean(cls.get("credit_bucket")),
        "duration_bucket": lower_clean(cls.get("duration_bucket")),
        "classification_confidence": safe_float(cls.get("classification_confidence")),
        "warnings": cls.get("warnings") or [],
        "raw": cls,
    }
    return out


def extract_exposure(doc: Dict[str, Any]) -> Dict[str, Any]:
    exp = doc.get("portfolio_exposure_v2") or {}
    metrics = doc.get("metrics") or {}
    derived = doc.get("derived") or {}

    out: Dict[str, Any] = {
        "exists": bool(exp),
        "top_level": {},
        "warnings": exp.get("warnings") or [],
        "exposure_confidence": safe_float(exp.get("exposure_confidence")),
        "raw": exp,
        "normalization_warnings": [],
    }

    for key in TOP_LEVEL_EXPOSURE_KEYS:
        raw_v = exp.get(key)
        if raw_v is None and key in ("equity", "bond", "cash", "other"):
            raw_v = metrics.get(key)
        if raw_v is None and key == "cash":
            raw_v = metrics.get("monetario")
        val, warn = normalize_percent_like(raw_v)
        out["top_level"][key] = val
        if warn:
            out["normalization_warnings"].append(f"{key}:{warn}")

    # equity_regions / sectors / styles / credit / duration
    for map_key in ["equity_regions", "equity_styles", "sectors", "bond_types", "credit", "duration", "alternatives"]:
        raw_map = exp.get(map_key) or {}
        norm_map = {}
        norm_warns = []
        if isinstance(raw_map, dict):
            for k, v in raw_map.items():
                kk = canonicalize_region(k) if map_key == "equity_regions" else lower_clean(k)
                vv, warn = normalize_percent_like(v)
                norm_map[kk or str(k)] = vv
                if warn:
                    norm_warns.append(f"{map_key}.{k}:{warn}")
        out[map_key] = norm_map
        out["normalization_warnings"].extend(norm_warns)

    # fallback extra desde derived.portfolio_exposure si faltase v2
    if not exp:
        legacy_exp = derived.get("portfolio_exposure") or derived.get("portfolio_exposure_v2") or {}
        if isinstance(legacy_exp, dict):
            for key in ["equity", "bond", "cash", "other"]:
                if out["top_level"].get(key) is None and key in legacy_exp:
                    vv, warn = normalize_percent_like(legacy_exp.get(key))
                    out["top_level"][key] = vv
                    if warn:
                        out["normalization_warnings"].append(f"legacy.{key}:{warn}")

    return out


def extract_quality(doc: Dict[str, Any]) -> Dict[str, Any]:
    dq = doc.get("data_quality") or {}
    history_ok = first_non_null(
        dq.get("history_ok"),
        doc.get("history_ok"),
        nested_get(doc, "metrics.history_ok"),
    )
    observations = first_non_null(
        dq.get("observations"),
        doc.get("observations"),
        nested_get(doc, "metrics.observations"),
        nested_get(doc, "metrics.n_obs"),
    )
    volatility = first_non_null(
        nested_get(doc, "metrics.volatility"),
        nested_get(doc, "std_perf.volatility"),
        doc.get("volatility"),
    )
    cagr = first_non_null(
        nested_get(doc, "metrics.cagr"),
        nested_get(doc, "std_perf.cagr"),
        doc.get("cagr"),
    )
    return {
        "history_ok": history_ok,
        "observations": safe_float(observations),
        "volatility": safe_float(volatility),
        "cagr": safe_float(cagr),
    }


# =========================
# Reglas de auditoría
# =========================

def check_required_structure(identity: Dict[str, Any], cls: Dict[str, Any], exp: Dict[str, Any]) -> List[str]:
    issues = []
    if not identity.get("isin"):
        issues.append("missing_isin")
    if not identity.get("name"):
        issues.append("missing_name")
    if not cls.get("exists"):
        issues.append("missing_classification_v2")
    if not exp.get("exists"):
        issues.append("missing_portfolio_exposure_v2")
    return issues


def check_taxonomy(cls: Dict[str, Any]) -> List[str]:
    issues = []
    if cls.get("asset_type") and cls["asset_type"] not in CANONICAL_ASSET_TYPES:
        issues.append(f"noncanonical_asset_type:{cls['asset_type']}")
    if cls.get("region_primary") and cls["region_primary"] not in CANONICAL_REGIONS:
        issues.append(f"noncanonical_region_primary:{cls['region_primary']}")
    if cls.get("commercial_type") and cls["commercial_type"] not in CANONICAL_COMMERCIAL_TYPES:
        issues.append(f"noncanonical_commercial_type:{cls['commercial_type']}")
    if cls.get("duration_bucket") and cls["duration_bucket"] not in CANONICAL_DURATION_BUCKETS:
        issues.append(f"noncanonical_duration_bucket:{cls['duration_bucket']}")
    if cls.get("credit_bucket") and cls["credit_bucket"] not in CANONICAL_CREDIT_BUCKETS:
        issues.append(f"noncanonical_credit_bucket:{cls['credit_bucket']}")
    if cls.get("fixed_income_type") and cls["fixed_income_type"] not in CANONICAL_FIXED_INCOME_TYPES:
        issues.append(f"noncanonical_fixed_income_type:{cls['fixed_income_type']}")
    return issues


def check_normalization(exp: Dict[str, Any]) -> List[str]:
    issues = []
    issues.extend(exp.get("normalization_warnings", []))

    top = exp["top_level"]
    s = approx_sum(top.values())
    if s > 0 and not (0.95 <= s <= 1.05):
        issues.append(f"top_level_exposure_sum_outside_tolerance:{round(s, 6)}")

    for map_key in ["equity_regions", "equity_styles", "sectors", "bond_types", "credit", "duration", "alternatives"]:
        m = exp.get(map_key) or {}
        vals = [v for v in m.values() if is_number(v)]
        if vals:
            total = sum(vals)
            if total > 1.30:  # tolerante: algunos mapas son subconjuntos, no totalizadores
                issues.append(f"{map_key}_sum_suspicious:{round(total, 6)}")

    return issues


def dominant_top_level(exp: Dict[str, Any]) -> Optional[str]:
    pairs = [(k, v) for k, v in exp["top_level"].items() if is_number(v)]
    if not pairs:
        return None
    pairs.sort(key=lambda x: x[1], reverse=True)
    return pairs[0][0] if pairs[0][1] is not None else None


def check_internal_consistency(cls: Dict[str, Any], exp: Dict[str, Any]) -> List[str]:
    issues = []
    asset_type = cls.get("asset_type")
    top = exp["top_level"]
    dom = dominant_top_level(exp)

    equity = top.get("equity") or 0.0
    bond = top.get("bond") or 0.0
    cash = top.get("cash") or 0.0
    other = top.get("other") or 0.0
    alternative = top.get("alternative") or 0.0
    real_asset = top.get("real_asset") or 0.0

    if asset_type == "equity":
        if equity < 0.50:
            issues.append(f"inconsistent_equity_asset_type:equity_exposure={round(equity,4)}")
    elif asset_type == "fixed_income":
        if bond < 0.50:
            issues.append(f"inconsistent_fixed_income_asset_type:bond_exposure={round(bond,4)}")
    elif asset_type == "money_market":
        if cash < 0.50 and bond < 0.50:
            issues.append(f"inconsistent_money_market_asset_type:cash={round(cash,4)},bond={round(bond,4)}")
        if cls.get("duration_bucket") == "long":
            issues.append("inconsistent_money_market_long_duration")
    elif asset_type == "allocation":
        if equity + bond + cash < 0.60:
            issues.append(f"inconsistent_allocation_mix:sum={round(equity+bond+cash,4)}")
    elif asset_type == "alternative":
        if alternative + other < 0.30:
            issues.append(f"weak_alternative_exposure:alt+other={round(alternative+other,4)}")
    elif asset_type == "real_asset":
        if real_asset + other < 0.30:
            issues.append(f"weak_real_asset_exposure:real_asset+other={round(real_asset+other,4)}")

    if asset_type and dom:
        # checks suaves, solo alertas relevantes
        if asset_type == "equity" and dom == "bond":
            issues.append("dominant_exposure_mismatch:equity_vs_bond")
        if asset_type == "fixed_income" and dom == "equity":
            issues.append("dominant_exposure_mismatch:fixed_income_vs_equity")
        if asset_type == "money_market" and dom not in {"cash", "bond"}:
            issues.append(f"dominant_exposure_mismatch:money_market_vs_{dom}")

    if cls.get("region_primary") and cls["region_primary"] not in CANONICAL_REGIONS:
        issues.append("invalid_region_primary_postcanonical")

    # mapas regionales no canónicos
    for region in (exp.get("equity_regions") or {}).keys():
        if region not in CANONICAL_REGIONS:
            issues.append(f"noncanonical_equity_region:{region}")

    return issues


def check_quality(quality: Dict[str, Any]) -> List[str]:
    issues = []
    obs = quality.get("observations")
    vol = quality.get("volatility")
    cagr = quality.get("cagr")
    history_ok = quality.get("history_ok")

    if history_ok is False:
        issues.append("history_not_ok")

    if obs is not None and obs < 60:
        issues.append(f"low_observations:{int(obs)}")

    if vol is not None and vol < 0:
        issues.append("negative_volatility")
    if vol is not None and vol > 2.5:
        issues.append(f"suspicious_volatility:{round(vol,4)}")

    if cagr is not None and cagr < -1.0:
        issues.append(f"suspicious_cagr_low:{round(cagr,4)}")
    if cagr is not None and cagr > 3.0:
        issues.append(f"suspicious_cagr_high:{round(cagr,4)}")

    return issues


def score_record(identity: Dict[str, Any], cls: Dict[str, Any], exp: Dict[str, Any], quality: Dict[str, Any], issues: List[str]) -> float:
    score = 1.0

    if not identity.get("isin"):
        score -= 0.08
    if not identity.get("name"):
        score -= 0.08
    if not cls.get("exists"):
        score -= 0.25
    if not exp.get("exists"):
        score -= 0.25

    cconf = cls.get("classification_confidence")
    if cconf is not None:
        score = min(score, 0.7 + 0.3 * max(0.0, min(1.0, cconf)))

    econf = exp.get("exposure_confidence")
    if econf is not None:
        score = min(score, 0.7 + 0.3 * max(0.0, min(1.0, econf)))

    heavy = [
        "missing_classification_v2",
        "missing_portfolio_exposure_v2",
        "history_not_ok",
        "top_level_exposure_sum_outside_tolerance",
        "inconsistent_equity_asset_type",
        "inconsistent_fixed_income_asset_type",
    ]
    for issue in issues:
        if any(issue.startswith(h) for h in heavy):
            score -= 0.08
        else:
            score -= 0.02

    return max(0.0, round(score, 4))


def audit_record(doc: Dict[str, Any]) -> Dict[str, Any]:
    identity = extract_identity(doc)
    cls = extract_classification(doc)
    exp = extract_exposure(doc)
    quality = extract_quality(doc)

    issues = []
    issues.extend(check_required_structure(identity, cls, exp))
    issues.extend(check_taxonomy(cls))
    issues.extend(check_normalization(exp))
    issues.extend(check_internal_consistency(cls, exp))
    issues.extend(check_quality(quality))

    warnings = []
    warnings.extend(cls.get("warnings") or [])
    warnings.extend(exp.get("warnings") or [])

    severity = "ok"
    if issues:
        severity = "warning"
    if any(i.startswith(("missing_", "inconsistent_", "history_not_ok", "top_level_exposure_sum_outside_tolerance")) for i in issues):
        severity = "critical"

    score = score_record(identity, cls, exp, quality, issues)

    return {
        "doc_id": identity.get("doc_id"),
        "isin": identity.get("isin"),
        "name": identity.get("name"),
        "manager": identity.get("manager"),
        "asset_type": cls.get("asset_type"),
        "region_primary": cls.get("region_primary"),
        "classification_exists": cls.get("exists"),
        "exposure_exists": exp.get("exists"),
        "classification_confidence": cls.get("classification_confidence"),
        "exposure_confidence": exp.get("exposure_confidence"),
        "history_ok": quality.get("history_ok"),
        "observations": quality.get("observations"),
        "top_level_exposure": exp.get("top_level"),
        "issues": issues,
        "warnings": warnings,
        "severity": severity,
        "audit_score": score,
    }


# =========================
# Resumen agregado
# =========================

def summarize(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(results)
    issue_counter = Counter()
    warning_counter = Counter()

    missing_classification = 0
    missing_exposure = 0
    history_not_ok = 0
    low_confidence = 0
    critical = 0
    warning = 0
    ok = 0

    asset_type_counter = Counter()
    region_counter = Counter()
    score_values = []

    for r in results:
        if not r["classification_exists"]:
            missing_classification += 1
        if not r["exposure_exists"]:
            missing_exposure += 1
        if r["history_ok"] is False:
            history_not_ok += 1
        if r["audit_score"] < 0.75:
            low_confidence += 1

        if r["severity"] == "critical":
            critical += 1
        elif r["severity"] == "warning":
            warning += 1
        else:
            ok += 1

        if r.get("asset_type"):
            asset_type_counter[r["asset_type"]] += 1
        if r.get("region_primary"):
            region_counter[r["region_primary"]] += 1

        for issue in r.get("issues", []):
            issue_counter[issue] += 1
        for w in r.get("warnings", []):
            warning_counter[w] += 1

        score_values.append(r["audit_score"])

    def top_n(counter: Counter, n: int = 25) -> Dict[str, int]:
        return dict(counter.most_common(n))

    summary = {
        "total_funds": total,
        "coverage": {
            "classification_v2": round((total - missing_classification) / total, 4) if total else 0.0,
            "portfolio_exposure_v2": round((total - missing_exposure) / total, 4) if total else 0.0,
        },
        "counts": {
            "missing_classification_v2": missing_classification,
            "missing_portfolio_exposure_v2": missing_exposure,
            "history_not_ok": history_not_ok,
            "low_audit_score_under_0_75": low_confidence,
            "severity_ok": ok,
            "severity_warning": warning,
            "severity_critical": critical,
        },
        "distribution": {
            "asset_type": dict(asset_type_counter),
            "region_primary": dict(region_counter),
        },
        "top_issues": top_n(issue_counter, 50),
        "top_warnings": top_n(warning_counter, 50),
        "audit_score": {
            "mean": round(statistics.mean(score_values), 4) if score_values else None,
            "median": round(statistics.median(score_values), 4) if score_values else None,
            "min": min(score_values) if score_values else None,
            "max": max(score_values) if score_values else None,
        },
        "recommendation": build_recommendation(
            missing_classification=missing_classification,
            missing_exposure=missing_exposure,
            critical=critical,
            issue_counter=issue_counter,
        ),
    }
    return summary


def build_recommendation(
    missing_classification: int,
    missing_exposure: int,
    critical: int,
    issue_counter: Counter,
) -> Dict[str, Any]:
    priorities = []
    if missing_classification or missing_exposure:
        priorities.append("P0: completar coverage de classification_v2 y portfolio_exposure_v2")
    if any(k.startswith("top_level_exposure_sum_outside_tolerance") for k in issue_counter):
        priorities.append("P0: corregir normalización 0-1 vs 0-100 en exposures")
    if any(k.startswith("noncanonical_") for k in issue_counter):
        priorities.append("P0: cerrar diccionarios canónicos de taxonomía y regiones")
    if any(k.startswith("inconsistent_") or k.startswith("dominant_exposure_mismatch") for k in issue_counter):
        priorities.append("P1: revisar coherencia entre classification_v2 y portfolio_exposure_v2")
    if any(k.startswith("low_observations") or k == "history_not_ok" for k in issue_counter):
        priorities.append("P1: endurecer elegibilidad para optimización y frontera")
    if not priorities:
        priorities.append("Base razonablemente consistente; siguiente paso: QA de warnings residuales y confidence")

    status = "healthy"
    if critical > 0 or missing_classification > 0 or missing_exposure > 0:
        status = "needs_attention"
    if critical > 25:
        status = "priority_review"

    return {
        "status": status,
        "priorities": priorities,
    }


# =========================
# Salida
# =========================

def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_jsonl(path: Path, rows: List[Dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def print_human_summary(summary: Dict[str, Any]) -> None:
    print("\n=== AUDITORÍA FUNDS_V3 ===")
    print(f"Total fondos: {summary['total_funds']}")
    print(f"Coverage classification_v2: {summary['coverage']['classification_v2']:.2%}")
    print(f"Coverage portfolio_exposure_v2: {summary['coverage']['portfolio_exposure_v2']:.2%}")
    print(f"Severity OK / warning / critical: {summary['counts']['severity_ok']} / {summary['counts']['severity_warning']} / {summary['counts']['severity_critical']}")
    print(f"Score medio: {summary['audit_score']['mean']}")
    print(f"Score mediano: {summary['audit_score']['median']}")
    print(f"Missing classification_v2: {summary['counts']['missing_classification_v2']}")
    print(f"Missing portfolio_exposure_v2: {summary['counts']['missing_portfolio_exposure_v2']}")
    print(f"History not ok: {summary['counts']['history_not_ok']}")
    print(f"Low audit score (<0.75): {summary['counts']['low_audit_score_under_0_75']}")

    print("\nTop issues:")
    for k, v in list(summary["top_issues"].items())[:15]:
        print(f"  - {k}: {v}")

    print("\nTop warnings:")
    for k, v in list(summary["top_warnings"].items())[:15]:
        print(f"  - {k}: {v}")

    print("\nPrioridades:")
    for p in summary["recommendation"]["priorities"]:
        print(f"  - {p}")
    print()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Auditoría de estructura y consistencia para funds_v3")
    parser.add_argument("--input", required=True, help="Ruta al JSON de entrada")
    parser.add_argument("--output-summary", default="audit_funds_v3_summary.json", help="Ruta salida JSON resumen")
    parser.add_argument("--output-details", default="audit_funds_v3_details.jsonl", help="Ruta salida JSONL detalle")
    parser.add_argument("--critical-only", action="store_true", help="Guardar en detalles solo fondos críticos")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    summary_path = Path(args.output_summary)
    details_path = Path(args.output_details)

    docs = load_input(input_path)
    results = [audit_record(doc) for doc in docs]
    summary = summarize(results)

    if args.critical_only:
        details_rows = [r for r in results if r["severity"] == "critical"]
    else:
        details_rows = results

    write_json(summary_path, summary)
    write_jsonl(details_path, details_rows)
    print_human_summary(summary)
    print(f"Resumen guardado en: {summary_path}")
    print(f"Detalle guardado en: {details_path}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Read-only audit for funds that can affect the canonical `Otros` bucket.

This script reads Firestore through the public REST API using a temporary
`gcloud auth print-access-token` token. It does not use Firebase Admin and it
does not contain Firestore write calls.

Outputs:
  artifacts/suitability/other_bucket_audit_<timestamp>.json
  artifacts/suitability/other_bucket_audit_<timestamp>.csv
  docs/BDB_OTHER_BUCKET_SUITABILITY_AUDIT_2026-06-03.md
"""

from __future__ import annotations

import csv
import json
import math
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
FUNCTIONS = ROOT / "functions_python"
sys.path.insert(0, str(FUNCTIONS))

from services.portfolio.suitability_engine import compute_compatible_profiles  # noqa: E402
from services.portfolio.utils import extract_v2_identity, get_profile_bucket_exposure, get_v2_asset_mix  # noqa: E402

PROJECT_ID = "bdb-fondos"
COLLECTION = "funds_v3"
REPORT_PATH = ROOT / "docs" / "BDB_OTHER_BUCKET_SUITABILITY_AUDIT_2026-06-03.md"
ARTIFACT_DIR = ROOT / "artifacts" / "suitability"

KEYWORD_PATTERNS_COMMODITIES = {
    "commodities": r"\bcommodit(?:y|ies)\b",
    "materias primas": r"\bmaterias\s+primas\b",
    "gold": r"\bgold\b",
    "oro": r"\boro\b",
    "silver": r"\bsilver\b",
    "plata": r"\bplata\b",
    "precious metals": r"\bprecious\s+metals?\b",
    "metals": r"\bmetals?\b",
    "mining": r"\bmining\b|\bminers?\b",
    "energy": r"\benergy\b",
    "oil": r"\boil\b",
    "brent": r"\bbrent\b",
    "crude": r"\bcrude\b",
    "agriculture": r"\bagriculture\b",
    "natural resources": r"\bnatural\s+resources\b",
}

KEYWORD_PATTERNS_AGGRESSIVE_THEME = {
    "biotech": r"\bbiotech(?:nology)?\b",
    "technology": r"\btechnology\b",
    "fintech": r"\bfintech\b",
    "robotics": r"\brobotics\b",
    "innovation": r"\binnovation\b",
    "disruption": r"\bdisrupt(?:ion|ive)?\b",
    "crypto": r"\bcrypto\b",
    "bitcoin": r"\bbitcoin\b",
    "blockchain": r"\bblockchain\b",
    "emerging": r"\bemerging\b|\bemergentes\b",
    "frontier": r"\bfrontier\b",
    "small cap": r"\bsmall\s+cap\b",
    "micro cap": r"\bmicro\s+cap\b",
    "china": r"\bchina\b",
    "india": r"\bindia\b",
}

HIGH_RISK_SUBTYPES = {
    "EMERGING_MARKETS_EQUITY",
    "EMERGING_MARKETS_BOND",
    "HIGH_YIELD_BOND",
    "CONVERTIBLE_BOND",
    "GLOBAL_SMALL_CAP_EQUITY",
}


def now_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def run_gcloud_access_token() -> str:
    proc = subprocess.run(
        ["gcloud.cmd", "auth", "print-access-token"],
        check=True,
        capture_output=True,
        text=True,
    )
    token = proc.stdout.strip()
    if not token:
        raise RuntimeError("gcloud did not return an access token")
    return token


def firestore_value_to_python(value: dict[str, Any]) -> Any:
    if "nullValue" in value:
        return None
    if "booleanValue" in value:
        return bool(value["booleanValue"])
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        raw = value["doubleValue"]
        if raw == "NaN":
            return math.nan
        if raw == "Infinity":
            return math.inf
        if raw == "-Infinity":
            return -math.inf
        return float(raw)
    if "timestampValue" in value:
        return value["timestampValue"]
    if "stringValue" in value:
        return value["stringValue"]
    if "bytesValue" in value:
        return value["bytesValue"]
    if "referenceValue" in value:
        return value["referenceValue"]
    if "geoPointValue" in value:
        return value["geoPointValue"]
    if "arrayValue" in value:
        values = value.get("arrayValue", {}).get("values", [])
        return [firestore_value_to_python(v) for v in values]
    if "mapValue" in value:
        fields = value.get("mapValue", {}).get("fields", {})
        return {k: firestore_value_to_python(v) for k, v in fields.items()}
    return None


def document_to_python(doc: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    name = doc.get("name", "")
    doc_id = name.rsplit("/", 1)[-1]
    fields = doc.get("fields", {})
    return doc_id, {k: firestore_value_to_python(v) for k, v in fields.items()}


def fetch_collection(token: str) -> list[tuple[str, dict[str, Any]]]:
    docs: list[tuple[str, dict[str, Any]]] = []
    page_token = ""
    base_url = (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}"
        f"/databases/(default)/documents/{COLLECTION}"
    )
    headers = {"Authorization": f"Bearer {token}"}

    while True:
        params = {"pageSize": "300"}
        if page_token:
            params["pageToken"] = page_token
        url = f"{base_url}?{urllib.parse.urlencode(params)}"
        request = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
        docs.extend(document_to_python(doc) for doc in payload.get("documents", []))
        page_token = payload.get("nextPageToken") or ""
        if not page_token:
            break
    return docs


def safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def norm_text(*parts: Any) -> str:
    return " ".join(str(p or "").lower() for p in parts)


def has_keyword(text: str, patterns: dict[str, str]) -> list[str]:
    return sorted(k for k, pattern in patterns.items() if re.search(pattern, text, flags=re.IGNORECASE))


def pct(value: Any) -> float:
    try:
        return float(value or 0.0)
    except Exception:
        return 0.0


def profile_label(profiles: list[int]) -> str:
    return ",".join(str(p) for p in profiles)


def to_sorted_ints(values: Any) -> list[int]:
    result = []
    for value in safe_list(values):
        try:
            result.append(int(value))
        except Exception:
            continue
    return sorted(set(result))


def analyze_fund(isin: str, data: dict[str, Any]) -> dict[str, Any]:
    class_v2 = safe_dict(data.get("classification_v2"))
    identity = extract_v2_identity(data)
    exposure = get_v2_asset_mix(data, as_percent=True)
    profile_exposure = get_profile_bucket_exposure(data, as_percent=True)
    live_profiles = compute_compatible_profiles(data)
    stored_profiles = to_sorted_ints(class_v2.get("compatible_profiles"))
    has_cached_profiles = "compatible_profiles" in class_v2 and isinstance(class_v2.get("compatible_profiles"), list)

    name = str(data.get("name") or data.get("fund_name") or data.get("nombre") or "")
    ms = safe_dict(data.get("ms"))
    text = norm_text(
        isin,
        name,
        data.get("category"),
        data.get("asset_class"),
        data.get("label"),
        class_v2.get("asset_type"),
        class_v2.get("asset_subtype"),
        class_v2.get("sector_focus"),
        ms.get("category_morningstar"),
        ms.get("global_category"),
    )

    asset_type = identity.get("asset_type")
    asset_subtype = identity.get("asset_subtype")
    risk_bucket = identity.get("risk_bucket")
    sector_focus = str(class_v2.get("sector_focus") or "").upper()
    is_sector_fund = bool(class_v2.get("is_sector_fund")) or str(asset_subtype or "").startswith("SECTOR_EQUITY_")
    is_low_risk_false = class_v2.get("is_suitable_low_risk") is False
    conservative_live = [p for p in live_profiles if p <= 2]
    conservative_stored = [p for p in stored_profiles if p <= 2]
    low_moderate_live = [p for p in live_profiles if p <= 4]

    equity_pct = pct(exposure.get("equity"))
    other_pct = pct(profile_exposure.get("Otros"))
    alternatives_pct = pct(profile_exposure.get("Alternativos"))
    rv_pct = pct(profile_exposure.get("RV"))

    commodity_hits = has_keyword(text, KEYWORD_PATTERNS_COMMODITIES)
    aggressive_hits = has_keyword(text, KEYWORD_PATTERNS_AGGRESSIVE_THEME)

    in_other_scope = (
        asset_type in {"other", "unknown", None}
        or other_pct > 0.0
        or bool(commodity_hits)
        or asset_type in {"commodities", "real_asset", "alternative"}
    )

    flags: list[str] = []
    if conservative_live:
        if asset_type in {"other", "unknown", None}:
            flags.append("P1_P2_ELIGIBLE_WITH_OTHER_OR_UNKNOWN_TYPE")
        if other_pct >= 10:
            flags.append("P1_P2_ELIGIBLE_WITH_MATERIAL_OTROS_EXPOSURE")
        elif other_pct > 0:
            flags.append("P1_P2_ELIGIBLE_WITH_MINOR_OTROS_EXPOSURE")
        if alternatives_pct > 0 and asset_type in {"commodities", "real_asset", "alternative"}:
            flags.append("P1_P2_ELIGIBLE_WITH_ALTERNATIVE_REAL_ASSET_TYPE")
        if commodity_hits:
            flags.append("P1_P2_ELIGIBLE_WITH_COMMODITY_KEYWORD")
        if aggressive_hits:
            flags.append("P1_P2_ELIGIBLE_WITH_AGGRESSIVE_THEME_KEYWORD")
        if risk_bucket == "HIGH":
            flags.append("P1_P2_ELIGIBLE_WITH_HIGH_RISK_BUCKET")
        if is_sector_fund:
            flags.append("P1_P2_ELIGIBLE_WITH_SECTOR_FUND")
        if asset_subtype in HIGH_RISK_SUBTYPES:
            flags.append("P1_P2_ELIGIBLE_WITH_HIGH_RISK_SUBTYPE")
        if equity_pct > 30:
            flags.append("P1_P2_ELIGIBLE_WITH_EQUITY_GT_30")

    if conservative_stored and not conservative_live:
        flags.append("STORED_CONSERVATIVE_PROFILE_STALE_VS_ENGINE")
    if stored_profiles != live_profiles:
        if has_cached_profiles:
            flags.append("COMPATIBLE_PROFILES_POPULATED_DRIFT")
        else:
            flags.append("COMPATIBLE_PROFILES_ABSENT_CACHE")
    if in_other_scope and not class_v2:
        flags.append("MISSING_CLASSIFICATION_V2")
    if in_other_scope and not exposure:
        flags.append("MISSING_V2_EXPOSURE")
    if other_pct >= 50:
        flags.append("OTROS_DOMINANT_EXPOSURE")
    elif other_pct >= 10:
        flags.append("OTROS_MATERIAL_EXPOSURE")

    severity = "OK"
    review_flags = {
        "P1_P2_ELIGIBLE_WITH_OTHER_OR_UNKNOWN_TYPE",
        "P1_P2_ELIGIBLE_WITH_MATERIAL_OTROS_EXPOSURE",
        "P1_P2_ELIGIBLE_WITH_ALTERNATIVE_REAL_ASSET_TYPE",
        "P1_P2_ELIGIBLE_WITH_COMMODITY_KEYWORD",
        "P1_P2_ELIGIBLE_WITH_AGGRESSIVE_THEME_KEYWORD",
        "P1_P2_ELIGIBLE_WITH_HIGH_RISK_BUCKET",
        "P1_P2_ELIGIBLE_WITH_SECTOR_FUND",
        "P1_P2_ELIGIBLE_WITH_HIGH_RISK_SUBTYPE",
        "P1_P2_ELIGIBLE_WITH_EQUITY_GT_30",
        "STORED_CONSERVATIVE_PROFILE_STALE_VS_ENGINE",
    }
    if any(flag in review_flags for flag in flags):
        severity = "REVIEW"
    elif any(
        flag in flags
        for flag in [
            "MISSING_CLASSIFICATION_V2",
            "MISSING_V2_EXPOSURE",
            "COMPATIBLE_PROFILES_POPULATED_DRIFT",
            "P1_P2_ELIGIBLE_WITH_MINOR_OTROS_EXPOSURE",
        ]
    ):
        severity = "WATCH"

    return {
        "isin": isin,
        "name": name,
        "asset_type": asset_type,
        "asset_subtype": asset_subtype,
        "risk_bucket": risk_bucket,
        "sector_focus": sector_focus,
        "is_sector_fund": is_sector_fund,
        "is_suitable_low_risk_false": is_low_risk_false,
        "rv_pct": round(rv_pct, 4),
        "equity_pct": round(equity_pct, 4),
        "alternativos_pct": round(alternatives_pct, 4),
        "otros_pct": round(other_pct, 4),
        "stored_profiles": stored_profiles,
        "has_cached_profiles": has_cached_profiles,
        "live_profiles": live_profiles,
        "conservative_live": conservative_live,
        "conservative_stored": conservative_stored,
        "low_moderate_live": low_moderate_live,
        "commodity_keywords": commodity_hits,
        "aggressive_keywords": aggressive_hits,
        "in_other_scope": in_other_scope,
        "severity": severity,
        "flags": sorted(set(flags)),
    }


def write_outputs(rows: list[dict[str, Any]], timestamp: str) -> tuple[Path, Path, Path]:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    json_path = ARTIFACT_DIR / f"other_bucket_audit_{timestamp}.json"
    csv_path = ARTIFACT_DIR / f"other_bucket_audit_{timestamp}.csv"

    scope_rows = [r for r in rows if r["in_other_scope"]]
    review_rows = [r for r in scope_rows if r["severity"] == "REVIEW"]
    watch_rows = [r for r in scope_rows if r["severity"] == "WATCH"]
    drift_rows = [r for r in rows if "COMPATIBLE_PROFILES_POPULATED_DRIFT" in r["flags"]]
    absent_cache_rows = [r for r in rows if "COMPATIBLE_PROFILES_ABSENT_CACHE" in r["flags"]]

    summary = {
        "generated_at": timestamp,
        "project_id": PROJECT_ID,
        "collection": COLLECTION,
        "read_only": True,
        "write_executed": False,
        "total_funds": len(rows),
        "other_scope_funds": len(scope_rows),
        "review_funds": len(review_rows),
        "watch_funds": len(watch_rows),
        "compatible_profiles_populated_drift": len(drift_rows),
        "compatible_profiles_absent_cache": len(absent_cache_rows),
        "p1_p2_eligible_with_review_flags": len(
            [r for r in review_rows if any(f.startswith("P1_P2_ELIGIBLE") for f in r["flags"])]
        ),
        "p1_p2_eligible_with_minor_other_exposure": len(
            [r for r in rows if "P1_P2_ELIGIBLE_WITH_MINOR_OTROS_EXPOSURE" in r["flags"]]
        ),
        "other_exposure_material_ge_10": len([r for r in rows if r["otros_pct"] >= 10]),
        "other_exposure_dominant_ge_50": len([r for r in rows if r["otros_pct"] >= 50]),
        "commodity_keyword_funds": len([r for r in rows if r["commodity_keywords"]]),
        "commodity_keyword_p1_p2_live": len([r for r in rows if r["commodity_keywords"] and r["conservative_live"]]),
        "flags": Counter(flag for r in rows for flag in r["flags"]),
    }

    payload = {
        "summary": summary,
        "review": review_rows,
        "watch": watch_rows,
        "populated_drift": drift_rows,
        "other_scope": scope_rows,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    fieldnames = [
        "severity",
        "isin",
        "name",
        "asset_type",
        "asset_subtype",
        "risk_bucket",
        "sector_focus",
        "is_sector_fund",
        "rv_pct",
        "equity_pct",
        "alternativos_pct",
        "otros_pct",
        "stored_profiles",
        "live_profiles",
        "commodity_keywords",
        "aggressive_keywords",
        "flags",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        for row in sorted(scope_rows, key=lambda r: (r["severity"] != "REVIEW", r["severity"] != "WATCH", r["isin"])):
            writer.writerow(
                {
                    **{k: row.get(k) for k in fieldnames},
                    "stored_profiles": profile_label(row["stored_profiles"]),
                    "live_profiles": profile_label(row["live_profiles"]),
                    "commodity_keywords": ",".join(row["commodity_keywords"]),
                    "aggressive_keywords": ",".join(row["aggressive_keywords"]),
                    "flags": ",".join(row["flags"]),
                }
            )

    review_table = "\n".join(
        "| {isin} | {name} | {asset_type} | {otros:.2f}% | {alt:.2f}% | {profiles} | {flags} |".format(
            isin=r["isin"],
            name=(r["name"][:70] + "...") if len(r["name"]) > 73 else r["name"],
            asset_type=r["asset_type"],
            otros=r["otros_pct"],
            alt=r["alternativos_pct"],
            profiles=profile_label(r["live_profiles"]),
            flags=", ".join(r["flags"]),
        )
        for r in review_rows[:25]
    )
    if not review_table:
        review_table = "| - | - | - | - | - | - | - |"

    drift_table = "\n".join(
        "| {isin} | {name} | {asset_type} | {stored} | {live} | {flags} |".format(
            isin=r["isin"],
            name=(r["name"][:70] + "...") if len(r["name"]) > 73 else r["name"],
            asset_type=r["asset_type"],
            stored=profile_label(r["stored_profiles"]),
            live=profile_label(r["live_profiles"]),
            flags=", ".join(r["flags"]),
        )
        for r in drift_rows[:25]
    )
    if not drift_table:
        drift_table = "| - | - | - | - | - | - |"

    report = f"""# Auditoria de fondos `Otros` y suitability conservadora

**Fecha:** 2026-06-03
**Modo:** solo lectura
**Proyecto:** `{PROJECT_ID}`
**Coleccion:** `{COLLECTION}`

## Resumen

- Fondos revisados: **{summary['total_funds']}**
- Fondos dentro del alcance `Otros`/alternativos/commodities/unknown: **{summary['other_scope_funds']}**
- Fondos con revision recomendada: **{summary['review_funds']}**
- Fondos en vigilancia: **{summary['watch_funds']}**
- Deriva `compatible_profiles` poblado vs motor vivo: **{summary['compatible_profiles_populated_drift']}**
- Fondos sin cache `compatible_profiles` poblado: **{summary['compatible_profiles_absent_cache']}**
- Fondos con `Otros` >= 10%: **{summary['other_exposure_material_ge_10']}**
- Fondos con `Otros` >= 50%: **{summary['other_exposure_dominant_ge_50']}**
- Fondos con keywords commodities: **{summary['commodity_keyword_funds']}**
- Commodities/keywords aptos para perfiles 1-2 segun motor auditado: **{summary['commodity_keyword_p1_p2_live']}**

## Lectura ejecutiva

El objetivo de esta auditoria es confirmar que la relajacion de `Otros` no abre una puerta peligrosa para perfiles conservadores.

Un fondo pasa a **revision** si el motor auditado lo permite en perfiles 1-2 y ademas presenta senales de riesgo material: tipo `other`/`unknown`, `Otros` >= 10%, keywords reales de commodities, tematicas agresivas, bucket HIGH, sector fund, subtipo de riesgo alto o RV real >30%.

Un fondo pasa a **vigilancia** si hay drift poblado, falta clasificacion/exposicion o senales menores, aunque no sea apto para perfiles 1-2.

## Fondos en revision

| ISIN | Nombre | Tipo | Otros | Alternativos | Perfiles auditados | Motivo |
| --- | --- | --- | ---: | ---: | --- | --- |
{review_table}

## Drift poblado de `compatible_profiles`

Estos fondos tienen cache almacenado y difieren de la regla local auditada. No se ha escrito nada.

| ISIN | Nombre | Tipo | Cache actual | Motor auditado | Motivo |
| --- | --- | --- | --- | --- | --- |
{drift_table}

## Artefactos

- JSON: `{json_path.relative_to(ROOT)}`
- CSV: `{csv_path.relative_to(ROOT)}`

## Recomendacion

1. Si **revision = 0**, no hay bloqueo semantico inmediato en perfiles 1-2.
2. Si hay fondos en revision, revisar primero esos ISINs antes de tocar perfiles.
3. Si hay drift de `compatible_profiles`, regenerar solo con dry-run + manifest + write gate.
4. Mantener esta auditoria como control antes de volver a relajar `Otros`.
"""
    REPORT_PATH.write_text(report, encoding="utf-8")
    return json_path, csv_path, REPORT_PATH


def main() -> int:
    timestamp = now_utc()
    print("BDB other bucket suitability audit - READ ONLY")
    print(f"Project: {PROJECT_ID} | Collection: {COLLECTION}")
    token = run_gcloud_access_token()
    docs = fetch_collection(token)
    rows = [analyze_fund(isin, data) for isin, data in docs]
    json_path, csv_path, report_path = write_outputs(rows, timestamp)
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    summary = payload["summary"]
    print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
    print(f"JSON: {json_path}")
    print(f"CSV: {csv_path}")
    print(f"Report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

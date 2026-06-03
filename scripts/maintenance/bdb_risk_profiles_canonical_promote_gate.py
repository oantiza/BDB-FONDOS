#!/usr/bin/env python3
"""Controlled gate to promote profiles 8-10 from staging to canonical.

Default mode is read-only. Write mode requires the exact authorization text.

Allowed write:
  collection: system_settings
  document: risk_profiles
  fields: `8`, `9`, `10`

The intended use is to remove the historical Mixto key from the canonical
document after unified constraints are already running from staging.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_ROOT = ROOT / "artifacts" / "risk_profiles"

PROJECT_ID = "bdb-fondos"
COLLECTION = "system_settings"
CANONICAL_DOC = "risk_profiles"
STAGING_DOC = "risk_profiles_staging"
AUTHORIZATION_TEXT = "AUTORIZO WRITE GATE RISK_PROFILES CANONICAL 8-10"
FIELDS_TO_PROMOTE = ["8", "9", "10"]


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
    if "arrayValue" in value:
        return [firestore_value_to_python(v) for v in value.get("arrayValue", {}).get("values", [])]
    if "mapValue" in value:
        return {
            k: firestore_value_to_python(v)
            for k, v in value.get("mapValue", {}).get("fields", {}).items()
        }
    return None


def python_to_firestore_value(value: Any) -> dict[str, Any]:
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, list):
        return {"arrayValue": {"values": [python_to_firestore_value(v) for v in value]}}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {str(k): python_to_firestore_value(v) for k, v in value.items()}}}
    raise TypeError(f"Unsupported Firestore value: {type(value)!r}")


def document_to_python(doc: dict[str, Any]) -> dict[str, Any]:
    return {k: firestore_value_to_python(v) for k, v in doc.get("fields", {}).items()}


def doc_url(doc_id: str) -> str:
    return (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}"
        f"/databases/(default)/documents/{COLLECTION}/{doc_id}"
    )


def request_json(method: str, url: str, token: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(url, headers=headers, data=data, method=method)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def read_doc(token: str, doc_id: str) -> dict[str, Any]:
    return document_to_python(request_json("GET", doc_url(doc_id), token))


def quoted_field_path(field: str) -> str:
    return f"`{field}`"


def patch_canonical(token: str, staging: dict[str, Any]) -> None:
    params = urllib.parse.urlencode(
        [("updateMask.fieldPaths", quoted_field_path(field)) for field in FIELDS_TO_PROMOTE]
    )
    body = {"fields": {field: python_to_firestore_value(staging[field]) for field in FIELDS_TO_PROMOTE}}
    request_json("PATCH", f"{doc_url(CANONICAL_DOC)}?{params}", token, body)


def analyze(canonical: dict[str, Any], staging: dict[str, Any]) -> dict[str, Any]:
    diffs = []
    for field in FIELDS_TO_PROMOTE:
        canonical_profile = canonical.get(field)
        staging_profile = staging.get(field)
        diffs.append(
            {
                "profile": field,
                "canonical_before": canonical_profile,
                "staging_target": staging_profile,
                "canonical_has_mixto": isinstance(canonical_profile, dict) and "Mixto" in canonical_profile,
                "staging_has_mixto": isinstance(staging_profile, dict) and "Mixto" in staging_profile,
                "will_change": canonical_profile != staging_profile,
            }
        )
    unexpected_staging_mixto = [d["profile"] for d in diffs if d["staging_has_mixto"]]
    missing = [field for field in FIELDS_TO_PROMOTE if field not in canonical or field not in staging]
    return {
        "fields_to_promote": FIELDS_TO_PROMOTE,
        "missing_fields": missing,
        "unexpected_staging_mixto": unexpected_staging_mixto,
        "diffs": diffs,
        "can_write": not missing and not unexpected_staging_mixto and any(d["will_change"] for d in diffs),
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def prepare_gate() -> Path:
    generated_at = now_utc()
    gate_dir = ARTIFACT_ROOT / f"canonical_promote_8_10_{generated_at}"
    token = run_gcloud_access_token()
    canonical = read_doc(token, CANONICAL_DOC)
    staging = read_doc(token, STAGING_DOC)
    analysis = analyze(canonical, staging)
    manifest = {
        "generated_at": generated_at,
        "project_id": PROJECT_ID,
        "collection": COLLECTION,
        "canonical_doc": CANONICAL_DOC,
        "staging_doc": STAGING_DOC,
        "read_only": True,
        "write_executed": False,
        "authorization_required": AUTHORIZATION_TEXT,
        **analysis,
    }
    rollback = {
        "generated_at": generated_at,
        "restore_doc": CANONICAL_DOC,
        "restore_fields": {
            field: canonical.get(field) for field in FIELDS_TO_PROMOTE
        },
    }
    write_json(gate_dir / "prepare_manifest.json", manifest)
    write_json(gate_dir / "rollback_manifest.json", rollback)
    print(f"[PREPARE] Gate dir: {gate_dir}")
    print(f"[PREPARE] Can write: {analysis['can_write']}")
    print(f"[PREPARE] Fields: {', '.join(FIELDS_TO_PROMOTE)}")
    return gate_dir


def run_write(gate_dir: Path, authorization: str) -> None:
    if authorization != AUTHORIZATION_TEXT:
        raise SystemExit("[ABORT] Authorization text does not match the required write gate.")
    manifest_path = gate_dir / "prepare_manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"[ABORT] Missing prepare manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not manifest.get("can_write"):
        raise SystemExit("[ABORT] Prepared manifest is not writable.")

    token = run_gcloud_access_token()
    canonical_before = read_doc(token, CANONICAL_DOC)
    staging = read_doc(token, STAGING_DOC)
    live_analysis = analyze(canonical_before, staging)
    if not live_analysis["can_write"]:
        raise SystemExit(f"[ABORT] Live analysis is not writable: {live_analysis}")
    prepared_targets = {
        d["profile"]: d["staging_target"] for d in manifest["diffs"]
    }
    live_targets = {
        d["profile"]: d["staging_target"] for d in live_analysis["diffs"]
    }
    if prepared_targets != live_targets:
        raise SystemExit("[ABORT] Staging targets changed since prepare.")

    patch_canonical(token, staging)
    canonical_after = read_doc(token, CANONICAL_DOC)
    post_analysis = analyze(canonical_after, staging)
    failed = [
        field for field in FIELDS_TO_PROMOTE
        if canonical_after.get(field) != staging.get(field)
    ]
    if failed:
        raise SystemExit(f"[ABORT] Post-write verification failed for: {failed}")
    post = {
        "executed_at": now_utc(),
        "project_id": PROJECT_ID,
        "collection": COLLECTION,
        "canonical_doc": CANONICAL_DOC,
        "staging_doc": STAGING_DOC,
        "write_executed": True,
        "authorization": authorization,
        "fields_written": FIELDS_TO_PROMOTE,
        "post_analysis": post_analysis,
    }
    write_json(gate_dir / "post_write_verification.json", post)
    print(f"[WRITE] Completed canonical promotion for {', '.join(FIELDS_TO_PROMOTE)}.")
    print(f"[WRITE] Verification: {gate_dir / 'post_write_verification.json'}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--gate-dir", type=Path)
    parser.add_argument("--authorization", default="")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.write:
        if not args.gate_dir:
            raise SystemExit("[ABORT] --gate-dir is required in --write mode")
        run_write(args.gate_dir, args.authorization)
    else:
        prepare_gate()


if __name__ == "__main__":
    main()

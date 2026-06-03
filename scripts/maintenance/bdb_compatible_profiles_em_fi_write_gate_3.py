#!/usr/bin/env python3
"""Controlled write gate for 3 emerging/frontier fixed-income funds.

Default mode is read-only. It prepares a gate directory with before snapshots,
rollback values, and the exact intended diff.

Write mode requires:
  --write
  --gate-dir <prepared gate dir>
  --authorization "AUTORIZO WRITE GATE 3 COMPATIBLE_PROFILES"

Allowed write:
  collection: funds_v3
  field: classification_v2.compatible_profiles
  docs:
    IE00B4XYLM55
    IE00B986FT65
    LU1061675168
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
ARTIFACT_ROOT = ROOT / "artifacts" / "suitability"

PROJECT_ID = "bdb-fondos"
COLLECTION = "funds_v3"
FIELD_PATH = "classification_v2.compatible_profiles"
AUTHORIZATION_TEXT = "AUTORIZO WRITE GATE 3 COMPATIBLE_PROFILES"

EXPECTED_BEFORE = [3, 4, 5, 6, 7, 8, 9, 10]
TARGET_AFTER = [5, 6, 7, 8, 9, 10]

TARGETS = {
    "IE00B4XYLM55": "Jupiter Emerging Market Debt Income Fund L EUR Acc",
    "IE00B986FT65": (
        "Neuberger Berman Emerging Market Debt - Hard Currency Fund "
        "EUR A Accumulating Class"
    ),
    "LU1061675168": (
        "Goldman Sachs Frontier Markets Debt (Hard Currency) - X Cap EUR "
        "(hedged i)"
    ),
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
        return {"mapValue": {"fields": {k: python_to_firestore_value(v) for k, v in value.items()}}}
    raise TypeError(f"Unsupported Firestore value: {type(value)!r}")


def document_to_python(doc: dict[str, Any]) -> dict[str, Any]:
    fields = doc.get("fields", {})
    return {k: firestore_value_to_python(v) for k, v in fields.items()}


def firestore_url(isin: str) -> str:
    quoted_isin = urllib.parse.quote(isin, safe="")
    return (
        f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}"
        f"/databases/(default)/documents/{COLLECTION}/{quoted_isin}"
    )


def request_json(method: str, url: str, token: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {token}"}
    data = None
    if body is not None:
        data = json.dumps(body, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def read_doc(token: str, isin: str) -> dict[str, Any]:
    return document_to_python(request_json("GET", firestore_url(isin), token))


def compatible_profiles(doc: dict[str, Any]) -> list[int]:
    raw = doc.get("classification_v2", {}).get("compatible_profiles", [])
    if not isinstance(raw, list):
        return []
    return sorted({int(v) for v in raw})


def write_compatible_profiles(token: str, isin: str, profiles: list[int]) -> None:
    params = urllib.parse.urlencode({"updateMask.fieldPaths": FIELD_PATH})
    body = {
        "fields": {
            "classification_v2": {
                "mapValue": {
                    "fields": {
                        "compatible_profiles": python_to_firestore_value(profiles),
                    }
                }
            }
        }
    }
    request_json("PATCH", f"{firestore_url(isin)}?{params}", token, body)


def ensure_targets_current(token: str) -> list[dict[str, Any]]:
    rows = []
    for isin, expected_name in TARGETS.items():
        doc = read_doc(token, isin)
        current = compatible_profiles(doc)
        name = doc.get("name") or doc.get("fund_name") or doc.get("nombre") or expected_name
        rows.append(
            {
                "isin": isin,
                "name": name,
                "expected_name": expected_name,
                "current": current,
                "target": TARGET_AFTER,
                "status": "ok" if current == EXPECTED_BEFORE else "drift",
                "classification_v2_before": doc.get("classification_v2", {}),
            }
        )
    return rows


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def prepare_gate() -> Path:
    executed_at = now_utc()
    gate_dir = ARTIFACT_ROOT / f"compatible_profiles_write_gate_em_fi_{executed_at}"
    token = run_gcloud_access_token()
    rows = ensure_targets_current(token)
    drift = [row for row in rows if row["status"] != "ok"]

    manifest = {
        "generated_at": executed_at,
        "project_id": PROJECT_ID,
        "collection": COLLECTION,
        "field_path": FIELD_PATH,
        "read_only": True,
        "write_executed": False,
        "authorization_required": AUTHORIZATION_TEXT,
        "selected_count": len(TARGETS),
        "expected_before": EXPECTED_BEFORE,
        "target_after": TARGET_AFTER,
        "can_write": not drift,
        "drift_detected": bool(drift),
        "targets": rows,
    }
    rollback = {
        "generated_at": executed_at,
        "field_path": FIELD_PATH,
        "rollbacks": [
            {"isin": row["isin"], "name": row["name"], "restore_value": row["current"]}
            for row in rows
        ],
    }
    diff = {
        "generated_at": executed_at,
        "diffs": [
            {
                "isin": row["isin"],
                "name": row["name"],
                "before": row["current"],
                "after": row["target"],
                "status": row["status"],
            }
            for row in rows
        ],
    }

    write_json(gate_dir / "prepare_manifest.json", manifest)
    write_json(gate_dir / "rollback_manifest.json", rollback)
    write_json(gate_dir / "diff_manifest.json", diff)

    print(f"[PREPARE] Gate dir: {gate_dir}")
    print(f"[PREPARE] Targets: {len(rows)}")
    print(f"[PREPARE] Can write: {not drift}")
    if drift:
        print("[PREPARE] Drift detected, write mode will abort:")
        for row in drift:
            print(f"  - {row['isin']}: current={row['current']} expected={EXPECTED_BEFORE}")
    else:
        print("[PREPARE] All current values match expected before state.")
    return gate_dir


def run_write(gate_dir: Path, authorization: str) -> None:
    if authorization != AUTHORIZATION_TEXT:
        raise SystemExit("[ABORT] Authorization text does not match the required write gate.")
    manifest_path = gate_dir / "prepare_manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"[ABORT] Missing prepare manifest: {manifest_path}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("drift_detected") or not manifest.get("can_write"):
        raise SystemExit("[ABORT] Prepared manifest is not writable.")
    if manifest.get("selected_count") != len(TARGETS):
        raise SystemExit("[ABORT] Prepared manifest target count changed.")

    token = run_gcloud_access_token()
    before_rows = ensure_targets_current(token)
    drift = [row for row in before_rows if row["status"] != "ok"]
    if drift:
        for row in drift:
            print(f"[ABORT] {row['isin']} current={row['current']} expected={EXPECTED_BEFORE}")
        raise SystemExit("[ABORT] Live Firestore drift detected before write.")

    written = []
    for row in before_rows:
        isin = row["isin"]
        write_compatible_profiles(token, isin, TARGET_AFTER)
        after_doc = read_doc(token, isin)
        after = compatible_profiles(after_doc)
        ok = after == TARGET_AFTER
        written.append(
            {
                "isin": isin,
                "name": row["name"],
                "before": row["current"],
                "after": after,
                "target": TARGET_AFTER,
                "ok": ok,
            }
        )
        if not ok:
            raise SystemExit(f"[ABORT] Post-write verification failed for {isin}: {after}")

    post = {
        "executed_at": now_utc(),
        "project_id": PROJECT_ID,
        "collection": COLLECTION,
        "field_path": FIELD_PATH,
        "write_executed": True,
        "authorization": authorization,
        "writes": written,
    }
    write_json(gate_dir / "post_write_verification.json", post)
    print(f"[WRITE] Completed {len(written)} controlled writes.")
    print(f"[WRITE] Verification: {gate_dir / 'post_write_verification.json'}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="execute the approved Firestore write")
    parser.add_argument("--gate-dir", type=Path, help="prepared gate directory to use in write mode")
    parser.add_argument("--authorization", default="", help="exact human authorization text")
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

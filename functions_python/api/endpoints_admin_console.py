"""
Admin Console — Read-only backend endpoints.

These endpoints serve the Admin Console frontend shell.
All endpoints are strictly read-only: no Firestore writes, no parser,
no Gemini, no secrets exposed.

Security: every endpoint requires admin authorization via admin_auth helpers.
"""

import json
import logging

from firebase_functions import https_fn, options

from services.admin_auth import (
    extract_and_verify_admin_callable,
    is_admin_email,
    ADMIN_EMAILS,
)

logger = logging.getLogger(__name__)

cors_config = options.CorsOptions(
    cors_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        r"https://.*\.web\.app",
        r"https://.*\.firebaseapp\.com",
    ],
    cors_methods=["GET", "POST", "OPTIONS"],
)

# ---------------------------------------------------------------------------
# Safe field allowlist for fund search results.
# Only these fields are returned to the admin UI — no full document dump.
# ---------------------------------------------------------------------------
SAFE_FUND_FIELDS = (
    "isin",
    "name",
    "asset_type",
    "classification_v2",
    "manual",
    "portfolio_exposure_v2",
)


def _sanitize_fund_doc(doc_dict: dict) -> dict:
    """Extract only safe fields from a fund document.

    Returns a new dict containing only whitelisted fields.
    Never returns the full raw document.
    """
    sanitized = {}
    for field in SAFE_FUND_FIELDS:
        if field in doc_dict:
            value = doc_dict[field]
            # For nested dicts, do a shallow copy to avoid mutation
            if isinstance(value, dict):
                sanitized[field] = dict(value)
            else:
                sanitized[field] = value
    return sanitized


@https_fn.on_call(
    region="europe-west1",
    memory=options.MemoryOption.MB_512,
    cors=cors_config,
)
def admin_health(request: https_fn.CallableRequest):
    """Admin health check — returns system status and capabilities.

    Read-only. No Firestore access. No secrets.
    """
    admin_email = extract_and_verify_admin_callable(request)

    return {
        "status": "ok",
        "mode": "read_only",
        "admin_email": admin_email,
        "capabilities": [
            "admin_health",
            "admin_fund_search",
        ],
        "invariants": {
            "no_writes": True,
            "no_parser": True,
            "no_gemini": True,
            "no_secrets_exposed": True,
        },
        "version": "0.1.0",
        "phase": "backend_require_admin_0",
    }


@https_fn.on_call(
    region="europe-west1",
    memory=options.MemoryOption.MB_512,
    timeout_sec=30,
    cors=cors_config,
)
def admin_fund_search(request: https_fn.CallableRequest):
    """Admin read-only fund search — returns sanitized fund data.

    Accepts: { query: str } or { isin: str }
    Returns: list of sanitized fund documents (max 20).

    Read-only. No writes. Sanitized output only.
    """
    admin_email = extract_and_verify_admin_callable(request)

    data = request.data or {}
    query = (data.get("query") or "").strip()
    isin = (data.get("isin") or "").strip().upper()

    if not query and not isin:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Either 'query' or 'isin' parameter is required",
        )

    from firebase_admin import firestore
    db = firestore.client()

    results = []
    max_results = 20

    if isin:
        # Direct ISIN lookup — single document by ID
        doc = db.collection("funds_v3").document(isin).get()
        if doc.exists:
            sanitized = _sanitize_fund_doc(doc.to_dict())
            sanitized["isin"] = isin  # Ensure ISIN is always present
            results.append(sanitized)
    else:
        # Name-based search — scan with limit
        # Firestore doesn't support native text search, so we do a prefix match
        # on the 'name' field for simplicity. For production, consider Algolia.
        docs = db.collection("funds_v3").limit(200).stream()
        query_lower = query.lower()
        for doc in docs:
            if len(results) >= max_results:
                break
            doc_dict = doc.to_dict()
            name = (doc_dict.get("name") or "").lower()
            doc_isin = (doc_dict.get("isin") or doc.id or "").lower()
            if query_lower in name or query_lower in doc_isin:
                sanitized = _sanitize_fund_doc(doc_dict)
                sanitized["isin"] = doc.id  # Use doc ID as canonical ISIN
                results.append(sanitized)

    return {
        "results": results,
        "count": len(results),
        "query": query or isin,
        "mode": "read_only",
    }


# ---------------------------------------------------------------------------
# Retrocession normalization — canonical (C.1, C.2)
# ---------------------------------------------------------------------------

import re
import math
import uuid
from datetime import datetime, timezone, timedelta

# ISIN format: 2 uppercase letters + 9 alphanumeric + 1 digit
ISIN_REGEX = re.compile(r"^[A-Z]{2}[A-Z0-9]{9}[0-9]$")

# Manifest TTL (C.7)
MANIFEST_TTL_SECONDS = 86400  # 24 hours


def _normalize_retrocession_backend(
    retro_raw: str | None,
    cell_internal_value: float | None,
    cell_number_format: str | None,
    source: str,
) -> dict:
    """Canonical retrocession normalization — backend authoritative (C.2).

    Returns dict with keys: value (float|None), status (str), reason (str).

    Rules:
    - For XLSX with cell_number_format containing "%": multiply cell_internal_value by 100
    - Decision EXCLUSIVELY by format, NEVER by value size (C.1)
    - 0 is a valid retrocession (section D)
    - Negative values → INVALID
    - Empty/null → MISSING
    - Non-numeric → INVALID
    - > 5 → WARNING (not blocked)

    This function IGNORES any retro_parsed_client from the frontend (C.2).
    """
    # Case 1: XLSX with numeric cell and format metadata
    if source == "xlsx" and cell_internal_value is not None:
        if math.isnan(cell_internal_value):
            return {"value": None, "status": "INVALID", "reason": "Valor NaN en celda Excel"}

        final_value = cell_internal_value
        # C.1: Decision ONLY by format, not by value size
        if cell_number_format and "%" in cell_number_format:
            final_value = cell_internal_value * 100

        # Round to 4 decimals (C.11)
        final_value = round(final_value, 4)

        if final_value < 0:
            return {"value": None, "status": "INVALID", "reason": f"Retrocesión negativa: {final_value}"}

        result = {"value": final_value, "status": "OK", "reason": ""}
        if final_value > 5:
            result["status"] = "WARNING"
            result["reason"] = f"Valor alto: {final_value}% — verificar"
        return result

    # Case 2: String (CSV or text input)
    if retro_raw is None:
        return {"value": None, "status": "MISSING", "reason": "Valor vacío (null)"}

    raw_str = str(retro_raw).strip()
    if not raw_str:
        return {"value": None, "status": "MISSING", "reason": "Valor vacío (string vacío)"}

    # Remove percentage sign
    cleaned = re.sub(r"%\s*$", "", raw_str).strip()
    # Replace comma decimal with dot
    cleaned = cleaned.replace(",", ".")

    try:
        parsed = float(cleaned)
    except (ValueError, TypeError):
        return {"value": None, "status": "INVALID", "reason": f"Valor no numérico: \"{raw_str}\""}

    if math.isnan(parsed):
        return {"value": None, "status": "INVALID", "reason": "Valor NaN"}

    # Round to 4 decimals (C.11)
    final_value = round(parsed, 4)

    if final_value < 0:
        return {"value": None, "status": "INVALID", "reason": f"Retrocesión negativa: {final_value}"}

    result = {"value": final_value, "status": "OK", "reason": ""}
    if final_value > 5:
        result["status"] = "WARNING"
        result["reason"] = f"Valor alto: {final_value}% — verificar"
    return result


def _classify_row(
    row: dict,
    fund_doc: dict | None,
    fund_isin: str,
    new_retro: float | None,
    norm_status: str,
    norm_reason: str,
    source_filename: str,
) -> dict:
    """Classify a single row for dry-run results."""
    row_number = row.get("row_number", 0)

    # BLOCKED: normalization failed
    if norm_status == "INVALID":
        return {
            "isin": fund_isin,
            "firestore_name": "",
            "current_retro": None,
            "new_retro": None,
            "new_retro_client_reported": row.get("retro_parsed_client"),
            "delta": None,
            "status": "BLOCKED",
            "reason": norm_reason,
            "action": "SKIP",
            "row_number": row_number,
            "source_filename": source_filename,
        }

    if norm_status == "MISSING":
        return {
            "isin": fund_isin,
            "firestore_name": "",
            "current_retro": None,
            "new_retro": None,
            "new_retro_client_reported": row.get("retro_parsed_client"),
            "delta": None,
            "status": "BLOCKED",
            "reason": norm_reason,
            "action": "SKIP",
            "row_number": row_number,
            "source_filename": source_filename,
        }

    # BLOCKED: Invalid ISIN
    if not fund_isin or not ISIN_REGEX.match(fund_isin):
        return {
            "isin": fund_isin or "",
            "firestore_name": "",
            "current_retro": None,
            "new_retro": new_retro,
            "new_retro_client_reported": row.get("retro_parsed_client"),
            "delta": None,
            "status": "BLOCKED",
            "reason": f"ISIN inválido: '{fund_isin}'",
            "action": "SKIP",
            "row_number": row_number,
            "source_filename": source_filename,
        }

    # BLOCKED: Fund not found (C.4 — no REVIEW option)
    if fund_doc is None:
        return {
            "isin": fund_isin,
            "firestore_name": "",
            "current_retro": None,
            "new_retro": new_retro,
            "new_retro_client_reported": row.get("retro_parsed_client"),
            "delta": None,
            "status": "BLOCKED",
            "reason": "FUND_NOT_FOUND",
            "action": "SKIP",
            "row_number": row_number,
            "source_filename": source_filename,
        }

    # Fund found — extract current retro
    firestore_name = fund_doc.get("name", "")
    manual = fund_doc.get("manual") or {}
    costs = manual.get("costs") or {}
    current_retro = costs.get("retrocession")

    # Calculate delta
    delta = None
    if current_retro is not None and new_retro is not None:
        delta = round(new_retro - current_retro, 4)

    # UNCHANGED check (C.11 tolerance)
    if current_retro is not None and new_retro is not None:
        if abs(new_retro - current_retro) < 1e-6:
            return {
                "isin": fund_isin,
                "firestore_name": firestore_name,
                "current_retro": current_retro,
                "new_retro": new_retro,
                "new_retro_client_reported": row.get("retro_parsed_client"),
                "delta": 0,
                "status": "UNCHANGED",
                "reason": "Sin cambio (delta < 1e-6)",
                "action": "NO_CHANGE",
                "row_number": row_number,
                "source_filename": source_filename,
            }

    # Determine status and warnings
    status = norm_status  # OK or WARNING (from high value)
    reason = norm_reason

    # Large change warning
    warnings = []
    if delta is not None and abs(delta) >= 0.50:
        warnings.append(f"Cambio grande: Δ={delta:+.4f} pp")
    if (
        delta is not None
        and current_retro is not None
        and abs(current_retro) > 1e-6
        and abs(delta) / abs(current_retro) >= 0.50
    ):
        warnings.append(f"Cambio relativo ≥ 50%")
    if current_retro == 0 and new_retro is not None and new_retro > 0:
        warnings.append("Cambio desde 0 a valor positivo")

    # Name mismatch warning
    row_nombre = (row.get("nombre") or "").strip()
    if row_nombre and firestore_name and row_nombre.lower() != firestore_name.lower():
        warnings.append("Nombre difiere del registrado en Firestore")

    if warnings:
        status = "WARNING"
        reason = "; ".join(filter(None, [reason] + warnings))

    return {
        "isin": fund_isin,
        "firestore_name": firestore_name,
        "current_retro": current_retro,
        "new_retro": new_retro,
        "new_retro_client_reported": row.get("retro_parsed_client"),
        "delta": delta,
        "status": status,
        "reason": reason or "",
        "action": "UPDATE_DRY_RUN" if status in ("OK", "WARNING") else "SKIP",
        "row_number": row_number,
        "source_filename": source_filename,
    }


# ---------------------------------------------------------------------------
# admin_retro_dry_run — read-only dry-run endpoint (DRYRUN-0)
# ---------------------------------------------------------------------------

@https_fn.on_call(
    region="europe-west1",
    memory=options.MemoryOption.GB_1,
    timeout_sec=120,
    cors=cors_config,
)
def admin_retro_dry_run(request: https_fn.CallableRequest):
    """Admin dry-run for retrocession updates — strictly read-only.

    Receives parsed rows with raw data, re-normalizes authoritatively (C.2),
    crosses against funds_v3, and returns classified results.

    NO writes to funds_v3 or any other collection.
    Auth: extract_and_verify_admin_callable (mandatory).
    """
    admin_email = extract_and_verify_admin_callable(request)

    data = request.data or {}
    rows = data.get("rows") or []
    source_filename = data.get("source_filename", "unknown")
    source_encoding = data.get("source_encoding", "")

    if not rows:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="No rows provided for dry-run",
        )

    if len(rows) > 500:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"Too many rows: {len(rows)} (max 500)",
        )

    # -----------------------------------------------------------------------
    # Phase 1: Backend re-normalization (C.2)
    # -----------------------------------------------------------------------
    normalized_rows = []
    for row in rows:
        isin = (row.get("isin") or "").strip().upper()
        norm = _normalize_retrocession_backend(
            retro_raw=row.get("retro_raw"),
            cell_internal_value=row.get("cell_internal_value"),
            cell_number_format=row.get("cell_number_format"),
            source=row.get("source", "csv"),
        )
        normalized_rows.append({
            "isin": isin,
            "row": row,
            "new_retro": norm["value"],
            "norm_status": norm["status"],
            "norm_reason": norm["reason"],
        })

    # -----------------------------------------------------------------------
    # Phase 2: Server-side dedup (C.5)
    # -----------------------------------------------------------------------
    from collections import defaultdict
    isin_groups: dict[str, list[int]] = defaultdict(list)
    for idx, nr in enumerate(normalized_rows):
        if nr["isin"]:
            isin_groups[nr["isin"]].append(idx)

    dup_blocked_indices: set[int] = set()
    dup_warning_indices: set[int] = set()

    for isin, indices in isin_groups.items():
        if len(indices) <= 1:
            continue

        # Check if all values are the same (tolerance < 1e-6)
        values = [normalized_rows[i]["new_retro"] for i in indices]
        non_none = [v for v in values if v is not None]

        if len(non_none) <= 1:
            # Only one non-None value, treat remaining as same
            for i in indices[1:]:
                dup_warning_indices.add(i)
            continue

        # Check for conflicting values
        first = non_none[0]
        all_same = all(abs(v - first) < 1e-6 for v in non_none)

        if all_same:
            # DUP_SAME_VALUE → WARNING on duplicates
            for i in indices[1:]:
                dup_warning_indices.add(i)
        else:
            # DUP_CONFLICT → BLOCKED on ALL entries
            for i in indices:
                dup_blocked_indices.add(i)

    # -----------------------------------------------------------------------
    # Phase 3: Fetch funds from Firestore (READ-ONLY)
    # -----------------------------------------------------------------------
    from firebase_admin import firestore as fs_admin
    db = fs_admin.client()

    unique_isins = set(
        nr["isin"] for nr in normalized_rows
        if nr["isin"] and ISIN_REGEX.match(nr["isin"])
    )

    fund_docs: dict[str, dict | None] = {}
    for isin in unique_isins:
        doc = db.collection("funds_v3").document(isin).get()
        fund_docs[isin] = doc.to_dict() if doc.exists else None

    # -----------------------------------------------------------------------
    # Phase 4: Classify each row
    # -----------------------------------------------------------------------
    results = []
    client_server_mismatches = 0

    for idx, nr in enumerate(normalized_rows):
        isin = nr["isin"]
        row = nr["row"]
        new_retro = nr["new_retro"]
        norm_status = nr["norm_status"]
        norm_reason = nr["norm_reason"]

        # Check dedup overrides
        if idx in dup_blocked_indices:
            norm_status = "INVALID"
            norm_reason = "DUP_CONFLICT"

        classified = _classify_row(
            row=row,
            fund_doc=fund_docs.get(isin),
            fund_isin=isin,
            new_retro=new_retro,
            norm_status=norm_status,
            norm_reason=norm_reason,
            source_filename=source_filename,
        )

        # Override for DUP_SAME_VALUE warning
        if idx in dup_warning_indices and classified["status"] not in ("BLOCKED",):
            classified["status"] = "WARNING"
            existing_reason = classified.get("reason", "")
            classified["reason"] = (
                f"DUP_SAME_VALUE; {existing_reason}" if existing_reason
                else "DUP_SAME_VALUE"
            )

        # Check client-server mismatch (C.2)
        client_parsed = row.get("retro_parsed_client")
        if client_parsed is not None and new_retro is not None:
            if abs(client_parsed - new_retro) >= 1e-6:
                client_server_mismatches += 1
        elif client_parsed is not None and new_retro is None:
            client_server_mismatches += 1
        elif client_parsed is None and new_retro is not None:
            client_server_mismatches += 1

        results.append(classified)

    # -----------------------------------------------------------------------
    # Phase 5: Summary and manifest
    # -----------------------------------------------------------------------
    summary = {
        "total": len(results),
        "ok": sum(1 for r in results if r["status"] == "OK"),
        "warning": sum(1 for r in results if r["status"] == "WARNING"),
        "blocked": sum(1 for r in results if r["status"] == "BLOCKED"),
        "unchanged": sum(1 for r in results if r["status"] == "UNCHANGED"),
        "client_server_normalization_mismatches": client_server_mismatches,
    }

    # Generate manifest ID (in-memory for DRYRUN-0, not persisted)
    # NOTE: DRYRUN-0 does NOT persist the manifest to Firestore.
    # Persistence to admin_write_manifests is deferred to WRITE-GATE-0.
    # This avoids auxiliary writes during a read-only dry-run phase.
    uuid_part = uuid.uuid4().hex[:12]
    manifest_id = f"retro_dry_run_{datetime.now(timezone.utc).strftime('%Y_%m_%d')}_{uuid_part}"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=MANIFEST_TTL_SECONDS)

    # Confirmation phrase (C.3) — manifest_id_short = uuid portion for uniqueness
    manifest_id_short = uuid_part
    approved_count = summary["ok"] + summary["warning"]
    confirmation_phrase = f"BDB-RETRO-WRITE-{manifest_id_short}-{approved_count}"

    logger.info(
        f"admin_retro_dry_run completed by {admin_email}: "
        f"total={summary['total']}, ok={summary['ok']}, "
        f"warning={summary['warning']}, blocked={summary['blocked']}, "
        f"unchanged={summary['unchanged']}, mismatches={client_server_mismatches}"
    )

    return {
        "mode": "DRY_RUN_READ_ONLY",
        "results": results,
        "summary": summary,
        "manifest_id": manifest_id,
        "manifest_created_at": now.isoformat(),
        "manifest_ttl_seconds": MANIFEST_TTL_SECONDS,
        "manifest_expires_at": expires_at.isoformat(),
        "confirmation_phrase_expected": confirmation_phrase,
    }


# ---------------------------------------------------------------------------
# admin_retro_write — controlled real-write endpoint (WRITE-MVP-0)
# ---------------------------------------------------------------------------
#
# This endpoint applies retrocession updates to funds_v3 after a successful
# dry-run. It is the ONLY place where Firestore writes are produced for the
# retrocession field. Invariants:
#
#   * Re-runs the SAME normalization + classification pipeline as
#     admin_retro_dry_run on the rows provided by the client. The client's
#     prior dry-run output is NOT trusted as authority (C.2 carries over):
#     the backend re-derives every status from raw inputs.
#   * BLOCKED rows present in the re-classified lote → abort, no writes.
#   * WARNING rows must be explicitly acknowledged by ISIN in `warning_acks`
#     (the client surfaces a checkbox per warning or "ack all").
#   * Writes use Firestore .update() targeting EXCLUSIVELY the dotted path
#     "manual.costs.retrocession". No other field is touched. No set().
#     No create() — funds that don't exist are recorded as BLOCKED.
#   * For each fund: read fund document immediately before write to verify
#     existence and to capture the freshest `previous` value. If the current
#     retrocession in Firestore drifted from the manifest's `current_retro`
#     beyond tolerance (1e-6), the row is skipped with STALE_CURRENT and
#     recorded in audit. Other rows proceed.
#   * One audit document is created in `admin_audit_log` per write operation
#     with all entries (PASS / FAIL / SKIPPED) so manual rollback is feasible
#     using before/after values stored there.
#
# Audit log collection. The `audit_id` is returned to the client so the admin
# can reference the operation later.
AUDIT_COLLECTION = "admin_audit_log"

# Maximum length for the reason/comment field. Reasonable cap to prevent abuse.
REASON_MIN_LEN = 3
REASON_MAX_LEN = 2000


def _re_classify_for_write(
    rows: list[dict],
    source_filename: str,
    db,
) -> tuple[list[dict], list[dict], int]:
    """Re-run normalization + dedup + classification pipeline on rows.

    Mirrors the phases of admin_retro_dry_run but is invoked from
    admin_retro_write to ensure the write decisions are based on a fresh
    server-side re-evaluation rather than the client's prior dry-run output.

    Returns (classified_results, normalized_rows, client_server_mismatches).
    """
    from collections import defaultdict
    from firebase_admin import firestore as fs_admin
    _ = fs_admin  # silence unused; db is injected for testability

    # Phase 1: normalize per row
    normalized_rows: list[dict] = []
    for row in rows:
        isin = (row.get("isin") or "").strip().upper()
        norm = _normalize_retrocession_backend(
            retro_raw=row.get("retro_raw"),
            cell_internal_value=row.get("cell_internal_value"),
            cell_number_format=row.get("cell_number_format"),
            source=row.get("source", "csv"),
        )
        normalized_rows.append({
            "isin": isin,
            "row": row,
            "new_retro": norm["value"],
            "norm_status": norm["status"],
            "norm_reason": norm["reason"],
        })

    # Phase 2: server-side dedup (C.5)
    isin_groups: dict[str, list[int]] = defaultdict(list)
    for idx, nr in enumerate(normalized_rows):
        if nr["isin"]:
            isin_groups[nr["isin"]].append(idx)

    dup_blocked_indices: set[int] = set()
    dup_warning_indices: set[int] = set()
    for isin, indices in isin_groups.items():
        if len(indices) <= 1:
            continue
        values = [normalized_rows[i]["new_retro"] for i in indices]
        non_none = [v for v in values if v is not None]
        if len(non_none) <= 1:
            for i in indices[1:]:
                dup_warning_indices.add(i)
            continue
        first = non_none[0]
        all_same = all(abs(v - first) < 1e-6 for v in non_none)
        if all_same:
            for i in indices[1:]:
                dup_warning_indices.add(i)
        else:
            for i in indices:
                dup_blocked_indices.add(i)

    # Phase 3: fetch funds (READ-ONLY at this point)
    unique_isins = set(
        nr["isin"] for nr in normalized_rows
        if nr["isin"] and ISIN_REGEX.match(nr["isin"])
    )
    fund_docs: dict[str, dict | None] = {}
    for isin in unique_isins:
        doc = db.collection("funds_v3").document(isin).get()
        fund_docs[isin] = doc.to_dict() if doc.exists else None

    # Phase 4: classify
    results: list[dict] = []
    client_server_mismatches = 0
    for idx, nr in enumerate(normalized_rows):
        isin = nr["isin"]
        row = nr["row"]
        new_retro = nr["new_retro"]
        norm_status = nr["norm_status"]
        norm_reason = nr["norm_reason"]

        if idx in dup_blocked_indices:
            norm_status = "INVALID"
            norm_reason = "DUP_CONFLICT"

        classified = _classify_row(
            row=row,
            fund_doc=fund_docs.get(isin),
            fund_isin=isin,
            new_retro=new_retro,
            norm_status=norm_status,
            norm_reason=norm_reason,
            source_filename=source_filename,
        )

        if idx in dup_warning_indices and classified["status"] not in ("BLOCKED",):
            classified["status"] = "WARNING"
            existing_reason = classified.get("reason", "")
            classified["reason"] = (
                f"DUP_SAME_VALUE; {existing_reason}" if existing_reason
                else "DUP_SAME_VALUE"
            )

        client_parsed = row.get("retro_parsed_client")
        if client_parsed is not None and new_retro is not None:
            if abs(client_parsed - new_retro) >= 1e-6:
                client_server_mismatches += 1
        elif client_parsed is not None and new_retro is None:
            client_server_mismatches += 1
        elif client_parsed is None and new_retro is not None:
            client_server_mismatches += 1

        results.append(classified)

    return results, normalized_rows, client_server_mismatches


def _run_admin_retro_write_core(
    admin_email: str,
    actor_uid: str,
    data: dict,
    db,
    server_timestamp,
):
    """Pure logic for admin_retro_write — testable without firebase_functions
    runtime. Raises https_fn.HttpsError on validation failures, returns the
    response dict on success. The decorated callable is a thin shim around
    this function.
    """
    rows = data.get("rows") or []
    reason = (data.get("reason") or "").strip()
    confirm = bool(data.get("confirm"))
    warning_acks_raw = data.get("warning_acks") or []
    warning_acks: set[str] = set()
    if isinstance(warning_acks_raw, list):
        for v in warning_acks_raw:
            if isinstance(v, str):
                warning_acks.add(v.strip().upper())
    source = (data.get("source") or "manual").lower()
    source_filename = data.get("source_filename", "")
    dry_run_manifest_id = data.get("dry_run_manifest_id", "")

    # -----------------------------------------------------------------------
    # Pre-flight validations
    # -----------------------------------------------------------------------
    if not confirm:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="confirm flag must be true",
        )
    if len(reason) < REASON_MIN_LEN:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"reason required (min {REASON_MIN_LEN} chars)",
        )
    if len(reason) > REASON_MAX_LEN:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"reason too long (max {REASON_MAX_LEN} chars)",
        )
    if not rows:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="No rows provided for write",
        )
    if len(rows) > 500:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"Too many rows: {len(rows)} (max 500)",
        )
    if source not in ("manual", "csv", "excel", "xlsx"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"Invalid source: {source}",
        )

    # -----------------------------------------------------------------------
    # Re-classify every row server-side (do NOT trust client-side dry-run)
    # -----------------------------------------------------------------------
    results, _normalized, client_server_mismatches = _re_classify_for_write(
        rows=rows,
        source_filename=source_filename,
        db=db,
    )

    # -----------------------------------------------------------------------
    # Gate: any BLOCKED → abort without writes
    # -----------------------------------------------------------------------
    blocked_results = [r for r in results if r["status"] == "BLOCKED"]
    if blocked_results:
        logger.warning(
            f"admin_retro_write aborted by {admin_email}: "
            f"{len(blocked_results)} BLOCKED rows present"
        )
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message=(
                f"Lote contiene {len(blocked_results)} filas BLOCKED; "
                "el flujo MVP no acepta escritura parcial. Corrige el archivo "
                "o re-ejecuta el dry-run."
            ),
            details={
                "blocked_isins": [
                    {"isin": r["isin"], "reason": r["reason"]}
                    for r in blocked_results
                ],
            },
        )

    # -----------------------------------------------------------------------
    # Gate: WARNING rows must be acknowledged by ISIN
    # -----------------------------------------------------------------------
    warning_results = [r for r in results if r["status"] == "WARNING"]
    unacked = [r for r in warning_results if r["isin"] not in warning_acks]
    if unacked:
        logger.warning(
            f"admin_retro_write aborted by {admin_email}: "
            f"{len(unacked)} WARNING rows without ack"
        )
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message=(
                f"{len(unacked)} filas con WARNING sin acuse explícito. "
                "Marcar la confirmación de warnings antes de aplicar."
            ),
            details={
                "unacked_warning_isins": [r["isin"] for r in unacked],
            },
        )

    # -----------------------------------------------------------------------
    # Apply writes — only OK and acknowledged WARNING rows
    # -----------------------------------------------------------------------
    writes_to_apply = [r for r in results if r["status"] in ("OK", "WARNING")]
    unchanged_count = sum(1 for r in results if r["status"] == "UNCHANGED")

    writes_executed = 0
    writes_failed = 0
    write_failures: list[dict] = []
    audit_entries: list[dict] = []
    isins_updated: list[str] = []

    for r in writes_to_apply:
        isin = r["isin"]
        new_retro = r["new_retro"]
        manifest_current = r["current_retro"]

        # Anti-stale & no-create: re-read the doc immediately before update
        doc_ref = db.collection("funds_v3").document(isin)
        try:
            doc_snap = doc_ref.get()
        except Exception as e:
            writes_failed += 1
            write_failures.append({
                "isin": isin,
                "reason": "READ_BEFORE_WRITE_FAILED",
                "error": str(e),
            })
            audit_entries.append({
                "isin": isin,
                "previous": manifest_current,
                "new": new_retro,
                "result": "FAIL",
                "reason": "READ_BEFORE_WRITE_FAILED",
                "error": str(e),
            })
            continue

        if not doc_snap.exists:
            writes_failed += 1
            write_failures.append({
                "isin": isin,
                "reason": "FUND_NOT_FOUND_AT_WRITE_TIME",
            })
            audit_entries.append({
                "isin": isin,
                "previous": manifest_current,
                "new": new_retro,
                "result": "FAIL",
                "reason": "FUND_NOT_FOUND_AT_WRITE_TIME",
            })
            continue

        existing = doc_snap.to_dict() or {}
        existing_manual = existing.get("manual") or {}
        existing_costs = existing_manual.get("costs") or {}
        existing_retro = existing_costs.get("retrocession")

        # Stale guard (C.7): aborta esta fila si current cambió respecto al manifest
        if (
            existing_retro is not None
            and manifest_current is not None
            and abs(existing_retro - manifest_current) >= 1e-6
        ):
            writes_failed += 1
            write_failures.append({
                "isin": isin,
                "reason": "STALE_CURRENT",
                "manifest_current": manifest_current,
                "firestore_current": existing_retro,
            })
            audit_entries.append({
                "isin": isin,
                "previous": existing_retro,
                "new": new_retro,
                "result": "SKIPPED",
                "reason": "STALE_CURRENT",
            })
            continue

        # No-op guard: if existing == new with tolerance, skip silently
        if (
            existing_retro is not None
            and new_retro is not None
            and abs(existing_retro - new_retro) < 1e-6
        ):
            audit_entries.append({
                "isin": isin,
                "previous": existing_retro,
                "new": new_retro,
                "result": "SKIPPED",
                "reason": "NO_OP_EQUAL_VALUE",
            })
            continue

        # Apply update — ONLY the retrocession dotted field. Preserves all else.
        try:
            doc_ref.update({"manual.costs.retrocession": round(float(new_retro), 4)})
            writes_executed += 1
            isins_updated.append(isin)
            audit_entries.append({
                "isin": isin,
                "previous": existing_retro,
                "new": round(float(new_retro), 4),
                "result": "PASS",
                "warning_acked": isin in warning_acks,
            })

            # Post-write verification (C.14): read-back and compare
            try:
                verify_snap = doc_ref.get()
                if verify_snap.exists:
                    verify_dict = verify_snap.to_dict() or {}
                    verify_retro = (
                        verify_dict.get("manual", {})
                        .get("costs", {})
                        .get("retrocession")
                    )
                    if (
                        verify_retro is None
                        or abs(verify_retro - new_retro) >= 1e-6
                    ):
                        audit_entries[-1]["post_write_verification"] = "FAIL"
                        audit_entries[-1]["post_write_readback"] = verify_retro
                    else:
                        audit_entries[-1]["post_write_verification"] = "PASS"
            except Exception as e:
                audit_entries[-1]["post_write_verification"] = "ERROR"
                audit_entries[-1]["post_write_error"] = str(e)
        except Exception as e:
            writes_failed += 1
            write_failures.append({
                "isin": isin,
                "reason": "UPDATE_FAILED",
                "error": str(e),
            })
            audit_entries.append({
                "isin": isin,
                "previous": existing_retro,
                "new": new_retro,
                "result": "FAIL",
                "reason": "UPDATE_FAILED",
                "error": str(e),
            })

    # -----------------------------------------------------------------------
    # Persist audit document (always, even if 0 writes executed)
    # -----------------------------------------------------------------------
    audit_doc_ref = db.collection(AUDIT_COLLECTION).document()
    audit_id = audit_doc_ref.id

    audit_payload = {
        "timestamp": server_timestamp,
        "actor_email": admin_email,
        "actor_uid": actor_uid,
        "action": "admin_retro_write",
        "source": source,
        "source_filename": source_filename,
        "dry_run_manifest_id": dry_run_manifest_id,
        "reason": reason,
        "total_rows": len(rows),
        "writes_planned": len(writes_to_apply),
        "writes_executed": writes_executed,
        "writes_failed": writes_failed,
        "unchanged_count": unchanged_count,
        "warning_count": len(warning_results),
        "warning_acks": sorted(warning_acks),
        "client_server_normalization_mismatches": client_server_mismatches,
        "isins_updated": isins_updated,
        "entries": audit_entries,
        "write_failures": write_failures,
    }
    try:
        audit_doc_ref.set(audit_payload)
    except Exception as e:
        # If audit fails after writes, surface clearly but do not undo writes
        logger.error(
            f"admin_retro_write audit log write failed for audit_id={audit_id}: {e}"
        )
        # Return with audit_id but warn — the operation still happened
        return {
            "mode": "WRITE_EXECUTED_AUDIT_FAILED",
            "audit_id": audit_id,
            "writes_executed": writes_executed,
            "writes_failed": writes_failed,
            "writes_planned": len(writes_to_apply),
            "unchanged_count": unchanged_count,
            "isins_updated": isins_updated,
            "write_failures": write_failures,
            "audit_error": str(e),
        }

    logger.info(
        f"admin_retro_write completed by {admin_email}: "
        f"audit_id={audit_id}, executed={writes_executed}, "
        f"failed={writes_failed}, planned={len(writes_to_apply)}, "
        f"unchanged={unchanged_count}, source={source}"
    )

    return {
        "mode": "WRITE_EXECUTED",
        "audit_id": audit_id,
        "writes_executed": writes_executed,
        "writes_failed": writes_failed,
        "writes_planned": len(writes_to_apply),
        "unchanged_count": unchanged_count,
        "warning_count": len(warning_results),
        "isins_updated": isins_updated,
        "write_failures": write_failures,
    }


# ---------------------------------------------------------------------------
# admin_retro_write — Cloud Function callable (thin wrapper around core)
# ---------------------------------------------------------------------------

@https_fn.on_call(
    region="europe-west1",
    memory=options.MemoryOption.GB_1,
    timeout_sec=180,
    cors=cors_config,
)
def admin_retro_write(request: https_fn.CallableRequest):
    """Apply real retrocession updates to funds_v3 after a successful dry-run.

    Strictly bounded:
      * update() of exactly `manual.costs.retrocession`. No other field.
      * Never creates a fund. BLOCKED if doc missing at re-classification or
        at write-time.
      * BLOCKED rows in the lote → abort with FAILED_PRECONDITION before any
        write.
      * WARNING rows must be explicitly acknowledged in `warning_acks` (list
        of ISIN strings). Unacknowledged warnings → abort.
      * `reason` (operator comment) is required (≥3 chars).
      * `confirm` must be true.
      * Writes one audit document to `admin_audit_log` per call summarizing
        every PASS/FAIL/SKIPPED ISIN with previous/new for manual rollback.

    All testable logic lives in `_run_admin_retro_write_core`.
    """
    admin_email = extract_and_verify_admin_callable(request)
    actor_uid = request.auth.uid if request.auth else ""

    from firebase_admin import firestore as fs_admin
    db = fs_admin.client()
    server_timestamp = fs_admin.SERVER_TIMESTAMP

    return _run_admin_retro_write_core(
        admin_email=admin_email,
        actor_uid=actor_uid,
        data=request.data or {},
        db=db,
        server_timestamp=server_timestamp,
    )

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
    memory=options.MemoryOption.MB_256,
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

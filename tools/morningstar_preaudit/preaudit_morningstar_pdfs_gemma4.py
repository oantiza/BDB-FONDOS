#!/usr/bin/env python
"""
Local Morningstar PDF pre-audit with Ollama/Gemma4.

This tool inventories PDFs, extracts local text, asks a local Ollama model for
structured compatibility signals, and writes a JSON audit artifact. It does not
call Gemini, Firestore, or any external API, and it never moves or deletes PDFs.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


TASK_ID = "BDB-MORNINGSTAR-PDFS-REFRESH-GEMMA4-PREAUDIT-0"
DEFAULT_MODEL = "gemma4:e4b"
DEFAULT_LIMIT = 5
DEFAULT_TIMEOUT = 120
DEFAULT_MAX_CHARS = 18000
OLLAMA_BASE_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")

RECOMMENDATIONS = {
    "HIGH_VALUE_REFRESH",
    "SAFE_REFRESH_LOW_RISK",
    "REVIEW_BEFORE_WRITE",
    "DO_NOT_PARSE_NOW",
}

CONFIDENCE_VALUES = {"HIGH", "MEDIUM", "LOW"}
DOCUMENT_TYPES = {
    "MORNINGSTAR_FACTSHEET",
    "KID",
    "KIID",
    "PROSPECTUS",
    "MANAGER_FACTSHEET",
    "UNKNOWN",
}

MONTHS_ES = {
    "enero": 1,
    "ene": 1,
    "febrero": 2,
    "feb": 2,
    "marzo": 3,
    "mar": 3,
    "abril": 4,
    "abr": 4,
    "mayo": 5,
    "may": 5,
    "junio": 6,
    "jun": 6,
    "julio": 7,
    "jul": 7,
    "agosto": 8,
    "ago": 8,
    "septiembre": 9,
    "setiembre": 9,
    "sept": 9,
    "sep": 9,
    "octubre": 10,
    "oct": 10,
    "noviembre": 11,
    "nov": 11,
    "diciembre": 12,
    "dic": 12,
}

ISIN_PREFIXES = {
    "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
    "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
    "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
    "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
    "EG", "EH", "ER", "ES", "ET", "EU", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE",
    "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK",
    "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE",
    "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB",
    "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH",
    "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ",
    "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF",
    "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU",
    "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR",
    "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN",
    "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG",
    "VI", "VN", "VU", "WF", "WS", "XS", "YE", "YT", "ZA", "ZM", "ZW",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def bool_from_any(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"true", "yes", "si", "sí", "1"}
    return False


def clean_text(value: str) -> str:
    value = value.replace("\x00", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def compact_for_prompt(value: str, max_chars: int) -> str:
    value = clean_text(value)
    if len(value) <= max_chars:
        return value
    head = value[: int(max_chars * 0.7)]
    tail = value[-int(max_chars * 0.3) :]
    return f"{head}\n\n[...TEXT_TRUNCATED...]\n\n{tail}"


def file_stat(path: Path, base_dir: Path) -> dict[str, Any]:
    stat = path.stat()
    return {
        "filename": path.name,
        "path": str(path.relative_to(base_dir.parent) if path.is_relative_to(base_dir.parent) else path),
        "absolute_path": str(path),
        "size": stat.st_size,
        "modified_time": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
    }


def inventory_pdfs(input_dir: Path) -> list[Path]:
    if not input_dir.exists():
        raise FileNotFoundError(f"Input directory does not exist: {input_dir}")
    return sorted([p for p in input_dir.iterdir() if p.is_file() and p.suffix.lower() == ".pdf"], key=lambda p: p.name.lower())


def extract_with_pypdf(path: Path) -> str | None:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return None
    try:
        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return None


def extract_with_pymupdf(path: Path) -> str | None:
    try:
        import fitz  # type: ignore
    except Exception:
        return None
    try:
        with fitz.open(str(path)) as doc:
            return "\n".join(page.get_text("text") for page in doc)
    except Exception:
        return None


def extract_with_pdfplumber(path: Path) -> str | None:
    try:
        import pdfplumber  # type: ignore
    except Exception:
        return None
    try:
        with pdfplumber.open(str(path)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception:
        return None


def extract_with_node_pdf_parse(path: Path, cwd: Path, timeout: int) -> str | None:
    script = """
const fs = require('fs');
const pdfParse = require('pdf-parse');
const file = process.argv[1];
pdfParse(fs.readFileSync(file))
  .then(data => process.stdout.write(data.text || ''))
  .catch(err => {
    console.error(err && err.message ? err.message : String(err));
    process.exit(2);
  });
""".strip()
    try:
        completed = subprocess.run(
            ["node", "-e", script, str(path)],
            cwd=str(cwd),
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except Exception:
        return None
    if completed.returncode != 0:
        return None
    return completed.stdout


def extract_pdf_text(path: Path, cwd: Path, timeout: int) -> tuple[str, str, list[str]]:
    warnings: list[str] = []
    extractors = [
        ("pypdf", lambda: extract_with_pypdf(path)),
        ("pymupdf", lambda: extract_with_pymupdf(path)),
        ("pdfplumber", lambda: extract_with_pdfplumber(path)),
        ("node_pdf_parse", lambda: extract_with_node_pdf_parse(path, cwd, timeout)),
    ]
    for name, extractor in extractors:
        text = extractor()
        if text and len(clean_text(text)) >= 80:
            return clean_text(text), name, warnings
        if text:
            warnings.append(f"{name}_text_too_short")
    return "", "none", warnings + ["TEXT_EXTRACTION_FAILED"]


def detect_isin(text: str, filename: str) -> str | None:
    haystack = f"{filename}\n{text}"
    for match in re.finditer(r"\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b", haystack.upper()):
        isin = match.group(1)
        if is_valid_isin(isin):
            return isin
    return None


def is_valid_isin(value: str) -> bool:
    value = (value or "").strip().upper()
    if not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}[0-9]", value):
        return False
    if value[:2] not in ISIN_PREFIXES:
        return False
    if sum(char.isdigit() for char in value[2:11]) < 3:
        return False
    expanded = "".join(str(ord(char) - 55) if char.isalpha() else char for char in value)
    total = 0
    reverse_digits = list(map(int, reversed(expanded)))
    for index, digit in enumerate(reverse_digits):
        if index % 2 == 1:
            doubled = digit * 2
            total += doubled // 10 + doubled % 10
        else:
            total += digit
    return total % 10 == 0


def detect_all_isins(text: str, filename: str = "") -> list[str]:
    haystack = f"{filename}\n{text}".upper()
    seen: set[str] = set()
    values: list[str] = []
    for match in re.finditer(r"\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b", haystack):
        isin = match.group(1)
        if isin not in seen and is_valid_isin(isin):
            seen.add(isin)
            values.append(isin)
    return values


def detect_name_from_filename(filename: str, isin: str | None) -> str | None:
    stem = Path(filename).stem
    if isin and stem.upper().startswith(isin):
        stem = stem[len(isin) :]
    stem = re.sub(r"^[\s\-_]+", "", stem)
    stem = re.sub(r"[_]+", " ", stem).strip()
    return stem or None


def parse_date_candidate(value: str) -> str | None:
    value = value.strip().lower()
    numeric = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|19\d{2})\b", value)
    if numeric:
        day, month, year = map(int, numeric.groups())
        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            return None
    text_month = re.search(
        r"(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(20\d{2}|19\d{2})\b",
        value,
        re.IGNORECASE,
    )
    if text_month:
        day = int(text_month.group(1))
        month_name = (
            text_month.group(2)
            .replace("á", "a")
            .replace("é", "e")
            .replace("í", "i")
            .replace("ó", "o")
            .replace("ú", "u")
        )
        month = MONTHS_ES.get(month_name)
        year = int(text_month.group(3))
        if month:
            try:
                return datetime(year, month, day).date().isoformat()
            except ValueError:
                return None
    short_text_month = re.search(
        r"(\d{1,2})\s+([a-záéíóúñ]{3,})\.?\s+(20\d{2}|19\d{2})\b",
        value,
        re.IGNORECASE,
    )
    if short_text_month:
        day = int(short_text_month.group(1))
        month_name = (
            short_text_month.group(2)
            .replace("á", "a")
            .replace("é", "e")
            .replace("í", "i")
            .replace("ó", "o")
            .replace("ú", "u")
        )
        month = MONTHS_ES.get(month_name)
        year = int(short_text_month.group(3))
        if month:
            try:
                return datetime(year, month, day).date().isoformat()
            except ValueError:
                return None
    iso = re.search(r"\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b", value)
    if iso:
        try:
            return datetime(int(iso.group(1)), int(iso.group(2)), int(iso.group(3))).date().isoformat()
        except ValueError:
            return None
    return None


def detect_dates(text: str, filename: str) -> tuple[str | None, str | None]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    report_date = None
    portfolio_date = None
    for line in lines[:200]:
        low = line.lower()
        parsed = parse_date_candidate(line)
        if not parsed:
            continue
        if any(token in low for token in ["cartera", "portfolio", "holdings", "datos al"]):
            portfolio_date = portfolio_date or parsed
        if any(token in low for token in ["informe", "report", "factsheet", "fecha"]):
            report_date = report_date or parsed
    if not report_date:
        report_date = parse_date_candidate(filename)
    if not report_date:
        for line in lines[:120]:
            report_date = parse_date_candidate(line) or report_date
            if report_date:
                break
    return report_date, portfolio_date


def detect_category(text: str) -> str | None:
    patterns = [
        r"Categor(?:ia|ía)\s+Morningstar\s*[:\-]?\s*(.+)",
        r"Morningstar\s+Category\s*[:\-]?\s*(.+)",
        r"Categoria\s*[:\-]?\s*(.+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = match.group(1).strip()
            value = re.split(r"\s{2,}|\n", value)[0].strip()
            return value[:160] or None
    return None


def local_feature_flags(text: str) -> dict[str, bool]:
    low = text.lower()
    return {
        "has_asset_allocation": any(k in low for k in ["asset allocation", "distribucion de activos", "distribución de activos", "renta variable", "renta fija"]),
        "has_regions": any(k in low for k in ["regiones", "regions", "exposicion geografica", "exposición geográfica", "europa", "america"]),
        "has_sectors": any(k in low for k in ["sectores", "sectors", "tecnologia", "technology", "financial services", "servicios financieros"]),
        "has_top_holdings": any(k in low for k in ["top 10", "principales posiciones", "top holdings", "mayores posiciones"]),
        "has_credit_quality": any(k in low for k in ["calidad crediticia", "credit quality", "aaa", "bbb", "high yield"]),
        "has_duration": any(k in low for k in ["duracion efectiva", "duración efectiva", "effective duration", "duration"]),
        "has_yield": any(k in low for k in ["yield", "rentabilidad a vencimiento", "tir", "ytm"]),
        "has_costs": any(k in low for k in ["gastos corrientes", "ongoing charge", "management fee", "comision de gestion", "comisión de gestión"]),
        "has_ratings": any(k in low for k in ["rating morningstar", "medalist", "sustainability rating", "estrellas"]),
        "has_esg": any(k in low for k in ["esg", "sostenibilidad", "sustainability"]),
    }


def detect_document_type(text: str, filename: str) -> str:
    low = f"{filename}\n{text[:3000]}".lower()
    if "morningstar" in low and any(k in low for k in ["factsheet", "snapshot", "rating morningstar", "category"]):
        return "MORNINGSTAR_FACTSHEET"
    if "kiid" in low or "datos fundamentales para el inversor" in low:
        return "KIID"
    if re.search(r"\bkid\b", low) or "key information document" in low:
        return "KID"
    if "prospectus" in low or "folleto" in low:
        return "PROSPECTUS"
    if "morningstar" not in low and any(k in low for k in ["factsheet", "ficha"]):
        return "MANAGER_FACTSHEET"
    return "UNKNOWN"


def ollama_json(path: str, payload: dict[str, Any], timeout: int) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{OLLAMA_BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def ollama_get(path: str, timeout: int) -> dict[str, Any]:
    with urllib.request.urlopen(f"{OLLAMA_BASE_URL}{path}", timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def validate_ollama_model(model: str, timeout: int) -> tuple[bool, dict[str, Any], str | None]:
    try:
        tags = ollama_get("/api/tags", timeout)
    except Exception as exc:
        return False, {}, f"OLLAMA_TAGS_ERROR:{exc}"
    names = {item.get("name") for item in tags.get("models", [])}
    if model not in names:
        return False, tags, f"MODEL_NOT_FOUND:{model}"
    try:
        result = ollama_json(
            "/api/generate",
            {"model": model, "prompt": "Responde solo OK", "stream": False, "options": {"temperature": 0}},
            timeout,
        )
    except Exception as exc:
        return False, tags, f"OLLAMA_GENERATE_ERROR:{exc}"
    if "OK" not in str(result.get("response", "")).upper():
        return False, tags, f"OLLAMA_UNEXPECTED_TEST_RESPONSE:{result.get('response')!r}"
    return True, tags, None


def build_prompt(meta: dict[str, Any], local: dict[str, Any], text: str) -> str:
    schema = {
        "file_path": meta["path"],
        "filename": meta["filename"],
        "detected_isin": local.get("detected_isin"),
        "detected_fund_name": local.get("detected_fund_name"),
        "document_date": local.get("document_date"),
        "portfolio_date": local.get("portfolio_date"),
        "document_type": "MORNINGSTAR_FACTSHEET | KID | KIID | PROSPECTUS | MANAGER_FACTSHEET | UNKNOWN",
        "morningstar_category": local.get("morningstar_category"),
        "benchmark": None,
        "currency": None,
        "has_asset_allocation": False,
        "has_regions": False,
        "has_sectors": False,
        "has_top_holdings": False,
        "has_credit_quality": False,
        "has_duration": False,
        "has_yield": False,
        "has_costs": False,
        "has_ratings": False,
        "has_esg": False,
        "appears_morningstar_standard_pdf": False,
        "likely_parser_compatible": False,
        "confidence": "HIGH | MEDIUM | LOW",
        "recommendation": "HIGH_VALUE_REFRESH | SAFE_REFRESH_LOW_RISK | REVIEW_BEFORE_WRITE | DO_NOT_PARSE_NOW",
        "score": 0,
        "reasons": [],
        "warnings": [],
    }
    return textwrap.dedent(
        f"""
        You are auditing a fund PDF for a local pre-audit. Return ONLY valid JSON.
        Do not use markdown. Do not explain.

        Task:
        - Detect whether this is a Morningstar-compatible factsheet.
        - Extract visible identifiers and dates.
        - Mark whether useful sections are present.
        - Do not invent values. Use null when unknown.
        - Do not extract retrocessions, entry fees, exit fees, or manual costs.

        Return exactly one JSON object compatible with this schema:
        {json.dumps(schema, ensure_ascii=False)}

        Local hints:
        {json.dumps(local, ensure_ascii=False)}

        PDF text:
        \"\"\"{text}\"\"\"
        """
    ).strip()


def extract_first_json_object(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(value)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = value.find("{")
    while start != -1:
        depth = 0
        in_string = False
        escaped = False
        for index in range(start, len(value)):
            char = value[index]
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
                continue
            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    candidate = value[start : index + 1]
                    try:
                        parsed = json.loads(candidate)
                        if isinstance(parsed, dict):
                            return parsed
                    except json.JSONDecodeError:
                        break
        start = value.find("{", start + 1)
    raise ValueError("JSON_PARSE_ERROR")


def normalize_model_result(raw: dict[str, Any], meta: dict[str, Any], local: dict[str, Any]) -> dict[str, Any]:
    result = dict(raw)
    result["file_path"] = result.get("file_path") or meta["path"]
    result["filename"] = result.get("filename") or meta["filename"]
    result["detected_isin"] = (result.get("detected_isin") or local.get("detected_isin") or None)
    if isinstance(result["detected_isin"], str):
        result["detected_isin"] = result["detected_isin"].strip().upper() or None
    result["detected_fund_name"] = result.get("detected_fund_name") or local.get("detected_fund_name")
    result["document_date"] = parse_date_candidate(str(result.get("document_date") or "")) or result.get("document_date") or local.get("document_date")
    model_portfolio_date = parse_date_candidate(str(result.get("portfolio_date") or "")) or result.get("portfolio_date")
    local_portfolio_date = local.get("portfolio_date")
    if local_portfolio_date and (not model_portfolio_date or model_portfolio_date == result["document_date"]):
        result["portfolio_date"] = local_portfolio_date
    else:
        result["portfolio_date"] = model_portfolio_date or local_portfolio_date
    document_type = str(result.get("document_type") or local.get("document_type") or "UNKNOWN").strip().upper()
    result["document_type"] = document_type if document_type in DOCUMENT_TYPES else "UNKNOWN"
    category = result.get("morningstar_category") or local.get("morningstar_category")
    if isinstance(category, str):
        category = category.replace("�", "").strip()
        if len(re.sub(r"[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+", "", category)) < 3:
            category = None
    result["morningstar_category"] = category
    for key, value in local.get("feature_flags", {}).items():
        result[key] = bool_from_any(result.get(key)) or bool(value)
    for key in [
        "has_asset_allocation",
        "has_regions",
        "has_sectors",
        "has_top_holdings",
        "has_credit_quality",
        "has_duration",
        "has_yield",
        "has_costs",
        "has_ratings",
        "has_esg",
        "appears_morningstar_standard_pdf",
        "likely_parser_compatible",
    ]:
        result[key] = bool_from_any(result.get(key))
    confidence = str(result.get("confidence") or "LOW").upper()
    result["confidence"] = confidence if confidence in CONFIDENCE_VALUES else "LOW"
    result["reasons"] = result.get("reasons") if isinstance(result.get("reasons"), list) else []
    result["warnings"] = result.get("warnings") if isinstance(result.get("warnings"), list) else []
    result["benchmark"] = result.get("benchmark")
    result["currency"] = result.get("currency")
    return result


def parse_date_for_score(value: Any) -> datetime | None:
    if not value:
        return None
    parsed = parse_date_candidate(str(value))
    if not parsed:
        return None
    try:
        return datetime.fromisoformat(parsed)
    except ValueError:
        return None


def score_and_recommend(result: dict[str, Any], extraction_ok: bool) -> tuple[int, str, list[str], list[str]]:
    score = 0
    reasons = list(result.get("reasons") or [])
    warnings = list(result.get("warnings") or [])

    if result.get("has_asset_allocation"):
        score += 3
        reasons.append("asset_allocation_detected")
    if result.get("has_credit_quality") or result.get("has_duration") or result.get("has_yield"):
        score += 3
        reasons.append("fixed_income_metrics_detected")
    if result.get("has_sectors") or result.get("has_regions") or result.get("has_top_holdings"):
        score += 2
        reasons.append("portfolio_breakdowns_detected")
    if result.get("has_costs"):
        score += 2
        reasons.append("non_manual_costs_visible")
    if result.get("has_ratings") or result.get("morningstar_category"):
        score += 2
        reasons.append("rating_or_category_detected")
    document_date = parse_date_for_score(result.get("document_date"))
    if document_date and document_date >= datetime(2025, 1, 1):
        score += 2
        reasons.append("recent_document_date")
    elif document_date and document_date < datetime(2024, 1, 1):
        score -= 3
        warnings.append("document_appears_old")
    if result.get("detected_isin") and (result.get("detected_fund_name") or result.get("document_date")):
        score += 1
        reasons.append("basic_identity_detected")
    if not result.get("detected_isin"):
        score -= 3
        warnings.append("MISSING_ISIN")
    if not extraction_ok:
        score -= 3
        warnings.append("TEXT_EXTRACTION_FAILED")
    if result.get("document_type") not in {"MORNINGSTAR_FACTSHEET", "MANAGER_FACTSHEET"}:
        warnings.append("document_type_not_standard_morningstar_factsheet")
    if not result.get("appears_morningstar_standard_pdf"):
        warnings.append("not_confirmed_morningstar_standard_pdf")
    if not result.get("likely_parser_compatible"):
        warnings.append("parser_compatibility_not_confirmed")

    severe = any(
        str(w).upper() in {"MISSING_ISIN", "TEXT_EXTRACTION_FAILED", "JSON_PARSE_ERROR"}
        or "MODEL_ERROR" in str(w).upper()
        for w in warnings
    )
    confidence = result.get("confidence")
    if score >= 7 and confidence in {"HIGH", "MEDIUM"} and not severe:
        recommendation = "HIGH_VALUE_REFRESH"
    elif 4 <= score <= 6 and not severe and confidence in {"HIGH", "MEDIUM"}:
        recommendation = "SAFE_REFRESH_LOW_RISK"
    elif score > 0:
        recommendation = "REVIEW_BEFORE_WRITE"
    else:
        recommendation = "DO_NOT_PARSE_NOW"

    return score, recommendation, sorted(set(map(str, reasons))), sorted(set(map(str, warnings)))


def process_pdf(path: Path, input_dir: Path, project_root: Path, args: argparse.Namespace) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []
    meta = file_stat(path, input_dir)
    text, extraction_method, extraction_warnings = extract_pdf_text(path, project_root, args.timeout)
    local_flags = local_feature_flags(text) if text else {}
    filename_isin = detect_isin("", path.name)
    text_isins = detect_all_isins(text, "")
    all_isins = detect_all_isins(text, path.name)
    isin = filename_isin or (text_isins[0] if text_isins else None)
    secondary_isins = [value for value in all_isins if value != isin]
    report_date, portfolio_date = detect_dates(text, path.name) if text else (parse_date_candidate(path.name), None)
    local = {
        "detected_isin": isin,
        "detected_fund_name": detect_name_from_filename(path.name, isin),
        "document_date": report_date,
        "portfolio_date": portfolio_date,
        "document_type": detect_document_type(text, path.name) if text else "UNKNOWN",
        "morningstar_category": detect_category(text) if text else None,
        "feature_flags": local_flags,
        "text_char_count": len(text),
        "text_extraction_method": extraction_method,
        "filename_isin": filename_isin,
        "text_isins_detected": text_isins,
        "secondary_isins_detected": secondary_isins,
        "potential_filename_text_mismatch": bool(filename_isin and text_isins and filename_isin not in text_isins),
    }
    extraction_ok = bool(text and len(text) >= 80)

    base_result: dict[str, Any] = {
        **meta,
        "text_extraction_method": extraction_method,
        "text_char_count": len(text),
        "local_detection": local,
        "filename_isin": filename_isin,
        "text_isins_detected": text_isins,
        "secondary_isins_detected": secondary_isins,
        "potential_filename_text_mismatch": local["potential_filename_text_mismatch"],
    }

    if args.dry_run:
        raw_result = {
            "file_path": meta["path"],
            "filename": meta["filename"],
            "detected_isin": isin,
            "detected_fund_name": local["detected_fund_name"],
            "document_date": report_date,
            "portfolio_date": portfolio_date,
            "document_type": local["document_type"],
            "morningstar_category": local["morningstar_category"],
            "confidence": "LOW",
            "appears_morningstar_standard_pdf": local["document_type"] == "MORNINGSTAR_FACTSHEET",
            "likely_parser_compatible": False,
            **local_flags,
            "reasons": ["dry_run_local_only"],
            "warnings": ["DRY_RUN_NO_OLLAMA_CALL", *extraction_warnings],
        }
    elif extraction_ok:
        prompt = build_prompt(meta, local, compact_for_prompt(text, args.max_chars))
        try:
            response = ollama_json(
                "/api/generate",
                {
                    "model": args.model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0},
                },
                args.timeout,
            )
            raw_text = str(response.get("response", "")).strip()
            raw_result = extract_first_json_object(raw_text)
            base_result["ollama_response_chars"] = len(raw_text)
        except Exception as exc:
            errors.append({"file": path.name, "error": f"MODEL_OR_JSON_ERROR:{exc}"})
            raw_result = {
                "file_path": meta["path"],
                "filename": meta["filename"],
                "detected_isin": isin,
                "detected_fund_name": local["detected_fund_name"],
                "document_date": report_date,
                "portfolio_date": portfolio_date,
                "document_type": local["document_type"],
                "morningstar_category": local["morningstar_category"],
                "confidence": "LOW",
                "appears_morningstar_standard_pdf": local["document_type"] == "MORNINGSTAR_FACTSHEET",
                "likely_parser_compatible": False,
                **local_flags,
                "reasons": ["local_fallback_after_model_error"],
                "warnings": [f"MODEL_ERROR:{exc}", *extraction_warnings],
            }
    else:
        errors.append({"file": path.name, "error": "TEXT_EXTRACTION_FAILED"})
        raw_result = {
            "file_path": meta["path"],
            "filename": meta["filename"],
            "detected_isin": isin,
            "detected_fund_name": local["detected_fund_name"],
            "document_date": report_date,
            "portfolio_date": portfolio_date,
            "document_type": local["document_type"],
            "morningstar_category": local["morningstar_category"],
            "confidence": "LOW",
            "appears_morningstar_standard_pdf": False,
            "likely_parser_compatible": False,
            **local_flags,
            "reasons": ["local_fallback_text_unreadable"],
            "warnings": extraction_warnings,
        }

    result = normalize_model_result(raw_result, meta, local)
    score, recommendation, reasons, warnings = score_and_recommend(result, extraction_ok)
    result["score"] = score
    result["recommendation"] = recommendation
    result["reasons"] = reasons
    result["warnings"] = warnings
    result.update(base_result)
    return result, errors


def build_parser_audit() -> dict[str, Any]:
    return {
        "parser_path": "MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js",
        "default_model": "gemini-2.5-flash",
        "dry_run_default": True,
        "writes_require_explicit_flags": True,
        "manual_fields_protected": True,
        "retrocession_fields_extracted": False,
        "economic_exposure_generated_by_parser": False,
        "fi_credit_generated_when_fixed_income_data_available": True,
        "moves_pdfs_by_default": True,
        "recommended_safe_command": (
            "node MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js "
            "--dir MORNINGSTAR_PDF_PARSER/ENTRADA --dry-run --no-move-files "
            "--model gemini-2.5-flash"
        ),
        "fields_ms": [
            "report_date",
            "category_morningstar",
            "rating_stars",
            "medalist_rating",
            "sustainability_rating",
            "portfolio.as_of",
            "portfolio.asset_allocation",
            "sectors",
            "regions.macro",
            "regions.detail",
            "equity_style",
            "fixed_income",
            "holdings_top10",
            "holdings_stats",
            "costs.management_fee",
            "objective",
        ],
        "fields_derived": [
            "asset_class",
            "asset_subtype",
            "primary_region",
            "subcategories",
            "top_sector",
            "is_sector_fund",
            "is_thematic",
            "is_index_like",
            "confidence",
            "portfolio_exposure",
            "style_bias",
        ],
        "fields_sensitive_or_prohibited": [
            "manual",
            "manual.*",
            "manual.costs",
            "manual.costs.retrocession",
            "retrocesiones",
            "entry_fee",
            "exit_fee",
        ],
    }


def summarize(artifact: dict[str, Any]) -> None:
    pdfs = artifact["pdfs"]
    summary = artifact["summary"]
    summary["pdfs_processed"] = len(pdfs)
    summary["unique_isins_detected"] = len({item.get("detected_isin") for item in pdfs if item.get("detected_isin")})
    summary["high_value_refresh"] = sum(1 for item in pdfs if item.get("recommendation") == "HIGH_VALUE_REFRESH")
    summary["safe_refresh_low_risk"] = sum(1 for item in pdfs if item.get("recommendation") == "SAFE_REFRESH_LOW_RISK")
    summary["review_before_write"] = sum(1 for item in pdfs if item.get("recommendation") == "REVIEW_BEFORE_WRITE")
    summary["do_not_parse_now"] = sum(1 for item in pdfs if item.get("recommendation") == "DO_NOT_PARSE_NOW")
    summary["errors_count"] = len(artifact["errors"])


def add_full_audit_aggregates(artifact: dict[str, Any]) -> None:
    pdfs = artifact["pdfs"]
    by_isin: dict[str, list[dict[str, Any]]] = {}
    for item in pdfs:
        isin = item.get("detected_isin")
        if isin:
            by_isin.setdefault(isin, []).append(item)

    artifact["duplicate_isins"] = [
        {
            "isin": isin,
            "count": len(items),
            "filenames": [item.get("filename") for item in items],
            "recommendations": [item.get("recommendation") for item in items],
        }
        for isin, items in sorted(by_isin.items())
        if len(items) > 1
    ]
    artifact["missing_isins"] = [
        {
            "filename": item.get("filename"),
            "recommendation": item.get("recommendation"),
            "score": item.get("score"),
            "warnings": item.get("warnings", []),
        }
        for item in pdfs
        if not item.get("detected_isin")
    ]
    artifact["potential_filename_text_mismatches"] = [
        {
            "filename": item.get("filename"),
            "filename_isin": item.get("filename_isin"),
            "detected_isin": item.get("detected_isin"),
            "text_isins_detected": item.get("text_isins_detected", []),
            "secondary_isins_detected": item.get("secondary_isins_detected", []),
            "recommendation": item.get("recommendation"),
        }
        for item in pdfs
        if item.get("potential_filename_text_mismatch")
    ]
    artifact["recommended_next_batch_for_gemini_flash"] = [
        {
            "filename": item.get("filename"),
            "detected_isin": item.get("detected_isin"),
            "score": item.get("score"),
            "recommendation": item.get("recommendation"),
            "confidence": item.get("confidence"),
        }
        for item in sorted(pdfs, key=lambda x: (x.get("score") or -999), reverse=True)
        if item.get("recommendation") in {"HIGH_VALUE_REFRESH", "SAFE_REFRESH_LOW_RISK"}
    ]


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local Morningstar PDF pre-audit with Ollama/Gemma4.")
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--text-only", action="store_true", help="Force text-only mode. Vision is not used by default.")
    parser.add_argument("--dry-run", action="store_true", help="Skip Ollama calls and use local heuristics only.")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument("--max-chars", type=int, default=DEFAULT_MAX_CHARS)
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    project_root = Path.cwd().resolve()
    input_dir = Path(args.input_dir).resolve()
    output_json = Path(args.output_json).resolve()
    output_json.parent.mkdir(parents=True, exist_ok=True)

    if "BDB-FONDOS-CORE" in str(project_root).upper():
        raise SystemExit("Refusing to run in BDB-FONDOS-CORE.")

    pdf_paths = inventory_pdfs(input_dir)
    selected = pdf_paths[: args.limit] if args.limit and args.limit > 0 else pdf_paths

    artifact: dict[str, Any] = {
        "summary": {
            "task": TASK_ID,
            "generated_at": utc_now_iso(),
            "project_root": str(project_root),
            "input_dir": str(input_dir),
            "model_used": args.model,
            "external_api_calls": 0,
            "gemini_api_calls": 0,
            "firestore_writes": 0,
            "pdfs_inventoried": len(pdf_paths),
            "pdfs_processed": 0,
            "unique_isins_detected": 0,
            "high_value_refresh": 0,
            "safe_refresh_low_risk": 0,
            "review_before_write": 0,
            "do_not_parse_now": 0,
            "errors_count": 0,
            "pdfs_moved": 0,
            "dry_run": bool(args.dry_run),
            "text_only": bool(args.text_only),
            "max_chars": args.max_chars,
        },
        "parser_audit": build_parser_audit(),
        "ollama": {
            "base_url": OLLAMA_BASE_URL,
            "cli_available_in_path": False,
            "service_detected": False,
            "version": None,
            "models_detected": [],
            "model_test_ok": False,
        },
        "pdfs": [],
        "recommendations": [],
        "duplicate_isins": [],
        "missing_isins": [],
        "potential_filename_text_mismatches": [],
        "recommended_next_batch_for_gemini_flash": [],
        "errors": [],
    }

    if not args.dry_run:
        ok, tags, error = validate_ollama_model(args.model, args.timeout)
        artifact["ollama"]["service_detected"] = bool(tags)
        artifact["ollama"]["models_detected"] = [item.get("name") for item in tags.get("models", [])]
        artifact["ollama"]["model_test_ok"] = ok
        try:
            artifact["ollama"]["version"] = ollama_get("/api/version", args.timeout).get("version")
        except Exception as exc:
            artifact["errors"].append({"error": f"OLLAMA_VERSION_ERROR:{exc}"})
        if not ok:
            artifact["errors"].append({"error": error or "OLLAMA_MODEL_TEST_FAILED"})
            add_full_audit_aggregates(artifact)
            summarize(artifact)
            output_json.write_text(json.dumps(artifact, indent=2, ensure_ascii=False), encoding="utf-8")
            return 2

    for path in selected:
        pdf_result, errors = process_pdf(path, input_dir, project_root, args)
        artifact["pdfs"].append(pdf_result)
        artifact["errors"].extend(errors)
        artifact["recommendations"].append(
            {
                "filename": pdf_result.get("filename"),
                "detected_isin": pdf_result.get("detected_isin"),
                "recommendation": pdf_result.get("recommendation"),
                "score": pdf_result.get("score"),
                "confidence": pdf_result.get("confidence"),
                "warnings": pdf_result.get("warnings", []),
            }
        )

    add_full_audit_aggregates(artifact)
    summarize(artifact)
    with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8", dir=str(output_json.parent), suffix=".tmp") as tmp:
        json.dump(artifact, tmp, indent=2, ensure_ascii=False)
        tmp.write("\n")
        tmp_path = Path(tmp.name)
    tmp_path.replace(output_json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

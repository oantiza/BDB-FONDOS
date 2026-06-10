"""DECISION 2026-06-09 (post-auditoria, H2) — pool de candidatos de auto-expand
por perfil, con margen para una base de ~700 fondos.

Principios adoptados:
1. COHERENTE: la elegibilidad del perfil (is_fund_eligible_for_profile) es el
   UNICO gate duro — el mismo filtro de Nivel 2 que aplica el motor (FIX H2).
2. NO BLOQUEANTE: la afinidad de tramo es solo PREFERENCIA (orden), nunca
   exclusion. Si el tramo preferente no llena el pool minimo, se rellena con
   cualquier fondo elegible por Sharpe.
3. CON MARGEN: umbrales relajados (p.ej. RV>=80 preferente en 8-10 en vez del
   eq>=90 anterior; mixtos 25-65% en 3-4) y pool amplio (max 12 candidatos
   sobre una consulta top-150 por Sharpe; el motor usa hasta 6).

Modulo PURO (sin firebase): el endpoint le pasa filas (isin, doc_dict).
"""
import logging

from services.portfolio.suitability_engine import is_fund_eligible_for_profile
from services.portfolio.utils import (
    _to_float,
    asset_type_to_bucket_label,
    extract_v2_identity,
    get_v2_asset_mix,
    summarize_v2_quality,
)

logger = logging.getLogger(__name__)

MAX_CANDIDATES_DEFAULT = 12
MIN_POOL_DEFAULT = 6


def _meta_payload(doc_dict):
    return {
        "classification_v2": (doc_dict or {}).get("classification_v2", {}) or {},
        "portfolio_exposure_v2": (doc_dict or {}).get("portfolio_exposure_v2", {}) or {},
    }


def _equity_pct(meta_payload, doc_dict):
    mix = get_v2_asset_mix(meta_payload, as_percent=True)
    if mix:
        return _to_float(mix.get("equity"), 0.0)
    return _to_float(((doc_dict or {}).get("metrics", {}) or {}).get("equity"), 0.0)


def _sharpe(doc_dict):
    perf = (doc_dict or {}).get("std_perf", {}) or {}
    return _to_float(perf.get("sharpe"), 0.0)


def _history_ok(doc_dict):
    dq = (doc_dict or {}).get("data_quality", {}) or {}
    return dq.get("history_ok") is not False and dq.get("has_history") is not False


def _tier_fit(risk_level, asset_type, equity_pct):
    """Afinidad de tramo (solo preferencia de orden, nunca gate)."""
    if risk_level is None:
        return 0.0
    if risk_level <= 2:
        if asset_type == "money_market":
            return 30.0
        if asset_type == "fixed_income":
            return 20.0
        return 0.0
    if risk_level <= 4:
        # Mixtos con RV media: la via apta de aportar equity en 3-4 (margen 25-65).
        if asset_type == "allocation" and 25.0 <= equity_pct <= 65.0:
            return 30.0
        if asset_type == "fixed_income":
            return 10.0
        return 0.0
    if risk_level <= 7:
        if asset_type == "equity" and equity_pct >= 45.0:
            return 20.0
        if asset_type == "allocation":
            return 10.0
        return 0.0
    # 8-10: cuanta mas RV mejor; >=80 ya es fuerte (margen sobre el eq>=90 previo).
    bonus = 25.0 if equity_pct >= 80.0 else 0.0
    return bonus + equity_pct / 10.0


def candidate_payload(doc_dict):
    meta_payload = _meta_payload(doc_dict)
    identity = extract_v2_identity(meta_payload)
    return {
        "metrics": (doc_dict or {}).get("metrics", {}) or {},
        "asset_class": asset_type_to_bucket_label(identity.get("asset_type")) or "UNKNOWN",
        "classification_v2": meta_payload["classification_v2"],
        "portfolio_exposure_v2": meta_payload["portfolio_exposure_v2"],
        "v2_identity": identity,
        "v2_exposure": get_v2_asset_mix(meta_payload, as_percent=True),
        "v2_quality": summarize_v2_quality(meta_payload),
    }


def select_candidate_pool(
    fund_rows,
    risk_level=None,
    max_candidates=MAX_CANDIDATES_DEFAULT,
    min_pool=MIN_POOL_DEFAULT,
):
    """Devuelve {isin: candidate_payload} ordenable para auto-expand.

    - risk_level None (legado/sin perfil): conserva el criterio historico
      equity>=90 sin filtro de idoneidad (el motor decide).
    - Con risk_level: gate duro de elegibilidad + preferencia de tramo +
      relleno hasta min_pool con cualquier elegible (no restrictivo).
    """
    scored = []
    for isin, doc_dict in fund_rows or []:
        if not isin or not isinstance(doc_dict, dict):
            continue
        if not _history_ok(doc_dict):
            continue
        meta_payload = _meta_payload(doc_dict)
        identity = extract_v2_identity(meta_payload)
        eq_pct = _equity_pct(meta_payload, doc_dict)

        if risk_level is None:
            if eq_pct >= 90.0:
                scored.append((0.0, _sharpe(doc_dict), isin, doc_dict))
            continue

        eligible, _reason = is_fund_eligible_for_profile(meta_payload, int(risk_level))
        if not eligible:
            continue
        fit = _tier_fit(int(risk_level), identity.get("asset_type"), eq_pct)
        scored.append((fit, _sharpe(doc_dict), isin, doc_dict))

    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)

    pool = {}
    # 1) Preferentes de tramo
    for fit, _sh, isin, doc_dict in scored:
        if len(pool) >= max_candidates:
            break
        if fit > 0 or risk_level is None:
            pool[isin] = candidate_payload(doc_dict)
    # 2) Relleno con elegibles sin afinidad (margen: nunca quedarse corto
    #    teniendo fondos aptos disponibles)
    if risk_level is not None and len(pool) < min_pool:
        for fit, _sh, isin, doc_dict in scored:
            if len(pool) >= max_candidates:
                break
            if isin not in pool:
                pool[isin] = candidate_payload(doc_dict)

    if risk_level is not None:
        logger.info(
            "[AutoExpandPool] perfil %s: %d candidatos (de %d elegibles evaluados).",
            risk_level, len(pool), len(scored),
        )
    return pool

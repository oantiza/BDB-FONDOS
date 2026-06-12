"""REM-5A — Feature flag `unified_constraints` y lectura dual de perfiles de riesgo.

Diseño (debe ser NEUTRO con el flag OFF):
- Flag OFF (por defecto)  -> se lee SIEMPRE el doc canónico `risk_profiles`
  (comportamiento idéntico al actual).
- Flag ON                 -> se intenta `risk_profiles_staging`; si no existe, cae al canónico.
- Fuente única coordinada FE/BE: Firestore `system_settings/feature_flags.unified_constraints`.
- Override por entorno: la variable UNIFIED_CONSTRAINTS (1/true/yes/on) tiene PRIORIDAD
  (útil para tests y para rollout server-side sin tocar Firestore).

Módulo deliberadamente LIGERO (solo os/logging) para ser testeable sin el stack pesado
(numpy/pandas/pypfopt/firebase).
"""
import logging
import os

logger = logging.getLogger(__name__)

SETTINGS_COLLECTION = "system_settings"
FEATURE_FLAGS_DOC = "feature_flags"
RISK_PROFILES_DOC = "risk_profiles"
RISK_PROFILES_STAGING_DOC = "risk_profiles_staging"

_TRUTHY = {"1", "true", "yes", "on"}

# FIX H7 (auditoria 2026-06-09): last-known-good por proceso. Antes, CUALQUIER
# fallo de lectura devolvia False ("flag OFF"), pero con el flag activado en
# produccion OFF ya no es neutro: revierte la peticion a la ruta legacy (otra
# semantica de buckets y precheck degradado). Con cache, un fallo transitorio
# conserva la ultima lectura valida del proceso; sin lectura previa, OFF.
_LAST_KNOWN_FLAG = None


def reset_unified_constraints_cache():
    """Solo para tests: limpia el last-known-good del proceso."""
    global _LAST_KNOWN_FLAG
    _LAST_KNOWN_FLAG = None


def _env_override():
    """Devuelve True/False si UNIFIED_CONSTRAINTS está definida; None si no lo está."""
    raw = os.environ.get("UNIFIED_CONSTRAINTS")
    if raw is None:
        return None
    return raw.strip().lower() in _TRUTHY


def unified_constraints_enabled(db) -> bool:
    """Flag (default OFF). El env var UNIFIED_CONSTRAINTS tiene prioridad; si no, Firestore."""
    env = _env_override()
    if env is not None:
        return env
    global _LAST_KNOWN_FLAG
    try:
        snap = db.collection(SETTINGS_COLLECTION).document(FEATURE_FLAGS_DOC).get()
        if getattr(snap, "exists", False):
            value = bool((snap.to_dict() or {}).get("unified_constraints", False))
            _LAST_KNOWN_FLAG = value
            return value
        _LAST_KNOWN_FLAG = False
        return False
    except Exception as e:  # noqa: BLE001
        if _LAST_KNOWN_FLAG is not None:
            logger.warning(
                "[feature_flags] Fallo de lectura (%s). Usando last-known-good=%s.",
                e, _LAST_KNOWN_FLAG,
            )
            return _LAST_KNOWN_FLAG
        logger.info("[feature_flags] No se pudo leer feature_flags (%s) y sin cache. Flag OFF.", e)
    return False


def resolve_risk_profiles_doc(db):
    """Devuelve (snapshot, source_doc_id) según el flag.

    Flag OFF -> canónico SIEMPRE. Flag ON -> staging si existe; si no, canónico.
    """
    if unified_constraints_enabled(db):
        try:
            staging = db.collection(SETTINGS_COLLECTION).document(RISK_PROFILES_STAGING_DOC).get()
            if getattr(staging, "exists", False):
                return staging, RISK_PROFILES_STAGING_DOC
        except Exception as e:  # noqa: BLE001
            logger.info("[feature_flags] staging no disponible (%s). Uso canónico.", e)
    return (
        db.collection(SETTINGS_COLLECTION).document(RISK_PROFILES_DOC).get(),
        RISK_PROFILES_DOC,
    )

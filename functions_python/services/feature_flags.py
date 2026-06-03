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
    try:
        snap = db.collection(SETTINGS_COLLECTION).document(FEATURE_FLAGS_DOC).get()
        if getattr(snap, "exists", False):
            return bool((snap.to_dict() or {}).get("unified_constraints", False))
    except Exception as e:  # noqa: BLE001 - cualquier fallo de lectura => flag OFF (seguro)
        logger.info("[feature_flags] No se pudo leer feature_flags (%s). Flag OFF.", e)
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

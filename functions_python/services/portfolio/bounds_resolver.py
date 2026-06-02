"""REM-2 — Resolutor ÚNICO de cotas (fusión narrowing-only) + mapeo bucket->vector.

Cierra A5: los overrides de petición SOLO pueden ESTRECHAR la banda canónica del
perfil. Un intento de AMPLIAR no se aplica y se registra en `ignored_overrides`
(nunca clamp silencioso). Una contradicción (min > max) lanza ConstraintError.

Diseño:
- base  = banda canónica del perfil (Firestore/seed).
- overrides = capa de ESTRECHAMIENTO (cliente/admin de petición).
- eff_min = max(profile_min, override_min)   (subir el suelo = estrechar)
- eff_max = min(profile_max, override_max)   (bajar el techo = estrechar)

Módulo LIGERO (no importa numpy/pypfopt/firebase) -> testeable sin el stack pesado.
build_bucket_vectors opera sobre arrays ya construidos por el caller.
"""
import logging

logger = logging.getLogger(__name__)

# Vocabulario canónico (D3: alternative+real_asset -> Alternativos; D1a: Mixto via look-through).
CANONICAL_BUCKETS = ("RV", "RF", "Monetario", "Alternativos", "Otros")

V1_TO_CANONICAL_BUCKET = {
    "equity": "RV",
    "bond": "RF",
    "cash": "Monetario",
    "alternative": "Alternativos",
    "real_asset": "Alternativos",
    "other": "Otros",
}


class ConstraintError(ValueError):
    """Contradicción irreconciliable entre perfil y override (min > max)."""


def _coerce_bound(raw):
    """(min, max) con None donde no haya cota; sanitiza porcentajes (>1 -> /100) a 0..1."""
    def s(v):
        if v is None:
            return None
        try:
            v = float(v)
        except Exception:
            return None
        if v > 1.0:
            v = v / 100.0
        return max(0.0, min(1.0, v))

    if isinstance(raw, (list, tuple)) and len(raw) >= 2:
        return s(raw[0]), s(raw[1])
    if isinstance(raw, dict):
        return s(raw.get("min")), s(raw.get("max"))
    return None, None


def resolve_effective_bounds(profile_bounds, overrides=None):
    """Fusiona overrides (estrechamiento) sobre la banda canónica del perfil.

    Devuelve (effective: {bucket: {"min": x|None, "max": y|None}}, ignored_overrides: list).
    """
    profile_bounds = profile_bounds or {}
    overrides = overrides or {}
    effective = {}
    ignored = []

    for bucket in set(profile_bounds) | set(overrides):
        p_min, p_max = _coerce_bound(profile_bounds.get(bucket))
        o_min, o_max = _coerce_bound(overrides.get(bucket))

        # min: estrechar = SUBIR el suelo. Bajarlo (ampliar) se ignora y se reporta.
        if o_min is not None and p_min is not None and o_min < p_min - 1e-9:
            ignored.append({"bucket": bucket, "field": "min", "requested": o_min,
                            "applied": p_min, "reason": "widening_not_allowed"})
            eff_min = p_min
        else:
            cands = [x for x in (p_min, o_min) if x is not None]
            eff_min = max(cands) if cands else None

        # max: estrechar = BAJAR el techo. Subirlo (ampliar) se ignora y se reporta.
        if o_max is not None and p_max is not None and o_max > p_max + 1e-9:
            ignored.append({"bucket": bucket, "field": "max", "requested": o_max,
                            "applied": p_max, "reason": "widening_not_allowed"})
            eff_max = p_max
        else:
            cands = [x for x in (p_max, o_max) if x is not None]
            eff_max = min(cands) if cands else None

        if eff_min is not None and eff_max is not None and eff_min > eff_max + 1e-9:
            raise ConstraintError(
                f"Bucket '{bucket}': min efectivo {eff_min:.4f} > max efectivo {eff_max:.4f} "
                "(contradicción perfil/override; no se relaja)."
            )
        effective[bucket] = {"min": eff_min, "max": eff_max}

    return effective, ignored


def canonicalize_bucket_bounds_v1(bucket_bounds_v1):
    """Convierte bucket_bounds_v1 al vocabulario canonico.

    alternative y real_asset se fusionan como Alternativos usando narrowing
    restrictivo: mayor min y menor max. Asi no se descarta ninguna entrada V1.
    """
    if not isinstance(bucket_bounds_v1, dict):
        return {}

    overrides = {}
    alternative_parts = []

    for v1_key, canonical_bucket in V1_TO_CANONICAL_BUCKET.items():
        raw_bound = bucket_bounds_v1.get(v1_key)
        if raw_bound is None:
            continue

        min_v, max_v = _coerce_bound(raw_bound)
        if min_v is None and max_v is None:
            continue

        if canonical_bucket == "Alternativos":
            alternative_parts.append((v1_key, min_v, max_v))
            continue

        overrides[canonical_bucket] = {"min": min_v, "max": max_v}

    if alternative_parts:
        min_candidates = [min_v for _key, min_v, _max_v in alternative_parts if min_v is not None]
        max_candidates = [max_v for _key, _min_v, max_v in alternative_parts if max_v is not None]
        merged = {
            "min": max(min_candidates) if min_candidates else None,
            "max": min(max_candidates) if max_candidates else None,
        }
        if (
            merged["min"] is not None
            and merged["max"] is not None
            and merged["min"] > merged["max"] + 1e-9
        ):
            sources = ", ".join(key for key, _min_v, _max_v in alternative_parts)
            raise ConstraintError(
                f"Bucket 'Alternativos': override V1 contradictorio ({sources}); "
                f"min {merged['min']:.4f} > max {merged['max']:.4f}."
            )
        overrides["Alternativos"] = merged

    return overrides


def build_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v):
    """Mapeo ÚNICO bucket canónico -> vector de exposición (look-through).

    D3: Alternativos = alternative + real_asset. D1a: sin clave 'Mixto' (los mixtos
    se descomponen por look-through en eq/bd/cs). Esta es la única definición del
    mapeo; la inyección, la validación y el post-proceso deben usar esta función.
    """
    return {
        "RV": eq_v,
        "RF": bd_v,
        "Monetario": cs_v,
        "Alternativos": al_v + ra_v,
        "Otros": ot_v,
    }

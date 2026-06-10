"""FIX H6 (auditoria 2026-06-09) — comparador READ-ONLY seed vs canonico vivo.

La auditoria verifico que las seeds locales (services/config.py
RISK_BUCKETS_LABELS y su espejo frontend rulesEngine.ts) divergen del documento
canonico system_settings/risk_profiles (P8/P9/P10 con bandas materialmente
distintas). Las seeds solo actuan como fallback, pero cuando el fallback se
activa aplica EN SILENCIO una politica distinta.

Uso (requiere credenciales: ADC o GOOGLE_APPLICATION_CREDENTIALS):

    python scripts/audit/check_risk_profiles_seed_drift.py

Exit code 0 = sin drift; 1 = drift detectado (apto para CI/cron); 2 = error de
lectura. No escribe nada.
"""
import sys


def _norm_bound(raw):
    """Normaliza [min, max] / {min, max} a tupla de floats redondeados."""
    if isinstance(raw, (list, tuple)) and len(raw) >= 2:
        lo, hi = raw[0], raw[1]
    elif isinstance(raw, dict):
        lo, hi = raw.get("min"), raw.get("max")
    else:
        return None
    try:
        return (round(float(lo), 6), round(float(hi), 6))
    except (TypeError, ValueError):
        return None


def compare_profiles(seed: dict, live: dict) -> list:
    """Devuelve la lista de divergencias entre seed y canonico vivo.

    Compara por perfil (1-10) y por bucket. Reporta tambien buckets presentes
    solo en un lado (p.ej. 'Mixto' residual en el canonico).
    """
    drifts = []
    profile_keys = sorted(
        {str(k) for k in seed} | {str(k) for k in live},
        key=lambda x: int(x) if x.isdigit() else 99,
    )
    for pk in profile_keys:
        seed_p = seed.get(int(pk)) if int(pk) in seed else seed.get(pk, {})
        live_p = live.get(pk) if pk in live else live.get(int(pk), {})
        seed_p = seed_p or {}
        live_p = live_p or {}
        for bucket in sorted(set(seed_p) | set(live_p)):
            s_b = _norm_bound(seed_p.get(bucket))
            l_b = _norm_bound(live_p.get(bucket))
            if s_b != l_b:
                drifts.append({
                    "profile": pk,
                    "bucket": bucket,
                    "seed": s_b,
                    "live": l_b,
                })
    return drifts


def main() -> int:
    import firebase_admin
    from firebase_admin import firestore

    sys.path.insert(0, ".")
    from services.config import RISK_BUCKETS_LABELS

    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        db = firestore.client()
        snap = db.collection("system_settings").document("risk_profiles").get()
        if not snap.exists:
            print("ERROR: system_settings/risk_profiles no existe.")
            return 2
        live = snap.to_dict() or {}
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR de lectura: {exc}")
        return 2

    drifts = compare_profiles(RISK_BUCKETS_LABELS, live)
    if not drifts:
        print("OK: seeds locales == canonico vivo (sin drift).")
        return 0

    print(f"DRIFT: {len(drifts)} divergencia(s) seed vs canonico:")
    for d in drifts:
        print(f"  P{d['profile']} {d['bucket']}: seed={d['seed']} live={d['live']}")
    print(
        "\nAccion: regenerar RISK_BUCKETS_LABELS (config.py) y RISK_PROFILES "
        "(rulesEngine.ts) desde el canonico, o documentar la divergencia."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())

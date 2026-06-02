"""REM-1 — Monitor de deriva de DATOS de `compatible_profiles` (read-only).

Compara el `classification_v2.compatible_profiles` CACHEADO en Firestore (funds_v3)
contra el recálculo EN VIVO con el motor canónico. Detecta cuándo el cache quedó
obsoleto (p. ej. exposición actualizada sin re-migrar).

USO: tarea PROGRAMADA (no CI; CI usa el golden sin Firestore). Si hay deriva, ejecutar
la migración con su gate (scripts/maintenance/migrate_suitability_v2.py: dry-run ->
manifest -> aprobación). Este script NO escribe nada.

Salida: lista de fondos con deriva + código de salida 1 si hay deriva (para alertar).
"""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.dirname(os.path.dirname(_HERE)))  # functions_python en sys.path

import firebase_admin
from firebase_admin import firestore
from services.portfolio.suitability_engine import compute_compatible_profiles


def check_drift(limit=None):
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()

    drifted, checked = [], 0
    for doc in db.collection("funds_v3").stream():
        data = doc.to_dict() or {}
        class_v2 = data.get("classification_v2")
        if not class_v2:
            continue
        checked += 1
        cached = list(class_v2.get("compatible_profiles") or [])
        live = compute_compatible_profiles(data)
        if cached != live:
            drifted.append({"isin": doc.id, "cached": cached, "live": live})
        if limit and checked >= limit:
            break

    print(f"Fondos revisados: {checked} | con deriva: {len(drifted)}")
    for d in drifted[:50]:
        print(f"  DRIFT {d['isin']}: cache={d['cached']} != vivo={d['live']}")
    if drifted:
        print("\nACCIÓN: regenerar con el gate (migrate_suitability_v2: dry-run -> manifest -> aprobación).")
    return drifted


if __name__ == "__main__":
    sys.exit(1 if check_drift() else 0)

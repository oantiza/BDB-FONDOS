"""DECISION 2026-06-09 (post-auditoria, H8) — bandas de volatilidad explicitas
para los perfiles 8-10, como RAILES DE CORDURA anchos (no corredores de target).

Politica adoptada (criterios: coherente, no bloqueante, con margen):
- Enforcement: SOFT WARNING (el por defecto del motor); solo strict_feasibility
  las convierte en check duro. No bloquean operaciones normales.
- Railes anchos: el riesgo de 8-10 lo gobiernan las bandas de asset allocation
  (RV min 85/90/95); la banda de vol solo debe avisar ante anomalias reales
  (fondos mal clasificados, datos planos/sinteticos) o riesgo extremo.
- Se escriben en el campo PARALELO 'vol_bands' del doc canonico (no dentro del
  mapa de buckets de cada perfil). REQUIERE el backend con los fixes H17-b
  (claves no numericas ignoradas) y merge_profile_vol_band DESPLEGADOS ANTES.

    P8 : target 0.15, banda [0.08, 0.28]
    P9 : target 0.16, banda [0.09, 0.30]
    P10: target 0.17, banda [0.10, 0.35]

Uso:
    DRY RUN (por defecto, read-only):
        python scripts/maintenance/set_aggressive_vol_bands.py
    ESCRITURA (gate explicito):
        BDB_WRITE_GATE_AUTHORIZATION="AUTORIZO WRITE GATE VOL_BANDS 8-10" \
            python scripts/maintenance/set_aggressive_vol_bands.py --execute

Recomendado: recalibrar los railes tras una pasada shadow/live sobre carteras
canonicas 8-10 (ajustar a ~0.7x / ~1.6x de la mediana realizada).
"""
import os
import sys

AUTH_TOKEN = "AUTORIZO WRITE GATE VOL_BANDS 8-10"

VOL_BANDS = {
    "8": {"min": 0.08, "max": 0.28, "target_vol": 0.15},
    "9": {"min": 0.09, "max": 0.30, "target_vol": 0.16},
    "10": {"min": 0.10, "max": 0.35, "target_vol": 0.17},
}


def main() -> int:
    import firebase_admin
    from firebase_admin import firestore

    execute = "--execute" in sys.argv
    if execute and os.environ.get("BDB_WRITE_GATE_AUTHORIZATION") != AUTH_TOKEN:
        print("BLOQUEADO: falta BDB_WRITE_GATE_AUTHORIZATION con el token exacto.")
        return 2

    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()
    ref = db.collection("system_settings").document("risk_profiles")
    snap = ref.get()
    if not snap.exists:
        print("ERROR: system_settings/risk_profiles no existe.")
        return 2
    current = (snap.to_dict() or {}).get("vol_bands", {})

    print("vol_bands actual:", current or "(ausente)")
    print("vol_bands propuesto:", VOL_BANDS)

    if not execute:
        print("\nDRY RUN: no se ha escrito nada. Use --execute con el gate para aplicar.")
        return 0

    ref.set({"vol_bands": VOL_BANDS}, merge=True)
    post = (ref.get().to_dict() or {}).get("vol_bands", {})
    print("\nESCRITO. vol_bands post-write:", post)
    print("Verifique que el backend desplegado incluye H17-b y merge_profile_vol_band.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

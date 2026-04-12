"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: fixes
PURPOSE: Corrige anomalías específicas detectadas en históricos corruptos de fondos.
SAFE_MODE: MUTATES_FIRESTORE
RUN: python functions_python/scripts/fixes/fix_anomalies.py
NOTES: Reemplaza el histórico del fondo usando mode="overwrite" en update_single_fund_history.
"""

import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore

# =========================================================
# Paths
# =========================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FUNCTIONS_PYTHON_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(FUNCTIONS_PYTHON_DIR, ".."))
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")

# Permite importar desde functions_python/*
if FUNCTIONS_PYTHON_DIR not in sys.path:
    sys.path.append(FUNCTIONS_PYTHON_DIR)


# =========================================================
# Firebase init
# =========================================================
def get_db():
    if not firebase_admin._apps:
        if not os.path.exists(KEY_PATH):
            raise FileNotFoundError(
                f"No se encontró serviceAccountKey.json en: {KEY_PATH}"
            )

        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
        print(f"[INIT] Firebase initialized with key: {KEY_PATH}")

    return firestore.client()


db = get_db()

from services.nav_fetcher import update_single_fund_history  # noqa: E402

# =========================================================
# Fondos a reparar
# =========================================================
ANOMALOUS_ISINS = [
    "LU0048293368",
    "LU0251853072",
    "LU1697013008",
    "LU1697017686",
    "LU1697018064",
    "LU1717592262",
    "LU1738492658",
    "LU1740985814",
    "LU1769941003",
]


# =========================================================
# Main fix
# =========================================================
def fix_anomalies():
    print("🛠️ Iniciando reparación de datos históricos corrompidos...")
    success_count = 0

    for isin in ANOMALOUS_ISINS:
        print(f"\n🔄 Purgando y re-descargando {isin}...")

        try:
            res = update_single_fund_history(db, isin, mode="overwrite")

            if isinstance(res, dict) and res.get("success"):
                points = len(res.get("history", []))
                print(f"✅ {isin} reparado con éxito. Puntos: {points}")
                success_count += 1
            else:
                error_msg = (
                    res.get("error") if isinstance(res, dict) else "respuesta inválida"
                )
                print(f"❌ Fallo al descargar {isin}: {error_msg}")

        except Exception as e:
            print(f"⚠️ Error procesando {isin}: {e}")

    print(
        f"\n🏁 Proceso terminado. {success_count}/{len(ANOMALOUS_ISINS)} fondos reparados."
    )
    print(
        "👉 Vuelve a ejecutar 'python functions_python/scripts/audit/analyze_history_anomalies.py' para verificar."
    )


if __name__ == "__main__":
    fix_anomalies()

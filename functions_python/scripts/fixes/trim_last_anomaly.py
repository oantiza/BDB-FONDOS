"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: fixes
PURPOSE: Recorta el último punto de datos si se detecta como anomalía.
SAFE_MODE: MUTATES_FIRESTORE
RUN: python -m scripts.fixes.trim_last_anomaly
"""

import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore, initialize_app

# AutenticaciÃ³n Local
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(KEY_PATH)
        initialize_app(cred)
except:
    pass

db = firestore.client()


def trim_fund():
    isin = "LU0251853072"
    cut_date = "2021-06-30"  # Un dÃ­a despuÃ©s del salto

    print(
        f"âï¸ Recortando histÃ³rico de {isin} para descartar datos previos al {cut_date}..."
    )

    doc_ref = db.collection("historico_vl_v2").document(isin)
    doc = doc_ref.get()

    if not doc.exists:
        print(f"â Documento de {isin} no encontrado.")
        return

    data = doc.to_dict()
    history = data.get("history", [])

    # Filtrar fechas invÃ¡lidas (previas al corte)
    clean_history = [item for item in history if item["date"] >= cut_date]

    # Guardar en BD
    doc_ref.update({"history": clean_history})
    print(
        f"â {isin} actualizado. Puntos antiguos: {len(history)} -> Puntos limpios: {len(clean_history)}"
    )


if __name__ == "__main__":
    trim_fund()

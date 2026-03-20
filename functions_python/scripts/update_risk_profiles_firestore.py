import os
import sys

# Agregar ruta para permitir importaciones relativas
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

import firebase_admin
from firebase_admin import credentials, firestore
from services.config import RISK_BUCKETS_LABELS

def get_firebase_app():
    if not firebase_admin._apps:
        # 1. Intentar buscar un archivo de clave de servicio local explícito
        for p in [
            "serviceAccountKey.json",
            "../serviceAccountKey.json",
            "functions_python/serviceAccountKey.json",
            os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'),
            os.path.join(os.path.dirname(__file__), '..', '..', 'serviceAccountKey.json')
        ]:
            if os.path.exists(p):
                print(f"Usando clave de servicio local encontrada en: {p}")
                cred = credentials.Certificate(p)
                return firebase_admin.initialize_app(cred)
        
        # 2. Fallbacks de Google Cloud CLI
        print("No se encontró serviceAccountKey.json, probando auth default CLI...")
        try:
            return firebase_admin.initialize_app()
        except ValueError:
            cred = credentials.ApplicationDefault()
            return firebase_admin.initialize_app(cred, {'projectId': 'bdb-fondos'})
    return firebase_admin.get_app()

def main():
    print("Iniciando reconstrucción de la matriz en Firestore...")
    app = get_firebase_app()
    db = firestore.client(app)

    # Convertir a JSON explícito e imperativo. Las claves del DB document se asumen strings de números "1".."10" 
    payload = {}
    for profile_id, buckets in RISK_BUCKETS_LABELS.items():
        payload[str(profile_id)] = {
            # Se convierte cada tupla (min, max) en lista [min, max]
            bucket_name: list(bounds) for bucket_name, bounds in buckets.items()
        }

    doc_ref = db.collection("system_settings").document("risk_profiles")
    
    # Sobrescribir exactamente el target
    doc_ref.set(payload)
    
    print("✅ Documento system_settings/risk_profiles sobrescrito con éxito.")
    print("🚀 El backend en Python e instancias operativas ahora usarán la nueva versión limpia (sin 'Mixto').")

if __name__ == "__main__":
    main()

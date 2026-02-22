import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore, initialize_app

# Autenticación Local
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
KEY_PATH = os.path.join(PROJECT_ROOT, 'serviceAccountKey.json')

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(KEY_PATH)
        initialize_app(cred)
except:
    pass

db = firestore.client()

from services.nav_fetcher import update_single_fund_history

anomalous_isins = [
    "ES0140643034",
    "ES0141991002",
    "ES0142167032",
    "ES0146309002",
    "ES0148181003",
    "ES0155142005",
    "LU0251853072",
    "LU1697016019"
]

def fix_anomalies():
    print("🛠️ Iniciando reparación de datos históricos corrompidos...")
    success_count = 0
    
    for isin in anomalous_isins:
        print(f"\n🔄 Purgando y re-descargando {isin}...")
        try:
            # Forzamos OVERWRITE para destruir el historial corrupto y pedirlo limpio al proveedor
            res = update_single_fund_history(db, isin, mode='overwrite')
            if res.get('success'):
                print(f"✅ {isin} reparado con éxito. Puntos: {len(res.get('history', []))}")
                success_count += 1
            else:
                print(f"❌ Fallo al descargar {isin}: {res.get('error')}")
        except Exception as e:
            print(f"⚠️ Error procesando {isin}: {e}")
            
    print(f"\n🏁 Proceso terminado. {success_count}/{len(anomalous_isins)} fondos reparados.")
    print("👉 Vuelve a ejecutar 'python scripts/analyze_history_anomalies.py' para verificar.")

if __name__ == '__main__':
    fix_anomalies()

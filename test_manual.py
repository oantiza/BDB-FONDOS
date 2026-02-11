import sys
import os

# --- CORRECCIÓN DE RUTAS ---
current_dir = os.path.dirname(os.path.abspath(__file__))
# Aseguramos que Python vea la carpeta actual como base
sys.path.insert(0, current_dir)

import asyncio
import aiohttp
from firebase_admin import credentials, firestore, initialize_app
from services.nav_fetcher import fetch_eodhd_data, merge_history

# --- INICIALIZACIÓN FIREBASE (CON TU LLAVE) ---
try:
    # Buscamos tu archivo de claves que vi en tu carpeta
    key_path = os.path.join(current_dir, 'serviceAccountKey.json')
    
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        initialize_app(cred)
        print(f"🔥 Firebase inicializado usando llave: {key_path}")
    else:
        # Si no encuentra el archivo, intenta el método por defecto (fallará en local sin setup)
        initialize_app()
        print("⚠️ No se encontró serviceAccountKey.json, usando credenciales por defecto.")
except ValueError:
    print("⚠️ Firebase ya estaba inicializado.")

db = firestore.client()

async def probar_cobaya():
    # --- CONFIGURACIÓN DE PRUEBA ---
    # Ticker correcto para FONDIBAS en EODHD (Bolsa virtual EUFUND)
    ticker = "ES0138936036.EUFUND"  
    isin_doc_id = "TEST_PRUEBA_01" 
    
    print(f"\n🔬 INICIANDO PRUEBA PARA: {ticker}")
    print("-" * 50)

    async with aiohttp.ClientSession() as session:
        # 1. PROBAR CONEXIÓN EODHD
        print("📡 1. Conectando a EODHD...")
        # Pedimos datos desde el 1 de Enero de 2024
        result = await fetch_eodhd_data(session, ticker, "2024-01-01")
        
        # fetch_eodhd_data devuelve una tupla (ticker, data)
        if not result or not result[1]:
            print(f"❌ ERROR: EODHD devolvió lista vacía o error.")
            print("   -> Verifica tu API KEY en services/nav_fetcher.py")
            return

        data = result[1] # La lista de datos está en la segunda posición
        print(f"✅ CONEXIÓN EXITOSA. Recibidos {len(data)} puntos.")
        
        last_point = data[-1]
        print(f"   📊 Último dato: Fecha {last_point['date']} | NAV {last_point['nav']} EUR")
        
        # Validación rápida
        if 10.0 < last_point['nav'] < 20.0:
            print("   ✅ El valor del NAV parece coherente para este fondo.")
        else:
            print(f"   ⚠️ OJO: El NAV ({last_point['nav']}) parece inusual.")

        # 2. PROBAR ESCRITURA EN FIRESTORE
        print(f"\n💾 2. Guardando en Firestore (Doc: {isin_doc_id})...")
        
        test_doc_ref = db.collection('historico_vl_v2').document(isin_doc_id)
        
        # Leemos si ya había algo (simulacro)
        doc_snap = test_doc_ref.get()
        existing_history = doc_snap.to_dict().get('history', []) if doc_snap.exists else []
        
        # Fusionamos datos nuevos con antiguos
        final_history = merge_history(existing_history, data)
        
        if final_history:
            test_doc_ref.set({
                "isin": isin_doc_id,
                "history": final_history,
                "last_updated": firestore.SERVER_TIMESTAMP,
                "source": "EODHD Test Script",
                "original_isin": "ES0138936036"
            })
            print("✅ ESCRITURA OK.")
            print("🎉 ¡Prueba completada! Verifica tu base de datos Firestore.")
        else:
            print("⚠️ No hubo datos nuevos para guardar (el histórico ya estaba al día).")

if __name__ == "__main__":
    # Ejecutar el loop asíncrono
    try:
        asyncio.run(probar_cobaya())
    except Exception as e:
        print(f"\n❌ ERROR FATAL: {e}")
import sys
import os
import concurrent.futures
from datetime import datetime

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Configuración de Paths para importar módulos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'functions_python')))

import firebase_admin
from firebase_admin import credentials, firestore
from services.nav_fetcher import merge_history
from services.daily_service import extract_history

def init_firestore():
    if not firebase_admin._apps:
        cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'serviceAccountKey.json'))
        if not os.path.exists(cred_path):
            raise FileNotFoundError(f"No se encuentra {cred_path}")
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def process_fund(db, isin):
    try:
        hist_ref = db.collection("historico_vl_v2").document(isin)
        hist_doc = hist_ref.get()
        
        if not hist_doc.exists:
            return None

        hist_data = hist_doc.to_dict()
        
        # 1. Utilizar extract_history para garantizar compatibilidad con múltiples formatos (dict, array, timestamp, str)
        raw_points = extract_history(hist_data)
        if not raw_points:
            return None
            
        # 2. Formatear al standard esperado por merge_history (soporta tuplas, listas y diccionarios)
        existing_history = []
        for p in raw_points:
            try:
                # Si viene como diccionario
                if isinstance(p, dict):
                    d_val = p.get("date") or p.get("timestamp")
                    n_val = p.get("price") or p.get("nav")
                # Si viene como tupla/lista (fecha, precio)
                else:
                    d_val = p[0]
                    n_val = p[1]
                
                # Extraer string de fecha
                if hasattr(d_val, 'strftime'):
                    date_str = d_val.strftime("%Y-%m-%d")
                else:
                    date_str = str(d_val)[:10] # Por si ya es string (YYYY-MM-DD)
                
                existing_history.append({"date": date_str, "nav": float(n_val)})
            except Exception:
                continue # Si hay un punto corrupto, lo ignoramos
        
        # 3. Rellenar huecos pasando el historial sin datos extra ('new_data' vacío activa solo el resample/ffill)
        filled_history = merge_history(existing_history, [])
        
        if filled_history:
            # Solo actualizamos si hubieron huecos que se rellenaron
            # merge_history retorna None si no existen cambios, pero dado que procesamos raw_points a estandar,
            # validaremos por longitud garantizando update solo en fondos que crecieron.
            
            added_points = len(filled_history) - len(existing_history)
            
            if added_points > 0:
                batch = db.batch()
                
                # Estandarizamos guardando bajo la llave 'history' 
                batch.update(hist_ref, {"history": filled_history})
                
                # Limpiar el flag en funds_v3
                fund_ref = db.collection("funds_v3").document(isin)
                batch.update(fund_ref, {
                    "data_quality.has_gaps": False,
                    "data_quality.history_ok": True,
                    "data_quality.last_checked_at": datetime.utcnow().isoformat()
                })
                
                batch.commit()
                return {"isin": isin, "added_points": added_points}
                
        return None
            
    except Exception as e:
        logger.error(f"Error processing {isin}: {e}")
        return None

def main():
    logger.info("🚀 Iniciando limpieza masiva de Gaps (Forward Fill)...")
    db = init_firestore()
    
    # Obtener fondos activos (disabled != True)
    funds_ref = db.collection("funds_v3")
    all_funds = list(funds_ref.stream())
    
    active_isins = [doc.id for doc in all_funds if doc.to_dict().get("disabled") != True]
    logger.info(f"Analizando {len(active_isins)} fondos activos...")
    
    healed_count = 0
    total_added_points = 0
    
    # Procesar concurrentemente (Max de hilos por restricciones IO, 15 está bien para Firestore)
    with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(process_fund, db, isin): isin for isin in active_isins}
        
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            res = future.result()
            if res:
                healed_count += 1
                total_added_points += res['added_points']
                logger.info(f"[{healed_count}] ✅ SANEADO: {res['isin']} (+{res['added_points']} días rellenados)")
            
            if i % 100 == 0:
                logger.info(f"Progreso: {i}/{len(active_isins)} fondos escaneados...")
                
    logger.info("\n🏁 LIMPIEZA COMPLETADA CON ÉXITO")
    logger.info(f"📈 Total de fondos reparados: {healed_count}")
    logger.info(f"📅 Total de días laborales generados: {total_added_points}")

if __name__ == "__main__":
    main()

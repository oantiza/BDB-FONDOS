import asyncio
import aiohttp
import logging
from datetime import datetime, timedelta
from google.cloud import firestore
from firebase_admin import firestore as admin_firestore

# Configuración
API_TOKEN = "6943decfb2bb14.96572592"  # TU TOKEN (Este es el demo de EODHD, asegúrate de poner el tuyo si tienes uno pro)
BASE_URL = "https://eodhd.com/api/eod"

# --- ADAPTADOR EODHD (Async) ---
async def fetch_eodhd_data(session, ticker, from_date):
    """Descarga datos de EODHD y normaliza a formato lista de dicts."""
    url = f"{BASE_URL}/{ticker}"
    params = {
        "api_token": API_TOKEN,
        "fmt": "json",
        "from": from_date,
        "period": "d"
    }
    try:
        async with session.get(url, params=params, timeout=10) as response:
            if response.status == 200:
                data = await response.json()
                # Normalizar salida: EODHD devuelve 'date' y 'adjusted_close' (o 'close')
                clean_data = []
                for item in data:
                    if item.get('date') and (item.get('adjusted_close') or item.get('close')):
                        val = item.get('adjusted_close') or item.get('close')
                        clean_data.append({
                            "date": item['date'],  # String YYYY-MM-DD
                            "nav": float(val)
                        })
                return ticker, clean_data
            else:
                logging.error(f"Error EODHD {ticker}: Status {response.status}")
                return ticker, None
    except Exception as e:
        logging.error(f"Excepción fetching {ticker}: {str(e)}")
        return ticker, None

# --- LÓGICA DE FUSIÓN (MERGE) ---
def merge_history(existing_history, new_data):
    """
    Fusiona datos nuevos con antiguos evitando duplicados.
    """
    if not new_data:
        return existing_history

    # 1. Convertir lista existente a Dict {Fecha: Valor} para búsqueda rápida
    history_map = {item['date']: item['nav'] for item in existing_history}
    
    # 2. Insertar/Actualizar con datos nuevos
    changes_count = 0
    for item in new_data:
        if history_map.get(item['date']) != item['nav']:
            history_map[item['date']] = item['nav']
            changes_count += 1
            
    if changes_count == 0:
        return None # No hay cambios
        
    # 3. Reconstruir lista ordenada
    merged_list = [{"date": k, "nav": v} for k, v in sorted(history_map.items())]
    return merged_list

# --- ORQUESTADOR PRINCIPAL (Para uso futuro) ---
async def process_batch(db, funds_batch, session, lookback_date):
    tasks = []
    for doc in funds_batch:
        ticker = doc.to_dict().get('eod_ticker')
        if ticker:
            tasks.append(fetch_eodhd_data(session, ticker, lookback_date))
    
    results = await asyncio.gather(*tasks)
    
    batch = db.batch()
    updates_count = 0
    fetched_data_map = {r[0]: r[1] for r in results if r and r[1]}

    for doc in funds_batch:
        fund_data = doc.to_dict()
        ticker = fund_data.get('eod_ticker')
        isin = doc.id 
        
        new_navs = fetched_data_map.get(ticker)
        
        if not new_navs:
            continue

        hist_ref = db.collection('historico_vl_v2').document(isin)
        hist_snap = hist_ref.get()
        existing_history = []
        
        if hist_snap.exists:
            existing_history = hist_snap.to_dict().get('history', [])
        
        final_history = merge_history(existing_history, new_navs)
        
        if final_history:
            batch.set(hist_ref, {
                "isin": isin,
                "history": final_history,
                "last_updated": datetime.utcnow().isoformat(),
                "source": "EODHD"
            }, merge=True)
            updates_count += 1

    if updates_count > 0:
        batch.commit()
        return updates_count
    return 0
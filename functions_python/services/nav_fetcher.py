import asyncio
import aiohttp
import logging
import os
from datetime import datetime, timedelta
from google.cloud import firestore
from firebase_admin import firestore as admin_firestore

# --- CONFIGURACIÓN ---
# Usamos variable de entorno si existe, o constante para debug.
# En producción, esto debe venir de os.environ
API_TOKEN = os.environ.get("EODHD_API_KEY", "6943decfb2bb14.96572592") 
BASE_URL = "https://eodhd.com/api/eod"

# --- ADAPTADOR EODHD (Async) ---
async def fetch_eodhd_data(session, ticker, from_date, to_date=None):
    """Descarga datos de EODHD."""
    url = f"{BASE_URL}/{ticker}"
    params = {
        "api_token": API_TOKEN,
        "fmt": "json",
        "order": "a", # Ascending
        "period": "d"
    }
    if from_date:
        params["from"] = from_date
    if to_date:
        params["to"] = to_date
    try:
        async with session.get(url, params=params, timeout=10) as response:
            if response.status == 200:
                try:
                    data = await response.json()
                except Exception as e_json:
                     logging.warning(f"⚠️ EODHD Json Error {ticker}: {e_json}")
                     return ticker, None

                if not isinstance(data, list):
                    # A veces devuelve objeto {error: ...}
                    logging.warning(f"⚠️ EODHD Data Format Error {ticker}: Not a list")
                    return ticker, None

                clean_data = []
                for item in data:
                    # Buscamos 'adjusted_close' o 'close'
                    val = item.get('adjusted_close') or item.get('close')
                    # Aseguramos que sea float > 0
                    if item.get('date') and val:
                        try:
                            f_val = float(val)
                            if f_val > 0:
                                clean_data.append({
                                    "date": item['date'],
                                    "nav": f_val
                                })
                        except: pass
                
                return ticker, clean_data
            elif response.status == 429:
                logging.warning(f"⏳ Rate Limit EODHD {ticker}")
                return ticker, None
            else:
                logging.warning(f"⚠️ EODHD {ticker}: Status {response.status}")
                return ticker, None
    except Exception as e:
        logging.error(f"❌ Excepción fetching {ticker}: {str(e)}")
        return ticker, None

# --- LÓGICA DE FUSIÓN (MERGE) ---
def merge_history(existing_history, new_data):
    if not new_data:
        return None

    # Mapa para búsqueda rápida y evitar duplicados
    history_map = {item['date']: item['nav'] for item in existing_history}
    
    changes = False
    for item in new_data:
        # Si la fecha no existe O el valor es diferente (corrección)
        # Nota: Comparar floats directamente puede ser tricky, usamos tolerancia simple o directo?
        # Para NAVs, exactitud es importante. Si cambia, actualizamos.
        current_val = history_map.get(item['date'])
        if current_val != item['nav']:
            history_map[item['date']] = item['nav']
            changes = True
            
    if not changes:
        return None 
        
    # Reconstruir lista ordenada
    return [{"date": k, "nav": v} for k, v in sorted(history_map.items())]

# --- ORQUESTADOR PRINCIPAL ---
async def process_batch(db, funds_batch, session, lookback_date):
    tasks = []
    
    # 1. PREPARAR PETICIONES (Lógica dinámica .EUFUND)
    for doc in funds_batch:
        data = doc.to_dict()
        isin = doc.id 
        
        # Leemos ticker. Si no tiene sufijo, asumimos .EUFUND
        raw_ticker = data.get('eod_ticker')
        if not raw_ticker:
            ticker = f"{isin}.EUFUND"
        elif "." not in raw_ticker:
            ticker = f"{raw_ticker}.EUFUND"
        else:
            ticker = raw_ticker
            
        tasks.append(fetch_eodhd_data(session, ticker, lookback_date))
    
    # 2. ESPERAR RESULTADOS
    results = await asyncio.gather(*tasks)
    
    # 3. PROCESAR RESULTADOS
    batch = db.batch()
    updates_count = 0
    batch_ops_count = 0
    
    # Mapa: {ticker_usado: datos_recibidos}
    fetched_data_map = {r[0]: r[1] for r in results if r and r[1]}

    # Necesitamos leer historial actual para hacer merge
    # Optimización: Leer historial solo para los que trajeron datos nuevos?
    # Sí, reducimos lecturas.
    
    # Identificar fondos con datos nuevos
    funds_to_update = []
    for doc in funds_batch:
        data = doc.to_dict()
        isin = doc.id
        raw_ticker = data.get('eod_ticker')
        if not raw_ticker: ticker_used = f"{isin}.EUFUND"
        elif "." not in raw_ticker: ticker_used = f"{raw_ticker}.EUFUND"
        else: ticker_used = raw_ticker
        
        if ticker_used in fetched_data_map:
            funds_to_update.append((doc, ticker_used))
            
    if not funds_to_update:
        return 0

    # Leer historiales en paralelo (si es posible) o batch get?
    # Firestore no tiene 'batch get' fácil para documentos arbitrarios, 
    # pero podemos hacer db.get_all(refs).
    
    hist_refs = [db.collection('historico_vl_v2').document(f[0].id) for f in funds_to_update]
    hist_docs = db.get_all(hist_refs)
    
    # Procesar fusiones
    for i, hist_snap in enumerate(hist_docs):
        fund_doc, ticker_used = funds_to_update[i]
        isin = fund_doc.id
        new_navs = fetched_data_map[ticker_used]
        
        existing_history = hist_snap.to_dict().get('history', []) if hist_snap.exists else []
        
        final_history = merge_history(existing_history, new_navs)
        
        if final_history:
            # Limitar tamaño histórico (ej. últimos 3000 puntos / ~12 años) 
            # para no exceder límite de 1MB por doc de Firestore a largo plazo.
            if len(final_history) > 3000:
                final_history = final_history[-3000:]
            
            ref = db.collection('historico_vl_v2').document(isin)
            batch.set(ref, {
                "isin": isin,
                "history": final_history,
                "last_updated": datetime.utcnow().isoformat(),
                "source": "EODHD Auto",
                "currency": fund_doc.to_dict().get('currency', 'EUR')
            }, merge=True)
            
            updates_count += 1
            batch_ops_count += 1
            
            # Actualizar quality flag en funds_v3 también?
            # Si es onboarding, sí. Si es update, refrescar timestamp.
            f_ref = db.collection('funds_v3').document(isin)
            batch.update(f_ref, {
                'data_quality.history_ok': True,
                'data_quality.last_checked_at': datetime.utcnow().isoformat()
            })
            batch_ops_count += 1
    
    if batch_ops_count > 0:
         # Batch limit es 500. Si updates_count es > 250, podríamos pasarnos (2 ops por fondo)
         # Pero CHUNK_SIZE del llamador dirá.
        batch.commit()
        
    return updates_count

# --- ENTRY POINT (Para Cloud Function) ---
def run_daily_fetch():
    # Inicializar cliente Firestore (Admin SDK)
    # Se asume initialize_app() ya llamado en main.py
    # Pero aquí necesitamos 'async' context? No, el entry point es sincrónico para Cloud Function v2
    # que llama a asyncio.run()
    
    # db = firestore.client() # Esto a veces da problemas en hilos async.
    # Mejor usar admin_firestore.client() si ya está init en main.
    db = admin_firestore.client()
    
    # Ventana de 7 días (recuperación de fallos y fin de semana)
    # Si es Lunes, queremos Viernes. 7 días cubre todo.
    lookback_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    print(f"📅 Fetch desde: {lookback_date}")

    funds_ref = db.collection('funds_v3')
    # Leer todos los IDs para iterar. stream() es generador.
    # Listarlo consume RAM pero son solo ~700 docs pequeños (IDs + tickers). 512MB sobra.
    all_funds = list(funds_ref.stream())
    print(f"🔍 Fondos totales a procesar: {len(all_funds)}")

    # Procesar en lotes pequeños para no saturar CPU/Net y mantener batches Firestore seguros
    CHUNK_SIZE = 50 # 50 fondos * 2 ops = 100 ops por batch commit (seguro < 500)
    total_updated = 0

    async def runner():
        # Usar una sola sesion para todo el proceso (Connection Pooling)
        async with aiohttp.ClientSession() as session:
            nonlocal total_updated
            for i in range(0, len(all_funds), CHUNK_SIZE):
                chunk = all_funds[i:i + CHUNK_SIZE]
                print(f"🚀 Procesando lote {i} a {i+len(chunk)}...")
                updated = await process_batch(db, chunk, session, lookback_date)
                total_updated += updated
                # Pequeña pausa para no ser agresivos con Firestore/EODHD?
                await asyncio.sleep(0.5) 
    
    asyncio.run(runner())
    return f"✅ Proceso finalizado. Actualizados: {total_updated}"


# --- NUEVA FUNCIÓN: ACTUALIZACIÓN MANUAL (ON-DEMAND) ---
def update_single_fund_history(db, isin, mode='merge', from_date=None, to_date=None):
    """
    Actualiza el histórico de un fondo específico desde EODHD.
    mode: 'merge' (rellenar huecos/actualizar) o 'overwrite' (borrar y descargar nuevo)
    """
    import asyncio
    
    async def runner():
        async with aiohttp.ClientSession() as session:
            # 1. Obtener Ticker
            doc_ref = db.collection('funds_v3').document(isin)
            doc = doc_ref.get()
            if not doc.exists:
                return {'success': False, 'error': f'Fund {isin} not found'}
            
            data = doc.to_dict()
            raw_ticker = data.get('eod_ticker')
            ticker = f"{isin}.EUFUND" # Default
            
            if raw_ticker:
                 if "." not in raw_ticker: ticker = f"{raw_ticker}.EUFUND"
                 else: ticker = raw_ticker
            
            print(f"🔄 Updating {isin} ({ticker}) Mode={mode} From={from_date} To={to_date}")
            
            # 2. Descargar
            ticker_res, new_data = await fetch_eodhd_data(session, ticker, from_date, to_date)
            
            if not new_data:
                return {'success': False, 'error': 'No data received from EODHD', 'ticker': ticker}
                
            # 3. Procesar
            hist_ref = db.collection('historico_vl_v2').document(isin)
            final_history = []
            
            if mode == 'overwrite':
                # Reemplazo directo
                final_history = new_data
            else:
                # Merge con existente
                hist_snap = hist_ref.get()
                existing = hist_snap.to_dict().get('history', []) if hist_snap.exists else []
                merged = merge_history(existing, new_data)
                final_history = merged if merged else existing

            # 4. Guardar
            # Sort y trim
            final_history.sort(key=lambda x: x['date'])
            if len(final_history) > 4000: # Limit history size
                 final_history = final_history[-4000:]
            
            hist_ref.set({
                "isin": isin,
                "history": final_history,
                "last_updated": datetime.utcnow().isoformat(),
                "source": "EODHD Manual",
                "currency": data.get('currency', 'EUR')
            }, merge=True)
            
            # Update quality timestamp
            db.collection('funds_v3').document(isin).update({
                'data_quality.history_ok': True,
                'data_quality.last_manual_update': datetime.utcnow().isoformat()
            })
            
            return {
                'success': True, 
                'count': len(final_history), 
                'mode': mode,
                'ticker_used': ticker
            }

    return asyncio.run(runner())

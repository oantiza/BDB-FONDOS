from datetime import datetime
from .config import PRICE_CACHE # Import from local config

def get_price_data(assets_list, db):
    # Importación diferida (Lazy Import)
    import pandas as pd
    import numpy as np
    
    def generate_synthetic_series(days=1200, vol=0.12, ret=0.07, seed=None):
        if seed is not None: np.random.seed(seed)
        end_date = datetime.now()
        dates = pd.date_range(end=end_date, periods=days, freq='B')
        dt = 1/252
        mu = ret * dt
        sigma = vol * np.sqrt(dt)
        returns = np.random.normal(loc=mu, scale=sigma, size=days)
        price_path = 100 * (1 + returns).cumprod()
        return {d.strftime('%Y-%m-%d'): float(round(p, 2)) for d, p in zip(dates, price_path)}

    price_data = {}
    missing_assets = []

    # 1. REVISAR CACHÉ RAM
    for isin in assets_list:
        if isin in PRICE_CACHE:
            price_data[isin] = PRICE_CACHE[isin]
        else:
            missing_assets.append(isin)
            
    if not missing_assets:
        print("⚡ [CACHE HIT] Todos los activos recuperados de memoria RAM.")
        return price_data, []

    # 2. CONSULTAR FIRESTORE (BATCH READ OPTIMIZATION)
    if missing_assets:
        print(f"📥 [DB READ] Buscando {len(missing_assets)} activos en Firestore (Batch)...")
        synthetic_used = [] 

        try:
            # Create list of references
            refs = [db.collection('historico_vl_v2').document(isin) for isin in missing_assets]
            
            # Fetch all in parallel/batch
            docs = db.get_all(refs)

            for doc in docs:
                isin = doc.id
                if not doc.exists:
                    print(f"❌ {isin}: NO DATA FOUND.")
                    continue
                
                try:
                    data = doc.to_dict()
                    
                    # PRIORITY 1: CANONICAL HISTORY (V3)
                    history_list = data.get('history', [])
                    clean_series = {}
                    
                    if history_list and isinstance(history_list, list):
                            for item in history_list:
                                if not isinstance(item, dict): continue
                                d_val = item.get('date')
                                n_val = item.get('nav')
                                if d_val and n_val is not None:
                                    clean_series[str(d_val)] = float(n_val)

                    # PRIORITY 2: LEGACY SERIES (Fallback)
                    if not clean_series: 
                        series = data.get('series', [])
                        if len(series) > 10:
                            for p in series:
                                if p.get('date') and p.get('price'):
                                    d_val = p['date']
                                    if hasattr(d_val, 'strftime'): d_str = d_val.strftime('%Y-%m-%d')
                                    else: d_str = str(d_val).split('T')[0]
                                    clean_series[d_str] = float(p['price'])
                    
                    if len(clean_series) > 50:
                        price_data[isin] = clean_series
                        PRICE_CACHE[isin] = clean_series 
                    else:
                         print(f"⚠️ {isin}: Historia insuficiente ({len(clean_series)})")

                except Exception as e_proc:
                    print(f"⚠️ Error procesando {isin}: {e_proc}")

        except Exception as e_batch:
            print(f"⚠️ Error Crítico en Batch Read: {e_batch}")
            # Fallback to sequential? No, if batch fails likely DB issue.
            pass

    return price_data, synthetic_used

_rf_cache = {'rate': None, 'timestamp': None}

def get_dynamic_risk_free_rate(db=None):
    """
    Obtiene la Tasa Libre de Riesgo (ESTR) del BCE.
    Actualiza solo una vez al día a las 08:00 AM (aprox).
    Usa Firestore para persistencia si db está disponible.
    """
    from datetime import datetime, timedelta
    global _rf_cache
    
    # Logic: Define "Current Validation Cycle".
    # Cycle starts at today 08:00. If now < 08:00, cycle started yesterday 08:00.
    now = datetime.now()
    cutoff_hour = 8
    
    cycle_start = now.replace(hour=cutoff_hour, minute=0, second=0, microsecond=0)
    if now.hour < cutoff_hour:
        cycle_start = cycle_start - timedelta(days=1)
        
    # 1. Try Firestore Cache (Persistent)
    if db:
        try:
            doc_ref = db.collection('system_settings').document('risk_free_rate')
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                last_update = data.get('updated_at')
                stored_rate = data.get('rate')
                
                # Check if valid for current cycle
                if last_update:
                    # localized or naive? assumes server time consistency
                    last_dt = last_update.replace(tzinfo=None) if hasattr(last_update, 'tzinfo') else last_update
                    if last_dt >= cycle_start:
                        print(f"⚡ [CACHE DB] Using stored ESTR: {stored_rate*100:.3f}% (from {last_dt})")
                        return float(stored_rate)
        except Exception as e:
            print(f"⚠️ Error checking DB cache: {e}")

    # 2. Try Memory Cache (Fallback / Optimization if DB fail)
    if _rf_cache['rate'] and _rf_cache['timestamp']:
        if _rf_cache['timestamp'] >= cycle_start:
             return _rf_cache['rate']

    # 3. Fetch from ECB (ESTR - Euro Short-Term Rate)
    # Nota: la key interna de series (p.ej. '0:0:0:0') NO es estable.
    # Por eso seleccionamos dinámicamente la primera serie y la última observación disponible.
    url = "https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT?lastNObservations=10&format=jsondata"

    fallback_rate = 0.03
    try:
        import requests
        print("🌍 [ECB] Fetching Real Risk Free Rate (ESTR)...")
        headers = {
            "Accept": "application/json",
            "User-Agent": "bdb-fondos/1.0 (risk_free_rate_fetch)"
        }
        r = requests.get(url, headers=headers, timeout=8)
        r.raise_for_status()
        data = r.json()

        series_dict = data.get('dataSets', [{}])[0].get('series', {})
        if not series_dict:
            raise KeyError('No series found in ECB response')

        series_key = next(iter(series_dict.keys()))
        observations = series_dict[series_key].get('observations', {})
        if not observations:
            raise KeyError('No observations found in ECB response')

        obs_keys_sorted = sorted(observations.keys(), key=lambda x: int(x))
        last_obs_key = obs_keys_sorted[-1]
        val = observations[last_obs_key][0]
        rate = float(val) / 100.0

        print(f"✅ [ECB] Rate updated: {rate*100:.3f}% (series={series_key}, obs={last_obs_key})")

        # Update Memory Cache
        _rf_cache = {'rate': rate, 'timestamp': now}

        # Update Firestore Cache
        if db:
            try:
                db.collection('system_settings').document('risk_free_rate').set({
                    'rate': rate,
                    'updated_at': now,
                    'source': 'ECB',
                    'cycle': cycle_start.isoformat(),
                    'series_key': series_key,
                    'obs_key': last_obs_key,
                })
            except Exception as w_err:
                print(f"⚠️ Error writing DB cache: {w_err}")

        return rate

    except Exception as e:
        print(f"⚠️ [ECB] Error fetching rate: {e}")

    print(f"⚠️ [ECB] Using Fallback Rate: {fallback_rate*100:.1f}%")
    return float(fallback_rate)

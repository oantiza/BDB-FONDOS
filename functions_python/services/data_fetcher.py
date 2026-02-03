from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import requests
from firebase_admin import firestore
from .config import PRICE_CACHE

class DataFetcher:
    """
    Data Access Layer.
    Handles Firestore, Caching, and Pre-processing (Resampling).
    """
    
    def __init__(self, db_client):
        self.db = db_client

    def get_price_data(self, assets_list: list, resample_freq='D', strict=True):
        """
        Fetches price history for assets.
        Standardizes to Daily Frequency ('D') and aligns to Business Day Calendar ('B').
        """
        price_data = {}
        missing_assets = []
        synthetic_used = []

        # 1. RAM Cache Check
        for isin in assets_list:
            if isin in PRICE_CACHE:
                price_data[isin] = PRICE_CACHE[isin]
            else:
                missing_assets.append(isin)

        # 2. Batch Fetch from Firestore
        if missing_assets:
            print(f"📥 [DataFetcher] Batch reading {len(missing_assets)} assets...")
            refs = [self.db.collection('historico_vl_v2').document(isin) for isin in missing_assets]
            docs = self.db.get_all(refs)
            
            for doc in docs:
                isin = doc.id
                if not doc.exists:
                    print(f"❌ {isin}: Not found in DB.")
                    continue
                
                try:
                    data = doc.to_dict()
                    series_clean = self._parse_doc_history(data)
                    
                    print(f"📡 [DataFetcher] {isin} retrieved. Points: {len(series_clean)}")
                    
                    if len(series_clean) > 20:
                        price_data[isin] = series_clean
                        PRICE_CACHE[isin] = series_clean
                    else:
                        print(f"⚠️ {isin}: Insufficient history ({len(series_clean)})")
                        
                except Exception as e:
                    print(f"⚠️ Error parsing {isin}: {e}")

        if not price_data:
            return pd.DataFrame(), []

        # 3. Pandas Alignment & Professional Cleaning
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index()

        # Step A: Resample to Daily to fill any missing calendar days
        df = df.resample('D').last()

        # Step B: Reindex to Business Day calendar ('B') to normalize series intersection
        if not df.empty:
            b_range = pd.date_range(start=df.index[0], end=df.index[-1], freq='B')
            df = df.reindex(b_range)

        # Step C: Fill Gaps (Professional ffill/bfill sequence)
        # We allow broad ffill to avoid zero drops in portfolio charts
        df = df.ffill().bfill()
        
        # Step D: Strict vs Loose
        if strict:
            df_final = df.dropna()
        else:
            df_final = df
        
        return df_final, synthetic_used

    def _parse_doc_history(self, data: dict) -> dict:
        """Parses V3 history or legacy series."""
        clean_series = {}
        
        # Priority 1: 'history' (V3)
        history_list = data.get('history', [])
        if history_list and isinstance(history_list, list):
            for item in history_list:
                if not isinstance(item, dict): continue
                d_val = item.get('date')
                n_val = item.get('nav')
                if d_val and n_val is not None:
                    clean_series[str(d_val)] = float(n_val)
            return clean_series

        # Priority 2: 'series' (Legacy)
        series = data.get('series', [])
        for p in series:
            if p.get('date') and p.get('price'):
                d_val = p['date']
                if hasattr(d_val, 'strftime'): d_str = d_val.strftime('%Y-%m-%d')
                else: d_str = str(d_val).split('T')[0]
                clean_series[d_str] = float(p['price'])
        
        return clean_series

    def get_asset_metadata(self, assets_list: list):
        """Fetches metadata (asset_class, region) for constraints."""
        metadata = {}
        
        # Optimize: Fetch only what's needed. 
        # For now, batch read funds_v3
        refs = [self.db.collection('funds_v3').document(isin) for isin in assets_list]
        docs = self.db.get_all(refs)
        
        for d in docs:
            if d.exists:
                dd = d.to_dict()
                metadata[d.id] = {
                    'asset_class': dd.get('derived', {}).get('asset_class') or dd.get('std_type'),
                    'region': dd.get('derived', {}).get('primary_region') or dd.get('std_region'),
                    'market_cap': dd.get('std_mcap', 1e9) # Default for BL if missing
                }
        return metadata
    def get_dynamic_risk_free_rate(self):
        """
        Obtiene la Tasa Libre de Riesgo (ESTR) del BCE.
        Actualiza solo una vez al día a las 08:00 AM (aprox).
        Usa Firestore para persistencia.
        """
        global _rf_cache
        
        # Logic: Define "Current Validation Cycle".
        now = datetime.now()
        cutoff_hour = 8
        
        cycle_start = now.replace(hour=cutoff_hour, minute=0, second=0, microsecond=0)
        if now.hour < cutoff_hour:
            cycle_start = cycle_start - timedelta(days=1)
            
        # 1. Try Firestore Cache (Persistent)
        try:
            doc_ref = self.db.collection('system_settings').document('risk_free_rate')
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
        url = "https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT?lastNObservations=10&format=jsondata"
        fallback_rate = 0.03

        try:
            print("🌍 [ECB] Fetching Real Risk Free Rate (ESTR)...")
            headers = {
                "Accept": "application/json",
                "User-Agent": "bdb-fondos/1.0 (risk_free_rate_fetch)"
            }
            r = requests.get(url, headers=headers, timeout=8)
            r.raise_for_status()
            data = r.json()

            series_dict = data.get('dataSets', [{}])[0].get('series', {})
            if not series_dict: raise KeyError('No series')

            series_key = next(iter(series_dict.keys()))
            observations = series_dict[series_key].get('observations', {})
            if not observations: raise KeyError('No observations')

            obs_keys_sorted = sorted(observations.keys(), key=lambda x: int(x))
            last_obs_key = obs_keys_sorted[-1]
            val = observations[last_obs_key][0]
            rate = float(val) / 100.0

            print(f"✅ [ECB] Rate updated: {rate*100:.3f}%")

            # Update Memory Cache
            _rf_cache = {'rate': rate, 'timestamp': now}

            # Update Firestore Cache
            try:
                self.db.collection('system_settings').document('risk_free_rate').set({
                    'rate': rate,
                    'updated_at': now,
                    'source': 'ECB',
                    'cycle': cycle_start.isoformat()
                })
            except Exception as w_err:
                print(f"⚠️ Error writing DB cache: {w_err}")

            return rate

        except Exception as e:
            print(f"⚠️ [ECB] Error fetching rate: {e}")

        print(f"⚠️ [ECB] Using Fallback Rate: {fallback_rate*100:.1f}%")
        return float(fallback_rate)

    def generate_synthetic_series(self, days=1200, vol=0.12, ret=0.07, seed=None):
        if seed is not None: np.random.seed(seed)
        end_date = datetime.now()
        dates = pd.date_range(end=end_date, periods=days, freq='B')
        dt = 1/252
        mu = ret * dt
        sigma = vol * np.sqrt(dt)
        returns = np.random.normal(loc=mu, scale=sigma, size=days)
        price_path = 100 * (1 + returns).cumprod()
        return {d.strftime('%Y-%m-%d'): float(round(p, 2)) for d, p in zip(dates, price_path)}

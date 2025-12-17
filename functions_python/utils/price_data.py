# Price data utilities
from datetime import datetime
from .config import PRICE_CACHE

def get_price_data(assets_list, db):
    """Fetch price data for assets, using cache and Firestore with synthetic fallback."""
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

    # 1. Check RAM cache
    for isin in assets_list:
        if isin in PRICE_CACHE:
            price_data[isin] = PRICE_CACHE[isin]
        else:
            missing_assets.append(isin)
            
    if not missing_assets:
        print("⚡ [CACHE HIT] All assets retrieved from RAM.")
        return price_data, []

    # 2. Query Firestore
    print(f"📥 [DB READ] Fetching {len(missing_assets)} assets from Firestore...")
    
    synthetic_used = []

    for i, isin in enumerate(missing_assets):
        loaded = False
        try:
            doc = db.collection('historico_vl_v2').document(isin).get()
            if doc.exists:
                data = doc.to_dict()
                series = data.get('series', [])
                if len(series) > 50:
                    clean_series = {}
                    for p in series:
                        if p.get('date') and p.get('price'):
                            d_val = p['date']
                            if hasattr(d_val, 'strftime'): d_str = d_val.strftime('%Y-%m-%d')
                            else: d_str = str(d_val).split('T')[0]
                            clean_series[d_str] = float(p['price'])
                    
                    if len(clean_series) > 50:
                        price_data[isin] = clean_series
                        PRICE_CACHE[isin] = clean_series 
                        loaded = True
        except Exception as e:
            print(f"⚠️ Error reading {isin}: {e}")

        if not loaded:
            print(f"⚠️ {isin}: Using SYNTHETIC data.")
            synthetic_used.append(isin)
            fake_vol = 0.05 + (0.15 * (i % 4) / 3) 
            fake_ret = 0.04 + (0.06 * (i % 3) / 2)
            price_data[isin] = generate_synthetic_series(vol=fake_vol, ret=fake_ret, seed=i)

    return price_data, synthetic_used

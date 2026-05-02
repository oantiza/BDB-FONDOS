"""
Descarga histórico de EODHD para los 44 fondos sin datos en historico_vl_v2.
Luego calcula std_perf para los que tengan suficiente historia.
"""
import firebase_admin
from firebase_admin import credentials, firestore
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import os
import time

sa_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
cred = credentials.Certificate(sa_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

EODHD_API_KEY = "6943decfb2bb14.96572592"
BASE_URL = "https://eodhd.com/api/eod"

# 1. Find funds without history
print("🔍 Buscando fondos sin histórico en historico_vl_v2...")
all_docs = list(db.collection('funds_v3').stream())

missing_funds = []
for doc in all_docs:
    data = doc.to_dict()
    isin = doc.id
    
    # Check if has history
    h_doc = db.collection('historico_vl_v2').document(isin).get()
    if h_doc.exists:
        h_data = h_doc.to_dict()
        raw = h_data.get('history') or h_data.get('series') or []
        if len(raw) > 0:
            continue
    
    # Get eod_ticker
    eod_ticker = data.get('eod_ticker', isin)
    missing_funds.append({
        'isin': isin,
        'name': data.get('name', 'Unknown'),
        'eod_ticker': eod_ticker,
    })

print(f"  Fondos sin histórico: {len(missing_funds)}\n")

# 2. Download from EODHD
start_date = (datetime.now() - timedelta(days=365*10)).strftime('%Y-%m-%d')

downloaded = 0
no_data = []
errors = []
metrics_updated = 0

for i, fund in enumerate(missing_funds):
    isin = fund['isin']
    ticker = fund['eod_ticker']
    name = fund['name']
    
    print(f"[{i+1}/{len(missing_funds)}] {isin} ({ticker}) - {name[:50]}...", end=" ")
    
    try:
        # Try with ticker first, then ISIN.EUFUND
        tickers_to_try = [ticker]
        if ticker == isin:
            tickers_to_try.append(f"{isin}.EUFUND")
        
        history_list = []
        used_ticker = None
        
        for t in tickers_to_try:
            params = {
                'api_token': EODHD_API_KEY,
                'fmt': 'json',
                'from': start_date,
                'order': 'a'
            }
            
            r = requests.get(f"{BASE_URL}/{t}", params=params, timeout=15)
            
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, list) and len(data) > 0:
                    for p in data:
                        date_str = p.get('date')
                        price_val = p.get('adjusted_close') or p.get('close')
                        if date_str and price_val is not None:
                            try:
                                price_num = float(price_val)
                                if price_num > 0:
                                    history_list.append({'date': date_str, 'nav': price_num})
                            except:
                                continue
                    
                    if history_list:
                        used_ticker = t
                        break
            
            time.sleep(0.3)  # Rate limit
        
        if not history_list:
            no_data.append(isin)
            print("❌ Sin datos")
            continue
        
        # 3. Write to historico_vl_v2
        db.collection('historico_vl_v2').document(isin).set({
            'history': history_list,
            'source': 'EODHD',
            'ticker_used': used_ticker,
            'last_updated': datetime.now().isoformat(),
            'points': len(history_list),
        })
        
        downloaded += 1
        print(f"✅ {len(history_list)} pts", end="")
        
        # 4. Calculate std_perf if enough data
        if len(history_list) >= 10:
            df = pd.DataFrame(history_list)
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            df = df.sort_index()
            df = df['nav'].astype(float)
            df = df[df > 0]
            
            if len(df) >= 10:
                returns = df.pct_change().dropna()
                days = (df.index[-1] - df.index[0]).days
                years = days / 365.25
                
                if years >= 0.5 and len(returns) >= 5:
                    vol = float(returns.std() * np.sqrt(252))
                    total_ret = (df.iloc[-1] / df.iloc[0]) - 1
                    cagr = float((1 + total_ret) ** (1 / years) - 1)
                    sharpe = float(cagr / vol) if vol > 0 else 0.0
                    rolling_max = df.cummax()
                    drawdown = (df / rolling_max) - 1.0
                    max_dd = float(drawdown.min())
                    var_95 = float(np.percentile(returns, 5))
                    cvar_returns = returns[returns <= var_95]
                    cvar_95 = float(cvar_returns.mean()) if len(cvar_returns) > 0 else var_95
                    
                    update = {
                        'std_perf.return': round(cagr, 4),
                        'std_perf.volatility': round(vol, 4),
                        'std_perf.sharpe': round(sharpe, 4),
                        'std_perf.max_drawdown': round(max_dd, 4),
                        'std_perf.var95': round(var_95, 4),
                        'std_perf.cvar95': round(cvar_95, 4),
                        'std_perf.window_points': len(df),
                        'std_perf.last_updated': datetime.now().isoformat(),
                        'data_quality.history_ok': True,
                        'data_quality.std_perf_ok': True,
                        'data_quality.history_points': len(history_list),
                        'data_quality.last_checked_at': datetime.now().isoformat(),
                        'has_history': True,
                    }
                    if years >= 3:
                        update['std_perf.cagr3y'] = round(cagr, 4)
                    
                    db.collection('funds_v3').document(isin).update(update)
                    metrics_updated += 1
                    print(f" + métricas (vol={vol:.3f}, cagr={cagr:.3f})")
                else:
                    print(f" (historia corta: {years:.1f}y)")
            else:
                print()
        else:
            print()
        
        time.sleep(0.5)  # EODHD rate limit
        
    except Exception as e:
        errors.append((isin, str(e)))
        print(f"❌ Error: {e}")

# Summary
print(f"\n{'=' * 60}")
print(f"RESUMEN")
print(f"{'=' * 60}")
print(f"  Total sin histórico: {len(missing_funds)}")
print(f"  ✅ Descargados:      {downloaded}")
print(f"  📊 Métricas calc.:   {metrics_updated}")
print(f"  📭 Sin datos EODHD:  {len(no_data)}")
print(f"  ❌ Errores:          {len(errors)}")

if no_data:
    print(f"\n  ISINs sin datos en EODHD:")
    for isin in no_data:
        print(f"    - {isin}")

if errors:
    print(f"\n  Errores:")
    for isin, err in errors:
        print(f"    - {isin}: {err}")

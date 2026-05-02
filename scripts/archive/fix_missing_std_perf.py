"""
Calcula std_perf para los fondos que no lo tienen.
Usa la misma lógica que update_daily_metrics() de analytics.py
pero solo actúa sobre los fondos sin std_perf.
"""
import firebase_admin
from firebase_admin import credentials, firestore
import numpy as np
import pandas as pd
from datetime import datetime
import os

sa_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
cred = credentials.Certificate(sa_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

# 1. Find funds without std_perf
print("🔍 Buscando fondos sin std_perf...")
all_docs = list(db.collection('funds_v3').stream())

missing = []
for doc in all_docs:
    data = doc.to_dict()
    sp = data.get('std_perf')
    if not sp or not isinstance(sp, dict) or not sp.get('volatility'):
        missing.append(doc)

print(f"  Fondos sin std_perf: {len(missing)}")

# 2. For each, check historico_vl_v2 and calculate
updated = 0
no_history = []
too_short = []
errors = []

for doc in missing:
    isin = doc.id
    try:
        # Get history
        h_doc = db.collection('historico_vl_v2').document(isin).get()
        if not h_doc.exists:
            no_history.append(isin)
            continue
        
        h_data = h_doc.to_dict()
        raw_list = h_data.get('history') or h_data.get('series') or []
        
        if len(raw_list) < 10:
            too_short.append(isin)
            continue
        
        # Build DataFrame
        history_data = []
        for item in raw_list:
            d_val = item.get('date')
            p_val = item.get('nav') if item.get('nav') is not None else item.get('price')
            if d_val and p_val is not None:
                history_data.append({'date': d_val, 'nav': float(p_val)})
        
        if len(history_data) < 10:
            too_short.append(isin)
            continue
        
        df = pd.DataFrame(history_data)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        df = df.sort_index()
        df = df['nav']
        df = df[df > 0]
        
        if len(df) < 10:
            too_short.append(isin)
            continue
        
        # Calculate
        returns = df.pct_change().dropna()
        if len(returns) < 5:
            too_short.append(isin)
            continue
        
        vol = float(returns.std() * np.sqrt(252))
        
        days = (df.index[-1] - df.index[0]).days
        years = days / 365.25
        if years < 0.5:
            too_short.append(isin)
            continue
        
        total_ret = (df.iloc[-1] / df.iloc[0]) - 1
        cagr = float((1 + total_ret) ** (1 / years) - 1)
        
        sharpe = float(cagr / vol) if vol > 0 else 0.0
        
        rolling_max = df.cummax()
        drawdown = (df / rolling_max) - 1.0
        max_dd = float(drawdown.min())
        
        var_95 = float(np.percentile(returns, 5))
        cvar_returns = returns[returns <= var_95]
        cvar_95 = float(cvar_returns.mean()) if len(cvar_returns) > 0 else var_95
        
        update_data = {
            'std_perf.return': round(cagr, 4),
            'std_perf.volatility': round(vol, 4),
            'std_perf.sharpe': round(sharpe, 4),
            'std_perf.max_drawdown': round(max_dd, 4),
            'std_perf.var95': round(var_95, 4),
            'std_perf.cvar95': round(cvar_95, 4),
            'std_perf.window_points': len(df),
            'std_perf.last_updated': datetime.now().isoformat(),
            'std_perf.last_calculated_at': datetime.now().isoformat(),
        }
        
        if years >= 3:
            update_data['std_perf.cagr3y'] = round(cagr, 4)
        
        db.collection('funds_v3').document(isin).update(update_data)
        updated += 1
        print(f"  ✅ {isin}: vol={vol:.4f}, cagr={cagr:.4f}, sharpe={sharpe:.4f}, mdd={max_dd:.4f} ({len(df)} pts)")
        
    except Exception as e:
        errors.append((isin, str(e)))
        print(f"  ❌ {isin}: {e}")

# Summary
print(f"\n{'=' * 60}")
print(f"RESUMEN")
print(f"{'=' * 60}")
print(f"  Total sin std_perf: {len(missing)}")
print(f"  ✅ Actualizados:    {updated}")
print(f"  📭 Sin histórico:   {len(no_history)}")
print(f"  📏 Historia corta:  {len(too_short)}")
print(f"  ❌ Errores:         {len(errors)}")

if no_history:
    print(f"\n  Fondos SIN histórico en historico_vl_v2:")
    for isin in no_history:
        print(f"    - {isin}")

if too_short:
    print(f"\n  Fondos con historia demasiado corta:")
    for isin in too_short:
        print(f"    - {isin}")

if errors:
    print(f"\n  Errores:")
    for isin, err in errors:
        print(f"    - {isin}: {err}")

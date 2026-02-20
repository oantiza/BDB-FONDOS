
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime

# Add parent directory to path to allow importing services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def initialize():
    try:
        app = firebase_admin.get_app()
    except ValueError:
        if os.path.exists('./serviceAccountKey.json'):
            cred = credentials.Certificate('./serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
        elif os.path.exists('../serviceAccountKey.json'):
             cred = credentials.Certificate('../serviceAccountKey.json')
             firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    return firestore.client()

def recalculate_single(isin):
    db = initialize()
    print(f"Recalculating metrics for {isin}...")
    
    # 1. Get Fund
    fund_ref = db.collection('funds_v3').document(isin)
    doc = fund_ref.get()
    
    if not doc.exists:
        # Try finding by field if ID doesn't match
        print("Doc not found by ID, searching...")
        docs = db.collection('funds_v3').where('isin', '==', isin).limit(1).stream()
        found = False
        for d in docs:
            doc = d
            fund_ref = d.reference
            found = True
            break
        if not found:
            print("Fund not found.")
            return

    fund = doc.to_dict()
    print(f"Fund found: {fund.get('name')} ({doc.id})")
    print(f"Old std_perf: {fund.get('std_perf')}")
    
    # 2. Get History (External only, assuming it's the good one as per investigation)
    h_ref = db.collection('historico_vl_v2').document(doc.id)
    h_doc = h_ref.get()
    
    history_data = []
    
    if h_doc.exists:
        h_d = h_doc.to_dict()
        raw_list = h_d.get('history') or h_d.get('series') or []
        for item in raw_list:
             d_val = item.get('date')
             p_val = item.get('nav') if item.get('nav') is not None else item.get('price')
             if d_val and p_val is not None:
                 history_data.append({'date': d_val, 'nav': p_val})
    else:
        print("No history found in historico_vl_v2.")
        return

    print(f"Found {len(history_data)} points of history.")
    if len(history_data) < 10:
        print("Not enough history.")
        return

    # 3. Calculate (Logic adapted from analytics.py)
    df = pd.DataFrame(history_data)
    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)
    df['nav'] = pd.to_numeric(df['nav'], errors='coerce')
    df.dropna(inplace=True)
    df = df.sort_index()
    df = df['nav']
    df = df[df > 0]
    
    if len(df) < 10:
        print("Not enough valid data points.")
        return

    # Daily Returns
    returns = df.pct_change().dropna()
    
    # Volatility
    vol = returns.std() * np.sqrt(252)
    
    # CAGR
    days = (df.index[-1] - df.index[0]).days
    years = days / 365.25
    
    cagr = 0
    if years > 0.5:
        total_ret = (df.iloc[-1] / df.iloc[0]) - 1
        cagr = (1 + total_ret) ** (1 / years) - 1
        
    # Max Drawdown
    rolling_max = df.cummax()
    drawdown = (df / rolling_max) - 1.0
    max_dd = drawdown.min()
    
    # Sharpe (Simplified)
    sharpe = 0
    if vol > 0:
        sharpe = cagr / vol

    # VaR / CVaR
    var_95_daily = np.percentile(returns, 5)
    cvar_returns = returns[returns <= var_95_daily]
    cvar_95_daily = cvar_returns.mean() if len(cvar_returns) > 0 else var_95_daily

    new_metrics = {
        'std_perf.return': float(round(cagr, 4)),
        'std_perf.volatility': float(round(vol, 4)),
        'std_perf.sharpe': float(round(sharpe, 4)),
        'std_perf.cagr3y': float(round(cagr, 4)) if years >= 3 else fund.get('std_perf', {}).get('cagr3y'),
        'std_perf.max_drawdown': float(round(max_dd, 4)),
        'std_perf.var95': float(round(var_95_daily, 4)),
        'std_perf.cvar95': float(round(cvar_95_daily, 4)),
        'std_perf.last_updated': datetime.now(),
        'std_perf.window_points': len(df)
    }

    # remove None
    new_metrics = {k: v for k, v in new_metrics.items() if v is not None}
    
    print("-" * 20)
    print("New Metrics:")
    for k, v in new_metrics.items():
        print(f"  {k}: {v}")
        
    # Update
    print("Updating Firestore...")
    fund_ref.update(new_metrics)
    print("DONE.")

if __name__ == "__main__":
    # Example usage:
    # recalculate_single('LU1762221155')
    pass

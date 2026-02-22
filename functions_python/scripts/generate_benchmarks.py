import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

# Setup path to import DataFetcher
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from services.data_fetcher import DataFetcher

ISIN_A = 'IE00B18GC888' # Fixed Income
ISIN_B = 'IE00B03HCZ61' # Equity

PROFILES = {
    'CONSERVADOR': {'A': 1.00, 'B': 0.00, 'CASH': 0.00},
    'MODERADO':    {'A': 0.75, 'B': 0.12, 'CASH': 0.13},
    'EQUILIBRADO': {'A': 0.50, 'B': 0.50, 'CASH': 0.00},
    'DINAMICO':    {'A': 0.25, 'B': 0.75, 'CASH': 0.00},
    'AGRESIVO':    {'A': 0.00, 'B': 1.00, 'CASH': 0.00},
}

def get_db():
    try:
        app = firebase_admin.get_app()
    except ValueError:
        cred_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'serviceAccountKey.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print(f"Error: {cred_path} not found")
            return None
    return firestore.client()

def fetch_history_df(db, isin):
    doc = db.collection('historico_vl_v2').document(isin).get()
    if not doc.exists:
        raise ValueError(f"History not found for {isin}")
    
    data = doc.to_dict().get('history', [])
    if not data:
        raise ValueError(f"History array empty for {isin}")
        
    df = pd.DataFrame(data)
    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)
    df.sort_index(inplace=True)
    # Forward fill to handle missing days in one of the series
    return df['nav']

def calculate_metrics(nav_series, rf_rate):
    if len(nav_series) < 10:
        return {}
        
    # Standard 252 trading days approximation
    # Daily Returns
    returns = nav_series.pct_change().dropna()
    
    # Volatility
    vol = returns.std() * np.sqrt(252)
    
    # CAGR
    days = (nav_series.index[-1] - nav_series.index[0]).days
    years = days / 365.25
    cagr = 0
    if years > 0.5:
        total_ret = (nav_series.iloc[-1] / nav_series.iloc[0]) - 1
        cagr = (1 + total_ret) ** (1 / years) - 1
        
    # Max Drawdown
    rolling_max = nav_series.cummax()
    drawdown = (nav_series / rolling_max) - 1.0
    max_dd = drawdown.min()
    
    # VaR / CVaR (Historical 95%)
    var_95_daily = np.percentile(returns, 5)
    cvar_returns = returns[returns <= var_95_daily]
    cvar_95_daily = cvar_returns.mean() if len(cvar_returns) > 0 else var_95_daily

    # --- 3-Year Sharpe Ratio with dynamic Risk-Free Rate ---
    start_date_3y = nav_series.index[-1] - pd.Timedelta(days=1095)
    nav_3y = nav_series[nav_series.index >= start_date_3y]
    
    if not nav_3y.empty and len(nav_3y) > 50:
        returns_3y = nav_3y.pct_change().dropna()
        rf_daily = rf_rate / 252.0
        excess_returns_3y = returns_3y - rf_daily
        
        if excess_returns_3y.std() > 0:
            sharpe_3y = (excess_returns_3y.mean() / excess_returns_3y.std()) * np.sqrt(252)
        else:
            sharpe_3y = 0.0
    else:
        sharpe_3y = 0.0

    return {
        'return': float(round(cagr, 4)),
        'volatility': float(round(vol, 4)),
        'sharpe': float(round(sharpe_3y, 4)),
        'rf_source': float(rf_rate),
        'cagr3y': float(round(cagr, 4)) if years >= 3 else None,
        'max_drawdown': float(round(max_dd, 4)),
        'var95': float(round(var_95_daily, 4)),
        'cvar95': float(round(cvar_95_daily, 4)),
        'window_points': len(nav_series),
        'last_updated': datetime.utcnow()
    }

def main():
    db = get_db()
    if not db:
        print("Could not connect to DB.")
        return

    # Fetch Risk-Free Rate dynamically
    fetcher = DataFetcher(db)
    rf_rate = fetcher.get_dynamic_risk_free_rate()
    print(f"\n📊 Dynamic Risk-Free Rate loaded from ECB: {rf_rate*100:.3f}%")

    print("Fetching histories...")
    try:
         df_a = fetch_history_df(db, ISIN_A)
         df_b = fetch_history_df(db, ISIN_B)
    except Exception as e:
         print(f"Error fetching data: {e}")
         return

    # Merge on date (inner join to common timeline)
    df_merged = pd.concat([df_a, df_b], axis=1, keys=['A', 'B']).dropna()
    print(f"Longest common timeline: {df_merged.index[0].date()} to {df_merged.index[-1].date()} ({len(df_merged)} points)")

    # Calculate returns for each
    ret_a = df_merged['A'].pct_change().fillna(0)
    ret_b = df_merged['B'].pct_change().fillna(0)
    
    results = {}
    
    batch = db.batch()
    benchmarks_ref = db.collection('synthetic_benchmarks')

    for name, weights in PROFILES.items():
        print(f"\n⚙️ Calculating {name}...")
        w_a = weights['A']
        w_b = weights['B']
        w_c = weights['CASH']
        
        # Daily return of the synthesized portfolio
        # Cash returns 0, so it doesn't add to the daily return calculation 
        # (It dampens it: e.g. 87% invested, 13% cash -> portfolio return consists only of the invested 87%)
        synth_ret = (ret_a * w_a) + (ret_b * w_b) # + (0 * w_c)
        
        # Build synthetic NAV starting at 100
        synth_nav = (1 + synth_ret).cumprod() * 100.0
        
        # Format history for saving
        history_list = [
            {"date": idx.strftime('%Y-%m-%d'), "nav": float(round(val, 6))} 
            for idx, val in synth_nav.items()
        ]
        
        # Calculate metrics using full series & rf_rate
        metrics = calculate_metrics(synth_nav, rf_rate)
        
        doc_data = {
            "name": name,
            "weights": {
                 ISIN_A: w_a,
                 ISIN_B: w_b,
                 "CASH": w_c
            },
            "std_perf": metrics,
            "history": history_list,
            "last_updated": datetime.utcnow().isoformat(),
            "currency": "EUR",
            "first_date": df_merged.index[0].strftime('%Y-%m-%d'),
            "last_date": df_merged.index[-1].strftime('%Y-%m-%d')
        }
        
        results[name] = metrics
        
        doc_ref = benchmarks_ref.document(name)
        batch.set(doc_ref, doc_data)
        print(f"✅ Prepared {name} for Firestore.")
        
    print("\nCommiting to Firestore...")
    batch.commit()
    print("Done! Benchmarks inserted successfully.")
    
    # Output markdown table for verification report
    print("\n| Perfil | Retorno (CAGR) | Volatilidad | Sharpe | Max Drawdown |")
    print("|---|---|---|---|---|")
    for name in ['CONSERVADOR', 'MODERADO', 'EQUILIBRADO', 'DINAMICO', 'AGRESIVO']:
         m = results[name]
         print(f"| {name} | {m['return']*100:.2f}% | {m['volatility']*100:.2f}% | {m['sharpe']:.2f} | {m['max_drawdown']*100:.2f}% |")

if __name__ == "__main__":
    main()

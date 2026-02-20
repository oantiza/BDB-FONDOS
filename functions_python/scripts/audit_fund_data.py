
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

def calculate_metrics_from_history(history_list):
    if not history_list or len(history_list) < 10:
        return None
        
    vals = []
    for item in history_list:
        p = item.get('nav') if item.get('nav') is not None else item.get('price')
        d = item.get('date')
        if p and d:
            vals.append({'date': d, 'nav': float(p)})
            
    if not vals: 
        return None
        
    df = pd.DataFrame(vals)
    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)
    df = df.sort_index()
    # Handle duplicates
    df = df[~df.index.duplicated(keep='last')]
    
    # Calculate returns
    df['returns'] = df['nav'].pct_change()
    df.dropna(inplace=True)
    
    if len(df) < 5: return None
    
    # Check for extreme anomalies (e.g. > 50% drop in one day)
    min_ret = df['returns'].min()
    max_ret = df['returns'].max()
    has_anomaly = min_ret < -0.5 or max_ret > 0.5
    
    # Volatility
    vol = df['returns'].std() * np.sqrt(252)
    
    # CAGR
    years = (df.index[-1] - df.index[0]).days / 365.25
    cagr = 0
    if years > 0.5:
        total_ret = (df['nav'].iloc[-1] / df['nav'].iloc[0]) - 1
        cagr = (1 + total_ret) ** (1/years) - 1
        
    # Max Drawdown
    roll_max = df['nav'].cummax()
    dd = (df['nav'] / roll_max) - 1
    max_dd = dd.min()
    
    # Sharpe (assuming Rf=0 for simplicity in audit)
    sharpe = cagr / vol if vol > 0 else 0
    
    return {
        'volatility': vol,
        'cagr': cagr,
        'max_drawdown': max_dd,
        'sharpe': sharpe,
        'points': len(df),
        'has_anomaly': has_anomaly,
        'min_daily_ret': min_ret,
        'max_daily_ret': max_ret,
        'last_date': df.index[-1]
    }

def audit_funds():
    db = initialize()
    print("Starting Audit...")
    
    funds = db.collection('funds_v3').stream()
    
    report = []
    
    count = 0
    for doc in funds:
        count += 1
        data = doc.to_dict()
        isin = data.get('isin', doc.id)
        name = data.get('name', 'Unknown')
        std_perf = data.get('std_perf')
        
        # 1. Fetch History
        history = data.get('returns_history') # check embedded
        source = 'embedded'
        
        if not history:
             # Check external
             h_doc = db.collection('historico_vl_v2').document(doc.id).get()
             if h_doc.exists:
                 h_data = h_doc.to_dict()
                 history = h_data.get('history') or h_data.get('series')
                 source = 'external'
                 
        if not history:
            report.append({
                'isin': isin, 'name': name, 'issue': 'MISSING_HISTORY',
                'std_perf_exists': bool(std_perf)
            })
            continue

        if isinstance(history, dict):
             # Convert map
             history = [{'date': k, 'nav': v} for k, v in history.items()]
             
        # 2. Recalculate
        calc = calculate_metrics_from_history(history)
        
        if not calc:
            report.append({
                'isin': isin, 'name': name, 'issue': 'HISTORY_TOO_SHORT_OR_INVALID',
                'points': len(history) if history else 0
            })
            continue
            
        if calc['has_anomaly']:
             report.append({
                'isin': isin, 'name': name, 'issue': 'DATA_ANOMALY',
                'details': f"Min Ret: {calc['min_daily_ret']:.2%}, Max Ret: {calc['max_daily_ret']:.2%}"
            })
            
        # 3. Compare with std_perf
        if std_perf:
            stored_dd = std_perf.get('max_drawdown')
            stored_vol = std_perf.get('volatility')
            
            # Check Max Drawdown Diff
            if stored_dd is not None:
                diff = abs(stored_dd - calc['max_drawdown'])
                if diff > 0.1: # 10% difference
                    report.append({
                        'isin': isin, 'name': name, 'issue': 'METRIC_MISMATCH_DD',
                        'stored': stored_dd, 'calculated': calc['max_drawdown'],
                        'diff': diff
                    })
                    
            # Check Volatility Diff
            if stored_vol is not None:
                diff = abs(stored_vol - calc['volatility'])
                if diff > 0.05: # 5% difference
                    report.append({
                        'isin': isin, 'name': name, 'issue': 'METRIC_MISMATCH_VOL',
                        'stored': stored_vol, 'calculated': calc['volatility'],
                        'diff': diff
                    })
        else:
             report.append({
                'isin': isin, 'name': name, 'issue': 'MISSING_STD_PERF',
                'available_points': calc['points']
            })
            
        if count % 100 == 0:
            print(f"Processed {count} funds...")
            
    # Print Report
    print("\n" + "="*30)
    print("AUDIT REPORT SUMMARY")
    print("="*30)
    
    df_rep = pd.DataFrame(report)
    if not df_rep.empty:
        print(f"Total Issues Found: {len(df_rep)}")
        print(df_rep['issue'].value_counts())
        
        print("\nTop 20 Issues:")
        print(df_rep.head(20).to_string())
        
        # Save to CSV
        df_rep.to_csv('audit_results.csv', index=False)
        print("\nFull report saved to audit_results.csv")
    else:
        print("No significant discrepancies found!")

if __name__ == "__main__":
    audit_funds()


import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os
import sys
import pandas as pd
import numpy as np

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

def fix_anomalies_for_fund(db, isin, name):
    print(f"\nProcessing {name} ({isin})...")
    
    # Get History
    h_ref = db.collection('historico_vl_v2').document(isin)
    h_doc = h_ref.get()
    
    if not h_doc.exists:
        print("  History document not found (unexpected).")
        return False
        
    h_data = h_doc.to_dict()
    # Check both fields
    series_field = 'history' if 'history' in h_data else 'series'
    raw_list = h_data.get(series_field, [])
    
    if not raw_list:
        print(f"  No data in '{series_field}'.")
        return False
        
    # Convert to DF for analysis
    vals = []
    for item in raw_list:
        p = item.get('nav') if item.get('nav') is not None else item.get('price')
        d = item.get('date')
        if p and d:
            vals.append({'date': d, 'nav': float(p), 'original': item})
            
    if not vals: return False
    
    df = pd.DataFrame(vals)
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')
    df = df.set_index('date')
    
    # Calc returns
    df['pct'] = df['nav'].pct_change()
    
    # Detect Anomalies (> 50% change)
    threshold = 0.5
    anomalies = df[ (df['pct'] > threshold) | (df['pct'] < -threshold) ]
    
    if anomalies.empty:
        print("  No anomalies detected with 50% threshold via pandas (maybe solved?).")
        return False
        
    print(f"  Found {len(anomalies)} anomalies.")
    print(anomalies[['nav', 'pct']])
    
    first_anomaly_date = anomalies.index.min()
    print(f"  First anomaly detected at: {first_anomaly_date}")
    
    # Strategy: Truncate history from the first anomaly date onwards.
    # This handles "step" errors where the data jumps and stays wrong.
    
    cutoff_date_str = first_anomaly_date.strftime('%Y-%m-%d')
    print(f"  Truncating history after {cutoff_date_str} (inclusive)...")
    
    new_list = []
    removed_count = 0
    
    for item in raw_list:
        d_str = item.get('date')
        if not d_str: continue
        
        # Simple string comparison works for ISO dates
        if d_str < cutoff_date_str:
            new_list.append(item)
        else:
            removed_count += 1
            
    print(f"  Removing {removed_count} points (tail)...")
    
    # Update DB
    # We keep the same field we read from
    h_ref.update({series_field: new_list})
    print("  ✅ Update successful.")
    return True

def run_fix():
    # Read audit results
    try:
        audit_df = pd.read_csv('audit_results.csv')
    except FileNotFoundError:
        print("audit_results.csv not found. Run audit first.")
        return

    anomalies_df = audit_df[audit_df['issue'] == 'DATA_ANOMALY']
    
    if anomalies_df.empty:
        print("No DATA_ANOMALY found in audit results.")
        return
        
    print(f"Found {len(anomalies_df)} funds to fix.")
    
    db = initialize()
    
    processed_isins = []
    
    for _, row in anomalies_df.iterrows():
        isin = row['isin']
        name = row['name']
        if fix_anomalies_for_fund(db, isin, name):
            processed_isins.append(isin)
            
    print("\n" + "="*30)
    print("FIX SUMMARY")
    print(f"Fixed {len(processed_isins)} funds.")
    if processed_isins:
        print(f"ISINs: {processed_isins}")
        # Save to CSV for next step
        pd.DataFrame({'isin': processed_isins}).to_csv('fixed_anomalies.csv', index=False)

if __name__ == "__main__":
    run_fix()

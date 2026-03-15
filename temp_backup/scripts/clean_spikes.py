import os
import sys
import pandas as pd
import numpy as np

import firebase_admin
from firebase_admin import credentials, firestore

# Init firebase
cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
try:
    cred = credentials.Certificate(cred_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
except Exception as e:
    print(f"Failed to initialize firebase: {e}")
    sys.exit(1)

db = firestore.client()

def clean_fund_data(isin, dry_run=True):
    doc_ref = db.collection('historico_vl_v2').document(isin)
    doc = doc_ref.get()
    
    if not doc.exists:
        return 0
        
    data = doc.to_dict()
    history = data.get('history') or data.get('points')
    
    if not history:
        return 0
        
    dates = []
    prices = []
    
    # Parse history 
    is_dict_format = isinstance(history, dict)
    
    if is_dict_format:
        for k, v in history.items():
            try:
                dates.append(pd.to_datetime(k))
                prices.append(float(v))
            except:
                pass
    elif isinstance(history, list):
         for item in history:
             try:
                 if 'date' in item and 'nav' in item:
                      dates.append(pd.to_datetime(item['date']))
                      prices.append(float(item['nav']))
                 elif 'timestamp' in item and 'price' in item:
                      d = item['timestamp']
                      if hasattr(d, 'isoformat'): d = d.isoformat()
                      dates.append(pd.to_datetime(d))
                      prices.append(float(item['price']))
             except:
                 pass
                 
    if not dates:
        return 0
        
    df = pd.DataFrame({'price': prices}, index=dates).sort_index()
    
    # Calculate returns to find spikes
    returns = df['price'].pct_change()
    
    # A point is likely a glitch if it drops heavily and then recovers heavily the next day.
    # More generally, any daily return > 25% or < -25% is highly suspicious for mutual funds.
    # To be safe, we will identify points that deviate massively from the rolling median.
    
    # Rolling median over 10 days (5 before, 5 after)
    rolling_median = df['price'].rolling(window=11, center=True, min_periods=3).median()
    
    # If the price is more than 30% away from its local median, it's a spike.
    deviation = np.abs(df['price'] - rolling_median) / rolling_median
    
    anomaly_mask = deviation > 0.30  # 30% deviation from local median
    
    anomalies = df[anomaly_mask]
    
    if len(anomalies) == 0:
        return 0
        
    print(f"\n==============================")
    print(f"Fund {isin}: Found {len(anomalies)} anomalies")
    
    for date, row in anomalies.iterrows():
        print(f"  [ANOMALY] {date.date()}: Price={row['price']:.4f} (Local Median={rolling_median.loc[date]:.4f})")
    
    if not dry_run:
        # We need to remove these points from the document
        clean_df = df[~anomaly_mask]
        
        # Reconstruct the history object in the same format it was originally
        new_history = None
        if is_dict_format:
            new_history = {str(k.date()): float(v) for k, v in clean_df['price'].items()}
        else:
            # List format
            new_history = []
            for item in history:
                date_str = None
                if 'date' in item: date_str = item['date']
                elif 'timestamp' in item:
                    d = item['timestamp']
                    if hasattr(d, 'isoformat'): date_str = d.isoformat()
                    else: date_str = str(d)
                
                if date_str:
                    try:
                        parsed_date = pd.to_datetime(date_str)
                        if parsed_date not in anomalies.index:
                            new_history.append(item)
                    except:
                        new_history.append(item) # keep unparseable just in case
        
        # Update Firestore
        field_to_update = 'history' if 'history' in data else 'points'
        doc_ref.update({
            field_to_update: new_history
        })
        print(f"  -> Cleaned data saved to Firestore for {isin}")
        
    return len(anomalies)

if __name__ == '__main__':
    print("--- FIXING SPIKES (Applying changes to DB) ---")
    
    # 1. Check Valentum specifically
    clean_fund_data('ES0182769002', dry_run=False)
    
    # 2. Check all other funds
    print("\nScanning all funds...")
    funds = db.collection('historico_vl_v2').stream()
    
    total_anomalies = 0
    funds_with_anomalies = 0
    
    for doc in funds:
        isin = doc.id
        if isin == 'ES0182769002': continue # already checked
        
        count = clean_fund_data(isin, dry_run=False)
        if count > 0:
            total_anomalies += count
            funds_with_anomalies += 1
            
    print(f"\n==============================")
    print(f"Summary: Cleaned {total_anomalies} anomalies across {funds_with_anomalies} funds.")

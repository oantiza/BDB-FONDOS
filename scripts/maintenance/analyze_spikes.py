"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: maintenance
PURPOSE: Utility script: analyze_spikes.py
SAFE_MODE: REVIEW
RUN: python scripts/maintenance/analyze_spikes.py
"""

import os
import sys
import pandas as pd

import firebase_admin
from firebase_admin import credentials, firestore

# init firebase using explicit service account
cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)

db = firestore.client()

def check_fund(isin):
    print(f"\n==============================")
    print(f"Checking fund: {isin}")
    
    doc_ref = db.collection('historico_vl_v2').document(isin)
    doc = doc_ref.get()
    
    if not doc.exists:
        print(f"Fund {isin} not found in historico_vl_v2")
        return False
        
    data = doc.to_dict()
    # history_writer format puts data in 'history', previously 'points'
    history = data.get('history') or data.get('points')
    
    if not history:
        print(f"Fund {isin} has no history in doc")
        return False
        
    print(f"Found {len(history)} data points")
    
    # Convert to series
    dates = []
    prices = []
    
    # history can be list of dicts or dict of date->price
    if isinstance(history, dict):
        for k, v in history.items():
            try:
                dates.append(pd.to_datetime(k))
                prices.append(float(v))
            except:
                pass
    elif isinstance(history, list):
         for item in history:
             try:
                 # Check 'date' or timestamp in item
                 if 'date' in item and 'nav' in item:
                      dates.append(pd.to_datetime(item['date']))
                      prices.append(float(item['nav']))
                 elif 'timestamp' in item and 'price' in item:
                      # Check if timestamp is datetime obj or string
                      d = item['timestamp']
                      if hasattr(d, 'isoformat'): d = d.isoformat()
                      dates.append(pd.to_datetime(d))
                      prices.append(float(item['price']))
             except Exception as e:
                 pass
            
    if not dates:
        print("Empty converted data")
        return False
        
    df = pd.DataFrame({'price': prices}, index=dates).sort_index()
    print(f"Data ranges from {df.index.min().date()} to {df.index.max().date()}")
    
    # Calculate daily returns
    returns = df['price'].pct_change().dropna()
    
    has_spike = False
    
    if len(returns) > 0:
        max_ret = returns.max()
        min_ret = returns.min()
        print(f"Max daily return: {max_ret * 100:.2f}%")
        print(f"Min daily return: {min_ret * 100:.2f}%")
        
        if max_ret > 0.15 or min_ret < -0.15:
            has_spike = True
            print("\n⚠️ ANOMALIES DETECTED (>15% or <-15%):")
            anomalies = returns[(returns > 0.15) | (returns < -0.15)]
            for date, ret in anomalies.items():
                price = df.loc[date, 'price']
                prev_price = df['price'].shift(1).loc[date]
                print(f"   [{date.date()}] Return: {ret*100:.2f}%  (Price: {prev_price:.4f} -> {price:.4f})")
    
    return has_spike

if __name__ == '__main__':
    # 1. Check Valentum
    check_fund('ES0182769002')
    
    print("\nScanning 50 random funds for similar spikes...")
    # 2. Check 50 random funds to answer "comprueba si pasa en mas fondos"
    funds = db.collection('funds_v3').limit(50).stream()
    spike_funds = []
    
    for doc in funds:
        isin = doc.id
        if isin == 'ES0182769002': continue
        if check_fund(isin):
            spike_funds.append(isin)
            
    print("\n==============================")
    print(f"Funds with anomalies among those sampled: {len(spike_funds)}")
    if spike_funds:
        print(", ".join(spike_funds))

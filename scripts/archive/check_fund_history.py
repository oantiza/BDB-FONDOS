"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: check_fund_history.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/check_fund_history.py
"""

import os
import sys
from datetime import datetime
import pandas as pd

# Try to initialize Firebase
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    # Check if already initialized
    if not firebase_admin._apps:
        # We need service account or ADC
        # Assume ADC is set or try passing default credentials
        # It's usually better to just use firestore.Client() which auto-resolves ADC
        pass
    db = firestore.Client(project="bdb-fondos")
except Exception as e:
    print(f"Failed to intialize firestore: {e}")
    sys.exit(1)

def check_fund(isin):
    print(f"Checking fund: {isin}")
    
    doc_ref = db.collection('funds_v3').document(isin)
    doc = doc_ref.get()
    
    if not doc.exists:
        print(f"Fund {isin} not found in funds_v3")
        return
        
    data = doc.to_dict()
    history = data.get('returns_history', {})
    
    if not history:
        print(f"Fund {isin} has no returns_history")
        return
        
    print(f"Found {len(history)} data points")
    
    # Convert to series
    dates = []
    prices = []
    
    for k, v in history.items():
        try:
            # k is usually YYYY-MM-DD
            dates.append(pd.to_datetime(k))
            prices.append(float(v))
        except:
            pass
            
    if not dates:
        print("Empty converted data")
        return
        
    df = pd.DataFrame({'price': prices}, index=dates).sort_index()
    print(f"Data ranges from {df.index.min().date()} to {df.index.max().date()}")
    
    # Calculate daily returns
    returns = df['price'].pct_change().dropna()
    print(f"Max daily return: {returns.max() * 100:.2f}%")
    print(f"Min daily return: {returns.min() * 100:.2f}%")
    print(f"Number of returns > 10%: {(returns > 0.10).sum()}")
    print(f"Number of returns < -10%: {(returns < -0.10).sum()}")
    
    # Print the biggest spikes
    print("\nBiggest positive spikes:")
    print(returns.nlargest(5) * 100)
    
    print("\nBiggest negative spikes:")
    print(returns.nsmallest(5) * 100)
    
    # Also check if it looks like price splits (where price halves or drops 90% without reason)
    # Check if there are days where return is > 2000% or something completely broken
    if (returns > 0.50).sum() > 0:
         print("\n⚠️ Found returns > 50%!")
         
    if (returns < -0.30).sum() > 0:
         print("\n⚠️ Found returns < -30%!")

if __name__ == '__main__':
    check_fund('ES0182769002')

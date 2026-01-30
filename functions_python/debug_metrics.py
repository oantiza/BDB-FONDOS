
import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import numpy as np
import os
import sys

# Setup path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.data_fetcher import DataFetcher
from services.financial_engine import FinancialEngine

def debug_metrics():
    # 1. Init Firestore
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    
    # 2. Pick a known asset (or list) from funds_v3
    print("Fetching sample assets...")
    docs = db.collection('funds_v3').limit(3).stream()
    assets = [d.id for d in docs]
    print(f"Assets: {assets}")
    
    # 3. Test DataFetcher (Strict vs Loose)
    fetcher = DataFetcher(db)
    
    print("\n--- TEST 1: DataFetcher Strict (Weekly) ---")
    df_strict, _ = fetcher.get_price_data(assets, resample_freq='W-FRI')
    print(f"Df Strict Shape: {df_strict.shape}")
    if not df_strict.empty:
        print(df_strict.head())
        # Calculate naive annualized return
        total_ret = (df_strict.iloc[-1] / df_strict.iloc[0]) - 1
        print("Total Return (Period):")
        print(total_ret)
        
        # Calculate EMA manually
        from pypfopt import expected_returns
        mu_52 = expected_returns.ema_historical_return(df_strict, frequency=52, span=52)
        mu_252 = expected_returns.ema_historical_return(df_strict, frequency=252, span=252) # Wrong way
        
        print("\n--- TEST 2: Financial Engine (Returns) ---")
        print("Calculated Annualized Return (Freq=52):")
        print(mu_52)
        print("Calculated Annualized Return (Freq=252) [WRONG?]:")
        print(mu_252)
        
        if mu_252.mean() > 1.0:
            print("🚨 High Return detected with Freq=252. This matches the bug report (196%).")
            
        if mu_52.mean() < 0.5:
             print("✅ Normal Return detected with Freq=52.")

    else:
        print("❌ Df Strict is EMPTY! This matches 'Missing Charts' bug if strict is used for charts.")

if __name__ == "__main__":
    debug_metrics()

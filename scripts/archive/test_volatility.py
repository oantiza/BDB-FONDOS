"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: test_volatility.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/test_volatility.py
"""

import os
import pandas as pd
import numpy as np
from firebase_admin import credentials, initialize_app, firestore
from services.data_fetcher import DataFetcher
from services.portfolio.utils import apply_market_proxy_backfill

try:
    cred = credentials.Certificate(r'c:\Users\oanti\Documents\BDB-FONDOS\serviceAccountKey.json')
    initialize_app(cred)
except Exception:
    pass

db = firestore.client()

assets = [
    "ES0144292008", # Hamco SICAV - Global Value R EUR Acc
    "ES0176462008", # SIH Capital FI 
    "ES0138531015", # Fondibas FI 
    "LU1075211516", # Invesco Pan European High Income Fund
    "ES0162735037", # Merch-Universal FI
    "ES0176466009", # SIH Healthcare 
    "LU0505655562", # DPAM B - Equities US
    "ES0162740003", # Merchbanc FCP Renta Fija Flex A
    "LU0348783233", # Allianz Oriental Income
    "LU0318931192", # Fidelity China Focus
    "LU0261950470", # Fidelity European Dividend
    "LU0232524495", # THE FUND WITH >80% VOLATILITY
]

print("Fetching historical data...")
fetcher = DataFetcher(db)
price_data, synthetic_used = fetcher.get_price_data(assets, resample_freq='D', strict=False, no_fill=True)

df = pd.DataFrame(price_data)
df.index = pd.to_datetime(df.index)
df = df.sort_index()

ideal_start = df.index[-1] - pd.Timedelta(days=1095)
df = df[df.index >= ideal_start]

print(f"Data shape after 3y truncation: {df.shape}")

print("\n--- Before Backfill ---")
returns_before = df.pct_change().dropna(how='all')
vol_before = returns_before.std() * np.sqrt(252)
for asset in assets:
    if asset in vol_before:
        print(f"[{asset}] Volatility BEFORE: {vol_before[asset]*100:.2f}% (NaNs: {df[asset].isna().sum()})")

print("\nApplying market proxy backfill...")
import warnings
warnings.filterwarnings('ignore')
df_filled = apply_market_proxy_backfill(df.copy()) # metadata absent for quick test

print("\n--- After Backfill ---")
returns_after = df_filled.pct_change().dropna(how='all')
vol_after = returns_after.std() * np.sqrt(252)
for asset in assets:
    if asset in vol_after:
        print(f"[{asset}] Volatility AFTER: {vol_after[asset]*100:.2f}% (NaNs: {df_filled[asset].isna().sum()})")

print("\nChecking LU0232524495 anomalies:")
if "LU0232524495" in df_filled:
    series = df_filled["LU0232524495"].dropna()
    returns = series.pct_change().dropna()
    print("Largest positive daily returns:")
    print(returns.nlargest(5) * 100)
    print("\nLargest negative daily returns:")
    print(returns.nsmallest(5) * 100)
    
    print("\nPrices around the largest jump:")
    max_jump_date = returns.idxmax()
    if pd.notna(max_jump_date):
        idx = series.index.get_loc(max_jump_date)
        start = max(0, idx - 2)
        end = min(len(series), idx + 3)
        print(series.iloc[start:end])

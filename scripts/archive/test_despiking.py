"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: test_despiking.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/test_despiking.py
"""

import os
import pandas as pd
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore
from services.data_fetcher import DataFetcher

cred = credentials.Certificate('serviceAccountKey.json')
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()
fetcher = DataFetcher(db)

print("Fetching LU0232524495 only to see if anomaly_mask triggers...")
df, _ = fetcher.get_price_data(["LU0232524495"], no_fill=True)
print("Tail 10 rows:")
print(df.tail(10))

ret = df.pct_change()
print("Max return:", ret.max().iloc[0])
print("Is any > 0.25?", (np.abs(ret) > 0.25).any().any())

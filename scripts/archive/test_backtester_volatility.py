"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: test_backtester_volatility.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/test_backtester_volatility.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
import json
import sys

# Replace with the path to your service account key
cred = credentials.Certificate("C:/Users/oanti/Documents/BDB-FONDOS/functions_python/service-account.json")
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Fix path for imports
sys.path.append("C:/Users/oanti/Documents/BDB-FONDOS/functions_python")

from services.backtester import run_multi_period_backtest

# Let's create a portfolio similar to what the user might generate
portfolio = [
    {'isin': 'LU0835722488', 'weight': 25.0},
    {'isin': 'ES0182769002', 'weight': 25.0},
    {'isin': 'LU1769941003', 'weight': 25.0},
    {'isin': 'IE000MI53C66', 'weight': 25.0} # A known one from the logs
]

print("Running backtest...")
result = run_multi_period_backtest(portfolio, ['3y'], db)

print(json.dumps(result, indent=2))

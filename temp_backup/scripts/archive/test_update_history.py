import os
import sys

# Add functions_python to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'functions_python')))

import firebase_admin
from firebase_admin import credentials, firestore

firebase_admin.initialize_app()
db = firestore.client()

from services.nav_fetcher import update_single_fund_history

funds_to_test = ['ES0142046038', 'ES0141116030', 'ES0131462022', 'AAAAAAAAAAA']

for isin in funds_to_test:
    print(f"\n--- Testing update for {isin} ---")
    try:
        res = update_single_fund_history(db, isin, mode='merge')
        print("Result:", res)
    except Exception as e:
        print("Error:", e)

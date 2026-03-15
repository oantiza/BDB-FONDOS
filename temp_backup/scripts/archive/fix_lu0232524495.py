import os
import firebase_admin
from firebase_admin import credentials, firestore
from services.nav_fetcher import update_single_fund_history

# Initialize Firebase (Using local emulator or service account)
cred = credentials.Certificate('serviceAccountKey.json')
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

fund_isin = "LU0232524495"
print(f"Cleaning out old anomalous data for {fund_isin}")

# We just delete the specific anomalous data point so the next fetch repopulates it via EODHD.
# Actually, the best way in V2 is to delete all data since the anomaly and refetch it.
try:
    doc_ref = db.collection('historico_vl_v2').document(fund_isin)
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        history = data.get('history', [])
        # Find index of the first anomaly day (around 2026-02-27 or late Feb 2026)
        # Delete history from 2026-02-20 onwards to be safe
        clean_history = [p for p in history if p['date'] < '2026-02-20']
        
        doc_ref.update({'history': clean_history})
        print(f"Deleted {len(history) - len(clean_history)} corrupted daily points.")
    else:
        print(f"No history found for {fund_isin}")
except Exception as e:
    print(f"Error accessing DB: {e}")

print("Triggering history update using EODHD API...")
# Set final update date to forcing refetch
db.collection('historico_navs').document(fund_isin).set({'latest_nav_date': None}, merge=True)
result = update_single_fund_history(db, fund_isin, mode='overwrite')
print(f"Update complete: {result}")

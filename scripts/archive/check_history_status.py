"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: check_history_status.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/check_history_status.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import json

firebase_admin.initialize_app()
db = firestore.client()

print("🔍 Checking funds history in historico_vl_v2...")

# Get 50 funds to check their history latest date
docs = list(db.collection('historico_vl_v2').limit(50).stream())
print(f"Found {len(docs)} documents.")

total_docs = 0
up_to_date_docs = 0
missing_history = 0

today = datetime.now()

for doc in docs:
    data = doc.to_dict()
    total_docs += 1
    
    isin = doc.id
    history = data.get('history', [])
    updated_at = data.get('updated_at')
    last_updated = data.get('last_updated')
    
    if not history:
        # Some items might not have 'history' as a field but a different structure.
        print(f"[{isin}] ❌ No 'history' array found.")
        missing_history += 1
        continue
        
    last_entry = history[-1]
    
    last_date_str = last_entry.get('date')
    if last_date_str:
        try:
            last_date = datetime.strptime(last_date_str, "%Y-%m-%d")
            days_diff = (today - last_date).days
            
            # If within last 7 days, consider up to date
            status = "✅" if days_diff <= 7 else "⚠️"
            if days_diff <= 7:
                up_to_date_docs += 1
                
            print(f"[{isin}] {status} Last date: {last_date_str} ({days_diff} days ago). Total points: {len(history)}.")
        except Exception as e:
            print(f"[{isin}] ❌ Error parsing date {last_date_str}: {e}")
    else:
        print(f"[{isin}] ❌ No 'date' in last entry: {last_entry}")

print("\n--- Summary ---")
print(f"Total checked: {total_docs}")
print(f"Up to date (<= 7 days): {up_to_date_docs}")
print(f"Missing history array: {missing_history}")

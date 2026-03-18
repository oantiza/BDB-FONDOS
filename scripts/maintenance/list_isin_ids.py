"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: maintenance
PURPOSE: Utility script: list_isin_ids.py
SAFE_MODE: REVIEW
RUN: python scripts/maintenance/list_isin_ids.py
"""

import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'bdb-fondos'})

db = firestore.client()

print("--- funds_v3 (first 50) ---")
docs = db.collection('funds_v3').limit(50).stream()
for doc in docs:
    print(doc.id)

print("\n--- historico_vl_v2 (first 50) ---")
docs = db.collection('historico_vl_v2').limit(50).stream()
for doc in docs:
    print(doc.id)

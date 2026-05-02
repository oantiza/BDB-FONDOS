"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: inspect_refresh_results.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/inspect_refresh_results.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
import json
from datetime import datetime

def datetime_converter(o):
    if isinstance(o, datetime):
        return o.isoformat()

def main():
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        try:
            firebase_admin.initialize_app(cred, {'projectId': 'bdb-fondos'})
        except:
            firebase_admin.initialize_app()
            
    db = firestore.client()
    
    print("\n🔎 INSPECTING REFRESH RESULTS\n")
    
    # 1. Status
    print("--- config/daily_refresh_status ---")
    doc_status = db.collection('config').document('daily_refresh_status').get()
    if doc_status.exists:
        print(json.dumps(doc_status.to_dict(), default=datetime_converter, indent=2))
    else:
        print("❌ Document not found!")

    # 2. Candidates
    print("\n--- config/auto_complete_candidates ---")
    doc_cand = db.collection('config').document('auto_complete_candidates').get()
    if doc_cand.exists:
        data = doc_cand.to_dict()
        isins = data.get('equity90_isins', [])
        print(f"Criteria: {data.get('criteria')}")
        print(f"Count: {len(isins)}")
        print(f"Top 10: {isins[:10]}")
    else:
        print("❌ Document not found!")

if __name__ == '__main__':
    main()

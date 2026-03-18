"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: maintenance
PURPOSE: Utility script: verify_history.py
SAFE_MODE: REVIEW
RUN: python scripts/maintenance/verify_history.py
"""

import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta

import warnings
warnings.filterwarnings('ignore')

cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
cred = credentials.Certificate(cred_path)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

def verify_history_writer():
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from functions_python.services.history_writer import write_history_canonical
    print("--- VERIFICATION: Backend History Writer Atomicity ---")
    
    isin = "TEST_MERGE_01"
    
    # 1. Simulate an old history block
    old_history = [
        {"date": "2020-01-01", "nav": 10.0},
        {"date": "2020-02-01", "nav": 11.0}
    ]
    doc_ref = db.collection('historico_vl_v2').document(isin)
    doc_ref.set({"history": old_history, "schema_version": 3})
    
    # 2. Add an incremental block (should merge, not overwrite)
    new_history = [
        {"date": "2020-03-01", "nav": 12.0},
        {"date": "2020-04-01", "nav": 13.0}
    ]
    
    count = write_history_canonical(db, isin, new_history, "Test", "Test")
    
    # 3. Read back and verify it has 4 items
    final_doc = doc_ref.get().to_dict()
    final_history = final_doc.get("history", [])
    
    assert len(final_history) == 4, f"Merge Failed! Expected 4, got {len(final_history)}"
    
    dates = [item["date"] for item in final_history]
    assert "2020-01-01" in dates and "2020-04-01" in dates, "Missing Dates!"
    
    # Clean up test
    doc_ref.delete()
    print("✅ Backward Compatibility & Atomic Merge VERIFIED.")

if __name__ == '__main__':
    verify_history_writer()

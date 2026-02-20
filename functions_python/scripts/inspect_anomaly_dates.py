
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os
import sys
import pandas as pd

# Add parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def initialize():
    try:
        app = firebase_admin.get_app()
    except ValueError:
        if os.path.exists('./serviceAccountKey.json'):
            cred = credentials.Certificate('./serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
        elif os.path.exists('../serviceAccountKey.json'):
             cred = credentials.Certificate('../serviceAccountKey.json')
             firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    return firestore.client()

def inspect_around_date(db, isin, target_date_str):
    print(f"Inspecting {isin} around {target_date_str}...")
    doc = db.collection('historico_vl_v2').document(isin).get()
    if not doc.exists:
        print("Doc not found")
        return
        
    data = doc.to_dict()
    history = data.get('history') or data.get('series') or []
    
    # Sort
    history.sort(key=lambda x: x.get('date', ''))
    
    # Find index
    target_idx = -1
    for i, item in enumerate(history):
        if item.get('date') == target_date_str:
            target_idx = i
            break
            
    # If not found (maybe removed), value closest
    if target_idx == -1:
        print("Target date NOT found in history (it was removed?). Showing surrounding points:")
        # Show points around that date
        for item in history:
            if item.get('date') > '2026-01-25' and item.get('date') < '2026-02-15':
                print(item)
    else:
        print(f"Target date found at index {target_idx}")
        start = max(0, target_idx - 5)
        end = min(len(history), target_idx + 6)
        for i in range(start, end):
            print(f"{i}: {history[i]}")

if __name__ == "__main__":
    db = initialize()
    inspect_around_date(db, 'LU1697017686', '2026-02-04')

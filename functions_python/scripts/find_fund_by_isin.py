
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os

def initialize():
    try:
        app = firebase_admin.get_app()
    except ValueError:
        # Check for service account in typical location
        if os.path.exists('./serviceAccountKey.json'):
            cred = credentials.Certificate('./serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
        # Check one level up (common in this repo structure)
        elif os.path.exists('../serviceAccountKey.json'):
             cred = credentials.Certificate('../serviceAccountKey.json')
             firebase_admin.initialize_app(cred)
        else:
            print("No serviceAccountKey.json found. Trying default credentials...")
            firebase_admin.initialize_app()
    return firestore.client()

def find_fund():
    db = initialize()
    print("Searching for LU1762221155 in funds_v3...")
    
    # Try direct ID get first (just in case)
    doc_ref = db.collection('funds_v3').document('LU1762221155')
    doc = doc_ref.get()
    if doc.exists:
        print(f"FOUND by ID: {doc.id}")
        print_data(doc, db)
        return

    # Scan collection (inefficient but effective for debugging if query fails)
    # limit to 1000 to avoid long waits, but enough to likely find it
    docs = db.collection('funds_v3').stream()
    
    found = False
    count = 0
    for doc in docs:
        count += 1
        data = doc.to_dict()
        isin = data.get('isin', '')
        name = data.get('name', '')
        
        if 'LU1762221155' in str(isin) or 'LU1762221155' in doc.id:
            print(f"FOUND matching fund: ID={doc.id}, Name={name}, ISIN={isin}")
            print_data(doc, db)
            found = True
            break
            
    if not found:
        print(f"Scanned {count} documents. Fund NOT FOUND.")

def print_data(doc, db):
    data = doc.to_dict()
    print("-" * 30)
    print(f"Name: {data.get('name')}")
    print(f"ISIN: {data.get('isin')}")
    
    # Check returns history
    history = data.get('returns_history')
    yearly = data.get('yearly_returns')
    
    if history:
        print(f"returns_history type: {type(history)}")
        if isinstance(history, dict):
             print(f"returns_history keys: {len(history)} items")
             sorted_keys = sorted(history.keys())
             print(f"First 10 keys: {sorted_keys[:10]}")
             print(f"Last 10 keys: {sorted_keys[-10:]}")
             for k in sorted_keys[-10:]:
                 print(f"  {k}: {history[k]}")
    elif yearly:
         print(f"yearly_returns list: {len(yearly)} items")
         if len(yearly) > 0:
             print(f"First 5: {yearly[:5]}")
    else:
        print("NO RETURNS HISTORY DATA")
        
    # Check subcollections
    if hasattr(doc, 'reference'):
        collections = doc.reference.collections()
        print("Subcollections:")
        for col in collections:
            print(f"  - {col.id}")
            # If history subcollection, peek
            if col.id in ['history', 'prices', 'returns']:
                 print("    Peeking...")
                 subdocs = list(col.limit(5).stream())
                 for sd in subdocs:
                     print(f"    {sd.id}: {sd.to_dict()}")

    # Check external history in historico_vl_v2
    print("-" * 30)
    print("Checking historico_vl_v2...")
    h_ref = db.collection('historico_vl_v2').document(doc.id)
    h_doc = h_ref.get()
    if h_doc.exists:
        h_data = h_doc.to_dict()
        print("Found in historico_vl_v2!")
        raw_list = h_data.get('history') or h_data.get('series') or []
        print(f"History points: {len(raw_list)}")
        
        if raw_list:
            # Sort by date
            try:
                raw_list.sort(key=lambda x: x.get('date', ''))
            except: pass
            
            print(f"First 3: {raw_list[:3]}")
            print(f"Last 3: {raw_list[-3:]}")
            
            # Find the drop
            max_p = 0
            max_dd = 0
            worst_day = None
            
            vals = []
            for item in raw_list:
                p = item.get('nav') if item.get('nav') is not None else item.get('price')
                if p:
                    vals.append(float(p))
                    
            if vals:
                import pandas as pd
                s = pd.Series(vals)
                roll_max = s.cummax()
                dd = (s / roll_max) - 1
                min_dd = dd.min()
                min_idx = dd.idxmin()
                print(f"Calculated Max Drawdown from raw data: {min_dd:.4f}")
                print(f"Worst day index: {min_idx}")
                if min_idx < len(raw_list):
                     print(f"Worst day data: {raw_list[min_idx]}")
                     # Show context
                     start = max(0, min_idx - 5)
                     end = min(len(raw_list), min_idx + 5)
                     print("Context around drop:")
                     for i in range(start, end):
                         print(f"  {i}: {raw_list[i]}")
    else:
        print("NOT FOUND in historico_vl_v2")
        
    # Check calculated metrics in DB if any
    print(f"perf: {data.get('perf')}")
    print(f"std_perf: {data.get('std_perf')}")

if __name__ == "__main__":
    find_fund()

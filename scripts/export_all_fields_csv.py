import os
import sys
import csv
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

def flatten_dict(d, parent_key='', sep='.'):
    """
    Recursively flattens a nested dictionary.
    """
    items = []
    if not isinstance(d, dict):
        return {parent_key: d}
        
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            # Convert list elements to string and join
            items.append((new_key, " | ".join(map(str, v))))
        else:
            items.append((new_key, str(v)))  # Keep as string for CSV
    return dict(items)

def init_firebase():
    """
    Initializes Firebase Admin SDK using the local service account key.
    """
    base_dir = "C:/Users/oanti/Documents/BDB-FONDOS"
    key_paths = [
        os.path.join(base_dir, "serviceAccountKey.json"),
        os.path.join(base_dir, "functions_python", "serviceAccountKey.json"),
        os.path.join(base_dir, "functions_python", "scripts", "serviceAccountKey.json")
    ]
    
    db = None
    if not firebase_admin._apps:
        for kp in key_paths:
            if os.path.exists(kp):
                print(f"[INIT] Using key: {kp}")
                cred = credentials.Certificate(kp)
                firebase_admin.initialize_app(cred)
                db = firestore.client()
                break
        else:
            print("[ERROR] No serviceAccountKey.json found!")
            sys.exit(1)
    else:
        db = firestore.client()
    return db

def export_all_funds_fields():
    print("[1/3] Initializing Firebase...")
    db = init_firebase()
    
    print("[2/3] Fetching ALL funds and flattening ALL fields...")
    funds_ref = db.collection("funds_v3")
    docs = funds_ref.stream()
    
    all_funds_data = []
    all_keys = set()
    count = 0
    for doc in docs:
        count += 1
        data = doc.to_dict()
        # Add the document ID as ISIN
        data['isin'] = doc.id
        
        # Flatten the entire document dynamically
        flat_data = flatten_dict(data)
        all_funds_data.append(flat_data)
        
        # Collect all unique keys
        all_keys.update(flat_data.keys())
        
        if count % 500 == 0:
            print(f"      ... processed {count} funds")
            
    print(f"[3/3] Found {len(all_funds_data)} funds. Generating comprehensive CSV...")
    
    if not all_funds_data:
        print("[ERROR] No data found in collection.")
        return

    # Put 'isin' and 'name' as the first columns if they exist
    cols = ['isin']
    if 'name' in all_keys:
        cols.append('name')
    
    other_cols = sorted([c for c in all_keys if c not in cols])
    final_cols = cols + other_cols
    
    output_path = "C:/Users/oanti/Documents/BDB-FONDOS/fondos_absolutamente_todos_los_campos.csv"
    
    # Save to CSV
    with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=final_cols)
        writer.writeheader()
        for row in all_funds_data:
            writer.writerow(row)
    
    print(f"\n[DONE] Successfully exported to: {output_path}")
    print(f"Total columns extracted: {len(final_cols)}")
    print(f"Total rows extracted: {len(all_funds_data)}")

if __name__ == "__main__":
    export_all_funds_fields()

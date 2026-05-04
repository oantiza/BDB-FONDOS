import os
import sys
import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

def flatten_dict(d, parent_key='', sep='_'):
    """
    Recursively flattens a nested dictionary.
    """
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def init_firebase():
    """
    Initializes Firebase Admin SDK.
    Priority: GOOGLE_APPLICATION_CREDENTIALS > local serviceAccountKey.json > default credentials.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    key_paths = [
        os.path.join(base_dir, "serviceAccountKey.json"),
        os.path.join(base_dir, "..", "serviceAccountKey.json"),
        os.path.join(base_dir, "..", "..", "serviceAccountKey.json"),
    ]
    
    if not firebase_admin._apps:
        if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            firebase_admin.initialize_app()
        else:
            _found = next((p for p in key_paths if os.path.exists(p)), None)
            if _found:
                print(f"[INIT] Using key: {_found}")
                firebase_admin.initialize_app(credentials.Certificate(_found))
            else:
                firebase_admin.initialize_app()
    return firestore.client()

def export_funds():
    print("[1/3] Initializing Firebase...")
    db = init_firebase()
    
    print("[2/3] Fetching funds from Firestore (collection: funds_v3)...")
    funds_ref = db.collection("funds_v3")
    docs = funds_ref.stream()
    
    all_funds_data = []
    count = 0
    for doc in docs:
        count += 1
        data = doc.to_dict()
        data['firestore_id'] = doc.id
        # Flatten the nested structure
        flattened = flatten_dict(data)
        all_funds_data.append(flattened)
        if count % 100 == 0:
            print(f"      ... processed {count} funds")
            
    print(f"[3/3] Found {len(all_funds_data)} funds. Generating CSV...")
    
    if not all_funds_data:
        print("[ERROR] No data found in collection.")
        return

    df = pd.DataFrame(all_funds_data)
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_filename = f"funds_export_{timestamp}.csv"
    output_path = os.path.join("C:/Users/oanti/Documents/BDB-FONDOS", output_filename)
    
    # Save to CSV
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    print(f"\n[DONE] Successfully exported to: {output_path}")
    print(f"Total columns: {len(df.columns)}")
    return output_path

if __name__ == "__main__":
    export_path = export_funds()

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
    if not isinstance(d, dict):
        return {parent_key: d}
        
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            # Join lists with a separator or just keep as string
            items.append((new_key, ", ".join(map(str, v))))
        else:
            items.append((new_key, v))
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
        data['isin'] = doc.id
        
        # We only want basic info + classification_v2 + portfolio_exposure_v2
        # But flattening everything is also fine and more comprehensive
        
        # Targeted flattening for categories and subcategories
        row = {
            'name': data.get('name', ''),
            'isin': data.get('isin', ''),
            'currency': data.get('currency', ''),
            'asset_class_legacy': data.get('asset_class_legacy', ''),
            'category_legacy': data.get('category_legacy', ''),
            'ms_category': data.get('ms_category', ''),
            'ms_global_category': data.get('ms_global_category', '')
        }
        
        # Add classification_v2 fields
        classification = data.get('classification_v2', {})
        if classification:
            flat_class = flatten_dict(classification, parent_key='class_v2')
            row.update(flat_class)
            
        # Add portfolio_exposure_v2 fields
        exposure = data.get('portfolio_exposure_v2', {})
        if exposure:
            flat_exp = flatten_dict(exposure, parent_key='exp_v2')
            row.update(flat_exp)
            
        all_funds_data.append(row)
        
        if count % 100 == 0:
            print(f"      ... processed {count} funds")
            
    print(f"[3/3] Found {len(all_funds_data)} funds. Generating CSV...")
    
    if not all_funds_data:
        print("[ERROR] No data found in collection.")
        return

    df = pd.DataFrame(all_funds_data)
    
    # Sort columns to have main ones first
    cols = ['name', 'isin', 'currency', 'asset_class_legacy', 'category_legacy']
    other_cols = [c for c in df.columns if c not in cols]
    df = df[cols + sorted(other_cols)]
    
    output_path = "C:/Users/oanti/Documents/BDB-FONDOS/fondos_categorias_subcategorias.csv"
    
    # Save to CSV
    df.to_csv(output_path, index=False, encoding='utf-8-sig')
    
    print(f"\n[DONE] Successfully exported to: {output_path}")
    print(f"Total columns: {len(df.columns)}")
    print(f"Total rows: {len(df)}")
    return output_path

if __name__ == "__main__":
    export_funds()

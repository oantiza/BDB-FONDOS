import firebase_admin
from firebase_admin import credentials, firestore
import json

def inspect_results():
    key_path = r"c:\Users\oanti\Documents\BDB-FONDOS\scripts\serviceAccountKey.json"
    cred = credentials.Certificate(key_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    
    print("Inspecting first 20 funds after batch run...")
    docs = db.collection("funds_v3").limit(20).stream()
    
    for doc in docs:
        d = doc.to_dict()
        isin = doc.id
        v2 = d.get('classification_v2', {})
        exp = d.get('portfolio_exposure_v2', {})
        derived = d.get('derived', {})
        
        print(f"\nISIN: {isin}")
        print(f"  Name: {d.get('name')}")
        print(f"  Derived Class: {derived.get('asset_class')}")
        print(f"  V2 Class: {v2.get('asset_type')}")
        print(f"  V2 Subtype: {v2.get('asset_subtype')}")
        print(f"  V2 Style: {v2.get('equity_style_box')}")
        print(f"  V2 Region: {v2.get('region_primary')}")
        
        # If it's EQUITY, let's see the raw MS data
        if v2.get('asset_type') == 'EQUITY':
            ms = d.get('ms', {})
            print(f"  MS Style: {json.dumps(ms.get('equity_style'), indent=2)}")
            print(f"  MS Regions: {json.dumps(ms.get('regions'), indent=2)}")

if __name__ == "__main__":
    inspect_results()

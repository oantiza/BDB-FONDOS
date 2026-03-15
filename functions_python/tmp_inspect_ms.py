import firebase_admin
from firebase_admin import credentials, firestore
import json

def debug_inspect():
    key_path = r"c:\Users\oanti\Documents\BDB-FONDOS\scripts\serviceAccountKey.json"
    cred = credentials.Certificate(key_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    
    print("Searching for funds with data...")
    # Increase limit to find more potential samples
    docs = db.collection("funds_v3").limit(100).stream()
    
    samples_found = 0
    for doc in docs:
        d = doc.to_dict()
        ms = d.get('ms', {})
        regions = ms.get('regions', {})
        style = ms.get('equity_style', {})
        
        # Safer check for data existence
        has_regions = bool(regions) and any(v != 0 for v in regions.values() if isinstance(v, (int, float)))
        style_data = style.get('style', {}) if isinstance(style, dict) else {}
        has_style = bool(style_data) and any(v != 0 for v in style_data.values() if isinstance(v, (int, float)))
        
        if has_regions or has_style:
            print(f"\n--- {doc.id} ---")
            print(f"Name: {d.get('name')}")
            print(f"MS Category: {ms.get('category_morningstar')}")
            print(f"Equity Style: {json.dumps(style, indent=2)}")
            print(f"Regions (keys): {list(regions.keys()) if isinstance(regions, dict) else 'Not a dict'}")
            print(f"Regions Sample: {json.dumps(regions, indent=2)}")
            samples_found += 1
            if samples_found >= 5: break

if __name__ == "__main__":
    debug_inspect()

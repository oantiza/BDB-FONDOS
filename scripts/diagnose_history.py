import firebase_admin
from firebase_admin import credentials, firestore
import re

# Initialize (if not already)
if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {'projectId': 'bdb-fondos'})

db = firestore.client()

ISINS = ['ES0141116030', 'ES0142046038', 'ES0162296000']

print("🔍 Diagnosing History for: ", ISINS)

for isin in ISINS:
    print(f"\n--- ISIN: {isin} ---")
    doc_ref = db.collection('historico_vl_v2').document(isin)
    doc = doc_ref.get()
    
    if not doc.exists:
        print("❌ Document 'historico_vl_v2' DOES NOT EXIST.")
        
        # Check v1 just in case? Or funds_v2 source?
        f_doc = db.collection('funds_v2').document(isin).get()
        if f_doc.exists:
            print("   (Fund metadata exists in funds_v2)")
        else:
            print("   (Fund metadata MISSING in funds_v2)")
            
    else:
        print("✅ Document EXISTS.")
        data = doc.to_dict()
        keys = list(data.keys())
        print(f"   Top-level keys ({len(keys)}): {keys[:10]} ...")
        
        # Check "series"
        if 'series' in data:
            s = data['series']
            if isinstance(s, list):
                print(f"   'series' is LIST. Length: {len(s)}")
                if len(s) > 0:
                    print(f"   Sample item: {s[0]}")
            else:
                print(f"   'series' is type {type(s)}.")
        else:
            print("   'series' key MISSING.")

        # Check map-style dates
        date_keys = [k for k in keys if re.match(r'^\d{4}-\d{2}-\d{2}', k)]
        if date_keys:
            print(f"   found {len(date_keys)} keys looking like YYYY-MM-DD.")
            
        # Check arrays
        if 'dates' in data:
            print(f"   'dates' array found. Length: {len(data['dates'])}")
        if 'values' in data:
            print(f"   'values' array found. Length: {len(data['values'])}")
            
    # Check subcollection 'daily'
    sub_dailies = list(doc_ref.collection('daily').limit(10).stream())
    if sub_dailies:
        print(f"   ⚠️ Found SUBCOLLECTION 'daily'. Sample docs: {len(sub_dailies)}+")
    else:
        print("   No 'daily' subcollection found.")

    # Check subcollection 'prices'
    sub_prices = list(doc_ref.collection('prices').limit(10).stream())
    if sub_prices:
        print(f"   ⚠️ Found SUBCOLLECTION 'prices'. Sample docs: {len(sub_prices)}+")
    else:
        print("   No 'prices' subcollection found.")

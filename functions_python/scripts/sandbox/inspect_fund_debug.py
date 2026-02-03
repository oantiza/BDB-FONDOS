
import firebase_admin
from firebase_admin import credentials, firestore
import json

if not firebase_admin._apps:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

def inspect_fund(isin):
    print(f"--- Inspecting {isin} ---")
    doc_ref = db.collection('funds_v3').document(isin)
    doc = doc_ref.get()
    
    if not doc.exists:
        print("Document not found.")
        return

    data = doc.to_dict()
    
    # Check keys relevant to regions
    print("Keys found in root:", list(data.keys()))
    
    if 'derived' in data:
        print("\n'derived' content:")
        print(json.dumps(data['derived'], indent=2))
    else:
        print("\nNo 'derived' field.")

    if 'regions' in data:
        print("\n'regions' content:")
        print(data['regions'])
    
    if 'ms' in data:
        print("\n'ms' content (keys):", list(data['ms'].keys()))
        if 'regions' in data['ms']:
            print("'ms.regions':", data['ms']['regions'])

# Inspect a known fund
inspect_fund('IE00B03HCZ61') 

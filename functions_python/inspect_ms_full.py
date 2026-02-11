import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

# Initialize Firebase
cred_path = "../scripts/serviceAccountKey.json"
if not os.path.exists(cred_path):
    cred_path = "serviceAccountKey.json"

if os.path.exists(cred_path):
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    except ValueError:
        pass
else:
    firebase_admin.initialize_app()

db = firestore.client()

def inspect_full_ms():
    funds_ref = db.collection('funds_v3').limit(10)
    docs = funds_ref.stream()

    for doc in docs:
        data = doc.to_dict()
        name = data.get('name', 'Unknown')
        ms = data.get('ms', {})
        derived = data.get('derived', {})
        
        if 'Bond' in name or 'Renta Fija' in name:
            print(f"\n--- FULL INSPECTION: {name} ---")
            print(f"MS Keys: {list(ms.keys())}")
            print(f"Derived Keys: {list(derived.keys())}")
            
            if 'fixed_income' in ms:
                print(f"MS Fixed Income: {json.dumps(ms['fixed_income'], indent=2)}")
            
            if 'regions' in ms:
                print(f"MS Regions: {json.dumps(ms['regions'], indent=2)}")
                
            if 'analysis' in ms:
                 print(f"MS Analysis: {json.dumps(ms['analysis'], indent=2)}")
                 
            # Check derived for duration hints
            if 'rf_duration_source' in derived:
                print(f"Derived Duration Source: {derived.get('rf_duration_source')}")
                # Print other derived fields that might be duration
                print(f"Derived Detail: {json.dumps(derived, indent=2)}")

if __name__ == "__main__":
    inspect_full_ms()

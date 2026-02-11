import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from datetime import datetime

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

def default_serializer(obj):
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if hasattr(obj, '__class__') and obj.__class__.__name__ == 'DatetimeWithNanoseconds':
        return obj.isoformat()
    return str(obj)

def inspect_full_ms():
    funds_ref = db.collection('funds_v3').limit(50)
    docs = funds_ref.stream()

    found_dur = 0
    found_reg = 0

    for doc in docs:
        data = doc.to_dict()
        name = data.get('name', 'Unknown')
        ms = data.get('ms', {})
        derived = data.get('derived', {})
        
        # Check for Derived Duration
        dur_keys = [k for k in derived.keys() if 'duration' in k]
        if dur_keys and found_dur < 3:
            print(f"\n--- Fund with Derived Duration: {name} ---")
            print(f"Derived Duration Keys: {dur_keys}")
            for k in dur_keys:
                print(f"  {k}: {derived[k]}")
            if 'maturity_allocation' in ms.get('fixed_income', {}) or 'maturity_allocation' in derived:
                 print("  Has Maturity Allocation buckets")
            found_dur += 1

        # Check for Regions
        if (ms.get('regions') or derived.get('regions') or data.get('primary_region')) and found_reg < 3:
             print(f"\n--- Fund with Regions: {name} ---")
             print(f"Primary Region: {data.get('primary_region')}")
             print(f"MS Regions: {json.dumps(ms.get('regions'), default=default_serializer, indent=2)}")
             print(f"Derived Regions: {json.dumps(derived.get('regions'), default=default_serializer, indent=2)}")
             found_reg += 1
             
        if found_dur >=3 and found_reg >=3:
            break

if __name__ == "__main__":
    inspect_full_ms()

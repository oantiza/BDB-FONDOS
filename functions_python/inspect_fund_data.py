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
        print("Authenticated with serviceAccountKey.json")
    except ValueError:
        print("App already initialized")
else:
    print("Warning: serviceAccountKey.json not found. Using default creds.")
    firebase_admin.initialize_app()

db = firestore.client()

def inspect_funds():
    # Get a few funds, ideally some that look like Fixed Income
    funds_ref = db.collection('funds_v3').limit(20)
    docs = funds_ref.stream()

    for doc in docs:
        data = doc.to_dict()
        name = data.get('name', 'Unknown')
        isin = data.get('isin', 'Unknown')
        
        # Check for potential FI keywords
        is_fi = 'Bond' in name or 'Renta Fija' in name or 'Fixed' in name or 'Bonos' in name
        
        if is_fi or True: # Inspect all 20 for now to find region too
            print(f"\n--- Fund: {name} ({isin}) ---")
            print(f"Asset Class: {data.get('asset_class')}")
            print(f"Primary Region: {data.get('primary_region')}")
            print(f"Derived: {data.get('derived', {})}")
            
            # Look for duration/maturity paths
            print("metrics:", data.get('metrics'))
            print("fixed_income:", data.get('fixed_income'))
            print("risk:", data.get('risk'))
            print("ms keys:", list(data.get('ms', {}).keys()))
            
            # Check ms breakdown if available
            if 'ms' in data:
                 print("ms.fixed_income:", data['ms'].get('fixed_income'))

if __name__ == "__main__":
    inspect_funds()

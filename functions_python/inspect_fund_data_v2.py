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

def inspect_funds():
    # Get a few funds
    funds_ref = db.collection('funds_v3').limit(50)
    docs = funds_ref.stream()

    found_fi = 0
    found_equity = 0

    for doc in docs:
        data = doc.to_dict()
        name = data.get('name', 'Unknown')
        
        # Check if it has MS data
        ms = data.get('ms', {})
        
        # Look for FI data
        if 'Bond' in name or 'Renta Fija' in name:
            if found_fi < 3:
                print(f"\n--- FI Fund: {name} ---")
                print(f"Metrics: {json.dumps(data.get('metrics'), indent=2)}")
                print(f"Fixed Income: {json.dumps(data.get('fixed_income'), indent=2)}")
                # Check MS deeper
                print(f"MS Portfolio: {json.dumps(ms.get('portfolio'), indent=2)}") 
                print(f"MS Risk: {json.dumps(ms.get('risk_volatility'), indent=2)}")
                found_fi += 1
        
        # Look for Equity data (Primary Region)
        if 'Equity' in name or 'Acciones' in name or 'Renta Variable' in name:
            if found_equity < 3:
                print(f"\n--- Equity Fund: {name} ---")
                print(f"Primary Region: {data.get('primary_region')}")
                print(f"MS Asset Alloc: {json.dumps(ms.get('asset_allocation'), indent=2)}")
                print(f"MS Regional breakdown: {json.dumps(ms.get('regional_breakdown'), indent=2)}") # Guessing keys
                found_equity += 1
                
        if found_fi >= 3 and found_equity >= 3:
            break

if __name__ == "__main__":
    inspect_funds()

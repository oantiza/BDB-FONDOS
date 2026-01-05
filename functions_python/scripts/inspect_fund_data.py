
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os
import sys

# Initialize Firestore
# Assuming the credentials are implicitly available or via GOOGLE_APPLICATION_CREDENTIALS
# If running locally in the user's environment, we might need to point to a service account key if not logged in via gcloud.
# But existing scripts might show how to init.

def initialize():
    try:
        app = firebase_admin.get_app()
    except ValueError:
        # Check for service account in typical location or default
        if os.path.exists('./serviceAccountKey.json'):
            cred = credentials.Certificate('./serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    return firestore.client()

def inspect_fund():
    db = initialize()
    # Get first 5 funds
    docs = db.collection('funds_v2').limit(5).stream()
    
    for doc in docs:
        data = doc.to_dict()
        name = data.get('name', 'Unknown')
        isin = data.get('isin', doc.id)
        history = data.get('returns_history')
        
        print(f"\nFund: {name} ({isin})")
        if not history:
            print("  NO returns_history found.")
            continue
            
        keys = list(history.keys())
        keys.sort()
        print(f"  History Points: {len(keys)}")
        print(f"  First 5 keys: {keys[:5]}")
        print(f"  Last 5 keys: {keys[-5:]}")
        
        # Check format
        sample_key = keys[0]
        sample_val = history[sample_key]
        print(f"  Sample: {sample_key} = {sample_val} (Type: {type(sample_val)})")

if __name__ == "__main__":
    inspect_fund()

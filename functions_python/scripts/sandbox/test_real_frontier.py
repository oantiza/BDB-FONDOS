import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import numpy as np
import sys
import os

# Add local path to services
sys.path.append('functions_python')

from services.optimizer import generate_efficient_frontier

def test():
    # Initialize Firebase if not already
    if not firebase_admin._apps:
        # Connect to Emulator
        os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:8080"
        os.environ["GCLOUD_PROJECT"] = "bdb-fondos"
        
        print("🔌 Connecting to Firestore Emulator (Anonymous)...")
        from firebase_admin import credentials
        import google.auth.credentials
        
        class MockCreds(object):
            def get_credential(self):
                return google.auth.credentials.AnonymousCredentials()
        
        firebase_admin.initialize_app(credential=MockCreds(), options={'projectId': 'bdb-fondos'})
    
    db = firestore.client()
    
    # Example portfolio that might be failing
    # Trying with common ISINs from the codebase (MS World, Vanguard, etc.)
    portfolio = [
        {'isin': 'IE00B03HCZ61', 'weight': 50}, # Vanguard Global Stock
        {'isin': 'IE00B4L5Y983', 'weight': 50}  # iShares Core MSCI World
    ]
    
    assets_list = [item['isin'] for item in portfolio]
    weights = {'IE00B03HCZ61': 0.5, 'IE00B4L5Y983': 0.5}
    
    print(f"Testing EF with: {assets_list}")
    try:
        result = generate_efficient_frontier(assets_list, db, weights)
        if 'error' in result:
            print(f"❌ ERROR: {result['error']}")
            if 'points' in result: print(f"Points: {result['points']}")
            if 'assets_found' in result: print(f"Assets Found: {result['assets_found']}")
        else:
            print(f"✅ SUCCESS!")
            print(f"Frontier Points: {len(result.get('frontier', []))}")
            print(f"Asset Points: {len(result.get('assets', []))}")
            print(f"Portfolio Point: {result.get('portfolio')}")
            
    except Exception as e:
        print(f"🔥 CRASH: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test()

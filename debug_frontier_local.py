import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import numpy as np
import sys
import os

# Add path to functions
sys.path.append('functions_python')

from services.data_fetcher import DataFetcher
from services.optimizer import generate_efficient_frontier

def debug_frontier():
    # Initialize Firebase (requires valid credentials locally or mocked)
    # Assuming user has credentials or we can run this where they exist?
    # Actually, running this via run_command might fail if no creds.
    # We'll use a mock DB or try to interpret dependencies.
    
    # Better: Inspect logic statically or use a simplified test.
    # I will try to run this, but if it fails due to Auth, I'll rely on the code analysis.
    
    print("Checking DataFetcher logic...")
    # Mock DB client behaving like Firestore
    class MockDoc:
        def __init__(self, id, data):
            self.id = id
            self._data = data
            self.exists = True
        def to_dict(self): return self._data

    class MockRef:
        def __init__(self, id): self.id = id
    
    class MockCol:
        def document(self, id): return MockRef(id) # returns ref, not doc
        def get(self): 
             # ... unused logic if refs passed
             pass 

    # We need a proper mock structure
    # In DataFetcher: 
    # refs = [self.db.collection(...).document(isin) for isin in missing_assets]
    # docs = self.db.get_all(refs)
    
    class MockDB:
        def collection(self, name): 
            class Collection:
                def document(self, id): return MockRef(id)
            return Collection()
            
        def get_all(self, refs):
            # Simulate fetching docs from refs
            results = []
            for r in refs:
                 # Real logic: doc.id = r.id; doc.exists = True; doc.to_dict() = ...
                 # Generate fake data
                 dates = pd.date_range('2020-01-01', periods=1200, freq='D')
                 # Make them slightly different to allow optimization
                 variance = 0.001 * (1 if 'A' in r.id else -1)
                 history = [{'date': d.strftime('%Y-%m-%d'), 'nav': 100 * (1.0001 + variance)**i} for i, d in enumerate(dates)]
                 results.append(MockDoc(r.id, {'history': history}))
            return results

    db = MockDB()
    fetcher = DataFetcher(db)
    
    assets = ['FUND_A', 'FUND_B']
    print(f"Fetching for {assets}...")
    
    # Test DataFetcher
    df, synth = fetcher.get_price_data(assets, resample_freq='W-FRI', strict=True)
    print("Result Type:", type(df))
    print("Empty?", df.empty)
    print("Head:\n", df.head())
    
    # Test Frontier
    print("\nGenerating Frontier...")
    res = generate_efficient_frontier(assets, db)
    print("Frontier Result Keys:", res.keys())
    if 'error' in res:
        print("ERROR:", res['error'])
    else:
        print(f"Points: {len(res.get('frontier', []))}")

if __name__ == "__main__":
    try:
        debug_frontier()
    except Exception as e:
        print(f"CRASH: {e}")
        import traceback
        traceback.print_exc()

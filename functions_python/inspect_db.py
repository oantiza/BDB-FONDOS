
import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

# Explicitly use serviceAccountKey.json
# Try current directory first, then absolute path
cred_path = "./serviceAccountKey.json"
if not os.path.exists(cred_path):
    cred_path = "c:/Users/oanti/Documents/BDB-FONDOS_LOCAL/BDB-FONDOS/functions_python/serviceAccountKey.json"

if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    app = firebase_admin.initialize_app(cred)
else:
    print(f"Error: Credentials not found at {cred_path}")
    exit(1)

db = firestore.client()

def inspect():
    print("Querying funds where derived.primary_region == 'Europa'...")
    # Note: Querying requires index if we sort, but for simple where() it might warn.
    # We will fetch all and filter in python if needed, or try exact query.
    
    docs_stream = db.collection('funds_v3').where('derived.primary_region', '==', 'Europa').limit(50).stream()
    docs = list(docs_stream)
    
    print(f"Found {len(docs)} funds for 'Europa'.")
    
    if not docs:
        print("TRYING 'EUROPA' (UPPERCASE)...")
        docs_stream = db.collection('funds_v3').where('derived.primary_region', '==', 'EUROPA').limit(50).stream()
        docs = list(docs_stream)
        print(f"Found {len(docs)} funds for 'EUROPA'.")

    valid_sharpe = 0
    missing_sharpe = 0
    
    for d in docs:
        data = d.to_dict()
        sharpe = data.get('std_perf', {}).get('sharpe')
        
        # Check strict existence
        if sharpe is not None and isinstance(sharpe, (int, float)):
            valid_sharpe += 1
        else:
            missing_sharpe += 1
            # print sample of missing
            if missing_sharpe <= 3:
                print(f"Missing Sharpe sample: {d.id} - name: {data.get('name')}")

    print(f"Stats for Europa: Valid Sharpe: {valid_sharpe}, Missing Sharpe: {missing_sharpe}")

if __name__ == "__main__":
    inspect()

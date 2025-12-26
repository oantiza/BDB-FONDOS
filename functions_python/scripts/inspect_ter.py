import firebase_admin
from firebase_admin import firestore
import os
import sys

# Ensure valid import of local modules if needed (not strictly needed for just firestore check but good practice)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def check_ter():
    print("Initializing Firebase...")
    try:
        app = firebase_admin.initialize_app()
    except ValueError:
        # Already initialized
        app = firebase_admin.get_app()
    
    db = firestore.client()
    
    print("Querying funds_v2 (limit 100)...")
    docs = db.collection('funds_v2').limit(100).stream()
    
    total = 0
    with_ter = 0
    with_mgmt = 0
    zeros = 0
    
    examples_ter = []
    
    print(f"{'ID':<15} | {'TER':<10} | {'Mgmt Fee':<10} | {'Name'}")
    print("-" * 60)
    
    for doc in docs:
        total += 1
        data = doc.to_dict()
        costs = data.get('costs', {})
        ter = costs.get('ter')
        mgmt = costs.get('management_fee')
        
        has_ter = ter is not None
        if has_ter:
            with_ter += 1
            if ter == 0:
                zeros += 1
            examples_ter.append((doc.id, ter, mgmt, data.get('name', 'N/A')))
            
        if mgmt is not None:
            with_mgmt += 1

        # Print first 20 rows
        if total <= 20:
             print(f"{doc.id:<15} | {str(ter):<10} | {str(mgmt):<10} | {data.get('name', 'N/A')[:30]}")

    print("\n" + "="*30)
    print("SUMMARY")
    print("="*30)
    print(f"Total Documents Scanned: {total}")
    print(f"Docs with 'costs.ter':   {with_ter}")
    print(f"Docs with 'costs.ter'=0: {zeros}")
    print(f"Docs with 'costs.mgmt':  {with_mgmt}")
    
    if with_ter == 0:
        print("\n⚠️  WARNING: No TER data found in the sample.")
    elif zeros == with_ter:
        print("\n⚠️  WARNING: TER field exists but ALL values are 0.")
    else:
        print("\n✅ Data found. Some examples:")
        for ex in examples_ter[:5]:
             print(f"ID: {ex[0]}, TER: {ex[1]}")

if __name__ == '__main__':
    check_ter()

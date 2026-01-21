
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os

def check_fund():
    # Init Firestore (similar to other scripts)
    try:
        app = firebase_admin.get_app()
    except ValueError:
        if os.path.exists('./serviceAccountKey.json'):
            cred = credentials.Certificate('./serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    
    db = firestore.client()
    
    # Search by name "Fondibas"
    print("Searching for 'Fondibas'...")
    docs = db.collection('funds_v3').stream()
    
    found = False
    for doc in docs:
        d = doc.to_dict()
        name = d.get('name', '').upper()
        if 'FONDIBAS' in name:
            found = True
            print(f"\n--- FOUND: {d.get('name')} ({d.get('isin')}) ---")
            print(f"DB std_type: {d.get('std_type')}")
            print(f"DB manual_type: {d.get('manual_type')}")
            print(f"DB asset_class: {d.get('asset_class')}")
            print(f"DB category: {d.get('category') or d.get('category_morningstar')}")
            print(f"Metrics: {d.get('metrics')}")
            print("------------------------------------------------")

    if not found:
        print("No fund found with name 'Fondibas'")

if __name__ == "__main__":
    check_fund()

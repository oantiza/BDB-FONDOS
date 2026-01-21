
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os

def list_categories():
    try:
        app = firebase_admin.get_app()
    except ValueError:
        if os.path.exists('./serviceAccountKey.json'):
            cred = credentials.Certificate('./serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    
    db = firestore.client()
    
    print("Scanning Morningstar Categories...")
    docs = db.collection('funds_v3').limit(200).stream()
    
    categories = set()
    sample_map = {}
    
    for doc in docs:
        d = doc.to_dict()
        cat = d.get('category_morningstar') or d.get('morningstar_category')
        if cat:
            categories.add(cat)
            sample_map[cat] = d.get('name')
            
    print(f"\nFound {len(categories)} unique categories in sample:")
    for c in sorted(list(categories)):
        print(f" - {c} (Ex: {sample_map[c]})")

if __name__ == "__main__":
    list_categories()

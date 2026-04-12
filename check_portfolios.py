import firebase_admin
from firebase_admin import firestore

if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()
portfolios = db.collection('saved_portfolios').order_by('created_at', direction=firestore.Query.DESCENDING).limit(5).stream()

for p in portfolios:
    data = p.to_dict()
    print(f"ID: {p.id}, Name: {data.get('name')}")
    items = data.get('items', [])
    for item in items:
        print(f"  {item.get('isin')}: val={item.get('value')} weight={item.get('weight')}")
    print("---")

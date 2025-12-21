
import firebase_admin
from firebase_admin import credentials, firestore
import os

if not firebase_admin._apps:
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': 'bdb-fondos',
    })

db = firestore.client()

docs = list(db.collection('reports').order_by('createdAt', direction=firestore.Query.DESCENDING).limit(5).stream())

print(f"Found {len(docs)} reports.")
for doc in docs:
    data = doc.to_dict()
    print(f"Report: {data.get('type')} - {data.get('createdAt')} - Status: {data.get('status')}")

import firebase_admin
from firebase_admin import credentials, firestore
import json

cred = credentials.ApplicationDefault()
try:
    firebase_admin.initialize_app(cred, {'projectId': 'bdb-fondos'})
except:
    pass

db = firestore.client()

doc = db.collection('funds_v3').document('LU0132601682').get()
data = doc.to_dict()

print("KEYS in document:")
print(list(data.keys()))

if "weight" in data:
    print("WEIGHT:", data["weight"])
else:
    print("No weight field.")


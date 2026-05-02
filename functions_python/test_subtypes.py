import os
from firebase_admin import credentials, firestore, initialize_app

os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = "127.0.0.1:9099"
os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"
os.environ["GCLOUD_PROJECT"] = "bdb-fondos"

cred = credentials.ApplicationDefault()
app = initialize_app(cred, {
    'projectId': 'bdb-fondos',
})
db = firestore.client()

funds = db.collection('funds').get()
subtypes = set()
for f in funds:
    data = f.to_dict()
    v2 = data.get('classification_v2', {})
    subtype = v2.get('asset_subtype')
    if subtype:
        subtypes.add(subtype)

print("Unique subcategories in V2:")
for s in sorted(list(subtypes)):
    print(s)

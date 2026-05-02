import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.Certificate('scripts/serviceAccountKey.json')
if not firebase_admin._apps: firebase_admin.initialize_app(cred)
db = firestore.client()

docs = db.collection('funds').limit(300).stream()
for d in docs:
    v2 = d.to_dict().get('classification_v2', {})
    if v2.get('asset_type') == 'MONETARY':
        print(d.id, ':', v2.get('asset_subtype'))

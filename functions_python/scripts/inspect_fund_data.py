import firebase_admin
from firebase_admin import credentials, firestore

def initialize():
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': 'acciones-cartera',
        })
    return firestore.client()

def inspect_fund():
    db = initialize()
    isin = 'LU1762221155'
    print(f"Inspecting {isin}...")
    doc_ref = db.collection('funds_v3').document(isin)
    doc = doc_ref.get()
    
    if doc.exists:
        data = doc.to_dict()
        print(f"--- Document Data for {isin} ---")
        std_perf = data.get('std_perf', {})
        perf = data.get('perf', {})
        
        print(f"std_perf (RAW): {std_perf}")
        print(f"perf (RAW): {perf}")
        
        vol_std = std_perf.get('volatility')
        vol_perf = perf.get('volatility')
        
        print(f"std_perf.volatility: {vol_std} (Type: {type(vol_std)})")
        print(f"perf.volatility: {vol_perf} (Type: {type(vol_perf)})")
        
    else:
        print(f"Document {isin} does not exist!")

if __name__ == "__main__":
    inspect_fund()

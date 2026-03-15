import firebase_admin
from firebase_admin import credentials, firestore

def find_equity_isins():
    key_path = r"c:\Users\oanti\Documents\BDB-FONDOS\scripts\serviceAccountKey.json"
    cred = credentials.Certificate(key_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    
    # Get ISINs of funds where classification_v2.asset_type is EQUITY
    # or where derived.asset_class is EQUITY
    docs = db.collection("funds_v3").where("derived.asset_class", "==", "EQUITY").limit(20).stream()
    
    print("Equity ISINs found:")
    for doc in docs:
        print(f"- {doc.id}")

if __name__ == "__main__":
    find_equity_isins()

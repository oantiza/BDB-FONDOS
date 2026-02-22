import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore

# Add path so nav_fetcher service can be imported
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from services.nav_fetcher import update_single_fund_history
from recalc_metrics_single import recalculate_single

def get_db():
    try:
        app = firebase_admin.get_app()
    except ValueError:
        # Initializing production credentials
        cred_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'serviceAccountKey.json')
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print(f"Error: {cred_path} not found")
            return None
    return firestore.client()

if __name__ == "__main__":
    db = get_db()
    
    if db:
        isin = "IE00B03HCZ61"
        print(f"Buscando histórico para {isin} desde 2015...")
        
        # 1. Fetch history from EODHD overriding whatever there is
        res = update_single_fund_history(db, isin, mode='overwrite', from_date='2015-01-01')
        print(f"Result EODHD Fetch: {res}")
        
        # 2. Recalculate metrics (std_perf) with the newly fetched data
        if res and res.get('success'):
            print(f"Refrescando métricas std_perf para {isin}...")
            recalculate_single(isin)
        else:
             print("Skipping metrics recalculation due to EODHD failure.")

import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import numpy as np

def scan_spikes():
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {'projectId': 'bdb-fondos'})
    
    db = firestore.client()
    print("🚀 Scanning historico_vl_v2 for spikes > 20%...")
    
    docs = db.collection('historico_vl_v2').stream()
    
    found = 0
    for doc in docs:
        data = doc.to_dict()
        isin = doc.id
        history = data.get('history') or data.get('series') or []
        
        if not history:
            continue
            
        df = pd.DataFrame(history)
        if 'nav' not in df.columns or 'date' not in df.columns:
            continue
            
        df['nav'] = pd.to_numeric(df['nav'], errors='coerce')
        df = df.dropna().sort_values('date')
        
        if len(df) < 2:
            continue
            
        df['pct'] = df['nav'].pct_change().abs()
        
        spikes = df[df['pct'] > 0.20]
        
        if not spikes.empty:
            print(f"\n⚠️ SPIKE FOUND in {isin}:")
            for idx, row in spikes.iterrows():
                prev_idx = df.index[df.index.get_loc(idx) - 1]
                prev_row = df.loc[prev_idx]
                print(f"   Date: {row['date']} | NAV: {row['nav']} | Prev NAV: {prev_row['nav']} | Change: {row['pct']*100:.2f}%")
            found += 1
            
    print(f"\n✅ Scan complete. Found {found} suspicious funds.")

if __name__ == "__main__":
    scan_spikes()

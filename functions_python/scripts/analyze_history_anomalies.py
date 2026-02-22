import os
import sys
import json
import pandas as pd
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore, initialize_app

# Add parent dir to path to import config if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# --- AUTENTICACIÓN LOCAL ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
KEY_PATH = os.path.join(PROJECT_ROOT, 'serviceAccountKey.json')

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(KEY_PATH)
        initialize_app(cred)
except Exception as e:
    print(f"⚠️ Error cargando serviceAccountKey.json: {e}")
    print("Intentando inicialización por defecto...")
    try:
        initialize_app()
    except:
        pass

db = firestore.client()

def analyze_anomalies(threshold=0.20):
    print(f"🔍 Analyzing history for anomalies (threshold > {threshold*100}% daily change)...")
    
    docs = db.collection('historico_vl_v2').stream()
    
    anomalous_funds = []
    total_funds = 0
    total_points = 0
    
    for doc in docs:
        total_funds += 1
        data = doc.to_dict()
        history = data.get('history') or data.get('series') or []
        
        if not history:
            continue
            
        # Parse history
        parsed_history = []
        for item in history:
            if isinstance(item, dict):
                d = item.get('date')
                p = item.get('nav') if item.get('nav') is not None else item.get('price')
                if d and p is not None:
                    parsed_history.append({'date': d, 'nav': float(p)})
                    
        if len(parsed_history) < 2:
            continue
            
        total_points += len(parsed_history)
        
        # Calculate returns
        df = pd.DataFrame(parsed_history)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')
        df['nav_prev'] = df['nav'].shift(1)
        df['pct_change'] = (df['nav'] / df['nav_prev']) - 1.0
        
        # Find anomalies
        anomalies = df[(df['pct_change'] > threshold) | (df['pct_change'] < -threshold)]
        
        if not anomalies.empty:
            # We have jumps!
            max_jump = df['pct_change'].max()
            min_jump = df['pct_change'].min()
            
            anomalous_funds.append({
                'isin': doc.id,
                'anomaly_count': len(anomalies),
                'max_jump_pct': max_jump * 100,
                'max_drop_pct': min_jump * 100,
                'sample_jumps': anomalies[['date', 'nav_prev', 'nav', 'pct_change']].head(3).to_dict('records')
            })
            
            print(f"⚠️ {doc.id} - Anomaly! Max jump: {max_jump*100:.2f}%, Max drop: {min_jump*100:.2f}%. Jumps: {len(anomalies)}")

    print("\n--- SUMMARY ---")
    print(f"Total funds scanned: {total_funds}")
    print(f"Total data points processed: {total_points}")
    print(f"Funds with anomalies (> {threshold*100}%): {len(anomalous_funds)}")
    
    if anomalous_funds:
        print("\nTop 10 most extreme positive jumps:")
        top_jumps = sorted(anomalous_funds, key=lambda x: x['max_jump_pct'], reverse=True)[:10]
        for f in top_jumps:
            print(f"  {f['isin']}: +{f['max_jump_pct']:.1f}%")
            
        print("\nTop 10 most extreme negative drops:")
        top_drops = sorted(anomalous_funds, key=lambda x: x['max_drop_pct'])[:10]
        for f in top_drops:
            print(f"  {f['isin']}: {f['max_drop_pct']:.1f}%")
            
        print("\nSample anomalies details:")
        for f in anomalous_funds[:3]:
            print(f"ISIN: {f['isin']}")
            for s in f['sample_jumps']:
                print(f"  {s['date'].strftime('%Y-%m-%d')}: {s['nav_prev']} -> {s['nav']} ({s['pct_change']*100:.2f}%)")

if __name__ == '__main__':
    analyze_anomalies(threshold=0.25) # 25% daily change is extremely rare for a fund unless it's a crypto fund or split

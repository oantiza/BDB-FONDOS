"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: trigger_calc.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/trigger_calc.py
"""

import requests
import json
import time
import pandas as pd

URL = "https://europe-west1-bdb-fondos.cloudfunctions.net/backfill_std_perf_endpoint"

def run_backfill():
    print(f"🔧 Calling Backfill API: {URL}")
    
    try:
        start = time.time()
        payload = {"data": {}}
        
        resp = requests.post(URL, json=payload, timeout=540, headers={'Content-Type': 'application/json'})
        duration = time.time() - start
        print(f"⏱️ Request took {duration:.2f}s")
        
        if resp.status_code != 200:
            print(f"❌ Error {resp.status_code}: {resp.text}")
            return

        raw = resp.json()
        data = raw.get('result', {})
        status = data.get('status')
        
        if status != 'success':
            print(f"❌ API Error: {data.get('error')}")
            return

        stats = data.get('data', {}).get('stats', {})
        csv_rows = data.get('data', {}).get('csv_rows', [])
        
        print("\n--- Backfill Stats ---")
        print(json.dumps(stats, indent=2))
        
        if csv_rows:
            df = pd.DataFrame(csv_rows)
            df.to_csv('backfill_std_perf_results.csv', index=False)
            print(f"✅ Saved 'backfill_std_perf_results.csv' with {len(df)} rows.")
            
            # Show 5 examples with valid sharpe
            valid = df[df['status'] == 'ok'].head(5)
            print("\n--- Examples ---")
            print(valid[['isin', 'sharpe', 'vol', 'ret', 'points']])
            
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == '__main__':
    run_backfill()

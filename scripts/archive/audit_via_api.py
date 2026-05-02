"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: audit_via_api.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/audit_via_api.py
"""

import requests
import pandas as pd
import json
import time

URL = "https://europe-west1-bdb-fondos.cloudfunctions.net/audit_database"

def fetch_audit_report():
    print(f"🌍 Calling Audit API: {URL}")
    try:
        start = time.time()
        # Firebase Callable expects { "data": ... }
        payload = {"data": {}}
        resp = requests.post(URL, json=payload, timeout=600, headers={'Content-Type': 'application/json'}) 
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

        rows = data.get('data', [])
        print(f"✅ Received {len(rows)} records.")
        
        if not rows:
            print("⚠️ No data returned.")
            return

        # Create DataFrame
        df = pd.DataFrame(rows)
        
        # Analyze locally
        print("\n--- Audit Summary (Local Analysis) ---")
        print(f"Total Funds: {len(df)}")
        if 'has_history' in df.columns:
            print(f"With History: {df['has_history'].sum()}")
        if 'metrics_sum' in df.columns:
            invalid_metrics = df[(df['metrics_sum'] < 1) | (df['metrics_sum'] > 105)]
            print(f"Metrics Invalid: {len(invalid_metrics)}")
        if 'is_hedged' in df.columns:
            print(f"Hedged Funds: {df['is_hedged'].sum()}")
        if 'equity90_candidate' in df.columns:
            print(f"Equity90 Candidates: {df['equity90_candidate'].sum()}")
        
        # Save
        filename = 'funds_v2_data_quality_report.csv'
        df.to_csv(filename, index=False)
        print(f"📝 Report saved to {filename}")
        
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == '__main__':
    fetch_audit_report()

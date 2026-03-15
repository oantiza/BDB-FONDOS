import requests
import json
import os
import sys

# URL from previous deploy output
URL = "https://europe-west1-bdb-fondos.cloudfunctions.net/refresh_daily_metrics"
TOKEN = "SECRET_DAILY_REFRESH_TOKEN_2026"

def main():
    print(f"🚀 Triggering Daily Refresh: {URL}")
    print(f"🔒 Token: {TOKEN[:5]}***")
    
    headers = {
        "X-Refresh-Token": TOKEN,
        "Content-Type": "application/json"
    }
    
    try:
        resp = requests.post(URL, json={}, headers=headers, timeout=540)
        
        if resp.status_code != 200:
            print(f"❌ Error {resp.status_code}: {resp.text}")
            return
            
        data = resp.json()
        print("\n=== JOB RESULT ===")
        print(json.dumps(data, indent=2))
        
        # Validation
        stats = data.get('stats', {})
        if stats.get('updated_history', 0) > 0:
            print("\n✅ SUCCESS: History updated.")
        else:
            print("\n⚠️ WARNING: No updates? Check logs.")

    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == '__main__':
    main()

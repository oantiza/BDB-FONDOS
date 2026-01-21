import requests
import json
import time

URL = "https://europe-west1-bdb-fondos.cloudfunctions.net/fix_database_endpoint"

def run_fix(apply_changes=False):
    print(f"🔧 Calling Fix API: {URL}")
    print(f"👉 Apply Changes: {apply_changes}")
    
    try:
        start = time.time()
        # Payload for Callable
        payload = {"data": {"apply": apply_changes}}
        
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
            
        stats = data.get('stats', {})
        print("\n--- Fix Summary ---")
        print(json.dumps(stats, indent=2))
        
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == '__main__':
    # Default to True to complete the task as requested
    run_fix(apply_changes=True)

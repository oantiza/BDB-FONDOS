import requests
import json

URL = "https://europe-west1-bdb-fondos.cloudfunctions.net/diagnose_history_endpoint"

def run_diag():
    print(f"🔍 Calling Diagnosis Endpoint: {URL}")
    try:
        resp = requests.post(URL, json={"data": {}}, timeout=60)
        if resp.status_code != 200:
            print(f"❌ Error {resp.status_code}: {resp.text}")
            return
            
        data = resp.json()
        result = data.get('result', {})
        
        if result.get('status') == 'success':
            print("\n" + "="*30)
            print(result.get('logs'))
            print("="*30 + "\n")
        else:
            print(f"❌ API Error: {result.get('error')}")

    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == '__main__':
    run_diag()

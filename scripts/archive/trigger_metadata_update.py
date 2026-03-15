import requests
import json
import csv
import sys

URL = "https://europe-west1-bdb-fondos.cloudfunctions.net/update_metadata_endpoint"

def main():
    print(f"🚀 Triggering Metadata Update (Server-Side)...")
    
    try:
        # Request apply=True
        resp = requests.post(URL, json={"data": {"apply": True}}, timeout=540)
        
        if resp.status_code != 200:
            print(f"❌ Error {resp.status_code}: {resp.text}")
            return
            
        data = resp.json()
        print(f"DEBUG RESPONSE: {json.dumps(data, indent=2)}")
        
        result = data.get('result', {})
        
        if result.get('status') == 'error': # Wrapper might return error inside result? 
             # Check distinct structure
             pass
             
        # Actual structure from endpoint: {'status': 'success', 'result': {...}}
        if data.get('status') != 'success':
            print(f"❌ API Error: {data.get('error')}")
            return

        inner_result = result # from audit_service
        
        summary = inner_result.get('summary', {})
        details = inner_result.get('details', [])
        
        print("\n--- Summary ---")
        print(json.dumps(summary, indent=2))
        
        # Save CSV
        filename = "funds_v2_extremos_update_report.csv"
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['isin', 'status', 'years_span', 'first_date', 'last_date', 'reason'])
            writer.writeheader()
            for row in details:
                writer.writerow(row)
                
        print(f"✅ Saved report to {filename} with {len(details)} rows.")

    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == '__main__':
    main()

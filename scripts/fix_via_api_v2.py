import requests
import json
import time
import pandas as pd

URL = "https://europe-west1-bdb-fondos.cloudfunctions.net/fix_database_endpoint"

def run_fix_v2(apply_changes=False):
    print(f"🔧 Calling Fix API V2: {URL}")
    print(f"👉 Apply Changes: {apply_changes}")
    
    try:
        start = time.time()
        payload = {"data": {"apply": apply_changes}}
        
        resp = requests.post(URL, json=payload, timeout=900, headers={'Content-Type': 'application/json'})
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
            
        # run_db_fix returns {'stats':..., 'report':...}
        # main.py wraps it in 'stats' key: return {'stats': run_db_fix_result}
        wrapper = data.get('stats', {})
        
        # Check if wrapper has 'report' or if it IS the stats dict (legacy)
        if 'report' in wrapper:
            final_stats = wrapper.get('stats', {})
            report_data = wrapper.get('report', [])
        else:
            # Fallback if structure is different
            final_stats = wrapper
            report_data = []

        print("\n--- Fix Summary ---")
        print(json.dumps(final_stats, indent=2))
        
        print(f"📦 Report items: {len(report_data)}")
        
        # Save Reports
        if report_data:
            try:
                df = pd.DataFrame(report_data)
                print(f"📊 DataFrame created. Shape: {df.shape}")
                df.to_csv('funds_v2_data_quality_report_v2.csv', index=False)
                print(f"✅ Saved 'funds_v2_data_quality_report_v2.csv' ({len(df)} rows)")
                
                # Candidates V2
                if 'is_candidate' in df.columns:
                    cands = df[df['is_candidate'] == True].copy()
                    cands = cands.sort_values(by='sharpe', ascending=False)
                    cands.to_csv('funds_v2_candidates_list_v2.csv', index=False)
                    print(f"✅ Saved 'funds_v2_candidates_list_v2.csv' ({len(cands)} candidates)")
                    
                    # Evidence Counts
                    total_eq90 = len(df[df['final_equity'] >= 90])
                    # Ensure history_ok is bool
                    eq90_hist_ok = len(df[(df['final_equity'] >= 90) & (df['history_ok'] == True)])
                    eq90_hist_nohedge = len(cands)
                    
                    print(f"\n--- Evidence Counts ---")
                    print(f"Total Equity >= 90%: {total_eq90}")
                    print(f"Equity90 + History OK (>=504 pts): {eq90_hist_ok}")
                    print(f"Strict Candidates (Unhedged + History OK): {eq90_hist_nohedge}")
                else:
                    print("⚠️ Column 'is_candidate' missing in report.")
            except Exception as e_csv:
                print(f"❌ CSV Error: {e_csv}")
        else:
            print("⚠️ Report data is empty.")

    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == '__main__':
    # Read-only fetch
    run_fix_v2(apply_changes=False)

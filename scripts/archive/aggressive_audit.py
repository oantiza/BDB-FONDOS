"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: aggressive_audit.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/aggressive_audit.py
"""

import os
import sys
import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
import concurrent.futures

import warnings
warnings.filterwarnings('ignore')

cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
cred = credentials.Certificate(cred_path)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

def check_fund(doc):
    isin = doc.id
    hist_ref = db.collection('historico_vl_v2').document(isin)
    hist_doc = hist_ref.get()
    
    if not hist_doc.exists:
        return {'isin': isin, 'orphan': True}
        
    hist_data = hist_doc.to_dict()
    history = hist_data.get('history') or hist_data.get('points')
    
    if not history:
        return {'isin': isin, 'orphan': True, 'msg': 'no_history_array'}
        
    dates = []
    navs = []
    type_error = False
    
    if isinstance(history, dict):
        for k, v in history.items():
            if isinstance(v, str): type_error = True
            try:
                dates.append(pd.to_datetime(k))
                navs.append(float(v))
            except: pass
    elif isinstance(history, list):
         for item in history:
             if 'date' in item and 'nav' in item:
                 if isinstance(item['nav'], str): type_error = True
                 dates.append(pd.to_datetime(item['date']))
                 navs.append(float(item['nav']))
             elif 'timestamp' in item and 'price' in item:
                 if isinstance(item['price'], str): type_error = True
                 d = item['timestamp']
                 if hasattr(d, 'isoformat'): d = d.isoformat()
                 dates.append(pd.to_datetime(d))
                 navs.append(float(item['price']))
                 
    res = {'isin': isin, 'type_error': type_error, 'outlier': False, 'gap': False}
    
    if not dates:
        return res
        
    df = pd.DataFrame({'nav': navs}, index=dates).sort_index()
    df = df[~df.index.duplicated(keep='last')]
    
    returns = df['nav'].pct_change().dropna()
    if len(returns) > 0:
        if returns.max() > 0.10 or returns.min() < -0.10:
            res['outlier'] = True
            res['max_ret'] = returns.max()
            res['min_ret'] = returns.min()
            
    recent_df = df[df.index >= pd.Timestamp(datetime.now() - timedelta(days=365))]
    if len(recent_df) > 1:
        diffs = recent_df.index.to_series().diff().dt.days
        max_gap = diffs.max()
        if max_gap > 5:
            res['gap'] = True
            res['max_gap'] = max_gap
            
    return res

def run_audit():
    print("🚀 Starting FAST AGGRESSIVE AUDIT...")
    funds = list(db.collection('funds_v3').stream())
    print(f"Total funds to check: {len(funds)}")
    
    orphans = []
    type_errors = []
    outliers = []
    gaps = []
    
    checked = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(check_fund, doc): doc for doc in funds}
        for future in concurrent.futures.as_completed(futures):
            try:
                res = future.result()
                if res.get('orphan'): orphans.append(res['isin'])
                if res.get('type_error'): type_errors.append(res['isin'])
                if res.get('outlier'): outliers.append(f"{res['isin']} (Max:{res.get('max_ret',0)*100:.1f}%, Min:{res.get('min_ret',0)*100:.1f}%)")
                if res.get('gap'): gaps.append(f"{res['isin']} (Gap:{res.get('max_gap')}d)")
            except Exception as e:
                pass
            
            checked += 1
            if checked % 50 == 0:
                print(f"Checked {checked}/{len(funds)} funds...")
                
    print("\n--- AUDIT RESULTS ---")
    print(f"Funds Checked: {checked}")
    print(f"Orphans (in v3 but no history): {len(orphans)}")
    if orphans[:10]: print(" Sample:", orphans[:10])
    print(f"Type Errors (String instead of Float for NAV): {len(type_errors)}")
    if type_errors[:10]: print(" Sample:", type_errors[:10])
    print(f"Outliers (>10% daily jump): {len(outliers)}")
    if outliers[:10]: print(" Sample:", outliers[:10])
    print(f"Gaps (>5 days missing in last year): {len(gaps)}")
    if gaps[:10]: print(" Sample:", gaps[:10])

if __name__ == '__main__':
    run_audit()

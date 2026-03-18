"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: maintenance
PURPOSE: Utility script: flag_data_quality.py
SAFE_MODE: REVIEW
RUN: python scripts/maintenance/flag_data_quality.py
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

def flag_fund(doc):
    isin = doc.id
    hist_ref = db.collection('historico_vl_v2').document(isin)
    hist_doc = hist_ref.get()
    
    if not hist_doc.exists:
        return None
        
    hist_data = hist_doc.to_dict()
    history = hist_data.get('history') or hist_data.get('points')
    
    if not history: return None
        
    dates = []
    navs = []
    
    if isinstance(history, dict):
        for k, v in history.items():
            try:
                dates.append(pd.to_datetime(k))
                navs.append(float(v))
            except: pass
    elif isinstance(history, list):
         for item in history:
             try:
                 if 'date' in item and 'nav' in item:
                     dates.append(pd.to_datetime(item['date']))
                     navs.append(float(item['nav']))
                 elif 'timestamp' in item and 'price' in item:
                     d = item['timestamp']
                     if hasattr(d, 'isoformat'): d = d.isoformat()
                     dates.append(pd.to_datetime(d))
                     navs.append(float(item['price']))
             except: pass
                 
    if not dates: return None
        
    df = pd.DataFrame({'nav': navs}, index=dates).sort_index()
    df = df[~df.index.duplicated(keep='last')]
    
    has_outlier = False
    has_gap = False
    
    returns = df['nav'].pct_change().dropna()
    if len(returns) > 0:
        if returns.max() > 0.10 or returns.min() < -0.10:
            has_outlier = True
            
    recent_df = df[df.index >= pd.Timestamp(datetime.now() - timedelta(days=365))]
    if len(recent_df) > 1:
        diffs = recent_df.index.to_series().diff().dt.days
        if diffs.max() > 5:
            has_gap = True
            
    # Update firestore if any flag is positive
    if has_outlier or has_gap:
        doc_ref = db.collection('funds_v3').document(isin)
        updates = {}
        if has_outlier: updates['data_quality.has_outliers'] = True
        if has_gap: updates['data_quality.has_gaps'] = True
        
        doc_ref.update(updates)
        return isin
        
    return None

def main():
    print(">> Starting background quality flagging...")
    funds = list(db.collection('funds_v3').where('disabled', '!=', True).stream())
    
    flagged = 0
    checked = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(flag_fund, doc): doc for doc in funds}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                flagged += 1
            checked += 1
            if checked % 50 == 0:
                print(f"Checked {checked} funds...")
                
    print(f">> DONE! Flagged {flagged} funds with bad data vectors.")

if __name__ == '__main__':
    main()

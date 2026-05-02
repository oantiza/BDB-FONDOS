import sys
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import concurrent.futures
import logging

logger = logging.getLogger(__name__)

import warnings
warnings.filterwarnings('ignore')

def process_fund(db, isin, dry_run=False):
    hist_ref = db.collection('historico_vl_v2').document(isin)
    fund_ref = db.collection('funds_v3').document(isin)
    
    hist_doc = hist_ref.get()
    
    if not hist_doc.exists:
        return None
        
    data = hist_doc.to_dict()
    history = data.get('history') or data.get('points')
    
    if not history:
        return None
        
    dates = []
    prices = []
    
    is_dict_format = isinstance(history, dict)
    
    if is_dict_format:
        for k, v in history.items():
            try:
                dates.append(pd.to_datetime(k))
                prices.append(float(v))
            except: pass
    elif isinstance(history, list):
         for item in history:
             try:
                 if 'date' in item and 'nav' in item:
                      dates.append(pd.to_datetime(item['date']))
                      prices.append(float(item['nav']))
                 elif 'timestamp' in item and 'price' in item:
                      d = item['timestamp']
                      if hasattr(d, 'isoformat'): d = d.isoformat()
                      dates.append(pd.to_datetime(d))
                      prices.append(float(item['price']))
             except: pass
                 
    if not dates:
        return None
        
    df = pd.DataFrame({'price': prices}, index=dates).sort_index()
    df = df[~df.index.duplicated(keep='last')]
    
    original_points_count = len(df)
    
    if original_points_count < 2:
        return None
        
    has_gaps = False
    has_outliers = False
    anomalies_removed = 0
    
    # 1. Detect Gaps > 5 Days
    recent_df = df[df.index >= pd.Timestamp(datetime.now() - timedelta(days=365))]
    if len(recent_df) > 1:
        diffs = recent_df.index.to_series().diff().dt.days
        if diffs.max() > 5:
            has_gaps = True

    # 2. Spike Detection
    rolling_median = df['price'].rolling(window=11, center=True, min_periods=3).median()
    deviation = np.abs(df['price'] - rolling_median) / rolling_median
    anomaly_mask = deviation > 0.30
    
    anomalies_removed = anomaly_mask.sum()
    clean_df = df[~anomaly_mask]
    
    # 3. Validated Volatility Check
    if len(clean_df) > 1:
        returns = clean_df['price'].pct_change().dropna()
        if len(returns) > 0 and (returns.max() > 0.10 or returns.min() < -0.10):
            has_outliers = True
    
    if not dry_run and (anomalies_removed > 0 or has_gaps or has_outliers):
        batch = db.batch()
        
        if anomalies_removed > 0:
            new_history = None
            if is_dict_format:
                new_history = {str(k.date()): float(v) for k, v in clean_df['price'].items()}
            else:
                new_history = []
                for item in history:
                    date_str = None
                    if 'date' in item: date_str = item['date']
                    elif 'timestamp' in item:
                        d = item['timestamp']
                        if hasattr(d, 'isoformat'): date_str = d.isoformat()
                        else: date_str = str(d)
                    
                    if date_str:
                        try:
                            parsed_date = pd.to_datetime(date_str)
                            if not anomaly_mask.get(parsed_date, False):
                                new_history.append(item)
                        except:
                            new_history.append(item)
            
            field_to_update = 'history' if 'history' in data else 'points'
            batch.update(hist_ref, {field_to_update: new_history})
            logger.info(f"[{isin}] Cleaned {anomalies_removed} anomalies.")
            
        if has_gaps or has_outliers:
            updates = {}
            if has_outliers: updates['data_quality.has_outliers'] = True
            if has_gaps: updates['data_quality.has_gaps'] = True
            batch.update(fund_ref, updates)
            
        batch.commit()
            
    return {
        'isin': isin,
        'anomalies_removed': int(anomalies_removed),
        'has_gaps': has_gaps,
        'has_outliers': has_outliers
    }

def run_nav_validation_pipeline(db, dry_run=False):
    logger.info(f"🚀 Starting Automated NAV Validation Pipeline (Dry Run: {dry_run})...")
    
    # Fetch all funds and filter locally to catch those lacking the 'disabled' field 
    all_funds = list(db.collection('funds_v3').stream())
    funds = [doc for doc in all_funds if doc.to_dict().get('disabled') != True]
    
    logger.info(f"Loaded {len(funds)} active funds from funds_v3.")
    
    total_anomalies_cleaned = 0
    funds_with_gaps = 0
    funds_with_outliers = 0
    checked = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(process_fund, db, doc.id, dry_run): doc for doc in funds}
        
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                total_anomalies_cleaned += res['anomalies_removed']
                if res['has_gaps']: funds_with_gaps += 1
                if res['has_outliers']: funds_with_outliers += 1
            
            checked += 1
            if checked % 50 == 0:
                logger.info(f"Processed {checked} funds...")
                
    logger.info("\n✅ NAV VALIDATION PIPELINE COMPLETE ----------------")
    logger.info(f"Total funds checked: {checked}")
    logger.info(f"Spike Points Deleted: {total_anomalies_cleaned}")
    logger.info(f"Funds Flagged (Gaps > 5 Days): {funds_with_gaps}")
    logger.info(f"Funds Flagged (Sustained Moves > 10%): {funds_with_outliers}")
    
    return {
        "success": True, 
        "total_funds": checked, 
        "cleaned_spikes": total_anomalies_cleaned,
        "gaps_flagged": funds_with_gaps,
        "outliers_flagged": funds_with_outliers
    }

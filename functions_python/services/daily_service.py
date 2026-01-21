import firebase_admin
from firebase_admin import firestore
import logging
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# --- CONFIG ---
HISTORY_MIN_POINTS = 504
HISTORY_MIN_YEARS = 2.0
MAX_RUNTIME_SEC = 510  # Leave buffer from 540s

def _to_float(x):
    if x is None: return 0.0
    try: return float(x)
    except: return 0.0

def detect_hedging(name, class_name):
    keywords = ['hedged', 'hgd', 'cubierto', 'currency hedged', 'eur hedged']
    text = f"{str(name or '')} {str(class_name or '')}".lower()
    return any(k in text for k in keywords)

def extract_history(h_data):
    """
    Robust history extraction supporting multiple formats:
    1. 'series': list of dicts [{'date': ..., 'price': ...}]
    2. 'dates'/'values': aligned arrays
    3. Top-level keys: 'YYYY-MM-DD'
    """
    tuples = []
    
    # UNWRAP 'data' key if present and primary keys missing
    content = h_data
    
    # PRIORITY 0: Canonical 'history'
    if 'history' in h_data and isinstance(h_data['history'], list):
        for item in h_data['history']:
            if not isinstance(item, dict): continue
            d_val = item.get('date')
            n_val = item.get('nav')
            if d_val and (n_val is not None):
                try:
                    tuples.append((d_val, float(n_val)))
                except: pass
        if tuples: return list(sorted(tuples, key=lambda x: x[0]))

    if 'data' in h_data and 'series' not in h_data and 'dates' not in h_data:
        d_val = h_data['data']
        if isinstance(d_val, dict):
            content = d_val
        elif isinstance(d_val, list):
            # Treat list as series
            content = {'series': d_val}
            
    # CASE 1: 'series' (List of Dicts)
    series = content.get('series')
    if series and isinstance(series, list):
        for p in series:
            d = p.get('date')
            # Support 'price' OR 'close'
            v = p.get('price')
            if v is None:
                v = p.get('close')
                
            if d and v is not None:
                tuples.append((d, float(v)))
    
    # CASE 2: 'dates' + 'values' arrays
    elif 'dates' in content and 'values' in content:
        dates = content['dates']
        values = content['values']
        if len(dates) == len(values):
            for d, v in zip(dates, values):
                if d and v is not None:
                    tuples.append((d, float(v)))
                    
    # CASE 3: Map (YYYY-MM-DD keys) - Check content direct items
    if not tuples:
        for k, v in content.items():
            if len(k) == 10 and k[4] == '-' and k[7] == '-':
                 try:
                     tuples.append((k, float(v)))
                 except: pass

    # Normalize Dates
    final_data = []
    for d_raw, v in tuples:
        dt = None
        if isinstance(d_raw, datetime): dt = d_raw
        elif isinstance(d_raw, str):
            try: dt = datetime.fromisoformat(d_raw.replace('Z',''))
            except: pass
        
        if dt:
            final_data.append({'date': dt, 'price': v})
            
    final_data.sort(key=lambda x: x['date'])
    return final_data

def refresh_daily_logic(db, start_time):
    print("🚀 Starting Daily Refresh Job...")
    
    # 1. Fetch Risk Free Rate
    rf_rate = 0.03
    rf_source = 'fallback'
    try:
        rf_doc = db.collection('system_settings').document('risk_free_rate').get()
        if rf_doc.exists:
            rf_rate = _to_float(rf_doc.to_dict().get('rate', 0.03))
            rf_source = 'firestore'
    except: pass
    
    # 2. Iterate Funds
    funds_ref = db.collection('funds_v3')
    docs = list(funds_ref.stream())
    
    batch = db.batch()
    batch_count = 0
    stats = {
        'scanned': 0, 'updated_history': 0, 'updated_perf': 0, 
        'errors': 0, 'candidates_count': 0, 'rf_rate': rf_rate
    }
    
    errors_sample = []
    debug_logs = [] 
    
    valid_candidates = [] 
    
    for d in docs:
        # Check Time Quota
        now_ts = datetime.utcnow().timestamp()
        if (now_ts - start_time) > MAX_RUNTIME_SEC:
            print("⚠️ Timeout Warning - Saving Partial State")
            break
            
        isin = d.id
        f_data = d.to_dict() or {}
        stats['scanned'] += 1
        
        # --- A. READ HISTORY ---
        try:
            h_doc = db.collection('historico_vl_v2').document(isin).get()
            
            history_points = 0
            history_ok = False
            first_date_str = None
            last_date_str = None
            years_span = 0.0
            
            perf_update = {}
            
            if h_doc.exists:
                h_dict = h_doc.to_dict()
                raw_points = extract_history(h_dict)
                history_points = len(raw_points)
                
                # DEBUG LOGGING
                if stats['scanned'] <= 10:
                    keys = list(h_dict.keys())
                    log_msg = f"{isin}: Keys={keys} Points={history_points}"
                    
                    if 'data' in h_dict:
                        d_val = h_dict['data']
                        log_msg += f" DataType={type(d_val).__name__}"
                        if isinstance(d_val, dict):
                             log_msg += f" DataKeys={list(d_val.keys())}"
                        elif isinstance(d_val, list):
                             if d_val:
                                 log_msg += f" FirstItem={str(d_val[0])[:50]} ItemType={type(d_val[0]).__name__}"
                             else:
                                 log_msg += " EmptyList"
                        else:
                             log_msg += f" RawVal={str(d_val)[:50]}"
                        
                    debug_logs.append(log_msg)
                    print(f"DEBUG {log_msg}")

                if history_points > 0:
                    d0 = raw_points[0]['date']
                    d1 = raw_points[-1]['date']
                    first_date_str = d0.strftime("%Y-%m-%d")
                    last_date_str = d1.strftime("%Y-%m-%d")
                    
                    days_diff = (d1 - d0).days
                    years_span = round(days_diff / 365.25, 3)
                    
                    # HISTORY CHECK
                    if history_points >= HISTORY_MIN_POINTS and years_span >= HISTORY_MIN_YEARS:
                        history_ok = True
                        
            # --- B. CALC PERF (If history OK) ---
            if history_ok:
                df = pd.DataFrame(raw_points)
                df.set_index('date', inplace=True)
                
                # Daily Returns
                df['pct_change'] = df['price'].pct_change()
                df.dropna(inplace=True)
                
                if not df.empty:
                    # Metrics
                    # CAGR
                    p_start = raw_points[0]['price']
                    p_end = raw_points[-1]['price']
                    cagr = (p_end / p_start) ** (1 / max(years_span, 0.01)) - 1
                    
                    # Vol
                    vol_daily = df['pct_change'].std()
                    vol_ann = vol_daily * np.sqrt(252)
                    
                    # Sharpe
                    sharpe = (cagr - rf_rate) / vol_ann if vol_ann > 1e-6 else 0.0
                    
                    perf_update = {
                        'std_perf.return': float(round(cagr, 4)),
                        'std_perf.volatility': float(round(vol_ann, 4)),
                        'std_perf.sharpe': float(round(sharpe, 4)),
                        'std_perf.rf_rate_used': rf_rate,
                        'std_perf.rf_source': rf_source,
                        'std_perf.window_points': history_points,
                        'std_perf.last_calculated_at': datetime.utcnow(),
                        'data_quality.std_perf_ok': True
                    }
                    stats['updated_perf'] += 1
            
            else:
                # Clear perf flags if history fails now? 
                # Or keep old? Prompt implies 'Source of Truth'.
                # Let's mark std_perf_ok = False
                perf_update = {
                    'data_quality.std_perf_ok': False
                }

            # --- C. PREPARE UPDATE ---
            update_data = {
                'std_extra.firstDate': first_date_str,
                'std_extra.lastDate': last_date_str,
                'std_extra.yearsHistory': years_span,
                'data_quality.history_points': history_points,
                'data_quality.history_ok': history_ok,
                'data_quality.last_checked_at': datetime.utcnow(),
                'schema_version': 3
            }
            update_data.update(perf_update)
            
            # Remove None values
            update_data = {k: v for k, v in update_data.items() if v is not None}
            
            batch.update(funds_ref.document(isin), update_data)
            batch_count += 1
            stats['updated_history'] += 1
            
            # --- D. COLLECT CANDIDATE ---
            # Criteria: Equity >= 90 (normalized), History OK, Unhedged
            metrics = f_data.get('metrics', {})
            eq = _to_float(metrics.get('equity'))
            
            # Use 'perf_update' keys if available, else fallback to existing?
            # Ideally use just calculated sharpe.
            current_sharpe = perf_update.get('std_perf.sharpe', -99.0)
            
            is_hedged = detect_hedging(f_data.get('name'), f_data.get('class'))
            
            if (eq >= 90.0) and history_ok and (not is_hedged):
                valid_candidates.append({
                    'isin': isin,
                    'name': f_data.get('name'),
                    'sharpe': current_sharpe
                })

            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0

        except Exception as e:
            stats['errors'] += 1
            if len(errors_sample) < 20:
                errors_sample.append(f"{isin}: {str(e)}")
    
    if batch_count > 0:
        batch.commit()
        
    # --- E. REGENERATE CONFIG ---
    # Sort by Sharpe Desc
    valid_candidates.sort(key=lambda x: x['sharpe'], reverse=True)
    top_50 = valid_candidates[:50]
    stats['candidates_count'] = len(top_50)
    
    top_isins = [c['isin'] for c in top_50]
    
    # Save Config
    db.collection('config').document('auto_complete_candidates').set({
        'equity90_isins': top_isins,
        'criteria': 'Equity>=90, History>=2y, Unhedged, Top50 Sharpe',
        'updated_at': datetime.utcnow(),
        'source': 'refresh_daily_metrics'
    })
    
    # --- F. SAVE STATUS ---
    status_doc = {
        'timestamp': datetime.utcnow(),
        'stats': stats,
        'errors_sample': errors_sample,
        'debug_logs': debug_logs
    }
    db.collection('config').document('daily_refresh_status').set(status_doc)
    
    print(f"✅ Refresh Stats: {stats}")
    return status_doc

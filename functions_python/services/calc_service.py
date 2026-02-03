import firebase_admin
from firebase_admin import firestore
from datetime import datetime
import pandas as pd
import numpy as np
from .data_fetcher import DataFetcher

def _calculate_metrics(prices_df, risk_free_rate, force_3y=False):
    """
    Calculates Annualized Return, Volatility, and Sharpe using Morningstar Methodology.
    prices_df: DataFrame with 'date' and 'price' columns.
    risk_free_rate: float (yearly rate, e.g. 0.03)
    force_3y: bool, if True, slices to last 1095 days.
    """
    try:
        # 1. Sanitization: Ensure Timeseries Index & Business Days
        df = prices_df.copy()
        df['date'] = pd.to_datetime(df['date'])
        df = df.set_index('date').sort_index()
        
        # Resample to Daily and Reindex to Business Days
        df = df.resample('D').last()
        if not df.empty:
            b_range = pd.date_range(start=df.index[0], end=df.index[-1], freq='B')
            df = df.reindex(b_range)
        
        # Fill Gaps (Professional ffill/bfill)
        df = df.ffill().bfill()
        
        # 2. Optional: 3-Year Window (1095 days)
        if force_3y and not df.empty:
            start_date = df.index[-1] - pd.Timedelta(days=1095)
            df = df[df.index >= start_date]

        if len(df) < 50: return None
        
        # 3. Arithmetic Excess Return Methodology
        # Daily Returns
        returns_daily = df['price'].pct_change().dropna()
        if len(returns_daily) < 1: return None
        
        # Excess returns over daily Risk-Free
        rf_daily = risk_free_rate / 252.0
        excess_returns = returns_daily - rf_daily
        
        # Morningstar Sharpe: (Mean Excess / Std Excess) * sqrt(252)
        if excess_returns.std() > 0:
            sharpe = (excess_returns.mean() / excess_returns.std()) * np.sqrt(252)
        else:
            sharpe = 0.0
            
        # 4. Annualized Volatility (Standard on Returns)
        vol_annual = returns_daily.std() * np.sqrt(252)
        
        # 5. Annualized Return (Arithmetic Mean Alignment)
        # Sincronizamos con weights.T @ mu (Senior Methodology)
        cagr = float(returns_daily.mean() * 252)
        
        # Real Years for context
        days = (df.index[-1] - df.index[0]).days
        years = max(days / 365.25, 0.1) 
            
        return {
            'return': round(float(cagr), 4),
            'volatility': round(float(vol_annual), 4),
            'sharpe': round(float(sharpe), 4),
            'years': round(years, 2),
            'points': len(df)
        }
    except Exception as e:
        print(f"Metrics Calc Error: {e}")
        import traceback
        traceback.print_exc()
        return None

def backfill_std_perf_logic(db):
    print("🚀 Starting Std Perf Backfill (Phase 4)...")
    
    # 1. Get Risk Free Rate (Via DataFetcher)
    fetcher = DataFetcher(db)
    rf_rate = fetcher.get_dynamic_risk_free_rate()
    print(f"💰 Risk Free Rate used: {rf_rate*100:.2f}%")
    
    # 2. Iterate Funds
    funds_ref = db.collection('funds_v3')
    docs = list(funds_ref.stream())
    
    stats = {
        'total': len(docs),
        'processed_ok': 0,
        'skipped_history': 0,
        'errors': 0,
        'candidates_v3_count': 0
    }
    
    results_csv = []
    candidates = []
    
    batch = db.batch()
    batch_count = 0
    
    for d in docs:
        isin = d.id
        dd = d.to_dict() or {}
        
        # Check history length flag first? 
        # Or just read history. User requirement: "Procesar solo ISINs con history_points >= 504".
        # We can trust 'data_quality.history_points' if it exists from previous step, to save reads.
        dq = dd.get('data_quality', {})
        h_pts = dq.get('history_points', 0)
        
        
        # Check history length - SELF HEAL STRATEGY
        # Ignore metadata 'history_points' for the decision to fetch, 
        # because diagnosis showed distinct funds with 0 points but valid history document.
        # We will fetch history and count for everyone.
        
        # Fetch full history for calculation
        try:
            h_doc = db.collection('historico_vl_v2').document(isin).get()
            if not h_doc.exists:
                # Confirm history is missing
                if dq.get('history_ok', False):
                    # Flag correction if it was true before
                    doc_ref = funds_ref.document(isin)
                    batch.update(doc_ref, {'data_quality.history_ok': False, 'data_quality.history_points': 0})
                    batch_count += 1
                stats['skipped_history'] += 1
                results_csv.append({'isin': isin, 'status': 'skipped', 'reason': 'No history doc'})
                continue
                
            h_data = h_doc.to_dict()
            
            # Priority 1: Canonical History
            series = h_data.get('history', [])
            is_canonical = True if series else False
            
            # Priority 2: Legacy Series
            if not series:
                series = h_data.get('series', [])
                is_canonical = False
            
            # Create DF
            data_tuples = []
            for p in series:
                d_val = p.get('date')
                # Canonical uses 'nav', Legacy uses 'price'
                p_val = p.get('nav') if p.get('nav') is not None else p.get('price')
                
                if d_val and p_val is not None:
                    d_val = p['date']
                    if isinstance(d_val, str):
                        try: d_val = datetime.fromisoformat(d_val.replace('Z',''))
                        except: continue
                    data_tuples.append({'date': d_val, 'price': float(p['price'])})
            
            real_points = len(data_tuples)
            
            if real_points < 504:
                stats['skipped_history'] += 1
                
                # Update metadata if needed
                update_dq = {}
                if dq.get('history_points') != real_points:
                    update_dq['data_quality.history_points'] = real_points
                if dq.get('history_ok') is True:
                     update_dq['data_quality.history_ok'] = False
                     
                if update_dq:
                     doc_ref = funds_ref.document(isin)
                     batch.update(doc_ref, update_dq)
                     batch_count += 1
                     
                results_csv.append({'isin': isin, 'status': 'skipped', 'reason': f'Insufficient history ({real_points})'})
                continue
                
            df = pd.DataFrame(data_tuples).sort_values('date')
            
            # Calculate
            m = _calculate_metrics(df, rf_rate)
            
            if m:
                # Prepare Update
                std_perf = {
                    'return': m['return'],
                    'volatility': m['volatility'],
                    'sharpe': m['sharpe'],
                    'last_calculated_at': firestore.SERVER_TIMESTAMP,
                    'window_points': m['points'],
                    'rf_source': rf_rate
                }
                
                # Update Data Quality
                new_dq = dq.copy()
                new_dq['std_perf_ok'] = True
                new_dq['last_checked_at'] = firestore.SERVER_TIMESTAMP
                
                # Add to Batch
                doc_ref = funds_ref.document(isin)
                batch.update(doc_ref, {
                    'std_perf': std_perf,
                    'data_quality': new_dq
                })
                batch_count += 1
                stats['processed_ok'] += 1
                
                results_csv.append({
                    'isin': isin, 'status': 'ok', 
                    'sharpe': m['sharpe'], 'vol': m['volatility'], 'ret': m['return'],
                    'points': m['points']
                })
                
                # Check for Candidate V3 (Equity >= 90 + Unhedged + History OK + Valid Sharpe)
                metrics = dd.get('metrics', {})
                # Use float parse robustly
                def gv(x): 
                    try: return float(x)
                    except: return 0.0
                eq = gv(metrics.get('equity'))
                is_hedged = any(k in f"{dd.get('name')} {dd.get('class')}".lower() for k in ['hedged','hgd','cubierto'])
                
                if eq >= 90.0 and (not is_hedged):
                    candidates.append({
                        'isin': isin,
                        'sharpe': m['sharpe'],
                        'name': dd.get('name')
                    })
                    
            else:
                stats['errors'] += 1
                results_csv.append({'isin': isin, 'status': 'error', 'reason': 'calc_failed_nan'})

        except Exception as e:
            print(f"Calc error {isin}: {e}")
            stats['errors'] += 1
            results_csv.append({'isin': isin, 'status': 'error', 'reason': str(e)})

        if batch_count >= 400:
            batch.commit()
            batch = db.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()
        
    # Update Config
    candidates.sort(key=lambda x: x['sharpe'], reverse=True)
    top_candidates = [c['isin'] for c in candidates[:50]]
    stats['candidates_v3_count'] = len(candidates)
    
    try:
        db.collection('config').document('auto_complete_candidates').set({
            'equity90_isins': top_candidates,
            'last_updated': firestore.SERVER_TIMESTAMP,
            'source': 'calc_service_backfill'
        })
    except: pass

    return {'stats': stats, 'csv_rows': results_csv}

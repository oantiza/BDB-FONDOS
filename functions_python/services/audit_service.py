import firebase_admin
from firebase_admin import firestore
import logging

def _to_float(x):
    if x is None: return 0.0
    if isinstance(x, (int, float)): return float(x)
    if isinstance(x, str):
        c = x.strip().replace('%','').replace(',','.')
        try:
            return float(c)
        except:
            return 0.0
    return 0.0

def detect_hedging(name, class_name):
    # Keywords for hedging detection
    keywords = ['hedged', 'hgd', 'cubierto', 'currency hedged', 'eur hedged']
    text = f"{str(name or '')} {str(class_name or '')}".lower()
    return any(k in text for k in keywords)

def run_audit(db):
    print("🚀 Starting Audit of funds_v3 (Cloud Side)...")
    
    # 1. Fetch all funds
    funds_ref = db.collection('funds_v3')
    docs = list(funds_ref.stream())
    
    data = []

    # 2. Iterate and check
    # Optimization: Prefetch all historico presence or check individually?
    # In cloud, individual checks are fast if same region.
    # However, N reads is costly. 
    # Alternative: Use a collection group query or just list documents?
    # For now, we will perform the check. If it times out, we'll see.
    # To be safer, let's limit to 2000 or similar if needed, or just iterate.
    
    # Optimization: check 'historico_vl_v2' existence via a separate loop or assuming it's synced.
    # Strictly we must check.
    
    for d in docs:
        dd = d.to_dict() or {}
        isin = d.id
        name = dd.get('name', 'Unknown')
        class_name = dd.get('class', '')
        currency = dd.get('currency', '')
        
        # Metrics
        metrics = dd.get('metrics', {})
        eq = _to_float(metrics.get('equity'))
        bd = _to_float(metrics.get('bond'))
        cs = _to_float(metrics.get('cash'))
        ot = _to_float(metrics.get('other'))
        
        metrics_sum = eq + bd + cs + ot
        has_metrics = metrics_sum > 0.01
        
        # Hedging
        is_hedged = detect_hedging(name, class_name)
        
        # History Check (Expensive step)
        # Check if document exists in historico_vl_v2
        has_history = False
        try:
            # We can use snapshot.exists.
            # To avoid reading full payload, use select([])?
            # Cloud Firestore client supports this.
            # doc_snap = db.collection('historico_vl_v2').document(isin).get(['__name__']) # Logic not exact in Python SDK
            # Just get().
            doc_snap = db.collection('historico_vl_v2').document(isin).get()
            has_history = doc_snap.exists
        except:
            pass

        equity90_candidate = (eq >= 90.0) and has_history and (not is_hedged)

        row = {
            'isin': isin,
            'name': name,
            'currency': currency,
            'is_hedged': is_hedged,
            'has_metrics': has_metrics,
            'metrics_sum': round(metrics_sum, 2),
            'equity': round(eq, 2),
            'bond': round(bd, 2),
            'cash': round(cs, 2),
            'other': round(ot, 2),
            'has_history': has_history,
            'equity90_candidate': equity90_candidate
        }
        data.append(row)
        
    return data

def diagnose_history_logic(db):
    import re
    ISINS = ['BE0946564383', 'LU2784406998']
    logs = []
    
    logs.append(f"🔍 Diagnosing History for: {ISINS}")

    for isin in ISINS:
        logs.append(f"\n--- ISIN: {isin} ---")
        doc_ref = db.collection('historico_vl_v2').document(isin)
        doc = doc_ref.get()
        
        if not doc.exists:
            logs.append("❌ Document 'historico_vl_v2' DOES NOT EXIST.")
        else:
            logs.append("✅ Document EXISTS.")
            data = doc.to_dict()
            keys = list(data.keys())
            logs.append(f"   Top-level keys ({len(keys)}): {keys[:10]} ...")
            
            # Check "series"
            if 'series' in data:
                s = data['series']
                if isinstance(s, list):
                    logs.append(f"   'series' is LIST. Length: {len(s)}")
                    if len(s) > 0:
                        logs.append(f"   Sample item: {s[0]}")
                else:
                    logs.append(f"   'series' is type {type(s)}.")
            else:
                logs.append("   'series' key MISSING.")

            # Check map-style dates
            date_keys = [k for k in keys if re.match(r'^\d{4}-\d{2}-\d{2}', k)]
            if date_keys:
                logs.append(f"   found {len(date_keys)} keys looking like YYYY-MM-DD.")
                
            # Check arrays
            if 'dates' in data:
                logs.append(f"   'dates' array found. Length: {len(data['dates'])}")
            if 'values' in data:
                logs.append(f"   'values' array found. Length: {len(data['values'])}")
                
        # Check subcollection 'daily'
        sub_dailies = list(doc_ref.collection('daily').limit(10).stream())
        if sub_dailies:
            logs.append(f"   ⚠️ Found SUBCOLLECTION 'daily'. Sample docs: {len(sub_dailies)}+")
        else:
            logs.append("   No 'daily' subcollection found.")
            
    return "\n".join(logs)

def update_years_span_logic(db, apply=False):
    import datetime
    
    print("🚀 Starting Update Years Span Logic...")
    
    # 1. List all funds
    funds_ref = db.collection('funds_v3')
    # Limit for safety or stream all? Stream all.
    docs = list(funds_ref.stream())
    
    results = []
    batch = db.batch()
    batch_count = 0
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    # 2. Iterate
    for d in docs:
        isin = d.id
        status = 'skipped'
        reason = ''
        first_date = ''
        last_date = ''
        years_span = 0.0
        
        try:
            # Fetch History
            h_doc = db.collection('historico_vl_v2').document(isin).get()
            if not h_doc.exists:
                reason = 'no_history_doc'
                skipped_count += 1
            else:
                h_data = h_doc.to_dict()
                
                # Priority 1: Canonical 'history'
                series = []
                if 'history' in h_data and isinstance(h_data['history'], list):
                    series = h_data['history'] 
                
                # Priority 2: Legacy 'series'
                if not series:
                    series = h_data.get('series')
                
                # Validation / Fallback to 'data' key
                if not series:
                    data_field = h_data.get('data')
                    if isinstance(data_field, list):
                        series = data_field
                    elif isinstance(data_field, dict):
                        series = data_field.get('series')
                
                if not series:
                    series = []
                
                # Extract valid dates
                dates = []
                for p in series:
                    if not isinstance(p, dict): continue
                    d_val = p.get('date')
                    val = p.get('nav') if p.get('nav') is not None else p.get('price')
                    
                    if d_val and val is not None:
                         if isinstance(d_val, str):
                             try:
                                 # parse ISO
                                 dt = datetime.datetime.fromisoformat(d_val.replace('Z',''))
                                 dates.append(dt)
                             except: pass
                         elif isinstance(d_val, datetime.datetime):
                             dates.append(d_val)
                
                if not dates:
                    reason = 'empty_history'
                    skipped_count += 1
                else:
                    dates.sort()
                    d0 = dates[0]
                    d1 = dates[-1]
                    
                    first_date = d0.strftime("%Y-%m-%d")
                    last_date = d1.strftime("%Y-%m-%d")
                    
                    diff_days = (d1 - d0).days
                    years_span = round(diff_days / 365.25, 3)
                    span_ok = (years_span >= 2.0)
                    
                    status = 'ok'
                    
                    if apply:
                        # Prepare update
                        # Look at existing to merge?
                        # funds_v3 update is safe merge by default
                        
                        updates = {
                            'std_extra.firstDate': first_date,
                            'std_extra.lastDate': last_date,
                            'std_extra.yearsHistory_span': years_span,
                            'data_quality.history_span_ok_2y': span_ok,
                            'data_quality.last_checked_at': datetime.datetime.utcnow(),
                            'schema_version': 3
                        }
                        
                        batch.update(funds_ref.document(isin), updates)
                        batch_count += 1
                        updated_count += 1
                        
                        if batch_count >= 400:
                            batch.commit()
                            batch = db.batch()
                            batch_count = 0

        except Exception as e:
            status = 'error'
            reason = str(e)
            error_count += 1
            
        results.append({
            'isin': isin,
            'status': status,
            'years_span': years_span,
            'first_date': first_date,
            'last_date': last_date,
            'reason': reason
        })
        
    if apply and batch_count > 0:
        batch.commit()
        
    return {
        'summary': {
            'total': len(docs),
            'updated': updated_count,
            'skipped': skipped_count,
            'errors': error_count
        },
        'details': results
    }

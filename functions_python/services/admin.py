from datetime import datetime, timedelta
import requests
import re
from .config import BUCKET_NAME, EODHD_API_KEY

def clean_duplicates_logic(db):
    try:
        docs = db.collection('funds_v3').stream()
        all_funds = []
        for d in docs:
            data = d.to_dict()
            data['doc_id'] = d.id
            all_funds.append(data)
            
        print(f"Cleaner: Scanning {len(all_funds)} funds...")

        by_isin = {}
        for f in all_funds:
            isin = f.get('isin', '').strip().upper()
            if not isin: continue
            if isin not in by_isin: by_isin[isin] = []
            by_isin[isin].append(f)
            
        deleted_count = 0
        preserved_count = 0
        
        batch = db.batch()
        batch_limit = 400
        batch_ops = 0
        
        def commit_if_full():
            nonlocal batch, batch_ops, deleted_count
            if batch_ops >= batch_limit:
                batch.commit()
                batch = db.batch()
                batch_ops = 0
                print("Batch committed.")

        def calculate_score(fund_data):
            score = 0
            for k, v in fund_data.items():
                if v and str(v).strip() and k != 'std_extra':
                    score += 1
            extra = fund_data.get('std_extra', {})
            if isinstance(extra, dict):
                for k, v in extra.items():
                    if v and str(v).strip():
                        score += 1
            return score

        for isin, group in by_isin.items():
            if len(group) > 1:
                group.sort(key=lambda x: calculate_score(x), reverse=True)
                
                winner = group[0]
                losers = group[1:]
                
                preserved_count += 1
                
                for loser in losers:
                    ref = db.collection('funds_v3').document(loser['doc_id'])
                    batch.delete(ref)
                    batch_ops += 1
                    deleted_count += 1
                    commit_if_full()
        
        if batch_ops > 0:
            batch.commit()
            
        return {
            'success': True,
            'scanned': len(all_funds),
            'deleted': deleted_count,
            'preserved': preserved_count,
            'message': f"Limpieza completada: {deleted_count} duplicados eliminados."
        }

    except Exception as e:
        print(f"❌ Clean Error: {e}")
        return {'success': False, 'error': str(e)}

def restore_historico_logic(db):
    try:
        funds_ref = db.collection('funds_v3')
        docs = funds_ref.stream()
        
        updated_count = 0
        errors = []
        
        batch = db.batch()
        batch_counter = 0
        BATCH_LIMIT = 400
        
        for doc in docs:
            fund_data = doc.to_dict()
            isin = fund_data.get('isin')
            
            if not isin: continue
            
            ticker = fund_data.get('eod_ticker', isin)
            start_date = (datetime.now() - timedelta(days=365*5)).strftime('%Y-%m-%d')
            
            url = f"https://eodhd.com/api/eod/{ticker}"
            params = {
                'api_token': EODHD_API_KEY, 
                'fmt': 'json', 
                'from': start_date, 
                'order': 'a'
            }
            
            try:
                r = requests.get(url, params=params, timeout=10)
                if r.status_code == 200:
                    data = r.json()
                    
                    if isinstance(data, list) and len(data) > 0:
                        history_list = []
                        for p in data:
                            date_str = p.get('date')
                            # Prefer adjusted_close, then close.
                            price_val = p.get('adjusted_close') or p.get('close')
                            
                            # Validation: Must have date and price
                            if not date_str or price_val is None: 
                                continue
                                
                            try:
                                price_num = float(price_val)
                                if price_num <= 0: continue # Invalid price
                            except:
                                continue

                            history_list.append({
                                'date': date_str, 
                                'nav': price_num
                            })
                        
                        if history_list:
                            # Use canonical writer (it validates and formats)
                            # Pass batch object for efficient writing
                            from .history_writer import write_history_canonical
                            write_history_canonical(
                                db=db, 
                                isin=isin, 
                                history_list=history_list, 
                                source="EODHD", 
                                source_format="canonical",
                                batch=batch
                            )
                            
                            batch_counter += 1
                            updated_count += 1
                            
                            # Optional: Update funds_v3 metadata for quality
                            # We can do this in a separate loop or here if we have refs.
                            # For now, let's stick to history restoration.
                            
                            if batch_counter >= BATCH_LIMIT:
                                batch.commit()
                                batch = db.batch()
                                batch_counter = 0
                                print(f"Committed batch. Total so far: {updated_count}")
                        else:
                             errors.append(f"{isin}: Valid history empty after filtering")
                            
                else:
                    errors.append(f"{isin}: EODHD status {r.status_code}")
                    
            except Exception as e:
                errors.append(f"{isin}: {str(e)}")

        if batch_counter > 0:
            batch.commit()
            
        return {
            'success': True,
            'updated': updated_count,
            'errors': errors[:20] 
        }

    except Exception as ie:
        return {'error': str(ie)}

def analyze_isin_health_logic(db, bucket):
    from firebase_admin import storage
    
    print("🔍 Starting ISIN Health Check...")

    funds_ref = db.collection('funds_v3')
    docs = funds_ref.stream()

    total = 0
    corrupted_ids = []
    corrupted_data = []

    isin_pattern = re.compile(r'^[A-Z]{2}[A-Z0-9]{9}\d$')

    for doc in docs:
        total += 1
        d = doc.to_dict()
        fid = doc.id
        
        is_bad = False
        reasons = []
        
        # Check ID
        if len(fid) != 12: 
            is_bad = True
            reasons.append("ID Length != 12")
            
        if not isin_pattern.match(fid):
            # Soft check
            if len(fid) > 15: # Suspicious long ID
                 is_bad = True
                 reasons.append("ID Pattern Invalid")

        # Check Fields
        if not d.get('eod_ticker'):
             reasons.append("Missing eod_ticker") # Not corruption per se but issue
        
        if is_bad:
            corrupted_ids.append(fid)
            corrupted_data.append({
                'id': fid,
                'name': d.get('name', 'Unknown'),
                'reasons': reasons
            })
            
    print(f"Found {len(corrupted_ids)} potential issues out of {total} funds.")
    
    # Save Report
    report = {
        'total_scanned': total,
        'issues_found': len(corrupted_ids),
        'timestamp': datetime.now().isoformat(),
        'details': corrupted_data
    }
    
    import json
    blob = bucket.blob("reports/isin_health_report.json")
    blob.upload_from_string(json.dumps(report, indent=2), content_type='application/json')
    
    return report

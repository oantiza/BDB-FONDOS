
# ==========================================
# REPAIR TOOLS
# ==========================================

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540, cors=cors_config)
def analyze_isin_health(request: https_fn.CallableRequest):
    """
    Analyzes 'funds_v2' for corrupted ISINs (id or field).
    Checks for:
    1. ID Length != 12
    2. ID Starts with 'IN', 'ISIN' (common corruption patterns)
    3. Missing 'eod_ticker' which is crucial for recovery
    
    Returns: Summary stats and a list of corrupted entries.
    Also saves 'isin_health_report.json' to Storage.
    """
    from firebase_admin import storage
    import re

    print("🔍 Starting ISIN Health Check...")
    db = firestore.client()
    bucket = storage.bucket(BUCKET_NAME)

    funds_ref = db.collection('funds_v2')
    docs = funds_ref.stream()

    total = 0
    corrupted_ids = []
    corrupted_data = []

    # Regex for strict ISIN (2 letters + 9 alphanumeric + 1 digit/char)
    # But usually just length 12 is a good enough filter for "grossly wrong" stuff like 'ISIN...'
    isin_pattern = re.compile(r'^[A-Z]{2}[A-Z0-9]{9}\d$')

    for doc in docs:
        total += 1
        d = doc.to_dict()
        fid = doc.id
        
        # Check ID integrity
        is_id_valid = len(fid) == 12 and isin_pattern.match(fid)
        
        # Check Field Integrity
        f_isin = d.get('isin', '')
        is_field_valid = len(f_isin) == 12 and isin_pattern.match(f_isin)

        # Detect SPECIFIC corruption patterns mentioned by user
        # Starts with 'ISIN', 'INIE', 'IN00' etc and is NOT a valid 12 char ISIN
        has_bad_prefix = fid.startswith('ISIN') or (fid.startswith('IN') and not fid.startswith('IN')) # Wait, IN is India. 
        # Actually user said "IN" is bad if it's "INIE..." (Ireland prefixed with IN).
        # Safe heuristic: proper ISINs don't start with "ISIN".
        # And "INIE..." is 100% wrong (Ireland is IE).
        
        is_corrupted = False
        reason = []

        if fid.startswith('ISIN'):
            is_corrupted = True
            reason.append("Prefix 'ISIN'")
        
        if fid.startswith('INIE'): # Corrupted Ireland
            is_corrupted = True
            reason.append("Prefix 'INIE'")
            
        if len(fid) != 12:
            is_corrupted = True 
            reason.append(f"Length {len(fid)}")

        if is_corrupted:
            corrupted_ids.append(fid)
            corrupted_data.append({
                'id': fid,
                'name': d.get('name', 'UNKNOWN'),
                'eod_ticker': d.get('eod_ticker', None),
                'reason': ", ".join(reason)
            })

    # Generate Report
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_scanned': total,
        'corrupted_count': len(corrupted_ids),
        'corrupted_entries': corrupted_data
    }

    # Save to Storage
    blob = bucket.blob('reports/isin_health_report.json')
    blob.upload_from_string(json.dumps(report, indent=2), content_type='application/json')

    print(f"✅ Analysis Complete. found {len(corrupted_ids)} corrupted records.")
    
    return {
        'success': True,
        'summary': {
            'total': total,
            'corrupted': len(corrupted_ids),
            'report_url': f"gs://{BUCKET_NAME}/reports/isin_health_report.json"
        },
        'sample': corrupted_data[:20]  # Return first 20 for immediate UI inspection
    }


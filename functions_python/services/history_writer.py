import logging
from firebase_admin import firestore
from datetime import datetime

def write_history_canonical(db: firestore.Client, isin: str, history_list: list, source="EODHD", source_format="canonical", batch=None):
    """
    Writes historical data to 'historico_vl_v2' using the strict canonical schema (v3).
    
    Args:
        db: Firestore client
        isin: Fund ISIN (Document ID)
        history_list: List of dicts, must contain 'date' (YYYY-MM-DD string) and 'nav' (float).
        source: Origin of data.
        source_format: Original format description.
        batch: Optional Firestore batch object.
    """
    if not isin:
        raise ValueError("Invalid ISIN")
    
    if not history_list or not isinstance(history_list, list):
         raise ValueError(f"Invalid history_list for {isin}: Must be a non-empty list.")

    clean_history = []
    
    for item in history_list:
        if not isinstance(item, dict): continue
        
        date_str = item.get('date')
        nav_val = item.get('nav')
        
        # Validation: Date
        if not date_str or not isinstance(date_str, str) or len(date_str) != 10:
             continue # Skip invalid dates
             
        # Validation: NAV (Must be float)
        try:
            nav_float = float(nav_val)
        except (ValueError, TypeError):
            continue # Skip invalid NAVs
            
        clean_history.append({
            'date': date_str,
            'nav': nav_float
        })
        
    if not clean_history:
        raise ValueError(f"No valid history items found for {isin} after validation (input size: {len(history_list)}).")
        
    # Sort by date ascending
    clean_history.sort(key=lambda x: x['date'])
    
    # Metadata calculation
    min_date = clean_history[0]['date']
    max_date = clean_history[-1]['date']
    count = len(clean_history)
    
    # Write to Firestore (SET to overwrite legacy fields completely if possible, 
    # OR update? User said "schema_version=3" and "PROHIBIDO series".
    # Using SET with merge=False is safer to wipe legacy 'series' fields, 
    # BUT we might lose other custom fields if any. 
    # 'historico_vl_v2' usually only holds data. Safe to overwrite.
    
    doc_data = {
        'history': clean_history,
        'schema_version': 3,
        'source': source,
        'source_format': source_format,
        'updated_at': firestore.SERVER_TIMESTAMP,
        'metadata': {
            'count': count,
            'min_date': min_date,
            'max_date': max_date
        }
    }
    
    doc_ref = db.collection('historico_vl_v2').document(isin)
    
    if batch:
        batch.set(doc_ref, doc_data)
        # print(f"📝 Added to Batch: {isin}")
    else:
        doc_ref.set(doc_data)
        print(f"✅ Canonical Write Success: {isin} ({count} points, v3)")
    
    return count

import logging
from google.cloud import firestore

def verify_history_format_logic(db: firestore.Client):
    """
    Verifies the format of historical data in 'historico_vl_v2'.
    Checks if dates are 'YYYY-MM-DD' and values are numbers.
    """
    results = {
        'total_checked': 0,
        'valid_docs': 0,
        'invalid_docs': 0,
        'errors': [],
        'sample_data': []
    }

    try:
        # Check standard collection
        collection_name = 'historico_vl_v2'
        docs = db.collection(collection_name).limit(50).stream()
        
        for doc in docs:
            data = doc.to_dict()
            results['total_checked'] += 1
            isin = doc.id
            
            # Assuming structure is { 'history': [{ 'date': '...', 'nav': ... }] } or { 'dates': [], 'navs': [] }
            # Or map { 'YYYY-MM-DD': value }
            # Let's inspect raw structure first
            
            # We will try to guess the format validation based on what we see, 
            # but usually it's expected to be a map or list of objects.
            
            # Common patterns in this project might be:
            # 1. data['history'] = [{'date': '2023-01-01', 'value': 100.0}, ...]
            # 2. data['valores'] = { '2023-01-01': 100.0 }
            
            # We'll validte generic simple patterns
            history = data.get('history') or data.get('valores') or data.get('data')
            
            if not history:
                # Some might store valid under 'nav'
                if not data: 
                    results['errors'].append(f"{isin}: Document empty")
                    results['invalid_docs'] += 1
                    continue
                # If structure is unknown, capture keys
                # formatted_keys = list(data.keys())[:5]
                # results['errors'].append(f"{isin}: Unknown history structure. Keys: {formatted_keys}")
                # results['invalid_docs'] += 1
                # continue
                
                # Assume the whole dict is date->value if checked fields missing?
                # No, let's treat the doc itself as the container if applicable, but usually it's a field.
                # Let's fallback to checking if the doc content itself looks like date-value pairs if 'history' is missing
                # But 'historico_vl_v2' usually implies structured.
                pass

            # If it's a list
            if isinstance(history, list):
                valid_items = 0
                for item in history:
                    if not isinstance(item, dict):
                        results['errors'].append(f"{isin}: Item not dict ({type(item)})")
                        break
                    
                    # expected date field
                    date_val = item.get('date') or item.get('fecha')
                    val_val = item.get('nav') or item.get('close') or item.get('value') or item.get('valor')
                    
                    if not date_val or val_val is None:
                        results['errors'].append(f"{isin}: Missing date/value in item {item}")
                        break
                        
                    # Validate Date Format YYYY-MM-DD
                    if not isinstance(date_val, str) or len(date_val) != 10 or date_val[4]!='-' or date_val[7]!='-':
                        results['errors'].append(f"{isin}: Invalid date format '{date_val}'")
                        break
                        
                    # Validate Value Number
                    if not isinstance(val_val, (int, float)):
                        results['errors'].append(f"{isin}: Invalid value type '{type(val_val)}' for '{val_val}'")
                        break
                        
                    valid_items += 1
                
                if valid_items == len(history):
                     results['valid_docs'] += 1
                else:
                     results['invalid_docs'] += 1

            # If it's a dict (Map)
            elif isinstance(history, dict):
                valid_keys = 0
                for d_key, d_val in history.items():
                    # Key should be date
                    if not isinstance(d_key, str) or len(d_key) != 10 or d_key[4]!='-' or d_key[7]!='-':
                         results['errors'].append(f"{isin}: Invalid date key '{d_key}'")
                         break
                    
                    # Val should be number
                    if not isinstance(d_val, (int, float)):
                         results['errors'].append(f"{isin}: Invalid value '{d_val}'")
                         break
                    valid_keys += 1
                
                if valid_keys == len(history):
                     results['valid_docs'] += 1
                else:
                     results['invalid_docs'] += 1
            
            else:
                 # Capture sample of unknown structure
                 results['errors'].append(f"{isin}: Unexpected history type {type(history)}")
                 results['sample_data'].append({isin: str(data)[:200]})
                 results['invalid_docs'] += 1

    except Exception as e:
        results['errors'].append(f"Global Error: {str(e)}")

    return results

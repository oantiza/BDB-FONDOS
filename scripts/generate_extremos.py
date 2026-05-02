import firebase_admin
from firebase_admin import credentials, firestore
import csv
from datetime import datetime
import argparse

def main():
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        try:
            firebase_admin.initialize_app(cred, {'projectId': 'bdb-fondos'})
        except:
            firebase_admin.initialize_app()
            
    db = firestore.client()
    
    print("🚀 Generating extremos_final.csv from historico_vl_v2...")
    
    # OUTPUT FILE
    FILENAME = "extremos_final.csv"
    
    # 1. List all funds or historico?
    # Better to iterate funds_v2 and check if they have historico, OR iterate historico_vl_v2 directly.
    # Iterating historico_vl_v2 is more direct.
    
    docs = db.collection('historico_vl_v2').stream()
    
    count = 0
    with open(FILENAME, 'w', newline='', encoding='utf-8') as f:
        # Delim ; as requested
        writer = csv.DictWriter(f, fieldnames=['ISIN', 'FIRST_DATE', 'FIRST_VL', 'LAST_DATE', 'LAST_VL'], delimiter=';')
        writer.writeheader()
        
        for doc in docs:
            isin = doc.id
            data = doc.to_dict()
            series = data.get('series', [])
            
            # Filter valid points
            valid = []
            for p in series:
                d = p.get('date')
                v = p.get('price')
                if d and v is not None:
                    # Normalize date
                    if isinstance(d, str):
                        d = d[:10] # YYYY-MM-DD
                    elif isinstance(d, datetime):
                        d = d.strftime("%Y-%m-%d")
                    valid.append({'date': d, 'val': v})
            
            if not valid:
                continue
                
            # Sort by date
            valid.sort(key=lambda x: x['date'])
            
            first = valid[0]
            last = valid[-1]
            
            writer.writerow({
                'ISIN': isin,
                'FIRST_DATE': first['date'],
                'FIRST_VL': first['val'],
                'LAST_DATE': last['date'],
                'LAST_VL': last['val']
            })
            count += 1
            if count % 100 == 0:
                print(f"Processed {count}...")
                
    print(f"✅ DONE. Generated {FILENAME} with {count} rows.")

if __name__ == '__main__':
    main()

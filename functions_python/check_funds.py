import firebase_admin
from firebase_admin import firestore

# Initializing with default application credentials
firebase_admin.initialize_app()
db = firestore.client()

isins = [
    'LU0232524495', 'LU0524465548', 'LU0171304552', 'LU1321847805', 'LU0766123821', 
    'BE0947853660', 'LU0353647737', 'LU1391767586', 'LU0133267202', 'LU0333810850', 
    'LU3038481936', 'LU0289089384', 'LU0117858752', 'LU1665237704', 'LU0094557526', 
    'LU0348784041', 'LU0243957239', 'LU2222028099', 'IE0031575271', 'IE00BYR8H148', 
    'ES0138936036', 'ES0182105033', 'ES0114633003', 'ES0161992005', 'ES0170865002'
]

print("Checking history lengths for provided portfolio...")
short_history_funds = []
for isin in isins:
    doc = db.collection('historico_vl_v2').document(isin).get()
    if doc.exists:
        data = doc.to_dict()
        history = data.get('history', [])
        series = data.get('series', [])
        total_len = max(len(history), len(series))
        print(f"Fund {isin}: {total_len} days of history")
        if total_len < 252 * 5:
            short_history_funds.append((isin, total_len))
    else:
        print(f"Fund {isin}: NOT FOUND in database")
        short_history_funds.append((isin, 0))

print("\n--- FUNDS WITH LESS THAN 5 YEARS OF HISTORY ---")
for fund, length in sorted(short_history_funds, key=lambda x: x[1]):
    print(f"Fund {fund}: {length} days")

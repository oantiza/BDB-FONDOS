import firebase_admin
from firebase_admin import credentials, firestore
import datetime
import os

if not firebase_admin._apps:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    else:
        _sak = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'serviceAccountKey.json')
        if os.path.exists(_sak):
            firebase_admin.initialize_app(credentials.Certificate(_sak))
        else:
            firebase_admin.initialize_app()
db = firestore.client()

funds = list(db.collection('funds_v3').stream())
print(f'Total funds in DB: {len(funds)}')

history_stats = []
for f in funds:
    history_ref = f.reference.collection('history')
    first_doc = list(history_ref.order_by('date').limit(1).stream())
    last_doc = list(history_ref.order_by('date', direction=firestore.Query.DESCENDING).limit(1).stream())
    
    if first_doc and last_doc:
        start_date = first_doc[0].get('date')
        end_date = last_doc[0].get('date')
        # Check an approximation by docs, but actually we can just check length
        docs = list(history_ref.stream())
        count = len(docs)
        history_stats.append({
            'isin': f.id,
            'start': start_date,
            'end': end_date,
            'count': count
        })
    else:
        history_stats.append({
            'isin': f.id,
            'start': 'NONE',
            'end': 'NONE',
            'count': 0
        })

history_stats.sort(key=lambda x: x['count'])
print('\nTop 15 funds with LEAST history (bottlenecks for common timeframe):')
for s in history_stats[:15]:
    print(f"{s['isin']}: {s['count']} days (From {s['start']} to {s['end']})")

print('\nFunds with EXACTLY 46 days:')
for s in history_stats:
    if s['count'] == 46:
        print(f"{s['isin']}: {s['count']} days (From {s['start']} to {s['end']})")

"""
Rellena data_quality para los fondos que no lo tienen.
Comprueba si tienen std_perf y historico_vl_v2 para determinar los flags.
"""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import os

sa_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
cred = credentials.Certificate(sa_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

print("🔍 Buscando fondos sin data_quality...")
all_docs = list(db.collection('funds_v3').stream())

missing = []
for doc in all_docs:
    data = doc.to_dict()
    dq = data.get('data_quality')
    if not dq or not isinstance(dq, dict):
        missing.append((doc, data))

print(f"  Fondos sin data_quality: {len(missing)}\n")

updated = 0
errors = []

for doc, data in missing:
    isin = doc.id
    try:
        # Check std_perf
        sp = data.get('std_perf')
        has_std_perf = bool(sp and isinstance(sp, dict) and sp.get('volatility'))

        # Check history in historico_vl_v2
        h_doc = db.collection('historico_vl_v2').document(isin).get()
        has_history = False
        history_points = 0
        if h_doc.exists:
            h_data = h_doc.to_dict()
            raw = h_data.get('history') or h_data.get('series') or []
            history_points = len(raw)
            has_history = history_points > 0

        update_data = {
            'data_quality': {
                'history_ok': has_history,
                'std_perf_ok': has_std_perf,
                'history_points': history_points,
                'last_checked_at': datetime.now().isoformat(),
            }
        }

        db.collection('funds_v3').document(isin).update(update_data)
        updated += 1
        
        status = "✅" if has_history and has_std_perf else "⚠️"
        print(f"  {status} {isin}: history_ok={has_history} ({history_points} pts), std_perf_ok={has_std_perf}")

    except Exception as e:
        errors.append((isin, str(e)))
        print(f"  ❌ {isin}: {e}")

print(f"\n{'=' * 60}")
print(f"RESUMEN")
print(f"{'=' * 60}")
print(f"  Total sin data_quality: {len(missing)}")
print(f"  ✅ Actualizados: {updated}")
print(f"  ❌ Errores: {len(errors)}")
if errors:
    for isin, err in errors:
        print(f"    - {isin}: {err}")

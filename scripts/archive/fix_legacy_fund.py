"""
Migra el fondo legacy ES0133593030 al esquema V3.
1. Lee el doc actual
2. Mapea campos legacy a V3
3. Elimina campos legacy
4. Actualiza el doc
"""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import os
import json

sa_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
cred = credentials.Certificate(sa_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

ISIN = 'ES0133593030'

print(f"🔍 Leyendo fondo legacy {ISIN}...")
doc = db.collection('funds_v3').document(ISIN).get()

if not doc.exists:
    print("❌ Documento no encontrado!")
    exit(1)

data = doc.to_dict()
print(f"\n📋 Campos actuales ({len(data)} campos):")
for k, v in sorted(data.items()):
    val_preview = str(v)[:80] if not isinstance(v, dict) else f"{{...}} ({len(v)} keys)"
    print(f"  {k:30s} = {val_preview}")

# Identify legacy fields
legacy_fields = ['nombre', 'descripcion', 'tipo', 'riesgo', 'valor_actual', 'activo', 'tags', 'created_at']
found_legacy = [f for f in legacy_fields if f in data]
print(f"\n⚠️ Campos legacy encontrados: {found_legacy}")

# Map legacy -> V3
updates = {}
deletes = {}

# nombre -> name (if name missing)
if not data.get('name') and data.get('nombre'):
    updates['name'] = data['nombre']
    print(f"  nombre -> name: {data['nombre']}")

# descripcion -> ms.objective (if missing)
if data.get('descripcion'):
    ms = data.get('ms', {})
    if not ms.get('objective'):
        updates['ms.objective'] = data['descripcion']
        print(f"  descripcion -> ms.objective")

# Ensure isin field exists
if not data.get('isin'):
    updates['isin'] = ISIN
    print(f"  Adding isin: {ISIN}")

# Ensure currency
if not data.get('currency'):
    updates['currency'] = 'EUR'
    print(f"  Adding currency: EUR")

# Ensure data_quality
if not data.get('data_quality'):
    # Check history
    h_doc = db.collection('historico_vl_v2').document(ISIN).get()
    has_history = False
    pts = 0
    if h_doc.exists:
        h = h_doc.to_dict().get('history') or h_doc.to_dict().get('series') or []
        pts = len(h)
        has_history = pts > 0
    
    has_std_perf = bool(data.get('std_perf') and isinstance(data.get('std_perf'), dict) and data['std_perf'].get('volatility'))
    
    updates['data_quality'] = {
        'history_ok': has_history,
        'std_perf_ok': has_std_perf,
        'history_points': pts,
        'last_checked_at': datetime.now().isoformat(),
    }
    print(f"  Adding data_quality: history_ok={has_history}, std_perf_ok={has_std_perf}")

# Delete legacy fields
for field in found_legacy:
    deletes[field] = firestore.DELETE_FIELD

print(f"\n📝 Actualizaciones: {len(updates)} campos")
print(f"🗑️ Eliminaciones: {len(deletes)} campos legacy")

# Apply
all_updates = {**updates, **deletes}
if all_updates:
    db.collection('funds_v3').document(ISIN).update(all_updates)
    print(f"\n✅ Fondo {ISIN} migrado correctamente!")
else:
    print(f"\n⚠️ No hay cambios que aplicar.")

# Verify
print(f"\n🔍 Verificando resultado...")
doc2 = db.collection('funds_v3').document(ISIN).get()
data2 = doc2.to_dict()
remaining_legacy = [f for f in legacy_fields if f in data2]
print(f"  Campos legacy restantes: {remaining_legacy if remaining_legacy else 'Ninguno ✅'}")
print(f"  name: {data2.get('name', 'N/A')}")
print(f"  isin: {data2.get('isin', 'N/A')}")
print(f"  currency: {data2.get('currency', 'N/A')}")
print(f"  data_quality: {data2.get('data_quality') is not None}")

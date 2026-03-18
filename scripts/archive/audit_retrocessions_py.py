"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: audit_retrocessions_py.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/audit_retrocessions_py.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os

def audit_retrocessions():
    # Use the service account key from the scripts directory
    sa_path = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
    
    if not os.path.exists(sa_path):
        print(f"❌ Service account key not found at {sa_path}")
        return

    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        print("✅ Firestore connected.")

        # Query funds_v3 collection
        funds_ref = db.collection('funds_v3')
        docs = funds_ref.stream()

        with_retro = []
        without_retro = []

        print("🔍 Auditing funds...")
        for doc in docs:
            d = doc.to_dict()
            isin = doc.id
            name = d.get('name') or d.get('fund_name') or d.get('nombre') or "N/A"
            
            # The field is expected at manual.costs.retrocession
            manual = d.get('manual', {})
            costs = manual.get('costs', {}) if manual else {}
            retro = costs.get('retrocession') if costs else None

            info = {
                'isin': isin,
                'name': name
            }

            if retro is not None:
                with_retro.append(info)
            else:
                without_retro.append(info)

        print("\n" + "="*60)
        print("📊 RESULTADOS DE LA AUDITORÍA DE RETROCESIONES")
        print("="*60)
        print(f"Total fondos analizados:  {len(with_retro) + len(without_retro)}")
        print(f"CON campo retrocesión:    {len(with_retro)}")
        print(f"SIN campo retrocesión:    {len(without_retro)}")
        print("-" * 60)

        if without_retro:
            print("\n🚨 FONDOS QUE NO TIENEN EL CAMPO RETROCESIÓN:")
            for i, f in enumerate(without_retro):
                print(f"   {f['isin'].padEnd(15) if hasattr(str, 'padEnd') else f['isin']:15} | {f['name']}")
                if i >= 49: # Limit to 50 for brevity in console
                    print(f"   ... y {len(without_retro) - 50} más.")
                    break
        else:
            print("\n✅ ¡Todos los fondos tienen el campo retrocesión!")
        
        print("="*60)

    except Exception as e:
        print(f"❌ Error during audit: {e}")

if __name__ == "__main__":
    audit_retrocessions()

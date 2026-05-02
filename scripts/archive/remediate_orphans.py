"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: remediate_orphans.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/remediate_orphans.py
"""

import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore

# Mute warnings
import warnings
warnings.filterwarnings('ignore')

cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
cred = credentials.Certificate(cred_path)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

ORPHAN_FUNDS = [
    'ES0142046038', 'ES0162296000', 'ES0167238023', 'FI0008804463', 'FR001400NTN5', 
    'IE00B28YJQ65', 'IE00BKSBDB61', 'LU0447425785', 'LU0842066523', 'LU0986194024',
    'LU1060965380', 'LU1175841604', 'LU1196204168', 'LU1295551144', 'LU1691238914',
    'LU1789233157', 'LU2070308064', 'LU2249056297', 'LU2334861803', 'LU2347653760',
    'LU2490423081', 'LU2552391642', 'LU2591605634', 'LU2591605717', 'LU2629683694'
]

def remediate_orphans(delete_mode=False):
    print(">> Starting Remediation of 25 Orphan Funds...")
    batch = db.batch()
    count = 0
    
    for isin in ORPHAN_FUNDS:
        doc_ref = db.collection('funds_v3').document(isin)
        doc = doc_ref.get()
        
        if doc.exists:
            print(f"Orphan Found: {isin} ({doc.to_dict().get('name', 'Unknown')})")
            if delete_mode:
                batch.delete(doc_ref)
                count += 1
                print(f"   -> Enqueued for DELETION.")
            else:
                # Disable it so it stops showing up in the frontend searches and comparisons
                batch.update(doc_ref, {'disabled': True, 'data_quality': {'has_history': False}})
                count += 1
                print(f"   -> Enqueued for DISABLEMENT.")
                
        if count >= 400:
            batch.commit()
            batch = db.batch()
            count = 0
            
    if count > 0:
        batch.commit()
        
    action = "DELETED" if delete_mode else "DISABLED"
    print(f">> Successfully {action} {count} orphan funds from funds_v3.")

if __name__ == '__main__':
    # By default we just disable them. User can pass --delete to actually remove.
    delete_mode = '--delete' in sys.argv
    remediate_orphans(delete_mode)

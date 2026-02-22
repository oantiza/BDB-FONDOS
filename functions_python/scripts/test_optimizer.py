import os
import sys
import json
from firebase_admin import credentials, firestore, initialize_app

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
KEY_PATH = os.path.join(PROJECT_ROOT, 'serviceAccountKey.json')

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = KEY_PATH

import firebase_admin
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(KEY_PATH)
        initialize_app(cred)
except:
    pass

from services.optimizer import run_optimization
db = firestore.client()

def test():
    print("Testing run_optimization with EXACT rebalance constraints (disable_profile_rules + max_sharpe)...")
    # These 10 ISINs are real funds from the frontend payload that triggers 500 error
    assets = ["LU0293313671", "LU0117858752", "ES0182105033", "ES0161992005",
              "ES0142167032", "ES0138936036", "LU0835722488", "LU1066281574",
              "LU2601038578", "IE00BF0GL212"]
    
    # Mirrors exactly what main.py does when ignore_constraints=True
    constraints = {
        'disable_profile_rules': True,
        'objective': 'max_sharpe',
        'min_weight': 0.03,
        'max_weight': 0.25,
    }
    
    try:
        res = run_optimization(assets, 9, db, constraints, {}, [])
        print(f"✅ Success! solver_path={res.get('solver_path')}, status={res.get('status')}")
        print(f"   Weights sum: {sum(res.get('weights', {}).values()):.4f}")
        print(f"   Warnings: {res.get('warnings', [])}")
        # Test JSON serialization
        json_str = json.dumps(res)
        print(f"   JSON serializable: YES (len={len(json_str)})")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Crashed: {e}")

if __name__ == '__main__':
    test()

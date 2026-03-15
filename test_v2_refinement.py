
import sys
import os

# Mock the database client to avoid real Firebase init
sys.modules['firebase_admin'] = type('Mock', (), {'_apps': []})
sys.modules['firebase_admin.credentials'] = type('Mock', (), {'Certificate': lambda x: None})
sys.modules['firebase_admin.firestore'] = type('Mock', (), {'client': lambda: None})

from functions_python.scripts.migration.populate_taxonomy_v2 import classifyFundV2
from functions_python.models.canonical_types import FICreditBucketV2, AssetSubtypeV2, RiskBucketV2

def test_v2_refinement():
    test_cases = [
        {"id": "DPAM", "name": "DPAM B - Bonds Eur Government B Cap", "ms_cat": "Fixed Income"},
        {"id": "HORIZON", "name": "Cartera Renta Fija Horizonte 2026/2027/2028 FI", "ms_cat": "Fixed Income"},
        {"id": "UBS_0-5", "name": "UBS Renta Fija 0-5 B FI", "ms_cat": "Fixed Income"},
        {"id": "UBS_0-2", "name": "UBS Duración 0-2 B FI", "ms_cat": "Fixed Income"},
        {"id": "TREA", "name": "Trea Renta Fija Ahorro S FI", "ms_cat": "Fixed Income"},
        {"id": "SIH_AHORRO", "name": "SIH Ahorro A FI", "ms_cat": "Fixed Income"},
        {"id": "SIH_RF", "name": "SIH Renta Fija A FI", "ms_cat": "Fixed Income"},
        {"id": "MERCHRENTA", "name": "Merchrenta FI", "ms_cat": "Fixed Income"},
        {"id": "R4_RF", "name": "Renta 4 Renta Fija R FI", "ms_cat": "Fixed Income"}
    ]

    print(f"{'Fondo':<45} | {'Subtype':<25} | {'Credit':<15} | {'Risk':<10} | {'Suitable':<8} | {'Conf':<5}")
    print("-" * 125)

    for tc in test_cases:
        data = {
            "name": tc["name"],
            "ms": {
                "category_morningstar": tc.get("ms_cat", "")
            },
            "metrics": {"bond": 95} # Assume bond exposure for all as they are FI funds
        }
        klass = classifyFundV2("ISIN", data)
        
        suitable = "YES" if klass.is_suitable_low_risk else "NO"
        conf = f"{klass.classification_confidence:.2f}"
        
        print(f"{tc['name'][:45]:<45} | {klass.asset_subtype.value:<25} | {klass.fi_credit_bucket.value:<15} | {klass.risk_bucket.value:<10} | {suitable:<8} | {conf}")

if __name__ == "__main__":
    test_v2_refinement()

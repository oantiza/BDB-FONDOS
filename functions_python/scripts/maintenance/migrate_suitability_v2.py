# =============================================================================
# !! DO NOT RUN DIRECTLY — HISTORICAL MIGRATION SCRIPT !!
# =============================================================================
# STATUS:       HISTORICAL — NOT SAFE TO EXECUTE WITHOUT EXPLICIT GATE
# RISK LEVEL:   HIGH — Writes to Firestore production collection (funds_v3)
#
# REASON FOR GUARD:
#   This script populates `classification_v2.compatible_profiles` by running
#   is_fund_eligible_for_profile() against ALL funds in funds_v3.
#
#   CRITICAL: After the MIXED exposure remediation (commit 2db5a24, May 2026),
#   portfolio_exposure_v2.economic_exposure was corrected for 59/60 MIXED funds.
#   Any `compatible_profiles` values written BEFORE that remediation are STALE
#   because they were computed from incorrect real_eq values (fallback 50/50).
#
# BEFORE RUNNING:
#   1. Perform a DRY-RUN that logs proposed changes WITHOUT writing.
#   2. Generate a DIFF MANIFEST and review all profile changes.
#   3. Obtain explicit approval from the responsible engineer.
#   4. Run on a SUBSET first and verify in production.
#   5. POST-VERIFICATION: confirm frontend suitability matches backend engine.
#
# DEPENDENCY:
#   - `portfolio_exposure_v2.economic_exposure` must be current and correct.
#   - Hamco (LU3038481936) has no exposure data — skip or handle explicitly.
#   - `suitability_version` field written is informational only (not read by any runtime code).
#
# REFERENCE:
#   docs/BDB_SUITABILITY_HARDCODED_CONTRACT_AUDIT_0.md
#   docs/BDB_SUITABILITY_CONTRACT_TESTS_0.md
# =============================================================================

import os
import sys

# Ensure functions_python is in the path
current_dir = os.path.dirname(os.path.abspath(__file__))
functions_python_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(functions_python_dir)

import firebase_admin
from firebase_admin import credentials, firestore
from services.portfolio.suitability_engine import compute_compatible_profiles

def migrate_suitability_v2():
    print("Starting Suitability Migration...")
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
        
    db = firestore.client()
    funds_ref = db.collection("funds_v3")
    docs = funds_ref.stream()
    
    batch = db.batch()
    count = 0
    updated = 0
    
    for doc in docs:
        fund_data = doc.to_dict()
        classification_v2 = fund_data.get("classification_v2")
        
        if not classification_v2:
            continue
            
        # REM-1: fuente única — el mismo helper que validan los tests de paridad (golden)
        # y el monitor de deriva. Evita que la generación divergir de la regla canónica.
        compatible_profiles = compute_compatible_profiles(fund_data)

        doc_ref = funds_ref.document(doc.id)
        batch.update(doc_ref, {
            "classification_v2.compatible_profiles": compatible_profiles,
            "classification_v2.suitability_version": "v1"
        })
        
        count += 1
        updated += 1
        
        if count % 100 == 0:
            batch.commit()
            print(f"Committed {count} funds...")
            batch = db.batch()
            
    if count % 100 != 0:
        batch.commit()
        
    print(f"Migration completed. Total funds updated: {updated}")

if __name__ == "__main__":
    migrate_suitability_v2()

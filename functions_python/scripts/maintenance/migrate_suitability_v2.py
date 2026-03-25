import os
import sys

# Ensure functions_python is in the path
current_dir = os.path.dirname(os.path.abspath(__file__))
functions_python_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(functions_python_dir)

import firebase_admin
from firebase_admin import credentials, firestore
from services.portfolio.suitability_engine import is_fund_eligible_for_profile

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
            
        compatible_profiles = []
        for profile in range(1, 11):
            is_eligible, _ = is_fund_eligible_for_profile(fund_data, profile)
            if is_eligible:
                compatible_profiles.append(profile)
                
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

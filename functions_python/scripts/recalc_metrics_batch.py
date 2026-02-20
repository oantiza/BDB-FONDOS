
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os
import sys
import pandas as pd
import numpy as np
from datetime import datetime

# Add parent directory to path to allow importing services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Reuse logic from recalc_metrics_single, but batched
from recalc_metrics_single import recalculate_single

def run_batch_recalc():
    # 1. Load targets
    targets = []
    
    # A. From Audit (Metric Mismatch)
    if os.path.exists('audit_results.csv'):
        audit = pd.read_csv('audit_results.csv')
        mismatches = audit[audit['issue'].str.contains('METRIC_MISMATCH', na=False)]
        targets.extend(mismatches['isin'].tolist())
        print(f"Added {len(mismatches)} targets from Audit Mismatches.")
    
    # B. From Fixes (Anomalies)
    if os.path.exists('fixed_anomalies.csv'):
        fixes = pd.read_csv('fixed_anomalies.csv')
        targets.extend(fixes['isin'].tolist())
        print(f"Added {len(fixes)} targets from Anomaly Fixes.")
        
    targets = list(set(targets)) # Unique
    
    if not targets:
        print("No targets found to recalculate.")
        return

    print(f"Starting Batch Recalculation for {len(targets)} funds...")
    print("-" * 30)
    
    for isin in targets:
        try:
            recalculate_single(isin)
        except Exception as e:
            print(f"❌ Error processing {isin}: {e}")
            
    print("-" * 30)
    print("Batch Recalculation Complete.")

if __name__ == "__main__":
    run_batch_recalc()

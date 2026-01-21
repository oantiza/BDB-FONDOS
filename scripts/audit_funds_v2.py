import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import warnings
import os

# Suppress warnings
warnings.filterwarnings('ignore')

# Initialize Firebase (Try-catch for local handling)
try:
    if not firebase_admin._apps:
        # Attempt to use Application Default Credentials
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': 'bdb-fondos',
        })
    db = firestore.client()
    print("✅ Firestore connected.")
except Exception as e:
    print(f"❌ Failed to initialize Firestore: {e}")
    print("Hint: Run `gcloud auth application-default login` if running locally.")
    exit(1)

def _to_float(x):
    if x is None: return 0.0
    if isinstance(x, (int, float)): return float(x)
    if isinstance(x, str):
        c = x.strip().replace('%','').replace(',','.')
        try:
            return float(c)
        except:
            return 0.0
    return 0.0

def detect_hedging(name, class_name):
    # Keywords for hedging detection
    keywords = ['hedged', 'hgd', 'cubierto', 'currency hedged', 'eur hedged']
    text = f"{str(name or '')} {str(class_name or '')}".lower()
    return any(k in text for k in keywords)

def audit_funds():
    print("🚀 Starting Audit of funds_v2...")
    
    # 1. Fetch all funds
    funds_ref = db.collection('funds_v2')
    docs = list(funds_ref.stream())
    print(f"Found {len(docs)} funds in funds_v2.")

    data = []

    # 2. Iterate and check
    for i, d in enumerate(docs):
        dd = d.to_dict()
        isin = d.id
        name = dd.get('name', 'Unknown')
        class_name = dd.get('class', '')
        currency = dd.get('currency', '')
        
        # Metrics
        metrics = dd.get('metrics', {})
        eq = _to_float(metrics.get('equity'))
        bd = _to_float(metrics.get('bond'))
        cs = _to_float(metrics.get('cash'))
        ot = _to_float(metrics.get('other'))
        
        metrics_sum = eq + bd + cs + ot
        has_metrics = metrics_sum > 0.01  # non-zero
        
        # Hedging
        is_hedged = detect_hedging(name, class_name)
        
        # History Check (Optimized: Can we batch check? 
        # For 500 funds, batching might be hard without `in`. 
        # We will do individual lookups for now or assume efficient connection)
        # To avoid being too slow, maybe we can't check ALL history docs efficiently 
        # if there are thousands. But listing collections ID? 
        # Let's try to check existence of 'historico_vl_v2/{isin}'
        
        # NOTE: Doing a db.get() for every fund might be slow (N reads).
        # Optimization: We only care about potential candidates for auto-expand first?
        # User asked for FULL audit report.
        # We will do a simple `db.collection('historico_vl_v2').document(isin).get().exists`
        # but warn if it takes too long.
        
        has_history = False
        try:
            # Only check history for active funds or promising ones? 
            # User wants audit. Let's do it.
            hist_ref = db.collection('historico_vl_v2').document(isin)
            # Use get(field_paths=[]) to minimize data transfer if just checking existence?
            # Firestore doesn't support lightweight exists without read.
            # We'll read.
            hist_snap = hist_ref.get()
            has_history = hist_snap.exists
        except Exception:
            has_history = False

        # Equity 90 Candidate Logic
        # Must be Equity >= 90 (normalized logic will handle 95+ later, but here raw)
        # Must have history
        # Must NOT be hedged
        equity90_candidate = (eq >= 90.0) and has_history and (not is_hedged)

        row = {
            'isin': isin,
            'name': name,
            'currency': currency,
            'is_hedged': is_hedged,
            'has_metrics': has_metrics,
            'metrics_sum': round(metrics_sum, 2),
            'equity': round(eq, 2),
            'bond': round(bd, 2),
            'cash': round(cs, 2),
            'other': round(ot, 2),
            'has_history': has_history,
            'equity90_candidate': equity90_candidate
        }
        data.append(row)
        
        if i % 20 == 0:
            print(f"Processed {i}/{len(docs)}...")

    # 3. Create DataFrame and Save
    df = pd.DataFrame(data)
    
    # Analyze
    print("\n--- Audit Summary ---")
    print(f"Total Funds: {len(df)}")
    print(f"With History: {df['has_history'].sum()}")
    print(f"Metrics Invalid (Sum=0 or >105): {len(df[(df['metrics_sum'] < 1) | (df['metrics_sum'] > 105)])}")
    print(f"Hedged Funds Detected: {df['is_hedged'].sum()}")
    print(f"Equity90 Candidates (Strict): {df['equity90_candidate'].sum()}")
    
    csv_path = 'funds_v2_data_quality_report.csv.txt' # using .txt suffix just to ensure readable easily if needed, but standard csv is fine
    df.to_csv('funds_v2_data_quality_report.csv', index=False)
    print(f"📝 Report saved to metrics_audit_report.csv")

if __name__ == '__main__':
    audit_funds()

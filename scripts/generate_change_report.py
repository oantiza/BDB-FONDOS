import pandas as pd
import numpy as np

def get_canonical_asset_class(eq, bd, cs):
    if eq >= 70: return 'RV'
    if bd >= 70: return 'RF'
    if cs >= 70: return 'Monetario'
    if eq >= 20 and bd >= 20: return 'Mixto'
    return 'Otros'

def analyze():
    print("🚀 Generating Change Report (Simulation)...")
    try:
        df = pd.read_csv('funds_v2_data_quality_report.csv')
    except Exception as e:
        print(f"❌ Error reading input CSV: {e}")
        return

    changes = []
    
    for _, row in df.iterrows():
        metrics_sum = row.get('metrics_sum', 0)
        
        # Logic matches fix_service.py
        is_valid = 95.0 <= metrics_sum <= 105.0
        
        # Parse inputs
        eq = row.get('equity', 0)
        bd = row.get('bond', 0)
        cs = row.get('cash', 0)
        ot = row.get('other', 0)
        
        n_eq, n_bd, n_cs, n_ot = eq, bd, cs, ot
        action = "None"
        
        if is_valid and metrics_sum != 0:
            if abs(metrics_sum - 100.0) > 0.01:
                # Normalize
                factor = 100.0 / metrics_sum
                n_eq *= factor
                n_bd *= factor
                n_cs *= factor
                n_ot *= factor
                action = "Normalized"
            
            # Asset Class
            ac = get_canonical_asset_class(n_eq, n_bd, n_cs)
            
            changes.append({
                'isin': row['isin'],
                'name': row.get('name', ''),
                'old_sum': metrics_sum,
                'action': action,
                'new_equity': round(n_eq, 2),
                'new_bond': round(n_bd, 2),
                'new_asset_class': ac,
                'valid': True
            })
        else:
            changes.append({
                'isin': row['isin'],
                'name': row.get('name', ''),
                'old_sum': metrics_sum,
                'action': "Flagged Invalid",
                'new_equity': eq,
                'new_bond': bd,
                'new_asset_class': 'Unknown',
                'valid': False
            })

    out_df = pd.DataFrame(changes)
    out_df.to_csv('funds_v2_changes_applied.csv', index=False)
    print(f"✅ Generated 'funds_v2_changes_applied.csv' with {len(out_df)} rows.")

    # High quality candidates
    candidates = out_df[ (out_df['new_equity'] >= 90) & (out_df['valid'] == True) ]
    # Filter by Audit columns if available? 
    # The audit CSV had 'equity90_candidate' which included history/hedged checks.
    # We should merge or trust audit.
    # The fix script re-checks history. Here we trust Audit 'equity90_candidate' flag?
    # Actually, audit 'equity90_candidate' used raw equity.
    # We should use 'new_equity' >= 90 AND audit['has_history'] AND !audit['is_hedged'].
    
    # Merge back original cols
    merged = out_df.merge(df[['isin', 'has_history', 'is_hedged']], on='isin')
    
    final_candidates = merged[
        (merged['new_equity'] >= 90) & 
        (merged['has_history'] == True) & 
        (merged['is_hedged'] == False)
    ]
    
    print(f"🎯 Verified Candidates: {len(final_candidates)}")
    final_candidates[['isin', 'name', 'new_equity']].head(50).to_csv('funds_v2_candidates_list.csv', index=False)

if __name__ == '__main__':
    analyze()

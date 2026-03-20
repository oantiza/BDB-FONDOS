import pandas as pd
import json

def generate_unclassified_report():
    input_csv = 'C:/Users/oanti/Documents/BDB-FONDOS/fondos_categorias_subcategorias.csv'
    output_csv = 'C:/Users/oanti/Documents/BDB-FONDOS/fondos_no_clasificados_v2.csv'
    
    try:
        df = pd.read_csv(input_csv)
    except FileNotFoundError:
        print(f"Error: {input_csv} not found.")
        return

    # Relevant columns to check for "UNKNOWN" or "OTROS" / "OTHER"
    # We focus on the most important high-level classifications
    critical_cols = [
        'class_v2_asset_type',
        'class_v2_asset_subtype',
        'class_v2_region_primary',
        'class_v2_risk_bucket',
        'class_v2_strategy_type'
    ]

    # Filter rows where ANY critical column contains UNKNOWN, OTHER, or is empty
    def is_unclassified(row):
        for col in critical_cols:
            if col in row and pd.notna(row[col]):
                val = str(row[col]).upper()
                if 'UNKNOWN' in val or 'OTHER' in val or 'OTRO' in val or 'MISSING' in val:
                    return True
            else:
                return True # Missing value
        return False

    unclassified_mask = df.apply(is_unclassified, axis=1)
    df_unclassified = df[unclassified_mask].copy()

    total_funds = len(df)
    unclassified_count = len(df_unclassified)
    
    print(f"Total funds: {total_funds}")
    print(f"Funds with at least one critical UNKNOWN/OTHER: {unclassified_count} ({unclassified_count/total_funds*100:.1f}%)")
    
    # Save to CSV
    df_unclassified.to_csv(output_csv, index=False, encoding='utf-8')
    print(f"\nExported unclassified funds to: {output_csv}")

    # Generate a breakdown
    print("\n--- Breakdown of UNKNOWNs by Category ---")
    for col in critical_cols:
        if col in df.columns:
            series = df[col].fillna('MISSING').astype(str).str.upper()
            unknowns = series[series.str.contains('UNKNOWN') | series.str.contains('OTHER') | series.str.contains('OTRO') | (series == 'MISSING')].shape[0]
            print(f"{col}: {unknowns} funds ({unknowns/total_funds*100:.1f}%)")

if __name__ == "__main__":
    generate_unclassified_report()

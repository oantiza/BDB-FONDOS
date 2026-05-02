import pandas as pd

def analyze():
    df = pd.read_csv('C:/Users/oanti/Documents/BDB-FONDOS/fondos_categorias_subcategorias.csv')
    total = len(df)
    print(f"Total Funds Evaluated: {total}")
    print("-" * 50)
    
    for col in df.columns:
        if 'class_v2_' in col and not 'confidence' in col and not 'geographic' in col:
            # fillna with string 'MISSING' so we can do string comparisons safely
            series = df[col].fillna('MISSING').astype(str).str.upper()
            unknown_count = series[series.str.contains('UNKNOWN') | (series == 'MISSING') | (series == '') | (series == 'NONE')].shape[0]
            if unknown_count > 0:
                pct = (unknown_count / total) * 100
                print(f"{col.replace('class_v2_', '')}: {unknown_count} UNKNOWN/Missing ({pct:.1f}%)")
                
if __name__ == "__main__":
    analyze()

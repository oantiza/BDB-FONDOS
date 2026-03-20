import pandas as pd
import os

# Ajusta la ruta a donde tengas tu CSV maestro
CSV_PATH = "fondos_categorias_subcategorias.csv"
def audit_categories():
    if not os.path.exists(CSV_PATH):
        print(f"Error: No se encuentra el archivo en {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH)

    print("\n" + "="*50)
    print(" DISTRIBUCIÓN MACRO (class_v2_asset_type)")
    print("="*50)
    print(df['class_v2_asset_type'].value_counts(dropna=False))

    print("\n" + "="*50)
    print(" DISTRIBUCIÓN MICRO (class_v2_asset_subtype)")
    print("="*50)
    print(df['class_v2_asset_subtype'].value_counts(dropna=False))

    # Fondos conflictivos o sin clasificar
    unknowns = df[(df['class_v2_asset_type'] == 'UNKNOWN') | (df['class_v2_asset_type'].isna())]
    print("\n" + "="*50)
    print(f" ALERTA: {len(unknowns)} fondos sin Asset Type definido (UNKNOWN o NaN)")
    print("="*50)
    if not unknowns.empty:
        print(unknowns[['isin', 'name', 'category_legacy']].head())

if __name__ == "__main__":
    audit_categories()
import pandas as pd
import os

def audit_unknowns_v2(input_csv):
    if not os.path.exists(input_csv):
        print(f"❌ Archivo no encontrado: {input_csv}")
        return

    df = pd.read_csv(input_csv)
    
    # Categorías que SÍ consideramos correctas y clasificadas
    CAT_OK = [
        "RV Europa", "RV EE.UU.", "RV Emergente", "RV Global", "RV Japón", "RV Sectorial Tecnología",
        "RF Global", "RF Soberana", "RF Corporativa", "RF Emergente", "RF Alto Rendimiento",
        "Mixto Conservador", "Mixto Flexible", "Mixto Dinámico", "Monetario EUR"
    ]

    # El campo que queremos auditar
    cat_col = 'categoria_inferida' if 'categoria_inferida' in df.columns else 'derived_category'
    name_col = 'name' if 'name' in df.columns else 'classification_v2_raw_name'
    ms_cat_col = 'ms_category_morningstar'

    # Filtramos todo lo que NO esté en nuestra lista de "Categorías OK"
    # Esto atrapará: NaNs, "Otras", "Unknown", y cualquier cosa que Morningstar mande y no hayamos mapeado
    df_unknowns = df[~df[cat_col].isin(CAT_OK)].copy()

    print(f"🚨 Detectados {len(df_unknowns)} fondos fuera de las categorías oficiales.")
    print("-" * 60)

    if not df_unknowns.empty:
        print("\n📈 Top Categorías 'Problemáticas' de Morningstar:")
        print(df_unknowns[ms_cat_col].value_counts().head(15))
        
        print("-" * 60)
        print(f"{'ISIN':<15} | {'NOMBRE':<35} | {'CATEGORÍA ACTUAL'}")
        print("-" * 60)
        
        for _, row in df_unknowns.head(20).iterrows():
            isin = str(row.get('isin', 'N/A'))
            name = str(row.get(name_col, 'N/A'))[:35]
            curr_cat = str(row.get(cat_col, 'N/A'))
            print(f"{isin:<15} | {name:<35} | {curr_cat}")

        df_unknowns.to_csv("fondos_para_revisar.csv", index=False)
        print("-" * 60)
        print(f"✅ Lista completa exportada a: fondos_para_revisar.csv")
    else:
        print("🤔 Sigo sin encontrar nada. ¿Seguro que 'categoria_inferida' es la columna que usa tu gráfica?")

if __name__ == "__main__":
    audit_unknowns_v2("funds_100_percent_classified.csv")
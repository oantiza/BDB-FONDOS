import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
import argparse


def sync_to_firestore(input_csv, dry_run=True):
    # 1. Inicializar Firestore
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    # 2. Leer el CSV clasificado
    df = pd.read_csv(input_csv)

    # Filtrar solo los que tienen una categoría inferida nueva
    # (Comparando con la columna original si existe, o simplemente procesando los que no son 'No Clasificado')
    to_update = df[df["categoria_inferida"] != "No Clasificado"]

    print(f"🚀 Preparado para sincronizar {len(to_update)} fondos...")

    updated_count = 0
    for _, row in to_update.iterrows():
        isin = row["isin"]
        nueva_cat = row["categoria_inferida"]

        # Referencia al documento en funds_v3
        doc_ref = db.collection("funds_v3").document(isin)

        if dry_run:
            print(f"👻 [DRY RUN] Actualizaría {isin} -> {nueva_cat}")
        else:
            # Actualizamos solo el campo de categoría derivada
            doc_ref.update({"derived_category": nueva_cat})
            print(f"✅ {isin} actualizado con éxito.")

        updated_count += 1

    print(f"\n✨ Finalizado. Fondos procesados: {updated_count}")
    if dry_run:
        print(
            "💡 Esto fue un simulacro. Usa el script sin --execute para aplicar cambios."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="funds_100_percent_classified.csv")
    parser.add_argument(
        "--execute", action="store_true", help="Escribe los cambios en Firestore"
    )
    args = parser.parse_args()

    sync_to_firestore(args.input, dry_run=not args.execute)

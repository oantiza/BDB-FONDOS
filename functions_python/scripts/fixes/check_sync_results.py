import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore


def verify_sync(csv_path):
    # 1. Conexión a Firestore
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    # 2. Cargar el CSV que usamos como base
    df = pd.read_csv(csv_path)
    # Solo nos interesan los que debían actualizarse
    targeted_funds = df[df["categoria_inferida"] != "No Clasificado"]

    print(f"🔍 Verificando {len(targeted_funds)} fondos en Firestore...\n")

    success_count = 0
    errors = []

    for _, row in targeted_funds.iterrows():
        isin = row["isin"]
        expected_cat = row["categoria_inferida"]

        # Consultar la realidad actual en Firestore
        doc = db.collection("funds_v3").document(isin).get()

        if doc.exists:
            actual_data = doc.to_dict()
            actual_cat = actual_data.get("derived_category")

            if actual_cat == expected_cat:
                success_count += 1
                # Opcional: print(f"✅ {isin}: OK")
            else:
                errors.append(
                    f"❌ {isin}: Error. Esperado '{expected_cat}', Encontrado '{actual_cat}'"
                )
        else:
            errors.append(f"❓ {isin}: El documento no existe en Firestore.")

    # 3. Reporte Final
    print("-" * 30)
    print("📊 RESULTADO DE LA VERIFICACIÓN:")
    print(f"   - Coincidencias exactas: {success_count}/{len(targeted_funds)}")

    if errors:
        print(f"   - Discrepancias encontradas: {len(errors)}")
        for err in errors[:10]:  # Mostramos los primeros 10 errores
            print(f"     {err}")
    else:
        print("   - 🎉 ¡Todo perfecto! La base de datos coincide al 100% con el CSV.")


if __name__ == "__main__":
    verify_sync("funds_100_percent_classified.csv")

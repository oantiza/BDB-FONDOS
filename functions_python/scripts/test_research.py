import sys
import os
import json

# Add parent directory to path to import services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Manually load .env variables before importing our services
env_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
)
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"').strip("'")


from services.research import generate_weekly_strategy_report
import firebase_admin
from firebase_admin import firestore


class MockDocRef:
    @property
    def id(self):
        return "mock_doc_id_123"


class MockCollection:
    def add(self, data):
        print("\n" + "=" * 50)
        print("=== MOCK FIRESTORE SAVE (LOCAL TEST) ===")
        print("=" * 50)

        # Vamos a imprimir el titular y los primeros caracteres del json para no inundar la consola
        print(f"📌 HEADLINE GENERADO: {data.get('summary', {}).get('headline', 'N/A')}")
        print(
            f"\n📝 NARRATIVA (Extracto inicial):\n{data.get('summary', {}).get('narrative', '')[:500]}...\n"
        )

        # Imprimimos la matriz táctica de pesos
        print("📊 ASSET ALLOCATION (Classes):")
        print(
            json.dumps(
                data.get("assetAllocation", {}).get("classes", []),
                indent=2,
                ensure_ascii=False,
            )
        )

        print("\n" + "=" * 50)
        print(
            "✅ Reporte exitosamente generado por la IA (No guardado en Base de Datos por ser test local)"
        )
        return (None, MockDocRef())


class MockDB:
    def collection(self, name):
        return MockCollection()


def main():
    db = None
    try:
        # Intentaremos usar la app por defecto (GCP/Firebase CLI logueado)
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        db = firestore.client()
        print("✅ Conectado a Firebase Firestore Real.")
    except Exception:
        print("⚠️ No se encontraron credenciales de Google Cloud locales.")
        print(
            "⚠️ Pasando a modo 'Mock Database' para probar la IA sin guardar en BD...\n"
        )
        db = MockDB()

    print("Testing generate_weekly_strategy_report...\n")
    result = generate_weekly_strategy_report(db)
    print("\nEstado final del script:", result)


if __name__ == "__main__":
    main()

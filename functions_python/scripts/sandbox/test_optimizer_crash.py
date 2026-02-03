
import sys
import os

# Ajustar path para que encuentre los módulos
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'functions_python'))

print("🔍 Iniciando test de importación...")

try:
    from functions_python.services.optimizer import run_optimization
    print("✅ Importación de optimizer exitosa.")
except Exception as e:
    print(f"❌ Error importando optimizer: {e}")
    sys.exit(1)

# Mock DB y DataFetcher si es necesario para correr algo más
class MockDB:
    def collection(self, name):
        return MockCollection()

class MockCollection:
    def document(self, name):
        return MockDoc()

class MockDoc:
    def get(self):
        return MockSnapshot()

class MockSnapshot:
    exists = False
    def to_dict(self):
        return {}

print("🚀 Ejecutando run_optimization con datos dummy...")
try:
    # Esto probablemente fallará en DataFetcher por falta de credenciales reales
    # pero queremos ver si explota ANTES de eso (sintaxis, lógica inicial)
    db = MockDB()
    run_optimization(['IE00B03HCZ61'], 5, db=db)
except Exception as e:
    print(f"⚠️ Error ejecucion (esperado si es auth): {e}")

print("🏁 Test finalizado.")

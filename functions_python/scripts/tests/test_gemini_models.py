"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: tests
PURPOSE: Verifica conectividad y respuesta de modelos Gemini.
SAFE_MODE: LOCAL_ONLY
RUN: python -m scripts.tests.test_gemini_models
"""
import os
import sys

from google import genai

# API key intentionally read from the environment; never hardcode secrets here.
MI_CLAVE = os.environ.get("GEMINI_API_KEY")
if not MI_CLAVE:
    print("GEMINI_API_KEY no configurada; se omite el test local de Gemini.")
    sys.exit(0)

print("🔍 Iniciando test con la nueva API de Gemini...")

try:
    # Le pasamos la variable de entorno
    client = genai.Client(api_key=MI_CLAVE)

    print("\n✅ Conectado con éxito. Obteniendo modelos...\n")

    # Listamos los modelos
    for model in client.models.list():
        print(f"🤖 Modelo: {model.name}")

    print("\n✅ Test finalizado con éxito.")
except Exception as e:
    print(f"\n❌ Error crítico de la API: {e}")


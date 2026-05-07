"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: tests
PURPOSE: Verifica conectividad y respuesta de modelos Gemini.
SAFE_MODE: LOCAL_ONLY
RUN: python -m scripts.tests.test_gemini_models
"""
import os`r`nimport sys`r`n`r`nfrom google import genai

# API key intentionally read from the environment; never hardcode secrets here.`r`nMI_CLAVE = os.environ.get("GEMINI_API_KEY")`r`nif not MI_CLAVE:`r`n    print("GEMINI_API_KEY no configurada; se omite el test local de Gemini.")`r`n    sys.exit(0)

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


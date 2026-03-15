from google import genai

# ¡AQUÍ ESTÁ LA CLAVE DIRECTA! Sin inputs.
MI_CLAVE = "AIzaSyDLTmqTvGDqzSuG70srrFV1wSP0omYjwV4"

print("🔍 Iniciando test con la nueva API de Gemini...")

try:
    # Le pasamos la variable directamente
    client = genai.Client(api_key=MI_CLAVE)

    print("\n✅ Conectado con éxito. Obteniendo modelos...\n")

    # Listamos los modelos
    for model in client.models.list():
        print(f"🤖 Modelo: {model.name}")

    print("\n✅ Test finalizado con éxito.")
except Exception as e:
    print(f"\n❌ Error crítico de la API: {e}")

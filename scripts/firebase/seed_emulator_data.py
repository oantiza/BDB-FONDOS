"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: firebase
PURPOSE: Seed the Firestore emulator with a sample weekly report and basic system settings (risk profiles).
SAFE_MODE: LOCAL_ONLY
RUN: python scripts/firebase/seed_emulator_data.py
"""
import os
from google.cloud import firestore
import datetime

# Point to emulator
os.environ["FIRESTORE_EMULATOR_HOST"] = "localhost:8080"

db = firestore.Client(project="bdb-fondos")

report_data = {
    "type": "WEEKLY_REPORT",
    "date": datetime.datetime.now().isoformat(),
    "author": "Antigravity AI",
    "summary": {
        "headline": "Perspectiva Macro Semanal: Resiliencia y Adaptación",
        "narrative": "A la atención del Comité de Inversiones, nos encontramos en un entorno de crecimiento moderado con inflación persistente.",
        "marketTemperature": "Neutral"
    },
    "fullReport": {
        "narrative": "# Análisis Macroeconómico Semanal\n\n## 1. Coyuntura Global\n\nEl crecimiento global se mantiene estable pero con riesgos a la baja. La política monetaria sigue siendo restrictiva en la mayoría de las economías desarrolladas.\n\n## 2. Estrategia de Inversión\n\nRecomendamos mantener una exposición equilibrada entre renta variable y renta fija. La liquidez debe ser gestionada con prudencia.\n\n> \"La paciencia es la clave en los mercados actuales\".\n\n### Tabla de Asignación sugerida\n| Activo | Visión | Peso |\n| :--- | :--- | :--- |\n| Renta Variable | Positiva | 60% |\n| Renta Fija | Neutral | 30% |\n| Alternativos | Neutral | 10% |\n"
    },
    "assetAllocation": {
        "overview": "Distribución táctica basada en el análisis de riesgo-retorno actual.",
        "classes": [
            {"assetClass": "Renta Variable", "strategicWeight": 50, "tacticalWeight": 60, "view": "Positiva"},
            {"assetClass": "Renta Fija", "strategicWeight": 40, "tacticalWeight": 30, "view": "Neutral"},
            {"assetClass": "Liquidez", "strategicWeight": 10, "tacticalWeight": 10, "view": "Neutral"}
        ],
        "regionsEquity": [
            {"region": "EEUU", "weight": 55, "view": "Positiva"},
            {"region": "Europa", "weight": 25, "view": "Neutral"},
            {"region": "Emergentes", "weight": 20, "view": "Positiva"}
        ]
    }
}

# Seed system settings
db.collection("system_settings").document("risk_profiles").set({
    "profiles": [
        {"id": "conservative", "name": "Conservador"},
        {"id": "moderate", "name": "Moderado"},
        {"id": "aggressive", "name": "Agresivo"}
    ]
})

db.collection("reports").add(report_data)
print("Successfully seeded sample report and system settings to emulator firestore.")


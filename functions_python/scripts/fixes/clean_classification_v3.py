import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore

# =========================================================
# Paths & Init
# =========================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FUNCTIONS_PYTHON_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(FUNCTIONS_PYTHON_DIR, ".."))
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")

if FUNCTIONS_PYTHON_DIR not in sys.path:
    sys.path.append(FUNCTIONS_PYTHON_DIR)


def get_db():
    if not firebase_admin._apps:
        if not os.path.exists(KEY_PATH):
            raise FileNotFoundError(f"Key not found: {KEY_PATH}")
        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
    return firestore.client()


# =========================================================
# Data Fixes
# =========================================================

MOJIBAKE_MAP = {
    "RV Asia PacÝfico": "RV Asia Pacífico",
    "RV Temßtica": "RV Temática",
    "Mixto Dinßmico": "Mixto Dinámico",
    "RF Ligada a Inflaci¾n": "RF Ligada a Inflación",
    "RV Jap¾n": "RV Japón",
}


def infer_region_from_name(name):
    name = name.upper()
    if any(k in name for k in ["EMERGING", "EMERG", "EMERGE", "EM "]):
        return "EMERGING"
    if any(k in name for k in ["EUROPE", "EURO", "EUR "]):
        return "EUROPE"
    if any(k in name for k in ["US ", "AMERICA", "USA"]):
        return "US"
    if "GLOBAL" in name or "WORLD" in name:
        return "GLOBAL"
    if "ASIA" in name or "CHINA" in name or "INDIA" in name:
        return "ASIA_DEV"
    if "JAPAN" in name:
        return "JAPAN"
    return None


def infer_subtype_from_name(name, current_type):
    name = name.upper()
    if current_type == "EQUITY":
        if "TECH" in name or "TECHNOLOGY" in name:
            return "SECTOR_EQUITY_TECH"
        if "HEALTH" in name:
            return "SECTOR_EQUITY_HEALTHCARE"
        if "GLOBAL" in name:
            return "GLOBAL_EQUITY"
        if "EMERGING" in name:
            return "EMERGING_MARKETS_EQUITY"
        if "EUROPE" in name:
            return "EUROPE_EQUITY"
        if "US " in name or "USA" in name:
            return "US_EQUITY"
    elif current_type == "FIXED_INCOME":
        if "HIGH YIELD" in name or "HY " in name:
            return "HIGH_YIELD_BOND"
        if "CORP" in name:
            return "CORPORATE_BOND"
        if "GOV" in name or "SOVEREIGN" in name:
            return "GOVERNMENT_BOND"
        if "EMERGING" in name:
            return "EMERGING_MARKETS_BOND"
        if "CONVERTIBLE" in name:
            return "CONVERTIBLE_BOND"
    elif current_type == "MIXED":
        if "FLEX" in name:
            return "FLEXIBLE_ALLOCATION"
        if "MODERAT" in name:
            return "MODERATE_ALLOCATION"
        if "CONSERVAT" in name:
            return "CONSERVATIVE_ALLOCATION"
        if "AGGRESSIV" in name or "DYNAMIC" in name:
            return "AGGRESSIVE_ALLOCATION"
    return None


def main():
    db = get_db()

    print("Iniciando revisión de base de datos funds_v3...")
    assets_ref = db.collection("funds_v3")
    docs = assets_ref.stream()

    total_updates = 0
    updates_mojibake = 0
    updates_region = 0
    updates_subtype = 0

    for doc in docs:
        data = doc.to_dict()
        isin = doc.id
        updates = {}

        name = data.get("name", "")
        classification = data.get("classification_v2", {})
        derived = data.get("derived", {})

        current_category = derived.get("category")
        current_region = classification.get("region_primary")
        current_subtype = classification.get("asset_subtype")
        current_type = classification.get("asset_type")

        # 1. Fix Mojibake
        if current_category in MOJIBAKE_MAP:
            new_cat = MOJIBAKE_MAP[current_category]
            derived["category"] = new_cat
            updates["derived.category"] = new_cat
            updates_mojibake += 1

        # 2. Infer UNKNOWN region
        if current_region == "UNKNOWN":
            new_region = infer_region_from_name(name)
            if new_region:
                updates["classification_v2.region_primary"] = new_region
                updates_region += 1

        # 3. Infer UNKNOWN subtype
        if current_subtype == "UNKNOWN":
            new_subtype = infer_subtype_from_name(name, current_type)
            if new_subtype:
                updates["classification_v2.asset_subtype"] = new_subtype
                updates_subtype += 1

        if updates:
            print(f"[{isin}] {name} -> Aplicando {len(updates)} parches: {updates}")
            total_updates += 1
            doc.reference.update(updates)

    print("\n--- Resumen de Actualización ---")
    print(f"Fondos actualizados: {total_updates}")
    print(f"Correcciones de Mojibake (derived.category): {updates_mojibake}")
    print(f"Inferencias de Región (UNKNWON -> Región): {updates_region}")
    print(f"Inferencias de Subtipo (UNKNOWN -> Subtipo): {updates_subtype}")
    print("Saneamiento completado.")


if __name__ == "__main__":
    main()

import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from collections import Counter

# =========================================================
# Paths
# =========================================================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FUNCTIONS_PYTHON_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(FUNCTIONS_PYTHON_DIR, ".."))
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")

# Permite importar desde functions_python/*
if FUNCTIONS_PYTHON_DIR not in sys.path:
    sys.path.append(FUNCTIONS_PYTHON_DIR)


# =========================================================
# Firebase init
# =========================================================
def get_db():
    if not firebase_admin._apps:
        if not os.path.exists(KEY_PATH):
            raise FileNotFoundError(
                f"No se encontró serviceAccountKey.json en: {KEY_PATH}"
            )

        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
        print(f"[INIT] Firebase initialized with key: {KEY_PATH}")

    return firestore.client()


def main():
    db = get_db()
    assets_ref = db.collection("funds_v3")
    docs = assets_ref.stream()

    data_summary = {
        "classification_v2.asset_type": Counter(),
        "classification_v2.asset_subtype": Counter(),
        "classification_v2.region_primary": Counter(),
        "derived.asset_class": Counter(),
        "derived.category": Counter(),
        "derived.style": Counter(),
        "derived.quality": Counter(),
        "portfolio_exposure_v2.economic_exposure": Counter(),
        "type": Counter(),
    }

    asset_count = 0

    def str_hashable(val):
        if isinstance(val, (dict, list)):
            return str(val)
        return val

    for doc in docs:
        data = doc.to_dict()
        asset_count += 1

        classification = data.get("classification_v2", {})
        derived = data.get("derived", {})
        exposure = data.get("portfolio_exposure_v2", {})

        data_summary["classification_v2.asset_type"][
            str_hashable(classification.get("asset_type", "MISSING"))
        ] += 1
        data_summary["classification_v2.asset_subtype"][
            str_hashable(classification.get("asset_subtype", "MISSING"))
        ] += 1
        data_summary["classification_v2.region_primary"][
            str_hashable(classification.get("region_primary", "MISSING"))
        ] += 1

        data_summary["derived.asset_class"][
            str_hashable(derived.get("asset_class", "MISSING"))
        ] += 1
        data_summary["derived.category"][
            str_hashable(derived.get("category", "MISSING"))
        ] += 1
        data_summary["derived.style"][
            str_hashable(derived.get("style", "MISSING"))
        ] += 1
        data_summary["derived.quality"][
            str_hashable(derived.get("quality", "MISSING"))
        ] += 1

        data_summary["portfolio_exposure_v2.economic_exposure"][
            str_hashable(exposure.get("economic_exposure", "MISSING"))
        ] += 1
        data_summary["type"][str_hashable(data.get("type", "MISSING"))] += 1

    print(f"Total Assets Processed: {asset_count}")
    print("\n--- Summary ---")

    for key, counter in data_summary.items():
        print(f"\n{key}:")
        for val, count in counter.most_common():
            print(f"  {val}: {count}")


if __name__ == "__main__":
    main()

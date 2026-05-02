"""
Script: check_and_import_retrocesion.py

Lee el CSV 'fondos_con_retrocesion.csv' desde la raíz del proyecto y:
1. Para cada ISIN, consulta Firestore en 'funds_v3'.
2. Reporta los fondos que ya tienen retrocesión != 0 en BD (CONFLICTO).
3. Actualiza los fondos que NO tienen retrocesión o la tienen a 0 (IMPORT).

Uso:
    python check_and_import_retrocesion.py             -> Solo verificar y reportar
    python check_and_import_retrocesion.py --import    -> Verificar e importar (skip conflictos)
    python check_and_import_retrocesion.py --force     -> Importar TODOS, sobreescribir conflictos

"""

import os
import sys
import csv
import firebase_admin
from firebase_admin import credentials, firestore

# ——————————————— CONFIG ———————————————
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")
CSV_PATH = os.path.join(PROJECT_ROOT, "fondos_con_retrocesion.csv")
COLLECTION = "funds_v3"

# ——————————————— INIT FIREBASE ———————————————
if not firebase_admin._apps:
    cred = credentials.Certificate(KEY_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()


# ——————————————— PARSE CSV ———————————————
def parse_retrocesion(val: str) -> float:
    """Convierte '1,50%' o '0.50%' a float decimal (0.015 -> 1.5%)"""
    val = val.strip().replace("%", "").replace(",", ".").strip()
    try:
        pct = float(val)
        # Si el valor está en formato > 1 (ej. 1.5 que significa 1.5%), lo dejamos así
        # La BD guarda los valores como porcentaje directo (ej. 1.5 = 1.5%)
        return round(pct, 4)
    except:
        return 0.0


csv_funds = []
seen_isins = set()
with open(CSV_PATH, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f, delimiter=";")
    for row in reader:
        isin = row.get("isin ", row.get("isin", "")).strip()
        nombre = row.get("nombre", "").strip()
        retro_str = row.get("retrocesion", "0").strip()
        retro = parse_retrocesion(retro_str)

        if not isin or isin in seen_isins:
            continue
        seen_isins.add(isin)
        csv_funds.append(
            {"isin": isin, "nombre": nombre, "retro": retro, "retro_str": retro_str}
        )

print(f"\n📂 CSV cargado: {len(csv_funds)} fondos únicos encontrados.\n")

# ——————————————— CONSULTAR FIRESTORE ———————————————
conflicts = []  # Ya tienen retro != 0 en BD
to_import = []  # No tienen retro O la tienen a 0
not_found = []  # ISIN no existe en funds_v3
skipped_zero = []  # CSV tiene retro = 0, se salta

print("🔍 Consultando Firestore...")
for fund in csv_funds:
    isin = fund["isin"]
    retro_csv = fund["retro"]

    if retro_csv == 0:
        skipped_zero.append(fund)
        continue

    doc_ref = db.collection(COLLECTION).document(isin)
    doc = doc_ref.get()

    if not doc.exists:
        not_found.append(fund)
        continue

    data = doc.to_dict()
    # Check retrocession in both possible locations
    retro_db = (
        (data.get("manual") or {}).get("costs", {}).get("retrocession")
        or (data.get("costs") or {}).get("retrocession")
        or 0
    )

    if retro_db and retro_db != 0:
        conflicts.append({**fund, "retro_db": retro_db})
    else:
        to_import.append(fund)

# ——————————————— REPORT ———————————————
print("\n" + "=" * 60)
print("📊 REPORTE DE RETROCESIONES")
print("=" * 60)

print(f"\n✅ Fondos listos para importar (sin retro en BD): {len(to_import)}")
print(f"⚠️  Fondos con CONFLICTO (retro != 0 en BD): {len(conflicts)}")
print(f"❌  Fondos NO encontrados en BD: {len(not_found)}")
print(f"⏭️  Fondos con retrocesión 0 en CSV (saltados): {len(skipped_zero)}")

if conflicts:
    print(f"\n{'─' * 60}")
    print(f"⚠️  CONFLICTOS: {len(conflicts)} fondos ya tienen retrocesión en BD")
    print(f"{'─' * 60}")
    for c in conflicts:
        csv_val = f"{c['retro']}%"
        db_val = f"{c['retro_db']}%"
        print(
            f"  {c['isin']:<20} | CSV: {csv_val:<8} | BD: {db_val:<8} | {c['nombre'][:50]}"
        )

if not_found:
    print(f"\n{'─' * 60}")
    print(f"❌  NO ENCONTRADOS: {len(not_found)} ISINs no están en funds_v3")
    print(f"{'─' * 60}")
    for f in not_found:
        print(f"  {f['isin']:<20} | {f['retro']}% | {f['nombre'][:50]}")

# ——————————————— IMPORT ———————————————
do_import = "--import" in sys.argv or "--force" in sys.argv
force_overwrite = "--force" in sys.argv

# --isins ISIN1,ISIN2,... : force-update only these specific ISINs
specific_isins = set()
if "--isins" in sys.argv:
    idx = sys.argv.index("--isins")
    if idx + 1 < len(sys.argv):
        specific_isins = set(
            i.strip() for i in sys.argv[idx + 1].split(",") if i.strip()
        )
        do_import = True

if do_import:
    if specific_isins:
        # Merge all candidates (to_import + conflicts) and filter by specific_isins
        all_candidates = {f["isin"]: f for f in to_import + conflicts}
        targets = [f for isin, f in all_candidates.items() if isin in specific_isins]
        print(f"\n{'─' * 60}")
        print(f"🎯 IMPORTACIÓN SELECTIVA: {len(targets)} fondos específicos")
        print(f"{'─' * 60}")
    else:
        targets = to_import + (conflicts if force_overwrite else [])
    print(f"\n{'─' * 60}")
    print(f"🚀 IMPORTANDO {len(targets)} fondos...")
    print(f"{'─' * 60}")
    imported = 0
    errors = 0
    for fund in targets:
        try:
            doc_ref = db.collection(COLLECTION).document(fund["isin"])
            doc_ref.set(
                {"manual": {"costs": {"retrocession": fund["retro"]}}}, merge=True
            )
            imported += 1
            print(f"  ✅ {fund['isin']} -> {fund['retro']}% ({fund['nombre'][:40]})")
        except Exception as e:
            errors += 1
            print(f"  ❌ {fund['isin']} -> ERROR: {e}")

    print(f"\n{'=' * 60}")
    print(
        f"✅ Importación completada: {imported} fondos actualizados, {errors} errores."
    )
else:
    print(f"\n{'─' * 60}")
    print("ℹ️  Modo solo lectura. Para importar ejecuta con:")
    print("    python check_and_import_retrocesion.py --import")
    print(
        "    python check_and_import_retrocesion.py --force  (sobrescribe conflictos)"
    )
    print(f"{'─' * 60}\n")

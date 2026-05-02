import os
import sys
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import json

# Definir el mapeo comercial
SUBTYPE_MAPPING = {
    # EQUITY
    "GLOBAL_EQUITY": "RV Global",
    "US_EQUITY": "RV EE.UU.",
    "EUROPE_EQUITY": "RV Europa",
    "EUROZONE_EQUITY": "RV Eurozona",
    "EMERGING_MARKETS_EQUITY": "RV Emergente",
    "ASIA_PACIFIC_EQUITY": "RV Asia Pacífico",
    "JAPAN_EQUITY": "RV Japón",
    "UK_EQUITY": "RV Reino Unido",
    "THEMATIC_EQUITY": "RV Temática",
    "SECTOR_EQUITY_TECH": "RV Sectorial Tecnología",
    "SECTOR_EQUITY_HEALTHCARE": "RV Sectorial Salud",
    "SECTOR_EQUITY_FINANCIAL": "RV Sectorial Financiero",
    "SECTOR_EQUITY_CONSUMER": "RV Sectorial Consumo",
    "GLOBAL_INCOME_EQUITY": "RV Alto Dividendo",
    
    # FIXED_INCOME
    "GLOBAL_BOND": "RF Global",
    "GOVERNMENT_BOND": "RF Soberana",
    "CORPORATE_BOND": "RF Corporativa",
    "HIGH_YIELD_BOND": "RF Alto Rendimiento",
    "EMERGING_MARKETS_BOND": "RF Emergente",
    "INFLATION_LINKED_BOND": "RF Ligada a Inflación",
    "CONVERTIBLE_BOND": "RF Convertible",
    "COVERED_BOND": "RF Cédulas",
    
    # MIXED / ALLOCATION
    "CONSERVATIVE_ALLOCATION": "Mixto Conservador",
    "MODERATE_ALLOCATION": "Mixto Moderado",
    "AGGRESSIVE_ALLOCATION": "Mixto Dinámico",
    "FLEXIBLE_ALLOCATION": "Mixto Flexible",
    "TARGET_DATE": "Ciclo de Vida",
    
    # ALTERNATIVES
    "TOTAL_RETURN": "Retorno Absoluto",
    "LONG_SHORT_EQUITY": "Retorno Absoluto (L/S Equity)",
    "MACRO_FUNDS": "Macro Global",
    "MULTI_STRATEGY": "Multiestrategia",
    "REAL_ESTATE": "Inmobiliario",
    "COMMODITIES": "Materias Primas",
    
    # MONETARY
    "MONETARY_EUR": "Monetario EUR",
    "MONETARY_USD": "Monetario USD",
    "MONETARY_GLOBAL": "Monetario Global",
    
    "UNKNOWN": "No Clasificado"
}

def main():
    print("Iniciando actualización de derived.category en funds_v3...")
    
    if "GOOGLE_APPLICATION_CREDENTIALS" not in os.environ:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "serviceAccountKey.json"
        
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
        
    db = firestore.client()
    funds_ref = db.collection("funds_v3")
    funds = list(funds_ref.stream())
    
    print(f"Se encontraron {len(funds)} fondos en total.")
    
    batch = db.batch()
    updated_count = 0
    batch_count = 0
    
    for doc in funds:
        data = doc.to_dict()
        cv2 = data.get("classification_v2", {})
        subtype = cv2.get("asset_subtype", "UNKNOWN")
        
        # Mapeamos a la categoría comercial, si no existe ponemos el inglés por defecto
        category_label = SUBTYPE_MAPPING.get(subtype, "Otros - " + subtype)
        
        # Leemos derived actual
        derived = data.get("derived", {})
        current_cat = derived.get("category", "NONE")
        
        # Solo actualizamos si es necesario
        if current_cat != category_label:
            derived["category"] = category_label
            batch.update(doc.reference, {"derived": derived})
            updated_count += 1
            batch_count += 1
            
            # Subir en lotes de 400
            if batch_count >= 400:
                print(f"Commit batch de {batch_count} operaciones...")
                batch.commit()
                batch = db.batch()
                batch_count = 0
                
    if batch_count > 0:
        print(f"Commit batch final de {batch_count} operaciones...")
        batch.commit()
        
    print(f"¡Éxito! Se actualizaron las categorías secundarias de {updated_count} fondos.")

if __name__ == "__main__":
    main()

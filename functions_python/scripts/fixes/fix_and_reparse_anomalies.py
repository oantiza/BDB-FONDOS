import firebase_admin
from firebase_admin import credentials, firestore
import json
import requests
import os
import sys

# Replace with your API key if you want to pass it directly
EODHD_API_KEY = "6943decfb2bb14.96572592"

def initialize_firebase():
    if not firebase_admin._apps:
        if os.path.exists("./serviceAccountKey.json"):
            cred = credentials.Certificate("./serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
        elif os.path.exists("../serviceAccountKey.json"):
            cred = credentials.Certificate("../serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    return firestore.client()

def fetch_eodhd_fundamentals(isin):
    """
    Intenta buscar el ISIN en EODHD usando el Search API y recuperar los Fundamentales.
    """
    search_url = f"https://eodhd.com/api/search/{isin}?api_token={EODHD_API_KEY}&fmt=json"
    try:
        s_resp = requests.get(search_url)
        search_data = s_resp.json()
        if not search_data:
            return None
        
        # Tomar el primer ticker coincidente
        ticker = search_data[0].get("Code")
        exchange = search_data[0].get("Exchange")
        full_ticker = f"{ticker}.{exchange}"
        
        fund_url = f"https://eodhd.com/api/fundamentals/{full_ticker}?api_token={EODHD_API_KEY}&fmt=json"
        f_resp = requests.get(fund_url)
        return f_resp.json()
    except Exception as e:
        print(f"Error fetching EODHD for {isin}: {e}")
        return None

def main():
    db = initialize_firebase()
    funds_ref = db.collection("funds_v3").stream()
    
    anomalies_found = 0
    dry_run_patches = []
    
    for doc in funds_ref:
        data = doc.to_dict()
        isin = data.get("isin", doc.id)
        
        needs_reparse = False
        reason = ""
        
        # 1. Chequeo de Exposiciones a Zero
        portfolio = data.get("portfolio_exposure_v2", {})
        if portfolio:
            total_exp = portfolio.get("equity", 0.0) + portfolio.get("bond", 0.0) + portfolio.get("cash", 0.0) + portfolio.get("alternative", 0.0) + portfolio.get("other", 0.0)
            if total_exp == 0.0:
                needs_reparse = True
                reason = "ZERO_EXPOSURE"
                
        # 2. Chequeo de Anomalías Regionales > 1.05
        # En la plataforma se mapean a classification_v2 o similar
        regions = data.get("classification_v2", {}).get("equity_regions", {})
        if regions:
            total_region = sum(regions.values())
            if total_region > 1.05:
                needs_reparse = True
                reason = f"REGION_SUM_OVERFLOW ({total_region:.2f})"
                
        if needs_reparse:
            anomalies_found += 1
            print(f"[*] Reparando {isin} - Motivo: {reason}")
            
            # Reparseo
            fundamentals = fetch_eodhd_fundamentals(isin)
            if fundamentals and "Asset_Allocation" in fundamentals:
                # EODHD tiene Asset_Allocation y World_Regions
                patch = {
                    "isin": isin,
                    "reason": reason,
                    "new_asset_allocation": fundamentals.get("Asset_Allocation"),
                    "new_world_regions": fundamentals.get("World_Regions")
                }
                dry_run_patches.append(patch)
                print(f"    --> ¡Datos recuperados para {isin} desde EODHD!")
            else:
                print(f"    --> [!] No se encontró info limpia en EODHD para {isin}.")
                patch = {
                    "isin": isin,
                    "reason": reason,
                    "error": "Not found in EODHD"
                }
                dry_run_patches.append(patch)
                
    # Guardar parche para validación
    with open("reparse_dryrun_patch.json", "w") as f:
        json.dump(dry_run_patches, f, indent=2)
        
    print(f"\nFinalizado. Total anomalías procesadas: {anomalies_found}")
    print("Por favor, revisa el archivo 'reparse_dryrun_patch.json' antes de aplicarlo.")

if __name__ == '__main__':
    main()

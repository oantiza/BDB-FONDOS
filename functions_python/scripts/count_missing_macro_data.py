import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore

def main():
    print("Conectando a Firebase...")
    if not firebase_admin._apps:
        cred = credentials.Certificate(r'C:\Users\oanti\Documents\BDB-FONDOS\functions_python\credenciales.json')
        firebase_admin.initialize_app(cred)
    
    db = firestore.client()
    
    print("Obteniendo todos los fondos...")
    docs = db.collection('funds_v3').stream()
    
    total = 0
    missing = 0
    con_exposure = 0
    con_metrics = 0
    
    for doc in docs:
        total += 1
        data = doc.to_dict()
        
        has_exposure = False
        has_metrics = False
        
        # Validar portfolio_exposure_v2
        exposure_v2 = data.get('portfolio_exposure_v2')
        if exposure_v2 and isinstance(exposure_v2, dict):
            eco_exp = exposure_v2.get('economic_exposure')
            if eco_exp and isinstance(eco_exp, dict) and any(eco_exp.values()):
                has_exposure = True
                
        # Validar metrics fallback
        metrics = data.get('metrics')
        if metrics and isinstance(metrics, dict):
            if any(k in metrics for k in ['equity', 'bond', 'cash', 'other']):
                has_metrics = True
                
        if has_exposure:
            con_exposure += 1
        elif has_metrics:
            con_metrics += 1
        else:
            missing += 1
            
    print(f"\n--- REPORTE DE CALIDAD DE DATOS (FONDOS) ---")
    print(f"Total de fondos analizados: {total}")
    print(f"Fondos CON desglose macro v2 (economic_exposure): {con_exposure}")
    print(f"Fondos CON desglose macro legacy (metrics): {con_metrics}")
    print(f"Fondos SIN ningún desglose (requieren estimación): {missing}")
    
    if total > 0:
        pct_missing = (missing / total) * 100
        print(f"\nPorcentaje de fondos sin datos detallados: {pct_missing:.2f}%")

if __name__ == "__main__":
    main()

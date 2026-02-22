import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import json

try:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    db = firestore.client()
    
    reports_ref = db.collection('reports')
    query = reports_ref.where('type', '==', 'WEEKLY_REPORT').order_by('date', direction=firestore.Query.DESCENDING).limit(1)
    results = query.stream()
    
    found = False
    for doc in results:
        found = True
        data = doc.to_dict()
        print(f"✅ Encontrado reporte ID: {doc.id}")
        print(f"Date: {data.get('date')}")
        print(f"Type: {data.get('type')}")
        print(f"Status: {data.get('status')}")
        print(f"Headline: {data.get('summary', {}).get('headline')}")
        # Just print the first 100 chars of narrative to see if it's there
        narrative = data.get('summary', {}).get('narrative', '')
        print(f"Narrative length: {len(narrative)}")
        print(f"Narrative preview: {narrative[:100]}...")
        
    if not found:
        print("❌ No se encontró ningún reporte de tipo WEEKLY_REPORT en Firestore.")
        
        # Let's check what IS in there just in case
        all_reports = reports_ref.limit(3).stream()
        print("\nRevisando otros documentos en la colección 'reports':")
        for doc in all_reports:
             data = doc.to_dict()
             print(f"ID: {doc.id}, Type: {data.get('type')}, Date: {data.get('date')}")
        
except Exception as e:
    print(f"Error querying Firestore: {e}")

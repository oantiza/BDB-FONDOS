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
    collections = db.collections()
    for col in collections:
        print(f"Colección encontrada: {col.id}")

if __name__ == "__main__":
    main()

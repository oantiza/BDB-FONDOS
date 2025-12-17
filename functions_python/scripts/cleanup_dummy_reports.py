from firebase_admin import firestore, initialize_app, credentials

# Initialize Firebase
try:
    initialize_app()
except ValueError:
    pass

db = firestore.client()

def delete_dummy_reports():
    print("Deleting dummy reports...")
    docs = db.collection('analysis_results').stream()
    deleted = 0
    for doc in docs:
        d = doc.to_dict()
        # Identify dummy reports by specific content signatures or dates
        if "generado automáticamente" in d.get('executive_summary', ''):
            print(f"Deleting {doc.id}...")
            doc.reference.delete()
            deleted += 1
            
    print(f"Deleted {deleted} dummy reports.")

if __name__ == "__main__":
    delete_dummy_reports()

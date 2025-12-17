"""
Script to migrate analysis_results from boutique-financiera-app to bdb-fondos
"""
from firebase_admin import firestore, initialize_app, credentials
import firebase_admin

# Initialize source Firebase (boutique-financiera-app)
source_cred = credentials.Certificate({
    "type": "service_account",
    "project_id": "boutique-financiera-app",
    # Note: You'll need to provide the service account key
    # Download from: https://console.firebase.google.com/project/boutique-financiera-app/settings/serviceaccounts/adminsdk
})

source_app = initialize_app(source_cred, name='source')
source_db = firestore.client(source_app)

# Initialize destination Firebase (bdb-fondos)
# This will use the default credentials from the environment
try:
    dest_app = firebase_admin.get_app()
except ValueError:
    dest_app = initialize_app()
    
dest_db = firestore.client(dest_app)

def migrate_reports():
    """
    Migrate all documents from analysis_results collection
    """
    print("🔄 Starting migration from boutique-financiera-app to bdb-fondos...")
    
    # Get all reports from source
    source_collection = source_db.collection('analysis_results')
    reports = source_collection.stream()
    
    migrated_count = 0
    
    for report_doc in reports:
        report_data = report_doc.to_dict()
        report_id = report_doc.id
        
        # Add to destination
        dest_db.collection('analysis_results').document(report_id).set(report_data)
        
        print(f"✅ Migrated: {report_data.get('type', 'Unknown')} - {report_data.get('date', 'No date')}")
        migrated_count += 1
    
    print(f"\n🎉 Migration complete! Migrated {migrated_count} reports.")
    return migrated_count

if __name__ == "__main__":
    try:
        count = migrate_reports()
        print(f"\n✨ Successfully migrated {count} reports to bdb-fondos")
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        print("\nNote: You need to download the service account key for boutique-financiera-app")
        print("Go to: https://console.firebase.google.com/project/boutique-financiera-app/settings/serviceaccounts/adminsdk")

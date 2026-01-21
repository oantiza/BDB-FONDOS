from google.cloud import firestore

def inspect_document_logic(db: firestore.Client, isin: str):
    doc_ref = db.collection('historico_vl_v2').document(isin)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    return {"error": "Document not found"}

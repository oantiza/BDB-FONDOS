import pandas as pd
import fitz  # PyMuPDF
import json

print("=== EXCEL FILE ===")
try:
    df = pd.read_excel(r'C:\Users\oanti\Documents\BDB-FONDOS\jon.xlsx')
    print(df.head(20).to_string())
    print("\nColumns:", df.columns.tolist())
except Exception as e:
    print("Error reading excel:", e)

print("\n=== PDF FILE ===")
try:
    doc = fitz.open(r'C:\Users\oanti\Documents\BDB-FONDOS\descarga (3).pdf')
    for i in range(min(3, len(doc))):
        print(f"Page {i+1}:")
        print(doc[i].get_text()[:1000]) # Print first 1000 chars of each of the first 3 pages
except Exception as e:
    print("Error reading pdf:", e)

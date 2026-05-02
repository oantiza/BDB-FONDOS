import pandas as pd
import fitz

print("--- EXCEL ---")
df = pd.read_excel(r'C:\Users\oanti\Documents\BDB-FONDOS\jon.xlsx', header=None)
print(df.head(20).to_string())
print(df.info())

print("--- PDF TEXT DUMP ---")
doc = fitz.open(r'C:\Users\oanti\Documents\BDB-FONDOS\descarga (3).pdf')
for i in range(16, 20): # Look at pages 17-20 where portfolio details usually are
    if i < len(doc):
        print(f"--- PAGE {i+1} ---")
        text = doc[i].get_text("blocks")
        for b in text[:20]:
            print(b[4].strip())

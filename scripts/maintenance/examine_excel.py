import pandas as pd

try:
    df = pd.read_excel(r'C:\Users\oanti\Documents\BDB-FONDOS\jon.xlsx')
    print("Columns in jon.xlsx:", df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.head())
except Exception as e:
    print(f"Error: {e}")

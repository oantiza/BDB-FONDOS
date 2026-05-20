import os
import json
import glob
import pandas as pd

def main():
    print("Reading funds from data/canonical directory...")
    canonical_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "canonical")
    json_files = glob.glob(os.path.join(canonical_dir, "*.json"))
    
    data = []
    for file_path in json_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                doc_dict = json.load(f)
                
            isin = doc_dict.get("isin", "N/A")
            name = doc_dict.get("name", "N/A")
            
            if isin == "N/A":
                # Fallback to filename
                isin = os.path.basename(file_path).split('.')[0]
                
            data.append({"ISIN": isin, "Nombre": name})
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
        
    print(f"Fetched {len(data)} funds.")
    
    if not data:
        print("No funds found. Exiting.")
        return
        
    # Create a DataFrame and remove duplicates
    df = pd.DataFrame(data)
    df = df.drop_duplicates(subset=['ISIN'], keep='first')
    
    # Save to Excel
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fondos.xlsx")
    print(f"Saving to {output_path}...")
    df.to_excel(output_path, index=False)
    print("Done!")

if __name__ == "__main__":
    main()

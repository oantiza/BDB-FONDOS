import json
import pandas as pd
import os

files = [
    'C:/Users/oanti/.gemini/antigravity/brain/de1b34c8-d565-45bd-a206-2105d8ec0792/.system_generated/steps/183/output.txt',
    'C:/Users/oanti/.gemini/antigravity/brain/de1b34c8-d565-45bd-a206-2105d8ec0792/.system_generated/steps/189/output.txt',
    'C:/Users/oanti/.gemini/antigravity/brain/de1b34c8-d565-45bd-a206-2105d8ec0792/.system_generated/steps/195/output.txt'
]

def unwrap_firestore_value(v):
    if not isinstance(v, dict): return v
    if 'stringValue' in v: return v['stringValue']
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return float(v['doubleValue'])
    if 'booleanValue' in v: return v['booleanValue']
    if 'nullValue' in v: return None
    if 'timestampValue' in v: return v['timestampValue']
    if 'mapValue' in v:
        fields = v['mapValue'].get('fields', {})
        return {k: unwrap_firestore_value(val) for k, val in fields.items()}
    if 'arrayValue' in v:
        values = v['arrayValue'].get('values', [])
        return [unwrap_firestore_value(val) for val in values]
    return str(v)

def flatten_dict(d, parent_key='', sep='.'):
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            items.append((new_key, json.dumps(v, ensure_ascii=False)))
        else:
            items.append((new_key, v))
    return dict(items)

def main():
    rows = []
    for f in files:
        if not os.path.exists(f): continue
        with open(f, 'r', encoding='utf-8') as file:
            data = json.load(file)
            for doc in data.get('documents', []):
                fields = doc.get('fields', {})
                unwrapped = {k: unwrap_firestore_value(v) for k, v in fields.items()}
                flattened = flatten_dict(unwrapped)
                rows.append(flattened)

    df = pd.DataFrame(rows)

    # Convert common fields to lowercase to avoid case issues, if needed
    # Usually it's 'isin' and 'name'
    
    # Drop duplicates
    if 'isin' in df.columns:
        df = df.drop_duplicates(subset=['isin'], keep='first')

    cols = list(df.columns)
    
    # Extract isin and name to put them first
    if 'isin' in cols:
        cols.remove('isin')
        cols.insert(0, 'isin')
    if 'name' in cols:
        cols.remove('name')
        cols.insert(1, 'name')

    df = df[cols]
    
    # Rename for output
    rename_map = {}
    if 'isin' in df.columns: rename_map['isin'] = 'ISIN'
    if 'name' in df.columns: rename_map['name'] = 'Nombre'
    df.rename(columns=rename_map, inplace=True)

    output_path = 'fondos_firestore_detallado.xlsx'
    df.to_excel(output_path, index=False)
    print(f"Creado {output_path} con {len(df)} filas y {len(df.columns)} columnas.")

if __name__ == "__main__":
    main()

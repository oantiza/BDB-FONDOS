"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: maintenance
PURPOSE: Utility script: list_blackrock.py
SAFE_MODE: REVIEW
RUN: python scripts/maintenance/list_blackrock.py
"""

import json

path = r"c:\Users\oanti\Documents\BDB-FONDOS\scripts\assetclass_backfill_assetclass_ms_category_first_v1_DRY_RUN.json"

with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

search_term = "BlackRock"
found = []

for item in data.get('items', []):
    if search_term.lower() in item.get('name', '').lower():
        found.append({'isin': item['isin'], 'name': item['name']})

print(json.dumps(found, indent=2))

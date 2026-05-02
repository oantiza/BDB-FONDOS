"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: maintenance
PURPOSE: Utility script: search_isin.py
SAFE_MODE: REVIEW
RUN: python scripts/maintenance/search_isin.py
"""

import json

path = r"c:\Users\oanti\Documents\BDB-FONDOS\scripts\assetclass_backfill_assetclass_ms_category_first_v1_DRY_RUN.json"

with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

search_term = "Sustainable Energy"
found = []

for item in data.get('items', []):
    if search_term.lower() in item.get('name', '').lower():
        found.append(item)

print(f"Found {len(found)} items:")
for item in found:
    print(f"ISIN: {item['isin']} | Name: {item['name']}")

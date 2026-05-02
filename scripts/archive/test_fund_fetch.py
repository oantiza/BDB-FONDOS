"""
BDB-FONDOS SCRIPT

STATUS: ARCHIVE
CATEGORY: archive
PURPOSE: Utility script: test_fund_fetch.py
SAFE_MODE: REVIEW
RUN: python scripts/archive/test_fund_fetch.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os
import json
from collections import Counter, defaultdict

sa_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
cred = credentials.Certificate(sa_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

docs = list(db.collection('funds_v3').stream())
total = len(docs)
print(f"Total fondos: {total}\n")

# Track field presence across all docs
field_counts = Counter()        # top-level fields
std_perf_counts = Counter()     # std_perf sub-fields
data_quality_counts = Counter() # data_quality sub-fields
derived_counts = Counter()      # derived sub-fields
ms_counts = Counter()           # ms sub-fields
manual_counts = Counter()       # manual sub-fields
costs_counts = Counter()        # manual.costs sub-fields

# Track which funds are missing critical fields
missing_name = []
missing_std_perf = []
missing_data_quality = []
missing_derived = []
missing_isin_field = []

# std_perf completeness
std_perf_complete = 0  # all key metrics present
std_perf_partial = 0

for doc in docs:
    data = doc.to_dict()
    
    # Top-level
    for k in data.keys():
        field_counts[k] += 1
    
    # Name check
    if not data.get('name'):
        missing_name.append(doc.id)
    
    # std_perf
    sp = data.get('std_perf')
    if sp and isinstance(sp, dict):
        for k in sp.keys():
            std_perf_counts[k] += 1
        # Check completeness of key metrics
        key_metrics = ['volatility', 'sharpe', 'cagr3y', 'max_drawdown']
        has_all = all(sp.get(m) is not None for m in key_metrics)
        if has_all:
            std_perf_complete += 1
        else:
            std_perf_partial += 1
    else:
        missing_std_perf.append(doc.id)
    
    # data_quality
    dq = data.get('data_quality')
    if dq and isinstance(dq, dict):
        for k in dq.keys():
            data_quality_counts[k] += 1
    else:
        missing_data_quality.append(doc.id)
    
    # derived
    dr = data.get('derived')
    if dr and isinstance(dr, dict):
        for k in dr.keys():
            derived_counts[k] += 1
    else:
        missing_derived.append(doc.id)
    
    # ms
    ms = data.get('ms')
    if ms and isinstance(ms, dict):
        for k in ms.keys():
            ms_counts[k] += 1
    
    # manual / costs
    mn = data.get('manual')
    if mn and isinstance(mn, dict):
        for k in mn.keys():
            manual_counts[k] += 1
        costs = mn.get('costs')
        if costs and isinstance(costs, dict):
            for k in costs.keys():
                costs_counts[k] += 1

# REPORT
print("=" * 60)
print("TOP-LEVEL FIELDS (campo: count / total)")
print("=" * 60)
for field, count in field_counts.most_common():
    pct = count / total * 100
    marker = " ⚠️" if pct < 100 else ""
    print(f"  {field:30s} {count:4d}/{total} ({pct:5.1f}%){marker}")

print(f"\n{'=' * 60}")
print(f"std_perf SUB-FIELDS ({total - len(missing_std_perf)} fondos lo tienen)")
print("=" * 60)
for field, count in std_perf_counts.most_common():
    pct = count / (total - len(missing_std_perf)) * 100 if (total - len(missing_std_perf)) > 0 else 0
    marker = " ⚠️" if pct < 100 else ""
    print(f"  {field:30s} {count:4d}/{total - len(missing_std_perf)} ({pct:5.1f}%){marker}")

print(f"\n  std_perf COMPLETO (4 métricas clave): {std_perf_complete}/{total}")
print(f"  std_perf PARCIAL: {std_perf_partial}")
print(f"  SIN std_perf: {len(missing_std_perf)}")

if missing_std_perf:
    print(f"  Fondos sin std_perf: {missing_std_perf[:10]}{'...' if len(missing_std_perf) > 10 else ''}")

print(f"\n{'=' * 60}")
print(f"data_quality SUB-FIELDS ({total - len(missing_data_quality)} fondos lo tienen)")
print("=" * 60)
for field, count in data_quality_counts.most_common():
    pct = count / (total - len(missing_data_quality)) * 100 if (total - len(missing_data_quality)) > 0 else 0
    print(f"  {field:30s} {count:4d}/{total - len(missing_data_quality)} ({pct:5.1f}%)")

print(f"  SIN data_quality: {len(missing_data_quality)}")
if missing_data_quality:
    print(f"  Fondos: {missing_data_quality[:10]}{'...' if len(missing_data_quality) > 10 else ''}")

print(f"\n{'=' * 60}")
print(f"derived SUB-FIELDS ({total - len(missing_derived)} fondos lo tienen)")
print("=" * 60)
for field, count in derived_counts.most_common():
    pct = count / (total - len(missing_derived)) * 100 if (total - len(missing_derived)) > 0 else 0
    print(f"  {field:30s} {count:4d}/{total - len(missing_derived)} ({pct:5.1f}%)")

print(f"  SIN derived: {len(missing_derived)}")
if missing_derived:
    print(f"  Fondos: {missing_derived[:10]}{'...' if len(missing_derived) > 10 else ''}")

print(f"\n{'=' * 60}")
print(f"ms (Morningstar) SUB-FIELDS")
print("=" * 60)
ms_total = field_counts.get('ms', 0)
for field, count in ms_counts.most_common():
    pct = count / ms_total * 100 if ms_total > 0 else 0
    print(f"  {field:30s} {count:4d}/{ms_total} ({pct:5.1f}%)")

print(f"\n{'=' * 60}")
print(f"manual.costs SUB-FIELDS")
print("=" * 60)
costs_total = costs_counts.total() // max(len(costs_counts), 1) if costs_counts else 0
for field, count in costs_counts.most_common():
    print(f"  {field:30s} {count:4d}")

# Missing name
if missing_name:
    print(f"\n⚠️ Fondos sin 'name': {missing_name[:10]}")
